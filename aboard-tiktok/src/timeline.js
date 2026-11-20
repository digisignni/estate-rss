'use strict';
/* The edit. 16 s @ 120 BPM (one bar = 2 s, cuts land on beats); the last frame flows straight back into the first.

   0.0  full-frame STOP sign ............ the viewer's phone *is* the sign
   0.85 pull back: it's an A-board on a pavement
   2.0  "MADE YOU LOOK."   3.0 "I'M A SIGN. IT'S LITERALLY MY JOB."
   4.0  PLUG SOCKET? -> "NEVER HEARD OF HER." -> 5.1 spins round: battery inside
   6.0  WHEELS? -> rolls in -> "BORN TO ROLL."
   8.0  "SUN'S OUT."  8.75 "SO AM I." (high-brightness screen)
   10.0 8AM / 12PM / 5PM artwork swaps -> "CHANGE ME IN SECONDS."
   12.5 bakery / event / estate agent
   14.0 "WHAT WOULD YOU PUT ON ME?"   15.4 STOP sign flips in as the camera dives into the screen -> loop */

const DURATION = 16;
const stage = document.getElementById('stage');
const hex2rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const DEG = Math.PI / 180;

/* gentle hand-held drift so stills never feel frozen */
const drift = (t, seed, amt = 1) => ({ ox: 7 * amt * noise(t * 0.9, seed), oy: 9 * amt * noise(t * 0.8, seed + 3), rot: 0.0022 * amt * noise(t * 0.7, seed + 7) });

/* A photo with live artwork pinned onto its screen.
   reveal/dive = [t0, t1] windows where the camera travels between "the screen IS the frame" and the scene. */
class PhotoScene {
  constructor(o) {
    Object.assign(this, o);
    const ph = PHOTOS[o.photo];
    this.root = h('div', { class: 'scene' });
    this.img = h('img', { class: 'photo', src: ph.src, style: { width: ph.w + 'px', height: ph.h + 'px', filter: o.grade || 'contrast(1.05) saturate(1.1)' } });
    this.sign = new Sign([...new Set(o.cues.map(c => c.id))]);
    this.sign.cues = o.cues;
    this.Hq = M.homography(FRAME, grow(ph.quad, 2.5));
    this.HqInv = M.inv(this.Hq);
    this.vig = h('div', { class: 'vignette' });
    this.root.append(this.img, this.sign.root, this.vig);
    (o.overlays || []).forEach(ov => this.root.append(ov.el));
    stage.append(this.root);
  }
  /* 1 = normal scene, 0 = the sign's screen fills the whole frame */
  blend(t) {
    let e = 1;
    if (this.reveal) e = Math.min(e, E.outBack(prog(t, this.reveal[0], this.reveal[1]), 0.9));
    if (this.dive) { const p = prog(t, this.dive[0], this.dive[1]); e = Math.min(e, 1 - E.inOutCubic(Math.pow(p, 1.45))); }
    return e;
  }
  update(t) {
    const c = this.camFn(t);
    if (this.punch) c.vh *= 1 - this.punch * (1 - E.outExpo(prog(t, this.t0, this.t0 + 0.32)));   // snap-zoom on the cut
    for (const cue of this.cues) {                                                                 // tiny jolt when artwork slams in
      const dt = t - cue.t;
      if (!cue.noFlash && !cue.noShake && dt >= 0 && dt < 0.24) {
        const k = Math.pow(1 - dt / 0.24, 2) * 11;
        c.ox = (c.ox || 0) + k * Math.sin(dt * 95); c.oy = (c.oy || 0) + k * Math.cos(dt * 123);
      }
    }
    const Cm = cam(c);
    let Hs = M.mul(Cm, this.Hq), Pm = Cm;
    const e = this.blend(t);
    if (e !== 1) {
      const target = FRAME.map(p => M.apply(Hs, p));
      const P = target.map((p, i) => [lerp(FRAME[i][0], p[0], e), lerp(FRAME[i][1], p[1], e)]);
      Hs = M.homography(FRAME, P);
      Pm = M.mul(Hs, this.HqInv);
    }
    const inScene = clamp(e * 1.4);
    this.img.style.display = e <= 0.0005 ? 'none' : 'block';
    this.img.style.transform = M.css(Pm);
    this.sign.root.style.transform = M.css(Hs);
    const glow = this.sign.update(t, { fx: inScene });
    const [r, g, b] = hex2rgb(glow);
    this.sign.root.style.boxShadow = `0 0 170px 34px rgba(${r},${g},${b},${(0.3 * inScene).toFixed(3)})`;
    this.vig.style.opacity = inScene;
    (this.overlays || []).forEach(ov => ov.update(t, this));
  }
}

