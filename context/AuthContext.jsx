"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { API_BASE } from "@/lib/invoiceUtils";

const TOKEN_KEY = "token";

const AuthContext = createContext(null);

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function AuthProvider({ children }) {
  // Start null on both server and client render to avoid hydration mismatch.
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Hydrate stored token and validate against /api/auth/me once on mount.
  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      const stored = readStoredToken();
      if (!stored) {
        await Promise.resolve();
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setIsLoaded(true);
        }
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.success) {
          setToken(stored);
          setUser(data.user);
        } else {
          setToken(null);
          setUser(null);
          writeStoredToken(null);
        }
      } catch {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    }

    initAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    writeStoredToken(nextToken);
    setUser(nextUser || null);
    setIsLoaded(true);
  }, []);

  const register = useCallback(
    async ({ name, email, password }) => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          return { ok: false, error: data.message || "Registration failed" };
        }
        applySession(data.token, data.user);
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error" };
      }
    },
    [applySession]
  );

  const login = useCallback(
    async ({ email, password }) => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          return { ok: false, error: data.message || "Login failed" };
        }
        applySession(data.token, data.user);
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error" };
      }
    },
    [applySession]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    writeStoredToken(null);
  }, []);

  // Accepts (and ignores) an options arg for drop-in compatibility.
  const getToken = useCallback(async () => readStoredToken(), []);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoaded,
      isSignedIn: Boolean(token && user),
      getToken,
      login,
      register,
      logout,
      signOut: logout,
    }),
    [user, token, isLoaded, getToken, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}

export function SignedIn({ children }) {
  const { isSignedIn } = useAuth();
  return isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }) {
  const { isSignedIn, isLoaded } = useAuth();
  return isLoaded && !isSignedIn ? <>{children}</> : null;
}
