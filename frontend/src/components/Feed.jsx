import { useEffect, useState } from "react";

import { api } from "../api";
import { loadCache, relativeTime, saveCache } from "../lib/format";
import FeedCard from "./FeedCard";
import SignalScope from "./SignalScope";
import { FeedSkeleton } from "./Skeleton";

const CACHE_KEY = "signal_feed";

function subtitle(feed) {
  if (feed.last_seen_at == null) return "Your first look — showing the last 30 days.";
  return `Since you last reviewed ${relativeTime(feed.last_seen_at)}`;
}

export default function Feed() {
  const [feed, setFeed] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | stale | error
  const [reviewing, setReviewing] = useState(false);

  function load() {
    api.getFeed()
      .then((d) => {
        setFeed(d);
        setStatus("ok");
        saveCache(CACHE_KEY, d);
      })
      .catch(() => {
        const cached = loadCache(CACHE_KEY);
        if (cached) {
          setFeed(cached.val);
          setStatus("stale");
        } else {
          setStatus("error");
        }
      });
  }

  useEffect(load, []);

  async function review() {
    setReviewing(true);
    try {
      await api.markSeen();
      load();
    } finally {
      setReviewing(false);
    }
  }

  if (status === "loading") return <FeedSkeleton />;
  if (status === "error") {
    return (
      <div className="state">
        Can’t reach the server right now, and there’s no saved data to show. Try again in a moment.
      </div>
    );
  }

  const n = feed.items.length;
  const headline = n === 0 ? "All quiet." : `${n} signal${n > 1 ? "s" : ""}`;

  return (
    <section>
      {status === "stale" && (
        <div className="offline-banner">
          Can’t reach the server — showing the last data you loaded.
        </div>
      )}

      <div className="scope-wrap">
        <SignalScope items={feed.items} />
      </div>

      <div className="feed-head">
        <div>
          <h1 className="feed-title">{headline}</h1>
          <div className="feed-sub">{subtitle(feed)}</div>
        </div>
        {n > 0 && (
          <button
            className="review-btn"
            onClick={review}
            disabled={reviewing || status === "stale"}
          >
            {reviewing ? "Marking…" : "✓ Mark as reviewed"}
          </button>
        )}
      </div>

      {n > 0 ? (
        feed.items.map((item, i) => <FeedCard key={item.symbol} item={item} index={i} />)
      ) : (
        <p className="quiet-note">Nothing in your watchlist needs your attention right now.</p>
      )}
    </section>
  );
}
