// Pipeline de traitement des résultats : filtres « durs » (corbeille, dates, état,
// zone, prestation) puis partage pertinents / non pertinents et tri par score.
// Version pure de legacy/index.html getProcessedResults : tout l'état (filtres,
// corbeille, analyse IA, géo) est passé en entrée par l'UI (Pinia).

import { norm, stemWord, STOPWORDS } from './text';
import { EMPTY_GEO, type GeoRef } from './geo';
import { computeClientScore } from './scoring';
import { dateInRange, passEtat, type DateRange } from './dates';
import { offerKey } from './filters';
import type { KeywordMode, MarketResult } from '../shared/mp/types';
import type { AiAnalysis, AiRelevant, ScoredResult } from './types';

export interface ProcessInput {
  allResults: MarketResult[];
  groups: string[][];
  queryZones: Set<string>;
  aiAnalysis: AiAnalysis | null;
  hiddenOffers: Set<string>;
  datePub: DateRange;
  dateClose: DateRange;
  etat: string;
  typeMarche: string;
  prestationText: string;
  keywordMode: KeywordMode;
  showIrrelevant: boolean;
  geo?: GeoRef;
}

export interface ProcessOutput {
  relevant: ScoredResult[];
  irrelevant: ScoredResult[];
  visible: ScoredResult[];
}

export function processResults(input: ProcessInput): ProcessOutput {
  const geo = input.geo || EMPTY_GEO;
  const { groups, queryZones } = input;
  const nGroups = groups.length;

  const relMap: Record<number, AiRelevant> = {};
  if (input.aiAnalysis?.relevant)
    input.aiAnalysis.relevant.forEach((r) => {
      relMap[r.index] = r;
    });

  let list: ScoredResult[] = input.allResults.map((r, i) => {
    const ai = relMap[i] || null;
    const c = computeClientScore(r, groups, queryZones, geo);
    return {
      ...r,
      _idx: i,
      _rel: ai,
      _clientScore: c.score,
      _matched: c.matchedGroups,
      _geoMismatch: c.geoMismatch,
      _score: ai ? ai.score : c.score,
    };
  });

  // Corbeille : on écarte définitivement les offres supprimées par l'utilisateur.
  if (input.hiddenOffers.size)
    list = list.filter((r) => !input.hiddenOffers.has(offerKey(r)));

  // Filtres de dates (publication + clôture) et d'état.
  list = list.filter(
    (r) =>
      dateInRange(r.date, input.datePub) &&
      dateInRange(r.datelimite, input.dateClose) &&
      passEtat(r.datelimite, input.etat),
  );

  // Filtre géographique : si la requête cible une zone, on écarte les annonces
  // d'une AUTRE zone clairement identifiée (sauf si l'IA les juge très pertinentes).
  // Garde-fou : ne jamais tout masquer.
  if (queryZones.size) {
    const inZone = list.filter(
      (r) => !r._geoMismatch || (r._rel && r._rel.score >= 70),
    );
    if (inZone.length > 0) list = inZone;
  }

  // Filtre « prestation » — uniquement en domaine Services. Une prestation est une
  // activité de service désignée par un libellé (ex. « nettoyage de locaux »), pas
  // un simple mot-clé : on n'exige PAS la sous-chaîne exacte, mais que TOUS ses
  // mots significatifs soient présents (ET interne, pluriel/racine tolérés). On
  // garde l'offre si elle correspond à AU MOINS UNE prestation listée (OU entre ;).
  if (input.typeMarche === 'SERVICES' && input.prestationText.trim()) {
    const PRESTA_IGNORE = new Set([...STOPWORDS, 'prestation', 'prestations']);
    const prestations = input.prestationText
      .split(';')
      .map((p) =>
        norm(p)
          .replace(/[^a-z0-9]+/g, ' ')
          .trim()
          .split(' ')
          .filter((w) => w.length >= 3 && !PRESTA_IGNORE.has(w)),
      )
      .filter((words) => words.length > 0);
    if (prestations.length) {
      list = list.filter((r) => {
        const text = norm((r.title || '') + ' ' + (r.desc || ''));
        const stems = new Set(
          text.split(/[^a-z0-9]+/).filter(Boolean).map(stemWord),
        );
        const wordMatch = (w: string): boolean =>
          text.includes(w) || stems.has(w) || stems.has(stemWord(w));
        return prestations.some((words) => words.every(wordMatch));
      });
    }
  }

  const base = list; // résultats après les filtres « durs ».

  // Pertinence : mode des mots-clés + score > 0. L'IA (score ≥ 40) peut toujours
  // rattraper un résultat. Garde-fou : jamais tout masquer.
  let relevant = base;
  if (nGroups) {
    const aiKeep = (r: ScoredResult): boolean =>
      !!r._rel && r._rel.score >= 40;
    let kept: ScoredResult[];
    if (input.keywordMode === 'strict') {
      kept = base.filter((r) => r._matched === nGroups || aiKeep(r));
    } else if (input.keywordMode === 'ou') {
      kept = base.filter((r) => r._matched >= 1 || aiKeep(r));
    } else {
      // souple : palier de correspondance maximal présent.
      const maxM = base.reduce((m, r) => Math.max(m, r._matched), 0);
      kept = maxM > 0 ? base.filter((r) => r._matched === maxM || aiKeep(r)) : base;
    }
    if (kept.length > 0) relevant = kept;
  }
  // Les résultats sans aucune correspondance (score 0 %) sont aussi « non pertinents ».
  relevant = relevant.filter((r) => (r._rel?.score ?? r._score) > 0);

  // Complément (présent dans base mais pas dans relevant) = non pertinents.
  const relSet = new Set(relevant.map((r) => r._idx));
  const byScore = (a: ScoredResult, b: ScoredResult): number =>
    b._score - a._score || b._matched - a._matched;
  relevant = [...relevant].sort(byScore);
  const irrelevant = base.filter((r) => !relSet.has(r._idx)).sort(byScore);
  irrelevant.forEach((r) => {
    r._irrelevant = true;
  });

  // Par défaut on ne montre que les pertinents ; le bouton ajoute les non pertinents.
  const visible = input.showIrrelevant ? relevant.concat(irrelevant) : relevant;
  return { relevant, irrelevant, visible };
}
