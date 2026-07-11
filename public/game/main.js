import * as THREE from 'three';
import { buildClassroom, lights, collide, DESKS, TEACHER_DESK, BOARD, STOOL, ROOM, seatAdjacent } from './src/classroom.js';
import { makeFigure, bakeFigure } from './src/figure.js';
import { generateExam, dealKnowledge, score, N_QUESTIONS, LETTERS } from './src/exam.js';
import { makeNet, onlineAvailable, makeId } from './src/net.js';
import { makeBots, BotBrain } from './src/bots.js';
import { profile, SKINS, skinById } from './src/profile.js';
import { sfx } from './src/audio.js';

// THE EXAM — cheat together, don't get caught.
// prep → inspection → exam → grading. Class average ≥ 60% and the students win.

const P = new URLSearchParams(location.search);
const TSCALE = Math.max(0.25, +(P.get('t') || 1));
const DUR = { prep: 60, inspect: 18, exam: 180 };
const CATCH_WINDOW = 5, ACCUSE_CD = 8, PASS = 0.6;
const $ = id => document.getElementById(id);
const now = () => performance.now() / 1000;

// ---------------------------------------------------------------- three
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfd8e4');
scene.fog = new THREE.Fog('#cfd8e4', 24, 46);
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 90);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
lights(scene);
const room = buildClassroom(scene);
bakeFigure();                       // one-time sculpt+skin bake (shared by all)

