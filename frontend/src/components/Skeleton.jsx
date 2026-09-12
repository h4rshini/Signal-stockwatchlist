export function FeedSkeleton() {
  return (
    <div>
      <div className="skel skel-scope" />
      <div className="skel skel-title" />
      {[0, 1].map((i) => (
        <div className="skel-card" key={i}>
          <div className="skel skel-badge" />
          <div className="skel skel-line long" />
          <div className="skel skel-line" />
          <div className="skel skel-line short" />
        </div>
      ))}
    </div>
  );
}

export function WatchlistSkeleton() {
  return (
    <div className="skel-rows">
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="skel skel-row" key={i} />
      ))}
    </div>
  );
}
