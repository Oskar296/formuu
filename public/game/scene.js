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

export const SHIRTS = ['#d95d4c', '#4e86c7', '#56a05c', '#d0a844', '#9a6bc9',
  '#3fb3a5', '#c75e9a', '#8a9a4e', '#c77e4e'];
const HAIR = ['#3a2a1c', '#171310', '#7a4a22', '#b8862e', '#57432e', '#20242c', '#8a3a22', '#4a3424', '#2c2018'];

// ---------------------------------------------------------------- procedural textures

function texture(w, h, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

const rnd = (() => { let s = 987; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

function woodDraw(base, light, dark, plankH) {
  return (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += plankH) {
      c.fillStyle = rnd() < 0.5 ? light : base;
      c.globalAlpha = 0.25 + rnd() * 0.3;
      c.fillRect(0, y, w, plankH - 2);
      c.globalAlpha = 1;
      c.fillStyle = dark;
      c.fillRect(0, y + plankH - 2, w, 2);
      // grain
      c.strokeStyle = 'rgba(60,35,15,0.18)';
      for (let i = 0; i < 5; i++) {
        c.lineWidth = 1 + rnd();
        c.beginPath();
        const gy = y + rnd() * plankH;
        c.moveTo(0, gy);
        c.bezierCurveTo(w * 0.3, gy + rnd() * 6 - 3, w * 0.7, gy + rnd() * 6 - 3, w, gy);
        c.stroke();
      }
      // plank seams
      c.fillStyle = dark;
      for (let sx = (rnd() * w) | 0; sx < w; sx += 200 + rnd() * 300) c.fillRect(sx, y, 2, plankH);
    }
  };
}

const floorTex = texture(1024, 1024, woodDraw('#a5734a', '#b98a5c', '#7c5230', 128), [5, 5]);
const deskTex = texture(512, 512, woodDraw('#9a6a3e', '#ad7c4c', '#75481f', 256), [1, 1]);
const darkWoodTex = texture(512, 512, woodDraw('#6f4526', '#7f5433', '#4f2e14', 256), [1, 1]);

const wallTex = texture(512, 512, (c, w, h) => {
  c.fillStyle = '#e7e0cd'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = rnd() < 0.5 ? 'rgba(120,110,90,0.05)' : 'rgba(255,255,255,0.06)';
    c.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
  }
}, [4, 2]);

const boardTex = texture(1024, 512, (c, w, h) => {
  c.fillStyle = '#2c4a3c'; c.fillRect(0, 0, w, h);
  // chalk haze
  for (let i = 0; i < 40; i++) {
    c.strokeStyle = `rgba(230,235,225,${0.02 + rnd() * 0.03})`;
    c.lineWidth = 8 + rnd() * 26;
    c.beginPath();
    const y = rnd() * h, x = rnd() * w;
    c.moveTo(x, y);
    c.bezierCurveTo(x + 80, y - 20 + rnd() * 40, x + 200, y - 20 + rnd() * 40, x + 260 + rnd() * 140, y + rnd() * 30);
    c.stroke();
  }
  c.fillStyle = 'rgba(235,238,230,0.85)';
  c.font = "bold 64px 'Segoe Print', 'Comic Sans MS', cursive";
  c.fillText('EXAM — section 7B', 60, 130);
  c.font = "42px 'Segoe Print', 'Comic Sans MS', cursive";
  c.fillStyle = 'rgba(235,238,230,0.6)';
  c.fillText('eyes on your OWN paper.', 64, 210);
});

const skyTex = texture(512, 512, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7db4e8'); g.addColorStop(0.65, '#cfe6f7'); g.addColorStop(1, '#eef7ee');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,250,220,0.95)';
  c.beginPath(); c.arc(w * 0.72, h * 0.24, 42, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [cx, cy, s] of [[120, 150, 40], [200, 130, 55], [300, 340, 46], [420, 300, 34]]) {
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(cx + i * s * 0.55, cy + (i % 2) * 10, s * 0.6, s * 0.38, 0, 0, 7); c.fill(); }
  }
});

const paperTex = texture(256, 256, (c, w, h) => {
  c.fillStyle = '#f4efdf'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(90,110,160,0.35)'; c.lineWidth = 1;
  for (let y = 36; y < h; y += 22) { c.beginPath(); c.moveTo(12, y); c.lineTo(w - 12, y); c.stroke(); }
  c.strokeStyle = 'rgba(190,90,90,0.4)';
  c.beginPath(); c.moveTo(30, 10); c.lineTo(30, h - 10); c.stroke();
});

