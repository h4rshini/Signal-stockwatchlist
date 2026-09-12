from dataclasses import dataclass
from statistics import mean, stdev

from .config import settings


@dataclass
class SignalResult:
    name: str
    fired: bool
    value: float        # raw ratio, e.g. 2.3 or 3.1 (0.0 when there isn't enough data)
    strength: float     # value normalised by its threshold, for combining (>=1 when fired)
    threshold: float    # the bar this signal has to clear
    reason: str | None  # concise flag text, set only when fired


def price_move_signal(closes: list[float]) -> SignalResult:
    """Latest daily return measured against the stock's own recent volatility.

    closes: daily closes, oldest first, latest last.
    """
    name = "price_move"
    threshold = settings.price_sigma_threshold
    # Need enough history for a meaningful baseline, plus today's move on top.
    if len(closes) < settings.min_baseline_days + 2:
        return SignalResult(name, False, 0.0, 0.0, threshold, None)

    returns = [
        (closes[i] - closes[i - 1]) / closes[i - 1]
        for i in range(1, len(closes))
        if closes[i - 1] != 0
    ]
    today, baseline = returns[-1], returns[:-1]

    sigma = stdev(baseline)
    if sigma < 1e-9:  # perfectly flat history, nothing to measure against
        return SignalResult(name, False, 0.0, 0.0, threshold, None)

    ratio = abs(today) / sigma
    strength = ratio / threshold
    if ratio < threshold:
        return SignalResult(name, False, ratio, strength, threshold, None)

    direction = "up" if today > 0 else "down"
    reason = f"Price moved {direction} {ratio:.1f}x its typical daily range"
    return SignalResult(name, True, ratio, strength, threshold, reason)


def volume_signal(volumes: list[int]) -> SignalResult:
    """Latest volume against recent average volume. volumes oldest first, latest last."""
    name = "volume"
    threshold = settings.volume_ratio_threshold
    if len(volumes) < settings.min_baseline_days + 1:
        return SignalResult(name, False, 0.0, 0.0, threshold, None)

    today, baseline = volumes[-1], volumes[:-1]
    avg = mean(baseline)
    if avg <= 0:
        return SignalResult(name, False, 0.0, 0.0, threshold, None)

    ratio = today / avg
    strength = ratio / threshold
    if ratio < threshold:
        return SignalResult(name, False, ratio, strength, threshold, None)

    reason = f"Volume was {ratio:.1f}x its recent average"
    return SignalResult(name, True, ratio, strength, threshold, reason)


def index_relative_signal(closes: list[float], index_return: float | None) -> SignalResult:
    """Today's move with the market's move removed, in units of the stock's volatility.

    index_return: the market proxy's return for the same day, or None if unavailable
    (in which case this signal simply doesn't fire).
    """
    name = "index_relative"
    threshold = settings.index_sigma_threshold
    if index_return is None or len(closes) < settings.min_baseline_days + 2:
        return SignalResult(name, False, 0.0, 0.0, threshold, None)

    returns = [
        (closes[i] - closes[i - 1]) / closes[i - 1]
        for i in range(1, len(closes))
        if closes[i - 1] != 0
    ]
    today, baseline = returns[-1], returns[:-1]

    sigma = stdev(baseline)
    if sigma < 1e-9:
        return SignalResult(name, False, 0.0, 0.0, threshold, None)

    ratio = abs(today - index_return) / sigma
    strength = ratio / threshold
    if ratio < threshold:
        return SignalResult(name, False, ratio, strength, threshold, None)

    reason = f"Moved {ratio:.1f}x its typical range independent of the market"
    return SignalResult(name, True, ratio, strength, threshold, reason)
