import { createContext, useContext, useEffect, useState } from "react";

import { api, getToken, setToken } from "./api";
import { loadCache, saveCache } from "./lib/format";

const AuthContext = createContext(null);
const USER_KEY = "signal_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.me()
      .then((u) => {
        setUser(u);
        saveCache(USER_KEY, u);
      })
      .catch((e) => {
        if (e.status === 401) {
          // The token is genuinely invalid — drop it.
          setToken(null);
        } else {
          // Backend unreachable, not a bad token: keep the session from cache
          // so the app degrades to last-known data instead of a login wall.
          const cached = loadCache(USER_KEY);
          if (cached) setUser(cached.val);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function authenticate(fn, email, password) {
    const { access_token } = await fn(email, password);
    setToken(access_token);
    const u = await api.me();
    setUser(u);
    saveCache(USER_KEY, u);
  }

  const value = {
    user,
    loading,
    login: (email, password) => authenticate(api.login, email, password),
    register: (email, password) => authenticate(api.register, email, password),
    logout: () => {
      setToken(null);
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
