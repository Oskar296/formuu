import * as THREE from 'three';
import { MarchingCubes } from '../vendor/MarchingCubes.js';

// The mannequin: a smooth faceless clay figure sculpted as ONE seamless surface
// (SDF capsules blended with smooth-min, polygonized once), auto-skinned to an
// 11-bone skeleton with hand-tuned weight bands so it stands, walks and sits
// with no seams, no tears, no floating parts. Baked once; every player shares
// the geometry and gets their own skeleton + tint.

const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
function sdSeg(px, py, pz, ax, ay, az, bx, by, bz, r0, r1) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, apx = px - ax, apy = py - ay, apz = pz - az;
  let t = (apx * abx + apy * aby + apz * abz) / (abx * abx + aby * aby + abz * abz); t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (r0 + (r1 - r0) * t);
}
function sdEll(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const kx = (px - cx) / rx, ky = (py - cy) / ry, kz = (pz - cz) / rz;
  const k0 = Math.sqrt(kx * kx + ky * ky + kz * kz);
  const k1 = Math.sqrt((kx / rx) ** 2 + (ky / ry) ** 2 + (kz / rz) ** 2);
  return k1 === 0 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
function bodySDF(x, y, z) {
  let d = sdEll(x, y, z, 0, 1.19, 0, 0.18, 0.20, 0.158);           // chest
  d = smin(d, sdEll(x, y, z, 0, 0.95, 0, 0.195, 0.215, 0.18), 0.13); // belly
  d = smin(d, sdEll(x, y, z, 0, 0.76, 0, 0.155, 0.13, 0.145), 0.07); // pelvis fill
  d = smin(d, sdSeg(x, y, z, 0, 1.29, 0, 0, 1.43, 0, 0.105, 0.09), 0.09);  // neck
  d = smin(d, sdEll(x, y, z, 0, 1.56, 0, 0.183, 0.226, 0.18), 0.055);       // egg head
  for (const s of [-1, 1]) {
    d = smin(d, sdSeg(x, y, z, s * 0.225, 1.25, 0, s * 0.325, 0.80, 0, 0.068, 0.055), 0.055); // arm
    d = smin(d, sdEll(x, y, z, s * 0.332, 0.725, 0, 0.062, 0.092, 0.044), 0.034);              // hand nub
    d = smin(d, sdSeg(x, y, z, s * 0.132, 0.81, 0, s * 0.148, 0.15, 0, 0.098, 0.082), 0.045);  // leg
    d = smin(d, sdEll(x, y, z, s * 0.15, 0.06, -0.05, 0.098, 0.056, 0.18), 0.045);             // foot
  }
  return d;
}

// bone segments: [name, ax,ay,az, bx,by,bz, parent]
const SEGS = [
  ['pelvis', 0, 0.84, 0, 0, 1.08, 0, -1],
  ['spine', 0, 1.08, 0, 0, 1.38, 0, 0],
  ['head', 0, 1.38, 0, 0, 1.78, 0, 1],
  ['armLu', -0.225, 1.25, 0, -0.275, 1.02, 0, 1],
  ['armLf', -0.275, 1.02, 0, -0.33, 0.66, 0, 3],
  ['armRu', 0.225, 1.25, 0, 0.275, 1.02, 0, 1],
  ['armRf', 0.275, 1.02, 0, 0.33, 0.66, 0, 5],
  ['legLu', -0.132, 0.85, 0, -0.14, 0.48, 0, 0],
  ['legLf', -0.14, 0.48, 0, -0.148, 0.02, 0, 7],
  ['legRu', 0.132, 0.85, 0, 0.14, 0.48, 0, 0],
  ['legRf', 0.14, 0.48, 0, 0.148, 0.02, 0, 9],
];
const IDX = { pelvis: 0, spine: 1, head: 2, armLu: 3, armLf: 4, armRu: 5, armRf: 6, legLu: 7, legLf: 8, legRu: 9, legRf: 10 };
const ss = (e0, e1, x) => { let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

let BAKED = null;
export function bakeFigure(res = 112) {
  if (BAKED) return BAKED;
  const ISO = 80, NS = 0.46, OY = 0.04;
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 1400000);
  mc.isolation = ISO;
  const f = mc.field, S = ISO / 0.045;
  let i = 0;
  for (let iz = 0; iz < res; iz++) { const wz = ((iz / res) - 0.5) / NS;
    for (let iy = 0; iy < res; iy++) { const wy = ((iy / res) - OY) / NS;
      for (let ix = 0; ix < res; ix++, i++) { const wx = ((ix / res) - 0.5) / NS;
        f[i] = ISO - bodySDF(wx, wy, wz) * S;
      } } }
  mc.update();
  const n = mc.count;
  const sp = mc.geometry.getAttribute('position').array, sn = mc.geometry.getAttribute('normal').array;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    pos[v * 3] = ((sp[v * 3] + 1) / 2 - 0.5) / NS;
    pos[v * 3 + 1] = ((sp[v * 3 + 1] + 1) / 2 - OY) / NS;
    pos[v * 3 + 2] = ((sp[v * 3 + 2] + 1) / 2 - 0.5) / NS;
    nor[v * 3] = sn[v * 3]; nor[v * 3 + 1] = sn[v * 3 + 1]; nor[v * 3 + 2] = sn[v * 3 + 2];
  }
  // smooth analytic skin weights (bands tuned so nothing tears in motion)
  const skinIndex = new Uint16Array(n * 4), skinWeight = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const px = pos[v * 3], py = pos[v * 3 + 1];
    const ax = Math.abs(px), right = ss(-0.02, 0.02, px);
    const hi = ss(0.85, 0.98, py);
    const a0 = 0.25 + (0.175 - 0.25) * hi, a1 = 0.29 + (0.235 - 0.29) * hi;
    const arm = py > 0.5 ? ss(a0, a1, ax) : 0;
    const sideFade = ss(0.012, 0.05, ax);
    const leg = (1 - arm) * ss(0.86, 0.79, py) * sideFade;
    const torso = Math.max(0, 1 - arm - leg);
    const cand = [];
    if (arm > 0) {
      const up = ss(0.94, 1.10, py);
      if (arm * up > 0.001) cand.push([right > 0.5 ? IDX.armRu : IDX.armLu, arm * up]);
      if (arm * (1 - up) > 0.001) cand.push([right > 0.5 ? IDX.armRf : IDX.armLf, arm * (1 - up)]);
    }
    if (leg > 0) {
      const th = ss(0.40, 0.56, py), lw = 1 - right, rw = right;
      for (const [b, w] of [[IDX.legLu, leg * th * lw], [IDX.legRu, leg * th * rw], [IDX.legLf, leg * (1 - th) * lw], [IDX.legRf, leg * (1 - th) * rw]])
        if (w > 0.001) cand.push([b, w]);
    }
    if (torso > 0) {
      const h = py > 1.15 ? ss(1.33, 1.45, py) : 0, rest = torso * (1 - h), sp2 = ss(0.95, 1.15, py);
      if (torso * h > 0.001) cand.push([IDX.head, torso * h]);
      if (rest * sp2 > 0.001) cand.push([IDX.spine, rest * sp2]);
      if (rest * (1 - sp2) > 0.001) cand.push([IDX.pelvis, rest * (1 - sp2)]);
    }
    cand.sort((a, b) => b[1] - a[1]);
    let tot = 0; for (let k = 0; k < 4 && k < cand.length; k++) tot += cand[k][1];
    for (let k = 0; k < 4; k++) {
      skinIndex[v * 4 + k] = k < cand.length ? cand[k][0] : 0;
      skinWeight[v * 4 + k] = k < cand.length ? cand[k][1] / tot : 0;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  BAKED = geo;
  return geo;
}

// accessory meshes parented to the head bone (skins)
function accessory(kind, tint) {
  const g = new THREE.Group();
  const m = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  if (kind === 'cap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.20, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), m('#2e5a8a'));
    dome.position.y = 0.30; g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.025, 16, 1, false, -Math.PI * 0.5, Math.PI), m('#2e5a8a'));
    brim.position.set(0, 0.32, -0.14); g.add(brim);
  } else if (kind === 'beanie') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m('#c05050', 0.9));
    dome.position.y = 0.28; g.add(dome);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), m('#f0ede0', 0.95));
    pom.position.y = 0.47; g.add(pom);
  } else if (kind === 'glasses') {
    const dark = m('#20242c', 0.35);
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 14), dark);
      ring.position.set(sx * 0.075, 0.20, -0.155); g.add(ring);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), dark);
    bridge.position.set(0, 0.21, -0.165); g.add(bridge);
  } else if (kind === 'crown') {
    const gold = m('#e8bc3a', 0.3); gold.metalness = 0.6;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.145, 0.07, 12, 1, true), gold);
    ring.position.y = 0.40; g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.07, 5), gold);
      spike.position.set(Math.cos(a) * 0.13, 0.46, Math.sin(a) * 0.13); g.add(spike);
    }
  } else if (kind === 'mohawk') {
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), m('#d94a9a', 0.8));
      spike.position.set(0, 0.40, -0.10 + i * 0.075); spike.rotation.x = -0.25 + i * 0.16; g.add(spike);
    }
  } else if (kind === 'antenna') {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), m('#2a2a32', 0.4));
    rod.position.y = 0.48; g.add(rod);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#ff5040', emissive: '#ff2010', emissiveIntensity: 1.4 }));
    bulb.position.y = 0.57; g.add(bulb);
  }
  if (tint) g.traverse(o => { if (o.isMesh && kind === 'cap') o.material.color.set(tint); });
  return g;
}

