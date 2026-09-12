const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "signal_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      // non-JSON error body; keep the status text
    }
    const err = new Error(detail);
    err.status = res.status;  // lets callers tell a 401 from a network failure
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  register: (email, password) =>
    request("/auth/register", { method: "POST", body: { email, password }, auth: false }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/me"),
  getWatchlist: () => request("/watchlist"),
  addTicker: (symbol) => request("/watchlist", { method: "POST", body: { symbol } }),
  removeTicker: (symbol) => request(`/watchlist/${symbol}`, { method: "DELETE" }),
  getFeed: () => request("/feed"),
  markSeen: () => request("/seen", { method: "POST" }),
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
  instrument: (symbol) => request(`/instrument/${encodeURIComponent(symbol)}`),
};
