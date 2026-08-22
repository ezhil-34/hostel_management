import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, tokenStore, ApiRequestError } from '../lib/api';

const AuthContext = createContext(null);

const USER_KEY = 'hostel_user';

const readCachedUser = () => {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const cacheUser = (user) => {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
};

export const AuthProvider = ({ children }) => {
  // Start from the cached user so a refresh does not flash the signed-out UI,
  // then confirm against the server.
  const [user, setUser] = useState(readCachedUser);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback(({ user: nextUser, accessToken }) => {
    if (accessToken) tokenStore.set(accessToken);
    setUser(nextUser);
    cacheUser(nextUser);
    return nextUser;
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    cacheUser(null);
  }, []);

  // Revalidate on mount: the cached user may be stale or the session expired.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!tokenStore.get() && !readCachedUser()) {
        setIsLoading(false);
        return;
      }
      try {
        const { user: fresh } = await authApi.me();
        if (!cancelled) applySession({ user: fresh });
      } catch (err) {
        if (cancelled) return;
        // Only a genuine 401 means the session is gone. A network failure or a
        // 5xx means the *server* is having a moment — throwing the user out and
        // wiping their cached session over a backend restart is not acceptable.
        if (err instanceof ApiRequestError && err.status === 401) {
          clearSession();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (identifier, password) => applySession(await authApi.signin({ identifier, password })),
    [applySession],
  );

  const signup = useCallback(
    async (payload) => applySession(await authApi.signup(payload)),
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  /** Called after a profile save so the header and cache show the new details. */
  const setUserData = useCallback((nextUser) => applySession({ user: nextUser }), [applySession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        signup,
        logout,
        setUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an <AuthProvider>');
  return ctx;
};
