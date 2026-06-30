// Score de correspondance local (par GROUPES de mots-clés + géo). Un groupe (ex.
// « équipement sportif ») est « matché » si TOUS ses mots sont présents (racine
// FR tolérée). Port fidèle de legacy/index.html computeClientScore.

import { norm, stemWord } from './text';
import { geoScan, EMPTY_GEO, type GeoRef } from './geo';
import type { MarketResult } from '../shared/mp/types';

export interface ClientScore {
  score: number;
  matchedGroups: number;
  geoMismatch: boolean;
}

export function computeClientScore(
  result: MarketResult,
  groups: string[][],
  queryZones: Set<string>,
  geo: GeoRef = EMPTY_GEO,
): ClientScore {
  const titleN = norm(result.title);
  const text = titleN + ' ' + norm(result.desc || '');
  const textStems = new Set(
    text.split(/[^a-z0-9]+/).filter(Boolean).map(stemWord),
  );
  const titleStems = new Set(
    titleN.split(/[^a-z0-9]+/).filter(Boolean).map(stemWord),
  );
  const wordMatch = (w: string): boolean => {
    const ws = stemWord(w);
    return text.includes(w) || textStems.has(w) || textStems.has(ws);
  };

  let matchedGroups = 0;
  let titleHits = 0;
  groups.forEach((words) => {
    if (words.every(wordMatch)) {
      matchedGroups++;
      if (words.some((w) => titleN.includes(w) || titleStems.has(stemWord(w))))
        titleHits++;
    }
  });

  // Score non linéaire : récompense la couverture COMPLÈTE des groupes et pénalise
  // les correspondances partielles (1 groupe sur 2 → ~38 %, pas 50 %).
  let score: number;
  if (!groups.length) {
    score = 60;
  } else {
    const cov = matchedGroups / groups.length;
    score = Math.round(Math.pow(cov, 1.4) * 100);
    if (titleHits > 0 && score < 100) score = Math.min(100, score + 8);
  }

  // Pénalité géographique : la requête cible une zone, l'annonce en cite une AUTRE.
  let geoMismatch = false;
  if (queryZones.size) {
    const resultZones = geoScan(
      (result.title || '') + ' ' + (result.desc || ''),
      false,
      geo,
    ).zones;
    (result.depts || []).forEach((c) => resultZones.add(c)); // dept officiel (BOAMP)
    if (resultZones.size && ![...resultZones].some((z) => queryZones.has(z))) {
      geoMismatch = true;
      score = Math.min(score, 8);
    }
  }
  return { score, matchedGroups, geoMismatch };
}
