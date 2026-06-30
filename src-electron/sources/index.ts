// Registre des sources de marchés publics (process Electron). L'ordre reproduit
// celui de legacy/main.js (l'UI affiche les sources dans cet ordre).

import { boampSource, boamp2Source } from './boamp';
import { tedSource, joueSource } from './ted';
import {
  placeSource,
  dematAmpaSource,
  marchesSecurisesSource,
} from './place';
import {
  eMarchesPublicsSource,
  franceMarchesSource,
  marchesOnlineSource,
  awsSolutionsSource,
} from './aggregators';
import type { Source } from './types';
import type {
  SearchSourceArgs,
  SearchSourceResult,
  SourceMeta,
} from '../../src/shared/mp/types';

export const SOURCES: Source[] = [
  boampSource,
  placeSource,
  tedSource,
  joueSource,
  dematAmpaSource,
  marchesSecurisesSource,
  eMarchesPublicsSource,
  franceMarchesSource,
  marchesOnlineSource,
  awsSolutionsSource,
  boamp2Source,
];

/** Métadonnées légères pour l'UI (sans la fonction search). */
export function getSources(): SourceMeta[] {
  return SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    country: s.country,
    description: s.description,
    url: s.url,
  }));
}

/**
 * Exécute la recherche d'une source. Ne lève jamais : toute erreur est rapportée
 * dans `error` (l'UI continue avec les autres sources). Port fidèle de l'IPC
 * search-source de legacy/main.js.
 */
export async function searchSource(
  args: SearchSourceArgs,
): Promise<SearchSourceResult> {
  const {
    sourceId,
    query,
    offset = 0,
    keywords,
    depts,
    facets,
    keywordGroups,
    keywordMode,
  } = args;
  const source = SOURCES.find((s) => s.id === sourceId);
  if (!source) {
    return { sourceId, results: [], total: 0, error: 'Source inconnue' };
  }
  try {
    const raw = await source.search(query, offset, {
      keywords,
      depts,
      facets,
      keywordGroups,
      keywordMode,
    });
    const results = Array.isArray(raw) ? raw : raw.results || [];
    const total = Array.isArray(raw) ? raw.length : raw.total || results.length;
    return { sourceId, results, total };
  } catch (e) {
    return {
      sourceId,
      results: [],
      total: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
