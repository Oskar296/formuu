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

export const BOARD_ZONE = { x: 0, z: -6.6, r: 2.6 };
export const TEACHER_DESK = { x: 6.8, z: -5.6, r: 2.2 };
export const STOOL = { x: -7.6, z: -5.6 };
export const ROOM = { x: 11, z: 8 };

export const SHIRTS = ['#d95d4c', '#4e86c7', '#56a05c', '#d0a844', '#9a6bc9',
  '#3fb3a5', '#c75e9a', '#8a9a4e', '#c77e4e'];
const HAIR = ['#3a2a1c', '#171310', '#7a4a22', '#b8862e', '#57432e', '#20242c', '#8a3a22', '#4a3424', '#2c2018'];
const SKINS = ['#e8bd96', '#d9a878', '#c68e62', '#f0cba6', '#b97a50'];

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
      c.strokeStyle = 'rgba(60,35,15,0.16)';
      for (let i = 0; i < 5; i++) {
        c.lineWidth = 1 + rnd();
        c.beginPath();
        const gy = y + rnd() * plankH;
        c.moveTo(0, gy);
        c.bezierCurveTo(w * 0.3, gy + rnd() * 6 - 3, w * 0.7, gy + rnd() * 6 - 3, w, gy);
        c.stroke();
      }
      c.fillStyle = dark;
      for (let sx = (rnd() * w) | 0; sx < w; sx += 200 + rnd() * 300) c.fillRect(sx, y, 2, plankH);
    }
    // soft vignette for baked-light feel
    const g = c.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,15,5,0.18)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  };
}

const floorTex = texture(1024, 1024, woodDraw('#9c6a40', '#b0824f', '#6f4526', 128), [5, 5]);
const deskTex = texture(512, 512, woodDraw('#9a6a3e', '#ad7c4c', '#75481f', 256), [1, 1]);
const darkWoodTex = texture(512, 512, woodDraw('#6f4526', '#7f5433', '#4f2e14', 256), [1, 1]);

function plasterDraw(base) {
  return (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      c.fillStyle = rnd() < 0.5 ? 'rgba(110,100,80,0.05)' : 'rgba(255,255,255,0.06)';
      c.fillRect(rnd() * w, rnd() * h, 1.7, 1.7);
    }
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,250,235,0.10)');
    g.addColorStop(1, 'rgba(40,30,20,0.12)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  };
}
const wallUpperTex = texture(512, 512, plasterDraw('#e9e2cd'), [4, 1.6]);
const wallLowerTex = texture(512, 512, plasterDraw('#9fb8a4'), [4, 1]);

const ceilTex = texture(512, 512, (c, w, h) => {
  c.fillStyle = '#eeece2'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(150,145,130,0.55)'; c.lineWidth = 3;
  for (let x = 0; x <= w; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y <= h; y += 128) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (let i = 0; i < 900; i++) {
    c.fillStyle = 'rgba(120,115,100,0.08)';
    c.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
}, [5, 4]);

const boardTex = texture(1024, 512, (c, w, h) => {
  c.fillStyle = '#2c4a3c'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    c.strokeStyle = `rgba(230,235,225,${0.02 + rnd() * 0.03})`;
    c.lineWidth = 8 + rnd() * 26;
    c.beginPath();
    const y = rnd() * h, x = rnd() * w;
    c.moveTo(x, y);
    c.bezierCurveTo(x + 80, y - 20 + rnd() * 40, x + 200, y - 20 + rnd() * 40, x + 260 + rnd() * 140, y + rnd() * 30);
    c.stroke();
  }
  c.fillStyle = 'rgba(235,238,230,0.88)';
  c.font = "bold 64px 'Segoe Print', 'Comic Sans MS', cursive";
  c.fillText('EXAM — section 7B', 60, 130);
  c.font = "42px 'Segoe Print', 'Comic Sans MS', cursive";
  c.fillStyle = 'rgba(235,238,230,0.6)';
  c.fillText('eyes on your OWN paper.', 64, 210);
});