// ---------------------------------------------------------------- state
const S = {
  net: null, myId: null, myRole: 'student', code: '', roster: [],
  phase: 'menu', phaseEnds: 0, seed: 0,
  seats: {}, teacherId: null, exam: null, knowledge: {}, answers: {},
  strikes: {}, expelled: {}, authority: 100, inspection: 100,
  duty: null, nextDutyAt: 0, riotUntil: 0, lastAccuseAt: -99, ACCUSE_CD,
  cheatLog: [],                 // {pid, until, kind, img?, riot}
  figures: {}, poses: {}, walkPh: {},
  traps: new Map(), notes: new Map(), attach: {}, myTrapUsed: false, myNoteUsed: false,
  me: { x: 4, z: 6, yaw: Math.PI, walk: 0 }, stun: 0, stuck: 0, keys: {},
  camYaw: Math.PI, camPitch: 0.12, aim: null, poseAt: 0, resultsSent: false,
  handLure: null, ringingUntil: 0, ringingId: null,
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
function viewer(title, img) { $('viewerTitle').textContent = title; $('viewerImg').src = img; $('viewer').classList.remove('hidden'); }
$('viewerClose').onclick = () => $('viewer').classList.add('hidden');
const show = (id, v) => $(id).classList.toggle('hidden', !v);

// sheet image (what a peek/flash reveals): the target's current answers
function sheetImage(name, answers) {
  const cv = document.createElement('canvas'); cv.width = 340; cv.height = 300;
  const c = cv.getContext('2d');
  c.fillStyle = '#f6f1e0'; c.fillRect(0, 0, 340, 300);
  c.fillStyle = '#6a1f1f'; c.font = 'bold 20px Georgia'; c.fillText(`${name}'s paper`, 16, 30);
  c.font = '17px system-ui';
  for (let q = 0; q < N_QUESTIONS; q++) {
    const a = answers ? answers[q] : null;
    c.fillStyle = '#4a3f28'; c.fillText(`Q${q + 1}:`, 20, 66 + q * 29);
    c.fillStyle = a == null ? '#b9ac8a' : '#33508c';
    c.font = a == null ? 'italic 16px system-ui' : 'bold 18px system-ui';
    c.fillText(a == null ? '—' : LETTERS[a], 70, 66 + q * 29);
    c.font = '17px system-ui';
  }
  return cv.toDataURL('image/png');
}

// ---------------------------------------------------------------- menu / lobby
{
  let role = 'student';
  $('roleStudent').onclick = () => { role = 'student'; $('roleStudent').classList.add('sel'); $('roleTeacher').classList.remove('sel'); };
  $('roleTeacher').onclick = () => { role = 'teacher'; $('roleTeacher').classList.add('sel'); $('roleStudent').classList.remove('sel'); };
  $('nameInput').value = profile.name;
  $('nameInput').oninput = () => (profile.name = $('nameInput').value);
  $('chalkCount').textContent = profile.chalk;
  $('btnSolo').onclick = () => join('solo', role);
  $('btnCreate').onclick = () => join('create', role);
  $('btnJoin').onclick = () => join('join', role, $('codeInput').value.trim().toUpperCase());
  $('btnStart').onclick = () => hostStart();
  $('btnAgain').onclick = () => { show('results', false); backToLobby(); };
  $('netNote').textContent = onlineAvailable()
    ? 'Online rooms enabled — share the code with friends anywhere.'
    : 'Local mode: rooms work across TABS of this browser. Solo works everywhere.';
  $('btnLocker').onclick = () => { renderLocker(); show('locker', true); };
  $('btnLockerClose').onclick = () => show('locker', false);
  $('soundBtn').onclick = () => ($('soundBtn').textContent = sfx.toggle() ? '🔇' : '🔊');
}
function renderLocker() {
  const g = $('lockerGrid'); g.innerHTML = '';
  for (const sk of SKINS) {
    const owned = profile.owned.includes(sk.id), eq = profile.skin === sk.id;
    const d = document.createElement('div');
    d.className = 'skinCard' + (eq ? ' equipped' : '') + (!owned && profile.chalk < sk.cost ? ' locked' : '');
    d.innerHTML = `<div class="em">${sk.emoji}</div><div class="nm">${sk.name}</div>
      <div class="pr ${owned ? 'own' : ''}">${eq ? 'EQUIPPED' : owned ? 'tap to equip' : '🖍 ' + sk.cost}</div>`;
    d.onclick = () => {
      if (owned) profile.equip(sk.id);
      else if (profile.buy(sk.id)) { profile.equip(sk.id); toast(`${sk.emoji} ${sk.name} unlocked!`, 'gold'); }
      else { toast('Not enough Chalk — play rounds to earn 🖍', 'red'); return; }
      $('chalkCount').textContent = profile.chalk;
      renderLocker();
    };
    g.appendChild(d);
  }
}

async function join(mode, role, code) {
  sfx.resume();
  const name = ($('nameInput').value.trim() || (role === 'teacher' ? 'Teacher' : 'Student')).slice(0, 14);
  profile.name = name;
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
  try { await S.net.join(S.code, { name, role, skin: profile.skin }); }
  catch (e) { toast(e.message, 'red'); return; }
  if (mode === 'solo') {
    S.net.addBots(role === 'teacher' ? makeBots(9, 'student')
      : [...makeBots(1, 'teacher'), ...makeBots(8, 'student')]);
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
    d.innerHTML = `<span>${p.role === 'teacher' ? '🧑‍🏫' : '🙋'} ${p.name}${p.bot ? ' 🤖' : ''}</span><span class="dim">${p.role}</span>`;
    r.appendChild(d);
  }
  const t = S.roster.filter(p => p.role === 'teacher').length, st = students().length;
  const ok = t === 1 && st >= 1 && S.net.isHost();
  $('btnStart').disabled = !ok;
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
  // duties
  if (!S.duty && t >= S.nextDutyAt) {
    S.net.send('duty', { kind: Math.random() < 0.5 ? 'phone' : 'board', deadline: Date.now() + 18000 / TSCALE });
    S.nextDutyAt = t + (26 + Math.random() * 14) / TSCALE;
  }
  if (S.duty && Date.now() > S.duty.deadline) S.net.send('dutyMiss', {});
  // human teacher completes a duty by standing at it
  if (S.duty && S.teacherId && !S.roster.find(p => p.id === S.teacherId)?.bot) {
    const tp = S.poses[S.teacherId];
    if (tp) {
      const g = S.duty.kind === 'phone' ? { x: TEACHER_DESK.x + 1.2, z: TEACHER_DESK.z + 1.2 } : { x: BOARD.x, z: -ROOM.z + 1.2 };
      if (Math.hypot(tp.x - g.x, tp.z - g.z) < 1.0) {
        S.dutyHold = (S.dutyHold || 0) + dt;
        if (S.dutyHold > 1.6) { S.dutyHold = 0; S.net.send('dutyDone', {}); }
      } else S.dutyHold = 0;
    }
  }
  // traps vs the teacher
  const tp = S.poses[S.teacherId];
  for (const tr of S.traps.values()) {
    if (!tr.armed) continue;
    if ((tr.kind === 'marbles' || tr.kind === 'glue' || tr.kind === 'pepper') && tp &&
      Math.hypot(tp.x - tr.pos[0], tp.z - tr.pos[2]) < 0.8) S.net.send('trapFire', { id: tr.id });
    else if (tr.kind === 'clock' && tr.ringAt && t >= tr.ringAt) S.net.send('trapFire', { id: tr.id });
  }
  if (S.ringingId && t > S.ringingUntil) { S.net.send('trapGone', { id: S.ringingId }); }
  // riot recovery
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

// log a catchable cheat (host authoritative via events arriving at host too)
function logCheat(pid, kind, img) {
  if (ringing()) return;                       // the alarm covers everything
  S.cheatLog.push({ pid, kind, img, until: now() + CATCH_WINDOW, riot: inRiot() });
  if (S.cheatLog.length > 300) S.cheatLog.splice(0, 150);
}
const BURST = {};
function logBurst(pid, kind) {                 // taps/coughs: only a burst is accusable
  const k = pid + kind, t = now();
  BURST[k] = (BURST[k] || []).filter(x => x > t - 4); BURST[k].push(t);
  if (BURST[k].length >= 3) logCheat(pid, kind);
}

// ---------------------------------------------------------------- events (one path for all)
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
      const mesh = trapMesh(data.kind, data.pos);
      S.traps.set(data.id, { ...data, mesh, armed: true, owner: from });
      if (from === S.myId) { S.myTrapUsed = true; refreshTray(); toast(`${TRAP_ICON[data.kind]} planted`); }
      break;
    }
    case 'stick': {
      if (S.notes.has(data.id)) break;
      const d = DESKS[data.desk];
      const mesh = noteMesh([d.x + 0.5, 0.99, d.deskZ + 0.3]);
      S.notes.set(data.id, { ...data, mesh, owner: from });
      if (from === S.myId) { S.myNoteUsed = true; refreshTray(); toast('📝 note hidden under the desk'); }
      break;
    }
    case 'throw': {
      sfx.paper();
      logCheat(from, 'throwing a note', data.img);
      flyNote(from, data.to);
      if (data.to === S.myId) setTimeout(() => { viewer(`🗒 A note from ${nameOf(from)} lands on your desk:`, data.img); sfx.paper(); }, 900 / TSCALE);
      gesture(from, '🗒 yeet!');
      break;
    }
    case 'attach': {
      (S.attach[from] = S.attach[from] || {})[data.slot] = data.img;
      logCheat(from, data.slot === 'arm' ? 'inking their arm' : 'rigging a bottle');
      if (from === S.myId) toast(data.slot === 'arm' ? '💪 ink dried on your arm' : '🍼 bottle label applied');
      gesture(from, data.slot === 'arm' ? '✍️ scribbles on arm' : '🍼 fiddles with bottle');
      break;
    }
    case 'accuse': if (S.net.isHost()) hostAccuse(from, data.target); break;
    case 'verdict': handleVerdict(data); break;
    case 'riot': {
      S.riotUntil = data.until / 1000 - (Date.now() / 1000 - now());
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
      if (tr.kind === 'marbles') {
        sfx.crash(); removeTrap(data.id);
        if (isTeacher()) { S.stun = now() + 2.2; banner('💫 MARBLES! WHO PUT MARBLES THERE?!'); }
        else banner(`💫 The teacher slipped on ${who}'s marbles!`);
      } else if (tr.kind === 'glue') {
        sfx.squelch(); removeTrap(data.id);
        if (isTeacher()) { S.stuck = now() + 2.6; banner('🍯 YOUR SHOES ARE GLUED DOWN'); }
        else banner(`🍯 The teacher stepped in ${who}'s glue!`);
      } else if (tr.kind === 'pepper') {
        sfx.sneeze(); removeTrap(data.id);
        if (isTeacher()) { blind(2.6); banner('🤧 A PEPPER ERASER?! I CANNOT SEE!'); }
        else banner(`🤧 ${who}'s pepper eraser goes off!`);
      } else if (tr.kind === 'clock') {
        S.ringingUntil = now() + 10; S.ringingId = data.id;
        sfx.startRing('clock');
        banner(isTeacher() ? '⏰ WHERE IS THAT RINGING?! Click it!' : '⏰ COVER NOISE — cheat freely!', 3000);
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
      if (n) { scene.remove(n.mesh); S.notes.delete(data.id); }
      if (data.readAloud && n) { viewer(`📢 CONFISCATED — ${nameOf(n.owner)}'s hidden note, shown to the class:`, n.img); sfx.laugh(); }
      break;
    }
    case 'results': showResults(data); break;
  }
}

