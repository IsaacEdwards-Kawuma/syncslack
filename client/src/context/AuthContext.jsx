import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: u } = await api('/auth/me');
      setUser(u);
      applyThemeClass(u.theme);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    applyThemeClass(data.user.theme);
    return data.user;
  };

  const register = async (email, password, name) => {
    const data = await api('/auth/register', { method: 'POST', body: { email, password, name } });
    setToken(data.token);
    setUser(data.user);
    applyThemeClass(data.user.theme);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    document.documentElement.classList.remove('dark');
  };

  const setTheme = async (theme) => {
    const { user: u } = await api('/auth/me/theme', { method: 'PATCH', body: { theme } });
    setUser(u);
    applyThemeClass(u.theme);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refresh,
      setTheme,
      isAuthenticated: !!user,
    }),
    [user, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}

function applyThemeClass(theme) {
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}
