// Suivi de mise à jour par GitHub Releases. Basé sur fetch (renderer ou Node).
//
// Modèle (cf. docs/05-auto-update.md) : la CI Jenkins build sur tag v* et publie
// les artefacts sur la release GitHub correspondante. L'app compare SA version
// (package.json) à la dernière release publiée et propose la mise à jour.

import type { UpdateInfo } from './types';

/** Normalise un tag/version en triplet numérique (tolère le préfixe "v"). */
function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split('.')
    .map((p) => parseInt(p, 10) || 0);
}

/** Renvoie true si `latest` est strictement plus récent que `current`. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const da = a[i] ?? 0;
    const db = b[i] ?? 0;
    if (da > db) return true;
    if (da < db) return false;
  }
  return false;
}

export interface CheckUpdateOptions {
  /** Version courante de l'app (package.json). */
  current: string;
  /** Dépôt GitHub "owner/repo" hébergeant les releases. */
  repo: string;
  /** Token GitHub optionnel (dépôt privé / quota). */
  token?: string;
}

/**
 * Interroge la dernière release publiée et indique si une MAJ est disponible.
 * En cas d'erreur réseau / quota, renvoie updateAvailable=false (jamais d'exception).
 */
export async function checkForUpdate(
  opts: CheckUpdateOptions,
): Promise<UpdateInfo> {
  const fallback: UpdateInfo = {
    updateAvailable: false,
    current: opts.current,
    latest: null,
    url: null,
  };
  if (!opts.repo) return fallback;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
    };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

    const res = await fetch(
      `https://api.github.com/repos/${opts.repo}/releases/latest`,
      { headers },
    );
    if (!res.ok) return fallback;

    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    const latest = data.tag_name ?? null;
    return {
      updateAvailable: latest ? isNewer(latest, opts.current) : false,
      current: opts.current,
      latest,
      url: data.html_url ?? null,
    };
  } catch {
    return fallback;
  }
}
