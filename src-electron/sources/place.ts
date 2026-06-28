// Plateformes type « PLACE » (moteur AWS/Atexo) : PLACE (État), Demat-AMPA et
// Marchés Sécurisés partagent EXACTEMENT la même structure HTML (.item_consultation,
// panelBlocObjet, date-min…) ; seule l'URL de base change. Fabrique commune, port
// fidèle de legacy/main.js.

import * as cheerio from 'cheerio';
import { fetchHtml } from './http';
import type { Source } from './types';
import type { MarketResult } from '../../src/shared/mp/types';

interface PlaceSpec {
  id: string;
  name: string;
  description: string;
  base: string;
}

function makePlaceSource(spec: PlaceSpec): Source {
  const { base } = spec;
  return {
    id: spec.id,
    name: spec.name,
    country: '🇫🇷',
    description: spec.description,
    url: base,
    search: async (query) => {
      const encoded = encodeURIComponent(query);
      const url = `${base}/index.php?page=entreprise.EntrepriseAdvancedSearch&AllCons&texte=${encoded}`;
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);
      const results: MarketResult[] = [];
      $('.item_consultation').each((i, el) => {
        if (i >= 20) return false;
        const titleEl = $(el).find('[id*="panelBlocObjet"] .truncate-700');
        const title =
          titleEl.attr('title') ||
          titleEl.find('span').not('.h5, strong').last().text().trim();
        const descEl = $(el).find('[id*="panelBlocDenomination"] .truncate-700');
        const desc = descEl.attr('title') || descEl.find('.small').text().trim();
        const day = $(el).find('.date-min .day span').text().trim();
        const month = $(el).find('.date-min .month span').text().trim();
        const year = $(el).find('.date-min .year span').text().trim();
        const date = day && year ? `${day} ${month} ${year}` : '';
        const refCons = $(el).find('input[name*="refCons"]').val();
        const orgCons = $(el).find('input[name*="orgCons"]').val();
        const link =
          refCons && orgCons
            ? `${base}/entreprise/consultation/${refCons}?orgAcronyme=${orgCons}`
            : base;
        if (title && title.length > 5) results.push({ title, desc, date, url: link });
      });
      return results;
    },
  };
}

export const placeSource = makePlaceSource({
  id: 'place',
  name: 'PLACE',
  description: "Plateforme des Achats de l'État",
  base: 'https://www.marches-publics.gouv.fr',
});

export const dematAmpaSource = makePlaceSource({
  id: 'demat-ampa',
  name: 'Demat-AMPA',
  description: 'Plateforme dématérialisation Occitanie / Midi-Pyrénées',
  base: 'https://www.demat-ampa.fr',
});

export const marchesSecurisesSource = makePlaceSource({
  id: 'marches-securises',
  name: 'Marchés Sécurisés',
  description: 'Plateforme nationale de dématérialisation',
  base: 'https://www.marches-securises.fr',
});
