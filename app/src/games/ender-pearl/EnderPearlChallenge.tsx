// ============================================================
// Ender Pearl Challenge — timed click-to-spell game
// Click letter blocks to spell the word before the pearl lands
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameWord, GameProgress } from '../../types';
import { EnderPearlEngine } from './EnderPearlEngine';
import { speakWord, speakSequence } from '../../services/speech';
import { playClick, playBlockBreak, playFail, playGameComplete } from '../../services/sound';
import { useApp } from '../../store/AppContext';

interface EnderPearlProps {
  words: GameWord[];
  onAnswer: (wordId: string, correct: boolean, responseTimeMs: number) => void;
  onComplete: (progress: GameProgress) => void;
}

export default function EnderPearlChallenge({ words, onAnswer, onComplete }: EnderPearlProps) {
  const { state } = useApp();
  const soundEnabled = state.settings.soundEnabled;
  const engineRef = useRef<EnderPearlEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLimitRef = useRef<number>(12);

  const [question, setQuestion] = useState<{
    wordId: string;
    definition: string;
    phonetic?: string;
    letters: string[];
    correctAnswer: string;
  } | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(12);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    showAnswer: string;
    userAnswer?: string;
    xp: number;
    combo: number;
  } | null>(null);
  const [progress, setProgress] = useState<GameProgress>({
    currentQuestion: 0, totalQuestions: 0, correctCount: 0,
    incorrectCount: 0, xpEarned: 0, isComplete: false,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const submittingRef = useRef(false);
  const handleSubmitRef = useRef<(currentSlots: string[]) => void>(() => {});
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;

  useEffect(() => {
    const engine = new EnderPearlEngine();
    engine.initialize(words);
    engineRef.current = engine;
    loadQuestion(engine);
  }, [words]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((timeLimit: number) => {
    clearTimer();
    setTimeLeft(timeLimit);
    timeLimitRef.current = timeLimit;

    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearTimer();
        if (!submittingRef.current) {
          submittingRef.current = true;
          setSlots((current) => {
            handleSubmitRef.current(current);
            return current;
          });
        }
      }
    }, 100);
  }, [clearTimer]);

  const loadQuestion = useCallback((engine: EnderPearlEngine) => {
    const q = engine.nextQuestion();
    if (!q) {
      setIsComplete(true);
      setProgress(engine.getProgress());
      onComplete(engine.getProgress());
      if (soundEnabled) playGameComplete();
      clearTimer();
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
    setComboCount(engine.getComboCount());
    setProgress(engine.getProgress());
    submittingRef.current = false;

    // Start timer
    const timeLimit = engine.getTimeLimit();
    startTimer(timeLimit);

    // Read: word → instruction → definition → word (twice before acting)
    (async () => {
      await speakWord(q.correctAnswer, 0.85);
      await new Promise(r => setTimeout(r, 400));
      await speakSequence([
        { text: '请拼出这个单词', lang: 'zh', pauseMs: 400 },
        { text: q.prompt, lang: 'zh', pauseMs: 600 },
      ]);
      await speakWord(q.correctAnswer, 0.85);
    })().catch(() => {});
  }, [onComplete, soundEnabled, clearTimer, startTimer]);

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
        setTimeout(() => {
          handleSubmitRef.current(newSlots);
        }, 300);
      }
    },
    [question, slots, usedIndices, feedback, soundEnabled]
  );

  const handleRemoveLetter = useCallback(
    (slotIndex: number) => {
      if (feedback) return;
      if (soundEnabled) playClick();

      const newSlots = slots.filter((_, i) => i !== slotIndex);

      // Rebuild usedIndices from newSlots
      const rebuiltUsed = new Set<number>();
      const remaining = [...(question?.letters || [])];
      for (const slotLetter of newSlots) {
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i] === slotLetter) {
            rebuiltUsed.add(i);
            remaining[i] = '';
            break;
          }
        }
      }

      setSlots(newSlots);
      setUsedIndices(rebuiltUsed);
    },
    [slots, question, feedback, soundEnabled]
  );

  const handleSubmit = useCallback(
    (currentSlots: string[]) => {
      if (!engineRef.current || !question || feedback) return;

      const answer = currentSlots.join('');
      const timeRatio = timeLeftRef.current / timeLimitRef.current;
      const result = engineRef.current.submitAnswer(answer || '(no answer)', timeRatio);

      clearTimer();

      if (result.correct) {
        if (soundEnabled) playBlockBreak();

        setFeedback({
          correct: true,
          showAnswer: result.correctAnswer,
          xp: result.xpEarned,
          combo: engineRef.current.getComboCount(),
        });

        onAnswer(question.wordId, true, 0);
        setProgress(engineRef.current.getProgress());
        setComboCount(engineRef.current.getComboCount());

        setTimeout(() => {
          speakWord(result.correctAnswer).catch(() => {});
        }, 200);

        setTimeout(() => {
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 1500);
      } else {
        if (soundEnabled) playFail();

        // Fill slots with the correct answer
        const correctLetters = result.correctAnswer.toLowerCase().split('');
        setSlots(correctLetters);

        setFeedback({
          correct: false,
          showAnswer: result.correctAnswer,
          userAnswer: answer,
          xp: 0,
          combo: 0,
        });

        onAnswer(question.wordId, false, 0);
        setProgress(engineRef.current.getProgress());
        setComboCount(0);

        setTimeout(() => {
          speakWord(result.correctAnswer, 0.85).catch(() => {});
        }, 400);

        setTimeout(() => {
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 3500);
      }
    },
    [question, feedback, onAnswer, loadQuestion, soundEnabled, clearTimer]
  );

  handleSubmitRef.current = handleSubmit;

  const handleClear = useCallback(() => {
    if (feedback) return;
    if (soundEnabled) playClick();
    setSlots([]);
    setUsedIndices(new Set());
  }, [feedback, soundEnabled]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // Completion screen
  if (isComplete) {
    const maxCombo = engineRef.current?.getMaxCombo() ?? 0;
    return (
      <div className="flex-col gap-md" style={{ alignItems: 'center', padding: 32 }}>
        <div className="pixel-text" style={{ color: 'var(--color-gold)', fontSize: 16 }}>
          🎯 Pearl Challenge Complete!
        </div>
        <div className="flex" style={{ gap: 32, marginTop: 8 }}>
          <StatBox label="Correct" value={`${progress.correctCount}`} color="var(--color-xp)" />
          <StatBox label="Misses" value={`${progress.incorrectCount}`} color="var(--color-redstone)" />
          <StatBox label="XP" value={`+${progress.xpEarned}`} color="var(--color-gold)" />
        </div>
        {maxCombo >= 3 && (
          <div className="pixel-text-sm" style={{ color: 'var(--color-diamond)', fontSize: 9, marginTop: 8 }}>
            🔥 Max Combo: {maxCombo}x!
          </div>
        )}
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex-center" style={{ height: 200 }}>
        <span className="pixel-text" style={{ color: 'var(--text-muted)' }}>
          Throwing pearl...
        </span>
      </div>
    );
  }

  const totalSlots = question.correctAnswer.length;
  const timeRatio = timeLeft / timeLimitRef.current;
  const isError = feedback && !feedback.correct;
  const timerColor =
    timeRatio > 0.5 ? 'var(--color-xp)' :
    timeRatio > 0.25 ? 'var(--color-gold)' :
    'var(--color-redstone)';

  return (
    <div className="flex-col gap-md" style={{ padding: 16 }}>
      {/* Progress header */}
      <div>
        <div className="flex-between" style={{ marginBottom: 4 }}>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            Pearl {progress.currentQuestion + 1}/{progress.totalQuestions}
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

      {/* Timer bar */}
      <div
        style={{
          height: 8,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.max(0, timeRatio) * 100}%`,
            background: timerColor,
            borderRadius: 4,
            transition: 'width 0.1s linear, background 0.3s ease',
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 20,
            lineHeight: 1,
            filter: timeRatio < 0.3 ? 'none' : 'grayscale(0.3)',
            transition: 'filter 0.3s ease',
          }}
        >
          🎯
        </span>
        {/* Time remaining digit */}
        <span
          style={{
            position: 'absolute',
            left: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 7,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          {Math.ceil(timeLeft)}s
        </span>
      </div>

      {/* Recipe panel — what to spell */}
      <div
        className="mc-panel"
        style={{
          padding: '16px',
          textAlign: 'center',
          background: 'rgba(138, 43, 226, 0.12)',
          border: '1px solid rgba(138, 43, 226, 0.3)',
        }}
      >
        <div className="pixel-text-sm" style={{ color: 'var(--text-muted)', fontSize: 7, marginBottom: 8 }}>
          🎯 SPELL BEFORE THE PEARL LANDS:
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
      <div style={{ minHeight: 28, textAlign: 'center' }}>
        {feedback && feedback.correct && (
          <div
            style={{
              animation: 'fadeInUp 0.2s ease-out',
              color: 'var(--color-xp)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ✅ 正确！+{feedback.xp}XP
            {feedback.combo >= 2 && (
              <span style={{ color: 'var(--color-diamond)', marginLeft: 8 }}>
                🔥 {feedback.combo}x COMBO!
              </span>
            )}
          </div>
        )}
        {isError && (
          <div
            style={{
              animation: 'fadeInUp 0.3s ease-out',
              color: 'var(--color-redstone)',
              fontSize: 14,
              fontWeight: 700,
              padding: '8px 16px',
              background: 'rgba(255,70,70,0.1)',
              borderRadius: 6,
              border: '1px solid rgba(255,70,70,0.3)',
            }}
          >
            ❌ 正确拼写：<span style={{ fontSize: 20, letterSpacing: 2 }}>{feedback.showAnswer}</span>
          </div>
        )}
      </div>

      {/* Crafting slots */}
      <div className="mc-panel" style={{ padding: 12, overflowX: 'auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 4,
            flexWrap: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {Array.from({ length: totalSlots }).map((_, i) => {
            const letter = slots[i] || '';
            const filled = i < slots.length;

            return (
              <button
                key={i}
                onClick={() => filled && !isError && handleRemoveLetter(i)}
                disabled={!filled || (!!feedback && !isError)}
                style={{
                  flex: '1 1 0',
                  minWidth: 26,
                  maxWidth: 44,
                  height: 42,
                  fontSize: 16,
                  cursor: filled && !feedback ? 'pointer' : 'default',
                  background: isError
                    ? 'rgba(255,70,70,0.15)'
                    : filled
                      ? 'var(--color-surface)'
                      : 'rgba(255,255,255,0.04)',
                  border: isError
                    ? '2px solid var(--color-redstone)'
                    : filled
                      ? '2px solid var(--color-diamond)'
                      : '2px dashed rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  color: isError
                    ? 'var(--color-redstone)'
                    : filled
                      ? '#FFF'
                      : 'transparent',
                  animation: isError ? 'blockShake 0.4s ease-out' : undefined,
                  transition: 'all 0.15s ease',
                }}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Letter pool — responsive grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(48px, 1fr))`,
          gap: 8,
          maxWidth: 360,
          margin: '0 auto',
          padding: '4px 0',
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
                aspectRatio: '1',
                fontSize: 22,
                fontWeight: 700,
                minWidth: 0,
                minHeight: 0,
                padding: 4,
                opacity: isUsed ? 0.15 : 1,
                cursor: isUsed || feedback ? 'default' : 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Action buttons + combo */}
      <div className="flex" style={{ gap: 12, justifyContent: 'center' }}>
        <button
          className="btn btn-ghost"
          onClick={handleClear}
          disabled={slots.length === 0 || !!feedback}
          style={{ fontSize: 10, padding: '8px 20px' }}
        >
          🔄 Clear
        </button>
        {comboCount >= 2 && !feedback && (
          <span
            className="pixel-text-sm combo-pop"
            style={{ color: 'var(--color-diamond)', fontSize: 9, alignSelf: 'center' }}
          >
            🔥 {comboCount}x
          </span>
        )}
        {slots.length < totalSlots && !feedback && (
          <span style={{ color: 'var(--text-muted)', fontSize: 10, alignSelf: 'center' }}>
            Fill all {totalSlots} slots
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
