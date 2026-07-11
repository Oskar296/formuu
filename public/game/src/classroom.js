import * as THREE from 'three';

// The classroom: warm wooden room, 3x3 desks facing the blackboard (-z),
// teacher desk + phone up front, shame stool in the corner.

export const DESKS = [];           // seat positions (chair center), facing -z
export const ROOM = { x: 7.2, z: 8.4 };   // half-extents
export const TEACHER_DESK = { x: -2.2, z: -6.2 };
export const PHONE = { x: -2.2, z: -6.2 };
export const BOARD = { x: 1.2, z: -8.1 };
export const STOOL = { x: 6.0, z: -6.6 };
{
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      DESKS.push({ x: (c - 1) * 3.0, z: -1.6 + r * 2.9, deskZ: -1.6 + r * 2.9 - 0.85 });
}
export const seatAdjacent = (a, b) => {
  const ac = a % 3, ar = (a / 3) | 0, bc = b % 3, br = (b / 3) | 0;
  return Math.abs(ac - bc) + Math.abs(ar - br) === 1;
};

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });

function tex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export function buildClassroom(scene) {
  const surfaces = [];   // clickable stick-note surfaces: desks
  // floor: warm planks
  const floorTex = tex(512, 512, (c, w, h) => {
    for (let y = 0; y < 8; y++) {
      const b = 148 + Math.random() * 22;
      c.fillStyle = `rgb(${b + 24},${b - 18},${b - 58})`; c.fillRect(0, y * 64, w, 64);
      c.strokeStyle = 'rgba(70,45,22,0.4)'; c.lineWidth = 2; c.strokeRect(0, y * 64, w, 64);
      for (let g = 0; g < 5; g++) {
        c.strokeStyle = `rgba(95,62,30,${0.05 + Math.random() * 0.06})`;
        c.beginPath(); c.moveTo(0, y * 64 + Math.random() * 64);
        c.bezierCurveTo(170, y * 64 + Math.random() * 64, 340, y * 64 + Math.random() * 64, 512, y * 64 + Math.random() * 64);
        c.stroke();
      }
    }
  }, [4, 5]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2 + 1, ROOM.z * 2 + 1),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // walls: two-tone with a rail
  const wallTop = mat('#e7e2d2'), wallBot = mat('#a8c4bc');
  const H = 4.6;
  const mkWall = (w, x, z, ry) => {
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, H - 1.4), wallTop);
    top.position.set(x, 1.4 + (H - 1.4) / 2, z); top.rotation.y = ry; scene.add(top);
    const bot = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.4), wallBot);
    bot.position.set(x, 0.7, z); bot.rotation.y = ry; scene.add(bot);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(ry === 0 || Math.abs(ry) === Math.PI ? w : 0.06, 0.08, ry === 0 || Math.abs(ry) === Math.PI ? 0.06 : w), mat('#8a6a42', { roughness: 0.6 }));
    rail.position.set(x, 1.42, z); scene.add(rail);
  };
  mkWall(ROOM.x * 2 + 1, 0, -ROOM.z - 0.5, 0);
  mkWall(ROOM.x * 2 + 1, 0, ROOM.z + 0.5, Math.PI);
  mkWall(ROOM.z * 2 + 1, -ROOM.x - 0.5, 0, Math.PI / 2);
  mkWall(ROOM.z * 2 + 1, ROOM.x + 0.5, 0, -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2 + 1, ROOM.z * 2 + 1), mat('#f2f0e8'));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);

  // blackboard with the exam rules chalked on
  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.3), new THREE.MeshStandardMaterial({
    map: tex(1024, 384, (c, w, h) => {
      c.fillStyle = '#2b4433'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(240,240,220,0.92)'; c.font = 'bold 66px Georgia';
      c.fillText('FINAL EXAM', 56, 100);
      c.font = '40px Georgia'; c.globalAlpha = 0.85;
      c.fillText('• eyes on your OWN paper', 60, 190);
      c.fillText('• absolutely NO cheating', 60, 260);
      c.globalAlpha = 0.5; c.strokeStyle = '#f0f0dc'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(52, 122); c.lineTo(470, 118); c.stroke();
    }), roughness: 0.95,
  }));
  board.position.set(BOARD.x, 2.15, -ROOM.z - 0.44); scene.add(board);
  const frame = mat('#6b4a2a', { roughness: 0.65 });
  for (const [w2, h2, x2, y2] of [[6.7, 0.12, BOARD.x, 3.36], [6.7, 0.12, BOARD.x, 0.94], [0.12, 2.55, BOARD.x - 3.32, 2.15], [0.12, 2.55, BOARD.x + 3.32, 2.15]]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, 0.08), frame);
    f.position.set(x2, y2, -ROOM.z - 0.42); scene.add(f);
  }
  const chalkTray = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.06, 0.18), frame);
  chalkTray.position.set(BOARD.x, 0.9, -ROOM.z - 0.36); scene.add(chalkTray);

  // windows on the left wall, glowing daylight
  for (const wz of [-4.2, 0.6, 5.4]) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.9), new THREE.MeshBasicMaterial({
      map: tex(256, 256, (c) => {
        const g2 = c.createLinearGradient(0, 0, 0, 256);
        g2.addColorStop(0, '#9cc2ec'); g2.addColorStop(0.65, '#d5e6f6'); g2.addColorStop(1, '#eef4da');
        c.fillStyle = g2; c.fillRect(0, 0, 256, 256);
        c.fillStyle = 'rgba(255,255,255,0.9)';
        for (const [x2, y2, r2] of [[70, 70, 24], [104, 80, 30], [180, 56, 20]]) { c.beginPath(); c.arc(x2, y2, r2, 0, 7); c.fill(); }
        c.fillStyle = '#8fbf6a'; c.fillRect(0, 214, 256, 42);
      }),
    }));
    glass.rotation.y = Math.PI / 2;
    glass.position.set(-ROOM.x - 0.44, 2.3, wz);
    scene.add(glass);
    const fm = mat('#e8e4d8', { roughness: 0.5 });
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 0.09), fm);
    v.position.set(-ROOM.x - 0.4, 2.3, wz); scene.add(v);
    const hh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 2.5), fm);
    hh.position.set(-ROOM.x - 0.4, 2.3, wz); scene.add(hh);
  }

  // posters
  const poster = (txt, bg, x, z, ry) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), new THREE.MeshStandardMaterial({
      map: tex(220, 300, (c, w, h) => {
        c.fillStyle = bg; c.fillRect(0, 0, w, h);
        c.fillStyle = '#fff'; c.font = 'bold 40px system-ui'; c.textAlign = 'center';
        txt.split('\n').forEach((l, i) => c.fillText(l, w / 2, 120 + i * 52));
      }), roughness: 0.9,
    }));
    p.position.set(x, 2.5, z); p.rotation.y = ry; scene.add(p);
  };
  poster('STUDY\nHARD', '#4e8a5e', ROOM.x + 0.44, -3, -Math.PI / 2);
  poster('NO\nEXCUSES', '#b9553e', ROOM.x + 0.44, 1.5, -Math.PI / 2);
  poster('SILENCE', '#46608a', -4.5, -ROOM.z - 0.44, 0);

  // student desks + chairs (with a paper + bottle on each)
  const wood = mat('#a9713f', { roughness: 0.55 }), leg = mat('#8a8f98', { roughness: 0.45 });
  const paperMeshes = [], bottleMeshes = [];
  DESKS.forEach((d, i) => {
    const grp = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.0), wood);
    top.position.set(d.x, 1.06, d.deskZ); top.castShadow = top.receiveShadow = true;
    grp.add(top);
    surfaces.push({ mesh: top, desk: i });
    for (const [lx, lz] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.02, 10), leg);
      l.position.set(d.x + lx, 0.51, d.deskZ + lz); grp.add(l);
    }
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.72), mat('#f4efdd', { roughness: 0.95 }));
    paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.06;
    paper.position.set(d.x + 0.15, 1.105, d.deskZ + 0.02);
    grp.add(paper); paperMeshes.push(paper);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.34, 14), mat('#5aa3d8', { roughness: 0.3 }));
    bottle.position.set(d.x - 0.6, 1.27, d.deskZ - 0.25); bottle.castShadow = true;
    grp.add(bottle); bottleMeshes.push(bottle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 12), mat('#2d5b80', { roughness: 0.4 }));
    cap.position.set(d.x - 0.6, 1.47, d.deskZ - 0.25); grp.add(cap);
    // chair
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.8), mat('#b5643c', { roughness: 0.6 }));
    seat.position.set(d.x, 0.62, d.z + 0.15); seat.castShadow = true; grp.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, 0.07), mat('#b5643c', { roughness: 0.6 }));
    back.position.set(d.x, 1.02, d.z + 0.5); grp.add(back);
    for (const [lx, lz] of [[-0.36, -0.3], [0.36, -0.3], [-0.36, 0.42], [0.36, 0.42]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), leg);
      l.position.set(d.x + lx, 0.31, d.z + 0.15 + lz); grp.add(l);
    }
    scene.add(grp);
  });

  // teacher's desk + phone
  const tdesk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.1), mat('#7a5230', { roughness: 0.6 }));
  tdesk.position.set(TEACHER_DESK.x, 0.5, TEACHER_DESK.z);
  tdesk.castShadow = tdesk.receiveShadow = true;
  scene.add(tdesk);
  const phoneBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.22), mat('#b03a30', { roughness: 0.4 }));
  phoneBase.position.set(TEACHER_DESK.x + 0.8, 1.06, TEACHER_DESK.z);
  scene.add(phoneBase);
  const handset = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.24, 6, 10), mat('#b03a30', { roughness: 0.4 }));
  handset.rotation.z = Math.PI / 2;
  handset.position.set(TEACHER_DESK.x + 0.8, 1.16, TEACHER_DESK.z);
  scene.add(handset);

  // shame stool
  const stoolTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 18), mat('#8a5a34', { roughness: 0.6 }));
  stoolTop.position.set(STOOL.x, 0.62, STOOL.z); stoolTop.castShadow = true; scene.add(stoolTop);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.6, 8), leg);
    l.position.set(STOOL.x + Math.cos(a) * 0.2, 0.31, STOOL.z + Math.sin(a) * 0.2);
    l.rotation.z = Math.cos(a) * 0.12; l.rotation.x = -Math.sin(a) * 0.12;
    scene.add(l);
  }

  // door on the right wall
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 1.1), mat('#6b4a2a', { roughness: 0.6 }));
  door.position.set(ROOM.x + 0.42, 1.15, 5.6); scene.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('#d8c26a', { metalness: 0.5, roughness: 0.3 }));
  knob.position.set(ROOM.x + 0.35, 1.15, 5.25); scene.add(knob);

  // clock above the board
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), mat('#f4f4ee', { roughness: 0.4 }));
  clockFace.position.set(BOARD.x + 4.6, 3.6, -ROOM.z - 0.44); scene.add(clockFace);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 24), mat('#333'));
  ring.position.copy(clockFace.position); scene.add(ring);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.26, 0.02), mat('#222'));
  hand.geometry.translate(0, 0.13, 0);
  hand.position.set(clockFace.position.x, clockFace.position.y, clockFace.position.z + 0.02);
  scene.add(hand);

  return { surfaces, paperMeshes, bottleMeshes, clockHand: hand };
}