function posterTex(bg, emoji, caption) {
  return texture(256, 340, (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(10, 10, w - 20, h - 20);
    c.font = '110px serif'; c.textAlign = 'center';
    c.fillText(emoji, w / 2, 160);
    c.fillStyle = '#fff'; c.font = "bold 30px 'Segoe UI', sans-serif";
    c.fillText(caption, w / 2, 250);
  });
}

const clockTex = texture(256, 256, (c, w, h) => {
  c.fillStyle = '#f4f2ea'; c.beginPath(); c.arc(128, 128, 118, 0, 7); c.fill();
  c.strokeStyle = '#3a3a40'; c.lineWidth = 8; c.beginPath(); c.arc(128, 128, 114, 0, 7); c.stroke();
  c.fillStyle = '#3a3a40';
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    c.fillRect(128 + Math.cos(a) * 96 - 3, 128 + Math.sin(a) * 96 - 3, 7, 7);
  }
  c.lineWidth = 7; c.beginPath(); c.moveTo(128, 128); c.lineTo(128, 62); c.stroke();
  c.lineWidth = 5; c.beginPath(); c.moveTo(128, 128); c.lineTo(176, 148); c.stroke();
});

// ---------------------------------------------------------------- materials / helpers

const mats = new Map();
const mat = (c, o = {}) => {
  const k = c + JSON.stringify(Object.keys(o));
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o }));
  return mats.get(k);
};

let SURFACES = [];
function box(parent, w, h, d, c, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.material || mat(c));
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = !opts.noShadow; m.receiveShadow = true;
  parent.add(m);
  SURFACES.push(m); // anything built is a valid place to stick a note
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

// ---------------------------------------------------------------- the room

