// ============================================================
// Diamond Mine Game Engine — 12-block wall, multi-target mining
// ============================================================
import type { GameEngine, GameWord, Question, AnswerResult, GameProgress, MasteryLevel } from '../../types';
import { XP_CONFIG } from '../../types';

const WALL_SIZE = 12; // 3×4 grid of stone blocks
const TARGETS_PER_WALL = 3; // Find 3 correct words on each wall

export class DiamondMineEngine implements GameEngine {
  private words: GameWord[] = [];
  private walls: WallData[] = [];
  private currentWallIndex = 0;
  private totalCorrect = 0;
  private totalIncorrect = 0;
  private totalQuestions = 0;
  private xpEarned = 0;
  private comboCount = 0;
  private maxCombo = 0;

  initialize(words: GameWord[]): void {
    this.words = [...words].sort(() => Math.random() - 0.5);
    this.currentWallIndex = 0;
    this.totalCorrect = 0;
    this.totalIncorrect = 0;
    this.totalQuestions = 0;
    this.xpEarned = 0;
    this.comboCount = 0;
    this.maxCombo = 0;

    // Generate walls — each wall has WALL_SIZE blocks with TARGETS_PER_WALL correct targets
    this.walls = this.generateWalls(this.words);
  }

  nextQuestion(): Question | null {
    // Wall mode: return the current wall as a special question
    if (this.currentWallIndex < this.walls.length) {
      const wall = this.walls[this.currentWallIndex];
      return {
        wordId: `wall_${this.currentWallIndex}`,
        type: 'multiple_choice',
        prompt: '', // Not used in wall mode — targets shown separately
        correctAnswer: wall.targets.map(t => t.word).join('|'),
        options: wall.blocks,
        phonetic: '',
      };
    }
    return null;
  }

  submitAnswer(answer: string): AnswerResult {
    const wall = this.walls[this.currentWallIndex];
    if (!wall) throw new Error('No active wall');

    const clickedWord = answer.toLowerCase().trim();
    const target = wall.remainingTargets.find(
      (t) => t.word.toLowerCase().trim() === clickedWord
    );

    if (target) {
      // Correct! Remove from remaining targets
      wall.remainingTargets = wall.remainingTargets.filter((t) => t !== target);
      this.totalCorrect++;
      this.comboCount++;
      if (this.comboCount > this.maxCombo) {
        this.maxCombo = this.comboCount;
      }

      // Combo XP bonus
      const comboBonus = Math.min(this.comboCount - 1, 5) * 2; // Up to +10 XP for 6+ combo
      const xp = XP_CONFIG.BASE_CORRECT + comboBonus;
      this.xpEarned += xp;
      this.totalQuestions++;

      // Check if wall is complete
      if (wall.remainingTargets.length === 0) {
        this.currentWallIndex++;
        this.comboCount = 0; // Reset combo between walls
      }

      const oldMastery = target.masteryLevel ?? 0;
      const newMastery = Math.min(oldMastery + 1, 5) as MasteryLevel;

      return {
        correct: true,
        correctAnswer: target.word,
        xpEarned: xp,
        newMasteryLevel: newMastery,
        masteryChanged: newMastery !== oldMastery,
      };
    } else {
      // Incorrect
      this.totalIncorrect++;
      this.comboCount = 0;
      this.totalQuestions++;
      this.xpEarned += 0;

      // Find the "most relevant" target to show as answer
      const firstTarget = wall.remainingTargets[0] || wall.targets[0];

      return {
        correct: false,
        correctAnswer: firstTarget.word,
        xpEarned: 0,
        newMasteryLevel: Math.max(firstTarget.masteryLevel - 1, 0) as MasteryLevel,
        masteryChanged: true,
      };
    }
  }

  getProgress(): GameProgress {
    return {
      currentQuestion: this.totalQuestions,
      totalQuestions: this.walls.length * TARGETS_PER_WALL,
      correctCount: this.totalCorrect,
      incorrectCount: this.totalIncorrect,
      xpEarned: this.xpEarned,
      isComplete: this.isComplete(),
    };
  }

  isComplete(): boolean {
    return this.currentWallIndex >= this.walls.length;
  }

  getCurrentWall(): WallData | null {
    if (this.currentWallIndex < this.walls.length) {
      return this.walls[this.currentWallIndex];
    }
    return null;
  }

  getComboCount(): number {
    return this.comboCount;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  private generateWalls(words: GameWord[]): WallData[] {
    const walls: WallData[] = [];
    const sorted = [...words].sort((a, b) => a.masteryLevel - b.masteryLevel);

    // Each wall: 12 blocks, 3 targets
    let idx = 0;
    while (idx < sorted.length) {
      const targets = sorted.slice(idx, idx + TARGETS_PER_WALL);
      if (targets.length === 0) break;

      // Generate distractors from remaining words
      const distractors = sorted
        .filter((w) => !targets.includes(w))
        .slice(0, WALL_SIZE - targets.length);

      // If not enough distractors, we may have fewer blocks
      const blocks = [...targets.map((t) => t.word), ...distractors.map((d) => d.word)]
        .sort(() => Math.random() - 0.5);

      walls.push({
        targets: targets,
        remainingTargets: [...targets],
        blocks,
      });

      idx += TARGETS_PER_WALL;
    }

    return walls;
  }
}

export interface WallData {
  targets: GameWord[];
  remainingTargets: GameWord[];
  blocks: string[]; // All words shown on the wall (targets + distractors)
}
