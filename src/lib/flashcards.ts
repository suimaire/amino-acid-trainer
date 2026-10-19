import { AMINO_ACIDS, AMINO_ACID_BY_ID, type AminoAcid } from '../data/aminoAcids';
import { shuffle } from './random';

/**
 * Structural near-neighbors for the 20 standard amino acids. The first entry
 * is always included; two more are randomly drawn from the remaining related
 * structures so the correct answer cannot be learned by position or a fixed set.
 *
 * In particular, this prioritizes Leu/Ile/Val, Asp/Glu vs Asn/Gln,
 * Ser/Thr/Cys, and the aromatic side chains.
 */
const STRUCTURAL_NEIGHBORS: Record<string, readonly string[]> = {
  alanine: ['glycine', 'valine', 'serine', 'cysteine'],
  arginine: ['lysine', 'histidine', 'glutamine', 'asparagine'],
  asparagine: ['aspartic-acid', 'glutamine', 'glutamic-acid', 'serine'],
  'aspartic-acid': ['asparagine', 'glutamic-acid', 'glutamine', 'serine'],
  cysteine: ['serine', 'methionine', 'threonine', 'alanine'],
  glutamine: ['glutamic-acid', 'asparagine', 'aspartic-acid', 'lysine'],
  'glutamic-acid': ['glutamine', 'aspartic-acid', 'asparagine', 'lysine'],
  glycine: ['alanine', 'serine', 'valine', 'proline'],
  histidine: ['tryptophan', 'arginine', 'lysine', 'phenylalanine'],
  isoleucine: ['leucine', 'valine', 'threonine', 'alanine'],
  leucine: ['isoleucine', 'valine', 'methionine', 'alanine'],
  lysine: ['arginine', 'glutamine', 'methionine', 'histidine'],
  methionine: ['cysteine', 'leucine', 'lysine', 'isoleucine'],
  phenylalanine: ['tyrosine', 'tryptophan', 'histidine', 'leucine'],
  proline: ['valine', 'alanine', 'glycine', 'isoleucine'],
  serine: ['threonine', 'cysteine', 'alanine', 'asparagine'],
  threonine: ['serine', 'valine', 'isoleucine', 'cysteine'],
  tryptophan: ['phenylalanine', 'tyrosine', 'histidine', 'proline'],
  tyrosine: ['phenylalanine', 'tryptophan', 'histidine', 'serine'],
  valine: ['leucine', 'isoleucine', 'alanine', 'threonine'],
};

/** Both printed full names and three-letter codes quiz structural recognition. */
export function isStructureChoiceCue(cue: string): boolean {
  return cue === 'name' || cue === 'threeLetter';
}

/** Exactly four unique, verified SMILES structures; one answer, three decoys. */
export function createFlashStructureChoices(
  acid: AminoAcid,
  random: () => number = Math.random,
): AminoAcid[] {
  const similarIds = STRUCTURAL_NEIGHBORS[acid.id] ?? [];
  const closest = similarIds[0] ? AMINO_ACID_BY_ID.get(similarIds[0]) : undefined;
  const related = shuffle(
    similarIds.slice(1)
      .map((id) => AMINO_ACID_BY_ID.get(id))
      .filter((item): item is AminoAcid => Boolean(item)),
    random,
  );

  const pool = [
    ...(closest ? [closest] : []),
    ...related,
    ...shuffle(AMINO_ACIDS.filter((item) => item.category === acid.category), random),
    ...shuffle(AMINO_ACIDS, random),
  ];
  const unique = new Map<string, AminoAcid>();
  for (const item of pool) {
    if (item.id !== acid.id && !unique.has(item.id)) unique.set(item.id, item);
    if (unique.size === 3) break;
  }
  return shuffle([acid, ...unique.values()], random);
}
