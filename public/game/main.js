import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ---------------------------------------------------------------- config

const PLANETS = [
  { name: 'PLUTO',   r: 0.30, color: '#c4b2a4', points: 1  },
  { name: 'MOON',    r: 0.43, color: '#d3d3dc', points: 3  },
  { name: 'MERCURY', r: 0.57, color: '#a98f7e', points: 6  },
  { name: 'MARS',    r: 0.73, color: '#d65f38', points: 10 },
  { name: 'VENUS',   r: 0.91, color: '#eab765', points: 15 },
  { name: 'EARTH',   r: 1.10, color: '#4a8fdb', points: 21 },
  { name: 'NEPTUNE', r: 1.30, color: '#4257cf', points: 28 },
  { name: 'URANUS',  r: 1.50, color: '#8fdcd8', points: 36 },
  { name: 'SATURN',  r: 1.72, color: '#dfc189', points: 45, ring: true },
  { name: 'JUPITER', r: 1.96, color: '#c68b58', points: 55 },
  { name: 'SUN',     r: 2.24, color: '#ffb52e', points: 66, sun: true },
];
const MAX_TIER = PLANETS.length - 1;
const SUPERNOVA_POINTS = 250;         // merging two Suns
const DROP_WEIGHTS = [30, 26, 20, 14, 10]; // spawn odds for tiers 0..4

const JAR_R = 3.1;        // inner radius
const JAR_H = 7.0;        // rim height (also the lose line)
const DROP_Y = JAR_H + 1.5;
const OVERFLOW_SECONDS = 2.2;
const DROP_COOLDOWN = 0.45;

// ---------------------------------------------------------------- renderer / scene

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#070a18');

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 300);
let camAzimuth = 0.5, camPolar = 1.12, camDist = 15.5;
const camTarget = new THREE.Vector3(0, JAR_H * 0.48, 0);

function updateCamera() {
  camPolar = Math.max(0.55, Math.min(1.45, camPolar));
  camDist = Math.max(10, Math.min(24, camDist));
  camera.position.set(
    camTarget.x + camDist * Math.sin(camPolar) * Math.sin(camAzimuth),
    camTarget.y + camDist * Math.cos(camPolar),
    camTarget.z + camDist * Math.sin(camPolar) * Math.cos(camAzimuth),
  );
  camera.lookAt(camTarget);
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
updateCamera();

// lights
scene.add(new THREE.HemisphereLight('#93a7ff', '#1c1428', 0.85));
const sunLight = new THREE.DirectionalLight('#fff4e0', 1.6);
sunLight.position.set(7, 14, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -7; sunLight.shadow.camera.right = 7;
sunLight.shadow.camera.top = 10;  sunLight.shadow.camera.bottom = -4;
sunLight.shadow.camera.far = 40;
scene.add(sunLight);

// starfield
{
  const n = 1100, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 60);
    pos.set([v.x, Math.abs(v.y) * (Math.random() < 0.2 ? -0.3 : 1), v.z], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({
    color: '#cdd8ff', size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.9,
  }));
  scene.add(stars);
}

// ---------------------------------------------------------------- jar visuals

{
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#9fd4ff', transparent: true, opacity: 0.13, roughness: 0.08,
    metalness: 0, side: THREE.DoubleSide, depthWrite: false,
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(JAR_R + 0.12, JAR_R + 0.12, JAR_H, 56, 1, true), glassMat);
  wall.position.y = JAR_H / 2;
  scene.add(wall);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(JAR_R + 0.12, 0.07, 12, 72),
    new THREE.MeshStandardMaterial({ color: '#bfe2ff', transparent: true, opacity: 0.55, roughness: 0.25 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = JAR_H;
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.CylinderGeometry(JAR_R + 0.35, JAR_R + 0.55, 0.35, 56),
    new THREE.MeshStandardMaterial({ color: '#1b2140', roughness: 0.75 }));
  floor.position.y = -0.175;
  floor.receiveShadow = true;
  scene.add(floor);
}

// pulsing lose line
const dangerRing = new THREE.Mesh(new THREE.TorusGeometry(JAR_R + 0.14, 0.035, 8, 72),
  new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0 }));
