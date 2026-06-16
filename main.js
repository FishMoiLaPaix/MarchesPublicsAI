const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0f1e',
      symbolColor: '#4a9eff',
      height: 38
    },
    backgroundColor: '#0a0f1e',
    show: false
  });

  mainWindow.loadFile('index.html');
  const doShow = () => { try { if (mainWindow && !mainWindow.isVisible()) mainWindow.show(); } catch {} };
  mainWindow.once('ready-to-show', doShow);
  setTimeout(doShow, 6000); // fallback si ready-to-show ne se déclenche pas
}

// Empêche plusieurs instances simultanées (cause du "doit relancer plusieurs fois")
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
  app.whenReady().then(() => {
    createWindow();
    getGeoReference().catch(() => {}); // précharge le référentiel géo en tâche de fond
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}

// ─── Persistent store (JSON file in userData) ────────────────────────────────
let _storeCache = null;
function loadStore() {
  if (_storeCache) return _storeCache;
  try { _storeCache = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'store.json'), 'utf8')); }
  catch { _storeCache = {}; }
  return _storeCache;
}
function saveStore() {
  try { fs.writeFileSync(path.join(app.getPath('userData'), 'store.json'), JSON.stringify(_storeCache), 'utf8'); } catch {}
}
ipcMain.handle('store-get', (event, key) => loadStore()[key] ?? null);
ipcMain.handle('store-set', (event, key, value) => { loadStore()[key] = value; saveStore(); return true; });

ipcMain.on('set-theme', (event, theme) => {
  if (!mainWindow) return;
  if (theme === 'light') {
    mainWindow.setTitleBarOverlay({ color: '#f3f3f3', symbolColor: '#1a1a1a', height: 38 });
  } else {
    mainWindow.setTitleBarOverlay({ color: '#0a0f1e', symbolColor: '#4a9eff', height: 38 });
  }
});

// ─── Scraper: sources de marchés publics ────────────────────────────────────

