import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001") + "/api";
const TOKEN_KEY = "eliza_token";

const AuthContext = createContext(null);

function applySettings(settings) {
  if (!settings || typeof settings !== "object") return;
  const root = document.documentElement;
  if (settings.theme) {
    root.setAttribute("data-theme", settings.theme);
  }
  if (settings.accent_color) {
    root.style.setProperty("--accent-color", settings.accent_color);
  }
  if (settings.table_density) {
    root.setAttribute("data-density", settings.table_density);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Invalid token");
        return r.json();
      })
      .then((data) => {
        setUser(data.user);
        applySettings(data.user?.settings);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setLoading(false);
      });
  }, []);

  async function login(identifier, password, remember) {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password, remember }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    applySettings(data.user?.settings);
    return data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    // Reset to defaults
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.removeAttribute("data-density");
    document.documentElement.style.removeProperty("--accent-color");
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  const updateSettings = useCallback(
    (newSettings) => {
      // Optimistic local update
      setUser((prev) => {
        if (!prev) return prev;
        const merged = { ...(prev.settings || {}), ...newSettings };
        return { ...prev, settings: merged };
      });
      applySettings(newSettings);

      // Debounced save to API
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;
        try {
          await fetch(`${API}/auth/settings`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ settings: newSettings }),
          });
        } catch (err) {
          console.error("Failed to save settings:", err);
        }
      }, 500);
    },
    []
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getToken, updateSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
