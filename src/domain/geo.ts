// Détection des zones géographiques (codes département) dans un texte, côté
// renderer. Le référentiel vient du process principal (window.mp.getGeoReference)
// puis est converti en Map/Set pour l'accès rapide. Port fidèle de
// legacy/index.html (geoScan + loadGeoReference).

import { normWords } from './text';
import type { GeoReference } from '../shared/mp/types';

export interface GeoRef {
  names: Map<string, string[]>;
  deptCodes: Set<string>;
}

export const EMPTY_GEO: GeoRef = { names: new Map(), deptCodes: new Set() };

/** Convertit le référentiel transmis par l'IPC en structures rapides. */
export function fromGeoReference(ref: GeoReference | null): GeoRef {
  if (!ref || !ref.names) return EMPTY_GEO;
  return {
    names: new Map(Object.entries(ref.names)),
    deptCodes: new Set(ref.deptCodes || []),
  };
}

export interface GeoScan {
  zones: Set<string>;
  words: Set<string>;
}

/**
 * Détecte les zones (codes département) citées dans un texte et les mots consommés
 * par un nom de lieu (à exclure des mots-clés). includeBareCode : n'accepter les
 * n° à 2 chiffres seuls (ex. « 33 ») que s'ils sont des départements connus.
 */
export function geoScan(
  text: string,
  includeBareCode: boolean,
  geo: GeoRef = EMPTY_GEO,
): GeoScan {
  const toks = normWords(text);
  const zones = new Set<string>();
  const words = new Set<string>();
  toks.forEach((t) => {
    if (/^\d{5}$/.test(t)) {
      zones.add(t.startsWith('97') ? t.slice(0, 3) : t.slice(0, 2));
      words.add(t);
    }
  });
  if (includeBareCode)
    toks.forEach((t) => {
      if (/^\d{2}$/.test(t) && geo.deptCodes.has(t)) {
        zones.add(t);
        words.add(t);
      }
    });
  // n-grammes (3 → 1 mots) confrontés à la table officielle des noms de lieux.
  for (let i = 0; i < toks.length; i++) {
    for (let n = Math.min(3, toks.length - i); n >= 1; n--) {
      const gram = toks.slice(i, i + n).join(' ');
      if (gram.length < 3) continue;
      const codes = geo.names.get(gram);
      if (codes) {
        codes.forEach((c) => zones.add(c));
        for (let k = i; k < i + n; k++) words.add(toks[k]);
        i += n - 1;
        break;
      }
    }
  }
  return { zones, words };
}
