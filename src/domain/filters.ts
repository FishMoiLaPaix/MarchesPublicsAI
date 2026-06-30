// Construction des filtres de recherche à partir des champs de l'UI. Version pure
// de legacy/index.html gatherFilters : sépare les mots-clés (groupes) de la
// géographie (départements), prépare le payload des sources. Aucune dépendance
// au DOM : l'UI (Pinia) passe les valeurs des champs.

import { normWords, STOPWORDS } from './text';
import { geoScan, EMPTY_GEO, type GeoRef } from './geo';
import type { KeywordMode, MarketResult, SearchFacets } from '../shared/mp/types';

/** Clé stable d'une offre (corbeille, lus). */
export function offerKey(r: Pick<MarketResult, 'url' | 'title'>): string {
  return (r.url || '') + '|' + (r.title || '');
}

export interface FilterInputs {
  precise: string;
  kwBar: string;
  secteur: string;
  lieu: string;
  keywordMode: KeywordMode;
  typeMarche: string;
  famille: string;
  procedure: string;
  nature: string;
  etat: string;
  pubFrom: string | null;
  pubTo: string | null;
  closeFrom: string | null;
  closeTo: string | null;
}

export interface Filters {
  text: string;
  scraperText: string;
  precise: string;
  kwBar: string;
  secteur: string;
  lieu: string;
  groups: string[][];
  keywordGroups: string[];
  keywordMode: KeywordMode;
  depts: string[];
  typeMarche: string;
  famille: string;
  procedure: string;
  nature: string;
  etat: string;
  pubFrom: string | null;
  pubTo: string | null;
  closeFrom: string | null;
  closeTo: string | null;
}

export function buildFilters(input: FilterInputs, geo: GeoRef = EMPTY_GEO): Filters {
  const { precise, kwBar, secteur, lieu, keywordMode } = input;

  // Sources de mots-clés : la barre ;-séparée, le secteur, et la recherche précise.
  const rawGroups: string[] = [];
  kwBar.split(';').forEach((s) => {
    if (s.trim()) rawGroups.push(s.trim());
  });
  if (secteur) rawGroups.push(secteur);
  if (precise) rawGroups.push(precise);

  // Zones (départements) détectées dans les mots-clés + le champ Lieu.
  const geoWords = geoScan(rawGroups.join(' '), true, geo).words;
  const depts = [
    ...new Set([
      ...geoScan(lieu, true, geo).zones,
      ...geoScan(rawGroups.join(' '), true, geo).zones,
    ]),
  ];

  // Chaque groupe = liste de mots (hors géo / stopwords). On déduplique les groupes.
  const seen = new Set<string>();
  const groups: string[][] = [];
  rawGroups.forEach((g) => {
    const words = normWords(g).filter(
      (w) => w.length >= 2 && !STOPWORDS.has(w) && !geoWords.has(w),
    );
    if (!words.length) return;
    const key = words.join(' ');
    if (seen.has(key)) return;
    seen.add(key);
    groups.push(words);
  });
  const keywordGroups = groups.map((w) => w.join(' ')); // pour BOAMP (objet like)

  // Texte transmis aux sources NON-BOAMP : tous les mots-clés + le lieu.
  const scraperText = [...rawGroups, lieu].filter(Boolean).join(' ');

  return {
    text: rawGroups.join(' '),
    scraperText,
    precise,
    kwBar,
    secteur,
    lieu,
    groups,
    keywordGroups,
    keywordMode,
    depts,
    typeMarche: input.typeMarche,
    famille: input.famille,
    procedure: input.procedure,
    nature: input.nature,
    etat: input.etat,
    pubFrom: input.pubFrom,
    pubTo: input.pubTo,
    closeFrom: input.closeFrom,
    closeTo: input.closeTo,
  };
}

export function hasAnyCriterion(f: Filters): boolean {
  return !!(
    f.groups.length ||
    f.depts.length ||
    f.typeMarche ||
    f.famille ||
    f.procedure ||
    f.nature ||
    f.etat ||
    f.pubFrom ||
    f.pubTo ||
    f.closeFrom ||
    f.closeTo
  );
}

/** Payload des facettes transmis aux sources (BOAMP). */
export function facetPayload(f: Filters): SearchFacets {
  return {
    typeMarche: f.typeMarche,
    famille: f.famille,
    procedure: f.procedure,
    nature: f.nature,
    etat: f.etat,
    pubFrom: f.pubFrom || undefined,
    pubTo: f.pubTo || undefined,
    closeFrom: f.closeFrom || undefined,
    closeTo: f.closeTo || undefined,
  };
}
