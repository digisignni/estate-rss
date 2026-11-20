'use strict';
/* Everything the A-board "says": each slide is a 1080x1920 SVG poster with its own entrance animation.
   update(tl, t, opts): tl = seconds since the slide appeared, t = absolute time. */

const C = {
  yellow: '#FFE600', pink: '#FF3C8E', blue: '#2B50FF', mint: '#1FE0B6', orange: '#FF7A00', purple: '#7A3CFF',
  ink: '#0A0A0C', white: '#FFFFFF', cream: '#FFF3DC', brown: '#3B1F0E', navy: '#0E1A4A', red: '#E5142B',
};
let _uid = 0;
const uid = p => `${p}${++_uid}`;

function root(bg) {
  const svg = s('svg', { viewBox: '0 0 1080 1920', width: 1080, height: 1920 });
  const defs = s('defs');
  svg.append(defs, s('rect', { x: 0, y: 0, width: 1080, height: 1920, fill: bg }));
  svg.defs = defs;
  return svg;
}
function emoji(ch, cx, baseline, size) {
  const t = s('text', { x: cx, y: baseline, 'font-size': size, 'text-anchor': 'middle', 'font-family': EMOJI });
  t.textContent = ch;
  const g = s('g', {}, t);
  g.cx = cx; g.cy = baseline - size * 0.36;
  return g;
}
/* rounded label ("pill") with centred text, sized to fit `w` */
function pill(text, cx, cy, { fill = C.ink, ink = C.white, w = 860, max = 118, font = 'Anton', weight = 400, ls = 0.03 } = {}) {
  const per = measure(text, font, weight) + ls * [...text].length;      // width per 1px of font size
  const size = Math.min(max, (w * 0.86) / per);
  const hgt = size * 1.62, pw = per * size + size * 1.25;
  const g = s('g', {}, s('rect', { x: cx - pw / 2, y: cy - hgt / 2, width: pw, height: hgt, rx: hgt / 2, fill }));
  const t = s('text', {
    x: cx + (ls * size) / 2, y: cy + capHeight(font, weight) * size / 2, 'font-size': size.toFixed(2), 'text-anchor': 'middle', fill: ink,
    'font-family': `${font}, ${EMOJI}`, 'font-weight': weight, 'letter-spacing': (ls * size).toFixed(2),
  });
  t.textContent = text;
  g.append(t);
  g.cx = cx; g.cy = cy; g.w = pw; g.h = hgt;
  return g;
}
/* rotating sunburst */
function rays(cx, cy, r, n, fill) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2;
    d += `M${cx} ${cy}L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}L${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}Z`;
  }
  const g = s('g', {}, s('path', { d, fill }));
  g.cx = cx; g.cy = cy;
  return g;
}
function octagon(cx, cy, r, attrs) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (22.5 + i * 45) * Math.PI / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return s('polygon', { points: pts.join(' '), ...attrs });
}

const SLIDES = {};

/* ---- A: the hook. A road STOP sign on hazard yellow. Loop-safe: at rest it is identical every time. ---- */
SLIDES.stop = () => {
  const svg = root(C.yellow);
  const pid = uid('hz');
  const pat = s('pattern', { id: pid, width: 160, height: 160, patternUnits: 'userSpaceOnUse' },
    s('rect', { x: 0, y: 0, width: 80, height: 160, fill: C.ink }));
  svg.defs.append(pat);
  svg.append(
    s('rect', { x: -400, y: 0, width: 1880, height: 132, fill: `url(#${pid})` }),
    s('rect', { x: -400, y: 1788, width: 1880, height: 132, fill: `url(#${pid})` }),
    s('rect', { x: 0, y: 132, width: 1080, height: 14, fill: C.ink }),
    s('rect', { x: 0, y: 1774, width: 1080, height: 14, fill: C.ink }),
  );
  const cx = 540, cy = 690, R = 400;
  const sign = s('g', {},
    octagon(cx + 16, cy + 22, R, { fill: C.ink }),
    octagon(cx, cy, R, { fill: C.white, stroke: C.ink, 'stroke-width': 10, 'stroke-linejoin': 'round' }),
    octagon(cx, cy, R - 36, { fill: C.red }),
  );
  const st = stack(['STOP'], { x: cx - 300, w: 600, top: 0, fill: C.white });
  const sh = st.lines[0].bottom - st.lines[0].top;
  st.g.setAttribute('transform', `translate(0 ${cy - sh / 2})`);
  sign.append(st.g);
  const scr = stack(['SCROLLING.'], { x: 118, w: 800, top: 1150, fill: C.ink });
  const you = pill('YES, YOU. 👀', 530, 1432, { fill: C.ink, ink: C.yellow, w: 560, max: 96 });
  svg.append(sign, scr.g, you);
  return {
    el: svg, glow: C.yellow,
    update(tl, t, { hook = false } = {}) {
      pat.setAttribute('patternTransform', `skewX(-38) translate(${((t * 120) % 160).toFixed(2)} 0)`);
      if (hook) {                       // first second of the video: already on screen, reacts to the "impact"
        setT(sign, cx, cy, { sc: 1 + 0.07 * bump(tl, 0.6, 2.6), rot: 2.6 * bump(tl, 0.7, 2.1) });
        setLine(scr.lines[0], { dy: -16 * bump(tl - 0.04, 0.55, 2.8) });
        const p = pop(tl, 0.34);
        setT(you, you.cx, you.cy, { sc: p.sc, o: p.o, rot: -3 });
      } else {
        const a = slam(tl, 0), b = slam(tl, 0.08);
        setT(sign, cx, cy, { sc: a.sc, o: a.o });
        setLine(scr.lines[0], { sc: b.sc, o: b.o });
        you.setAttribute('opacity', 0);
      }
    },
  };
};

