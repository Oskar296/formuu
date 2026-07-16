// Player identity: a username and a COLOR (Among-Us style — no cosmetics).
// Plus a STABLE friend code, a friends list, all-time stats and achievements,
// all persisted in localStorage (no account server needed).

export const COLORS = [
  { id: 'red', hex: '#C51111' }, { id: 'blue', hex: '#1949d6' },
  { id: 'green', hex: '#127f3a' }, { id: 'pink', hex: '#ED54BA' },
  { id: 'orange', hex: '#EF7D0D' }, { id: 'yellow', hex: '#e9d02c' },
  { id: 'black', hex: '#3F474E' }, { id: 'white', hex: '#D6E0F0' },
  { id: 'purple', hex: '#6B2FBB' }, { id: 'brown', hex: '#71491E' },
  { id: 'cyan', hex: '#2ac8b0' }, { id: 'lime', hex: '#5ace3a' },
];
export const colorHex = id => (COLORS.find(c => c.id === id) || COLORS[7]).hex;

// Unambiguous alphabet (no I/O/0/1/L) for codes people read aloud and type.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeCode = (n = 6) => Array.from({ length: n }, () => ALPHABET[(Math.random() * ALPHABET.length) | 0]).join('');
export const validCode = (c, n = 6) => typeof c === 'string' && c.length === n && [...c].every(ch => ALPHABET.includes(ch));

// All-time stats we accumulate. Everything defaults to 0 so old saves upgrade.
const STAT_KEYS = ['rounds', 'wins', 'asStudent', 'asTeacher', 'studentWins', 'teacherWins',
  'caught', 'expelled', 'cleanWins', 'streak', 'bestStreak', 'shared', 'copied'];

// Achievements are pure predicates over the cumulative stats, so they can be
// evaluated for yourself OR for a friend from their shared stats blob.
export const ACHIEVEMENTS = [
  { id: 'firstday', icon: '🎒', name: 'First Day', desc: 'Play your first round', test: s => s.rounds >= 1 },
  { id: 'regular', icon: '📅', name: 'Regular', desc: 'Play 10 rounds', test: s => s.rounds >= 10 },
  { id: 'veteran', icon: '🎓', name: 'Veteran', desc: 'Play 50 rounds', test: s => s.rounds >= 50 },
  { id: 'firstwin', icon: '🥇', name: 'Passing Grade', desc: 'Win a round', test: s => s.wins >= 1 },
  { id: 'honorroll', icon: '🏆', name: 'Honor Roll', desc: 'Win 10 rounds', test: s => s.wins >= 10 },
  { id: 'streak3', icon: '🔥', name: 'On a Roll', desc: 'Win 3 rounds in a row', test: s => s.bestStreak >= 3 },
  { id: 'ghost', icon: '👻', name: 'Ghost', desc: 'Win without ever being caught', test: s => s.cleanWins >= 1 },
  { id: 'clown', icon: '🤡', name: 'Class Clown', desc: 'Share 25 answers by cheating', test: s => s.shared >= 25 },
  { id: 'mastermind', icon: '🧠', name: 'Mastermind', desc: 'Copy 50 answers from others', test: s => s.copied >= 50 },
  { id: 'hawk', icon: '🦅', name: 'Hall Monitor', desc: 'Win 5 rounds as the Teacher', test: s => s.teacherWins >= 5 },
];
// Evaluate every achievement against a stats blob → [{...def, unlocked}].
export const achievementsFor = stats => ACHIEVEMENTS.map(a => ({ ...a, unlocked: !!a.test(stats || {}) }));

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
  // stable friend code / identity — minted once, then permanent for this browser
  if (!validCode(P.uid)) P.uid = makeCode(6);
  // secret token: proves you own this account and namespaces its private state
  // (friends list) so only your own linked devices can read/write it
  if (typeof P.token !== 'string' || P.token.length !== 10) P.token = makeCode(10);
  if (!Array.isArray(P.friends)) P.friends = [];   // [{ code, name, color }]
  return P;
}
// account code = the public friend code + the secret token, e.g. ABC234-KMNP7QRS2T
export const parseAccount = s => {
  const m = String(s || '').toUpperCase().trim().match(/^([A-Z2-9]{6})-?([A-Z2-9]{10})$/);
  return m ? { uid: m[1], token: m[2] } : null;
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* private mode */ } };

