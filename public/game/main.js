import * as THREE from 'three';
import { buildRoom, makeStudent, makeTeacher, flyNote, tickFlights, makeNoteMesh,
  DESKS, seatAdjacent, BOARD_ZONE, TEACHER_DESK, ROOM } from './scene.js';
import { generateExam, dealKnowledge, score, N_QUESTIONS } from './exam.js';
import { makeNet, onlineAvailable } from './net.js';
import * as hud from './hud.js';

// THE EXAM — infinite-cheat edition.
// The game defines NO cheats. It gives students paper, a pen, surfaces and
// meaningless gestures; the cheating is whatever players invent with them.

const P = new URLSearchParams(location.search);
const TSCALE = Math.max(0.5, +(P.get('t') || 1));
const DUR = { prep: 75, inspect: 25, exam: 240 };
const CATCH_WINDOW = 5, ACCUSE_CD = 8, PASS_PCT = 0.6;
const STICK_RANGE = 3.0, READ_RANGE = 2.6, CONFISCATE_RANGE = 3.6;

// expressive primitives — none of them carry any built-in meaning
const ACTIONS = [
  { type: 'fingers', key: '1-4', label: 'hold fingers', dur: 2.5, real: true },
  { type: 'tap', key: 'T', label: 'tap desk', dur: 0.35, real: 'burst' },
  { type: 'cough', key: 'C', label: 'cough', dur: 0.35, real: 'burst' },
  { type: 'peek', key: 'E', label: 'peek at neighbor', dur: 2.5, real: true },
  { type: 'flash', key: 'F', label: 'flash my sheet', dur: 2, real: true },
  { type: 'write', key: 'N', label: 'write a note', dur: 0, real: false },
  { type: 'readArm', key: 'V', label: 'read arm', dur: 1.5, real: true },
  { type: 'readBottle', key: 'B', label: 'sip & read', dur: 2, real: true },
  { type: 'shifty', key: 'H', label: 'act shifty', dur: 2, real: false },
  { type: 'raise', key: 'R', label: 'raise hand', dur: 6, real: false },
];
const HIDDEN_ACTS = { // triggered by clicks / scribbler, not the bar
  throw: { dur: 1.2, real: true },
  armNote: { dur: 3, real: true },
  bottleNote: { dur: 3, real: true },
  readNote: { dur: 2, real: true },
};
const ACT = Object.fromEntries([...ACTIONS.map(a => [a.type, a]), ...Object.entries(HIDDEN_ACTS)]);
const GESTURE = {
  fingers: m => '✋ ' + '☝️'.repeat(m.n), tap: () => '👇 tap', cough: () => '😷 KHM!',
  peek: () => '👀 leans over', flash: () => '📄 flashes sheet', throw: () => '🗒 yeet!',
  armNote: () => '✍️ scribbles on arm', bottleNote: () => '🍼 fiddles with bottle',
  readArm: () => '🧐 checks sleeve', readBottle: () => '🥤 loooong sip',
  readNote: () => '👀 reaches for something', shifty: () => '😬 shifty eyes', raise: () => '✋ SIR!',
};

const now = () => Date.now() / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- three

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const { deskMeshes, surfaces } = buildRoom(scene);
const raycaster = new THREE.Raycaster();

// ---------------------------------------------------------------- state

const S = {
  net: null, myId: null, myName: '', myRole: 'student', code: '',
  roster: [], phase: 'menu', phaseEnds: 0, seed: 0, lastStart: null,
  teacherId: null, seats: {}, exam: null, knowledge: {},
  answers: {}, strikes: {}, expelled: {}, authority: 100, inspection: 100,
  duty: null, dutyProgress: 0, nextDutyAt: 0, riotUntil: 0,
  actionLog: [], raised: [], pendingFx: [],
  notes: new Map(),          // id -> {id, owner, img, mesh, pos}
  attach: {},                // pid -> {arm: img, bottle: img}
  attachMeshes: {},          // pid -> {arm: mesh, bottle: mesh}
  busyUntil: 0, busyType: null, aim: null, lastTapAt: 0,
  accuseReadyAt: 0, lastHostAccuse: -99,
  avatars: {}, teacherAv: null, poses: {},
  camYaw: 0, camPitch: 0, lean: 0,
  tPos: { x: 0, z: -5.2 }, walk: { x: 0, z: 6.5 }, keys: {},
  answersDirty: 0, poseDirty: 0, resultsSent: false, noteSeq: 0,
};

const isTeacher = () => S.myRole === 'teacher';
const students = () => S.roster.filter(p => p.role === 'student');
const mySeat = () => S.seats[S.myId];
const myAnswers = () => S.answers[S.myId] || Array(N_QUESTIONS).fill(null);
const inRiot = () => now() < S.riotUntil;
const nameOf = pid => (S.roster.find(p => p.id === pid) || {}).name || '???';
const canAct = () => !isTeacher() && S.phase === 'exam' && !S.expelled[S.myId] && now() >= S.busyUntil;

// ---------------------------------------------------------------- audio

