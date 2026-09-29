// Hand-built SVG charts and the results table. All numbers are copied from the paper (Table 1, Table 2, Appendix Table "Library growth").
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
function txt(parent, x, y, s, attrs = {}) { const t = el('text', { x, y, ...attrs }, parent); t.textContent = s; return t; }

// Table 1 rows: pass = native if defined, else adapted (hollow marker)
export const MAIN = [
  { m: 'PhysX-Anything', n: 2000, exp: 97.85, nat: 44.55, ada: 30.10, art: 16.35, t: '303.3', p5: '34.4', gpu: 11.3, peak: '19.6', group: 'gen' },
  { m: 'PhysX-Omni', n: 2000, exp: 98.05, nat: 36.50, ada: 26.60, art: 16.35, t: '464.6', p5: '15.6', gpu: 21.2, peak: '60.5', group: 'gen' },
  { m: 'PAct', n: 2000, exp: 94.60, nat: 23.70, ada: 16.80, art: 14.65, t: '108.8', p5: '15.6', gpu: 7.7, peak: '21.8', group: 'gen' },
  { m: 'PartCrafter', n: 2000, exp: 99.95, nat: null, ada: 6.10, art: 0.00, t: '230.0‡', p5: '3.1‡', gpu: 62.8, gpuS: '62.8‡', peak: '13.6', group: 'gen' },
  { m: 'TRELLIS.2', n: 2000, exp: 98.80, nat: null, ada: 23.60, art: 0.00, t: '393.9‡', p5: '3.1‡', gpu: 27.8, gpuS: '27.8‡', peak: '21.5', group: 'gen' },
  { m: 'Articulate-Anything', n: 200, exp: 81.00, nat: null, ada: 35.00, art: 35.00, t: '349.6‡§', p5: '16.0‡§', gpu: 16.6, gpuS: '16.6‡§', peak: '', group: 'api' },
  { m: 'GPT-6 Astra agent', n: 200, exp: 99.50, nat: 34.50, ada: 22.00, art: 27.00, t: '1423.0§', p5: '6.0§', gpu: 68.7, gpuS: '68.7§', peak: '', group: 'api' },
  { m: 'AffordCraft (ours)', n: 2000, exp: 85.15, nat: 85.15, ada: null, art: 56.60, t: '40.0', p5: '53.1', gpu: 0.8, peak: '21.2', group: 'ours' },
];

export function renderTable(table) {
  const f = (v) => (v === null || v === undefined ? '–' : v.toFixed(2));
  const best = { exp: 'PartCrafter', nat: 'AffordCraft (ours)', ada: 'Articulate-Anything', art: 'AffordCraft (ours)', t: 'AffordCraft (ours)', p5: 'AffordCraft (ours)', gpu: 'AffordCraft (ours)', peak: 'PartCrafter' };
  let h = '<thead><tr><th>Method</th><th>N</th><th>Export %</th><th>Native %</th><th>Adapted %</th><th>Artic. %</th><th>Median time (s)</th><th>Pass in 5 min %</th><th>GPU min / pass</th><th>Peak GiB</th></tr></thead><tbody>';
  let grp = '';
  for (const r of MAIN) {
    if (r.group !== grp) {
      grp = r.group;
      if (grp === 'gen') h += '<tr class="grp"><td colspan="10">Generative reconstruction or mesh generation from one RGB image</td></tr>';
      if (grp === 'api') h += '<tr class="grp"><td colspan="10">Library retrieval or general agent (200-input subset)</td></tr>';
      if (grp === 'ours') h += '<tr class="grp"><td colspan="10"></td></tr>';
    }
    const c = (k, v, cls = '') => `<td class="${best[k] === r.m ? 'best' : ''} ${cls}">${v}</td>`;
    h += `<tr class="${grp === 'ours' ? 'ours' : ''}"><td>${r.m}</td><td>${r.n.toLocaleString('en-US')}</td>` +
      c('exp', f(r.exp)) + c('nat', f(r.nat), r.nat === null ? 'na' : '') + c('ada', f(r.ada), r.ada === null ? 'na' : '') + c('art', f(r.art)) +
      c('t', r.t) + c('p5', r.p5) + c('gpu', r.gpuS || r.gpu.toFixed(1)) + c('peak', r.peak) + '</tr>';
  }
  table.innerHTML = h + '</tbody>';
}

