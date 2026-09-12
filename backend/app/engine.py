from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import ChangeEvent, Instrument, Observation
from .signals import (
    SignalResult,
    index_relative_signal,
    price_move_signal,
    volume_signal,
)

# A single signal is treated as noise; a flag needs corroboration.
CO_OCCURRENCE_MIN = 2


@dataclass
class EngineResult:
    flagged: bool
    confidence: str | None   # "medium" | "high"
    score: float
    reasons: list[str]
    signals: list[SignalResult]


def evaluate(closes: list[float], volumes: list[int], index_return: float | None = None) -> EngineResult:
    signals = [
        price_move_signal(closes),
        volume_signal(volumes),
        index_relative_signal(closes, index_return),
    ]
    fired = [s for s in signals if s.fired]

    if len(fired) < CO_OCCURRENCE_MIN:
        return EngineResult(False, None, 0.0, [], signals)

    score = sum(s.strength for s in fired)
    confidence = "high" if score >= settings.high_confidence_score else "medium"
    reasons = [s.reason for s in fired]
    return EngineResult(True, confidence, score, reasons, signals)


def index_return_for(session: Session, on_date) -> float | None:
    idx = session.scalar(select(Instrument).where(Instrument.symbol == settings.index_symbol))
    if idx is None:
        return None
    bars = session.scalars(
        select(Observation)
        .where(Observation.instrument_id == idx.id, Observation.bar_date <= on_date)
        .order_by(Observation.bar_date.desc())
        .limit(2)
    ).all()
    # Require the proxy to have the same day, so we compare like-for-like.
    if len(bars) < 2 or bars[0].bar_date != on_date or bars[1].close == 0:
        return None
    return (bars[0].close - bars[1].close) / bars[1].close


def evaluate_instrument(session: Session, instrument: Instrument) -> ChangeEvent | None:
    """Evaluate an instrument's latest bar and persist a flag if one fires."""
    bars = session.scalars(
        select(Observation)
        .where(Observation.instrument_id == instrument.id)
        .order_by(Observation.bar_date.desc())
        .limit(settings.baseline_bars)
    ).all()
    bars = list(reversed(bars))  # back to oldest-first for the signals
    if not bars:
        return None

    latest_date = bars[-1].bar_date
    existing = session.scalar(
        select(ChangeEvent).where(
            ChangeEvent.instrument_id == instrument.id,
            ChangeEvent.window_end == latest_date,
        )
    )
    if existing is not None:
        return existing

    index_return = None
    if instrument.symbol != settings.index_symbol:
        index_return = index_return_for(session, latest_date)
    result = evaluate([b.close for b in bars], [b.volume for b in bars], index_return)
    if not result.flagged:
        return None

    event = ChangeEvent(
        instrument_id=instrument.id,
        window_start=bars[0].bar_date,
        window_end=latest_date,
        confidence=result.confidence,
        score=result.score,
        reasons=result.reasons,
    )
    session.add(event)
    session.commit()
    return event
