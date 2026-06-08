// ============================================================
// Ender Pearl Challenge Engine — timed typing game
// ============================================================
import type { GameEngine, GameWord, Question, AnswerResult, GameProgress, MasteryLevel } from '../../types';
import { XP_CONFIG } from '../../types';

export class EnderPearlEngine implements GameEngine {
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

  nextQuestion(): Question | null {
    if (this.currentIndex >= this.words.length) return null;

    const word = this.words[this.currentIndex];
    return {
      wordId: word.id,
      type: 'typing',
      prompt: word.definition,
      correctAnswer: word.word.toLowerCase(),
      phonetic: word.phonetic,
    };
  }

  submitAnswer(answer: string, timeRatio?: number): AnswerResult {
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

      // Speed bonus based on time remaining
      let speedBonus = 0;
      if (timeRatio !== undefined) {
        if (timeRatio >= 2 / 3) speedBonus = 5;      // Answered in first 1/3 of time
        else if (timeRatio >= 1 / 3) speedBonus = 3; // Answered in second 1/3
        else speedBonus = 1;                          // Answered in last 1/3
      }

      // Combo bonus
      const comboBonus = Math.min(this.comboCount - 1, 5) * 2;

      const xp = XP_CONFIG.BASE_CORRECT + speedBonus + comboBonus;
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

  /** Get time limit in seconds for the current word, based on word length */
  getTimeLimit(): number {
    const word = this.words[this.currentIndex];
    if (!word) return 8;
    return Math.max(6, Math.ceil(word.word.length * 1.5));
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