function nameSprite(text, bg) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  c.font = 'bold 52px system-ui, sans-serif';
  const w = Math.min(480, c.measureText(text).width + 60);
  c.fillStyle = bg || 'rgba(15,16,28,0.55)';
  c.beginPath(); c.roundRect((512 - w) / 2, 24, w, 80, 40); c.fill();
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(1.5, 0.375, 1);
  return sp;
}

// One figure instance: shared geometry, own skeleton, own tint.
export function makeFigure(scene, { color = '#eef0f2', name = '', tag = null, acc = null, scale = 1 } = {}) {
  const geo = bakeFigure();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.castShadow = true;
  const bones = SEGS.map(() => new THREE.Bone());
  for (let i = 0; i < SEGS.length; i++) {
    const S = SEGS[i], par = S[7];
    if (par < 0) bones[i].position.set(S[1], S[2], S[3]);
    else { bones[par].add(bones[i]); bones[i].position.set(S[1] - SEGS[par][1], S[2] - SEGS[par][2], S[3] - SEGS[par][3]); }
  }
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  const g = new THREE.Group();
  g.add(mesh);
  g.scale.setScalar(scale);
  const B = {}; SEGS.forEach((S, i) => (B[S[0]] = bones[i]));
  if (acc) bones[IDX.head].add(accessory(acc, null));
  let sprite = null;
  if (name) { sprite = nameSprite(name, tag); sprite.position.y = 2.05; g.add(sprite); }
  // soft blob shadow
  {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const gr = c.createRadialGradient(64, 64, 6, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.015;
    g.add(blob);
  }
  scene.add(g);

  const zero = () => { for (const k in B) { B[k].rotation.set(0, 0, 0); } mesh.position.y = 0; };
  let gesture = null, gestureUntil = 0;

  const fig = {
    group: g, mesh, B, headBone: B.head,
    setColor(c) { mat.color.set(c); },
    setPos(x, z, yaw) { g.position.x = x; g.position.z = z; g.rotation.y = yaw; },
    stand() { zero(); },
    // natural walk cycle: knee bend on recovery, arm counter-swing, lean + bob
    walk(ph, amp = 1) {
      const swL = Math.sin(ph), swR = Math.sin(ph + Math.PI);
      B.legLu.rotation.x = swL * 0.5 * amp; B.legRu.rotation.x = swR * 0.5 * amp;
      B.legLf.rotation.x = Math.max(0, -Math.sin(ph - 0.5)) * 0.75 * amp + 0.05;
      B.legRf.rotation.x = Math.max(0, -Math.sin(ph + Math.PI - 0.5)) * 0.75 * amp + 0.05;
      B.armLu.rotation.x = -swL * 0.38 * amp; B.armRu.rotation.x = -swR * 0.38 * amp;
      B.armLf.rotation.x = B.armRf.rotation.x = -0.15 * amp;
      B.spine.rotation.x = 0.06 * amp;
      B.spine.rotation.y = Math.sin(ph) * 0.06 * amp;
      B.head.rotation.x = -0.06 * amp;
      mesh.position.y = Math.abs(Math.sin(ph)) * 0.02 * amp;
    },
    // seated at a desk: thighs forward, shins down, arms resting toward the desk
    sit() {
      zero();
      B.legLu.rotation.x = B.legRu.rotation.x = 1.45;
      B.legLf.rotation.x = B.legRf.rotation.x = -1.35;
      B.armLu.rotation.x = B.armRu.rotation.x = 0.55;
      B.armLf.rotation.x = B.armRf.rotation.x = 0.35;
      B.spine.rotation.x = -0.04;
    },
    idle(t) { // breathing + tiny head sway, layered over current pose
      B.spine.scale.y = 1 + Math.sin(t * 1.7 + g.position.x) * 0.012;
      B.head.rotation.z = Math.sin(t * 0.6 + g.position.z) * 0.04;
    },
    lookYaw(y) { B.head.rotation.y = Math.max(-0.9, Math.min(0.9, y)); },
    lean(l) { B.spine.rotation.z = -l * 0.35; },
    raiseHand(on) { B.armRu.rotation.x = on ? Math.PI * 0.95 : 0.55; },
    setGesture(text, dur, now, bg) {
      if (gesture) { g.remove(gesture); gesture = null; }
      gesture = nameSprite(text, bg || 'rgba(30,60,140,0.8)');
      gesture.position.y = 2.45; gesture.scale.set(1.9, 0.475, 1);
      g.add(gesture); gestureUntil = now + dur;
    },
    tickGesture(now) { if (gesture && now > gestureUntil) { g.remove(gesture); gesture = null; } },
    setVisible(v) { g.visible = v; },
    dispose() { scene.remove(g); },
  };
  return fig;
}
