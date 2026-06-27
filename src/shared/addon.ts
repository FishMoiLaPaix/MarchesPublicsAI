// Accès typé au manifeste de l'addon depuis le renderer. addon.config.json est la
// SEULE source de vérité de l'identité de l'outil (cf. scripts/init-addon.sh).

import manifest from '../../addon.config.json';

export interface AddonManifest {
  name: string;
  displayName: string;
  description: string;
  clientId: string;
  appId: string;
  updateRepo: string;
  platforms: string[];
}

export const addon = manifest as AddonManifest;

/** Dépôt GitHub des releases : variable d'env (CI) sinon manifeste. */
export const updateRepo: string =
  (typeof process !== 'undefined' && process.env.UPDATE_REPO) ||
  addon.updateRepo ||
  '';
