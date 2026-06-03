// ============================================================
// ProgressPage — Stats, mastery distribution, achievements
// ============================================================
import { useApp } from '../store/AppContext';
import { getLevel } from '../types';
import { getMasteryDistribution, getMasteredCount, getAccuracy } from '../services/spaced-repetition';
import { MASTERY_NAMES, type MasteryLevel } from '../types';

export default function ProgressPage() {
  const { state } = useApp();
  const allWords = Object.values(state.words);
  const level = getLevel(state.player.xp);
  const mastered = getMasteredCount(allWords);
  const accuracy = getAccuracy(allWords);
  const distribution = getMasteryDistribution(allWords);

  if (allWords.length === 0) {
    return (
      <div className="flex-col" style={{ padding: 24, gap: 16, alignItems: 'center' }}>
        <div className="mc-panel" style={{ padding: 32, textAlign: 'center' }}>
          <span style={{ fontSize: 48 }}>🗺️</span>
          <p style={{ color: '#AAA', fontSize: 14, marginTop: 12 }}>
            Your adventure map is empty.
          </p>
          <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
            Play some games to see your progress!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col" style={{ padding: 16, gap: 16 }}>
      <h2 className="pixel-text" style={{ fontSize: 14, color: '#FFC107', textAlign: 'center' }}>
        🗺️ Adventure Progress
      </h2>

      {/* Stats Overview */}
      <div className="mc-panel" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <MiniStat label="Level" value={`Lv.${level}`} color="#80FF20" />
          <MiniStat label="Total XP" value={`${state.player.xp}`} color="#F5A623" />
          <MiniStat label="Mastered" value={`${mastered}`} color="#3CC6DE" />
          <MiniStat label="Accuracy" value={`${accuracy}%`} color="#FF5252" />
          <MiniStat label="Streak" value={`🔥${state.player.streakDays}d`} color="#FFA500" />
          <MiniStat label="Sessions" value={`${state.player.totalSessionsCompleted}`} color="#AAA" />
        </div>
      </div>

      {/* Mastery Distribution */}
      <div className="mc-panel" style={{ padding: 16 }}>
        <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9, marginBottom: 12 }}>
          📊 Mastery Distribution
        </h3>
        <div className="flex-col" style={{ gap: 6 }}>
          {([0, 1, 2, 3, 4, 5] as MasteryLevel[]).map((level) => {
            const count = distribution[level] || 0;
            const maxCount = Math.max(...Object.values(distribution), 1);
            const gems: Record<number, string> = { 0: '🪨', 1: '🪨', 2: '⛏️', 3: '🥇', 4: '💎', 5: '🔮' };
            return (
              <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{gems[level]}</span>
                <span className="pixel-text-sm" style={{ color: '#AAA', fontSize: 8, width: 60 }}>
                  {MASTERY_NAMES[level]}
                </span>
                <div className="progress-bar" style={{ flex: 1, height: 10 }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      background: getMasteryColor(level),
                    }}
                  />
                </div>
                <span style={{ color: '#AAA', fontSize: 11, width: 24, textAlign: 'right' }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session History */}
      {state.sessions.length > 0 && (
        <div className="mc-panel" style={{ padding: 16 }}>
          <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9, marginBottom: 12 }}>
            📜 Recent Adventures
          </h3>
          <div className="flex-col" style={{ gap: 4 }}>
            {state.sessions.slice(-7).reverse().map((session) => {
              const correct = Object.values(session.results).filter(Boolean).length;
              const total = Object.keys(session.results).length;
              return (
                <div
                  key={session.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    background: 'rgba(255,255,255,0.05)',
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: '#AAA' }}>{session.date}</span>
                  <span style={{ color: '#FFF' }}>
                    {getGameEmoji(session.gameMode)} {correct}/{total}
                  </span>
                  <span style={{ color: '#80FF20' }}>+{session.xpEarned}XP</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="mc-panel-inset" style={{ padding: '8px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: '#888', marginBottom: 4 }}>{label}</div>
      <div className="pixel-text-sm" style={{ fontSize: 11, color }}>{value}</div>
    </div>
  );
}

function getMasteryColor(level: number): string {
  const colors: Record<number, string> = {
    0: 'linear-gradient(180deg, #7F7F7F 0%, #5C5C5C 100%)',
    1: 'linear-gradient(180deg, #3D3D3D 0%, #1A1A1A 100%)',
    2: 'linear-gradient(180deg, #D9D9D9 0%, #A0A0A0 100%)',
    3: 'linear-gradient(180deg, #F5A623 0%, #B8770A 100%)',
    4: 'linear-gradient(180deg, #3CC6DE 0%, #1B8FA8 100%)',
    5: 'linear-gradient(180deg, #4A4A4A 0%, #2A2A2A 100%)',
  };
  return colors[level] || colors[0];
}

function getGameEmoji(gameMode: string): string {
  const emojis: Record<string, string> = {
    diamond_mine: '⛏️',
    crafting_table: '🛠️',
    ender_pearl: '🎯',
    redstone_quiz: '🔴',
    nether_portal: '🌑',
  };
  return emojis[gameMode] || '🎮';
}