const skyTex = texture(512, 512, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#79b2e8'); g.addColorStop(0.62, '#cfe6f7'); g.addColorStop(1, '#e8f3e4');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,250,215,0.95)';
  c.beginPath(); c.arc(w * 0.72, h * 0.22, 44, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath(); c.arc(w * 0.72, h * 0.22, 62, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.88)';
  for (const [cx, cy, s] of [[120, 150, 40], [210, 128, 55], [300, 340, 46], [430, 290, 34]]) {
    for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(cx + i * s * 0.55, cy + (i % 2) * 10, s * 0.6, s * 0.38, 0, 0, 7); c.fill(); }
  }
  // distant rooftops
  c.fillStyle = 'rgba(90,100,90,0.5)';
  for (let x = 0; x < w; x += 90) c.fillRect(x, h - 60 - rnd() * 40, 70, 120);
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

const clockTex = texture(256, 256, (c) => {
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

const blobTex = texture(128, 128, (c, w, h) => {
  const g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.42)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});

// ---------------------------------------------------------------- helpers

const mats = new Map();
const mat = (c, o = {}) => {
  const k = c + JSON.stringify(Object.keys(o)) + (o.map ? o.map.uuid : '');
  // never tint a texture: maps carry their own color
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: o.map ? '#ffffff' : c, roughness: 0.85, ...o }));
  return mats.get(k);
};
const darkWoodMat = () => mat('#6f4526', { map: darkWoodTex, roughness: 0.6 });

let SURFACES = [];
function box(parent, w, h, d, c, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.material || mat(c));
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  m.castShadow = !opts.noShadow; m.receiveShadow = true;
  parent.add(m);
  SURFACES.push(m);
  return m;
}

