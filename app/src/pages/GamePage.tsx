// ============================================================
// GamePage — Wrapper for all game modes
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import type { GameModeId, GameProgress } from '../types';
import DiamondMine from '../games/diamond-mine/DiamondMine';
import CraftingTable from '../games/crafting-table/CraftingTable';
import EnderPearlChallenge from '../games/ender-pearl/EnderPearlChallenge';

export default function GamePage() {
  const { modeId } = useParams<{ modeId: string }>();
  const navigate = useNavigate();
  const { state, submitGameAnswer, endGameSession } = useApp();
  const [gameResult, setGameResult] = useState<GameProgress | null>(null);

  const gameMode = modeId as GameModeId;
  const words = state.activeSession?.words ?? [];

  useEffect(() => {
    if (!state.activeSession) {
      navigate('/quest');
    }
  }, [state.activeSession, navigate]);

  const handleAnswer = useCallback(
    (wordId: string, correct: boolean, responseTimeMs: number) => {
      submitGameAnswer(wordId, correct, gameMode, responseTimeMs);
    },
    [submitGameAnswer, gameMode]
  );

  const handleComplete = useCallback(
    (progress: GameProgress) => {
      setGameResult(progress);
      if (state.activeSession) {
        const duration = Math.round((Date.now() - state.activeSession.startTime) / 1000);
        endGameSession(true, duration);
      }
    },
    [state.activeSession, endGameSession]
  );

  const handleQuit = () => {
    if (state.activeSession) {
      const duration = Math.round((Date.now() - state.activeSession.startTime) / 1000);
      endGameSession(false, duration);
    }
    navigate('/quest');
  };

  // Show results page
  if (gameResult) {
    return (
      <div className="flex-col" style={{ padding: 16, gap: 16 }}>
        <div className="mc-panel" style={{ padding: 24, textAlign: 'center' }}>
          <h2 className="pixel-text" style={{ fontSize: 18, color: '#FFC107', marginBottom: 16 }}>
            🏆 Adventure Complete!
          </h2>

          {/* Stars */}
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {gameResult.correctCount === gameResult.totalQuestions
              ? '⭐⭐⭐'
              : gameResult.correctCount >= gameResult.totalQuestions * 0.7
              ? '⭐⭐'
              : '⭐'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <ResultStat label="Correct" value={`${gameResult.correctCount}/${gameResult.totalQuestions}`} color="#80FF20" />
            <ResultStat label="Accuracy" value={`${Math.round((gameResult.correctCount / gameResult.totalQuestions) * 100)}%`} color="#3CC6DE" />
            <ResultStat label="XP Earned" value={`+${gameResult.xpEarned}`} color="#F5A623" />
            <ResultStat label="Total XP" value={`${state.player.xp}`} color="#80FF20" />
          </div>

          {gameResult.correctCount === gameResult.totalQuestions && (
            <div style={{ marginBottom: 16 }}>
              <span className="pixel-text-sm" style={{ color: '#FFC107', fontSize: 10 }}>
                🌟 Perfect! +25 XP Bonus!
              </span>
            </div>
          )}
        </div>

        {/* Wrong words review */}
        {gameResult.incorrectCount > 0 && (
          <div className="mc-panel" style={{ padding: 16 }}>
            <h3 className="pixel-text-sm" style={{ color: '#FF5252', fontSize: 10, marginBottom: 8 }}>
              🔄 Words to Review
            </h3>
            <div className="flex-col" style={{ gap: 4 }}>
              {words
                .filter((w) => {
                  const results = state.activeSession?.results ?? {};
                  return results[w.id] === false;
                })
                .map((w) => (
                  <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(255,85,85,0.1)' }}>
                    <span style={{ color: '#FFF', fontSize: 13 }}>{w.word}</span>
                    <span style={{ color: '#AAA', fontSize: 12 }}>{w.definition}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex-col" style={{ gap: 8 }}>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px 24px', fontSize: 12 }}
            onClick={() => navigate('/quest')}
          >
            🎮 Play Another Mode
          </button>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', padding: '12px 24px', fontSize: 12 }}
            onClick={() => navigate('/')}
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Render game
  return (
    <div>
      {/* Game header with quit button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px' }}>
        <h2 className="pixel-text-sm" style={{ color: '#FFF', fontSize: 10 }}>
          {getGameTitle(gameMode)}
        </h2>
        <button className="btn btn-ghost" style={{ fontSize: 8, padding: '4px 8px' }} onClick={handleQuit}>
          ✕ Quit
        </button>
      </div>

      {/* Render appropriate game component */}
      {gameMode === 'diamond_mine' && (
        <DiamondMine
          words={words}
          onAnswer={handleAnswer}
          onComplete={handleComplete}
        />
      )}

      {gameMode === 'crafting_table' && (
        <CraftingTable
          words={words}
          onAnswer={handleAnswer}
          onComplete={handleComplete}
        />
      )}

      {gameMode === 'ender_pearl' && (
        <EnderPearlChallenge
          words={words}
          onAnswer={handleAnswer}
          onComplete={handleComplete}
        />
      )}

      {gameMode !== 'diamond_mine' && gameMode !== 'crafting_table' && gameMode !== 'ender_pearl' && (
        <div className="flex-center" style={{ height: 200, padding: 24 }}>
          <div className="mc-panel" style={{ padding: 24, textAlign: 'center' }}>
            <span style={{ fontSize: 48 }}>🚧</span>
            <p className="pixel-text-sm" style={{ color: '#FFC107', fontSize: 10, marginTop: 12 }}>
              Coming Soon!
            </p>
            <p style={{ color: '#AAA', fontSize: 12, marginTop: 8 }}>
              This game mode is under construction. Check back later!
            </p>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 16, fontSize: 10, padding: '8px 16px' }}
              onClick={() => navigate('/quest')}
            >
              Back to Quests
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="mc-panel-inset" style={{ padding: '8px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{label}</div>
      <div className="pixel-text-sm" style={{ fontSize: 12, color }}>{value}</div>
    </div>
  );
}

function getGameTitle(modeId: GameModeId): string {
  const titles: Record<GameModeId, string> = {
    diamond_mine: '⛏️ Diamond Mine',
    crafting_table: '🛠️ Crafting Table',
    ender_pearl: '🎯 Ender Pearl Challenge',
    redstone_quiz: '🔴 Redstone Quiz',
    nether_portal: '🌑 Nether Portal Escape',
  };
  return titles[modeId] || 'Game';
}
