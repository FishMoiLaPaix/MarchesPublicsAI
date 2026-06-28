import { configure } from 'quasar/wrappers';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// L'identité de l'addon vit dans addon.config.json (cf. scripts/init-addon.sh).
// On la lit ici pour alimenter appId / appName Capacitor + Electron sans la dupliquer.
const addon = JSON.parse(
  readFileSync(fileURLToPath(new URL('./addon.config.json', import.meta.url)), 'utf-8'),
) as { appId: string; displayName: string; name: string };

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string };

export default configure(() => {
  return {
    boot: ['pinia', 'persoia'],

    css: ['app.scss'],

    extras: ['roboto-font', 'material-icons'],

    build: {
      target: {
        browser: ['es2022', 'firefox115', 'chrome115', 'safari14'],
        node: 'node20',
      },
      typescript: {
        strict: true,
        vueShim: true,
      },
      vueRouterMode: 'hash', // 'hash' : robuste pour Electron/Capacitor (pas de serveur d'historique).
      // Variables exposées à process.env.* dans le code applicatif.
      // Surchargées à la volée par l'environnement réel (CI, poste dev).
      env: {
        // Repo GitHub utilisé par l'updater pour chercher la dernière release.
        UPDATE_REPO: process.env.UPDATE_REPO || '',
        // Version courante (package.json) pour le bandeau de mise à jour.
        APP_VERSION: pkg.version,
      },
      sourcemap: false,
    },

    devServer: {
      open: true,
    },

    framework: {
      config: {
        brand: {
          primary: '#104070',
          secondary: '#26A69A',
          accent: '#9C27B0',
          dark: '#1d1d1d',
          positive: '#21BA45',
          negative: '#C10015',
          info: '#31CCEC',
          warning: '#F2C037',
        },
        notify: { position: 'top-right', timeout: 3000 },
      },
      plugins: ['Notify', 'Dialog', 'Loading', 'LocalStorage'],
    },

    animations: [],

    // --- Desktop (mac / linux / windows) -------------------------------------
    // Le mode Electron porte le "token partagé entre outils" : c'est le seul
    // contexte qui peut lire/écrire le fichier ~/.config/persoia/config.env
    // commun à tous les addons, et héberger le serveur de login loopback.
    electron: {
      preloadScripts: ['electron-preload'],
      inspectPort: 5858,
      bundler: 'builder', // electron-builder : cibles mac/linux/win + signing.
      builder: {
        appId: addon.appId,
        productName: addon.displayName,
        // Cibles activées par plateforme au moment du build (cf. ci/Jenkinsfile).
        mac: { target: 'dmg' },
        win: { target: 'nsis' },
        linux: { target: 'AppImage' },
      },
    },

    // --- Mobile (Android / iOS) ----------------------------------------------
    capacitor: {
      hideSplashscreen: true,
      appId: addon.appId,
      appName: addon.displayName,
    },

    // --- Web installable ------------------------------------------------------
    pwa: {
      workboxMode: 'GenerateSW',
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
    },
  };
});
