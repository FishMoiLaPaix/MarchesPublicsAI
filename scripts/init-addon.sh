#!/usr/bin/env bash
# init-addon.sh — Transforme le squelette en un nouvel addon PersoIA.
#
# Met à jour addon.config.json (la SEULE source de vérité de l'identité) puis
# propage les valeurs dérivées dans package.json. Le reste du code lit
# addon.config.json à l'exécution : aucun autre fichier à éditer à la main.
#
# Usage :
#   bash scripts/init-addon.sh <nom-technique> [--app-id com.persoia.x] [--repo Org/Repo]
#
# Exemple :
#   bash scripts/init-addon.sh devis-express \
#        --app-id com.persoia.devis --repo FishMoiLaPaix/devis-express
set -euo pipefail

if ! command -v node &>/dev/null; then
  echo "Erreur : node est requis." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage : bash scripts/init-addon.sh <nom-technique> [--app-id …] [--repo Org/Repo]" >&2
  exit 1
fi
shift || true

APP_ID="com.persoia.$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
REPO=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-id) APP_ID="$2"; shift 2 ;;
    --repo)   REPO="$2"; shift 2 ;;
    *) echo "Option inconnue : $1" >&2; exit 1 ;;
  esac
done

# Nom d'affichage : "devis-express" -> "Devis Express".
DISPLAY="$(echo "$NAME" | sed -E 's/[-_]+/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')"

# Mise à jour atomique du JSON via node (pas de sed fragile sur du JSON).
node - "$NAME" "$DISPLAY" "$APP_ID" "$REPO" <<'NODE'
const fs = require('node:fs');
const [, , name, display, appId, repo] = process.argv;

const cfgPath = 'addon.config.json';
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
cfg.name = name;
cfg.displayName = display;
cfg.clientId = name;
cfg.appId = appId;
if (repo) cfg.updateRepo = repo;
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

const pkgPath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
pkg.name = name;
pkg.productName = display;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`✓ addon.config.json + package.json mis à jour :`);
console.log(`  name       = ${name}`);
console.log(`  displayName= ${display}`);
console.log(`  clientId   = ${name}  (header X-Persoia-Client)`);
console.log(`  appId      = ${appId}`);
console.log(`  updateRepo = ${cfg.updateRepo}`);
NODE

echo
echo "Terminé. Étapes suivantes :"
echo "  1. npm install"
echo "  2. npm run dev          # lance l'app web"
echo "  3. Codez votre outil dans src/pages/HelloPersoiaPage.vue"
echo "     (l'auth, le token partagé et les MAJ sont déjà gérés dans src/shared/persoia)"
