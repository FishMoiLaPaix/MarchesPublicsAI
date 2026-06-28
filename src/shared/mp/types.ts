// Types partagés du domaine « marchés publics », consommés par le renderer (Vue)
// ET le process Electron (sources, géo). Aucun import Node ici : ce fichier doit
// rester importable depuis le navigateur.

/** Un résultat de marché normalisé, tel que renvoyé par chaque source. */
export interface MarketResult {
  title: string;
  desc?: string;
  date?: string;
  datelimite?: string;
  procedure?: string;
  depts?: string[];
  url: string;
  /** Nom de la source d'origine (ajouté côté renderer après concaténation). */
  sourceName?: string;
  /** Identifiant de la source d'origine. */
  sourceId?: string;
}

/** Métadonnées d'une source (affichées dans la liste des sources). */
export interface SourceMeta {
  id: string;
  name: string;
  country: string;
  description: string;
  url: string;
}

/** Facettes structurées (principalement exploitées par BOAMP via ODSQL). */
export interface SearchFacets {
  typeMarche?: string;
  famille?: string;
  procedure?: string;
  nature?: string;
  pubFrom?: string;
  pubTo?: string;
  closeFrom?: string;
  closeTo?: string;
  /** État de l'avis : '' (tous) | 'en-cours' | 'cloture'. */
  etat?: string;
}

/** Mode de combinaison des groupes de mots-clés. */
export type KeywordMode = 'strict' | 'souple' | 'ou';

/** Options de recherche passées à une source. */
export interface SearchOpts {
  keywords?: string[];
  depts?: string[];
  facets?: SearchFacets;
  keywordGroups?: string[];
  keywordMode?: KeywordMode;
}

/** Arguments de l'IPC mp:searchSource. */
export interface SearchSourceArgs extends SearchOpts {
  sourceId: string;
  query: string;
  offset?: number;
}

/** Résultat de l'IPC mp:searchSource (jamais d'exception : erreur dans `error`). */
export interface SearchSourceResult {
  sourceId: string;
  results: MarketResult[];
  total: number;
  error?: string;
}

/** Référentiel géographique : nom normalisé → codes département. */
export interface GeoReference {
  names: Record<string, string[]>;
  deptCodes: string[];
}

/**
 * Surface métier exposée au renderer par le preload Electron (window.mp).
 * Tout ce qui a besoin de Node (scraping, CORS, fs) vit dans le process principal
 * et passe par ce pont. Absent en contexte web/PWA pur.
 */
export interface MpBridge {
  getSources(): Promise<SourceMeta[]>;
  searchSource(args: SearchSourceArgs): Promise<SearchSourceResult>;
  getGeoReference(): Promise<GeoReference | null>;
  openUrl(url: string): Promise<void>;
}

declare global {
  interface Window {
    mp?: MpBridge;
  }
}
