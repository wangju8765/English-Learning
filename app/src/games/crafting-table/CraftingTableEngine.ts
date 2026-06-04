// ============================================================
// Crafting Table Game Engine — click letters to spell words
// ============================================================
import type { GameEngine, GameWord, Question, AnswerResult, GameProgress, MasteryLevel } from '../../types';
import { XP_CONFIG } from '../../types';

// Common English letters used as distractors
const DISTRACTOR_POOL = 'eariotnslcudpmhgbfywkvxzjq'.split('');
const EXTRA_LETTER_COUNT = 3;

export class CraftingTableEngine implements GameEngine {
  private words: GameWord[] = [];
  private currentIndex = 0;
  private totalCorrect = 0;
  private totalIncorrect = 0;
  private xpEarned = 0;

  initialize(words: GameWord[]): void {
    this.words = [...words].sort(() => Math.random() - 0.5);
    this.currentIndex = 0;
    this.totalCorrect = 0;
    this.totalIncorrect = 0;
    this.xpEarned = 0;
  }

  nextQuestion(): Question | null {
    if (this.currentIndex >= this.words.length) return null;

    const word = this.words[this.currentIndex];
    const letters = word.word.toLowerCase().split('');

    // Generate extra distractor letters not in the target word
    const usedLetters = new Set(letters);
    const distractors: string[] = [];
    const shuffledPool = [...DISTRACTOR_POOL].sort(() => Math.random() - 0.5);
    for (const ch of shuffledPool) {
      if (distractors.length >= EXTRA_LETTER_COUNT) break;
      if (!usedLetters.has(ch)) {
        distractors.push(ch);
        usedLetters.add(ch); // don't repeat the same distractor
      }
    }

    // Combine and sort alphabetically for easy scanning
    const allLetters = [...letters, ...distractors].sort();

    return {
      wordId: word.id,
      type: 'spelling',
      prompt: word.definition,
      correctAnswer: word.word.toLowerCase(),
      options: allLetters, // repurpose as letter pool
      phonetic: word.phonetic,
    };
  }

  submitAnswer(answer: string): AnswerResult {
    const word = this.words[this.currentIndex];
    if (!word) throw new Error('No active question');

    const playerAnswer = answer.toLowerCase().trim();
    const correctAnswer = word.word.toLowerCase().trim();
    const correct = playerAnswer === correctAnswer;

    if (correct) {
      this.totalCorrect++;
      const xp = XP_CONFIG.BASE_CORRECT;
      this.xpEarned += xp;

      const oldMastery = word.masteryLevel ?? 0;
      const newMastery = Math.min(oldMastery + 1, 5) as MasteryLevel;

      this.currentIndex++;

      return {
        correct: true,
        correctAnswer: word.word,
        xpEarned: xp,
        newMasteryLevel: newMastery,
        masteryChanged: newMastery !== oldMastery,
      };
    } else {
      this.totalIncorrect++;
      this.xpEarned += 0;

      // Keep same word for retry, or move on
      this.currentIndex++;

      return {
        correct: false,
        correctAnswer: word.word,
        xpEarned: 0,
        newMasteryLevel: Math.max(word.masteryLevel - 1, 0) as MasteryLevel,
        masteryChanged: true,
      };
    }
  }

  getProgress(): GameProgress {
    return {
      currentQuestion: this.currentIndex,
      totalQuestions: this.words.length,
      correctCount: this.totalCorrect,
      incorrectCount: this.totalIncorrect,
      xpEarned: this.xpEarned,
      isComplete: this.isComplete(),
    };
  }

  isComplete(): boolean {
    return this.currentIndex >= this.words.length;
  }

  getCurrentWord(): GameWord | null {
    if (this.currentIndex < this.words.length) {
      return this.words[this.currentIndex];
    }
    return null;
  }
}