// Read the cumulative stats as a fully-populated object (missing keys → 0).
function readStats() { const p = load(); const s = {}; for (const k of STAT_KEYS) s[k] = p[k] | 0; return s; }

export const profile = {
  get name() { return load().name; },
  set name(v) { load().name = String(v).slice(0, 14); save(); },
  get color() { return load().color; },
  set color(v) { if (COLORS.some(c => c.id === v)) { load().color = v; save(); } },
  get fovH() { return load().fovH; },
  set fovH(v) { v = Math.round(+v); if (v >= 70 && v <= 130) { load().fovH = v; save(); } },
  get uid() { return load().uid; },
  get token() { return load().token; },
  // the code you type on another device to sign in as this same account
  get account() { const p = load(); return p.uid + '-' + p.token; },
  // adopt an account on a fresh device (its friends + stats then sync in from
  // the cloud). Local friends are kept and merged so nothing is lost.
  setAccount(uid, token) {
    if (!validCode(uid, 6) || typeof token !== 'string' || token.length !== 10) return false;
    const p = load(); p.uid = uid; p.token = token; save(); return true;
  },

  // ---- stats ----------------------------------------------------------------
  get stats() { return readStats(); },
  // Overwrite the whole stats block (used when a linked device pulls the
  // account's cloud snapshot). Only known keys are taken.
  setStats(blob) { const p = load(); for (const k of STAT_KEYS) if (blob && typeof blob[k] === 'number') p[k] = blob[k] | 0; save(); },
  // Increment an in-round counter (answers shared/copied) by n.
  bump(key, n = 1) { if (!STAT_KEYS.includes(key)) return; const p = load(); p[key] = (p[key] | 0) + n; save(); },
  // Record a finished round; returns the list of achievements newly unlocked so
  // the UI can celebrate them. `role` is 'student' | 'teacher', `clean` means
  // you won without ever being caught, `caught`/`expelled` bump discipline tallies.
  recordRound({ win, role, clean = false, caught = false, expelled = false }) {
    const before = new Set(achievementsFor(readStats()).filter(a => a.unlocked).map(a => a.id));
    const p = load();
    p.rounds = (p.rounds | 0) + 1;
    if (win) p.wins = (p.wins | 0) + 1;
    if (role === 'teacher') { p.asTeacher = (p.asTeacher | 0) + 1; if (win) p.teacherWins = (p.teacherWins | 0) + 1; }
    else { p.asStudent = (p.asStudent | 0) + 1; if (win) p.studentWins = (p.studentWins | 0) + 1; }
    if (caught) p.caught = (p.caught | 0) + 1;
    if (expelled) p.expelled = (p.expelled | 0) + 1;
    if (win && clean) p.cleanWins = (p.cleanWins | 0) + 1;
    p.streak = win ? (p.streak | 0) + 1 : 0;
    if ((p.streak | 0) > (p.bestStreak | 0)) p.bestStreak = p.streak;
    save();
    return achievementsFor(readStats()).filter(a => a.unlocked && !before.has(a.id));
  },
  // Backwards-compatible shim (old call site) — a plain win/lose round.
  addRound(win) { return this.recordRound({ win: !!win, role: 'student' }); },
  achievements() { return achievementsFor(readStats()); },
  // A shareable snapshot for friends to view (never includes anything private).
  publicProfile() { return { code: load().uid, name: this.name, color: this.color, stats: readStats() }; },

  // ---- friends --------------------------------------------------------------
  get friends() { return load().friends.slice(); },
  isFriend(code) { return load().friends.some(f => f.code === code); },
  addFriend(f) {
    if (!f || !validCode(f.code) || f.code === load().uid) return;
    const p = load(); const ex = p.friends.find(x => x.code === f.code);
    if (ex) { ex.name = f.name || ex.name; ex.color = f.color || ex.color; }
    else p.friends.push({ code: f.code, name: f.name || '?', color: f.color || 'white' });
    save();
  },
  removeFriend(code) { const p = load(); p.friends = p.friends.filter(f => f.code !== code); save(); },
  // union-merge a cloud friends list into the local one (linked-device sync)
  mergeFriends(list) { if (Array.isArray(list)) for (const f of list) this.addFriend(f); },
};
