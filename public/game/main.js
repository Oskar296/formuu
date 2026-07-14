import * as THREE from 'three';
import { buildWorld, MAPS, lights, collide, setAniso, DESKS, TEACHER_DESK, BOARD, STOOL, ROOM, seatAdjacent } from './src/classroom.js';
import { makeFigure, bakeFigure } from './src/figure.js';
import { generateExam, dealKnowledge, score, N_QUESTIONS, LETTERS } from './src/exam.js';
import { makeNet, onlineAvailable, makeId } from './src/net.js';
import { makeBots, BotBrain } from './src/bots.js';
import { profile, COLORS, colorHex } from './src/profile.js';
import { sfx } from './src/audio.js';

// THE EXAM — cheat together, don't get caught.
// Minecraft-style controls: pointer-lock mouse look, crosshair, one interact
// key. The player chooses what to do by AIMING at the world, not from menus.

const P = new URLSearchParams(location.search);
const TSCALE = Math.max(0.25, +(P.get('t') || 1));
const DUR = { prep: 60, inspect: 18, exam: 180 };
const CATCH_WINDOW = 5, ACCUSE_CD = 8, PASS = 0.6;
const $ = id => document.getElementById(id);
const now = () => performance.now() / 1000;

// ---------------------------------------------------------------- three
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
setAniso(renderer.capabilities.getMaxAnisotropy());   // sharp textures at grazing angles
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfd8e4');
scene.fog = new THREE.Fog('#cfd8e4', 24, 46);

// image-based lighting: a soft sky→ground gradient env map so every material
// gets gentle reflections and ambient variation instead of reading flat. Rough
// surfaces (walls) barely show it; glass, metal and bottles come alive.
function buildEnv(sky, mid, ground) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, sky); g.addColorStop(0.5, mid); g.addColorStop(1, ground);
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  const tx = new THREE.CanvasTexture(cv);
  tx.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tx).texture;
  pmrem.dispose(); tx.dispose();
  return env;
}
const ENV_DAY = buildEnv('#eae4d4', '#cbc4b6', '#7d766a');   // warm neutral, keeps wood tones rich
const ENV_NIGHT = buildEnv('#2a3350', '#1c2334', '#12151e');
scene.environment = ENV_DAY;
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 90);
// the profile stores a HORIZONTAL fov (like Minecraft's wide feel); the
// vertical fov is derived from the window shape so narrow windows and
// phones don't collapse into a zoomed-in tunnel
const DEG = Math.PI / 180;
const BASE_FOVH = 110;   // fixed, wide resting horizontal FOV (not too zoomed in)
let fovKick = 0;         // sprinting widens the view a touch
let zoom = 1, zoomTarget = 1;   // hold-to-zoom (Minecraft-style), 1 = normal
function applyFov() {
  const h = Math.min(150, (BASE_FOVH + fovKick) / zoom);
  camera.fov = Math.max(14, Math.min(120, 2 * Math.atan(Math.tan(h * DEG / 2) / camera.aspect) / DEG));
  camera.updateProjectionMatrix();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; applyFov(); }
addEventListener('resize', resize); resize();
lights(scene);
const applyEnv = mapId => { scene.environment = mapId === 'detention' ? ENV_NIGHT : ENV_DAY; };
let room = buildWorld(scene, 'classroom');
applyEnv(room.mapId);
bakeFigure();

// ---------------------------------------------------------------- state
const S = {
  net: null, myId: null, myRole: 'student', code: '', roster: [],
  phase: 'menu', phaseEnds: 0, seed: 0,
  seats: {}, teacherId: null, exam: null, knowledge: {}, answers: {},
  strikes: {}, expelled: {}, authority: 100, inspection: 100,
  duty: null, nextDutyAt: 0, riotUntil: 0, lastAccuseAt: -99, ACCUSE_CD,
  cheatLog: [], figures: {}, poses: {}, walkPh: {}, lastPos: {}, leanUntil: {},
  traps: new Map(), notes: new Map(),   // notes hidden under / left on desks + thrown
  standing: false, standingSet: {}, lastOOS: {}, board: null,
  attach: {}, myTrapUsed: false,
  me: { x: 4, z: 6, yaw: Math.PI, walk: 0 }, vx: 0, vz: 0, stun: 0, stuck: 0, keys: {},
  yaw: Math.PI, pitch: 0, locked: false, tp: false, headPt: new THREE.Vector3(),
  sheetOpen: true,
  poseAt: 0, resultsSent: false, handLure: null, ringingUntil: 0, ringingId: null, windowUntil: 0,
  prompt: null,   // {text, run} — current crosshair action
};
const isTeacher = () => S.myRole === 'teacher';
const students = () => S.roster.filter(p => p.role === 'student');
const nameOf = id => (S.roster.find(p => p.id === id) || {}).name || '???';
const mySeat = () => S.seats[S.myId];
const inRiot = () => now() < S.riotUntil;
const ringing = () => now() < S.ringingUntil;
const bots = new BotBrain(S, null);

// ---------------------------------------------------------------- hud helpers
function toast(msg, cls = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + cls; el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3400);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}
let bannerT = 0;
function banner(msg, ms = 2600) { const b = $('banner'); b.textContent = msg; b.style.opacity = 1; clearTimeout(bannerT); bannerT = setTimeout(() => (b.style.opacity = 0), ms); }
function viewer(title, img, marks) {
  // free the mouse so the pop-up can actually be closed while pointer-locked
  document.exitPointerLock && document.exitPointerLock();
  $('viewerTitle').textContent = title; $('viewerImg').src = img;
  const cp = $('viewerCopy'), has = marks && marks.length && !isTeacher() && mySeat() != null && !S.expelled[S.myId];
  cp.classList.toggle('hidden', !has);
  if (has) {
    cp.textContent = `📋 Copy ${marks.length} answer${marks.length > 1 ? 's' : ''}`;
    cp.onclick = () => { marks.forEach(m => setAnswer(m.q, m.a)); toast(`✅ copied ${marks.length} answer${marks.length > 1 ? 's' : ''} to your sheet`, 'gold'); sfx.learn(); $('viewer').classList.add('hidden'); };
  }
  $('viewer').classList.remove('hidden');
}
$('viewerClose').onclick = () => $('viewer').classList.add('hidden');
$('viewer').addEventListener('pointerup', e => { if (e.target.id === 'viewer') $('viewer').classList.add('hidden'); });
$('help').addEventListener('pointerup', e => { if (e.target.id === 'help') $('help').classList.add('hidden'); });
const show = (id, v) => $(id).classList.toggle('hidden', !v);
const modalOpen = () => ['viewer', 'scrib', 'help', 'settings', 'howto'].some(id => !$(id).classList.contains('hidden'));

function sheetImage(name, answers) {
  const cv = document.createElement('canvas'); cv.width = 340; cv.height = 300;
  const c = cv.getContext('2d');
  c.fillStyle = '#f6f1e0'; c.fillRect(0, 0, 340, 300);
  c.fillStyle = '#6a1f1f'; c.font = 'bold 20px Georgia'; c.fillText(`${name}'s paper`, 16, 30);
  for (let q = 0; q < N_QUESTIONS; q++) {
    const a = answers ? answers[q] : null;
    c.fillStyle = '#4a3f28'; c.font = '17px system-ui'; c.fillText(`Q${q + 1}:`, 20, 66 + q * 29);
    c.fillStyle = a == null ? '#b9ac8a' : '#33508c';
    c.font = a == null ? 'italic 16px system-ui' : 'bold 18px system-ui';
    c.fillText(a == null ? '—' : LETTERS[a], 70, 66 + q * 29);
  }
  return cv.toDataURL('image/png');
}

// ---------------------------------------------------------------- menu / settings / lobby
function refreshWho() {
  $('whoName').textContent = profile.name || 'no name yet';
  $('whoDot').style.background = colorHex(profile.color);
  const st = profile.stats;
  $('statLine').textContent = st.rounds ? `🎓 ${st.rounds} round${st.rounds > 1 ? 's' : ''} played · ${st.wins} won` : '';
}
{
  let role = 'student';
  $('roleStudent').onclick = () => { role = 'student'; $('roleStudent').classList.add('sel'); $('roleTeacher').classList.remove('sel'); };
  $('roleTeacher').onclick = () => { role = 'teacher'; $('roleTeacher').classList.add('sel'); $('roleStudent').classList.remove('sel'); };
  S.mapSel = 'random';
  [...$('mapRow').children].forEach(b => (b.onclick = () => {
    S.mapSel = b.dataset.map;
    [...$('mapRow').children].forEach(x => x.classList.toggle('sel', x === b));
    $('mapNote').textContent = S.mapSel === 'random' ? '🎲 random map each round'
      : `${MAPS[S.mapSel].icon} ${MAPS[S.mapSel].name}`;
  }));
  S.diffSel = 'normal';
  const DIFF_NOTE = { chill: '😴 substitute teacher — barely awake', normal: '🧑‍🏫 normal teacher', hawk: '🦅 hawk — sees EVERYTHING, students cheat sneakier' };
  [...$('diffRow').children].forEach(b => (b.onclick = () => {
    S.diffSel = b.dataset.diff;
    [...$('diffRow').children].forEach(x => x.classList.toggle('sel', x === b));
    $('diffNote').textContent = DIFF_NOTE[S.diffSel];
  }));
  $('btnHow').onclick = () => show('howto', true);
  $('btnHowClose').onclick = () => show('howto', false);
  $('btnSolo').onclick = () => join('solo', role);
  $('btnCreate').onclick = () => join('create', role);
  $('btnJoin').onclick = () => join('join', role, $('codeInput').value.trim().toUpperCase());
  $('btnStart').onclick = () => hostStart();
  $('btnAgain').onclick = () => { show('results', false); backToLobby(); };
  $('netNote').textContent = onlineAvailable()
    ? 'Online rooms enabled — share the code with friends anywhere.'
    : 'Local mode: rooms work across TABS of this browser. Solo works everywhere.';
  $('soundBtn').onclick = () => ($('soundBtn').textContent = sfx.toggle() ? '🔇' : '🔊');
  // settings: username + color
  $('btnSettings').onclick = () => {
    $('setName').value = profile.name;
    const g = $('colorGrid'); g.innerHTML = '';
    for (const c of COLORS) {
      const d = document.createElement('div');
      d.className = 'swatch' + (profile.color === c.id ? ' sel' : '');
      d.style.background = c.hex;
      d.onclick = () => { profile.color = c.id; [...g.children].forEach(x => x.classList.remove('sel')); d.classList.add('sel'); refreshWho(); };
      g.appendChild(d);
    }
    show('settings', true);
  };
  $('btnSettingsDone').onclick = () => { profile.name = $('setName').value; refreshWho(); show('settings', false); };
  refreshWho();
}