function handleAct(from, a) {
  const t = now();
  switch (a.type) {
    case 'signal': logCheat(from, 'hand signals'); gesture(from, '✋ ' + '☝️'.repeat(a.n)); break;
    case 'peek': logCheat(from, 'peeking'); gesture(from, '👀 leans over');
      if (from === S.myId && a.target) viewer(`👀 You peek at ${nameOf(a.target)}'s paper…`, sheetImage(nameOf(a.target), S.answers[a.target]));
      break;
    case 'flash': logCheat(from, 'flashing their sheet'); gesture(from, '📄 flashes sheet');
      if (from !== S.myId && !isTeacher() && mySeat() != null && S.seats[from] != null && seatAdjacent(S.seats[from], mySeat()))
        viewer(`📄 ${nameOf(from)} flashes their sheet!`, sheetImage(nameOf(from), S.answers[from]));
      break;
    case 'readArm': logCheat(from, 'reading their arm'); gesture(from, '🧐 checks sleeve');
      if (from === S.myId && (S.attach[from] || {}).arm) viewer('💪 Your arm says:', S.attach[from].arm);
      break;
    case 'readBottle': logCheat(from, 'reading a bottle label'); gesture(from, '🥤 loooong sip');
      if (from === S.myId && (S.attach[from] || {}).bottle) viewer('🍼 Your bottle label:', S.attach[from].bottle);
      break;
    case 'readDesk': logCheat(from, 'reading a hidden note'); gesture(from, '🤫 reaches under the desk');
      if (from === S.myId) { const n = [...S.notes.values()].find(x => x.desk === mySeat()); if (n) viewer('🤫 The note under your desk:', n.img); }
      break;
    case 'tap': sfx.tap(); logBurst(from, 'tapping in code'); gesture(from, '👇 tap'); break;
    case 'cough': sfx.cough(); logBurst(from, 'coughing in code'); gesture(from, '😷 KHM!'); break;
    case 'raise': gesture(from, '✋ SIR!'); S.handLure = { pid: from, until: t + 6 };
      if (S.figures[from]) S.figures[from].raiseHand(true), setTimeout(() => S.figures[from] && S.figures[from].raiseHand(false), 2500);
      break;
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
      if (v.target === S.myId) { toast('You were EXPELLED — enjoy the stool of shame', 'red'); rebuildActionUI(); }
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
  for (const pid in S.seats) S.answers[pid] = Array(N_QUESTIONS).fill(null);
  clearRound(false);
  bots.reset();
  // figures for everyone
  for (const p of S.roster) {
    if (!(p.id in S.seats) && p.id !== S.teacherId) continue;
    const sk = skinById(p.skin);
    const fig = makeFigure(scene, {
      color: p.id === S.teacherId ? '#4a4a5a' : sk.color,
      name: p.name, acc: p.id === S.teacherId ? 'glasses' : sk.acc,
      tag: p.id === S.teacherId ? 'rgba(120,30,30,0.6)' : null,
      scale: p.id === S.teacherId ? 1.07 : 1,
    });
    S.figures[p.id] = fig;
    if (p.id === S.teacherId) fig.setPos(TEACHER_DESK.x, TEACHER_DESK.z + 1.3, 0);
    else { const d = DESKS[S.seats[p.id]]; fig.setPos(d.x, d.z + 0.9, Math.PI); }
    if (p.id === S.myId) {
      if (isTeacher()) { S.me.x = TEACHER_DESK.x; S.me.z = TEACHER_DESK.z + 1.3; S.me.yaw = 0; }
      else { const d = DESKS[S.seats[p.id]]; S.me.x = d.x; S.me.z = d.z + 0.9; S.me.yaw = Math.PI; S.camYaw = Math.PI; }
    }
  }
  show('lobby', false); show('menu', false); show('results', false);
  sfx.bell();
  if (S.net.isHost()) setTimeout(() => hostPhase('prep'), 80);
}
function clearRound(alsoUI = true) {
  for (const id in S.figures) S.figures[id].dispose();
  S.figures = {}; S.poses = {}; S.walkPh = {};
  for (const tr of S.traps.values()) scene.remove(tr.mesh);
  for (const n of S.notes.values()) scene.remove(n.mesh);
  S.traps.clear(); S.notes.clear();
  sfx.stopRing();
  if (alsoUI) { show('sheet', false); show('actions', false); show('teachBar', false); show('trapTray', false); show('hintBar', false); }
}
function setPhase(phase, endsAt) {
  S.phase = phase; S.phaseEnds = endsAt;
  show('lobby', false);
  const stud = !isTeacher();
  show('trapTray', phase === 'prep' && stud && mySeat() != null);
  show('sheet', stud && (phase === 'exam') && mySeat() != null);
  show('actions', stud && phase === 'exam' && mySeat() != null && !S.expelled[S.myId]);
  show('teachBar', isTeacher() && (phase === 'inspect' || phase === 'exam'));
  show('hintBar', true);
  $('phaseLabel').textContent = phase === 'prep' ? 'PREP — RIG THE ROOM' : phase === 'inspect' ? 'INSPECTION' : phase === 'exam' ? 'THE EXAM — DO NOT GET CAUGHT' : phase.toUpperCase();
  $('hintBar').textContent =
    phase === 'prep' ? (stud ? 'WASD walk · pick a trap below, click the floor to plant · hide a note under a desk' : 'The class is rigging the room… you walk in soon')
    : phase === 'inspect' ? (stud ? 'Sit tight — the teacher is sweeping the room' : 'WASD walk · CLICK a trap to disarm it before the exam!')
    : (stud ? 'Answer on your sheet · cheat with the buttons · watch the teacher' : 'CLICK a student to ACCUSE (5s window) · do your duties · click ringing clocks');
  if (phase === 'inspect' || phase === 'exam') sfx.bell();
  if (phase === 'exam') banner(S.exam ? `📝 Subject: the Republic of ${S.exam.country}` : '📝 BEGIN!', 3000);
  if (phase === 'prep' && stud) banner('🛠 RIG THE ROOM — the teacher isn\'t here yet', 3000);
  rebuildActionUI();
}

// ---------------------------------------------------------------- meshes for traps/notes
const TRAP_ICON = { marbles: '🔮', glue: '🍯', pepper: '🌶', clock: '⏰' };
function trapMesh(kind, pos) {
  const g = new THREE.Group();
  if (kind === 'marbles') {
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8),
        new THREE.MeshStandardMaterial({ color: ['#c05050', '#5080c0', '#50c080', '#c0a050'][i % 4], roughness: 0.2 }));
      m.position.set(pos[0] + (Math.random() - 0.5) * 0.5, 0.045, pos[2] + (Math.random() - 0.5) * 0.5);
      g.add(m);
    }
  } else if (kind === 'glue') {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20),
      new THREE.MeshStandardMaterial({ color: '#e0b64e', roughness: 0.15, transparent: true, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos[0], 0.02, pos[2]); g.add(m);
  } else if (kind === 'pepper') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.14),
      new THREE.MeshStandardMaterial({ color: '#c04030', roughness: 0.6 }));
    m.position.set(pos[0], 0.05, pos[2]); g.add(m);
  } else if (kind === 'clock') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14),
      new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.4 }));
    m.rotation.x = Math.PI / 2; m.position.set(pos[0], 0.13, pos[2]); g.add(m);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#c0a030', metalness: 0.5, roughness: 0.3 }));
    bell.position.set(pos[0], 0.24, pos[2]); g.add(bell);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.trap = true; } });
  scene.add(g);
  return g;
}
function noteMesh(pos) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16),
    new THREE.MeshStandardMaterial({ color: '#fff8e0', roughness: 0.9, side: THREE.DoubleSide }));
  m.rotation.x = Math.PI / 2; m.position.set(...pos);
  m.userData.note = true;
  scene.add(m);
  return m;
}
function removeTrap(id) { const tr = S.traps.get(id); if (tr) { scene.remove(tr.mesh); S.traps.delete(id); } }
const flights = [];
function flyNote(fromId, toId) {
  const a = S.figures[fromId], b = S.figures[toId];
  if (!a || !b) return;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.19),
    new THREE.MeshStandardMaterial({ color: '#f6f1e0', side: THREE.DoubleSide }));
  scene.add(m);
  flights.push({ m, t: 0, a: a.group.position.clone().setY(1.3), b: b.group.position.clone().setY(1.15) });
}
function gesture(pid, text) {
  const f = S.figures[pid];
  if (f) f.setGesture(text, 2.2, now());
}
function blind(sec) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:60;background:#fff;opacity:.96;transition:opacity .5s';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 600); }, sec * 1000);
}

