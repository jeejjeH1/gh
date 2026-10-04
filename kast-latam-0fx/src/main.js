/* KAST — 0% FX fees across LATAM. Deterministic motion timeline: every frame is a pure function of t. */
(() => {
  const W = 1080, H = 1080, FPS = 60, DURATION = 22;
  const MINT = [163, 247, 207];
  const css = getComputedStyle(document.documentElement);
  const mintHex = css.getPropertyValue('--mint').trim();
  if (/^#[0-9a-f]{6}$/i.test(mintHex)) {
    MINT[0] = parseInt(mintHex.slice(1, 3), 16); MINT[1] = parseInt(mintHex.slice(3, 5), 16); MINT[2] = parseInt(mintHex.slice(5, 7), 16);
  }
  const mint = (a) => `rgba(${MINT[0]},${MINT[1]},${MINT[2]},${a})`;

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));
  const E = {
    outCubic: (x) => 1 - (1 - x) ** 3,
    inCubic: (x) => x ** 3,
    inOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
    outQuart: (x) => 1 - (1 - x) ** 4,
    outQuint: (x) => 1 - (1 - x) ** 5,
    inQuart: (x) => x ** 4,
    outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
    inExpo: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
    inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
    outBack: (x, c = 1.70158) => 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2,
  };
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const vel = (f, t) => (f(t + 1 / 120) - f(t - 1 / 120)); // displacement per 60fps frame

  // ---------- dom ----------
  const $ = (id) => document.getElementById(id);
  const tf = (el, o) => {
    const p = [];
    if (o.x || o.y || o.z) p.push(`translate3d(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px,${(o.z || 0).toFixed(2)}px)`);
    if (o.rx) p.push(`rotateX(${o.rx.toFixed(3)}deg)`);
    if (o.ry) p.push(`rotateY(${o.ry.toFixed(3)}deg)`);
    if (o.rz) p.push(`rotateZ(${o.rz.toFixed(3)}deg)`);
    if (o.s !== undefined && o.s !== 1) p.push(`scale(${o.s.toFixed(4)})`);
    if (o.sx !== undefined) p.push(`scaleX(${o.sx.toFixed(4)})`);
    if (o.sy !== undefined) p.push(`scaleY(${o.sy.toFixed(4)})`);
    el.style.transform = p.join(' ') || 'none';
    if (o.o !== undefined) el.style.opacity = clamp(o.o).toFixed(3);
  };
  const show = (el, on) => { el.style.display = on ? '' : 'none'; };

  // Directional motion blur through per-element SVG filters.
  const defs = $('filters');
  const filters = {};
  const blur = (el, name, sx, sy) => {
    sx = Math.min(70, Math.abs(sx)); sy = Math.min(70, Math.abs(sy));
    if (sx < 0.35 && sy < 0.35) { el.style.filter = 'none'; return; }
    let g = filters[name];
    if (!g) {
      const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      f.setAttribute('id', name);
      f.setAttribute('x', '-60%'); f.setAttribute('y', '-60%'); f.setAttribute('width', '220%'); f.setAttribute('height', '220%');
      f.setAttribute('color-interpolation-filters', 'sRGB');
      g = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
      f.appendChild(g); defs.appendChild(f); filters[name] = g;
    }
    g.setAttribute('stdDeviation', `${sx.toFixed(2)} ${sy.toFixed(2)}`);
    el.style.filter = `url(#${name})`;
  };

  // Slot-machine reels.
  const reels = [];
  const makeReel = (strip, final, n, seed) => {
    const r = rng(seed);
    const seq = [];
    for (let i = 0; i < n - 1; i++) seq.push(String(1 + Math.floor(r() * 9)));
    seq.push(final);
    seq.push(String(1 + Math.floor(r() * 9))); // overshoot padding
    strip.innerHTML = seq.map((d) => `<span>${d}</span>`).join('');
    return n - 1; // landing index
  };
  const reelPos = (t, t0, t1, last) => last * E.outBack(prog(t, t0, t1), 0.9);
  const setReel = (strip, t, t0, t1, last, fontPx, name) => {
    const f = (tt) => reelPos(tt, t0, t1, last);
    const p = f(t);
    strip.style.transform = `translateY(${(-p).toFixed(4)}em)`;
    blur(strip, name, 0, vel(f, t) * fontPx * 0.32);
  };

  // Typewriter for segmented text.
  const typed = (segs, n, cursorOn) => {
    let out = '', left = n;
    for (const s of segs) {
      if (left <= 0) break;
      const part = s.t.slice(0, left); left -= part.length;
      const txt = part.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      out += s.c ? `<${s.c}>${txt}</${s.c}>` : txt;
    }
    return out + (cursorOn ? '<span class="cursor"></span>' : '');
  };
  const segLen = (segs) => segs.reduce((a, s) => a + s.t.length, 0);

  // ---------- canvases ----------
  const bg = $('bg').getContext('2d');
  const fx = $('fx').getContext('2d');
  const mapC = $('mapCanvas').getContext('2d');
  const s3c = $('s3canvas').getContext('2d');
  const grainC = $('grain').getContext('2d');

  // Static grain: dithers the mint glows against banding without costing bitrate on every frame.
  {
    const r = rng(77);
    const img = grainC.createImageData(W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (r() ** 2.4) * 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    grainC.putImageData(img, 0, 0);
  }

  // ---------- map ----------
  const MAP = window.LATAM;
  const MS = 1.24, MAP_X = 404, MAP_Y = 132;
  const dots = (() => {
    const r = rng(2027);
    return MAP.dots.map(([x, y]) => {
      const nx = x / MAP.w, ny = y / MAP.h;
      return {
        x: MAP_X + x * MS, y: MAP_Y + y * MS, ny,
        t0: 2.2 + ny * 0.62 + r() * 0.16 + nx * 0.08,
        tw: 2.95 + ny * 0.78 + r() * 0.05,
        b: 0.55 + r() * 0.45, ph: r() * Math.PI * 2,
      };
    });
  })();
  const ripples = (() => {
    const r = rng(9);
    return Array.from({ length: 16 }, (_, i) => ({ t: 3.55 + i * 0.09 + r() * 0.05, d: dots[Math.floor(r() * dots.length)] }));
  })();
  const arcs = (() => {
    const r = rng(31);
    const out = [];
    while (out.length < 7) {
      const a = dots[Math.floor(r() * dots.length)], b = dots[Math.floor(r() * dots.length)];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 260 || dist > 620) continue;
      out.push({ a, b, t: 3.45 + out.length * 0.17, dur: 0.75 + r() * 0.25 });
    }
    return out;
  })();
  const quad = (a, c, b, u) => ({
    x: (1 - u) ** 2 * a.x + 2 * (1 - u) * u * c.x + u * u * b.x,
    y: (1 - u) ** 2 * a.y + 2 * (1 - u) * u * c.y + u * u * b.y,
  });

  const drawMap = (t) => {
    mapC.clearRect(0, 0, W, H);
    if (t < 2.1 || t > 5.2) return;
    const R = 3.1;
    for (const d of dots) {
      const ap = prog(t, d.t0, d.t0 + 0.4);
      if (ap <= 0) continue;
      const sc = E.outBack(ap, 2.2);
      const w = t - d.tw;
      const act = E.outCubic(clamp(w / 0.4));
      const fl = w > -0.2 && w < 0.4 ? bump(w, 0.02, 0.07) : 0;
      const tw = 0.82 + 0.18 * Math.sin(t * 3.1 + d.ph);
      const k = act * d.b * tw;
      const cr = lerp(62, MINT[0], k) + fl * 120, cg = lerp(62, MINT[1], k) + fl * 120, cb = lerp(62, MINT[2], k) + fl * 120;
      let a = (0.9 * ap + 0.1) * lerp(0.75, 1, act);
      // keep the headline area calm
      if (d.x < 770 && d.y > 520 && d.y < 870) a *= 0.32;
      mapC.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${a.toFixed(3)})`;
      mapC.beginPath(); mapC.arc(d.x, d.y, R * sc * (1 + fl * 0.9), 0, Math.PI * 2); mapC.fill();
      if (fl > 0.05) {
        mapC.fillStyle = mint(0.22 * fl);
        mapC.beginPath(); mapC.arc(d.x, d.y, 12 * fl, 0, Math.PI * 2); mapC.fill();
      }
    }
    mapC.lineWidth = 2;
    for (const rp of ripples) {
      const p = prog(t, rp.t, rp.t + 0.9);
      if (p <= 0 || p >= 1) continue;
      const e = E.outCubic(p);
      mapC.strokeStyle = mint(0.85 * (1 - p));
      mapC.beginPath(); mapC.arc(rp.d.x, rp.d.y, 4 + e * 46, 0, Math.PI * 2); mapC.stroke();
      mapC.fillStyle = `rgba(255,255,255,${(1 - p).toFixed(3)})`;
      mapC.beginPath(); mapC.arc(rp.d.x, rp.d.y, 4.2, 0, Math.PI * 2); mapC.fill();
    }
    for (const arc of arcs) {
      const p = prog(t, arc.t, arc.t + arc.dur);
      if (p <= 0) continue;
      const head = E.inOutCubic(p);
      const tailP = prog(t, arc.t + arc.dur * 0.55, arc.t + arc.dur * 1.4);
      const tail = E.inOutCubic(tailP);
      if (tail >= 1) continue;
      const { a, b } = arc;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const c = { x: mx + ((a.y - b.y) / len) * len * 0.32, y: my - ((b.x - a.x) / len) * len * 0.32 };
      const N = 36;
      for (let i = 0; i < N; i++) {
        const u0 = lerp(tail, head, i / N), u1 = lerp(tail, head, (i + 1) / N);
        const p0 = quad(a, c, b, u0), p1 = quad(a, c, b, u1);
        mapC.strokeStyle = `rgba(255,255,255,${(0.9 * (i / N) ** 1.6).toFixed(3)})`;
        mapC.lineWidth = 2.2;
        mapC.beginPath(); mapC.moveTo(p0.x, p0.y); mapC.lineTo(p1.x, p1.y); mapC.stroke();
      }
      if (p < 1) {
        const hp = quad(a, c, b, head);
        mapC.fillStyle = mint(0.35); mapC.beginPath(); mapC.arc(hp.x, hp.y, 11, 0, Math.PI * 2); mapC.fill();
        mapC.fillStyle = '#fff'; mapC.beginPath(); mapC.arc(hp.x, hp.y, 4.5, 0, Math.PI * 2); mapC.fill();
      }
      const land = prog(t, arc.t + arc.dur, arc.t + arc.dur + 0.6);
      if (land > 0 && land < 1) {
        mapC.strokeStyle = mint(0.9 * (1 - land)); mapC.lineWidth = 2;
        mapC.beginPath(); mapC.arc(b.x, b.y, 5 + E.outCubic(land) * 30, 0, Math.PI * 2); mapC.stroke();
      }
    }
  };

  // ---------- impacts (shake, zoom punch, particles, rings) ----------
  const HITS = [
    { t: 1.0, a: 18, z: 0.05 }, { t: 2.55, a: 4, z: 0.012 }, { t: 3.0, a: 5, z: 0.015 },
    { t: 5.42, a: 12, z: 0.03 }, { t: 7.02, a: 10, z: 0.025 },
    { t: 9.0, a: 7, z: 0.018 }, { t: 9.5, a: 7, z: 0.018 }, { t: 10.0, a: 9, z: 0.022 },
    { t: 15.55, a: 14, z: 0.035 }, { t: 17.0, a: 8, z: 0.02 },
  ];
  const camShake = (t) => {
    let x = 0, y = 0, r = 0, z = 0;
    for (const h of HITS) {
      const d = t - h.t;
      if (d < 0 || d > 1.2) continue;
      const env = Math.exp(-d * 9);
      x += h.a * env * Math.sin(d * 71 + h.t * 3);
      y += h.a * env * Math.cos(d * 59 + h.t * 7);
      r += h.a * 0.035 * env * Math.sin(d * 43 + h.t);
      z += h.z * Math.exp(-d * 11);
    }
    return { x, y, r, z };
  };
  const BURSTS = [
    { t: 1.0, x: 540, y: 540, n: 56, sp: 1100, seed: 1, size: 7 },
    { t: 7.02, x: 630, y: 690, n: 34, sp: 700, seed: 2, size: 6 },
    { t: 15.55, x: 540, y: 570, n: 50, sp: 1000, seed: 3, size: 7 },
  ].map((b) => {
    const r = rng(b.seed);
    b.parts = Array.from({ length: b.n }, () => ({
      a: r() * Math.PI * 2, v: b.sp * (0.35 + r() * 0.65), s: b.size * (0.4 + r() * 0.8), rot: r() * 6, white: r() < 0.3, life: 0.6 + r() * 0.6,
    }));
    return b;
  });
  const RINGS = [
    { t: 1.0, x: 540, y: 540, r: 700, w: 3 }, { t: 1.06, x: 540, y: 540, r: 480, w: 1.5 },
    { t: 7.02, x: 630, y: 690, r: 260, w: 2 },
    { t: 15.55, x: 540, y: 570, r: 640, w: 3 }, { t: 15.6, x: 540, y: 570, r: 420, w: 1.5 },
  ];
  const drawFx = (t) => {
    fx.clearRect(0, 0, W, H);
    for (const rg of RINGS) {
      const p = prog(t, rg.t, rg.t + 0.9);
      if (p <= 0 || p >= 1) continue;
      fx.strokeStyle = mint(0.9 * (1 - p) ** 1.5); fx.lineWidth = rg.w * (1 + (1 - p) * 2);
      fx.beginPath(); fx.arc(rg.x, rg.y, rg.r * E.outExpo(p), 0, Math.PI * 2); fx.stroke();
    }
    for (const b of BURSTS) {
      const d = t - b.t;
      if (d < 0 || d > 1.3) continue;
      for (const pt of b.parts) {
        if (d > pt.life) continue;
        const k = 5.5;
        const dist = (pt.v / k) * (1 - Math.exp(-k * d));
        const x = b.x + Math.cos(pt.a) * dist, y = b.y + Math.sin(pt.a) * dist + 60 * d * d;
        const life = 1 - d / pt.life;
        fx.save(); fx.translate(x, y); fx.rotate(pt.rot + d * 6);
        fx.fillStyle = pt.white ? `rgba(255,255,255,${life.toFixed(3)})` : mint(life);
        fx.fillRect(-pt.s / 2, -pt.s / 2, pt.s, pt.s);
        fx.restore();
      }
    }
  };

  // ---------- background ----------
  const sceneMix = (t, keys) => { // keys: [[time, value], ...] linear between keys
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], E.inOutCubic(prog(t, keys[i - 1][0], keys[i][0])));
    }
    return keys[keys.length - 1][1];
  };
  const drawBg = (t) => {
    bg.globalCompositeOperation = 'source-over';
    bg.fillStyle = '#000'; bg.fillRect(0, 0, W, H);
    const ga = sceneMix(t, [[0, 0], [0.4, 0.07], [2.0, 0.05], [5.0, 0.04], [8.5, 0.055], [16.6, 0.055], [17.0, 0]]);
    if (ga > 0.002) {
      const G = 60, off = (t * 14) % G;
      bg.strokeStyle = `rgba(255,255,255,${ga.toFixed(3)})`; bg.lineWidth = 1;
      bg.beginPath();
      for (let x = -G + off; x < W + G; x += G) { bg.moveTo(x + 0.5, 0); bg.lineTo(x + 0.5, H); }
      for (let y = -G + off * 0.5; y < H + G; y += G) { bg.moveTo(0, y + 0.5); bg.lineTo(W, y + 0.5); }
      bg.stroke();
      bg.fillStyle = `rgba(255,255,255,${(ga * 3.2).toFixed(3)})`;
      for (let x = -G + off; x < W + G; x += G * 3) for (let y = -G + off * 0.5; y < H + G; y += G * 3) {
        bg.fillRect(x - 5, y, 11, 1); bg.fillRect(x, y - 5, 1, 11);
      }
    }
    const glows = [
      { x: 540, y: 540, a: 0.16 * prog(t, 0.2, 1.0) * (1 - prog(t, 1.8, 2.4)) + 0.35 * bump(t, 1.03, 0.12), r: 620 },
      { x: 790, y: 520, a: 0.13 * prog(t, 2.9, 3.8) * (1 - prog(t, 4.7, 5.0)), r: 640 },
      { x: 540, y: 330, a: 0.12 * prog(t, 5.2, 6.0) * (1 - prog(t, 8.2, 8.5)) + 0.18 * bump(t, 6.1, 0.2), r: 560 },
      { x: 300, y: 520, a: 0.07 * prog(t, 8.6, 9.2) * (1 - prog(t, 11.2, 11.5)), r: 700 },
      { x: 540, y: 600, a: 0.16 * prog(t, 15.2, 15.6) * (1 - prog(t, 16.8, 17.0)) + 0.25 * bump(t, 15.57, 0.14), r: 620 },
      { x: 930, y: 830, a: 0.09 * prog(t, 17.4, 18.2), r: 560 },
    ];
    bg.globalCompositeOperation = 'lighter';
    for (const g of glows) {
      if (g.a < 0.002) continue;
      const gr = bg.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      gr.addColorStop(0, mint(g.a)); gr.addColorStop(0.45, mint(g.a * 0.35)); gr.addColorStop(1, mint(0));
      bg.fillStyle = gr; bg.fillRect(0, 0, W, H);
    }
    bg.globalCompositeOperation = 'source-over';
    const v = bg.createRadialGradient(540, 540, 360, 540, 540, 820);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
    bg.fillStyle = v; bg.fillRect(0, 0, W, H);
  };

  // ---------- element refs & layout measurement ----------
  const el = {};
  ['cam', 'grpA', 's1', 'scanA', 'scanB', 's1chip', 's1dot', 's1label', 'zeroWrap', 'zeroBase', 'zeroSheen', 'zeroPh', 's2hud', 's2head', 'h1', 'h2', 'h3',
    's3', 'cardPos', 'cardShadow', 'panel', 'pRow1', 'pHair1', 'pRow2', 'pHair2', 'pRow3', 'feeVal', 'stamp', 'p3circ', 'p3tick', 'p3txt',
    's4', 's4count', 's4aIn', 's4slot', 'w0', 'w1', 'w2', 'k0', 'k1', 'k2', 's4fin', 'f1', 'f2', 'f3', 's4check', 's4circ', 's4tick', 's4finTag',
    's5', 's5head', 's5headTxt', 'r0', 'r1', 'r2', 's5bottom',
    's6', 's6lbl', 's6dayIn', 's6year', 's6fill', 's6head', 's7', 's7card', 's7logo', 'e1', 'e2', 'e3', 's7cta', 's7date', 's7legal', 'wipe', 'flash', 'grain']
    .forEach((id) => { el[id] = $(id); });

  const ZERO_PX = 520, FEE_PX = 96, YEAR_PX = 340;
  const zeroLast = makeReel(el.zeroBase.querySelector('.strip'), '0', 26, 11);
  makeReel(el.zeroSheen.querySelector('.strip'), '0', 26, 11);
  const feeLast = makeReel(el.feeVal.querySelector('.strip'), '0', 18, 12);
  const yearReels = '2027'.split('').map((d, i) => {
    const reel = document.createElement('span'); reel.className = 'reel';
    const strip = document.createElement('span'); strip.className = 'strip';
    reel.appendChild(strip); el.s6year.appendChild(reel);
    return { strip, last: makeReel(strip, d, 16 + i * 4, 40 + i), land: [15.3, 15.38, 15.46, 15.55][i] };
  });

  // Logo override (official SVG) via ?logo=path
  const params = new URLSearchParams(location.search);
  if (params.get('logo')) {
    document.querySelectorAll('.logo').forEach((n) => { n.innerHTML = `<img src="${params.get('logo')}" alt="KAST" style="height:.74em">`; });
  }

  const L = {};
  const measure = () => {
    const zb = el.zeroBase.getBoundingClientRect();
    L.zw = zb.width; L.zh = zb.height;
    L.zx0 = (W - zb.width) / 2; L.zy0 = (H - zb.height) / 2;
    el.zeroPh.style.display = 'inline-block'; el.zeroPh.style.lineHeight = '1'; el.zeroPh.style.letterSpacing = '-.055em';
    const ph = el.zeroPh.getBoundingClientRect();
    L.zs1 = ph.height / zb.height; L.zx1 = ph.left; L.zy1 = ph.top;
  };

  const p3len = { c: 2 * Math.PI * 21, k: 36 };
  const s4len = { c: 2 * Math.PI * 54, k: 80 };
  el.p3circ.style.strokeDasharray = p3len.c; el.p3tick.style.strokeDasharray = p3len.k;
  el.s4circ.style.strokeDasharray = s4len.c; el.s4tick.style.strokeDasharray = s4len.k;
  const rowParts = ['r0', 'r1', 'r2'].map((id) => {
    const r = el[id];
    const svg = r.querySelector('svg');
    const [c, k] = svg.children;
    c.style.strokeDasharray = 2 * Math.PI * 29; k.style.strokeDasharray = 44;
    return { r, hair: r.querySelector('.hair'), num: r.querySelector('.num'), lines: [...r.querySelectorAll('.txt .mask > span')], svg, c, k };
  });
  const cards = [
    { pos: el.cardPos, spec: el.cardPos.querySelector('.spec') },
    { pos: el.s7card, spec: el.s7card.querySelector('.spec') },
  ];

  const hudSegs = [
    [{ t: 'STATUS     ' }, { t: 'LIVE', c: 'i' }],
    [{ t: 'REGION     ' }, { t: 'LATAM', c: 'b' }],
    [{ t: 'KAST FX FEE ' }, { t: '0%', c: 'i' }],
  ];
  const s1Segs = [{ t: 'KAST FX FEE' }, { t: '  ·  ', c: 'span class="mint"' }, { t: 'LATAM' }];
  // closing tag for the attribute-bearing segment
  const typedS1 = (n, cur) => typed(s1Segs, n, cur).replace(/<\/span class="mint">/g, '</span>');

  // ---------- scenes ----------
  const reveal = (node, t, t0, dur = 0.55, from = 108) => {
    const p = E.outExpo(prog(t, t0, t0 + dur));
    node.style.transform = `translateY(${lerp(from, 0, p).toFixed(2)}%)`;
  };
  const hide = (node, t, t0, dur = 0.4, to = -108) => {
    const p = E.inOutExpo(prog(t, t0, t0 + dur));
    return lerp(0, to, p);
  };

  const sceneA = (t) => {
    const on = t < 5.05;
    show(el.grpA, on);
    if (!on) return;
    // S1 scan lines
    const open = E.inOutExpo(prog(t, 0.36, 0.72));
    const sa = E.outExpo(prog(t, 0.04, 0.42));
    const gone = E.inExpo(prog(t, 0.98, 1.22));
    const topY = lerp(539, 318, open) - gone * 400, botY = lerp(539, 762, open) + gone * 400;
    tf(el.scanA, { y: topY, sx: sa, o: 1 - prog(t, 1.12, 1.22) });
    tf(el.scanB, { y: botY, sx: sa, o: (open > 0.01 ? 1 : 0) * (1 - prog(t, 1.12, 1.22)) });
    show(el.scanA, t < 1.25); show(el.scanB, t < 1.25 && t > 0.36);

    // zero: centered in S1, flies into the headline in S2
    const mv = E.inOutExpo(prog(t, 2.0, 2.62));
    const punch = t >= 1.0 ? 1 + 0.07 * Math.exp(-(t - 1.0) * 9) : lerp(0.9, 0.97, prog(t, 0.36, 1.0));
    const s = lerp(punch, L.zs1, mv);
    const cx = L.zx0 + (L.zw * (1 - s)) / 2, cy = L.zy0 + (L.zh * (1 - s)) / 2;
    const x = lerp(cx, L.zx1, mv), y = lerp(cy, L.zy1, mv);
    el.zeroWrap.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
    // clip to the scan window while spinning
    if (t < 1.0) {
      const top = (topY - y) / s, bot = (botY - y) / s;
      const l = -300, r = L.zw + 300;
      el.zeroWrap.style.clipPath = `polygon(${l}px ${top.toFixed(1)}px, ${r}px ${top.toFixed(1)}px, ${r}px ${bot.toFixed(1)}px, ${l}px ${bot.toFixed(1)}px)`;
    } else el.zeroWrap.style.clipPath = 'none';
    show(el.zeroWrap, t > 0.36);
    setReel(el.zeroBase.querySelector('.strip'), t, 0.36, 1.0, zeroLast, ZERO_PX, 'bz');
    const pctIn = E.outExpo(prog(t, 0.92, 1.25));
    const pct = el.zeroBase.querySelector('.pct');
    pct.style.transform = `translateX(${lerp(-120, 0, pctIn).toFixed(1)}px)`;
    pct.style.opacity = pctIn.toFixed(3);
    const toMint = prog(t, 2.2, 2.6);
    el.zeroBase.style.color = `rgb(${lerp(255, MINT[0], toMint) | 0},${lerp(255, MINT[1], toMint) | 0},${lerp(255, MINT[2], toMint) | 0})`;
    // mint sheen sweep after the landing
    const sh = prog(t, 1.08, 1.62);
    if (sh > 0 && sh < 1) {
      el.zeroSheen.style.display = 'flex';
      el.zeroSheen.querySelector('.strip').style.transform = `translateY(${-zeroLast}em)`;
      const c = lerp(-260, L.zw + 260, E.inOutCubic(sh)), hw = 120, sk = 90;
      el.zeroSheen.style.clipPath = `polygon(${c - hw + sk}px 0, ${c + hw + sk}px 0, ${c + hw - sk}px 100%, ${c - hw - sk}px 100%)`;
    } else el.zeroSheen.style.display = 'none';

    // chip + label
    const chipIn = E.outBack(prog(t, 1.12, 1.45));
    const s1out = E.inExpo(prog(t, 1.86, 2.12));
    el.s1chip.style.transform = `translateX(-50%) translateY(${lerp(30, 0, chipIn) - s1out * 40}px) scale(${lerp(0.7, 1, chipIn)})`;
    el.s1chip.style.opacity = (prog(t, 1.12, 1.25) * (1 - s1out)).toFixed(3);
    el.s1dot.style.opacity = (0.55 + 0.45 * Math.cos(t * 9)).toFixed(3);
    const n1 = Math.floor(lerp(0, segLen(s1Segs), prog(t, 1.22, 1.62)));
    const cur = t > 1.2 && t < 1.9 && (n1 < segLen(s1Segs) || Math.floor(t * 4) % 2 === 0);
    el.s1label.innerHTML = typedS1(n1, cur);
    el.s1label.style.opacity = (1 - s1out).toFixed(3);
    el.s1label.style.transform = `translateY(${s1out * 40}px)`;

    // S2 headline + hud
    show(el.s2head, t > 2.0);
    el.h1.style.transform = `translateY(${lerp(108, 0, E.outExpo(prog(t, 2.3, 2.9))).toFixed(2)}%)`;
    reveal(el.h2, t, 2.62);
    reveal(el.h3, t, 2.86);
    const hudN = Math.floor(lerp(0, 46, prog(t, 2.7, 3.5)));
    let left = hudN, html = '';
    hudSegs.forEach((segs, i) => {
      const len = segLen(segs);
      const n = clamp(left, 0, len); left -= len;
      const typing = n > 0 && n < len;
      html += typed(segs, n, typing || (i === 2 && n === len && Math.floor(t * 4) % 2 === 0)) + (i < 2 ? '\n' : '');
    });
    el.s2hud.innerHTML = html;
    drawMap(t);

    // S2 exit: punch through the map
    const ex = E.inExpo(prog(t, 4.6, 5.02));
    el.grpA.style.transformOrigin = '760px 560px';
    el.grpA.style.transform = ex > 0 ? `scale(${(1 + ex * 2.4).toFixed(4)})` : 'none';
    el.grpA.style.opacity = (1 - prog(t, 4.84, 5.02)).toFixed(3);
    el.grpA.style.filter = ex > 0.02 ? `blur(${(ex * 14).toFixed(2)}px)` : 'none';
  };

  const cardTransform = (t) => {
    const e = E.outExpo(prog(t, 4.96, 5.62));
    const lt = t - 5.0;
    let x = 0, y = lerp(300, 0, e), z = lerp(-2800, 0, e);
    let ry = lerp(-215, -16, e), rx = lerp(55, 10, e), rz = lerp(-42, -5, e), s = 1;
    ry += 5 * Math.sin(lt * 2.0); rx += 2.5 * Math.sin(lt * 1.6 + 1); y += 7 * Math.sin(lt * 1.8);
    const tap = E.outCubic(prog(t, 5.92, 6.1)) - E.outCubic(prog(t, 6.1, 6.55));
    rx += 24 * tap; z += 90 * tap; y += 26 * tap;
    const up = E.outExpo(prog(t, 6.15, 6.9));
    y += lerp(0, -134, up); s = lerp(1, 0.74, up);
    return { x, y, z, rx, ry, rz, s };
  };
  const applyCard = (c, o, t, sweepT) => {
    tf(c.pos, o);
    const sw = prog(t, sweepT, sweepT + 0.75);
    const base = (-o.ry - 16) * 9;
    c.spec.style.transform = `translateX(${(base + lerp(-700, 700, E.inOutCubic(sw))).toFixed(1)}px)`;
  };

  const sceneS3 = (t) => {
    const on = t > 4.94 && t < 8.55;
    show(el.s3, on);
    if (!on) return;
    const ex = (tt) => -1350 * E.inExpo(prog(tt, 8.2, 8.52));
    const exX = ex(t);
    el.s3.style.transform = exX ? `translateX(${exX.toFixed(1)}px)` : 'none';
    blur(el.s3, 'b3', vel(ex, t) * 0.32, 0);

    const c = cardTransform(t);
    applyCard(cards[0], c, t, 5.25);
    el.cardShadow.style.opacity = (0.9 * prog(t, 5.15, 5.6) * (1 - prog(t, 6.15, 6.6))).toFixed(3);

    // contactless pulses behind the card
    s3c.clearRect(0, 0, W, H);
    for (const k of [6.0, 6.12, 6.24]) {
      const p = prog(t, k, k + 0.85);
      if (p <= 0 || p >= 1) continue;
      s3c.strokeStyle = mint(0.8 * (1 - p) ** 2); s3c.lineWidth = 3;
      s3c.beginPath(); s3c.arc(540, 451 + 26, 200 + E.outCubic(p) * 420, 0, Math.PI * 2); s3c.stroke();
    }

    const pin = E.outExpo(prog(t, 6.25, 6.95));
    el.panel.style.transform = `translateY(${lerp(160, 0, pin).toFixed(1)}px)`;
    el.panel.style.opacity = prog(t, 6.25, 6.5).toFixed(3);
    tf(el.pRow1, { y: lerp(24, 0, E.outExpo(prog(t, 6.35, 6.9))), o: prog(t, 6.35, 6.55) });
    tf(el.pHair1, { sx: E.outExpo(prog(t, 6.4, 7.0)) });
    tf(el.pRow2, { y: lerp(24, 0, E.outExpo(prog(t, 6.45, 7.0))), o: prog(t, 6.45, 6.65) });
    tf(el.pHair2, { sx: E.outExpo(prog(t, 6.55, 7.1)) });
    setReel(el.feeVal.querySelector('.strip'), t, 6.45, 7.0, feeLast, FEE_PX, 'bf');
    const st = prog(t, 7.0, 7.24);
    el.stamp.style.opacity = prog(t, 7.0, 7.05).toFixed(3);
    el.stamp.style.transform = `rotate(${lerp(-20, -7, E.outBack(st)).toFixed(2)}deg) scale(${lerp(2.6, 1, E.outBack(st, 1.4)).toFixed(4)})`;
    el.pRow3.style.opacity = prog(t, 7.2, 7.3).toFixed(3);
    el.p3circ.style.strokeDashoffset = (p3len.c * (1 - E.outCubic(prog(t, 7.22, 7.6)))).toFixed(2);
    el.p3tick.style.strokeDashoffset = (p3len.k * (1 - E.outCubic(prog(t, 7.4, 7.65)))).toFixed(2);
    reveal(el.p3txt, t, 7.3);
  };

  const sceneS4 = (t) => {
    const on = t > 8.25 && t < 11.62;
    show(el.s4, on);
    if (!on) return;
    const ent = (tt) => 1350 * (1 - E.outExpo(prog(tt, 8.28, 8.78)));
    el.s4.style.transform = `translateX(${ent(t).toFixed(1)}px)`;
    blur(el.s4, 'b4', vel(ent, t) * 0.32, 0);

    const enters = [8.5, 9.06, 9.56], strikes = [9.0, 9.5, 10.0], exits = [9.06, 9.56, 10.3];
    let idx = 0;
    ['w0', 'w1', 'w2'].forEach((id, i) => {
      const w = el[id];
      const inP = E.outExpo(prog(t, enters[i], enters[i] + 0.34));
      const outP = E.outExpo(prog(t, exits[i], exits[i] + 0.34));
      const y = lerp(205, 0, inP) - 205 * outP;
      w.style.transform = `translateY(${y.toFixed(1)}px)`;
      show(w, inP > 0 && outP < 1);
      const k = el['k' + i];
      k.style.transform = `scaleX(${E.outExpo(prog(t, strikes[i] - 0.04, strikes[i] + 0.16)).toFixed(4)})`;
      const dim = prog(t, strikes[i] + 0.02, strikes[i] + 0.2);
      const g = lerp(255, 92, dim) | 0;
      w.style.color = `rgb(${g},${g},${g})`;
      if (t >= enters[i]) idx = i;
    });
    el.s4count.innerHTML = `<i>0${idx + 1}</i> / 03   ·   Nothing to do`;
    const fin = prog(t, 10.3, 10.6);
    el.s4aIn.style.transform = `translateY(${lerp(0, -110, E.inOutExpo(fin)).toFixed(1)}%)`;
    el.s4count.style.opacity = (prog(t, 8.6, 8.9) * (1 - prog(t, 10.22, 10.36))).toFixed(3);
    show(el.s4slot, t < 10.7);

    const finOut = (i) => hide(null, t, 11.2 + i * 0.05, 0.36);
    [el.f1, el.f2, el.f3].forEach((f, i) => {
      const p = E.outExpo(prog(t, 10.42 + i * 0.09, 10.98 + i * 0.09));
      f.style.transform = `translateY(${(lerp(108, 0, p) + finOut(i)).toFixed(2)}%)`;
    });
    show(el.s4fin, t > 10.35);
    el.s4circ.style.strokeDashoffset = (s4len.c * (1 - E.outCubic(prog(t, 10.62, 11.0)))).toFixed(2);
    el.s4tick.style.strokeDashoffset = (s4len.k * (1 - E.outCubic(prog(t, 10.82, 11.05)))).toFixed(2);
    const chkOut = E.inExpo(prog(t, 11.2, 11.5));
    el.s4check.style.opacity = (prog(t, 10.6, 10.65) * (1 - chkOut)).toFixed(3);
    el.s4check.style.transform = `scale(${(1 + 0.12 * bump(t, 11.0, 0.08)).toFixed(4)}) translateY(${-chkOut * 60}px)`;
    el.s4finTag.style.opacity = (prog(t, 10.85, 11.05) * (1 - prog(t, 11.2, 11.4))).toFixed(3);
    el.s4finTag.style.transform = `translateY(${lerp(16, 0, E.outCubic(prog(t, 10.85, 11.1)))}px)`;
  };

  const sceneS5 = (t) => {
    const on = t > 11.45 && t < 15.05;
    show(el.s5, on);
    if (!on) return;
    const head = 'WHAT YOU NEED TO KNOW';
    const n = Math.floor(lerp(0, head.length, prog(t, 11.5, 11.85)));
    el.s5headTxt.innerHTML = head.slice(0, n) + (t < 12.2 && (n < head.length || Math.floor(t * 4) % 2 === 0) ? '<span class="cursor"></span>' : '');
    const out = (i) => E.inExpo(prog(t, 14.62 + i * 0.07, 14.95 + i * 0.07));
    el.s5head.style.opacity = (prog(t, 11.5, 11.55) * (1 - out(0))).toFixed(3);
    [11.66, 11.96, 12.26].forEach((rt, i) => {
      const r = rowParts[i];
      tf(r.hair, { sx: E.outExpo(prog(t, rt, rt + 0.7)) });
      tf(r.num, { x: lerp(-20, 0, E.outExpo(prog(t, rt + 0.06, rt + 0.5))), o: prog(t, rt + 0.06, rt + 0.24) });
      r.lines.forEach((ln, j) => reveal(ln, t, rt + 0.08 + j * 0.06, 0.6));
      r.c.style.strokeDashoffset = (2 * Math.PI * 29 * (1 - E.outCubic(prog(t, rt + 0.3, rt + 0.7)))).toFixed(2);
      r.k.style.strokeDashoffset = (44 * (1 - E.outCubic(prog(t, rt + 0.5, rt + 0.75)))).toFixed(2);
      const o = out(i + 1);
      r.r.style.transform = `translateX(${(-80 * o).toFixed(1)}px)`;
      r.r.style.opacity = (1 - o).toFixed(3);
    });
    tf(el.s5bottom, { sx: E.outExpo(prog(t, 12.45, 13.1)), o: 1 - out(4) });
  };

  const sceneS6 = (t) => {
    const on = t > 14.95 && t < 17.05;
    show(el.s6, on);
    if (!on) return;
    const lp = E.outExpo(prog(t, 15.0, 15.5));
    el.s6lbl.style.opacity = lp.toFixed(3);
    el.s6lbl.style.letterSpacing = `${lerp(0.7, 0.32, lp).toFixed(3)}em`;
    reveal(el.s6dayIn, t, 15.08, 0.6);
    yearReels.forEach((r, i) => setReel(r.strip, t, 15.0 + i * 0.03, r.land, r.last, YEAR_PX, 'by' + i));
    el.s6year.style.transform = `scale(${(1 + 0.06 * Math.exp(-Math.max(0, t - 15.55) * 8) * (t >= 15.55 ? 1 : 0)).toFixed(4)})`;
    el.s6year.style.opacity = prog(t, 15.0, 15.12).toFixed(3);
    const f = E.outCubic(prog(t, 15.3, 16.2));
    el.s6fill.style.transform = `scaleX(${f.toFixed(4)})`;
    el.s6head.style.left = `${(f * 780).toFixed(1)}px`;
    el.s6head.style.opacity = prog(t, 15.3, 15.4).toFixed(3);
    document.querySelectorAll('.s6tick').forEach((n) => { n.style.opacity = prog(t, 15.35, 15.6).toFixed(3); });
  };

  const sceneS7 = (t) => {
    const w = E.inOutExpo(prog(t, 16.68, 17.32));
    el.wipe.style.transform = `translateX(${lerp(-2900, 1500, w).toFixed(1)}px) skewX(-14deg)`;
    show(el.wipe, w > 0 && w < 1);
    const on = t >= 17.0;
    show(el.s7, on);
    if (!on) return;
    [el.e1, el.e2, el.e3].forEach((e, i) => reveal(e, t, 17.12 + i * 0.1, 0.7));
    tf(el.s7logo, { y: lerp(-24, 0, E.outExpo(prog(t, 17.3, 17.9))), o: prog(t, 17.3, 17.5) });
    tf(el.s7cta, { y: lerp(26, 0, E.outExpo(prog(t, 17.62, 18.2))), o: prog(t, 17.62, 17.8) });
    tf(el.s7date, { y: lerp(16, 0, E.outExpo(prog(t, 17.8, 18.3))), o: prog(t, 17.8, 18.0) });
    tf(el.s7legal, { y: lerp(16, 0, E.outExpo(prog(t, 17.9, 18.4))), o: prog(t, 17.9, 18.1) });
    el.s7cta.querySelector('.dot').style.opacity = (0.55 + 0.45 * Math.cos(t * 5)).toFixed(3);
    const ce = E.outExpo(prog(t, 17.15, 18.05));
    const lt = t - 17.0;
    applyCard(cards[1], {
      x: lerp(760, 0, ce), y: lerp(160, 0, ce) + 8 * Math.sin(lt * 1.5), z: 0,
      rx: lerp(30, 16, ce) + 3 * Math.sin(lt * 1.2), ry: lerp(-90, -26, ce) + 7 * Math.sin(lt * 0.9), rz: lerp(-30, -16, ce),
    }, t, 17.75);
  };

  // ---------- frame ----------
  // X uses the first frame as the post thumbnail, so the opening 0.1s holds the 0% hero as a cover.
  const COVER = 0.1, COVER_T = 1.8;
  const renderFrame = (t) => {
    t = clamp(t, 0, DURATION);
    const cover = t < COVER;
    if (cover) t = COVER_T;
    drawBg(t);
    const sh = camShake(t);
    const drift = 1 + 0.012 * Math.sin(t * 0.55) + sh.z;
    el.cam.style.transform = `translate(${sh.x.toFixed(2)}px,${sh.y.toFixed(2)}px) rotate(${(sh.r + 0.18 * Math.sin(t * 0.4)).toFixed(3)}deg) scale(${drift.toFixed(4)})`;
    sceneA(t); sceneS3(t); sceneS4(t); sceneS5(t); sceneS6(t); sceneS7(t);
    drawFx(t);
    if (cover) fx.clearRect(0, 0, W, H);
    el.flash.style.opacity = (0.22 * bump(t, 1.0, 0.06) + 0.3 * bump(t, 5.0, 0.07) + 0.16 * bump(t, 15.55, 0.06)).toFixed(3);
    el.grain.style.opacity = '0.045';
  };

  // Audio cue sheet (consumed by scripts/audio.py so sound design stays in sync with the picture).
  const CUES = {
    bpm: 120, duration: DURATION,
    impacts: [1.0, 5.42, 7.02, 15.55, 17.0],
    whooshes: [0.06, 2.0, 4.72, 8.3, 11.22, 14.66, 16.72],
    strikes: [9.0, 9.5, 10.0],
    ticks: [[0.36, 1.0, zeroLast], [6.45, 7.0, feeLast], ...yearReels.map((r, i) => [15.0 + i * 0.03, r.land, r.last])],
    blips: [1.15, 2.7, 3.0, 6.35, 6.45, 7.3, 11.5, 11.66, 11.96, 12.26, 15.3, 17.62],
    taps: [6.0, 6.12, 6.24],
    risers: [[3.9, 5.0], [16.0, 17.0]],
  };

  window.KAST = {
    W, H, FPS, DURATION, CUES, renderFrame,
    ready: document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => { measure(); renderFrame(0); r(true); }))),
  };

  if (params.has('play')) {
    window.KAST.ready.then(() => {
      const t0 = performance.now();
      const loop = () => { renderFrame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
      loop();
    });
  } else if (params.has('t')) {
    window.KAST.ready.then(() => renderFrame(parseFloat(params.get('t'))));
  }
})();
