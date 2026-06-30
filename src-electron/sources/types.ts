// Contrat interne d'une source de marchés (process Electron). Étend les
// métadonnées partagées avec la fonction de recherche (Node : axios/cheerio).

import type {
  MarketResult,
  SearchOpts,
  SourceMeta,
} from '../../src/shared/mp/types';

/** Une source peut renvoyer un tableau simple ou { results, total } (pagination). */
export type SearchReturn =
  | MarketResult[]
  | { results: MarketResult[]; total: number };

export interface Source extends SourceMeta {
  search(query: string, offset: number, opts: SearchOpts): Promise<SearchReturn>;
}