export function lights(scene) {
  scene.add(new THREE.HemisphereLight('#f2ecff', '#5c5044', 0.85));
  const sun = new THREE.DirectionalLight('#ffeccf', 1.7);
  sun.position.set(-9, 9, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -11; sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
  sun.shadow.camera.far = 45; sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.AmbientLight('#b8c0d4', 0.4));
}

// keep a walking body out of desks/furniture. Obstacles are tight rectangles
// matching the actual furniture footprints (no invisible force fields), and
// the push-out is along the shallow axis so you slide along edges naturally.
const OBS = [];
for (const d of DESKS) {
  OBS.push({ x: d.x, z: d.deskZ, hx: 0.85, hz: 0.5 });     // desk top
  OBS.push({ x: d.x, z: d.z + 0.2, hx: 0.44, hz: 0.42 });  // chair
}
OBS.push({ x: TEACHER_DESK.x, z: TEACHER_DESK.z, hx: 1.3, hz: 0.55 });
export function collide(pos, r = 0.26) {
  // walls sit at ±(ROOM+0.5); walk right up to them
  pos.x = Math.max(-ROOM.x - 0.5 + r + 0.06, Math.min(ROOM.x + 0.5 - r - 0.06, pos.x));
  pos.z = Math.max(-ROOM.z - 0.5 + r + 0.06, Math.min(ROOM.z + 0.5 - r - 0.06, pos.z));
  for (const o of OBS) {
    const dx = pos.x - o.x, dz = pos.z - o.z;
    const px = o.hx + r - Math.abs(dx), pz = o.hz + r - Math.abs(dz);
    if (px <= 0 || pz <= 0) continue;
    if (px < pz) pos.x = o.x + (dx < 0 ? -1 : 1) * (o.hx + r);
    else pos.z = o.z + (dz < 0 ? -1 : 1) * (o.hz + r);
  }
  const sx = pos.x - STOOL.x, sz = pos.z - STOOL.z, sd = Math.hypot(sx, sz);
  if (sd < 0.36 + r && sd > 1e-4) { pos.x = STOOL.x + sx / sd * (0.36 + r); pos.z = STOOL.z + sz / sd * (0.36 + r); }
}