// ---------------------------------------------------------------- sheet + actions
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
    full.style.cssText = 'font-size:11px;opacity:.75;margin-top:2px';
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
let answersDirty = 0;
function setAnswer(q, a, sync = true) {
  if (S.expelled[S.myId]) return;
  (S.answers[S.myId] = S.answers[S.myId] || Array(N_QUESTIONS).fill(null))[q] = a;
  refreshSheet();
  if (sync) answersDirty = now() + 0.4;
}

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
function openScribbler(title, cb) { $('scribTitle').textContent = title; scribCb = cb; show('scrib', true); }

let throwArmed = null;   // dataURL waiting for a target click
function rebuildActionUI() {
  const canAct = !isTeacher() && S.phase === 'exam' && mySeat() != null && !S.expelled[S.myId];
  show('actions', canAct);
  if (!canAct) return;
  const deskNote = [...S.notes.values()].some(n => n.desk === mySeat());
  $('actArm').classList.toggle('hot', !!(S.attach[S.myId] || {}).arm);
  $('actBottle').classList.toggle('hot', !!(S.attach[S.myId] || {}).bottle);
  $('actPeek').disabled = false;
  let deskBtn = $('actDesk');
  if (deskNote && !deskBtn) {
    deskBtn = document.createElement('button'); deskBtn.id = 'actDesk'; deskBtn.textContent = '🤫 Desk note';
    deskBtn.onclick = () => act('readDesk');
    $('actions').appendChild(deskBtn);
  }
}
function act(type, extra = {}) {
  if (isTeacher() || S.phase !== 'exam' || S.expelled[S.myId]) return;
  S.net.send('act', { type, ...extra });
}
{
  $('actWrite').onclick = () => openScribbler('✍️ Draw your note, then CLICK a classmate to throw it', img => { throwArmed = img; toast('🎯 click a classmate to throw'); });
  for (const n of [1, 2, 3, 4]) $('actSig' + n).onclick = () => act('signal', { n });
  $('actTap').onclick = () => act('tap');
  $('actCough').onclick = () => act('cough');
  $('actPeek').onclick = () => {
    const s = mySeat();
    const nb = students().find(p => p.id !== S.myId && S.seats[p.id] != null && seatAdjacent(S.seats[p.id], s));
    if (nb) act('peek', { target: nb.id }); else toast('no neighbour close enough');
  };
  $('actFlash').onclick = () => act('flash');
  $('actArm').onclick = () => {
    if ((S.attach[S.myId] || {}).arm) act('readArm');
    else openScribbler('💪 Ink a cheat on your ARM (readable all round)', img => S.net.send('attach', { slot: 'arm', img }));
  };
  $('actBottle').onclick = () => {
    if ((S.attach[S.myId] || {}).bottle) act('readBottle');
    else openScribbler('🍼 Rig your BOTTLE label', img => S.net.send('attach', { slot: 'bottle', img }));
  };
  $('actRaise').onclick = () => act('raise');
  addEventListener('keydown', e => {
    if (S.phase !== 'exam' || isTeacher()) return;
    const k = e.key.toLowerCase();
    if (k === 'n') $('actWrite').click();
    if (k === 't') act('tap'); if (k === 'c') act('cough');
    if (k === 'e') $('actPeek').click(); if (k === 'f') act('flash');
    if (k === 'v') $('actArm').click(); if (k === 'b') $('actBottle').click();
    if (k === 'r') act('raise');
    if ('1234'.includes(e.key)) act('signal', { n: +e.key });
  });
}