// fake contact shadow — huge ambient-occlusion feel for free
export function blobShadow(parent, w, d, x = 0, z = 0, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.015, z);
  m.renderOrder = 1;
  parent.add(m);
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
  scene.background = new THREE.Color('#191c24');
  scene.fog = new THREE.Fog('#191c24', 36, 85);

  scene.add(new THREE.HemisphereLight('#dfe8ff', '#5c4c3c', 0.75));
  scene.add(new THREE.AmbientLight('#b0a8bc', 0.32));
  const sun = new THREE.DirectionalLight('#ffd9a8', 2.3);
  sun.position.set(18, 10.5, -1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
  sun.shadow.bias = -0.0003;
  sun.shadow.radius = 5;
  scene.add(sun);

  // floor / ceiling
  box(scene, ROOM.x * 2, 0.2, ROOM.z * 2, null, 0, -0.1, 0, { material: mat('#9c6a40', { map: floorTex, roughness: 0.55 }), noShadow: true });
  box(scene, ROOM.x * 2, 0.2, ROOM.z * 2, null, 0, 4.4, 0, { material: mat('#eeece2', { map: ceilTex, roughness: 0.95 }), noShadow: true });

  // two-tone walls: painted lower band + plaster upper + wooden chair rail
  const upper = mat('#e9e2cd', { map: wallUpperTex });
  const lower = mat('#9fb8a4', { map: wallLowerTex });
  const rail = darkWoodMat();
  function wall(w, d, x, z, ry) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    box(g, w, 1.3, d, null, 0, 0.65, 0, { material: lower, noShadow: true });
    box(g, w, 0.09, d + 0.04, null, 0, 1.34, 0, { material: rail, noShadow: true });
    box(g, w, 3.02, d, null, 0, 2.89, 0, { material: upper, noShadow: true });
    box(g, w, 0.2, d + 0.03, '#7a5c3a', 0, 0.1, 0, { noShadow: true });
    scene.add(g);
  }
  wall(ROOM.x * 2, 0.3, 0, -ROOM.z, 0);
  wall(ROOM.x * 2, 0.3, 0, ROOM.z, 0);
  wall(ROOM.z * 2, 0.3, -ROOM.x, 0, Math.PI / 2);
  wall(ROOM.z * 2, 0.3, ROOM.x, 0, Math.PI / 2);

  // ceiling light fixtures
  for (const lx of [-6, 0, 6]) {
    box(scene, 2.6, 0.1, 0.95, '#d8d5c8', lx, 4.3, 0, { noShadow: true });
    box(scene, 2.4, 0.06, 0.8, null, lx, 4.24, 0, { material: mat('#fbf8ee', { emissive: '#fff3d4', emissiveIntensity: 1.1 }), noShadow: true });
    const pl = new THREE.PointLight('#ffedd0', 13, 12.5, 2);
    pl.position.set(lx, 3.85, 0);
    scene.add(pl);
  }

  // blackboard
  box(scene, 8.4, 2.6, 0.08, null, 0, 2.25, -ROOM.z + 0.22, { material: darkWoodMat(), noShadow: true });
  box(scene, 8, 2.2, 0.06, null, 0, 2.25, -ROOM.z + 0.28, { material: mat('#2c4a3c', { map: boardTex, roughness: 0.92 }), noShadow: true });
  box(scene, 8.4, 0.1, 0.26, '#7a5c3a', 0, 1.05, -ROOM.z + 0.36);
  box(scene, 0.35, 0.05, 0.08, '#f4f2ea', 1.2, 1.12, -ROOM.z + 0.36, { noShadow: true });
  const eraser = box(scene, 0.5, 0.09, 0.14, '#8a8a92', -1.6, 1.13, -ROOM.z + 0.36, { noShadow: true });

  // windows (+x wall): sky, frames, sills, curtains, light shafts
  for (const wz of [-4.5, 0.5, 5]) {
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.1), new THREE.MeshBasicMaterial({ map: skyTex }));
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
    // curtain
    box(scene, 0.14, 2.5, 0.5, '#b0703f', ROOM.x - 0.24, 2.55, wz - 1.62, { noShadow: true });
    box(scene, 0.14, 2.5, 0.5, '#b0703f', ROOM.x - 0.24, 2.55, wz + 1.62, { noShadow: true });
    // light shaft
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.7),
      new THREE.MeshBasicMaterial({ color: '#ffe6bd', transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    shaft.position.set(ROOM.x - 3, 1.7, wz);
    shaft.rotation.set(0, 0, 0.53);
    shaft.rotateY(Math.PI / 2);
    scene.add(shaft);
  }

  // door (left wall)
  box(scene, 0.16, 3.1, 1.5, '#e5dfce', -ROOM.x + 0.16, 1.55, -5.5, { noShadow: true });
  box(scene, 0.12, 2.95, 1.34, null, -ROOM.x + 0.2, 1.48, -5.5, { material: darkWoodMat() });
  box(scene, 0.1, 0.5, 0.4, '#dfe8ea', -ROOM.x + 0.21, 2.3, -5.5, { noShadow: true }); // door window
  box(scene, 0.08, 0.08, 0.26, '#c9b64a', -ROOM.x + 0.3, 1.45, -5.02);

  // bookshelf along back wall
  {
    const g = new THREE.Group();
    g.position.set(-4, 0, ROOM.z - 0.62);
    scene.add(g);
    box(g, 5.2, 2.3, 0.5, null, 0, 1.15, 0, { material: darkWoodMat() });
    for (const sy of [0.55, 1.15, 1.75]) {
      box(g, 5, 0.06, 0.42, null, 0, sy, 0.02, { material: darkWoodMat(), noShadow: true });
      let bx = -2.35;
      while (bx < 2.3) {
        const bw = 0.1 + rnd() * 0.12, bh = 0.34 + rnd() * 0.14;
        box(g, bw, bh, 0.3, SHIRTS[(rnd() * SHIRTS.length) | 0], bx + bw / 2, sy + bh / 2 + 0.03, 0.03, { noShadow: true });
        bx += bw + 0.02 + (rnd() < 0.12 ? 0.2 : 0);
      }
    }
    blobShadow(scene, 6, 1.6, -4, ROOM.z - 0.62);
  }

  // posters + clock + plant
  const posters = [
    [posterTex('#3f5d8a', '🧠', 'THINK'), 3.4, 2.6, ROOM.z - 0.17, Math.PI],
    [posterTex('#7a4a8a', '🤫', 'SILENCE'), 6.4, 2.7, ROOM.z - 0.17, Math.PI],
    [posterTex('#3a7a5c', '📚', 'STUDY'), -ROOM.x + 0.17, 2.6, 1.5, Math.PI / 2],
    [posterTex('#8a5c3a', '⏰', 'NO EXCUSES'), -ROOM.x + 0.17, 2.6, -2.2, Math.PI / 2],
  ];
  for (const [tex, x, y, z, ry] of posters) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    p.position.set(x, y, z); p.rotation.y = ry; p.rotation.z = (rnd() - 0.5) * 0.04;
    scene.add(p);
    SURFACES.push(p);
  }
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.6 }));
  clock.position.set(0, 3.6, -ROOM.z + 0.32);
  scene.add(clock);
  SURFACES.push(clock);

  box(scene, 0.55, 0.5, 0.55, '#b06a4a', -ROOM.x + 1, 0.25, ROOM.z - 1);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.26 + rnd() * 0.18, 8, 6), mat('#3f7a4a', { roughness: 0.9 }));
    leaf.position.set(-ROOM.x + 1 + (rnd() - 0.5) * 0.45, 0.8 + rnd() * 0.55, ROOM.z - 1 + (rnd() - 0.5) * 0.45);
    leaf.castShadow = true;
    scene.add(leaf);
  }
  blobShadow(scene, 1.3, 1.3, -ROOM.x + 1, ROOM.z - 1);

  // teacher desk
  box(scene, 2.7, 0.12, 1.35, null, TEACHER_DESK.x, 0.95, TEACHER_DESK.z, { material: darkWoodMat() });
  box(scene, 2.45, 0.85, 1.12, null, TEACHER_DESK.x, 0.46, TEACHER_DESK.z, { material: darkWoodMat() });
  box(scene, 0.7, 0.16, 0.02, '#4a3018', TEACHER_DESK.x - 0.6, 0.62, TEACHER_DESK.z + 0.57);
  box(scene, 0.7, 0.16, 0.02, '#4a3018', TEACHER_DESK.x + 0.6, 0.62, TEACHER_DESK.z + 0.57);
  const phone = box(scene, 0.38, 0.15, 0.26, '#a83a30', TEACHER_DESK.x - 0.85, 1.09, TEACHER_DESK.z - 0.3);
  box(scene, 0.5, 0.04, 0.65, null, TEACHER_DESK.x + 0.2, 1.03, TEACHER_DESK.z, { material: mat('#f4efdf', { map: paperTex }), noShadow: true });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 12), mat('#4e86c7', { roughness: 0.5 }));
  globe.position.set(TEACHER_DESK.x + 0.9, 1.22, TEACHER_DESK.z - 0.25);
  globe.castShadow = true;
  scene.add(globe);
  box(scene, 0.06, 0.14, 0.06, '#3a3a40', TEACHER_DESK.x + 0.9, 1.05, TEACHER_DESK.z - 0.25);
  blobShadow(scene, 3.4, 2, TEACHER_DESK.x, TEACHER_DESK.z);

  // shame stool
  box(scene, 0.5, 0.09, 0.5, null, STOOL.x, 0.62, STOOL.z, { material: darkWoodMat() });
  for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]])
    box(scene, 0.07, 0.6, 0.07, '#5c3e22', STOOL.x + lx, 0.3, STOOL.z + lz);
  blobShadow(scene, 0.9, 0.9, STOOL.x, STOOL.z);

  // student desks
  const deskMeshes = [], paperMeshes = [], bottleMeshes = [];
  const deskMat = mat('#9a6a3e', { map: deskTex, roughness: 0.6 });
  const PENCILCASE = ['#c75d4e', '#4e86c7', '#68a75e'];
  DESKS.forEach((d, i) => {
    const top = box(scene, 1.5, 0.09, 0.95, null, d.x, 0.78, d.z, { material: deskMat });
    top.userData.seat = i;
    deskMeshes.push(top);
    box(scene, 1.42, 0.1, 0.06, '#7c5230', d.x, 0.72, d.z + 0.44, { noShadow: true });
    for (const [lx, lz] of [[-0.65, -0.38], [0.65, -0.38], [-0.65, 0.38], [0.65, 0.38]])
      box(scene, 0.08, 0.75, 0.08, '#4c4c54', d.x + lx, 0.39, d.z + lz);
    box(scene, 0.95, 0.07, 0.85, null, d.x, 0.52, d.z + 1.05, { material: deskMat });
    box(scene, 0.95, 0.8, 0.07, null, d.x, 0.98, d.z + 1.46, { material: deskMat });
    for (const [lx, lz] of [[-0.4, 0.72], [0.4, 0.72], [-0.4, 1.4], [0.4, 1.4]])
      box(scene, 0.07, 0.52, 0.07, '#4c4c54', d.x + lx, 0.26, d.z + lz);
    blobShadow(scene, 2.3, 1.7, d.x, d.z + 0.2);
    blobShadow(scene, 1.4, 1.4, d.x, d.z + 1.1, 0.8);

    const paper = box(scene, 0.6, 0.015, 0.8, null, d.x - 0.18, 0.835, d.z, { material: mat('#f4efdf', { map: paperTex }), noShadow: true });
    paper.userData.paperSeat = i;
    paper.rotation.y = (rnd() - 0.5) * 0.15;
    paperMeshes.push(paper);
    box(scene, 0.24, 0.025, 0.025, '#d0a030', d.x + 0.28, 0.84, d.z + 0.3, { ry: 0.5, noShadow: true });
    if (i % 3 === 0) box(scene, 0.3, 0.07, 0.12, PENCILCASE[i % 3], d.x + 0.4, 0.85, d.z + 0.1, { ry: -0.3, noShadow: true });
    if (i % 3 === 2) box(scene, 0.34, 0.05, 0.26, '#e8e2d0', d.x - 0.5, 0.84, d.z - 0.28, { ry: 0.2, noShadow: true }); // notebook

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
    if (i % 2 === 0) box(scene, 0.4, 0.5, 0.28, SHIRTS[(i + 3) % SHIRTS.length], d.x - 0.95, 0.25, d.z + 0.9, { ry: 0.3 });
  });

  return { deskMeshes, paperMeshes, bottleMeshes, phone, eraser, surfaces: SURFACES.slice() };
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

