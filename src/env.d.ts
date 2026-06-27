/* eslint-disable */
// Types d'environnement Quasar + déclarations globales du projet.

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
    VUE_ROUTER_BASE: string | undefined;
    DEV: boolean | undefined;
    SERVER: boolean | undefined;
    /** Injectées via quasar.config.ts (build.env). */
    UPDATE_REPO: string | undefined;
    APP_VERSION: string | undefined;
  }
}

// Shim pour l'import de fichiers .vue en TypeScript.
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