const sounds = (() => {
  let ctx = null;
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  const tone = (f, d, ty, v, sl = 1, dl = 0) => {
    try {
      const c = ac(), t = c.currentTime + dl;
      const o = c.createOscillator(), g = c.createGain();
      o.type = ty; o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f * sl), t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.03);
    } catch { /* audio locked */ }
  };
  return {
    resume() { try { ac().resume(); } catch { /* noop */ } },
    bell() { [660, 880].forEach((f, i) => tone(f, 0.55, 'triangle', 0.2, 1, i * 0.25)); },
    tap() { tone(220, 0.06, 'square', 0.12, 0.8); },
    cough() { tone(140, 0.15, 'sawtooth', 0.12, 0.6); },
    paper() { tone(900, 0.08, 'triangle', 0.08, 1.4); },
    whistle() { tone(1400, 0.5, 'square', 0.12, 0.55); tone(300, 0.4, 'sawtooth', 0.15, 0.4, 0.1); },
    laugh() { [500, 420, 470, 380].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, 0.9, i * 0.12)); },
    riot() { tone(190, 0.9, 'sawtooth', 0.25, 1.6); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, 1, i * 0.13)); },
    lose() { [400, 340, 260].forEach((f, i) => tone(f, 0.4, 'triangle', 0.18, 0.85, i * 0.2)); },
  };
})();

// ---------------------------------------------------------------- join / lobby

function netLabel(mode) {
  if (mode === 'online') return 'Online rooms via Supabase — share the code with friends.';
  if (mode === 'bc') return 'Local mode: rooms work across TABS of this browser (Supabase not configured).';
  return '';
}

async function join(create, name, role, code) {
  sounds.resume();
  const mode = P.get('net') || (onlineAvailable() ? 'online' : 'bc');
  S.code = create
    ? Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ'[Math.floor(Math.random() * 23)]).join('')
    : code;
  if (!S.code || S.code.length !== 4) { hud.toast('Enter a 4-letter code', 'red'); return; }
  S.myName = name; S.myRole = role;
  S.net = makeNet(mode);
  S.myId = S.net.id;
  S.net.onEvent(onEvent);
  S.net.onRoster(r => { S.roster = r; if (S.phase === 'lobby') refreshLobby(); });
  try {
    await S.net.join(S.code, name, role);
  } catch (e) {
    hud.toast(e.message, 'red');
    hud.showMenu(netLabel(mode));
    return;
  }
  S.phase = 'lobby';
  refreshLobby();
}

function refreshLobby() {
  if (S.phase !== 'lobby') return;
  const t = S.roster.filter(p => p.role === 'teacher').length;
  const s = students().length;
  const ok = t === 1 && s >= 1;
  const hint = t === 0 ? 'Waiting for a Teacher to join…'
    : t > 1 ? 'Too many teachers! Only one allowed.'
    : s === 0 ? 'Waiting for at least one Student…'
    : `${s} student${s > 1 ? 's' : ''} + 1 teacher — ready! More friends can still join.`;
  hud.showLobby(S.code, S.roster, S.net.isHost(), ok, hint);
}

// ---------------------------------------------------------------- host: phases

function hostStart() {
  if (!S.net.isHost()) return;
  const t = S.roster.filter(p => p.role === 'teacher');
  const st = students();
  if (t.length !== 1 || st.length < 1) return;
  const seats = {};
  st.slice(0, 9).forEach((p, i) => { seats[p.id] = i; });
  const seed = +(P.get('seed') || Math.floor(Math.random() * 1e9));
  S.net.send('start', { seed, seats, teacherId: t[0].id });
  setTimeout(() => hostPhase('prep'), 60);
}

function hostPhase(phase) {
  if (!S.lastStart) return;
  const endsAt = Date.now() + DUR[phase] / TSCALE * 1000;
  S.net.send('phase', { phase, endsAt });
  if (phase === 'prep') {
    const deal = dealKnowledge(S.lastStart.seed, Object.keys(S.lastStart.seats));
    const exam = generateExam(S.lastStart.seed);
    const know = {};
    for (const pid in deal) know[pid] = deal[pid].map(k => ({ q: k.q, a: exam[k.q].correct }));
    S.net.send('deal', { knowledge: know });
  }
  if (phase === 'exam') S.nextDutyAt = now() + (12 + Math.random() * 10) / TSCALE;
}

function hostTick() {
  if (!S.net || !S.net.isHost() || !S.lastStart) return;
  const t = now();
  if (['prep', 'inspect', 'exam'].includes(S.phase) && t * 1000 > S.phaseEnds) {
    if (S.phase === 'prep') hostPhase('inspect');
    else if (S.phase === 'inspect') hostPhase('exam');
    else if (S.phase === 'exam') hostResults('bell');
    return;
  }
  if (S.phase !== 'exam') return;
  if (!S.duty && t >= S.nextDutyAt) {
    const kind = Math.random() < 0.55 ? 'board' : 'phone';
    S.net.send('duty', { kind, deadline: Date.now() + 20 / TSCALE * 1000 });
    S.nextDutyAt = t + (30 + Math.random() * 20) / TSCALE;
  }
  if (S.duty && Date.now() > S.duty.deadline) S.net.send('dutyMiss', { kind: S.duty.kind });
  for (const r of S.raised.slice()) {
    const tp = S.poses[S.teacherId];
    const d = DESKS[r.seat];
    if (tp && Math.hypot(tp.x - d.x, tp.z - d.z) < 2.2) {
      S.raised = S.raised.filter(x => x !== r);
      S.net.send('handServed', { pid: r.pid });
    } else if (t > r.until) {
      S.raised = S.raised.filter(x => x !== r);
      S.net.send('handIgnored', { pid: r.pid });
    }
  }
  if (S.riotUntil && t > S.riotUntil && S.authority <= 0) {
    S.net.send('meters', { authority: 50, inspection: S.inspection });
  }
}

