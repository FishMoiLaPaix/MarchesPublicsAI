// Types partagés du contrat PersoIA. Aucun import Node ici : ce fichier est
// consommé aussi bien par le renderer (navigateur) que par le main Electron.

/** Clés stockées dans le fichier partagé ~/.config/persoia/config.env. */
export interface PersoiaConfig {
  PERSOIA_API_KEY: string;
  PERSOIA_API_BASE: string;
  PERSOIA_MODEL: string;
  PERSOIA_TENANT_NAME: string;
}

/** Bases d'API connues. La démo est déduite du préfixe de clé persoia_demo_sk_. */
export const PERSOIA_DEFAULT_BASE = 'https://chat.persoia.com/v1';
export const PERSOIA_DEMO_BASE = 'https://demo.chat.persoia.com/v1';

/** En-tête d'identification de l'outil, lu côté backend pour le suivi de conso. */
export const CLIENT_HEADER = 'X-Persoia-Client';

/** Résultat d'un check de mise à jour (updater.ts). */
export interface UpdateInfo {
  updateAvailable: boolean;
  current: string;
  latest: string | null;
  url: string | null;
}

/**
 * Surface exposée au renderer par le preload Electron (window.persoia).
 * En contexte web/PWA pur, cet objet est absent : auth.ts bascule sur un
 * provider de repli (env / LocalStorage). Voir docs/02-authentification.md.
 */
export interface PersoiaBridge {
  /** Lit la config partagée (clé + base + modèle). */
  getConfig(): Promise<PersoiaConfig>;
  /** Lance le login loopback navigateur ; renvoie la clé ou null si échec/timeout. */
  login(client: string): Promise<string | null>;
  /** Efface uniquement la clé du store partagé (préserve modèle/tenant). */
  logout(): Promise<void>;
}

declare global {
  interface Window {
    persoia?: PersoiaBridge;
  }
}