// ---- traps ----------------------------------------------------------------

export function makeTrapMesh(scene, kind, pos, normal) {
  const g = new THREE.Group();
  if (kind === 'marbles') {
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8),
        mat(['#c9d6e8', '#d68a5a', '#8ac95e', '#d65a8a'][i % 4], { roughness: 0.15, metalness: 0.1 }));
      m.position.set((Math.random() - 0.5) * 0.55, 0.045, (Math.random() - 0.5) * 0.55);
      m.castShadow = true;
      g.add(m);
    }
    g.position.set(pos[0], 0, pos[2]);
  } else if (kind === 'glue') {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.42, 22),
      mat('#e8d9a0', { roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.75 }));
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.y = 0.02;
    g.add(puddle);
    g.position.set(pos[0], 0, pos[2]);
  } else if (kind === 'pepper') {
    const dust = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.16),
      mat('#b83a2a', { roughness: 0.9, transparent: true, opacity: 0.85 }));
    dust.position.set(pos[0], pos[1], pos[2]);
    g.add(dust);
  } else if (kind === 'clock') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14), mat('#c23a30', { roughness: 0.4 }));
    body.rotation.x = Math.PI / 2;
    for (const bx of [-0.06, 0.06]) {
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#e0b64e', { roughness: 0.3, metalness: 0.4 }));
      bell.position.set(bx, 0.1, 0);
      g.add(bell);
    }
    g.add(body);
    const p = new THREE.Vector3(...pos), n = new THREE.Vector3(...(normal || [0, 1, 0])).normalize();
    g.position.copy(p).addScaledVector(n, 0.09);
  }
  scene.add(g);
  return g;
}