// trap tray
let selTrap = null;
function refreshTray() {
  [...$('trapTray').children].forEach(b => {
    const kind = b.dataset.trap;
    b.classList.toggle('sel', selTrap === kind);
    b.disabled = kind === 'note' ? S.myNoteUsed : S.myTrapUsed;
  });
}
[...$('trapTray').children].forEach(b => (b.onclick = () => {
  selTrap = b.dataset.trap === selTrap ? null : b.dataset.trap;
  refreshTray();
  if (selTrap === 'note') toast('draw the note, then click a desk to hide it');
  else if (selTrap) toast('click the floor to plant it');
}));

// ---------------------------------------------------------------- input: movement + clicks
addEventListener('keydown', e => (S.keys[e.code] = true));
addEventListener('keyup', e => (S.keys[e.code] = false));
let dragX = null, dragged = false;
addEventListener('pointerdown', e => { if (e.target.tagName === 'CANVAS' && e.target.id === 'c') { dragX = [e.clientX, e.clientY]; dragged = false; } });
addEventListener('pointermove', e => {
  if (!dragX) return;
  const dx = e.clientX - dragX[0], dy = e.clientY - dragX[1];
  if (Math.abs(dx) + Math.abs(dy) > 6) dragged = true;
  if (dragged) {
    S.camYaw -= dx * 0.006;
    S.camPitch = Math.max(-0.25, Math.min(0.9, S.camPitch + dy * 0.004));
    dragX = [e.clientX, e.clientY];
  }
});
addEventListener('pointerup', e => {
  const wasDrag = dragged; dragX = null;
  if (wasDrag || e.target.id !== 'c') return;
  handleClick(e);
});
const ray = new THREE.Raycaster();
function handleClick(e) {
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // teacher: accuse figures / disarm traps / silence clocks
  if (isTeacher() && (S.phase === 'exam' || S.phase === 'inspect')) {
    const trapHits = [];
    for (const [id, tr] of S.traps) {
      const hit = ray.intersectObject(tr.mesh, true);
      if (hit.length) trapHits.push([hit[0].distance, id]);
    }
    trapHits.sort((a, b) => a[0] - b[0]);
    if (trapHits.length) {
      const [, id] = trapHits[0];
      const tr = S.traps.get(id);
      const tp = S.me;
      if (Math.hypot(tp.x - tr.pos[0], tp.z - tr.pos[2]) < 3.2) { S.net.send('trapGone', { id, disarmed: true }); return; }
    }
    const noteHits = [];
    for (const [id, n] of S.notes) { const h = ray.intersectObject(n.mesh, true); if (h.length) noteHits.push([h[0].distance, id]); }
    noteHits.sort((a, b) => a[0] - b[0]);
    if (noteHits.length && S.phase === 'inspect') { S.net.send('noteGone', { id: noteHits[0][1], readAloud: true }); return; }
    if (S.phase === 'exam') {
      for (const p of students()) {
        const f = S.figures[p.id];
        if (!f || S.expelled[p.id]) continue;
        if (ray.intersectObject(f.mesh, true).length) {
          const cd = ACCUSE_CD - (now() - S.lastAccuseAt);
          if (cd > 0) { toast(`accuse ready in ${cd.toFixed(1)}s`, 'red'); return; }
          S.net.send('accuse', { target: p.id }); return;
        }
      }
    }
    return;
  }
  // student, prep: plant selected trap / stick note
  if (!isTeacher() && S.phase === 'prep' && selTrap) {
    if (selTrap === 'note') {
      const hits = ray.intersectObjects(room.surfaces.map(s => s.mesh));
      if (hits.length) {
        const desk = room.surfaces.find(s => s.mesh === hits[0].object).desk;
        openScribbler('📝 Draw the note you\'ll hide under this desk', img => {
          S.net.send('stick', { id: 'nt-' + makeId().slice(0, 5), desk, img });
        });
        selTrap = null; refreshTray();
      }
      return;
    }
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
      if (Math.abs(hit.x) < ROOM.x && Math.abs(hit.z) < ROOM.z) {
        S.net.send('trap', { id: 'tr-' + makeId().slice(0, 5), kind: selTrap, pos: [hit.x, 0, hit.z] });
        selTrap = null; refreshTray();
      }
    }
    return;
  }
  // student, exam: armed note throw → click a classmate
  if (!isTeacher() && S.phase === 'exam' && throwArmed) {
    for (const p of students()) {
      if (p.id === S.myId || S.expelled[p.id]) continue;
      const f = S.figures[p.id];
      if (f && ray.intersectObject(f.mesh, true).length) {
        S.net.send('throw', { to: p.id, img: throwArmed });
        throwArmed = null;
        return;
      }
    }
    toast('tap directly on a classmate', 'red');
  }
}

