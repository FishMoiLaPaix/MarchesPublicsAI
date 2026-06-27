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

/** Parse un fichier au format `CLE=valeur` (lignes vides et # ignorés). */
function parseEnvFile(content: string): Partial<PersoiaConfig> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (CONFIG_KEYS.includes(key as keyof PersoiaConfig)) out[key] = value;
  }
  return out as Partial<PersoiaConfig>;
}

/**
 * Charge la config effective : variables d'environnement (prioritaires) fusionnées
 * avec le fichier partagé. La base d'API est toujours résolue (jamais vide).
 * Tolère un fichier absent ou corrompu (renvoie des valeurs vides).
 */
export function loadConfig(): PersoiaConfig {
  let fileCfg: Partial<PersoiaConfig> = {};
  try {
    const path = getConfigPath();
    if (existsSync(path)) fileCfg = parseEnvFile(readFileSync(path, 'utf-8'));
  } catch {
    fileCfg = {};
  }

  const cfg: PersoiaConfig = {
    PERSOIA_API_KEY:
      process.env.PERSOIA_API_KEY || fileCfg.PERSOIA_API_KEY || '',
    PERSOIA_API_BASE:
      process.env.PERSOIA_API_BASE || fileCfg.PERSOIA_API_BASE || '',
    PERSOIA_MODEL: process.env.PERSOIA_MODEL || fileCfg.PERSOIA_MODEL || '',
    PERSOIA_TENANT_NAME:
      process.env.PERSOIA_TENANT_NAME || fileCfg.PERSOIA_TENANT_NAME || '',
  };
  cfg.PERSOIA_API_BASE = deduceApiBaseClient(
    cfg.PERSOIA_API_KEY,
    cfg.PERSOIA_API_BASE,
  );
  return cfg;
}

/**
 * Écrit/fusionne des clés PERSOIA_* dans le fichier partagé (perms 0600).
 * Ne touche qu'aux clés fournies : préserve les autres champs existants.
 */
export function saveConfig(values: Partial<PersoiaConfig>): void {
  const path = getConfigPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Fusion avec l'existant.
  let current: Partial<PersoiaConfig> = {};
  if (existsSync(path)) {
    try {
      current = parseEnvFile(readFileSync(path, 'utf-8'));
    } catch {
      current = {};
    }
  }
  const merged = { ...current, ...values };

  const lines = [
    '# persoIA configuration — partagée par tous les outils persoIA.',
    '# Généré automatiquement. Ne pas committer (cf. .gitignore).',
  ];
  for (const key of CONFIG_KEYS) {
    const v = merged[key];
    if (v) lines.push(`${key}=${v}`);
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
