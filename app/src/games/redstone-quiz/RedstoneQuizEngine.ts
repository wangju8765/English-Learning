// ============================================================
// Redstone Quiz Engine — sentence context fill-in-the-blank
// ============================================================
import type { GameEngine, GameWord, Question, AnswerResult, GameProgress, MasteryLevel } from '../../types';
import { XP_CONFIG } from '../../types';

const OPTIONS_COUNT = 4; // 1 correct + 3 distractors

export class RedstoneQuizEngine implements GameEngine {
  private words: GameWord[] = [];
  private questions: QuestionData[] = [];
  private currentIndex = 0;
  private totalCorrect = 0;
  private totalIncorrect = 0;
  private xpEarned = 0;
  private comboCount = 0;
  private maxCombo = 0;

  initialize(words: GameWord[]): void {
    // Only use words that have example sentences
    const eligible = words.filter((w) => w.exampleSentences && w.exampleSentences.length > 0);

    this.words = eligible;
    this.currentIndex = 0;
    this.totalCorrect = 0;
    this.totalIncorrect = 0;
    this.xpEarned = 0;
    this.comboCount = 0;
    this.maxCombo = 0;

    this.questions = this.generateQuestions(eligible);
  }

  nextQuestion(): Question | null {
    if (this.currentIndex >= this.questions.length) return null;

    const q = this.questions[this.currentIndex];
    return {
      wordId: q.wordId,
      type: 'multiple_choice',
      prompt: q.sentenceWithBlank,
      correctAnswer: q.correctAnswer,
      options: q.options,
      phonetic: q.phonetic,
    };
  }

  submitAnswer(answer: string): AnswerResult {
    const q = this.questions[this.currentIndex];
    if (!q) throw new Error('No active question');

    const playerAnswer = answer.trim();
    const correct = playerAnswer.toLowerCase() === q.correctAnswer.toLowerCase();

    if (correct) {
      this.totalCorrect++;
      this.comboCount++;
      if (this.comboCount > this.maxCombo) {
        this.maxCombo = this.comboCount;
      }

      const comboBonus = Math.min(this.comboCount - 1, 5) * 2;
      const xp = XP_CONFIG.BASE_CORRECT + comboBonus;
      this.xpEarned += xp;

      const word = this.words.find((w) => w.id === q.wordId);
      const oldMastery = word?.masteryLevel ?? 0;
      const newMastery = Math.min(oldMastery + 1, 5) as MasteryLevel;

      this.currentIndex++;

      return {
        correct: true,
        correctAnswer: q.correctAnswer,
        xpEarned: xp,
        newMasteryLevel: newMastery,
        masteryChanged: newMastery !== oldMastery,
      };
    } else {
      this.totalIncorrect++;
      this.comboCount = 0;

      this.currentIndex++;

      const word = this.words.find((w) => w.id === q.wordId);

      return {
        correct: false,
        correctAnswer: q.correctAnswer,
        xpEarned: 0,
        newMasteryLevel: Math.max((word?.masteryLevel ?? 0) - 1, 0) as MasteryLevel,
        masteryChanged: true,
      };
    }
  }

  getProgress(): GameProgress {
    return {
      currentQuestion: this.currentIndex,
      totalQuestions: this.questions.length,
      correctCount: this.totalCorrect,
      incorrectCount: this.totalIncorrect,
      xpEarned: this.xpEarned,
      isComplete: this.isComplete(),
    };
  }

  isComplete(): boolean {
    return this.currentIndex >= this.questions.length;
  }

