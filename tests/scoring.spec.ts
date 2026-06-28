import { describe, it, expect } from 'vitest';
import { norm, normWords, stemWord, queryKeywords } from '../src/domain/text';
import { geoScan, fromGeoReference } from '../src/domain/geo';
import { computeClientScore } from '../src/domain/scoring';
import { parseResultDate, dateInRange, passEtat } from '../src/domain/dates';
import { buildFilters, offerKey } from '../src/domain/filters';
import { processResults } from '../src/domain/pipeline';

// Oracles tirés de la logique de l'app actuelle (legacy/index.html).

describe('text', () => {
  it('norm enlève accents + minuscule', () => {
    expect(norm('Réfection ÉCOLE')).toBe('refection ecole');
  });
  it('stemWord racinise (>4 car.)', () => {
    expect(stemWord('équipements')).toBe('équip'); // -ements
    expect(stemWord('sportive')).toBe('sport'); // -ive
    expect(stemWord('eau')).toBe('eau'); // <= 4 car. inchangé
  });
  it('queryKeywords retire stopwords/chiffres/géo', () => {
    expect(queryKeywords('marché de nettoyage 33', new Set(['lyon']))).toEqual([
      'nettoyage',
    ]);
  });
  it('normWords découpe', () => {
    expect(normWords('Toiture, charpente')).toEqual(['toiture', 'charpente']);
  });
});

describe('geoScan', () => {
  const geo = fromGeoReference({
    names: { bordeaux: ['33'], gironde: ['33'] },
    deptCodes: ['33', '75'],
  });
  it('code postal 5 chiffres → département', () => {
    expect([...geoScan('chantier 33000 centre', false, geo).zones]).toEqual([
      '33',
    ]);
  });
  it('nom de commune → code via référentiel', () => {
    const r = geoScan('travaux bordeaux', true, geo);
    expect([...r.zones]).toEqual(['33']);
    expect(r.words.has('bordeaux')).toBe(true);
  });
  it('code à 2 chiffres seul seulement si includeBareCode + connu', () => {
    expect([...geoScan('lot 33', true, geo).zones]).toEqual(['33']);
    expect([...geoScan('lot 33', false, geo).zones]).toEqual([]);
  });
});

describe('computeClientScore', () => {
  it('sans groupe → 60', () => {
    expect(
      computeClientScore({ title: 'x', url: 'u' }, [], new Set()).score,
    ).toBe(60);
  });
  it('groupe entièrement matché → 100', () => {
    const c = computeClientScore(
      { title: 'travaux de toiture', url: 'u' },
      [['toiture']],
      new Set(),
    );
    expect(c).toEqual({ score: 100, matchedGroups: 1, geoMismatch: false });
  });
  it('1 groupe sur 2 (hors titre) → 38', () => {
    const c = computeClientScore(
      { title: 'x', desc: 'achat de toiture', url: 'u' },
      [['toiture'], ['informatique']],
      new Set(),
    );
    expect(c.matchedGroups).toBe(1);
    expect(c.score).toBe(38);
  });
  it('mismatch géo → score plafonné à 8', () => {
    const c = computeClientScore(
      { title: 'toiture', url: 'u', depts: ['75'] },
      [['toiture']],
      new Set(['33']),
    );
    expect(c.geoMismatch).toBe(true);
    expect(c.score).toBe(8);
  });
});

describe('dates', () => {
  it('parse ISO / FR numérique / FR littéral', () => {
    expect(parseResultDate('2024-11-05')?.getTime()).toBe(
      new Date(2024, 10, 5).getTime(),
    );
    expect(parseResultDate('05/11/2024')?.getTime()).toBe(
      new Date(2024, 10, 5).getTime(),
    );
    expect(parseResultDate('5 novembre 2024')?.getTime()).toBe(
      new Date(2024, 10, 5).getTime(),
    );
  });
  it('dateInRange (illisible → conservée)', () => {
    expect(dateInRange('2024-11-05', { from: '2024-11-01', to: '2024-11-30' })).toBe(
      true,
    );
    expect(dateInRange('2024-12-05', { from: '2024-11-01', to: '2024-11-30' })).toBe(
      false,
    );
    expect(dateInRange('texte', { from: '2024-11-01', to: null })).toBe(true);
  });
  it('passEtat en-cours / cloturé', () => {
    expect(passEtat('2099-01-01', 'en-cours')).toBe(true);
    expect(passEtat('2000-01-01', 'en-cours')).toBe(false);
    expect(passEtat('2000-01-01', 'cloture')).toBe(true);
    expect(passEtat('', 'en-cours')).toBe(true); // inconnue → non masquée
  });
});

