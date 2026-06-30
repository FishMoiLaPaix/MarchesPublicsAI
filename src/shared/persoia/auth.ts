// Façade d'authentification côté renderer (Vue). Masque les différences de
// plateforme et expose une API simple à la page d'exemple.
//
//   • Electron (desktop) : délègue au pont preload window.persoia, qui réalise le
//     login loopback ET lit/écrit le config.env PARTAGÉ entre tous les outils.
//   • Web / PWA : pas de fichier partagé ni de serveur local possible → repli sur
//     LocalStorage (la clé est saisie/collée par l'utilisateur). Voir
//     docs/02-authentification.md pour la stratégie redirect en production.
//   • Capacitor (mobile) : à brancher sur un deep-link + Secure Storage (stub doc).
//
// Le « token partagé entre outils » n'a de sens que sur desktop (fichier commun).

import { deduceApiBaseClient } from './base';
import {
  PERSOIA_DEFAULT_BASE,
  type PersoiaConfig,
} from './types';

const LS_KEY = 'persoia_api_key';
const LS_BASE = 'persoia_api_base';
const LS_MODEL = 'persoia_model';

export type Platform = 'electron' | 'web';

export function detectPlatform(): Platform {
  return typeof window !== 'undefined' && window.persoia ? 'electron' : 'web';
}

/** Construit une config web à partir du LocalStorage (repli navigateur). */
function webConfig(): PersoiaConfig {
  const key =
    (typeof localStorage !== 'undefined' && localStorage.getItem(LS_KEY)) || '';
  const base =
    (typeof localStorage !== 'undefined' && localStorage.getItem(LS_BASE)) || '';
  const model =
    (typeof localStorage !== 'undefined' && localStorage.getItem(LS_MODEL)) || '';
  return {
    PERSOIA_API_KEY: key,
    PERSOIA_API_BASE: deduceApiBaseClient(key, base),
    PERSOIA_MODEL: model,
    PERSOIA_TENANT_NAME: '',
  };
}

/** Lit la config effective (clé + base + modèle), selon la plateforme. */
export async function getConfig(): Promise<PersoiaConfig> {
  if (detectPlatform() === 'electron') {
    return window.persoia!.getConfig();
  }
  return webConfig();
}

/** Vrai si une clé API est disponible. */
export async function isAuthenticated(): Promise<boolean> {
  const cfg = await getConfig();
  return Boolean(cfg.PERSOIA_API_KEY);
}

/**
 * Lance la connexion.
 *   • Electron : login loopback navigateur (transparent), clé écrite dans le store partagé.
 *   • Web : enregistre une clé fournie manuellement dans LocalStorage.
 * Renvoie la clé obtenue, ou null.
 */
export async function login(
  clientId: string,
  manualKey?: string,
): Promise<string | null> {
  if (detectPlatform() === 'electron') {
    return window.persoia!.login(clientId);
  }
  // Web : pas de loopback possible, on stocke la clé saisie.
  const key = (manualKey || '').trim();
  if (!key) return null;
  try {
    localStorage.setItem(LS_KEY, key);
    localStorage.setItem(LS_BASE, deduceApiBaseClient(key, ''));
  } catch {
    // LocalStorage indisponible (sandbox, navigation privée stricte, SSR/tests).
    return null;
  }
  return key;
}

/** Déconnexion : efface la clé (store partagé en Electron, LocalStorage en web). */
export async function logout(): Promise<void> {
  if (detectPlatform() === 'electron') {
    await window.persoia!.logout();
    return;
  }
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // LocalStorage indisponible — la clé n'est pas stockée, rien à effacer.
  }
}

export { PERSOIA_DEFAULT_BASE };
