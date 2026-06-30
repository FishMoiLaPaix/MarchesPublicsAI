// Helpers HTTP des sources (process Electron principal — Node). Port fidèle des
// helpers de l'ancienne app (legacy/main.js fetchHtml/fetchJson/postJson) vers
// axios : même User-Agent navigateur, suivi des redirections, erreur « HTTP <code> »
// sur statut >= 400, et parse JSON explicite (erreur « Réponse non-JSON » sinon).
//
// Aucun import Electron : ce module est testable directement sous Node/vitest.

import axios from 'axios';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function httpError(status: number): Error {
  return new Error(`HTTP ${status}`);
}

/** GET HTML brut (scraping). Suit les redirections, lève « HTTP <code> » si >= 400. */
export async function fetchHtml(url: string, timeout = 15000): Promise<string> {
  try {
    const res = await axios.get<string>(url, {
      timeout,
      responseType: 'text',
      maxRedirects: 10,
      transformResponse: (d) => d, // garde le texte brut, pas de parse auto.
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    });
    return res.data;
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (status) throw httpError(status);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/** GET JSON. Suit les redirections, parse explicitement (erreur si non-JSON). */
export async function fetchJson<T = unknown>(
  url: string,
  timeout = 15000,
): Promise<T> {
  let raw: string;
  try {
    const res = await axios.get<string>(url, {
      timeout,
      responseType: 'text',
      maxRedirects: 10,
      transformResponse: (d) => d,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    });
    raw = res.data;
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (status) throw httpError(status);
    throw e instanceof Error ? e : new Error(String(e));
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Réponse non-JSON: ' + raw.slice(0, 120));
  }
}

/** POST JSON (API TED v3). Parse explicitement la réponse. */
export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  timeout = 20000,
): Promise<T> {
  let raw: string;
  try {
    const res = await axios.post<string>(url, JSON.stringify(body), {
      timeout,
      responseType: 'text',
      maxRedirects: 10,
      transformResponse: (d) => d,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    raw = res.data;
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (status) throw httpError(status);
    throw e instanceof Error ? e : new Error(String(e));
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Réponse non-JSON: ' + raw.slice(0, 120));
  }
}
