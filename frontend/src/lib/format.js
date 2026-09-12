export function relativeTime(value) {
  if (!value) return "";
  // Date-only strings (YYYY-MM-DD) are treated as local midnight.
  const then = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  const secs = Math.round((Date.now() - then.getTime()) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export const formatPct = (n, digits = 2) =>
  n == null ? "" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;

export const formatPrice = (n) =>
  n == null ? "" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatVolume = (n) => (n == null ? "" : n.toLocaleString("en-US"));

// Small last-known-good cache so a backend hiccup shows stale data, not a blank.
export function loadCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCache(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), val }));
  } catch {
    // storage unavailable (private mode etc.) — caching is best-effort
  }
}
