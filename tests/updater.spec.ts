import { describe, it, expect } from 'vitest';
import { isNewer } from '../src/shared/persoia/updater';

describe('isNewer', () => {
  it('détecte une version majeure plus récente', () => {
    expect(isNewer('2.0.0', '1.9.9')).toBe(true);
  });

  it('tolère le préfixe v sur les tags', () => {
    expect(isNewer('v1.2.0', '1.1.0')).toBe(true);
    expect(isNewer('v1.0.0', 'v1.0.0')).toBe(false);
  });

  it('compare correctement patch et minor', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true);
    expect(isNewer('1.0.0', '1.0.1')).toBe(false);
    expect(isNewer('1.2.0', '1.10.0')).toBe(false);
  });

  it('égalité → pas de mise à jour', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
  });
});
