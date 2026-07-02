import * as THREE from 'three';
import { buildRoom, makeStudent, makeTeacher, flyNote, tickFlights,
  DESKS, seatAdjacent, BOARD_ZONE, TEACHER_DESK, ROOM } from './scene.js';
import { generateExam, dealKnowledge, score, LETTERS, N_QUESTIONS } from './exam.js';
import { makeNet, onlineAvailable } from './net.js';
import * as hud from './hud.js';
import { mulberry32 } from './rng.js';

// ---------------------------------------------------------------- setup

const P = new URLSearchParams(location.search);
const TSCALE = Math.max(0.5, +(P.get('t') || 1));
const DUR = { prep: 45, inspect: 20, exam: 240 };
const CATCH_WINDOW = 5, ACCUSE_CD = 8, PASS_PCT = 0.6;

const ACTIONS = [
  { type: 'signal', key: 'S', label: 'signal answer', dur: 3, real: true },
  { type: 'ask', key: 'Q', label: 'ask class', dur: 2, real: true },
  { type: 'tap', key: 'T', label: 'tap code', dur: 1.5, real: true },
  { type: 'flash', key: 'F', label: 'flash sheet', dur: 2, real: true },
  { type: 'lean', key: 'E', label: 'lean & peek', dur: 2.5, real: true },
  { type: 'note', key: 'N', label: 'throw note', dur: 1.2, real: true },
  { type: 'readArm', key: 'V', label: 'read arm', dur: 1.5, real: true },
  { type: 'readBottle', key: 'B', label: 'sip & read', dur: 2, real: true },
  { type: 'readStash', key: 'X', label: 'check stash', dur: 3, real: true },
  { type: 'cough', key: 'C', label: 'fake cough', dur: 1, real: false },
  { type: 'shifty', key: 'H', label: 'act shifty', dur: 2, real: false },
  { type: 'raise', key: 'R', label: 'raise hand', dur: 6, real: false },
];
const ACT = Object.fromEntries(ACTIONS.map(a => [a.type, a]));
const GESTURE = {
  signal: m => `☝️ Q${m.q + 1} → ${LETTERS[m.a]}`, ask: m => `🙏 Q${m.q + 1}??`,
  tap: () => '👇 t-t-tap', flash: () => '📄 flashes sheet', lean: () => '👀 leans over',
  note: () => '🗒 throws!', readArm: () => '🧐 checks sleeve', readBottle: () => '🥤 long sip…',
  readStash: () => '🗄 rummages…', cough: () => '😷 KHM-KHM!', shifty: () => '😬 shifty eyes',
  raise: () => '✋ SIR!',
};

const now = () => Date.now() / 1000;

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
const { deskMeshes } = buildRoom(scene);
const raycaster = new THREE.Raycaster();

// ---------------------------------------------------------------- state

const S = {
  net: null, myId: null, myName: '', myRole: 'student', code: '',
  roster: [], phase: 'menu', phaseEnds: 0, seed: 0,
  teacherId: null, seats: {}, exam: null, knowledge: {},
  answers: {}, artifacts: {}, preps: {},
  strikes: {}, expelled: {}, authority: 100, inspection: 100,
  duty: null, nextDutyAt: 0, riotUntil: 0,
  actionLog: [], raised: [], pendingLearns: [],
  busyUntil: 0, busyType: null, selectedQ: null, aimMode: false,
  accuseReadyAt: 0, inspectionsLeft: 3, inspected: new Set(),
  lastHostAccuse: 0, avatars: {}, teacherAv: null, poses: {},
  camYaw: 0, camPitch: 0, lean: 0, tPos: { x: 0, z: -5.2 }, keys: {},
  answersDirty: 0, poseDirty: 0, resultsSent: false,
};

