// ============================================================
// Note Block Studio — 3-stage scaffolding for listen→spell
// Stage 1 🟢 Syllables: syllable groups + vowel highlights, repeat N rounds (= syllable count)
// Stage 2 🟡 Copy:      full template shown, guided clicking — solidify overall shape
// Stage 3 🟠 Independent: pure audio, no visual help — real test
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameWord, GameProgress } from '../../types';
import { NoteBlockEngine } from './NoteBlockEngine';
import type { NoteBlockStage, StageQuestion } from './NoteBlockEngine';
import { speakWord, speak, stopSpeech } from '../../services/speech';
import { playClick, playBlockBreak, playFail, playGameComplete } from '../../services/sound';
import { useApp } from '../../store/AppContext';

interface NoteBlockStudioProps {
  words: GameWord[];
  onAnswer: (wordId: string, correct: boolean, responseTimeMs: number) => void;
  onComplete: (progress: GameProgress) => void;
}

// Note: Stage labels are tied to content, not number.
// Stage 1 = SYLLABLES (was "assisted"), Stage 2 = COPY, Stage 3 unchanged
const STAGE_LABELS: Record<NoteBlockStage, string> = {
  1: 'SYLLABLES',
  2: 'COPY',
  3: 'INDEPENDENT',
};

const STAGE_EMOJI: Record<NoteBlockStage, string> = {
  1: '🟢',
  2: '🟡',
  3: '🟠',
};

const STAGE_INSTRUCTIONS: Record<NoteBlockStage, string> = {
  1: '注意每个音节的发音',
  2: '对照下面的拼写点击字母',
  3: '根据读音拼出来',
};

