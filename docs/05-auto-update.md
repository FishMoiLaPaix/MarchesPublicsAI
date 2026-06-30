# 05 — Mise à jour automatique

L'app vérifie au démarrage si une version plus récente existe et **propose** la
mise à jour. Modèle retenu : **GitHub Releases + check de version** (universel,
versionné, compatible desktop *et* stores mobiles).

## Comment ça marche

`src/shared/persoia/updater.ts` :

1. lit la version courante (`process.env.APP_VERSION`, injectée depuis `package.json`) ;
2. interroge `GET https://api.github.com/repos/<updateRepo>/releases/latest` ;
3. compare le tag (`v0.3.0`) à la version locale via `isNewer()` (comparaison sémantique) ;
4. renvoie `{ updateAvailable, current, latest, url }`.

Le composant `src/components/UpdateBanner.vue` affiche un bandeau discret avec un
lien vers la release quand une MAJ est disponible. En cas d'erreur réseau ou de
quota GitHub, l'updater renvoie `updateAvailable: false` (jamais d'exception, jamais
de blocage de l'app).

## Configuration

Le dépôt cible vient de `addon.config.json` (`updateRepo`) ou de la variable
d'environnement `UPDATE_REPO` (prioritaire, utile en CI). Réglé automatiquement par
`scripts/init-addon.sh --repo Org/Repo`.

Pour un dépôt **privé**, passez un token GitHub à `checkForUpdate({ ..., token })`.

## Différences avec le modèle « push-sur-main »

`MarchesPublicsAI` utilise un auto-update « pousser sur `main` = déployé » : il
re-télécharge les fichiers source depuis GitHub. Simple, mais réservé au **code
interprété non signé** et **incompatible avec les stores mobiles**. Le squelette
retient volontairement le modèle **Releases versionnées** : il marche pour toutes
les cibles (desktop installé, PWA, Android, iOS) et garde une traçabilité claire.

## Aller plus loin (optionnel)

- **Electron** : pour une MAJ *en place* (téléchargement + installation), ajoutez
  `electron-updater` branché sur les mêmes GitHub Releases.
- **Mobile** : la MAJ passe par les stores (Play / App Store) ; le bandeau invite
  simplement à mettre à jour.
