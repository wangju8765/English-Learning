// ============================================================
// SettingsPage — App configuration
// ============================================================
import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { isSpeechSupported } from '../services/speech';
import { setSoundEnabled } from '../services/sound';

export default function SettingsPage() {
  const { state, dispatch, exportAppState, importAppState } = useApp();
  const { settings, player } = state;
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [message, setMessage] = useState('');

  const speechSupported = isSpeechSupported();

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleExport = () => {
    const json = exportAppState();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english-craft-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg('✅ Data exported!');
  };

  const handleImport = () => {
    if (importAppState(importText)) {
      showMsg('✅ Data imported successfully! Refresh recommended.');
      setShowImport(false);
      setImportText('');
    } else {
      showMsg('❌ Invalid data format!');
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure? This will reset all your progress! This cannot be undone.')) {
      dispatch({ type: 'RESET_ALL' });
      showMsg('🔄 Progress reset.');
    }
  };

  return (
    <div className="flex-col" style={{ padding: 16, gap: 16 }}>
      <h2 className="pixel-text" style={{ fontSize: 14, color: '#FFC107', textAlign: 'center' }}>
        ⚙️ Settings
      </h2>

      {message && (
        <div className="mc-panel" style={{ padding: '8px 16px', background: '#2A2A1A', textAlign: 'center' }}>
          <span style={{ color: '#FFC107', fontSize: 12 }}>{message}</span>
        </div>
      )}

      {/* Player Name */}
      <div className="mc-panel" style={{ padding: 16 }}>
        <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9, marginBottom: 12 }}>
          👤 Player
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={player.name}
            onChange={(e) => dispatch({ type: 'SET_PLAYER_NAME', payload: e.target.value })}
            className="mc-panel-inset"
            style={{
              flex: 1,
              padding: '8px 12px',
              color: '#FFF',
              fontSize: 13,
              border: 'none',
              outline: 'none',
            }}
            placeholder="Enter your name"
          />
        </div>
      </div>

      {/* Audio Settings */}
      <div className="mc-panel" style={{ padding: 16 }}>
        <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9, marginBottom: 12 }}>
          🔊 Audio
        </h3>
        <div className="flex-col" style={{ gap: 8 }}>
          <ToggleRow
            label="Sound Effects"
            enabled={settings.soundEnabled}
            onChange={() => {
              const next = !settings.soundEnabled;
              setSoundEnabled(next);
              dispatch({ type: 'UPDATE_SETTINGS', payload: { soundEnabled: next } });
            }}
          />
          <ToggleRow
            label="Speech (TTS)"
            enabled={settings.speechEnabled && speechSupported}
            onChange={() =>
              dispatch({ type: 'UPDATE_SETTINGS', payload: { speechEnabled: !settings.speechEnabled } })
            }
            disabled={!speechSupported}
          />
          {settings.speechEnabled && speechSupported && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#888', fontSize: 11 }}>Speech Speed</span>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={settings.speechRate}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_SETTINGS',
                    payload: { speechRate: parseFloat(e.target.value) },
                  })
                }
                style={{ flex: 1 }}
              />
              <span style={{ color: '#FFF', fontSize: 11, width: 30 }}>{settings.speechRate}x</span>
            </div>
          )}
        </div>
      </div>

      {/* Gameplay Settings */}
      <div className="mc-panel" style={{ padding: 16 }}>
        <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9, marginBottom: 12 }}>
          🎮 Gameplay
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#888', fontSize: 11 }}>Words per session</span>
          <input
            type="range"
            min="6"
            max="20"
            step="2"
            value={settings.dailyWordTarget}
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_SETTINGS',
                payload: { dailyWordTarget: parseInt(e.target.value) },
              })
            }
            style={{ flex: 1 }}
          />
          <span style={{ color: '#FFF', fontSize: 11, width: 24 }}>{settings.dailyWordTarget}</span>
        </div>
      </div>

      {/* Data Management */}
      <div className="mc-panel" style={{ padding: 16 }}>
        <h3 className="pixel-text-sm" style={{ color: '#AAA', fontSize: 9, marginBottom: 12 }}>
          💾 Data
        </h3>
        <div className="flex-col" style={{ gap: 8 }}>
          <button className="btn btn-gold" style={{ width: '100%', fontSize: 10 }} onClick={handleExport}>
            📥 Export Progress
          </button>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', fontSize: 10 }}
            onClick={() => setShowImport(!showImport)}
          >
            📤 Import Progress
          </button>
          {showImport && (
            <div className="flex-col" style={{ gap: 8 }}>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="mc-panel-inset"
                placeholder="Paste your exported JSON here..."
                style={{
                  width: '100%',
                  height: 100,
                  padding: 8,
                  color: '#FFF',
                  fontSize: 11,
                  border: 'none',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'monospace',
                }}
              />
              <button className="btn btn-gold" style={{ width: '100%', fontSize: 10 }} onClick={handleImport}>
                Confirm Import
              </button>
            </div>
          )}
          <button
            className="btn btn-ghost"
            style={{
              width: '100%',
              fontSize: 10,
              background: 'linear-gradient(180deg, #FF5252 0%, #C62828 100%)',
              border: '3px solid',
              borderColor: '#FF8888 #881111 #881111 #FF8888',
            }}
            onClick={handleReset}
          >
            🗑️ Reset All Progress
          </button>
        </div>
      </div>

      {/* About */}
      <div className="mc-panel" style={{ padding: 16, textAlign: 'center' }}>
        <p className="pixel-text-sm" style={{ color: '#80FF20', fontSize: 9 }}>
          English Craft v0.1.0
        </p>
        <p style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
          Built with ❤️ for a young programmer
        </p>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  enabled,
  onChange,
  disabled = false,
}: {
  label: string;
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#CCC', fontSize: 12 }}>{label}</span>
      <button
        className={enabled ? 'btn btn-primary' : 'btn btn-ghost'}
        style={{ fontSize: 9, padding: '4px 12px', minWidth: 60 }}
        onClick={onChange}
        disabled={disabled}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
