import * as THREE from 'three';
import { buildClassroom, lights, collide, DESKS, TEACHER_DESK, BOARD, STOOL, ROOM, seatAdjacent } from './src/classroom.js';
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfd8e4');
scene.fog = new THREE.Fog('#cfd8e4', 24, 46);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 90);
// the profile stores a HORIZONTAL fov (like Minecraft's wide feel); the
// vertical fov is derived from the window shape so narrow windows and
// phones don't collapse into a zoomed-in tunnel
const DEG = Math.PI / 180;
let fovKick = 0;   // sprinting widens the view a touch
function applyFov() {
  const h = Math.min(150, profile.fovH + fovKick);
  camera.fov = Math.max(45, Math.min(120, 2 * Math.atan(Math.tan(h * DEG / 2) / camera.aspect) / DEG));
  camera.updateProjectionMatrix();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; applyFov(); }
addEventListener('resize', resize); resize();
lights(scene);
const room = buildClassroom(scene);
bakeFigure();

// ---------------------------------------------------------------- state
const S = {
  net: null, myId: null, myRole: 'student', code: '', roster: [],
  phase: 'menu', phaseEnds: 0, seed: 0,
  seats: {}, teacherId: null, exam: null, knowledge: {}, answers: {},
  strikes: {}, expelled: {}, authority: 100, inspection: 100,
  duty: null, nextDutyAt: 0, riotUntil: 0, lastAccuseAt: -99, ACCUSE_CD,
  cheatLog: [], figures: {}, poses: {}, walkPh: {}, leanUntil: {},
  traps: new Map(), notes: new Map(),   // notes: stuck under desks AND landed on desks
  items: new Map(),                     // rare cheat items spawned around the room
  standing: false, standingSet: {}, lastOOS: {}, hasMirror: false, hasCushion: false,
  attach: {}, myTrapUsed: false, myNoteUsed: false,
  me: { x: 4, z: 6, yaw: Math.PI, walk: 0 }, vx: 0, vz: 0, stun: 0, stuck: 0, keys: {},
  yaw: Math.PI, pitch: 0, locked: false,
  hotSel: -1, armedThrow: null, sheetOpen: true,
  poseAt: 0, resultsSent: false, handLure: null, ringingUntil: 0, ringingId: null,
  prompt: null,   // {text, run} — current crosshair action
};
const isTeacher = () => S.myRole === 'teacher';
const students = () => S.roster.filter(p => p.role === 'student');
const nameOf = id => (S.roster.find(p => p.id === id) || {}).name || '???';
const mySeat = () => S.seats[S.myId];
const inRiot = () => now() < S.riotUntil;
const ringing = () => now() < S.ringingUntil;
const bots = new BotBrain(S, null);
const HOT = ['marbles', 'glue', 'pepper', 'clock', 'note'];

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
function viewer(title, img) {
  // free the mouse so the pop-up can actually be closed while pointer-locked
  document.exitPointerLock && document.exitPointerLock();
  $('viewerTitle').textContent = title; $('viewerImg').src = img; $('viewer').classList.remove('hidden');
}
$('viewerClose').onclick = () => $('viewer').classList.add('hidden');
$('viewer').addEventListener('pointerup', e => { if (e.target.id === 'viewer') $('viewer').classList.add('hidden'); });
$('help').addEventListener('pointerup', e => { if (e.target.id === 'help') $('help').classList.add('hidden'); });
const show = (id, v) => $(id).classList.toggle('hidden', !v);
const modalOpen = () => ['viewer', 'scrib', 'help', 'settings'].some(id => !$(id).classList.contains('hidden'));

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
}
{
  let role = 'student';
  $('roleStudent').onclick = () => { role = 'student'; $('roleStudent').classList.add('sel'); $('roleTeacher').classList.remove('sel'); };
  $('roleTeacher').onclick = () => { role = 'teacher'; $('roleTeacher').classList.add('sel'); $('roleStudent').classList.remove('sel'); };
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
  $('setFov').oninput = () => {
    profile.fovH = +$('setFov').value;
    $('fovVal').textContent = profile.fovH;
    applyFov();
  };
  $('btnSettings').onclick = () => {
    $('setName').value = profile.name;
    $('setFov').value = profile.fovH; $('fovVal').textContent = profile.fovH;
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
  S.net.send('start', { seed: +(P.get('seed') || (Math.random() * 1e9 | 0)), seats, teacherId: t[0].id });
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
    for (const tr of S.traps.values())
      if (tr.kind === 'clock' && tr.armed) tr.ringAt = now() + (0.25 + Math.random() * 0.5) * DUR.exam / TSCALE;
    // rare cheat items appear around the room — you must LEAVE YOUR SEAT to grab
    // one (map-specific pools later; the classroom gets all three)
    const spots = [[-6.4, -5.3], [6.4, -2.2], [-6.4, 3.1], [6.4, 5.4], [0, 7.0], [-2.2, -4.8], [3.2, -5.1]]
      .sort(() => Math.random() - 0.5);
    ['mirror', 'scrap', 'cushion'].sort(() => Math.random() - 0.5).forEach((kind, i) =>
      S.net.send('itemSpawn', { id: 'it-' + makeId().slice(0, 5), kind, pos: [spots[i][0], 0, spots[i][1]] }));
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
    if (tr.kind !== 'clock' && tp &&
      Math.hypot(tp.x - tr.pos[0], tp.z - tr.pos[2]) < 0.8) S.net.send('trapFire', { id: tr.id });
    else if (tr.kind === 'clock' && tr.ringAt && t >= tr.ringAt) S.net.send('trapFire', { id: tr.id });
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
function logCheat(pid, kind, img) {
  if (ringing()) return;
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
      if (from === S.myId) { S.myTrapUsed = true; S.hotSel = -1; refreshHotbar(); toast(`${TRAP_ICON[data.kind]} planted`); }
      break;
    }
    case 'stick': {
      if (S.notes.has(data.id)) break;
      const d = DESKS[data.desk];
      S.notes.set(data.id, { ...data, kind: 'stuck', mesh: noteMesh([d.x + 0.45, 0.99, d.deskZ + 0.28], true), owner: from });
      if (from === S.myId) { S.myNoteUsed = true; S.hotSel = -1; refreshHotbar(); toast('📝 note hidden under the desk'); }
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
        S.notes.set(data.id, { id: data.id, img: data.img, desk: targetSeat, kind: 'landed', mesh: noteMesh(pos, false), owner: from });
        if (data.to === S.myId) toast('🗒 a note landed on your desk — look at it', 'gold');
      });
      break;
    }
    case 'attach': {
      (S.attach[from] = S.attach[from] || {})[data.slot] = data.img;
      logCheat(from, data.slot === 'arm' ? 'inking their arm' : 'rigging a bottle');
      if (data.slot === 'arm' && S.figures[from]) S.figures[from].inkArm();   // visible to everyone
      if (data.slot === 'bottle' && S.seats[from] != null) bottleLabel(S.seats[from]);
      if (from === S.myId) toast(data.slot === 'arm' ? '💪 ink dried on your arm' : '🍼 bottle label applied');
      gesture(from, data.slot === 'arm' ? '✍️ scribbles on arm' : '🍼 fiddles with bottle');
      break;
    }
    case 'itemSpawn': {
      if (S.items.has(data.id)) break;
      S.items.set(data.id, { ...data, mesh: itemMesh(data.kind, data.pos) });
      if (!isTeacher() && now() - (S.itemToastAt || 0) > 3) {
        S.itemToastAt = now();
        toast('✨ rare cheat items appeared around the room — leave your seat to grab one', 'gold');
      }
      break;
    }
    case 'itemGet': {   // host adjudicates first-come-first-served
      if (S.net.isHost() && S.items.has(data.id)) S.net.send('itemTaken', { id: data.id, by: from });
      break;
    }
    case 'itemTaken': {
      const it = S.items.get(data.id); if (!it) break;
      scene.remove(it.mesh); S.items.delete(data.id);
      if (data.by === S.myId) {
        sfx.pickup();
        if (it.kind === 'scrap') {   // instantly reveals one answer you don't have
          const mine = S.answers[S.myId] || [];
          const missing = S.exam.questions.filter(q => mine[q.id] !== q.correct);
          if (missing.length) {
            const q = missing[(Math.random() * missing.length) | 0];
            setAnswer(q.id, q.correct);
            toast(`📜 the scrap says: Q${q.id + 1} = ${LETTERS[q.correct]}!`, 'gold');
          } else toast('📜 the scrap tells you nothing new');
        } else if (it.kind === 'mirror') {
          S.hasMirror = true;
          toast('🪞 mirror! peek at ANYONE\'s paper from your seat', 'gold');
        } else {
          S.hasCushion = true;
          toast('💨 whoopee cushion! aim at the floor to hide it', 'gold');
        }
      } else if (!isTeacher()) toast(`${ITEM_ICON[it.kind]} ${nameOf(data.by)} grabbed the ${it.kind}`);
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
        if (isTeacher()) { S.stun = now() + 2.2; banner('💫 MARBLES! WHO PUT MARBLES THERE?!'); }
        else banner(`💫 The teacher slipped on ${who}'s marbles!`);
      } else if (tr.kind === 'glue') {
        sfx.squelch(tv); removeTrap(data.id);
        if (isTeacher()) { S.stuck = now() + 2.6; banner('🍯 YOUR SHOES ARE GLUED DOWN'); }
        else banner(`🍯 The teacher stepped in ${who}'s glue!`);
      } else if (tr.kind === 'pepper') {
        sfx.sneeze(tv); removeTrap(data.id);
        if (isTeacher()) { blind(2.6); banner('🤧 A PEPPER ERASER?! I CANNOT SEE!'); }
        else banner(`🤧 ${who}'s pepper eraser goes off!`);
      } else if (tr.kind === 'clock') {
        S.ringingUntil = now() + 10; S.ringingId = data.id;
        sfx.startRing('clock');
        banner(isTeacher() ? '⏰ WHERE IS THAT RINGING?! Find it!' : '⏰ COVER NOISE — cheat freely!', 3000);
      } else if (tr.kind === 'cushion') {
        sfx.honk(volAt(tr.pos[0], tr.pos[2])); removeTrap(data.id);
        S.ringingUntil = Math.max(S.ringingUntil, now() + 6);   // the class is in stitches — cover noise
        banner(isTeacher() ? '💨 WHO PUT A WHOOPEE CUSHION THERE?!' : `💨 PFFFRT! ${nameOf(tr.owner)}'s cushion — cheat freely!`, 3000);
        sfx.laugh();
      }
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
        if (data.readAloud) { viewer(`📢 CONFISCATED — ${nameOf(n.owner)}'s note, read to the class:`, n.img); sfx.laugh(); }
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
      if (from === S.myId && a.target) viewer(`👀 You peek at ${nameOf(a.target)}'s paper…`, sheetImage(nameOf(a.target), S.answers[a.target]));
      break;
    case 'flash': logCheat(from, 'flashing their sheet');
      if (S.figures[from]) S.figures[from].holdPaper(2.2, now());
      if (from !== S.myId && !isTeacher() && mySeat() != null && S.seats[from] != null && seatAdjacent(S.seats[from], mySeat()))
        viewer(`📄 ${nameOf(from)} flashes their sheet!`, sheetImage(nameOf(from), S.answers[from]));
      break;
    case 'readArm': logCheat(from, 'reading their arm'); gesture(from, '🧐 checks sleeve');
      if (from === S.myId && (S.attach[from] || {}).arm) viewer('💪 Your arm says:', S.attach[from].arm);
      break;
    case 'readBottle': logCheat(from, 'reading a bottle label'); gesture(from, '🥤 loooong sip');
      if (from === S.myId && (S.attach[from] || {}).bottle) viewer('🍼 Your bottle label:', S.attach[from].bottle);
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
  S.exam = generateExam(data.seed);
  S.answers = {}; S.strikes = {}; S.expelled = {}; S.knowledge = {};
  S.authority = 100; S.inspection = 100; S.duty = null; S.riotUntil = 0;
  S.cheatLog = []; S.resultsSent = false; S.attach = {};
  S.myTrapUsed = false; S.myNoteUsed = false; S.lastAccuseAt = -99;
  S.stun = 0; S.stuck = 0; S.ringingId = null; S.ringingUntil = 0;
  S.hotSel = -1; S.armedThrow = null; S.sheetOpen = true;
  S.standing = false; S.standingSet = {}; S.lastOOS = {};
  S.hasMirror = false; S.hasCushion = false; S.vx = 0; S.vz = 0;
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
      fig.setVisible(false);   // first person — you ARE the figure
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
  S.figures = {}; S.poses = {}; S.walkPh = {}; S.leanUntil = {};
  for (const tr of S.traps.values()) scene.remove(tr.mesh);
  for (const n of S.notes.values()) scene.remove(n.mesh);
  for (const it of S.items.values()) scene.remove(it.mesh);
  S.traps.clear(); S.notes.clear(); S.items.clear();
  clearBottleLabels();
  sfx.stopRing();
  if (alsoUI) ['sheet', 'teachBar', 'hotbar', 'crosshair', 'prompt', 'helpTip'].forEach(i => show(i, false));
}
function setPhase(phase, endsAt) {
  S.phase = phase; S.phaseEnds = endsAt;
  show('lobby', false);
  const stud = !isTeacher();
  show('hotbar', phase === 'prep' && stud && mySeat() != null);
  show('sheet', stud && phase === 'exam' && mySeat() != null && S.sheetOpen);
  show('teachBar', isTeacher() && (phase === 'inspect' || phase === 'exam'));
  show('crosshair', true); show('helpTip', true);
  $('phaseLabel').textContent = phase === 'prep' ? 'PREP — RIG THE ROOM' : phase === 'inspect' ? 'INSPECTION' : phase === 'exam' ? 'THE EXAM — DO NOT GET CAUGHT' : phase.toUpperCase();
  if (phase === 'inspect' || phase === 'exam') sfx.bell();
  if (phase === 'exam') {
    banner(S.exam ? `📝 Subject: the Republic of ${S.exam.country}` : '📝 BEGIN!', 3000);
    // the paper starts in your hands — free the mouse so answers are clickable
    if (stud && S.sheetOpen && mySeat() != null) document.exitPointerLock && document.exitPointerLock();
  }
  if (phase === 'prep') banner(stud ? '🛠 RIG THE ROOM — the teacher isn\'t here yet' : '👀 the class is up to something…', 3000);
  refreshHotbar();
}

