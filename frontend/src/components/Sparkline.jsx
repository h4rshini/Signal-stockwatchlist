export default function Sparkline({ data, up, width = 120, height = 30 }) {
  if (!data || data.length < 2) return <span className="spark-empty" style={{ width }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  // Color by the caller's sign (the daily % change) when given, so the line
  // matches the change shown beside it; else fall back to the window's trend.
  const rising = up != null ? up : data[data.length - 1] >= data[0];

  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} className={rising ? "spark-up" : "spark-down"} />
    </svg>
  );
}
