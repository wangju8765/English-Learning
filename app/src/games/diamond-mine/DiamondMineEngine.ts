// ============================================================
// Diamond Mine Game Engine — Multiple Choice Recognition
// ============================================================
import type { GameEngine, GameWord, Question, AnswerResult, GameProgress, MasteryLevel } from '../../types';
import { XP_CONFIG } from '../../types';

const QUESTIONS_PER_ROUND = 12;
const OPTIONS_PER_QUESTION = 4;

export class DiamondMineEngine implements GameEngine {
  private words: GameWord[] = [];
  private currentIndex = 0;
  private questions: Question[] = [];
  private correctCount = 0;
  private incorrectCount = 0;
  private xpEarned = 0;
  private roundWords: GameWord[] = [];

  initialize(words: GameWord[]): void {
    this.words = words;
    this.currentIndex = 0;
    this.correctCount = 0;
    this.incorrectCount = 0;
    this.xpEarned = 0;

    // Select words for this round (up to QUESTIONS_PER_ROUND)
    this.roundWords = this.selectRoundWords(words);
    this.questions = this.generateQuestions(this.roundWords);
  }

  nextQuestion(): Question | null {
    if (this.currentIndex >= this.questions.length) {
      return null;
    }
    return this.questions[this.currentIndex];
  }

  submitAnswer(answer: string): AnswerResult {
    const question = this.questions[this.currentIndex];
    if (!question) {
      throw new Error('No active question');
    }

    const isCorrect = answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
    const word = this.words.find((w) => w.id === question.wordId);

    if (isCorrect) {
      this.correctCount++;
    } else {
      this.incorrectCount++;
    }

    const baseXp = isCorrect ? XP_CONFIG.BASE_CORRECT : 0;
    this.xpEarned += baseXp;

    // Calculate new mastery level
    const oldMastery = word?.masteryLevel ?? 0;
    const newMastery = isCorrect
      ? Math.min(oldMastery + 1, 5) as MasteryLevel
      : Math.max(oldMastery - 1, 0) as MasteryLevel;

    this.currentIndex++;

    return {
      correct: isCorrect,
      correctAnswer: question.correctAnswer,
      xpEarned: baseXp,
      newMasteryLevel: newMastery,
      masteryChanged: newMastery !== oldMastery,
    };
  }

  getProgress(): GameProgress {
    return {
      currentQuestion: this.currentIndex,
      totalQuestions: this.questions.length,
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
      xpEarned: this.xpEarned,
      isComplete: this.currentIndex >= this.questions.length,
    };
  }

  isComplete(): boolean {
    return this.currentIndex >= this.questions.length;
  }

  private selectRoundWords(words: GameWord[]): GameWord[] {
    // Prioritize lower mastery words, but include some higher mastery for review
    const sorted = [...words].sort((a, b) => a.masteryLevel - b.masteryLevel);
    return sorted.slice(0, Math.min(QUESTIONS_PER_ROUND, sorted.length));
  }

  private generateQuestions(words: GameWord[]): Question[] {
    const allWords = this.words.filter((w) => !words.includes(w));
    const questions: Question[] = [];

    for (const word of words) {
      // Generate distractors from other words
      const distractors = this.pickDistractors(word, allWords, OPTIONS_PER_QUESTION - 1);
      const options = [word.word, ...distractors].sort(() => Math.random() - 0.5);

      questions.push({
        wordId: word.id,
        type: 'multiple_choice',
        prompt: word.definition,
        correctAnswer: word.word,
        options,
        phonetic: word.phonetic,
      });
    }

    return questions;
  }

  private pickDistractors(target: GameWord, pool: GameWord[], count: number): string[] {
    const available = pool
      .filter((w) => w.id !== target.id)
      .map((w) => w.word);

    // Shuffle and pick
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}
