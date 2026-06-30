# 02 — Authentification & token partagé

C'est le cœur du modèle PersoIA. **Un seul login** par utilisateur, et la clé est
**partagée par tous les outils** sur la même machine.

## Le store partagé

Tous les outils PersoIA lisent/écrivent le **même fichier** :

| OS | Chemin |
|----|--------|
| Linux / macOS | `~/.config/persoia/config.env` (respecte `XDG_CONFIG_HOME`) |
| Windows | `%APPDATA%\persoia\config.env` |
| Override | variable d'environnement `PERSOIA_CONFIG` |

Format (`CLE=valeur`, permissions `0600` sous Unix) :

```env
PERSOIA_API_KEY=persoia_sk_…
PERSOIA_API_BASE=https://chat.persoia.com/v1
PERSOIA_MODEL=small
PERSOIA_TENANT_NAME=…
```

Conséquence directe : un login réalisé depuis **n'importe quel** outil PersoIA
profite à **tous** les autres. C'est ce fichier qui réalise le « token partagé ».
Implémentation : `src/shared/persoia/config.ts` (TS, Electron) — copie fidèle du
contrat `python/persoia_auth.py`.

## Le login loopback (desktop)

L'utilisateur **ne tape jamais son mot de passe** dans l'outil :

1. l'app démarre un serveur HTTP éphémère sur `127.0.0.1:<port aléatoire>` ;
2. elle ouvre le navigateur sur `https://chat.persoia.com/cli?callback=…&state=…&client=<addon>` ;
3. l'utilisateur s'authentifie sur le **portail PersoIA** (déjà connecté la plupart du temps) ;
4. le portail `POST` le token sur `http://127.0.0.1:<port>/callback` ;
5. l'app vérifie le `state` anti-CSRF (comparaison à temps constant) et écrit la clé dans le store partagé.

Sécurité (cf. `src/shared/persoia/login-loopback.ts`) : `state` anti-CSRF à usage
unique, CORS restreint à `*.persoia.com`, portail HTTPS-only, `127.0.0.1` littéral
(jamais `localhost`).

## L'en-tête `X-Persoia-Client`

**Toujours** émis sur les appels `/v1`. Il identifie l'outil côté backend pour le
suivi de consommation. Sa valeur = `clientId` de `addon.config.json`. C'est géré
automatiquement par `PersoiaClient` ; vous n'avez rien à faire.

```http
Authorization: Bearer persoia_sk_…
X-Persoia-Client: mon-addon
```

## Les bases d'API

| Préfixe de clé | Base déduite |
|----------------|--------------|
| `persoia_sk_…` | `https://chat.persoia.com/v1` (prod) |
| `persoia_demo_sk_…` | `https://demo.chat.persoia.com/v1` (démo) |

Surchargeable via `PERSOIA_API_BASE`. Surface `/v1` disponible : `chat/completions`,
`models`, `documents`, `ocr`, `synthesis`.

## Selon la plateforme

| Plateforme | Login | Stockage de la clé |
|------------|-------|--------------------|
| **Electron** (desktop) | loopback navigateur (transparent) | `config.env` **partagé** |
| **Web / PWA** | saisie manuelle de la clé (pas de serveur local possible) | LocalStorage (par origine) |
| **Capacitor** (mobile) | *à brancher* : deep-link `app://callback` + Secure Storage | sandbox de l'app (pas de partage entre outils) |

`auth.ts` détecte la plateforme (`detectPlatform()`) et choisit le bon provider.
Le partage de clé entre outils n'a de sens que sur **desktop** (fichier commun) ;
en web et mobile, chaque app est isolée.

### Pour développer : utilisez le mode Electron

⚠️ Ne confondez pas « mode navigateur » et « mode Electron » : ce sont deux fenêtres
différentes. Electron **n'est pas** un onglet de votre navigateur, c'est une **fenêtre
applicative native** (Chromium embarqué). Le navigateur n'est ouvert que ponctuellement,
le temps du login loopback, puis se referme.

```bash
npx quasar dev -m electron     # ← environnement de dev recommandé
```

Ce mode garde le **hot-reload complet** (le renderer charge le serveur Vite via `APP_URL`)
**ET** vous donne le **vrai login loopback + le token partagé**. C'est donc l'environnement
de développement idéal : pas besoin de coller de clé à la main.

Le mode navigateur (`quasar dev`) reste utile pour le travail purement UI (devtools,
responsive) ; il bascule alors sur la saisie manuelle de clé, faute de pouvoir lancer un
serveur local.

> **Production web** : la saisie manuelle ne concerne **que** le cas où vous livreriez une
> version web publique (URL accessible sans rien installer). Là, et seulement là, remplacez-la
> par un flux *redirect* OAuth-like (le portail renvoie vers `https://votre-addon/...#token=…`).
> Tant que votre addon est distribué en desktop/mobile, ce n'est pas nécessaire.

## Côté Python

Le contrat est identique. Voir [`python/README.md`](../python/README.md) :
`persoia_auth.auth_headers(client="mon-addon")` renvoie les bons headers et lit le
même `config.env`.
