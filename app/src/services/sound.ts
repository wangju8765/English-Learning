// ============================================================
// Sound Service — Procedural pixel-art sound effects via Web Audio API
// Zero external dependencies, zero file size
// ============================================================

let audioCtx: AudioContext | null = null;
let _enabled = true;

function getCtx(): AudioContext | null {
  if (!_enabled) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Master on/off switch — controlled by SettingsPage */
export function setSoundEnabled(enabled: boolean): void {
  _enabled = enabled;
}

export function isSoundEnabled(): boolean {
  return _enabled;
}

// --- Helper: play a tone ---

function playTone(
  type: OscillatorType,
  freq: number,
  duration: number,
  volume: number = 0.15,
  freqEnd?: number
): void {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (freqEnd) {
    osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
  }

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

// --- Helper: play a sequence of tones ---

function playSequence(
  notes: Array<{ freq: number; delay: number; duration: number }>,
  type: OscillatorType = 'square',
  volume: number = 0.12
): void {
  const ctx = getCtx();
  if (!ctx) return;

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.delay);

    gain.gain.setValueAtTime(0, ctx.currentTime + note.delay);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + note.delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + note.delay + note.duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + note.delay);
    osc.stop(ctx.currentTime + note.delay + note.duration);
  }
}

// --- Sound Effects ---

/** Short tick when clicking a block */
export function playClick(): void {
  playTone('square', 880, 0.05, 0.08);
}

/** Satisfying pop when finding a correct word */
export function playBlockBreak(): void {
  const ctx = getCtx();
  if (!ctx) return;

  // Two layers: low thud + high sparkle
  playTone('sine', 200, 0.08, 0.12, 80);
  playTone('square', 1200, 0.1, 0.06, 600);

  // Noise burst via very short high-freq oscillation
  setTimeout(() => {
    playTone('square', 2400, 0.04, 0.04, 800);
  }, 40);
}

/** Ascending combo sound — pitch rises with combo count */
export function playCombo(combo: number): void {
  const baseFreq = 600 + Math.min(combo, 6) * 120;
  playTone('square', baseFreq, 0.1, 0.08, baseFreq * 1.5);
  setTimeout(() => {
    playTone('square', baseFreq * 1.3, 0.08, 0.06);
  }, 60);
}

/** Low buzz for incorrect answer */
export function playFail(): void {
  playTone('sawtooth', 150, 0.2, 0.08, 80);
  setTimeout(() => {
    playTone('triangle', 100, 0.15, 0.06);
  }, 50);
}

/** Wall complete — quick ascending arpeggio */
export function playWallComplete(): void {
  playSequence([
    { freq: 523, delay: 0, duration: 0.1 },     // C5
    { freq: 659, delay: 0.08, duration: 0.1 },   // E5
    { freq: 784, delay: 0.16, duration: 0.15 },  // G5
  ], 'square', 0.1);
}

/** All walls cleared — triumphant fanfare */
export function playGameComplete(): void {
  playSequence([
    { freq: 523, delay: 0, duration: 0.12 },     // C5
    { freq: 659, delay: 0.1, duration: 0.12 },   // E5
    { freq: 784, delay: 0.2, duration: 0.12 },   // G5
    { freq: 1047, delay: 0.3, duration: 0.25 },  // C6
  ], 'square', 0.1);
}

/** XP gain blip — tiny positive feedback */
export function playXpGain(): void {
  playTone('sine', 1600, 0.06, 0.05, 2000);
}

/** Short beep to mask a blank in sentence reading — like a censored word */
export function playBeep(): void {
  playTone('square', 800, 0.12, 0.06, 600);
}

// --- Portal (Nether Portal Escape) sounds ---

/** Low ambient hum for portal presence */
export function playPortalHum(): void {
  playTone('sine', 80, 0.5, 0.06, 60);
  setTimeout(() => {
    playTone('sine', 100, 0.4, 0.04, 70);
  }, 100);
}

/** Rising pitch sequence — portal activates! */
export function playPortalActivate(): void {
  playSequence([
    { freq: 80, delay: 0, duration: 0.2 },
    { freq: 160, delay: 0.15, duration: 0.2 },
    { freq: 320, delay: 0.3, duration: 0.25 },
    { freq: 640, delay: 0.45, duration: 0.35 },
  ], 'sine', 0.1);
}

/** Descending tone — portal collapses */
export function playPortalFail(): void {
  playTone('sawtooth', 200, 0.3, 0.08, 60);
  setTimeout(() => {
    playTone('triangle', 100, 0.25, 0.06, 40);
  }, 150);
}
