// ============================================================
// Speech Service — Web Speech API TTS wrapper
// ============================================================

let speechSynth: SpeechSynthesis | null = null;

function getSynth(): SpeechSynthesis | null {
  if (!speechSynth) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynth = window.speechSynthesis;
    }
  }
  return speechSynth;
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, rate: number = 0.85): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = getSynth();
    if (!synth) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    // Cancel any ongoing speech
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to use an English voice
    const voices = synth.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith('en') && v.name.includes('Google')
    ) || voices.find(
      (v) => v.lang.startsWith('en')
    ) || voices[0];

    if (englishVoice) {
      utterance.voice = englishVoice;
      utterance.lang = englishVoice.lang;
    } else {
      utterance.lang = 'en-US';
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);

    synth.speak(utterance);
  });
}

export function speakWord(word: string, rate: number = 0.85): Promise<void> {
  return speak(word, rate);
}

export function speakSentence(sentence: string, rate: number = 0.9): Promise<void> {
  return speak(sentence, rate);
}

export function stopSpeech(): void {
  const synth = getSynth();
  if (synth) {
    synth.cancel();
  }
}

// Preload voices (must be called from a user gesture context)
export function preloadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = getSynth();
    if (!synth) {
      resolve([]);
      return;
    }
    const voices = synth.getVoices();
    if (voices.length > 0) {
      resolve(voices);
    } else {
      synth.onvoiceschanged = () => {
        resolve(synth.getVoices());
      };
    }
  });
}