// ---------------------------------------------------------------- cameras + frame loop
function canWalk() {
  if (isTeacher()) return ['prep', 'inspect', 'exam'].includes(S.phase);
  return S.phase === 'prep';
}
let last = performance.now();
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min((nowMs - last) / 1000, 0.05) * TSCALE;
  last = nowMs;
  const t = now();

  hostTick(dt);
  if (answersDirty && t > answersDirty) { answersDirty = 0; S.net && S.net.send('answers', { filled: S.answers[S.myId] }); }

  // my movement
  if (S.net && canWalk() && !S.expelled[S.myId] && t > S.stun && t > S.stuck) {
    const sp = (isTeacher() ? 3.2 : 2.9) * dt;
    let mx = 0, mz = 0;
    const fy = S.camYaw;
    if (S.keys.KeyW || S.keys.ArrowUp) { mx -= Math.sin(fy) * sp; mz -= Math.cos(fy) * sp; }
    if (S.keys.KeyS || S.keys.ArrowDown) { mx += Math.sin(fy) * sp; mz += Math.cos(fy) * sp; }
    if (S.keys.KeyA || S.keys.ArrowLeft) { mx -= Math.cos(fy) * sp; mz += Math.sin(fy) * sp; }
    if (S.keys.KeyD || S.keys.ArrowRight) { mx += Math.cos(fy) * sp; mz -= Math.sin(fy) * sp; }
    const moving = mx || mz;
    if (moving) {
      S.me.x += mx; S.me.z += mz;
      const p = { x: S.me.x, z: S.me.z }; collide(p); S.me.x = p.x; S.me.z = p.z;
      S.me.yaw = Math.atan2(-mx, -mz);
    }
    S.me.walk = moving ? 1 : 0;
    if (t > S.poseAt) { S.poseAt = t + 0.11; S.net.send('pose', { x: S.me.x, z: S.me.z, yaw: S.me.yaw, walk: S.me.walk }); }
  } else if (S.net && S.phase === 'exam' && !isTeacher() && t > S.poseAt) {
    S.poseAt = t + 0.3; S.net.send('pose', { seated: 1 });
  }

  // figures follow poses
  for (const p of (S.roster || [])) {
    const f = S.figures[p.id];
    if (!f) continue;
    const pose = p.id === S.myId ? { x: S.me.x, z: S.me.z, yaw: S.me.yaw, walk: S.me.walk } : S.poses[p.id];
    const seat = S.seats[p.id];
    const isT = p.id === S.teacherId;
    if (S.expelled[p.id]) {
      f.setPos(STOOL.x, STOOL.z, -0.6);
      f.group.position.y = 0.35; f.sit();
    } else if (!isT && seat != null && (S.phase === 'exam' || S.phase === 'inspect' || (S.phase === 'prep' && isTeacher() && false))) {
      const d = DESKS[seat];
      f.setPos(d.x, d.z + 0.15, Math.PI);
      f.group.position.y = 0.34;               // sitting on the chair
      f.sit();
    } else if (pose && pose.x !== undefined) {
      f.group.position.y = 0;
      f.setPos(pose.x, pose.z, pose.yaw || 0);
      if (pose.walk) { S.walkPh[p.id] = (S.walkPh[p.id] || 0) + dt * 7; f.walk(S.walkPh[p.id]); }
      else f.stand();
    }
    f.idle(t); f.tickGesture(t);
  }

  // camera
  if (S.phase === 'menu' || S.phase === 'lobby' || S.phase === 'results') {
    const a = nowMs / 9000;
    camera.position.set(Math.sin(a) * 9, 4.6, Math.cos(a) * 9);
    camera.lookAt(0, 1.0, -1);
  } else if (canWalk() && !S.expelled[S.myId]) {
    const cx = S.me.x + Math.sin(S.camYaw) * 3.4, cz = S.me.z + Math.cos(S.camYaw) * 3.4;
    camera.position.lerp(new THREE.Vector3(cx, 2.1 + S.camPitch * 2.4, cz), 0.16);
    camera.lookAt(S.me.x, 1.15, S.me.z);
  } else if (S.expelled[S.myId]) {
    camera.position.lerp(new THREE.Vector3(STOOL.x - 2.4, 2.6, STOOL.z + 2.4), 0.1);
    camera.lookAt(0, 1, 0);
  } else {
    // seated at my desk: over-the-shoulder toward the board
    const s = mySeat();
    if (s != null) {
      const d = DESKS[s];
      const cx = d.x + Math.sin(S.camYaw) * 2.6, cz = d.z + 0.15 + Math.cos(S.camYaw) * 2.6;
      camera.position.lerp(new THREE.Vector3(cx, 2.0 + S.camPitch * 2.0, cz), 0.16);
      camera.lookAt(d.x - Math.sin(S.camYaw) * 2, 1.1, d.z - Math.cos(S.camYaw) * 2);
    }
  }

  // flights
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];
    f.t += dt / 0.9;
    const u = Math.min(f.t, 1);
    f.m.position.lerpVectors(f.a, f.b, u);
    f.m.position.y += Math.sin(u * Math.PI) * 0.9;
    f.m.rotation.x += dt * 9; f.m.rotation.z += dt * 6;
    if (u >= 1) { scene.remove(f.m); flights.splice(i, 1); }
  }

  // HUD tick
  if (['prep', 'inspect', 'exam'].includes(S.phase)) {
    const left = Math.max(0, (S.phaseEnds - Date.now()) / 1000);
    $('phaseTimer').textContent = `${(left / 60) | 0}:${String((left % 60) | 0).padStart(2, '0')}`;
  } else $('phaseTimer').textContent = '–:––';
  if (isTeacher()) {
    $('authFill').firstElementChild.style.width = S.authority + '%';
    $('inspFill').firstElementChild.style.width = S.inspection + '%';
    $('dutyLine').textContent = S.duty ? (S.duty.kind === 'phone' ? '📞 Answer the phone!' : '🖊 Write on the board!') : '';
    const cd = ACCUSE_CD - (t - S.lastAccuseAt);
    $('accuseLine').textContent = S.phase === 'exam' ? (cd > 0 ? `🫵 accuse in ${cd.toFixed(1)}s` : '🫵 CLICK a student to accuse') : 'sweep the room — click traps/notes';
    $('strikeList').innerHTML = students().map(p => `${p.name}: ${'⚠️'.repeat(S.strikes[p.id] || 0) || '—'}${S.expelled[p.id] ? ' 💀' : ''}`).join('<br>');
  }
  if (room.clockHand) room.clockHand.rotation.z = -t * 0.35;

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- results
function showResults(data) {
  S.phase = 'results';
  sfx.stopRing();
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
  let earn = 30 + (iWin ? 40 : 0);
  const me = data.rows.find(r => r.id === S.myId);
  if (me && me.crown) earn += 25;
  profile.earn(earn);
  $('chalkCount').textContent = profile.chalk;
  setTimeout(() => toast(`🖍 +${earn} Chalk earned!`, 'gold'), 600);
  (iWin ? sfx.win : sfx.lose).call(sfx);
  show('sheet', false); show('actions', false); show('teachBar', false); show('trapTray', false); show('hintBar', false);
  show('results', true);
}

