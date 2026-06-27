#!/usr/bin/env bash
# gen-icons.sh — Régénère les icônes Electron à partir de src-electron/icons/icon.png.
#
# Le build desktop a besoin de formats natifs : .icns (macOS) et .ico (Windows).
# electron-builder ne les déduit pas du .png — il faut les fournir. Ce script les
# (re)génère après que vous avez remplacé icon.png par le logo de votre addon
# (512×512 minimum recommandé).
#
# macOS : utilise sips + iconutil (natifs). .ico généré en PNG-embarqué via node.
# Sur Linux/Windows : installez/relayez sur `@quasar/icongenie` (cf. README).
#
# Usage : bash scripts/gen-icons.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICONS="$ROOT/src-electron/icons"
SRC="$ICONS/icon.png"

[[ -f "$SRC" ]] || { echo "Erreur : $SRC introuvable." >&2; exit 1; }

if ! command -v sips &>/dev/null || ! command -v iconutil &>/dev/null; then
  echo "Ce script requiert macOS (sips + iconutil)." >&2
  echo "Sur Linux/Windows, utilisez : npx @quasar/icongenie generate -i $SRC" >&2
  exit 1
fi

# --- .icns (macOS) ----------------------------------------------------------
SET="$(mktemp -d)/icon.iconset"; mkdir -p "$SET"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" "$SRC" --out "$SET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z "$d" "$d" "$SRC" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$ICONS/icon.icns"
echo "✓ $ICONS/icon.icns"

# --- .ico (Windows, PNG-embarqué 256×256) -----------------------------------
TMP256="$(mktemp).png"
sips -z 256 256 "$SRC" --out "$TMP256" >/dev/null
node - "$TMP256" "$ICONS/icon.ico" <<'NODE'
const fs = require('node:fs');
const [, , src, out] = process.argv;
const png = fs.readFileSync(src);
const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4);
const ent = Buffer.alloc(16);
ent[0] = 0; ent[1] = 0;              // 256×256 encodé comme 0
ent.writeUInt16LE(1, 4);             // planes
ent.writeUInt16LE(32, 6);            // bpp
ent.writeUInt32LE(png.length, 8);
ent.writeUInt32LE(6 + 16, 12);       // offset
fs.writeFileSync(out, Buffer.concat([dir, ent, png]));
NODE
echo "✓ $ICONS/icon.ico"
echo "Terminé. Committez icon.png + icon.icns + icon.ico."