async function join(mode, role, code) {
  sfx.resume();
  if (!profile.name) profile.name = role === 'teacher' ? 'Teacher' : 'Student' + ((Math.random() * 90 + 10) | 0);
  refreshWho();
  S.myRole = role;
  S.code = mode === 'join' ? code
    : Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ'[(Math.random() * 23) | 0]).join('');
  if (mode === 'join' && (!code || code.length !== 4)) { toast('Enter a 4-letter code', 'red'); return; }
  const netMode = mode === 'solo' ? 'local' : P.get('net') || (onlineAvailable() ? 'online' : 'bc');
  S.net = makeNet(netMode);
  bots.net = S.net;
  S.myId = S.net.id;
  S.net.onEvent(onEvent);
  S.net.onRoster(r => { S.roster = r; if (S.phase === 'lobby') refreshLobby(); });
  try { await S.net.join(S.code, { name: profile.name, role, color: profile.color }); }
  catch (e) { toast(e.message, 'red'); return; }
  if (mode === 'solo') {
    S.net.addBots(role === 'teacher' ? makeBots(9, 'student', profile.color)
      : [...makeBots(1, 'teacher', profile.color), ...makeBots(8, 'student', profile.color)]);
    show('menu', false);
    setTimeout(() => hostStart(), 150);
    return;
  }
  show('menu', false);
  S.phase = 'lobby';
  refreshLobby();
}
function refreshLobby() {
  show('lobby', true);
  $('roomCodeBig').textContent = S.code;
  const r = $('roster'); r.innerHTML = '';
  for (const p of S.roster) {
    const d = document.createElement('div');
    d.innerHTML = `<span><span class="rosterDot" style="background:${colorHex(p.color)}"></span>${p.name}${p.bot ? ' 🤖' : ''}</span><span class="dim">${p.role}</span>`;
    r.appendChild(d);
  }
  const t = S.roster.filter(p => p.role === 'teacher').length, st = students().length;
  $('btnStart').disabled = !(t === 1 && st >= 1 && S.net.isHost());
  $('lobbyHint').textContent =
    t === 0 ? 'Waiting for a Teacher to join…' :
    t > 1 ? 'Too many teachers — only one allowed!' :
    st === 0 ? 'Waiting for at least one Student…' :
    S.net.isHost() ? `${st} student${st > 1 ? 's' : ''} + 1 teacher — ready!` : 'Waiting for the host to start…';
}
function backToLobby() {
  S.phase = 'lobby'; S.resultsSent = false;
  clearRound();
  if (S.roster.some(p => p.bot)) { setTimeout(() => hostStart(), 400); return; }
  refreshLobby();
}

// ---------------------------------------------------------------- host logic
function hostStart() {
  if (!S.net.isHost()) return;
  const t = S.roster.filter(p => p.role === 'teacher'), st = students();
  if (t.length !== 1 || st.length < 1) return;
  const seats = {};
  st.slice(0, 9).forEach((p, i) => (seats[p.id] = i));
  const ids = Object.keys(MAPS);
  const map = P.get('map') || (S.mapSel === 'random' || !MAPS[S.mapSel] ? ids[(Math.random() * ids.length) | 0] : S.mapSel);
  S.net.send('start', { seed: +(P.get('seed') || (Math.random() * 1e9 | 0)), seats, teacherId: t[0].id, map, diff: S.diffSel || 'normal' });
}
function hostPhase(phase) {
  const endsAt = Date.now() + DUR[phase] / TSCALE * 1000;
  S.net.send('phase', { phase, endsAt });
  if (phase === 'prep') {
    const deal = dealKnowledge(S.seed, Object.keys(S.seats));
    const know = {};
    for (const pid in deal) know[pid] = deal[pid].map(q => ({ q, a: S.exam.questions[q].correct }));
    S.net.send('deal', { knowledge: know });
  }
  if (phase === 'exam') {
    S.nextDutyAt = now() + (14 + Math.random() * 10) / TSCALE;
    // every rigged distraction fires at a staggered random time during the
    // exam (so the cheat window is guaranteed, not dependent on the teacher)
    for (const tr of S.traps.values())
      if (tr.armed) tr.ringAt = now() + (0.12 + Math.random() * 0.7) * DUR.exam / TSCALE;
  }
}
function hostTick(dt) {
  if (!S.net || !S.net.isHost() || !['prep', 'inspect', 'exam'].includes(S.phase)) return;
  const t = now();
  if (Date.now() > S.phaseEnds) {
    if (S.phase === 'prep') hostPhase('inspect');
    else if (S.phase === 'inspect') hostPhase('exam');
    else hostResults('bell');
    return;
  }
  bots.tick(t, dt);
  if (S.phase !== 'exam') return;
  // being out of your seat is itself a catchable offence — logged on a rolling
  // window so the teacher can accuse a wanderer at ANY moment, not just 5s
  for (const p of students()) {
    if (S.expelled[p.id] || S.seats[p.id] == null) continue;
    if (S.standingSet[p.id] && t > (S.lastOOS[p.id] || 0) + 1.4) { S.lastOOS[p.id] = t; logCheat(p.id, 'OUT OF THEIR SEAT'); }
  }
  if (!S.duty && t >= S.nextDutyAt) {
    S.net.send('duty', { kind: Math.random() < 0.5 ? 'phone' : 'board', deadline: Date.now() + 18000 / TSCALE });
    S.nextDutyAt = t + (26 + Math.random() * 14) / TSCALE;
  }
  if (S.duty && Date.now() > S.duty.deadline) S.net.send('dutyMiss', {});
  if (S.duty && S.teacherId && !S.roster.find(p => p.id === S.teacherId)?.bot) {
    const tp = S.poses[S.teacherId] || (S.teacherId === S.myId ? S.me : null);
    if (tp) {
      const g = S.duty.kind === 'phone' ? { x: TEACHER_DESK.x + 1.2, z: TEACHER_DESK.z + 1.2 } : { x: BOARD.x, z: -ROOM.z + 1.2 };
      if (Math.hypot(tp.x - g.x, tp.z - g.z) < 1.1) {
        S.dutyHold = (S.dutyHold || 0) + dt;
        if (S.dutyHold > 1.6) { S.dutyHold = 0; S.net.send('dutyDone', {}); }
      } else S.dutyHold = 0;
    }
  }
  const tp = S.poses[S.teacherId] || (S.teacherId === S.myId ? S.me : null);
  for (const tr of S.traps.values()) {
    if (!tr.armed) continue;
    // fire on the teacher stepping on it OR when its timer comes up
    const prox = tr.kind !== 'clock' && tp && Math.hypot(tp.x - tr.pos[0], tp.z - tr.pos[2]) < 0.9;
    const timer = tr.ringAt && t >= tr.ringAt;
    if (prox || timer) S.net.send('trapFire', { id: tr.id });
  }
  if (S.ringingId && t > S.ringingUntil) S.net.send('trapGone', { id: S.ringingId });
  if (S.authority <= 0 && !inRiot()) S.net.send('meters', { authority: 55, inspection: S.inspection });
}
function hostAccuse(from, targetId) {
  const t = now();
  if (from !== S.teacherId || S.phase !== 'exam') return;
  if (t - S.lastAccuseAt < ACCUSE_CD - 0.25) return;
  if (!(targetId in S.seats) || S.expelled[targetId]) return;
  S.lastAccuseAt = t;
  const hit = S.cheatLog.filter(a => a.pid === targetId && a.until >= t && !a.riot).pop();
  if (hit) {
    const strikes = (S.strikes[targetId] || 0) + 1;
    S.net.send('verdict', { target: targetId, guilty: true, kind: hit.kind, strikes, expelled: strikes >= 3, img: hit.img || null });
    if (strikes >= 3 && students().every(p => S.expelled[p.id] || p.id === targetId))
      setTimeout(() => hostResults('expelled'), 1000);
  } else {
    const authority = Math.max(0, S.authority - 25);
    S.net.send('verdict', { target: targetId, guilty: false, authority });
    if (authority <= 0) S.net.send('riot', { until: Date.now() + 8000 });
  }
}
function hostResults(reason) {
  if (S.resultsSent) return;
  S.resultsSent = true;
  const rows = students().map(p => ({
    id: p.id, name: p.name,
    score: S.expelled[p.id] ? 0 : score(S.answers[p.id], S.exam),
    expelled: !!S.expelled[p.id],
  })).sort((a, b) => b.score - a.score);
  const avg = rows.length ? rows.reduce((s, r) => s + r.score, 0) / (rows.length * N_QUESTIONS) : 0;
  let pass = avg >= PASS;
  if (reason === 'principal') pass = true;
  if (reason === 'expelled') pass = false;
  if (rows[0] && !rows[0].expelled) rows[0].crown = true;
  S.net.send('results', { rows, avg, pass, reason });
}
const inWindow = () => now() < S.windowUntil;   // a distraction is covering the class
const WINDOW_SECS = { clock: 9, marbles: 5, glue: 5, pepper: 5 };
function openCheatWindow(sec, kind, who) {
  S.windowUntil = Math.max(S.windowUntil, now() + sec);
  if (kind === 'clock') S.ringingUntil = Math.max(S.ringingUntil, now() + sec);
  const label = { clock: '⏰ ALARM GOING OFF', marbles: '💫 MARBLES!', glue: '🍯 GLUED DOWN', pepper: '🤧 PEPPER CLOUD' }[kind] || '🎯 CHAOS';
  banner(isTeacher() ? `${label} — WHO DID THIS?!` : `🎯 CHEAT WINDOW — nobody's watching!`, Math.min(4000, sec * 1000));
  const v = $('riotVignette'); v.style.opacity = 0.65; setTimeout(() => (v.style.opacity = 0), Math.min(sec, 5) * 1000);
  if (!isTeacher()) sfx.learn();
}
function logCheat(pid, kind, img) {
  if (ringing() || inWindow()) return;   // cover noise / distraction
  S.cheatLog.push({ pid, kind, img, until: now() + CATCH_WINDOW, riot: inRiot() });
  if (S.cheatLog.length > 300) S.cheatLog.splice(0, 150);
}
const BURST = {};
function logBurst(pid, kind) {
  const k = pid + kind, t = now();
  BURST[k] = (BURST[k] || []).filter(x => x > t - 4); BURST[k].push(t);
  if (BURST[k].length >= 3) logCheat(pid, kind);
}

