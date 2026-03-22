import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { getApiBaseUrl, getToken } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setSocket((prev) => {
        prev?.disconnect();
        return null;
      });
      setConnected(false);
      return undefined;
    }
    const token = getToken();
    if (!token) return undefined;

    const base = getApiBaseUrl();
    const opts = {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    };
    const s = base ? io(base, opts) : io(opts);

    setSocket(s);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    return () => {
      s.disconnect();
      setConnected(false);
    };
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      socket,
      connected,
    }),
    [socket, connected]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket outside SocketProvider');
  return ctx;
}
