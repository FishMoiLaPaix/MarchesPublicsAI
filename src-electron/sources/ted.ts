// Sources TED / JOUE via l'API officielle TED v3 (l'ancienne v2.0 est
// décommissionnée). franceOnly=true → restreint aux avis concernant la France
// (CY=FRA), périmètre du Journal Officiel de l'UE pertinent pour un acheteur
// français. Port fidèle de legacy/main.js (tedSearch + les deux sources).

import { postJson } from './http';
import type { Source } from './types';
import type { MarketResult, SearchOpts } from '../../src/shared/mp/types';

interface TedNotice {
  ND?: string;
  TI?: Record<string, string>;
  PD?: string;
}
interface TedResponse {
  notices?: TedNotice[];
  totalNoticeCount?: number;
}

export async function tedSearch(
  query: string,
  offset = 0,
  opts: SearchOpts = {},
  franceOnly = false,
): Promise<{ results: MarketResult[]; total: number }> {
  const esc = (s: unknown): string => String(s).replace(/["\\]/g, ' ').trim();
  const kws =
    Array.isArray(opts.keywords) && opts.keywords.length
      ? opts.keywords
      : String(query || '')
          .split(/\s+/)
          .filter((w) => w.length >= 3);
  const parts: string[] = [];
  if (kws.length) parts.push(`FT~"${kws.map(esc).join(' ')}"`);
  if (franceOnly) parts.push('CY=FRA');
  const q = (parts.join(' AND ') || 'PD>=20180101') + ' SORT BY PD DESC';
  const limit = 25;
  const page = Math.floor(offset / limit) + 1;
  const data = await postJson<TedResponse>(
    'https://api.ted.europa.eu/v3/notices/search',
    { query: q, fields: ['ND', 'TI', 'PD'], page, limit, scope: 'ALL' },
  );
  const pick = (ti?: Record<string, string>): string =>
    ti ? ti.fra || ti.eng || Object.values(ti)[0] || '' : '';
  const items: MarketResult[] = (data.notices || [])
    .map((n) => ({
      title: String(pick(n.TI) || n.ND || 'Avis JOUE'),
      desc: '',
      date: (n.PD || '').slice(0, 10),
      url: n.ND
        ? `https://ted.europa.eu/fr/notice/-/detail/${n.ND}`
        : 'https://ted.europa.eu',
    }))
    .filter((r) => r.title);
  return { results: items, total: data.totalNoticeCount || items.length };
}

export const tedSource: Source = {
  id: 'ted',
  name: 'TED Europa',
  country: '🇪🇺',
  description: 'Tenders Electronic Daily — tous marchés européens',
  url: 'https://ted.europa.eu',
  search: (query, offset = 0, opts = {}) => tedSearch(query, offset, opts, false),
};

export const joueSource: Source = {
  id: 'joue',
  name: 'J.O.U.E',
  country: '🇪🇺',
  description: "Journal Officiel de l'Union Européenne — avis concernant la France",
  url: 'https://ted.europa.eu',
  search: (query, offset = 0, opts = {}) => tedSearch(query, offset, opts, true),
};
