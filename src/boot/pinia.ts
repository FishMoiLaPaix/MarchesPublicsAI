import { defineBoot } from '#q-app/wrappers';
import { createPinia } from 'pinia';

// Store d'état applicatif (recherche, résultats, filtres, corbeille).
export default defineBoot(({ app }) => {
  app.use(createPinia());
});
