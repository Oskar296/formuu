import { LETTERS } from './exam.js';

const $ = id => document.getElementById(id);
const show = (id, v) => $(id).classList.toggle('hidden', !v);

let CB = {};

export function init(cb) {
  CB = cb;
  let role = 'student';
  $('roleStudent').onclick = () => { role = 'student'; $('roleStudent').classList.add('sel'); $('roleTeacher').classList.remove('sel'); };
  $('roleTeacher').onclick = () => { role = 'teacher'; $('roleTeacher').classList.add('sel'); $('roleStudent').classList.remove('sel'); };
  $('btnCreate').onclick = () => CB.onCreate($('nameInput').value.trim() || 'Student', role);
  $('btnJoin').onclick = () => CB.onJoin($('nameInput').value.trim() || 'Student', role, $('codeInput').value.trim().toUpperCase());
  $('btnStart').onclick = () => CB.onStart();
  $('btnAgain').onclick = () => CB.onAgain();
  $('viewerClose').onclick = () => show('viewer', false);
  initScribbler();
}

export function showMenu(netLabel) {
  show('menu', true); show('lobby', false); show('resultsOv', false); show('staffroom', false);
  $('netNote').textContent = netLabel;
}

export function showLobby(code, roster, isHost, canStart, hint) {
  show('menu', false); show('lobby', true); show('resultsOv', false);
  $('roomCodeBig').textContent = code;
  $('roster').innerHTML = '';
  for (const p of roster) {
    const d = document.createElement('div');
    d.innerHTML = `<span>${p.role === 'teacher' ? '🧑‍🏫' : '🙋'} ${esc(p.name)}</span><span class="r">${p.role}</span>`;
    $('roster').appendChild(d);
  }
  $('btnStart').style.display = isHost ? 'block' : 'none';
  $('btnStart').disabled = !canStart;
  $('lobbyHint').textContent = hint;
}

export function hideOverlays() {
  for (const id of ['menu', 'lobby', 'resultsOv', 'staffroom']) show(id, false);
}
export function staffroom(v) { show('staffroom', v); }

export function showResults(title, avgLine, rows) {
  hideOverlays(); show('resultsOv', true);
  $('resultsTitle').textContent = title;
  $('avgLine').innerHTML = avgLine;
  $('resultsRows').innerHTML = '';
  for (const r of rows) {
    const d = document.createElement('div');
    d.innerHTML = `<span>${r.crown ? '👑 ' : ''}${esc(r.name)}${r.expelled ? ' (expelled)' : ''}</span><span class="val">${r.score}</span>`;
    $('resultsRows').appendChild(d);
  }
}

export function setPhase(label) { $('phaseLabel').textContent = label; }
export function setTimer(s) { $('phaseTimer').textContent = s; }

export function toast(text, cls = '') {
  const d = document.createElement('div');
  d.className = 'toast ' + cls;
  d.textContent = text;
  $('toasts').appendChild(d);
  setTimeout(() => d.remove(), 3800);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}

let bannerT = 0;
export function banner(text, dur = 2500) {
  $('banner').textContent = text;
  $('banner').style.opacity = 1;
  clearTimeout(bannerT);
  bannerT = setTimeout(() => { $('banner').style.opacity = 0; }, dur);
}

export function studentHUD(v) { show('sheetPanel', v); show('actionBar', v); }
export function teacherHUD(v) { show('teachBar', v); show('crosshair', v); }
export function prepPanel(v) { show('prepPanel', v); }
export function centerHint(text) { show('centerHint', !!text); if (text) $('centerHint').textContent = text; }
export function riotFlash(v) { $('riotFlash').style.opacity = v ? 1 : 0; }
export function noteCount(n) { $('noteCount').textContent = n ? `📌 notes placed: ${n}` : ''; }

export function fillStudied(knowledge, exam) {
  $('studied').innerHTML = '';
  for (const k of knowledge) {
    const d = document.createElement('div');
    d.innerHTML = `You actually studied — Q${k.q + 1}: <b>${LETTERS[k.a]}</b> (${esc(exam[k.q].options[k.a])})`;
    $('studied').appendChild(d);
  }
}

export function renderSheet(exam, answers, knownQs) {
  const p = $('sheetPanel');
  p.innerHTML = '<h3>📝 FINAL EXAM — SECTION 7B</h3>';
  exam.forEach((q, i) => {
    const d = document.createElement('div');
    d.className = 'q' + (knownQs.includes(i) ? ' studied' : '');
    d.innerHTML = `<div class="qt">Q${i + 1}. ${esc(q.text)}</div>`;
    const opts = document.createElement('div');
    opts.className = 'opts';
    q.options.forEach((o, oi) => {
      const b = document.createElement('button');
      b.textContent = LETTERS[oi];
      b.title = o;
      if (answers[i] === oi) b.classList.add('pick');
      b.onclick = (e) => { e.stopPropagation(); CB.onAnswer(i, oi); };
      opts.appendChild(b);
    });
    d.appendChild(opts);
    p.appendChild(d);
  });
}

