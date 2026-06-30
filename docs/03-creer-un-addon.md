# 03 — Créer un addon (pas-à-pas)

De zéro à un outil PersoIA fonctionnel, en ~10 minutes.

## 1. Cloner le squelette

```bash
# Nouveau repo (ex. FishMoiLaPaix/devis-express) à partir du squelette
git clone https://github.com/FishMoiLaPaix/Addons-skeleton.git devis-express
cd devis-express
rm -rf .git && git init        # on repart d'un historique propre
```

> Ou utilisez le bouton **« Use this template »** sur GitHub.

## 2. Donner son identité à l'addon

Une seule commande met à jour `addon.config.json` + `package.json` :

```bash
bash scripts/init-addon.sh devis-express \
     --app-id com.persoia.devis \
     --repo FishMoiLaPaix/devis-express
```

Cela fixe :
- `name` / `clientId` → `devis-express` (le `clientId` = header `X-Persoia-Client`) ;
- `displayName` → `Devis Express` ;
- `appId` → `com.persoia.devis` (Electron + Capacitor) ;
- `updateRepo` → le dépôt des releases (pour l'updater).

Tout le reste du code lit `addon.config.json` à l'exécution : **aucun autre fichier
à éditer**.

## 3. Installer et lancer

```bash
npm install
npx quasar dev -m electron   # ← mode de dev recommandé : HMR + vrai login loopback
```

Une **fenêtre Electron** (app native, pas un onglet de navigateur) s'ouvre avec la page
d'exemple : carte de connexion + essai de chat. Le bouton « Se connecter » fait le login
loopback réel et le token est partagé avec les autres outils.

> Pour du travail purement UI, `npm run dev` ouvre l'app dans votre **navigateur**
> (http://localhost:9000) — plus pratique pour les devtools, mais sans login loopback :
> il faut alors coller une clé `persoia_sk_…` à la main. Voir l'étape 5.

## 4. Coder votre outil

Toute la logique métier se met dans **`src/pages/HelloPersoiaPage.vue`** (renommez-la
si vous voulez). Le bloc à remplacer est balisé par un commentaire :

```ts
// ⬇️ C'EST ICI que vit la logique métier de votre outil.
const cfg = await getConfig();
const client = PersoiaClient.fromConfig(cfg, addon.clientId);
const answer = await client.chat([{ role: 'user', content: prompt.value }]);
```

Le `PersoiaClient` expose déjà :

| Méthode | Endpoint | Usage |
|---------|----------|-------|
| `client.chat(messages)` | `/v1/chat/completions` | génération de texte |
| `client.ocr(file)` | `/v1/ocr` | OCR image/PDF |
| `client.models()` | `/v1/models` | liste des modèles |

**Ne touchez pas à `src/shared/persoia/`** : c'est l'infra commune (auth, token
partagé, headers, updater). Réutilisez-la.

## 5. Modes de lancement

| Commande | S'ouvre dans | Login | Quand l'utiliser |
|----------|--------------|-------|------------------|
| `npx quasar dev -m electron` | fenêtre Electron native | loopback réel + token partagé | **dev par défaut** (HMR complet) |
| `npm run dev` | navigateur (localhost:9000) | saisie manuelle de clé | travail UI (devtools, responsive) |

En mode Electron, le bouton « Se connecter » ouvre brièvement le navigateur sur le portail
PersoIA, et la clé obtenue est écrite dans `~/.config/persoia/config.env` (partagée avec
tous les outils). Le navigateur se referme ensuite : Electron reste une app native, ce
n'est pas un onglet.

## 6. Vérifier

```bash
npm run lint
npm run test          # tests de config.ts + updater.ts
```

## 7. Builder

```bash
npm run build            # SPA web (dist/spa)
npm run build:pwa        # PWA (dist/pwa)
npm run build:electron   # desktop (dist/electron)
```

Pour Android/iOS, voir [06-cles-mobiles.md](./06-cles-mobiles.md) (clés requises).

## 8. Releaser

```bash
bash scripts/release.sh 0.1.0
git push origin HEAD --tags
```

Le tag déclenche la CI Jenkins → build multi-plateformes → artefacts publiés sur la
release GitHub. Voir [04-releases.md](./04-releases.md).
