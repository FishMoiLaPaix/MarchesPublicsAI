// Store JSON minimal du process principal (Electron). Persiste dans
// userData/store.json. Port réduit de legacy/main.js : ne sert plus qu'au cache
// du référentiel géographique (l'état UI — corbeille, lus, récents, filtres —
// vit désormais côté renderer via Quasar LocalStorage).

import { app } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

let cache: Record<string, unknown> | null = null;

function storeFile(): string {
  return join(app.getPath('userData'), 'store.json');
}

function load(): Record<string, unknown> {
  if (cache) return cache;
  try {
    cache = JSON.parse(readFileSync(storeFile(), 'utf-8')) as Record<
      string,
      unknown
    >;
  } catch {
    cache = {};
  }
  return cache;
}

function save(): void {
  try {
    writeFileSync(storeFile(), JSON.stringify(cache), 'utf-8');
  } catch {
    /* best-effort */
  }
}

export function storeGet<T>(key: string): T | null {
  return (load()[key] as T) ?? null;
}

export function storeSet(key: string, value: unknown): void {
  load()[key] = value;
  save();
}
