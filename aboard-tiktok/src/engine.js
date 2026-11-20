'use strict';
/* Tiny deterministic animation toolkit: everything on screen is a pure function of time,
   so any frame can be rendered on its own (and in parallel). */

const W = 1080, H = 1920, FPS = 30;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));

const E = {
  lin: x => x,
  inQuad: x => x * x,
  outQuad: x => 1 - (1 - x) * (1 - x),
  inOutQuad: x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: x => x * x * x,
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inQuart: x => x * x * x * x,
  outQuart: x => 1 - Math.pow(1 - x, 4),
  inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  // 0 -> 1 with a damped overshoot
  spring: (x, damping = 5.5, freq = 2.6) => (x >= 1 ? 1 : 1 - Math.exp(-damping * x) * Math.cos(freq * Math.PI * x)),
};

/* decaying wobble that starts (and ends) at rest: used for impact "bumps" */
const bump = (t, dur = 0.5, freq = 3.2) => (t <= 0 || t >= dur ? 0 : Math.sin(freq * 2 * Math.PI * t) * Math.pow(1 - t / dur, 2.2));

/* cheap deterministic pseudo-noise in [-1, 1] (for hand-held camera drift) */
const noise = (t, seed = 0) =>
  (Math.sin(t * 1.7 + seed * 12.9898) + Math.sin(t * 2.9 + seed * 78.233) * 0.6 + Math.sin(t * 4.7 + seed * 37.719) * 0.3) / 1.9;

/* ---------- 3x3 projective matrices (row-major) ---------- */
const M = {
  I: () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  mul(A, B) {
    const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    return R;
  },
  inv(A) {
    const [[a, b, c], [d, e, f], [g, h, i]] = A;
    const A1 = e * i - f * h, B1 = -(d * i - f * g), C1 = d * h - e * g;
    const det = a * A1 + b * B1 + c * C1;
    return [
      [A1 / det, -(b * i - c * h) / det, (b * f - c * e) / det],
      [B1 / det, (a * i - c * g) / det, -(a * f - c * d) / det],
      [C1 / det, -(a * h - b * g) / det, (a * e - b * d) / det],
    ];
  },
  apply(A, [x, y]) {
    const w = A[2][0] * x + A[2][1] * y + A[2][2];
    return [(A[0][0] * x + A[0][1] * y + A[0][2]) / w, (A[1][0] * x + A[1][1] * y + A[1][2]) / w];
  },
  /* similarity: scale s, rotation r (rad), then translate */
  sim: (s, tx, ty, r = 0) => [[Math.cos(r) * s, -Math.sin(r) * s, tx], [Math.sin(r) * s, Math.cos(r) * s, ty], [0, 0, 1]],
  /* projective map taking 4 points onto 4 points */
  homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [X, Y] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
      A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
    }
    const n = 8;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const k = A[r][c] / A[c][c];
        for (let j = c; j < n; j++) A[r][j] -= k * A[c][j];
        b[r] -= k * b[c];
      }
    }
    const h = b.map((v, i) => v / A[i][i]);
    return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  },
  css(A) {
    const k = A[2][2];
    const f = v => (v / k).toFixed(10);
    return `matrix3d(${f(A[0][0])},${f(A[1][0])},0,${f(A[2][0])},${f(A[0][1])},${f(A[1][1])},0,${f(A[2][1])},0,0,1,0,${f(A[0][2])},${f(A[1][2])},0,1)`;
  },
};

const RECT = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
const FRAME = RECT(W, H);

/* camera looking at a photo: (cx, cy) = photo point at frame centre, vh = photo px visible vertically */
function cam({ cx, cy, vh, rot = 0, ox = 0, oy = 0 }) {
  const s = H / vh;
  return M.mul(M.sim(1, W / 2 + ox, H / 2 + oy), M.mul(M.sim(s, 0, 0, rot), M.sim(1, -cx, -cy)));
}
const camLerp = (a, b, t) => ({
  cx: lerp(a.cx, b.cx, t), cy: lerp(a.cy, b.cy, t), vh: Math.exp(lerp(Math.log(a.vh), Math.log(b.vh), t)),
  rot: lerp(a.rot || 0, b.rot || 0, t), ox: lerp(a.ox || 0, b.ox || 0, t), oy: lerp(a.oy || 0, b.oy || 0, t),
});

