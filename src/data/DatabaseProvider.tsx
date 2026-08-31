import { createContext, useContext, type ReactNode } from 'react';

import type { AppInit } from './db';

const DatabaseContext = createContext<AppInit | null>(null);

export function DatabaseProvider({ value, children }: { value: AppInit; children: ReactNode }) {
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): AppInit {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used within a DatabaseProvider');
  return ctx;
}
