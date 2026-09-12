import { useDetail } from "../detail";
import { formatPct, formatPrice, relativeTime } from "../lib/format";

export default function FeedCard({ item, index = 0 }) {
  const { open } = useDetail();
  const pct = item.since_last_seen_pct;

  return (
    <article
      className={`card clickable ${item.confidence}`}
      style={{ animationDelay: `${index * 0.08}s` }}
      onClick={() => open(item.symbol)}
    >
      <div className="card-top">
        <div className="card-idblock">
          <span className={`conf-badge ${item.confidence}`}>{item.confidence}</span>
          <span className="card-symbol">{item.symbol}</span>
          {item.name && <span className="card-name">{item.name}</span>}
        </div>
        {item.latest_close != null && (
          <div className="card-price">
            <span className="p">{formatPrice(item.latest_close)}</span>
          </div>
        )}
      </div>

      <ul className="reasons">
        {item.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      <div className="card-context">
        <span className="context-tag">context</span>
        {pct != null && (
          <span>
            <span className={pct >= 0 ? "pct-up" : "pct-down"}>{formatPct(pct, 1)}</span> since you
            last looked
          </span>
        )}
        {pct != null && <span aria-hidden>·</span>}
        <span>flagged {relativeTime(item.flagged_on)}</span>
      </div>
    </article>
  );
}
