import { useEffect, useState } from "react";

import { api } from "../api";
import { useDetail } from "../detail";
import { formatPct, formatPrice, relativeTime } from "../lib/format";
import DetailChart from "./DetailChart";
import SignalMeter from "./SignalMeter";

export default function StockDetail() {
  const { symbol, close } = useDetail();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) return;
    setData(null);
    setError(null);
    api.instrument(symbol).then(setData).catch((e) => setError(e.message));
  }, [symbol]);

  if (!symbol) return null;

  const pct = data?.since_last_seen_pct;

  return (
    <div className="modal-scrim" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={close} aria-label="Close">
          ×
        </button>

        {error && <div className="state">Couldn’t load {symbol}: {error}</div>}
        {!data && !error && <div className="state">Loading…</div>}

        {data && (
          <>
            <div className="detail-head">
              <div className="detail-id">
                <span className="detail-symbol mono">{data.symbol}</span>
                {data.flagged && <span className={`conf-badge ${data.confidence}`}>{data.confidence}</span>}
              </div>
              <div className="detail-price">
                {data.latest_close != null && <span>{formatPrice(data.latest_close)}</span>}
                {data.change_pct != null && (
                  <span className={data.change_pct >= 0 ? "pct-up" : "pct-down"}>
                    {formatPct(data.change_pct, 2)}
                  </span>
                )}
              </div>
            </div>
            {data.latest_date && (
              <div className="detail-meta">as of {relativeTime(data.latest_date)}</div>
            )}

            <DetailChart history={data.history} marks={data.backtest} />
            <div className="chart-caption">
              {data.backtest.length > 0
                ? `${data.backtest.length} day${data.backtest.length > 1 ? "s" : ""} the engine would have flagged in this window`
                : "No flags in this window — the engine stayed quiet"}
            </div>

            {data.flagged ? (
              <div className={`detail-signals ${data.confidence}`}>
                <div className="detail-signals-head">
                  <SignalMeter confidence={data.confidence} />
                  <span className="confidence-label">
                    {data.confidence} confidence · flagged {relativeTime(data.flagged_on)}
                  </span>
                </div>
                <ul className="reasons">
                  {data.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="breakdown">
                <div className="breakdown-verdict">{data.verdict}</div>
                <ul className="breakdown-list">
                  {data.breakdown.map((b, i) => (
                    <li key={i} className={b.fired ? "bd-fired" : ""}>
                      <span className="bd-label">{b.label}</span>
                      <span className="bd-detail">{b.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {pct != null && (
              <p className="detail-context">
                <span className={pct >= 0 ? "pct-up" : "pct-down"}>{formatPct(pct, 1)}</span> since you
                last looked — context only, not a signal.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
