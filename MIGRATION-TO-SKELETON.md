# Brief de migration — MarchésPublics AI → squelette PersoIA (port Quasar complet)

> **À l'attention de la session Claude Code enracinée dans `MarchesPublicsAI/`.**
> Donne-toi un accès lecture au squelette :
> `/add-dir /Users/smerle/persocode/persoIA/addons/Addons-skeleton`.
> Le squelette est la **référence** (ne le modifie pas) ; tu écris **ici**, dans MarchésPublics AI.

---

## 0. Objectif & nature du chantier

Faire passer MarchésPublics AI du modèle **Electron vanilla** (JS brut : `main.js` +
`index.html` ~2771 lignes inline + `preload.js`, auth réécrite à la main, auto-update
push-sur-`main`, Windows uniquement) au **modèle squelette** : **Quasar 2 + Vue 3 + TypeScript**,
avec auth/token partagés mutualisés, releases multi-plateformes (Jenkins → GitHub Releases),
suivi de MAJ par version, et base mobile (Capacitor) prête.

⚠️ **Ce n'est PAS un upgrade drop-in.** Le gros du travail est le **port de l'UI** (un seul
`index.html` de 2771 lignes, rendu en `innerHTML`) vers des **composants Vue**. En revanche
l'**auth**, le **client `/v1`**, l'**updater** et la **CI** sont fournis clés en main par le
squelette et remplacent du code existant. La **logique métier** (sources de marchés, scoring,
géo) est **préservée**, juste re-rangée et typée.

---

## ⛔ 1. Règles de sécurité (lis avant de coder)

1. **MarchésPublics AI auto-ship depuis `main`** (cf. son `CLAUDE.md` : push `main` =
   déploiement sur tous les postes installés). **JAMAIS de commit direct sur `main`.**
   Travaille en **branche + PR** uniquement. ⚠️ Pendant la migration, l'ancien updater
   surveille `main.js`/`index.html`/`preload.js`/`package.json` : tant que la bascule n'est
   pas finie, **ne casse pas** ces 4 fichiers sur `main` ou tu déploies une app cassée.
   Stratégie recommandée : faire **toute la migration sur une branche longue**
   (`feat/quasar-migration`), valider, puis basculer en un seul merge maîtrisé.
2. **Aucune référence à une IA/assistant** dans le code, commits, PR, issues (règle org).
3. Commits conventionnels. Code en anglais, UI/docs en français. Fichiers finissant par une
   ligne vide.
4. **Ne réécris jamais `src/shared/persoia/`** du squelette : recopie-le tel quel et utilise-le.

---

## 🧭 2. Décisions à confirmer AVEC L'UTILISATEUR avant de démarrer