// Construit une clause ODSQL "where" pour BOAMP à partir des facettes de recherche :
// mots-clés dans l'objet (objet like, pas le q= plein-texte inopérant), département
// officiel, et critères structurés (domaine, type de marché, procédure, type d'avis,
// état, dates de publication et de clôture). Sépare le QUOI du OÙ et du COMMENT.
function boampToday() { return new Date().toISOString().slice(0, 10); }
function boampWhere(opts = {}) {
  const esc = s => String(s).replace(/["\\]/g, ' ').trim();
  const clauses = [];
  const kws = (Array.isArray(opts.keywords) ? opts.keywords : []).map(esc).filter(w => w.length >= 3);
  kws.forEach(w => clauses.push(`objet like "${w}"`));

  const depts = Array.isArray(opts.depts) ? opts.depts : [];
  if (depts.length) {
    const dq = depts.map(d => `code_departement="${esc(d)}" or code_departement_prestation="${esc(d)}"`).join(' or ');
    clauses.push(`(${dq})`);
  }

  const f = opts.facets || {};
  if (f.typeMarche) clauses.push(`type_marche="${esc(f.typeMarche)}"`);
  if (f.famille)    clauses.push(`famille_libelle="${esc(f.famille)}"`);
  if (f.procedure)  clauses.push(`procedure_libelle="${esc(f.procedure)}"`);
  if (f.nature)     clauses.push(`nature="${esc(f.nature)}"`);
  if (f.pubFrom)    clauses.push(`dateparution>=date'${esc(f.pubFrom)}'`);
  if (f.pubTo)      clauses.push(`dateparution<=date'${esc(f.pubTo)}'`);
  if (f.closeFrom)  clauses.push(`datelimitereponse>=date'${esc(f.closeFrom)}'`);
  if (f.closeTo)    clauses.push(`datelimitereponse<=date'${esc(f.closeTo)}'`);
  if (f.etat === 'en-cours') clauses.push(`datelimitereponse>=date'${boampToday()}'`);
  if (f.etat === 'cloture')  clauses.push(`datelimitereponse<date'${boampToday()}'`);

  return clauses.join(' and ');
}
const BOAMP_RECORDS = 'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records';

// Recherche TED / JOUE via l'API officielle v3 (l'ancienne v2.0 est décommissionnée).
// franceOnly=true → restreint aux avis concernant la France (CY=FRA) : c'est le
// périmètre du Journal Officiel de l'UE (JOUE) pertinent pour un acheteur français.
async function tedSearch(query, offset = 0, opts = {}, franceOnly = false) {
  const esc = s => String(s).replace(/["\\]/g, ' ').trim();
  const kws = (Array.isArray(opts.keywords) && opts.keywords.length)
    ? opts.keywords : String(query || '').split(/\s+/).filter(w => w.length >= 3);
  const parts = [];
  if (kws.length) parts.push(`FT~"${kws.map(esc).join(' ')}"`);
  if (franceOnly) parts.push('CY=FRA');
  let q = (parts.join(' AND ') || 'PD>=20180101') + ' SORT BY PD DESC';
  const limit = 25;
  const page = Math.floor(offset / limit) + 1;
  const data = await postJson('https://api.ted.europa.eu/v3/notices/search',
    { query: q, fields: ['ND', 'TI', 'PD'], page, limit, scope: 'ALL' });
  const pick = ti => ti ? (ti.fra || ti.eng || Object.values(ti)[0] || '') : '';
  const items = (data.notices || []).map(n => ({
    title: String(pick(n.TI) || n.ND || 'Avis JOUE'),
    desc: '',
    date: (n.PD || '').slice(0, 10),
    url: n.ND ? `https://ted.europa.eu/fr/notice/-/detail/${n.ND}` : 'https://ted.europa.eu'
  })).filter(r => r.title);
  return { results: items, total: data.totalNoticeCount || items.length };
}

const SOURCES = [
  {
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
      const data = await fetchJson(url);
      const items = (data.results || [])
        .map(r => ({
          title: r.objet || 'Avis BOAMP',
          desc: r.nomacheteur ? `${r.nomacheteur}${r.famille_libelle ? ' — ' + r.famille_libelle : ''}` : (r.famille_libelle || ''),
          date: (r.dateparution || '').slice(0, 10),
          datelimite: (r.datelimitereponse || '').slice(0, 10),
          procedure: r.procedure_libelle || '',
          depts: Array.isArray(r.code_departement) ? r.code_departement : (r.code_departement_prestation ? [r.code_departement_prestation] : []),
          url: r.idweb ? `https://www.boamp.fr/avis/detail/${r.idweb}` : 'https://www.boamp.fr'
        }))
        .filter(r => r.title);
      return { results: items, total: data.total_count || items.length };
    }
  },
  {
    id: 'place',
    name: 'PLACE',
    country: '🇫🇷',
    description: 'Plateforme des Achats de l\'État',
    url: 'https://www.marches-publics.gouv.fr',
    search: async (query) => {
      const encoded = encodeURIComponent(query);
      const url = `https://www.marches-publics.gouv.fr/index.php?page=entreprise.EntrepriseAdvancedSearch&AllCons&texte=${encoded}`;
      const html = await fetchHtml(url);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      $('.item_consultation').each((i, el) => {
        if (i >= 20) return false;
        const titleEl = $(el).find('[id*="panelBlocObjet"] .truncate-700');
        const title = titleEl.attr('title') || titleEl.find('span').not('.h5, strong').last().text().trim();
        const descEl = $(el).find('[id*="panelBlocDenomination"] .truncate-700');
        const desc = descEl.attr('title') || descEl.find('.small').text().trim();
        const day   = $(el).find('.date-min .day span').text().trim();
        const month = $(el).find('.date-min .month span').text().trim();
        const year  = $(el).find('.date-min .year span').text().trim();
        const date  = day && year ? `${day} ${month} ${year}` : '';
        const refCons = $(el).find('input[name*="refCons"]').val();
        const orgCons = $(el).find('input[name*="orgCons"]').val();
        const link = refCons && orgCons
          ? `https://www.marches-publics.gouv.fr/entreprise/consultation/${refCons}?orgAcronyme=${orgCons}`
          : 'https://www.marches-publics.gouv.fr';
        if (title && title.length > 5) results.push({ title, desc, date, url: link });
      });
      return results;
    }
  },
  {
    id: 'ted',
    name: 'TED Europa',
    country: '🇪🇺',
    description: 'Tenders Electronic Daily — tous marchés européens',
    url: 'https://ted.europa.eu',
    search: (query, offset = 0, opts = {}) => tedSearch(query, offset, opts, false)
  },
  {
    id: 'joue',
    name: 'J.O.U.E',
    country: '🇪🇺',
    description: 'Journal Officiel de l\'Union Européenne — avis concernant la France',
    url: 'https://ted.europa.eu',
    search: (query, offset = 0, opts = {}) => tedSearch(query, offset, opts, true)
  },
  {
    id: 'demat-ampa',
    name: 'Demat-AMPA',
    country: '🇫🇷',
    description: 'Plateforme dématérialisation Occitanie / Midi-Pyrénées',
    url: 'https://www.demat-ampa.fr',
    search: async (query) => {
      const encoded = encodeURIComponent(query);
      const url = `https://www.demat-ampa.fr/index.php?page=entreprise.EntrepriseAdvancedSearch&AllCons&texte=${encoded}`;
      const html = await fetchHtml(url);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      $('.item_consultation').each((i, el) => {
        if (i >= 20) return false;
        const titleEl = $(el).find('[id*="panelBlocObjet"] .truncate-700');
        const title = titleEl.attr('title') || titleEl.find('span').not('.h5, strong').last().text().trim();
        const descEl = $(el).find('[id*="panelBlocDenomination"] .truncate-700');
        const desc = descEl.attr('title') || descEl.find('.small').text().trim();
        const day   = $(el).find('.date-min .day span').text().trim();
        const month = $(el).find('.date-min .month span').text().trim();
        const year  = $(el).find('.date-min .year span').text().trim();
        const date  = day && year ? `${day} ${month} ${year}` : '';
        const refCons = $(el).find('input[name*="refCons"]').val();
        const orgCons = $(el).find('input[name*="orgCons"]').val();
        const link = refCons && orgCons
          ? `https://www.demat-ampa.fr/entreprise/consultation/${refCons}?orgAcronyme=${orgCons}`
          : 'https://www.demat-ampa.fr';
        if (title && title.length > 5) results.push({ title, desc, date, url: link });
      });
      return results;
    }
  },
  {
    id: 'marches-securises',
    name: 'Marchés Sécurisés',
    country: '🇫🇷',
    description: 'Plateforme nationale de dématérialisation',
    url: 'https://www.marches-securises.fr',
    search: async (query) => {
      const encoded = encodeURIComponent(query);
      const url = `https://www.marches-securises.fr/index.php?page=entreprise.EntrepriseAdvancedSearch&AllCons&texte=${encoded}`;
      const html = await fetchHtml(url);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      $('.item_consultation').each((i, el) => {
        if (i >= 20) return false;
        const titleEl = $(el).find('[id*="panelBlocObjet"] .truncate-700');
        const title = titleEl.attr('title') || titleEl.find('span').not('.h5, strong').last().text().trim();
        const descEl = $(el).find('[id*="panelBlocDenomination"] .truncate-700');
        const desc = descEl.attr('title') || descEl.find('.small').text().trim();
        const day   = $(el).find('.date-min .day span').text().trim();
        const month = $(el).find('.date-min .month span').text().trim();
        const year  = $(el).find('.date-min .year span').text().trim();
        const date  = day && year ? `${day} ${month} ${year}` : '';
        const refCons = $(el).find('input[name*="refCons"]').val();
        const orgCons = $(el).find('input[name*="orgCons"]').val();
        const link = refCons && orgCons
          ? `https://www.marches-securises.fr/entreprise/consultation/${refCons}?orgAcronyme=${orgCons}`
          : 'https://www.marches-securises.fr';
        if (title && title.length > 5) results.push({ title, desc, date, url: link });
      });
      return results;
    }
  },
  {
    id: 'e-marchespublics',
    name: 'e-Marchés Publics',
    country: '🇫🇷',
    description: 'Portail national des appels d\'offres publics et dématérialisation',
    url: 'https://www.e-marchespublics.com',
    search: async (query) => {
      const slug = query.trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const encoded = encodeURIComponent(query);
      // Essai 1 : page de résultats par slug
      const url = `https://www.e-marchespublics.com/appels-offres/${slug}`;
      const html = await fetchHtml(url);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      // Sélecteurs larges pour agrégateur de marchés
      $('article, .offre, .tender, .consultation, .ao, li.item, .card, [class*="marche"], [class*="offre"]').each((i, el) => {
        if (i >= 20) return false;
        const titleEl = $(el).find('h1, h2, h3, .title, .objet, strong a, a').first();
        const title = titleEl.attr('title') || titleEl.text().trim();
        const desc  = $(el).find('.acheteur, .organisme, .buyer, p, .desc, .subtitle').first().text().trim();
        const date  = $(el).find('.date, time, [datetime], .parution, .pub').first().text().trim();
        const href  = $(el).find('a').first().attr('href') || titleEl.attr('href');
        const link  = href ? (href.startsWith('http') ? href : 'https://www.e-marchespublics.com' + href) : url;
        if (title && title.length > 8) results.push({ title, desc, date, url: link });
      });
      return results;
    }
  },
  {
    id: 'francemarches',
    name: 'France Marchés',
    country: '🇫🇷',
    description: 'Portail n°1 des appels d\'offres — agrégateur national',
    url: 'https://www.francemarches.com',
    search: async (query) => {
      // France Marchés utilise des URL slug : /appels-offre/MOT-CLE
      const slug = query.trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const url = `https://www.francemarches.com/appels-offre/${slug}`;
      const html = await fetchHtml(url);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      // Selectors France Marchés (liste d'avis)
      $('article, li.offre, .offre-item, .result-offre, .item-offre, [class*="offre"], [class*="avis"]').each((i, el) => {
        if (i >= 20) return false;
        const linkEl = $(el).find('a[href*="/appel-offre/"], a[href*="/offre/"]').first();
        const title = linkEl.text().trim() || $(el).find('h2, h3, .title').first().text().trim();
        const desc  = $(el).find('.acheteur, .buyer, .organisme, .reference, p').first().text().trim();
        const date  = $(el).find('.date, time, .parution, .publication').first().text().trim();
        const href  = linkEl.attr('href') || $(el).find('a').first().attr('href');
        const link  = href ? (href.startsWith('http') ? href : 'https://www.francemarches.com' + href) : url;
        if (title && title.length > 8) results.push({ title, desc, date, url: link });
      });
      return results;
    }
  },
  {
    id: 'marchesonline',
    name: 'Marchés Online',
    country: '🇫🇷',
    description: 'Tous les appels d\'offres publics et privés en accès libre',
    url: 'https://www.marchesonline.com',
    search: async (query) => {
      const encoded = encodeURIComponent(query);
      const url = `https://www.marchesonline.com/appels-offres/en-cours?mots=${encoded}`;
      const html = await fetchHtml(url);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      // Pages à exclure explicitement (navigation, abonnement, etc.)
      const BANNED_PATHS = ['/nous-connaitre', '/abonnement', '/connexion', '/pack', '/faq', '/contact', '/cgu', '/rgpd', '/presse', '/partenaires', '/offre-'];
      $('article, .ao-item, [class*="ao-item"], [class*="appel-item"], .result-ao, tr.ao').each((i, el) => {
        if (i >= 20) return false;
        const linkEl = $(el).find('a[href]').first();
        const href = linkEl.attr('href') || '';
        const fullHref = href.startsWith('http') ? href : 'https://www.marchesonline.com' + href;
        if (!href || href === '/' || href.startsWith('#')) return;
        if (BANNED_PATHS.some(p => href.includes(p))) return;
        const title = linkEl.text().trim() || $(el).find('h2, h3, strong').first().text().trim();
        const desc  = $(el).find('.organisme, .acheteur, p').first().text().trim();
        const date  = $(el).find('.date, time, .pub').first().text().trim();
        if (title && title.length > 8) results.push({ title, desc, date, url: fullHref });
      });
      return results;
    }
  },
  {
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
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      // Structure ColdFusion avec tableaux de résultats
      $('tr.ligneBlanche, tr.ligneGrise, tr[class*="ligne"], .item_consultation, tr:has(td a[href*="consultation"])').each((i, el) => {
        if (i >= 20) return false;
        const cells = $(el).find('td');
        const title = cells.eq(1).text().trim() || cells.eq(0).find('a').text().trim() || $(el).find('.objet, h3').first().text().trim();
        const desc  = cells.eq(2).text().trim() || $(el).find('.acheteur').first().text().trim();
        const date  = cells.eq(0).text().trim() || $(el).find('.date').first().text().trim();
        const href  = $(el).find('a').first().attr('href');
        const link  = href ? (href.startsWith('http') ? href : 'https://www.marches-publics.info' + href) : url;
        if (title && title.length > 8) results.push({ title, desc, date, url: link });
      });
      return results;
    }
  },
  {
    id: 'boamp2',
    name: 'BOAMP Attributions',
    country: '🇫🇷',
    description: 'Avis d\'attribution BOAMP (contrats récemment attribués)',
    url: 'https://www.boamp.fr',
    search: async (query, offset = 0, opts = {}) => {
      const parts = ['nature="ATTRIBUTION"'];
      const w = boampWhere(opts);
      if (w) parts.push(w);
      const where = parts.join(' and ');
      const url = `${BOAMP_RECORDS}?where=${encodeURIComponent(where)}&limit=50&offset=${offset}&order_by=${encodeURIComponent('dateparution desc')}`;
      const data = await fetchJson(url);
      const items = (data.results || [])
        .map(r => ({
          title: r.objet || 'Attribution BOAMP',
          desc: r.titulaire ? `Titulaire : ${r.titulaire}${r.nomacheteur ? ' — ' + r.nomacheteur : ''}` : (r.nomacheteur || ''),
          date: (r.dateparution || '').slice(0, 10),
          datelimite: (r.datelimitereponse || '').slice(0, 10),
          procedure: r.procedure_libelle || '',
          depts: Array.isArray(r.code_departement) ? r.code_departement : (r.code_departement_prestation ? [r.code_departement_prestation] : []),
          url: r.idweb ? `https://www.boamp.fr/avis/detail/${r.idweb}` : 'https://www.boamp.fr'
        }))
        .filter(r => r.title);
      return { results: items, total: data.total_count || items.length };
    }
  }
];

// ─── Référentiel géographique (officiel, geo.api.gouv.fr) ────────────────────
// Construit automatiquement une table { nom normalisé → [codes département] } à
// partir des données officielles (départements, régions, communes ≥ 2000 hab).
// Aucune zone n'est définie à la main : tout vient du registre national.
let _geoRefPromise = null;
function geoNorm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
async function buildGeoReference() {
  const cached = loadStore()['geo-ref-v1'];
  if (cached && cached.names) return cached;

  const ref = { names: {}, deptCodes: [] };
  const add = (name, codes) => {
    const k = geoNorm(name);
    if (!k || k.length < 3) return;
    ref.names[k] = [...new Set([...(ref.names[k] || []), ...codes])];
  };

  const [deps, regs, communes] = await Promise.all([
    fetchJson('https://geo.api.gouv.fr/departements?fields=nom,code,codeRegion'),
    fetchJson('https://geo.api.gouv.fr/regions?fields=nom,code'),
    fetchJson('https://geo.api.gouv.fr/communes?fields=nom,codeDepartement,population&format=json')
  ]);

  deps.forEach(d => add(d.nom, [d.code]));
  ref.deptCodes = deps.map(d => d.code);

  const byRegion = {};
  deps.forEach(d => { (byRegion[d.codeRegion] = byRegion[d.codeRegion] || []).push(d.code); });
  regs.forEach(r => add(r.nom, byRegion[r.code] || []));

  communes.filter(c => (c.population || 0) >= 2000)
    .forEach(c => add(c.nom, [c.codeDepartement]));

  loadStore()['geo-ref-v1'] = ref;
  saveStore();
  return ref;
}
function getGeoReference() {
  if (!_geoRefPromise) _geoRefPromise = buildGeoReference().catch(e => { _geoRefPromise = null; throw e; });
  return _geoRefPromise;
}
ipcMain.handle('get-geo-reference', async () => {
  try { return await getGeoReference(); } catch { return null; }
});

// ─── HTTP helpers ────────────────────────────────────────────────────────────
function fetchHtml(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      },
      timeout
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchHtml(res.headers.location, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function fetchJson(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      },
      timeout
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchJson(res.headers.location, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Réponse non-JSON: ' + data.slice(0, 120))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// POST JSON (utilisé par l'API TED v3).
function postJson(url, body, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout
    }, (res) => {
      if (res.statusCode >= 400) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('Réponse non-JSON: ' + d.slice(0, 120))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

// ─── AI call (multi-provider) ────────────────────────────────────────────────
async function callAI(config, systemPrompt, userPrompt) {
  const { provider, apiKey, endpoint, model } = config;

  const providers = {
    anthropic: {
      url: endpoint || 'https://api.anthropic.com/v1/messages',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: { model: model || 'claude-opus-4-6', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] },
      extract: (d) => d.content?.[0]?.text || ''
    },
    openai: {
      url: endpoint || 'https://api.openai.com/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: { model: model || 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] },
      extract: (d) => d.choices?.[0]?.message?.content || ''
    },
    mistral: {
      url: endpoint || 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: { model: model || 'mistral-large-latest', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] },
      extract: (d) => d.choices?.[0]?.message?.content || ''
    },
    ollama: {
      url: endpoint || 'http://localhost:11434/api/chat',
      headers: { 'content-type': 'application/json' },
      body: { model: model || 'llama3', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], stream: false },
      extract: (d) => d.message?.content || ''
    },
    custom: {
      url: endpoint,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: { model: model || 'default', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] },
      extract: (d) => d.choices?.[0]?.message?.content || d.content?.[0]?.text || d.response || JSON.stringify(d)
    }
  };

  const p = providers[provider] || providers.custom;
  if (!p.url) throw new Error('Endpoint requis pour le provider custom');

  const parsed = new URL(p.url);
  const lib = parsed.protocol === 'https:' ? https : http;
  const body = JSON.stringify(p.body);

  return new Promise((resolve, reject) => {
    const req = lib.request(p.url, {
      method: 'POST',
      headers: { ...p.headers, 'content-length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(json.error.message || JSON.stringify(json.error)));
          else resolve(p.extract(json));
        } catch (e) { reject(new Error('Réponse invalide: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── IPC handlers ────────────────────────────────────────────────────────────
ipcMain.handle('get-sources', () => SOURCES.map(s => ({ id: s.id, name: s.name, country: s.country, description: s.description, url: s.url })));

ipcMain.handle('search-source', async (_, { sourceId, query, offset = 0, keywords, depts, facets }) => {
  const source = SOURCES.find(s => s.id === sourceId);
  if (!source) return { sourceId, results: [], total: 0, error: 'Source inconnue' };
  try {
    const raw = await source.search(query, offset, { keywords, depts, facets });
    const results = Array.isArray(raw) ? raw : (raw.results || []);
    const total = Array.isArray(raw) ? raw.length : (raw.total || results.length);
    return { sourceId, results, total };
  } catch (e) {
    return { sourceId, results: [], total: 0, error: e.message };
  }
});

ipcMain.handle('analyze-with-ai', async (_, { aiConfig, query, results }) => {
  const systemPrompt = `Tu es un expert en marchés publics français et européens spécialisé dans l'analyse de pertinence.

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

  // Détection de zones géographiques dans la requête
  const geoPattern = /\b(Paris|Lyon|Marseille|Toulouse|Bordeaux|Lille|Nantes|Strasbourg|Montpellier|Rennes|Reims|Nice|Rouen|Grenoble|Dijon|Angers|Nîmes|Toulon|Brest|Amiens|Tours|Limoges|Le Mans|Metz|Besançon|Orléans|Mulhouse|Caen|Nancy|Argenteuil|Montreuil|Saint-Denis|Île-de-France|Bretagne|Normandie|Occitanie|PACA|Provence|Nouvelle-Aquitaine|Hauts-de-France|Grand Est|Auvergne|Rhône-Alpes|Centre-Val de Loire|Bourgogne|Franche-Comté|Pays de la Loire|Corse|\b[0-9]{5}\b|\b[0-9]{2}\b)\b/gi;
  const geoMatches = [...new Set((query.match(geoPattern) || []).map(s => s.trim()))];
  const geoWarning = geoMatches.length > 0
    ? `\n⚠️ ZONE GÉOGRAPHIQUE DÉTECTÉE: ${geoMatches.join(', ')} — tout résultat clairement hors de cette zone doit recevoir score ≤ 10.`
    : '';

  const userPrompt = `Requête utilisateur: "${query}"${geoWarning}

Analyse ces ${results.length} résultats. Note CHAQUE index de 0 à ${results.length - 1} dans "relevant".

${results.map((r, i) => `[${i}] ${r.sourceName}
  Titre: ${r.title}
  Desc: ${r.desc || '—'}
  Date: ${r.date || '—'}
  URL: ${r.url}`).join('\n\n')}

Réponds uniquement en JSON valide.`;

  try {
    const response = await callAI(aiConfig, systemPrompt, userPrompt);
    const clean = response.replace(/```json|```/g, '').trim();
    return { success: true, analysis: JSON.parse(clean) };
  } catch (e) {
    // Si le JSON parse échoue, retourner le texte brut
    try {
      const match = response?.match(/\{[\s\S]*\}/);
      if (match) return { success: true, analysis: JSON.parse(match[0]) };
    } catch {}
    return { success: false, error: e.message, rawResponse: '' };
  }
});

ipcMain.handle('open-url', (_, url) => shell.openExternal(url));

ipcMain.handle('test-ai', async (_, aiConfig) => {
  try {
    const result = await callAI(aiConfig, 'Tu es un assistant.', 'Réponds juste "OK" pour confirmer que la connexion fonctionne.');
    return { success: true, message: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