// ---------------------------------------------------------------- events
function onEvent(ev) {
  const { type, data, from } = ev;
  switch (type) {
    case 'start': startRound(data); break;
    case 'phase': setPhase(data.phase, data.endsAt); break;
    case 'deal': {
      S.knowledge = data.knowledge;
      for (const k of (S.knowledge[S.myId] || [])) setAnswer(k.q, k.a, false);
      buildSheet(); break;
    }
    case 'pose': S.poses[from] = data; break;
    case 'answers': if (from !== S.myId) S.answers[from] = data.filled; break;
    case 'act': handleAct(from, data); break;
    case 'trap': {
      if (S.traps.has(data.id)) break;
      S.traps.set(data.id, { ...data, mesh: trapMesh(data.kind, data.pos), armed: true, owner: from });
      if (from === S.myId) toast(`${TRAP_ICON[data.kind] || '🛠'} rigged`);
      break;
    }
    case 'stick': {
      if (S.notes.has(data.id)) break;
      let pos, kind;
      if (data.decoy) {   // on the teacher's desk — bait
        pos = [TEACHER_DESK.x + (Math.random() - 0.5) * 0.9, 1.06, TEACHER_DESK.z + (Math.random() - 0.5) * 0.4];
        kind = 'decoy';
      } else {
        const d = DESKS[data.desk];
        if (data.hidden) { pos = [d.x + (Math.random() - 0.5) * 0.5, 0.99, d.deskZ + 0.28]; kind = 'hidden'; }
        else { pos = [d.x + (Math.random() - 0.5) * 0.5, 1.115, d.deskZ + (Math.random() - 0.5) * 0.3]; kind = 'landed'; }
      }
      S.notes.set(data.id, { ...data, kind, mesh: noteMesh(pos, !!data.hidden), owner: from });
      if (data.desk >= 0) capDeskNotes(data.desk);
      if (from === S.myId) toast(data.decoy ? "🎭 decoy planted on the teacher's desk" : data.hidden ? '🙈 note hidden under the desk' : '📝 note left on your desk');
      break;
    }
    case 'throw': {
      sfx.paper(volFor(from));
      logCheat(from, 'throwing a note', data.img);
      gesture(from, '🗒 yeet!');
      const targetSeat = S.seats[data.to];
      flyNote(from, data.to, () => {
        // the note LANDS and stays on the desk — physical evidence
        if (targetSeat == null || S.notes.has(data.id)) return;
        const d = DESKS[targetSeat];
        const pos = [d.x + (Math.random() - 0.5) * 0.6, 1.115, d.deskZ + (Math.random() - 0.5) * 0.3];
        S.notes.set(data.id, { id: data.id, img: data.img, marks: data.marks, desk: targetSeat, kind: 'landed', mesh: noteMesh(pos, false), owner: from });
        capDeskNotes(targetSeat);
        if (data.to === S.myId) toast('🗒 a note landed on your desk — read it!', 'gold');
      });
      break;
    }
    case 'attach': {
      (S.attach[from] = S.attach[from] || {})[data.slot] = { img: data.img, marks: data.marks };
      logCheat(from, data.slot === 'arm' ? 'inking their arm' : 'rigging a bottle');
      if (data.slot === 'arm' && S.figures[from]) S.figures[from].inkArm();   // visible to everyone
      if (data.slot === 'bottle' && S.seats[from] != null) bottleLabel(S.seats[from]);
      if (from === S.myId) toast(data.slot === 'arm' ? '💪 ink dried on your arm' : '🍼 bottle labelled');
      gesture(from, data.slot === 'arm' ? '✍️ scribbles on arm' : '🍼 fiddles with bottle');
      break;
    }
    case 'board': {
      S.board = { img: data.img, marks: data.marks, owner: from };
      boardWrite(data.img);
      logCheat(from, 'writing on the board');
      if (from === S.myId) toast('🖊 written on the board — everyone can read it!');
      else gesture(from, '🖊 writes on the board');
      break;
    }
    case 'accuse': if (S.net.isHost()) hostAccuse(from, data.target); break;
    case 'verdict': handleVerdict(data); break;
    case 'riot': {
      S.riotUntil = now() + (data.until - Date.now()) / 1000;
      S.authority = 0;
      banner('🔥 CLASS RIOT — CHEAT FREELY! 🔥', 5000);
      $('riotVignette').style.opacity = 1;
      setTimeout(() => ($('riotVignette').style.opacity = 0), data.until - Date.now());
      sfx.riot(); break;
    }
    case 'meters': S.authority = data.authority; S.inspection = data.inspection; break;
    case 'duty': {
      S.duty = data;
      if (data.kind === 'phone') sfx.startRing('phone');
      if (isTeacher()) banner(data.kind === 'phone' ? '📞 THE PHONE IS RINGING — answer it!' : '🖊 GO WRITE ON THE BOARD!', 2600);
      else toast(data.kind === 'phone' ? '📞 the phone is ringing…' : '🖊 teacher has board duty…', 'gold');
      break;
    }
    case 'dutyDone': S.duty = null; sfx.stopRing(); if (isTeacher()) toast('duty done ✓'); break;
    case 'dutyMiss': {
      S.duty = null; sfx.stopRing();
      S.inspection = Math.max(0, S.inspection - 20);
      if (isTeacher()) toast('📋 duty missed — inspection drops!', 'red');
      if (S.net.isHost()) {
        S.net.send('meters', { authority: S.authority, inspection: S.inspection });
        if (S.inspection <= 0) hostResults('principal');
      }
      break;
    }
    case 'trapFire': {
      const tr = S.traps.get(data.id); if (!tr || !tr.armed) break;
      tr.armed = false;
      const who = nameOf(tr.owner);
      const tv = volAt(tr.pos[0], tr.pos[2]);
      if (tr.kind === 'marbles') {
        sfx.crash(tv); removeTrap(data.id);
        if (isTeacher()) S.stun = now() + 2.2;
      } else if (tr.kind === 'glue') {
        sfx.squelch(tv); removeTrap(data.id);
        if (isTeacher()) S.stuck = now() + 2.6;
      } else if (tr.kind === 'pepper') {
        sfx.sneeze(tv); removeTrap(data.id);
        if (isTeacher()) blind(2.6);
      } else if (tr.kind === 'clock') {
        S.ringingId = data.id; sfx.startRing('clock');
      }
      // EVERY distraction opens a loud CHEAT WINDOW — nothing can be caught
      openCheatWindow(WINDOW_SECS[tr.kind] || 5, tr.kind, who);
      break;
    }
    case 'trapGone': {
      const tr = S.traps.get(data.id);
      if (tr) { removeTrap(data.id); if (data.disarmed) toast(`🕵️ teacher removed ${nameOf(tr.owner)}'s ${tr.kind}`, 'red'); }
      if (S.ringingId === data.id) { S.ringingId = null; S.ringingUntil = 0; sfx.stopRing(); }
      break;
    }
    case 'noteGone': {
      const n = S.notes.get(data.id);
      if (n) {
        scene.remove(n.mesh); S.notes.delete(data.id);
        if (data.readAloud) { viewer(`📢 CONFISCATED — ${nameOf(n.owner)}'s note, read to the class:`, n.img, n.marks); sfx.laugh(); }
      }
      break;
    }
    case 'results': showResults(data); break;
  }
}
// how loud someone's noise is for ME: full volume up close, a murmur across
// the room. This is what keeps nine cheating bots from being a wall of sound.
function volFor(pid) {
  if (pid === S.myId) return 1;
  let px, pz;
  const pose = S.poses[pid];
  if (pose && pose.x !== undefined && S.standingSet[pid]) { px = pose.x; pz = pose.z; }
  else if (S.seats[pid] != null) { const d = DESKS[S.seats[pid]]; px = d.x; pz = d.z; }
  else if (pose && pose.x !== undefined) { px = pose.x; pz = pose.z; }
  else return 0.5;
  const d = Math.hypot(px - S.me.x, pz - S.me.z);
  return Math.max(0.06, Math.min(1, 1.9 / (1 + d)));
}
const volAt = (x, z) => Math.max(0.12, Math.min(1, 2.4 / (1 + Math.hypot(x - S.me.x, z - S.me.z))));
function handleAct(from, a) {
  switch (a.type) {
    case 'signal': logCheat(from, 'hand signals');
      if (S.figures[from]) { S.figures[from].raiseHand(true); setTimeout(() => S.figures[from] && S.figures[from].raiseHand(false), 2000); }
      gesture(from, ['☝️', '✌️', '🤟', '🖐'][a.n - 1] + ' ' + a.n);
      break;
    case 'peek': logCheat(from, 'peeking');
      S.leanUntil[from] = { until: now() + 1.6, dir: a.dir || 1 };
      if (from === S.myId && a.target) viewer(`👀 ${nameOf(a.target)}'s paper — copy what they've got:`, sheetImage(nameOf(a.target), S.answers[a.target]), answerMarks(a.target));
      break;
    case 'readArm': logCheat(from, 'reading their arm'); gesture(from, '🧐 checks sleeve');
      if (from === S.myId && (S.attach[from] || {}).arm) viewer('💪 Your arm says:', S.attach[from].arm.img, S.attach[from].arm.marks);
      break;
    case 'readBottle': logCheat(from, 'reading a bottle label'); gesture(from, '🥤 loooong sip');
      if (from === S.myId && (S.attach[from] || {}).bottle) viewer('🍼 Your bottle label:', S.attach[from].bottle.img, S.attach[from].bottle.marks);
      break;
    case 'readNote': logCheat(from, 'reading a hidden note'); gesture(from, '🤫 reaches under the desk'); break;
    case 'tap': sfx.tap(volFor(from)); logBurst(from, 'tapping in code'); gesture(from, '👇 tap'); break;
    case 'cough': sfx.cough(volFor(from)); logBurst(from, 'coughing in code'); gesture(from, '😷 KHM!'); break;
    case 'raise': gesture(from, '✋ SIR!'); S.handLure = { pid: from, until: now() + 6 };
      if (S.figures[from]) { S.figures[from].raiseHand(true); setTimeout(() => S.figures[from] && S.figures[from].raiseHand(false), 2500); }
      break;
    case 'stand': S.standingSet[from] = true; sfx.scrape(volFor(from)); gesture(from, '🪑 stands up!', 'rgba(140,60,20,0.8)'); break;
    case 'sit': delete S.standingSet[from]; sfx.scrape(volFor(from) * 0.7); break;
  }
}
function handleVerdict(v) {
  const name = nameOf(v.target);
  if (v.guilty) {
    S.strikes[v.target] = v.strikes;
    sfx.whistle();
    banner(`🚨 ${name} CAUGHT ${v.kind}! Strike ${v.strikes}${v.expelled ? ' — EXPELLED!' : ''}`, 3000);
    if (v.img) setTimeout(() => { viewer(`📢 CONFISCATED from ${name} — read to the class:`, v.img); sfx.laugh(); }, 700);
    if (v.expelled) {
      S.expelled[v.target] = true;
      if (v.target === S.myId) toast('You were EXPELLED — enjoy the stool of shame', 'red');
    }
  } else {
    S.authority = v.authority;
    sfx.laugh();
    banner(`😂 WRONG! ${name} was innocent. Authority ${v.authority}%`, 2600);
  }
}

