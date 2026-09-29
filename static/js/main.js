import { loadLibrary, createGalaxy, TYPE_NAMES } from './galaxy.js';
import { renderTable, renderScatter, renderScaling, renderAblation } from './charts.js';
import { SpritePlayer, buildGallery, play, stop, loadImage } from './gallery.js';

const $ = (s, r = document) => r.querySelector(s);
const SHOT = new URLSearchParams(location.search).has('shot');
if (SHOT) document.documentElement.classList.add('shot');
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (n) => n.toLocaleString('en-US');

/* ------------------------------------------------------------ nav + reveal */
const nav = $('.nav');
const hero = $('.hero');
new IntersectionObserver(([e]) => nav.classList.toggle('is-visible', !e.isIntersecting), { threshold: 0.12 }).observe(hero);
const navLinks = $$('.nav-links a');
const secObs = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
}, { rootMargin: '-45% 0px -50% 0px' });
$$('section[id]').forEach((s) => secObs.observe(s));

const revObs = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) { e.target.classList.add('is-in'); revObs.unobserve(e.target); }
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
$$('.reveal').forEach((el) => revObs.observe(el));

/* ------------------------------------------------------------ counters */
const cntObs = new IntersectionObserver((es) => {
  for (const e of es) {
    if (!e.isIntersecting) continue;
    cntObs.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
    const t0 = performance.now(), dur = 1600;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur), v = to * (1 - Math.pow(1 - p, 4));
      el.textContent = dec ? v.toFixed(dec) : fmt(Math.round(v));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => cntObs.observe(el));

/* ------------------------------------------------------------ statement: words light up with scroll */
const st = $('#statement');
if (st) {
  const walk = (node) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach((w) => {
          if (!w.trim()) { frag.appendChild(document.createTextNode(w)); return; }
          const s = document.createElement('span'); s.className = 'w'; s.textContent = w; frag.appendChild(s);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && ch.tagName !== 'EM') walk(ch);
      else if (ch.nodeType === 1) ch.classList.add('w');
    }
  };
  walk(st);
  const words = $$('.w', st);
  const onScroll = () => {
    const r = st.getBoundingClientRect(), vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
    const k = Math.round(p * words.length * 1.15);
    words.forEach((w, i) => w.classList.toggle('lit', i < k));
  };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

/* ------------------------------------------------------------ hero galaxy + explorer */
loadLibrary().then((lib) => {
  createGalaxy($('#galaxy'), lib, { parallax: true, dust: true, spin: 0.035, camZ: 20, camY: 2.5, pointScale: 1.05 });
  $('#hero-count').textContent = `${fmt(lib.n)} indexed entries · ${lib.meta.categories.length} labels`;
  const exCanvas = $('#explorer-canvas');
  let ex = null;
  const start = () => {
    if (ex) return;
    ex = createGalaxy(exCanvas, lib, { interactive: true, camZ: 21, camY: 6, pointScale: 1.25 });
    const tip = $('#tooltip');
    ex.onHover((i, p) => {
      if (i < 0) { tip.classList.remove('on'); return; }
      tip.querySelector('.t').textContent = lib.meta.categories[lib.cat[i]];
      tip.querySelector('.s').textContent = `${lib.meta.sources[lib.src[i]]} · ${TYPE_NAMES[lib.type[i]]}`;
      tip.style.left = p.x + 'px'; tip.style.top = p.y + 'px';
      tip.classList.add('on');
    });
    let tFilter = 'all', cat = -1;
    const apply = () => {
      ex.setFilter((i) => tFilter === 'all' || (tFilter === '1' ? lib.type[i] === 1 || lib.type[i] === 3 : tFilter === '2' ? lib.type[i] === 2 || lib.type[i] === 3 : lib.type[i] === 0));
      const k = cat >= 0 ? ex.setHighlight((i) => lib.cat[i] === cat) : ex.setHighlight(null);
      $('#cat-count').textContent = cat >= 0 ? `${fmt(k)} entries` : '';
    };
    $('#type-filter').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('#type-filter button').forEach((x) => x.classList.toggle('on', x === b));
      tFilter = b.dataset.t; apply();
    });
    const dl = $('#cat-list');
    dl.innerHTML = lib.meta.categories.map((c) => `<option value="${c}">`).join('');
    const lower = lib.meta.categories.map((c) => c.toLowerCase());
    $('#cat-search').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      cat = q ? lower.indexOf(q) : -1;
      if (q && cat < 0) cat = lower.findIndex((c) => c.startsWith(q));
      apply();
    });
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) start(); }, { rootMargin: '300px' }).observe(exCanvas);
});

