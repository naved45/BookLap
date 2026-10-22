import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { api('/auth/me').then((d) => setUser(d.user)).catch(() => setUser(null)).finally(() => setReady(true)); }, []);
  const login = useCallback(async (b) => setUser((await api('/auth/login', { method: 'POST', body: b })).user), []);
  const register = useCallback(async (b) => setUser((await api('/auth/register', { method: 'POST', body: b })).user), []);
  const logout = useCallback(async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); }, []);
  return <Ctx.Provider value={{ user, ready, login, register, logout, setUser }}>{children}</Ctx.Provider>;
}