/* ---------- DOM helpers ---------- */
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'style') Object.assign(e.style, attrs[k]);
    else if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  kids.flat().forEach(c => c != null && e.append(c));
  return e;
}
function s(tag, attrs = {}, ...kids) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  kids.flat().forEach(c => c != null && e.append(c));
  return e;
}

/* ---------- type measurement (canvas) ---------- */
const _ctx = document.createElement('canvas').getContext('2d');
const EMOJI = "'Noto Color Emoji'";
function measure(text, font = 'Anton', weight = 400) {
  _ctx.font = `${weight} 200px ${font}, ${EMOJI}`;
  return _ctx.measureText(text).width / 200;          // advance width per 1px of font-size
}
function capHeight(font = 'Anton', weight = 400) {
  _ctx.font = `${weight} 200px ${font}`;
  return _ctx.measureText('H').actualBoundingBoxAscent / 200;
}

/* A block of lines, each scaled so it is exactly `w` wide (poster-style justified stack).
   Returns {g, lines:[{g,cx,cy,size}], bottom}. Each line can be animated via setLine(). */
function stack(lines, { x = 90, w = 900, top = 0, gap = 34, font = 'Anton', weight = 400, fill = '#000', ls = 0 } = {}) {
  const g = s('g');
  const out = [];
  let y = top;
  for (const ln of lines) {
    const L = typeof ln === 'string' ? { text: ln } : ln;
    const lw = w * (L.scale || 1);
    const f = L.font || font, wt = L.weight || weight;
    const size = L.size || lw / (measure(L.text, f, wt) + ls * Math.max(0, [...L.text].length - 1));
    const ch = capHeight(f, wt) * size;
    y += (L.pre || 0);
    const base = y + ch;
    const tw = (measure(L.text, f, wt) + ls * Math.max(0, [...L.text].length - 1)) * size;
    const tx = x + (w - tw) / 2;
    const t = s('text', {
      x: tx.toFixed(2), y: base.toFixed(2), 'font-size': size.toFixed(2), fill: L.fill || fill,
      'font-family': `${f}, ${EMOJI}`, 'font-weight': wt, 'letter-spacing': (ls * size).toFixed(2),
    });
    t.textContent = L.text;
    const lg = s('g', {}, t);
    g.append(lg);
    out.push({ g: lg, cx: x + w / 2, cy: y + ch / 2, size, top: y, bottom: base });
    y = base + (L.gap != null ? L.gap : gap);
  }
  return { g, lines: out, bottom: y };
}
/* scale/translate/fade one stack line about its own centre */
function setLine(line, { sc = 1, dx = 0, dy = 0, rot = 0, o = 1 } = {}) {
  line.g.setAttribute('transform', `translate(${line.cx + dx} ${line.cy + dy}) rotate(${rot}) scale(${sc}) translate(${-line.cx} ${-line.cy})`);
  line.g.setAttribute('opacity', o);
}
/* generic "set transform about a point" for any svg node */
function setT(node, cx, cy, { sc = 1, dx = 0, dy = 0, rot = 0, o = 1, sx = null, sy = null } = {}) {
  node.setAttribute('transform', `translate(${cx + dx} ${cy + dy}) rotate(${rot}) scale(${sx ?? sc} ${sy ?? sc}) translate(${-cx} ${-cy})`);
  node.setAttribute('opacity', o);
}

/* standard entrance for a line: slams in from large with a short fade */
function slam(tl, delay = 0, dur = 0.26) {
  const p = prog(tl, delay, delay + dur);
  return { sc: lerp(1.55, 1, E.outExpo(p)) + 0.035 * bump(tl - delay - dur * 0.55, 0.3, 4), o: prog(tl, delay, delay + 0.06) };
}
/* springy pop from small */
function pop(tl, delay = 0, dur = 0.42) {
  const p = prog(tl, delay, delay + dur);
  return { sc: p <= 0 ? 0 : E.spring(p), o: prog(tl, delay, delay + 0.05) };
}