// ---- avatars ---------------------------------------------------------------

function makeFace(head, skin) {
  const eyeMat = mat('#1c1a22', { roughness: 0.3 });
  for (const ex of [-0.095, 0.095]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat);
    eye.position.set(ex, 0.03, -0.235);
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 0.02), eyeMat);
    brow.position.set(ex, 0.115, -0.235);
    brow.rotation.z = ex < 0 ? 0.12 : -0.12;
    head.add(brow);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.013, 6, 10, Math.PI * 0.8), eyeMat);
  smile.position.set(0, -0.075, -0.24);
  smile.rotation.z = Math.PI + Math.PI * 0.1;
  head.add(smile);
  head.material = mat(skin, { roughness: 0.65 });
}

function makeHair(head, colorIdx) {
  const hm = mat(HAIR[colorIdx % HAIR.length], { roughness: 0.95 });
  const style = colorIdx % 4;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.275, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hm);
  cap.position.set(0, 0.015, 0.03);
  cap.rotation.x = -0.25;
  head.add(cap);
  if (style === 1) { // bun
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hm);
    bun.position.set(0, 0.18, 0.2);
    head.add(bun);
  } else if (style === 2) { // spikes
    for (const sx of [-0.1, 0, 0.1]) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), hm);
      spike.position.set(sx, 0.27, 0);
      spike.rotation.x = 0.15;
      head.add(spike);
    }
  } else if (style === 3) { // fringe
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.06), hm);
    fringe.position.set(0.03, 0.16, -0.2);
    fringe.rotation.z = -0.1;
    head.add(fringe);
  }
}