dangerRing.rotation.x = Math.PI / 2; dangerRing.position.y = JAR_H;
scene.add(dangerRing);

// ---------------------------------------------------------------- physics

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -19, 0) });
world.allowSleep = true;
const planetPhysMat = new CANNON.Material('planet');
world.addContactMaterial(new CANNON.ContactMaterial(planetPhysMat, planetPhysMat, {
  friction: 0.35, restitution: 0.15,
}));

// floor
{
  const b = new CANNON.Body({ type: CANNON.Body.STATIC, material: planetPhysMat });
  b.addShape(new CANNON.Box(new CANNON.Vec3(8, 0.5, 8)), new CANNON.Vec3(0, -0.5, 0));
  world.addBody(b);
}
// jar wall: ring of static boxes facing inward (tall so nothing escapes)
{
  const SEG = 22;
  const segW = (2 * Math.PI * (JAR_R + 0.4)) / SEG;
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    const b = new CANNON.Body({ type: CANNON.Body.STATIC, material: planetPhysMat });
    b.addShape(new CANNON.Box(new CANNON.Vec3(segW * 0.62, JAR_H * 1.4, 0.25)));
    b.position.set(Math.sin(a) * (JAR_R + 0.25), JAR_H * 0.9, Math.cos(a) * (JAR_R + 0.25));
    b.quaternion.setFromEuler(0, a, 0);
    world.addBody(b);
  }
}

// ---------------------------------------------------------------- planet textures & materials

