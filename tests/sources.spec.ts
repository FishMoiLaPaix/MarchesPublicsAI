import { describe, it, expect } from 'vitest';
import { boampWhere } from '../src-electron/sources/boamp';
import { geoNorm } from '../src-electron/geo';
import { getSources, SOURCES } from '../src-electron/sources';

// Ces tests servent d'ORACLE pour le port : ils figent la construction ODSQL de
// BOAMP, la normalisation géographique et l'ordre du registre, identiques à
// l'app actuelle (legacy/main.js).

describe('boampWhere (clause ODSQL)', () => {
  it('groupe de mots-clés en mode strict → ET', () => {
    expect(
      boampWhere({ keywordGroups: ['nettoyage', 'vitre'], keywordMode: 'strict' }),
    ).toBe('(objet like "nettoyage" and objet like "vitre")');
  });

  it('groupe de mots-clés en mode souple → OU', () => {
    expect(
      boampWhere({ keywordGroups: ['nettoyage', 'vitre'], keywordMode: 'souple' }),
    ).toBe('(objet like "nettoyage" or objet like "vitre")');
  });

  it('mode "ou" → OU également', () => {
    expect(
      boampWhere({ keywordGroups: ['a', 'bb'], keywordMode: 'ou' }),
    ).toBe('(objet like "bb")'); // "a" (1 car.) est filtré (< 2).
  });

  it('échappe les guillemets/backslashes des groupes', () => {
    expect(boampWhere({ keywordGroups: ['a"b'] })).toBe('(objet like "a b")');
  });

  it('départements → code_departement OU code_departement_prestation', () => {
    expect(boampWhere({ depts: ['33'] })).toBe(
      '(code_departement="33" or code_departement_prestation="33")',
    );
  });

  it('facettes structurées', () => {
    expect(boampWhere({ facets: { typeMarche: 'Travaux' } })).toBe(
      'type_marche="Travaux"',
    );
  });

  it('combinaison mots-clés + dépts + facettes (jointes par AND)', () => {
    expect(
      boampWhere({
        keywordGroups: ['toiture'],
        keywordMode: 'strict',
        depts: ['2A'],
        facets: { procedure: 'MAPA', nature: 'AVIS' },
      }),
    ).toBe(
      '(objet like "toiture") and (code_departement="2A" or code_departement_prestation="2A") and procedure_libelle="MAPA" and nature="AVIS"',
    );
  });

  it('état en-cours / cloturé → contrainte de date sur datelimitereponse', () => {
    expect(boampWhere({ facets: { etat: 'en-cours' } })).toMatch(
      /^datelimitereponse>=date'\d{4}-\d{2}-\d{2}'$/,
    );
    expect(boampWhere({ facets: { etat: 'cloture' } })).toMatch(
      /^datelimitereponse<date'\d{4}-\d{2}-\d{2}'$/,
    );
  });

  it('sans critère → clause vide', () => {
    expect(boampWhere({})).toBe('');
  });
});

describe('geoNorm (normalisation géographique)', () => {
  it('minuscule, sans accents, séparateurs → espace', () => {
    expect(geoNorm('Île-de-France')).toBe('ile de france');
    expect(geoNorm('Saint-Étienne')).toBe('saint etienne');
    expect(geoNorm('PROVENCE-ALPES-CÔTE-D’AZUR')).toBe(
      'provence alpes cote d azur',
    );
  });
});

describe('registre des sources', () => {
  it('expose 11 sources dans l’ordre de l’app actuelle', () => {
    expect(SOURCES).toHaveLength(11);
    expect(getSources().map((s) => s.id)).toEqual([
      'boamp',
      'place',
      'ted',
      'joue',
      'demat-ampa',
      'marches-securises',
      'e-marchespublics',
      'francemarches',
      'marchesonline',
      'aws-solutions',
      'boamp2',
    ]);
  });

  it('chaque source a des métadonnées complètes', () => {
    for (const s of getSources()) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.country).toBeTruthy();
      expect(s.url).toMatch(/^https?:\/\//);
    }
  });
});