// ---------------------------------------------------------------- round lifecycle
function startRound(data) {
  S.seed = data.seed; S.seats = data.seats; S.teacherId = data.teacherId;
  S.diff = data.diff || 'normal'; S.roundCounted = false; S.warned30 = false;
  if (room.mapId !== (data.map || 'classroom')) { room = buildWorld(scene, data.map || 'classroom'); applyEnv(room.mapId); }
  buildRigSpots();
  S.exam = generateExam(data.seed);
  S.answers = {}; S.strikes = {}; S.expelled = {}; S.knowledge = {};
  S.authority = 100; S.inspection = 100; S.duty = null; S.riotUntil = 0;
  S.cheatLog = []; S.resultsSent = false; S.attach = {}; S.board = null;
  S.myTrapUsed = false; S.lastAccuseAt = -99;
  S.stun = 0; S.stuck = 0; S.ringingId = null; S.ringingUntil = 0; S.windowUntil = 0;
  S.sheetOpen = true;
  S.standing = false; S.standingSet = {}; S.lastOOS = {};
  S.vx = 0; S.vz = 0;
  for (const pid in S.seats) S.answers[pid] = Array(N_QUESTIONS).fill(null);
  clearRound(false);
  bots.reset();
  for (const p of S.roster) {
    if (!(p.id in S.seats) && p.id !== S.teacherId) continue;
    const fig = makeFigure(scene, {
      color: colorHex(p.color),
      name: p.name,
      tag: p.id === S.teacherId ? 'rgba(120,30,30,0.6)' : null,
      scale: p.id === S.teacherId ? 1.07 : 1,
    });
    S.figures[p.id] = fig;
    if (p.id === S.teacherId) fig.setPos(TEACHER_DESK.x, TEACHER_DESK.z + 1.3, 0);
    else { const d = DESKS[S.seats[p.id]]; fig.setPos(d.x, d.z + 0.9, Math.PI); }
    if (p.id === S.myId) {
      fig.setVisible(S.tp);   // hidden in first person, shown in third person
      if (isTeacher()) { S.me.x = TEACHER_DESK.x; S.me.z = TEACHER_DESK.z + 1.3; S.yaw = Math.PI; } // face the class
      else { const d = DESKS[S.seats[p.id]]; S.me.x = d.x; S.me.z = d.z + 0.9; S.yaw = 0; }         // face the board
      S.pitch = 0;
    }
  }
  show('lobby', false); show('menu', false); show('results', false);
  sfx.bell();
  if (S.net.isHost()) setTimeout(() => hostPhase('prep'), 80);
}
function clearRound(alsoUI = true) {
  for (const id in S.figures) S.figures[id].dispose();
  S.figures = {}; S.poses = {}; S.walkPh = {}; S.lastPos = {}; S.leanUntil = {};
  for (const tr of S.traps.values()) scene.remove(tr.mesh);
  for (const n of S.notes.values()) scene.remove(n.mesh);
  S.traps.clear(); S.notes.clear();
  clearBottleLabels(); clearBoard();
  sfx.stopRing();
  if (alsoUI) ['sheet', 'teachBar', 'crosshair', 'prompt', 'helpTip'].forEach(i => show(i, false));
}
function setPhase(phase, endsAt) {
  S.phase = phase; S.phaseEnds = endsAt;
  show('lobby', false);
  const stud = !isTeacher();
  show('sheet', stud && phase === 'exam' && mySeat() != null && S.sheetOpen);
  show('teachBar', isTeacher() && (phase === 'inspect' || phase === 'exam'));
  show('crosshair', true); show('helpTip', true);
  showRigSpots(phase === 'prep' && stud);
  $('phaseLabel').textContent = phase === 'prep' ? 'PREP — RIG THE ROOM' : phase === 'inspect' ? 'INSPECTION' : phase === 'exam' ? 'THE EXAM — DO NOT GET CAUGHT' : phase.toUpperCase();
  if (phase === 'inspect' || phase === 'exam') sfx.bell();
  if (phase === 'exam') {
    banner(S.exam ? `📝 Subject: the Republic of ${S.exam.country}` : '📝 BEGIN!', 3000);
    // the paper starts in your hands — free the mouse so answers are clickable
    if (stud && S.sheetOpen && mySeat() != null) document.exitPointerLock && document.exitPointerLock();
  }
  if (phase === 'prep') {
    banner(`${MAPS[room.mapId].icon} ${MAPS[room.mapId].name} — ` + (stud ? '🧠 PLAN YOUR CHEATS before the teacher arrives!' : '👀 the class is up to something…'), 3200);
    if (stud) setTimeout(() => toast('🙈 hide notes under desks · 🎭 decoy the teacher · 🛠 rig distractions · 💪 ink your arm', 'gold'), 900);
  }
}

