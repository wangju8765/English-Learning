// ============================================================
// Storage Service — IndexedDB + localStorage fallback
// ============================================================
import type { PersistedState, WordState } from '../types';

const DB_NAME = 'english-craft';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';
const STATE_KEY = 'current';

const DEFAULT_STATE: PersistedState = {
  version: 1,
  player: {
    name: 'Adventurer',
    xp: 0,
    streakDays: 0,
    lastActiveDate: '',
    totalSessionsCompleted: 0,
    totalWordsEncountered: 0,
    achievements: [],
  },
  words: {},
  sessions: [],
  settings: {
    soundEnabled: true,
    speechEnabled: true,
    speechRate: 0.85,
    dailyWordTarget: 12,
  },
  meta: {
    lastVocabularyHash: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
  },
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function getFromIndexedDB(): Promise<PersistedState | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(STATE_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveToIndexedDB(state: PersistedState): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(state, STATE_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// localStorage fallback
function getFromLocalStorage(): PersistedState | null {
  try {
    const raw = localStorage.getItem('english-craft-state');
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

function saveToLocalStorage(state: PersistedState): void {
  try {
    localStorage.setItem('english-craft-state', JSON.stringify(state));
    // Also save critical subset for recovery
    localStorage.setItem(
      'english-craft-critical',
      JSON.stringify({
        player: state.player,
        settings: state.settings,
        meta: state.meta,
      })
    );
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export async function loadState(): Promise<PersistedState> {
  // Try IndexedDB first
  const idbState = await getFromIndexedDB();
  if (idbState) return idbState;

  // Fallback to localStorage
  const lsState = getFromLocalStorage();
  if (lsState) {
    // Restore to IndexedDB
    saveToIndexedDB(lsState);
    return lsState;
  }

  return { ...DEFAULT_STATE, meta: { ...DEFAULT_STATE.meta, createdAt: new Date().toISOString() } };
}

export async function saveState(state: PersistedState): Promise<void> {
  state.meta.updatedAt = new Date().toISOString();
  saveToLocalStorage(state);
  await saveToIndexedDB(state);
}

export function exportState(state: PersistedState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): PersistedState | null {
  try {
    const state = JSON.parse(json) as PersistedState;
    if (!state.version || !state.player || !state.words) {
      throw new Error('Invalid state format');
    }
    return state;
  } catch {
    return null;
  }
}

// Word state helpers
export function createWordState(
  entry: {
    id: string;
    word: string;
    variants?: string[];
    phonetic: string;
    partOfSpeech: string;
    definition: string;
    definitionDetail?: string[];
    exampleSentences: { english: string; chinese: string }[];
    parentNotes?: string;
    sourceDate: string;
  },
  today: string
): WordState {
  return {
    ...entry,
    masteryLevel: 0,
    easeFactor: 2.5,
    nextReviewDate: today,
    lastReviewDate: '',
    consecutiveCorrect: 0,
    totalAttempts: 0,
    totalCorrect: 0,
    firstSeenDate: today,
    reviewHistory: [],
    gameModePerformance: {},
  };
}

export function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
