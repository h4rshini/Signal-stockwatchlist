import { useEffect, useState } from "react";

import { api } from "../api";
import { useDetail } from "../detail";
import { formatPct, formatPrice, loadCache, saveCache } from "../lib/format";
import SearchAdd from "./SearchAdd";
import Sparkline from "./Sparkline";
import { WatchlistSkeleton } from "./Skeleton";

const CACHE_KEY = "signal_watchlist";

export default function Watchlist() {
  const { open } = useDetail();
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | stale | error

  function load() {
    api.getWatchlist()
      .then((d) => {
        setItems(d);
        setStatus("ok");
        saveCache(CACHE_KEY, d);
      })
      .catch(() => {
        const cached = loadCache(CACHE_KEY);
        if (cached) {
          setItems(cached.val);
          setStatus("stale");
        } else {
          setStatus("error");
        }
      });
  }

  useEffect(load, []);

  function afterAdd() {
    load();
    // Price + sparkline fill in from the background fetch; pick them up shortly.
    setTimeout(load, 2500);
  }

  async function remove(sym) {
    await api.removeTicker(sym);
    load();
  }

  const count = items ? items.length : null;

  return (
    <section>
      <div className="wl-headrow">
        <div>
          <h1 className="feed-title">Watchlist</h1>
          <div className="feed-sub">
            {count == null
              ? "Everything you track"
              : `${count} ${count === 1 ? "stock" : "stocks"} tracked`}
          </div>
        </div>
      </div>

      <SearchAdd onAdd={afterAdd} />

      {status === "stale" && (
        <div className="offline-banner">
          Can’t reach the server — showing the last data you loaded.
        </div>
      )}

      {status === "loading" && <WatchlistSkeleton />}
      {status === "error" && (
        <div className="state">Can’t reach the server right now. Try again in a moment.</div>
      )}

      {items && items.length === 0 && status !== "loading" && (
        <div className="state">No stocks yet. Search above to start tracking.</div>
      )}

      {items && items.length > 0 && (
        <ul className="wl">
          {items.map((it) => {
            const pending = it.latest_close == null;
            return (
              <li key={it.symbol} className="wl-row" onClick={() => open(it.symbol)}>
                <div className="wl-id">
                  {it.confidence && (
                    <span className={`conf-badge ${it.confidence}`}>{it.confidence}</span>
                  )}
                  <span className="wl-symbol mono">{it.symbol}</span>
                </div>

                <Sparkline
                  data={it.spark}
                  up={it.change_pct != null ? it.change_pct >= 0 : undefined}
                />

                <div className="wl-nums">
                  {pending ? (
                    <span className="muted" style={{ fontSize: 13 }}>fetching…</span>
                  ) : (
                    <>
                      <span className="wl-price">{formatPrice(it.latest_close)}</span>
                      {it.change_pct != null && (
                        <span className={`wl-change ${it.change_pct >= 0 ? "pct-up" : "pct-down"}`}>
                          {formatPct(it.change_pct, 2)}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <button
                  className="wl-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(it.symbol);
                  }}
                  aria-label={`Remove ${it.symbol}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