function hostResults(reason) {
  if (S.resultsSent) return;
  S.resultsSent = true;
  const rows = students().map(p => ({
    id: p.id, name: p.name,
    score: score(S.answers[p.id] || [], S.exam),
    expelled: !!S.expelled[p.id],
  })).sort((a, b) => b.score - a.score);
  const avg = rows.length ? rows.reduce((s, r) => s + r.score, 0) / (rows.length * N_QUESTIONS) : 0;
  let pass = avg >= PASS_PCT;
  if (reason === 'principal') pass = true;
  if (reason === 'expelled') pass = false;
  if (rows[0]) rows[0].crown = true;
  S.net.send('results', { rows, avg, pass, reason });
}

// ---------------------------------------------------------------- host: adjudication

// tap/cough are innocent one-offs; a BURST (3+ in 4s) is an accusable pattern
function entryIsReal(e) {
  if (e.real !== 'burst') return !!e.real;
  const n = S.actionLog.filter(x => x.pid === e.pid && x.type === e.type &&
    x.t0 > e.t1 - 4 && x.t0 <= e.t1).length;
  return n >= 3;
}

function hostAccuse(from, targetId) {
  const t = now();
  if (t - S.lastHostAccuse < ACCUSE_CD - 0.25) return;
  if (from !== S.teacherId || S.phase !== 'exam') return;
  if (!Object.hasOwn(S.seats, targetId) || S.expelled[targetId]) return;
  S.lastHostAccuse = t;
  const hit = S.actionLog.filter(a =>
    a.pid === targetId && a.t1 >= t - CATCH_WINDOW && a.t0 <= t && entryIsReal(a) && !a.riot
  ).pop();
  if (hit) {
    const strikes = (S.strikes[targetId] || 0) + 1;
    const expelled = strikes >= 3;
    let confiscate = null;
    if (hit.type === 'throw') confiscate = { img: hit.meta.img, label: 'a note, snatched mid-air' };
    if (hit.type === 'readNote') {
      const n = S.notes.get(hit.meta.id);
      if (n) confiscate = { img: n.img, noteId: n.id, label: 'a hidden note' };
    }
    if (hit.type === 'readArm' || hit.type === 'armNote')
      confiscate = { img: (S.attach[targetId] || {}).arm, slot: 'arm', label: 'writing on their ARM' };
    if (hit.type === 'readBottle' || hit.type === 'bottleNote')
      confiscate = { img: (S.attach[targetId] || {}).bottle, slot: 'bottle', label: 'a rigged bottle label' };
    if (confiscate && !confiscate.img) confiscate = null;
    S.net.send('verdict', { target: targetId, guilty: true, type: hit.type, strikes, expelled, confiscate });
    if (expelled && students().every(p => S.expelled[p.id] || p.id === targetId)) {
      setTimeout(() => hostResults('expelled'), 1200);
    }
  } else {
    const authority = Math.max(0, S.authority - 25);
    S.net.send('verdict', { target: targetId, guilty: false, authority });
    if (authority <= 0) S.net.send('riot', { until: Date.now() + 8000 });
  }
}

// ---------------------------------------------------------------- events (one path for every client)

function onEvent(ev) {
  const { type, data, from } = ev;
  const H = S.net.isHost();

  switch (type) {
    case 'start': {
      S.lastStart = data;
      S.seed = data.seed; S.seats = data.seats; S.teacherId = data.teacherId;
      S.exam = generateExam(data.seed);
      S.answers = {}; S.strikes = {}; S.expelled = {}; S.knowledge = {};
      S.authority = 100; S.inspection = 100; S.duty = null; S.riotUntil = 0;
      S.actionLog = []; S.raised = []; S.pendingFx = []; S.resultsSent = false;
      S.attach = {}; S.aim = null;
      for (const n of S.notes.values()) scene.remove(n.mesh);
      S.notes.clear();
      for (const pid in S.attachMeshes)
        for (const k in S.attachMeshes[pid]) S.attachMeshes[pid][k].parent?.remove(S.attachMeshes[pid][k]);
      S.attachMeshes = {};
      for (const pid in S.seats) S.answers[pid] = Array(N_QUESTIONS).fill(null);
      buildAvatars();
      const seat = mySeat();
      if (seat != null) S.walk = { x: DESKS[seat].x, z: DESKS[seat].z + 1.6 };
      break;
    }
    case 'deal': {
      S.knowledge = data.knowledge;
      for (const k of (S.knowledge[S.myId] || [])) setMyAnswer(k.q, k.a, false);
      break;
    }
    case 'phase': setPhase(data.phase, data.endsAt); break;
    case 'pose': S.poses[from] = data; break;
    case 'answers': if (S.answers[from]) S.answers[from] = data.filled; break;
    case 'act': handleAct(ev); break;
    case 'stick': {
      const mesh = makeNoteMesh(scene, data.img, data.pos, data.n);
      S.notes.set(data.id, { id: data.id, owner: from, img: data.img, mesh, pos: data.pos });
      if (from === S.myId) hud.noteCount([...S.notes.values()].filter(n => n.owner === S.myId).length);
      break;
    }
    case 'attach': {
      S.attach[from] = S.attach[from] || {};
      S.attach[from][data.slot] = data.img;
      attachVisual(from, data.slot, data.img);
      if (from === S.myId) hud.toast(data.slot === 'arm' ? '💪 Ink dried on your arm' : '🍼 Bottle label applied');
      break;
    }
    case 'confiscate': {
      const n = S.notes.get(data.id);
      if (n) {
        scene.remove(n.mesh);
        S.notes.delete(data.id);
        hud.viewer(`📢 CONFISCATED — ${nameOf(n.owner)}'s hidden note, shown to the class:`, n.img);
        sounds.laugh();
      }
      break;
    }
    case 'accuse': if (H) hostAccuse(from, data.target); break;
    case 'verdict': handleVerdict(data); break;
    case 'riot': {
      S.riotUntil = data.until / 1000;
      S.authority = 0;
      hud.banner('🔥 CLASS RIOT — CHEAT FREELY! 🔥', 6000);
      hud.riotFlash(true);
      setTimeout(() => hud.riotFlash(false), data.until - Date.now());
      sounds.riot();
      break;
    }
    case 'meters': S.authority = data.authority; S.inspection = data.inspection; break;
    case 'duty':
      S.duty = data; S.dutyProgress = 0;
      if (isTeacher()) hud.banner(data.kind === 'board' ? '🖊 GO WRITE ON THE BOARD!' : '📞 THE PHONE IS RINGING!', 2600);
      break;
    case 'dutyDone': S.duty = null; break;
    case 'dutyMiss': {
      S.duty = null;
      S.inspection = Math.max(0, S.inspection - 25);
      if (isTeacher()) hud.toast('📋 Duty missed — inspection rating drops!', 'red');
      if (H) {
        S.net.send('meters', { authority: S.authority, inspection: S.inspection });
        if (S.inspection <= 0) hostResults('principal');
      }
      break;
    }
    case 'handServed': if (data.pid === S.myId) hud.toast('The teacher came over. "Never mind, sir."'); break;
    case 'handIgnored': {
      S.inspection = Math.max(0, S.inspection - 8);
      if (isTeacher()) hud.toast('You ignored a raised hand (−8 inspection)', 'red');
      if (H) {
        S.net.send('meters', { authority: S.authority, inspection: S.inspection });
        if (S.inspection <= 0) hostResults('principal');
      }
      break;
    }
    case 'results': showResults(data); break;
  }
  if (S.phase === 'lobby') refreshLobby();
}

