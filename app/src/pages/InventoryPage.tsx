// ============================================================
// InventoryPage — Minecraft-style item collection display
// ============================================================
import { useApp } from '../store/AppContext';

// Inventory will be populated in Phase 3 with achievements/items
export default function InventoryPage() {
  const { state } = useApp();
  const totalSlots = 27; // 3 rows of 9 like Minecraft

  // Placeholder items based on player stats
  const items: { icon: string; name: string; acquired: boolean }[] = [
    { icon: '⛏️', name: 'Wooden Pickaxe', acquired: state.player.totalSessionsCompleted >= 1 },
    { icon: '📖', name: 'Enchanted Book', acquired: Object.values(state.words).some((w) => w.masteryLevel >= 5) },
    { icon: '💎', name: 'Diamond', acquired: Object.values(state.words).filter((w) => w.masteryLevel >= 4).length >= 5 },
    { icon: '🔥', name: 'Blaze Rod', acquired: state.player.streakDays >= 3 },
    { icon: '🌟', name: 'Nether Star', acquired: state.player.streakDays >= 7 },
    { icon: '🗡️', name: 'Stone Sword', acquired: state.player.totalSessionsCompleted >= 5 },
    { icon: '🛡️', name: 'Shield', acquired: state.player.totalSessionsCompleted >= 10 },
    { icon: '🎯', name: 'Ender Pearl', acquired: state.player.totalWordsEncountered >= 20 },
    { icon: '🏆', name: 'Trophy', acquired: state.player.xp >= 1000 },
  ];

  while (items.length < totalSlots) {
    items.push({ icon: '❓', name: '???', acquired: false });
  }

  return (
    <div className="flex-col" style={{ padding: 16, gap: 16 }}>
      <h2 className="pixel-text" style={{ fontSize: 14, color: '#FFC107', textAlign: 'center' }}>
        🎒 Inventory
      </h2>

      <div className="mc-panel" style={{ padding: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 1fr)',
            gap: 4,
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="mc-panel-inset"
              title={item.acquired ? item.name : '???'}
              style={{
                aspectRatio: '1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                opacity: item.acquired ? 1 : 0.3,
                cursor: item.acquired ? 'pointer' : 'default',
              }}
            >
              {item.acquired ? item.icon : '⬛'}
            </div>
          ))}
        </div>
      </div>

      <div className="mc-panel" style={{ padding: 16 }}>
        <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9, marginBottom: 12 }}>
          📋 Collection Log
        </h3>
        <div className="flex-col" style={{ gap: 4 }}>
          {items.filter((i) => i.name !== '???').map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                opacity: item.acquired ? 1 : 0.4,
              }}
            >
              <span style={{ fontSize: 16 }}>{item.acquired ? item.icon : '⬛'}</span>
              <span style={{ color: item.acquired ? '#FFF' : '#666', fontSize: 12 }}>{item.name}</span>
              {item.acquired && <span style={{ color: '#80FF20', fontSize: 10, marginLeft: 'auto' }}>✅</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
