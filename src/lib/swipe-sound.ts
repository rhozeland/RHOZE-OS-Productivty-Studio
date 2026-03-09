// Synthesize a subtle, short "pop" tone using Web Audio API
// Works on iOS Safari (which doesn't support navigator.vibrate)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playSwipeSound(direction: "up" | "down" | "left" | "right" = "right") {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Different subtle tones per direction
  const freqMap = { up: 880, down: 330, left: 520, right: 660 };
  const freq = freqMap[direction];

  // Oscillator — short sine blip
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.06);

  // Gain envelope — very subtle
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.015); // quick attack
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12); // fast decay

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.13);
}