function makePlanetTexture(tier) {
  const P = PLANETS[tier];
  const W = 512, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const base = new THREE.Color(P.color);
  const lighter = base.clone().offsetHSL(0, 0.02, 0.10).getStyle();
  const darker = base.clone().offsetHSL(0, 0.02, -0.10).getStyle();

  ctx.fillStyle = P.color; ctx.fillRect(0, 0, W, H);

  const rand = mulberry32(tier * 1337 + 7);

  if (tier === 0) { // Pluto: famous heart
    blotches(ctx, rand, darker, 10, 8, 26);
    ctx.fillStyle = lighter;
    heart(ctx, W * 0.5, H * 0.62, 46);
  } else if (tier === 1 || tier === 2) { // Moon / Mercury: craters
    blotches(ctx, rand, darker, 8, 6, 20);
    for (let i = 0; i < 14; i++) {
      const x = rand() * W, y = rand() * H, r = 4 + rand() * 9;
      ctx.fillStyle = 'rgba(0,0,20,0.18)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.75, 0, 7); ctx.fill();
    }
  } else if (tier === 3) { // Mars: dark patches + polar cap
    blotches(ctx, rand, darker, 12, 12, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(0, 0, W, 14);
  } else if (tier === 4) { // Venus: creamy swirls
    swirls(ctx, rand, lighter, 9);
    swirls(ctx, rand, 'rgba(140,90,30,0.20)', 6);
  } else if (tier === 5) { // Earth: oceans + continents + poles
    ctx.fillStyle = '#3fa860';
    for (let i = 0; i < 9; i++) blob(ctx, rand() * W, H * (0.2 + rand() * 0.6), 18 + rand() * 34, rand);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 0, W, 16); ctx.fillRect(0, H - 14, W, 14);
    swirls(ctx, rand, 'rgba(255,255,255,0.30)', 7); // clouds
  } else if (tier === 6 || tier === 7) { // Neptune / Uranus: soft bands
    bands(ctx, rand, lighter, darker, 5, 0.25);
  } else if (tier === 8) { // Saturn: warm bands
    bands(ctx, rand, lighter, darker, 8, 0.45);
  } else if (tier === 9) { // Jupiter: strong bands + red spot
    bands(ctx, rand, lighter, darker, 10, 0.8);
    ctx.fillStyle = '#c94f30';
    ctx.beginPath(); ctx.ellipse(W * 0.68, H * 0.62, 26, 15, 0, 0, 7); ctx.fill();
  } else { // Sun: hot swirls
    swirls(ctx, rand, '#ffd76a', 12);
    swirls(ctx, rand, 'rgba(255,90,20,0.35)', 8);
  }

  drawFace(ctx, W * 0.5, H * 0.46, tier);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function blotches(ctx, rand, style, n, rMin, rMax) {
  ctx.fillStyle = style;
  for (let i = 0; i < n; i++) blob(ctx, rand() * 512, rand() * 256, rMin + rand() * (rMax - rMin), rand);
}
function blob(ctx, x, y, r, rand) {
  ctx.beginPath();
  for (let a = 0; a <= 12; a++) {
    const ang = (a / 12) * Math.PI * 2;
    const rr = r * (0.7 + rand() * 0.5);
    ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.7);
  }
  ctx.fill();
}
function swirls(ctx, rand, style, n) {
  ctx.strokeStyle = style; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    ctx.lineWidth = 5 + rand() * 12;
    const y = rand() * 256, x = rand() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 40, y - 14 + rand() * 28, x + 90, y - 14 + rand() * 28, x + 130 + rand() * 60, y);
    ctx.stroke();
  }
}
function bands(ctx, rand, lighter, darker, n, alpha) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? lighter : darker;
    ctx.globalAlpha = alpha * (0.5 + rand() * 0.5);
    const y = (i / n) * 256, h = 256 / n;
    ctx.fillRect(0, y, 512, h * (0.7 + rand() * 0.5));
  }
  ctx.globalAlpha = 1;
}
function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.35, x - s * 0.45, y - s, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.35, x, y + s * 0.35);
  ctx.fill();
}
function drawFace(ctx, x, y, tier) {
  const s = 1 + tier * 0.06;
  const dx = 20 * s;
  ctx.fillStyle = '#141420';
  for (const ex of [-dx, dx]) { // eyes
    ctx.beginPath(); ctx.ellipse(x + ex, y, 7.5 * s, 9.5 * s, 0, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  for (const ex of [-dx, dx]) {
    ctx.beginPath(); ctx.arc(x + ex + 2.5 * s, y - 3 * s, 2.6 * s, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = '#141420'; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round'; // smile
  ctx.beginPath(); ctx.arc(x, y + 8 * s, 10 * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.fillStyle = 'rgba(255,110,130,0.35)'; // blush
  for (const ex of [-dx * 1.7, dx * 1.7]) {
    ctx.beginPath(); ctx.ellipse(x + ex, y + 7 * s, 6.5 * s, 4 * s, 0, 0, 7); ctx.fill();
  }
}

const geoCache = [], matCache = [];
function tierAssets(tier) {
  if (!geoCache[tier]) {
    geoCache[tier] = new THREE.SphereGeometry(PLANETS[tier].r, 36, 22);
    const P = PLANETS[tier];
    matCache[tier] = new THREE.MeshStandardMaterial({
      map: makePlanetTexture(tier),
      roughness: P.sun ? 0.5 : 0.75,
      emissive: P.sun ? new THREE.Color('#ff8c00') : new THREE.Color('#000000'),
      emissiveIntensity: P.sun ? 0.55 : 0,
      emissiveMap: P.sun ? matCacheSunMap() : null,
    });
  }
  return { geo: geoCache[tier], mat: matCache[tier] };
}
let _sunMap = null;
function matCacheSunMap() { return _sunMap || (_sunMap = makePlanetTexture(MAX_TIER)); }

let glowTex = null;
function makeGlowSprite(scale, color) {
  if (!glowTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d').createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    const ctx = cv.getContext('2d'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(cv);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity: 0.85, depthWrite: false,
  }));
  sp.scale.setScalar(scale);
  return sp;
}

// ---------------------------------------------------------------- game state

let planets = [];        // { body, mesh, tier, born, overT, id }
let nextId = 1;
let score = 0;
let best = +(localStorage.getItem('cosmicjar-best') || 0);
let playing = false;
let gameOver = false;
let cooldown = 0;
let discovered = new Set([0]);
let queue = [randTier(), randTier()];

function randTier() {
  const total = DROP_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < DROP_WEIGHTS.length; i++) {
    roll -= DROP_WEIGHTS[i];
    if (roll <= 0) return i;
  }
  return 0;
}

function spawnPlanet(tier, pos, vel, popIn) {
  const { geo, mat } = tierAssets(tier);
  const P = PLANETS[tier];
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  if (P.ring) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(P.r * 1.3, P.r * 1.85, 48),
      new THREE.MeshStandardMaterial({ color: '#d8bf8d', side: THREE.DoubleSide, transparent: true, opacity: 0.85, roughness: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    mesh.add(ring);
  }
  if (P.sun) mesh.add(makeGlowSprite(P.r * 4.2, '#ffb52e'));
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: P.r * P.r * P.r * 4,
    shape: new CANNON.Sphere(P.r),
    material: planetPhysMat,
    linearDamping: 0.05,
    angularDamping: 0.25,
    position: new CANNON.Vec3(pos.x, pos.y, pos.z),
  });
  if (vel) body.velocity.set(vel.x, vel.y, vel.z);
  body.planetId = nextId++;
  world.addBody(body);

  const p = { body, mesh, tier, born: perfNow(), overT: 0, popT: popIn ? 0 : 1 };
  planets.push(p);

  if (!discovered.has(tier)) {
    discovered.add(tier);
    flashChainDot(tier);
  }
  return p;
}

function removePlanet(p) {
  world.removeBody(p.body);
  scene.remove(p.mesh);
  planets = planets.filter(q => q !== p);
}

function perfNow() { return performance.now() / 1000; }

// merge detection
let mergeQueue = [];
world.addEventListener('beginContact', ({ bodyA, bodyB }) => {
  if (!bodyA.planetId || !bodyB.planetId) return;
  mergeQueue.push([bodyA.planetId, bodyB.planetId]);
});

function processMerges() {
  if (!mergeQueue.length) return;
  const used = new Set();
  for (const [ida, idb] of mergeQueue) {
    if (used.has(ida) || used.has(idb)) continue;
    const a = planets.find(p => p.body.planetId === ida);
    const b = planets.find(p => p.body.planetId === idb);
    if (!a || !b || a.tier !== b.tier) continue;
    used.add(ida); used.add(idb);

    const mid = a.body.position.clone().vadd(b.body.position).scale(0.5);
    const vel = a.body.velocity.clone().vadd(b.body.velocity).scale(0.5);
    removePlanet(a); removePlanet(b);

    if (a.tier === MAX_TIER) { // two Suns → supernova!
      addScore(SUPERNOVA_POINTS, mid);
      supernova(mid);
    } else {
      const t = a.tier + 1;
      // keep merge result inside the jar
      const horiz = Math.hypot(mid.x, mid.z);
      const maxR = JAR_R - PLANETS[t].r - 0.05;
      if (horiz > maxR) { mid.x *= maxR / horiz; mid.z *= maxR / horiz; }
      mid.y = Math.max(mid.y, PLANETS[t].r + 0.02);
      const p = spawnPlanet(t, mid, { x: vel.x, y: Math.min(vel.y, 0) + 1.6, z: vel.z }, true);
      p.born = perfNow(); // reset overflow grace timer
      addScore(PLANETS[t].points, mid);
      burst(mid, PLANETS[t].color, 18 + t * 4);
      sounds.pop(t);
    }
  }
  mergeQueue = [];
}

function supernova(mid) {
  burst(mid, '#ffd76a', 90);
  burst(mid, '#ff6a3a', 60);
  sounds.boom();
  // shockwave: push everything away
  for (const p of planets) {
    const d = p.body.position.clone().vsub(mid);
    const len = Math.max(d.length(), 0.5);
    d.scale(30 / (len * len) * p.body.mass, d);
    d.y = Math.abs(d.y) + 4;
    p.body.applyImpulse(d);
    p.body.wakeUp();
  }
}

// ---------------------------------------------------------------- particles

const bursts = [];
function burst(pos, color, count) {
  const g = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const vels = [];
  for (let i = 0; i < count; i++) {
    positions.set([pos.x, pos.y, pos.z], i * 3);
    vels.push(new THREE.Vector3().randomDirection().multiplyScalar(2.5 + Math.random() * 5));
  }
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({
    color, size: 0.16, transparent: true, opacity: 1, depthWrite: false,
  }));
  scene.add(pts);
  bursts.push({ pts, vels, life: 0 });
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life += dt;
    const arr = b.pts.geometry.attributes.position.array;
    for (let j = 0; j < b.vels.length; j++) {
      b.vels[j].y -= 9 * dt;
      arr[j * 3] += b.vels[j].x * dt;
      arr[j * 3 + 1] += b.vels[j].y * dt;
      arr[j * 3 + 2] += b.vels[j].z * dt;
    }
    b.pts.geometry.attributes.position.needsUpdate = true;
    b.pts.material.opacity = Math.max(0, 1 - b.life / 0.9);
    if (b.life > 0.9) {
      scene.remove(b.pts);
      b.pts.geometry.dispose(); b.pts.material.dispose();
      bursts.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- sound (synthesized, no assets)

const sounds = (() => {
  let ctx = null, muted = false;
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function tone(freq, dur, type, vol, slide = 0.6) {
    if (muted) return;
    const c = ac(), t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    resume() { try { ac().resume(); } catch { /* no audio available */ } },
    toggle() { muted = !muted; return muted; },
    drop() { tone(150, 0.12, 'sine', 0.15, 0.5); },
    pop(tier) {
      tone(560 * Math.pow(0.87, tier), 0.22, 'triangle', 0.3, 1.5);
      tone(280 * Math.pow(0.87, tier), 0.3, 'sine', 0.2, 1.3);
    },
    boom() {
      tone(220, 0.7, 'sawtooth', 0.25, 0.15);
      tone(90, 1.1, 'sine', 0.4, 0.4);
    },
    over() { tone(320, 0.5, 'triangle', 0.25, 0.4); tone(200, 0.8, 'sine', 0.25, 0.35); },
  };
})();

// ---------------------------------------------------------------- aiming UI (3D)

const ghostMats = {};
const ghost = new THREE.Group();
scene.add(ghost);
let ghostMesh = null;

const guideLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -DROP_Y, 0)]),
  new THREE.LineDashedMaterial({ color: '#8fb5ff', dashSize: 0.28, gapSize: 0.22, transparent: true, opacity: 0.55 }));
