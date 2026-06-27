# 01 — Architecture

## Pourquoi ce squelette

Chaque outil client PersoIA (scan de cartes, marchés publics, …) a besoin des
**mêmes briques** : se connecter à PersoIA, lire le token *partagé*, appeler l'API
`/v1`, se construire/publier sur plusieurs plateformes, et se mettre à jour. Sans
socle commun, chaque outil les réimplémente différemment et diverge.

Ce repo est le **squelette canonique** : on le clone pour démarrer tout nouvel
outil qui consomme l'API PersoIA par token (`persoia_sk_…`). Tout est déjà câblé ;
le développeur n'écrit que la logique métier de son outil.

## Stack

| Couche | Choix | Pourquoi |
|--------|-------|----------|
| UI / app | **Quasar 2** (Vue 3 + TypeScript) | Un seul code → web, desktop, mobile |
| Dev | `quasar dev` (SPA) | Itération web ultra-rapide |
| Desktop | **Electron** (mac / linux / windows) | Porte le **token partagé** + login loopback |
| Mobile | **Capacitor** (Android / iOS) | Apps natives depuis le même code |
| Web installable | **PWA** | Déploiement statique |
| Release | **Jenkins** sur tag `v*` | Build multi-plateformes + GitHub Releases |
| Mise à jour | **GitHub Releases + check de version** | Universel, versionné, traçable |

C'est le même stack que `chat.persoia.com` → on réutilise ses comptes/clés Apple &
Google (`appId` sous `com.persoia.*`).

## Plan du code

```
src/shared/persoia/      ← INFRA COMMUNE — ne pas réécrire, juste utiliser
  types.ts               contrat (clés config, header, bases d'API)
  base.ts                helpers purs (déduction base d'API)
  client.ts              PersoiaClient : appels /v1 (chat, ocr, models)
  auth.ts                façade auth (détecte la plateforme)
  config.ts              store partagé config.env (Node / Electron)
  login-loopback.ts      login navigateur 127.0.0.1 (Node / Electron)
  updater.ts             check de mise à jour (GitHub Releases)

src/pages/HelloPersoiaPage.vue   ← VOTRE OUTIL vit ici (exemple à remplacer)
src/components/                  cartes login + bandeau MAJ (réutilisables)
src-electron/                    main + preload (pont window.persoia)
addon.config.json                identité de l'addon (nom, clientId, appId, repo)
ci/Jenkinsfile                   pipeline de release commun
python/                          copie du module auth pour addons Python
docs/                            cette documentation
```

## Flux d'exécution (desktop)

```
Renderer (Vue)                 Electron main                 PersoIA
  HelloPersoiaPage             (process principal)
      │  login()                    │
      ├───── window.persoia.login ─►│  loginLoopback()
      │                             ├──► ouvre le navigateur → portail /cli
      │                             │◄── POST /callback {token}  (127.0.0.1)
      │                             ├──► saveConfig()  → ~/.config/persoia/config.env
      │◄──────── token ─────────────┤        (PARTAGÉ avec les autres outils)
      │  PersoiaClient.chat()       │
      ├──────────────────────────── fetch /v1/chat/completions ──────────────►│
      │◄───────────────────────────────────── réponse ───────────────────────┤
```

En **web pur** (`quasar dev`), il n'y a pas de process Electron : `window.persoia`
est absent, et `auth.ts` bascule sur un repli LocalStorage (clé saisie à la main).
Voir [02-authentification.md](./02-authentification.md).

## Lectures suivantes

- [02 — Authentification & token partagé](./02-authentification.md)
- [03 — Créer un addon (pas-à-pas)](./03-creer-un-addon.md)
- [04 — Releases](./04-releases.md)
- [05 — Mise à jour automatique](./05-auto-update.md)
- [06 — Clés mobiles Apple / Google](./06-cles-mobiles.md)
- [07 — Addons hors modèle](./07-addons-hors-modele.md)