export function buildRoom(scene) {
  SURFACES = [];
  scene.background = new THREE.Color('#1c2028');
  scene.fog = new THREE.Fog('#1c2028', 34, 80);

  scene.add(new THREE.HemisphereLight('#dfe8ff', '#5c4c3c', 0.85));
  scene.add(new THREE.AmbientLight('#b8b0c0', 0.35));
  const sun = new THREE.DirectionalLight('#ffddb0', 2.1);
  sun.position.set(18, 11, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
  sun.shadow.bias = -0.0003;
  scene.add(sun);

  // floor / ceiling / walls
  box(scene, ROOM.x * 2, 0.2, ROOM.z * 2, null, 0, -0.1, 0, { material: mat('#a5734a', { map: floorTex, roughness: 0.7 }), noShadow: true });
  box(scene, ROOM.x * 2, 0.2, ROOM.z * 2, '#eceadf', 0, 4.4, 0, { noShadow: true });
  const wallMat = mat('#e7e0cd', { map: wallTex });
  const boardWallMat = mat('#cfdcd2', { map: wallTex });
  box(scene, ROOM.x * 2, 4.4, 0.3, null, 0, 2.2, -ROOM.z, { material: boardWallMat, noShadow: true });
  box(scene, ROOM.x * 2, 4.4, 0.3, null, 0, 2.2, ROOM.z, { material: wallMat, noShadow: true });
  box(scene, 0.3, 4.4, ROOM.z * 2, null, -ROOM.x, 2.2, 0, { material: wallMat, noShadow: true });
  box(scene, 0.3, 4.4, ROOM.z * 2, null, ROOM.x, 2.2, 0, { material: wallMat, noShadow: true });
  // skirting
  for (const [w, h, d, x, z] of [[ROOM.x * 2, 0.22, 0.06, 0, -ROOM.z + 0.18], [ROOM.x * 2, 0.22, 0.06, 0, ROOM.z - 0.18]])
    box(scene, w, h, d, '#7a5c3a', x, 0.11, z, { noShadow: true });
  for (const x of [-ROOM.x + 0.18, ROOM.x - 0.18])
    box(scene, 0.06, 0.22, ROOM.z * 2, '#7a5c3a', x, 0.11, 0, { noShadow: true });

  // ceiling lights
  for (const lx of [-6, 0, 6]) {
    box(scene, 2.6, 0.09, 0.9, null, lx, 4.32, 0, { material: mat('#fbf8ee', { emissive: '#fff6dc', emissiveIntensity: 0.9 }), noShadow: true });
    const pl = new THREE.PointLight('#fff2d8', 14, 13, 2);
    pl.position.set(lx, 3.9, 0);
    scene.add(pl);
  }

  // blackboard with wooden frame + chalk tray
  box(scene, 8.4, 2.6, 0.08, '#6b4a26', 0, 2.25, -ROOM.z + 0.22, { material: darkWoodMat(), noShadow: true });
  const board = box(scene, 8, 2.2, 0.06, null, 0, 2.25, -ROOM.z + 0.28, { material: mat('#2c4a3c', { map: boardTex, roughness: 0.92 }), noShadow: true });
  box(scene, 8.4, 0.1, 0.26, '#7a5c3a', 0, 1.05, -ROOM.z + 0.36);
  box(scene, 0.35, 0.05, 0.08, '#f4f2ea', 1.2, 1.12, -ROOM.z + 0.36, { noShadow: true }); // chalk
  box(scene, 0.5, 0.09, 0.14, '#8a8a92', -1.6, 1.13, -ROOM.z + 0.36, { noShadow: true }); // eraser

  // windows on +x wall: frame, sill, sky
  for (const wz of [-4.5, 0.5, 5]) {
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.1),
      new THREE.MeshBasicMaterial({ map: skyTex }));
    sky.position.set(ROOM.x - 0.14, 2.5, wz);
    sky.rotation.y = -Math.PI / 2;
    scene.add(sky);
    const f = '#f0ece0';
    box(scene, 0.1, 2.3, 0.12, f, ROOM.x - 0.16, 2.5, wz - 1.36, { noShadow: true });
    box(scene, 0.1, 2.3, 0.12, f, ROOM.x - 0.16, 2.5, wz + 1.36, { noShadow: true });
    box(scene, 0.1, 0.12, 2.85, f, ROOM.x - 0.16, 3.6, wz, { noShadow: true });
    box(scene, 0.1, 0.12, 2.85, f, ROOM.x - 0.16, 1.4, wz, { noShadow: true });
    box(scene, 0.1, 0.1, 2.72, f, ROOM.x - 0.17, 2.5, wz, { noShadow: true });
    box(scene, 0.18, 0.08, 3, f, ROOM.x - 0.22, 1.32, wz);
  }

  // door + frame + handle (left wall)
  box(scene, 0.16, 3.1, 1.5, '#e5dfce', -ROOM.x + 0.16, 1.55, -5.5, { noShadow: true });
  box(scene, 0.12, 2.95, 1.34, null, -ROOM.x + 0.2, 1.48, -5.5, { material: darkWoodMat() });
  box(scene, 0.08, 0.08, 0.26, '#c9b64a', -ROOM.x + 0.3, 1.45, -5.02);

  // posters + clock + plant
  const posters = [
    [posterTex('#3f5d8a', '🧠', 'THINK'), -4, 2.6, ROOM.z - 0.17, Math.PI],
    [posterTex('#7a4a8a', '🤫', 'SILENCE'), 5, 2.7, ROOM.z - 0.17, Math.PI],
    [posterTex('#3a7a5c', '📚', 'STUDY'), -ROOM.x + 0.17, 2.6, 1.5, Math.PI / 2],
  ];
  for (const [tex, x, y, z, ry] of posters) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    p.position.set(x, y, z); p.rotation.y = ry;
    scene.add(p);
    SURFACES.push(p);
  }
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.6 }));
  clock.position.set(0, 3.6, -ROOM.z + 0.32);
  scene.add(clock);
  SURFACES.push(clock);
  // plant in corner
  box(scene, 0.55, 0.5, 0.55, '#b06a4a', -ROOM.x + 1, 0.25, ROOM.z - 1);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3 + rnd() * 0.16, 8, 6), mat('#3f7a4a'));
    leaf.position.set(-ROOM.x + 1 + (rnd() - 0.5) * 0.4, 0.75 + rnd() * 0.5, ROOM.z - 1 + (rnd() - 0.5) * 0.4);
    leaf.castShadow = true;
    scene.add(leaf);
  }

  // teacher desk with drawers, globe, papers, phone
  box(scene, 2.7, 0.12, 1.35, null, TEACHER_DESK.x, 0.95, TEACHER_DESK.z, { material: darkWoodMat() });
  box(scene, 2.45, 0.85, 1.12, null, TEACHER_DESK.x, 0.46, TEACHER_DESK.z, { material: darkWoodMat() });
  box(scene, 0.7, 0.16, 0.02, '#4a3018', TEACHER_DESK.x - 0.6, 0.62, TEACHER_DESK.z + 0.57); // drawer
  box(scene, 0.7, 0.16, 0.02, '#4a3018', TEACHER_DESK.x + 0.6, 0.62, TEACHER_DESK.z + 0.57);
  const phone = box(scene, 0.38, 0.15, 0.26, '#a83a30', TEACHER_DESK.x - 0.85, 1.09, TEACHER_DESK.z - 0.3);
  box(scene, 0.5, 0.04, 0.65, null, TEACHER_DESK.x + 0.2, 1.03, TEACHER_DESK.z, { material: mat('#f4efdf', { map: paperTex }), noShadow: true });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 12), mat('#4e86c7', { roughness: 0.5 }));
  globe.position.set(TEACHER_DESK.x + 0.9, 1.22, TEACHER_DESK.z - 0.25);
  globe.castShadow = true;
  scene.add(globe);
  box(scene, 0.06, 0.14, 0.06, '#3a3a40', TEACHER_DESK.x + 0.9, 1.05, TEACHER_DESK.z - 0.25);
  // shame stool
  box(scene, 0.5, 0.09, 0.5, null, STOOL.x, 0.62, STOOL.z, { material: darkWoodMat() });
  for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]])
    box(scene, 0.07, 0.6, 0.07, '#5c3e22', STOOL.x + lx, 0.3, STOOL.z + lz);

  // student desks
  const deskMeshes = [], paperMeshes = [], bottleMeshes = [];
  const deskMat = mat('#9a6a3e', { map: deskTex, roughness: 0.65 });
  DESKS.forEach((d, i) => {
    const top = box(scene, 1.5, 0.09, 0.95, null, d.x, 0.78, d.z, { material: deskMat });
    top.userData.seat = i;
    deskMeshes.push(top);
    box(scene, 1.42, 0.1, 0.06, '#7c5230', d.x, 0.72, d.z + 0.44, { noShadow: true }); // front edge trim
    for (const [lx, lz] of [[-0.65, -0.38], [0.65, -0.38], [-0.65, 0.38], [0.65, 0.38]])
      box(scene, 0.08, 0.75, 0.08, '#4c4c54', d.x + lx, 0.39, d.z + lz); // metal legs
    // chair
    box(scene, 0.95, 0.07, 0.85, null, d.x, 0.52, d.z + 1.05, { material: deskMat });
    box(scene, 0.95, 0.8, 0.07, null, d.x, 0.98, d.z + 1.46, { material: deskMat });
    for (const [lx, lz] of [[-0.4, 0.72], [0.4, 0.72], [-0.4, 1.4], [0.4, 1.4]])
      box(scene, 0.07, 0.52, 0.07, '#4c4c54', d.x + lx, 0.26, d.z + lz);
    // exam paper + pencil
    const paper = box(scene, 0.6, 0.015, 0.8, null, d.x - 0.18, 0.835, d.z, { material: mat('#f4efdf', { map: paperTex }), noShadow: true });
    paper.userData.paperSeat = i;
    paperMeshes.push(paper);
    box(scene, 0.24, 0.025, 0.025, '#d0a030', d.x + 0.28, 0.84, d.z + 0.3, { ry: 0.5, noShadow: true });
    // water bottle
    const bottle = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.34, 12), mat('#5db0d6', { roughness: 0.3 }));
    body.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), mat('#2e5a7a'));
    cap.position.y = 0.2;
    bottle.add(body, cap);
    bottle.position.set(d.x + 0.55, 1.0, d.z - 0.25);
    scene.add(bottle);
    body.userData.bottleSeat = i;
    bottleMeshes.push(body);
    SURFACES.push(body);
    // schoolbag beside some desks
    if (i % 2 === 0) box(scene, 0.4, 0.5, 0.28, SHIRTS[(i + 3) % SHIRTS.length], d.x - 0.95, 0.25, d.z + 0.9, { ry: 0.3 });
  });

  return { deskMeshes, paperMeshes, bottleMeshes, phone, surfaces: SURFACES.slice() };

  function darkWoodMat() { return mat('#6f4526', { map: darkWoodTex, roughness: 0.6 }); }
}

