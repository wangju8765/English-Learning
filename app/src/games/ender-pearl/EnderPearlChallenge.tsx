// ============================================================
// Ender Pearl Challenge — timed typing game
// See the Chinese definition, type the English word before the pearl lands
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
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLimitRef = useRef<number>(8);
  const answerStartRef = useRef<number>(Date.now());

  const [question, setQuestion] = useState<{
    wordId: string;
    definition: string;
    phonetic?: string;
    correctAnswer: string;
  } | null>(null);
  const [userInput, setUserInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(8);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    showAnswer: string;
    userAnswer: string;
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
  const handleSubmitRef = useRef<(input: string, timedOut?: boolean) => void>(() => {});
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;

  useEffect(() => {
    const engine = new EnderPearlEngine();
    engine.initialize(words);
    engineRef.current = engine;
    loadQuestion(engine);
    answerStartRef.current = Date.now();
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
        // Auto-submit whatever the user has typed
        if (!submittingRef.current) {
          submittingRef.current = true;
          setUserInput((current) => {
            handleSubmitRef.current(current, true); // true = timed out
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
      correctAnswer: q.correctAnswer,
    });
    setUserInput('');
    setFeedback(null);
    setComboCount(engine.getComboCount());
    setProgress(engine.getProgress());
    submittingRef.current = false;
    answerStartRef.current = Date.now();

    // Focus input after render
    setTimeout(() => inputRef.current?.focus(), 100);

    // Start timer
    const timeLimit = engine.getTimeLimit();
    startTimer(timeLimit);

    // Read the English word first as auditory hint, then Chinese instruction & definition
    (async () => {
      await speakWord(q.correctAnswer, 0.85);
      await new Promise(r => setTimeout(r, 400));
      await speakSequence([
        { text: '请输入这个单词', lang: 'zh', pauseMs: 400 },
        { text: q.prompt, lang: 'zh' },
      ]);
    })().catch(() => {});
  }, [onComplete, soundEnabled, clearTimer, startTimer]);

  const handleSubmit = useCallback(
    (input: string, timedOut: boolean = false) => {
      if (!engineRef.current || !question || feedback) return;

      const answer = input.trim();
      if (!answer && !timedOut) return; // Don't submit empty input unless timed out

      clearTimer();

      const responseTimeMs = Date.now() - answerStartRef.current;
      const timeRatio = timedOut ? 0 : timeLeftRef.current / timeLimitRef.current;
      const result = engineRef.current.submitAnswer(answer || '(no answer)', timeRatio);

      if (result.correct) {
        if (soundEnabled) playBlockBreak();

        setFeedback({
          correct: true,
          showAnswer: result.correctAnswer,
          userAnswer: answer,
          xp: result.xpEarned,
          combo: engineRef.current.getComboCount(),
        });

        onAnswer(question.wordId, true, responseTimeMs);
        setProgress(engineRef.current.getProgress());
        setComboCount(engineRef.current.getComboCount());

        // Speak the word after a short delay
        setTimeout(() => {
          speakWord(result.correctAnswer).catch(() => {});
        }, 200);

        setTimeout(() => {
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 1500);
      } else {
        if (soundEnabled) playFail();

        setFeedback({
          correct: false,
          showAnswer: result.correctAnswer,
          userAnswer: answer,
          xp: 0,
          combo: 0,
        });

        onAnswer(question.wordId, false, responseTimeMs);
        setProgress(engineRef.current.getProgress());
        setComboCount(0);

        // Speak the correct word
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

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !feedback) {
        e.preventDefault();
        if (soundEnabled) playClick();
        submittingRef.current = true;
        handleSubmit(userInput);
      }
    },
    [userInput, feedback, handleSubmit, soundEnabled]
  );

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
            width: `${timeRatio * 100}%`,
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
            filter: timeRatio < 0.3 ? 'grayscale(0)' : 'grayscale(0.3)',
            transition: 'filter 0.3s ease',
          }}
        >
          🎯
        </span>
      </div>

      {/* Definition panel — what to type */}
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
          🎯 TYPE THIS WORD:
        </div>
        <div
          style={{
            fontSize: 18,
            color: 'var(--color-gold)',
            marginBottom: question.phonetic ? 6 : 12,
            animation: 'fadeInUp 0.3s ease-out',
          }}
        >
          {question.definition}
        </div>
        {question.phonetic && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            /{question.phonetic}/
          </div>
        )}

        {/* Letter count hint */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 4,
            marginTop: 8,
          }}
        >
          {Array.from({ length: totalSlots }).map((_, i) => {
            const typed = userInput[i] || '';
            const dimmed = isError;
            return (
              <span
                key={i}
                style={{
                  fontSize: 18,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: dimmed
                    ? 'var(--color-redstone)'
                    : typed
                      ? 'var(--color-xp)'
                      : 'rgba(255,255,255,0.2)',
                  minWidth: 18,
                  textAlign: 'center',
                  transition: 'color 0.15s ease',
                }}
              >
                {dimmed ? (question.correctAnswer[i] || '_') : (typed || '_')}
              </span>
            );
          })}
        </div>
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

      {/* Text input — command block style */}
      <div className="mc-panel" style={{ padding: 12 }}>
        <input
          ref={inputRef}
          type="text"
          value={isError ? feedback.showAnswer : userInput}
          onChange={(e) => {
            if (feedback) return;
            setUserInput(e.target.value.toLowerCase().replace(/[^a-z]/g, ''));
          }}
          onKeyDown={handleInputKeyDown}
          disabled={!!feedback}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={isError ? '' : 'Type the word...'}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: 22,
            fontFamily: 'var(--font-mono, "Courier New", monospace)',
            letterSpacing: 4,
            background: isError
              ? 'rgba(255,70,70,0.1)'
              : 'rgba(0,0,0,0.3)',
            border: isError
              ? '2px solid var(--color-redstone)'
              : '2px solid rgba(138, 43, 226, 0.4)',
            borderRadius: 4,
            color: isError ? 'var(--color-redstone)' : '#FFF',
            textAlign: 'center',
            outline: 'none',
            caretColor: 'var(--color-gold)',
            transition: 'border-color 0.2s ease, background 0.2s ease',
          }}
        />
      </div>

      {/* Combo + action hint */}
      <div className="flex-center" style={{ gap: 16 }}>
        {comboCount >= 2 && !feedback && (
          <span
            className="pixel-text-sm combo-pop"
            style={{ color: 'var(--color-diamond)', fontSize: 9 }}
          >
            🔥 {comboCount}x
          </span>
        )}
        {!feedback && (
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            Press Enter to submit
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
