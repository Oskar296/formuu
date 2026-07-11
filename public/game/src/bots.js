// Host-driven bots, speaking through the same event pipe as humans (net.sendAs).
// Student bots wander in prep, plant a trap, then cheat visibly during the exam
// and gain answers up to a per-bot cap so the class hovers near the pass line.
// The teacher bot patrols, does duties, and accuses cheats it can see.

import { DESKS, TEACHER_DESK, BOARD, ROOM } from './classroom.js';
import { N_QUESTIONS } from './exam.js';

export const BOT_NAMES = ['Mia', 'Leo', 'Ava', 'Max', 'Zoe', 'Sam', 'Ivy', 'Kai', 'Nia', 'Ben', 'Uma', 'Rex'];
const BOT_COLORS = ['red', 'blue', 'green', 'pink', 'orange', 'yellow', 'purple', 'brown', 'cyan', 'lime', 'black'];

export function makeBots(count, role, takenColor) {
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const cols = BOT_COLORS.filter(c => c !== takenColor);
  const out = [];
  for (let i = 0; i < count; i++)
    out.push({ id: 'bot-' + Math.random().toString(36).slice(2, 8), name: names[i],
      role, color: cols[i % cols.length], joinedAt: Date.now() + 1 + i, bot: true });
  return out;
}

export class BotBrain {
  constructor(S, net) { this.S = S; this.net = net; this.st = {}; this.t = {}; }

  reset() { this.st = {}; this.tb = null; }

  ensure(id) {
    return this.st[id] || (this.st[id] = {
      nextGain: 2 + Math.random() * 4, nextAct: 3 + Math.random() * 5,
      cap: 4 + (Math.random() * 3 | 0), wander: null, planted: false, poseAt: 0,
      wx: 0, wz: 0,
    });
  }

  tick(now, dt) {
    const S = this.S;
    if (!this.net.isHost() || !S.seats) return;
    for (const p of S.roster) {
      if (!p.bot) continue;
      if (p.role === 'teacher') this.teacher(p, now, dt);
      else this.student(p, now, dt);
    }
  }

  student(p, now, dt) {
    const S = this.S, b = this.ensure(p.id), seat = S.seats[p.id];
    if (seat == null || S.expelled[p.id]) return;
    const d = DESKS[seat];
    if (S.phase === 'prep') {
      // wander, then plant one trap somewhere sensible
      if (b.wx === 0 && b.wz === 0) { b.wx = d.x; b.wz = d.z + 1; }
      if (!b.wander || Math.hypot(b.wander.x - b.wx, b.wander.z - b.wz) < 0.3) {
        b.wander = { x: (Math.random() * 2 - 1) * (ROOM.x - 1), z: (Math.random() * 2 - 1) * (ROOM.z - 1.5) };
        if (!b.planted && Math.random() < 0.5) {
          b.planted = true;
          const kinds = ['marbles', 'glue', 'pepper', 'clock'];
          const kind = kinds[(Math.random() * kinds.length) | 0];
          const px = (Math.random() * 2 - 1) * 3, pz = -3 - Math.random() * 3;
          this.net.sendAs(p.id, 'trap', { id: 'tr-' + Math.random().toString(36).slice(2, 7), kind, pos: [px, 0, pz] });
        }
      }
      const dx = b.wander.x - b.wx, dz = b.wander.z - b.wz, dist = Math.hypot(dx, dz);
      if (dist > 0.05) { b.wx += dx / dist * Math.min(dist, 1.9 * dt); b.wz += dz / dist * Math.min(dist, 1.9 * dt); }
      if (now > b.poseAt) { b.poseAt = now + 0.12; this.net.sendAs(p.id, 'pose', { x: b.wx, z: b.wz, yaw: Math.atan2(dx, dz) + Math.PI, walk: dist > 0.1 ? 1 : 0 }); }
      return;
    }
    if (S.phase !== 'exam') return;
    if (b.roam) { this.roamTick(p, b, now, dt); return; }
    // gain answers over time (successful cheating, abstracted), capped
    const ans = S.answers[p.id] || (S.answers[p.id] = Array(N_QUESTIONS).fill(null));
    b.nextGain -= dt;
    if (b.nextGain <= 0) {
      b.nextGain = 2.5 + Math.random() * 3.5;
      let correct = 0; const missing = [];
      for (let q = 0; q < N_QUESTIONS; q++) (ans[q] === S.exam.questions[q].correct ? correct++ : missing.push(q));
      if (missing.length && correct < b.cap) {
        const q = missing[(Math.random() * missing.length) | 0];
        ans[q] = S.exam.questions[q].correct;
        this.net.sendAs(p.id, 'answers', { filled: ans.slice() });
      }
    }
    // visible, catchable cheats — gives the teacher prey
    b.nextAct -= dt;
    if (b.nextAct <= 0) {
      b.nextAct = 3.5 + Math.random() * 5;
      const roll = Math.random();
      const nb = S.roster.filter(x => x.role === 'student' && x.id !== p.id && S.seats[x.id] != null && !S.expelled[x.id]);
      const target = nb.length ? nb[(Math.random() * nb.length) | 0] : null;
      if (roll < 0.3 && target) this.net.sendAs(p.id, 'act', { type: 'peek', target: target.id });
      else if (roll < 0.5 && target) this.net.sendAs(p.id, 'act', { type: 'flash' });
      else if (roll < 0.62) this.net.sendAs(p.id, 'act', { type: 'signal', n: 1 + (Math.random() * 4 | 0) });
      else if (roll < 0.75 && target) {
        const cv = document.createElement('canvas'); cv.width = 180; cv.height = 120;
        const c = cv.getContext('2d');
        c.fillStyle = '#f6f1e0'; c.fillRect(0, 0, 180, 120);
        c.fillStyle = '#2a2a3a'; c.font = 'bold 60px system-ui'; c.textAlign = 'center';
        c.fillText(['?', 'B!', '3=C', 'idk', ':)'][Math.random() * 5 | 0], 90, 78);
        this.net.sendAs(p.id, 'throw', { id: 'nt-' + Math.random().toString(36).slice(2, 7), to: target.id, img: cv.toDataURL('image/png') });
      }
      else if (roll < 0.82 && target && S.seats[target.id] != null) {
        // leave the seat and sneak over to a classmate's desk
        const td = DESKS[S.seats[target.id]];
        b.wx = d.x; b.wz = d.z + 1.0;
        b.roam = { st: 'go', tx: td.x + (d.x < td.x ? -0.95 : 0.95), tz: td.z + 0.2, victim: target.id };
        this.net.sendAs(p.id, 'act', { type: 'stand' });
      }
      else if (roll < 0.9) this.net.sendAs(p.id, 'act', { type: 'cough' });
      else this.net.sendAs(p.id, 'act', { type: 'tap' });
    }
  }

