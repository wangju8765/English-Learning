// ============================================================
// Diamond Mine — 9-block wall (3×3), 2-target word mining
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameWord, GameProgress } from '../../types';
import { DiamondMineEngine, type WallData } from './DiamondMineEngine';
import { speakWord, speakChinese, preloadVoices, warmUpTTS } from '../../services/speech';
import { playClick, playBlockBreak, playCombo, playFail, playWallComplete, playGameComplete } from '../../services/sound';
import { useApp } from '../../store/AppContext';

interface DiamondMineProps {
  words: GameWord[];
  onAnswer: (wordId: string, correct: boolean, responseTimeMs: number) => void;
  onComplete: (progress: GameProgress) => void;
}

interface BlockState {
  word: string;
  isTarget: boolean;
  found: boolean;
  status: 'idle' | 'correct' | 'incorrect' | 'highlight';
}

export default function DiamondMine({ words, onAnswer, onComplete }: DiamondMineProps) {
  const { state } = useApp();
  const soundEnabled = state.settings.soundEnabled;
  const engineRef = useRef<DiamondMineEngine | null>(null);
  const [wall, setWall] = useState<WallData | null>(null);
  const [blockStates, setBlockStates] = useState<Map<string, BlockState>>(new Map());
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    word: string;
    xp: number;
    combo: number;
  } | null>(null);
  const [progress, setProgress] = useState<GameProgress>({
    currentQuestion: 0, totalQuestions: 0, correctCount: 0,
    incorrectCount: 0, xpEarned: 0, isComplete: false,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const answerStartRef = useRef<number>(Date.now());

  useEffect(() => {
    const engine = new DiamondMineEngine();
    engine.initialize(words);
    engineRef.current = engine;

    // Warm up TTS engine
    preloadVoices().then(() => {
      warmUpTTS();
    });

    loadWall(engine);
    answerStartRef.current = Date.now();
  }, [words]);

  const loadWall = useCallback((engine: DiamondMineEngine) => {
    const w = engine.getCurrentWall();
    if (!w) {
      setIsComplete(true);
      setProgress(engine.getProgress());
      onComplete(engine.getProgress());
      if (soundEnabled) playGameComplete();
      return;
    }

    setWall(w);
    setFeedback(null);

    // Build block states
    const states = new Map<string, BlockState>();
    for (const blockWord of w.blocks) {
      states.set(blockWord, {
        word: blockWord,
        isTarget: w.targets.some(
          (t) => t.word.toLowerCase().trim() === blockWord.toLowerCase().trim()
        ),
        found: false,
        status: 'idle',
      });
    }
    setBlockStates(states);
    setProgress(engine.getProgress());
    answerStartRef.current = Date.now();

    // Auto-read the instruction in Chinese
    const targetDefs = w.remainingTargets.map((t) => t.definition).join('，');
    speakChinese(`请找出这些单词：${targetDefs}`).catch(() => {});
  }, [onComplete, soundEnabled]);

  const handleBlockClick = useCallback(
    (blockWord: string) => {
      if (!engineRef.current || !wall || feedback) return;

      const blockState = blockStates.get(blockWord);
      if (!blockState || blockState.found) return;

      if (soundEnabled) playClick();

      const responseTimeMs = Date.now() - answerStartRef.current;
      const wallIndexBefore = engineRef.current.getCurrentWallIndex();
      const result = engineRef.current.submitAnswer(blockWord);

      // Update block state
      const newStates = new Map(blockStates);
      if (result.correct) {
        newStates.set(blockWord, { ...blockState, found: true, status: 'correct' });
        speakWord(blockWord).catch(() => {});

        if (soundEnabled) {
          playBlockBreak();
          const newCombo = engineRef.current.getComboCount();
          if (newCombo >= 2) playCombo(newCombo);
        }

        // Check if wall advanced (all targets found on this wall)
        const wallIndexAfter = engineRef.current.getCurrentWallIndex();
        if (wallIndexAfter !== wallIndexBefore) {
          if (soundEnabled) playWallComplete();
          // Wall complete — move to next after delay
          setTimeout(() => {
            if (engineRef.current) {
              loadWall(engineRef.current);
            }
          }, 1500);
        }
      } else {
        if (soundEnabled) playFail();
        newStates.set(blockWord, { ...blockState, status: 'incorrect' });
        // Highlight the first remaining target
        const curWall = engineRef.current.getCurrentWall();
        const firstTarget = curWall?.remainingTargets[0];
        if (firstTarget) {
          const targetWord = firstTarget.word;
          const targetState = newStates.get(targetWord);
          if (targetState) {
            newStates.set(targetWord, { ...targetState, status: 'highlight' });
          }
        }
        // Clear highlight after a moment
        setTimeout(() => {
          setBlockStates((prev) => {
            const next = new Map(prev);
            const ts = next.get(firstTarget?.word || '');
            if (ts && ts.status === 'highlight') {
              next.set(firstTarget!.word, { ...ts, status: 'idle' });
            }
            return next;
          });
        }, 2000);
        // Reset incorrect block
        setTimeout(() => {
          setBlockStates((prev) => {
            const next = new Map(prev);
            const s = next.get(blockWord);
            if (s && s.status === 'incorrect') {
              next.set(blockWord, { ...s, status: 'idle' });
            }
            return next;
          });
        }, 800);
      }

      setBlockStates(newStates);
      setComboCount(engineRef.current.getComboCount());

      setFeedback({
        correct: result.correct,
        word: result.correctAnswer,
        xp: result.xpEarned,
        combo: result.correct ? engineRef.current.getComboCount() : 0,
      });

      // Clear feedback
      setTimeout(() => setFeedback(null), result.correct ? 1000 : 1800);

      onAnswer(
        wall.targets.find(
          (t) => t.word.toLowerCase().trim() === blockWord.toLowerCase().trim()
        )?.id || wall.targets[0].id,
        result.correct,
        responseTimeMs
      );

      setProgress(engineRef.current.getProgress());
    },
    [wall, blockStates, feedback, onAnswer, loadWall, soundEnabled]
  );

  // Calculate which blocks go in which row for the 3×3 grid
  const displayBlocks = wall ? wall.blocks : [];
  const gridCols = 3;

  if (isComplete) {
    return (
      <div className="flex-col gap-md" style={{ alignItems: 'center', padding: 32 }}>
        <div className="pixel-text" style={{ color: 'var(--color-gold)', fontSize: 16 }}>
          ⛏️ Mine Complete!
        </div>
        <div className="flex" style={{ gap: 32, marginTop: 8 }}>
          <StatBox label="Found" value={`${progress.correctCount}`} color="var(--color-xp)" />
          <StatBox label="Misses" value={`${progress.incorrectCount}`} color="var(--color-redstone)" />
          <StatBox label="XP" value={`+${progress.xpEarned}`} color="var(--color-gold)" />
        </div>
        {engineRef.current && engineRef.current.getMaxCombo() >= 3 && (
          <div className="pixel-text-sm" style={{ color: 'var(--color-diamond)', fontSize: 9, marginTop: 8 }}>
            🔥 Max Combo: {engineRef.current.getMaxCombo()}x!
          </div>
        )}
      </div>
    );
  }

  if (!wall || displayBlocks.length === 0) {
    return (
      <div className="flex-center" style={{ height: 200 }}>
        <span className="pixel-text" style={{ color: 'var(--text-muted)' }}>
          Digging tunnel...
        </span>
      </div>
    );
  }

  const targetsRemaining = wall.remainingTargets.length;
  const targetsTotal = wall.targets.length;

  return (
    <div className="flex-col gap-md" style={{ padding: 16 }}>
      {/* Progress header */}
      <div>
        <div className="flex-between" style={{ marginBottom: 4 }}>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            Depth: Y={progress.currentQuestion * 4}
          </span>
          <span className="pixel-text-sm" style={{ color: 'var(--text-secondary)', fontSize: 8 }}>
            Found: {targetsTotal - targetsRemaining}/{targetsTotal}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: `${(progress.correctCount / Math.max(progress.totalQuestions, 1)) * 100}%`,
              background: 'linear-gradient(90deg, var(--color-xp-dim), var(--color-xp))',
            }}
          />
        </div>
      </div>

      {/* Target definitions to find */}
      <div className="mc-panel" style={{ padding: '12px 16px', textAlign: 'center' }}>
        <div className="pixel-text-sm" style={{ color: 'var(--text-muted)', fontSize: 7, marginBottom: 8 }}>
          FIND THESE WORDS IN THE MINE:
        </div>
        <div className="flex-col gap-sm">
          {wall.remainingTargets.map((target, i) => (
            <div
              key={target.id}
              style={{
                padding: '6px 10px',
                background: 'rgba(255,193,7,0.08)',
                border: '1px solid rgba(255,193,7,0.2)',
                borderRadius: 2,
                fontSize: 13,
                color: 'var(--color-gold)',
                animation: `fadeInUp 0.3s ${i * 0.1}s ease-out both`,
              }}
            >
              {target.definition}
            </div>
          ))}
        </div>
      </div>

      {/* Combo + Feedback */}
      <div style={{ minHeight: 28, textAlign: 'center' }}>
        {feedback && (
          <div
            style={{
              animation: 'fadeInUp 0.2s ease-out',
              color: feedback.correct ? 'var(--color-xp)' : 'var(--color-redstone)',
              fontSize: 13,
            }}
          >
            {feedback.correct ? (
              <span>
                ✅ +{feedback.xp}XP
                {feedback.combo >= 2 && (
                  <span style={{ color: 'var(--color-diamond)', marginLeft: 8 }}>
                    {feedback.combo}x COMBO!
                  </span>
                )}
              </span>
            ) : (
              <span>❌ Try again! Hint: {feedback.word}</span>
            )}
          </div>
        )}
      </div>

      {/* The Mine Wall — 3×3 grid */}
      <div className="cave-bg" style={{ padding: 12, borderRadius: 4 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: 8,
            maxWidth: 420,
            margin: '0 auto',
          }}
        >
          {displayBlocks.map((blockWord, i) => {
            const state = blockStates.get(blockWord);
            const isFound = state?.found;
            const status = state?.status || 'idle';

            // Calculate word length class for font sizing
            const wordLen = blockWord.length;
            const fontSize = wordLen > 12 ? 6 : wordLen > 9 ? 7 : wordLen > 6 ? 9 : 11;

            return (
              <button
                key={`${blockWord}-${i}`}
                className={[
                  'stone-block',
                  isFound ? 'diamond' : '',
                  status === 'incorrect' ? 'incorrect' : '',
                  status === 'highlight' ? 'highlight' : '',
                ].join(' ')}
                onClick={() => handleBlockClick(blockWord)}
                disabled={isFound || !!feedback}
                style={{
                  fontSize,
                  minWidth: 0,
                  minHeight: 60,
                  padding: '6px 8px',
                  opacity: isFound ? 0.4 : 1,
                  cursor: isFound ? 'default' : 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  position: 'relative',
                }}
              >
                {isFound ? (
                  '💎'
                ) : (
                  <>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        speakWord(blockWord).catch(() => {});
                      }}
                      style={{
                        fontSize: 8,
                        marginRight: 2,
                        cursor: 'pointer',
                        opacity: 0.6,
                      }}
                      title={`听发音: ${blockWord}`}
                    >
                      🔊
                    </span>
                    {blockWord}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Combo indicator */}
      <div className="flex-center">
        <span className="pixel-text-sm" style={{ color: 'var(--color-xp)', fontSize: 9 }}>
          ⭐ {progress.xpEarned} XP
        </span>
        {comboCount >= 2 && (
          <span
            className="pixel-text-sm combo-pop"
            style={{ color: 'var(--color-diamond)', fontSize: 9, marginLeft: 12 }}
          >
            🔥 {comboCount}x
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