// ---------------------------------------------------------------- world objects
const TRAP_ICON = { marbles: '🔮', glue: '🍯', pepper: '🌶', clock: '⏰', cushion: '💨' };
const ITEM_ICON = { mirror: '🪞', scrap: '📜', cushion: '💨' };
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
  } else if (kind === 'cushion') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.05, 16), m('#d86a9a', { roughness: 0.7 }));
    b.position.set(pos[0], 0.03, pos[2]); g.add(b);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  return g;
}
// rare item pickups: small props with a glowing halo so they catch your eye
function itemMesh(kind, pos) {
  const g = new THREE.Group();
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
  if (kind === 'mirror') {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), m('#cfe4f2', { metalness: 0.9, roughness: 0.08 }));
    disc.position.y = 0.3; g.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 18), m('#8a6a3a'));
    rim.position.y = 0.3; g.add(rim);
  } else if (kind === 'scrap') {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.16), m('#f2e8b8', { side: THREE.DoubleSide, roughness: 0.95 }));
    p.rotation.x = -0.9; p.position.y = 0.28; g.add(p);
  } else {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 16), m('#d86a9a', { roughness: 0.7 }));
    b.position.y = 0.28; g.add(b);
  }
  for (const ch of g.children) ch.userData.baseY = ch.position.y;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20),
    new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.35, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02; halo.userData.halo = true;
  g.add(halo);
  g.position.set(pos[0], 0, pos[2]);
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
let scribCb = null, drawing = false;
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
  $('scribOk').onclick = () => { const img = cv.toDataURL('image/png'); show('scrib', false); reset(); const cb = scribCb; scribCb = null; cb && cb(img); };
}
function openScribbler(title, cb) {
  document.exitPointerLock && document.exitPointerLock();
  $('scribTitle').textContent = title; scribCb = cb; show('scrib', true);
}