/* ---- generic poster: optional emoji, a justified stack, optional pill ---- */
function poster({ bg, ink, lines, top, gap = 44, emo, pillText, pillY, pillFill, pillInk, pillW, x = 90, w = 900, sun, glow, stagger = 0.085 }) {
  return () => {
    const svg = root(bg);
    let sunG = null;
    if (sun) { sunG = rays(540, sun.cy, 1700, 14, sun.fill); svg.append(sunG); }
    const st = stack(lines, { x, w, top, gap, fill: ink });
    svg.append(st.g);
    let em = null, pl = null;
    if (emo) { em = emoji(emo.ch, emo.cx || 540, emo.y, emo.size); svg.append(em); }
    if (pillText) {
      pl = pill(pillText, 540, 0, { fill: pillFill || ink, ink: pillInk || bg, w: pillW || 880 });
      const y = pillY != null ? pillY : st.bottom - gap + 58 + pl.h / 2;
      pl.setAttribute('transform', `translate(0 ${y})`);          // (pop animation re-applies this each frame)
      pl.cy = y; pl.baseY = y;
      svg.append(pl);
    }
    return {
      el: svg, glow: glow || bg, stack: st, emoji: em, pill: pl,
      update(tl, t) {
        st.lines.forEach((ln, i) => setLine(ln, slam(tl, i * stagger)));
        const after = st.lines.length * stagger;
        if (em) {
          const p = pop(tl, emo.delay != null ? emo.delay : after + 0.02);
          const wig = emo.wiggle ? emo.wiggle * Math.sin(t * 7) : 0;
          const flip = emo.look ? (Math.floor(t * 2.5) % 2 ? -1 : 1) : 1;
          setT(em, em.cx, em.cy, { sx: p.sc * flip, sy: p.sc, o: p.o, rot: wig });
        }
        if (pl) { const p = pop(tl, after + 0.1); setT(pl, pl.cx, 0, { sc: p.sc, o: p.o, rot: -2, dy: pl.baseY }); }
        if (sunG) setT(sunG, sunG.cx, sunG.cy, { rot: t * 14 });
      },
    };
  };
}

SLIDES.look = poster({
  bg: C.blue, ink: C.white, lines: ['MADE', 'YOU', 'LOOK.'], top: 500,
  emo: { ch: '👀', y: 400, size: 300, look: true, delay: 0.3 },
});
SLIDES.job = poster({
  bg: C.mint, ink: C.ink, lines: ["IT'S", 'LITERALLY', 'MY JOB.'], top: 470,
});
SLIDES.never = poster({
  bg: C.yellow, ink: C.ink, lines: ['NEVER', 'HEARD', 'OF HER.'], top: 330,
  emo: { ch: '💅', y: 1640, size: 300, wiggle: 5 },
});
SLIDES.roll = poster({
  bg: C.purple, ink: C.white, lines: ['BORN', { text: 'TO', scale: 0.46 }, 'ROLL.'], top: 380,
});
SLIDES.sun = poster({
  bg: C.orange, ink: C.white, lines: ["SUN'S", 'OUT.'], top: 520, sun: { cy: 960, fill: '#FF9426' },
  emo: { ch: '☀️', y: 420, size: 300, delay: 0.1 },
});
SLIDES.soami = poster({
  bg: C.yellow, ink: C.ink, lines: ['SO AM I.'], top: 860, sun: { cy: 600, fill: '#FFF27A' },
  emo: { ch: '😎', y: 720, size: 470, delay: 0.05, wiggle: 4 },
  pillText: 'HIGH-BRIGHTNESS SCREEN',
});

