// ============================================================
// Nether Portal Escape — 3-phase BOSS battle component
// Phase 1 🟣 Collect Obsidian: multiple-choice word recognition
// Phase 2 🟣 Build Frame: timed spelling with distractors
// Phase 3 🟣 Ignite Portal: mixed question types + energy bar
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameWord, GameProgress } from '../../types';
import { NetherPortalEngine, type PortalPhase, type Phase3QuestionData } from './NetherPortalEngine';
import { speakWord, speakSequence, speak } from '../../services/speech';
import {
  playClick,
  playBlockBreak,
  playFail,
  playGameComplete,
  playCombo,
  playWallComplete,
  playPortalActivate,
  playPortalFail,
} from '../../services/sound';
import { useApp } from '../../store/AppContext';

interface NetherPortalProps {
  words: GameWord[];
  onAnswer: (wordId: string, correct: boolean, responseTimeMs: number) => void;
  onComplete: (progress: GameProgress) => void;
}

// Phase display config
const PHASE_LABELS: Record<PortalPhase, string> = {
  1: 'COLLECT OBSIDIAN',
  2: 'BUILD FRAME',
  3: 'IGNITE PORTAL',
};

const PHASE_ICONS: Record<PortalPhase, string> = {
  1: '🟣',
  2: '🟣',
  3: '💜',
};

