import { useEffect, useState } from 'react';
import { onChange, type ChangeTopic } from '../lib/events';

/**
 * Charge une donnée locale et la recharge à chaque changement signalé sur l'un
 * des sujets (y compris depuis le service worker ou un autre onglet).
 */
export function useLive<T>(
  load: () => Promise<T>,
  topics: readonly ChangeTopic[],
  /** Clé supplémentaire : la donnée est rechargée quand elle change. */
  depKey = '',
): T | undefined {
  const [value, setValue] = useState<T>();
  const key = topics.join(',');
  // Sans cette remise à zéro, l'ancienne valeur resterait affichée pendant le rechargement.
  const [loadedFor, setLoadedFor] = useState(depKey);
  if (loadedFor !== depKey) {
    setLoadedFor(depKey);
    setValue(undefined);
  }
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void load().then((next) => {
        if (alive) setValue(next);
      });
    };
    refresh();
    const off = onChange((topic) => {
      if (key.split(',').includes(topic)) refresh();
    });
    return () => {
      alive = false;
      off();
    };
    // `load` est volontairement exclu : seules les dépendances explicites comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, depKey]);
  return value;
}