// a written note stuck onto any surface, showing the author's actual drawing
export function makeNoteMesh(scene, img, pos, normal) {
  const tex = new THREE.Texture();
  const image = new Image();
  image.onload = () => { tex.image = image; tex.needsUpdate = true; };
  image.src = img;
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.185),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  const p = new THREE.Vector3(...pos), n = new THREE.Vector3(...normal).normalize();
  m.position.copy(p).addScaledVector(n, 0.012);
  m.lookAt(p.clone().add(n));
  m.rotateZ((Math.random() - 0.5) * 0.5);
  scene.add(m);
  return m;
}

// ---- avatars ------------------------------------------------------------

function makeFace(head) {
  const eyeMat = mat('#1c1a22', { roughness: 0.3 });
  for (const ex of [-0.095, 0.095]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), eyeMat);
    eye.position.set(ex, 0.03, -0.235);
    head.add(eye);
  }
}

export function makeStudent(scene, seat, colorIdx, name) {
  const d = DESKS[seat];
  const g = new THREE.Group();
  g.position.set(d.x, 0, d.z + 0.95);

  const shirt = mat(SHIRTS[colorIdx % SHIRTS.length], { roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.42, 6, 14), shirt);
  body.position.set(0, 0.92, 0);
  body.castShadow = true;
  g.add(body);
  // arms resting toward the desk
  for (const ax of [-0.32, 0.32]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.34, 4, 10), shirt);
    arm.position.set(ax, 0.95, -0.22);
    arm.rotation.x = 1.15;
    arm.rotation.z = ax > 0 ? -0.25 : 0.25;
    arm.castShadow = true;
    g.add(arm);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 16), mat('#e8bd96', { roughness: 0.65 }));
  head.position.set(0, 1.52, 0);
  head.castShadow = true;
  makeFace(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.275, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(HAIR[colorIdx % HAIR.length], { roughness: 0.95 }));
  hair.position.set(0, 0.015, 0.03);
  hair.rotation.x = -0.25;
  head.add(hair);
  g.add(head);

  const tag = textSprite(name, { size: 44, bg: 'rgba(12,12,22,0.5)' });
  tag.position.set(0, 2.12, 0);
  g.add(tag);
  const gesture = { sprite: null, until: 0 };
  scene.add(g);

  return {
    group: g, head, body, seat,
    setLean(l) { g.position.x = d.x + l * 0.55; g.rotation.z = -l * 0.18; },
    setPos(x, z, yaw) { g.position.x = x; g.position.z = z; g.rotation.y = yaw; g.rotation.z = 0; },
    resetSeat() { g.position.set(d.x, 0, d.z + 0.95); g.rotation.set(0, 0, 0); },
    setGesture(text, dur, now, bg = 'rgba(30,60,140,0.85)') {
      if (gesture.sprite) g.remove(gesture.sprite);
      gesture.sprite = textSprite(text, { size: 52, bg });
      gesture.sprite.position.set(0, 2.55, 0);
      g.add(gesture.sprite);
      gesture.until = now + dur;
    },
    tick(now) {
      if (gesture.sprite && now > gesture.until) { g.remove(gesture.sprite); gesture.sprite = null; }
    },
    moveToStool() {
      g.position.set(STOOL.x, 0, STOOL.z + 0.1);
      g.rotation.y = Math.PI * 0.15;
      g.rotation.z = 0;
    },
    setVisible(v) { g.visible = v; },
  };
}