export function makeStudent(scene, seat, colorIdx, name) {
  const d = DESKS[seat];
  const g = new THREE.Group();
  g.position.set(d.x, 0, d.z + 0.95);

  const shirt = mat(SHIRTS[colorIdx % SHIRTS.length], { roughness: 0.8 });
  const pants = mat('#3a4152', { roughness: 0.9 });
  const skin = SKINS[colorIdx % SKINS.length];

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.4, 6, 14), shirt);
  body.position.set(0, 0.94, 0);
  body.scale.set(1, 1, 0.82);
  body.castShadow = true;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 10), mat(skin, { roughness: 0.65 }));
  neck.position.set(0, 1.26, 0);
  g.add(neck);
  // thighs under the desk
  for (const lx of [-0.14, 0.14]) {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.5), pants);
    thigh.position.set(lx, 0.6, -0.3);
    g.add(thigh);
  }
  // arms reaching to the desk, with hands
  for (const ax of [-0.31, 0.31]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.34, 4, 10), shirt);
    arm.position.set(ax, 0.96, -0.24);
    arm.rotation.x = 1.2;
    arm.rotation.z = ax > 0 ? -0.22 : 0.22;
    arm.castShadow = true;
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat(skin, { roughness: 0.65 }));
    hand.position.set(ax * 1.35, 0.86, -0.5);
    g.add(hand);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 22, 16), mat(skin, { roughness: 0.65 }));
  head.position.set(0, 1.56, 0);
  head.castShadow = true;
  makeFace(head, skin);
  makeHair(head, colorIdx);
  g.add(head);
  blobShadow(g, 1.1, 1.1, 0, 0, 0.85);

  const tag = textSprite(name, { size: 44, bg: 'rgba(12,12,22,0.5)' });
  tag.position.set(0, 2.16, 0);
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
      g.rotation.z = 0;
    },
    setVisible(v) { g.visible = v; },
  };
}

export function makeTeacher(scene, name) {
  const g = new THREE.Group();
  const suit = mat('#3e3e50', { roughness: 0.85 });
  const skin = '#e8bd96';
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 6, 14), suit);
  body.position.set(0, 1.06, 0);
  body.scale.set(1, 1, 0.85);
  body.castShadow = true;
  g.add(body);
  for (const ax of [-0.37, 0.37]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 10), suit);
    arm.position.set(ax, 1.02, 0);
    arm.rotation.z = ax > 0 ? -0.1 : 0.1;
    arm.castShadow = true;
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat(skin, { roughness: 0.65 }));
    hand.position.set(ax * 1.15, 0.68, 0);
    g.add(hand);
  }
  for (const lx of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), mat('#2c2c3a', { roughness: 0.9 }));
    leg.position.set(lx, 0.31, 0);
    g.add(leg);
  }
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.03), mat('#a83a30'));
  tie.position.set(0, 1.3, -0.29);
  tie.rotation.x = 0.08;
  g.add(tie);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 10), mat(skin, { roughness: 0.65 }));
  neck.position.set(0, 1.62, 0);
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 22, 16), mat(skin, { roughness: 0.65 }));
  head.position.set(0, 1.94, 0);
  head.castShadow = true;
  makeFace(head, skin);
  // stern: flatten the smile into a frown
  head.children[head.children.length - 1].rotation.z = Math.PI * 0.1;
  // glasses
  const gm = mat('#2a2a32', { roughness: 0.3 });
  for (const ex of [-0.095, 0.095]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 6, 14), gm);
    ring.position.set(ex, 0.03, -0.245);
    head.add(ring);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.014, 0.014), gm);
  bridge.position.set(0, 0.045, -0.25);
  head.add(bridge);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.285, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), mat('#9c9ca4', { roughness: 0.95 }));
  hair.position.set(0, 0.03, 0.05);
  hair.rotation.x = -0.3;
  head.add(hair);
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.04), mat('#8a8a92'));
  stache.position.set(0, -0.06, -0.25);
  head.add(stache);
  g.add(head);
  blobShadow(g, 1.1, 1.1, 0, 0, 0.9);

  const tag = textSprite('🧑‍🏫 ' + name, { size: 44, bg: 'rgba(120,30,30,0.65)' });
  tag.position.set(0, 2.55, 0);
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
      gesture.sprite.position.set(0, 3, 0);
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
