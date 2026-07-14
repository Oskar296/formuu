import * as THREE from 'three';

// The world: five exam rooms sharing one skeleton (desks facing a board at
// -z, teacher desk + phone up front, shame stool in a corner) but each with
// its own layout, palette, lighting mood, props, and EXCLUSIVE cheat items.
// Layout state (DESKS, ROOM, …) is mutated in place on build so every module
// reads fresh coordinates.

export const MAPS = {
  classroom: { name: 'Classroom', icon: '🏫' },
  lab: { name: 'Science Lab', icon: '🧪' },
  gym: { name: 'Gym Hall', icon: '🏀' },
  library: { name: 'Library', icon: '📚' },
  detention: { name: 'Night Detention', icon: '🌙' },
};

export const DESKS = [];                       // seat positions (chair center), facing -z
export const ROOM = { x: 7.2, z: 8.4 };        // half-extents
export const TEACHER_DESK = { x: -2.2, z: -6.2 };
export const BOARD = { x: 1.2, z: -8.1 };
export const STOOL = { x: 6.0, z: -6.6 };
export const seatAdjacent = (a, b) => {
  const ac = a % 3, ar = (a / 3) | 0, bc = b % 3, br = (b / 3) | 0;
  return Math.abs(ac - bc) + Math.abs(ar - br) === 1;
};

const OBS = [];
function layout(mapId) {
  DESKS.length = 0;
  const dims = {
    classroom: [7.2, 8.4], lab: [8.6, 7.6], gym: [10.2, 10.2],
    library: [8.2, 8.8], detention: [6.6, 7.8],
  }[mapId];
  ROOM.x = dims[0]; ROOM.z = dims[1];
  const sx = { classroom: 3.0, lab: 3.5, gym: 4.1, library: 3.1, detention: 2.7 }[mapId];
  const sz = { classroom: 2.9, lab: 2.7, gym: 3.5, library: 2.9, detention: 2.5 }[mapId];
  const z0 = mapId === 'gym' ? -2.4 : -1.6;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const stagger = mapId === 'gym' ? (r % 2 ? 0.7 : -0.7) : 0;
      const x = (c - 1) * sx + stagger, z = z0 + r * sz;
      DESKS.push({ x, z, deskZ: z - 0.85 });
    }
  TEACHER_DESK.x = -2.2; TEACHER_DESK.z = -ROOM.z + 2.2;
  BOARD.x = mapId === 'gym' ? 0 : 1.2; BOARD.z = -ROOM.z + 0.3;
  STOOL.x = ROOM.x - 1.2; STOOL.z = -ROOM.z + 1.8;
  OBS.length = 0;
  for (const d of DESKS) {
    OBS.push({ x: d.x, z: d.deskZ, hx: 0.85, hz: 0.5 });     // desk top
    OBS.push({ x: d.x, z: d.z + 0.2, hx: 0.44, hz: 0.42 });  // chair
  }
  OBS.push({ x: TEACHER_DESK.x, z: TEACHER_DESK.z, hx: 1.3, hz: 0.55 });
  if (mapId === 'gym') OBS.push({ x: ROOM.x + 0.1, z: 0, hx: 1.2, hz: ROOM.z });          // bleachers
  if (mapId === 'library') {
    OBS.push({ x: -ROOM.x + 0.35, z: 0, hx: 0.45, hz: ROOM.z });                          // shelf walls
    OBS.push({ x: ROOM.x - 0.35, z: 0, hx: 0.45, hz: ROOM.z });
  }
}

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });

let ANISO = 8;   // set from the renderer's real max in main.js via setAniso()
export function setAniso(n) { ANISO = Math.max(1, n | 0); }
function tex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;   // sharp at grazing angles (floors, walls, wood)
  t.generateMipmaps = true;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

const plankTex = (base = 148, spread = 22) => tex(512, 512, (c, w) => {
  for (let y = 0; y < 8; y++) {
    const b = base + Math.random() * spread;
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

const tileTex = () => tex(512, 512, (c) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const l = 214 + ((x + y) % 2 ? -16 : 0) + Math.random() * 8;
    c.fillStyle = `rgb(${l - 6},${l},${l + 2})`; c.fillRect(x * 64, y * 64, 64, 64);
    c.strokeStyle = 'rgba(120,135,140,0.55)'; c.strokeRect(x * 64, y * 64, 64, 64);
  }
}, [5, 5]);

const courtTex = () => tex(1024, 1024, (c, w, h) => {
  for (let y = 0; y < 16; y++) {
    const b = 176 + Math.random() * 16;
    c.fillStyle = `rgb(${b + 30},${b - 6},${b - 52})`; c.fillRect(0, y * 64, w, 64);
    c.strokeStyle = 'rgba(120,80,40,0.25)'; c.strokeRect(0, y * 64, w, 64);
  }
  c.strokeStyle = '#f2ede2'; c.lineWidth = 10;
  c.strokeRect(70, 70, w - 140, h - 140);
  c.beginPath(); c.arc(w / 2, h / 2, 130, 0, 7); c.stroke();
  c.beginPath(); c.moveTo(70, h / 2); c.lineTo(w - 70, h / 2); c.stroke();
  c.strokeStyle = '#c0503a'; c.lineWidth = 8;
  c.beginPath(); c.arc(w / 2, 74, 190, 0, Math.PI); c.stroke();
});

const carpetTex = () => tex(512, 512, (c, w, h) => {
  c.fillStyle = '#7a3f3a'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i++) {
    c.fillStyle = `rgba(${90 + Math.random() * 60},${40 + Math.random() * 26},${36 + Math.random() * 22},0.5)`;
    c.fillRect(Math.random() * w, Math.random() * h, 2.2, 2.2);
  }
  c.strokeStyle = 'rgba(220,190,140,0.28)'; c.lineWidth = 5;
  c.strokeRect(38, 38, w - 76, h - 76);
}, [3, 3]);

