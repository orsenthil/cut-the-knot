"use strict";

/*
 * BOL6 — Book of Lemmas, Proposition 6 (Archimedes' arbelos circle).
 *
 * AB is the diameter of a large semicircle. C divides AB, and semicircles on
 * AC and CB are drawn inside it. The circle touching all three semicircles has
 * a horizontal diameter GH; the proposition asks how GH compares with AB.
 *
 * One idea does all the work: write AC = 2r1, CB = 2r2, so the big radius is
 * R = r1 + r2. If the touching circle has radius rho, the three tangencies give
 *
 *     rho = r1*r2*(r1+r2) / (r1*r1 + r1*r2 + r2*r2),
 *
 * and its centre is one diameter (2*rho) above AB. With k = AC/CB this is
 * GH/AB = k/(1 + k + k*k); for k = 3/2 that is exactly 6/19.
 *
 * The applet's BOL6Canvas finds the circle with ApolloniusCircle.Compute(1,1,-1)
 * after nudging the big circle one pixel down (three otherwise collinear
 * centres make the determinant zero). The nudge is a drawing workaround, not
 * part of the theorem, so this core uses the exact tangency; porting/check-bol-6
 * transcribes the applet's Apollonius computation literally and compares the two
 * over hundreds of configurations.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Bol6Core, so the page loads it with a plain <script>
 * and porting/check-bol-6.mjs loads it in Node. Positions are plain data.
 */
