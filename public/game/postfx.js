import * as THREE from 'three';

// Minimal hand-rolled post pipeline: scene -> HDR target (MSAA) -> bright pass
// -> separable blur (quarter res) -> composite (bloom + ACES + grade + vignette).

const QUAD = new THREE.BufferGeometry();
QUAD.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
QUAD.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 99);
const quadCam = new THREE.Camera();

function pass(fragment, uniforms) {
  const m = new THREE.RawShaderMaterial({
    uniforms,
    vertexShader: `
      precision highp float;
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = position * 0.5 + 0.5;
        gl_Position = vec4(position, 0.0, 1.0);
      }`,
    fragmentShader: 'precision highp float;\n' + fragment,
    depthTest: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(QUAD, m);
  mesh.frustumCulled = false;
  const sc = new THREE.Scene();
  sc.add(mesh);
  return { scene: sc, mat: m };
}

export function makePost(renderer) {
  const size = () => renderer.getSize(new THREE.Vector2());
  let w = 8, h = 8;

  const rtScene = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, samples: 4,
  });
  const rtA = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
  const rtB = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });

  const bright = pass(`
    uniform sampler2D tex;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tex, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor = vec4(c * smoothstep(0.72, 1.35, l), 1.0);
    }`, { tex: { value: null } });

  const blur = pass(`
    uniform sampler2D tex;
    uniform vec2 dir;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tex, vUv).rgb * 0.227;
      c += texture2D(tex, vUv + dir * 1.384).rgb * 0.316;
      c += texture2D(tex, vUv - dir * 1.384).rgb * 0.316;
      c += texture2D(tex, vUv + dir * 3.230).rgb * 0.070;
      c += texture2D(tex, vUv - dir * 3.230).rgb * 0.070;
      gl_FragColor = vec4(c, 1.0);
    }`, { tex: { value: null }, dir: { value: new THREE.Vector2() } });

  const comp = pass(`
    uniform sampler2D tex;
    uniform sampler2D bloom;
    varying vec2 vUv;
    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    void main() {
      vec3 c = texture2D(tex, vUv).rgb;
      c += texture2D(bloom, vUv).rgb * 0.85;
      c = aces(c * 1.05);
      // gentle grade: saturation + warmth
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.14);
      c *= vec3(1.02, 1.0, 0.985);
      // vignette
      vec2 q = vUv - 0.5;
      c *= 1.0 - dot(q, q) * 0.55;
      c = pow(max(c, 0.0), vec3(1.0 / 2.2));
      gl_FragColor = vec4(c, 1.0);
    }`, { tex: { value: null }, bloom: { value: null } });

  function resize() {
    const s = size();
    if (s.x === w && s.y === h) return;
    w = s.x; h = s.y;
    rtScene.setSize(w, h);
    rtA.setSize(w >> 2, h >> 2);
    rtB.setSize(w >> 2, h >> 2);
  }

  return {
    render(scene, camera) {
      resize();
      renderer.setRenderTarget(rtScene);
      renderer.render(scene, camera);

      bright.mat.uniforms.tex.value = rtScene.texture;
      renderer.setRenderTarget(rtA);
      renderer.render(bright.scene, quadCam);

      blur.mat.uniforms.tex.value = rtA.texture;
      blur.mat.uniforms.dir.value.set(1 / (w >> 2), 0);
      renderer.setRenderTarget(rtB);
      renderer.render(blur.scene, quadCam);
      blur.mat.uniforms.tex.value = rtB.texture;
      blur.mat.uniforms.dir.value.set(0, 1 / (h >> 2));
      renderer.setRenderTarget(rtA);
      renderer.render(blur.scene, quadCam);

      comp.mat.uniforms.tex.value = rtScene.texture;
      comp.mat.uniforms.bloom.value = rtA.texture;
      renderer.setRenderTarget(null);
      renderer.render(comp.scene, quadCam);
    },
  };
}
