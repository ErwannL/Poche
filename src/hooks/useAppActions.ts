import { createContext, useContext } from 'react';

export interface AppActions {
  /** Relance immédiatement la file d'envoi. */
  sync: () => void;
}

export const AppActionsContext = createContext<AppActions>({ sync: () => undefined });

export const useAppActions = (): AppActions => useContext(AppActionsContext);
