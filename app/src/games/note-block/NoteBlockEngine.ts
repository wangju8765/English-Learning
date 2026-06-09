// ============================================================
// Note Block Studio Engine — 3-stage scaffolding
// Stage 1 (Copy):     full template shown, child copies → builds sound-letter link
// Stage 2 (Assisted): syllable groups + vowel highlights → learns syllable→letter mapping
// Stage 3 (Independent): pure audio, no visual help → tests real listening→spelling
// ============================================================
import type { GameEngine, GameWord, Question, AnswerResult, GameProgress, MasteryLevel } from '../../types';
import { XP_CONFIG } from '../../types';
import { splitSyllables, getVowelIndices, type SyllableGroup } from '../../utils/syllables';

export type NoteBlockStage = 1 | 2 | 3;

export interface StageQuestion {
  wordId: string;
  correctAnswer: string;
  letters: string[];
  stage: NoteBlockStage;
  // Stage 1
  templateWord?: string;
  definition?: string;
  phonetic?: string;
  // Stage 2
  syllables?: SyllableGroup[];
  vowelIndices?: Set<number>;
}

export class NoteBlockEngine implements GameEngine {
  private words: GameWord[] = [];
  private wordIndex = 0;
  private stage: NoteBlockStage = 1;
  private totalCorrect = 0;
  private totalIncorrect = 0;
  private xpEarned = 0;
  private comboCount = 0;
  private maxCombo = 0;

  initialize(words: GameWord[]): void {
    this.words = [...words].sort(() => Math.random() - 0.5);
    this.wordIndex = 0;
    this.stage = 1;
    this.totalCorrect = 0;
    this.totalIncorrect = 0;
    this.xpEarned = 0;
    this.comboCount = 0;
    this.maxCombo = 0;
  }

  getCurrentStage(): NoteBlockStage {
    return this.stage;
  }

  getCurrentWordIndex(): number {
    return this.wordIndex;
  }

  /** Number of words in this session */
  getTotalWords(): number {
    return this.words.length;
  }

  nextQuestion(): Question | null {
    if (this.wordIndex >= this.words.length) return null;

    const word = this.words[this.wordIndex];
    const letters = word.word.toLowerCase().split('');
    const allLetters = [...letters].sort();
    const stage = this.stage;

    const promptMap: Record<NoteBlockStage, string> = {
      1: word.definition,   // Stage 1: show definition as prompt
      2: '',                // Stage 2: syllables shown in UI, not via prompt
      3: '',                // Stage 3: nothing
    };

    const phoneticMap: Record<NoteBlockStage, string | undefined> = {
      1: word.phonetic,
      2: undefined,
      3: undefined,
    };

    return {
      wordId: word.id,
      type: 'spelling',
      prompt: promptMap[stage],
      correctAnswer: word.word.toLowerCase(),
      options: allLetters,
      phonetic: phoneticMap[stage],
    };
  }

  /** Get enriched question data including stage-specific fields */
  getStageQuestion(): StageQuestion | null {
    if (this.wordIndex >= this.words.length) return null;

    const word = this.words[this.wordIndex];
    const letters = word.word.toLowerCase().split('');
    const allLetters = [...letters].sort();

    const base: StageQuestion = {
      wordId: word.id,
      correctAnswer: word.word.toLowerCase(),
      letters: allLetters,
      stage: this.stage,
    };

    if (this.stage === 1) {
      base.templateWord = word.word;
      base.definition = word.definition;
      base.phonetic = word.phonetic;
    } else if (this.stage === 2) {
      base.syllables = splitSyllables(word.word);
      base.vowelIndices = getVowelIndices(word.word);
    }

    return base;
  }

  submitAnswer(answer: string): AnswerResult {
    const word = this.words[this.wordIndex];
    if (!word) throw new Error('No active question');

    const playerAnswer = answer.toLowerCase().trim();
    const correctAnswer = word.word.toLowerCase().trim();
    const correct = playerAnswer === correctAnswer;
    const oldMastery = word.masteryLevel ?? 0;

    if (correct) {
      this.totalCorrect++;
      this.comboCount++;
      if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

      const comboBonus = Math.min(this.comboCount - 1, 5) * 2;
      // Stage 1 gives reduced XP (it's guided copying)
      const baseXp = this.stage === 1 ? 3 : XP_CONFIG.BASE_CORRECT;
      const xp = baseXp + comboBonus;
      this.xpEarned += xp;

      const masteryDelta = this.stage === 1 ? 0.5 : 1; // Stage 1 gives half mastery progress
      const newMastery = Math.min(oldMastery + masteryDelta, 5) as MasteryLevel;

      this.advanceStage();

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

      this.advanceStage(); // Still advance — don't get stuck

      return {
        correct: false,
        correctAnswer: word.word,
        xpEarned: 0,
        newMasteryLevel: Math.max(oldMastery - 1, 0) as MasteryLevel,
        masteryChanged: true,
      };
    }
  }

  /**
   * Advance stage or word index:
   * Stage 1 → Stage 2 (same word)
   * Stage 2 → Stage 3 (same word)
   * Stage 3 → Stage 1 (next word)
   */
  private advanceStage(): void {
    if (this.stage < 3) {
      this.stage = (this.stage + 1) as NoteBlockStage;
    } else {
      this.stage = 1;
      this.wordIndex++;
    }
  }

  getComboCount(): number {
    return this.comboCount;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  getProgress(): GameProgress {
    // Total questions = words × 3 stages, but simplified as words count
    return {
      currentQuestion: this.wordIndex,
      totalQuestions: this.words.length,
      correctCount: this.totalCorrect,
      incorrectCount: this.totalIncorrect,
      xpEarned: this.xpEarned,
      isComplete: this.isComplete(),
    };
  }

  isComplete(): boolean {
    return this.wordIndex >= this.words.length && this.stage === 1;
  }

  getCurrentWord(): GameWord | null {
    if (this.wordIndex < this.words.length) {
      return this.words[this.wordIndex];
    }
    return null;
  }
}
