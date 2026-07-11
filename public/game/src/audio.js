// Synthesized SFX — no audio files. Every effect takes an optional loudness
// scale (0..1) so the game can fade sounds by distance: a cough across the
// room is a murmur, not a foghorn. A soft attack kills speaker clicks and a
// global throttle stops nine bots from turning the room into a drum solo.
let ctx = null, muted = false, ringTimer = 0;
const MASTER = 0.7;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
let recent = [];
function tone(f, d, type, v, slide = 1, delay = 0) {
  if (muted || v <= 0.004) return;
  const nowMs = performance.now();
  recent = recent.filter(x => x > nowMs - 130);
  if (recent.length >= 7) return;   // too many voices already — drop it
  recent.push(nowMs);
  try {
    const c = ac(), t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * MASTER, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.05);
  } catch { /* locked */ }
}
export const sfx = {
  resume() { try { ac().resume(); } catch { /* noop */ } },
  toggle() { muted = !muted; return muted; },
  bell() { [660, 880].forEach((f, i) => tone(f, 0.5, 'triangle', 0.16, 1, i * 0.22)); },
  click() { tone(420, 0.05, 'triangle', 0.08, 1.2); },
  paper(s = 1) { tone(950, 0.08, 'triangle', 0.07 * s, 1.5); },
  tap(s = 1) { tone(200, 0.05, 'triangle', 0.12 * s, 0.8); },
  cough(s = 1) { tone(140, 0.16, 'sawtooth', 0.1 * s, 0.55); },
  whistle() { tone(1400, 0.45, 'square', 0.09, 0.55); tone(300, 0.4, 'sawtooth', 0.1, 0.4, 0.1); },
  laugh(s = 1) { [500, 420, 470, 380].forEach((f, i) => tone(f, 0.11, 'triangle', 0.11 * s, 0.9, i * 0.11)); },
  riot() { tone(190, 0.9, 'sawtooth', 0.16, 1.6); },
  crash(s = 1) { [180, 320, 240, 400].forEach((f, i) => tone(f, 0.12, 'triangle', 0.11 * s, 0.7, i * 0.06)); },
  squelch(s = 1) { tone(120, 0.5, 'sine', 0.15 * s, 0.4); },
  sneeze(s = 1) { tone(900, 0.12, 'sawtooth', 0.1 * s, 0.3); tone(240, 0.32, 'triangle', 0.14 * s, 0.5, 0.1); },
  phone() { tone(1180, 0.13, 'triangle', 0.07); tone(940, 0.13, 'triangle', 0.07, 1, 0.17); },
  clockRing() { tone(1560, 0.13, 'triangle', 0.08); tone(1180, 0.13, 'triangle', 0.08, 1, 0.17); },
  learn() { tone(520, 0.1, 'triangle', 0.12, 1.3); tone(780, 0.15, 'triangle', 0.1, 1, 0.08); },
  scrape(s = 1) { tone(90, 0.22, 'sawtooth', 0.1 * s, 2.4); tone(140, 0.16, 'sawtooth', 0.06 * s, 1.8, 0.08); },
  honk(s = 1) { [220, 180, 150].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.16 * s, 0.7, i * 0.16)); },
  pickup() { tone(660, 0.09, 'triangle', 0.11, 1.5); tone(990, 0.12, 'triangle', 0.09, 1, 0.07); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15, 1, i * 0.13)); },
  lose() { [400, 340, 260].forEach((f, i) => tone(f, 0.4, 'triangle', 0.15, 0.85, i * 0.2)); },
  startRing(kind) { this.stopRing(); ringTimer = setInterval(() => (kind === 'phone' ? this.phone() : this.clockRing()), 900); },
  stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = 0; } },
};
