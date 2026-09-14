import { describe, expect, it } from 'vitest';
import { createProgressStorage } from './storage';
import { emptyMastery, updateMastery } from './mastery';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('progress storage', () => {
  it('round-trips versioned mastery data', () => {
    const storage = new MemoryStorage();
    const progress = createProgressStorage(storage);
    const mastery = updateMastery(emptyMastery(), 'alanine', 2);
    expect(progress.save(mastery)).toBe(true);
    expect(progress.load().alanine).toBe(2);
  });

  it('recovers from malformed stored data', () => {
    const storage = new MemoryStorage();
    storage.setItem('amino-acid-trainer:progress', '{broken');
    const progress = createProgressStorage(storage);
    expect(progress.load().alanine).toBe(0);
    expect(progress.isAvailable()).toBe(true);
  });

  it('keeps the app usable when storage is unavailable', () => {
    const progress = createProgressStorage(null);
    expect(progress.load().alanine).toBe(0);
    expect(progress.save(emptyMastery())).toBe(false);
    expect(progress.clear()).toBe(false);
    expect(progress.isAvailable()).toBe(false);
  });
});