// ---------------------------------------------------------------- world objects
const TRAP_ICON = { marbles: '🔮', glue: '🍯', pepper: '🌶', clock: '⏰' };
function trapMesh(kind, pos) {
  const g = new THREE.Group();
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
  if (kind === 'marbles') {
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), m(['#c05050', '#5080c0', '#50c080', '#c0a050'][i % 4], { roughness: 0.15 }));
      b.position.set(pos[0] + (Math.random() - 0.5) * 0.5, 0.045, pos[2] + (Math.random() - 0.5) * 0.5);
      g.add(b);
    }
  } else if (kind === 'glue') {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), m('#e0b64e', { roughness: 0.12, transparent: true, opacity: 0.85 }));
    b.rotation.x = -Math.PI / 2; b.position.set(pos[0], 0.02, pos[2]); g.add(b);
  } else if (kind === 'pepper') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.14), m('#c04030'));
    b.position.set(pos[0], 0.05, pos[2]); g.add(b);
  } else if (kind === 'clock') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14), m('#d8d0c0'));
    b.rotation.x = Math.PI / 2; b.position.set(pos[0], 0.13, pos[2]); g.add(b);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), m('#c0a030', { metalness: 0.5, roughness: 0.3 }));
    bell.position.set(pos[0], 0.24, pos[2]); g.add(bell);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  return g;
}
function noteMesh(pos, underDesk) {
  // a folded paper you can actually SEE lying there
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.12),
    new THREE.MeshStandardMaterial({ color: '#fdf7e3', roughness: 0.9 }));
  m.rotation.y = Math.random() * 1.5;
  g.add(m);
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.05),
    new THREE.MeshStandardMaterial({ color: '#efe7cc', roughness: 0.9 }));
  fold.position.set(0, 0.02, 0.02); fold.rotation.y = m.rotation.y;
  g.add(fold);
  g.position.set(...pos);
  if (underDesk) g.rotation.z = Math.PI;   // stuck to the underside
  g.traverse(o => { if (o.isMesh) o.castShadow = !underDesk; });
  scene.add(g);
  return g;
}
function removeTrap(id) { const tr = S.traps.get(id); if (tr) { scene.remove(tr.mesh); S.traps.delete(id); } }
// keep at most a few notes on one desk so they don't pile up forever
function capDeskNotes(desk, max = 4) {
  const ns = [...S.notes.entries()].filter(([, n]) => n.desk === desk);
  while (ns.length > max) { const [id, n] = ns.shift(); scene.remove(n.mesh); S.notes.delete(id); }
}

// riggable world objects — during prep a student aims at one of these glowing
// spots to arm a distraction (no menu). Each maps to an existing trap effect.
let rigSpots = [];
function buildRigSpots() {
  for (const s of rigSpots) if (s.mesh) scene.remove(s.mesh);
  rigSpots = [
    { kind: 'clock', label: 'the clock', pos: [BOARD.x + 4.6, 3.4, -ROOM.z - 0.32] },
    { kind: 'marbles', label: 'the floor', pos: [0, 0.08, -ROOM.z + 2.7] },
    { kind: 'pepper', label: 'the door', pos: [ROOM.x - 0.15, 1.2, ROOM.z * 0.66] },
    { kind: 'glue', label: "the teacher's chair", pos: [TEACHER_DESK.x, 0.62, TEACHER_DESK.z + 0.95] },
  ];
  for (const s of rigSpots) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.3, depthWrite: false }));
    m.position.set(s.pos[0], s.pos[1], s.pos[2]); m.visible = false;
    scene.add(m); s.mesh = m; s.used = false;
  }
}
function showRigSpots(on) { for (const s of rigSpots) if (s.mesh) s.mesh.visible = on && !s.used; }
function armPrompt(set) {
  for (const s of rigSpots) {
    if (s.used || !s.mesh) continue;
    const h = ray.intersectObject(s.mesh, true);
    if (h.length && h[0].distance < 5) {
      set(`🛠 CLICK — rig ${s.label} (a distraction to cheat under)`, () => {
        s.used = true; s.mesh.visible = false;
        S.net.send('trap', { id: 'tr-' + makeId().slice(0, 5), kind: s.kind, pos: s.pos });
      });
      return;
    }
  }
}
const flights = [];
function flyNote(fromId, toId, onLand) {
  const a = S.figures[fromId], seat = S.seats[toId];
  if (!a || seat == null) { onLand && onLand(); return; }
  const d = DESKS[seat];
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.12),
    new THREE.MeshStandardMaterial({ color: '#fdf7e3' }));
  scene.add(m);
  flights.push({ m, t: 0, a: a.group.position.clone().setY(1.35), b: new THREE.Vector3(d.x, 1.12, d.deskZ), onLand });
}
const bottleLabels = [];
function bottleLabel(seat) {
  const b = room.bottleMeshes[seat];
  if (!b) return;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.14),
    new THREE.MeshBasicMaterial({ color: '#f6f1e0' }));
  label.position.set(0, 0, 0.078);
  b.add(label);
  bottleLabels.push({ seat, label });
}
function clearBottleLabels() { for (const l of bottleLabels) l.label.parent?.remove(l.label); bottleLabels.length = 0; }
// the answers a player currently holds, as copyable marks
function answerMarks(pid) {
  const a = S.answers[pid] || [];
  const out = [];
  for (let q = 0; q < N_QUESTIONS; q++) if (a[q] != null) out.push({ q, a: a[q] });
  return out;
}
// a drawing pinned to the classroom board for the whole room to read
let boardMesh = null;
function boardWrite(img) {
  if (boardMesh) { scene.remove(boardMesh); boardMesh = null; }
  const tx = new THREE.TextureLoader().load(img);
  tx.colorSpace = THREE.SRGBColorSpace;
  boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6),
    new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
  boardMesh.position.set(BOARD.x, 2.15, -ROOM.z - 0.36);
  scene.add(boardMesh);
}
function clearBoard() { if (boardMesh) { scene.remove(boardMesh); boardMesh = null; } S.board = null; }
function gesture(pid, text, bg) { const f = S.figures[pid]; if (f) f.setGesture(text, 2.2, now(), bg); }
function blind(sec) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:60;background:#fff;opacity:.96;transition:opacity .5s';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 600); }, sec * 1000);
}

// ---------------------------------------------------------------- sheet
function buildSheet() {
  if (isTeacher() || mySeat() == null) return;
  $('sheetCountry').textContent = 'Republic of ' + S.exam.country;
  const box = $('sheetQs'); box.innerHTML = '';
  const known = new Set((S.knowledge[S.myId] || []).map(k => k.q));
  S.exam.questions.forEach(q => {
    const d = document.createElement('div');
    d.className = 'q' + (known.has(q.id) ? ' studied' : '');
    d.innerHTML = `<div class="qt">Q${q.id + 1}. ${q.text}</div>`;
    const opts = document.createElement('div'); opts.className = 'opts';
    q.options.forEach((o, oi) => {
      const b = document.createElement('button');
      b.textContent = LETTERS[oi]; b.title = o;
      b.onclick = () => { setAnswer(q.id, oi); sfx.click(); };
      opts.appendChild(b);
    });
    d.appendChild(opts);
    const full = document.createElement('div');
    full.style.cssText = 'font-size:10.5px;opacity:.75;margin-top:2px';
    full.textContent = q.options.map((o, i) => `${LETTERS[i]}:${o}`).join('  ');
    d.appendChild(full);
    box.appendChild(d);
  });
  refreshSheet();
}
function refreshSheet() {
  const mine = S.answers[S.myId] || [];
  [...$('sheetQs').children].forEach((d, qi) => {
    [...d.querySelector('.opts').children].forEach((b, oi) => b.classList.toggle('pick', mine[qi] === oi));
  });
}
// picking the paper up frees the mouse (to click answers); putting it down
// grabs the mouse again — same rhythm as Minecraft's inventory
function setSheet(open) {
  S.sheetOpen = open;
  show('sheet', open && S.phase === 'exam' && !isTeacher() && mySeat() != null);
  if (open) document.exitPointerLock && document.exitPointerLock();
  else if (!modalOpen()) {
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }
}
let answersDirty = 0;
function setAnswer(q, a, sync = true) {
  if (S.expelled[S.myId]) return;
  (S.answers[S.myId] = S.answers[S.myId] || Array(N_QUESTIONS).fill(null))[q] = a;
  refreshSheet();
  if (sync) answersDirty = now() + 0.4;
}

// ---------------------------------------------------------------- scribbler
// Freeform cheat authoring: draw ANYTHING, and stamp the answers you want to
// share (Q# = letter). Returns { img, marks:[{q,a}] } — marks are what a
// reader can one-tap copy onto their own sheet. Wrong stamps = decoys.
let scribCb = null, drawing = false, scribMarks = {};
{
  const cv = $('scribCanvas'), c = cv.getContext('2d');
  const reset = () => { c.fillStyle = '#f6f1e0'; c.fillRect(0, 0, cv.width, cv.height); c.strokeStyle = '#22283a'; c.lineWidth = 4; c.lineCap = 'round'; };
  reset();
  const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  cv.onpointerdown = e => { drawing = true; const [x, y] = pt(e); c.beginPath(); c.moveTo(x, y); };
  cv.onpointermove = e => { if (!drawing) return; const [x, y] = pt(e); c.lineTo(x, y); c.stroke(); };
  addEventListener('pointerup', () => (drawing = false));
  $('scribClear').onclick = reset;
  $('scribCancel').onclick = () => { show('scrib', false); scribCb = null; };
  $('scribOk').onclick = () => {
    const marks = Object.keys(scribMarks).map(q => ({ q: +q, a: scribMarks[q] }));
    if (marks.length) {   // burn the stamps into the drawing so it's readable as an image too
      c.fillStyle = 'rgba(246,241,224,0.92)'; c.fillRect(0, 0, cv.width, 30);
      c.fillStyle = '#1c4a2a'; c.font = 'bold 18px system-ui'; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(marks.map(m => `Q${m.q + 1}=${LETTERS[m.a]}`).join('  '), 8, 15);
    }
    const img = cv.toDataURL('image/png');
    show('scrib', false); reset();
    const cb = scribCb; scribCb = null; cb && cb({ img, marks });
  };
}
function openScribbler(title, cb) {
  document.exitPointerLock && document.exitPointerLock();
  $('scribTitle').textContent = title; scribCb = cb; scribMarks = {};
  const box = $('scribStamps'); box.innerHTML = '';
  for (let q = 0; q < N_QUESTIONS; q++) {
    const el = document.createElement('div'); el.className = 'stamp';
    const paint = () => { const a = scribMarks[q]; el.classList.toggle('set', a != null); el.innerHTML = `<span class="qn">Q${q + 1}</span>${a == null ? '—' : LETTERS[a]}`; };
    el.onclick = () => { const cur = scribMarks[q]; const nx = cur == null ? 0 : cur + 1; if (nx > 3) delete scribMarks[q]; else scribMarks[q] = nx; paint(); };
    paint(); box.appendChild(el);
  }
  show('scrib', true);
}

