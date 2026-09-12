from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .deps import get_current_user, get_db
from .engine import evaluate, index_return_for
from .models import ChangeEvent, Instrument, Observation, User
from .schemas import HistoryPoint, InstrumentDetail, SignalStatus

router = APIRouter(tags=["detail"])

HISTORY_BARS = 60

SIGNAL_LABELS = {"price_move": "Price", "volume": "Volume", "index_relative": "Vs. market"}


def _describe(s) -> SignalStatus:
    label = SIGNAL_LABELS.get(s.name, s.name)
    if not s.fired and s.value == 0:
        note = "no market data to compare" if s.name == "index_relative" else "not enough data yet"
        return SignalStatus(label=label, fired=False, detail=note)
    if s.name == "price_move":
        base = f"moved {s.value:.1f}x its typical daily range"
    elif s.name == "volume":
        base = f"was {s.value:.1f}x its recent average"
    else:
        base = f"moved {s.value:.1f}x its typical range vs the market"
    tail = "active" if s.fired else f"below the {s.threshold:.1f}x mark"
    return SignalStatus(label=label, fired=s.fired, detail=f"{base} — {tail}")


@router.get("/instrument/{symbol}", response_model=InstrumentDetail)
def instrument_detail(symbol: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    symbol = symbol.strip().upper()
    inst = db.scalar(select(Instrument).where(Instrument.symbol == symbol))
    if inst is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown symbol")

    obs = db.scalars(
        select(Observation)
        .where(Observation.instrument_id == inst.id)
        .order_by(Observation.bar_date.desc())
        .limit(HISTORY_BARS)
    ).all()
    obs = list(reversed(obs))
    latest = obs[-1] if obs else None
    prev = obs[-2] if len(obs) >= 2 else None

    change_pct = None
    if latest and prev and prev.close:
        change_pct = round((latest.close - prev.close) / prev.close * 100, 2)

    cutoff = date.today() - timedelta(days=settings.lookback_cap_days)
    event = db.scalar(
        select(ChangeEvent)
        .where(ChangeEvent.instrument_id == inst.id, ChangeEvent.window_end >= cutoff)
        .order_by(ChangeEvent.window_end.desc())
        .limit(1)
    )

    since = None
    if user.last_seen_at and latest:
        base = db.scalar(
            select(Observation)
            .where(Observation.instrument_id == inst.id, Observation.bar_date <= user.last_seen_at.date())
            .order_by(Observation.bar_date.desc())
            .limit(1)
        )
        if base and base.close:
            since = round((latest.close - base.close) / base.close * 100, 1)

    # Live per-signal breakdown for the latest bar — reuses the engine, reads
    # stored bars only (no provider call), and explains a non-flag too.
    recent = obs[-settings.baseline_bars:]
    index_return = None
    if latest and inst.symbol != settings.index_symbol:
        index_return = index_return_for(db, latest.bar_date)
    result = evaluate([o.close for o in recent], [o.volume for o in recent], index_return)
    breakdown = [_describe(s) for s in result.signals]
    active = sum(1 for s in result.signals if s.fired)
    verdict = (
        f"{active} of 3 signals active — flagged ({result.confidence} confidence)"
        if result.flagged
        else f"{active} of 3 signals active — not flagged (needs 2)"
    )

    return InstrumentDetail(
        symbol=inst.symbol,
        name=inst.name,
        latest_close=latest.close if latest else None,
        latest_date=latest.bar_date if latest else None,
        change_pct=change_pct,
        history=[HistoryPoint(date=o.bar_date, close=o.close) for o in obs],
        flagged=event is not None,
        confidence=event.confidence if event else None,
        score=event.score if event else None,
        reasons=event.reasons if event else [],
        flagged_on=event.window_end if event else None,
        since_last_seen_pct=since,
        breakdown=breakdown,
        verdict=verdict,
    )