/* ------------------------------------------------------------ film */
const filmCard = $('#film-card'), filmVideo = $('#film-video');
const filmPlay = () => {
  const full = filmCard.dataset.full || 'static/video/affordcraft_film.mp4';
  if (!filmCard.classList.contains('is-playing')) {
    filmVideo.src = full; filmVideo.muted = false; filmVideo.loop = false; filmVideo.controls = true;
    filmCard.classList.add('is-playing');
    filmVideo.play().catch(() => {});
  }
};
$('#film-play').addEventListener('click', filmPlay);
$$('[data-play-film]').forEach((a) => a.addEventListener('click', () => setTimeout(filmPlay, 650)));
new IntersectionObserver(([e]) => {
  if (filmCard.classList.contains('is-playing')) { if (!e.isIntersecting) filmVideo.pause(); return; }
  if (e.isIntersecting) filmVideo.play().catch(() => {}); else filmVideo.pause();
}, { threshold: 0.25 }).observe(filmCard);

/* ------------------------------------------------------------ generic autoplay for muted videos */
const vidObs = new IntersectionObserver((es) => {
  for (const e of es) { const v = e.target; if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }
}, { threshold: 0.2 });

/* ------------------------------------------------------------ scrollytelling */
const STEP_NAMES = ['Ground', 'Retrieve', 'Select', 'Adapt', 'Gate', 'Use'];
const stage = $('#stage');
const layers = $$('.stage-layer', stage);
const progress = $$('#stage-progress i');
let stepNow = -1;
const CANDS = [
  { id: '7292', s: 0.371, v: 'partial', why: 'hinged door, no control panel' },
  { id: '7349', s: 0.344, v: 'partial', why: 'extra rotating tray, buttons' },
  { id: '7366', s: 0.315, v: 'partial', why: 'buttons laid out differently' },
  { id: '7310', s: 0.298, v: 'match', why: 'one hinged door, as in the photo' },
  { id: '7263', s: 0.289, v: 'mismatch', why: 'many sliding button joints' },
  { id: '7236', s: 0.277 }, { id: '7296', s: 0.276 }, { id: '7273', s: 0.270 },
];
$('#cands').innerHTML = CANDS.map((c, i) => `
  <div class="cand ${c.id === '7310' ? 'sel' : ''} ${c.v ? 'noted' : ''}" style="transition-delay:${i * 55}ms">
    <span class="rk">#${i + 1}</span>
    <div class="img"><img src="static/img/kitchen/cand_${c.id}.webp" alt="Library entry ${c.id}" loading="lazy"></div>
    <div class="who"><b>Microwave ${c.id}</b><span>PartNet-Mobility · cosine ${c.s.toFixed(3)}</span><div class="why">${c.why || 'not examined: the first group of five already has a match'}</div></div>
    <div class="sc"><b>${c.s.toFixed(3)}</b><div class="bar"><i style="--w:${Math.round(((c.s - 0.2) / (0.371 - 0.2)) * 100)}%"></i></div>
      <div class="verdict v-${c.v || 'none'}"><span>${c.v === 'match' ? 'match · selected' : c.v || 'group 2'}</span></div></div>
  </div>`).join('');
