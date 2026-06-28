// Types du domaine (renderer) : résultats scorés et analyse IA.

import type { MarketResult } from '../shared/mp/types';

/** Une entrée d'analyse IA pour un résultat (par index). */
export interface AiRelevant {
  index: number;
  score: number;
  reason?: string;
  highlights?: string[];
}

/** Réponse structurée de l'analyse IA (JSON renvoyé par le modèle). */
export interface AiAnalysis {
  summary?: string;
  relevant?: AiRelevant[];
  recommendations?: string;
}

/** Résultat enrichi par le scoring/pipeline (champs internes préfixés `_`). */
export interface ScoredResult extends MarketResult {
  _idx: number;
  _rel: AiRelevant | null;
  _clientScore: number;
  _matched: number;
  _geoMismatch: boolean;
  _score: number;
  _irrelevant?: boolean;
}