/* low sun creeping into frame (screen-blended) */
function sunFlare(t0, t1) {
  const el = h('div', { style: { position: 'absolute', inset: '0', mixBlendMode: 'screen', pointerEvents: 'none' } });
  const glow = h('div', { style: { position: 'absolute', width: '1500px', height: '1500px', left: '0', top: '0', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,250,225,.95) 0%, rgba(255,226,150,.55) 16%, rgba(255,190,90,.2) 40%, rgba(255,170,60,0) 68%)' } });
  const discs = [[0.34, 150, 0.2], [0.55, 70, 0.26], [0.78, 240, 0.12], [1.02, 110, 0.18]].map(([k, d, o]) => {
    const e = h('div', { style: { position: 'absolute', width: d + 'px', height: d + 'px', left: '0', top: '0', borderRadius: '50%',
      background: `radial-gradient(circle, rgba(255,240,200,${o}) 0%, rgba(255,210,140,${o * 0.6}) 60%, rgba(255,200,120,0) 72%)` } });
    e.k = k; e.d = d; return e;
  });
  el.append(glow, ...discs);
  return {
    el,
    update(t) {
      const p = prog(t, t0, t1);
      const sx = lerp(1010, 880, p), sy = lerp(60, 130, p);             // sun position
      const a = 0.62 + 0.38 * E.outCubic(prog(t, t0, t0 + 0.5));
      glow.style.transform = `translate(${sx - 750}px, ${sy - 750}px) scale(${lerp(0.9, 1.08, p)})`;
      glow.style.opacity = a;
      for (const d of discs) {                                           // ghosts along the sun -> centre axis
        const x = lerp(sx, 540, d.k * 1.5), y = lerp(sy, 960, d.k * 1.5);
        d.style.transform = `translate(${x - d.d / 2}px, ${y - d.d / 2}px)`;
        d.style.opacity = a;
      }
    },
  };
}

/* ---------- studio scenes: cut-out product on flat colour, a giant question, the sign answers ---------- */
function studioRoot(c0, c1, c2) {
  return h('div', { class: 'scene', style: { background: `radial-gradient(circle at 50% 44%, ${c0} 0%, ${c1} 58%, ${c2} 100%)` } });
}
function overlaySvg() {
  return s('svg', { viewBox: '0 0 1080 1920', width: 1080, height: 1920, style: 'position:absolute;left:0;top:0;overflow:visible' });
}
function sprite(sp) {
  return h('img', { class: 'sprite', src: sp.src, style: { width: sp.w + 'px', height: sp.h + 'px' } });
}
function ringEl(color) {
  return h('div', { style: { position: 'absolute', left: '0', top: '0', width: '200px', height: '200px', borderRadius: '50%', border: `10px solid ${color}`, boxSizing: 'border-box' } });
}
function setRing(el, x, y, r, o) {
  el.style.transform = `translate(${x - 100}px, ${y - 100}px) scale(${r / 100})`;
  el.style.opacity = o;
}

/* 4.0 - 6.0  PLUG SOCKET? */
function batteryScene(t0, t1) {
  const root = studioRoot('#9466FF', C.purple, '#6427F2');
  const back = overlaySvg(), svg = overlaySvg();
  const ttl = stack(['PLUG SOCKET?'], { x: 100, w: 880, top: 268, fill: C.white });
  back.append(ttl.g);
  const F = SPRITES.front, R = SPRITES.rear;
  const front = sprite(F), rear = sprite(R);
  const sign = new Sign(['never']);
  sign.cues = [{ t: t0 + 0.06, id: 'never' }];
  const Hq = M.homography(FRAME, grow(F.quad, 1.5));
  const led = h('div', { style: { position: 'absolute', left: '0', top: '0', width: '30px', height: '22px', borderRadius: '5px', background: '#4DFF6A', boxShadow: '0 0 34px 14px rgba(70,255,110,.75)' } });
  const rings = [ringEl('#4DFF6A'), ringEl('#4DFF6A')];
  const tag = h('div', { class: 'tag', style: { background: C.mint, color: C.ink } });
  tag.textContent = '🔋 BATTERY INSIDE';
  const arrow = s('path', { fill: 'none', stroke: C.mint, 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1 });
  const head = s('path', { fill: 'none', stroke: C.mint, 'stroke-width': 13, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  svg.append(arrow, head);
  root.append(back, rear, front, sign.root, led, ...rings, svg, tag);
  stage.append(root);
  const SC = 1.16, TOP = 424, FLIP = [1.12, 1.38];
  const place = (sp, sx, y) => [[sx * SC, 0, 540 - sx * SC * sp.cx], [0, SC, y], [0, 0, 1]];
  return {
    t0, t1, root,
    update(t) {
      const tl = t - t0;
      setLine(ttl.lines[0], slam(tl + 0.05, 0));
      const y = TOP + lerp(1750, 0, E.spring(prog(tl, -0.03, 0.5), 6.5, 1.9));          // jumps up into frame
      const fl = prog(tl, FLIP[0], FLIP[1]);
      const sxF = fl < 0.45 ? 1 - E.inQuad(fl / 0.45) : 0;                          // front squeezes shut...
      const sxR = fl >= 0.45 ? E.outBack((fl - 0.45) / 0.55, 1.6) : 0;              // ...and the back opens out
      const hop = -46 * Math.sin(Math.PI * fl);
      const Tf = place(F, Math.max(sxF, 1e-4), y + hop), Tr = place(R, Math.max(sxR, 1e-4), y + hop);
      front.style.transform = M.css(Tf); front.style.opacity = sxF > 0.002 ? 1 : 0;
      rear.style.transform = M.css(Tr); rear.style.opacity = sxR > 0.002 ? 1 : 0;
      sign.root.style.transform = M.css(M.mul(Tf, Hq));
      sign.root.style.opacity = sxF > 0.002 ? 1 : 0;
      const glow = sign.update(t, { fx: 1 });
      const [r, g, b] = hex2rgb(glow);
      sign.root.style.boxShadow = `0 0 150px 30px rgba(${r},${g},${b},.34)`;
      /* battery call-out once the back is showing */
      const k = prog(tl, FLIP[1], FLIP[1] + 0.1);
      const [lx, ly] = M.apply(Tr, R.led);
      led.style.transform = `translate(${lx - 15}px, ${ly - 11}px)`;
      led.style.opacity = k * (0.75 + 0.25 * Math.sin(tl * 14));
      rings.forEach((el, i) => {
        const ph = ((tl - FLIP[1] - i * 0.3) % 0.6 + 0.6) % 0.6 / 0.6;
        setRing(el, lx, ly, lerp(26, 190, E.outCubic(ph)), k * (1 - ph) * 0.95);
      });
      const p = pop(tl, FLIP[1] + 0.08, 0.4);
      tag.style.transform = `translate(-50%, -50%) translate(540px, 1085px) rotate(-4deg) scale(${p.sc})`;
      tag.style.opacity = p.o;
      const d = prog(tl, FLIP[1] + 0.12, FLIP[1] + 0.3);
      arrow.setAttribute('d', `M 660 1000 C 760 900, 740 760, ${lx + 62} ${ly + 30}`);
      arrow.setAttribute('stroke-dashoffset', 1 - E.outCubic(d));
      arrow.setAttribute('opacity', d > 0 ? 1 : 0);
      head.setAttribute('d', `M ${lx + 62 + 52} ${ly + 30 + 8} L ${lx + 62} ${ly + 30} L ${lx + 62 + 22} ${ly + 30 + 50}`);
      head.setAttribute('opacity', d >= 0.98 ? 1 : 0);
    },
  };
}

/* 6.0 - 8.0  WHEELS? */
function wheelsScene(t0, t1) {
  const root = studioRoot('#5CF2D2', C.mint, '#10C9A2');
  const svg = overlaySvg();
  const ttl = stack(['WHEELS?'], { x: 150, w: 780, top: 262, fill: C.ink });
  const lines = [0, 1, 2, 3, 4].map(i => s('rect', { x: 0, y: 760 + i * 150, width: 520, height: 16, rx: 8, fill: C.white }));
  svg.append(...lines, ttl.g);                       // appended first, so the board rolls in front of it
  const Rl = SPRITES.roller;
  const img = sprite(Rl);
  const sign = new Sign(['roll']);
  sign.cues = [{ t: t0 + 0.6, id: 'roll' }];
  const Hq = M.homography(FRAME, grow(Rl.quad, 1.5));
  const rings = [ringEl(C.yellow), ringEl(C.white)];
  root.append(svg, img, sign.root, ...rings);
  stage.append(root);
  const SC = 1.06, LEFT = 540 - Rl.cx * SC - 14, TOP = 452;
  const [px, py] = Rl.contact;
  return {
    t0, t1, root,
    update(t) {
      const tl = t - t0;
      setLine(ttl.lines[0], slam(tl + 0.05, 0));
      const travel = E.outCubic(prog(tl, 0, 0.5));
      const x = lerp(1180, 0, travel);
      const tilt = lerp(14, 0, E.outBack(prog(tl, 0.36, 0.62), 2.4)) * DEG;        // leans back on its wheels, then sets down
      const squash = 1 - 0.035 * bump(tl - 0.5, 0.4, 3);
      const cs = Math.cos(tilt), sn = Math.sin(tilt);
      const Rm = [[cs, -sn, px - cs * px + sn * py], [sn, cs, py - sn * px - cs * py], [0, 0, 1]];   // rotate about wheel contact
      const Sq = [[1, 0, 0], [0, squash, py * (1 - squash)], [0, 0, 1]];
      const T = M.mul(M.sim(SC, LEFT + x, TOP), M.mul(Sq, Rm));
      img.style.transform = M.css(T);
      sign.root.style.transform = M.css(M.mul(T, Hq));
      const glow = sign.update(t, { fx: 1 });
      const [r, g, b] = hex2rgb(glow);
      sign.root.style.boxShadow = `0 0 150px 30px rgba(${r},${g},${b},.34)`;
      lines.forEach((ln, i) => {                                                    // speed streaks trailing behind
        const o = (1 - travel) * prog(tl, 0.02 + i * 0.02, 0.12 + i * 0.02);
        ln.setAttribute('x', LEFT + x + 760 + i * 46 + (1 - travel) * 240);
        ln.setAttribute('width', 200 + (1 - travel) * 520);
        ln.setAttribute('opacity', o * 0.85);
      });
      const [wx, wy] = M.apply(T, Rl.wheel);
      rings.forEach((el, i) => {
        const ph = prog(tl, 0.56 + i * 0.16, 1.1 + i * 0.16);
        setRing(el, wx, wy, lerp(60, 230, E.outCubic(ph)), ph > 0 && ph < 1 ? (1 - ph) : 0);
      });
    },
  };
}

/* ---------- assemble ---------- */
const SCENES = [];
function build() {
  /* 0.0 - 4.0  hook: the frame IS the sign -> pull back -> "made you look" */
  SCENES.push(new PhotoScene({
    photo: 'street', t0: 0, t1: 4,
    cues: [{ t: 0, id: 'stop', opts: { hook: true }, noFlash: true }, { t: 2.0, id: 'look' }, { t: 3.0, id: 'job' }],
    reveal: [0.85, 1.55],
    camFn: t => ({ cx: 1500, cy: 905, vh: lerp(1770, 1690, E.outCubic(prog(t, 0.85, 4))), ...drift(t, 1) }),
  }));
  SCENES.push(batteryScene(4, 6));
  SCENES.push(wheelsScene(6, 8));
  /* 8.0 - 10.0  sunshine */
  SCENES.push(new PhotoScene({
    photo: 'hero', t0: 8, t1: 10, punch: 0.05,
    cues: [{ t: 7.92, id: 'sun', noShake: true }, { t: 8.75, id: 'soami' }],
    grade: 'contrast(1.06) saturate(1.16) brightness(1.03)',
    camFn: t => ({ cx: 1612, cy: 1196, vh: lerp(2340, 2250, prog(t, 8, 10)), ...drift(t, 2, 0.8) }),
    overlays: [sunFlare(8, 10)],
  }));
  /* 10.0 - 12.5  one sign, every hour */
  SCENES.push(new PhotoScene({
    photo: 'kerb', t0: 10, t1: 12.5, punch: 0.04,
    cues: [{ t: 9.9, id: 'am', noShake: true }, { t: 10.5, id: 'noon' }, { t: 11.0, id: 'pm' }, { t: 11.5, id: 'change' }],
    camFn: t => ({ cx: 1548, cy: 902, vh: lerp(1765, 1700, prog(t, 10, 12.5)), ...drift(t, 3) }),
  }));
  /* 12.5 - 14.0  who it's for (artwork already settled when each cut lands) */
  SCENES.push(new PhotoScene({
    photo: 'grassA', t0: 12.5, t1: 13, punch: 0.06,
    cues: [{ t: 12.0, id: 'cafe', noFlash: true }],
    camFn: t => ({ cx: 1640, cy: 1185, vh: 2330, ...drift(t, 4, 0.6) }),
  }));
  SCENES.push(new PhotoScene({
    photo: 'grassB', t0: 13, t1: 13.5, punch: 0.06,
    cues: [{ t: 12.5, id: 'event', noFlash: true }],
    camFn: t => ({ cx: 1640, cy: 902, vh: 1760, ...drift(t, 6, 0.6) }),
  }));
  SCENES.push(new PhotoScene({
    photo: 'city', t0: 13.5, t1: 14, punch: 0.06,
    cues: [{ t: 13.0, id: 'estate', noFlash: true }],
    grade: 'contrast(1.06) saturate(1.12) brightness(1.04)',
    camFn: t => ({ cx: 1258, cy: 1345, vh: 1240, ...drift(t, 8, 0.5) }),
  }));
  /* 14.0 - 16.0  the ask, then dive back into the screen (loops into frame 0) */
  SCENES.push(new PhotoScene({
    photo: 'street', t0: 14, t1: 16, punch: 0.04,
    cues: [{ t: 13.92, id: 'cta' }, { t: 15.42, id: 'stop', noShake: true }],
    dive: [15.44, 16.0],
    camFn: t => ({ cx: 1500, cy: 905, vh: lerp(1700, 1760, prog(t, 14, 16)), ...drift(t, 5) }),
  }));
}

/* frames inside these windows are rendered as several sub-frames and averaged (real motion blur) */
const BLUR = [[0.85, 1.4], [4.0, 4.34], [5.1, 5.42], [6.0, 6.6], [15.44, 16.0]];
window.blurSamples = f => { const t = f / FPS; return BLUR.some(([a, b]) => t >= a - 1e-6 && t < b - 1e-6) ? 8 : 1; };
window.TOTAL_FRAMES = DURATION * FPS;
window.FPS = FPS;

window.renderAt = t => {
  t = ((t % DURATION) + DURATION) % DURATION;
  for (const sc of SCENES) {
    const on = t >= sc.t0 - 1e-6 && t < sc.t1 - 1e-6;
    sc.root.style.display = on ? 'block' : 'none';
    if (on) sc.update(t);
  }
};

window.READY = (async () => {
  const probe = 'A👀💅☕🥪🍹🥐🎟️🏡👇😎☀️🔋';
  await Promise.all(['400 100px Anton', "100px 'Noto Color Emoji'"].map(f => document.fonts.load(f, probe)));
  await document.fonts.ready;
  build();                                   // text is measured here, so fonts must be in first
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  window.renderAt(0);
  return true;
})();
