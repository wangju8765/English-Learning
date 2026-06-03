// ============================================================
// English Craft — TypeScript Type Definitions
// ============================================================

// --- Vocabulary Content (from parsed markdown) ---

export interface ExampleSentence {
  english: string;
  chinese: string;
}

export interface VocabularyEntry {
  id: string; // normalized: word.toLowerCase().trim().replace(/\s+/g, '-')
  word: string; // display form, preserves case like "Mac"
  variants?: string[]; // alternate forms, e.g. ["Macintosh"]
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  definitionDetail?: string[];
  exampleSentences: ExampleSentence[];
  parentNotes?: string;
  sourceDate: string; // "YYYY-MM-DD" from which daily file
}

export interface VocabularyManifest {
  version: number;
  contentHash: string;
  generatedAt: string; // ISO timestamp
  entries: VocabularyEntry[];
}

// --- Spaced Repetition ---

export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const MASTERY_NAMES: Record<MasteryLevel, string> = {
  0: 'Stone',
  1: 'Coal',
  2: 'Iron',
  3: 'Gold',
  4: 'Diamond',
  5: 'Netherite',
};

export const MASTERY_INTERVALS: Record<MasteryLevel, number> = {
  0: 0, // same day
  1: 1, // 1 day
  2: 2, // 2 days
  3: 3, // 3 days
  4: 5, // 5 days
  5: 7, // 7 days
};

export interface ReviewEntry {
  date: string; // "YYYY-MM-DD"
  gameMode: string;
  correct: boolean;
  responseTimeMs: number;
}

export interface GameModePerformance {
  attempts: number;
  correct: number;
}

export interface WordState {
  id: string;
  word: string;
  variants?: string[];
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  definitionDetail?: string[];
  exampleSentences: ExampleSentence[];
  parentNotes?: string;
  sourceDate: string;

  // Spaced repetition
  masteryLevel: MasteryLevel;
  easeFactor: number; // 1.3 - 2.5
  nextReviewDate: string; // "YYYY-MM-DD"
  lastReviewDate: string; // "YYYY-MM-DD"
  consecutiveCorrect: number;
  totalAttempts: number;
  totalCorrect: number;

  // Metadata
  firstSeenDate: string;
  reviewHistory: ReviewEntry[];
  gameModePerformance: Record<string, GameModePerformance>;
}

// --- Game Modes ---

export type GameModeId =
  | 'diamond_mine'
  | 'crafting_table'
  | 'ender_pearl'
  | 'redstone_quiz'
  | 'nether_portal';

export interface GameModeMeta {
  id: GameModeId;
  name: string;
  nameZh: string;
  description: string;
  icon: string; // emoji or icon identifier
  difficulty: 1 | 2 | 3;
  unlocked: boolean; // some modes unlock over time
  unlockDay?: number; // day of batch when it unlocks
}

export const GAME_MODES: GameModeMeta[] = [
  {
    id: 'diamond_mine',
    name: 'Diamond Mine',
    nameZh: '钻石矿工',
    description: 'Click the correct English word for the Chinese meaning',
    icon: '⛏️',
    difficulty: 1,
    unlocked: true,
  },
  {
    id: 'crafting_table',
    name: 'Crafting Table',
    nameZh: '工作台',
    description: 'Arrange letter blocks to spell the word correctly',
    icon: '🛠️',
    difficulty: 2,
    unlocked: true,
  },
  {
    id: 'ender_pearl',
    name: 'Ender Pearl Challenge',
    nameZh: '末影珍珠挑战',
    description: 'Type the English word before the Ender Dragon flies away',
    icon: '🎯',
    difficulty: 3,
    unlocked: true,
  },
  {
    id: 'redstone_quiz',
    name: 'Redstone Quiz',
    nameZh: '红石问答',
    description: 'Choose the right word to complete the sentence',
    icon: '🔴',
    difficulty: 2,
    unlocked: true,
  },
  {
    id: 'nether_portal',
    name: 'Nether Portal Escape',
    nameZh: '下界传送门逃脱',
    description: 'Boss level — prove you have mastered this week\'s words!',
    icon: '🌑',
    difficulty: 3,
    unlocked: false,
    unlockDay: 6,
  },
];

// --- Game Engine ---

export interface GameWord extends WordState {
  // Additional runtime fields for game sessions
}

export interface Question {
  wordId: string;
  type: 'multiple_choice' | 'spelling' | 'typing' | 'sentence';
  prompt: string; // What to show the player (Chinese definition, sentence with blank, etc.)
  correctAnswer: string;
  options?: string[]; // For multiple choice
  phonetic?: string;
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  xpEarned: number;
  newMasteryLevel: MasteryLevel;
  masteryChanged: boolean;
}

export interface GameProgress {
  currentQuestion: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  xpEarned: number;
  isComplete: boolean;
}

export interface GameEngine {
  initialize(words: GameWord[]): void;
  nextQuestion(): Question | null;
  submitAnswer(answer: string): AnswerResult;
  getProgress(): GameProgress;
  isComplete(): boolean;
}

// --- Player & State ---

export interface PlayerState {
  name: string;
  xp: number;
  streakDays: number;
  lastActiveDate: string; // "YYYY-MM-DD"
  totalSessionsCompleted: number;
  totalWordsEncountered: number;
  achievements: string[];
}

export interface SessionRecord {
  id: string;
  date: string;
  gameMode: GameModeId;
  wordsReviewed: string[];
  results: Record<string, boolean>;
  xpEarned: number;
  durationSeconds: number;
  completed: boolean;
}

export interface AppSettings {
  soundEnabled: boolean;
  speechEnabled: boolean;
  speechRate: number; // 0.5 - 2.0, default 0.85
  dailyWordTarget: number; // default 12
}

export interface MetaState {
  lastVocabularyHash: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}

export interface PersistedState {
  version: number;
  player: PlayerState;
  words: Record<string, WordState>;
  sessions: SessionRecord[];
  settings: AppSettings;
  meta: MetaState;
}

// --- XP System ---

export const XP_CONFIG = {
  BASE_CORRECT: 10,
  PERFECT_SESSION_BONUS: 25,
  DAILY_QUEST_BONUS: 50,
  STREAK_BONUS_PER_DAY: 5,
  STREAK_BONUS_CAP: 25,
  LEVEL_UP_WORD_BONUS: 30,
} as const;

export function getLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100));
}

export function xpToNextLevel(xp: number): number {
  const currentLevel = getLevel(xp);
  return (currentLevel + 1) ** 2 * 100 - xp;
}
