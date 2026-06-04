// ============================================================
// Global State Reducer — All game actions
// ============================================================
import type {
  PersistedState,
  WordState,
  SessionRecord,
  GameModeId,
  VocabularyEntry,
} from '../types';
import { XP_CONFIG } from '../types';
import { getTodayDate, createWordState } from '../services/storage';
import { processAnswer } from '../services/spaced-repetition';

// --- Action Types ---

export type AppAction =
  | { type: 'INITIALIZE_STATE'; payload: PersistedState }
  | { type: 'SET_PLAYER_NAME'; payload: string }
  | { type: 'MERGE_VOCABULARY'; payload: VocabularyEntry[] }
  | { type: 'START_SESSION'; payload: { gameMode: GameModeId; words: WordState[] } }
  | {
      type: 'SUBMIT_ANSWER';
      payload: {
        wordId: string;
        correct: boolean;
        gameMode: GameModeId;
        responseTimeMs: number;
      };
    }
  | { type: 'END_SESSION'; payload: { completed: boolean; durationSeconds: number } }
  | { type: 'UPDATE_STREAK' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<PersistedState['settings']> }
  | { type: 'RESET_ALL' }
  | { type: 'IMPORT_STATE'; payload: PersistedState };

// --- State type with runtime fields ---

export interface AppState extends PersistedState {
  activeSession: {
    gameMode: GameModeId;
    words: WordState[];
    results: Record<string, boolean>;
    xpEarned: number;
    startTime: number;
  } | null;
}

// --- Initial State ---

export function createInitialState(): AppState {
  return {
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
      speechRate: 1.0,
      dailyWordTarget: 12,
    },
    meta: {
      lastVocabularyHash: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 2,
    },
    activeSession: null,
  };
}

// --- Reducer ---

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'INITIALIZE_STATE': {
      const saved = action.payload;
      const APP_SCHEMA_VERSION = 2;

      // Check if streak should be reset (missed a day)
      const today = getTodayDate();
      let streakDays = saved.player.streakDays;
      const yesterday = getYesterday();

      if (saved.player.lastActiveDate === today) {
        // Already active today, keep streak
      } else if (saved.player.lastActiveDate === yesterday) {
        // Consecutive day
        streakDays += 1;
      } else if (saved.player.lastActiveDate && saved.player.lastActiveDate !== today) {
        // Streak broken
        streakDays = 0;
      }

      // Schema migration: clear stale word data from older versions
      // v1 → v2: definition field format changed (legacy → YAML), force refresh
      const wordData = (saved.meta.schemaVersion || 1) < APP_SCHEMA_VERSION
        ? {} // Clear words — they will be re-imported from vocabulary.json
        : saved.words;

      return {
        ...saved,
        words: wordData,
        meta: {
          ...saved.meta,
          schemaVersion: APP_SCHEMA_VERSION,
          lastVocabularyHash: wordData === saved.words
            ? saved.meta.lastVocabularyHash
            : '', // Reset hash so vocabulary re-imports
        },
        player: {
          ...saved.player,
          streakDays,
          lastActiveDate: today,
        },
        activeSession: null,
      };
    }

    case 'SET_PLAYER_NAME': {
      return {
        ...state,
        player: { ...state.player, name: action.payload },
      };
    }

    case 'MERGE_VOCABULARY': {
      const today = getTodayDate();
      const updatedWords = { ...state.words };
      let newCount = 0;
      let updatedCount = 0;

      for (const entry of action.payload) {
        if (!updatedWords[entry.id]) {
          // New word — create from scratch
          updatedWords[entry.id] = createWordState(entry, today);
          newCount++;
        } else {
          // Existing word — update content fields, preserve learning progress
          const existing = updatedWords[entry.id];
          updatedWords[entry.id] = {
            ...existing,
            // Update content fields (user may have corrected definitions)
            word: entry.word,
            variants: entry.variants,
            phonetic: entry.phonetic,
            partOfSpeech: entry.partOfSpeech,
            definition: entry.definition,
            definitionDetail: entry.definitionDetail,
            exampleSentences: entry.exampleSentences,
            parentNotes: entry.parentNotes,
            sourceDate: entry.sourceDate,
            // Learning progress fields are preserved from existing
          };
          updatedCount++;
        }
      }

      return {
        ...state,
        words: updatedWords,
        player: {
          ...state.player,
          totalWordsEncountered: state.player.totalWordsEncountered + newCount,
        },
      };
    }

    case 'START_SESSION': {
      return {
        ...state,
        activeSession: {
          gameMode: action.payload.gameMode,
          words: action.payload.words,
          results: {},
          xpEarned: 0,
          startTime: Date.now(),
        },
      };
    }

    case 'SUBMIT_ANSWER': {
      if (!state.activeSession) return state;

      const { wordId, correct, gameMode, responseTimeMs } = action.payload;
      const word = state.words[wordId];
      if (!word) return state;

      // Process spaced repetition
      const updatedWord = processAnswer(word, correct, gameMode, responseTimeMs);

      // Calculate XP
      let xpEarned = 0;
      if (correct) {
        xpEarned += XP_CONFIG.BASE_CORRECT;
        // Bonus for leveling up a word
        if (updatedWord.masteryLevel > word.masteryLevel && updatedWord.masteryLevel === 5) {
          xpEarned += XP_CONFIG.LEVEL_UP_WORD_BONUS;
        }
      }

      // Calculate XP and update
      const newXp = state.player.xp + xpEarned;

      return {
        ...state,
        words: { ...state.words, [wordId]: updatedWord },
        player: {
          ...state.player,
          xp: newXp,
        },
        activeSession: {
          ...state.activeSession,
          results: { ...state.activeSession.results, [wordId]: correct },
          xpEarned: state.activeSession.xpEarned + xpEarned,
        },
      };
    }

    case 'END_SESSION': {
      if (!state.activeSession) return state;

      const { completed, durationSeconds } = action.payload;
      const { gameMode, words, results, xpEarned } = state.activeSession;

      // Perfect session bonus
      const totalQuestions = words.length;
      const correctCount = Object.values(results).filter(Boolean).length;
      let totalXp = xpEarned;
      if (completed && correctCount === totalQuestions && totalQuestions > 0) {
        totalXp += XP_CONFIG.PERFECT_SESSION_BONUS;
      }

      const sessionRecord: SessionRecord = {
        id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: getTodayDate(),
        gameMode,
        wordsReviewed: words.map((w) => w.id),
        results,
        xpEarned: totalXp,
        durationSeconds,
        completed,
      };

      const finalXp = state.player.xp + (completed && correctCount === totalQuestions ? XP_CONFIG.PERFECT_SESSION_BONUS : 0);

      return {
        ...state,
        player: {
          ...state.player,
          xp: finalXp,
          totalSessionsCompleted: completed
            ? state.player.totalSessionsCompleted + 1
            : state.player.totalSessionsCompleted,
        },
        sessions: [...state.sessions, sessionRecord],
        activeSession: null,
      };
    }

    case 'UPDATE_STREAK': {
      const today = getTodayDate();
      return {
        ...state,
        player: {
          ...state.player,
          lastActiveDate: today,
        },
      };
    }

    case 'UPDATE_SETTINGS': {
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    }

    case 'RESET_ALL': {
      const fresh = createInitialState();
      return {
        ...fresh,
        words: state.words, // Preserve word data but reset progress
      };
    }

    case 'IMPORT_STATE': {
      return {
        ...action.payload,
        activeSession: null,
      };
    }

    default:
      return state;
  }
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