export function renderScatter(host) {
  const W = 640, H = 430, m = { l: 52, r: 18, t: 14, b: 44 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Physical pass rate against GPU minutes per accepted asset' });
  const x = (v) => m.l + ((Math.log10(v) - Math.log10(0.5)) / (Math.log10(100) - Math.log10(0.5))) * (W - m.l - m.r);
  const y = (v) => H - m.b - (v / 100) * (H - m.t - m.b);
  const g = el('g', { class: 'grid' }, svg);
  for (const v of [0, 20, 40, 60, 80, 100]) { el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, g); txt(svg, m.l - 10, y(v) + 4, v + '%', { 'text-anchor': 'end' }); }
  for (const v of [0.5, 1, 2, 5, 10, 20, 50, 100]) { el('line', { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b }, g); txt(svg, x(v), H - m.b + 18, v, { 'text-anchor': 'middle' }); }
  txt(svg, (W + m.l) / 2, H - 6, 'GPU minutes per accepted asset (log)', { 'text-anchor': 'middle' });
  // "better" corner
  const defs = el('defs', {}, svg);
  const rg = el('radialGradient', { id: 'hot', cx: '0', cy: '0', r: '1' }, defs);
  el('stop', { offset: '0', 'stop-color': '#ff6a1f', 'stop-opacity': '0.28' }, rg);
  el('stop', { offset: '1', 'stop-color': '#ff6a1f', 'stop-opacity': '0' }, rg);
  el('rect', { x: m.l, y: m.t, width: 230, height: 190, fill: 'url(#hot)' }, svg);
  txt(svg, m.l + 12, m.t + 20, '← cheaper, more assets pass ↑', { fill: '#ff9a57' });
  const pts = el('g', {}, svg);
  const lab = { 'PhysX-Anything': [10, -10], 'PhysX-Omni': [10, 18], 'PAct': [-10, -10, 'end'], 'PartCrafter': [-10, -10, 'end'], 'TRELLIS.2': [10, 16], 'Articulate-Anything': [-10, -12, 'end'], 'GPT-6 Astra agent': [8, -13, 'end'] };
  for (const r of MAIN) {
    const ours = r.group === 'ours';
    const val = r.nat ?? r.ada; const hollow = r.nat === null;
    const cx = x(r.gpu), cy = y(val);
    const gg = el('g', { class: 'pt', style: 'cursor:default' }, pts);
    if (ours) {
      el('circle', { cx, cy, r: 26, fill: '#ff6a1f', opacity: 0.12 }, gg).innerHTML = '<animate attributeName="r" values="16;30;16" dur="2.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.25;0.02;0.25" dur="2.8s" repeatCount="indefinite"/>';
      el('circle', { cx, cy, r: 9, fill: '#ff6a1f', stroke: '#fff', 'stroke-width': 2 }, gg);
      txt(gg, cx + 16, cy + 5, 'AffordCraft', { class: 'lbl-big', style: 'font-size:15px' });
      txt(gg, cx + 16, cy + 22, '85.2% · 0.8 min', { fill: '#ff9a57' });
    } else {
      el('circle', { cx, cy, r: 6.5, fill: hollow ? 'none' : (r.group === 'api' ? '#8be9fb' : '#c9d1dc'), stroke: r.group === 'api' ? '#8be9fb' : '#c9d1dc', 'stroke-width': 1.8 }, gg);
      const [dx, dy, anchor] = lab[r.m] || [10, 4];
      txt(gg, cx + dx, cy + dy, r.m, { 'text-anchor': anchor || 'start', fill: '#c9d1dc' });
    }
    el('title', {}, gg).textContent = `${r.m}: ${val.toFixed(2)}% ${hollow ? '(adapted)' : '(native)'}, ${r.gpu} GPU-min per pass, N=${r.n}`;
  }
  host.appendChild(svg);
}

