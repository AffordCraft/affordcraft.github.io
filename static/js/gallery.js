// Asset loops: every asset is a sprite sheet of N frames (rest -> fully actuated) rendered in Isaac Sim with a
// chroma-key alpha. Frames are played forward and backward with easing, so the loop opens and closes smoothly.
const imgCache = new Map();
export function loadImage(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = src; }));
  }
  return imgCache.get(src);
}
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export class SpritePlayer {
  constructor(canvas, asset, opts = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.a = asset; this.opts = opts;
    this.phase = opts.phase || 0; this.tint = 0; this.tintTarget = opts.tint ? 1 : 0;
    this.w = null; this.t = null; this.running = false; this.frameOverride = null;
    this.hold0 = opts.hold0 ?? 0.55; this.open = opts.open ?? 1.5; this.hold1 = opts.hold1 ?? 1.0; this.close = opts.close ?? 1.3;
    this.pad = opts.pad ?? 0.08; this.offsetY = opts.offsetY ?? 0.04; this.box = opts.box || null;
  }
  async load(which = 'w') {
    if (which === 'w' && !this.w) this.w = await loadImage(this.a.w);
    if (which === 't' && !this.t && this.a.t) this.t = await loadImage(this.a.t);
  }
  progressAt(time) {
    const T = this.hold0 + this.open + this.hold1 + this.close;
    let u = ((time + this.phase) % T + T) % T;
    if (u < this.hold0) return 0; u -= this.hold0;
    if (u < this.open) return ease(u / this.open); u -= this.open;
    if (u < this.hold1) return 1; u -= this.hold1;
    return 1 - ease(u / this.close);
  }
  fit() {
    const c = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  }
  draw(time) {
    if (!this.w) return;
    this.fit();
    const { ctx, canvas: c, a } = this;
    const p = this.frameOverride ?? this.progressAt(time);
    const k = Math.round(p * (a.n - 1));
    const sx = (k % a.cols) * a.fw, sy = Math.floor(k / a.cols) * a.fh;
    let bx = 0, by = 0, bw = c.width, bh = c.height;
    if (this.box) { bx = this.box[0] * c.width; by = this.box[1] * c.height; bw = (this.box[2] - this.box[0]) * c.width; bh = (this.box[3] - this.box[1]) * c.height; }
    const pad = this.pad * Math.min(bw, bh);
    const s = Math.min((bw - 2 * pad) / a.fw, (bh - 2 * pad) / a.fh);
    const dw = a.fw * s, dh = a.fh * s, dx = bx + (bw - dw) / 2, dy = by + (bh - dh) / 2 + this.offsetY * c.height;
    ctx.clearRect(0, 0, c.width, c.height);
    this.tint += (this.tintTarget - this.tint) * 0.12;
    if (this.tint < 0.99 || !this.t) { ctx.globalAlpha = 1; ctx.drawImage(this.w, sx, sy, a.fw, a.fh, dx, dy, dw, dh); }
    if (this.t && this.tint > 0.01) { ctx.globalAlpha = this.tint; ctx.drawImage(this.t, sx, sy, a.fw, a.fh, dx, dy, dw, dh); ctx.globalAlpha = 1; }
    return p;
  }
}

// one shared animation loop for every visible player
const active = new Set();
let rafId = 0;
function tick(now) {
  const t = now / 1000;
  for (const p of active) p.draw(t);
  rafId = active.size ? requestAnimationFrame(tick) : 0;
}
export function play(player) { active.add(player); if (!rafId) rafId = requestAnimationFrame(tick); }
export function stop(player) { active.delete(player); }

export async function buildGallery(grid, filtersHost, data) {
  const assets = data.assets;
  const cats = {};
  for (const a of assets) cats[a.group] = (cats[a.group] || 0) + 1;
  const order = Object.keys(cats).sort((x, y) => cats[y] - cats[x]);
  filtersHost.innerHTML = `<button class="on" data-g="all">All<span>${assets.length}</span></button>` + order.map((g) => `<button data-g="${g}">${g}<span>${cats[g]}</span></button>`).join('');
  const cards = [];
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      const card = cards.find((c) => c.el === e.target);
      if (!card) continue;
      if (e.isIntersecting) { card.player.load('w').then(() => play(card.player)); } else stop(card.player);
    }
  }, { rootMargin: '200px 0px' });
  assets.forEach((a, i) => {
    const el = document.createElement('div');
    el.className = 'gcard';
    el.dataset.g = a.group;
    el.innerHTML = `<canvas></canvas>${a.photo ? `<div class="ph"><img loading="lazy" src="${a.photo}" alt="Input photograph"></div><span class="arrow">→</span>` : ''}<div class="lbl"><b>${a.label}</b><span>${a.src}</span></div>`;
    grid.appendChild(el);
    const player = new SpritePlayer(el.querySelector('canvas'), a, { phase: (i % 6) * 0.18 + Math.floor(i / 6) * 0.12, pad: 0.04, offsetY: 0, box: a.photo ? [0.16, 0.2, 0.98, 0.84] : [0.06, 0.08, 0.94, 0.84] });
    el.addEventListener('pointerenter', () => { player.load('t'); player.tintTarget = 1; });
    el.addEventListener('pointerleave', () => { player.tintTarget = 0; });
    cards.push({ el, player });
    io.observe(el);
  });
  filtersHost.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    filtersHost.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    const g = b.dataset.g;
    for (const c of cards) c.el.style.display = g === 'all' || c.el.dataset.g === g ? '' : 'none';
  });
  return cards;
}
