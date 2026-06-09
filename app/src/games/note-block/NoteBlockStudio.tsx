// ============================================================
// Note Block Studio — listen to the word, then spell it
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameWord, GameProgress } from '../../types';
import { NoteBlockEngine } from './NoteBlockEngine';
import type { NoteBlockTier } from './NoteBlockEngine';
import { speakWord, speakSequence, speak, stopSpeech } from '../../services/speech';
import { playClick, playBlockBreak, playFail, playGameComplete } from '../../services/sound';
import { useApp } from '../../store/AppContext';

interface NoteBlockStudioProps {
  words: GameWord[];
  onAnswer: (wordId: string, correct: boolean, responseTimeMs: number) => void;
  onComplete: (progress: GameProgress) => void;
}

export default function NoteBlockStudio({ words, onAnswer, onComplete }: NoteBlockStudioProps) {
  const { state } = useApp();
  const soundEnabled = state.settings.soundEnabled;
  const engineRef = useRef<NoteBlockEngine | null>(null);
  const [question, setQuestion] = useState<{
    wordId: string;
    definition: string;
    phonetic?: string;
    letters: string[];
    correctAnswer: string;
    tier: NoteBlockTier;
  } | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    showAnswer: string;
    userAnswer?: string;
  } | null>(null);
  const [progress, setProgress] = useState<GameProgress>({
    currentQuestion: 0, totalQuestions: 0, correctCount: 0,
    incorrectCount: 0, xpEarned: 0, isComplete: false,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const answerStartRef = useRef<number>(Date.now());
  const speechIdRef = useRef<number>(0);
  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current);
      if (feedbackSpeechTimerRef.current) clearTimeout(feedbackSpeechTimerRef.current);
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    const engine = new NoteBlockEngine();
    engine.initialize(words);
    engineRef.current = engine;
    loadQuestion(engine);
    answerStartRef.current = Date.now();
  }, [words]);

  const loadQuestion = useCallback((engine: NoteBlockEngine) => {
    // Clear pending timers
    if (nextQuestionTimerRef.current) {
      clearTimeout(nextQuestionTimerRef.current);
      nextQuestionTimerRef.current = null;
    }
    if (feedbackSpeechTimerRef.current) {
      clearTimeout(feedbackSpeechTimerRef.current);
      feedbackSpeechTimerRef.current = null;
    }
    stopSpeech();

    const q = engine.nextQuestion();
    if (!q) {
      setIsComplete(true);
      setProgress(engine.getProgress());
      onComplete(engine.getProgress());
      if (soundEnabled) playGameComplete();
      return;
    }

    const tier = engine.getCurrentTier();

    setQuestion({
      wordId: q.wordId,
      definition: q.prompt,
      phonetic: q.phonetic,
      letters: q.options || [],
      correctAnswer: q.correctAnswer,
      tier,
    });
    setSlots([]);
    setUsedIndices(new Set());
    setFeedback(null);
    setHintUsed(false);
    answerStartRef.current = Date.now();

    // Speech: different pattern per tier
    const speechId = ++speechIdRef.current;
    (async () => {
      if (tier === 'green') {
        // Green tier: word → instruction → definition → word (same as CraftingTable)
        await speakWord(q.correctAnswer, 0.85);
        if (speechId !== speechIdRef.current) return;
        await new Promise(r => setTimeout(r, 400));
        if (speechId !== speechIdRef.current) return;
        await speakSequence([
          { text: '请拼出这个单词', lang: 'zh', pauseMs: 400 },
          { text: q.prompt, lang: 'zh', pauseMs: 600 },
        ]);
        if (speechId !== speechIdRef.current) return;
        await speakWord(q.correctAnswer, 0.85);
      } else {
        // Orange tier: word → instruction → word (NO definition — pure listening)
        await speakWord(q.correctAnswer, 0.9);
        if (speechId !== speechIdRef.current) return;
        await new Promise(r => setTimeout(r, 500));
        if (speechId !== speechIdRef.current) return;
        await speak('根据读音拼出来', 1.0, 'zh');
        if (speechId !== speechIdRef.current) return;
        await new Promise(r => setTimeout(r, 500));
        if (speechId !== speechIdRef.current) return;
        await speakWord(q.correctAnswer, 0.9);
      }
    })().catch(() => {});
  }, [onComplete, soundEnabled]);

  // Replay the word audio (orange tier only — useful "listen again")
  const handleListenAgain = useCallback(() => {
    if (!question || feedback) return;
    stopSpeech();
    speakWord(question.correctAnswer, 0.9).catch(() => {});
  }, [question, feedback]);

  // Hint: reveal the first letter
  const handleHint = useCallback(() => {
    if (!question || feedback || hintUsed) return;
    if (soundEnabled) playClick();

    const firstLetter = question.correctAnswer[0].toLowerCase();
    // Find the index of the first occurrence of this letter in the pool
    const poolIndex = question.letters.findIndex(
      (l, i) => l === firstLetter && !usedIndices.has(i)
    );

    if (poolIndex >= 0) {
      const newSlots = [...slots, firstLetter];
      const newUsed = new Set(usedIndices);
      newUsed.add(poolIndex);
      setSlots(newSlots);
      setUsedIndices(newUsed);
      setHintUsed(true);
    }
  }, [question, slots, usedIndices, feedback, hintUsed, soundEnabled]);

  const handleSubmitRef = useRef<(currentSlots: string[]) => void>(() => {});

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
      const responseTimeMs = Date.now() - answerStartRef.current;
      const result = engineRef.current.submitAnswer(answer);

      if (result.correct) {
        if (soundEnabled) playBlockBreak();

        setFeedback({ correct: true, showAnswer: result.correctAnswer });
        onAnswer(question.wordId, true, responseTimeMs);
        setProgress(engineRef.current.getProgress());

        // Speak the word for reinforcement
        feedbackSpeechTimerRef.current = setTimeout(() => {
          speakWord(result.correctAnswer).catch(() => {});
        }, 200);

        nextQuestionTimerRef.current = setTimeout(() => {
          nextQuestionTimerRef.current = null;
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
        });

        onAnswer(question.wordId, false, responseTimeMs);
        setProgress(engineRef.current.getProgress());

        // Slow-read the correct word
        feedbackSpeechTimerRef.current = setTimeout(() => {
          speakWord(result.correctAnswer, 0.85).catch(() => {});
        }, 400);

        // Longer display for learning
        nextQuestionTimerRef.current = setTimeout(() => {
          nextQuestionTimerRef.current = null;
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 3500);
      }
    },
    [question, feedback, onAnswer, loadQuestion, soundEnabled]
  );

  handleSubmitRef.current = handleSubmit;

  const handleClear = useCallback(() => {
    if (feedback) return;
    if (soundEnabled) playClick();
    setSlots([]);
    setUsedIndices(new Set());
  }, [feedback, soundEnabled]);

  // --- Completion screen ---
  if (isComplete) {
    return (
      <div className="flex-col gap-md" style={{ alignItems: 'center', padding: 32 }}>
        <div className="pixel-text" style={{ color: 'var(--color-gold)', fontSize: 16 }}>
          🎵 Performance Complete!
        </div>
        <div className="flex" style={{ gap: 32, marginTop: 8 }}>
          <StatBox label="Correct" value={`${progress.correctCount}`} color="var(--color-xp)" />
          <StatBox label="Misses" value={`${progress.incorrectCount}`} color="var(--color-redstone)" />
          <StatBox label="XP" value={`+${progress.xpEarned}`} color="var(--color-gold)" />
        </div>
      </div>
    );
  }

  // --- Loading state ---
  if (!question) {
    return (
      <div className="flex-center" style={{ height: 200 }}>
        <span className="pixel-text" style={{ color: 'var(--text-muted)' }}>
          Tuning note blocks...
        </span>
      </div>
    );
  }

  const totalSlots = question.correctAnswer.length;
  const tier = question.tier;

  // Tier colors
  const tierAccentColor = tier === 'green' ? 'var(--color-xp)' : 'var(--color-gold)';
  const tierBgGradient = tier === 'green'
    ? 'linear-gradient(180deg, rgba(128,255,32,0.06) 0%, rgba(80,200,20,0.02) 100%)'
    : 'linear-gradient(180deg, rgba(255,193,7,0.06) 0%, rgba(200,150,0,0.02) 100%)';
  const tierBorderColor = tier === 'green'
    ? 'rgba(128,255,32,0.15) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(128,255,32,0.08)'
    : 'rgba(255,193,7,0.15) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(255,193,7,0.08)';

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
              background: `linear-gradient(90deg, ${tier === 'green' ? 'var(--color-xp-dim)' : '#B8860B'}, ${tierAccentColor})`,
            }}
          />
        </div>
      </div>

      {/* Tier indicator */}
      <div style={{ textAlign: 'center' }}>
        <span
          className="pixel-text-sm"
          style={{
            fontSize: 7,
            color: tierAccentColor,
            padding: '3px 10px',
            border: `1px solid ${tierAccentColor}33`,
            borderRadius: 8,
            background: `${tierAccentColor}11`,
          }}
        >
          {tier === 'green' ? '🟢 GREEN NOTE' : '🟠 ORANGE NOTE'}
        </span>
      </div>

      {/* Note Block Panel — shows definition (green) or audio-only prompt (orange) */}
      <div
        className="mc-panel"
        style={{
          padding: tier === 'green' ? '20px 16px' : '24px 16px',
          textAlign: 'center',
          borderColor: tierBorderColor,
          background: tierBgGradient,
        }}
      >
        <div className="pixel-text-sm" style={{ color: 'var(--text-muted)', fontSize: 7, marginBottom: 12 }}>
          🎵 NOTE BLOCK STUDIO
        </div>

        {tier === 'green' ? (
          // Green Tier: show definition + phonetic (warm-up)
          <>
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
          </>
        ) : (
          // Orange Tier: audio only — note block animation placeholder
          <div className="flex-col" style={{ alignItems: 'center', gap: 8, animation: 'fadeInUp 0.3s ease-out' }}>
            {/* Animated note block icon */}
            <div
              style={{
                fontSize: 40,
                filter: 'drop-shadow(0 0 8px rgba(255,193,7,0.3))',
              }}
            >
              🎵
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.6 }}>
              仔细听 — 根据读音拼出单词
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>
              Listen carefully and spell the word
            </div>
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
              fontSize: 13,
            }}
          >
            ✅ 正确！{feedback.showAnswer}
          </div>
        )}
        {feedback && !feedback.correct && (
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
            const isError = feedback && !feedback.correct;
            const isHintLetter = hintUsed && i === 0;

            return (
              <button
                key={i}
                className={filled ? 'stone-block' : 'crafting-slot'}
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
                      ? `2px solid ${isHintLetter ? tierAccentColor : 'var(--color-diamond)'}`
                      : '2px dashed rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  color: isError
                    ? 'var(--color-redstone)'
                    : isHintLetter
                      ? tierAccentColor
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

      {/* Letter pool */}
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
              {letter.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Action buttons — different for green vs orange tier */}
      <div className="flex" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* Listen Again — always available */}
        <button
          className="btn btn-ghost"
          onClick={handleListenAgain}
          disabled={!!feedback}
          style={{ fontSize: 10, padding: '8px 14px' }}
        >
          🔊 Listen
        </button>

        {/* Hint — only relevant in orange tier */}
        {!hintUsed && (
          <button
            className="btn btn-ghost"
            onClick={handleHint}
            disabled={slots.length > 0 || !!feedback}
            style={{
              fontSize: 10,
              padding: '8px 14px',
              opacity: slots.length > 0 || feedback ? 0.4 : 1,
            }}
          >
            💡 Hint
          </button>
        )}

        {/* Clear */}
        <button
          className="btn btn-ghost"
          onClick={handleClear}
          disabled={slots.length === 0 || !!feedback}
          style={{ fontSize: 10, padding: '8px 14px' }}
        >
          🔄 Clear
        </button>
      </div>

      {/* Help text */}
      {slots.length < totalSlots && !feedback && (
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            Fill all {totalSlots} slots to auto-submit
          </span>
        </div>
      )}

      {/* Combo indicator */}
      {engineRef.current && engineRef.current.getComboCount() >= 3 && !feedback && (
        <div style={{ textAlign: 'center' }}>
          <span className="pixel-text-sm" style={{ color: 'var(--color-gold)', fontSize: 9 }}>
            🔥 {engineRef.current.getComboCount()}x Combo!
          </span>
        </div>
      )}
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