describe('buildFilters', () => {
  const empty = {
    precise: '',
    secteur: '',
    typeMarche: '',
    famille: '',
    procedure: '',
    nature: '',
    etat: '',
    pubFrom: null,
    pubTo: null,
    closeFrom: null,
    closeTo: null,
  };
  it('découpe les groupes ;-séparés', () => {
    const f = buildFilters({
      ...empty,
      kwBar: 'nettoyage; vitre',
      lieu: '',
      keywordMode: 'strict',
    });
    expect(f.groups).toEqual([['nettoyage'], ['vitre']]);
    expect(f.keywordGroups).toEqual(['nettoyage', 'vitre']);
    expect(f.scraperText).toBe('nettoyage vitre');
    expect(f.depts).toEqual([]);
  });
  it('extrait les départements du lieu + exclut les mots géo des groupes', () => {
    const geo = fromGeoReference({ names: { bordeaux: ['33'] }, deptCodes: ['33'] });
    const f = buildFilters(
      { ...empty, kwBar: 'toiture bordeaux', lieu: '', keywordMode: 'souple' },
      geo,
    );
    expect(f.depts).toEqual(['33']);
    expect(f.groups).toEqual([['toiture']]); // 'bordeaux' retiré (géo)
  });
});

describe('offerKey', () => {
  it('combine url + titre', () => {
    expect(offerKey({ url: 'u', title: 't' })).toBe('u|t');
  });
});

describe('processResults (pipeline)', () => {
  const base = {
    queryZones: new Set<string>(),
    aiAnalysis: null,
    hiddenOffers: new Set<string>(),
    datePub: { from: null, to: null },
    dateClose: { from: null, to: null },
    etat: '',
    typeMarche: '',
    prestationText: '',
    keywordMode: 'souple' as const,
    showIrrelevant: false,
  };
  const results = [
    { title: 'nettoyage de locaux', url: 'u1' },
    { title: 'développement web', url: 'u2' },
  ];

  it('partage pertinents / non pertinents', () => {
    const out = processResults({
      ...base,
      allResults: results,
      groups: [['nettoyage']],
    });
    expect(out.relevant.map((r) => r.url)).toEqual(['u1']);
    expect(out.irrelevant.map((r) => r.url)).toEqual(['u2']);
    expect(out.visible.map((r) => r.url)).toEqual(['u1']); // non pertinents masqués
  });

  it('showIrrelevant affiche les deux', () => {
    const out = processResults({
      ...base,
      allResults: results,
      groups: [['nettoyage']],
      showIrrelevant: true,
    });
    expect(out.visible.map((r) => r.url)).toEqual(['u1', 'u2']);
  });

  it('corbeille écarte une offre', () => {
    const out = processResults({
      ...base,
      allResults: results,
      groups: [['nettoyage']],
      hiddenOffers: new Set([offerKey(results[0])]),
    });
    expect(out.relevant).toHaveLength(0);
    expect(out.visible).toHaveLength(0);
  });

  it('filtre prestation (Services) : ET interne des mots', () => {
    const out = processResults({
      ...base,
      allResults: [
        { title: 'nettoyage de locaux administratifs', url: 'a' },
        { title: 'nettoyage de voirie', url: 'b' },
      ],
      groups: [],
      typeMarche: 'SERVICES',
      prestationText: 'nettoyage locaux',
      showIrrelevant: true,
    });
    expect(out.visible.map((r) => r.url)).toEqual(['a']); // 'b' n'a pas "locaux"
  });
});