export default function NetherPortalEscape({ words, onAnswer, onComplete }: NetherPortalProps) {
  const { state } = useApp();
  const soundEnabled = state.settings.soundEnabled;
  const engineRef = useRef<NetherPortalEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeLimitRef = useRef<number>(12);
  const timeLeftRef = useRef<number>(12);

  // Shared state
  const [phase, setPhase] = useState<PortalPhase>(1);
  const [phaseProgress, setPhaseProgress] = useState({ current: 0, total: 4, phase: 1 as PortalPhase });
  const [energy, setEnergy] = useState(50);
  const [xpTotal, setXpTotal] = useState(0);
  const [comboCount, setComboCount] = useState(0);

  // Phase 1 state
  const [p1Question, setP1Question] = useState<{
    wordId: string;
    definition: string;
    options: string[];
    correctAnswer: string;
    phonetic?: string;
  } | null>(null);
  const [p1Feedback, setP1Feedback] = useState<{
    correct: boolean;
    correctAnswer: string;
    xp: number;
    combo: number;
  } | null>(null);

  // Phase 2 state
  const [p2Question, setP2Question] = useState<{
    wordId: string;
    definition: string;
    phonetic?: string;
    letters: string[];
    correctAnswer: string;
  } | null>(null);
  const [p2Slots, setP2Slots] = useState<string[]>([]);
  const [p2UsedIndices, setP2UsedIndices] = useState<Set<number>>(new Set());
  const [p2Feedback, setP2Feedback] = useState<{
    correct: boolean;
    showAnswer: string;
    xp: number;
    combo: number;
  } | null>(null);
  const [p2TimeLeft, setP2TimeLeft] = useState(12);
  const [p2Strikes, setP2Strikes] = useState(0);
  const submittingRef = useRef(false);
  const handleSubmitRef = useRef<(currentSlots: string[]) => void>(() => {});

  // Phase 3 state
  const [p3QuestionData, setP3QuestionData] = useState<Phase3QuestionData | null>(null);
  const [p3Letters, setP3Letters] = useState<string[]>([]);
  const [p3Slots, setP3Slots] = useState<string[]>([]);
  const [p3UsedIndices, setP3UsedIndices] = useState<Set<number>>(new Set());
  const [p3Options, setP3Options] = useState<string[]>([]);
  const [p3Feedback, setP3Feedback] = useState<{
    correct: boolean;
    showAnswer: string;
    xp: number;
    combo: number;
  } | null>(null);

  // Terminal states
  const [isComplete, setIsComplete] = useState(false);
  const [portalActivated, setPortalActivated] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  const [finalProgress, setFinalProgress] = useState<GameProgress | null>(null);

  // Phase transition animation
  const [phaseTransition, setPhaseTransition] = useState<string | null>(null);

  // --- Init engine ---
  useEffect(() => {
    const engine = new NetherPortalEngine();
    engine.initialize(words);
    engineRef.current = engine;
    setPhase(1);
    setEnergy(50);
    setXpTotal(0);
    setComboCount(0);
    setP2Strikes(0);
    setPhaseTransition('Collect obsidian to activate the portal...');
    setTimeout(() => setPhaseTransition(null), 2000);
    loadPhase1(engine);
  }, [words]);

  // --- Timer management ---
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((timeLimit: number) => {
    clearTimer();
    setP2TimeLeft(timeLimit);
    timeLeftRef.current = timeLimit;
    timeLimitRef.current = timeLimit;

    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, timeLimit - elapsed);
      setP2TimeLeft(remaining);
      timeLeftRef.current = remaining;

      if (remaining <= 0) {
        clearTimer();
        if (!submittingRef.current) {
          submittingRef.current = true;
          setP2Slots((current) => {
            handleSubmitRef.current(current);
            return current;
          });
        }
      }
    }, 100);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // ============================================================
  // Phase 1: Collect Obsidian — Multiple Choice
  // ============================================================
  const loadPhase1 = useCallback((engine: NetherPortalEngine) => {
    const q = engine.nextQuestion();
    if (!q) {
      // Phase 1 complete → transition to Phase 2
      transitionToPhase2(engine);
      return;
    }

    setP1Question({
      wordId: q.wordId,
      definition: q.prompt,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      phonetic: q.phonetic,
    });
    setP1Feedback(null);
    setPhaseProgress(engine.getPhaseProgress());

    // Speak definition
    speakSequence([
      { text: '选择正确的单词', lang: 'zh', pauseMs: 300 },
      { text: q.prompt, lang: 'zh', pauseMs: 500 },
    ]).catch(() => {});
  }, []);

  const transitionToPhase2 = useCallback((engine: NetherPortalEngine) => {
    setPhase(2);
    setPhaseTransition('Obsidian collected! Build the portal frame...');
    if (soundEnabled) playWallComplete();
    setTimeout(() => setPhaseTransition(null), 2000);
    loadPhase2(engine);
  }, [soundEnabled]);

  const handleP1Option = useCallback((option: string) => {
    if (!engineRef.current || !p1Question || p1Feedback) return;

    const result = engineRef.current.submitAnswer(option);
    const engine = engineRef.current;

    setXpTotal(engine.getProgress().xpEarned);
    setComboCount(engine.getComboCount());

    if (result.correct) {
      if (soundEnabled) playBlockBreak();
      setP1Feedback({
        correct: true,
        correctAnswer: result.correctAnswer,
        xp: result.xpEarned,
        combo: engine.getComboCount(),
      });
      onAnswer(p1Question.wordId, true, 0);

      setTimeout(() => {
        if (soundEnabled) speakWord(result.correctAnswer).catch(() => {});
      }, 200);

      setTimeout(() => {
        if (engine.getPhase() === 2) {
          transitionToPhase2(engine);
        } else {
          loadPhase1(engine);
        }
      }, 1200);
    } else {
      if (soundEnabled) playFail();
      setP1Feedback({
        correct: false,
        correctAnswer: result.correctAnswer,
        xp: 0,
        combo: 0,
      });
      onAnswer(p1Question.wordId, false, 0);

      setTimeout(() => {
        if (engine.getPhase() === 2) {
          transitionToPhase2(engine);
        } else {
          loadPhase1(engine);
        }
      }, 1500);
    }
  }, [p1Question, p1Feedback, onAnswer, soundEnabled, loadPhase1, transitionToPhase2]);

  // ============================================================
  // Phase 2: Build Frame — Timed Spelling
  // ============================================================
  const loadPhase2 = useCallback((engine: NetherPortalEngine) => {
    const q = engine.nextQuestion();
    if (!q) {
      finishPortal(engine);
      return;
    }

    setP2Question({
      wordId: q.wordId,
      definition: q.prompt,
      phonetic: q.phonetic,
      letters: q.options || [],
      correctAnswer: q.correctAnswer,
    });
    setP2Slots([]);
    setP2UsedIndices(new Set());
    setP2Feedback(null);
    setComboCount(engine.getComboCount());
    setP2Strikes(engine.getPhase2Strikes());
    setPhaseProgress(engine.getPhaseProgress());
    setXpTotal(engine.getProgress().xpEarned);
    submittingRef.current = false;

    const timeLimit = engine.getTimeLimit();
    startTimer(timeLimit);

    // Speak: word → instruction → definition → word
    (async () => {
      await speakWord(q.correctAnswer, 0.85);
      await new Promise((r) => setTimeout(r, 400));
      await speakSequence([
        { text: '请拼出这个单词', lang: 'zh', pauseMs: 400 },
        { text: q.prompt, lang: 'zh', pauseMs: 600 },
      ]);
      await speakWord(q.correctAnswer, 0.85);
    })().catch(() => {});
  }, [startTimer]);

  const handleP2LetterClick = useCallback(
    (letter: string, index: number) => {
      if (!p2Question || p2UsedIndices.has(index) || p2Feedback) return;
      if (soundEnabled) playClick();

      const newSlots = [...p2Slots, letter];
      const newUsed = new Set(p2UsedIndices);
      newUsed.add(index);

      setP2Slots(newSlots);
      setP2UsedIndices(newUsed);

      if (newSlots.length === p2Question.correctAnswer.length) {
        setTimeout(() => {
          handleSubmitRef.current(newSlots);
        }, 300);
      }
    },
    [p2Question, p2Slots, p2UsedIndices, p2Feedback, soundEnabled]
  );

  const handleP2RemoveLetter = useCallback(
    (slotIndex: number) => {
      if (p2Feedback) return;
      if (soundEnabled) playClick();

      const newSlots = p2Slots.filter((_, i) => i !== slotIndex);
      const rebuiltUsed = new Set<number>();
      const remaining = [...(p2Question?.letters || [])];
      for (const slotLetter of newSlots) {
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i] === slotLetter) {
            rebuiltUsed.add(i);
            remaining[i] = '';
            break;
          }
        }
      }

      setP2Slots(newSlots);
      setP2UsedIndices(rebuiltUsed);
    },
    [p2Slots, p2Question, p2Feedback, soundEnabled]
  );

  const handleP2Submit = useCallback(
    (currentSlots: string[]) => {
      if (!engineRef.current || !p2Question || p2Feedback) return;

      const answer = currentSlots.join('');
      const timeRatio = timeLeftRef.current / timeLimitRef.current;
      const result = engineRef.current.submitAnswer(answer || '(no answer)', timeRatio);

      clearTimer();

      const engine = engineRef.current;
      setXpTotal(engine.getProgress().xpEarned);
      setP2Strikes(engine.getPhase2Strikes());

      if (result.correct) {
        if (soundEnabled) {
          playBlockBreak();
          if (engine.getComboCount() >= 2) playCombo(engine.getComboCount());
        }

        setP2Feedback({
          correct: true,
          showAnswer: result.correctAnswer,
          xp: result.xpEarned,
          combo: engine.getComboCount(),
        });
        onAnswer(p2Question.wordId, true, 0);

        setTimeout(() => speakWord(result.correctAnswer).catch(() => {}), 200);

        setTimeout(() => {
          if (engine.isGameOver()) {
            finishPortal(engine);
          } else if (engine.getPhase() === 3) {
            transitionToPhase3(engine);
          } else {
            loadPhase2(engine);
          }
        }, 1500);
      } else {
        if (soundEnabled) playFail();

        // Fill slots with correct answer
        const correctLetters = result.correctAnswer.toLowerCase().split('');
        setP2Slots(correctLetters);

        setP2Feedback({
          correct: false,
          showAnswer: result.correctAnswer,
          xp: 0,
          combo: 0,
        });
        onAnswer(p2Question.wordId, false, 0);

        setTimeout(() => speakWord(result.correctAnswer, 0.85).catch(() => {}), 400);

        setTimeout(() => {
          if (engine.isGameOver()) {
            finishPortal(engine);
          } else if (engine.getPhase() === 3) {
            transitionToPhase3(engine);
          } else {
            loadPhase2(engine);
          }
        }, 3500);
      }
    },
    [p2Question, p2Feedback, onAnswer, soundEnabled, loadPhase2, clearTimer]
  );

  handleSubmitRef.current = handleP2Submit;

  const handleP2Clear = useCallback(() => {
    if (p2Feedback) return;
    if (soundEnabled) playClick();
    setP2Slots([]);
    setP2UsedIndices(new Set());
  }, [p2Feedback, soundEnabled]);

  // ============================================================
  // Phase 3: Ignite Portal — Mixed Mode + Energy Bar
  // ============================================================
  const transitionToPhase3 = useCallback((engine: NetherPortalEngine) => {
    setPhase(3);
    setEnergy(engine.getEnergy());
    setPhaseTransition('Frame complete! Ignite the portal...');
    if (soundEnabled) playWallComplete();
    setTimeout(() => setPhaseTransition(null), 2000);
    loadPhase3(engine);
  }, [soundEnabled]);

  const loadPhase3 = useCallback((engine: NetherPortalEngine) => {
    const qData = engine.getPhase3QuestionData();
    if (!qData) {
      finishPortal(engine);
      return;
    }

    setP3QuestionData(qData);
    setP3Feedback(null);
    setComboCount(engine.getComboCount());
    setEnergy(engine.getEnergy());
    setPhaseProgress(engine.getPhaseProgress());
    setXpTotal(engine.getProgress().xpEarned);

    // Prepare letters for spelling questions
    if (qData.questionType === 'listen_spell' || qData.questionType === 'definition_spell') {
      const word = qData.word;
      const letters = word.word.toLowerCase().split('');
      const usedLetters = new Set(letters);
      const distractors: string[] = [];
      const pool = 'eariotnslcudpmhgbfywkvxzjq'.split('');
      const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
      for (const ch of shuffledPool) {
        if (distractors.length >= 2) break;
        if (!usedLetters.has(ch)) {
          distractors.push(ch);
          usedLetters.add(ch);
        }
      }
      setP3Letters([...letters, ...distractors].sort());
      setP3Options([]);
    } else if (qData.questionType === 'sentence_fill' && qData.sentenceData) {
      setP3Options(qData.sentenceData.options);
      setP3Letters([]);
    }

    setP3Slots([]);
    setP3UsedIndices(new Set());

    // Speak based on question type
    if (qData.questionType === 'listen_spell') {
      speakWord(qData.word.word, 0.85).catch(() => {});
      setTimeout(() => {
        speak('请拼出你听到的单词', 1.0, 'zh').catch(() => {});
      }, 600);
    } else if (qData.questionType === 'definition_spell') {
      speakSequence([
        { text: qData.word.definition, lang: 'zh', pauseMs: 400 },
      ]).catch(() => {});
    } else if (qData.questionType === 'sentence_fill' && qData.sentenceData) {
      // Speak the sentence with beep for blank
      speakSequence([
        { text: qData.sentenceData.chinese, lang: 'zh', pauseMs: 400 },
      ]).catch(() => {});
    }
  }, []);

  const handleP3SpellClick = useCallback(
    (letter: string, index: number) => {
      if (!p3QuestionData || p3UsedIndices.has(index) || p3Feedback) return;
      if (soundEnabled) playClick();

      const newSlots = [...p3Slots, letter];
      const newUsed = new Set(p3UsedIndices);
      newUsed.add(index);

      setP3Slots(newSlots);
      setP3UsedIndices(newUsed);

      const targetLen = p3QuestionData.word.word.length;
      if (newSlots.length === targetLen) {
        setTimeout(() => handleP3Submit(newSlots.join('')), 300);
      }
    },
    [p3QuestionData, p3Slots, p3UsedIndices, p3Feedback, soundEnabled]
  );

  const handleP3RemoveLetter = useCallback(
    (slotIndex: number) => {
      if (p3Feedback) return;
      if (soundEnabled) playClick();

      const newSlots = p3Slots.filter((_, i) => i !== slotIndex);
      const rebuiltUsed = new Set<number>();
      const remaining = [...p3Letters];
      for (const slotLetter of newSlots) {
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i] === slotLetter) {
            rebuiltUsed.add(i);
            remaining[i] = '';
            break;
          }
        }
      }

      setP3Slots(newSlots);
      setP3UsedIndices(rebuiltUsed);
    },
    [p3Slots, p3Letters, p3Feedback, soundEnabled]
  );

  const handleP3Option = useCallback((option: string) => {
    if (!p3QuestionData || p3Feedback) return;
    handleP3Submit(option);
  }, [p3QuestionData, p3Feedback]);

  const handleP3Submit = useCallback((answer: string) => {
    if (!engineRef.current || !p3QuestionData || p3Feedback) return;

    const result = engineRef.current.submitAnswer(answer);
    const engine = engineRef.current;

    setXpTotal(engine.getProgress().xpEarned);
    setEnergy(engine.getEnergy());
    setComboCount(engine.getComboCount());

    if (result.correct) {
      if (soundEnabled) playBlockBreak();

      setP3Feedback({
        correct: true,
        showAnswer: result.correctAnswer,
        xp: result.xpEarned,
        combo: engine.getComboCount(),
      });

      const qId = p3QuestionData.word.id;
      onAnswer(qId, true, 0);

      setTimeout(() => speakWord(result.correctAnswer).catch(() => {}), 200);

      setTimeout(() => {
        if (engine.isPortalActivated() || engine.isGameOver()) {
          finishPortal(engine);
        } else {
          loadPhase3(engine);
        }
      }, 1500);
    } else {
      if (soundEnabled) playFail();

      setP3Feedback({
        correct: false,
        showAnswer: result.correctAnswer,
        xp: 0,
        combo: 0,
      });

      const qId = p3QuestionData.word.id;
      onAnswer(qId, false, 0);

      setTimeout(() => speakWord(result.correctAnswer, 0.85).catch(() => {}), 400);

      setTimeout(() => {
        if (engine.isPortalActivated() || engine.isGameOver()) {
          finishPortal(engine);
        } else {
          loadPhase3(engine);
        }
      }, 2500);
    }
  }, [p3QuestionData, p3Feedback, onAnswer, soundEnabled, loadPhase3]);

  const handleP3Clear = useCallback(() => {
    if (p3Feedback) return;
    if (soundEnabled) playClick();
    setP3Slots([]);
    setP3UsedIndices(new Set());
  }, [p3Feedback, soundEnabled]);

  // ============================================================
  // Terminal: Game Over or Portal Activated
  // ============================================================
  const finishPortal = useCallback((engine: NetherPortalEngine) => {
    const progress = engine.getProgress();
    setFinalProgress(progress);

    if (engine.isPortalActivated()) {
      setPortalActivated(true);
      if (soundEnabled) {
        playPortalActivate();
        setTimeout(() => playGameComplete(), 600);
      }
    } else {
      setGameOver(true);
      if (engine.getPhase() === 2) {
        setGameOverReason('The frame collapsed... You were pushed back by piglins!');
      } else if (engine.getPhase() === 3) {
        setGameOverReason('The portal energy faded away...');
      } else {
        setGameOverReason('The portal remains dormant...');
      }
      if (soundEnabled) playPortalFail();
    }

    setXpTotal(progress.xpEarned);
    setIsComplete(true);
    onComplete(progress);
  }, [soundEnabled, onComplete]);

  // ============================================================
  // Portal Visualization
  // ============================================================
  const renderPortal = () => {
    const frameSegments = phase === 1 ? 0 : phase === 2 ? p2Question ? phaseProgress.current : 5 : 5;
    const totalSegments = 5;
    const energyPct = energy / 100;

    // Calculate glow intensity based on phase and energy
    const glowIntensity = phase === 1 ? 0.15 :
      phase === 2 ? 0.2 + frameSegments / totalSegments * 0.3 :
      portalActivated ? 1 : 0.3 + energyPct * 0.5;

    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div
          style={{
            position: 'relative',
            width: 200,
            height: 160,
          }}
        >
          {/* Portal frame — obsidian border */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: '4px solid #1a0a2e',
              borderRadius: 8,
              background: 'rgba(10, 5, 20, 0.9)',
              boxShadow: '0 0 8px rgba(100, 0, 200, 0.2), inset 0 0 8px rgba(100, 0, 200, 0.1)',
            }}
          >
            {/* Frame segments (Phase 2+) */}
            {phase >= 2 && (
              <div style={{
                position: 'absolute', inset: -4, borderRadius: 8,
                overflow: 'hidden', pointerEvents: 'none',
              }}>
                {Array.from({ length: totalSegments }).map((_, i) => {
                  // Segments are evenly distributed along the 4 sides
                  const side = i < 2 ? 'top' : i < 4 ? 'bottom' : 'left';
                  const lit = i < frameSegments;
                  let segmentStyle: React.CSSProperties = {};
                  if (side === 'top') {
                    segmentStyle = {
                      position: 'absolute',
                      top: 0,
                      left: `${i * 50}%`,
                      width: '50%',
                      height: 4,
                      background: lit ? '#7C3AED' : '#2d1a4e',
                      boxShadow: lit ? '0 0 6px #7C3AED' : 'none',
                      transition: 'all 0.4s ease',
                    };
                  } else if (side === 'bottom') {
                    const bi = i - 2;
                    segmentStyle = {
                      position: 'absolute',
                      bottom: 0,
                      left: `${bi * 50}%`,
                      width: '50%',
                      height: 4,
                      background: lit ? '#7C3AED' : '#2d1a4e',
                      boxShadow: lit ? '0 0 6px #7C3AED' : 'none',
                      transition: 'all 0.4s ease',
                    };
                  } else {
                    segmentStyle = {
                      position: 'absolute',
                      top: `${(i - 4) * 100}%`,
                      left: 0,
                      width: 4,
                      height: '100%',
                      background: lit ? '#7C3AED' : '#2d1a4e',
                      boxShadow: lit ? '0 0 6px #7C3AED' : 'none',
                      transition: 'all 0.4s ease',
                    };
                  }
                  return <div key={i} style={segmentStyle} />;
                })}
              </div>
            )}

            {/* Portal center — inner void */}
            <div
              style={{
                position: 'absolute',
                inset: 12,
                borderRadius: 4,
                background: portalActivated
                  ? 'radial-gradient(circle, #7C3AED 0%, #4C1D95 40%, #1a0a2e 80%)'
                  : phase === 3
                    ? `radial-gradient(circle, rgba(124,58,237,${0.3 + energyPct * 0.5}) 0%, rgba(76,29,149,${0.1 + energyPct * 0.3}) 40%, #1a0a2e 80%)`
                    : 'radial-gradient(circle, rgba(30,10,60,0.8) 0%, #0a0514 80%)',
                border: portalActivated
                  ? '2px solid rgba(147,51,234,0.8)'
                  : '2px solid rgba(80,30,120,0.3)',
                transition: 'all 0.5s ease',
              }}
            >
              {/* Swirl effect when activated */}
              {portalActivated && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 4,
                    background: 'conic-gradient(from 0deg, transparent, rgba(167,139,250,0.4), transparent, rgba(167,139,250,0.2), transparent)',
                    animation: 'portalSwirl 2s linear infinite',
                    overflow: 'hidden',
                  }}
                />
              )}

              {/* Phase 1 obsidian slots */}
              {phase === 1 && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexWrap: 'wrap', gap: 8, padding: 16,
                }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 3,
                        background: i < phaseProgress.current
                          ? '#2d1a4e'
                          : 'rgba(20,10,40,0.6)',
                        border: i < phaseProgress.current
                          ? '2px solid #7C3AED'
                          : '2px dashed rgba(80,30,120,0.3)',
                        boxShadow: i < phaseProgress.current
                          ? '0 0 4px rgba(124,58,237,0.5)'
                          : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {i < phaseProgress.current && (
                        <div style={{
                          width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14,
                        }}>
                          💎
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Phase 3 energy text */}
              {phase === 3 && !portalActivated && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: `rgba(167,139,250,${0.4 + energyPct * 0.6})`,
                    textShadow: `0 0 8px rgba(124,58,237,${0.3 + energyPct * 0.5})`,
                  }}>
                    {energy}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Portal glow aura */}
          <div
            style={{
              position: 'absolute',
              inset: -12,
              borderRadius: 16,
              background: `radial-gradient(ellipse, rgba(124,58,237,${glowIntensity * 0.4}) 0%, transparent 70%)`,
              pointerEvents: 'none',
              transition: 'all 0.5s ease',
              animation: portalActivated ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
          />
        </div>
      </div>
    );
  };

  // ============================================================
  // Completion screens
  // ============================================================
  if (isComplete) {
    if (portalActivated) {
      return (
        <div className="flex-col gap-md" style={{ alignItems: 'center', padding: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 8, animation: 'fadeInUp 0.5s ease-out' }}>
            🌑✨
          </div>
          <div className="pixel-text" style={{ color: '#C084FC', fontSize: 18, textAlign: 'center', animation: 'fadeInUp 0.3s ease-out' }}>
            PORTAL ACTIVATED!
          </div>
          <div className="pixel-text-sm" style={{ color: '#A78BFA', fontSize: 10, textAlign: 'center', marginTop: 4 }}>
            You have entered the Nether!
          </div>
          <div className="mc-panel" style={{ padding: 24, textAlign: 'center', marginTop: 8, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <div className="flex" style={{ gap: 32 }}>
              <StatBox label="Correct" value={`${finalProgress?.correctCount ?? 0}`} color="var(--color-xp)" />
              <StatBox label="Misses" value={`${finalProgress?.incorrectCount ?? 0}`} color="var(--color-redstone)" />
              <StatBox label="XP" value={`+${finalProgress?.xpEarned ?? 0}`} color="var(--color-gold)" />
            </div>
            <div className="pixel-text-sm" style={{ color: '#C084FC', fontSize: 9, marginTop: 16 }}>
              🏆 Achievement: Into the Nether!
            </div>
          </div>
        </div>
      );
    }

    if (gameOver) {
      return (
        <div className="flex-col gap-md" style={{ alignItems: 'center', padding: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 8, animation: 'fadeInUp 0.5s ease-out' }}>
            🌑💔
          </div>
          <div className="pixel-text" style={{ color: 'var(--color-redstone)', fontSize: 16, textAlign: 'center' }}>
            Portal Collapsed!
          </div>
          <div style={{ color: '#AAA', fontSize: 13, textAlign: 'center', maxWidth: 280 }}>
            {gameOverReason}
          </div>
          {finalProgress && (
            <div className="mc-panel" style={{ padding: 20, textAlign: 'center', marginTop: 8 }}>
              <div className="flex" style={{ gap: 24 }}>
                <StatBox label="Correct" value={`${finalProgress.correctCount}`} color="var(--color-xp)" />
                <StatBox label="Misses" value={`${finalProgress.incorrectCount}`} color="var(--color-redstone)" />
                <StatBox label="XP" value={`+${finalProgress.xpEarned}`} color="var(--color-gold)" />
              </div>
              <div className="pixel-text-sm" style={{ color: 'var(--text-muted)', fontSize: 9, marginTop: 12 }}>
                🔄 The portal can be re-attempted — keep practicing!
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  // ============================================================
  // Show phase transition overlay
  // ============================================================
  if (phaseTransition && !isComplete) {
    return (
      <div className="flex-col gap-md" style={{ padding: 16 }}>
        {/* Header */}
        <PhaseHeader phase={phase} progress={phaseProgress} xp={xpTotal} />
        {renderPortal()}
        <div className="mc-panel" style={{ padding: 32, textAlign: 'center', animation: 'fadeInUp 0.4s ease-out' }}>
          <span style={{ fontSize: 36, display: 'block', marginBottom: 12 }}>
            {phase === 2 ? '🔮' : '💜'}
          </span>
          <p style={{ color: '#C084FC', fontSize: 16, fontWeight: 700 }}>
            {phaseTransition}
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // Loading state
  // ============================================================
  if (!p1Question && !p2Question && !p3QuestionData) {
    return (
      <div className="flex-center" style={{ height: 200 }}>
        <span className="pixel-text" style={{ color: 'var(--text-muted)' }}>
          Approaching portal...
        </span>
      </div>
    );
  }

  // ============================================================
  // Main game render
  // ============================================================
  return (
    <div className="flex-col gap-md" style={{ padding: 16 }}>
      {/* Header */}
      <PhaseHeader phase={phase} progress={phaseProgress} xp={xpTotal} />

      {/* Portal visualization */}
      {renderPortal()}

      {/* Phase 1: Multiple Choice */}
      {phase === 1 && p1Question && (
        <Phase1UI
          question={p1Question}
          feedback={p1Feedback}
          comboCount={comboCount}
          onOption={handleP1Option}
        />
      )}

      {/* Phase 2: Timed Spelling */}
      {phase === 2 && p2Question && (
        <Phase2UI
          question={p2Question}
          slots={p2Slots}
          usedIndices={p2UsedIndices}
          feedback={p2Feedback}
          timeLeft={p2TimeLeft}
          timeLimit={timeLimitRef.current}
          comboCount={comboCount}
          strikes={p2Strikes}
          maxStrikes={3}
          onLetterClick={handleP2LetterClick}
          onRemoveLetter={handleP2RemoveLetter}
          onClear={handleP2Clear}
        />
      )}

      {/* Phase 3: Mixed Mode */}
      {phase === 3 && p3QuestionData && (
        <Phase3UI
          questionData={p3QuestionData}
          letters={p3Letters}
          slots={p3Slots}
          usedIndices={p3UsedIndices}
          options={p3Options}
          feedback={p3Feedback}
          energy={energy}
          comboCount={comboCount}
          onSpellClick={handleP3SpellClick}
          onRemoveLetter={handleP3RemoveLetter}
          onClear={handleP3Clear}
          onOption={handleP3Option}
        />
      )}
    </div>
  );
}

// ============================================================
// Phase Header
// ============================================================
function PhaseHeader({ phase, progress, xp }: { phase: PortalPhase; progress: { current: number; total: number; phase: PortalPhase }; xp: number }) {
  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 4 }}>
        <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>{PHASE_ICONS[phase]}</span>
          <span className="pixel-text-sm" style={{ color: '#C084FC', fontSize: 9 }}>
            {PHASE_LABELS[phase]}
          </span>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            {progress.current}/{progress.total}
          </span>
        </div>
        <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
          ⭐ {xp} XP
        </span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{
            width: `${(progress.current / Math.max(progress.total, 1)) * 100}%`,
            background: 'linear-gradient(90deg, #4C1D95, #7C3AED)',
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Phase 1 UI — Multiple Choice 2×2 Grid
// ============================================================
function Phase1UI({
  question,
  feedback,
  comboCount,
  onOption,
}: {
  question: { wordId: string; definition: string; options: string[]; correctAnswer: string; phonetic?: string };
  feedback: { correct: boolean; correctAnswer: string; xp: number; combo: number } | null;
  comboCount: number;
  onOption: (option: string) => void;
}) {
  return (
    <>
      {/* Definition panel */}
      <div className="mc-panel" style={{ padding: 16, textAlign: 'center', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <div className="pixel-text-sm" style={{ color: 'var(--text-muted)', fontSize: 7, marginBottom: 8 }}>
          🟣 FIND THE WORD:
        </div>
        <div style={{ fontSize: 18, color: 'var(--color-gold)', marginBottom: question.phonetic ? 6 : 0 }}>
          {question.definition}
        </div>
        {question.phonetic && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            /{question.phonetic}/
          </div>
        )}
      </div>

      {/* Options grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 360, margin: '0 auto' }}>
        {question.options.map((option, i) => {
          const isCorrectAnswer = feedback && option.toLowerCase() === question.correctAnswer.toLowerCase();
          const wasSelectedWrong = feedback && !feedback.correct && !isCorrectAnswer;
          return (
            <button
              key={i}
              className="stone-block"
              onClick={() => !feedback && onOption(option)}
              disabled={!!feedback}
              style={{
                aspectRatio: '1.6',
                fontSize: 18,
                fontWeight: 700,
                cursor: feedback ? 'default' : 'pointer',
                background: feedback && isCorrectAnswer
                  ? 'rgba(128,255,32,0.12)'
                  : feedback && wasSelectedWrong
                    ? 'rgba(255,70,70,0.1)'
                    : undefined,
                border: feedback && isCorrectAnswer
                  ? '2px solid var(--color-xp)'
                  : feedback && !feedback.correct
                    ? '2px solid var(--color-redstone)'
                    : undefined,
                opacity: feedback && !isCorrectAnswer && !wasSelectedWrong ? 0.4 : 1,
                animation: feedback && !feedback.correct && wasSelectedWrong ? 'blockShake 0.4s ease-out' : undefined,
              }}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      <div style={{ minHeight: 28, textAlign: 'center' }}>
        {feedback && feedback.correct && (
          <div style={{ animation: 'fadeInUp 0.2s ease-out', color: 'var(--color-xp)', fontSize: 14, fontWeight: 700 }}>
            ✅ +{feedback.xp}XP
            {feedback.combo >= 2 && (
              <span style={{ color: 'var(--color-diamond)', marginLeft: 8 }}>🔥 {feedback.combo}x</span>
            )}
          </div>
        )}
        {feedback && !feedback.correct && (
          <div style={{ animation: 'fadeInUp 0.3s ease-out', color: 'var(--color-redstone)', fontSize: 14 }}>
            ❌ 正确答案：<span style={{ fontWeight: 700 }}>{feedback.correctAnswer}</span>
          </div>
        )}
        {!feedback && comboCount >= 2 && (
          <span className="pixel-text-sm" style={{ color: 'var(--color-diamond)', fontSize: 9 }}>🔥 {comboCount}x</span>
        )}
      </div>
    </>
  );
}

// ============================================================
// Phase 2 UI — Timed Spelling with Strikes
// ============================================================
function Phase2UI({
  question,
  slots,
  usedIndices,
  feedback,
  timeLeft,
  timeLimit,
  comboCount,
  strikes,
  maxStrikes,
  onLetterClick,
  onRemoveLetter,
  onClear,
}: {
  question: { wordId: string; definition: string; phonetic?: string; letters: string[]; correctAnswer: string };
  slots: string[];
  usedIndices: Set<number>;
  feedback: { correct: boolean; showAnswer: string; xp: number; combo: number } | null;
  timeLeft: number;
  timeLimit: number;
  comboCount: number;
  strikes: number;
  maxStrikes: number;
  onLetterClick: (letter: string, index: number) => void;
  onRemoveLetter: (slotIndex: number) => void;
  onClear: () => void;
}) {
  const totalSlots = question.correctAnswer.length;
  const timeRatio = timeLeft / timeLimit;
  const isError = feedback && !feedback.correct;
  const timerColor =
    timeRatio > 0.5 ? 'var(--color-xp)' :
    timeRatio > 0.25 ? 'var(--color-gold)' :
    'var(--color-redstone)';

  return (
    <>
      {/* Strikes indicator */}
      <div className="flex" style={{ gap: 4, justifyContent: 'center' }}>
        {Array.from({ length: maxStrikes }).map((_, i) => (
          <span key={i} style={{ fontSize: 12, opacity: i < strikes ? 1 : 0.3 }}>
            {i < strikes ? '💔' : '❤️'}
          </span>
        ))}
      </div>

      {/* Timer bar */}
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%',
          width: `${Math.max(0, timeRatio) * 100}%`,
          background: timerColor,
          borderRadius: 4,
          transition: 'width 0.1s linear, background 0.3s ease',
        }} />
        <span style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🎯</span>
        <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>
          {Math.ceil(timeLeft)}s
        </span>
      </div>

      {/* Definition */}
      <div className="mc-panel" style={{ padding: 12, textAlign: 'center', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}>
        <div style={{ fontSize: 16, color: 'var(--color-gold)', marginBottom: question.phonetic ? 4 : 0 }}>
          {question.definition}
        </div>
        {question.phonetic && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>/{question.phonetic}/</div>}
      </div>

      {/* Feedback */}
      <div style={{ minHeight: 28, textAlign: 'center' }}>
        {feedback && feedback.correct && (
          <div style={{ animation: 'fadeInUp 0.2s ease-out', color: 'var(--color-xp)', fontSize: 14, fontWeight: 700 }}>
            ✅ +{feedback.xp}XP
            {feedback.combo >= 2 && <span style={{ color: 'var(--color-diamond)', marginLeft: 8 }}>🔥 {feedback.combo}x</span>}
          </div>
        )}
        {isError && (
          <div style={{ animation: 'fadeInUp 0.3s ease-out', color: 'var(--color-redstone)', fontSize: 14, fontWeight: 700, padding: '8px 16px', background: 'rgba(255,70,70,0.1)', borderRadius: 6, border: '1px solid rgba(255,70,70,0.3)' }}>
            ❌ 正确拼写：<span style={{ fontSize: 20, letterSpacing: 2 }}>{feedback.showAnswer}</span>
          </div>
        )}
      </div>

      {/* Letter slots */}
      <div className="mc-panel" style={{ padding: 12, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'nowrap', maxWidth: '100%' }}>
          {Array.from({ length: totalSlots }).map((_, i) => {
            const letter = slots[i] || '';
            const filled = i < slots.length;
            return (
              <button
                key={i}
                onClick={() => filled && !isError && onRemoveLetter(i)}
                disabled={!filled || (!!feedback && !isError)}
                style={{
                  flex: '1 1 0', minWidth: 26, maxWidth: 44, height: 42, fontSize: 16,
                  cursor: filled && !feedback ? 'pointer' : 'default',
                  background: isError ? 'rgba(255,70,70,0.15)' : filled ? 'var(--color-surface)' : 'rgba(255,255,255,0.04)',
                  border: isError ? '2px solid var(--color-redstone)' : filled ? '2px solid var(--color-diamond)' : '2px dashed rgba(255,255,255,0.15)',
                  borderRadius: 4,
                  color: isError ? 'var(--color-redstone)' : filled ? '#FFF' : 'transparent',
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

      {/* Letter grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(48px, 1fr))', gap: 8, maxWidth: 360, margin: '0 auto', padding: '4px 0' }}>
        {question.letters.map((letter, i) => {
          const isUsed = usedIndices.has(i);
          return (
            <button
              key={i}
              className="stone-block"
              onClick={() => onLetterClick(letter, i)}
              disabled={isUsed || !!feedback}
              style={{
                aspectRatio: '1', fontSize: 22, fontWeight: 700,
                minWidth: 0, minHeight: 0, padding: 4,
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
        <button className="btn btn-ghost" onClick={onClear} disabled={slots.length === 0 || !!feedback} style={{ fontSize: 10, padding: '8px 20px' }}>
          🔄 Clear
        </button>
        {comboCount >= 2 && !feedback && (
          <span className="pixel-text-sm" style={{ color: 'var(--color-diamond)', fontSize: 9, alignSelf: 'center' }}>🔥 {comboCount}x</span>
        )}
      </div>
    </>
  );
}

// ============================================================
// Phase 3 UI — Mixed Mode: spelling + sentence fill
// ============================================================
function Phase3UI({
  questionData,
  letters,
  slots,
  usedIndices,
  options,
  feedback,
  energy,
  comboCount,
  onSpellClick,
  onRemoveLetter,
  onClear,
  onOption,
}: {
  questionData: Phase3QuestionData;
  letters: string[];
  slots: string[];
  usedIndices: Set<number>;
  options: string[];
  feedback: { correct: boolean; showAnswer: string; xp: number; combo: number } | null;
  energy: number;
  comboCount: number;
  onSpellClick: (letter: string, index: number) => void;
  onRemoveLetter: (slotIndex: number) => void;
  onClear: () => void;
  onOption: (option: string) => void;
}) {
  const isSpelling = questionData.questionType === 'listen_spell' || questionData.questionType === 'definition_spell';
  const isListen = questionData.questionType === 'listen_spell';
  const isSentence = questionData.questionType === 'sentence_fill';
  const totalSlots = questionData.word.word.length;
  const energyPct = energy / 100;
  const isError = feedback && !feedback.correct;

  return (
    <>
      {/* Energy bar */}
      <div>
        <div className="flex-between" style={{ marginBottom: 4 }}>
          <span className="pixel-text-sm" style={{ color: '#A78BFA', fontSize: 8 }}>💜 Portal Energy</span>
          <span className="pixel-text-sm" style={{ color: energyPct > 0.6 ? '#A78BFA' : energyPct > 0.3 ? '#C084FC' : 'var(--color-redstone)', fontSize: 8 }}>
            {energy}%
          </span>
        </div>
        <div style={{ height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${energyPct * 100}%`,
            background: 'linear-gradient(90deg, #4C1D95, #7C3AED, #A78BFA)',
            borderRadius: 6,
            transition: 'width 0.5s ease',
            boxShadow: '0 0 8px rgba(124,58,237,0.3)',
          }} />
        </div>
      </div>

      {/* Question type indicator */}
      <div style={{ textAlign: 'center' }}>
        <span className="pixel-text-sm" style={{
          color: '#A78BFA', fontSize: 7,
          background: 'rgba(124,58,237,0.1)', padding: '4px 10px', borderRadius: 4,
        }}>
          {isListen ? '🎤 LISTEN & SPELL' : isSpelling ? '📝 SPELL THE WORD' : '📋 FILL IN THE BLANK'}
        </span>
      </div>

      {/* Listen button */}
      {isListen && !feedback && (
        <div style={{ textAlign: 'center' }}>
          <button
            className="btn btn-ghost"
            onClick={() => speakWord(questionData.word.word, 0.85)}
            style={{ fontSize: 12, padding: '8px 16px' }}
          >
            🔊 Listen Again
          </button>
        </div>
      )}

      {/* Definition for definition_spell */}
      {questionData.questionType === 'definition_spell' && (
        <div className="mc-panel" style={{ padding: 12, textAlign: 'center', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <div style={{ fontSize: 16, color: 'var(--color-gold)' }}>{questionData.word.definition}</div>
          {questionData.word.phonetic && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>/{questionData.word.phonetic}/</div>
          )}
        </div>
      )}

      {/* Sentence fill */}
      {isSentence && questionData.sentenceData && (
        <div className="mc-panel" style={{ padding: 16, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <div style={{ fontSize: 15, color: '#FFF', marginBottom: 8, lineHeight: 1.5 }}>
            {questionData.sentenceData.sentenceWithBlank}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {questionData.sentenceData.chinese}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div style={{ minHeight: 28, textAlign: 'center' }}>
        {feedback && feedback.correct && (
          <div style={{ animation: 'fadeInUp 0.2s ease-out', color: 'var(--color-xp)', fontSize: 14, fontWeight: 700 }}>
            ✅ +{feedback.xp}XP ⚡+15% Energy
            {feedback.combo >= 2 && <span style={{ color: 'var(--color-diamond)', marginLeft: 8 }}>🔥 {feedback.combo}x</span>}
          </div>
        )}
        {isError && (
          <div style={{ animation: 'fadeInUp 0.3s ease-out', color: 'var(--color-redstone)', fontSize: 14, fontWeight: 700, padding: '8px 16px', background: 'rgba(255,70,70,0.1)', borderRadius: 6, border: '1px solid rgba(255,70,70,0.3)' }}>
            ❌ -5% Energy · 正确：<span style={{ fontSize: 18 }}>{feedback.showAnswer}</span>
          </div>
        )}
      </div>

      {/* Spelling UI */}
      {isSpelling && (
        <>
          {/* Letter slots */}
          <div className="mc-panel" style={{ padding: 12, overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'nowrap', maxWidth: '100%' }}>
              {Array.from({ length: totalSlots }).map((_, i) => {
                const letter = slots[i] || '';
                const filled = i < slots.length;
                return (
                  <button
                    key={i}
                    onClick={() => filled && !isError && onRemoveLetter(i)}
                    disabled={!filled || (!!feedback && !isError)}
                    style={{
                      flex: '1 1 0', minWidth: 26, maxWidth: 44, height: 42, fontSize: 16,
                      cursor: filled && !feedback ? 'pointer' : 'default',
                      background: isError ? 'rgba(255,70,70,0.15)' : filled ? 'var(--color-surface)' : 'rgba(255,255,255,0.04)',
                      border: isError ? '2px solid var(--color-redstone)' : filled ? '2px solid #7C3AED' : '2px dashed rgba(255,255,255,0.15)',
                      borderRadius: 4,
                      color: isError ? 'var(--color-redstone)' : filled ? '#FFF' : 'transparent',
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

          {/* Letter grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(48px, 1fr))', gap: 8, maxWidth: 360, margin: '0 auto', padding: '4px 0' }}>
            {letters.map((letter, i) => {
              const isUsed = usedIndices.has(i);
              return (
                <button
                  key={i}
                  className="stone-block"
                  onClick={() => onSpellClick(letter, i)}
                  disabled={isUsed || !!feedback}
                  style={{
                    aspectRatio: '1', fontSize: 22, fontWeight: 700,
                    minWidth: 0, minHeight: 0, padding: 4,
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

          {/* Clear button */}
          <div className="flex" style={{ gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={onClear} disabled={slots.length === 0 || !!feedback} style={{ fontSize: 10, padding: '8px 20px' }}>
              🔄 Clear
            </button>
            {comboCount >= 2 && !feedback && (
              <span className="pixel-text-sm" style={{ color: 'var(--color-diamond)', fontSize: 9, alignSelf: 'center' }}>🔥 {comboCount}x</span>
            )}
          </div>
        </>
      )}

      {/* Sentence options grid */}
      {isSentence && options.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 360, margin: '0 auto' }}>
          {options.map((option, i) => {
            const isCorrectAnswer = feedback && option.toLowerCase() === questionData.sentenceData?.inflectedForm.toLowerCase();
            return (
              <button
                key={i}
                className="stone-block"
                onClick={() => !feedback && onOption(option)}
                disabled={!!feedback}
                style={{
                  aspectRatio: '1.6', fontSize: 16, fontWeight: 700,
                  cursor: feedback ? 'default' : 'pointer',
                  background: feedback && isCorrectAnswer ? 'rgba(128,255,32,0.12)' : undefined,
                  border: feedback && isCorrectAnswer ? '2px solid var(--color-xp)' : feedback ? '2px solid var(--color-redstone)' : undefined,
                  opacity: feedback && !isCorrectAnswer ? 0.4 : 1,
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// ============================================================
// Shared
// ============================================================
function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-col" style={{ alignItems: 'center' }}>
      <div className="pixel-text-sm" style={{ fontSize: 16, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
