import * as THREE from 'three';

// Classroom layout (meters). Students face -z toward the blackboard.
export const DESKS = [];
for (let r = 0; r < 3; r++)
  for (let c = 0; c < 3; c++)
    DESKS.push({ x: (c - 1) * 4, z: -1 + r * 3, row: r, col: c });

export const seatAdjacent = (a, b) => {
  const A = DESKS[a], B = DESKS[b];
  return Math.abs(A.row - B.row) + Math.abs(A.col - B.col) === 1;
};

export const BOARD_ZONE = { x: 0, z: -6.6, r: 2.6 };       // teacher writes here
export const TEACHER_DESK = { x: 6.8, z: -5.6, r: 2.2 };   // phone lives here
export const STOOL = { x: -7.6, z: -5.6 };                 // shame stool
export const ROOM = { x: 11, z: 8 };                       // half-extents

export const SHIRTS = ['#e05d4e', '#4e86c7', '#5da85e', '#c7a94e', '#9a6bc9',
  '#4ec7b7', '#c75e9a', '#8a9a4e', '#c77e4e'];

const mats = new Map();
const mat = (c, o = {}) => {
  const k = c + JSON.stringify(o);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o }));
  return mats.get(k);
};

function box(scene, w, h, d, c, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.material || mat(c));
  m.position.set(x, y, z);
  m.castShadow = !opts.noShadow; m.receiveShadow = true;
  scene.add(m);
  return m;
}

