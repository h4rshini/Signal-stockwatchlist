const W = 600;
const H = 180;
const PAD = 8;

export default function DetailChart({ history, marks = [] }) {
  if (!history || history.length < 2) return <div className="chart-empty">No price history yet.</div>;

  const closes = history.map((h) => h.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const step = (W - PAD * 2) / (closes.length - 1);
  const x = (i) => PAD + i * step;
  const y = (v) => PAD + (H - PAD * 2) * (1 - (v - min) / range);

  const line = closes.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} ${x(closes.length - 1).toFixed(1)},${H - PAD} ${x(0).toFixed(1)},${H - PAD}`;
  const cls = closes[closes.length - 1] >= closes[0] ? "up" : "down";

  // Backtest marks are positioned as a percentage of the chart box, so they line
  // up with the line even though the SVG stretches to fill the width.
  const dateIndex = new Map(history.map((h, i) => [h.date, i]));
  const dots = marks
    .map((m) => ({ i: dateIndex.get(m.date), confidence: m.confidence }))
    .filter((d) => d.i != null)
    .map((d) => ({
      left: (x(d.i) / W) * 100,
      top: (y(closes[d.i]) / H) * 100,
      confidence: d.confidence,
    }));

  return (
    <div className="chart-wrap">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <polygon className={`chart-area ${cls}`} points={area} />
        <polyline className={`chart-line ${cls}`} points={line} />
      </svg>
      {dots.map((d, i) => (
        <span
          key={i}
          className={`chart-mark ${d.confidence}`}
          style={{ left: `${d.left}%`, top: `${d.top}%` }}
          title={`${d.confidence} flag`}
        />
      ))}
    </div>
  );
}
