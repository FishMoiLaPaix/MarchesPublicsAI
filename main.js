const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

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
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.on('set-theme', (event, theme) => {
  if (!mainWindow) return;
  if (theme === 'light') {
    mainWindow.setTitleBarOverlay({ color: '#f3f3f3', symbolColor: '#1a1a1a', height: 38 });
  } else {
    mainWindow.setTitleBarOverlay({ color: '#0a0f1e', symbolColor: '#4a9eff', height: 38 });
  }
});

// ─── Scraper: sources de marchés publics ────────────────────────────────────
const SOURCES = [
  {
    id: 'boamp',
    name: 'BOAMP',
    country: '🇫🇷',
    description: 'Bulletin Officiel des Annonces de Marchés Publics',
    url: 'https://www.boamp.fr',
    search: async (query) => {
      const encoded = encodeURIComponent(query);
      // API OpenDataSoft officielle BOAMP — fiable et sans scraping
      const url = `https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records?q=${encoded}&limit=10&order_by=dateparution%20desc`;
      const data = await fetchJson(url);
      return (data.results || [])
        .map(r => ({
          title: r.objet || 'Avis BOAMP',
          desc: r.nomacheteur ? `${r.nomacheteur}${r.famille_libelle ? ' — ' + r.famille_libelle : ''}` : (r.famille_libelle || ''),
          date: (r.dateparution || '').slice(0, 10),
          url: r.url_avis || (r.idweb ? `https://www.boamp.fr/pages/avis/?q=idweb:${r.idweb}` : 'https://www.boamp.fr')
        }))
        .filter(r => r.title);
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
      const url = `https://www.marches-publics.gouv.fr/?page=entreprise.EntrepriseAdvancedSearch&AllCons&id_lot=0&y=0&texte=${encoded}`;
      const html = await fetchHtml(url);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const results = [];
      $('tr.tableRegular, .dce-item, .result-row, li.resultat, .avis-item').each((i, el) => {
        if (i >= 10) return false;
        const title = $(el).find('td:nth-child(2), .objet, h3, .libelle, a').first().text().trim();
        const date = $(el).find('td:nth-child(4), .date, time').first().text().trim();
        const href = $(el).find('a').first().attr('href');
        if (title && title.length > 5) results.push({
          title, desc: '', date,
          url: href ? (href.startsWith('http') ? href : 'https://www.marches-publics.gouv.fr' + href) : url
        });
      });
      return results;
    }
  },
  {
    id: 'ted',
    name: 'TED Europa',
    country: '🇪🇺',
    description: 'Tenders Electronic Daily — Marchés européens',
    url: 'https://ted.europa.eu',
    search: async (query) => {
      // Le paramètre q entier doit être encodé (espace et parenthèses inclus)
      const q = encodeURIComponent(`LANG:FR AND (${query})`);
      const apiUrl = `https://ted.europa.eu/api/v2.0/notices/search?fields=ND,TI,PD,MA,IA,CY&q=${q}&scope=3&limit=10&sortField=ND&sortOrder=DESC`;
      const data = await fetchJson(apiUrl);
      const notices = data.results || data.notices || [];
      return notices
        .map(n => ({
          title: n.TI || n.title || 'Avis TED',
          desc: n.IA || n.subject || '',
          date: n.PD || n.publicationDate || '',
          url: n.ND ? `https://ted.europa.eu/udl?uri=TED:NOTICE:${n.ND}:TEXT:FR:HTML` : 'https://ted.europa.eu'
        }))
        .filter(r => r.title);
    }
  },
  {
    id: 'boamp2',
    name: 'BOAMP Attributions',
    country: '🇫🇷',
    description: 'Avis d\'attribution BOAMP (contrats récemment attribués)',
    url: 'https://www.boamp.fr',
    search: async (query) => {
      const encoded = encodeURIComponent(query);
      const url = `https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records?q=${encoded}&where=nature%3D%22ATTRIBUTION%22&limit=10&order_by=dateparution%20desc`;
      const data = await fetchJson(url);
      return (data.results || [])
        .map(r => ({
          title: r.objet || 'Attribution BOAMP',
          desc: r.titulaire ? `Titulaire : ${r.titulaire}${r.nomacheteur ? ' — ' + r.nomacheteur : ''}` : (r.nomacheteur || ''),
          date: (r.dateparution || '').slice(0, 10),
          url: r.url_avis || (r.idweb ? `https://www.boamp.fr/pages/avis/?q=idweb:${r.idweb}` : 'https://www.boamp.fr')
        }))
        .filter(r => r.title);
    }
  }
];

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

function fetchJson(url, timeout = 12000) {
  return fetchHtml(url, timeout).then(t => JSON.parse(t));
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

ipcMain.handle('search-source', async (_, { sourceId, query }) => {
  const source = SOURCES.find(s => s.id === sourceId);
  if (!source) return { sourceId, results: [], error: 'Source inconnue' };
  try {
    const results = await source.search(query);
    return { sourceId, results };
  } catch (e) {
    return { sourceId, results: [], error: e.message };
  }
});

ipcMain.handle('analyze-with-ai', async (_, { aiConfig, query, results }) => {
  const systemPrompt = `Tu es un expert en marchés publics français et européens. 
Tu analyses des annonces de marchés publics et tu identifies celles qui correspondent aux besoins de l'utilisateur.
Pour chaque résultat pertinent, tu expliques pourquoi il correspond et tu donnes un score de pertinence de 0 à 100.
Réponds en JSON avec ce format exact:
{
  "summary": "résumé général de la recherche",
  "relevant": [
    {
      "index": 0,
      "score": 85,
      "reason": "raison de pertinence",
      "highlights": ["point clé 1", "point clé 2"]
    }
  ],
  "recommendations": "conseils pour affiner la recherche"
}`;

  const userPrompt = `L'utilisateur cherche: "${query}"

Voici les marchés publics trouvés (${results.length} résultats au total):
${results.map((r, i) => `[${i}] SOURCE: ${r.sourceName}
Titre: ${r.title}
Description: ${r.desc || 'N/A'}
Date: ${r.date || 'N/A'}
URL: ${r.url}`).join('\n\n')}

Analyse ces résultats et identifie ceux qui correspondent à la recherche.`;

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