/* time-of-day posters for the "change me in seconds" run */
function daypart({ bg, ink, time, ch, lines, pillInk }) {
  return () => {
    const svg = root(bg);
    const tp = pill(time, 540, 270, { fill: ink, ink: pillInk || bg, w: 520, max: 150 });
    const em = emoji(ch, 540, 820, 440);
    const st = stack(lines, { x: 90, w: 900, top: 980, gap: 40, fill: ink });
    svg.append(tp, em, st.g);
    return {
      el: svg, glow: bg,
      update(tl, t) {
        const q = tl + 0.07;                                   // already mid-pop on its first frame
        const a = pop(q, 0, 0.26); setT(tp, tp.cx, tp.cy, { sc: a.sc, o: a.o });
        const b = pop(q, 0.02, 0.3); setT(em, em.cx, em.cy, { sc: b.sc, o: b.o, rot: 6 * Math.sin(t * 8) });
        st.lines.forEach((ln, i) => setLine(ln, slam(q, 0.01 + i * 0.04, 0.18)));
      },
    };
  };
}
SLIDES.am = daypart({ bg: C.cream, ink: C.brown, time: '8AM', ch: '☕', lines: ['FRESH', 'COFFEE'] });
SLIDES.noon = daypart({ bg: C.mint, ink: C.ink, time: '12PM', ch: '🥪', lines: ['MEAL', 'DEAL'] });
SLIDES.pm = daypart({ bg: C.purple, ink: C.white, time: '5PM', ch: '🍹', lines: ['HAPPY', 'HOUR'], pillInk: C.purple });
SLIDES.change = poster({
  bg: C.ink, ink: C.yellow, lines: ['CHANGE', 'ME IN', 'SECONDS.'], top: 330, gap: 46, stagger: 0.06,
  pillText: 'NO CHALK. NO REPRINTS.', pillFill: C.white, pillInk: C.ink, glow: C.yellow,
});

/* who it is for */
SLIDES.cafe = poster({
  bg: C.cream, ink: C.brown, lines: ['FRESHLY', 'BAKED'], top: 800, gap: 40,
  emo: { ch: '🥐', y: 690, size: 470, delay: 0.02, wiggle: 4 }, pillText: 'COME ON IN →',
});
SLIDES.event = poster({
  bg: C.pink, ink: C.white, lines: ['TICKETS', { text: 'HERE', scale: 0.86 }], top: 780, gap: 40,
  emo: { ch: '🎟️', y: 680, size: 460, delay: 0.02, wiggle: 4 }, pillText: 'DOORS 7PM', pillW: 620, pillFill: C.ink, pillInk: C.white,
});
SLIDES.estate = poster({
  bg: C.navy, ink: C.white, lines: [{ text: 'OPEN', scale: 0.86 }, 'HOUSE'], top: 760, gap: 40,
  emo: { ch: '🏡', y: 660, size: 450, delay: 0.02, wiggle: 3 }, pillText: 'TODAY · 2PM', pillW: 700, pillFill: C.yellow, pillInk: C.ink,
});

/* the ask */
SLIDES.cta = poster({
  bg: C.ink, ink: C.yellow, lines: ['WHAT', 'WOULD', 'YOU PUT', 'ON ME?'], top: 250, gap: 40, stagger: 0.07,
  pillText: '👇 COMMENT IT', pillFill: C.white, pillInk: C.ink, pillW: 760, glow: C.yellow,
});

/* ---------- the display itself ---------- */
class Sign {
  constructor(names) {
    this.root = h('div', { class: 'sign' });
    this.slides = {};
    for (const n of names) {
      const sl = SLIDES[n]();
      sl.el.style.display = 'none';
      this.slides[n] = sl;
      this.root.append(sl.el);
    }
    this.flash = h('div', { class: 'sign-flash' });
    this.fx = h('div', { class: 'sign-fx' });
    this.root.append(this.flash, this.fx);
    this.cues = [];            // [{t, id, opts}]
  }
  current(t) {
    let cur = null;
    for (const c of this.cues) if (t >= c.t - 1e-6) cur = c;
    return cur;
  }
  update(t, { fx = 1 } = {}) {
    const cur = this.current(t);
    for (const n in this.slides) this.slides[n].el.style.display = cur && cur.id === n ? 'block' : 'none';
    let glow = '#000';
    if (cur) {
      const tl = t - cur.t;
      this.slides[cur.id].update(tl, t, cur.opts || {});
      this.flash.style.opacity = cur.noFlash ? 0 : 0.42 * (1 - prog(tl, 0, 0.1));
      glow = this.slides[cur.id].glow;
    }
    this.fx.style.opacity = fx;
    return glow;
  }
}