export function renderScaling(host) {
  const rows = [
    { k: 'Base', n: 141, cov: 46.15, top: 17.5 },
    { k: '+ instances', n: 418, cov: 46.15, top: 22.3 },
    { k: '+ mechanisms', n: 472, cov: 46.15, top: 24.75 },
    { k: '+ categories', n: 614, cov: 100, top: 30.3 },
    { k: 'Full', n: 11372, cov: 100, top: 51.45 },
  ];
  const W = 520, H = 430, m = { l: 44, r: 20, t: 20, b: 64 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Library growth chart' });
  const x = (i) => m.l + 20 + (i / (rows.length - 1)) * (W - m.l - m.r - 40);
  const y = (v) => H - m.b - (v / 100) * (H - m.t - m.b);
  const g = el('g', { class: 'grid' }, svg);
  for (const v of [0, 25, 50, 75, 100]) { el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, g); txt(svg, m.l - 8, y(v) + 4, v + '%', { 'text-anchor': 'end' }); }
  rows.forEach((r, i) => {
    txt(svg, x(i), H - m.b + 20, r.n.toLocaleString('en-US'), { 'text-anchor': 'middle', fill: '#eef2f7' });
    txt(svg, x(i), H - m.b + 36, r.k, { 'text-anchor': 'middle' });
  });
  const line = (key, color, dash) => {
    const d = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r[key])}`).join(' ');
    const p = el('path', { d, fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-dasharray': dash || '', 'stroke-linejoin': 'round' }, svg);
    p.classList.add('draw');
    rows.forEach((r, i) => {
      el('circle', { cx: x(i), cy: y(r[key]), r: 5, fill: '#07090c', stroke: color, 'stroke-width': 2.2 }, svg);
      if (i === 0 || i === rows.length - 1 || (key === 'cov' && i === 3)) txt(svg, x(i) + (i === rows.length - 1 ? -8 : 8), y(r[key]) - 10, r[key] + '%', { fill: color, 'text-anchor': i === rows.length - 1 ? 'end' : 'start' });
    });
  };
  line('cov', '#39d5f2');
  line('top', '#ff6a1f');
  const lg = el('g', {}, svg);
  el('line', { x1: m.l + 10, x2: m.l + 30, y1: H - 10, y2: H - 10, stroke: '#39d5f2', 'stroke-width': 2.5 }, lg); txt(lg, m.l + 36, H - 6, 'category coverage');
  el('line', { x1: m.l + 190, x2: m.l + 210, y1: H - 10, y2: H - 10, stroke: '#ff6a1f', 'stroke-width': 2.5 }, lg); txt(lg, m.l + 216, H - 6, 'top-1 agreement');
  host.appendChild(svg);
}

export function renderAblation(host) {
  const rows = [
    ['Articulation adapter', -40.0, true], ['Task condition', -22.0, true], ['Physical-feedback reselection', -11.0, true],
    ['Decomposition cascade', -8.0, true], ['Scale adaptation', -1.5, false], ['Deterministic repair', 0.0, false],
    ['Installation evidence', 0.0, false], ['Multimodal selection', 2.0, false], ['CLIP for DINOv2 (swap)', 2.0, false],
  ];
  const W = 560, rowH = 34, m = { l: 214, r: 50, t: 10, b: 30 };
  const H = m.t + m.b + rows.length * rowH;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Ablation study bars' });
  const lo = -42, hi = 6;
  const x = (v) => m.l + ((v - lo) / (hi - lo)) * (W - m.l - m.r);
  const g = el('g', { class: 'grid' }, svg);
  for (const v of [-40, -30, -20, -10, 0]) { el('line', { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b }, g); txt(svg, x(v), H - 10, (v > 0 ? '+' : '') + v, { 'text-anchor': 'middle' }); }
  rows.forEach(([name, d, sig], i) => {
    const cy = m.t + i * rowH + rowH / 2;
    txt(svg, m.l - 12, cy + 4, (name.includes('swap') ? '' : 'w/o ') + name, { 'text-anchor': 'end', fill: '#c9d1dc', style: 'font-family:Inter,sans-serif;font-size:12.5px' });
    const x0 = x(Math.min(0, d)), w = Math.max(2, Math.abs(x(d) - x(0)));
    el('rect', { x: x0, y: cy - 9, width: w, height: 18, rx: 4, fill: sig ? '#ff6a1f' : 'none', stroke: sig ? 'none' : '#6a7483', 'stroke-width': 1.3, 'stroke-dasharray': sig ? '' : '3 3' }, svg);
    txt(svg, d < 0 ? x0 - 6 : x0 + w + 6, cy + 4, (d > 0 ? '+' : d === 0 ? '±' : '') + d.toFixed(1), { 'text-anchor': d < 0 ? 'end' : 'start', fill: sig ? '#ff9a57' : '#95a0af' });
  });
  el('line', { x1: x(0), x2: x(0), y1: m.t - 4, y2: H - m.b + 4, stroke: '#eef2f7', 'stroke-width': 1.2 }, svg);
  host.appendChild(svg);
}
