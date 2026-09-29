// AffordCraft library galaxy: every indexed library entry as a point, placed by a 3D t-SNE of its DINOv2 feature.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

const TYPE_COLORS = [
  new THREE.Color('#8fa2bf'), // rigid
  new THREE.Color('#ff6a1f'), // revolute
  new THREE.Color('#39d5f2'), // prismatic
  new THREE.Color('#ffc24b'), // revolute + prismatic
];
export const TYPE_NAMES = ['rigid', 'revolute', 'prismatic', 'revolute + prismatic'];
const R = 10;

let libPromise = null;
export function loadLibrary(base = 'static/data/') {
  if (libPromise) return libPromise;
  libPromise = Promise.all([
    fetch(base + 'library.bin').then((r) => r.arrayBuffer()),
    fetch(base + 'library.json').then((r) => r.json()),
  ]).then(([buf, meta]) => {
    const n = meta.n;
    const pos = new Float32Array(buf, 0, n * 3);
    const type = new Uint8Array(buf, n * 12, n);
    const src = new Uint8Array(buf, n * 13, n);
    const catOff = n * 14 + ((n * 2) % 4 ? 1 : 0);
    const cat = new Uint16Array(buf.slice(catOff, catOff + n * 2));
    return { n, pos, type, src, cat, meta };
  });
  return libPromise;
}

const vert = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  attribute float aFilter;
  attribute float aHi;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uHasHi;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHi;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.78 + 0.22 * sin(uTime * 1.3 + aPhase * 6.2831);
    float hi = aHi;
    float dimmed = mix(1.0, 0.16, uHasHi * (1.0 - hi));
    float size = aSize * tw * (1.0 + hi * 1.6) * mix(0.35, 1.0, aFilter);
    gl_PointSize = size * uScale * uPixelRatio * (118.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
    vColor = mix(aColor, vec3(1.0), hi * 0.55);
    vAlpha = mix(0.05, 1.0, aFilter) * dimmed;
    vHi = hi;
  }
`;
const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHi;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float halo = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.16, 0.0, d);
    float a = (halo * halo * 0.55 + core * 0.9) * vAlpha;
    gl_FragColor = vec4(vColor * (0.65 + core * 0.8), a);
  }
`;

export function createGalaxy(canvas, lib, opts = {}) {
  const interactive = !!opts.interactive;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov || 42, 1, 0.1, 400);
  camera.position.set(0, opts.camY ?? 3.5, opts.camZ ?? 25);
  const group = new THREE.Group();
  scene.add(group);

  const n = lib.n;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const phases = new Float32Array(n);
  const filter = new Float32Array(n).fill(1);
  const hi = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = lib.pos[i * 3] * R;
    positions[i * 3 + 1] = lib.pos[i * 3 + 2] * R * 0.82;
    positions[i * 3 + 2] = lib.pos[i * 3 + 1] * R;
    const t = lib.type[i];
    const col = TYPE_COLORS[t];
    const k = t === 0 ? 0.78 : 1.0;
    colors[i * 3] = col.r * k; colors[i * 3 + 1] = col.g * k; colors[i * 3 + 2] = col.b * k;
    sizes[i] = (t === 0 ? 0.78 : 1.22) * (0.72 + Math.random() * 0.62);
    phases[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const aFilter = new THREE.BufferAttribute(filter, 1);
  const aHi = new THREE.BufferAttribute(hi, 1);
  geo.setAttribute('aFilter', aFilter);
  geo.setAttribute('aHi', aHi);
  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uScale: { value: opts.pointScale || 1 },
    uHasHi: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  // faint background dust for depth
  if (opts.dust) {
    const m = 1600, dp = new Float32Array(m * 3), dc = new Float32Array(m * 3), ds = new Float32Array(m), dph = new Float32Array(m), df = new Float32Array(m).fill(0.55), dh = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      const r = 30 + Math.random() * 70, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      dp[i * 3] = r * Math.sin(ph) * Math.cos(th); dp[i * 3 + 1] = r * Math.cos(ph) * 0.6; dp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      dc[i * 3] = 0.5; dc[i * 3 + 1] = 0.58; dc[i * 3 + 2] = 0.72; ds[i] = 0.9 + Math.random(); dph[i] = Math.random();
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    g2.setAttribute('aColor', new THREE.BufferAttribute(dc, 3));
    g2.setAttribute('aSize', new THREE.BufferAttribute(ds, 1));
    g2.setAttribute('aPhase', new THREE.BufferAttribute(dph, 1));
    g2.setAttribute('aFilter', new THREE.BufferAttribute(df, 1));
    g2.setAttribute('aHi', new THREE.BufferAttribute(dh, 1));
    scene.add(new THREE.Points(g2, mat));
  }

  let controls = null;
  if (interactive) {
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
    controls.enablePan = false; controls.minDistance = 6; controls.maxDistance = 60;
    controls.addEventListener('start', () => { controls.autoRotate = false; });
  }

  // hover picking (explorer)
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.22;
  const mouse = new THREE.Vector2(9, 9);
  let hoverCb = null, hovered = -1, lastMove = 0;
  const pointer = { x: 0, y: 0 };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; lastMove = performance.now();
  });
  canvas.addEventListener('pointerleave', () => { mouse.set(9, 9); if (hoverCb) hoverCb(-1); hovered = -1; });

  // parallax for the hero
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  if (opts.parallax) {
    window.addEventListener('pointermove', (e) => {
      par.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      par.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true, raf = 0;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf) loop(); }, { threshold: 0 }).observe(canvas);
  const clock = new THREE.Clock();
  const spin = opts.spin ?? 0.03;
  function loop() {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;
    if (!interactive) {
      group.rotation.y += dt * spin;
      par.x += (par.tx - par.x) * 0.04; par.y += (par.ty - par.y) * 0.04;
      group.rotation.x = 0.08 + par.y * 0.08;
      group.rotation.z = par.x * -0.04;
      camera.position.x = par.x * 1.2;
      camera.lookAt(0, 0, 0);
    } else {
      controls.update();
      if (hoverCb && performance.now() - lastMove < 120) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObject(points);
        let best = -1;
        for (const h of hits) { if (filter[h.index] > 0.5) { best = h.index; break; } }
        if (best !== hovered) { hovered = best; hoverCb(best, pointer); }
        else if (best >= 0) hoverCb(best, pointer, true);
      }
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  return {
    camera, controls,
    onHover(cb) { hoverCb = cb; },
    setFilter(fn) {
      for (let i = 0; i < n; i++) filter[i] = fn(i) ? 1 : 0;
      aFilter.needsUpdate = true;
    },
    setHighlight(fn) {
      let any = 0;
      for (let i = 0; i < n; i++) { hi[i] = fn && fn(i) ? 1 : 0; any += hi[i]; }
      aHi.needsUpdate = true;
      uniforms.uHasHi.value = any > 0 ? 1 : 0;
      return any;
    },
  };
}
