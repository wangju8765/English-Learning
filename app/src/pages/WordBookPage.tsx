// ============================================================
// WordBookPage — Searchable dictionary of all learned words
// ============================================================
import { useState } from 'react';
import { useApp } from '../store/AppContext';
import AudioButton from '../components/AudioButton';
import { MASTERY_NAMES, type MasteryLevel } from '../types';

export default function WordBookPage() {
  const { state } = useApp();
  const allWords = Object.values(state.words);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MasteryLevel | -1>(-1); // -1 = all
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = allWords
    .filter((w) => {
      if (filter !== -1 && w.masteryLevel !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          w.word.toLowerCase().includes(q) ||
          w.definition.toLowerCase().includes(q) ||
          w.phonetic.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => a.word.localeCompare(b.word));

  if (allWords.length === 0) {
    return (
      <div className="flex-col" style={{ padding: 24, gap: 16, alignItems: 'center' }}>
        <div className="mc-panel" style={{ padding: 32, textAlign: 'center' }}>
          <span style={{ fontSize: 48 }}>📚</span>
          <p style={{ color: '#AAA', fontSize: 14, marginTop: 12 }}>
            Your word book is empty.
          </p>
          <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
            Words will appear here as you learn them!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col" style={{ padding: 16, gap: 16 }}>
      <h2 className="pixel-text" style={{ fontSize: 14, color: '#FFC107', textAlign: 'center' }}>
        📚 Word Book
      </h2>

      {/* Search */}
      <input
        type="text"
        placeholder="Search words..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mc-panel-inset"
        style={{
          width: '100%',
          padding: '8px 12px',
          color: '#FFF',
          fontSize: 13,
          border: 'none',
          outline: 'none',
        }}
      />

      {/* Mastery filter */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <FilterChip label="All" active={filter === -1} onClick={() => setFilter(-1)} />
        {([0, 1, 2, 3, 4, 5] as MasteryLevel[]).map((level) => (
          <FilterChip
            key={level}
            label={`${MASTERY_NAMES[level]}`}
            active={filter === level}
            onClick={() => setFilter(filter === level ? -1 : level)}
          />
        ))}
      </div>

      <p style={{ color: '#666', fontSize: 11 }}>
        {filtered.length} word{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Word list */}
      <div className="flex-col" style={{ gap: 6 }}>
        {filtered.map((word) => {
          const isExpanded = expandedId === word.id;
          const gem: Record<number, string> = { 0: '🪨', 1: '🪨', 2: '⛏️', 3: '🥇', 4: '💎', 5: '🔮' };
          return (
            <div key={word.id}>
              <button
                className="mc-panel"
                onClick={() => setExpandedId(isExpanded ? null : word.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  width: '100%',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{gem[word.masteryLevel]}</span>
                  <div>
                    <span style={{ color: '#FFF', fontSize: 14, fontWeight: 600 }}>{word.word}</span>
                    <span style={{ color: '#AAA', fontSize: 11, marginLeft: 8, fontFamily: 'monospace' }}>
                      {word.phonetic}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AudioButton text={word.word} />
                  <span style={{ color: '#666', fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div
                  className="mc-panel-inset"
                  style={{
                    padding: 12,
                    marginTop: -2,
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ color: '#AAA', fontSize: 10 }}>Definition: </span>
                    <span style={{ color: '#FFF', fontSize: 13 }}>{word.definition}</span>
                  </div>
                  {word.definitionDetail && word.definitionDetail.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {word.definitionDetail.map((d, i) => (
                        <div key={i} style={{ color: '#CCC', fontSize: 12, paddingLeft: 12 }}>
                          • {d}
                        </div>
                      ))}
                    </div>
                  )}
                  {word.parentNotes && (
                    <div style={{ marginBottom: 8, padding: 8, background: 'rgba(255,193,7,0.1)' }}>
                      <span style={{ color: '#FFC107', fontSize: 10 }}>💡 Note: </span>
                      <span style={{ color: '#DDD', fontSize: 12 }}>{word.parentNotes}</span>
                    </div>
                  )}
                  {word.exampleSentences.length > 0 && (
                    <div>
                      <span style={{ color: '#AAA', fontSize: 10 }}>Examples:</span>
                      {word.exampleSentences.map((ex, i) => (
                        <div key={i} style={{ marginTop: 4, fontSize: 12 }}>
                          <div style={{ color: '#3CC6DE' }}>{ex.english}</div>
                          <div style={{ color: '#888' }}>{ex.chinese}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 12, padding: '4px 0', borderTop: '1px solid #444' }}>
                    <span style={{ color: '#666', fontSize: 10 }}>
                      Mastery: {MASTERY_NAMES[word.masteryLevel]} |
                      Accuracy: {word.totalAttempts > 0
                        ? `${Math.round((word.totalCorrect / word.totalAttempts) * 100)}%`
                        : 'N/A'} |
                      Last reviewed: {word.lastReviewDate || 'Never'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? 'btn btn-gold' : 'btn btn-ghost'}
      style={{ fontSize: 8, padding: '4px 8px' }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