const bookRowTex = () => tex(512, 256, (c, w, h) => {
  c.fillStyle = '#2c1f14'; c.fillRect(0, 0, w, h);
  const cols = ['#8a3a34', '#3a5a8a', '#3f7a4c', '#b08a3a', '#6a4a8a', '#a05a2a', '#4a7a7a'];
  let x = 4;
  while (x < w - 10) {
    const bw = 14 + Math.random() * 22, bh = h * (0.72 + Math.random() * 0.24);
    c.fillStyle = cols[(Math.random() * cols.length) | 0];
    c.fillRect(x, h - bh, bw, bh);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + bw - 3, h - bh, 3, bh);
    if (Math.random() < 0.3) { c.fillStyle = 'rgba(255,240,200,0.5)'; c.fillRect(x + 3, h - bh + 8, bw - 8, 3); }
    x += bw + 2;
  }
});

const clamp = v => Math.max(0, Math.min(255, v | 0));
const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

// painted wall: the flat colour plus faint mottling, brush streaks, and a soft
// top-down gradient so big walls catch light unevenly instead of reading flat
const paintTex = (hex) => {
  const [r, g, bl] = hex2rgb(hex);
  return tex(384, 384, (c, w, h) => {
    const grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgb(${clamp(r + 10)},${clamp(g + 10)},${clamp(bl + 10)})`);
    grad.addColorStop(1, `rgb(${clamp(r - 12)},${clamp(g - 12)},${clamp(bl - 12)})`);
    c.fillStyle = grad; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1100; i++) {
      const a = (Math.random() - 0.5) * 14;
      c.fillStyle = `rgba(${clamp(r + a)},${clamp(g + a)},${clamp(bl + a)},0.16)`;
      c.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    for (let i = 0; i < 46; i++) {
      c.strokeStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
      c.lineWidth = 1; const x = Math.random() * w;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (Math.random() - 0.5) * 10, h); c.stroke();
    }
  }, [3, 2]);
};

// wood grain for desktops: flowing streaks + the odd knot
const woodGrainTex = (base) => {
  const [r, g, bl] = hex2rgb(base);
  return tex(384, 384, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      const yy = (i / 30) * h + (Math.random() - 0.5) * 6, a = (Math.random() - 0.5) * 40;
      c.strokeStyle = `rgba(${clamp(r + a)},${clamp(g + a)},${clamp(bl + a)},0.55)`;
      c.lineWidth = 0.8 + Math.random() * 2.4;
      c.beginPath(); c.moveTo(0, yy);
      c.bezierCurveTo(w * 0.33, yy + (Math.random() - 0.5) * 9, w * 0.66, yy + (Math.random() - 0.5) * 9, w, yy + (Math.random() - 0.5) * 6);
      c.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const kx = 30 + Math.random() * (w - 60), ky = 30 + Math.random() * (h - 60);
      c.strokeStyle = `rgba(${clamp(r - 34)},${clamp(g - 28)},${clamp(bl - 22)},0.5)`;
      for (let rr = 2; rr < 13; rr += 2.2) { c.beginPath(); c.ellipse(kx, ky, rr, rr * 0.62, 0.4, 0, 7); c.stroke(); }
    }
  }, [2, 1]);
};

// ambience per map: sky/fog + light rig settings, applied on every build
const AMB = {
  classroom: { bg: '#cfd8e4', sun: 1.7, sunCol: '#ffeccf', hemi: 0.85, amb: 0.4, panel: '#fdfdf2' },
  lab: { bg: '#d4dde2', sun: 1.45, sunCol: '#eef4ff', hemi: 1.0, amb: 0.48, panel: '#f2fbff' },
  gym: { bg: '#d8d8ca', sun: 1.6, sunCol: '#fff2d8', hemi: 0.9, amb: 0.42, panel: '#fdfae8' },
  library: { bg: '#c9c0ad', sun: 1.1, sunCol: '#ffdfa8', hemi: 0.66, amb: 0.36, panel: '#f6e8c8' },
  detention: { bg: '#1c2130', sun: 0.35, sunCol: '#9ab0e8', hemi: 0.28, amb: 0.2, panel: '#5a6478' },
};

let LIGHTS = null;
export function lights(scene) {
  const hemi = new THREE.HemisphereLight('#f2ecff', '#5c5044', 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffeccf', 1.7);
  sun.position.set(-9, 9, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // tighter frustum → more shadow resolution concentrated on the room
  sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
  sun.shadow.camera.far = 40; sun.shadow.camera.near = 0.5;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.035;
  scene.add(sun);
  // a dim cool fill from the opposite side lifts the shadow side of everything
  const fill = new THREE.DirectionalLight('#aebfe0', 0.32);
  fill.position.set(8, 5, -4);
  scene.add(fill);
  const amb = new THREE.AmbientLight('#b8c0d4', 0.4);
  scene.add(amb);
  LIGHTS = { hemi, sun, fill, amb };
}

let worldGroup = null;

export function buildWorld(scene, mapId = 'classroom') {
  if (!MAPS[mapId]) mapId = 'classroom';
  if (worldGroup) { scene.remove(worldGroup); worldGroup = null; }
  layout(mapId);
  const G = new THREE.Group();
  const add = o => { G.add(o); return o; };
  const surfaces = [], paperMeshes = [], bottleMeshes = [];
  const H = mapId === 'gym' ? 6.2 : 4.6;
  const night = mapId === 'detention';
  const PAL = {
    classroom: { wallTop: '#e7e2d2', wallBot: '#a8c4bc', deskTop: '#a9713f', chair: '#b5643c', leg: '#8a8f98', rail: '#8a6a42' },
    lab: { wallTop: '#eef2f4', wallBot: '#b8c8cc', deskTop: '#4a5560', chair: '#5a6570', leg: '#3a4048', rail: '#7a868c' },
    gym: { wallTop: '#d8d4c4', wallBot: '#9a8f6a', deskTop: '#8a8f98', chair: '#7a6f52', leg: '#6a6f78', rail: '#8a6a42' },
    library: { wallTop: '#d9cdb4', wallBot: '#7a5a3c', deskTop: '#6e4a28', chair: '#7d3f34', leg: '#4a3a28', rail: '#5a4228' },
    detention: { wallTop: '#3c4252', wallBot: '#2c3140', deskTop: '#5a4c3c', chair: '#4a4238', leg: '#3a3f48', rail: '#2a2f3a' },
  }[mapId];

  // ambience: sky, fog and the light rig take on the map's mood
  const A = AMB[mapId];
  scene.background = new THREE.Color(A.bg);
  scene.fog = new THREE.Fog(A.bg, night ? 16 : 24, night ? 38 : 46);
  if (LIGHTS) {
    LIGHTS.sun.intensity = A.sun; LIGHTS.sun.color.set(A.sunCol);
    LIGHTS.hemi.intensity = A.hemi;
    LIGHTS.amb.intensity = A.amb;
    LIGHTS.fill.intensity = A.amb * 0.8;   // cool fill tracks the mood
  }
  if (night) {
    // a warm desk lamp at the teacher's post and a cold moon wash
    const lamp = new THREE.PointLight('#ffb45a', 22, 12, 1.8);
    lamp.position.set(TEACHER_DESK.x + 0.9, 1.5, TEACHER_DESK.z + 0.2);
    add(lamp);
    const moon = new THREE.PointLight('#7a96d8', 14, 18, 1.6);
    moon.position.set(-ROOM.x + 1, 3.4, 0);
    add(moon);
  }

  // soft contact-shadow decal so furniture visibly "sits" on the floor
  const shadowTex = tex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(0.65, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: night ? 0.5 : 1 });
  const contact = (x, z, rx, rz = rx) => {
    const s = add(new THREE.Mesh(new THREE.PlaneGeometry(rx, rz), shadowMat));
    s.rotation.x = -Math.PI / 2; s.position.set(x, 0.018, z); s.renderOrder = 1;
  };

  // floor
  const floorMap = { classroom: plankTex(), lab: tileTex(), gym: courtTex(), library: carpetTex(), detention: plankTex(96, 14) }[mapId];
  const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2 + 1, ROOM.z * 2 + 1),
    new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.8 })));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;

  // walls + dado rail + baseboard + cornice + ceiling
  const wallTop = new THREE.MeshStandardMaterial({ map: paintTex(PAL.wallTop), roughness: 0.92 });
  const wallBot = new THREE.MeshStandardMaterial({ map: paintTex(PAL.wallBot), roughness: 0.86 });
  const base = mat('#4a4038', { roughness: 0.6 });
  const railM = mat(PAL.rail, { roughness: 0.55 });
  const cornM = mat(night ? '#3a4150' : '#f0ede2', { roughness: 0.7 });
  const mkWall = (w, x, z, ry) => {
    const along = ry === 0 || Math.abs(ry) === Math.PI;
    const top = add(new THREE.Mesh(new THREE.PlaneGeometry(w, H - 1.4), wallTop));
    top.position.set(x, 1.4 + (H - 1.4) / 2, z); top.rotation.y = ry; top.receiveShadow = true;
    const bot = add(new THREE.Mesh(new THREE.PlaneGeometry(w, 1.4), wallBot));
    bot.position.set(x, 0.7, z); bot.rotation.y = ry; bot.receiveShadow = true;
    // dado rail (chair rail) between the two tones, rounded profile
    const rail = add(new THREE.Mesh(new THREE.BoxGeometry(along ? w : 0.07, 0.1, along ? 0.07 : w), railM));
    rail.position.set(x, 1.42, z); rail.castShadow = true;
    const railLip = add(new THREE.Mesh(new THREE.BoxGeometry(along ? w : 0.04, 0.03, along ? 0.04 : w), railM));
    railLip.position.set(x, 1.49, z);
    // skirting board
    const bb = add(new THREE.Mesh(new THREE.BoxGeometry(along ? w : 0.09, 0.18, along ? 0.09 : w), base));
    bb.position.set(x, 0.09, z);
    // crown moulding at the ceiling
    const corn = add(new THREE.Mesh(new THREE.BoxGeometry(along ? w : 0.14, 0.16, along ? 0.14 : w), cornM));
    corn.position.set(x, H - 0.12, z);
  };
  mkWall(ROOM.x * 2 + 1, 0, -ROOM.z - 0.5, 0);
  mkWall(ROOM.x * 2 + 1, 0, ROOM.z + 0.5, Math.PI);
  mkWall(ROOM.z * 2 + 1, -ROOM.x - 0.5, 0, Math.PI / 2);
  mkWall(ROOM.z * 2 + 1, ROOM.x + 0.5, 0, -Math.PI / 2);
  const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2 + 1, ROOM.z * 2 + 1), mat(night ? '#262b38' : '#f2f0e8')));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H;

  // glowing ceiling light panels (dim, greenish in detention)
  for (const px of [-ROOM.x * 0.45, ROOM.x * 0.45]) for (const pz of [-ROOM.z * 0.42, ROOM.z * 0.42]) {
    const panel = add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.9), new THREE.MeshBasicMaterial({ color: A.panel })));
    panel.position.set(px, H - 0.05, pz);
    const rim = add(new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.05, 1.04), mat('#9aa0aa')));
    rim.position.set(px, H - 0.02, pz);
  }

  // the exam board
  const boardTitle = { classroom: 'FINAL EXAM', lab: 'LAB FINAL', gym: 'PE THEORY EXAM', library: 'LIBRARY QUIZ', detention: 'DETENTION EXAM' }[mapId];
  const white = mapId === 'lab';
  const board = add(new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.3), new THREE.MeshStandardMaterial({
    map: tex(1024, 384, (c, w, h) => {
      c.fillStyle = white ? '#f2f6f6' : night ? '#20301f' : '#2b4433'; c.fillRect(0, 0, w, h);
      c.fillStyle = white ? '#2b4a8c' : 'rgba(240,240,220,0.92)'; c.font = 'bold 66px Georgia';
      c.fillText(boardTitle, 56, 100);
      c.font = '40px Georgia'; c.globalAlpha = 0.85;
      c.fillText('• eyes on your OWN paper', 60, 190);
      c.fillText('• absolutely NO cheating', 60, 260);
      c.globalAlpha = 0.5; c.strokeStyle = white ? '#2b4a8c' : '#f0f0dc'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(52, 122); c.lineTo(470, 118); c.stroke();
    }), roughness: 0.95,
  })));
  board.position.set(BOARD.x, 2.15, -ROOM.z - 0.44);
  const frame = mat('#6b4a2a', { roughness: 0.65 });
  for (const [w2, h2, x2, y2] of [[6.7, 0.12, BOARD.x, 3.36], [6.7, 0.12, BOARD.x, 0.94], [0.12, 2.55, BOARD.x - 3.32, 2.15], [0.12, 2.55, BOARD.x + 3.32, 2.15]]) {
    const f = add(new THREE.Mesh(new THREE.BoxGeometry(w2, h2, 0.08), frame));
    f.position.set(x2, y2, -ROOM.z - 0.42);
  }
  const chalkTray = add(new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.06, 0.18), frame));
  chalkTray.position.set(BOARD.x, 0.9, -ROOM.z - 0.36);

  // windows on the left wall: proper cased frames with a sill, cross mullions
  // dividing four panes, and glass that glows a little (library has shelves
  // there instead; detention shows the night sky and one is boarded up)
  if (mapId !== 'library') {
    const wy = mapId === 'gym' ? 3.9 : 2.3, wh = mapId === 'gym' ? 1.5 : 2.0, ww = 2.4;
    const winList = [-ROOM.z * 0.5, 0.1 * ROOM.z, ROOM.z * 0.64];
    const wallX = -ROOM.x - 0.5, glassX = wallX + 0.09, frameX = wallX + 0.16;
    const skyTex = tex(256, 256, (c) => {
      if (night) {
        const g2 = c.createLinearGradient(0, 0, 0, 256);
        g2.addColorStop(0, '#0a1024'); g2.addColorStop(1, '#20325c');
        c.fillStyle = g2; c.fillRect(0, 0, 256, 256);
        c.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 55; i++) c.fillRect(Math.random() * 256, Math.random() * 256, 1.5 + Math.random(), 1.5 + Math.random());
        c.fillStyle = '#eef1f8'; c.beginPath(); c.arc(188, 58, 25, 0, 7); c.fill();
        c.fillStyle = '#20325c'; c.beginPath(); c.arc(199, 50, 21, 0, 7); c.fill();
      } else {
        const g2 = c.createLinearGradient(0, 0, 0, 256);
        g2.addColorStop(0, '#7fb0ec'); g2.addColorStop(0.58, '#cbe2f6'); g2.addColorStop(1, '#e8f2dc');
        c.fillStyle = g2; c.fillRect(0, 0, 256, 256);
        c.fillStyle = 'rgba(255,255,255,0.94)';
        for (const [x2, y2, rx, ry2] of [[58, 66, 30, 16], [96, 78, 38, 20], [176, 54, 26, 14], [212, 92, 22, 12]]) {
          c.beginPath(); c.ellipse(x2, y2, rx, ry2, 0, 0, 7); c.fill();
        }
        c.fillStyle = '#7fb45e'; c.fillRect(0, 214, 256, 42);
        c.fillStyle = '#6aa04e'; for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(i * 28, 214); c.lineTo(i * 28 + 13, 190); c.lineTo(i * 28 + 26, 214); c.fill(); }
      }
    });
    const frameM = mat(night ? '#39414f' : '#f2efe6', { roughness: 0.55 });
    const glassM = new THREE.MeshStandardMaterial({
      map: skyTex, roughness: 0.12, metalness: 0.0,
      emissive: new THREE.Color(night ? '#16294f' : '#bcd6f2'), emissiveIntensity: night ? 0.55 : 0.22,
    });
    winList.forEach((wz, wi) => {
      const glass = add(new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), glassM));
      glass.rotation.y = Math.PI / 2; glass.position.set(glassX, wy, wz);
      // outer casing bars (thin in x = depth into room, proud of the glass)
      for (const zz of [wz - ww / 2 - 0.07, wz + ww / 2 + 0.07]) {
        const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.18, wh + 0.28, 0.12), frameM));
        m.position.set(frameX, wy, zz); m.castShadow = true;
      }
      for (const yy of [wy - wh / 2 - 0.07, wy + wh / 2 + 0.07]) {
        const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, ww + 0.26), frameM));
        m.position.set(frameX, yy, wz); m.castShadow = true;
      }
      // cross mullions → four panes
      const mv = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, wh, 0.05), frameM)); mv.position.set(frameX - 0.02, wy, wz);
      const mh = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, ww), frameM)); mh.position.set(frameX - 0.02, wy, wz);
      // sill jutting into the room
      const sill = add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, ww + 0.5), frameM));
      sill.position.set(wallX + 0.22, wy - wh / 2 - 0.16, wz); sill.castShadow = sill.receiveShadow = true;
      if (night && wi === 2) for (const rot of [0.5, -0.4]) {   // boarded-up window
        const plank = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 2.7), mat('#5a4632', { roughness: 0.9 })));
        plank.position.set(frameX + 0.02, wy, wz); plank.rotation.x = rot; plank.castShadow = true;
      }
    });
  }

  // posters / decorations
  const poster = (draw, x, z, ry, w = 1.1, h = 1.5, y = 2.5) => {
    const p = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tex(220, Math.round(220 * h / w), draw), roughness: 0.9 })));
    p.position.set(x, y, z); p.rotation.y = ry;
  };
  const txtPoster = (txt, bg) => (c, w, h) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = 'bold 40px system-ui'; c.textAlign = 'center';
    txt.split('\n').forEach((l, i) => c.fillText(l, w / 2, h / 2 - 20 + i * 52));
  };

  if (mapId === 'classroom') {
    poster(txtPoster('STUDY\nHARD', '#4e8a5e'), ROOM.x + 0.44, -3, -Math.PI / 2);
    poster(txtPoster('NO\nEXCUSES', '#b9553e'), ROOM.x + 0.44, 1.5, -Math.PI / 2);
    poster(txtPoster('SILENCE', '#46608a'), -4.5, -ROOM.z - 0.44, 0);
    // bookshelf, globe, plant, backpacks
    const shelf = add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 0.5), mat('#6e4a28', { roughness: 0.7 })));
    shelf.position.set(4.6, 1.05, ROOM.z + 0.22); shelf.castShadow = true;
    for (let s = 0; s < 3; s++) {
      const row = add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.52),
        new THREE.MeshStandardMaterial({ map: bookRowTex(), roughness: 0.9 })));
      row.position.set(4.6, 0.55 + s * 0.62, ROOM.z - 0.045); row.rotation.y = Math.PI;
    }
    const globe = add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mat('#4a7ac0', { roughness: 0.4 })));
    globe.position.set(TEACHER_DESK.x - 0.85, 1.18, TEACHER_DESK.z);
    const pot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.34, 12), mat('#a05a32')));
    pot.position.set(-ROOM.x + 0.6, 0.17, ROOM.z - 0.5);
    for (let i = 0; i < 5; i++) {
      const leaf = add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7, 7), mat('#3f7a44', { roughness: 0.7 })));
      const a = i / 5 * Math.PI * 2;
      leaf.position.set(-ROOM.x + 0.6 + Math.cos(a) * 0.1, 0.68, ROOM.z - 0.5 + Math.sin(a) * 0.1);
      leaf.rotation.z = Math.cos(a) * 0.5; leaf.rotation.x = -Math.sin(a) * 0.5;
    }
    [[1, '#b9553e'], [4, '#46608a'], [7, '#4e8a5e']].forEach(([i, col]) => {
      const d = DESKS[i];
      const bp = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.2, 4, 10), mat(col, { roughness: 0.8 })));
      bp.position.set(d.x + 0.75, 0.26, d.z + 0.5); bp.rotation.z = 0.35; bp.castShadow = true;
    });
  } else if (mapId === 'lab') {
    poster((c, w, h) => {
      c.fillStyle = '#f4f1e6'; c.fillRect(0, 0, w, h);
      const cols = ['#c05050', '#5080c0', '#50a070', '#c0a050', '#9060b0'];
      for (let r = 0; r < 6; r++) for (let q = 0; q < 8; q++) {
        c.fillStyle = cols[(r * 8 + q) % 5]; c.fillRect(10 + q * 25, 30 + r * 25, 22, 22);
      }
      c.fillStyle = '#333'; c.font = 'bold 20px system-ui'; c.textAlign = 'center';
      c.fillText('ELEMENTS', w / 2, 20);
    }, ROOM.x + 0.44, -2, -Math.PI / 2, 1.6, 1.4);
    poster(txtPoster('SAFETY\nFIRST', '#c07030'), -4.2, -ROOM.z - 0.44, 0);
    // cabinets along the back wall + wall shelf with flasks
    for (const cx of [-4.4, -1.8, 0.8, 3.4]) {
      const cab = add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.0, 0.55), mat('#8a949c', { roughness: 0.5 })));
      cab.position.set(cx, 0.5, ROOM.z + 0.2); cab.castShadow = true;
      const hdl = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), mat('#3a4048')));
      hdl.position.set(cx, 0.62, ROOM.z - 0.09);
    }
    const shelf = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 4.4), mat('#7a5a38')));
    shelf.position.set(ROOM.x + 0.35, 1.9, 2.6);
    for (let i = 0; i < 6; i++) {
      const f = add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 10),
        mat(['#5aa3d8', '#c05a8a', '#5ac07a', '#d8b04e'][i % 4], { roughness: 0.25, transparent: true, opacity: 0.85 })));
      f.position.set(ROOM.x + 0.35, 2.03, 0.9 + i * 0.72);
    }
    // hazard stripe strip under the board
    poster((c, w, h) => {
      for (let i = -2; i < 10; i++) {
        c.fillStyle = i % 2 ? '#e8c020' : '#232323';
        c.beginPath(); c.moveTo(i * 30, 0); c.lineTo(i * 30 + 30, 0); c.lineTo(i * 30 + 10, h); c.lineTo(i * 30 - 20, h); c.fill();
      }
    }, BOARD.x, -ROOM.z - 0.43, 0, 6.6, 0.28, 0.68);
  } else if (mapId === 'gym') {
    poster(txtPoster('GO\nTEAM', '#b9553e'), -4.5, -ROOM.z - 0.44, 0, 1.3, 1.7, 3.4);
    // scoreboard
    poster((c, w, h) => {
      c.fillStyle = '#1a1e28'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e8c020'; c.font = 'bold 30px monospace'; c.textAlign = 'center';
      c.fillText('HOME 42', w / 2, 44);
      c.fillStyle = '#e05a4a'; c.fillText('GUEST 7', w / 2, 86);
      c.strokeStyle = '#4a5060'; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8);
    }, 4.2, -ROOM.z - 0.42, 0, 2.2, 1.1, 4.2);
    // hanging banners
    [['#b9553e', 'EXAM CUP'], ['#46608a', 'DIV 1'], ['#4e8a5e', 'CHAMPS']].forEach(([col, txt], i) => {
      poster((c, w, h) => {
        c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w, h * 0.72); c.lineTo(w / 2, h); c.lineTo(0, h * 0.72); c.fill();
        c.fillStyle = '#fff'; c.font = 'bold 26px system-ui'; c.textAlign = 'center'; c.fillText(txt, w / 2, 44);
      }, -6 + i * 3.2, ROOM.z + 0.42, Math.PI, 1.1, 1.5, 4.6);
    });
    // bleachers along the right wall
    for (let s = 0; s < 3; s++) {
      const step = add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, ROOM.z * 2 - 3), mat('#8a6a42', { roughness: 0.7 })));
      step.position.set(ROOM.x - 1.35 + s * 0.45, 0.21 + s * 0.42, 0);
      step.castShadow = step.receiveShadow = true;
    }
    // basketball hoop + cones
    const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.9, 10), mat('#5a6068', { roughness: 0.4 })));
    pole.position.set(-ROOM.x + 1.2, 1.95, ROOM.z + 0.2);
    const back = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.06), mat('#e8e8e0', { roughness: 0.5 })));
    back.position.set(-ROOM.x + 1.2, 3.9, ROOM.z + 0.1);
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 20), mat('#c05a30', { roughness: 0.4 })));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-ROOM.x + 1.2, 3.55, ROOM.z - 0.25);
    for (let i = 0; i < 3; i++) {
      const cone = add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 10), mat('#e07030', { roughness: 0.6 })));
      cone.position.set(-ROOM.x + 1.4 + i * 0.5, 0.18, -ROOM.z + 1.2);
      cone.castShadow = true;
    }
  } else if (mapId === 'library') {
    poster(txtPoster('SHHH!', '#46608a'), -4.2, -ROOM.z - 0.44, 0);
    poster(txtPoster('READ\nMORE', '#4e8a5e'), 4.2, ROOM.z + 0.44, Math.PI);
    // tall shelf walls down both sides, stuffed with books
    for (const side of [-1, 1]) {
      for (let s = 0; s < 4; s++) {
        const zc = -ROOM.z + 2.2 + s * ((ROOM.z * 2 - 4.4) / 3);
        const case_ = add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.6, 3.2), mat('#5a4228', { roughness: 0.7 })));
        case_.position.set(side * (ROOM.x - 0.35), 1.3, zc);
        case_.castShadow = case_.receiveShadow = true;
        for (let r = 0; r < 4; r++) {
          const row = add(new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.5),
            new THREE.MeshStandardMaterial({ map: bookRowTex(), roughness: 0.9 })));
          row.position.set(side * (ROOM.x - 0.35 - side * 0.44), 0.5 + r * 0.6, zc);
          row.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
    }
    // reading lamps on the desks (warm dot of light, no perf cost)
    DESKS.forEach(d => {
      const armM = mat('#2a5a3a', { roughness: 0.4, metalness: 0.3 });
      const stem = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.24, 8), armM));
      stem.position.set(d.x - 0.62, 1.22, d.deskZ + 0.28);
      const shade = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.1, 10, 1, true),
        new THREE.MeshStandardMaterial({ color: '#2a5a3a', roughness: 0.4, side: THREE.DoubleSide, emissive: '#ffdf9a', emissiveIntensity: 0.35 })));
      shade.position.set(d.x - 0.62, 1.36, d.deskZ + 0.28); shade.rotation.z = 0.5;
    });
  } else {
    // detention: bare, cold, one flickery mood
    poster(txtPoster('NO\nTALKING', '#6a3030'), -4.0, -ROOM.z - 0.44, 0);
    poster(txtPoster('NO\nFUN', '#3a3a4a'), ROOM.x + 0.44, 1.2, -Math.PI / 2);
    poster((c, w, h) => {   // rules sheet, half torn
      c.fillStyle = '#d8d2c0'; c.fillRect(0, 0, w, h * 0.8);
      c.fillStyle = '#5a5248'; c.font = '16px Georgia';
      for (let i = 0; i < 6; i++) c.fillRect(16, 22 + i * 24, w - 40 - Math.random() * 60, 4);
      c.fillStyle = '#8a2f2f'; c.font = 'bold 22px Georgia'; c.textAlign = 'center';
      c.fillText('DETENTION RULES', w / 2, 16);
    }, 3.4, -ROOM.z - 0.44, 0, 0.9, 1.2);
    // stacked old chairs in a corner
    for (let i = 0; i < 3; i++) {
      const ch = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.09, 0.7), mat('#4a4238', { roughness: 0.8 })));
      ch.position.set(-ROOM.x + 0.9, 0.35 + i * 0.28, ROOM.z - 0.9);
      ch.rotation.y = i * 0.4; ch.castShadow = true;
    }
    // mop + bucket
    const bucket = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 12), mat('#5a6068', { roughness: 0.4, metalness: 0.4 })));
    bucket.position.set(ROOM.x - 0.7, 0.15, ROOM.z - 0.7);
    const mop = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), mat('#8a6a42')));
    mop.position.set(ROOM.x - 0.62, 0.9, ROOM.z - 0.62); mop.rotation.z = 0.25;
  }

  // student desks + chairs (+ paper, bottle, map-specific desk prop)
  const metalTable = mapId === 'lab' || mapId === 'gym';
  const wood = metalTable
    ? mat(PAL.deskTop, { roughness: 0.4, metalness: 0.2 })
    : new THREE.MeshStandardMaterial({ map: woodGrainTex(PAL.deskTop), roughness: 0.48 });
  const leg = mat(PAL.leg, { roughness: 0.4, metalness: 0.35 });
  const edgeM = mat(PAL.leg, { roughness: 0.5, metalness: 0.25 });
  const bottleCol = ['#7ab8e0', '#e08fb4', '#8fd0a0', '#e0c47a', '#a89ae0'];
  // a printed exam sheet: ruled lines, red margin, header and a couple of marks
  const paperTex = tex(280, 360, (c, w, h) => {
    c.fillStyle = '#f7f2e2'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(180,168,138,${Math.random() * 0.07})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.strokeStyle = '#cf9a94'; c.lineWidth = 2; c.beginPath(); c.moveTo(30, 0); c.lineTo(30, h); c.stroke();
    c.fillStyle = '#6a2020'; c.font = 'bold 22px Georgia'; c.fillText('FINAL EXAM', 42, 34);
    c.strokeStyle = 'rgba(90,110,150,0.32)'; c.lineWidth = 1.4;
    for (let y = 54; y < h - 12; y += 22) { c.beginPath(); c.moveTo(36, y); c.lineTo(w - 14, y); c.stroke(); }
    c.strokeStyle = 'rgba(35,35,55,0.55)'; c.lineWidth = 2.2;
    for (let k = 0; k < 6; k++) {
      const y = 70 + k * 40; c.beginPath(); c.moveTo(44, y);
      c.bezierCurveTo(80, y - 7, 140, y + 5, 70 + Math.random() * 120, y - 1); c.stroke();
    }
  });
  DESKS.forEach((d, i) => {
    contact(d.x, d.deskZ, 2.0, 1.3);          // grounding shadow under desk
    contact(d.x, d.z + 0.15, 1.0, 1.0);       // and under the chair
    const top = add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 1.0), wood));
    top.position.set(d.x, 1.07, d.deskZ); top.castShadow = top.receiveShadow = true;
    surfaces.push({ mesh: top, desk: i });
    // trim band just under the top + a modesty apron at the front
    const band = add(new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.05, 1.04), edgeM));
    band.position.set(d.x, 1.02, d.deskZ);
    const apron = add(new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.22, 0.05), wood));
    apron.position.set(d.x, 0.9, d.deskZ - 0.4); apron.castShadow = true;
    // slightly tapered legs
    for (const [lx, lz] of [[-0.76, -0.4], [0.76, -0.4], [-0.76, 0.4], [0.76, 0.4]]) {
      const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.042, 1.0, 12), leg));
      l.position.set(d.x + lx, 0.5, d.deskZ + lz); l.castShadow = true;
    }
    // stretcher bars between each side's legs for a real-furniture look
    for (const lx of [-0.76, 0.76]) {
      const sb = add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.78, 8), leg));
      sb.position.set(d.x + lx, 0.26, d.deskZ); sb.rotation.x = Math.PI / 2;
    }
    const paper = add(new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.72), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.95 })));
    paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.06;
    paper.position.set(d.x + 0.15, 1.115, d.deskZ + 0.02);
    paperMeshes.push(paper);
    // rounded water bottle: translucent body, shoulder, cap, and a label band
    const bMat = new THREE.MeshStandardMaterial({ color: bottleCol[i % bottleCol.length], roughness: 0.14, metalness: 0.05, transparent: true, opacity: 0.9 });
    const bottle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.3, 20), bMat));
    bottle.position.set(d.x - 0.6, 1.25, d.deskZ - 0.25); bottle.castShadow = true;
    bottleMeshes.push(bottle);
    const shoulder = add(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.068, 0.07, 18), bMat));
    shoulder.position.set(d.x - 0.6, 1.435, d.deskZ - 0.25);
    const neck = add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 12), bMat));
    neck.position.set(d.x - 0.6, 1.485, d.deskZ - 0.25);
    const cap = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 14), mat('#2d5b80', { roughness: 0.4 })));
    cap.position.set(d.x - 0.6, 1.52, d.deskZ - 0.25);
    const label = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0735, 0.0735, 0.13, 20, 1, true), mat('#eef2ee', { roughness: 0.75, side: THREE.DoubleSide })));
    label.position.set(d.x - 0.6, 1.235, d.deskZ - 0.25);
    if (mapId === 'lab') {
      const fl = add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 10),
        mat(['#5ac07a', '#c05a8a', '#d8b04e'][i % 3], { roughness: 0.25, transparent: true, opacity: 0.85 })));
      fl.position.set(d.x + 0.62, 1.2, d.deskZ - 0.3);
    } else if (mapId === 'library' && i % 2 === 0) {
      const bk = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.22), mat(['#8a3a34', '#3a5a8a', '#3f7a4c'][i % 3], { roughness: 0.8 })));
      bk.position.set(d.x + 0.6, 1.13, d.deskZ + 0.25); bk.rotation.y = 0.4;
    }
    // contoured moulded-plastic chair on a tapered metal-tube frame
    const cz = d.z + 0.15, cMat = mat(PAL.chair, { roughness: 0.5, metalness: 0.05 });
    const seat = add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.055, 0.72, 2, 1, 2), cMat));
    seat.position.set(d.x, 0.6, cz); seat.rotation.x = -0.04; seat.castShadow = true;
    const seatLip = add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.8, 12), cMat));
    seatLip.rotation.z = Math.PI / 2; seatLip.position.set(d.x, 0.585, cz - 0.35);
    const back = add(new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.44, 0.05, 2, 1, 1), cMat));
    back.position.set(d.x, 1.0, cz + 0.34); back.rotation.x = 0.14; back.castShadow = true;
    const topBar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.76, 12), cMat));
    topBar.rotation.z = Math.PI / 2; topBar.position.set(d.x, 1.22, cz + 0.31);
    const cLegM = mat(PAL.leg, { roughness: 0.32, metalness: 0.55 });
    for (const [lx, lz, rz, rx] of [[-0.33, -0.29, -0.06, -0.05], [0.33, -0.29, 0.06, -0.05], [-0.33, 0.35, -0.06, 0.04], [0.33, 0.35, 0.06, 0.04]]) {
      const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.03, 0.6, 10), cLegM));
      l.position.set(d.x + lx, 0.3, cz + lz); l.rotation.z = rz; l.rotation.x = rx; l.castShadow = true;
    }
    for (const lz of [-0.29, 0.35]) {   // stretcher rails low on the frame
      const sb = add(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.68, 8), cLegM));
      sb.rotation.z = Math.PI / 2; sb.position.set(d.x, 0.11, cz + lz);
    }
  });

  // teacher's desk + phone
  contact(TEACHER_DESK.x, TEACHER_DESK.z, 3.0, 1.5);
  const tdesk = add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.1), mat('#7a5230', { roughness: 0.6 })));
  tdesk.position.set(TEACHER_DESK.x, 0.5, TEACHER_DESK.z);
  tdesk.castShadow = tdesk.receiveShadow = true;
  const phoneBase = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.22), mat('#b03a30', { roughness: 0.4 })));
  phoneBase.position.set(TEACHER_DESK.x + 0.8, 1.06, TEACHER_DESK.z);
  const handset = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.24, 6, 10), mat('#b03a30', { roughness: 0.4 })));
  handset.rotation.z = Math.PI / 2;
  handset.position.set(TEACHER_DESK.x + 0.8, 1.16, TEACHER_DESK.z);

  // shame stool
  contact(STOOL.x, STOOL.z, 0.9, 0.9);
  const stoolTop = add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 18), mat('#8a5a34', { roughness: 0.6 })));
  stoolTop.position.set(STOOL.x, 0.62, STOOL.z); stoolTop.castShadow = true;
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.6, 8), mat(PAL.leg)));
    l.position.set(STOOL.x + Math.cos(a) * 0.2, 0.31, STOOL.z + Math.sin(a) * 0.2);
    l.rotation.z = Math.cos(a) * 0.12; l.rotation.x = -Math.sin(a) * 0.12;
  }

  // door on the right wall
  const door = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 1.1), mat('#6b4a2a', { roughness: 0.6 })));
  door.position.set(ROOM.x + 0.42, 1.15, ROOM.z * 0.66);
  const knob = add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('#d8c26a', { metalness: 0.5, roughness: 0.3 })));
  knob.position.set(ROOM.x + 0.35, 1.15, ROOM.z * 0.66 - 0.35);

  // clock above the board
  const clockFace = add(new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), mat('#f4f4ee', { roughness: 0.4 })));
  clockFace.position.set(BOARD.x + 4.6, 3.6, -ROOM.z - 0.44);
  const ring2 = add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 24), mat('#333')));
  ring2.position.copy(clockFace.position);
  const hand = add(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.26, 0.02), mat('#222')));
  hand.geometry.translate(0, 0.13, 0);
  hand.position.set(clockFace.position.x, clockFace.position.y, clockFace.position.z + 0.02);

  scene.add(G);
  worldGroup = G;
  return { surfaces, paperMeshes, bottleMeshes, clockHand: hand, mapId };
}

// keep a walking body out of desks/furniture. Obstacles are tight rectangles
// matching the actual furniture footprints (no invisible force fields), and
// the push-out is along the shallow axis so you slide along edges naturally.
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

layout('classroom');