guideLine.computeLineDistances();
ghost.add(guideLine);

const landRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40),
  new THREE.MeshBasicMaterial({ color: '#8fb5ff', transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
landRing.rotation.x = -Math.PI / 2;
scene.add(landRing);

function setGhostTier(tier) {
  if (ghostMesh) ghost.remove(ghostMesh);
  if (!ghostMats[tier]) {
    ghostMats[tier] = new THREE.MeshStandardMaterial({
      map: matCache[tier] ? matCache[tier].map : tierAssets(tier).mat.map,
      transparent: true, opacity: 0.65,
    });
  }
  ghostMesh = new THREE.Mesh(tierAssets(tier).geo, ghostMats[tier]);
  ghost.add(ghostMesh);
  landRing.scale.setScalar(PLANETS[tier].r * 1.1);
}

let aim = new THREE.Vector3(0, DROP_Y, 0);
const raycaster = new THREE.Raycaster();
const dropPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DROP_Y);

function updateAim(clientX, clientY) {
  const ndc = new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dropPlane, hit)) return;
  const tier = queue[0];
  const maxR = JAR_R - PLANETS[tier].r - 0.06;
  const len = Math.hypot(hit.x, hit.z);
  if (len > maxR) { hit.x *= maxR / len; hit.z *= maxR / len; }
  aim.set(hit.x, DROP_Y, hit.z);
}

