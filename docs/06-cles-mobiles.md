# 06 — Clés mobiles Apple / Google (partagées)

Objectif : **mutualiser** les comptes et clés de signature mobiles entre **tous** les
addons PersoIA. Une seule organisation Apple Developer + un seul compte Google Play
Console servent l'ensemble des outils, sous le préfixe `com.persoia.*`.

> ⚠️ État actuel : les comptes payants ne sont **pas encore** provisionnés. Les
> stages Android/iOS du `Jenkinsfile` sont donc **désactivés** (`ENABLE_ANDROID` /
> `ENABLE_IOS = false`). Ce document décrit la cible et le câblage prévu, pour
> activer sans refactor le moment venu.

## Conventions d'identité

- Chaque addon a un `appId` unique sous `com.persoia.*` (ex. `com.persoia.devis`),
  fixé dans `addon.config.json` via `init-addon.sh`.
- Même `appId` pour Electron et Capacitor → cohérent sur toutes les plateformes.
- Aligné sur `chat.persoia.com` (`com.persoia.app`) : même organisation, mêmes clés.

## Android (Google Play)

| Élément | Partage | Stockage |
|---------|---------|----------|
| Compte Play Console | 1 pour toute l'org | — |
| **Upload keystore** | **partagé** entre addons | credential Jenkins `android-keystore` (+ `android-keystore-pass`) |
| Clé d'app (App Signing by Google) | gérée par Google | côté Play |

Câblage prévu (déjà présent, commenté, dans le stage `Build Android`) :

```groovy
withCredentials([
  file(credentialsId: 'android-keystore', variable: 'KEYSTORE'),
  string(credentialsId: 'android-keystore-pass', variable: 'KEYSTORE_PASS')
]) { /* gradle bundleRelease + signature */ }
```

Activation : provisionner le keystore → créer les credentials → `ENABLE_ANDROID=true`.

## iOS (Apple)

| Élément | Partage | Stockage |
|---------|---------|----------|
| Compte Apple Developer (org) | 1 pour toute l'org | — |
| Certificat de distribution | **partagé** | trousseau de l'agent `macos-arm64` / credential |
| Provisioning profile | **1 par `appId`** | généré par addon |

Câblage prévu (stage `Build iOS`) : `xcodebuild -archive` + export `.ipa` signé.
Activation : compte Apple Developer → certs + profils → `ENABLE_IOS=true`.

## Pourquoi mutualiser

- **Coût** : un seul abonnement Apple (99 $/an) + Google (25 $ unique) pour tous les outils.
- **Confiance** : tous les addons publiés sous l'éditeur « PersoIA ».
- **Simplicité** : un seul jeu de secrets à gérer dans Jenkins, réutilisé par chaque pipeline.

## Sécurité

- Les clés vivent **uniquement** dans les credentials Jenkins (jamais dans le repo).
- `config.env`, keystores et `.p12` sont au `.gitignore`.
- Rotation : si une clé fuite, la régénérer côté store et mettre à jour le credential.
