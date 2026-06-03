// ============================================================
// WordDisplay — Show word + phonetic + speaker button
// ============================================================
import AudioButton from './AudioButton';
import { MASTERY_NAMES, type MasteryLevel } from '../types';

interface WordDisplayProps {
  word: string;
  phonetic?: string;
  showAudio?: boolean;
  masteryLevel?: MasteryLevel;
  size?: 'sm' | 'md' | 'lg';
}

const MASTERY_GEMS: Record<MasteryLevel, string> = {
  0: '🪨',
  1: '🪨',
  2: '⛏️',
  3: '🥇',
  4: '💎',
  5: '🔮',
};

export default function WordDisplay({
  word,
  phonetic,
  showAudio = true,
  masteryLevel,
  size = 'md',
}: WordDisplayProps) {
  const fontSizeMap = { sm: 16, md: 24, lg: 36 };
  const phoneticSizeMap = { sm: 11, md: 14, lg: 18 };

  return (
    <div className="flex-col" style={{ alignItems: 'center', gap: 4 }}>
      <div className="flex-row" style={{ alignItems: 'center', gap: 8 }}>
        {masteryLevel !== undefined && (
          <span title={`Mastery: ${MASTERY_NAMES[masteryLevel]}`} style={{ fontSize: 20 }}>
            {MASTERY_GEMS[masteryLevel]}
          </span>
        )}
        <span
          className="pixel-text"
          style={{
            fontSize: fontSizeMap[size],
            color: '#FFF',
            textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
          }}
        >
          {word}
        </span>
        {showAudio && <AudioButton text={word} />}
      </div>
      {phonetic && (
        <span style={{ fontSize: phoneticSizeMap[size], color: '#AAA', fontFamily: 'monospace' }}>
          {phonetic}
        </span>
      )}
    </div>
  );
}
