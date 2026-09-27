import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

export const useOnline = (): boolean => useSyncExternalStore(subscribe, () => navigator.onLine);