// ---------------------------------------------------------------- pointer-lock look (Minecraft style)
canvas.addEventListener('click', () => {
  if (['prep', 'inspect', 'exam'].includes(S.phase) && !S.locked) {
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }
});
document.addEventListener('pointerlockchange', () => { S.locked = document.pointerLockElement === canvas; });
addEventListener('mousemove', e => {
  if (!S.locked) return;
  const s = 0.0027 / zoom;   // zoomed in → slower, precise aim (scope feel)
  S.yaw -= e.movementX * s;
  S.pitch = Math.max(-1.35, Math.min(1.35, S.pitch - e.movementY * (0.0025 / zoom)));
});
// drag fallback when pointer lock is unavailable
let dragXY = null;
addEventListener('pointerdown', e => { if (!S.locked && e.target === canvas) dragXY = [e.clientX, e.clientY]; });
addEventListener('pointermove', e => {
  if (S.locked || !dragXY) return;
  S.yaw -= (e.clientX - dragXY[0]) * 0.005;
  S.pitch = Math.max(-1.35, Math.min(1.35, S.pitch - (e.clientY - dragXY[1]) * 0.004));
  dragXY = [e.clientX, e.clientY];
});
addEventListener('pointerup', () => (dragXY = null));

addEventListener('keydown', e => {
  S.keys[e.code] = true;
  // pop-ups swallow game keys — E / ESC / Enter / Space close them
  if (!$('viewer').classList.contains('hidden')) {
    if (['Escape', 'KeyE', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); $('viewer').classList.add('hidden'); }
    return;
  }
  if (!$('scrib').classList.contains('hidden')) {
    if (e.code === 'Escape') { show('scrib', false); scribCb = null; }
    return;
  }
  if (!$('help').classList.contains('hidden')) {
    if (e.code === 'KeyH' || e.code === 'Escape') $('help').classList.add('hidden');
    return;
  }
  if (e.code === 'Tab') { e.preventDefault(); if (S.phase === 'exam' && !isTeacher() && mySeat() != null) setSheet(!S.sheetOpen); }
  if (e.code === 'KeyH') $('help').classList.remove('hidden');
  if (e.code === 'KeyM' && ['prep', 'inspect', 'exam'].includes(S.phase)) {
    S.tp = !S.tp;
    const me = S.figures[S.myId]; if (me) me.setVisible(S.tp);
    toast(S.tp ? '🎥 third person' : '🎥 first person');
  }
  // seat toggle mid-exam; everything else is aim-driven (E / click)
  if (e.code === 'Space' && S.phase === 'exam' && !isTeacher() && !S.expelled[S.myId] && mySeat() != null) { e.preventDefault(); toggleSeat(); }
  if (e.code === 'KeyE' && S.prompt) S.prompt.run();
});
addEventListener('keyup', e => (S.keys[e.code] = false));
addEventListener('pointerup', e => {
  // clicks act on the crosshair target when locked; when unlocked a plain
  // click (no drag) does the same via the cursor ray
  if (e.target !== canvas || modalOpen()) return;
  if (S.prompt) S.prompt.run();
});
function act(type, extra = {}) {
  if (isTeacher() || S.phase !== 'exam' || S.expelled[S.myId]) return;
  S.net.send('act', { type, ...extra });
}
// leave your seat mid-exam to wander (VERY catchable) — SPACE toggles
function toggleSeat() {
  const seat = mySeat(); if (seat == null) return;
  const d = DESKS[seat];
  if (!S.standing) {
    S.standing = true;
    S.me.x = d.x; S.me.z = d.z + 1.0; S.vx = 0; S.vz = 0;
    act('stand');
    toast('🪑 you are OUT OF YOUR SEAT — the teacher can accuse you on sight!', 'red');
    show('sheet', false);
  } else if (Math.hypot(S.me.x - d.x, S.me.z - (d.z + 0.15)) < 1.5) {
    S.standing = false;
    S.me.x = d.x; S.me.z = d.z + 0.15; S.me.walk = 0; S.vx = 0; S.vz = 0;
    act('sit');
    show('sheet', S.sheetOpen);
  } else toast('get back to YOUR seat to sit down (SPACE)', 'red');
}

// ---------------------------------------------------------------- crosshair interaction
const ray = new THREE.Raycaster();
function computePrompt() {
  S.prompt = null;
  if (!['prep', 'inspect', 'exam'].includes(S.phase)) { show('prompt', false); return; }
  if (S.tp) {
    // aim from the head along the look direction (the camera is behind you)
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), cp = Math.cos(S.pitch);
    ray.set(S.headPt, new THREE.Vector3(-sy * cp, Math.sin(S.pitch), -cy * cp).normalize());
  } else ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const t = now();
  const seat = mySeat();
  const set = (text, run) => (S.prompt = { text, run });

  if (isTeacher()) {
    // students in reach → accuse; traps/notes → remove
    let best = null;
    for (const p of students()) {
      if (S.expelled[p.id]) continue;
      const f = S.figures[p.id]; if (!f) continue;
      const h = ray.intersectObject(f.mesh, true);
      if (h.length && (!best || h[0].distance < best.d)) best = { d: h[0].distance, p };
    }
    if (best && best.d < 8 && S.phase === 'exam') {
      const cd = ACCUSE_CD - (t - S.lastAccuseAt);
      set(cd > 0 ? `⏳ accuse ready in ${cd.toFixed(1)}s` : `🫵 CLICK — accuse ${best.p.name}`,
        () => { if (cd <= 0) S.net.send('accuse', { target: best.p.id }); });
    } else {
      for (const [id, tr] of S.traps) {
        const h = ray.intersectObject(tr.mesh, true);
        if (h.length && h[0].distance < 3.4) {
          set(tr.kind === 'clock' && S.ringingId === id ? '🔕 CLICK — silence the clock' : `🕵️ CLICK — remove the ${tr.kind}`,
            () => S.net.send('trapGone', { id, disarmed: true }));
          break;
        }
      }
      if (!S.prompt) for (const [id, n] of S.notes) {
        if (n.kind === 'hidden') continue;   // the teacher can't see under desks
        const h = ray.intersectObject(n.mesh, true);
        if (h.length && h[0].distance < 3.4) {
          set('📢 CLICK — confiscate the note (read it aloud)', () => S.net.send('noteGone', { id, readAloud: true }));
          break;
        }
      }
    }
  } else if (!isTeacher() && seat != null && !S.expelled[S.myId]) {
    // FREEFORM CHEATING: aim at a thing → draw on it, or read what's on it.
    const exam = S.phase === 'exam';
    const draw = (title, ev) => openScribbler(title, p => S.net.send(ev.type, { ...ev.data, img: p.img, marks: p.marks }));
    // 1) read a cheat note you can reach. Notes at your desk (incl. ones hidden
    //    under it during prep) are yours to read; others' are swipeable only
    //    while roaming, and hidden notes only ever belong to their desk's owner.
    for (const [id, n] of S.notes) {
      const h = ray.intersectObject(n.mesh, true);
      if (!h.length) continue;
      const mine = n.desk === seat;
      if (mine ? h[0].distance > 2.8 : !(S.standing && h[0].distance < 2.4 && n.kind !== 'hidden')) continue;
      const label = n.kind === 'hidden' ? '🙈 CLICK — read your hidden note' : mine ? '🗒 CLICK — read the note on your desk' : `🕵️ CLICK — swipe ${nameOf(n.owner)}'s note`;
      set(label, () => {
        act('readNote');
        viewer(mine ? `🗒 Note from ${nameOf(n.owner)}:` : `🕵️ ${nameOf(n.owner)}'s note:`, n.img, n.marks);
        S.net.send('noteGone', { id });   // reading consumes the note (declutter)
      });
      break;
    }
    // 2) trap-armable world objects during prep (aim + arm, no menu)
    if (!S.prompt && S.phase === 'prep') armPrompt(set);
    // 3) PLANNING (prep): hide a note UNDER any desk — the teacher can't
    //    confiscate it, and whoever sits there retrieves it during the exam
    if (!S.prompt && S.phase === 'prep') {
      const h = ray.intersectObjects(room.surfaces.map(s => s.mesh));
      if (h.length && h[0].distance < 3.2) {
        const desk = room.surfaces.find(s => s.mesh === h[0].object).desk;
        set('🙈 CLICK — hide a note UNDER this desk (safe from the teacher)', () => draw("🙈 Draw a note to hide under this desk — stamp the answers to share", { type: 'stick', data: { id: 'nt-' + makeId().slice(0, 5), desk, hidden: true } }));
      }
    }
    // 4) plant a DECOY note on the teacher's desk (bait them into wasting a move)
    if (!S.prompt && (S.phase === 'prep' || S.standing) && Math.hypot(S.me.x - TEACHER_DESK.x, S.me.z - TEACHER_DESK.z) < 2.3)
      set("🎭 CLICK — plant a decoy on the teacher's desk", () => draw('🎭 Draw a decoy note — bait the teacher', { type: 'stick', data: { id: 'nt-' + makeId().slice(0, 5), desk: -1, decoy: true } }));
    // 5) ink a cheat on your own arm (look down at yourself)
    if (!S.prompt && !S.standing && S.pitch < -0.6) {
      if ((S.attach[S.myId] || {}).arm) set('💪 CLICK — read your arm', () => act('readArm'));
      else set('✍️ CLICK — ink a cheat on your arm (peekable)', () => draw('✍️ Ink a cheat on your forearm', { type: 'attach', data: { slot: 'arm' } }));
    }
    // 6) aim at a classmate → draw and pass them a note
    if (!S.prompt && exam) for (const p of students()) {
      if (p.id === S.myId || S.expelled[p.id]) continue;
      const f = S.figures[p.id]; if (!f) continue;
      const h = ray.intersectObject(f.mesh, true);
      if (h.length && h[0].distance < (S.standing ? 6.5 : 4.4)) {
        set(`✍️ CLICK — pass a note to ${p.name}`, () => draw(`✍️ Draw a note for ${p.name} — stamp the answers to share`, { type: 'throw', data: { id: 'nt-' + makeId().slice(0, 5), to: p.id } }));
        break;
      }
    }
    // 7) a classmate's paper → peek (adjacent / standing / mirror)
    if (!S.prompt && exam) {
      const h = ray.intersectObjects(room.paperMeshes);
      if (h.length) {
        const deskIdx = room.paperMeshes.indexOf(h[0].object);
        const owner = Object.keys(S.seats).find(pid => S.seats[pid] === deskIdx);
        const dist = h[0].distance;
        if (owner && owner !== S.myId) {
          const near = S.standing ? dist < 2.8 : (seatAdjacent(deskIdx, seat) && dist < 3.4);
          if (near) { const dir = DESKS[deskIdx].x > DESKS[seat].x ? 1 : -1; set(`👀 CLICK — peek at ${nameOf(owner)}'s paper`, () => act('peek', { target: owner, dir })); }
        } else if (deskIdx === seat && !S.standing && dist < 3.4) {
          set('📄 CLICK — ' + (S.sheetOpen ? 'put your paper down (TAB)' : 'pick up your paper (TAB)'), () => setSheet(!S.sheetOpen));
        }
      }
    }
    // 8) my bottle → label / read (from your seat)
    if (!S.prompt && !S.standing) {
      const mine = room.bottleMeshes[seat];
      const h = mine ? ray.intersectObject(mine, true) : [];
      if (h.length && h[0].distance < 2.6) {
        if ((S.attach[S.myId] || {}).bottle) set('🍼 CLICK — read your bottle label', () => act('readBottle'));
        else set('🍼 CLICK — draw a bottle-label cheat', () => draw('🍼 Draw on your bottle label', { type: 'attach', data: { slot: 'bottle' } }));
      }
    }
    // 9) my desk surface → leave a note on it
    if (!S.prompt && !S.standing) {
      const surf = room.surfaces.find(s => s.desk === seat);
      const h = surf ? ray.intersectObject(surf.mesh, true) : [];
      if (h.length && h[0].distance < 2.8)
        set('✍️ CLICK — write a note on your desk', () => draw('✍️ Draw a note to leave on your desk', { type: 'stick', data: { id: 'nt-' + makeId().slice(0, 5), desk: seat } }));
    }
    // 10) the board → write big for the whole room (walk up to it)
    if (!S.prompt && (S.phase === 'prep' || S.standing) && Math.hypot(S.me.x - BOARD.x, S.me.z - BOARD.z) < 3.3)
      set('🖊 CLICK — write on the board (the whole class can read it!)', () => draw('🖊 Draw on the board — big, bold and risky', { type: 'board', data: {} }));
  }
  if (S.prompt && S.prompt.text) { $('prompt').innerHTML = S.prompt.text.replace('CLICK', '<b>CLICK</b>'); show('prompt', true); }
  else show('prompt', false);
}

