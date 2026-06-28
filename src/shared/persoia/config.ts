// Lecture/écriture du store de configuration PARTAGÉ entre tous les outils PersoIA.
//
// ⚠️  Node uniquement (fs/os/path). Ce module n'est importé QUE par le process
// principal Electron (src-electron/electron-main.ts). Le renderer y accède via
// le pont preload (window.persoia), jamais directement.
//
// C'est ce fichier qui réalise concrètement le « token partagé entre outils » :
// tous les addons lisent/écrivent le MÊME fichier config.env, donc un login fait
// depuis un outil profite à tous les autres sur la même machine.
//
// Port fidèle du contrat de addons/persoia-auth/persoia_auth.py (Python stdlib).

import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { type PersoiaConfig } from './types';
import { deduceApiBaseClient } from './base';

const CONFIG_KEYS: (keyof PersoiaConfig)[] = [
  'PERSOIA_API_KEY',
  'PERSOIA_API_BASE',
  'PERSOIA_MODEL',
  'PERSOIA_TENANT_NAME',
];

/** Dossier de config partagé, dépendant de l'OS. */
function configDir(): string {
  if (process.platform === 'win32') {
    const base =
      process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(base, 'persoia');
  }
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'persoia');
}

/** Chemin du fichier config.env (surchargé par la variable PERSOIA_CONFIG). */
export function getConfigPath(): string {
  return process.env.PERSOIA_CONFIG || join(configDir(), 'config.env');
}

/**
 * Parse un fichier `CLE=valeur` en préservant TOUTES les clés (lignes vides et #
 * ignorés). On NE filtre PAS sur les clés connues : le fichier est partagé entre
 * tous les outils, il peut contenir des clés d'autres addons (ex. une clé privée,
 * PERSOIA_CONTEXT_WINDOW, etc.) qu'il ne faut jamais perdre.
 */
function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

/**
 * Charge la config effective : variables d'environnement (prioritaires) fusionnées
 * avec le fichier partagé. La base d'API est toujours résolue (jamais vide).
 * Tolère un fichier absent ou corrompu (renvoie des valeurs vides).
 */
export function loadConfig(): PersoiaConfig {
  let file: Record<string, string> = {};
  try {
    const path = getConfigPath();
    if (existsSync(path)) file = parseEnv(readFileSync(path, 'utf-8'));
  } catch {
    file = {};
  }

  const cfg: PersoiaConfig = {
    PERSOIA_API_KEY: process.env.PERSOIA_API_KEY || file.PERSOIA_API_KEY || '',
    PERSOIA_API_BASE:
      process.env.PERSOIA_API_BASE || file.PERSOIA_API_BASE || '',
    PERSOIA_MODEL: process.env.PERSOIA_MODEL || file.PERSOIA_MODEL || '',
    PERSOIA_TENANT_NAME:
      process.env.PERSOIA_TENANT_NAME || file.PERSOIA_TENANT_NAME || '',
  };
  cfg.PERSOIA_API_BASE = deduceApiBaseClient(
    cfg.PERSOIA_API_KEY,
    cfg.PERSOIA_API_BASE,
  );
  return cfg;
}

/**
 * Écrit/fusionne des clés PERSOIA_* dans le fichier partagé (perms 0600).
 * Ne touche qu'aux clés fournies et PRÉSERVE TOUTES les autres clés existantes —
 * y compris celles d'autres outils ou une clé privée (ex. PERSOIA_CONTEXT_WINDOW).
 * Le config.env est commun à tous les addons : un login/logout ne doit JAMAIS
 * effacer la configuration d'un autre outil.
 */
export function saveConfig(values: Partial<PersoiaConfig>): void {
  const path = getConfigPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Relit l'intégralité du fichier (toutes les clés, connues ou non) avant fusion.
  let current: Record<string, string> = {};
  if (existsSync(path)) {
    try {
      current = parseEnv(readFileSync(path, 'utf-8'));
    } catch {
      current = {};
    }
  }
  const merged: Record<string, string | undefined> = { ...current, ...values };

  const lines = [
    '# persoIA configuration — partagée par tous les outils persoIA.',
    '# Généré automatiquement. Ne pas committer (cf. .gitignore).',
  ];
  // Clés CONNUES d'abord (ordre stable) : pour elles, une valeur vide retire la
  // clé — c'est ainsi que logout() efface PERSOIA_API_KEY.
  const known = new Set<string>(CONFIG_KEYS);
  for (const key of CONFIG_KEYS) {
    const v = merged[key];
    if (v) lines.push(`${key}=${v}`);
  }
  // Puis toute AUTRE clé existante : on réécrit la paire clé=valeur dès que la clé
  // est présente, y compris une valeur vide voulue (`FOO=`) — on ne supprime jamais
  // la clé d'un autre outil. NB : le fichier est régénéré (en-tête + ordre des
  // clés connues normalisés, espaces autour du `=` retirés par parseEnv), donc la
  // préservation porte sur les paires clé/valeur, pas sur le format ligne à ligne.
  for (const key of Object.keys(merged)) {
    if (known.has(key)) continue;
    const v = merged[key];
    if (v !== undefined) lines.push(`${key}=${v}`);
  }
  writeFileSync(path, lines.join('\n') + '\n', { encoding: 'utf-8', mode: 0o600 });
  if (process.platform !== 'win32') {
    try {
      chmodSync(path, 0o600);
    } catch {
      /* best-effort */
    }
  }
}

/** Efface uniquement la clé API (préserve modèle / tenant / base). */
export function logout(): void {
  saveConfig({ PERSOIA_API_KEY: '' });
}
