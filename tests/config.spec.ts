import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { deduceApiBaseClient } from '../src/shared/persoia/base';
import {
  PERSOIA_DEFAULT_BASE,
  PERSOIA_DEMO_BASE,
} from '../src/shared/persoia/types';

describe('deduceApiBaseClient', () => {
  it('renvoie la base prod par défaut', () => {
    expect(deduceApiBaseClient('persoia_sk_abc', '')).toBe(PERSOIA_DEFAULT_BASE);
  });

  it('déduit la base démo depuis le préfixe persoia_demo_sk_', () => {
    expect(deduceApiBaseClient('persoia_demo_sk_abc', '')).toBe(PERSOIA_DEMO_BASE);
  });

  it('respecte une surcharge explicite', () => {
    expect(deduceApiBaseClient('persoia_demo_sk_abc', 'https://x.persoia.com/v1')).toBe(
      'https://x.persoia.com/v1',
    );
  });
});

describe('loadConfig / saveConfig (store partagé)', () => {
  let dir: string;
  let configPath: string;
  const savedEnv = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'persoia-test-'));
    configPath = join(dir, 'config.env');
    // Isole le test du store réel de la machine.
    process.env.PERSOIA_CONFIG = configPath;
    delete process.env.PERSOIA_API_KEY;
    delete process.env.PERSOIA_API_BASE;
    delete process.env.PERSOIA_MODEL;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    rmSync(dir, { recursive: true, force: true });
  });

  it('roundtrip : la valeur écrite est relue', async () => {
    const { loadConfig, saveConfig } = await import('../src/shared/persoia/config');
    saveConfig({ PERSOIA_API_KEY: 'persoia_sk_xyz', PERSOIA_MODEL: 'small' });
    expect(existsSync(configPath)).toBe(true);

    const cfg = loadConfig();
    expect(cfg.PERSOIA_API_KEY).toBe('persoia_sk_xyz');
    expect(cfg.PERSOIA_MODEL).toBe('small');
    expect(cfg.PERSOIA_API_BASE).toBe(PERSOIA_DEFAULT_BASE);
  });

  it('logout efface la clé mais préserve le modèle', async () => {
    const { loadConfig, saveConfig, logout } = await import(
      '../src/shared/persoia/config'
    );
    saveConfig({ PERSOIA_API_KEY: 'persoia_sk_xyz', PERSOIA_MODEL: 'small' });
    logout();

    const cfg = loadConfig();
    expect(cfg.PERSOIA_API_KEY).toBe('');
    expect(cfg.PERSOIA_MODEL).toBe('small');
    // Le fichier ne contient plus la clé.
    expect(readFileSync(configPath, 'utf-8')).not.toContain('persoia_sk_xyz');
  });

  it('la variable env est prioritaire sur le fichier', async () => {
    const { loadConfig, saveConfig } = await import('../src/shared/persoia/config');
    saveConfig({ PERSOIA_API_KEY: 'persoia_sk_file' });
    process.env.PERSOIA_API_KEY = 'persoia_sk_env';

    expect(loadConfig().PERSOIA_API_KEY).toBe('persoia_sk_env');
  });
});
