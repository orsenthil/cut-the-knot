"use strict";

/*
 * Butterfly — the 2N-Wing Butterfly theorem behind Bogomolny's applet Butterfly.
 *
 * The applet draws N concentric circles, a "classifier" chord line through the
 * nexus M, and two "spikes" through M. Each circle cuts the first spike in
 * A_i and B_i and the second in C_i and D_i. For any permutation p of
 * {1,...,N} let X_i be where A_i D_p(i) meets the classifier and Y_i where
 * C_i B_p(i) meets it. The theorem says
 *
 *     sum_i 1 / |MX_i|  =  sum_i 1 / |MY_i|,
 *
 * which for N = 1 is the plain Butterfly theorem: M is the midpoint of XY.
 * The key fact is that M is the midpoint of every circle's chord on the
 * classifier, so |MA_i| * |MB_i| = r_i^2 - |OM|^2 + |M|^2 ... in particular it
 * is the same for both spikes of one circle. Moving M off the perpendicular
 * through the common centre breaks that midpoint property, and the equality
 * then fails; the applet lets you drag M, so the page reports when it holds.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, ButterflyCore, so the page loads it with a plain
 * <script> and porting/check-butterfly.mjs loads it in Node. Every function
 * takes plain data and returns new objects; nothing passed in is changed.
 */
