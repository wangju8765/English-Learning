// ============================================================
// Note Block Studio Engine — listen & spell (audio → spelling)
// ============================================================
import type { GameEngine, GameWord, Question, AnswerResult, GameProgress, MasteryLevel } from '../../types';
import { XP_CONFIG } from '../../types';

export type NoteBlockTier = 'green' | 'orange';

export class NoteBlockEngine implements GameEngine {
  private words: GameWord[] = [];
  private currentIndex = 0;
  private totalCorrect = 0;
  private totalIncorrect = 0;
  private xpEarned = 0;
  private comboCount = 0;
  private maxCombo = 0;

  initialize(words: GameWord[]): void {
    this.words = [...words].sort(() => Math.random() - 0.5);
    this.currentIndex = 0;
    this.totalCorrect = 0;
    this.totalIncorrect = 0;
    this.xpEarned = 0;
    this.comboCount = 0;
    this.maxCombo = 0;
  }

  /** Green tier for the first 2 words (warm-up with definition), orange after (audio only) */
  getCurrentTier(): NoteBlockTier {
    return this.currentIndex < 2 ? 'green' : 'orange';
  }

  nextQuestion(): Question | null {
    if (this.currentIndex >= this.words.length) return null;

    const word = this.words[this.currentIndex];
    const letters = word.word.toLowerCase().split('');

    // No distractors — just the word's own letters, sorted alphabetically
    const allLetters = [...letters].sort();

    const tier = this.getCurrentTier();

    return {
      wordId: word.id,
      type: 'spelling',
      prompt: tier === 'green' ? word.definition : '', // No definition in orange tier
      correctAnswer: word.word.toLowerCase(),
      options: allLetters,
      phonetic: tier === 'green' ? word.phonetic : undefined, // No phonetic in orange tier
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
      this.comboCount++;
      if (this.comboCount > this.maxCombo) {
        this.maxCombo = this.comboCount;
      }

      const comboBonus = Math.min(this.comboCount - 1, 5) * 2;
      const xp = XP_CONFIG.BASE_CORRECT + comboBonus;
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
      this.comboCount = 0;
      this.xpEarned += 0;

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

  getComboCount(): number {
    return this.comboCount;
  }

  getMaxCombo(): number {
    return this.maxCombo;
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
