// Analyse IA de pertinence (renderer). Le prompt système, la détection de zone et
// le prompt utilisateur sont CONSERVÉS À L'IDENTIQUE depuis legacy/main.js
// (analyze-with-ai) — c'est de la valeur métier. L'appel passe par le PersoiaClient
// du squelette (fetch direct vers chat.persoia.com/v1, OK depuis le renderer).
// Le retry 503 (instance GPU en démarrage) est géré par l'appelant (store).

import { PersoiaClient } from '../shared/persoia/client';
import type { MarketResult } from '../shared/mp/types';
import type { AiAnalysis } from './types';

// Prompt système — NE PAS réécrire (valeur métier, calibré sur le scoring attendu).
export const SYSTEM_PROMPT = `Tu es un expert en marchés publics français et européens spécialisé dans l'analyse de pertinence.

## MISSION
Analyser des annonces de marchés publics et les noter selon leur correspondance avec les critères de l'utilisateur. Tu dois noter TOUS les résultats, même ceux à 0.

## CRITÈRES D'ÉVALUATION (par ordre de priorité)

### 1. Zone géographique — CRITIQUE
Si l'utilisateur mentionne une ville, région, département ou code postal :
- Correspondance confirmée dans l'annonce → score normal
- Zone non mentionnée dans l'annonce (impossible à vérifier) → score max 50
- Zone différente confirmée dans l'annonce → score 0 à 10 maximum, toujours

### 2. Objet / domaine
Le marché doit correspondre au secteur ou à l'objet recherché.
- Correspondance exacte → +40 pts
- Domaine proche → +20 pts
- Hors-sujet → 0

### 3. Validité de l'annonce
- URL qui semble être une page "à propos", "connexion", "abonnement", "sources d'information" ou toute page non-marché → score 0
- Annonce active et récente → +10 pts
- Annonce ancienne ou attribution → neutre

## GRILLE DE SCORES
- 80–100 : Correspond à TOUS les critères (zone + objet + valide)
- 60–79 : Bon objet, zone probable ou non précisée
- 40–59 : Objet correct, zone douteuse
- 20–39 : Partiellement lié
- 0–19 : Hors zone confirmé, hors-sujet, ou lien invalide

## FORMAT DE RÉPONSE (JSON strict, aucun texte avant ou après)
{
  "summary": "2-3 phrases sur la qualité et la pertinence des résultats pour cette recherche",
  "relevant": [
    { "index": 0, "score": 85, "reason": "raison courte et précise", "highlights": ["point 1", "point 2"] }
  ],
  "recommendations": "conseils concrets pour affiner la recherche (zone, mots-clés CPV, etc.)"
}

Inclus TOUS les index dans "relevant" (même score 0) pour permettre un tri complet.`;

// Détection de zones géographiques dans la requête (port à l'identique).
const GEO_PATTERN =
  /\b(Paris|Lyon|Marseille|Toulouse|Bordeaux|Lille|Nantes|Strasbourg|Montpellier|Rennes|Reims|Nice|Rouen|Grenoble|Dijon|Angers|Nîmes|Toulon|Brest|Amiens|Tours|Limoges|Le Mans|Metz|Besançon|Orléans|Mulhouse|Caen|Nancy|Argenteuil|Montreuil|Saint-Denis|Île-de-France|Bretagne|Normandie|Occitanie|PACA|Provence|Nouvelle-Aquitaine|Hauts-de-France|Grand Est|Auvergne|Rhône-Alpes|Centre-Val de Loire|Bourgogne|Franche-Comté|Pays de la Loire|Corse|\b[0-9]{5}\b|\b[0-9]{2}\b)\b/gi;

export function buildUserPrompt(query: string, results: MarketResult[]): string {
  const geoMatches = [
    ...new Set((query.match(GEO_PATTERN) || []).map((s) => s.trim())),
  ];
  const geoWarning =
    geoMatches.length > 0
      ? `\n⚠️ ZONE GÉOGRAPHIQUE DÉTECTÉE: ${geoMatches.join(', ')} — tout résultat clairement hors de cette zone doit recevoir score ≤ 10.`
      : '';

  return `Requête utilisateur: "${query}"${geoWarning}

Analyse ces ${results.length} résultats. Note CHAQUE index de 0 à ${results.length - 1} dans "relevant".

${results
  .map(
    (r, i) => `[${i}] ${r.sourceName}
  Titre: ${r.title}
  Desc: ${r.desc || '—'}
  Date: ${r.date || '—'}
  URL: ${r.url}`,
  )
  .join('\n\n')}

Réponds uniquement en JSON valide.`;
}

/** Extrait le JSON de l'analyse (tolère un bloc ```json … ``` ou du texte autour). */
export function parseAnalysis(response: string): AiAnalysis {
  const clean = response.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean) as AiAnalysis;
  } catch {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AiAnalysis;
    throw new Error('Réponse IA non-JSON');
  }
}

/**
 * Lance l'analyse IA d'une liste de résultats. Lève en cas d'échec (PersoiaError
 * porte le statut HTTP — 503 = instance GPU en démarrage, géré par l'appelant).
 */
export async function analyzeResults(
  client: PersoiaClient,
  query: string,
  results: MarketResult[],
  signal?: AbortSignal,
): Promise<AiAnalysis> {
  const content = await client.chat(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(query, results) },
    ],
    { signal },
  );
  return parseAnalysis(content);
}
