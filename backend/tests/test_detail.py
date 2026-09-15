from datetime import date, timedelta

from app.models import Instrument, Observation


def _seed_quiet(db, symbol="ABC", n=25):
    inst = Instrument(symbol=symbol)
    db.add(inst)
    db.flush()
    start = date.today() - timedelta(days=n)
    for i in range(n):
        close = 100.0 if i % 2 == 0 else 101.0  # ~1% daily wobble, well below 2 sigma
        db.add(Observation(instrument_id=inst.id, bar_date=start + timedelta(days=i),
                           open=close, high=close, low=close, close=close, volume=1000))
    db.commit()
    return inst


def test_detail_requires_auth(client):
    assert client.get("/instrument/ABC").status_code == 401


def test_unknown_symbol_404(client, auth_headers):
    assert client.get("/instrument/NOPE", headers=auth_headers).status_code == 404


def test_backtest_marks_a_spike_day(client, auth_headers, db):
    inst = Instrument(symbol="SPK")
    db.add(inst)
    db.flush()
    start = date.today() - timedelta(days=30)
    closes = [100.0 if i % 2 == 0 else 101.0 for i in range(29)] + [120.0]  # spike last day
    vols = [100] * 29 + [400]  # volume spike too -> two signals -> flags
    for i, (c, v) in enumerate(zip(closes, vols)):
        db.add(Observation(instrument_id=inst.id, bar_date=start + timedelta(days=i),
                           open=c, high=c, low=c, close=c, volume=v))
    db.commit()

    body = client.get("/instrument/SPK", headers=auth_headers).json()
    assert len(body["backtest"]) >= 1
    assert any(m["date"] == (start + timedelta(days=29)).isoformat() for m in body["backtest"])


def test_breakdown_explains_a_non_flag(client, auth_headers, db):
    _seed_quiet(db)
    body = client.get("/instrument/ABC", headers=auth_headers).json()
    assert body["flagged"] is False
    assert len(body["breakdown"]) == 3
    assert "not flagged" in body["verdict"]
    # A quiet stock's price signal is present but under its threshold.
    price = next(b for b in body["breakdown"] if b["label"] == "Price")
    assert price["fired"] is False
    assert "below the" in price["detail"]
