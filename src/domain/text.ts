// Normalisation de texte et mots-clés de domaine. Logique pure (renderer),
// port fidèle de legacy/index.html. Réutilisée par le scoring, le filtre
// prestation et l'extraction de mots-clés.

/** Minuscule + suppression des accents (diacritiques U+0300–U+036F). */
export function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Mots normalisés (séparateurs non alphanumériques → espace). */
export function normWords(text: string): string[] {
  return norm(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

// Mots-outils ignorés dans les mots-clés et le filtre prestation.
export const STOPWORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'en', 'pour',
  'dans', 'sur', 'au', 'aux', 'avec', 'sans', 'sous', 'par', 'the', 'of', 'and',
  'marche', 'marches', 'public', 'publics',
]);

/** Mots-clés de domaine extraits d'une requête (hors stopwords, chiffres, géo). */
export function queryKeywords(query: string, geoWords?: Set<string>): string[] {
  return [
    ...new Set(
      normWords(query).filter(
        (w) =>
          w.length >= 3 &&
          !STOPWORDS.has(w) &&
          !/^\d+$/.test(w) &&
          !(geoWords && geoWords.has(w)),
      ),
    ),
  ];
}

// Racinisation légère FR : "sportif/sportive/sports" → "sport",
// "équipements" → "equip". Port à l'identique (ordre des suffixes important).
export function stemWord(w: string): string {
  if (w.length <= 4) return w;
  return w.replace(
    /(ations|ation|ements|ement|ions|aires|aire|euses|euse|eurs|eur|ives|ive|ifs|if|aux|ales|ale|s|x|e)$/,
    '',
  );
}