export function renderActionBar(actions) {
  const bar = $('actionBar');
  bar.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.id = 'act_' + a.type;
    b.innerHTML = `<b>${a.key}</b>${a.label}`;
    b.onclick = () => CB.onAction(a.type);
    bar.appendChild(b);
  }
}
export function actionBarState(fn) {
  for (const b of $('actionBar').children) {
    const st = fn(b.id.slice(4));
    b.disabled = !!st.disabled;
    b.classList.toggle('busy', !!st.busy);
    b.title = st.tip || '';
  }
}

export function meters(auth, insp) {
  $('authFill').style.width = Math.max(0, auth) + '%';
  $('inspFill').style.width = Math.max(0, insp) + '%';
}
export function duty(text) { $('dutyLabel').textContent = text || ''; }
export function cooldown(text) { $('cdLabel').textContent = text || ''; }
export function strikesHud(lines) { $('strikesHud').innerHTML = lines.map(esc).join('<br>'); }

// ---------------------------------------------------------------- scribbler

let ctx2d, drawing = false, penColor = '#2a2418', erasing = false;
const BG = '#f6f1e0';

function initScribbler() {
  const cv = $('scribCv');
  ctx2d = cv.getContext('2d');
  wipe();
  const pos = e => {
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)];
  };
  cv.addEventListener('pointerdown', e => {
    drawing = true;
    const [x, y] = pos(e);
    ctx2d.beginPath(); ctx2d.moveTo(x, y);
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return;
    const [x, y] = pos(e);
    ctx2d.strokeStyle = erasing ? BG : penColor;
    ctx2d.lineWidth = erasing ? 26 : 4.5;
    ctx2d.lineCap = 'round'; ctx2d.lineJoin = 'round';
    ctx2d.lineTo(x, y); ctx2d.stroke();
  });
  cv.addEventListener('pointerup', () => { drawing = false; });
  const pens = { penDark: '#2a2418', penRed: '#b33a2e', penBlue: '#2e4ab3' };
  for (const id in pens) {
    $(id).onclick = () => {
      erasing = false; penColor = pens[id];
      for (const x of ['penDark', 'penRed', 'penBlue', 'penErase']) $(x).classList.toggle('sel', x === id);
    };
  }
  $('penErase').onclick = () => {
    erasing = true;
    for (const x of ['penDark', 'penRed', 'penBlue', 'penErase']) $(x).classList.toggle('sel', x === 'penErase');
  };
  $('scribClear').onclick = wipe;
}

function wipe() {
  ctx2d.fillStyle = BG;
  ctx2d.fillRect(0, 0, 480, 340);
}

export function openScribbler(title, actions) {
  $('scribTitle').textContent = title;
  const box = $('scribActs');
  box.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.textContent = a.label;
    if (a.main) b.className = 'main';
    b.onclick = () => {
      const img = noteImage();
      show('scrib', false);
      a.fn(img);
    };
    box.appendChild(b);
  }
  const cancel = document.createElement('button');
  cancel.textContent = '✖ never mind';
  cancel.onclick = () => show('scrib', false);
  box.appendChild(cancel);
  wipe();
  show('scrib', true);
}
export function scribblerOpen() { return !$('scrib').classList.contains('hidden'); }
export function closeScribbler() { show('scrib', false); }

export function noteImage() {
  // downscale for the wire
  const small = document.createElement('canvas');
  small.width = 240; small.height = 170;
  small.getContext('2d').drawImage($('scribCv'), 0, 0, 240, 170);
  return small.toDataURL('image/jpeg', 0.72);
}
export function scribbleTestImage(text) {
  // used by automated tests to "write" a note without a mouse
  wipe();
  ctx2d.fillStyle = '#2a2418';
  ctx2d.font = 'bold 44px cursive';
  ctx2d.fillText(text, 30, 120);
  return noteImage();
}

export function viewer(title, img) {
  $('viewerTitle').textContent = title;
  $('viewerImg').src = img;
  show('viewer', true);
}
export function miniView(label, img, dur = 4200) {
  $('miniLabel').textContent = label;
  $('miniImg').src = img;
  show('miniView', true);
  clearTimeout(miniView._t);
  miniView._t = setTimeout(() => show('miniView', false), dur);
}

// a readable snapshot of someone's answer sheet (used by peek / flash)
export function sheetImage(name, answers) {
  const cv = document.createElement('canvas');
  cv.width = 300; cv.height = 330;
  const c = cv.getContext('2d');
  c.fillStyle = BG; c.fillRect(0, 0, 300, 330);
  c.fillStyle = '#6a1f1f';
  c.font = 'bold 17px Georgia';
  c.fillText(`${name}'s paper`, 18, 30);
  c.strokeStyle = '#c9bb92'; c.beginPath(); c.moveTo(14, 42); c.lineTo(286, 42); c.stroke();
  c.font = '22px cursive';
  answers.forEach((a, i) => {
    c.fillStyle = '#3a3020';
    c.fillText(`Q${i + 1}:`, 24, 78 + i * 32);
    c.fillStyle = a == null ? '#b9ac8a' : '#2e4ab3';
    c.fillText(a == null ? '—' : LETTERS[a], 84, 78 + i * 32);
  });
  return cv.toDataURL('image/jpeg', 0.8);
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