function handleAct(ev) {
  const { data, from } = ev;
  const a = ACT[data.type];
  if (!a) return;
  const t = now();
  if (S.net.isHost()) {
    S.actionLog.push({ pid: from, type: data.type, real: a.real, riot: !!data.riot, t0: t, t1: t + a.dur, meta: data.meta || {} });
    if (S.actionLog.length > 500) S.actionLog.splice(0, 250);
    if (data.type === 'raise') S.raised.push({ pid: from, seat: S.seats[from], until: t + 6 });
  }
  const av = S.avatars[from];
  if (av && GESTURE[data.type]) {
    const bg = a.real === true ? 'rgba(30,60,140,0.85)' : 'rgba(140,110,30,0.85)';
    av.setGesture(GESTURE[data.type](data.meta || {}), Math.max(a.dur, 1), t, bg);
  }
  if (data.type === 'tap') sounds.tap();
  if (data.type === 'cough') sounds.cough();
  if (data.type === 'throw' && S.seats[from] != null && S.seats[data.meta.target] != null) {
    sounds.paper();
    flyNote(scene, S.seats[from], S.seats[data.meta.target]);
  }
  S.pendingFx.push({ at: t + a.dur, ev });
}

// what happens when an action completes — all information is images, never autofill
function resolveAct(ev) {
  const { data, from } = ev;
  const m = data.meta || {};
  switch (data.type) {
    case 'peek':
      if (from === S.myId && m.target)
        hud.viewer(`👀 You peek at ${nameOf(m.target)}'s paper…`, hud.sheetImage(nameOf(m.target), S.answers[m.target] || []));
      break;
    case 'flash':
      if (from !== S.myId && !isTeacher() && mySeat() != null && seatAdjacent(S.seats[from], mySeat()))
        hud.miniView(`📄 ${nameOf(from)} flashes their sheet!`, hud.sheetImage(nameOf(from), S.answers[from] || []));
      break;
    case 'throw':
      if (m.target === S.myId) {
        hud.viewer(`🗒 A note from ${nameOf(from)} lands on your desk:`, m.img);
        sounds.paper();
      }
      break;
    case 'armNote': case 'bottleNote':
      if (from === S.myId) S.net.send('attach', { slot: data.type === 'armNote' ? 'arm' : 'bottle', img: m.img });
      break;
    case 'readArm':
      if (from === S.myId && (S.attach[S.myId] || {}).arm) hud.viewer('💪 Your arm says:', S.attach[S.myId].arm);
      break;
    case 'readBottle':
      if (from === S.myId && (S.attach[S.myId] || {}).bottle) hud.viewer('🍼 Your bottle label:', S.attach[S.myId].bottle);
      break;
    case 'readNote':
      if (from === S.myId) {
        const n = S.notes.get(m.id);
        if (n) hud.viewer('🤫 The hidden note reads:', n.img);
      }
      break;
  }
}

function handleVerdict(v) {
  const tName = nameOf(v.target);
  if (v.guilty) {
    S.strikes[v.target] = v.strikes;
    sounds.whistle();
    hud.banner(`🚨 ${tName} CAUGHT! Strike ${v.strikes}`, 2600);
    if (v.confiscate) {
      hud.viewer(`📢 CONFISCATED from ${tName} — ${v.confiscate.label}. Shown to the whole class:`, v.confiscate.img);
      if (v.confiscate.noteId) {
        const n = S.notes.get(v.confiscate.noteId);
        if (n) { scene.remove(n.mesh); S.notes.delete(n.id); }
      }
      if (v.confiscate.slot) {
        if (S.attach[v.target]) delete S.attach[v.target][v.confiscate.slot];
        const am = (S.attachMeshes[v.target] || {})[v.confiscate.slot];
        if (am) am.parent?.remove(am);
      }
    }
    if (v.expelled) {
      S.expelled[v.target] = true;
      hud.banner(`💀 ${tName} IS EXPELLED TO THE STOOL OF SHAME`, 3200);
      const av = S.avatars[v.target];
      if (av) av.moveToStool();
      if (v.target === S.myId) hud.toast('You are out. Watch your friends carry on.', 'red');
    }
  } else {
    S.authority = v.authority;
    sounds.laugh();
    hud.banner(`😂 FALSE ACCUSATION! ${tName} was innocent`, 2600);
    if (isTeacher()) hud.toast('The class laughs at you. Authority −25', 'red');
  }
}