const Bol6Core = (() => {
  const EPS = 1e-9;
  const MIN_GAP = 10; // the applet's PointIsEligible keeps C 10 px from A and B

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Intersection of the infinite lines p->q and r->s, or null if parallel. */
  function intersect(p, q, r, s) {
    const ux = q.x - p.x, uy = q.y - p.y;
    const vx = s.x - r.x, vy = s.y - r.y;
    const det = ux * vy - uy * vx;
    if (Math.abs(det) < 1e-12) return null;
    const t = ((r.x - p.x) * vy - (r.y - p.y) * vx) / det;
    return { x: p.x + ux * t, y: p.y + uy * t };
  }

  /** The second point where line p->q meets a circle; p is the known point. */
  function otherOnCircle(circle, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const a = dx * dx + dy * dy;
    if (a < EPS) return null;
    const fx = p.x - circle.x, fy = p.y - circle.y;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circle.r * circle.r;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const make = (t) => ({ x: p.x + dx * t, y: p.y + dy * t });
    const one = make((-b + root) / (2 * a));
    const two = make((-b - root) / (2 * a));
    // FindOtherPoint calls Other(): take the point farther from the known one.
    return dist(p, one) >= dist(p, two) ? one : two;
  }

  /** The starting diagram. A and B are fixed; C is the draggable division. */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: { x: o.points.A.x, y: o.points.A.y },
        B: { x: o.points.B.x, y: o.points.B.y },
        C: { x: o.points.C.x, y: o.points.C.y },
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 250 : o.height;
    const margin = o.margin === undefined ? 30 : o.margin;
    const A = { x: margin, y: height - margin };
    const B = { x: width - margin, y: height - margin };
    const L = B.x - A.x;
    const raw = o.ratio === undefined ? 3 / 2 : o.ratio;
    const ratio = clamp(raw, MIN_GAP / (L - MIN_GAP), (L - MIN_GAP) / MIN_GAP);
    return { A, B, C: { x: A.x + (L * ratio) / (1 + ratio), y: A.y } };
  }

  /** AC / CB, or null when the division has collapsed. */
  function ratioOf(s) {
    const ac = s.C.x - s.A.x;
    const cb = s.B.x - s.C.x;
    return cb > EPS && ac > EPS ? ac / cb : null;
  }

  /** Move the named point; only C can move, and only along AB (Fix(Y_FIXED)). */
  function withPoint(s, name, p) {
    const next = {
      A: { x: s.A.x, y: s.A.y },
      B: { x: s.B.x, y: s.B.y },
      C: { x: s.C.x, y: s.C.y },
    };
    if (name !== "C") return next;
    next.C = { x: clamp(p.x, s.A.x + MIN_GAP, s.B.x - MIN_GAP), y: s.A.y };
    return next;
  }

  /** Set the division ratio directly, keeping C on AB. */
  function withRatio(s, ratio) {
    const L = s.B.x - s.A.x;
    const k = clamp(ratio, MIN_GAP / (L - MIN_GAP), (L - MIN_GAP) / MIN_GAP);
    return { A: { ...s.A }, B: { ...s.B }, C: { x: s.A.x + (L * k) / (1 + k), y: s.A.y } };
  }

  /** Everything the page draws and the logic test checks. */
  function geometry(s) {
    const L = s.B.x - s.A.x;
    const c = s.C.x - s.A.x;
    const ratio = ratioOf(s);
    const blank = {
      A: s.A, B: s.B, C: s.C, L, c, ratio, degenerate: true,
      R1: null, R2: null, R: null, rho: null, main: null,
      O1: null, O2: null, O: null, G: null, H: null, N: null, P: null,
      D: null, E: null, F: null, I: null, K: null, Lp: null, M: null,
    };
    if (ratio === null || Math.abs(s.C.y - s.A.y) > 1e-6) return blank;

    const R1 = c / 2, R2 = (L - c) / 2, R = L / 2;
    const den = L * L - L * c + c * c;
    const rho = (c * L * (L - c)) / (2 * den);
    const mx = s.A.x + (c * L * (L + c)) / (2 * den);
    const main = { x: mx, y: s.A.y - 2 * rho, r: rho };
    const O1 = { x: s.A.x + c / 2, y: s.A.y };
    const O2 = { x: s.A.x + (L + c) / 2, y: s.A.y };
    const O = { x: s.A.x + L / 2, y: s.A.y };
    const G = { x: mx - rho, y: main.y };
    const H = { x: mx + rho, y: main.y };
    const N = { x: G.x, y: s.A.y };
    const P = { x: H.x, y: s.A.y };
    const left = { ...O1, r: R1 };
    const right = { ...O2, r: R2 };

    return {
      A: s.A, B: s.B, C: s.C, L, c, ratio, degenerate: false,
      R1, R2, R, rho, main, O1, O2, O, G, H, N, P,
      // The auxiliary lines the applet shows with "auxiliary lines" ticked.
      D: intersect(s.A, G, s.B, H),
      E: intersect(s.A, H, s.C, G),
      F: intersect(G, s.B, s.C, H),
      Lp: intersect(G, N, s.A, H),
      M: intersect(G, s.B, P, H),
      I: (() => { const d = intersect(s.A, G, s.B, H); return d ? otherOnCircle(left, s.A, d) : null; })(),
      K: (() => { const d = intersect(s.A, G, s.B, H); return d ? otherOnCircle(right, s.B, d) : null; })(),
    };
  }

  /** Each claim on the cut-the-knot page, tested numerically at this diagram. */
  function claims(s) {
    const g = geometry(s);
    const no = {
      tangentLeft: false, tangentRight: false, tangentBig: false,
      centreHeight: false, diameterOnBaseline: false, ghEqualsNp: false,
      continuedProportion: false, ratioClaim: false, ghFormula: false,
      specialCase: false,
    };
    if (g.degenerate) return no;
    const tol = 1e-7 * g.L;
    const AN = g.N.x - g.A.x, NP = g.P.x - g.N.x, PB = g.B.x - g.P.x;
    const GH = dist(g.G, g.H);
    const k = g.ratio;
    const near = (a, b) => Math.abs(a - b) <= tol;
    return {
      tangentLeft: near(dist(g.main, g.O1), g.R1 + g.rho),
      tangentRight: near(dist(g.main, g.O2), g.R2 + g.rho),
      tangentBig: near(dist(g.main, g.O), g.R - g.rho),
      centreHeight: near(g.A.y - g.main.y, 2 * g.rho),
      diameterOnBaseline: near(g.N.x, g.G.x) && near(g.P.x, g.H.x) &&
        near(g.N.y, g.A.y) && near(g.P.y, g.A.y),
      ghEqualsNp: near(GH, NP),
      continuedProportion: NP > EPS && near((AN * PB) / (NP * NP), 1),
      ratioClaim: PB > EPS && near(NP / PB, k) && near(AN / NP, k),
      ghFormula: near(GH / g.L, k / (1 + k + k * k)),
      specialCase: near(k, 3 / 2) ? near(GH / g.L, 6 / 19) : true,
    };
  }

  /** An illustration has nothing to win or lose. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, MIN_GAP, dist, start, ratioOf, withPoint, withRatio,
    geometry, claims, result, intersect, otherOnCircle,
  };
})();
