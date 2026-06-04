// ============================================================
// Crafting Table — click letters to spell the target word
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameWord, GameProgress } from '../../types';
import { CraftingTableEngine } from './CraftingTableEngine';
import { speakWord, speakSequence } from '../../services/speech';
import { playClick, playBlockBreak, playFail, playGameComplete } from '../../services/sound';
import { useApp } from '../../store/AppContext';

interface CraftingTableProps {
  words: GameWord[];
  onAnswer: (wordId: string, correct: boolean, responseTimeMs: number) => void;
  onComplete: (progress: GameProgress) => void;
}

export default function CraftingTable({ words, onAnswer, onComplete }: CraftingTableProps) {
  const { state } = useApp();
  const soundEnabled = state.settings.soundEnabled;
  const engineRef = useRef<CraftingTableEngine | null>(null);
  const [question, setQuestion] = useState<{
    wordId: string;
    definition: string;
    phonetic?: string;
    letters: string[];
    correctAnswer: string;
  } | null>(null);
  const [slots, setSlots] = useState<string[]>([]); // filled letters
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set()); // which letter pool indices are used
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    showAnswer: string;
  } | null>(null);
  const [progress, setProgress] = useState<GameProgress>({
    currentQuestion: 0, totalQuestions: 0, correctCount: 0,
    incorrectCount: 0, xpEarned: 0, isComplete: false,
  });
  const [isComplete, setIsComplete] = useState(false);
  const answerStartRef = useRef<number>(Date.now());

  useEffect(() => {
    const engine = new CraftingTableEngine();
    engine.initialize(words);
    engineRef.current = engine;
    loadQuestion(engine);
    answerStartRef.current = Date.now();
  }, [words]);

  const loadQuestion = useCallback((engine: CraftingTableEngine) => {
    const q = engine.nextQuestion();
    if (!q) {
      setIsComplete(true);
      setProgress(engine.getProgress());
      onComplete(engine.getProgress());
      if (soundEnabled) playGameComplete();
      return;
    }

    setQuestion({
      wordId: q.wordId,
      definition: q.prompt,
      phonetic: q.phonetic,
      letters: q.options || [],
      correctAnswer: q.correctAnswer,
    });
    setSlots([]);
    setUsedIndices(new Set());
    setFeedback(null);
    answerStartRef.current = Date.now();

    // Read the definition
    speakSequence([
      { text: '请拼出这个单词', lang: 'zh', pauseMs: 600 },
      { text: q.prompt, lang: 'zh' },
    ]).catch(() => {});
  }, [onComplete, soundEnabled]);

  const handleLetterClick = useCallback(
    (letter: string, index: number) => {
      if (!question || usedIndices.has(index) || feedback) return;

      if (soundEnabled) playClick();

      const newSlots = [...slots, letter];
      const newUsed = new Set(usedIndices);
      newUsed.add(index);

      setSlots(newSlots);
      setUsedIndices(newUsed);

      // Auto-submit when slots are full
      if (newSlots.length === question.correctAnswer.length) {
        // Delay slightly so user sees the last letter placed
        setTimeout(() => {
          handleSubmit(newSlots);
        }, 300);
      }
    },
    [question, slots, usedIndices, feedback, soundEnabled]
  );

  const handleRemoveLetter = useCallback(
    (slotIndex: number) => {
      if (feedback) return;
      if (soundEnabled) playClick();

      const removedLetter = slots[slotIndex];
      const newSlots = slots.filter((_, i) => i !== slotIndex);

      // Find the used pool index for this letter
      const newUsed = new Set(usedIndices);
      // We need to free one occurrence — find the last used index for this letter
      const usedArr = Array.from(usedIndices);
      for (let i = usedArr.length - 1; i >= 0; i--) {
        const poolIdx = usedArr[i];
        if (question?.letters[poolIdx] === removedLetter && !newSlots.includes(removedLetter) ? false : true) {
          // This is tricky — just free all and re-mark based on newSlots
        }
      }

      // Simpler approach: rebuild usedIndices from newSlots
      const rebuiltUsed = new Set<number>();
      const remaining = [...question?.letters || []];
      for (const slotLetter of newSlots) {
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i] === slotLetter) {
            rebuiltUsed.add(i);
            remaining[i] = ''; // mark as used
            break;
          }
        }
      }

      setSlots(newSlots);
      setUsedIndices(rebuiltUsed);
    },
    [slots, usedIndices, question, feedback, soundEnabled]
  );

  const handleSubmit = useCallback(
    (currentSlots: string[]) => {
      if (!engineRef.current || !question || feedback) return;

      const answer = currentSlots.join('');
      const responseTimeMs = Date.now() - answerStartRef.current;
      const result = engineRef.current.submitAnswer(answer);

      if (result.correct) {
        if (soundEnabled) playBlockBreak();
        speakWord(result.correctAnswer).catch(() => {});

        setFeedback({ correct: true, showAnswer: result.correctAnswer });

        onAnswer(question.wordId, true, responseTimeMs);
        setProgress(engineRef.current.getProgress());

        setTimeout(() => {
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 1500);
      } else {
        if (soundEnabled) playFail();

        setFeedback({ correct: false, showAnswer: result.correctAnswer });

        onAnswer(question.wordId, false, responseTimeMs);
        setProgress(engineRef.current.getProgress());

        // Show correct answer, then move on
        setTimeout(() => {
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 2000);
      }
    },
    [question, feedback, onAnswer, loadQuestion, soundEnabled]
  );

  const handleClear = useCallback(() => {
    if (feedback) return;
    if (soundEnabled) playClick();
    setSlots([]);
    setUsedIndices(new Set());
  }, [feedback, soundEnabled]);

  // Completion screen
  if (isComplete) {
    return (
      <div className="flex-col gap-md" style={{ alignItems: 'center', padding: 32 }}>
        <div className="pixel-text" style={{ color: 'var(--color-gold)', fontSize: 16 }}>
          🛠️ Crafting Complete!
        </div>
        <div className="flex" style={{ gap: 32, marginTop: 8 }}>
          <StatBox label="Correct" value={`${progress.correctCount}`} color="var(--color-xp)" />
          <StatBox label="Misses" value={`${progress.incorrectCount}`} color="var(--color-redstone)" />
          <StatBox label="XP" value={`+${progress.xpEarned}`} color="var(--color-gold)" />
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex-center" style={{ height: 200 }}>
        <span className="pixel-text" style={{ color: 'var(--text-muted)' }}>
          Setting up workbench...
        </span>
      </div>
    );
  }

  const totalSlots = question.correctAnswer.length;
  const slotsPerRow = Math.min(totalSlots, 6); // fit on one row up to 6 letters

  return (
    <div className="flex-col gap-md" style={{ padding: 16 }}>
      {/* Progress header */}
      <div>
        <div className="flex-between" style={{ marginBottom: 4 }}>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            Word {progress.currentQuestion + 1}/{progress.totalQuestions}
          </span>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            ⭐ {progress.xpEarned} XP
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: `${(progress.currentQuestion / Math.max(progress.totalQuestions, 1)) * 100}%`,
              background: 'linear-gradient(90deg, var(--color-xp-dim), var(--color-xp))',
            }}
          />
        </div>
      </div>

      {/* Recipe panel — what to craft */}
      <div className="mc-panel" style={{ padding: '16px', textAlign: 'center' }}>
        <div className="pixel-text-sm" style={{ color: 'var(--text-muted)', fontSize: 7, marginBottom: 8 }}>
          🛠️ CRAFT THIS WORD:
        </div>
        <div
          style={{
            fontSize: 16,
            color: 'var(--color-gold)',
            marginBottom: question.phonetic ? 6 : 0,
            animation: 'fadeInUp 0.3s ease-out',
          }}
        >
          {question.definition}
        </div>
        {question.phonetic && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            /{question.phonetic}/
          </div>
        )}
      </div>

      {/* Feedback */}
      <div style={{ minHeight: 24, textAlign: 'center' }}>
        {feedback && (
          <div
            style={{
              animation: 'fadeInUp 0.2s ease-out',
              color: feedback.correct ? 'var(--color-xp)' : 'var(--color-redstone)',
              fontSize: 13,
            }}
          >
            {feedback.correct ? (
              <span>✅ Correct! {feedback.showAnswer}</span>
            ) : (
              <span>❌ The word is: <strong>{feedback.showAnswer}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* Crafting slots */}
      <div className="mc-panel" style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {Array.from({ length: totalSlots }).map((_, i) => {
            const letter = slots[i] || '';
            const filled = i < slots.length;

            return (
              <button
                key={i}
                className={filled ? 'stone-block' : 'crafting-slot'}
                onClick={() => filled && handleRemoveLetter(i)}
                disabled={!filled || !!feedback}
                style={{
                  width: 42,
                  height: 48,
                  fontSize: 18,
                  cursor: filled && !feedback ? 'pointer' : 'default',
                  background: filled
                    ? 'var(--color-surface)'
                    : 'rgba(255,255,255,0.04)',
                  border: filled
                    ? '2px solid var(--color-diamond)'
                    : '2px dashed rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  color: filled ? '#FFF' : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Letter pool */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          flexWrap: 'wrap',
          padding: '8px 0',
        }}
      >
        {question.letters.map((letter, i) => {
          const isUsed = usedIndices.has(i);
          return (
            <button
              key={i}
              className="stone-block"
              onClick={() => handleLetterClick(letter, i)}
              disabled={isUsed || !!feedback}
              style={{
                width: 44,
                height: 44,
                fontSize: 18,
                opacity: isUsed ? 0.2 : 1,
                cursor: isUsed || feedback ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {letter.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex" style={{ gap: 12, justifyContent: 'center' }}>
        <button
          className="btn btn-ghost"
          onClick={handleClear}
          disabled={slots.length === 0 || !!feedback}
          style={{ fontSize: 10, padding: '8px 20px' }}
        >
          🔄 Clear
        </button>
        {slots.length < totalSlots && (
          <span style={{ color: 'var(--text-muted)', fontSize: 10, alignSelf: 'center' }}>
            Fill all {totalSlots} slots to auto-craft
          </span>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-col" style={{ alignItems: 'center' }}>
      <div className="pixel-text-sm" style={{ fontSize: 16, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
