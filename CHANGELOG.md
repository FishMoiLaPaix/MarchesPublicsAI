# Changelog

## v1.0.0 — Refonte Quasar & distribution par paquets

Première version **packagée** de MarchésPublics AI, reconstruite sur le squelette
PersoIA (**Quasar 2 + Vue 3 + TypeScript**). Mêmes fonctionnalités qu'avant, mais
une base technique moderne, typée et testée, et une distribution multi-plateformes.

### ⚠️ Action requise (utilisateurs Windows existants)
La distribution passe de l'auto-mise à jour « fichiers bruts » à des **paquets
installables** (GitHub Releases). **Une réinstallation unique est nécessaire** :
téléchargez et installez le nouveau paquet ci-dessous. L'ancienne version installée
reste fonctionnelle mais ne se mettra plus à jour automatiquement.

### Nouveautés
- **Multi-plateformes** : Windows (`.exe` NSIS), macOS (`.dmg`), Linux (`.AppImage`).
- **Mises à jour par version** : l'app détecte la dernière release publiée et propose
  la mise à jour (plus de re-téléchargement de fichiers bruts depuis `main`).
- **Architecture** : logique métier typée et couverte par des tests (scoring,
  filtres, sources) ; UI en composants Vue/Quasar.

### Fonctionnalités (parité avec la version précédente)
- Recherche sur **11 sources** : BOAMP, PLACE, TED Europa, J.O.U.E, Demat-AMPA,
  Marchés Sécurisés, e-Marchés Publics, France Marchés, Marchés Online, AW
  Solutions, BOAMP Attributions.
- **Analyse de pertinence IA persoIA** : score + résumé + recommandations, relance
  automatique si l'instance GPU démarre.
- Filtres : mots-clés (`;`-séparés) avec modes Strict / Souple / Large, secteur,
  lieu, domaine, type de marché, procédure, type d'avis, état, dates de publication
  et de clôture, filtre prestation (domaine Services).
- Scoring local par groupes de mots-clés avec racinisation FR et pénalité
  géographique (référentiel officiel `geo.api.gouv.fr`).
- Corbeille, marquage « lu », recherches et mots-clés récents, derniers filtres
  restaurés, thème clair/sombre.

### Connexion persoIA
Connexion unique par navigateur (aucune clé à saisir), partagée avec tous vos
outils persoIA via `config.env`.

### Installation
Téléchargez l'installeur correspondant à votre système dans les **Assets**
ci-dessous, puis lancez-le.
