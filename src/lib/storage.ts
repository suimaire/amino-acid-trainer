import { emptyMastery, normalizeMastery, type MasteryMap } from './mastery';

const STORAGE_KEY = 'amino-acid-trainer:progress';
const SCHEMA_VERSION = 1;

interface StoredProgress {
  version: number;
  mastery: MasteryMap;
}

export interface ProgressStorage {
  load(): MasteryMap;
  save(mastery: MasteryMap): boolean;
  clear(): boolean;
  isAvailable(): boolean;
}

export function createProgressStorage(storage: Storage | null = safeLocalStorage()): ProgressStorage {
  let available = storage !== null;

  return {
    load(): MasteryMap {
      if (!storage || !available) return emptyMastery();
      let raw: string | null;
      try {
        raw = storage.getItem(STORAGE_KEY);
      } catch {
        available = false;
        return emptyMastery();
      }
      if (!raw) return emptyMastery();
      try {
        const parsed = JSON.parse(raw) as Partial<StoredProgress>;
        if (parsed.version !== SCHEMA_VERSION) return emptyMastery();
        return normalizeMastery(parsed.mastery);
      } catch {
        return emptyMastery();
      }
    },

    save(mastery: MasteryMap): boolean {
      if (!storage || !available) return false;
      try {
        const payload: StoredProgress = { version: SCHEMA_VERSION, mastery };
        storage.setItem(STORAGE_KEY, JSON.stringify(payload));
        return true;
      } catch {
        available = false;
        return false;
      }
    },

    clear(): boolean {
      if (!storage || !available) return false;
      try {
        storage.removeItem(STORAGE_KEY);
        return true;
      } catch {
        available = false;
        return false;
      }
    },

    isAvailable(): boolean {
      return available;
    },
  };
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
