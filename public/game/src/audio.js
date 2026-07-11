// Synthesized SFX — no audio files.
let ctx = null, muted = false, ringTimer = 0;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
function tone(f, d, type, v, slide = 1, delay = 0) {
  if (muted) return;
  try {
    const c = ac(), t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.03);
  } catch { /* locked */ }
}
export const sfx = {
  resume() { try { ac().resume(); } catch { /* noop */ } },
  toggle() { muted = !muted; return muted; },
  bell() { [660, 880].forEach((f, i) => tone(f, 0.5, 'triangle', 0.2, 1, i * 0.22)); },
  click() { tone(420, 0.05, 'square', 0.1, 1.2); },
  paper() { tone(950, 0.08, 'triangle', 0.09, 1.5); },
  tap() { tone(210, 0.05, 'square', 0.13, 0.8); },
  cough() { tone(140, 0.16, 'sawtooth', 0.14, 0.55); },
  whistle() { tone(1400, 0.5, 'square', 0.13, 0.55); tone(300, 0.4, 'sawtooth', 0.14, 0.4, 0.1); },
  laugh() { [500, 420, 470, 380].forEach((f, i) => tone(f, 0.11, 'triangle', 0.14, 0.9, i * 0.11)); },
  riot() { tone(190, 0.9, 'sawtooth', 0.24, 1.6); },
  crash() { [180, 320, 240, 400].forEach((f, i) => tone(f, 0.13, 'square', 0.14, 0.7, i * 0.06)); },
  squelch() { tone(120, 0.5, 'sine', 0.2, 0.4); },
  sneeze() { tone(900, 0.12, 'sawtooth', 0.14, 0.3); tone(240, 0.32, 'triangle', 0.2, 0.5, 0.1); },
  phone() { tone(1180, 0.14, 'square', 0.1); tone(940, 0.14, 'square', 0.1, 1, 0.17); },
  clockRing() { tone(1560, 0.15, 'square', 0.1); tone(1180, 0.15, 'square', 0.1, 1, 0.17); },
  learn() { tone(520, 0.1, 'triangle', 0.15, 1.3); tone(780, 0.15, 'triangle', 0.12, 1, 0.08); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, 1, i * 0.13)); },
  lose() { [400, 340, 260].forEach((f, i) => tone(f, 0.4, 'triangle', 0.18, 0.85, i * 0.2)); },
  startRing(kind) { this.stopRing(); ringTimer = setInterval(() => (kind === 'phone' ? this.phone() : this.clockRing()), 700); },
  stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = 0; } },
};
