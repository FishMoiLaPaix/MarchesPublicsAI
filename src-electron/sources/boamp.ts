// Sources BOAMP (Bulletin Officiel des Annonces de Marchés Publics) via l'API
// Opendatasoft. Deux entrées : avis en cours (boamp) et avis d'attribution
// (boamp2). Port fidèle de legacy/main.js (boampWhere + les deux sources).

import { fetchJson } from './http';
import type { Source } from './types';
import type { MarketResult, SearchOpts } from '../../src/shared/mp/types';

export const BOAMP_RECORDS =
  'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records';

function boampToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// Construit une clause ODSQL "where" à partir des facettes de recherche : mots-clés
// dans l'objet (objet like), département officiel, et critères structurés (domaine,
// type de marché, procédure, type d'avis, état, dates). Sépare le QUOI/OÙ/COMMENT.
export function boampWhere(opts: SearchOpts = {}): string {
  const esc = (s: unknown): string =>
    String(s).replace(/["\\]/g, ' ').trim();
  const clauses: string[] = [];

  // Groupes de mots-clés combinés selon le mode : strict = ET, souple/ou = OU.
  const groups = (Array.isArray(opts.keywordGroups) ? opts.keywordGroups : [])
    .map(esc)
    .filter((g) => g.length >= 2);
  if (groups.length) {
    const joiner = opts.keywordMode === 'strict' ? ' and ' : ' or ';
    clauses.push(
      '(' + groups.map((g) => `objet like "${g}"`).join(joiner) + ')',
    );
  }

  const depts = Array.isArray(opts.depts) ? opts.depts : [];
  if (depts.length) {
    const dq = depts
      .map(
        (d) =>
          `code_departement="${esc(d)}" or code_departement_prestation="${esc(d)}"`,
      )
      .join(' or ');
    clauses.push(`(${dq})`);
  }

  const f = opts.facets || {};
  if (f.typeMarche) clauses.push(`type_marche="${esc(f.typeMarche)}"`);
  if (f.famille) clauses.push(`famille_libelle="${esc(f.famille)}"`);
  if (f.procedure) clauses.push(`procedure_libelle="${esc(f.procedure)}"`);
  if (f.nature) clauses.push(`nature="${esc(f.nature)}"`);
  if (f.pubFrom) clauses.push(`dateparution>=date'${esc(f.pubFrom)}'`);
  if (f.pubTo) clauses.push(`dateparution<=date'${esc(f.pubTo)}'`);
  if (f.closeFrom) clauses.push(`datelimitereponse>=date'${esc(f.closeFrom)}'`);
  if (f.closeTo) clauses.push(`datelimitereponse<=date'${esc(f.closeTo)}'`);
  if (f.etat === 'en-cours')
    clauses.push(`datelimitereponse>=date'${boampToday()}'`);
  if (f.etat === 'cloture')
    clauses.push(`datelimitereponse<date'${boampToday()}'`);

  return clauses.join(' and ');
}

// Forme brute d'un enregistrement BOAMP (champs utilisés uniquement).
interface BoampRecord {
  objet?: string;
  nomacheteur?: string;
  famille_libelle?: string;
  titulaire?: string;
  dateparution?: string;
  datelimitereponse?: string;
  procedure_libelle?: string;
  code_departement?: string[] | string;
  code_departement_prestation?: string;
  idweb?: string;
}
interface BoampResponse {
  results?: BoampRecord[];
  total_count?: number;
}

function recordDepts(r: BoampRecord): string[] {
  if (Array.isArray(r.code_departement)) return r.code_departement;
  return r.code_departement_prestation ? [r.code_departement_prestation] : [];
}

export const boampSource: Source = {
  id: 'boamp',
  name: 'BOAMP',
  country: '🇫🇷',
  description: 'Bulletin Officiel des Annonces de Marchés Publics',
  url: 'https://www.boamp.fr',
  search: async (query, offset = 0, opts = {}) => {
    const where = boampWhere(opts);
    let url = `${BOAMP_RECORDS}?limit=50&offset=${offset}&order_by=${encodeURIComponent('dateparution desc')}`;
    if (where) url += `&where=${encodeURIComponent(where)}`;
    else if (query) url += `&q=${encodeURIComponent(query)}`;
    const data = await fetchJson<BoampResponse>(url);
    const items: MarketResult[] = (data.results || [])
      .map((r) => ({
        title: r.objet || 'Avis BOAMP',
        desc: r.nomacheteur
          ? `${r.nomacheteur}${r.famille_libelle ? ' — ' + r.famille_libelle : ''}`
          : r.famille_libelle || '',
        date: (r.dateparution || '').slice(0, 10),
        datelimite: (r.datelimitereponse || '').slice(0, 10),
        procedure: r.procedure_libelle || '',
        depts: recordDepts(r),
        url: r.idweb
          ? `https://www.boamp.fr/avis/detail/${r.idweb}`
          : 'https://www.boamp.fr',
      }))
      .filter((r) => r.title);
    return { results: items, total: data.total_count || items.length };
  },
};

export const boamp2Source: Source = {
  id: 'boamp2',
  name: 'BOAMP Attributions',
  country: '🇫🇷',
  description: "Avis d'attribution BOAMP (contrats récemment attribués)",
  url: 'https://www.boamp.fr',
  search: async (query, offset = 0, opts = {}) => {
    const parts = ['nature="ATTRIBUTION"'];
    const w = boampWhere(opts);
    if (w) parts.push(w);
    const where = parts.join(' and ');
    const url = `${BOAMP_RECORDS}?where=${encodeURIComponent(where)}&limit=50&offset=${offset}&order_by=${encodeURIComponent('dateparution desc')}`;
    const data = await fetchJson<BoampResponse>(url);
    const items: MarketResult[] = (data.results || [])
      .map((r) => ({
        title: r.objet || 'Attribution BOAMP',
        desc: r.titulaire
          ? `Titulaire : ${r.titulaire}${r.nomacheteur ? ' — ' + r.nomacheteur : ''}`
          : r.nomacheteur || '',
        date: (r.dateparution || '').slice(0, 10),
        datelimite: (r.datelimitereponse || '').slice(0, 10),
        procedure: r.procedure_libelle || '',
        depts: recordDepts(r),
        url: r.idweb
          ? `https://www.boamp.fr/avis/detail/${r.idweb}`
          : 'https://www.boamp.fr',
      }))
      .filter((r) => r.title);
    return { results: items, total: data.total_count || items.length };
  },
};