// ---------------------------------------------------------------- hotbar
function refreshHotbar() {
  [...$('hotbar').children].forEach((el, i) => {
    el.classList.toggle('sel', S.hotSel === i);
    el.classList.toggle('used', i < 4 ? S.myTrapUsed : S.myNoteUsed);
  });
}
[...$('hotbar').children].forEach((el, i) => (el.onclick = () => selectHot(i)));
function selectHot(i) {
  if (S.phase !== 'prep') return;
  if ((i < 4 && S.myTrapUsed) || (i === 4 && S.myNoteUsed)) return;
  S.hotSel = S.hotSel === i ? -1 : i;
  refreshHotbar();
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
  S.yaw -= e.movementX * 0.0027;
  S.pitch = Math.max(-1.35, Math.min(1.35, S.pitch - e.movementY * 0.0025));
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
  const k = e.key;
  if (S.phase === 'prep' && !isTeacher() && '12345'.includes(k)) selectHot(+k - 1);
  if (S.phase === 'exam' && !isTeacher() && !S.expelled[S.myId] && mySeat() != null) {
    if (e.code === 'Space') { e.preventDefault(); toggleSeat(); }
    if ('1234'.includes(k)) act('signal', { n: +k });
    if (e.code === 'KeyN') $('scrib').classList.contains('hidden') && openScribbler('✍️ Draw your note — then LOOK at a classmate and click to throw', img => { S.armedThrow = img; toast('🎯 look at a classmate and click'); });
    if (e.code === 'KeyF') act('flash');
    if (e.code === 'KeyT') act('tap');
    if (e.code === 'KeyC') act('cough');
    if (e.code === 'KeyR') act('raise');
    if (e.code === 'KeyV') { if ((S.attach[S.myId] || {}).arm) act('readArm'); else openScribbler('💪 Ink a cheat on your ARM (visible on your body!)', img => S.net.send('attach', { slot: 'arm', img })); }
    if (e.code === 'KeyE' && S.prompt) S.prompt.run();
  } else if (e.code === 'KeyE' && S.prompt) S.prompt.run();
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
    show('sheet', false);
    toast('🪑 you are OUT OF YOUR SEAT — the teacher can accuse you on sight!', 'red');
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
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
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
        const h = ray.intersectObject(n.mesh, true);
        if (h.length && h[0].distance < 3.4) {
          set('📢 CLICK — confiscate the note (read it aloud)', () => S.net.send('noteGone', { id, readAloud: true }));
          break;
        }
      }
    }
  } else if (S.phase === 'prep' && seat != null) {
    if (S.hotSel === 4) {
      const h = ray.intersectObjects(room.surfaces.map(s => s.mesh));
      if (h.length && h[0].distance < 3.2) {
        const desk = room.surfaces.find(s => s.mesh === h[0].object).desk;
        set('📝 CLICK — hide a note under this desk', () => {
          openScribbler('📝 Draw the note to hide under this desk', img => S.net.send('stick', { id: 'nt-' + makeId().slice(0, 5), desk, img }));
        });
      }
    } else if (S.hotSel >= 0) {
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) &&
          Math.abs(hit.x) < ROOM.x && Math.abs(hit.z) < ROOM.z && hit.distanceTo(new THREE.Vector3(S.me.x, 0, S.me.z)) < 4.5) {
        const kind = HOT[S.hotSel];
        set(`${TRAP_ICON[kind]} CLICK — plant ${kind} here`, () => S.net.send('trap', { id: 'tr-' + makeId().slice(0, 5), kind, pos: [hit.x, 0, hit.z] }));
      }
    }
  } else if (S.phase === 'exam' && seat != null && !S.expelled[S.myId]) {
    if (S.armedThrow) {
      for (const p of students()) {
        if (p.id === S.myId || S.expelled[p.id]) continue;
        const f = S.figures[p.id]; if (!f) continue;
        if (ray.intersectObject(f.mesh, true).length) {
          const img = S.armedThrow;
          set(`🗒 CLICK — throw the note to ${p.name}`, () => { S.net.send('throw', { id: 'nt-' + makeId().slice(0, 5), to: p.id, img }); S.armedThrow = null; });
          break;
        }
      }
      if (!S.prompt) set('🎯 aim at a classmate to throw (N redraws)', () => {});
    } else {
      // notes: read yours; while OUT OF YOUR SEAT you can swipe anyone's
      for (const [id, n] of S.notes) {
        const h = ray.intersectObject(n.mesh, true);
        if (!h.length) continue;
        const mine = n.desk === seat;
        if (mine ? h[0].distance > 2.4 : !(S.standing && h[0].distance < 2.2)) continue;
        set(mine ? (n.kind === 'landed' ? '🗒 CLICK — unfold the note' : '🤫 CLICK — read the hidden note')
                 : '🕵️ CLICK — swipe the note off this desk', () => {
          act('readNote');
          viewer(mine ? (n.kind === 'landed' ? `🗒 The note from ${nameOf(n.owner)}:` : '🤫 The note under your desk:')
                      : `🕵️ You swiped ${nameOf(n.owner)}'s note:`, n.img);
          if (n.kind === 'landed' || !mine) S.net.send('noteGone', { id });
        });
        break;
      }
      // a classmate's paper → peek. Adjacent from your seat; ANY desk you walk
      // up to while standing; ANY desk from your seat with the 🪞 mirror
      if (!S.prompt) {
        const h = ray.intersectObjects(room.paperMeshes);
        if (h.length) {
          const deskIdx = room.paperMeshes.indexOf(h[0].object);
          const owner = Object.keys(S.seats).find(pid => S.seats[pid] === deskIdx);
          const dist = h[0].distance;
          if (owner && owner !== S.myId) {
            const near = S.standing ? dist < 2.8 : (seatAdjacent(deskIdx, seat) && dist < 3.4);
            const mirror = !near && !S.standing && S.hasMirror && dist < 14;
            if (near || mirror) {
              const dir = DESKS[deskIdx].x > DESKS[seat].x ? 1 : -1;
              set(`${mirror ? '🪞' : '👀'} CLICK — peek at ${nameOf(owner)}'s paper`, () => act('peek', { target: owner, dir }));
            }
          } else if (deskIdx === seat && !S.standing && dist < 3.4) {
            set('📄 CLICK — ' + (S.sheetOpen ? 'put your paper down (TAB)' : 'pick up your paper (TAB)'),
              () => setSheet(!S.sheetOpen));
          }
        }
      }
      // rare item on the floor → grab it (you'll have to leave your seat…)
      if (!S.prompt) for (const [id, it] of S.items) {
        const h = ray.intersectObject(it.mesh, true);
        if (h.length && h[0].distance < 2.6) {
          set(`${ITEM_ICON[it.kind]} CLICK — grab the ${it.kind}`, () => S.net.send('itemGet', { id }));
          break;
        }
      }
      // carrying the whoopee cushion → hide it on the floor
      if (!S.prompt && S.hasCushion) {
        const hit = new THREE.Vector3();
        if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) &&
            Math.abs(hit.x) < ROOM.x && Math.abs(hit.z) < ROOM.z &&
            hit.distanceTo(new THREE.Vector3(S.me.x, 0, S.me.z)) < 3) {
          set('💨 CLICK — hide the whoopee cushion here', () => {
            S.net.send('trap', { id: 'tr-' + makeId().slice(0, 5), kind: 'cushion', pos: [hit.x, 0, hit.z] });
            S.hasCushion = false;
          });
        }
      }
      // my bottle → rig / read
      if (!S.prompt) {
        const mine = room.bottleMeshes[seat];
        const h = mine ? ray.intersectObject(mine, true) : [];
        if (h.length && h[0].distance < 2.4) {
          if ((S.attach[S.myId] || {}).bottle) set('🍼 CLICK — take a long sip (read the label)', () => act('readBottle'));
          else set('🍼 CLICK — rig your bottle label', () => openScribbler('🍼 Draw your bottle-label cheat', img => S.net.send('attach', { slot: 'bottle', img })));
        }
      }
    }
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
  // sprint FOV kick eases in and out
  const kick = S.sprinting ? 11 : 0;
  if (Math.abs(fovKick - kick) > 0.2) { fovKick += (kick - fovKick) * Math.min(1, dt * 7); applyFov(); }

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
      if (pose.walk) { S.walkPh[p.id] = (S.walkPh[p.id] || 0) + dt * 8.5; f.walk(S.walkPh[p.id]); }
      else f.stand();
    }
    f.idle(t); f.tickGesture(t);
  }

  // camera — first person from your own head
  if (S.phase === 'menu' || S.phase === 'lobby' || S.phase === 'results') {
    const a = nowMs / 9000;
    camera.position.set(Math.sin(a) * 9, 4.6, Math.cos(a) * 9);
    camera.lookAt(0, 1.0, -1);
  } else {
    let ex, ey, ez, roll = 0;
    if (S.expelled[S.myId]) { ex = STOOL.x; ey = 1.42; ez = STOOL.z; }
    else if (canWalk()) {
      // Minecraft-style view bob while moving
      const spd = Math.min(1, Math.hypot(S.vx, S.vz) / 3.5);
      ex = S.me.x; ey = 1.42 + Math.sin((S.bobPh || 0) * 2) * 0.021 * spd; ez = S.me.z;
      roll = Math.sin(S.bobPh || 0) * 0.0045 * spd;
    } else { const d = DESKS[mySeat() ?? 0]; ex = d.x; ey = 1.38; ez = d.z + 0.15; }
    camera.position.set(ex, ey, ez);
    camera.rotation.set(0, 0, 0, 'YXZ');
    camera.rotation.order = 'YXZ';
    camera.rotation.y = S.yaw;
    camera.rotation.x = S.pitch;
    camera.rotation.z = roll;
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
  } else $('phaseTimer').textContent = '–:––';
  if (isTeacher()) {
    $('authFill').firstElementChild.style.width = S.authority + '%';
    $('inspFill').firstElementChild.style.width = S.inspection + '%';
    $('dutyLine').textContent = S.duty ? (S.duty.kind === 'phone' ? '📞 Answer the phone!' : '🖊 Write on the board!') : '';
  }
  if (room.clockHand) room.clockHand.rotation.z = -t * 0.35;

  // item pickups shimmer and slowly spin so they catch the eye
  for (const it of S.items.values()) {
    it.mesh.rotation.y += dt * 1.3;
    for (const ch of it.mesh.children)
      if (!ch.userData.halo) ch.position.y = ch.userData.baseY + Math.sin(t * 2.4 + it.mesh.position.x) * 0.045;
  }

  // tension chips: "out of seat" reminder + teacher-proximity warning
  const inDanger = !isTeacher() && S.phase === 'exam' && !S.expelled[S.myId] && mySeat() != null;
  $('oos').style.opacity = inDanger && S.standing ? 1 : 0;
  const tp2 = inDanger && S.teacherId !== S.myId ? S.poses[S.teacherId] : null;
  $('tnear').style.opacity = tp2 && Math.hypot(tp2.x - S.me.x, tp2.z - S.me.z) < 3.0 ? 1 : 0;

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- results
function showResults(data) {
  S.phase = 'results';
  sfx.stopRing();
  document.exitPointerLock && document.exitPointerLock();
  const iWin = isTeacher() ? !data.pass : data.pass;
  $('resultTitle').textContent = data.pass ? '🎉 THE CLASS PASSES!' : '💀 THE CLASS FAILS!';
  $('avgLine').textContent =
    (data.reason === 'principal' ? 'The principal fired the teacher! ' :
     data.reason === 'expelled' ? 'Everyone got expelled! ' : '') +
    `Class average: ${Math.round(data.avg * 100)}% (needed ${PASS * 100}%)`;
  const rows = $('resultsRows'); rows.innerHTML = '';
  for (const r of data.rows) {
    const d = document.createElement('div');
    d.innerHTML = `<span>${r.crown ? '👑 ' : ''}${r.name}${r.id === S.myId ? ' (you)' : ''}</span>
      <span class="val">${r.expelled ? 'EXPELLED' : Math.round(r.score / N_QUESTIONS * 100) + '%'}</span>`;
    rows.appendChild(d);
  }
  (iWin ? sfx.win : sfx.lose).call(sfx);
  ['sheet', 'teachBar', 'hotbar', 'crosshair', 'prompt', 'helpTip'].forEach(i => show(i, false));
  show('results', true);
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
      standing: S.standing, items: S.items.size, hasMirror: S.hasMirror, hasCushion: S.hasCushion };
  },
  skipPhase() { if (S.net && S.net.isHost()) S.phaseEnds = 0; },
  look(yaw, pitch) { S.yaw = yaw; S.pitch = pitch || 0; },
  interact() { if (S.prompt) S.prompt.run(); },
  act, accuse: id => S.net.send('accuse', { target: id }),
  answer: (q, a) => setAnswer(q, a),
  teleport: (x, z) => { S.me.x = x; S.me.z = z; },
  selectHot,
  plant: (kind, x, z) => S.net.send('trap', { id: 'tr-' + makeId().slice(0, 5), kind, pos: [x, 0, z] }),
  throwTo: (pid, text) => {
    const cv = document.createElement('canvas'); cv.width = 180; cv.height = 120;
    const c = cv.getContext('2d'); c.fillStyle = '#f6f1e0'; c.fillRect(0, 0, 180, 120);
    c.fillStyle = '#222'; c.font = 'bold 44px system-ui'; c.textAlign = 'center'; c.fillText(text, 90, 72);
    S.net.send('throw', { id: 'nt-' + makeId().slice(0, 5), to: pid, img: cv.toDataURL('image/png') });
  },
  students: () => students().map(p => ({ id: p.id, name: p.name })),
  toggleSeat,
  itemsAt: () => [...S.items.values()].map(i => ({ id: i.id, kind: i.kind, pos: i.pos })),
};
