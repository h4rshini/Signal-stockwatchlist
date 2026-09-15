from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import Instrument, Observation

BASE_URL = "https://api.twelvedata.com/time_series"
SEARCH_URL = "https://api.twelvedata.com/symbol_search"


class FetchError(Exception):
    """The provider couldn't return usable bars (bad symbol, rate limit, downtime)."""


# The app tracks US equities (daily bars are reliable on the free tier, and the
# index signal compares against SPY), so suggestions are scoped to those.
_SEARCH_TYPES = {"Common Stock", "ETF"}


def search_symbols(query: str, limit: int = 8) -> list[dict]:
    # Over-fetch, then filter to US common stocks/ETFs and take the top matches.
    params = {"symbol": query, "outputsize": 40, "apikey": settings.twelvedata_api_key}
    try:
        resp = httpx.get(SEARCH_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        payload = resp.json()
    except httpx.HTTPStatusError as e:
        raise FetchError(f"provider returned {e.response.status_code}") from None
    except httpx.HTTPError:
        raise FetchError("search request failed") from None

    results, seen = [], set()
    for d in payload.get("data", []):
        symbol = d.get("symbol")
        if symbol in seen:  # same ticker often repeats across exchanges
            continue
        if d.get("country") != "United States":
            continue
        if d.get("instrument_type") not in _SEARCH_TYPES:
            continue
        seen.add(symbol)
        results.append({
            "symbol": symbol,
            "name": d.get("instrument_name"),
            "exchange": d.get("exchange"),
            "type": d.get("instrument_type"),
        })
        if len(results) >= limit:
            break
    return results


def fetch_daily_bars(symbol: str, days: int = 35) -> list[dict]:
    params = {
        "symbol": symbol,
        "interval": "1day",
        "outputsize": days,
        "apikey": settings.twelvedata_api_key,
    }
    try:
        resp = httpx.get(BASE_URL, params=params, timeout=10.0)
        resp.raise_for_status()
        payload = resp.json()
    except httpx.HTTPStatusError as e:
        # Don't chain: the underlying error carries the URL, which contains the api key.
        raise FetchError(f"provider returned {e.response.status_code} for {symbol}") from None
    except httpx.HTTPError:
        raise FetchError(f"request to provider failed for {symbol}") from None

    # The provider reports errors in the body with a 200, so check status here.
    if payload.get("status") == "error":
        raise FetchError(payload.get("message", "unknown provider error"))

    values = payload.get("values")
    if not values:
        raise FetchError(f"no data returned for {symbol}")

    return [_normalize_bar(v) for v in values]


def _normalize_bar(v: dict) -> dict:
    return {
        "bar_date": datetime.strptime(v["datetime"], "%Y-%m-%d").date(),
        "open": float(v["open"]),
        "high": float(v["high"]),
        "low": float(v["low"]),
        "close": float(v["close"]),
        # Volume is missing or "0" for some symbols; treat that as zero rather than fail.
        "volume": int(float(v["volume"])) if v.get("volume") else 0,
    }


def get_or_create_instrument(session: Session, symbol: str) -> Instrument:
    symbol = symbol.upper()
    inst = session.scalar(select(Instrument).where(Instrument.symbol == symbol))
    if inst is None:
        inst = Instrument(symbol=symbol)
        session.add(inst)
        session.flush()  # need inst.id before attaching observations
    return inst


def store_bars(session: Session, symbol: str, bars: list[dict]) -> int:
    inst = get_or_create_instrument(session, symbol)
    existing = set(
        session.scalars(
            select(Observation.bar_date).where(Observation.instrument_id == inst.id)
        )
    )
    added = 0
    for bar in bars:
        if bar["bar_date"] in existing:
            continue
        session.add(Observation(instrument_id=inst.id, **bar))
        added += 1
    session.commit()
    return added


def refresh_symbol(session: Session, symbol: str, days: int = 35) -> int:
    """Fetch a symbol's recent daily bars and store the new ones. Returns count added."""
    bars = fetch_daily_bars(symbol, days)
    return store_bars(session, symbol, bars)
