// ============================================================
// Diamond Mine — Multiple Choice Word Recognition Game
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameWord, Question, GameProgress } from '../../types';
import { DiamondMineEngine } from './DiamondMineEngine';
import { speakWord } from '../../services/speech';

interface DiamondMineProps {
  words: GameWord[];
  onAnswer: (wordId: string, correct: boolean, responseTimeMs: number) => void;
  onComplete: (progress: GameProgress) => void;
}

interface BlockState {
  word: string;
  isCorrectOption: boolean;
  status: 'idle' | 'correct' | 'incorrect' | 'highlight';
}

export default function DiamondMine({ words, onAnswer, onComplete }: DiamondMineProps) {
  const engineRef = useRef<DiamondMineEngine | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [blocks, setBlocks] = useState<BlockState[]>([]);
  const [feedback, setFeedback] = useState<{ correct: boolean; word: string; xp: number } | null>(null);
  const [progress, setProgress] = useState<GameProgress>({
    currentQuestion: 0,
    totalQuestions: 0,
    correctCount: 0,
    incorrectCount: 0,
    xpEarned: 0,
    isComplete: false,
  });
  const [isComplete, setIsComplete] = useState(false);
  const answerStartRef = useRef<number>(Date.now());

  // Initialize engine
  useEffect(() => {
    const engine = new DiamondMineEngine();
    engine.initialize(words);
    engineRef.current = engine;
    loadNextQuestion(engine);
    answerStartRef.current = Date.now();
  }, [words]);

  const loadNextQuestion = useCallback((engine: DiamondMineEngine) => {
    const next = engine.nextQuestion();
    if (!next) {
      // Round complete
      const prog = engine.getProgress();
      setProgress(prog);
      setIsComplete(true);
      onComplete(prog);
      return;
    }

    setQuestion(next);
    setFeedback(null);

    // Create blocks from options
    if (next.options) {
      const newBlocks: BlockState[] = next.options.map((word) => ({
        word,
        isCorrectOption: word === next.correctAnswer,
        status: 'idle',
      }));
      setBlocks(newBlocks);
    }

    setProgress(engine.getProgress());
    answerStartRef.current = Date.now();
  }, [onComplete]);

  const handleBlockClick = useCallback(
    (block: BlockState, index: number) => {
      if (!engineRef.current || !question || feedback) return;
      if (block.status !== 'idle') return;

      const responseTimeMs = Date.now() - answerStartRef.current;
      const result = engineRef.current.submitAnswer(block.word);

      // Update block states
      setBlocks((prev) =>
        prev.map((b, i) => {
          if (b.isCorrectOption && block.word !== b.word) {
            return { ...b, status: 'highlight' }; // Show correct answer
          }
          if (i === index) {
            return { ...b, status: result.correct ? 'correct' : 'incorrect' };
          }
          return b;
        })
      );

      // Show feedback
      setFeedback({
        correct: result.correct,
        word: result.correctAnswer,
        xp: result.xpEarned,
      });

      // Speak the word if correct
      if (result.correct) {
        speakWord(question.correctAnswer).catch(() => {});
      }

      // Notify parent
      onAnswer(question.wordId, result.correct, responseTimeMs);

      // Load next question after delay
      setTimeout(() => {
        loadNextQuestion(engineRef.current!);
      }, result.correct ? 1200 : 2000);
    },
    [question, feedback, onAnswer, loadNextQuestion]
  );

  if (isComplete) {
    return (
      <div className="flex-col" style={{ alignItems: 'center', padding: 32, gap: 16 }}>
        <div className="pixel-text" style={{ color: '#FFC107', fontSize: 18 }}>
          ⛏️ Mine Complete!
        </div>
        <div style={{ color: '#AAA', fontSize: 14 }}>
          Correct: {progress.correctCount} / {progress.totalQuestions}
        </div>
        <div style={{ color: '#80FF20', fontSize: 14 }}>
          XP Earned: +{progress.xpEarned}
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex-center" style={{ height: 200 }}>
        <span className="pixel-text" style={{ color: '#AAA' }}>Loading mine...</span>
      </div>
    );
  }

  return (
    <div className="flex-col" style={{ gap: 20, padding: 16 }}>
      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9 }}>
            Depth: Y={progress.currentQuestion * 5}
          </span>
          <span className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9 }}>
            {progress.currentQuestion}/{progress.totalQuestions}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: `${(progress.currentQuestion / progress.totalQuestions) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Target definition — what the player needs to find */}
      <div className="minecraft-panel" style={{ padding: '12px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Find the word for:</div>
        <div style={{ fontSize: 20, color: '#FFF', fontWeight: 700, fontFamily: 'var(--font-body)' }}>
          {question.prompt}
        </div>
        {question.phonetic && (
          <div style={{ fontSize: 13, color: '#AAA', marginTop: 4, fontFamily: 'monospace' }}>
            {question.phonetic}
          </div>
        )}
      </div>

      {/* Feedback overlay */}
      {feedback && (
        <div
          className="flex-center"
          style={{
            padding: 8,
            background: feedback.correct ? 'rgba(128,255,32,0.2)' : 'rgba(255,85,85,0.2)',
            border: `2px solid ${feedback.correct ? '#80FF20' : '#FF5555'}`,
            borderRadius: 0,
          }}
        >
          <span
            className="pixel-text-sm"
            style={{ color: feedback.correct ? '#80FF20' : '#FF5555', fontSize: 10 }}
          >
            {feedback.correct ? `✅ Correct! +${feedback.xp}XP` : `❌ The answer was: ${feedback.word}`}
          </span>
        </div>
      )}

      {/* Stone block grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: 12,
          maxWidth: 500,
          margin: '0 auto',
        }}
      >
        {blocks.map((block, i) => (
          <button
            key={`${block.word}-${i}`}
            className={`stone-block ${block.status === 'correct' ? 'correct' : ''} ${block.status === 'incorrect' ? 'incorrect' : ''} ${block.status === 'highlight' ? 'highlight' : ''}`}
            onClick={() => handleBlockClick(block, i)}
            disabled={!!feedback}
            style={{
              minWidth: 90,
              minHeight: 70,
            }}
          >
            {block.word}
          </button>
        ))}
      </div>

      {/* XP counter */}
      <div className="flex-center">
        <span className="pixel-text-sm" style={{ color: '#80FF20', fontSize: 10 }}>
          ⭐ {progress.xpEarned} XP
        </span>
      </div>
    </div>
  );
}