Pose ces questions (elles changent l'architecture / sont irréversibles) :

1. **`appId`** : aligner sur la convention squelette `com.persoia.marchespublics` (pour
   mutualiser les clés Apple/Google) **ou** garder l'historique `com.marchespublics.ai` ?
   → recommandé : `com.persoia.marchespublics`.
2. **Modèle de distribution** : on **abandonne l'auto-update push-sur-`main`** au profit de
   **GitHub Releases + app packagée** (DMG/NSIS/AppImage). Les utilisateurs Windows actuels
   (installés via `INSTALLER.ps1`) devront **réinstaller une fois** la nouvelle app packagée.
   OK pour cette rupture ? (C'est le cœur du passage au modèle commun.)
3. **Cibles** : desktop (mac/win/linux) d'emblée ; mobile (Android/iOS) plus tard (clés). Web
   public PWA : utile pour ce produit (recherche d'AO depuis un navigateur) ? Si oui, prévoir
   le flux auth web (cf. squelette `docs/02`, section production web).
4. **Périmètre v1 du port** : parité fonctionnelle stricte, ou on profite du refactor pour
   couper des bouts (ex. configs AI legacy déjà désactivées) ?

---

## 🎯 3. Architecture cible (rappel squelette)

```
src/shared/persoia/      ← COPIER depuis le squelette, NE PAS modifier
  config.ts, login-loopback.ts   (Node/Electron : store config.env partagé + login)
  client.ts, base.ts, types.ts   (fetch : appels /v1, X-Persoia-Client)
  updater.ts                      (MAJ par GitHub Releases)
src-electron/
  electron-main.ts         IPC : auth (déjà fourni) + À AJOUTER : sources/scrape/geo/store
  electron-preload.ts      bridge window.persoia (fourni) + À ÉTENDRE : window.mp (métier MPAI)
src/
  pages/SearchPage.vue     l'écran principal (port de index.html)
  components/              SourceList, FilterBar, ResultCard, AiPanel, TrashDialog, UpdateBanner…
  stores/                 Pinia : recherche, résultats, filtres, corbeille, "lus"
  domain/                 logique pure TS : scoring, stemming, géo, normalisation
addon.config.json          name=marches-publics-ai, clientId=marchespublicsai, appId=…, updateRepo
ci/Jenkinsfile             repris du squelette
```

**Découpage Node vs renderer (crucial)** :
- **Process principal (Node)** : tout ce qui a besoin de `cheerio`/`axios`/`http` et contourne
  CORS → **le scraping des sources, les appels BOAMP/TED, la géo-référence, le store, l'updater**.
  Exposé au renderer via le preload (nouveaux canaux IPC).
- **Renderer (Vue)** : UI, état (Pinia), **scoring client** (pur TS), et **l'analyse AI**
  (via `PersoiaClient` du squelette, en lisant la config par `window.persoia.getConfig()` —
  `fetch` vers `chat.persoia.com/v1` marche depuis le renderer).
- **Auth** : 100 % le module squelette (`config.ts` + `login-loopback.ts` côté main, exposés
  par `window.persoia`). **Supprime** toute la réimplémentation JS d'auth de `main.js`
  (lignes 692–879).

---

## 🔁 4. Mapping pièce par pièce (existant MPAI → cible squelette)

| Domaine | Existant MarchésPublics AI | Cible |
|---|---|---|
| **Login PersoIA** | `main.js:692–879` (loopback réécrit, `savePersoiaConfig`, portalBase) | **Supprimé** → `src/shared/persoia/{config,login-loopback}.ts` + IPC `persoia:*` déjà fournis par le squelette (`electron-main.ts`). |
| **persoia-status/login/logout** (IPC) | `main.js` handlers + `preload.js` | Remplacés par `window.persoia.{getConfig,login,logout}` du squelette. |
| **Appel AI** `callAI` | `main.js:895–983` (provider persoia, headers `X-Persoia-Client: marchespublicsai`) | `PersoiaClient.chat()` (`src/shared/persoia/client.ts`). Le `clientId` vient de `addon.config.json`. |
| **Prompt d'analyse** (système + géo-pénalité + JSON `{summary,relevant[],recommendations}`) | `main.js:1001–1061` | **Conserver à l'identique** dans un module `src/domain/aiAnalysis.ts` ; appel via `PersoiaClient`. C'est de la valeur métier, ne pas réécrire le prompt. |
| **Sources de marchés** (11 : BOAMP, PLACE, TED, JOUE, Demat-AMPA, Marchés Sécurisés, e-Marchés, France Marchés, Marchés Online, AW Solutions, BOAMP Attributions) | `main.js:178–526` (`SOURCES[]`, mix JSON API + cheerio) | **Porter tel quel** en modules TS dans `src-electron/sources/*.ts` (Node : axios/cheerio OK). Un fichier par source + un registre. Exposer via IPC `mp:searchSource`. **C'est le cœur métier — préserver la logique exacte (sélecteurs, facettes BOAMP `boampWhere` main.js:178–210).** |
| **Géo-référence** | `main.js:537–574` + cache store ; renderer `index.html:2183` | Module `src-electron/geo.ts` (fetch + cache) exposé par IPC `mp:getGeoReference`. |
| **Scoring client** (`computeClientScore`, stemming, `geoScan`, `normWords`, modes strict/souple/ou) | `index.html:2173–2280` | **Port pur TS** dans `src/domain/scoring.ts` (renderer). Tests unitaires bienvenus (vitest est déjà câblé dans le squelette). |
| **Pipeline de recherche** (`gatherFilters`, `runSearch`, `getProcessedResults`, split pertinents/non) | `index.html:1668–2404` | Orchestration dans un **store Pinia** + `src/domain/pipeline.ts`. Recherche parallèle des sources via IPC, puis filtrage/scoring/tri côté renderer. |
| **Store / persistance** (recent-searches, recent-keywords, last-filters, hidden-offers, trash-offers, read-offers, geo-ref, applied-commit) | `main.js:68–76` (`store.json` userData) + IPC | Deux options : (a) garder un IPC `mp:store:{get,set}` côté main ; (b) utiliser **Quasar LocalStorage** dans le renderer. Recommandé : **Pinia + Quasar LocalStorage** pour l'état UI ; garder l'IPC store seulement si tu veux le même fichier qu'avant. |
| **Auto-update** | `main.js:80–160` (push-sur-`main`, SHA commit, `UPDATE_FILES`, IPC update-*) | **Supprimé** → `src/shared/persoia/updater.ts` (GitHub Releases vs version) + `components/UpdateBanner.vue` du squelette. ⚠️ rupture de modèle (cf. décision §2.2). |
| **Thème clair/sombre** | `index.html:2747` + `set-theme` (main.js:162) | Quasar Dark plugin (`$q.dark`) + `LocalStorage`. La titlebar overlay macOS : via `electron` `setTitleBarOverlay` si tu gardes une titlebar custom (sinon natif). |
| **UI (index.html)** | titlebar, sidebar (sources + AI config), search area, filter bar, results grid, AI panel, pagination, trash modal, update banner (cf. inventaire §7) | **`pages/SearchPage.vue` + composants** Quasar (`q-input`, `q-select`, `q-checkbox`, `q-list`, `q-card`, `q-dialog`, `q-banner`, `q-pagination`). Remplacer le rendu `innerHTML` par du template Vue réactif. |
| **Build / packaging** | `package.json` (electron-builder portable win), `INSTALLER.ps1`, `UNINSTALL.ps1` | `quasar build -m electron` (NSIS/DMG/AppImage) + `ci/Jenkinsfile`. `INSTALLER.ps1`/`UNINSTALL.ps1` deviennent **obsolètes** (NSIS gère install/uninstall). Archiver dans `legacy/` plutôt que supprimer d'un coup. |
| **preload** | `preload.js` (window.api.*) | `electron-preload.ts` : garder `window.persoia` (squelette) + ajouter `window.mp` (searchSource, getSources, getGeoReference, openUrl, store…). |

---

## 🪜 5. Plan d'exécution par phases (avec vérif à chaque étape)

> Toute la migration sur **une branche** `feat/quasar-migration` (cf. §1). Ne merge sur `main`
> qu'à la toute fin, en une bascule maîtrisée.

**Phase 0 — Scaffolding.** Récupère la structure squelette dans le repo (copie des fichiers
de config Quasar : `quasar.config.ts`, `package.json` deps, `tsconfig.json`, `src/shared/persoia/`,
`src-electron/`, `ci/Jenkinsfile`, `index.html` template, `eslint`/`vitest`). Lance
`scripts/init-addon.sh marches-publics-ai --app-id <décision §2.1> --repo FishMoiLaPaix/MarchesPublicsAI`.
`npm install`. **Vérif** : `npx quasar dev` ouvre la page d'exemple.

**Phase 1 — Auth.** Branche `window.persoia` (login loopback + token partagé). Une page de test
qui affiche `getConfig()` et un bouton login. **Vérif** : `quasar dev -m electron` → login
navigateur réel → clé écrite dans `~/.config/persoia/config.env`. Supprime l'auth JS de `main.js`.

**Phase 2 — Couche données (Node/main).** Porte les 11 sources (`src-electron/sources/*.ts`),
la géo-référence, le store. Expose `mp:getSources`, `mp:searchSource`, `mp:getGeoReference` via
le preload. **Vérif** : un script/page minimal appelle `searchSource('boamp', …)` et renvoie des
résultats réels (compare au comportement actuel sur la même requête).

**Phase 3 — Domaine pur (renderer).** Porte `scoring.ts`, `geoScan`, stemming, `gatherFilters`,
`pipeline.ts`. **Vérif** : tests vitest sur le scoring (mêmes entrées → mêmes scores qu'aujourd'hui ;
prends 2-3 cas réels de l'app actuelle comme oracle).

**Phase 4 — UI Vue.** Reconstruis l'écran : `SearchPage` + `SourceList`, `FilterBar`,
`ResultCard`, `AiPanel`, `TrashDialog`, pagination. État dans Pinia, persistance LocalStorage.
**Vérif** : parité visuelle/fonctionnelle écran par écran avec l'app actuelle (recherche,
filtres, facettes BOAMP, corbeille, "lus", recents).

**Phase 5 — Analyse AI.** `aiAnalysis.ts` (prompt conservé) + `PersoiaClient`. Gère le retry 503
(GPU qui démarre) comme aujourd'hui (4 tentatives, backoff ~40s). **Vérif** : une recherche avec
AI activée renvoie le re-scoring + summary.

**Phase 6 — MAJ & release.** `updater.ts` + `UpdateBanner` (Releases). Retire l'updater
push-sur-`main`. Icônes (`gen-icons.sh` — ⚠️ une vraie icône ≥512, sinon le build Electron
plante, cf. gotchas). `ci/Jenkinsfile`. **Vérif** : `quasar build -m electron` produit un
DMG/NSIS ; `checkForUpdate` compare bien à la dernière release.

**Phase 7 — Bascule.** Archive `legacy/` (main.js/index.html/preload.js/INSTALLER.ps1).
Mets à jour `README`/`CLAUDE.md`. PR finale, revue, merge `main`. **Communique** aux utilisateurs
Windows qu'une réinstallation unique est nécessaire (nouveau packaging).

---

## ⚠️ 6. Gotchas rencontrés en construisant le squelette (évite-les)

1. **Icône Electron** : un `icon.png` placeholder **1×1 fait planter** `quasar build -m electron`
   (crash du convertisseur d'icône). Il faut une vraie image **≥512×512** + `icon.icns` (mac) +
   `icon.ico` (win) **committés** (electron-builder ne les déduit pas du png). Réutilise
   `assets/icon.ico` existant de MPAI comme base et lance `scripts/gen-icons.sh`.
2. **Wrappers Quasar (app-vite 2.6)** : `defineBoot`/`defineRouter` s'importent de
   **`#q-app/wrappers`**, pas `quasar/wrappers` (seul `configure` y reste). Sinon erreur
   `MISSING_EXPORT` au build.
3. **`index.html` racine requis** par app-vite (avec `<!-- quasar:entry-point -->`), sinon
   « Files validation not passed ».
4. **Pas d'import Node dans le renderer** : `cheerio`/`http`/`fs` **uniquement** côté
   `src-electron/`. Le renderer passe par le preload (IPC). `client.ts`/`updater.ts`/scoring
   sont fetch/pur → OK renderer.
5. **CORS** : le renderer ne peut pas scraper `boamp`/`place`/`ted` directement → ça **doit**
   rester dans le main (comme aujourd'hui). En revanche `chat.persoia.com/v1` accepte les appels
   directs depuis le renderer.
6. **ESLint** : ignore `src-pwa/**` et `src-capacitor/**` (générés). `no-unused-vars` cœur JS à
   couper (les types `defineEmits<{(e,…)}>()` lèvent de faux positifs).

---

## ✅ 7. Checklist de vérification finale (parité)

- [ ] Login PersoIA loopback OK ; token partagé lu/écrit dans `config.env` commun.
- [ ] Les 11 sources renvoient des résultats équivalents à l'app actuelle (mêmes requêtes témoins).
- [ ] Facettes BOAMP (typeMarche, famille, procédure, nature, états, dates) fonctionnelles.
- [ ] Scoring client identique (tests vitest avec oracles tirés de l'app actuelle).
- [ ] Modes strict/souple/ou + "AI rescue" (score 0 mais IA ≥40) conservés.
- [ ] Corbeille, "lus", recherches/keywords récents, derniers filtres : persistés et restaurés.
- [ ] Analyse AI : re-scoring + summary + retry 503.
- [ ] Thème clair/sombre.
- [ ] `quasar build` (spa), `-m pwa`, `-m electron` réussissent ; `lint` 0 erreur ; `vitest` vert.
- [ ] Updater pointe sur les GitHub Releases ; bandeau de MAJ s'affiche.
- [ ] Ancien updater push-sur-`main` retiré ; `INSTALLER.ps1` archivé.
- [ ] PR (jamais commit direct `main`) ; aucune référence IA ; `CLAUDE.md`/`README` à jour.

---

## 📌 8. Références

- Squelette : `/Users/smerle/persocode/persoIA/addons/Addons-skeleton` (lecture seule).
  Docs clés : `docs/01-architecture.md`, `docs/02-authentification.md`,
  `docs/03-creer-un-addon.md`, `docs/04-releases.md`, `docs/05-auto-update.md`,
  `docs/06-cles-mobiles.md`. Le `CLAUDE.md` du squelette liste les invariants.
- Contrat token partagé : `~/.config/persoia/config.env` (`%APPDATA%\persoia\config.env`),
  header `X-Persoia-Client`, bases `chat.persoia.com/v1` (prod) / `demo.chat.persoia.com/v1`.
- Inventaire détaillé de l'existant MPAI : voir le rapport d'exploration (canaux IPC, sources,
  pipeline, store, auto-update, UI, build) — toutes les `file:line` y sont.

> Commence par poser les 4 décisions du §2 à l'utilisateur, puis attaque la Phase 0.
