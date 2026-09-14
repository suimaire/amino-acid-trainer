import { describe, expect, it } from 'vitest';
import { clampMastery, emptyMastery, masteredCount, updateMastery } from './mastery';

describe('mastery rules', () => {
  it('clamps every level to the 0–3 range', () => {
    expect(clampMastery(-12)).toBe(0);
    expect(clampMastery(0)).toBe(0);
    expect(clampMastery(2)).toBe(2);
    expect(clampMastery(99)).toBe(3);
  });

  it('applies predictable +1, 0, and -1 changes', () => {
    let mastery = emptyMastery();
    mastery = updateMastery(mastery, 'alanine', 1);
    mastery = updateMastery(mastery, 'alanine', 0);
    expect(mastery.alanine).toBe(1);
    mastery = updateMastery(mastery, 'alanine', -1);
    mastery = updateMastery(mastery, 'alanine', -1);
    expect(mastery.alanine).toBe(0);
  });

  it('counts only level 3 as mastered', () => {
    let mastery = emptyMastery();
    mastery = updateMastery(mastery, 'alanine', 3);
    mastery = updateMastery(mastery, 'arginine', 2);
    expect(masteredCount(mastery)).toBe(1);
  });
});

