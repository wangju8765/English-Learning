// ============================================================
// AudioButton — Trigger TTS for a word or sentence
// ============================================================
import { useState } from 'react';
import { speakWord, speakSentence, isSpeechSupported } from '../services/speech';

interface AudioButtonProps {
  text: string;
  rate?: number;
  type?: 'word' | 'sentence';
}

export default function AudioButton({ text, rate = 0.85, type = 'word' }: AudioButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  if (!isSpeechSupported()) return null;

  const handleClick = async () => {
    if (speaking) return;
    setSpeaking(true);
    try {
      if (type === 'sentence') {
        await speakSentence(text, rate);
      } else {
        await speakWord(text, rate);
      }
    } catch {
      // Silently fail — user may not have speech enabled
    }
    setSpeaking(false);
  };

  return (
    <button
      className={`audio-button ${speaking ? 'speaking' : ''}`}
      onClick={handleClick}
      title={`Listen: ${text}`}
      aria-label={`Listen to ${text}`}
    >
      🔊
    </button>
  );
}
