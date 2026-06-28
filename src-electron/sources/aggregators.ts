// Agrégateurs nationaux d'appels d'offres (HTML scraping, structures hétérogènes).
// Sélecteurs larges + repli, port fidèle de legacy/main.js. La normalisation des
// slugs retire les diacritiques via la plage de combinaison U+0300–U+036F (écrite
// en échappement \u… pour éviter tout problème d'encodage du fichier source).

import * as cheerio from 'cheerio';
import { fetchHtml } from './http';
import type { Source } from './types';
import type { MarketResult } from '../../src/shared/mp/types';

function slugify(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const eMarchesPublicsSource: Source = {
  id: 'e-marchespublics',
  name: 'e-Marchés Publics',
  country: '🇫🇷',
  description:
    "Portail national des appels d'offres publics et dématérialisation",
  url: 'https://www.e-marchespublics.com',
  search: async (query) => {
    const slug = slugify(query);
    const url = `https://www.e-marchespublics.com/appels-offres/${slug}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const results: MarketResult[] = [];
    $(
      'article, .offre, .tender, .consultation, .ao, li.item, .card, [class*="marche"], [class*="offre"]',
    ).each((i, el) => {
      if (i >= 20) return false;
      const titleEl = $(el).find('h1, h2, h3, .title, .objet, strong a, a').first();
      const title = titleEl.attr('title') || titleEl.text().trim();
      const desc = $(el)
        .find('.acheteur, .organisme, .buyer, p, .desc, .subtitle')
        .first()
        .text()
        .trim();
      const date = $(el)
        .find('.date, time, [datetime], .parution, .pub')
        .first()
        .text()
        .trim();
      const href = $(el).find('a').first().attr('href') || titleEl.attr('href');
      const link = href
        ? href.startsWith('http')
          ? href
          : 'https://www.e-marchespublics.com' + href
        : url;
      if (title && title.length > 8) results.push({ title, desc, date, url: link });
    });
    return results;
  },
};

export const franceMarchesSource: Source = {
  id: 'francemarches',
  name: 'France Marchés',
  country: '🇫🇷',
  description: "Portail n°1 des appels d'offres — agrégateur national",
  url: 'https://www.francemarches.com',
  search: async (query) => {
    // France Marchés utilise des URL slug : /appels-offre/MOT-CLE
    const slug = slugify(query);
    const url = `https://www.francemarches.com/appels-offre/${slug}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const results: MarketResult[] = [];
    $(
      'article, li.offre, .offre-item, .result-offre, .item-offre, [class*="offre"], [class*="avis"]',
    ).each((i, el) => {
      if (i >= 20) return false;
      const linkEl = $(el)
        .find('a[href*="/appel-offre/"], a[href*="/offre/"]')
        .first();
      const title =
        linkEl.text().trim() ||
        $(el).find('h2, h3, .title').first().text().trim();
      const desc = $(el)
        .find('.acheteur, .buyer, .organisme, .reference, p')
        .first()
        .text()
        .trim();
      const date = $(el)
        .find('.date, time, .parution, .publication')
        .first()
        .text()
        .trim();
      const href = linkEl.attr('href') || $(el).find('a').first().attr('href');
      const link = href
        ? href.startsWith('http')
          ? href
          : 'https://www.francemarches.com' + href
        : url;
      if (title && title.length > 8) results.push({ title, desc, date, url: link });
    });
    return results;
  },
};

export const marchesOnlineSource: Source = {
  id: 'marchesonline',
  name: 'Marchés Online',
  country: '🇫🇷',
  description: "Tous les appels d'offres publics et privés en accès libre",
  url: 'https://www.marchesonline.com',
  search: async (query) => {
    const encoded = encodeURIComponent(query);
    const url = `https://www.marchesonline.com/appels-offres/en-cours?mots=${encoded}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const results: MarketResult[] = [];
    // Pages à exclure explicitement (navigation, abonnement, etc.)
    const BANNED_PATHS = [
      '/nous-connaitre',
      '/abonnement',
      '/connexion',
      '/pack',
      '/faq',
      '/contact',
      '/cgu',
      '/rgpd',
      '/presse',
      '/partenaires',
      '/offre-',
    ];
    $('article, .ao-item, [class*="ao-item"], [class*="appel-item"], .result-ao, tr.ao').each(
      (i, el) => {
        if (i >= 20) return false;
        const linkEl = $(el).find('a[href]').first();
        const href = linkEl.attr('href') || '';
        const fullHref = href.startsWith('http')
          ? href
          : 'https://www.marchesonline.com' + href;
        if (!href || href === '/' || href.startsWith('#')) return;
        if (BANNED_PATHS.some((p) => href.includes(p))) return;
        const title =
          linkEl.text().trim() ||
          $(el).find('h2, h3, strong').first().text().trim();
        const desc = $(el).find('.organisme, .acheteur, p').first().text().trim();
        const date = $(el).find('.date, time, .pub').first().text().trim();
        if (title && title.length > 8)
          results.push({ title, desc, date, url: fullHref });
      },
    );
    return results;
  },
};

export const awsSolutionsSource: Source = {
  id: 'aws-solutions',
  name: 'AW Solutions',
  country: '🇫🇷',
  description: 'Plateforme dématérialisation AW Solutions (awsolutions.fr)',
  url: 'https://www.marches-publics.info',
  search: async (query) => {
    const encoded = encodeURIComponent(query);
    // AW Solutions / marches-publics.info — plateforme ColdFusion
    const url = `https://www.marches-publics.info/mpiaws/index.cfm?fuseaction=entreprise.recherche&texte=${encoded}&AllCons`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const results: MarketResult[] = [];
    // Structure ColdFusion avec tableaux de résultats
    $(
      'tr.ligneBlanche, tr.ligneGrise, tr[class*="ligne"], .item_consultation, tr:has(td a[href*="consultation"])',
    ).each((i, el) => {
      if (i >= 20) return false;
      const cells = $(el).find('td');
      const title =
        cells.eq(1).text().trim() ||
        cells.eq(0).find('a').text().trim() ||
        $(el).find('.objet, h3').first().text().trim();
      const desc =
        cells.eq(2).text().trim() ||
        $(el).find('.acheteur').first().text().trim();
      const date =
        cells.eq(0).text().trim() || $(el).find('.date').first().text().trim();
      const href = $(el).find('a').first().attr('href');
      const link = href
        ? href.startsWith('http')
          ? href
          : 'https://www.marches-publics.info' + href
        : url;
      if (title && title.length > 8) results.push({ title, desc, date, url: link });
    });
    return results;
  },
};
