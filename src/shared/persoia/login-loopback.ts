// Login PersoIA par boucle locale (loopback). Node uniquement — process principal
// Electron. Reproduit le contrat de persoia-auth / MarchesPublicsAI :
//
//   1. on démarre un serveur HTTP éphémère sur 127.0.0.1:<port aléatoire> ;
//   2. on ouvre le navigateur sur {portail}/cli?callback=…&state=…&client=<addon> ;
//   3. le portail (déjà authentifié) POST {token,…} sur /callback ;
//   4. on vérifie le state anti-CSRF (comparaison à temps constant) et on rend la clé.
//
// L'utilisateur ne tape JAMAIS son mot de passe dans l'outil : il s'authentifie
// sur le portail persoIA, qui renvoie un token par le callback local.

import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PERSOIA_DEFAULT_BASE } from './types';

export interface LoopbackResult {
  token: string;
  api_base?: string;
  model?: string;
  tenant_name?: string;
}

export interface LoginOptions {
  /** Identifiant de l'outil (header X-Persoia-Client). */
  client: string;
  /** Base d'API configurée, sert à déduire le portail (chat.*). */
  apiBase?: string;
  /** Ouvre une URL dans le navigateur par défaut (ex. shell.openExternal). */
  openUrl: (url: string) => void | Promise<void>;
  /** Délai max avant abandon (ms). */
  timeoutMs?: number;
}

/** Déduit l'URL du portail (https://chat.persoia.com) à partir de la base d'API. */
function portalBase(apiBase?: string): string {
  const base = (apiBase || PERSOIA_DEFAULT_BASE).replace(/\/v1\/?$/, '');
  try {
    const url = new URL(base);
    // Sécurité : on n'accepte qu'un hôte *.persoia.com en HTTPS.
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.persoia.com')) {
      return 'https://chat.persoia.com';
    }
    // api.persoia.com → chat.persoia.com (le portail de login vit sur chat.*).
    url.hostname = url.hostname.replace(/^api\./, 'chat.');
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://chat.persoia.com';
  }
}

/** Comparaison de chaînes à temps constant (anti-CSRF sur le state). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function loginLoopback(opts: LoginOptions): Promise<LoopbackResult | null> {
  const { client, apiBase, openUrl } = opts;
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const state = randomBytes(24).toString('base64url');
  const portal = portalBase(apiBase);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: LoopbackResult | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      resolve(value);
    };

    const server = createServer((req, res) => {
      // CORS : on autorise uniquement le portail persoIA (et le preflight PNA).
      const origin = req.headers.origin || '';
      if (origin.endsWith('.persoia.com')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }

      const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
      if (!reqUrl.pathname.startsWith('/callback')) {
        res.writeHead(404).end();
        return;
      }

      const respondOk = () => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!doctype html><meta charset="utf-8"><title>persoIA</title>' +
            '<p style="font-family:sans-serif">Connexion réussie. ' +
            'Vous pouvez fermer cet onglet et revenir à l\'application.</p>',
        );
      };

      const handle = (payload: Record<string, string>) => {
        if (!payload.token || !payload.state || !safeEqual(payload.state, state)) {
          res.writeHead(400).end('invalid state');
          return;
        }
        respondOk();
        finish({
          token: payload.token,
          api_base: payload.api_base,
          model: payload.model,
          tenant_name: payload.tenant_name,
        });
      };

      if (req.method === 'GET') {
        const p = reqUrl.searchParams;
        handle({
          token: p.get('token') || '',
          state: p.get('state') || '',
          api_base: p.get('api_base') || '',
          model: p.get('model') || '',
          tenant_name: p.get('tenant_name') || '',
        });
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', (c) => {
          body += c;
          if (body.length > 64 * 1024) req.destroy(); // garde-fou taille.
        });
        req.on('end', () => {
          try {
            handle(JSON.parse(body || '{}'));
          } catch {
            res.writeHead(400).end('bad json');
          }
        });
        return;
      }

      res.writeHead(405).end();
    });

    const timer = setTimeout(() => finish(null), timeoutMs);

    // 127.0.0.1 littéral (pas "localhost", qui peut résoudre en ::1).
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const params = new URLSearchParams({
        callback: `http://127.0.0.1:${port}/callback`,
        state,
        client,
      });
      void openUrl(`${portal}/cli?${params.toString()}`);
    });

    server.on('error', () => finish(null));
  });
}
