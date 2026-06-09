// ============================================================
// LearningDashboard — Daily progress, Portal unlock, mastery overview
// ============================================================
import { useMemo } from 'react';
import {
  getRegularModes,
  isPortalUnlocked,
  PORTAL_STREAK_REQUIRED,
  PORTAL_DAILY_MODES_REQUIRED,
  XP_CONFIG,
  type MasteryLevel,
} from '../types';
import { getMasteryDistribution } from '../services/spaced-repetition';
import type { WordState, SessionRecord } from '../types';

interface LearningDashboardProps {
  streakDays: number;
  allWords: WordState[];
  todaySessions: SessionRecord[];
}

export default function LearningDashboard({ streakDays, allWords, todaySessions }: LearningDashboardProps) {
  const today = new Date().toISOString().slice(0, 10);
  const completedToday = new Set(
    todaySessions.filter((s) => s.date === today && s.completed).map((s) => s.gameMode)
  );
  const completedCount = completedToday.size;

  const portalUnlocked = isPortalUnlocked(streakDays, completedCount);
  const regularModes = getRegularModes();
  const distribution = getMasteryDistribution(allWords);
  const totalWords = allWords.length;

  // Today's recommendation: first unplayed regular mode
  const recommendation = useMemo(() => {
    const unplayed = regularModes.filter((m) => !completedToday.has(m.id));
    if (unplayed.length === 0) {
      if (portalUnlocked) {
        return { icon: '🌑', text: 'All modes done! Time for the Nether Portal boss fight!' };
      }
      return { icon: '✅', text: 'All modes completed today! Great job!' };
    }
    // Recommend the easiest unplayed mode first
    const rec = unplayed.sort((a, b) => a.difficulty - b.difficulty)[0];
    return { icon: rec.icon, text: `Next: ${rec.name} — ${rec.description}` };
  }, [regularModes, completedToday, portalUnlocked]);

  return (
    <div className="flex-col" style={{ gap: 16 }}>
      {/* Today's Progress Grid */}
      <div className="mc-panel" style={{ padding: 16 }}>
        <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9, marginBottom: 12 }}>
          📋 Today's Progress ({completedCount}/{XP_CONFIG.DAILY_QUEST_TARGET} for quest, {regularModes.length} modes available)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {regularModes.map((mode) => {
            const done = completedToday.has(mode.id);
            return (
              <div
                key={mode.id}
                style={{
                  padding: '10px 6px',
                  textAlign: 'center',
                  background: done ? 'rgba(128,255,32,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${done ? 'rgba(128,255,32,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 6,
                  opacity: done ? 0.8 : 1,
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 2 }}>{mode.icon}</div>
                <div style={{ fontSize: 7, color: done ? '#80FF20' : '#666' }}>
                  {done ? '✅' : '⬜'} {mode.nameZh}
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily quest progress bar */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#888' }}>Daily Quest</span>
            <span style={{ fontSize: 10, color: completedCount >= XP_CONFIG.DAILY_QUEST_TARGET ? '#80FF20' : '#AAA' }}>
              {completedCount}/{XP_CONFIG.DAILY_QUEST_TARGET}
            </span>
          </div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div
              className="progress-bar-fill"
              style={{
                width: `${Math.min((completedCount / XP_CONFIG.DAILY_QUEST_TARGET) * 100, 100)}%`,
                background: completedCount >= XP_CONFIG.DAILY_QUEST_TARGET
                  ? 'linear-gradient(90deg, #F5A623, #FFC107)'
                  : undefined,
              }}
            />
          </div>
        </div>
      </div>

      {/* Portal Unlock Progress */}
      <div
        className="mc-panel"
        style={{
          padding: 14,
          background: portalUnlocked
            ? 'linear-gradient(135deg, rgba(128,0,128,0.15), rgba(75,0,130,0.1))'
            : 'rgba(255,255,255,0.02)',
          border: portalUnlocked ? '2px solid rgba(147,51,234,0.4)' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: portalUnlocked ? 28 : 20, filter: portalUnlocked ? undefined : 'grayscale(100%)' }}>
            🌑
          </span>
          <div style={{ flex: 1 }}>
            <span className="pixel-text-sm" style={{ color: portalUnlocked ? '#C084FC' : '#888', fontSize: 9 }}>
              Nether Portal {portalUnlocked ? 'UNLOCKED!' : 'Locked'}
            </span>
            {!portalUnlocked && (
              <p style={{ color: '#666', fontSize: 10, marginTop: 2 }}>
                Complete both conditions to unlock the boss fight
              </p>
            )}
          </div>
          {portalUnlocked && (
            <span className="pixel-text-sm" style={{ color: '#C084FC', fontSize: 10 }}>
              ⚔️ READY
            </span>
          )}
        </div>

        {/* Two progress bars */}
        <div className="flex-col" style={{ gap: 6 }}>
          {/* Streak bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: '#888' }}>
                🔥 Streak ({streakDays}/{PORTAL_STREAK_REQUIRED} days)
              </span>
              <span style={{ fontSize: 9, color: streakDays >= PORTAL_STREAK_REQUIRED ? '#80FF20' : '#666' }}>
                {streakDays >= PORTAL_STREAK_REQUIRED ? '✅' : `${PORTAL_STREAK_REQUIRED - streakDays}d left`}
              </span>
            </div>
            <div className="progress-bar" style={{ height: 6 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min((streakDays / PORTAL_STREAK_REQUIRED) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #FF8C00, #FFA500)',
                }}
              />
            </div>
          </div>

          {/* Daily bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: '#888' }}>
                📋 Today ({completedCount}/{PORTAL_DAILY_MODES_REQUIRED} modes)
              </span>
              <span style={{ fontSize: 9, color: completedCount >= PORTAL_DAILY_MODES_REQUIRED ? '#80FF20' : '#666' }}>
                {completedCount >= PORTAL_DAILY_MODES_REQUIRED ? '✅' : `${PORTAL_DAILY_MODES_REQUIRED - completedCount} left`}
              </span>
            </div>
            <div className="progress-bar" style={{ height: 6 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min((completedCount / PORTAL_DAILY_MODES_REQUIRED) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, #7C3AED, #A78BFA)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mastery + Recommendation Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Compact Mastery Breakdown */}
        <div className="mc-panel" style={{ padding: 12 }}>
          <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 8, marginBottom: 8 }}>
            📊 Word Mastery
          </h3>
          {totalWords === 0 ? (
            <p style={{ color: '#666', fontSize: 11 }}>No words yet</p>
          ) : (
            <div className="flex-col" style={{ gap: 4 }}>
              {([0, 1, 2, 3, 4, 5] as MasteryLevel[]).map((level) => {
                const count = distribution[level] || 0;
                const maxCount = Math.max(...Object.values(distribution), 1);
                const colors: Record<number, string> = {
                  0: '#7F7F7F', 1: '#5C5C5C', 2: '#A0A0A0',
                  3: '#F5A623', 4: '#3CC6DE', 5: '#9B59B6',
                };
                const labels: Record<number, string> = {
                  0: '🪨', 1: 'Coal', 2: 'Iron', 3: '🥇', 4: '💎', 5: '🔮',
                };
                if (count === 0 && level > 0) return null;
                return (
                  <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, width: 18, textAlign: 'center' }}>{labels[level]}</span>
                    <div className="progress-bar" style={{ flex: 1, height: 6 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${(count / maxCount) * 100}%`,
                          background: `linear-gradient(90deg, ${colors[level]}, ${colors[level]}88)`,
                        }}
                      />
                    </div>
                    <span style={{ color: '#888', fontSize: 10, width: 16, textAlign: 'right' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Today's Recommendation */}
        <div className="mc-panel" style={{ padding: 12 }}>
          <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 8, marginBottom: 8 }}>
            💡 Next Up
          </h3>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>{recommendation.icon}</div>
            <p style={{ color: '#CCC', fontSize: 11, lineHeight: 1.4 }}>{recommendation.text}</p>
          </div>
          {totalWords > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#888' }}>
                <span>🆕 {distribution[0] || 0}</span>
                <span>📖 {(distribution[1] || 0) + (distribution[2] || 0) + (distribution[3] || 0)}</span>
                <span>✅ {(distribution[4] || 0) + (distribution[5] || 0)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