function textSprite(text, { size = 42, w = 512, h = 128, bg = null, fg = '#fff' } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, 26); ctx.fill();
  }
  ctx.fillStyle = fg;
  ctx.font = `bold ${size}px 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(1.9 * (w / 512), 1.9 * (h / 512) * (512 / 128) * 0.25, 1);
  return sp;
}

export function buildRoom(scene) {
  scene.background = new THREE.Color('#20242e');
  scene.add(new THREE.HemisphereLight('#e8ecff', '#4a4238', 1.0));
  scene.add(new THREE.AmbientLight('#b8b2c4', 0.45));
  const sun = new THREE.DirectionalLight('#ffeecc', 1.4);
  sun.position.set(14, 12, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
  scene.add(sun);

  // floor / ceiling / walls
  const floor = box(scene, ROOM.x * 2, 0.2, ROOM.z * 2, '#9a7a52', 0, -0.1, 0, { noShadow: true });
  floor.material = mat('#9a7a52');
  box(scene, ROOM.x * 2, 0.2, ROOM.z * 2, '#ded9cc', 0, 4.4, 0, { noShadow: true });
  box(scene, ROOM.x * 2, 4.4, 0.3, '#cfe3d2', 0, 2.2, -ROOM.z, { noShadow: true }); // board wall
  box(scene, ROOM.x * 2, 4.4, 0.3, '#e3decf', 0, 2.2, ROOM.z, { noShadow: true });
  box(scene, 0.3, 4.4, ROOM.z * 2, '#e3decf', -ROOM.x, 2.2, 0, { noShadow: true });
  box(scene, 0.3, 4.4, ROOM.z * 2, '#e3decf', ROOM.x, 2.2, 0, { noShadow: true });

  // blackboard + chalk tray
  box(scene, 7, 2.2, 0.1, '#2e4a38', 0, 2.2, -ROOM.z + 0.25, { noShadow: true });
  const chalkText = textSprite('EXAM — EYES ON YOUR OWN PAPER', { size: 30, w: 1024, bg: null, fg: '#cfe3d2' });
  chalkText.position.set(0, 2.7, -ROOM.z + 0.4);
  chalkText.scale.set(6, 0.8, 1);
  scene.add(chalkText);
  box(scene, 7, 0.12, 0.3, '#7a5c3a', 0, 1.05, -ROOM.z + 0.35);

  // windows (right wall) — glowing panes
  for (const wz of [-4, 0, 4]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(3, 2),
      new THREE.MeshBasicMaterial({ color: '#fdf3d8' }));
    pane.position.set(ROOM.x - 0.16, 2.4, wz);
    pane.rotation.y = -Math.PI / 2;
    scene.add(pane);
  }
  // door (left wall)
  box(scene, 0.12, 3, 1.4, '#7a5c3a', -ROOM.x + 0.2, 1.5, -5.5);

  // teacher desk + phone + stool
  box(scene, 2.6, 0.12, 1.3, '#6f4526', TEACHER_DESK.x, 0.95, TEACHER_DESK.z);
  box(scene, 2.4, 0.85, 1.1, '#7d5230', TEACHER_DESK.x, 0.46, TEACHER_DESK.z);
  const phone = box(scene, 0.4, 0.18, 0.28, '#b33', TEACHER_DESK.x - 0.8, 1.1, TEACHER_DESK.z - 0.3);
  box(scene, 0.5, 0.7, 0.5, '#8a6a44', STOOL.x, 0.35, STOOL.z);

  // student desks + chairs + papers + bottles
  const deskMeshes = [];
  DESKS.forEach((d, i) => {
    const top = box(scene, 1.5, 0.09, 0.95, '#a97a4e', d.x, 0.78, d.z);
    top.userData.seat = i;
    for (const [lx, lz] of [[-0.65, -0.38], [0.65, -0.38], [-0.65, 0.38], [0.65, 0.38]])
      box(scene, 0.09, 0.75, 0.09, '#6f4526', d.x + lx, 0.39, d.z + lz);
    box(scene, 1.0, 0.08, 0.9, '#8a6a44', d.x, 0.5, d.z + 1.05);            // chair seat
    box(scene, 1.0, 0.9, 0.08, '#8a6a44', d.x, 0.95, d.z + 1.48);           // chair back
    box(scene, 0.62, 0.02, 0.85, '#f2efe4', d.x - 0.2, 0.83, d.z, { noShadow: true }); // paper
    const bottle = box(scene, 0.14, 0.4, 0.14, '#5db0d6', d.x + 0.55, 1.02, d.z - 0.25);
    bottle.userData.bottleSeat = i;
    deskMeshes.push(top);
  });

  return { deskMeshes, phone };
}

// ---- avatars ------------------------------------------------------------

export function makeStudent(scene, seat, colorIdx, name) {
  const d = DESKS[seat];
  const g = new THREE.Group();
  g.position.set(d.x, 0, d.z + 0.95);
  const body = box(g, 0.62, 0.75, 0.4, SHIRTS[colorIdx % SHIRTS.length], 0, 0.85, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), mat('#e8c39e'));
  head.position.set(0, 1.5, 0); head.castShadow = true;
  g.add(head);
  const tag = textSprite(name, { size: 44, bg: 'rgba(10,10,20,0.55)' });
  tag.position.set(0, 2.15, 0);
  g.add(tag);
  const gesture = { sprite: null, until: 0 };
  scene.add(g);

  return {
    group: g, head, body, seat,
    setLean(l) { g.position.x = d.x + l * 0.55; g.rotation.z = -l * 0.18; },
    setGesture(text, dur, now, bg = 'rgba(30,60,140,0.85)') {
      if (gesture.sprite) g.remove(gesture.sprite);
      gesture.sprite = textSprite(text, { size: 52, bg });
      gesture.sprite.position.set(0, 2.6, 0);
      g.add(gesture.sprite);
      gesture.until = now + dur;
    },
    tick(now) {
      if (gesture.sprite && now > gesture.until) { g.remove(gesture.sprite); gesture.sprite = null; }
    },
    moveToStool() {
      g.position.set(STOOL.x, 0, STOOL.z + 0.1);
      g.rotation.y = Math.PI * 0.15;
    },
    setVisible(v) { g.visible = v; },
  };
}

export function makeTeacher(scene, name) {
  const g = new THREE.Group();
  const body = box(g, 0.7, 1.15, 0.42, '#4a4a5c', 0, 1.0, 0);
  box(g, 0.12, 0.5, 0.05, '#a33', 0, 1.25, -0.22); // tie
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), mat('#e8c39e'));
  head.position.set(0, 1.85, 0); head.castShadow = true;
  g.add(head);
  box(g, 0.8, 0.1, 0.5, '#3a3a48', 0, 1.62, 0); // stern shoulders
  const tag = textSprite('🧑‍🏫 ' + name, { size: 44, bg: 'rgba(120,30,30,0.7)' });
  tag.position.set(0, 2.5, 0);
  g.add(tag);
  const gesture = { sprite: null, until: 0 };
  g.position.set(0, 0, -5.5);
  scene.add(g);
  return {
    group: g, head, body,
    setPose(x, z, yaw) { g.position.x = x; g.position.z = z; g.rotation.y = yaw; },
    setGesture(text, dur, now, bg = 'rgba(120,30,30,0.85)') {
      if (gesture.sprite) g.remove(gesture.sprite);
      gesture.sprite = textSprite(text, { size: 52, bg });
      gesture.sprite.position.set(0, 2.95, 0);
      g.add(gesture.sprite);
      gesture.until = now + dur;
    },
    tick(now) {
      if (gesture.sprite && now > gesture.until) { g.remove(gesture.sprite); gesture.sprite = null; }
    },
  };
}

// ---- transient effects ---------------------------------------------------

const flights = [];
export function flyNote(scene, fromSeat, toSeat, dur = 1.0) {
  const A = DESKS[fromSeat], B = DESKS[toSeat];
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), mat('#f2efe4', { side: THREE.DoubleSide }));
  scene.add(m);
  flights.push({ m, t: 0, dur, ax: A.x, az: A.z, bx: B.x, bz: B.z });
}
export function tickFlights(scene, dt) {
  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];
    f.t += dt / f.dur;
    const t = Math.min(f.t, 1);
    f.m.position.set(
      f.ax + (f.bx - f.ax) * t,
      0.95 + Math.sin(t * Math.PI) * 1.5,
      f.az + (f.bz - f.az) * t);
    f.m.rotation.set(t * 9, t * 7, 0);
    if (f.t >= 1) { scene.remove(f.m); flights.splice(i, 1); }
  }
}
