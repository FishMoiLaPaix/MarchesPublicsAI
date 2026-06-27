// Helpers purs (sans Node) réutilisables dans le renderer ET le main.
// Extrait de la logique pour éviter d'importer config.ts (fs) côté navigateur.

import { PERSOIA_DEFAULT_BASE, PERSOIA_DEMO_BASE } from './types';

/** Déduit la base d'API : surcharge explicite > préfixe démo > prod. */
export function deduceApiBaseClient(apiKey: string, explicit?: string): string {
  if (explicit && explicit.trim()) return explicit.trim();
  if ((apiKey || '').trim().startsWith('persoia_demo_sk_')) {
    return PERSOIA_DEMO_BASE;
  }
  return PERSOIA_DEFAULT_BASE;
}
