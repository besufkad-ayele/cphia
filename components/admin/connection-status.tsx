'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ConnectionStatusContextValue = {
  notice: string | null;
  setNotice: (message: string | null) => void;
};

const ConnectionStatusContext = createContext<ConnectionStatusContextValue | null>(null);

export function ConnectionStatusProvider({ children }: { children: ReactNode }) {
  const [notice, setNoticeState] = useState<string | null>(null);
  const setNotice = useCallback((message: string | null) => {
    setNoticeState(message);
  }, []);
  const value = useMemo(() => ({ notice, setNotice }), [notice, setNotice]);
  return <ConnectionStatusContext.Provider value={value}>{children}</ConnectionStatusContext.Provider>;
}

export function useConnectionStatus() {
  const context = useContext(ConnectionStatusContext);
  if (!context) {
    throw new Error('useConnectionStatus must be used within ConnectionStatusProvider');
  }
  return context;
}
