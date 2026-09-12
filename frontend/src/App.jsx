import { useState } from "react";

import { AuthProvider, useAuth } from "./auth";
import { DetailProvider } from "./detail";
import AuthScreen from "./components/AuthScreen";
import Feed from "./components/Feed";
import StockDetail from "./components/StockDetail";
import Watchlist from "./components/Watchlist";

function Shell() {
  const { user, loading, logout } = useAuth();
  const [view, setView] = useState("feed");

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <AuthScreen />;

  return (
    <DetailProvider>
      <div className="app">
        <header className="topbar">
          <span className="brand small">Signal</span>
          <nav className="nav">
            <button
              className={view === "feed" ? "nav-tab active" : "nav-tab"}
              onClick={() => setView("feed")}
            >
              Attention
            </button>
            <button
              className={view === "watchlist" ? "nav-tab active" : "nav-tab"}
              onClick={() => setView("watchlist")}
            >
              Watchlist
            </button>
          </nav>
          <div className="spacer" />
          <span className="email">{user.email}</span>
          <button className="link" onClick={logout}>
            Log out
          </button>
        </header>
        <main className="content">{view === "feed" ? <Feed /> : <Watchlist />}</main>
      </div>
      <StockDetail />
    </DetailProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
