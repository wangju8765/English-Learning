// ============================================================
// HomePage — Welcome screen with stats, daily quest, streak, and "Start" button
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { getLevel, XP_CONFIG } from '../types';
import { selectSessionWords, getMasteredCount, getAccuracy } from '../services/spaced-repetition';
import { getTodayDate } from '../services/storage';
import LearningDashboard from '../components/LearningDashboard';

export default function HomePage() {
  const navigate = useNavigate();
  const { state } = useApp();
  const level = getLevel(state.player.xp);
  const allWords = Object.values(state.words);
  const mastered = getMasteredCount(allWords);
  const accuracy = getAccuracy(allWords);
  const today = getTodayDate();

  // Daily quest progress
  const todaySessions = state.sessions.filter((s) => s.date === today);
  const completedModes = new Set(todaySessions.filter((s) => s.completed).map((s) => s.gameMode));
  const dailyQuestProgress = completedModes.size;
  const dailyQuestTarget = XP_CONFIG.DAILY_QUEST_TARGET;
  const dailyQuestComplete = dailyQuestProgress >= dailyQuestTarget;

  // Words available for review
  const reviewWords = selectSessionWords(allWords, state.settings.dailyWordTarget);
  const hasPlayedToday = todaySessions.length > 0;

  // Streak
  const streak = state.player.streakDays;

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
      </div>

      {/* Streak Banner */}
      {streak >= 3 ? (
        <div
          className="mc-panel"
          style={{
            padding: '12px 16px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(255,140,0,0.15), rgba(255,69,0,0.1))',
            border: '1px solid rgba(255,140,0,0.4)',
          }}
        >
          <span style={{ fontSize: 20, animation: 'pulse 0.6s ease-in-out infinite' }}>🔥</span>
          <span className="pixel-text" style={{ color: '#FFA500', fontSize: 11, marginLeft: 8 }}>
            {streak} Day Streak! +{Math.min(streak, 5) * 5} XP bonus per game!
          </span>
        </div>
      ) : streak > 0 ? (
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
            🔥 {streak} Day Streak — keep it going!
          </span>
        </div>
      ) : (
        <div
          className="mc-panel"
          style={{
            padding: '10px 16px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.1)',
          }}
        >
          <span style={{ color: '#666', fontSize: 11 }}>
            Play today to start a 🔥 streak!
          </span>
        </div>
      )}

      {/* Learning Journey Dashboard */}
      <LearningDashboard
        allWords={allWords}
        todaySessions={todaySessions}
      />

      {/* Daily Quest Card */}
      <div
        className="mc-panel"
        style={{
          padding: 16,
          background: dailyQuestComplete ? 'rgba(255,193,7,0.08)' : undefined,
          border: dailyQuestComplete ? '2px solid #F5A623' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>📖</span>
          <div style={{ flex: 1 }}>
            <span className="pixel-text-sm" style={{ color: '#FFC107', fontSize: 10 }}>
              Daily Quest
            </span>
            <span style={{ color: '#AAA', fontSize: 11, marginLeft: 8 }}>
              Complete {dailyQuestTarget} different game modes
            </span>
          </div>
          {dailyQuestComplete ? (
            <span className="pixel-text-sm" style={{ color: '#80FF20', fontSize: 10 }}>✅ Done!</span>
          ) : (
            <span style={{ color: '#AAA', fontSize: 11 }}>
              {dailyQuestProgress}/{dailyQuestTarget}
            </span>
          )}
        </div>
        <div className="progress-bar" style={{ height: 6 }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${(dailyQuestProgress / dailyQuestTarget) * 100}%`,
              background: dailyQuestComplete
                ? 'linear-gradient(90deg, #F5A623, #FFC107)'
                : undefined,
            }}
          />
        </div>
        {dailyQuestComplete && (
          <p style={{ color: '#FFC107', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
            🎉 Quest Complete! +50 XP Bonus awarded!
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
        {dailyQuestComplete
          ? '🎉 All Quests Done — Play More!'
          : hasPlayedToday
            ? `⚡ Continue (${dailyQuestProgress}/${dailyQuestTarget})`
            : '⛏️ Start Today\'s Quest'}
      </button>

      {/* Word count info */}
      <div className="flex-col" style={{ alignItems: 'center', gap: 4 }}>
        <p style={{ color: '#666', fontSize: 12 }}>
          📚 {allWords.length} words in your vocabulary
        </p>
        {todaySessions.length > 0 && (
          <p style={{ color: '#666', fontSize: 11 }}>
            ✅ {todaySessions.length} session(s) played today
          </p>
        )}
      </div>

      {/* Daily Tip */}
      <div className="mc-panel" style={{ padding: 12, background: 'rgba(255,193,7,0.06)' }}>
        <p className="pixel-text-sm" style={{ color: '#FFC107', fontSize: 8, marginBottom: 4 }}>
          💡 Learning Path
        </p>
        <p style={{ color: '#CCC', fontSize: 12 }}>
          New words? Start with 🎤 Echo Chamber to learn the sounds, then practice with other modes. Come back each day to unlock new challenges and build your 🔥 streak!
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
