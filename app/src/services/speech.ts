// ============================================================
// Speech Service — Web Speech API TTS wrapper
// ============================================================

let speechSynth: SpeechSynthesis | null = null;
let cachedEnglishVoice: SpeechSynthesisVoice | null = null;
let cachedChineseVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;

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

export function isVoicesReady(): boolean {
  return voicesReady;
}

function pickVoices(): void {
  const synth = getSynth();
  if (!synth) return;

  const voices = synth.getVoices();
  if (voices.length === 0) return;

  // English: prefer native OS voices (most natural), then Google, then any en-US
  cachedEnglishVoice =
    voices.find((v) => v.lang.startsWith('en') && v.name.includes('Samantha')) ||  // macOS — very natural
    voices.find((v) => v.lang.startsWith('en') && v.name.includes('Daniel')) ||    // macOS UK — natural
    voices.find((v) => v.lang.startsWith('en') && v.name.includes('Karen')) ||     // macOS AU — natural
    voices.find((v) => v.lang.startsWith('en') && v.name.includes('Google')) ||    // Chrome voices
    voices.find((v) => v.lang.startsWith('en-US')) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    null;

  // Chinese: prefer native OS voices, then Google, then any zh
  cachedChineseVoice =
    voices.find((v) => v.lang.startsWith('zh') && v.name.includes('Tingting')) || // macOS — good Mandarin
    voices.find((v) => v.lang.startsWith('zh') && v.name.includes('Google')) ||
    voices.find((v) => v.lang.startsWith('zh-CN')) ||
    voices.find((v) => v.lang.startsWith('zh')) ||
    null;

  voicesReady = true;
}

export function speak(text: string, rate: number = 1.0, lang?: 'en' | 'zh'): Promise<void> {
  return new Promise((resolve) => {
    const synth = getSynth();
    if (!synth) {
      resolve(); // Silently skip — not critical
      return;
    }

    // Cancel any ongoing speech
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (lang === 'zh' && cachedChineseVoice) {
      utterance.voice = cachedChineseVoice;
      utterance.lang = cachedChineseVoice.lang;
    } else if (cachedEnglishVoice) {
      utterance.voice = cachedEnglishVoice;
      utterance.lang = cachedEnglishVoice.lang;
    } else {
      utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); // Don't reject — TTS failures shouldn't break the game

    synth.speak(utterance);
  });
}

export function speakWord(word: string, rate: number = 1.0): Promise<void> {
  return speak(word, rate, 'en');
}

export function speakSentence(sentence: string, rate: number = 1.0): Promise<void> {
  return speak(sentence, rate, 'en');
}

export function speakChinese(text: string, rate: number = 1.0): Promise<void> {
  return speak(text, rate, 'zh');
}

/** Speak multiple texts sequentially with pauses between each */
export async function speakSequence(
  items: Array<{ text: string; lang: 'en' | 'zh'; pauseMs?: number }>,
  rate: number = 1.0
): Promise<void> {
  for (const item of items) {
    await speak(item.text, rate, item.lang);
    // Pause between items
    await new Promise((resolve) => setTimeout(resolve, item.pauseMs ?? 600));
  }
}

export function stopSpeech(): void {
  const synth = getSynth();
  if (synth) {
    synth.cancel();
  }
}

// Preload and cache voices (must be called from a user gesture context)
export function preloadVoices(): Promise<void> {
  return new Promise((resolve) => {
    const synth = getSynth();
    if (!synth) {
      resolve();
      return;
    }
    const voices = synth.getVoices();
    if (voices.length > 0) {
      pickVoices();
      resolve();
    } else {
      synth.onvoiceschanged = () => {
        pickVoices();
        resolve();
      };
    }
  });
}

// Warm up TTS engine with a silent utterance (must be called from user gesture)
export function warmUpTTS(): void {
  const synth = getSynth();
  if (!synth) return;

  // Speak a silent utterance to activate the speech engine
  const utterance = new SpeechSynthesisUtterance('');
  utterance.volume = 0;
  utterance.rate = 1;
  synth.speak(utterance);
}
