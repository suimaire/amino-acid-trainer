import { describe, expect, it } from 'vitest';
import SmilesDrawer from 'smiles-drawer';
import { AMINO_ACIDS, CATEGORY_IDS } from './aminoAcids';

const EXPECTED_CODES = [
  ['Alanine', 'Ala', 'A'],
  ['Arginine', 'Arg', 'R'],
  ['Asparagine', 'Asn', 'N'],
  ['Aspartic acid', 'Asp', 'D'],
  ['Cysteine', 'Cys', 'C'],
  ['Glutamine', 'Gln', 'Q'],
  ['Glutamic acid', 'Glu', 'E'],
  ['Glycine', 'Gly', 'G'],
  ['Histidine', 'His', 'H'],
  ['Isoleucine', 'Ile', 'I'],
  ['Leucine', 'Leu', 'L'],
  ['Lysine', 'Lys', 'K'],
  ['Methionine', 'Met', 'M'],
  ['Phenylalanine', 'Phe', 'F'],
  ['Proline', 'Pro', 'P'],
  ['Serine', 'Ser', 'S'],
  ['Threonine', 'Thr', 'T'],
  ['Tryptophan', 'Trp', 'W'],
  ['Tyrosine', 'Tyr', 'Y'],
  ['Valine', 'Val', 'V'],
];

const EXPECTED_SIDE_CHAINS: Record<string, string> = {
  Asp: '–CH₂–COOH',
  Glu: '–CH₂–CH₂–COOH',
  Asn: '–CH₂–CONH₂',
  Gln: '–CH₂–CH₂–CONH₂',
  Val: '–CH(CH₃)₂',
  Leu: '–CH₂–CH(CH₃)₂',
  Ile: '–CH(CH₃)–CH₂–CH₃',
  Ser: '–CH₂–OH',
  Thr: '–CH(OH)–CH₃',
  Cys: '–CH₂–SH',
  Met: '–CH₂–CH₂–S–CH₃',
  Phe: '–CH₂–phenyl',
  Tyr: '–CH₂–p-hydroxyphenyl',
  Trp: '–CH₂–indole',
  His: '–CH₂–imidazole',
  Lys: '–(CH₂)₄–NH₂',
  Arg: '–(CH₂)₃–NH–C(=NH)–NH₂',
  Pro: '–(CH₂)₃– → backbone N',
};

describe('canonical amino-acid data', () => {
  it('contains exactly the required 20 unique mappings', () => {
    expect(AMINO_ACIDS).toHaveLength(20);
    expect(AMINO_ACIDS.map(({ name, threeLetter, oneLetter }) => [name, threeLetter, oneLetter])).toEqual(
      EXPECTED_CODES,
    );
    expect(new Set(AMINO_ACIDS.map((acid) => acid.name)).size).toBe(20);
    expect(new Set(AMINO_ACIDS.map((acid) => acid.threeLetter)).size).toBe(20);
    expect(new Set(AMINO_ACIDS.map((acid) => acid.oneLetter)).size).toBe(20);
  });

  it('has every required field and only approved categories', () => {
    for (const acid of AMINO_ACIDS) {
      expect(acid.id).not.toBe('');
      expect(acid.name).not.toBe('');
      expect(acid.koreanName).not.toBe('');
      expect(acid.threeLetter).toMatch(/^[A-Z][a-z]{2}$/);
      expect(acid.oneLetter).toMatch(/^[A-Z]$/);
      expect(CATEGORY_IDS).toContain(acid.category);
      expect(acid.smiles).not.toBe('');
      expect(acid.sideChain).not.toBe('');
      expect(acid.note).not.toBe('');
    }
  });

  it('records the required side-chain identities', () => {
    for (const [code, sideChain] of Object.entries(EXPECTED_SIDE_CHAINS)) {
      expect(AMINO_ACIDS.find((acid) => acid.threeLetter === code)?.sideChain).toBe(sideChain);
    }
  });

  it('parses every verified SMILES structure', async () => {
    await Promise.all(
      AMINO_ACIDS.map(
        (acid) =>
          new Promise<void>((resolve, reject) => {
            SmilesDrawer.parse(acid.smiles, () => resolve(), reject);
          }),
      ),
    );
  });

  it('keeps Proline ring closure and Ile/Thr side-chain stereochemistry explicit', () => {
    const proline = AMINO_ACIDS.find((acid) => acid.threeLetter === 'Pro');
    const isoleucine = AMINO_ACIDS.find((acid) => acid.threeLetter === 'Ile');
    const threonine = AMINO_ACIDS.find((acid) => acid.threeLetter === 'Thr');
    expect(proline?.smiles).toMatch(/1.*N.*1/);
    expect(proline?.note).toContain('주사슬 질소');
    expect(isoleucine?.smiles.match(/@{1,2}/g)).toHaveLength(2);
    expect(threonine?.smiles.match(/@{1,2}/g)).toHaveLength(2);
  });
});