  // out-of-seat excursion: walk to the victim's desk, peek, hurry back, sit
  roamTick(p, b, now, dt) {
    const S = this.S, r = b.roam, seat = S.seats[p.id], d = DESKS[seat];
    if (S.expelled[p.id]) { b.roam = null; return; }
    const dx = r.tx - b.wx, dz = r.tz - b.wz, dist = Math.hypot(dx, dz);
    if (r.st === 'wait') {
      if (now > r.until) { r.st = 'back'; r.tx = d.x; r.tz = d.z + 0.7; }
    } else if (dist > 0.14) {
      const sp = 2.0 * dt;
      b.wx += dx / dist * Math.min(dist, sp); b.wz += dz / dist * Math.min(dist, sp);
    } else if (r.st === 'go') {
      r.st = 'wait'; r.until = now + 1.4 + Math.random();
      this.net.sendAs(p.id, 'act', { type: 'peek', target: r.victim });
    } else {
      b.roam = null;
      this.net.sendAs(p.id, 'act', { type: 'sit' });
      this.net.sendAs(p.id, 'pose', { x: d.x, z: d.z + 0.15, yaw: Math.PI, walk: 0 });
      return;
    }
    if (now > b.poseAt) {
      b.poseAt = now + 0.12;
      this.net.sendAs(p.id, 'pose', { x: b.wx, z: b.wz, yaw: Math.atan2(dx, dz) + Math.PI, walk: dist > 0.14 ? 1 : 0 });
    }
  }

  teacher(p, now, dt) {
    const S = this.S;
    const tb = this.tb || (this.tb = { x: TEACHER_DESK.x, z: TEACHER_DESK.z + 1.3, yaw: 0, wp: 0, poseAt: 0, busyUntil: 0 });
    const WAY = [
      { x: -4.5, z: -4.5 }, { x: 4.5, z: -4.5 }, { x: 4.5, z: 0 }, { x: -4.5, z: 0 },
      { x: -4.5, z: 4.5 }, { x: 4.5, z: 4.5 }, { x: 0, z: -4 },
    ];
    if (S.phase !== 'exam' && S.phase !== 'inspect') return;
    let goal = WAY[tb.wp];
    // duty handling: walk to it, then complete
    if (S.duty) {
      goal = S.duty.kind === 'phone' ? { x: TEACHER_DESK.x + 1.2, z: TEACHER_DESK.z + 1.2 } : { x: BOARD.x, z: -ROOM.z + 1.2 };
      if (Math.hypot(tb.x - goal.x, tb.z - goal.z) < 0.7) {
        if (!tb.busyUntil) tb.busyUntil = now + 2.2;
        else if (now > tb.busyUntil) { tb.busyUntil = 0; this.net.sendAs(p.id, 'dutyDone', {}); }
        this.pose(p, tb, now, 0); return;
      }
    } else if (Math.hypot(tb.x - goal.x, tb.z - goal.z) < 0.4) tb.wp = (tb.wp + 1) % WAY.length;
    const dx = goal.x - tb.x, dz = goal.z - tb.z, dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      tb.x += dx / dist * Math.min(dist, 2.1 * dt); tb.z += dz / dist * Math.min(dist, 2.1 * dt);
      tb.yaw = Math.atan2(dx, dz) + Math.PI;
    }
    this.pose(p, tb, now, dist > 0.1 ? 1 : 0);
    // accuse: any student with a live cheat in the log, close by, cooldown gated
    if (S.phase === 'exam' && now - S.lastAccuseAt >= S.ACCUSE_CD) {
      for (const q of S.roster) {
        if (q.role !== 'student' || S.expelled[q.id]) continue;
        const seat = S.seats[q.id]; if (seat == null) continue;
        // wanderers are judged where they actually ARE, not at their desk
        const loc = (S.standingSet[q.id] && (q.id === S.myId ? S.me : S.poses[q.id])) || DESKS[seat];
        if (Math.hypot(tb.x - loc.x, tb.z - loc.z) > 3.4) continue;
        const hit = S.cheatLog.some(a => a.pid === q.id && a.until >= now && !a.riot);
        if (hit && Math.random() < 0.55) { this.net.sendAs(p.id, 'accuse', { target: q.id }); break; }
      }
    }
  }

  pose(p, tb, now, walk) {
    if (now > tb.poseAt) { tb.poseAt = now + 0.12; this.net.sendAs(p.id, 'pose', { x: tb.x, z: tb.z, yaw: tb.yaw, walk }); }
  }
}
