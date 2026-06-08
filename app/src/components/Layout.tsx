// ============================================================
// Layout — TopBar + BottomNav Hotbar
// ============================================================
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { getLevel, xpToNextLevel } from '../types';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: '⛏️' },
  { path: '/quest', label: 'Quest', icon: '📖' },
  { path: '/progress', label: 'Progress', icon: '🗺️' },
  { path: '/words', label: 'Words', icon: '📚' },
  { path: '/inventory', label: 'Items', icon: '🎒' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout() {
  const { state } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const level = getLevel(state.player.xp);
  const xpNext = xpToNextLevel(state.player.xp);
  const xpProgress = Math.round(((xpNext - xpToNextLevel(state.player.xp)) / xpNext) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: 800, margin: '0 auto', background: '#1A1A1A' }}>
      {/* TopBar */}
      <header
        className="mc-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          margin: '8px',
          gap: 16,
        }}
      >
        {/* Player avatar placeholder */}
        <div
          style={{
            width: 40,
            height: 40,
            background: '#8B6914',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            border: '2px solid #373737',
          }}
        >
          🧑
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="pixel-text-sm" style={{ color: '#FFF', fontSize: 10 }}>
              {state.player.name}
            </span>
            <span className="pixel-text-sm" style={{ color: '#80FF20', fontSize: 8 }}>
              Lv.{level}
            </span>
            {state.player.streakDays > 0 && (
              <span
                className="pixel-text-sm"
                style={{
                  color: '#FFA500',
                  fontSize: 8,
                  animation: state.player.streakDays >= 3 ? 'pulse 0.8s ease-in-out infinite' : undefined,
                }}
              >
                🔥 {state.player.streakDays}d
              </span>
            )}
          </div>
          <div className="xp-bar">
            <div className="xp-bar-fill" style={{ width: `${Math.min(xpProgress, 100)}%` }} />
          </div>
          <div className="pixel-text-sm" style={{ color: '#80FF20', fontSize: 7, marginTop: 2 }}>
            XP: {state.player.xp} / {xpNext} to Lv.{level + 1}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        <Outlet />
      </main>

      {/* BottomNav Hotbar */}
      <nav
        className="mc-panel"
        style={{
          margin: '8px',
          padding: '6px 12px',
        }}
      >
        <div className="hotbar">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                className={`hotbar-slot ${isActive ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <span>{item.icon}</span>
                <span className="hotbar-slot-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