const isTeacher = () => S.myRole === 'teacher';
const students = () => S.roster.filter(p => p.role === 'student');
const mySeat = () => S.seats[S.myId];
const myAnswers = () => S.answers[S.myId] || Array(N_QUESTIONS).fill(null);
const inRiot = () => now() < S.riotUntil;
const pidBySeat = seat => Object.keys(S.seats).find(pid => S.seats[pid] === seat);
const nameOf = pid => (S.roster.find(p => p.id === pid) || {}).name || '???';

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
    resume() { try { ac().resume(); } catch { /* no audio */ } },
    bell() { [660, 880].forEach((f, i) => tone(f, 0.55, 'triangle', 0.2, 1, i * 0.25)); },
    learn() { tone(760, 0.14, 'sine', 0.15, 1.3); },
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
  S.net.onRoster(r => { S.roster = r; if (S.phase === 'menu' || S.phase === 'lobby') refreshLobby(); });
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

// ---------------------------------------------------------------- host: start & phases

function hostStart() {
  if (!S.net.isHost()) return;
  const t = S.roster.filter(p => p.role === 'teacher');
  const st = students();
  if (t.length !== 1 || st.length < 1) return;
  const seats = {};
  st.slice(0, 9).forEach((p, i) => { seats[p.id] = i; });
  const seed = +(P.get('seed') || Math.floor(Math.random() * 1e9));
  S.net.send('start', { seed, seats, teacherId: t[0].id, tscale: TSCALE });
  setTimeout(() => hostPhase('prep'), 50); // after the loopback 'start' lands
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

  // duty scheduling for the (human) teacher
  if (!S.duty && t >= S.nextDutyAt) {
    const kind = Math.random() < 0.55 ? 'board' : 'phone';
    S.net.send('duty', { kind, deadline: Date.now() + 20 / TSCALE * 1000 });
  }
  if (S.duty && Date.now() > S.duty.deadline) {
    S.net.send('dutyMiss', { kind: S.duty.kind });
  }
  // raised hands the teacher ignored
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
  // riot end
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

function hostAccuse(from, targetId) {
  const t = now();
  if (t - S.lastHostAccuse < ACCUSE_CD - 0.25) return;
  if (from !== S.teacherId || S.phase !== 'exam') return;
  if (!S.seats.hasOwnProperty(targetId) || S.expelled[targetId]) return;
  S.lastHostAccuse = t;
  const hit = S.actionLog.filter(a =>
    a.pid === targetId && a.real && a.t1 >= t - CATCH_WINDOW && a.t0 <= t
  ).pop();
  if (hit) {
    const strikes = (S.strikes[targetId] || 0) + 1;
    const expelled = strikes >= 3;
    let confiscate = null;
    if (hit.type === 'note') confiscate = hit.meta.decoy ? { decoy: true } : { q: hit.meta.q, a: hit.meta.a };
    if (['readArm', 'readBottle', 'readStash'].includes(hit.type))
      confiscate = { artifact: hit.type.slice(4).toLowerCase() };
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

function hostInspect(seat) {
  if (S.phase !== 'inspect') return;
  let found = null;
  for (const pid in S.preps) {
    const c = S.preps[pid];
    if (c.kinds.includes('stash') && S.seats[pid] === seat) found = { pid, kind: 'stash' };
    if (c.kinds.includes('gift') && c.giftTo && S.seats[c.giftTo] === seat) found = { pid, kind: 'gift', victim: c.giftTo };
  }
  S.net.send('inspectResult', { seat, found });
}

// ---------------------------------------------------------------- events (ALL clients, same path)

function onEvent(ev) {
  const { type, data, from } = ev;
  const H = S.net.isHost();

  switch (type) {
    case 'start': {
      S.lastStart = data;
      S.seed = data.seed; S.seats = data.seats; S.teacherId = data.teacherId;
      S.exam = generateExam(data.seed);
      S.answers = {}; S.strikes = {}; S.expelled = {}; S.artifacts = {}; S.preps = {};
      S.authority = 100; S.inspection = 100; S.duty = null; S.riotUntil = 0;
      S.actionLog = []; S.raised = []; S.pendingLearns = []; S.resultsSent = false;
      S.inspectionsLeft = 3; S.inspected = new Set(); S.selectedQ = null;
      for (const pid in S.seats) S.answers[pid] = Array(N_QUESTIONS).fill(null);
      buildAvatars();
      break;
    }
    case 'deal': {
      S.knowledge = data.knowledge;
      const mine = S.knowledge[S.myId] || [];
      for (const k of mine) setMyAnswer(k.q, k.a, false);
      break;
    }
    case 'phase': setPhase(data.phase, data.endsAt); break;
    case 'prep': S.preps[from] = data.carriers; if (from === S.myId) applyMyPrep(data.carriers); break;
    case 'pose': S.poses[from] = data; break;
    case 'answers': if (S.answers[from]) S.answers[from] = data.filled; break;
    case 'act': handleAct(ev); break;
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
    case 'duty': {
      S.duty = data;
      if (isTeacher()) {
        hud.banner(data.kind === 'board' ? '🖊 GO WRITE ON THE BOARD!' : '📞 THE PHONE IS RINGING!', 2600);
        S.dutyProgress = 0;
      }
      break;
    }
    case 'dutyDone': S.duty = null; break;
    case 'dutyMiss': {
      S.duty = null;
      S.inspection = Math.max(0, S.inspection - 25);
      hud.toast('📋 Inspection rating drops — duty missed!', 'red');
      if (H) {
        S.net.send('meters', { authority: S.authority, inspection: S.inspection });
        if (S.inspection <= 0) hostResults('principal');
      }
      break;
    }
    case 'handServed': if (data.pid === S.myId) hud.toast('The teacher came over. Nothing to see here…'); break;
    case 'handIgnored': {
      S.inspection = Math.max(0, S.inspection - 8);
      if (H) {
        S.net.send('meters', { authority: S.authority, inspection: S.inspection });
        if (S.inspection <= 0) hostResults('principal');
      }
      if (isTeacher()) hud.toast('You ignored a raised hand (−8 inspection)', 'red');
      break;
    }
    case 'inspect': if (H) hostInspect(data.seat); break;
    case 'inspectResult': {
      const seatName = nameOf(pidBySeat(data.seat));
      if (data.found) {
        hud.toast(`🚨 Inspection: crib notes found on ${seatName}'s desk! (planted by ${nameOf(data.found.pid)})`, 'red');
        removeArtifact(data.found.kind === 'gift' ? data.found.victim : data.found.pid,
          data.found.kind === 'gift' ? 'gift' : 'stash');
      } else {
        hud.toast(`🔍 ${seatName}'s desk: clean.`);
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
  const real = a.real && !data.riot;
  if (S.net.isHost()) {
    S.actionLog.push({ pid: from, type: data.type, real, t0: t, t1: t + a.dur, meta: data.meta || {} });
    if (S.actionLog.length > 400) S.actionLog.splice(0, 200);
    if (data.type === 'raise') S.raised.push({ pid: from, seat: S.seats[from], until: t + 6 });
  }
  // gesture on the actor's avatar
  const av = S.avatars[from];
  if (av) {
    const bg = a.real ? 'rgba(30,60,140,0.85)' : 'rgba(140,110,30,0.85)';
    av.setGesture(GESTURE[data.type](data.meta || {}), a.dur, t, bg);
  }
  if (data.type === 'note' && data.meta && S.seats[from] != null && S.seats[data.meta.target] != null) {
    flyNote(scene, S.seats[from], S.seats[data.meta.target]);
  }
  // schedule payload delivery at action completion
  if (real) S.pendingLearns.push({ at: t + a.dur, ev });
}

function deliver(ev) {
  const { data, from } = ev;
  const m = data.meta || {};
  const meStudent = !isTeacher() && S.seats[S.myId] != null && !S.expelled[S.myId];
  const learn = (q, a, src) => {
    if (!meStudent || q == null) return;
    if (myAnswers()[q] == null) setMyAnswer(q, a, true);
    hud.toast(`💡 Q${q + 1} = ${LETTERS[a]} (${src})`, 'gold');
    sounds.learn();
  };
  switch (data.type) {
    case 'signal': if (from !== S.myId) learn(m.q, m.a, nameOf(from) + "'s signal"); break;
    case 'tap':
      if (from !== S.myId && seatAdjacent(S.seats[from], mySeat() ?? -9)) learn(m.q, m.a, nameOf(from) + "'s taps");
      break;
    case 'flash':
      if (from !== S.myId && seatAdjacent(S.seats[from], mySeat() ?? -9)) {
        (S.answers[from] || []).forEach((ans, q) => { if (ans != null && myAnswers()[q] == null) learn(q, ans, nameOf(from) + "'s sheet"); });
      }
      break;
    case 'lean':
      if (from === S.myId && m.target) {
        (S.answers[m.target] || []).forEach((ans, q) => { if (ans != null && myAnswers()[q] == null) learn(q, ans, 'peeking at ' + nameOf(m.target)); });
      }
      break;
    case 'note':
      if (m.target === S.myId && !m.decoy) learn(m.q, m.a, nameOf(from) + "'s note");
      else if (m.target === S.myId && m.decoy) hud.toast(`🗒 Note from ${nameOf(from)}: "${m.text || 'nice weather'}"`);
      break;
    case 'readArm': case 'readBottle': case 'readStash':
      if (from === S.myId) {
        const kind = data.type.slice(4).toLowerCase();
        const art = (S.artifacts[S.myId] || []).find(x => x.kind === kind || (kind === 'stash' && x.kind === 'gift'));
        if (art) art.contents.forEach(k => learn(k.q, k.a, 'your ' + (art.kind === 'gift' ? 'gifted stash' : kind)));
      }
      break;
  }
}

function handleVerdict(v) {
  const tName = nameOf(v.target);
  if (v.guilty) {
    S.strikes[v.target] = v.strikes;
    sounds.whistle();
    hud.banner(`🚨 ${tName} CAUGHT ${v.type === 'note' ? 'passing notes' : 'cheating'}! Strike ${v.strikes}`, 2600);
    if (v.confiscate) {
      if (v.confiscate.q != null) {
        hud.toast(`📢 Teacher reads the note aloud: "Q${v.confiscate.q + 1} is ${LETTERS[v.confiscate.a]}"…`, 'gold');
        if (!isTeacher() && !S.expelled[S.myId] && myAnswers()[v.confiscate.q] == null)
          setMyAnswer(v.confiscate.q, v.confiscate.a, true);
      } else if (v.confiscate.decoy) {
        hud.toast('📢 Teacher reads the note aloud… it\'s a doodle. The class snickers.');
      } else if (v.confiscate.artifact) {
        removeArtifact(v.target, v.confiscate.artifact);
        hud.toast(`🗑 ${tName}'s ${v.confiscate.artifact} notes confiscated!`, 'red');
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

function removeArtifact(pid, kind) {
  if (S.artifacts[pid]) S.artifacts[pid] = S.artifacts[pid].filter(a => a.kind !== kind);
}

// ---------------------------------------------------------------- phases (client)

function setPhase(phase, endsAt) {
  S.phase = phase; S.phaseEnds = endsAt;
  hud.hideOverlays();
  hud.prepPanel(false); hud.inspectHint(null);
  hud.studentHUD(false); hud.teacherHUD(false);
  sounds.bell();
  if (phase === 'prep') {
    hud.setPhase('STUDY PERIOD — PLAN YOUR CHEATS');
    if (isTeacher()) hud.staffroom(true);
    else {
      hud.prepPanel(true);
      hud.fillPrep(S.knowledge[S.myId] || [], S.exam,
        students().filter(p => p.id !== S.myId).map(p => ({ id: p.id, name: p.name })));
      sendPrep(hud.getCarriers());
    }
  } else if (phase === 'inspect') {
    hud.setPhase('DESK INSPECTION');
    hud.staffroom(false);
    if (isTeacher()) { hud.teacherHUD(true); hud.inspectHint('🔍 Click desks to inspect — 3 left'); }
    else hud.banner('😰 The teacher is inspecting desks…', 2600);
  } else if (phase === 'exam') {
    hud.setPhase('THE EXAM — DO NOT GET CAUGHT');
    if (isTeacher()) hud.teacherHUD(true);
    else { hud.studentHUD(true); refreshSheet(); }
    hud.banner('📝 BEGIN!', 1600);
  }
}

function applyMyPrep(c) {
  const myKnow = S.knowledge[S.myId] || [];
  S.artifacts[S.myId] = (S.artifacts[S.myId] || []).filter(a => a.kind === 'gift');
  for (const k of c.kinds) {
    if (k === 'gift') continue;
    S.artifacts[S.myId].push({ kind: k, contents: myKnow });
  }
}

function sendPrep(c) {
  S.net.send('prep', { carriers: c });
  if (c.kinds.includes('gift') && c.giftTo) {
    // the receiver gets a readable stash at their desk
    S.net.send('gifted', { to: c.giftTo });
  }
}

// gifted stash: receiver learns it exists (contents revealed on read)
// handled via preps on host; receiver-side artifact:
function syncGifts() {
  for (const pid in S.preps) {
    const c = S.preps[pid];
    if (c.kinds.includes('gift') && c.giftTo === S.myId) {
      const have = (S.artifacts[S.myId] || []).some(a => a.kind === 'gift');
      if (!have) {
        S.artifacts[S.myId] = S.artifacts[S.myId] || [];
        S.artifacts[S.myId].push({ kind: 'gift', contents: S.knowledge[pid] || [] });
        if (S.phase === 'exam') hud.toast(`🎁 Someone left something under your desk…`, 'gold');
      }
    }
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
  if (isTeacher() || !S.exam || S.phase !== 'exam' && S.phase !== 'prep') return;
  const known = (S.knowledge[S.myId] || []).map(k => k.q);
  hud.renderSheet(S.exam, myAnswers(), known, S.knowledge[S.myId] || [], S.selectedQ);
}

function tryAction(type) {
  if (isTeacher() || S.phase !== 'exam' || S.expelled[S.myId]) return;
  const t = now();
  if (t < S.busyUntil) return;
  const a = ACT[type];
  const meta = {};
  const myKnowOrPick = q => myAnswers()[q] != null ? myAnswers()[q]
    : (S.knowledge[S.myId] || []).find(k => k.q === q)?.a;

  if (type === 'signal' || type === 'tap') {
    const q = S.selectedQ;
    if (q == null || myKnowOrPick(q) == null) { hud.toast('Select a question you have an answer for first (click it on your sheet)', 'red'); return; }
    meta.q = q; meta.a = myKnowOrPick(q);
  }
  if (type === 'ask') {
    const q = S.selectedQ;
    if (q == null) { hud.toast('Click a question on your sheet first', 'red'); return; }
    meta.q = q;
  }
  if (type === 'lean') {
    const adj = students().filter(p => p.id !== S.myId && !S.expelled[p.id] &&
      S.seats[p.id] != null && seatAdjacent(S.seats[p.id], mySeat()));
    if (!adj.length) { hud.toast('No neighbor close enough to peek at', 'red'); return; }
    meta.target = adj.sort((x, y) => {
      const fx = (S.answers[y.id] || []).filter(v => v != null).length - (S.answers[x.id] || []).filter(v => v != null).length;
      return fx;
    })[0].id;
  }
  if (type === 'note') {
    S.aimMode = true;
    hud.toast('🎯 Click a classmate\'s desk to throw the note' + (S.selectedQ == null ? ' (no question selected → decoy note)' : ''));
    return;
  }
  if (type === 'readArm' || type === 'readBottle' || type === 'readStash') {
    const kind = type.slice(4).toLowerCase();
    const has = (S.artifacts[S.myId] || []).some(x => x.kind === kind || (kind === 'stash' && x.kind === 'gift'));
    if (!has) { hud.toast('You have nothing there to read', 'red'); return; }
  }
  fireAction(type, meta);
}

function fireAction(type, meta) {
  const a = ACT[type];
  S.busyUntil = now() + a.dur;
  S.busyType = type;
  S.net.send('act', { type, meta, riot: inRiot() });
}

function throwNoteAt(seat) {
  S.aimMode = false;
  const target = pidBySeat(seat);
  if (!target || target === S.myId) { hud.toast('Pick another desk', 'red'); return; }
  const q = S.selectedQ;
  const myA = q != null ? (myAnswers()[q] ?? (S.knowledge[S.myId] || []).find(k => k.q === q)?.a) : null;
  const meta = (q != null && myA != null)
    ? { target, q, a: myA }
    : { target, decoy: true, text: ['nice mustache sir', 'is it lunch yet', 'BLINK IF YOU NEED HELP', 'this is a doodle of a duck'][Math.floor(Math.random() * 4)] };
  fireAction('note', meta);
}

// ---------------------------------------------------------------- input

addEventListener('keydown', e => {
  S.keys[e.code] = true;
  if (S.phase !== 'exam' && S.phase !== 'inspect') return;
  if (!isTeacher()) {
    const act = ACTIONS.find(a => 'Key' + a.key === e.code);
    if (act) tryAction(act.type);
  }
});
addEventListener('keyup', e => { S.keys[e.code] = false; });

let dragging = false, lastX = 0, lastY = 0, downAt = 0;
canvas.addEventListener('pointerdown', e => {
  dragging = true; lastX = e.clientX; lastY = e.clientY; downAt = now();
  sounds.resume();
  if (isTeacher() && document.pointerLockElement !== canvas && (S.phase === 'exam' || S.phase === 'inspect')) {
    const p = canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {});
  }
});
addEventListener('pointermove', e => {
  if (document.pointerLockElement === canvas) {
    S.camYaw -= e.movementX * 0.0022;
    S.camPitch = clamp(S.camPitch - e.movementY * 0.0022, -1.2, 1.2);
  } else if (dragging) {
    S.camYaw -= (e.clientX - lastX) * 0.004;
    S.camPitch = clamp(S.camPitch - (e.clientY - lastY) * 0.004, -1.2, 1.2);
    lastX = e.clientX; lastY = e.clientY;
  }
  if (!isTeacher()) S.camYaw = clamp(S.camYaw, -2.4, 2.4);
});
addEventListener('pointerup', e => {
  dragging = false;
  if (now() - downAt > 0.25) return; // drag, not click
  handleClick(e);
});

function handleClick(e) {
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const locked = document.pointerLockElement === canvas;
  raycaster.setFromCamera(locked ? new THREE.Vector2(0, 0) : ndc, camera);

  if (!isTeacher() && S.aimMode && S.phase === 'exam') {
    const hit = raycaster.intersectObjects(deskMeshes)[0];
    if (hit) throwNoteAt(hit.object.userData.seat);
    return;
  }
  if (isTeacher() && S.phase === 'inspect') {
    const hit = raycaster.intersectObjects(deskMeshes)[0];
    if (hit && S.inspectionsLeft > 0 && !S.inspected.has(hit.object.userData.seat)) {
      S.inspected.add(hit.object.userData.seat);
      S.inspectionsLeft--;
      hud.inspectHint(S.inspectionsLeft > 0 ? `🔍 Click desks to inspect — ${S.inspectionsLeft} left` : '🔍 No inspections left');
      S.net.send('inspect', { seat: hit.object.userData.seat });
    }
    return;
  }
  if (isTeacher() && S.phase === 'exam') {
    const t = now();
    if (t < S.accuseReadyAt) return;
    const targets = Object.entries(S.avatars)
      .filter(([pid]) => !S.expelled[pid])
      .map(([pid, av]) => ({ pid, objs: [av.body, av.head] }));
    for (const tg of targets) {
      if (raycaster.intersectObjects(tg.objs)[0]) {
        S.accuseReadyAt = t + ACCUSE_CD;
        S.net.send('accuse', { target: tg.pid });
        return;
      }
    }
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

function updateCamera(dt) {
  if (S.phase === 'menu' || S.phase === 'lobby') {
    const t = now() * 0.1;
    camera.position.set(Math.sin(t) * 9, 5, Math.cos(t) * 9);
    camera.lookAt(0, 1, 0);
    return;
  }
  if (isTeacher()) {
    const speed = 3.4 * dt;
    const fx = -Math.sin(S.camYaw), fz = -Math.cos(S.camYaw);
    let mx = 0, mz = 0;
    if (S.keys.KeyW) { mx += fx; mz += fz; }
    if (S.keys.KeyS) { mx -= fx; mz -= fz; }
    if (S.keys.KeyA) { mx += fz; mz -= fx; }
    if (S.keys.KeyD) { mx -= fz; mz += fx; }
    const l = Math.hypot(mx, mz);
    if (l > 0) {
      S.tPos.x = clamp(S.tPos.x + mx / l * speed, -ROOM.x + 0.7, ROOM.x - 0.7);
      S.tPos.z = clamp(S.tPos.z + mz / l * speed, -ROOM.z + 0.7, ROOM.z - 0.7);
      for (const d of DESKS) pushOut(d.x, d.z, 1.1);
      pushOut(TEACHER_DESK.x, TEACHER_DESK.z, 1.5);
    }
    camera.position.set(S.tPos.x, 1.72, S.tPos.z);
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

function pushOut(cx, cz, r) {
  const dx = S.tPos.x - cx, dz = S.tPos.z - cz;
  const d = Math.hypot(dx, dz);
  if (d < r && d > 0.001) { S.tPos.x = cx + dx / d * r; S.tPos.z = cz + dz / d * r; }
}

// ---------------------------------------------------------------- duty progress (human teacher)

function dutyTick(dt) {
  if (!isTeacher() || !S.duty || S.phase !== 'exam') { hud.duty(S.duty && isTeacher() ? '' : ''); return; }
  const zone = S.duty.kind === 'board' ? BOARD_ZONE : TEACHER_DESK;
  const inZone = Math.hypot(S.tPos.x - zone.x, S.tPos.z - zone.z) < zone.r;
  const secsLeft = Math.max(0, (S.duty.deadline - Date.now()) / 1000);
  if (inZone && S.keys.KeyE) {
    S.dutyProgress = (S.dutyProgress || 0) + dt;
    hud.duty(`${S.duty.kind === 'board' ? '🖊 Writing' : '📞 On the phone'}… ${Math.round(S.dutyProgress / 4 * 100)}%`);
    if (S.dutyProgress >= 4) { S.net.send('dutyDone', { kind: S.duty.kind }); hud.duty(''); }
  } else {
    hud.duty(`⚠ ${S.duty.kind === 'board' ? 'Write on the board' : 'Answer the phone'} — hold E there (${secsLeft.toFixed(0)}s)`);
  }
}

// ---------------------------------------------------------------- results

function showResults(data) {
  const iAmTeacher = isTeacher();
  const studentsWin = data.pass;
  const title = data.reason === 'principal' ? '🏫 PRINCIPAL STORMS IN — EXAM VOIDED'
    : data.reason === 'expelled' ? '💀 EVERYONE EXPELLED — TEACHER WINS'
    : studentsWin ? '🎉 THE CLASS PASSES!' : '📉 THE CLASS FAILS!';
  const avgLine = data.reason === 'principal'
    ? 'The teacher neglected their duties. Students win by chaos.'
    : `Class average: <b>${Math.round(data.avg * 100)}%</b> (needed ${PASS_PCT * 100}%)`;
  hud.showResults(title, avgLine, data.rows);
  (studentsWin !== iAmTeacher) ? sounds.win() : sounds.lose();
  S.phase = 'results';
}

// ---------------------------------------------------------------- boot & loop

hud.init({
  onCreate: (name, role) => join(true, name, role),
  onJoin: (name, role, code) => join(false, name, role, code),
  onStart: () => hostStart(),
  onAgain: () => { S.phase = 'lobby'; S.resultsSent = false; hud.hideOverlays(); refreshLobby(); },
  onAnswer: (q, oi) => { if (S.phase === 'exam' && !S.expelled[S.myId]) setMyAnswer(q, oi); },
  onSelectQ: q => { S.selectedQ = S.selectedQ === q ? null : q; refreshSheet(); },
  onPrepChange: c => { if (S.phase === 'prep') sendPrep(c); },
  onAction: t => tryAction(t),
});
hud.renderActionBar(ACTIONS);
hud.showMenu(netLabel(P.get('net') || (onlineAvailable() ? 'online' : 'bc')));

// URL auto-join for tests / quick links
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
  syncGifts();

  // pending payload deliveries
  for (let i = S.pendingLearns.length - 1; i >= 0; i--) {
    if (t >= S.pendingLearns[i].at) { deliver(S.pendingLearns[i].ev); S.pendingLearns.splice(i, 1); }
  }
  // debounced answer broadcast
  if (S.answersDirty && t > S.answersDirty) {
    S.answersDirty = 0;
    S.net.send('answers', { filled: myAnswers() });
  }
  // pose sync
  if (S.net && t > S.poseDirty && (S.phase === 'exam' || S.phase === 'inspect')) {
    S.poseDirty = t + 0.12;
    S.net.send('pose', isTeacher()
      ? { x: S.tPos.x, z: S.tPos.z, yaw: S.camYaw }
      : { yaw: S.camYaw, lean: S.lean });
  }
  // apply poses to avatars
  for (const pid in S.avatars) {
    const av = S.avatars[pid], pose = S.poses[pid];
    if (pose && pid !== S.myId && !S.expelled[pid]) {
      av.head.rotation.y = (pose.yaw || 0) * 0.7;
      av.setLean(pose.lean || 0);
    }
    av.tick(t);
  }
  if (S.teacherAv) {
    const tp = S.poses[S.teacherId];
    if (tp && !isTeacher()) S.teacherAv.setPose(tp.x, tp.z, tp.yaw);
    if (isTeacher()) S.teacherAv.setPose(S.tPos.x, S.tPos.z, S.camYaw);
    S.teacherAv.tick(t);
  }

  // HUD timers
  if (['prep', 'inspect', 'exam'].includes(S.phase)) {
    const left = Math.max(0, (S.phaseEnds - Date.now()) / 1000);
    hud.setTimer(`${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`);
  } else hud.setTimer('—');
  if (isTeacher()) {
    hud.meters(S.authority, S.inspection);
    const cd = S.accuseReadyAt - t;
    hud.cooldown(S.phase === 'exam' ? (cd > 0 ? `🫵 Accuse ready in ${cd.toFixed(1)}s` : '🫵 Click a student to ACCUSE') : '');
    hud.strikesHud(students().map(p =>
      `${p.name}: ${'⚠️'.repeat(S.strikes[p.id] || 0) || '—'}${S.expelled[p.id] ? ' 💀' : ''}`));
  } else if (S.phase === 'exam') {
    hud.actionBarState(type => {
      const a = ACT[type];
      const busy = t < S.busyUntil;
      let disabled = busy || S.expelled[S.myId];
      if (type.startsWith('read')) {
        const kind = type.slice(4).toLowerCase();
        disabled = disabled || !(S.artifacts[S.myId] || []).some(x => x.kind === kind || (kind === 'stash' && x.kind === 'gift'));
      }
      return { disabled, busy: busy && S.busyType === type, tip: a.label };
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
      knowledge: S.knowledge[S.myId] || [], artifacts: (S.artifacts[S.myId] || []).map(a => a.kind),
    };
  },
  start: () => hostStart(),
  act: (type, meta) => fireAction(type, meta || {}),
  selectQ: q => { S.selectedQ = q; },
  tryAction,
  throwNoteAt,
  answer: (q, a) => setMyAnswer(q, a),
  accuse: pid => S.net.send('accuse', { target: pid }),
  inspect: seat => S.net.send('inspect', { seat }),
  prep: kinds => sendPrep({ kinds, giftTo: null }),
  skipPhase: () => { if (S.net.isHost()) S.phaseEnds = 0; },
  get examKey() { return S.exam ? S.exam.map(q => q.correct) : []; },
  teacherTo: (x, z) => { S.tPos.x = x; S.tPos.z = z; },
};
