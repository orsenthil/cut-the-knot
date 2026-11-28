"use strict";

/*
 * Two Circles and One More — Alexander Bogomolny's MaxCommonChord4 applet.
 *
 * Two circles C(E) and C(F) meet at P and Q. The ray EP meets C(F) again at M
 * and C(E) again at the antipode G of P; the ray FP meets C(E) again at L and
 * C(F) again at the antipode H of P. The applet draws E, F, L, M and Q on one
 * circle and compares the angles at Q. The key idea is that LEP and MFP are
 * isosceles with equal base angles at P, so their apex angles agree; an
 * inscribed angle is then half (or, on the small arc, the supplement of half)
 * the central angle over the same chord.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, MaxCommonChord4Core, so the page loads it with
 * a plain <script> and porting/check-max-common-chord-4.mjs loads it in Node.
 * A position is plain data (numbers and plain points), so it can be saved and
 * handed to the tutor as it is. Every function returns a new position.
 */
const MaxCommonChord4Core = (() => {
  /* The Java canvas starts at 400x300 in the applet; positions are in its
     pixel-like units and the SVG viewBox uses the same units. */
  const WIDTH = 400;
  const HEIGHT = 300;
  /* Compute() refuses to redraw if any centre-to-P/Q distance or PQ itself
     is below two units. Keeping the last picture is what the applet does. */
  const MIN_GAP = 2;
  const NAMES = ["P", "Q", "A", "B"];
  const OPTIONS = ["statement1", "statement2", "hint", "names"];

  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const copy = (p) => ({ x: p.x, y: p.y });
  const round = (v) => Math.round(v);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** The undirected angle at v between v->p and v->q, in degrees. */
  function angle(v, p, q) {
    const vp = sqDist(v, p), vq = sqDist(v, q);
    if (!vp || !vq) return 0;
    const cosine = ((p.x - v.x) * (q.x - v.x) + (p.y - v.y) * (q.y - v.y)) / Math.sqrt(vp * vq);
    return (Math.acos(clamp(cosine, -1, 1)) * 180) / Math.PI;
  }

  /** Circumcentre and the applet's average-of-three-distances radius. */
  function circleThrough(p, q, r) {
    const det = 2 * (p.x * (q.y - r.y) + q.x * (r.y - p.y) + r.x * (p.y - q.y));
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
    const pp = sqDist(p, { x: 0, y: 0 }), qq = sqDist(q, { x: 0, y: 0 }), rr = sqDist(r, { x: 0, y: 0 });
    const c = {
      x: (pp * (q.y - r.y) + qq * (r.y - p.y) + rr * (p.y - q.y)) / det,
      y: (pp * (r.x - q.x) + qq * (p.x - r.x) + rr * (q.x - p.x)) / det,
    };
    c.r = (dist(c, p) + dist(c, q) + dist(c, r)) / 3;
    return c;
  }

  /** The two crossings of two circles, in no particular order. */
  function circleCrossings(c1, c2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy);
    if (!d || !Number.isFinite(d)) return [];
    const along = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
    const h2 = c1.r * c1.r - along * along;
    if (h2 < 0 || !Number.isFinite(h2)) return [];
    const ux = dx / d, uy = dy / d;
    const base = { x: c1.x + ux * along, y: c1.y + uy * along };
    const h = Math.sqrt(h2);
    const points = [
      { x: base.x - uy * h, y: base.y + ux * h },
      { x: base.x + uy * h, y: base.y - ux * h },
    ];
    /* The applet's Intersect() branches on the centre separation and lists
       the root with the larger y (or x) first. Other() below uses that order
       when the two crossings are less than a pixel apart, so keep it. */
    return ordered(points, c1, c2);
  }

  function ordered(points, c1, c2) {
    if (Math.abs(c1.x - c2.x) > MIN_GAP / 2) return points.slice().sort((a, b) => b.y - a.y);
    if (Math.abs(c1.y - c2.y) > MIN_GAP / 2) return points.slice().sort((a, b) => b.x - a.x);
    const centre = { x: c1.x, y: c1.y };
    return [centre, { x: centre.x, y: centre.y }];
  }

  /** The two crossings of the infinite line pq with a circle. */
  function lineCrossings(p, q, c) {
    const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
    if (!len || !Number.isFinite(len)) return [];
    const ux = dx / len, uy = dy / len;
    const t = (c.x - p.x) * ux + (c.y - p.y) * uy;
    const h2 = c.r * c.r - (sqDist(p, c) - t * t);
    if (h2 < 0 || !Number.isFinite(h2)) return [];
    const h = Math.sqrt(h2);
    const points = [
      { x: p.x + (t + h) * ux, y: p.y + (t + h) * uy },
      { x: p.x + (t - h) * ux, y: p.y + (t - h) * uy },
    ];
    /* Same listing order as Intersect(DoubLine, DoubCircle) in the applet. */
    if (Math.abs(p.y - q.y) > MIN_GAP / 2) return points.sort((a, b) => b.y - a.y);
    if (Math.abs(p.x - q.x) > MIN_GAP / 2) return points.sort((a, b) => b.x - a.x);
    return [points[0], points[0]];
  }

  function lineCrossing(p, q, r, s) {
    const a = q.x - p.x, b = q.y - p.y, c = r.x - s.x, d = r.y - s.y;
    const det = a * d - b * c;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
    const t = ((r.x - p.x) * d - (r.y - p.y) * c) / det;
    return { x: p.x + a * t, y: p.y + b * t };
  }

  /** Other(pair, q) in the applet: the crossing more than one unit from q. */
  function other(pair, q) {
    if (!pair || pair.length < 2) return null;
    return dist(pair[0], q) >= 1 ? pair[0] : pair[1];
  }

  /** CTKGeometryPlus.Prorate(p, c, length): p moved toward c by `length`. */
  function prorate(p, c, length) {
    const d = dist(p, c);
    if (d < 0.1) return copy(p);
    const k = length / d;
    return { x: p.x + k * (c.x - p.x), y: p.y + k * (c.y - p.y) };
  }

  /** The position a new picture starts from, with the applet's own formulas. */
  function start(options) {
    const o = options || {};
    const w = o.width === undefined ? WIDTH : o.width;
    const h = o.height === undefined ? HEIGHT : o.height;
    const show = {};
    OPTIONS.forEach((key) => { show[key] = !!(o.show && o.show[key]); });
    return {
      width: w,
      height: h,
      P: { x: w / 2, y: round((2 * h) / 5) + round(h / 5) },
      Q: { x: w / 2, y: round((3 * h) / 5) + round(h / 5) },
      A: { x: round((3 * w) / 10), y: round(h / 2) + round(h / 5) },
      B: { x: round((17 * w) / 20), y: round((3 * h) / 5) },
      show: show,
    };
  }

  /** Move a draggable point; nothing outside the board is reachable. */
  function movePoint(state, name, p) {
    if (NAMES.indexOf(name) < 0) return state;
    return Object.assign({}, state, {
      [name]: { x: clamp(p.x, 0, state.width), y: clamp(p.y, 0, state.height) },
    });
  }

  function setOption(state, name, on) {
    if (OPTIONS.indexOf(name) < 0) return state;
    return Object.assign({}, state, { show: Object.assign({}, state.show, { [name]: !!on }) });
  }

  /** The exact guard at the top of Compute(). */
  function ready(state) {
    return dist(state.A, state.P) >= MIN_GAP && dist(state.A, state.Q) >= MIN_GAP &&
      dist(state.B, state.P) >= MIN_GAP && dist(state.B, state.Q) >= MIN_GAP &&
      dist(state.P, state.Q) >= MIN_GAP;
  }

  /** All the constructed objects, or { valid: false } when the applet skips. */
  function compute(state) {
    if (!ready(state)) return { valid: false };
    const { P, Q, A, B } = state;
    const E = circleThrough(A, P, Q);
    const F = circleThrough(B, P, Q);
    if (!E || !F) return { valid: false };
    /* C(EQF) is the circle through the two centres and Q. */
    const O = circleThrough(E, Q, F);
    if (!O) return { valid: false };
    const ABQ = circleThrough(A, B, Q);
    if (!ABQ) return { valid: false };

    const R = other(lineCrossings(P, Q, ABQ), Q);
    if (!R || dist(P, R) < 1) return { valid: false };
    const L = other(circleCrossings(O, E), Q);
    const M = other(circleCrossings(O, F), Q);
    if (!L || !M) return { valid: false };
    const S = lineCrossing(A, L, B, M);
    const G = prorate(P, E, 2 * E.r);
    const H = prorate(P, F, 2 * F.r);
    return { valid: true, complete: !!S, E: E, F: F, O: O, ABQ: ABQ,
      P: P, Q: Q, A: A, B: B, L: L, M: M, R: R, S: S, G: G, H: H };
  }

  /* Which side of the chord uv a point lies on; 0 means degenerate. */
  function side(u, v, p) {
    const s = cross(u, v, p);
    return Math.abs(s) < 1e-9 ? 0 : Math.sign(s);
  }

  /** The page's angle statements, with the arc cases made explicit. */
  function claims(fig) {
    if (!fig || !fig.valid || !fig.complete) return null;
    const { E, F, P, Q, L, M } = fig;
    const apexE = angle(E, L, P), apexF = angle(F, M, P);
    const baseE = angle(P, E, L), baseF = angle(P, F, M);
    const lqp = angle(Q, L, P), mqp = angle(Q, M, P), lqm = angle(Q, L, M);
    const lem = angle(E, L, M), lfm = angle(F, L, M);
    const qMajorLP = side(L, P, Q) !== 0 && side(L, P, Q) === side(L, P, E);
    const qMajorMP = side(M, P, Q) !== 0 && side(M, P, Q) === side(M, P, F);
    const qWithEonLM = side(L, M, Q) !== 0 && side(L, M, Q) === side(L, M, E);
    const qWithFonLM = side(L, M, Q) !== 0 && side(L, M, Q) === side(L, M, F);
    const circle = circleThrough(L, E, F);
    return {
      apexE: apexE, apexF: apexF, baseE: baseE, baseF: baseF,
      lqp: lqp, mqp: mqp, lqm: lqm, lem: lem, lfm: lfm,
      qMajorLP: qMajorLP, qMajorMP: qMajorMP,
      qWithEonLM: qWithEonLM, qWithFonLM: qWithFonLM,
      halfE: qMajorLP ? apexE / 2 : 180 - apexE / 2,
      halfF: qMajorMP ? apexF / 2 : 180 - apexF / 2,
      /* Distance of M from the line EP and of L from the line FP. */
      offEM: Math.abs(cross(E, P, M)) / Math.max(1, dist(E, P)),
      offFL: Math.abs(cross(F, P, L)) / Math.max(1, dist(F, P)),
      offLM_E: circle ? Math.abs(dist(circle, E) - circle.r) : Infinity,
      offM: circle ? Math.abs(dist(circle, M) - circle.r) : Infinity,
      offQ: circle ? Math.abs(dist(circle, Q) - circle.r) : Infinity,
    };
  }

  /** One readable line for the status area; an illustration has no winner. */
  function describe(fig) {
    const c = claims(fig);
    if (!fig || !fig.valid) return "Move the dots at least 2 units apart to draw the circles.";
    if (!c) return "The circles do not meet here; move P or Q.";
    const first = `∠LEP ${c.apexE.toFixed(1)}° = ∠MFP ${c.apexF.toFixed(1)}° — E, F, L, M, Q lie on one circle.`;
    const second = c.qMajorLP
      ? `∠LQP = ∠MQP = ${c.lqp.toFixed(1)}° = ½∠LEP.`
      : `Here Q is on the small arc LP: ∠LQP ${c.lqp.toFixed(1)}° is the supplement of ½∠LEP.`;
    return first + " " + second;
  }

  /** The position saved for the tutor, in board units. */
  function position(state) {
    return { P: copy(state.P), Q: copy(state.Q), A: copy(state.A), B: copy(state.B),
      show: Object.assign({}, state.show) };
  }

  /* There is no win or loss: this applet is an illustration. */
  function result(state) { return null; }
  function legalMoves(state) { return NAMES.slice(); }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, MIN_GAP: MIN_GAP, NAMES: NAMES, OPTIONS: OPTIONS,
    start: start, movePoint: movePoint, setOption: setOption, ready: ready,
    compute: compute, claims: claims, describe: describe, position: position,
    result: result, legalMoves: legalMoves,
    circleThrough: circleThrough, circleCrossings: circleCrossings,
    lineCrossings: lineCrossings, lineCrossing: lineCrossing,
    prorate: prorate, other: other, angle: angle, dist: dist, cross: cross, side: side,
    clamp: clamp,
  };
})();
