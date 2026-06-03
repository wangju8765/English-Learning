// ============================================================
// QuestPage — Daily quest: select and play game modes
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { GAME_MODES, type GameModeMeta } from '../types';
import { selectSessionWords } from '../services/spaced-repetition';
import { getTodayDate } from '../services/storage';

export default function QuestPage() {
  const navigate = useNavigate();
  const { state, startGameSession } = useApp();
  const today = getTodayDate();
  const allWords = Object.values(state.words);

  const todaySessions = state.sessions.filter((s) => s.date === today);
  const completedModes = new Set(todaySessions.map((s) => s.gameMode));
  const dailyQuestComplete = completedModes.size >= 2;

  const handleStartGame = (mode: GameModeMeta) => {
    const words = selectSessionWords(allWords, state.settings.dailyWordTarget);
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
      <div className="minecraft-panel" style={{ padding: 16, textAlign: 'center' }}>
        <h2 className="pixel-text" style={{ fontSize: 14, color: '#FFC107', marginBottom: 8 }}>
          📖 Daily Quest
        </h2>
        <p style={{ color: '#AAA', fontSize: 13 }}>
          Complete 2 game modes to finish today's quest!
        </p>
        <div style={{ marginTop: 12 }}>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{
                width: `${(completedModes.size / 2) * 100}%`,
                background: dailyQuestComplete
                  ? 'linear-gradient(180deg, #FFC107 0%, #F5A623 100%)'
                  : undefined,
              }}
            />
          </div>
          <span className="pixel-text-sm" style={{ color: '#AAA', fontSize: 8, marginTop: 4, display: 'block' }}>
            {completedModes.size} / 2 Modes Complete
          </span>
        </div>
        {dailyQuestComplete && (
          <div style={{ marginTop: 12 }}>
            <span className="pixel-text-sm" style={{ color: '#FFC107', fontSize: 10 }}>
              🎉 Quest Complete! +50 XP Bonus!
            </span>
          </div>
        )}
      </div>

      {/* Word Count */}
      {allWords.length === 0 ? (
        <div className="minecraft-panel" style={{ padding: 24, textAlign: 'center' }}>
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
          {/* Game Mode Cards */}
          <div className="flex-col" style={{ gap: 12 }}>
            {GAME_MODES.filter((m) => m.unlocked).map((mode) => {
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

          {/* Locked modes */}
          {GAME_MODES.filter((m) => !m.unlocked).length > 0 && (
            <div>
              <p className="pixel-text-sm" style={{ color: '#666', fontSize: 9, marginBottom: 8 }}>
                🔒 Locked (reach Day {GAME_MODES.find((m) => !m.unlocked)?.unlockDay} to unlock)
              </p>
              {GAME_MODES.filter((m) => !m.unlocked).map((mode) => (
                <GameModeCard
                  key={mode.id}
                  mode={mode}
                  completed={false}
                  onStart={() => {}}
                  locked
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GameModeCard({
  mode,
  completed,
  onStart,
  locked = false,
}: {
  mode: GameModeMeta;
  completed: boolean;
  onStart: () => void;
  locked?: boolean;
}) {
  const difficultyStars = '⭐'.repeat(mode.difficulty);

  return (
    <button
      className="minecraft-panel"
      onClick={locked ? undefined : onStart}
      disabled={locked}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.4 : completed ? 0.7 : 1,
        textAlign: 'left',
        width: '100%',
        background: completed ? '#3A3A2A' : undefined,
        border: completed
          ? '3px solid #F5A623'
          : undefined,
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
        ) : locked ? (
          <span className="pixel-text-sm" style={{ color: '#666', fontSize: 10 }}>🔒</span>
        ) : (
          <span className="minecraft-button btn-stone" style={{ fontSize: 8, padding: '4px 8px' }}>
            PLAY
          </span>
        )}
      </div>
    </button>
  );
}