// ---------------------------------------------------------------- phases (client)

function setPhase(phase, endsAt) {
  S.phase = phase; S.phaseEnds = endsAt;
  hud.hideOverlays();
  hud.prepPanel(false); hud.centerHint(null);
  hud.studentHUD(false); hud.teacherHUD(false);
  hud.closeScribbler();
  sounds.bell();
  if (phase === 'prep') {
    hud.setPhase('STUDY PERIOD — RIG THE ROOM');
    if (isTeacher()) hud.staffroom(true);
    else {
      hud.prepPanel(true);
      hud.fillStudied(S.knowledge[S.myId] || [], S.exam);
      hud.noteCount(0);
    }
  } else if (phase === 'inspect') {
    hud.setPhase('INSPECTION — LOOK BUSY');
    hud.staffroom(false);
    for (const pid in S.avatars) S.avatars[pid].resetSeat();
    if (isTeacher()) {
      hud.teacherHUD(true);
      hud.centerHint('🔍 The room was rigged while you were gone. Click anything suspicious to rip it down.');
    } else hud.banner('😰 Look natural. LOOK NATURAL.', 2600);
  } else if (phase === 'exam') {
    hud.setPhase('THE EXAM — DO NOT GET CAUGHT');
    hud.centerHint(null);
    if (isTeacher()) hud.teacherHUD(true);
    else { hud.studentHUD(true); refreshSheet(); }
    hud.banner('📝 BEGIN!', 1600);
  }
}

// ---------------------------------------------------------------- student actions

function setMyAnswer(q, a, broadcast = true) {
  const arr = S.answers[S.myId] || (S.answers[S.myId] = Array(N_QUESTIONS).fill(null));
  arr[q] = a;
  if (broadcast) S.answersDirty = now() + 0.4;
  refreshSheet();
}

function refreshSheet() {
  if (isTeacher() || !S.exam || S.phase !== 'exam') return;
  hud.renderSheet(S.exam, myAnswers(), (S.knowledge[S.myId] || []).map(k => k.q));
}

function fireAction(type, meta) {
  const a = ACT[type];
  S.busyUntil = now() + a.dur;
  S.busyType = type;
  S.net.send('act', { type, meta, riot: inRiot() });
}

function tryAction(type, extra) {
  if (type === 'write') { openScrib(); return; }
  if (!canAct()) return;
  const meta = {};
  if (type === 'fingers') meta.n = extra || 1;
  if (type === 'tap' || type === 'cough') {
    if (now() - S.lastTapAt < 0.18) return;
    S.lastTapAt = now();
  }
  if (type === 'peek') {
    const adj = students().filter(p => p.id !== S.myId && !S.expelled[p.id] &&
      S.seats[p.id] != null && seatAdjacent(S.seats[p.id], mySeat()));
    if (!adj.length) { hud.toast('No neighbor close enough to peek at', 'red'); return; }
    meta.target = adj[0].id;
  }
  if (type === 'readArm' && !(S.attach[S.myId] || {}).arm) { hud.toast('Nothing written on your arm', 'red'); return; }
  if (type === 'readBottle' && !(S.attach[S.myId] || {}).bottle) { hud.toast('Your bottle label is blank', 'red'); return; }
  fireAction(type, meta);
}

// scribbler flows — prep: stick anywhere / arm / bottle; exam: throw / arm / bottle
function openScrib() {
  if (isTeacher()) return;
  if (S.phase === 'prep') {
    hud.openScribbler('✍️ RIG A NOTE — then hide it anywhere', [
      { id: 'stick', label: '📌 Stick it — then click any surface', main: true, fn: img => { S.aim = { mode: 'stick', img }; hud.toast('Click a surface within reach to stick the note'); } },
      { id: 'arm', label: '💪 Write it on my arm', fn: img => S.net.send('attach', { slot: 'arm', img }) },
      { id: 'bottle', label: '🍼 Make it my bottle label', fn: img => S.net.send('attach', { slot: 'bottle', img }) },
    ]);
  } else if (S.phase === 'exam' && canAct()) {
    hud.openScribbler('✍️ WRITE A NOTE — writing is innocent. sending it isn\'t.', [
      { id: 'throw', label: '🎯 Throw it — then click a desk', main: true, fn: img => { S.aim = { mode: 'throw', img }; hud.toast('Click a classmate\'s desk to throw'); } },
      { id: 'arm', label: '💪 Copy it onto my arm (3s)', fn: img => fireAction('armNote', { img }) },
      { id: 'bottle', label: '🍼 Onto my bottle (3s)', fn: img => fireAction('bottleNote', { img }) },
    ]);
  }
}

function stickNoteAt(pos, normal) {
  const id = S.myId + ':' + (S.noteSeq++);
  S.net.send('stick', { id, pos, n: normal, img: S.aim.img });
  S.aim = null;
}

function throwNoteAt(seat) {
  const target = Object.keys(S.seats).find(pid => S.seats[pid] === seat);
  if (!target || target === S.myId) { hud.toast('Pick a classmate\'s desk', 'red'); return; }
  fireAction('throw', { target, img: S.aim.img });
  S.aim = null;
}