// ---------------------------------------------------------------- HUD

const $ = id => document.getElementById(id);
const scoreEl = $('score'), bestEl = $('best'), nextBall = $('nextBall'), nextName = $('nextName');
bestEl.textContent = 'BEST ' + best;

function addScore(pts, worldPos) {
  score += pts;
  scoreEl.textContent = score;
  if (worldPos) {
    const v = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z).project(camera);
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = '+' + pts;
    el.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    el.style.fontSize = Math.min(34, 15 + pts * 0.35) + 'px';
    el.style.color = pts >= SUPERNOVA_POINTS ? '#ffd76a' : '#eaf0ff';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
}

function refreshNextUI() {
  const P = PLANETS[queue[1]];
  const c = new THREE.Color(P.color);
  const light = c.clone().offsetHSL(0, 0, 0.18).getStyle();
  nextBall.style.background = `radial-gradient(circle at 35% 30%, ${light}, ${P.color} 60%, ${c.clone().offsetHSL(0, 0, -0.15).getStyle()})`;
  nextName.textContent = P.name;
}

// evolution chain (side HUD + start screen)
function buildChain(container, sizeMul, withArrows) {
  container.innerHTML = '';
  PLANETS.forEach((P, i) => {
    if (withArrows && i > 0) {
      const a = document.createElement('span');
      a.className = 'arrow'; a.textContent = '▶';
      container.appendChild(a);
    }
    const d = document.createElement('div');
    d.className = 'dot'; d.dataset.tier = i; d.title = P.name;
    const s = (8 + i * 2.4) * sizeMul;
    d.style.width = d.style.height = s + 'px';
    const c = new THREE.Color(P.color);
    d.style.background = `radial-gradient(circle at 35% 30%, ${c.clone().offsetHSL(0, 0, 0.18).getStyle()}, ${P.color})`;
    container.appendChild(d);
  });
}
buildChain($('chain'), 1, false);
buildChain($('startChain'), 1.4, true);
function refreshChainSeen() {
  document.querySelectorAll('#chain .dot').forEach(d => {
    d.classList.toggle('seen', discovered.has(+d.dataset.tier));
  });
}
function flashChainDot(tier) {
  refreshChainSeen();
  const d = document.querySelector(`#chain .dot[data-tier="${tier}"]`);
  if (d) { d.classList.add('flash'); setTimeout(() => d.classList.remove('flash'), 350); }
}
refreshChainSeen();

