// ============================================================
// Nether Portal Escape Engine — 3-phase boss battle
// Phase 1 (OBSIDIAN): multiple-choice word recognition (4 questions)
// Phase 2 (FRAME):    timed spelling with distractors (5 questions, 3 strikes)
// Phase 3 (IGNITE):   mixed question types with energy bar (up to 10 questions)
// ============================================================
import type { GameEngine, GameWord, Question, AnswerResult, GameProgress, MasteryLevel } from '../../types';
import { XP_CONFIG } from '../../types';

// --- Phase types ---

export type PortalPhase = 1 | 2 | 3;

export type Phase3QuestionType = 'listen_spell' | 'definition_spell' | 'sentence_fill';

export interface PhaseProgress {
  current: number;
  total: number;
  phase: PortalPhase;
}

export interface Phase3QuestionData {
  questionType: Phase3QuestionType;
  word: GameWord;
  /** For sentence_fill: the sentence with blank + options + translation */
  sentenceData?: {
    english: string;
    chinese: string;
    sentenceWithBlank: string;
    inflectedForm: string;
    options: string[];
  };
}

// --- Constants ---

const PHASE1_COUNT = 4;
const PHASE2_COUNT = 5;
const PHASE3_MAX = 10;
const PHASE2_MAX_STRIKES = 3;
const PHASE3_INITIAL_ENERGY = 50;
const PHASE3_ENERGY_CORRECT = 15;
const PHASE3_ENERGY_WRONG = -5;
const PHASE3_ENERGY_DECAY = -1;
const PHASE3_WIN_THRESHOLD = 100;
const EXTRA_LETTER_COUNT = 2;

const DISTRACTOR_POOL = 'eariotnslcudpmhgbfywkvxzjq'.split('');

// XP rewards
const PHASE1_CLEAR_XP = 20;
const PHASE2_CLEAR_XP = 30;
const PORTAL_ACTIVATED_XP = 50;

export class NetherPortalEngine implements GameEngine {
  private allWords: GameWord[] = [];
  private phase1Words: GameWord[] = [];
  private phase2Words: GameWord[] = [];
  private phase3Words: GameWord[] = [];

  private phase: PortalPhase = 1;

  // Phase 1 state
  private phase1Index = 0;
  private phase1Questions: Phase1Q[] = [];

  // Phase 2 state
  private phase2Index = 0;
  private phase2Strikes = 0;

  // Phase 3 state
  private phase3Index = 0;
  private energy = PHASE3_INITIAL_ENERGY;
  private phase3Questions: Phase3QuestionData[] = [];

  // Global stats
  private totalCorrect = 0;
  private totalIncorrect = 0;
  private xpEarned = 0;
  private comboCount = 0;
  private maxCombo = 0;
  private portalActivated = false;
  private gameOver = false;

  initialize(words: GameWord[]): void {
    this.allWords = [...words].sort(() => Math.random() - 0.5);

    // Distribute words across phases
    const shuffled = [...this.allWords];
    this.phase1Words = shuffled.slice(0, Math.min(PHASE1_COUNT, shuffled.length));
    this.phase2Words = shuffled.slice(0, Math.min(PHASE2_COUNT, shuffled.length));
    this.phase3Words = shuffled; // All words available for phase 3

    // Reset state
    this.phase = 1;
    this.phase1Index = 0;
    this.phase2Index = 0;
    this.phase2Strikes = 0;
    this.phase3Index = 0;
    this.energy = PHASE3_INITIAL_ENERGY;
    this.totalCorrect = 0;
    this.totalIncorrect = 0;
    this.xpEarned = 0;
    this.comboCount = 0;
    this.maxCombo = 0;
    this.portalActivated = false;
    this.gameOver = false;

    // Generate Phase 1 questions
    this.phase1Questions = this.generatePhase1Questions(this.phase1Words, shuffled);

    // Generate Phase 3 questions
    this.phase3Questions = this.generatePhase3Questions(this.phase3Words);
  }

  // --- Public accessors ---

  getPhase(): PortalPhase {
    return this.phase;
  }

  getEnergy(): number {
    return this.energy;
  }

