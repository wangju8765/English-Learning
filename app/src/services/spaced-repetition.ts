// ============================================================
// Spaced Repetition Algorithm — Simplified SM-2 variant
// ============================================================
import type { WordState, MasteryLevel } from '../types';
import { MASTERY_INTERVALS } from '../types';
import { getTodayDate } from './storage';

export function processAnswer(
  word: WordState,
  correct: boolean,
  gameMode: string,
  responseTimeMs: number
): WordState {
  const today = getTodayDate();
  const updated = { ...word };

  updated.totalAttempts += 1;
  if (correct) {
    updated.totalCorrect += 1;
  }

  // Update mastery level
  if (correct) {
    updated.masteryLevel = Math.min(word.masteryLevel + 1, 5) as MasteryLevel;
    updated.easeFactor = Math.min(word.easeFactor + 0.15, 2.5);
    updated.consecutiveCorrect += 1;
  } else {
    updated.masteryLevel = Math.max(word.masteryLevel - 1, 0) as MasteryLevel;
    updated.easeFactor = Math.max(word.easeFactor - 0.2, 1.3);
    updated.consecutiveCorrect = 0;
  }

  // Calculate next review date
  const interval = MASTERY_INTERVALS[updated.masteryLevel];
  if (interval === 0) {
    updated.nextReviewDate = today;
  } else {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + Math.round(interval * updated.easeFactor));
    updated.nextReviewDate = nextDate.toISOString().slice(0, 10);
  }

  // Fallback: incorrect answers always review tomorrow
  if (!correct) {
    updated.nextReviewDate = getTomorrow();
  }

  updated.lastReviewDate = today;

  // Record history
  updated.reviewHistory.push({
    date: today,
    gameMode,
    correct,
    responseTimeMs,
  });

  // Keep only last 50 review entries
  if (updated.reviewHistory.length > 50) {
    updated.reviewHistory = updated.reviewHistory.slice(-50);
  }

  // Track per-mode performance
  if (!updated.gameModePerformance[gameMode]) {
    updated.gameModePerformance[gameMode] = { attempts: 0, correct: 0 };
  }
  updated.gameModePerformance[gameMode].attempts += 1;
  if (correct) {
    updated.gameModePerformance[gameMode].correct += 1;
  }

  return updated;
}

export function selectSessionWords(
  allWords: WordState[],
  count: number
): WordState[] {
  const today = getTodayDate();

  if (allWords.length === 0) return [];

  // 1. Overdue words (highest priority)
  const overdue = allWords.filter((w) => w.nextReviewDate <= today && w.masteryLevel < 4);

  // 2. New words never reviewed
  const newWords = allWords.filter((w) => w.masteryLevel === 0 && w.totalAttempts === 0);

  // 3. Words due for review
  const dueToday = allWords.filter(
    (w) => w.nextReviewDate <= today && !overdue.includes(w) && !newWords.includes(w)
  );

  // Assemble: prioritize overdue, then new, then due
  const selected: WordState[] = [];
  const used = new Set<string>();

  function addWords(pool: WordState[], _max: number) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (const w of shuffled) {
      if (selected.length >= count) break;
      if (!used.has(w.id)) {
        selected.push(w);
        used.add(w.id);
      }
    }
  }

  // Add up to 60% from overdue
  addWords(overdue, Math.floor(count * 0.6));
  // Add up to 30% new words
  addWords(newWords, Math.floor(count * 0.3));
  // Fill remaining with due words
  addWords(dueToday, count - selected.length);
  // If still not enough, add any words
  const remaining = allWords.filter((w) => !used.has(w.id));
  addWords(remaining, count - selected.length);

  return selected;
}

export function getMasteryDistribution(words: WordState[]): Record<number, number> {
  const dist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const w of words) {
    dist[w.masteryLevel] = (dist[w.masteryLevel] || 0) + 1;
  }
  return dist;
}

export function getMasteredCount(words: WordState[]): number {
  return words.filter((w) => w.masteryLevel >= 4).length;
}

export function getAccuracy(words: WordState[]): number {
  if (words.length === 0) return 0;
  const total = words.reduce((sum, w) => sum + w.totalAttempts, 0);
  if (total === 0) return 0;
  const correct = words.reduce((sum, w) => sum + w.totalCorrect, 0);
  return Math.round((correct / total) * 100);
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