// kitchen boxes, as in Figure 1 of the paper: every object to build (cyan), the task target in orange
const BOXES = {
  WallCabinetL: [0.07, 0.088, 0.268, 0.355], WallCabinet: [0.27, 0.085, 0.65, 0.355], Refrigerator: [0.645, 0.135, 0.953, 0.821],
  Oven: [0.0, 0.57, 0.248, 0.938], BaseCabinetL: [0.235, 0.525, 0.36, 0.79], BaseCabinetR: [0.357, 0.5, 0.632, 0.805],
  Kettle: [0.466, 0.393, 0.573, 0.48], Microwave: [0.206, 0.373, 0.445, 0.488],
};
$('#kitchen-boxes').innerHTML = Object.entries(BOXES).map(([k, b], i) => {
  const [x0, y0, x1, y1] = [b[0] * 457, b[1] * 640, b[2] * 457, b[3] * 640];
  const target = k === 'Microwave';
  return `<g class="bbox ${target ? 'target' : 'det'}"><rect x="${x0 + 1.5}" y="${y0 + 1.5}" width="${x1 - x0 - 3}" height="${y1 - y0 - 3}" rx="3" style="transition-delay:${0.1 + i * 0.12}s"/>` +
    (target ? `<text x="${x0 + 5}" y="${y0 - 6}" style="transition-delay:${0.2 + i * 0.12}s">Microwave · task target</text>` : '') + '</g>';
}).join('');
let typedTimer = 0;
function typeInstr() {
  const el = $('#typed'), text = el.dataset.text; let k = 0; clearInterval(typedTimer); el.textContent = '';
  typedTimer = setInterval(() => { el.textContent = text.slice(0, ++k); if (k >= text.length) clearInterval(typedTimer); }, 55);
}
let gateTimers = [];
function runGate() {
  gateTimers.forEach(clearTimeout); gateTimers = [];
  const items = $$('#gate-list .gate-item'); items.forEach((it) => it.classList.remove('ok')); $('#pass-stamp').classList.remove('on');
  items.forEach((it, i) => gateTimers.push(setTimeout(() => it.classList.add('ok'), 350 + i * 420)));
  gateTimers.push(setTimeout(() => $('#pass-stamp').classList.add('on'), 350 + items.length * 420 + 150));
}
const deployVideo = $('#deploy-video');
let adaptPlayer = null, gatePlayer = null;
function setStep(k) {
  if (k === stepNow) return;
  stepNow = k;
  stage.dataset.step = k;
  $('#stage-idx').textContent = String(k + 1).padStart(2, '0');
  $('#stage-name').textContent = STEP_NAMES[k];
  progress.forEach((p, i) => p.classList.toggle('on', i <= k));
  const layerFor = k === 2 ? 1 : k;
  layers.forEach((l) => l.classList.toggle('is-on', +l.dataset.layer === layerFor));
  $('.stage-layer[data-layer="1"]').classList.toggle('select-mode', k === 2);
  if (k === 0) typeInstr();
  if (adaptPlayer) (k === 3 ? play : stop)(adaptPlayer);
  if (gatePlayer) (k === 4 ? play : stop)(gatePlayer);
  if (k === 4) runGate();
  if (k === 5) { deployVideo.currentTime = 0; deployVideo.play().catch(() => {}); } else deployVideo.pause();
}
const stepEls = $$('#steps .step');
const stepObs = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) {
    stepEls.forEach((s) => s.classList.toggle('is-active', s === e.target));
    setStep(+e.target.dataset.step);
  }
}, { rootMargin: matchMedia('(max-width: 980px)').matches ? '-66% 0px -26% 0px' : '-45% 0px -45% 0px' });
stepEls.forEach((s) => stepObs.observe(s));
new IntersectionObserver(([e]) => { if (e.isIntersecting && stepNow <= 0) { stepNow = -1; setStep(0); } }, { threshold: 0.4 }).observe(stage);

/* ------------------------------------------------------------ gallery + stage sprites */
fetch('static/assets/assets.json').then((r) => (r.ok ? r.json() : null)).then((data) => {
  if (!data) return;
  buildGallery($('#gallery-grid'), $('#gallery-filters'), data);
  const mw = data.assets.find((a) => a.cid === '7310') || data.assets[0];
  adaptPlayer = new SpritePlayer($('#adapt-canvas'), mw, { pad: 0.04, offsetY: 0, hold0: 0.4, open: 1.6, hold1: 1.2, close: 1.4 });
  gatePlayer = new SpritePlayer($('#gate-canvas'), mw, { pad: 0.02, offsetY: 0, tint: true });
  adaptPlayer.load('w'); gatePlayer.load('w'); gatePlayer.load('t');
  if (stepNow === 3) play(adaptPlayer);
  if (stepNow === 4) play(gatePlayer);
}).catch(() => {});

/* ------------------------------------------------------------ results */
renderTable($('#table-main'));
renderScatter($('#chart-scatter'));
renderScaling($('#chart-scaling'));
renderAblation($('#chart-ablation'));

