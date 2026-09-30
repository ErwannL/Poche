/**
 * Adresse de l'application Orqea (pas de son API) : cible du bouton « Revenir sur Orqea ».
 * `VITE_ORQEA_APP_URL` la fixe au build ; sinon, en local Orqea vit sur le port 3001 et,
 * ailleurs, sur la même origine que Poche.
 */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export function orqeaAppUrl(
  configured: string | undefined = import.meta.env.VITE_ORQEA_APP_URL,
  hostname: string = window.location.hostname,
): string {
  if (configured) return configured;
  if (LOCAL_HOSTS.includes(hostname)) return 'http://localhost:3001';
  return '/';
}

export const CREDITS = {
  author: { name: 'Erwann Laplante', href: 'https://github.com/ErwannL' },
};