$('soundBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('soundBtn').textContent = sounds.toggle() ? '🔇' : '🔊';
});

// ---------------------------------------------------------------- input

let pointerDown = false, dragging = false, downX = 0, downY = 0, lastX = 0, lastY = 0;

canvas.addEventListener('pointerdown', e => {
  pointerDown = true; dragging = false;
  downX = lastX = e.clientX; downY = lastY = e.clientY;
  sounds.resume();
});
window.addEventListener('pointermove', e => {
  updateAim(e.clientX, e.clientY);
  if (!pointerDown) return;
  if (!dragging && Math.hypot(e.clientX - downX, e.clientY - downY) > 8) dragging = true;
  if (dragging) {
    camAzimuth -= (e.clientX - lastX) * 0.006;
    camPolar -= (e.clientY - lastY) * 0.004;
    updateCamera();
  }
  lastX = e.clientX; lastY = e.clientY;
});
window.addEventListener('pointerup', e => {
  if (pointerDown && !dragging) tryDrop();
  pointerDown = false; dragging = false;
});
window.addEventListener('wheel', e => {
  camDist += e.deltaY * 0.012;
  updateCamera();
}, { passive: true });
window.addEventListener('keydown', e => {
  if (e.key === 'a' || e.key === 'ArrowLeft') { camAzimuth += 0.12; updateCamera(); }
  if (e.key === 'd' || e.key === 'ArrowRight') { camAzimuth -= 0.12; updateCamera(); }
  if (e.key === 'm') $('soundBtn').click();
});

