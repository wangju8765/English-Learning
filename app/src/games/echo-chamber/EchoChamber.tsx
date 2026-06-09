// ============================================================
// Echo Chamber — listen to letter-by-letter spelling, then repeat
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameWord, GameProgress } from '../../types';
import { EchoChamberEngine } from './EchoEngine';
import type { SpellingSpeed } from './EchoEngine';
import { speakWord, speak, stopSpeech } from '../../services/speech';
import { playClick, playBlockBreak, playFail, playGameComplete } from '../../services/sound';
import { useApp } from '../../store/AppContext';

interface EchoChamberProps {
  words: GameWord[];
  onAnswer: (wordId: string, correct: boolean, responseTimeMs: number) => void;
  onComplete: (progress: GameProgress) => void;
}

export default function EchoChamber({ words, onAnswer, onComplete }: EchoChamberProps) {
  const { state } = useApp();
  const soundEnabled = state.settings.soundEnabled;
  const engineRef = useRef<EchoChamberEngine | null>(null);
  const [question, setQuestion] = useState<{
    wordId: string;
    letters: string[];
    correctAnswer: string;
    phonetic?: string;
  } | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    showAnswer: string;
    retryCount: number;
  } | null>(null);
  const [progress, setProgress] = useState<GameProgress>({
    currentQuestion: 0, totalQuestions: 0, correctCount: 0,
    incorrectCount: 0, xpEarned: 0, isComplete: false,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [spellingSpeed, setSpellingSpeed] = useState<SpellingSpeed>('normal');
  const [isSpelling, setIsSpelling] = useState(false); // visual indicator during spell-out
  const answerStartRef = useRef<number>(Date.now());
  const speechIdRef = useRef<number>(0);
  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current);
      if (feedbackSpeechTimerRef.current) clearTimeout(feedbackSpeechTimerRef.current);
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    const engine = new EchoChamberEngine();
    engine.initialize(words);
    engineRef.current = engine;
    setSpellingSpeed(engine.getSpellingSpeed());
    loadQuestion(engine);
    answerStartRef.current = Date.now();
  }, [words]);

  const loadQuestion = useCallback((engine: EchoChamberEngine) => {
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

    setQuestion({
      wordId: q.wordId,
      letters: q.options || [],
      correctAnswer: q.correctAnswer,
      phonetic: q.phonetic,
    });
    setSlots([]);
    setUsedIndices(new Set());
    setFeedback(null);
    answerStartRef.current = Date.now();

    // Speech: word → spell out letter by letter → word
    const speechId = ++speechIdRef.current;
    const intervalMs = engine.getLetterIntervalMs();
    (async () => {
      // Step 1: Read the full word
      await speakWord(q.correctAnswer, 0.9);
      if (speechId !== speechIdRef.current) return;
      await new Promise(r => setTimeout(r, 600));
      if (speechId !== speechIdRef.current) return;

      // Step 2: Spell out letter by letter
      setIsSpelling(true);
      await spellOut(q.correctAnswer, intervalMs, speechId, speechIdRef);
      setIsSpelling(false);
      if (speechId !== speechIdRef.current) return;

      await new Promise(r => setTimeout(r, 400));
      if (speechId !== speechIdRef.current) return;

      // Step 3: Read the full word again
      await speakWord(q.correctAnswer, 0.9);
    })().catch(() => { setIsSpelling(false); });
  }, [onComplete, soundEnabled]);

  const handleListenSpelling = useCallback(() => {
    if (!question || feedback) return;
    stopSpeech();
    const engine = engineRef.current;
    if (!engine) return;

    const speechId = ++speechIdRef.current;
    const intervalMs = engine.getLetterIntervalMs();
    (async () => {
      await speakWord(question.correctAnswer, 0.9);
      if (speechId !== speechIdRef.current) return;
      await new Promise(r => setTimeout(r, 500));
      if (speechId !== speechIdRef.current) return;

      setIsSpelling(true);
      await spellOut(question.correctAnswer, intervalMs, speechId, speechIdRef);
      setIsSpelling(false);
      if (speechId !== speechIdRef.current) return;

      await new Promise(r => setTimeout(r, 300));
      if (speechId !== speechIdRef.current) return;
      await speakWord(question.correctAnswer, 0.9);
    })().catch(() => { setIsSpelling(false); });
  }, [question, feedback]);

  const handleToggleSpeed = useCallback(() => {
    if (!engineRef.current || feedback) return;
    if (soundEnabled) playClick();
    const newSpeed = engineRef.current.toggleSpellingSpeed();
    setSpellingSpeed(newSpeed);
  }, [feedback, soundEnabled]);

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

        setFeedback({ correct: true, showAnswer: result.correctAnswer, retryCount: 0 });
        onAnswer(question.wordId, true, responseTimeMs);
        setProgress(engineRef.current.getProgress());

        feedbackSpeechTimerRef.current = setTimeout(() => {
          speakWord(result.correctAnswer).catch(() => {});
        }, 200);

        nextQuestionTimerRef.current = setTimeout(() => {
          nextQuestionTimerRef.current = null;
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 1500);
      } else {
        if (soundEnabled) playFail();

        const retryCount = engineRef.current.getRetryCount();

        // On retry >= 3, show the correct spelling as reference
        if (retryCount >= 3) {
          const correctLetters = result.correctAnswer.toLowerCase().split('');
          setSlots(correctLetters);
        }

        setFeedback({
          correct: false,
          showAnswer: result.correctAnswer,
          retryCount,
        });

        onAnswer(question.wordId, false, responseTimeMs);
        setProgress(engineRef.current.getProgress());

        // Speak the correct word
        feedbackSpeechTimerRef.current = setTimeout(() => {
          speakWord(result.correctAnswer, 0.85).catch(() => {});
        }, 400);

        // Replay the spelling — longer display time for learning
        nextQuestionTimerRef.current = setTimeout(() => {
          nextQuestionTimerRef.current = null;
          if (engineRef.current) loadQuestion(engineRef.current);
        }, retryCount >= 3 ? 4000 : 3000);
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
          🎤 Echo Mastered!
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
          Tuning echo chamber...
        </span>
      </div>
    );
  }

  const totalSlots = question.correctAnswer.length;
  const retryCount = feedback && !feedback.correct ? feedback.retryCount : 0;

  // Theme: purple for echo chamber
  const accentColor = '#B388FF';
  const bgGradient = 'linear-gradient(180deg, rgba(179,136,255,0.06) 0%, rgba(130,80,220,0.02) 100%)';
  const borderColor = 'rgba(179,136,255,0.15) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(179,136,255,0.08)';

  // Escalating UI based on retry count
  let panelBg = bgGradient;
  let panelBorder = borderColor;
  let retryHint: string | null = null;
  if (retryCount === 1 || retryCount === 2) {
    retryHint = '再听一次字母的发音，慢慢来！';
    panelBg = 'linear-gradient(180deg, rgba(255,193,7,0.06) 0%, rgba(200,150,0,0.02) 100%)';
    panelBorder = 'rgba(255,193,7,0.2) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(255,193,7,0.1)';
  } else if (retryCount >= 3) {
    retryHint = '没关系，看看正确拼写，下次一定行！';
    panelBg = 'linear-gradient(180deg, rgba(255,82,82,0.06) 0%, rgba(180,50,50,0.02) 100%)';
    panelBorder = 'rgba(255,82,82,0.2) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(255,82,82,0.1)';
  }

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
              background: `linear-gradient(90deg, #7C4DFF, ${accentColor})`,
            }}
          />
        </div>
      </div>

      {/* Echo Chamber Panel */}
      <div
        className="mc-panel"
        style={{
          padding: '20px 16px',
          textAlign: 'center',
          borderColor: panelBorder,
          background: panelBg,
        }}
      >
        <div className="pixel-text-sm" style={{ color: 'var(--text-muted)', fontSize: 7, marginBottom: 12 }}>
          🎤 ECHO CHAMBER
        </div>

        {/* Spelling animation indicator */}
        <div
          style={{
            fontSize: 40,
            filter: 'drop-shadow(0 0 8px rgba(179,136,255,0.3))',
            animation: isSpelling ? 'pulse 0.6s ease-in-out infinite' : undefined,
            marginBottom: 8,
          }}
        >
          🎤
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, margin: '0 auto', lineHeight: 1.6 }}>
          听字母逐个拼读，然后拼出单词
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6, marginTop: 4 }}>
          Listen to the spelling, then repeat
        </div>

        {/* Retry hint */}
        {retryHint && (
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              fontWeight: 600,
              color: retryCount >= 3 ? 'var(--color-redstone)' : 'var(--color-gold)',
              animation: 'fadeInUp 0.3s ease-out',
            }}
          >
            {retryHint}
          </div>
        )}

        {/* Show correct spelling when struggling (retry >= 3) */}
        {retryCount >= 3 && feedback && (
          <div
            style={{
              marginTop: 10,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3,
              color: 'var(--color-redstone)',
              padding: '8px 16px',
              background: 'rgba(255,70,70,0.1)',
              borderRadius: 6,
              border: '1px solid rgba(255,70,70,0.3)',
              animation: 'fadeInUp 0.3s ease-out',
            }}
          >
            {feedback.showAnswer.toUpperCase()}
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
        {retryCount > 0 && retryCount < 3 && (
          <div
            style={{
              fontSize: 10,
              color: 'var(--color-gold)',
              marginTop: 4,
            }}
          >
            🔄 第 {retryCount} 次重试
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
            const isShowAnswer = retryCount >= 3 && !!feedback;

            return (
              <button
                key={i}
                className={filled ? 'stone-block' : 'crafting-slot'}
                onClick={() => filled && !isError && !isShowAnswer && handleRemoveLetter(i)}
                disabled={!filled || (!!feedback && !isError) || isShowAnswer}
                style={{
                  flex: '1 1 0',
                  minWidth: 26,
                  maxWidth: 44,
                  height: 42,
                  fontSize: 16,
                  cursor: filled && !feedback ? 'pointer' : 'default',
                  background: isError
                    ? 'rgba(255,70,70,0.15)'
                    : isShowAnswer
                      ? 'rgba(255,70,70,0.1)'
                      : filled
                        ? 'var(--color-surface)'
                        : 'rgba(255,255,255,0.04)',
                  border: isError || isShowAnswer
                    ? '2px solid var(--color-redstone)'
                    : filled
                      ? '2px solid var(--color-diamond)'
                      : '2px dashed rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  color: isError || isShowAnswer
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

      {/* Action buttons */}
      <div className="flex" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-ghost"
          onClick={handleListenSpelling}
          disabled={!!feedback}
          style={{
            fontSize: 10,
            padding: '8px 14px',
            borderColor: feedback ? undefined : 'rgba(179,136,255,0.3)',
          }}
        >
          🔁 Replay
        </button>

        <button
          className="btn btn-ghost"
          onClick={handleToggleSpeed}
          disabled={!!feedback}
          style={{
            fontSize: 10,
            padding: '8px 14px',
            color: spellingSpeed === 'slow' ? 'var(--color-gold)' : undefined,
          }}
        >
          {spellingSpeed === 'normal' ? '🐢 Slow' : '🐇 Normal'}
        </button>

        <button
          className="btn btn-ghost"
          onClick={handleClear}
          disabled={slots.length === 0 || !!feedback}
          style={{ fontSize: 10, padding: '8px 14px' }}
        >
          🔄 Clear
        </button>
      </div>

      {slots.length < totalSlots && !feedback && (
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            Fill all {totalSlots} slots to auto-submit
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Spell out a word letter by letter via TTS.
 * Each letter is spoken individually with a pause between.
 */
async function spellOut(
  word: string,
  intervalMs: number,
  speechId: number,
  speechIdRef: React.MutableRefObject<number>,
): Promise<void> {
  const letters = word.split('');
  for (const letter of letters) {
    if (speechId !== speechIdRef.current) return;
    await speak(letter, 0.7, 'en');
    if (speechId !== speechIdRef.current) return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-col" style={{ alignItems: 'center' }}>
      <div className="pixel-text-sm" style={{ fontSize: 16, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