const ButterflyCore = (() => {
  const EPS = 1e-9;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* mulberry32: a small, repeatable stand-in for the applet's Math.random. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** The applet's Permutation.CreateRandom, as values 1..n. */
  function shuffle(n, random) {
    const p = [];
    for (let i = 1; i <= n; i++) p.push(i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    return p;
  }

  /** ButterflyCanvas.Reset: min(w,h)/4 is the outer radius, the rest step by step. */
  function radiiFor(base, n, random) {
    const step = base / n;
    const jitter = step / 4;
    const radii = [base];
    for (let i = 1; i < n; i++) radii.push(step * (n - i) + (random() * 2 - 1) * jitter);
    return radii;
  }

  /** The position a new diagram starts from (width=400, height=300 as in the applet). */
  function start(options) {
    const o = options || {};
    const n = clamp(Math.round(o.n === undefined ? 2 : o.n), 1, 10);
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const seed = o.seed === undefined ? 2912 : o.seed >>> 0;
    const random = o.random || rng(seed);
    const center = o.center
      ? { x: o.center.x, y: o.center.y }
      : { x: width / 2, y: height / 2 };
    const radii = o.radii ? o.radii.slice() : radiiFor(Math.min(width, height) / 4, n, random);
    const M = o.M ? { x: o.M.x, y: o.M.y } : { x: center.x, y: center.y + radii[n - 1] / 2 };

    /* Reset places A in the lower left quadrant and C in the upper right one. */
    const outer = radii[0];
    const angleA = Math.PI * 3 / 4 + random() * Math.PI / 4;
    const angleC = Math.PI / 6 + random() * Math.PI / 8;
    const A = o.A ? { x: o.A.x, y: o.A.y }
      : { x: center.x + outer * Math.cos(angleA), y: center.y + outer * Math.sin(angleA) };
    const C = o.C ? { x: o.C.x, y: o.C.y }
      : { x: center.x + outer * Math.cos(angleC), y: center.y - outer * Math.sin(angleC) };
    const perm = o.perm ? o.perm.slice() : shuffle(n, random);
    return {
      n, width, height, seed, center, radii, M, A, C, perm,
    };
  }

  /** The classifier is the horizontal line the applet draws through M and IM. */
  function classifier(s) {
    return { p: s.M, q: { x: s.M.x + 200, y: s.M.y } };
  }

  /** Where the line through p,q cuts the circle (common centre, radius r). */
  function lineCircle(p, q, c, r) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) return [];
    const ux = dx / len, uy = dy / len;
    const t = (c.x - p.x) * ux + (c.y - p.y) * uy;
    const foot = { x: p.x + t * ux, y: p.y + t * uy };
    const d2 = (c.x - foot.x) ** 2 + (c.y - foot.y) ** 2;
    if (d2 - r * r > 1e-7) return [];
    const h = Math.sqrt(Math.max(0, r * r - d2));
    return [
      { x: foot.x - h * ux, y: foot.y - h * uy },
      { x: foot.x + h * ux, y: foot.y + h * uy },
    ];
  }

  /** Intersection of the infinite lines a-b and c-d, or null if parallel. */
  function lineIntersection(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < EPS) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / det;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  /** Keep a dragged spike end on the outer circle. */
  function onOuterCircle(s, p) {
    const dx = p.x - s.center.x, dy = p.y - s.center.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) return { x: s.center.x + s.radii[0], y: s.center.y };
    return { x: s.center.x + (dx / len) * s.radii[0], y: s.center.y + (dy / len) * s.radii[0] };
  }

  /** A new position with one named point moved; the other data is untouched. */
  function withPoint(s, name, p) {
    if (!["M", "A", "C"].includes(name)) return s;
    const next = { ...s };
    if (name === "A") next.A = onOuterCircle(s, p);
    else if (name === "C") next.C = onOuterCircle(s, p);
    else next.M = { x: p.x, y: p.y };
    return next;
  }

  /** ProcessNumberChange: a new N runs Reset, exactly as the applet does. */
  function withN(s, n) {
    const nextN = clamp(Math.round(n), 1, 10);
    if (nextN === s.n) return s;
    return start({
      n: nextN, width: s.width, height: s.height,
      center: s.center, seed: s.seed + 101 * nextN,
    });
  }

  /** The Permute button: a new permutation, with the drawing left in place. */
  function permute(s, seed) {
    const random = rng((seed === undefined ? s.seed + s.n : seed) >>> 0);
    return { ...s, perm: shuffle(s.n, random) };
  }

  /**
   * Everything the page needs to draw and describe the diagram. The ordering
   * of the four points on each circle follows the applet's Draw: the point
   * with the larger y becomes A_i (or C_i), the other one B_i (or D_i).
   */
  function measurements(s) {
    const cls = classifier(s);
    const n = s.n;
    const A = [], B = [], C = [], D = [];
    let defined = true;
    for (let i = 0; i < n; i++) {
      const u = lineCircle(s.M, s.A, s.center, s.radii[i]);
      const v = lineCircle(s.M, s.C, s.center, s.radii[i]);
      if (u.length !== 2 || v.length !== 2) {
        defined = false;
        A.push(null); B.push(null); C.push(null); D.push(null);
        continue;
      }
      A.push(u[0].y > u[1].y ? u[0] : u[1]);
      B.push(u[0].y > u[1].y ? u[1] : u[0]);
      C.push(v[0].y > v[1].y ? v[0] : v[1]);
      D.push(v[0].y > v[1].y ? v[1] : v[0]);
    }
    const X = [], Y = [], mx = [], my = [];
    for (let i = 0; i < n; i++) {
      if (!defined || s.perm[i] < 1 || s.perm[i] > n || !A[i] || !C[i]) {
        X.push(null); Y.push(null); mx.push(NaN); my.push(NaN);
        continue;
      }
      const j = s.perm[i] - 1;
      const x = lineIntersection(A[i], D[j], cls.p, cls.q);
      const y = lineIntersection(C[i], B[j], cls.p, cls.q);
      X.push(x); Y.push(y);
      mx.push(x ? distance(s.M, x) : NaN);
      my.push(y ? distance(s.M, y) : NaN);
    }
    const sumX = mx.reduce((a, b) => a + 1 / b, 0);
    const sumY = my.reduce((a, b) => a + 1 / b, 0);
    /* M is the midpoint of every chord only when OM meets the classifier at M. */
    const aligned = Math.abs(s.M.x - s.center.x) <= EPS * Math.max(1, s.radii[0]);
    return {
      classifier: cls, circles: s.radii.map((r) => ({ center: s.center, radius: r })),
      A, B, C, D, X, Y, mx, my, sumX, sumY,
      defined: defined && mx.every(Number.isFinite) && my.every(Number.isFinite),
      aligned,
    };
  }

  /** The page's claims, checked against this exact position. */
  function claims(s) {
    const m = measurements(s);
    const scale = Math.max(1, s.radii[0]);
    const tol = 1e-7 * scale;
    const power = m.defined && m.aligned && m.A.every((p, i) => {
      const diff = Math.abs(distance(s.M, p) * distance(s.M, m.B[i]) -
        distance(s.M, m.C[i]) * distance(s.M, m.D[i]));
      const d = Math.abs(s.M.y - s.center.y);
      const want = s.radii[i] * s.radii[i] - d * d;
      return diff <= tol && Math.abs(distance(s.M, p) * distance(s.M, m.B[i]) - want) <= tol;
    });
    const chordMidpoints = m.aligned && s.radii.every((r) => {
      const ends = lineCircle(s.M, m.classifier.q, s.center, r);
      if (ends.length !== 2) return false;
      return distance(s.M, { x: (ends[0].x + ends[1].x) / 2, y: (ends[0].y + ends[1].y) / 2 }) <= tol;
    });
    return {
      defined: m.defined,
      aligned: m.aligned,
      midpoint: m.defined && m.aligned && s.n === 1 && Math.abs(m.mx[0] - m.my[0]) <= tol,
      reciprocal: m.defined && m.aligned &&
        Math.abs(m.sumX - m.sumY) <= tol * Math.max(1, Math.abs(m.sumX), Math.abs(m.sumY)),
      chordMidpoints,
      powerOfPoint: Boolean(power),
    };
  }

  /** Nothing can be won or lost in an illustration. */
  function result(/* state */) {
    return null;
  }

  return {
    rng, shuffle, radiiFor, start, classifier, lineCircle, lineIntersection,
    onOuterCircle, withPoint, withN, permute, measurements, claims, result,
  };
})();