  getComboCount(): number {
    return this.comboCount;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  getCurrentQuestionData(): QuestionData | null {
    if (this.currentIndex < this.questions.length) {
      return this.questions[this.currentIndex];
    }
    return null;
  }

  // --- Private helpers ---

  private generateQuestions(words: GameWord[]): QuestionData[] {
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    const questions: QuestionData[] = [];

    for (const word of shuffled) {
      const sentence = this.pickRandomSentence(word);
      if (!sentence) continue;

      const blankResult = this.blankOutWord(sentence.english, word.word);
      if (!blankResult) continue; // Skip if word form not found in sentence

      const distractors = this.pickDistractors(word, shuffled);

      // Shuffle options so correct answer isn't always in the same position
      const allOptions = [word.word, ...distractors].sort(() => Math.random() - 0.5);

      questions.push({
        wordId: word.id,
        correctAnswer: word.word,
        sentenceEnglish: sentence.english,
        sentenceChinese: sentence.chinese,
        sentenceWithBlank: blankResult.sentenceWithBlank,
        inflectedForm: blankResult.inflectedForm,
        options: allOptions,
        phonetic: word.phonetic,
      });
    }

    return questions;
  }

  private pickRandomSentence(word: GameWord): { english: string; chinese: string } | null {
    const sentences = word.exampleSentences;
    if (!sentences || sentences.length === 0) return null;
    return sentences[Math.floor(Math.random() * sentences.length)];
  }

  /**
   * Replace the target word with ______ in the sentence.
   * Handles inflected forms: plurals (tools→tool), gerunds (Learning→Learn),
   * past tense (closed→close), third-person (exports→export), etc.
   *
   * Strategy: tokenize sentence into words, for each token check if it
   * "belongs to" the target word by verifying the token starts with the
   * target (case-insensitive) and any extra suffix is morphologically plausible.
   * Falls back to exact regex match for mid-word punctuation cases.
   */
  private blankOutWord(
    sentence: string,
    word: string,
  ): { sentenceWithBlank: string; inflectedForm: string } | null {
    const wordLower = word.toLowerCase();

    // Tokenize: split on whitespace while preserving spans
    // Match each "word" as a sequence of non-whitespace characters
    const tokens = sentence.match(/\S+/g) || [];
    let matchedToken: string | null = null;

    for (const token of tokens) {
      // Strip leading/trailing punctuation for comparison
      const cleaned = token.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      if (!cleaned) continue;

      const cleanedLower = cleaned.toLowerCase();

      // 1. Exact match (case-insensitive)
      if (cleanedLower === wordLower) {
        matchedToken = token;
        break;
      }

      // 2. Token starts with the target word (handles inflected forms)
      if (cleanedLower.startsWith(wordLower)) {
        const suffix = cleanedLower.slice(wordLower.length);

        // Common English suffixes for inflected forms
        if (/^(s|es|ed|d|ing|er|r|'s|s'|ly|ness|ment|able|ible)$/.test(suffix)) {
          matchedToken = token;
          break;
        }

        // Also allow compound words where the target is the first part
        // e.g., "scanner" from "scan" (scan + ner)
        if (suffix.length <= 5 && /^[a-z]+$/.test(suffix)) {
          matchedToken = token;
          break;
        }
      }
    }

    // Fallback: try exact regex match (handles mid-word punctuation edge cases)
    if (!matchedToken) {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      const match = regex.exec(sentence);
      if (match) {
        matchedToken = match[0];
      }
    }

    if (!matchedToken) return null;

    // Extract the inflected form (the actual word text, preserving case)
    const inflectedForm = matchedToken.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');

    // Replace the matched token in the sentence (preserving surrounding text)
    const sentenceWithBlank = sentence.replace(matchedToken, '______');

    return { sentenceWithBlank, inflectedForm };
  }

  private pickDistractors(correctWord: GameWord, allWords: GameWord[]): string[] {
    const distractors: string[] = [];
    const correctId = correctWord.id;

    // Prefer same part of speech
    const samePos = allWords.filter(
      (w) => w.id !== correctId && w.partOfSpeech === correctWord.partOfSpeech
    );
    const other = allWords.filter(
      (w) => w.id !== correctId && w.partOfSpeech !== correctWord.partOfSpeech
    );

    // Shuffle both pools
    const shuffledSame = [...samePos].sort(() => Math.random() - 0.5);
    const shuffledOther = [...other].sort(() => Math.random() - 0.5);

    // Pick from same POS first, fill with others
    for (const w of shuffledSame) {
      if (distractors.length >= OPTIONS_COUNT - 1) break;
      if (!distractors.includes(w.word)) {
        distractors.push(w.word);
      }
    }

    for (const w of shuffledOther) {
      if (distractors.length >= OPTIONS_COUNT - 1) break;
      if (!distractors.includes(w.word)) {
        distractors.push(w.word);
      }
    }

    return distractors;
  }
}

export interface QuestionData {
  wordId: string;
  correctAnswer: string;
  sentenceEnglish: string;
  sentenceChinese: string;
  sentenceWithBlank: string;
  inflectedForm: string; // The actual word form found in the sentence (e.g., "windows" → "Window")
  options: string[];
  phonetic: string;
}