  getPhaseProgress(): PhaseProgress {
    switch (this.phase) {
      case 1:
        return { current: this.phase1Index, total: this.phase1Questions.length, phase: 1 };
      case 2:
        return { current: this.phase2Index, total: PHASE2_COUNT, phase: 2 };
      case 3:
        return { current: this.phase3Index, total: PHASE3_MAX, phase: 3 };
    }
  }

  getPhase2Strikes(): number {
    return this.phase2Strikes;
  }

  getPhase2MaxStrikes(): number {
    return PHASE2_MAX_STRIKES;
  }

  getPhase3QuestionData(): Phase3QuestionData | null {
    if (this.phase !== 3 || this.phase3Index >= this.phase3Questions.length) return null;
    return this.phase3Questions[this.phase3Index];
  }

  isPortalActivated(): boolean {
    return this.portalActivated;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  getComboCount(): number {
    return this.comboCount;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  // --- GameEngine interface ---

  nextQuestion(): Question | null {
    if (this.gameOver || this.portalActivated) return null;

    switch (this.phase) {
      case 1:
        return this.nextPhase1Question();
      case 2:
        return this.nextPhase2Question();
      case 3:
        return this.nextPhase3Question();
    }
  }

  submitAnswer(answer: string, timeRatio?: number): AnswerResult {
    switch (this.phase) {
      case 1:
        return this.submitPhase1Answer(answer);
      case 2:
        return this.submitPhase2Answer(answer, timeRatio);
      case 3:
        return this.submitPhase3Answer(answer);
    }
  }

  getProgress(): GameProgress {
    const totalQ =
      this.phase1Questions.length + PHASE2_COUNT + PHASE3_MAX;
    const currentQ =
      (this.phase === 1 ? this.phase1Index :
       this.phase === 2 ? this.phase1Questions.length + this.phase2Index :
       this.phase1Questions.length + PHASE2_COUNT + this.phase3Index);

    return {
      currentQuestion: currentQ,
      totalQuestions: totalQ,
      correctCount: this.totalCorrect,
      incorrectCount: this.totalIncorrect,
      xpEarned: this.xpEarned,
      isComplete: this.isComplete(),
    };
  }

  isComplete(): boolean {
    return this.gameOver || this.portalActivated;
  }

  // --- Phase 1: Multiple Choice ---

  private nextPhase1Question(): Question | null {
    if (this.phase1Index >= this.phase1Questions.length) return null;

    const q = this.phase1Questions[this.phase1Index];
    return {
      wordId: q.wordId,
      type: 'multiple_choice',
      prompt: q.definition,
      correctAnswer: q.correctAnswer,
      options: q.options,
      phonetic: q.phonetic,
    };
  }

  private submitPhase1Answer(answer: string): AnswerResult {
    const q = this.phase1Questions[this.phase1Index];
    if (!q) throw new Error('No active Phase 1 question');

    const correct = answer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
    const word = this.allWords.find((w) => w.id === q.wordId);

    if (correct) {
      this.totalCorrect++;
      this.comboCount++;
      if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

      const comboBonus = Math.min(this.comboCount - 1, 5) * 2;
      const xp = XP_CONFIG.BASE_CORRECT + comboBonus;
      this.xpEarned += xp;

      this.phase1Index++;

      // Check if Phase 1 complete
      if (this.phase1Index >= this.phase1Questions.length) {
        this.xpEarned += PHASE1_CLEAR_XP;
        this.advanceToPhase2();
      }

      const oldMastery = word?.masteryLevel ?? 0;
      return {
        correct: true,
        correctAnswer: q.correctAnswer,
        xpEarned: xp,
        newMasteryLevel: Math.min(oldMastery + 1, 5) as MasteryLevel,
        masteryChanged: true,
      };
    } else {
      this.totalIncorrect++;
      this.comboCount = 0;

      this.phase1Index++;

      if (this.phase1Index >= this.phase1Questions.length) {
        this.xpEarned += PHASE1_CLEAR_XP; // Still get the phase clear bonus
        this.advanceToPhase2();
      }

      const oldMastery = word?.masteryLevel ?? 0;
      return {
        correct: false,
        correctAnswer: q.correctAnswer,
        xpEarned: 0,
        newMasteryLevel: Math.max(oldMastery - 1, 0) as MasteryLevel,
        masteryChanged: true,
      };
    }
  }

  private advanceToPhase2(): void {
    this.phase = 2;
    this.comboCount = 0;
  }

  // --- Phase 2: Timed Spelling ---

  private nextPhase2Question(): Question | null {
    if (this.phase2Index >= PHASE2_COUNT) return null;

    const word = this.getPhase2Word();
    const letters = word.word.toLowerCase().split('');

    // Generate distractors
    const usedLetters = new Set(letters);
    const distractors: string[] = [];
    const shuffledPool = [...DISTRACTOR_POOL].sort(() => Math.random() - 0.5);
    for (const ch of shuffledPool) {
      if (distractors.length >= EXTRA_LETTER_COUNT) break;
      if (!usedLetters.has(ch)) {
        distractors.push(ch);
        usedLetters.add(ch);
      }
    }

    const allLetters = [...letters, ...distractors].sort();

    return {
      wordId: word.id,
      type: 'typing',
      prompt: word.definition,
      correctAnswer: word.word.toLowerCase(),
      options: allLetters,
      phonetic: word.phonetic,
    };
  }

  private submitPhase2Answer(answer: string, timeRatio?: number): AnswerResult {
    const word = this.getPhase2Word();
    const playerAnswer = answer.toLowerCase().trim();
    const correctAnswer = word.word.toLowerCase().trim();
    const correct = playerAnswer === correctAnswer;

    if (correct) {
      this.totalCorrect++;
      this.comboCount++;
      if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

      // Speed bonus
      let speedBonus = 0;
      if (timeRatio !== undefined) {
        if (timeRatio >= 2 / 3) speedBonus = 5;
        else if (timeRatio >= 1 / 3) speedBonus = 3;
        else speedBonus = 1;
      }

      const comboBonus = Math.min(this.comboCount - 1, 5) * 2;
      const xp = XP_CONFIG.BASE_CORRECT + speedBonus + comboBonus;
      this.xpEarned += xp;

      this.phase2Index++;

      if (this.phase2Index >= PHASE2_COUNT) {
        this.xpEarned += PHASE2_CLEAR_XP;
        this.advanceToPhase3();
      }

      const oldMastery = word.masteryLevel ?? 0;
      return {
        correct: true,
        correctAnswer: word.word,
        xpEarned: xp,
        newMasteryLevel: Math.min(oldMastery + 1, 5) as MasteryLevel,
        masteryChanged: true,
      };
    } else {
      this.totalIncorrect++;
      this.comboCount = 0;
      this.phase2Strikes++;
      this.phase2Index++;

      // Check if game over
      if (this.phase2Strikes >= PHASE2_MAX_STRIKES || this.phase2Index >= PHASE2_COUNT) {
        if (this.phase2Strikes >= PHASE2_MAX_STRIKES) {
          this.gameOver = true;
        } else {
          // Completed all questions with some strikes
          this.xpEarned += PHASE2_CLEAR_XP;
          this.advanceToPhase3();
        }
      }

      return {
        correct: false,
        correctAnswer: word.word,
        xpEarned: 0,
        newMasteryLevel: Math.max(word.masteryLevel - 1, 0) as MasteryLevel,
        masteryChanged: true,
      };
    }
  }

  private advanceToPhase3(): void {
    this.phase = 3;
    this.comboCount = 0;
  }

  getTimeLimit(): number {
    const word = this.getPhase2Word();
    return Math.max(10, Math.ceil(word.word.length * 3));
  }

  private getPhase2Word(): GameWord {
    // Cycle through available words if not enough
    return this.phase2Words[this.phase2Index % this.phase2Words.length];
  }

  // --- Phase 3: Energy Bar Mixed Mode ---

  private nextPhase3Question(): Question | null {
    if (this.phase3Index >= this.phase3Questions.length) {
      // Out of questions before reaching 100% or 0% — game over (portal fades)
      this.gameOver = true;
      return null;
    }

    const q = this.phase3Questions[this.phase3Index];

    switch (q.questionType) {
      case 'listen_spell':
      case 'definition_spell': {
        const letters = q.word.word.toLowerCase().split('');
        const usedLetters = new Set(letters);
        const distractors: string[] = [];
        const shuffledPool = [...DISTRACTOR_POOL].sort(() => Math.random() - 0.5);
        for (const ch of shuffledPool) {
          if (distractors.length >= EXTRA_LETTER_COUNT) break;
          if (!usedLetters.has(ch)) {
            distractors.push(ch);
            usedLetters.add(ch);
          }
        }
        const allLetters = [...letters, ...distractors].sort();

        return {
          wordId: q.word.id + '_p3_' + this.phase3Index,
          type: 'spelling',
          prompt: q.questionType === 'definition_spell' ? q.word.definition : '',
          correctAnswer: q.word.word.toLowerCase(),
          options: allLetters,
          phonetic: q.word.phonetic,
        };
      }
      case 'sentence_fill': {
        if (!q.sentenceData) return null;
        return {
          wordId: q.word.id + '_p3_' + this.phase3Index,
          type: 'multiple_choice',
          prompt: q.sentenceData.sentenceWithBlank,
          correctAnswer: q.sentenceData.inflectedForm,
          options: q.sentenceData.options,
          phonetic: q.word.phonetic,
        };
      }
    }
  }

  private submitPhase3Answer(answer: string): AnswerResult {
    const q = this.phase3Questions[this.phase3Index];
    if (!q) throw new Error('No active Phase 3 question');

    let correct = false;
    let correctAnswer = q.word.word;

    if (q.questionType === 'sentence_fill' && q.sentenceData) {
      correct = answer.toLowerCase().trim() === q.sentenceData.inflectedForm.toLowerCase().trim();
      correctAnswer = q.sentenceData.inflectedForm;
    } else {
      correct = answer.toLowerCase().trim() === q.word.word.toLowerCase().trim();
    }

    const word = this.allWords.find((w) => w.id === q.word.id);

    if (correct) {
      this.totalCorrect++;
      this.comboCount++;
      if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;

      const comboBonus = Math.min(this.comboCount - 1, 5) * 2;
      const xp = XP_CONFIG.BASE_CORRECT + comboBonus;
      this.xpEarned += xp;

      this.energy = Math.min(100, this.energy + PHASE3_ENERGY_CORRECT);

      this.phase3Index++;
      this.applyEnergyDecay();

      const oldMastery = word?.masteryLevel ?? 0;
      return {
        correct: true,
        correctAnswer,
        xpEarned: xp,
        newMasteryLevel: Math.min(oldMastery + 1, 5) as MasteryLevel,
        masteryChanged: true,
      };
    } else {
      this.totalIncorrect++;
      this.comboCount = 0;

      this.energy = Math.max(0, this.energy + PHASE3_ENERGY_WRONG);

      this.phase3Index++;
      this.applyEnergyDecay();

      // Check win/lose conditions
      this.checkPhase3End();

      const oldMastery = word?.masteryLevel ?? 0;
      return {
        correct: false,
        correctAnswer,
        xpEarned: 0,
        newMasteryLevel: Math.max(oldMastery - 1, 0) as MasteryLevel,
        masteryChanged: true,
      };
    }
  }

  private applyEnergyDecay(): void {
    this.energy = Math.max(0, this.energy + PHASE3_ENERGY_DECAY);
    this.checkPhase3End();
  }

  private checkPhase3End(): void {
    if (this.energy >= PHASE3_WIN_THRESHOLD) {
      this.portalActivated = true;
      this.xpEarned += PORTAL_ACTIVATED_XP;
    } else if (this.energy <= 0) {
      this.gameOver = true;
    }
  }

  // --- Question generators ---

  private generatePhase1Questions(targetWords: GameWord[], allWords: GameWord[]): Phase1Q[] {
    const questions: Phase1Q[] = [];

    for (const word of targetWords) {
      // Pick 3 distractors (prefer same part of speech)
      const distractors = this.pickDistractors(word, allWords, 3);
      const options = [word.word, ...distractors].sort(() => Math.random() - 0.5);

      questions.push({
        wordId: word.id,
        definition: word.definition,
        correctAnswer: word.word,
        options,
        phonetic: word.phonetic,
      });
    }

    return questions;
  }

  private generatePhase3Questions(words: GameWord[]): Phase3QuestionData[] {
    const questions: Phase3QuestionData[] = [];
    const types: Phase3QuestionType[] = ['listen_spell', 'definition_spell', 'sentence_fill'];

    for (let i = 0; i < PHASE3_MAX; i++) {
      const word = words[i % words.length];
      const type = types[i % types.length];

      const q: Phase3QuestionData = { questionType: type, word };

      if (type === 'sentence_fill' && word.exampleSentences?.length > 0) {
        const sentence = word.exampleSentences[
          Math.floor(Math.random() * word.exampleSentences.length)
        ];
        const blankResult = this.blankOutWord(sentence.english, word.word);
        if (blankResult) {
          const distractorWords = this.pickDistractors(word, words, 3);
          const options = [blankResult.inflectedForm, ...distractorWords].sort(() => Math.random() - 0.5);

          q.sentenceData = {
            english: sentence.english,
            chinese: sentence.chinese,
            sentenceWithBlank: blankResult.sentenceWithBlank,
            inflectedForm: blankResult.inflectedForm,
            options,
          };
        } else {
          // Fallback: make it a definition_spell instead
          q.questionType = 'definition_spell';
        }
      }

      // Fallback for sentence_fill without example sentences
      if (type === 'sentence_fill' && !q.sentenceData) {
        q.questionType = 'definition_spell';
      }

      questions.push(q);
    }

    return questions;
  }

  // --- Shared utilities ---

  private pickDistractors(correctWord: GameWord, allWords: GameWord[], count: number): string[] {
    const distractors: string[] = [];
    const correctId = correctWord.id;

    const samePos = allWords.filter(
      (w) => w.id !== correctId && w.partOfSpeech === correctWord.partOfSpeech
    );
    const other = allWords.filter(
      (w) => w.id !== correctId && w.partOfSpeech !== correctWord.partOfSpeech
    );

    const shuffledSame = [...samePos].sort(() => Math.random() - 0.5);
    const shuffledOther = [...other].sort(() => Math.random() - 0.5);

    for (const w of shuffledSame) {
      if (distractors.length >= count) break;
      if (!distractors.includes(w.word)) distractors.push(w.word);
    }
    for (const w of shuffledOther) {
      if (distractors.length >= count) break;
      if (!distractors.includes(w.word)) distractors.push(w.word);
    }

    return distractors;
  }

  /**
   * Replace target word with ______ in a sentence.
   * Handles inflected forms (plurals, gerunds, past tense, etc.)
   * Copied from RedstoneQuizEngine — same token-prefix matching strategy.
   */
  private blankOutWord(
    sentence: string,
    word: string,
  ): { sentenceWithBlank: string; inflectedForm: string } | null {
    const wordLower = word.toLowerCase();
    const tokens = sentence.match(/\S+/g) || [];
    let matchedToken: string | null = null;

    for (const token of tokens) {
      const cleaned = token.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      if (!cleaned) continue;

      const cleanedLower = cleaned.toLowerCase();

      if (cleanedLower === wordLower) {
        matchedToken = token;
        break;
      }

      if (cleanedLower.startsWith(wordLower)) {
        const suffix = cleanedLower.slice(wordLower.length);
        if (/^(s|es|ed|d|ing|er|r|'s|s'|ly|ness|ment|able|ible)$/.test(suffix)) {
          matchedToken = token;
          break;
        }
        if (suffix.length <= 5 && /^[a-z]+$/.test(suffix)) {
          matchedToken = token;
          break;
        }
      }
    }

    if (!matchedToken) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      const match = regex.exec(sentence);
      if (match) matchedToken = match[0];
    }

    if (!matchedToken) return null;

    const inflectedForm = matchedToken.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
    const sentenceWithBlank = sentence.replace(matchedToken, '______');
    return { sentenceWithBlank, inflectedForm };
  }
}

interface Phase1Q {
  wordId: string;
  definition: string;
  correctAnswer: string;
  options: string[];
  phonetic: string;
}