function attachVisual(pid, slot, img) {
  const old = (S.attachMeshes[pid] || {})[slot];
  if (old) old.parent?.remove(old);
  S.attachMeshes[pid] = S.attachMeshes[pid] || {};
  if (slot === 'arm') {
    const av = S.avatars[pid];
    if (!av) return;
    const m = makeNoteMesh(scene, img, [0, 0, 0], [0, 0, 1]);
    scene.remove(m);
    m.scale.setScalar(0.55);
    m.position.set(0.3, 0.78, -0.18);
    m.rotation.set(-0.4, 0, 0.2);
    av.group.add(m);
    S.attachMeshes[pid][slot] = m;
  } else {
    const seat = S.seats[pid];
    if (seat == null) return;
    const d = DESKS[seat];
    const m = makeNoteMesh(scene, img, [d.x + 0.63, 1.02, d.z - 0.25], [1, 0, 0]);
    m.scale.setScalar(0.6);
    S.attachMeshes[pid][slot] = m;
  }
}

// ---------------------------------------------------------------- input

addEventListener('keydown', e => {
  S.keys[e.code] = true;
  if (hud.scribblerOpen()) return;
  if (!isTeacher() && (S.phase === 'exam' || S.phase === 'prep')) {
    if (e.code === 'KeyN') { openScrib(); return; }
    if (S.phase !== 'exam') return;
    const digit = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 }[e.code];
    if (digit) { tryAction('fingers', digit); return; }
    const act = ACTIONS.find(a => 'Key' + a.key === e.code);
    if (act) tryAction(act.type);
  }
});
addEventListener('keyup', e => { S.keys[e.code] = false; });

let dragging = false, lastX = 0, lastY = 0, downAt = 0;
canvas.addEventListener('pointerdown', e => {
  dragging = true; lastX = e.clientX; lastY = e.clientY; downAt = now();
  sounds.resume();
  if (isTeacher() && document.pointerLockElement !== canvas && ['exam', 'inspect'].includes(S.phase)) {
    const p = canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {});
  }
});
addEventListener('pointermove', e => {
  if (document.pointerLockElement === canvas) {
    S.camYaw -= e.movementX * 0.0022;
    S.camPitch = clamp(S.camPitch - e.movementY * 0.0022, -1.25, 1.25);
  } else if (dragging) {
    S.camYaw -= (e.clientX - lastX) * 0.004;
    S.camPitch = clamp(S.camPitch - (e.clientY - lastY) * 0.004, -1.25, 1.25);
    lastX = e.clientX; lastY = e.clientY;
  }
  if (!isTeacher() && S.phase === 'exam') S.camYaw = clamp(S.camYaw, -2.4, 2.4);
});
addEventListener('pointerup', e => {
  dragging = false;
  if (now() - downAt > 0.25) return;
  handleClick(e);
});

function handleClick(e) {
  if (hud.scribblerOpen()) return;
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const locked = document.pointerLockElement === canvas;
  raycaster.setFromCamera(locked ? new THREE.Vector2(0, 0) : ndc, camera);

  // student: place a written note on any surface (prep)
  if (!isTeacher() && S.aim && S.aim.mode === 'stick' && S.phase === 'prep') {
    const hit = raycaster.intersectObjects(surfaces)[0];
    if (hit && hit.distance < STICK_RANGE) {
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      stickNoteAt(hit.point.toArray(), n.toArray());
    } else hud.toast('Too far — get closer to the surface', 'red');
    return;
  }
  // student: throw a written note (exam)
  if (!isTeacher() && S.aim && S.aim.mode === 'throw' && S.phase === 'exam') {
    const hit = raycaster.intersectObjects(deskMeshes)[0];
    if (hit) throwNoteAt(hit.object.userData.seat);
    return;
  }
  // student: read a hidden note within reach of your seat (exam)
  if (!isTeacher() && S.phase === 'exam' && canAct() && mySeat() != null) {
    const meshes = [...S.notes.values()].map(n => n.mesh);
    const hit = raycaster.intersectObjects(meshes)[0];
    if (hit) {
      const note = [...S.notes.values()].find(n => n.mesh === hit.object);
      const d = DESKS[mySeat()];
      if (Math.hypot(note.pos[0] - d.x, note.pos[2] - d.z) < READ_RANGE) {
        fireAction('readNote', { id: note.id });
      } else hud.toast('Too far from your seat to reach that', 'red');
      return;
    }
  }
  if (!isTeacher()) return;

  // teacher: rip down notes (inspect or exam)
  if (['inspect', 'exam'].includes(S.phase)) {
    const meshes = [...S.notes.values()].map(n => n.mesh);
    const hit = raycaster.intersectObjects(meshes)[0];
    if (hit && hit.distance < CONFISCATE_RANGE) {
      const note = [...S.notes.values()].find(n => n.mesh === hit.object);
      S.net.send('confiscate', { id: note.id });
      return;
    }
  }
  // teacher: accuse a student (exam)
  if (S.phase === 'exam') {
    const t = now();
    if (t < S.accuseReadyAt) return;
    for (const [pid, av] of Object.entries(S.avatars)) {
      if (S.expelled[pid]) continue;
      if (raycaster.intersectObjects([av.body, av.head])[0]) {
        S.accuseReadyAt = t + ACCUSE_CD;
        S.net.send('accuse', { target: pid });
        return;
      }
    }
  }
}

// ---------------------------------------------------------------- avatars & cameras

