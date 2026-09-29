import { describe, expect, it } from 'vitest';
import { AMINO_ACIDS, CATEGORY_IDS } from './aminoAcids';
import { AMINO_ACID_PROPERTIES, filterProperties } from './aminoAcidProperties';

// Fixed reference supplied for this page: code, Mr, pK1, pK2, pKR, pI, hydropathy.
const EXPECTED_REFERENCE = [
  ['Gly', 75, 2.34, 9.60, null, 5.97, -0.4],
  ['Ala', 89, 2.34, 9.69, null, 6.01, 1.8],
  ['Pro', 115, 1.99, 10.96, null, 6.48, -1.6],
  ['Val', 117, 2.32, 9.62, null, 5.97, 4.2],
  ['Leu', 131, 2.36, 9.60, null, 5.98, 3.8],
  ['Ile', 131, 2.36, 9.68, null, 6.02, 4.5],
  ['Met', 149, 2.28, 9.21, null, 5.74, 1.9],
  ['Phe', 165, 1.83, 9.13, null, 5.48, 2.8],
  ['Tyr', 181, 2.20, 9.11, 10.07, 5.66, -1.3],
  ['Trp', 204, 2.38, 9.39, null, 5.89, -0.9],
  ['Ser', 105, 2.21, 9.15, null, 5.68, -0.8],
  ['Thr', 119, 2.11, 9.62, null, 5.87, -0.7],
  ['Cys', 121, 1.96, 10.28, 8.18, 5.07, 2.5],
  ['Asn', 132, 2.02, 8.80, null, 5.41, -3.5],
  ['Gln', 146, 2.17, 9.13, null, 5.65, -3.5],
  ['Asp', 133, 1.88, 9.60, 3.65, 2.77, -3.5],
  ['Glu', 147, 2.19, 9.67, 4.25, 3.22, -3.5],
  ['Lys', 146, 2.18, 8.95, 10.53, 9.74, -3.9],
  ['His', 155, 1.82, 9.17, 6.00, 7.59, -3.2],
  ['Arg', 174, 2.17, 9.04, 12.48, 10.76, -4.5],
];

describe('amino-acid reference properties', () => {
  it('matches all supplied numbers and the requested display order exactly', () => {
    expect(AMINO_ACID_PROPERTIES.map((acid) => [
      acid.threeLetter, acid.mr, acid.pK1, acid.pK2, acid.pKR, acid.pI, acid.hydropathy,
    ])).toEqual(EXPECTED_REFERENCE);
  });

  it('covers exactly 20 canonical identities in groups of 7 / 3 / 5 / 2 / 3', () => {
    expect(AMINO_ACID_PROPERTIES).toHaveLength(20);
    for (const key of ['id', 'oneLetter', 'threeLetter'] as const) {
      expect(new Set(AMINO_ACID_PROPERTIES.map((acid) => acid[key])).size).toBe(20);
    }
    expect(CATEGORY_IDS.map((category) =>
      AMINO_ACID_PROPERTIES.filter((acid) => acid.category === category).length,
    )).toEqual([7, 3, 5, 2, 3]);
    for (const acid of AMINO_ACID_PROPERTIES) {
      const canonical = AMINO_ACIDS.find((candidate) => candidate.id === acid.id);
      expect(canonical).toBeDefined();
      for (const key of ['name', 'koreanName', 'threeLetter', 'oneLetter', 'category'] as const) {
        expect(acid[key]).toBe(canonical?.[key]);
      }
    }
  });

  it('has finite required numbers, explicitly nullable pKR, and compact features', () => {
    for (const acid of AMINO_ACID_PROPERTIES) {
      for (const key of ['mr', 'pK1', 'pK2', 'pI', 'hydropathy'] as const) {
        expect(Number.isFinite(acid[key])).toBe(true);
      }
      expect(acid.pKR === null || Number.isFinite(acid.pKR)).toBe(true);
      expect(acid.features.length).toBeGreaterThanOrEqual(2);
      expect(acid.features.length).toBeLessThanOrEqual(4);
    }
  });

  it('combines group filters with case-insensitive names and codes', () => {
    expect(filterProperties('all', '  ')).toHaveLength(20);
    expect(filterProperties('acidic', '')).toHaveLength(2);
    for (const query of ['Glycine', '글라이신', ' GLY ', 'g']) {
      expect(filterProperties('all', query).map((acid) => acid.threeLetter)).toEqual(['Gly']);
    }
    expect(filterProperties('nonpolar-aliphatic', 'leucine').map((acid) => acid.threeLetter))
      .toEqual(['Leu', 'Ile']);
    expect(filterProperties('aromatic', 'tyr').map((acid) => acid.threeLetter)).toEqual(['Tyr']);
    expect(filterProperties('acidic', 'Glycine')).toEqual([]);
    expect(filterProperties('all', '<img>')).toEqual([]);
    expect(filterProperties('all', 'not an amino acid')).toEqual([]);
  });
});
