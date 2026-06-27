import { defineBoot } from '#q-app/wrappers';
import { detectPlatform } from 'src/shared/persoia/auth';

// Boot PersoIA : point d'accroche au démarrage. Pour l'instant minimal (l'auth est
// résolue à la demande dans les composants). Ajoutez ici une init globale si besoin
// (ex. pré-charger la config, instancier un store Pinia, etc.).
export default defineBoot(() => {
  if (process.env.DEV) {
    // eslint-disable-next-line no-console
    console.info(`[persoia] plateforme détectée : ${detectPlatform()}`);
  }
});