/* ------------------------------------------------------------ robots */
const cmp = $('#compare');
if (cmp) {
  const setPos = (clientX) => {
    const r = cmp.getBoundingClientRect();
    cmp.style.setProperty('--pos', Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)) + '%');
  };
  let drag = false;
  cmp.addEventListener('pointerdown', (e) => { drag = true; cmp.setPointerCapture(e.pointerId); setPos(e.clientX); });
  cmp.addEventListener('pointermove', (e) => { if (drag) setPos(e.clientX); });
  cmp.addEventListener('pointerup', () => { drag = false; });
  // a one-time hint sweep when it scrolls into view
  new IntersectionObserver(([e], o) => {
    if (!e.isIntersecting) return; o.disconnect();
    const t0 = performance.now();
    const f = (now) => { const p = Math.min(1, (now - t0) / 1800); const v = 50 + Math.sin(p * Math.PI * 2) * 28 * (1 - p); cmp.style.setProperty('--pos', v + '%'); if (p < 1 && !drag) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }, { threshold: 0.6 }).observe(cmp);
}
const kv = $('#kitchen-video video');
vidObs.observe(kv);
$('#kitchen-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#kitchen-tabs button').forEach((x) => x.classList.toggle('on', x === b));
  kv.poster = `static/video/${b.dataset.src}.jpg`; kv.src = `static/video/${b.dataset.src}.mp4`;
  kv.style.objectFit = b.dataset.src === 'kitchen_photo' ? 'contain' : 'cover';
  kv.play().catch(() => {});
});
const SCENES = [
  ['microwave_box__policy', 'Open the microwave door fully and put the box inside', 'pol'],
  ['cabinet1_box__policy', 'Open the cabinet door fully and put the box inside', 'pol'],
  ['drawer_cup__policy', 'Open the top drawer and put the cup inside', 'pol'],
  ['drawer_to_cabinet__policy', 'Move the cup from the drawer into the cabinet, close the drawer', 'pol'],
  ['drawer_to_fridge__policy', 'Move the cup from the drawer into the refrigerator, close the drawer', 'pol'],
  ['fridge_cup__teacher', 'Open the refrigerator door fully and put the cup inside', 'tea'],
  ['cabinet_cup__teacher', 'Open the cabinet door fully and put the cup inside', 'tea'],
  ['drawer_two__teacher', 'Open the top drawer and put both cups inside', 'tea'],
  ['laptop_cup__teacher', 'Close the laptop and put the cup on top', 'tea'],
  ['trashcan_box__teacher', 'Open the trash can lid and put the box inside', 'tea'],
];
$('#scene-grid').innerHTML = SCENES.map(([f, cap, k]) => `
  <div class="scard reveal"><div class="v"><video muted loop playsinline preload="none" poster="static/video/scenes/${f}.jpg"><source src="static/video/scenes/${f}.mp4" type="video/mp4"></video>
  <span class="badge ${k}">${k === 'pol' ? 'trained policy · held-out' : 'scripted teacher'}</span></div>
  <div class="cap">“${cap}”<i>${k === 'pol' ? 'first passed held-out episode, round 2' : 'first passed demonstration'}</i></div></div>`).join('');
$$('#scene-grid video').forEach((v) => vidObs.observe(v));
$$('#scene-grid .reveal').forEach((el) => revObs.observe(el));

/* ------------------------------------------------------------ lightbox, copy */
const lb = $('#lightbox');
document.addEventListener('click', (e) => {
  const z = e.target.closest('[data-zoom]');
  if (z) { lb.querySelectorAll('img').forEach((x) => x.remove()); const im = new Image(); im.src = z.dataset.zoom; lb.appendChild(im); lb.classList.add('on'); return; }
  if (e.target.closest('#lightbox')) lb.classList.remove('on');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('on'); });
$('#copy-bib').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText($('#bibtex').innerText); b.querySelector('span').textContent = 'Copied'; }
  catch { b.querySelector('span').textContent = 'Select & copy'; }
  setTimeout(() => (b.querySelector('span').textContent = 'Copy'), 1800);
});

/* screenshot helper: ?shot&at=<id>[&dy=<px>] scrolls there after load */
if (SHOT) {
  const q = new URLSearchParams(location.search);
  const at = q.get('at');
  if (at) setTimeout(() => {
    const el = document.getElementById(at);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + parseFloat(q.get('dy') || '0'));
  }, 400);
}
