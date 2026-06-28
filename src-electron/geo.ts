// Référentiel géographique officiel (geo.api.gouv.fr). Construit une table
// { nom normalisé → [codes département] } à partir des départements, régions et
// communes ≥ 2000 hab. Aucune zone codée en dur. Port fidèle de legacy/main.js.
//
// Le cache persistant est INJECTÉ (interface GeoCache) pour garder ce module
// testable sous Node sans Electron : electron-main fournit l'implémentation
// adossée au store JSON ; les tests passent un cache mémoire (ou rien).

import { fetchJson } from './sources/http';
import type { GeoReference } from '../src/shared/mp/types';

export function geoNorm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface GeoCache {
  get(): GeoReference | null;
  set(ref: GeoReference): void;
}

interface Dept {
  nom: string;
  code: string;
  codeRegion: string;
}
interface Region {
  nom: string;
  code: string;
}
interface Commune {
  nom: string;
  codeDepartement: string;
  population?: number;
}

let _geoRefPromise: Promise<GeoReference> | null = null;

async function buildGeoReference(cache?: GeoCache): Promise<GeoReference> {
  const cached = cache?.get();
  if (cached && cached.names) return cached;

  const ref: GeoReference = { names: {}, deptCodes: [] };
  const add = (name: string, codes: string[]): void => {
    const k = geoNorm(name);
    if (!k || k.length < 3) return;
    ref.names[k] = [...new Set([...(ref.names[k] || []), ...codes])];
  };

  const [deps, regs, communes] = await Promise.all([
    fetchJson<Dept[]>('https://geo.api.gouv.fr/departements?fields=nom,code,codeRegion'),
    fetchJson<Region[]>('https://geo.api.gouv.fr/regions?fields=nom,code'),
    fetchJson<Commune[]>(
      'https://geo.api.gouv.fr/communes?fields=nom,codeDepartement,population&format=json',
    ),
  ]);

  deps.forEach((d) => add(d.nom, [d.code]));
  ref.deptCodes = deps.map((d) => d.code);

  const byRegion: Record<string, string[]> = {};
  deps.forEach((d) => {
    (byRegion[d.codeRegion] = byRegion[d.codeRegion] || []).push(d.code);
  });
  regs.forEach((r) => add(r.nom, byRegion[r.code] || []));

  communes
    .filter((c) => (c.population || 0) >= 2000)
    .forEach((c) => add(c.nom, [c.codeDepartement]));

  cache?.set(ref);
  return ref;
}

/** Construit (une seule fois) puis met en cache mémoire la référence géo. */
export function getGeoReference(cache?: GeoCache): Promise<GeoReference> {
  if (!_geoRefPromise) {
    _geoRefPromise = buildGeoReference(cache).catch((e) => {
      _geoRefPromise = null;
      throw e;
    });
  }
  return _geoRefPromise;
}
