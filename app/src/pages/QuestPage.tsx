// ============================================================
// QuestPage — Daily quest: play all modes, unlock Nether Portal
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import {
  getRegularModes,
  getPortalMode,
  isPortalUnlocked,
  XP_CONFIG,
  type GameModeMeta,
} from '../types';
import { selectWordsForMode } from '../services/spaced-repetition';
import { getTodayDate } from '../services/storage';

const DAILY_TARGET = XP_CONFIG.DAILY_QUEST_TARGET; // 3

export default function QuestPage() {
  const navigate = useNavigate();
  const { state, startGameSession } = useApp();
  const today = getTodayDate();
  const allWords = Object.values(state.words);
  const streakDays = state.player.streakDays;

  const todaySessions = state.sessions.filter((s) => s.date === today);
  const completedModes = new Set(todaySessions.filter((s) => s.completed).map((s) => s.gameMode));
  const completedCount = completedModes.size;
  const dailyQuestComplete = completedCount >= DAILY_TARGET;

  const regularModes = getRegularModes();
  const portalMode = getPortalMode();
  const portalUnlocked = isPortalUnlocked(streakDays, completedCount);

  const handleStartGame = (mode: GameModeMeta) => {
    const words = selectWordsForMode(allWords, state.settings.dailyWordTarget, mode.id);
    if (words.length === 0) {
      alert('No words to review! Add some vocabulary first.');
      return;
    }
    startGameSession(mode.id, words);
    navigate(`/game/${mode.id}`);
  };

  return (
    <div className="flex-col" style={{ padding: 16, gap: 16 }}>
      {/* Quest Header */}
      <div className="mc-panel" style={{ padding: 16, textAlign: 'center' }}>
        <h2 className="pixel-text" style={{ fontSize: 14, color: '#FFC107', marginBottom: 8 }}>
          📖 Daily Quest
        </h2>
        <p style={{ color: '#AAA', fontSize: 13 }}>
          Complete {DAILY_TARGET} different game modes to finish today's quest!
        </p>
        <div style={{ marginTop: 12 }}>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${Math.min((completedCount / DAILY_TARGET) * 100, 100)}%`,
                background: dailyQuestComplete
                  ? 'linear-gradient(90deg, #F5A623, #FFC107)'
                  : undefined,
              }}
            />
          </div>
          <span className="pixel-text-sm" style={{ color: '#AAA', fontSize: 8, marginTop: 4, display: 'block' }}>
            {completedCount} / {DAILY_TARGET} Modes Complete
          </span>
        </div>
        {dailyQuestComplete && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 16px',
              background: 'rgba(255,193,7,0.12)',
              borderRadius: 6,
              border: '1px solid rgba(255,193,7,0.3)',
            }}
          >
            <span className="pixel-text-sm" style={{ color: '#FFC107', fontSize: 11 }}>
              🎉 Quest Complete! +{XP_CONFIG.DAILY_QUEST_BONUS} XP Bonus Awarded!
            </span>
          </div>
        )}
      </div>

      {/* Streak info */}
      {streakDays > 0 && (
        <div
          className="mc-panel"
          style={{
            padding: '10px 16px',
            textAlign: 'center',
            background: 'rgba(255,165,0,0.08)',
            border: '1px solid rgba(255,165,0,0.2)',
          }}
        >
          <span className="pixel-text-sm" style={{ color: '#FFA500', fontSize: 9 }}>
            🔥 {streakDays} Day Streak — +{Math.min(streakDays, 5) * 5} XP bonus per game!
          </span>
        </div>
      )}

      {/* Word Count */}
      {allWords.length === 0 ? (
        <div className="mc-panel" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ color: '#AAA', fontSize: 14 }}>
            No vocabulary words yet!
          </p>
          <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
            Add .md files to the vocabulary/ folder to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Regular Game Mode Cards — always available */}
          <div className="flex-col" style={{ gap: 12 }}>
            {regularModes.map((mode) => {
              const completed = completedModes.has(mode.id);
              return (
                <GameModeCard
                  key={mode.id}
                  mode={mode}
                  completed={completed}
                  onStart={() => handleStartGame(mode)}
                />
              );
            })}
          </div>

          {/* Nether Portal — special unlock conditions */}
          <div>
            <p className="pixel-text-sm" style={{ color: '#666', fontSize: 9, marginBottom: 8 }}>
              🌑 Boss Level {portalUnlocked ? '— UNLOCKED!' : '— locked'}
            </p>
            <PortalCard
              mode={portalMode}
              unlocked={portalUnlocked}
              streakDays={streakDays}
              completedToday={completedCount}
              onStart={() => handleStartGame(portalMode)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function GameModeCard({
  mode,
  completed,
  onStart,
}: {
  mode: GameModeMeta;
  completed: boolean;
  onStart: () => void;
}) {
  const difficultyStars = '⭐'.repeat(mode.difficulty);

  return (
    <button
      className="mc-panel"
      onClick={onStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        cursor: 'pointer',
        opacity: completed ? 0.7 : 1,
        textAlign: 'left',
        width: '100%',
        background: completed ? '#3A3A2A' : undefined,
        border: completed ? '3px solid #F5A623' : undefined,
      }}
    >
      <span style={{ fontSize: 36 }}>{mode.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="pixel-text-sm" style={{ color: '#FFF', fontSize: 10 }}>
            {mode.name}
          </span>
          <span style={{ fontSize: 10 }}>{difficultyStars}</span>
        </div>
        <p style={{ color: '#AAA', fontSize: 11 }}>{mode.description}</p>
        <p style={{ color: '#FFC107', fontSize: 10, marginTop: 4 }}>{mode.nameZh}</p>
      </div>
      <div>
        {completed ? (
          <span className="pixel-text-sm" style={{ color: '#80FF20', fontSize: 10 }}>✅ Done</span>
        ) : (
          <span className="btn btn-ghost" style={{ fontSize: 8, padding: '4px 8px' }}>
            PLAY
          </span>
        )}
      </div>
    </button>
  );
}

function PortalCard({
  mode,
  unlocked,
  streakDays,
  completedToday,
  onStart,
}: {
  mode: GameModeMeta;
  unlocked: boolean;
  streakDays: number;
  completedToday: number;
  onStart: () => void;
}) {
  const streakMet = streakDays >= 6;
  const dailyMet = completedToday >= 3;

  return (
    <button
      className="mc-panel"
      onClick={unlocked ? onStart : undefined}
      disabled={!unlocked}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        cursor: unlocked ? 'pointer' : 'not-allowed',
        opacity: unlocked ? 1 : 0.5,
        textAlign: 'left',
        width: '100%',
        background: unlocked
          ? 'linear-gradient(135deg, rgba(128,0,128,0.15), rgba(75,0,130,0.1))'
          : undefined,
        border: unlocked ? '2px solid rgba(147,51,234,0.5)' : undefined,
      }}
    >
      <span style={{ fontSize: 36 }}>{mode.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="pixel-text-sm" style={{ color: unlocked ? '#C084FC' : '#888', fontSize: 10 }}>
            {mode.name}
          </span>
          <span style={{ fontSize: 10 }}>⭐⭐⭐</span>
        </div>
        <p style={{ color: '#AAA', fontSize: 11 }}>{mode.description}</p>
        {/* Unlock conditions */}
        <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 10 }}>
          <span style={{ color: streakMet ? '#80FF20' : '#666' }}>
            {streakMet ? '✅' : '⬜'} {streakDays}/6 Day Streak
          </span>
          <span style={{ color: dailyMet ? '#80FF20' : '#666' }}>
            {dailyMet ? '✅' : '⬜'} {completedToday}/3 Today
          </span>
        </div>
      </div>
      <div>
        {unlocked ? (
          <span className="btn btn-primary" style={{ fontSize: 8, padding: '4px 8px', background: '#7C3AED' }}>
            ⚔️ FIGHT
          </span>
        ) : (
          <span className="pixel-text-sm" style={{ color: '#666', fontSize: 9 }}>
            🔒
          </span>
        )}
      </div>
    </button>
  );
}
