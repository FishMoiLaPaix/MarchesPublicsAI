# 04 — Releases

Modèle de release **commun à tous les addons** : Jenkins build sur tag, publie sur
GitHub Releases, l'app détecte la nouvelle version.

## Principe

```
git tag v0.2.0  ──push──►  Jenkins (ci/Jenkinsfile)
                              ├─ lint + tests              (toujours)
                              ├─ build PWA                 (tag-only)
                              ├─ build Electron macOS      (tag-only)
                              ├─ build Electron Win/Linux  (tag-only)
                              ├─ build Android             (si ENABLE_ANDROID)
                              └─ build iOS                 (si ENABLE_IOS)
                                    │
                                    └─ gh release upload v0.2.0 <artefacts>
```

Tout ce qui n'est pas un tag (PR, push de branche) ne fait que **lint + tests** :
les builds lourds ne tournent que sur `v*`.

## Déclencher une release

```bash
bash scripts/release.sh 0.2.0     # aligne package.json, commit, crée le tag v0.2.0
git push origin HEAD --tags
```

## Artefacts par plateforme

| Plateforme | Commande Quasar | Artefact publié |
|------------|-----------------|-----------------|
| Web (PWA) | `quasar build -m pwa` | `pwa-v0.2.0.zip` (site statique) |
| macOS | `quasar build -m electron` | `.dmg` |
| Windows | `quasar build -m electron --win` | `.exe` (NSIS) |
| Linux | `quasar build -m electron --linux` | `.AppImage` |
| Android | `quasar build -m capacitor -T android` | `.aab` |
| iOS | `quasar build -m capacitor -T ios` | `.ipa` |

## Agents Jenkins attendus

| Label | Rôle |
|-------|------|
| `docker-enabled` | lint/tests, build Linux (+ Windows via Wine) |
| `macos-arm64` | build macOS (DMG) et iOS (xcodebuild) |
| `android-sdk` | build Android (Gradle / keystore) |

## Credentials Jenkins

| ID | Type | Usage |
|----|------|-------|
| `github-token` | secret text | `gh release upload` |
| `android-keystore` | fichier | signature AAB (quand dispo) |
| `android-keystore-pass` | secret text | mot de passe keystore |
| certs Apple | — | signature iOS (quand dispo) |

## Signature

- **macOS** : signature *ad-hoc* par défaut (suffit pour distribution interne).
  Developer ID + notarisation = phase 2 (compte Apple Developer requis).
- **Mobile** : voir [06-cles-mobiles.md](./06-cles-mobiles.md). Les stages Android/iOS
  sont présents mais **désactivés** (`ENABLE_ANDROID`/`ENABLE_IOS = false`) tant que
  les clés ne sont pas provisionnées — à basculer à `true` sans refactor.