function tryDrop() {
  if (!playing || gameOver || cooldown > 0) return;
  const tier = queue.shift();
  queue.push(randTier());
  spawnPlanet(tier, { x: aim.x, y: DROP_Y, z: aim.z });
  sounds.drop();
  cooldown = DROP_COOLDOWN;
  ghost.visible = false; landRing.visible = false;
  setGhostTier(queue[0]);
  refreshNextUI();
}

// ---------------------------------------------------------------- game over / restart

function endGame() {
  gameOver = true;
  playing = false;
  sounds.over();
  ghost.visible = false; landRing.visible = false;
  const isBest = score > best;
  if (isBest) {
    best = score;
    localStorage.setItem('cosmicjar-best', best);
    bestEl.textContent = 'BEST ' + best;
  }
  $('finalScore').textContent = score;
  $('finalBest').textContent = 'BEST ' + best;
  $('newBestTag').style.display = isBest ? 'block' : 'none';
  $('overOverlay').classList.remove('hidden');
}

function startGame() {
  for (const p of [...planets]) removePlanet(p);
  score = 0; scoreEl.textContent = '0';
  gameOver = false; playing = true; cooldown = 0.2;
  discovered = new Set([0]);
  queue = [randTier(), randTier()];
  mergeQueue = [];
  setGhostTier(queue[0]);
  refreshNextUI();
  refreshChainSeen();
  $('startOverlay').classList.add('hidden');
  $('overOverlay').classList.add('hidden');
}
$('playBtn').addEventListener('click', e => { e.stopPropagation(); sounds.resume(); startGame(); });
$('againBtn').addEventListener('click', e => { e.stopPropagation(); startGame(); });

// ---------------------------------------------------------------- main loop

let lastT = performance.now();
let danger = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  if (playing) {
    world.step(1 / 60, dt, 3);
    processMerges();

    cooldown -= dt;
    if (cooldown <= 0 && !ghost.visible) { ghost.visible = true; landRing.visible = true; }

    // overflow tracking
    danger = 0;
    const t = perfNow();
    for (const p of planets) {
      const grace = t - p.born > 1.4;
      if (grace && p.body.position.y > JAR_H) {
        p.overT += dt;
        danger = Math.max(danger, p.overT / OVERFLOW_SECONDS);
        if (p.overT > OVERFLOW_SECONDS) { endGame(); break; }
      } else {
        p.overT = Math.max(0, p.overT - dt * 2);
      }
    }
  }

  // sync meshes + pop-in scale
  for (const p of planets) {
    p.mesh.position.copy(p.body.position);
    p.mesh.quaternion.copy(p.body.quaternion);
    if (p.popT < 1) {
      p.popT = Math.min(1, p.popT + dt / 0.2);
      const back = 1 + 0.5 * Math.sin(p.popT * Math.PI); // overshoot
      p.mesh.scale.setScalar(0.4 + 0.6 * p.popT * back);
      if (p.popT >= 1) p.mesh.scale.setScalar(1);
    }
  }

  // aiming visuals
  if (ghost.visible) {
    ghost.position.copy(aim);
    landRing.position.set(aim.x, 0.03, aim.z);
    if (ghostMesh) ghostMesh.rotation.y += dt * 0.8;
  }

  // danger pulse
  const pulse = danger > 0 ? 0.35 + 0.65 * Math.abs(Math.sin(now / 130)) : 0;
  dangerRing.material.opacity = danger > 0.1 ? pulse : Math.max(0, dangerRing.material.opacity - dt * 2);
  document.getElementById('dangerFlash').style.opacity = danger > 0.25 ? String(danger * 0.9) : '0';

  updateBursts(dt);
  renderer.render(scene, camera);
}

setGhostTier(queue[0]);
refreshNextUI();
ghost.visible = false; landRing.visible = false;
requestAnimationFrame(frame);
