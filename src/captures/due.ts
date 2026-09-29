/**
 * Raccourcis d'échéance, calculés en heure locale puis stockés en ISO 8601 AVEC le décalage
 * local (`…T18:00:00+02:00`). Orqea garde l'heure écrite : en UTC (`Z`), 18 h locales
 * deviendraient 16 h pour l'utilisateur.
 */
export const TODAY_HOUR = 18;
export const TOMORROW_HOUR = 9;

/** Date → ISO 8601 en heure locale, avec son décalage (`+02:00`). */
export function toOffsetIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const local = `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  return `${local}T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function dueToday(now: Date = new Date()): string {
  const due = new Date(now);
  due.setHours(TODAY_HOUR, 0, 0, 0);
  // Déjà passé 18 h : fin de journée.
  if (due <= now) due.setHours(23, 59, 0, 0);
  return toOffsetIso(due);
}

export function dueTomorrow(now: Date = new Date()): string {
  const due = new Date(now);
  due.setDate(due.getDate() + 1);
  due.setHours(TOMORROW_HOUR, 0, 0, 0);
  return toOffsetIso(due);
}

/** Valeur d'un `<input type="datetime-local">` → ISO, ou `undefined` si vide/invalide. */
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : toOffsetIso(date);
}

/** ISO → valeur pour `<input type="datetime-local">` (heure locale, sans secondes). */
export function toLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function formatDue(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}