export default function NoteBlockStudio({ words, onAnswer, onComplete }: NoteBlockStudioProps) {
  const { state } = useApp();
  const soundEnabled = state.settings.soundEnabled;
  const engineRef = useRef<NoteBlockEngine | null>(null);
  const [stageQuestion, setStageQuestion] = useState<StageQuestion | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [usedIndices, setUsedIndices] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    showAnswer: string;
  } | null>(null);
  const [progress, setProgress] = useState<GameProgress>({
    currentQuestion: 0, totalQuestions: 0, correctCount: 0,
    incorrectCount: 0, xpEarned: 0, isComplete: false,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [rejectLetter, setRejectLetter] = useState<number | null>(null); // Stage 1: flash rejected letter
  const answerStartRef = useRef<number>(Date.now());
  const speechIdRef = useRef<number>(0);
  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (nextQuestionTimerRef.current) { clearTimeout(nextQuestionTimerRef.current); nextQuestionTimerRef.current = null; }
    if (feedbackSpeechTimerRef.current) { clearTimeout(feedbackSpeechTimerRef.current); feedbackSpeechTimerRef.current = null; }
    stopSpeech();

    const q = engine.nextQuestion();
    if (!q) {
      setIsComplete(true);
      setProgress(engine.getProgress());
      onComplete(engine.getProgress());
      if (soundEnabled) playGameComplete();
      return;
    }

    const sq = engine.getStageQuestion();
    setStageQuestion(sq);
    setSlots([]);
    setUsedIndices(new Set());
    setFeedback(null);
    setHintUsed(false);
    answerStartRef.current = Date.now();

    // Speech varies by stage
    const speechId = ++speechIdRef.current;
    const stage = engine.getCurrentStage();
    (async () => {
      await speakWord(q.correctAnswer, 0.9);
      if (speechId !== speechIdRef.current) return;
      await new Promise(r => setTimeout(r, 400));
      if (speechId !== speechIdRef.current) return;

      if (stage === 2) {
        // Stage 2 (Copy): word → instruction → definition → word
        await speak(STAGE_INSTRUCTIONS[stage], 1.0, 'zh');
        if (speechId !== speechIdRef.current) return;
        await new Promise(r => setTimeout(r, 300));
        if (speechId !== speechIdRef.current) return;
        await speak(q.prompt, 1.0, 'zh');
      } else {
        // Stage 1/3: word → instruction → word
        await speak(STAGE_INSTRUCTIONS[stage], 1.0, 'zh');
      }
      if (speechId !== speechIdRef.current) return;
      await new Promise(r => setTimeout(r, 500));
      if (speechId !== speechIdRef.current) return;
      await speakWord(q.correctAnswer, 0.9);
    })().catch(() => {});
  }, [onComplete, soundEnabled]);

  // --- Stage 1: per-syllable audio ---
  const handleSyllableClick = useCallback((syllableLetters: string[]) => {
    if (feedback) return;
    stopSpeech();
    const syllableText = syllableLetters.join('');
    // Read the syllable as "s y l l a b l e" not as a word
    speak(syllableText, 0.8, 'en').catch(() => {});
  }, [feedback]);

  // --- Listen again ---
  const handleListenAgain = useCallback(() => {
    if (!stageQuestion || feedback) return;
    stopSpeech();
    speakWord(stageQuestion.correctAnswer, 0.9).catch(() => {});
  }, [stageQuestion, feedback]);

  // --- Hint (Stage 1/3): reveal first letter ---
  const handleHint = useCallback(() => {
    if (!stageQuestion || feedback || hintUsed) return;
    if (soundEnabled) playClick();

    const firstLetter = stageQuestion.correctAnswer[0].toLowerCase();
    const poolIndex = stageQuestion.letters.findIndex(
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
  }, [stageQuestion, slots, usedIndices, feedback, hintUsed, soundEnabled]);

  const handleSubmitRef = useRef<(currentSlots: string[]) => void>(() => {});

  // --- Letter click (behavior differs by stage) ---
  const handleLetterClick = useCallback(
    (letter: string, index: number) => {
      if (!stageQuestion || usedIndices.has(index) || feedback) return;

      const stage = stageQuestion.stage;

      if (stage === 2) {
        // Stage 2 (Copy): only accept letters that match remaining unfilled template positions
        const template = stageQuestion.correctAnswer.split('');
        const slotArray = [...slots];
        // Pad slots to template length
        while (slotArray.length < template.length) slotArray.push('');

        let matched = false;
        for (let pos = 0; pos < template.length; pos++) {
          if (slotArray[pos] === '' && template[pos] === letter) {
            // Fill this position
            slotArray[pos] = letter;
            matched = true;
            break;
          }
        }

        if (!matched) {
          // Reject: flash the letter briefly
          if (soundEnabled) playFail();
          setRejectLetter(index);
          setTimeout(() => setRejectLetter(null), 400);
          return;
        }

        if (soundEnabled) playClick();

        // Update slots and usedIndices
        const newSlotsFiltered = slotArray.filter(l => l !== '');
        const newUsed = new Set(usedIndices);
        newUsed.add(index);

        setSlots(newSlotsFiltered);
        setUsedIndices(newUsed);

        if (newSlotsFiltered.length === stageQuestion.correctAnswer.length) {
          setTimeout(() => { handleSubmitRef.current(newSlotsFiltered); }, 300);
        }
      } else {
        // Stage 2/3: normal letter clicking (same as CraftingTable)
        if (soundEnabled) playClick();

        const newSlots = [...slots, letter];
        const newUsed = new Set(usedIndices);
        newUsed.add(index);

        setSlots(newSlots);
        setUsedIndices(newUsed);

        if (newSlots.length === stageQuestion.correctAnswer.length) {
          setTimeout(() => { handleSubmitRef.current(newSlots); }, 300);
        }
      }
    },
    [stageQuestion, slots, usedIndices, feedback, soundEnabled]
  );

  const handleRemoveLetter = useCallback(
    (slotIndex: number) => {
      if (feedback) return;
      if (soundEnabled) playClick();

      const newSlots = slots.filter((_, i) => i !== slotIndex);

      const rebuiltUsed = new Set<number>();
      const remaining = [...(stageQuestion?.letters || [])];
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
    [slots, stageQuestion, feedback, soundEnabled]
  );

  const handleSubmit = useCallback(
    (currentSlots: string[]) => {
      if (!engineRef.current || !stageQuestion || feedback) return;

      const answer = currentSlots.join('');
      const responseTimeMs = Date.now() - answerStartRef.current;
      const result = engineRef.current.submitAnswer(answer);

      if (result.correct) {
        if (soundEnabled) playBlockBreak();

        setFeedback({ correct: true, showAnswer: result.correctAnswer });
        onAnswer(stageQuestion.wordId, true, responseTimeMs);
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

        const correctLetters = result.correctAnswer.toLowerCase().split('');
        setSlots(correctLetters);

        setFeedback({
          correct: false,
          showAnswer: result.correctAnswer,
        });

        onAnswer(stageQuestion.wordId, false, responseTimeMs);
        setProgress(engineRef.current.getProgress());

        // For Stage 2 error: replay the syllable audio for incorrect positions
        // (handled by the feedback display below)

        feedbackSpeechTimerRef.current = setTimeout(() => {
          speakWord(result.correctAnswer, 0.85).catch(() => {});
        }, 400);

        nextQuestionTimerRef.current = setTimeout(() => {
          nextQuestionTimerRef.current = null;
          if (engineRef.current) loadQuestion(engineRef.current);
        }, 3500);
      }
    },
    [stageQuestion, feedback, onAnswer, loadQuestion, soundEnabled]
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

  if (!stageQuestion) {
    return (
      <div className="flex-center" style={{ height: 200 }}>
        <span className="pixel-text" style={{ color: 'var(--text-muted)' }}>
          Tuning note blocks...
        </span>
      </div>
    );
  }

  const stage = stageQuestion.stage;
  const totalSlots = stageQuestion.correctAnswer.length;
  const wordIdx = engineRef.current?.getCurrentWordIndex() ?? 0;
  const totalWords = engineRef.current?.getTotalWords() ?? 0;

  // Stage theme colors
  const stageColors: Record<NoteBlockStage, { accent: string; bg: string; border: string; dim: string }> = {
    1: {
      accent: 'var(--color-xp)',
      bg: 'linear-gradient(180deg, rgba(128,255,32,0.06) 0%, rgba(80,200,20,0.02) 100%)',
      border: 'rgba(128,255,32,0.15) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(128,255,32,0.08)',
      dim: 'var(--color-xp-dim)',
    },
    2: {
      accent: 'var(--color-gold)',
      bg: 'linear-gradient(180deg, rgba(255,193,7,0.06) 0%, rgba(200,150,0,0.02) 100%)',
      border: 'rgba(255,193,7,0.15) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(255,193,7,0.08)',
      dim: '#B8860B',
    },
    3: {
      accent: '#FF9800',
      bg: 'linear-gradient(180deg, rgba(255,152,0,0.06) 0%, rgba(200,100,0,0.02) 100%)',
      border: 'rgba(255,152,0,0.15) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(255,152,0,0.08)',
      dim: '#E65100',
    },
  };

  const colors = stageColors[stage];

  return (
    <div className="flex-col gap-md" style={{ padding: 16 }}>
      {/* Progress header */}
      <div>
        <div className="flex-between" style={{ marginBottom: 4 }}>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            Word {wordIdx + 1}/{totalWords} · Stage {stage}/3
          </span>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            ⭐ {progress.xpEarned} XP
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: `${((wordIdx * 3 + stage) / (totalWords * 3)) * 100}%`,
              background: `linear-gradient(90deg, ${colors.dim}, ${colors.accent})`,
            }}
          />
        </div>
      </div>

      {/* Stage indicator */}
      <div style={{ textAlign: 'center' }}>
        <span
          className="pixel-text-sm"
          style={{
            fontSize: 7,
            color: colors.accent,
            padding: '3px 10px',
            border: `1px solid ${colors.accent}33`,
            borderRadius: 8,
            background: `${colors.accent}11`,
          }}
        >
          {STAGE_EMOJI[stage]} {STAGE_LABELS[stage]}
        </span>
      </div>

      {/* Main panel — content varies by stage */}
      <div
        className="mc-panel"
        style={{
          padding: '20px 16px',
          textAlign: 'center',
          borderColor: colors.border,
          background: colors.bg,
        }}
      >
        <div className="pixel-text-sm" style={{ color: 'var(--text-muted)', fontSize: 7, marginBottom: 12 }}>
          🎵 NOTE BLOCK STUDIO
        </div>

        {/* Stage 1: Syllable groups + vowel highlights */}
        {stage === 1 && stageQuestion.syllables && (
          <>
            {/* Round counter */}
            {stageQuestion.totalSyllableRounds && stageQuestion.totalSyllableRounds > 1 && (
              <div style={{ fontSize: 9, color: colors.accent, marginBottom: 8 }}>
                Round {stageQuestion.syllableRound! + 1}/{stageQuestion.totalSyllableRounds}
              </div>
            )}

            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12 }}>
              {STAGE_INSTRUCTIONS[1]}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 4,
                animation: 'fadeInUp 0.3s ease-out',
              }}
            >
              {stageQuestion.syllables.map((syl, si) => (
                <button
                  key={si}
                  className="mc-panel"
                  onClick={() => handleSyllableClick(syl.letters)}
                  disabled={!!feedback}
                  style={{
                    display: 'flex',
                    gap: 2,
                    padding: '8px 10px',
                    cursor: feedback ? 'default' : 'pointer',
                    background: 'rgba(128,255,32,0.06)',
                    borderColor: 'rgba(128,255,32,0.2) rgba(0,0,0,0.4) rgba(0,0,0,0.4) rgba(128,255,32,0.1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {syl.letters.map((letter, li) => {
                    const globalIdx = syl.startIndex + li;
                    const isVowel = stageQuestion.vowelIndices?.has(globalIdx);
                    return (
                      <span
                        key={li}
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          color: isVowel ? 'var(--color-gold)' : '#FFF',
                          borderBottom: isVowel ? '2px solid var(--color-gold)' : '2px solid transparent',
                          paddingBottom: 1,
                        }}
                      >
                        {letter}
                      </span>
                    );
                  })}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.6 }}>
              🔈 Tap a syllable to hear it
            </div>
          </>
        )}

        {/* Stage 2: Template word + definition (Copy) */}
        {stage === 2 && (
          <>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
              {STAGE_INSTRUCTIONS[2]}
            </div>

            {/* Template word — gray reference letters */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 4,
                marginBottom: 8,
                flexWrap: 'wrap',
              }}
            >
              {stageQuestion.correctAnswer.split('').map((letter, i) => {
                const filled = slots.length > i && slots[i] === letter;
                return (
                  <div
                    key={i}
                    style={{
                      width: 30,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      color: filled ? 'var(--color-gold)' : 'rgba(255,255,255,0.3)',
                      border: `1px solid ${filled ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 3,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>

            {stageQuestion.definition && (
              <div style={{ fontSize: 14, color: 'var(--color-gold)', marginBottom: 4 }}>
                {stageQuestion.definition}
              </div>
            )}
            {stageQuestion.phonetic && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                /{stageQuestion.phonetic}/
              </div>
            )}
          </>
        )}

        {/* Stage 3: Pure audio — note block animation */}
        {stage === 3 && (
          <div className="flex-col" style={{ alignItems: 'center', gap: 8, animation: 'fadeInUp 0.3s ease-out' }}>
            <div style={{ fontSize: 40, filter: 'drop-shadow(0 0 8px rgba(255,152,0,0.3))' }}>
              🎵
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.6 }}>
              {STAGE_INSTRUCTIONS[3]}
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
          <div style={{ animation: 'fadeInUp 0.2s ease-out', color: 'var(--color-xp)', fontSize: 13 }}>
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
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'nowrap', maxWidth: '100%' }}>
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
                      ? `2px solid ${isHintLetter ? colors.accent : 'var(--color-diamond)'}`
                      : '2px dashed rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  color: isError
                    ? 'var(--color-redstone)'
                    : isHintLetter
                      ? colors.accent
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
        {stageQuestion.letters.map((letter, i) => {
          const isUsed = usedIndices.has(i);
          const isRejected = rejectLetter === i;
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
                animation: isRejected ? 'blockShake 0.3s ease-out' : undefined,
                color: isRejected ? 'var(--color-redstone)' : undefined,
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex" style={{ gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-ghost"
          onClick={handleListenAgain}
          disabled={!!feedback}
          style={{ fontSize: 10, padding: '8px 14px' }}
        >
          🔊 Listen
        </button>

        {(stage === 1 || stage === 3) && !hintUsed && (
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
