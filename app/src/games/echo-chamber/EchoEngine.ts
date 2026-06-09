// ============================================================
// Echo Chamber Engine — listen to letter-by-letter spelling,
// then repeat. Loops until correct — must learn to leave.
// ============================================================
import type { GameEngine, GameWord, Question, AnswerResult, GameProgress, MasteryLevel } from '../../types';
import { XP_CONFIG } from '../../types';

export type SpellingSpeed = 'normal' | 'slow';

export class EchoChamberEngine implements GameEngine {
  private words: GameWord[] = [];
  private currentIndex = 0;
  private totalCorrect = 0;
  private totalIncorrect = 0;
  private xpEarned = 0;
  private comboCount = 0;
  private retryCount = 0; // retries for current word
  private spellingSpeed: SpellingSpeed = 'normal';

  initialize(words: GameWord[]): void {
    this.words = [...words].sort(() => Math.random() - 0.5);
    this.currentIndex = 0;
    this.totalCorrect = 0;
    this.totalIncorrect = 0;
    this.xpEarned = 0;
    this.comboCount = 0;
    this.retryCount = 0;
    this.spellingSpeed = 'normal';
  }

  getSpellingSpeed(): SpellingSpeed {
    return this.spellingSpeed;
  }

  /** Speed in ms between letters during spell-out */
  getLetterIntervalMs(): number {
    return this.spellingSpeed === 'normal' ? 400 : 800;
  }

  toggleSpellingSpeed(): SpellingSpeed {
    this.spellingSpeed = this.spellingSpeed === 'normal' ? 'slow' : 'normal';
    return this.spellingSpeed;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  nextQuestion(): Question | null {
    if (this.currentIndex >= this.words.length) return null;

    const word = this.words[this.currentIndex];
    const letters = word.word.toLowerCase().split('');
    const allLetters = [...letters].sort();

    return {
      wordId: word.id,
      type: 'spelling',
      prompt: '', // No visual prompt — pure audio
      correctAnswer: word.word.toLowerCase(),
      options: allLetters,
      phonetic: word.phonetic,
    };
  }

  /**
   * Submit answer. On failure, does NOT advance — same word repeats.
   * This is the key difference from other engines: the child must
   * spell correctly to move on.
   */
  submitAnswer(answer: string): AnswerResult {
    const word = this.words[this.currentIndex];
    if (!word) throw new Error('No active question');

    const playerAnswer = answer.toLowerCase().trim();
    const correctAnswer = word.word.toLowerCase().trim();
    const correct = playerAnswer === correctAnswer;

    if (correct) {
      this.totalCorrect++;
      this.comboCount++;

      // XP: base + combo, reduced by retries
      const comboBonus = Math.min(this.comboCount - 1, 5) * 2;
      const retryPenalty = Math.min(this.retryCount * 2, 6); // max -6 for retries
      const xp = Math.max(1, XP_CONFIG.BASE_CORRECT + comboBonus - retryPenalty);
      this.xpEarned += xp;

      const oldMastery = word.masteryLevel ?? 0;
      const newMastery = Math.min(oldMastery + 1, 5) as MasteryLevel;

      this.currentIndex++;
      this.retryCount = 0;

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
      this.retryCount++;

      // Do NOT advance currentIndex — same word repeats

      return {
        correct: false,
        correctAnswer: word.word,
        xpEarned: 0,
        newMasteryLevel: Math.max((word.masteryLevel ?? 0) - 1, 0) as MasteryLevel,
        masteryChanged: true,
      };
    }
  }

  getComboCount(): number {
    return this.comboCount;
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