function buildAvatars() {
  for (const pid in S.avatars) S.avatars[pid].group.parent?.remove(S.avatars[pid].group);
  if (S.teacherAv) S.teacherAv.group.parent?.remove(S.teacherAv.group);
  S.avatars = {}; S.poses = {};
  for (const pid in S.seats) {
    const p = S.roster.find(r => r.id === pid);
    const av = makeStudent(scene, S.seats[pid], S.seats[pid], p ? p.name : '???');
    if (pid === S.myId) av.setVisible(false);
    S.avatars[pid] = av;
  }
  const tp = S.roster.find(r => r.id === S.teacherId);
  S.teacherAv = makeTeacher(scene, tp ? tp.name : 'Teacher');
  if (isTeacher()) S.teacherAv.group.visible = false;
}

function walkStep(pos, dt, speed) {
  const fx = -Math.sin(S.camYaw), fz = -Math.cos(S.camYaw);
  let mx = 0, mz = 0;
  if (S.keys.KeyW) { mx += fx; mz += fz; }
  if (S.keys.KeyS) { mx -= fx; mz -= fz; }
  if (S.keys.KeyA) { mx += fz; mz -= fx; }
  if (S.keys.KeyD) { mx -= fz; mz += fx; }
  const l = Math.hypot(mx, mz);
  if (l > 0) {
    pos.x = clamp(pos.x + mx / l * speed * dt, -ROOM.x + 0.7, ROOM.x - 0.7);
    pos.z = clamp(pos.z + mz / l * speed * dt, -ROOM.z + 0.7, ROOM.z - 0.7);
    for (const d of DESKS) pushOut(pos, d.x, d.z, 1.05);
    pushOut(pos, TEACHER_DESK.x, TEACHER_DESK.z, 1.5);
  }
}
function pushOut(pos, cx, cz, r) {
  const dx = pos.x - cx, dz = pos.z - cz;
  const d = Math.hypot(dx, dz);
  if (d < r && d > 0.001) { pos.x = cx + dx / d * r; pos.z = cz + dz / d * r; }
}

function updateCamera(dt) {
  if (S.phase === 'menu' || S.phase === 'lobby' || S.phase === 'results') {
    const t = now() * 0.1;
    camera.position.set(Math.sin(t) * 9, 5, Math.cos(t) * 9);
    camera.lookAt(0, 1, 0);
    return;
  }
  if (isTeacher()) {
    walkStep(S.tPos, dt, 3.4);
    camera.position.set(S.tPos.x, 1.72, S.tPos.z);
  } else if (S.phase === 'prep') {
    walkStep(S.walk, dt, 3.2);
    camera.position.set(S.walk.x, 1.5, S.walk.z);
  } else {
    const seat = mySeat();
    if (seat == null) { camera.position.set(0, 3, 8); camera.lookAt(0, 1, -4); return; }
    if (S.expelled[S.myId]) {
      camera.position.set(-7.6, 1.35, -5.0);
    } else {
      const d = DESKS[seat];
      const targetLean = (S.keys.KeyA ? -1 : 0) + (S.keys.KeyD ? 1 : 0);
      S.lean += (targetLean - S.lean) * Math.min(1, dt * 8);
      camera.position.set(d.x + S.lean * 0.55, 1.38, d.z + 0.85);
    }
  }
  camera.rotation.set(0, 0, 0);
  camera.rotateY(S.camYaw);
  camera.rotateX(S.camPitch);
}

// ---------------------------------------------------------------- duty (human teacher)

function dutyTick(dt) {
  if (!isTeacher() || !S.duty || S.phase !== 'exam') return;
  const zone = S.duty.kind === 'board' ? BOARD_ZONE : TEACHER_DESK;
  const inZone = Math.hypot(S.tPos.x - zone.x, S.tPos.z - zone.z) < zone.r;
  const secsLeft = Math.max(0, (S.duty.deadline - Date.now()) / 1000);
  if (inZone && S.keys.KeyE) {
    S.dutyProgress += dt;
    hud.duty(`${S.duty.kind === 'board' ? '🖊 Writing' : '📞 On the phone'}… ${Math.round(S.dutyProgress / 4 * 100)}%`);
    if (S.dutyProgress >= 4) { S.net.send('dutyDone', { kind: S.duty.kind }); hud.duty(''); }
  } else {
    hud.duty(`⚠ ${S.duty.kind === 'board' ? 'Write on the board' : 'Answer the phone'} — hold E there (${secsLeft.toFixed(0)}s)`);
  }
}

// ---------------------------------------------------------------- results

function showResults(data) {
  const studentsWin = data.pass;
  const title = data.reason === 'principal' ? '🏫 PRINCIPAL STORMS IN — EXAM VOIDED'
    : data.reason === 'expelled' ? '💀 EVERYONE EXPELLED — TEACHER WINS'
    : studentsWin ? '🎉 THE CLASS PASSES!' : '📉 THE CLASS FAILS!';
  const avgLine = data.reason === 'principal'
    ? 'The teacher neglected their duties. Students win by chaos.'
    : `Class average: <b>${Math.round(data.avg * 100)}%</b> (needed ${PASS_PCT * 100}%)`;
  hud.showResults(title, avgLine, data.rows);
  (studentsWin !== isTeacher()) ? sounds.win() : sounds.lose();
  S.phase = 'results';
}

// ---------------------------------------------------------------- boot & loop

