// Player identity: a username and a COLOR (Among-Us style — no cosmetics).

export const COLORS = [
  { id: 'red', hex: '#C51111' }, { id: 'blue', hex: '#1949d6' },
  { id: 'green', hex: '#127f3a' }, { id: 'pink', hex: '#ED54BA' },
  { id: 'orange', hex: '#EF7D0D' }, { id: 'yellow', hex: '#e9d02c' },
  { id: 'black', hex: '#3F474E' }, { id: 'white', hex: '#D6E0F0' },
  { id: 'purple', hex: '#6B2FBB' }, { id: 'brown', hex: '#71491E' },
  { id: 'cyan', hex: '#2ac8b0' }, { id: 'lime', hex: '#5ace3a' },
];
export const colorHex = id => (COLORS.find(c => c.id === id) || COLORS[7]).hex;

const KEY = 'exam2-profile';
let P = null;
function load() {
  if (P) return P;
  try { P = JSON.parse(localStorage.getItem(KEY)); } catch { P = null; }
  if (!P || typeof P !== 'object') P = {};
  P.name = P.name || '';
  if (!COLORS.some(c => c.id === P.color)) P.color = COLORS[(Math.random() * COLORS.length) | 0].id;
  // fovH is the HORIZONTAL field of view — the vertical one is derived from
  // the window shape so the world never looks zoomed-in on narrow screens
  P.fovH = Math.round(+P.fovH);
  if (!(P.fovH >= 70 && P.fovH <= 130)) P.fovH = 103;
  return P;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* private mode */ } };

export const profile = {
  get name() { return load().name; },
  set name(v) { load().name = String(v).slice(0, 14); save(); },
  get color() { return load().color; },
  set color(v) { if (COLORS.some(c => c.id === v)) { load().color = v; save(); } },
  get fovH() { return load().fovH; },
  set fovH(v) { v = Math.round(+v); if (v >= 70 && v <= 130) { load().fovH = v; save(); } },
  get stats() { const p = load(); return { rounds: p.rounds | 0, wins: p.wins | 0 }; },
  addRound(win) { const p = load(); p.rounds = (p.rounds | 0) + 1; if (win) p.wins = (p.wins | 0) + 1; save(); },
};
