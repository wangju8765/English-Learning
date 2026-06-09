// ============================================================
// Note Block Studio Engine — 3-stage scaffolding
// Stage 1 (Syllables):   syllable groups + vowel highlights, repeats N rounds
// Stage 2 (Copy):        full template shown, child copies → solidifies overall shape
// Stage 3 (Independent): pure audio, no visual help → real test
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
  // Stage 1 (Syllables)
  syllables?: SyllableGroup[];
  vowelIndices?: Set<number>;
  syllableRound?: number;
  totalSyllableRounds?: number;
  // Stage 2 (Copy)
  templateWord?: string;
  definition?: string;
  phonetic?: string;
}

export class NoteBlockEngine implements GameEngine {
  private words: GameWord[] = [];
  private wordIndex = 0;
  private stage: NoteBlockStage = 1;
  private syllableRound = 0;        // Current round within Stage 1 (0-indexed)
  private totalSyllableRounds = 1;  // = syllable count for current word
  private totalCorrect = 0;
  private totalIncorrect = 0;
  private xpEarned = 0;
  private comboCount = 0;
  private maxCombo = 0;

  initialize(words: GameWord[]): void {
    this.words = [...words].sort(() => Math.random() - 0.5);
    this.wordIndex = 0;
    this.stage = 1;
    this.syllableRound = 0;
    this.totalCorrect = 0;
    this.totalIncorrect = 0;
    this.xpEarned = 0;
    this.comboCount = 0;
    this.maxCombo = 0;

    // Pre-compute syllable rounds for the first word
    if (this.words.length > 0) {
      const syllables = splitSyllables(this.words[0].word);
      this.totalSyllableRounds = Math.max(1, syllables.length);
    }
  }

  getCurrentStage(): NoteBlockStage {
    return this.stage;
  }

  getCurrentWordIndex(): number {
    return this.wordIndex;
  }

  getTotalWords(): number {
    return this.words.length;
  }

  getSyllableRound(): number {
    return this.syllableRound;
  }

  getTotalSyllableRounds(): number {
    return this.totalSyllableRounds;
  }

  nextQuestion(): Question | null {
    if (this.wordIndex >= this.words.length) return null;

    const word = this.words[this.wordIndex];
    const letters = word.word.toLowerCase().split('');
    const allLetters = [...letters].sort();

    // Stage 2 (Copy) shows definition; Stage 1/3 do not
    const prompt = this.stage === 2 ? word.definition : '';
    const phonetic = this.stage === 2 ? word.phonetic : undefined;

    return {
      wordId: word.id,
      type: 'spelling',
      prompt,
      correctAnswer: word.word.toLowerCase(),
      options: allLetters,
      phonetic,
    };
  }

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
      // Syllables: show grouped syllables with vowel highlights
      base.syllables = splitSyllables(word.word);
      base.vowelIndices = getVowelIndices(word.word);
      base.syllableRound = this.syllableRound;
      base.totalSyllableRounds = this.totalSyllableRounds;
    } else if (this.stage === 2) {
      // Copy: show full template word + definition
      base.templateWord = word.word;
      base.definition = word.definition;
      base.phonetic = word.phonetic;
    }
    // Stage 3: nothing extra

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
      // Stage 2 (Copy) gives reduced XP since it's guided
      // Stage 1 (Syllables) gives full XP for repeated practice
      const baseXp = this.stage === 2 ? 3 : XP_CONFIG.BASE_CORRECT;
      const xp = baseXp + comboBonus;
      this.xpEarned += xp;

      const masteryDelta = this.stage === 2 ? 0.5 : 1;
      const newMastery = Math.min(oldMastery + masteryDelta, 5) as MasteryLevel;

      this.advance();

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

      this.advance();

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
   * Advance within the 3-stage cycle:
   * Stage 1 (Syllables): syllableRound++ → if all rounds done → stage=2
   * Stage 2 (Copy):      → stage=3
   * Stage 3 (Independent): → next word, stage=1, reset syllable counter
   */
  private advance(): void {
    if (this.stage === 1) {
      this.syllableRound++;
      if (this.syllableRound >= this.totalSyllableRounds) {
        this.stage = 2;
        this.syllableRound = 0;
      }
    } else if (this.stage === 2) {
      this.stage = 3;
    } else {
      // Stage 3 → next word
      this.stage = 1;
      this.syllableRound = 0;
      this.wordIndex++;

      // Pre-compute syllable rounds for next word
      if (this.wordIndex < this.words.length) {
        const syllables = splitSyllables(this.words[this.wordIndex].word);
        this.totalSyllableRounds = Math.max(1, syllables.length);
      }
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
      currentQuestion: this.wordIndex,
      totalQuestions: this.words.length,
      correctCount: this.totalCorrect,
      incorrectCount: this.totalIncorrect,
      xpEarned: this.xpEarned,
      isComplete: this.isComplete(),
    };
  }

  isComplete(): boolean {
    return this.wordIndex >= this.words.length;
  }

  getCurrentWord(): GameWord | null {
    if (this.wordIndex < this.words.length) {
      return this.words[this.wordIndex];
    }
    return null;
  }
}
