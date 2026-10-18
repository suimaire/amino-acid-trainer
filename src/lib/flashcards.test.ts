import { describe, expect, it } from 'vitest';
import { AMINO_ACIDS, AMINO_ACID_BY_ID } from '../data/aminoAcids';
import { createFlashStructureChoices } from './flashcards';

describe('name to four structures (flashcards)', () => {
  it('includes each exact structure exactly once among four unique choices', () => {
    for (const acid of AMINO_ACIDS) {
      for (const seed of [0, 0.23, 0.42, 0.99]) {
        const options = createFlashStructureChoices(acid, () => seed);
        expect(options).toHaveLength(4);
        expect(new Set(options.map((option) => option.id)).size).toBe(4);
        expect(options.filter((option) => option.id === acid.id)).toHaveLength(1);
        expect(options.every((option) => option.smiles.length > 0)).toBe(true);
      }
    }
  });

  it('always includes a structurally confusable near neighbor', () => {
    const pairs: Array<readonly [string, string]> = [
      ['leucine', 'isoleucine'],
      ['valine', 'leucine'],
      ['aspartic-acid', 'asparagine'],
      ['glutamic-acid', 'glutamine'],
      ['serine', 'threonine'],
      ['phenylalanine', 'tyrosine'],
      ['arginine', 'lysine'],
      ['glycine', 'alanine'],
    ];
    for (const [id, neighbor] of pairs) {
      const acid = AMINO_ACID_BY_ID.get(id);
      expect(acid).toBeDefined();
      expect(createFlashStructureChoices(acid!, () => 0.5).some((option) => option.id === neighbor))
        .toBe(true);
    }
  });

  it('uses the provided RNG reproducibly and keeps the correct answer randomized', () => {
    const acid = AMINO_ACID_BY_ID.get('alanine')!;
    const at = (n: number) => createFlashStructureChoices(acid, () => n).map((option) => option.id);
    expect(at(0.32)).toEqual(at(0.32));
    const layouts = [0, 0.13, 0.44, 0.8, 0.99].map(at);
    expect(new Set(layouts.map((ids) => ids.join(','))).size).toBeGreaterThan(1);
  });

  it('keeps every neighbor pool distinct from its own answer and drawn from canonical data', () => {
    for (const acid of AMINO_ACIDS) {
      const options = createFlashStructureChoices(acid, () => 0.17);
      expect(options.every((item) => AMINO_ACID_BY_ID.get(item.id) === item)).toBe(true);
    }
  });
});
