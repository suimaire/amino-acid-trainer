import { AMINO_ACIDS } from '../data/aminoAcids';

export type MasteryLevel = 0 | 1 | 2 | 3;
export type MasteryMap = Record<string, MasteryLevel>;

export function clampMastery(value: number): MasteryLevel {
  return Math.max(0, Math.min(3, Math.round(value))) as MasteryLevel;
}

export function emptyMastery(): MasteryMap {
  return Object.fromEntries(AMINO_ACIDS.map((acid) => [acid.id, 0])) as MasteryMap;
}

export function normalizeMastery(candidate: unknown): MasteryMap {
  const fallback = emptyMastery();
  if (!candidate || typeof candidate !== 'object') return fallback;

  const record = candidate as Record<string, unknown>;
  for (const acid of AMINO_ACIDS) {
    const value = record[acid.id];
    if (typeof value === 'number' && Number.isFinite(value)) {
      fallback[acid.id] = clampMastery(value);
    }
  }
  return fallback;
}

export function updateMastery(
  mastery: MasteryMap,
  aminoAcidId: string,
  delta: number,
): MasteryMap {
  return {
    ...mastery,
    [aminoAcidId]: clampMastery((mastery[aminoAcidId] ?? 0) + delta),
  };
}

export function masteredCount(mastery: MasteryMap): number {
  return AMINO_ACIDS.filter((acid) => mastery[acid.id] === 3).length;
}

