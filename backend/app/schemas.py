from datetime import date, datetime

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TickerRequest(BaseModel):
    symbol: str


class WatchlistItemOut(BaseModel):
    symbol: str
    name: str | None
    added_at: datetime
    # Null right after adding, until the background fetch fills it in.
    latest_close: float | None
    latest_date: date | None
    change_pct: float | None       # latest close vs the prior day
    spark: list[float]             # recent closes, oldest first, for a sparkline
    flagged: bool                  # has a recent change event
    confidence: str | None         # "high"|"medium" of the most recent flag, else None


class FeedEntry(BaseModel):
    symbol: str
    name: str | None
    confidence: str
    score: float
    reasons: list[str]
    flagged_on: date
    latest_close: float | None
    # Plain context, not a signal: percent change since the user's last visit.
    since_last_seen_pct: float | None


class FeedResponse(BaseModel):
    last_seen_at: datetime | None
    window_days: int
    items: list[FeedEntry]


class HistoryPoint(BaseModel):
    date: date
    close: float


class SignalStatus(BaseModel):
    label: str
    fired: bool
    detail: str  # e.g. "moved 1.3x its typical daily range — below the 2.0x mark"


class InstrumentDetail(BaseModel):
    symbol: str
    name: str | None
    latest_close: float | None
    latest_date: date | None
    change_pct: float | None
    history: list[HistoryPoint]
    flagged: bool
    confidence: str | None
    score: float | None
    reasons: list[str]
    flagged_on: date | None
    since_last_seen_pct: float | None
    # Per-signal status for the latest bar — explains a non-flag as much as a flag.
    breakdown: list[SignalStatus]
    verdict: str
