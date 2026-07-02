import { LETTERS } from './exam.js';

const $ = id => document.getElementById(id);
const show = (id, v) => $(id).classList.toggle('hidden', !v);

let CB = {};
let carriersSel = new Set();

export function init(cb) {
  CB = cb;
  let role = 'student';
  $('roleStudent').onclick = () => { role = 'student'; $('roleStudent').classList.add('sel'); $('roleTeacher').classList.remove('sel'); };
  $('roleTeacher').onclick = () => { role = 'teacher'; $('roleTeacher').classList.add('sel'); $('roleStudent').classList.remove('sel'); };
  $('btnCreate').onclick = () => CB.onCreate($('nameInput').value.trim() || 'Student', role);
  $('btnJoin').onclick = () => CB.onJoin($('nameInput').value.trim() || 'Student', role, $('codeInput').value.trim().toUpperCase());
  $('btnStart').onclick = () => CB.onStart();
  $('btnAgain').onclick = () => CB.onAgain();

  for (const [id, kind] of [['cArm', 'arm'], ['cBottle', 'bottle'], ['cStash', 'stash'], ['cGift', 'gift']]) {
    $(id).onclick = () => {
      if (carriersSel.has(kind)) carriersSel.delete(kind);
      else if (carriersSel.size < 2) carriersSel.add(kind);
      $(id).classList.toggle('sel', carriersSel.has(kind));
      $('giftWho').style.display = carriersSel.has('gift') ? 'block' : 'none';
      CB.onPrepChange(getCarriers());
    };
  }
  $('giftWho').onchange = () => CB.onPrepChange(getCarriers());
}

export function getCarriers() {
  return { kinds: [...carriersSel], giftTo: $('giftWho').value || null };
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
export function prepPanel(v) { show('prepPanel', v); if (v) { carriersSel = new Set(); for (const id of ['cArm','cBottle','cStash','cGift']) $(id).classList.remove('sel'); $('giftWho').style.display = 'none'; } }
export function inspectHint(text) { show('inspectHint', !!text); if (text) $('inspectHint').textContent = text; }
export function riotFlash(v) { $('riotFlash').style.opacity = v ? 1 : 0; }

export function fillPrep(knowledge, exam, classmates) {
  $('studied').innerHTML = '';
  for (const k of knowledge) {
    const d = document.createElement('div');
    d.innerHTML = `Q${k.q + 1}: ${esc(exam[k.q].text)} → <b>${LETTERS[k.a]} (${esc(exam[k.q].options[k.a])})</b>`;
    $('studied').appendChild(d);
  }
  $('giftWho').innerHTML = classmates.map(c => `<option value="${c.id}">plant under ${esc(c.name)}'s desk</option>`).join('');
}

export function renderSheet(exam, answers, knownQs, learned, selectedQ) {
  const p = $('sheetPanel');
  p.innerHTML = '<h3>📝 FINAL EXAM — SECTION 7B</h3>';
  exam.forEach((q, i) => {
    const d = document.createElement('div');
    d.className = 'q' + (selectedQ === i ? ' sel' : '') + (knownQs.includes(i) ? ' studied' : '');
    d.innerHTML = `<div class="qt">Q${i + 1}. ${esc(q.text)}</div>`;
    const opts = document.createElement('div');
    opts.className = 'opts';
    q.options.forEach((o, oi) => {
      const b = document.createElement('button');
      b.textContent = LETTERS[oi];
      b.title = o;
      if (answers[i] === oi) b.classList.add('pick');
      if (learned.some(l => l.q === i && l.a === oi)) b.classList.add('known');
      b.onclick = (e) => { e.stopPropagation(); CB.onAnswer(i, oi); };
      opts.appendChild(b);
    });
    d.appendChild(opts);
    d.onclick = () => CB.onSelectQ(i);
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

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