hud.init({
  onCreate: (name, role) => join(true, name, role),
  onJoin: (name, role, code) => join(false, name, role, code),
  onStart: () => hostStart(),
  onAgain: () => { S.phase = 'lobby'; S.resultsSent = false; hud.hideOverlays(); refreshLobby(); },
  onAnswer: (q, oi) => { if (S.phase === 'exam' && !S.expelled[S.myId]) setMyAnswer(q, oi); },
  onAction: t => tryAction(t),
});
hud.renderActionBar(ACTIONS);
hud.showMenu(netLabel(P.get('net') || (onlineAvailable() ? 'online' : 'bc')));

if (P.get('auto') === 'create') join(true, P.get('name') || 'Host', P.get('role') || 'student');
else if (P.get('auto') === 'join') join(false, P.get('name') || 'Guest', P.get('role') || 'student', (P.get('room') || '').toUpperCase());

let lastT = performance.now();
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min((nowMs - lastT) / 1000, 0.05);
  lastT = nowMs;
  const t = now();

  hostTick();
  dutyTick(dt);

  for (let i = S.pendingFx.length - 1; i >= 0; i--) {
    if (t >= S.pendingFx[i].at) { resolveAct(S.pendingFx[i].ev); S.pendingFx.splice(i, 1); }
  }
  if (S.answersDirty && t > S.answersDirty) {
    S.answersDirty = 0;
    S.net.send('answers', { filled: myAnswers() });
  }
  if (S.net && t > S.poseDirty && ['prep', 'inspect', 'exam'].includes(S.phase)) {
    S.poseDirty = t + 0.12;
    if (isTeacher()) S.net.send('pose', { x: S.tPos.x, z: S.tPos.z, yaw: S.camYaw });
    else if (S.phase === 'prep') S.net.send('pose', { walk: 1, x: S.walk.x, z: S.walk.z, yaw: S.camYaw });
    else S.net.send('pose', { yaw: S.camYaw, lean: S.lean });
  }
  for (const pid in S.avatars) {
    const av = S.avatars[pid], pose = S.poses[pid];
    if (pose && pid !== S.myId && !S.expelled[pid]) {
      if (pose.walk && S.phase === 'prep') av.setPos(pose.x, pose.z, pose.yaw);
      else if (!pose.walk) { av.head.rotation.y = (pose.yaw || 0) * 0.7; av.setLean(pose.lean || 0); }
    }
    av.tick(t);
  }
  if (S.teacherAv) {
    const tp = S.poses[S.teacherId];
    if (tp && !isTeacher()) S.teacherAv.setPose(tp.x, tp.z, tp.yaw);
    if (isTeacher()) S.teacherAv.setPose(S.tPos.x, S.tPos.z, S.camYaw);
    S.teacherAv.tick(t);
  }

  if (['prep', 'inspect', 'exam'].includes(S.phase)) {
    const left = Math.max(0, (S.phaseEnds - Date.now()) / 1000);
    hud.setTimer(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`);
  } else hud.setTimer('—');

  if (isTeacher()) {
    hud.meters(S.authority, S.inspection);
    const cd = S.accuseReadyAt - t;
    hud.cooldown(S.phase === 'exam' ? (cd > 0 ? `🫵 Accuse ready in ${cd.toFixed(1)}s` : '🫵 Click a student to ACCUSE · click notes to rip down') : '');
    hud.strikesHud(students().map(p =>
      `${p.name}: ${'⚠️'.repeat(S.strikes[p.id] || 0) || '—'}${S.expelled[p.id] ? ' 💀' : ''}`));
  } else if (S.phase === 'exam') {
    hud.actionBarState(type => {
      const busy = t < S.busyUntil;
      let disabled = busy || S.expelled[S.myId];
      if (type === 'readArm') disabled = disabled || !(S.attach[S.myId] || {}).arm;
      if (type === 'readBottle') disabled = disabled || !(S.attach[S.myId] || {}).bottle;
      return { disabled, busy: busy && S.busyType === type, tip: ACT[type].label };
    });
  }

  updateCamera(dt);
  tickFlights(scene, dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks

window.__game = {
  get state() {
    return {
      phase: S.phase, role: S.myRole, code: S.code, roster: S.roster.length,
      seats: { ...S.seats }, myId: S.myId, answers: myAnswers(),
      strikes: { ...S.strikes }, expelled: { ...S.expelled },
      authority: S.authority, inspection: S.inspection, isHost: S.net ? S.net.isHost() : false,
      knowledge: S.knowledge[S.myId] || [],
      notes: [...S.notes.values()].map(n => ({ id: n.id, owner: n.owner, pos: n.pos })),
      attach: Object.keys(S.attach[S.myId] || {}),
    };
  },
  start: () => hostStart(),
  scribble: text => hud.scribbleTestImage(text),
  stickAt: (text, pos, n) => { S.aim = { mode: 'stick', img: hud.scribbleTestImage(text) }; stickNoteAt(pos, n); },
  attach: (slot, text) => S.net.send('attach', { slot, img: hud.scribbleTestImage(text) }),
  throwTo: (pid, text) => fireAction('throw', { target: pid, img: hud.scribbleTestImage(text) }),
  tryAction,
  readNote: id => fireAction('readNote', { id }),
  confiscate: id => S.net.send('confiscate', { id }),
  accuse: pid => S.net.send('accuse', { target: pid }),
  answer: (q, a) => setMyAnswer(q, a),
  skipPhase: () => { if (S.net.isHost()) S.phaseEnds = 0; },
  teacherTo: (x, z) => { S.tPos.x = x; S.tPos.z = z; },
  walkTo: (x, z) => { S.walk.x = x; S.walk.z = z; },
  get examKey() { return S.exam ? S.exam.map(q => q.correct) : []; },
  viewerOpen: () => !document.getElementById('viewer').classList.contains('hidden'),
};