export function makeTeacher(scene, name) {
  const g = new THREE.Group();
  const suit = mat('#3e3e50', { roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.72, 6, 14), suit);
  body.position.set(0, 1.05, 0);
  body.castShadow = true;
  g.add(body);
  for (const ax of [-0.36, 0.36]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 10), suit);
    arm.position.set(ax, 1.05, 0);
    arm.rotation.z = ax > 0 ? -0.12 : 0.12;
    arm.castShadow = true;
    g.add(arm);
  }
  // tie
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.03), mat('#a83a30'));
  tie.position.set(0, 1.28, -0.3);
  tie.rotation.x = 0.08;
  g.add(tie);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 22, 16), mat('#e8bd96', { roughness: 0.65 }));
  head.position.set(0, 1.9, 0);
  head.castShadow = true;
  makeFace(head);
  // stern gray hair + mustache
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.285, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), mat('#9c9ca4', { roughness: 0.95 }));
  hair.position.set(0, 0.03, 0.05);
  hair.rotation.x = -0.3;
  head.add(hair);
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.04), mat('#8a8a92'));
  stache.position.set(0, -0.07, -0.245);
  head.add(stache);
  g.add(head);

  const tag = textSprite('🧑‍🏫 ' + name, { size: 44, bg: 'rgba(120,30,30,0.65)' });
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
