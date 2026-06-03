// ============================================================
// Global App Context — State provider and hooks
// ============================================================
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { WordState, GameModeId, PersistedState } from '../types';
import { appReducer, createInitialState, type AppState, type AppAction } from './reducer';
import { loadState, saveState } from '../services/storage';
import type { VocabularyManifest } from '../types';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Convenience methods
  initializeApp: () => Promise<void>;
  mergeVocabulary: (manifest: VocabularyManifest) => void;
  startGameSession: (gameMode: GameModeId, words: WordState[]) => void;
  submitGameAnswer: (wordId: string, correct: boolean, gameMode: GameModeId, responseTimeMs: number) => void;
  endGameSession: (completed: boolean, durationSeconds: number) => void;
  exportAppState: () => string;
  importAppState: (json: string) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, null, createInitialState);

  // Save state to storage whenever it changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const { activeSession, ...persisted } = state;
      saveState(persisted as PersistedState);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [state]);

  const initializeApp = useCallback(async () => {
    const saved = await loadState();
    dispatch({ type: 'INITIALIZE_STATE', payload: saved });
  }, []);

  const mergeVocabulary = useCallback((manifest: VocabularyManifest) => {
    // Only merge if vocabulary has changed
    if (manifest.contentHash === state.meta.lastVocabularyHash) return;
    dispatch({ type: 'MERGE_VOCABULARY', payload: manifest.entries });
    dispatch({
      type: 'UPDATE_SETTINGS',
      payload: {
        lastVocabularyHash: manifest.contentHash,
      } as any,
    });
  }, [state.meta.lastVocabularyHash]);

  const startGameSession = useCallback((gameMode: GameModeId, words: WordState[]) => {
    dispatch({ type: 'START_SESSION', payload: { gameMode, words } });
  }, []);

  const submitGameAnswer = useCallback(
    (wordId: string, correct: boolean, gameMode: GameModeId, responseTimeMs: number) => {
      dispatch({
        type: 'SUBMIT_ANSWER',
        payload: { wordId, correct, gameMode, responseTimeMs },
      });
    },
    []
  );

  const endGameSession = useCallback((completed: boolean, durationSeconds: number) => {
    dispatch({ type: 'END_SESSION', payload: { completed, durationSeconds } });
  }, []);

  const exportAppState = useCallback(() => {
    const { activeSession, ...persisted } = state;
    return JSON.stringify(persisted, null, 2);
  }, [state]);

  const importAppState = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as PersistedState;
      if (!parsed.version || !parsed.player || !parsed.words) {
        throw new Error('Invalid state format');
      }
      dispatch({ type: 'IMPORT_STATE', payload: parsed });
      return true;
    } catch {
      return false;
    }
  }, []);

  const value: AppContextValue = {
    state,
    dispatch,
    initializeApp,
    mergeVocabulary,
    startGameSession,
    submitGameAnswer,
    endGameSession,
    exportAppState,
    importAppState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
