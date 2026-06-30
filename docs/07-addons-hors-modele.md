# 07 — Addons hors modèle

Ce squelette vise les outils **applicatifs cross-platform** qui consomment l'API
PersoIA par token. Certains addons existants **n'entrent pas** dans ce moule, et
c'est volontaire — ne tentez pas de les y faire rentrer.

## `persoia-word` — add-in Office.js

- **Plateforme imposée** : s'exécute *dans* Microsoft Word (runtime Office.js), pas
  une app autonome. Pas d'Electron, pas de Capacitor.
- **Distribution imposée** : déploiement via le manifeste Office / Microsoft 365 admin,
  pas via GitHub Releases. ⚠️ **auto-ship depuis `main`** : tout push sur `main`
  redéploie sur tous les postes installés → branche + PR obligatoires.
- **Auth** : peut réutiliser le *contrat* token PersoIA, mais le cycle de vie (sandbox
  Office, pas d'accès au `config.env` partagé du poste) diffère.

→ Modèle de release et packaging **incompatibles** avec ce squelette.

## `persoia-cli` — CLI pure

- **Pas d'UI** : outil en ligne de commande (ex. wrapper aider). Aucune des couches
  Quasar/Vue/Electron/Capacitor n'a de sens.
- **Auth** : utilise directement le module partagé (`persoia_auth` en Python, ou la
  lecture de `config.env`), ce qui est parfait — mais sans la partie applicative.
- **Distribution** : via gestionnaire de paquets / binaire CLI, pas des apps signées
  par store.

→ Réutilise le **contrat token**, mais pas le squelette applicatif.

## La ligne de partage

| Critère | Dans le modèle (ce squelette) | Hors modèle |
|---------|-------------------------------|-------------|
| Forme | app web/desktop/mobile | add-in hôte, CLI |
| UI | Quasar/Vue | aucune ou imposée par l'hôte |
| Release | Jenkins + GitHub Releases | store Microsoft / paquet CLI |
| Mise à jour | check de version GitHub | auto-ship `main` / gestionnaire de paquets |

Le **dénominateur commun de TOUS les outils PersoIA** reste le *contrat token*
(`config.env` partagé, header `X-Persoia-Client`, surface `/v1`). Ce squelette
l'industrialise pour les apps ; les outils hors modèle s'appuient sur le même contrat
par d'autres moyens.