// ---------------------------------------------------------------- frame loop
function canWalk() {
  if (isTeacher()) return ['prep', 'inspect', 'exam'].includes(S.phase);
  return S.phase === 'prep' || (S.phase === 'exam' && S.standing);
}
let last = performance.now();
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min((nowMs - last) / 1000, 0.05) * TSCALE;
  last = nowMs;
  const t = now();

  hostTick(dt);
  if (answersDirty && t > answersDirty) { answersDirty = 0; S.net && S.net.send('answers', { filled: S.answers[S.myId] }); }

  // movement: Minecraft-flavoured — walk ~4.3 u/s, hold SHIFT to sprint with
  // a smooth FOV kick, normalized diagonals, snappy accelerate/brake
  S.sprinting = false;
  if (S.net && canWalk() && !S.expelled[S.myId] && t > S.stun && t > S.stuck) {
    const sprint = S.keys.ShiftLeft || S.keys.ShiftRight;
    const sp = (isTeacher() ? 4.4 : 4.2) * (sprint ? 1.35 : 1);
    let ix = 0, iz = 0;
    if (S.keys.KeyW) { ix -= Math.sin(S.yaw); iz -= Math.cos(S.yaw); }
    if (S.keys.KeyS) { ix += Math.sin(S.yaw); iz += Math.cos(S.yaw); }
    if (S.keys.KeyA) { ix -= Math.cos(S.yaw); iz += Math.sin(S.yaw); }
    if (S.keys.KeyD) { ix += Math.cos(S.yaw); iz -= Math.sin(S.yaw); }
    const il = Math.hypot(ix, iz);
    S.sprinting = !!(il && sprint);
    const k = Math.min(1, dt * 20);
    S.vx += ((il ? ix / il * sp : 0) - S.vx) * k;
    S.vz += ((il ? iz / il * sp : 0) - S.vz) * k;
    if (Math.hypot(S.vx, S.vz) > 0.12) {
      S.me.x += S.vx * dt; S.me.z += S.vz * dt;
      const p = { x: S.me.x, z: S.me.z }; collide(p); S.me.x = p.x; S.me.z = p.z;
      S.me.yaw = Math.atan2(-S.vx, -S.vz) + Math.PI;   // avatar faces where it walks
      S.bobPh = (S.bobPh || 0) + Math.hypot(S.vx, S.vz) * dt * 1.9;
    } else { S.vx = 0; S.vz = 0; }
    S.me.walk = il ? 1 : 0;
    if (t > S.poseAt) { S.poseAt = t + 0.11; S.net.send('pose', { x: S.me.x, z: S.me.z, yaw: S.yaw, walk: S.me.walk }); }
  }
  // hold-to-zoom (Minecraft spyglass style): Z zooms in, X zooms out (wider);
  // plus the sprint FOV kick, all eased
  const inRound = ['prep', 'inspect', 'exam'].includes(S.phase);
  const canZoom = inRound && !modalOpen();
  zoomTarget = canZoom && S.keys.KeyZ ? 3.6 : canZoom && S.keys.KeyX ? 0.8 : 1;
  const kick = S.sprinting && zoomTarget === 1 ? 11 : 0;   // no sprint-widen while scoping
  let fovDirty = false;
  if (Math.abs(zoom - zoomTarget) > 0.002) { zoom += (zoomTarget - zoom) * Math.min(1, dt * 12); fovDirty = true; }
  if (Math.abs(fovKick - kick) > 0.2) { fovKick += (kick - fovKick) * Math.min(1, dt * 7); fovDirty = true; }
  if (fovDirty) applyFov();

  // figures
  for (const p of (S.roster || [])) {
    const f = S.figures[p.id];
    if (!f) continue;
    const pose = p.id === S.myId ? S.me : S.poses[p.id];
    const seat = S.seats[p.id];
    const isT = p.id === S.teacherId;
    const standing = p.id === S.myId ? S.standing : S.standingSet[p.id];
    if (S.expelled[p.id]) {
      f.setPos(STOOL.x, STOOL.z, -0.6); f.group.position.y = 0.03; f.sit();
    } else if (!isT && seat != null && S.phase !== 'prep' && !standing) {
      const d = DESKS[seat];
      f.setPos(d.x, d.z + 0.15, Math.PI);
      f.group.position.y = 0.03;
      f.sit();
      const L = S.leanUntil[p.id];
      f.lean(L && t < L.until ? L.dir : 0);
    } else if (pose && pose.x !== undefined) {
      f.group.position.y = 0;
      f.setPos(pose.x, pose.z, pose.yaw || 0);
      if (pose.walk) {
        // gait speed: exact for me, estimated from motion for everyone else,
        // so a stroll ambles and a sprint reads as a run
        let spd;
        if (p.id === S.myId) spd = Math.hypot(S.vx, S.vz);
        else { const lp = S.lastPos[p.id]; spd = lp && dt > 0 ? Math.min(9, Math.hypot(pose.x - lp.x, pose.z - lp.z) / dt) : 3.4; }
        const amp = Math.max(0.7, Math.min(1.5, spd / 3.6));
        S.walkPh[p.id] = (S.walkPh[p.id] || 0) + dt * (5 + spd * 1.15);
        f.walk(S.walkPh[p.id], amp);
      } else f.stand();
      if (p.id !== S.myId) S.lastPos[p.id] = { x: pose.x, z: pose.z };
    }
    f.idle(t); f.tickGesture(t);
  }

  // camera — first person from your own head
  if (S.phase === 'menu' || S.phase === 'lobby' || S.phase === 'results') {
    const a = nowMs / 9000;
    camera.position.set(Math.sin(a) * 9, 4.6, Math.cos(a) * 9);
    camera.lookAt(0, 1.0, -1);
  } else {
    // eye point: where the player's head is
    let hx, hy, hz, roll = 0;
    if (S.expelled[S.myId]) { hx = STOOL.x; hy = 1.42; hz = STOOL.z; }
    else if (canWalk()) {
      const spd = Math.min(1, Math.hypot(S.vx, S.vz) / 3.5);
      hx = S.me.x; hy = 1.42 + Math.sin((S.bobPh || 0) * 2) * 0.021 * spd * (S.tp ? 0 : 1); hz = S.me.z;
      if (!S.tp) roll = Math.sin(S.bobPh || 0) * 0.0045 * spd;
    } else { const d = DESKS[mySeat() ?? 0]; hx = d.x; hy = 1.38; hz = d.z + 0.15; }
    S.headPt.set(hx, hy, hz);
    if (S.tp) {
      // orbit the camera behind and above the head, clamped inside the room
      const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), cp = Math.cos(S.pitch);
      const fwd = new THREE.Vector3(-sy * cp, Math.sin(S.pitch), -cy * cp);
      let dist = 2.9;
      const cx = () => hx - fwd.x * dist, cz = () => hz - fwd.z * dist;
      while (dist > 0.9 && (Math.abs(cx()) > ROOM.x + 0.35 || Math.abs(cz()) > ROOM.z + 0.35)) dist -= 0.2;
      camera.position.set(cx(), hy + 0.55 - fwd.y * dist, cz());
      camera.lookAt(hx, hy + 0.15, hz);
    } else {
      camera.position.set(hx, hy, hz);
      camera.rotation.set(0, 0, 0, 'YXZ');
      camera.rotation.order = 'YXZ';
      camera.rotation.y = S.yaw;
      camera.rotation.x = S.pitch;
      camera.rotation.z = roll;
    }
    computePrompt();
  }

  // note flights
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];
    f.t += dt / 0.9;
    const u = Math.min(f.t, 1);
    f.m.position.lerpVectors(f.a, f.b, u);
    f.m.position.y += Math.sin(u * Math.PI) * 0.9;
    f.m.rotation.x += dt * 9; f.m.rotation.z += dt * 6;
    if (u >= 1) { scene.remove(f.m); f.onLand && f.onLand(); flights.splice(i, 1); }
  }

  // HUD
  if (['prep', 'inspect', 'exam'].includes(S.phase)) {
    const left = Math.max(0, (S.phaseEnds - Date.now()) / 1000);
    $('phaseTimer').textContent = `${(left / 60) | 0}:${String((left % 60) | 0).padStart(2, '0')}`;
    // last 30 seconds of the exam: pulse red + a one-time warning
    const urgent = S.phase === 'exam' && left <= 30 && left > 0;
    $('phaseTimer').classList.toggle('urgent', urgent);
    if (urgent && !S.warned30) { S.warned30 = true; banner('⏰ 30 SECONDS LEFT — fill every answer!', 2600); sfx.bell(); }
  } else { $('phaseTimer').textContent = '–:––'; $('phaseTimer').classList.remove('urgent'); }
  if (isTeacher()) {
    $('authFill').firstElementChild.style.width = S.authority + '%';
    $('inspFill').firstElementChild.style.width = S.inspection + '%';
    $('dutyLine').textContent = S.duty ? (S.duty.kind === 'phone' ? '📞 Answer the phone!' : '🖊 Write on the board!') : '';
  }
  if (room.clockHand) room.clockHand.rotation.z = -t * 0.35;

  // tension chips: "out of seat" reminder + teacher-proximity warning
  const inDanger = !isTeacher() && S.phase === 'exam' && !S.expelled[S.myId] && mySeat() != null;
  $('oos').style.opacity = inDanger && S.standing ? 1 : 0;
  const tp2 = inDanger && S.teacherId !== S.myId ? S.poses[S.teacherId] : null;
  $('tnear').style.opacity = tp2 && Math.hypot(tp2.x - S.me.x, tp2.z - S.me.z) < 3.0 ? 1 : 0;

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- results
let resultTimers = [];
function showResults(data) {
  S.phase = 'results';
  sfx.stopRing();
  document.exitPointerLock && document.exitPointerLock();
  ['viewer', 'scrib', 'help', 'howto'].forEach(i => show(i, false));   // clear any leftover popup
  resultTimers.forEach(clearTimeout); resultTimers = [];
  const iWin = isTeacher() ? !data.pass : data.pass;
  // count the round once, locally, for the menu stats line
  if (!S.roundCounted) { S.roundCounted = true; profile.addRound(iWin); refreshWho(); }

  // the ceremony builds suspense: title + rows reveal one-by-one on a drumroll,
  // scores tick up, then the verdict lands
  $('resultTitle').textContent = '📊 GRADING…';
  $('resultTitle').style.color = '#ffd76a';
  $('avgLine').textContent = 'The teacher is marking the papers…';
  const rows = $('resultsRows'); rows.innerHTML = '';
  ['sheet', 'teachBar', 'crosshair', 'prompt', 'helpTip'].forEach(i => show(i, false));
  show('results', true);

  const list = data.rows;
  list.forEach((r, i) => {
    const d = document.createElement('div');
    d.style.opacity = 0; d.style.transition = 'opacity .3s, transform .3s'; d.style.transform = 'translateY(8px)';
    d.innerHTML = `<span>${r.crown ? '👑 ' : ''}${r.name}${r.id === S.myId ? ' (you)' : ''}</span>
      <span class="val">…</span>`;
    rows.appendChild(d);
    resultTimers.push(setTimeout(() => {
      d.style.opacity = 1; d.style.transform = 'none';
      d.querySelector('.val').textContent = r.expelled ? 'EXPELLED' : Math.round(r.score / N_QUESTIONS * 100) + '%';
      sfx.tap(0.8);
      if (r.crown) sfx.learn();
    }, 500 + i * 500));
  });

  // final verdict after every paper is shown
  resultTimers.push(setTimeout(() => {
    $('resultTitle').textContent = data.pass ? '🎉 THE CLASS PASSES!' : '💀 THE CLASS FAILS!';
    $('resultTitle').style.color = data.pass ? '#8fd39e' : '#e07a6a';
    $('avgLine').textContent =
      (data.reason === 'principal' ? 'The principal fired the teacher! ' :
       data.reason === 'expelled' ? 'Everyone got expelled! ' : '') +
      `Class average: ${Math.round(data.avg * 100)}% (needed ${PASS * 100}%)`;
    (iWin ? sfx.win : sfx.lose).call(sfx);
  }, 600 + list.length * 500));
}

