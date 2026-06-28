# MarchésPublics AI

Application de bureau de recherche intelligente dans les marchés publics français
et européens, avec analyse de pertinence par IA. Outil de l'écosystème **persoIA**
(token partagé entre tous les outils).

Construite sur le squelette PersoIA : **Quasar 2 + Vue 3 + TypeScript**, packagée en
desktop (Electron) avec une base mobile (Capacitor) et web (PWA).

## Sources couvertes (11)

| Source | Périmètre |
|--------|-----------|
| BOAMP | Bulletin Officiel des Annonces de Marchés Publics (FR) |
| PLACE | Plateforme des Achats de l'État (FR) |
| TED Europa | Tenders Electronic Daily (UE) |
| J.O.U.E | Journal Officiel de l'UE — avis concernant la France |
| Demat-AMPA | Plateforme Occitanie / Midi-Pyrénées |
| Marchés Sécurisés | Plateforme nationale de dématérialisation |
| e-Marchés Publics | Agrégateur national |
| France Marchés | Agrégateur national |
| Marchés Online | Appels d'offres publics et privés |
| AW Solutions | Plateforme marches-publics.info |
| BOAMP Attributions | Avis d'attribution (contrats attribués) |

## Intelligence Artificielle — persoIA

Unique fournisseur d'IA (`chat.persoia.com/v1`). **Aucune clé à copier-coller** :
vous vous identifiez **une seule fois** dans le navigateur (login loopback). La clé
est stockée dans un emplacement commun à tous vos outils persoIA
(`~/.config/persoia/config.env` sous Unix, `%APPDATA%\persoia\config.env` sous
Windows) et relue automatiquement. Au **premier lancement**, l'app ouvre directement
le login pour créer la configuration. Authentification fournie par le squelette
(port de [persoia-auth](https://github.com/FishMoiLaPaix/persoia-auth)).

## Installation

L'application est distribuée en **paquets installables** via les
[GitHub Releases](https://github.com/FishMoiLaPaix/MarchesPublicsAI/releases) :

- **Windows** : installeur `.exe` (NSIS)
- **macOS** : image `.dmg`
- **Linux** : `.AppImage`

> Mises à jour : l'app vérifie la dernière release publiée et affiche un bandeau
> lorsqu'une nouvelle version est disponible.

## Utilisation

1. Connectez-vous à persoIA (automatique au premier lancement)
2. Sélectionnez les sources à explorer (panneau latéral)
3. Saisissez une recherche (objet précis et/ou mots-clés `;`-séparés), affinez avec
   les filtres (secteur, lieu, domaine, procédure, dates…)
4. Activez/désactivez l'analyse IA
5. Les résultats sont classés par pertinence (score local + ré-analyse IA) ; les
   résultats non pertinents sont masqués par défaut (bouton pour les afficher)

## Développement

```bash
npm install
npm run dev                 # app web (dev)
npx quasar dev -m electron  # app desktop (dev)
npm run lint
npm run test                # vitest
npm run build               # SPA
npm run build:pwa
npm run build:electron      # DMG / NSIS / AppImage
```

Voir `CLAUDE.md` pour l'architecture détaillée.
