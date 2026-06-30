#!/usr/bin/env bash
# release.sh — Crée et pousse un tag de release. La CI Jenkins (ci/Jenkinsfile)
# se déclenche sur les tags v* : build multi-plateformes + publication des
# artefacts sur la release GitHub. L'app installée détecte ensuite la nouvelle
# version (cf. src/shared/persoia/updater.ts).
#
# Usage : bash scripts/release.sh 0.2.0
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage : bash scripts/release.sh <version>   (ex. 0.2.0)" >&2
  exit 1
fi
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Erreur : version invalide '$VERSION' (attendu X.Y.Z)." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Erreur : arbre de travail non propre. Committez avant de tagger." >&2
  exit 1
fi

# Aligne package.json sur la version puis tague.
node -e "const f='package.json',p=require('./'+f);p.version='$VERSION';require('node:fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
git add package.json
git commit -m "chore(release): v$VERSION"
git tag "v$VERSION"

echo "Tag v$VERSION créé. Poussez-le pour déclencher la CI :"
echo "  git push origin HEAD --tags"