// ---------------------------------------------------------------- boot + test hooks
show('menu', true);
if (P.get('auto') === 'solo') { if (P.get('name')) profile.name = P.get('name'); if (P.get('role') === 'teacher') $('roleTeacher').click(); $('btnSolo').click(); }

window.__game = {
  get S() { return S; },
  get state() {
    return { phase: S.phase, roster: S.roster.length, role: S.myRole, code: S.code,
      answers: S.answers[S.myId], strikes: { ...S.strikes }, expelled: { ...S.expelled },
      authority: S.authority, inspection: S.inspection, traps: S.traps.size, notes: S.notes.size,
      prompt: S.prompt && S.prompt.text, isHost: S.net ? S.net.isHost() : false, country: S.exam && S.exam.country,
      standing: S.standing, notesN: S.notes.size, map: room.mapId, diff: S.diff };
  },
  skipPhase() { if (S.net && S.net.isHost()) S.phaseEnds = 0; },
  look(yaw, pitch) { S.yaw = yaw; S.pitch = pitch || 0; },
  interact() { if (S.prompt) S.prompt.run(); },
  act, accuse: id => S.net.send('accuse', { target: id }),
  answer: (q, a) => setAnswer(q, a),
  teleport: (x, z) => { S.me.x = x; S.me.z = z; },
  plant: (kind, x, z) => S.net.send('trap', { id: 'tr-' + makeId().slice(0, 5), kind, pos: [x, 0, z] }),
  // send a note with real answer marks to a target (test hook)
  throwTo: (pid, marks = []) => {
    const cv = document.createElement('canvas'); cv.width = 180; cv.height = 120;
    const c = cv.getContext('2d'); c.fillStyle = '#f6f1e0'; c.fillRect(0, 0, 180, 120);
    c.fillStyle = '#1c4a2a'; c.font = 'bold 22px system-ui'; c.textAlign = 'center';
    c.fillText(marks.map(m => `Q${m.q + 1}=${LETTERS[m.a]}`).join(' '), 90, 64);
    S.net.send('throw', { id: 'nt-' + makeId().slice(0, 5), to: pid, img: cv.toDataURL('image/png'), marks });
  },
  students: () => students().map(p => ({ id: p.id, name: p.name })),
  toggleSeat,
  tp: () => S.tp,
  eye: () => [S.headPt.x, S.headPt.y, S.headPt.z],
  aimNote: () => { const seat = mySeat(); const n = [...S.notes.values()].find(x => x.desk === seat); return n ? [n.mesh.position.x, n.mesh.position.y, n.mesh.position.z] : null; },
};
