/** Web Audio API sound generation — no external files required */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(frequency, type, duration, volume = 0.3) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Silently fail if audio is not available
  }
}

/** Satisfying swish sound for a made shot */
export function playSwish() {
  try {
    const ctx = getCtx();
    // Layered tones for swish feel
    playTone(880, 'sine', 0.15, 0.25);
    playTone(1100, 'sine', 0.12, 0.2);
    playTone(1320, 'triangle', 0.1, 0.1);

    // Short noise burst (net swoosh)
    const bufLen = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gainN = ctx.createGain();
    gainN.gain.setValueAtTime(0.15, ctx.currentTime);
    gainN.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    src.connect(gainN);
    gainN.connect(ctx.destination);
    src.start(ctx.currentTime + 0.05);
  } catch {
    // Silently fail
  }
}

/** Clank/clunk sound for a missed shot (ball hitting rim) */
export function playClank() {
  try {
    playTone(220, 'sawtooth', 0.08, 0.3);
    playTone(180, 'square', 0.12, 0.2);
    playTone(120, 'sawtooth', 0.15, 0.25);
  } catch {
    // Silently fail
  }
}

/** Tap / click feedback */
export function playTap() {
  try {
    playTone(440, 'sine', 0.05, 0.1);
  } catch {
    // Silently fail
  }
}

/** Perfect shot fanfare */
export function playPerfect() {
  try {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 'sine', 0.2, 0.35), i * 60);
    });
  } catch {
    // Silently fail
  }
}

/** Resume audio context after user interaction (required by browsers) */
export function resumeAudio() {
  try {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch {
    // Silently fail
  }
}