// ---------------------------------------------------------------- boot + test hooks
show('menu', true);
if (P.get('auto') === 'solo') { $('nameInput').value = P.get('name') || 'Tester'; if (P.get('role') === 'teacher') $('roleTeacher').click(); $('btnSolo').click(); }

window.__game = {
  get S() { return S; },
  get state() {
    return { phase: S.phase, roster: S.roster.length, role: S.myRole, code: S.code,
      answers: S.answers[S.myId], strikes: { ...S.strikes }, expelled: { ...S.expelled },
      authority: S.authority, inspection: S.inspection, traps: S.traps.size, notes: S.notes.size,
      isHost: S.net ? S.net.isHost() : false, country: S.exam && S.exam.country };
  },
  skipPhase() { if (S.net && S.net.isHost()) { S.phaseEnds = 0; } },
  act, accuse: id => S.net.send('accuse', { target: id }),
  answer: (q, a) => setAnswer(q, a),
  teleport: (x, z) => { S.me.x = x; S.me.z = z; },
  plant: (kind, x, z) => S.net.send('trap', { id: 'tr-' + makeId().slice(0, 5), kind, pos: [x, 0, z] }),
  throwTo: (pid, text) => {
    const cv = document.createElement('canvas'); cv.width = 180; cv.height = 120;
    const c = cv.getContext('2d'); c.fillStyle = '#f6f1e0'; c.fillRect(0, 0, 180, 120);
    c.fillStyle = '#222'; c.font = 'bold 44px system-ui'; c.textAlign = 'center'; c.fillText(text, 90, 72);
    S.net.send('throw', { to: pid, img: cv.toDataURL('image/png') });
  },
  students: () => students().map(p => ({ id: p.id, name: p.name })),
};
