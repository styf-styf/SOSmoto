import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useActiveHelpRequest } from './useActiveHelpRequest';
import type { HelpRequest } from '../types/database';

interface ActiveHelpRequestContextValue {
  activeRequest: HelpRequest | null;
  setActiveRequest: (request: HelpRequest | null) => void;
  completedRequest: HelpRequest | null;
  clearCompletedRequest: () => void;
  refresh: () => Promise<void>;
}

const ActiveHelpRequestContext = createContext<ActiveHelpRequestContextValue | null>(null);

export function ActiveHelpRequestProvider({
  clientId,
  children,
}: {
  clientId: string | undefined;
  children: ReactNode;
}) {
  const value = useActiveHelpRequest(clientId);
  return <ActiveHelpRequestContext.Provider value={value}>{children}</ActiveHelpRequestContext.Provider>;
}

export function useActiveHelpRequestContext() {
  const context = useContext(ActiveHelpRequestContext);
  if (!context) {
    throw new Error('useActiveHelpRequestContext must be used within ActiveHelpRequestProvider');
  }
  return context;
}
