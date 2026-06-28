// Parsing et filtrage de dates (formats hétérogènes selon les sources). Port
// fidèle de legacy/index.html. Une date illisible est CONSERVÉE (jamais masquée).

import { norm } from './text';

const FR_MONTHS: Record<string, number> = {
  janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6,
  aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11,
};

export interface DateRange {
  from: string | null;
  to: string | null;
}

export function parseResultDate(d: string | undefined | null): Date | null {
  if (!d) return null;
  const s = String(d).trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/); // ISO : 2024-11-05
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/); // 05/11/2024 ou 5.11.24
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return new Date(y, +m[2] - 1, +m[1]);
  }
  m = norm(s).match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/); // 5 novembre 2024
  if (m && FR_MONTHS[m[2]] != null)
    return new Date(+m[3], FR_MONTHS[m[2]], +m[1]);
  return null;
}

/** Vrai si `value` est dans la plage (date illisible → conservée). */
export function dateInRange(
  value: string | undefined | null,
  range: DateRange,
): boolean {
  if (!range.from && !range.to) return true;
  const d = parseResultDate(value);
  if (!d) return true;
  if (range.from && d < new Date(range.from + 'T00:00:00')) return false;
  if (range.to && d > new Date(range.to + 'T23:59:59')) return false;
  return true;
}

/** Filtre « état » (en cours / clôturé) via la date limite de réponse. */
export function passEtat(
  datelimite: string | undefined | null,
  etat: string,
): boolean {
  if (!etat) return true;
  const d = parseResultDate(datelimite);
  if (!d) return true; // date de clôture inconnue → on ne masque pas
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return etat === 'en-cours' ? d >= today : d < today;
}
