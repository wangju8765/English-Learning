// ============================================================
// HomePage — Welcome screen with stats and "Start Adventure" button
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { getLevel } from '../types';
import { selectSessionWords, getMasteredCount, getAccuracy } from '../services/spaced-repetition';
import { getTodayDate } from '../services/storage';

export default function HomePage() {
  const navigate = useNavigate();
  const { state } = useApp();
  const level = getLevel(state.player.xp);
  const allWords = Object.values(state.words);
  const mastered = getMasteredCount(allWords);
  const accuracy = getAccuracy(allWords);

  // Check if already played today
  const today = getTodayDate();
  const todaySessions = state.sessions.filter((s) => s.date === today);
  const hasPlayedToday = todaySessions.length > 0;

  // Words available for review
  const reviewWords = selectSessionWords(allWords, state.settings.dailyWordTarget);

  return (
    <div className="flex-col" style={{ padding: 24, gap: 24 }}>
      {/* Title */}
      <div className="flex-col" style={{ alignItems: 'center', gap: 8 }}>
        <h1 className="pixel-text" style={{ fontSize: 22, color: '#80FF20', textShadow: '3px 3px 0 #000' }}>
          ⛏️ English Craft
        </h1>
        <p style={{ color: '#AAA', fontSize: 13 }}>
          Welcome back, {state.player.name}!
        </p>
        {state.player.streakDays > 0 && (
          <p className="pixel-text-sm" style={{ color: '#FFA500', fontSize: 9 }}>
            🔥 {state.player.streakDays} Day Streak!
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="mc-panel" style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <StatBox label="Level" value={`Lv.${level}`} color="#80FF20" />
          <StatBox label="Total XP" value={`${state.player.xp}`} color="#F5A623" />
          <StatBox label="Words Mastered" value={`${mastered}`} color="#3CC6DE" />
          <StatBox label="Accuracy" value={`${accuracy}%`} color="#FF5252" />
        </div>
        {allWords.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#AAA' }}>Words ready for review</span>
              <span style={{ fontSize: 11, color: '#80FF20' }}>{reviewWords.length}</span>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min((reviewWords.length / allWords.length) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Action Button */}
      <button
        className="btn btn-primary"
        style={{ padding: '16px 32px', fontSize: 14, width: '100%' }}
        onClick={() => navigate('/quest')}
      >
        {hasPlayedToday ? '⚡ Continue Adventure' : '⛏️ Start Today\'s Quest'}
      </button>

      {/* Word count info */}
      <div className="flex-col" style={{ alignItems: 'center', gap: 4 }}>
        <p style={{ color: '#666', fontSize: 12 }}>
          📚 {allWords.length} words in your vocabulary
        </p>
        {todaySessions.length > 0 && (
          <p style={{ color: '#666', fontSize: 11 }}>
            ✅ {todaySessions.length} session(s) completed today
          </p>
        )}
      </div>

      {/* Daily Tip */}
      <div className="mc-panel" style={{ padding: 12, background: '#3A3A2A' }}>
        <p className="pixel-text-sm" style={{ color: '#FFC107', fontSize: 8, marginBottom: 4 }}>
          💡 Daily Tip
        </p>
        <p style={{ color: '#CCC', fontSize: 12 }}>
          Remember: "Software" = Soft (软的) + Ware (东西). Think of "hardware" — Hard (硬的) + Ware!
        </p>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="mc-panel-inset" style={{ padding: '8px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{label}</div>
      <div className="pixel-text-sm" style={{ fontSize: 12, color }}>
        {value}
      </div>
    </div>
  );
}
