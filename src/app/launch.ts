export type LaunchAction = 'new' | 'photo';

export interface LaunchParams {
  action: LaunchAction | null;
  shareId: string | null;
}

/** Lit les paramètres d'ouverture (raccourcis du manifest, Web Share Target). */
export function parseLaunch(search: string): LaunchParams {
  const params = new URLSearchParams(search);
  const action = params.get('action');
  return {
    action: action === 'new' || action === 'photo' ? action : null,
    shareId: params.get('share'),
  };
}

/** Retire les paramètres d'ouverture de l'URL pour qu'un rechargement ne les rejoue pas. */
export function clearLaunch(location: Location, history: History): void {
  if (location.search) history.replaceState(history.state, '', location.pathname);
}
