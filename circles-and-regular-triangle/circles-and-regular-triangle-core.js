"use strict";

/*
 * Tangent Circles and an Isosceles Triangle, from Alexander Bogomolny's
 * applet CirclesAndRegularTriangle on cut-the-knot.org (an 1803 Sangaku
 * problem). Circle S has centre O and diameter AC; B is a point on AC. Circle
 * G has centre P and diameter AB, and the isosceles triangle BCE has its
 * apex E on S, directly above the midpoint D of BC. Circle W with centre Q
 * is tucked into the gap between S, G and the side BE. The claim is that QB
 * is perpendicular to AC.
 *
 * The code below is the geometry and nothing else: no document, no window,
 * no storage. It defines one global, CirclesAndRegularTriangleCore, so a
 * page loads it with a plain <script> and the logic test loads it in Node.
 * The position is plain data, so it can be saved and handed to the tutor.
 *
 * The formulas and the guard are transcribed from the applet's own
 * Compute and CommonPoint methods (including GeoSDoub.IntersectX and its
 * choice of the upper intersection for E). The applet fixes B's y and lets
 * its x slide along the diameter; outside the segment AC it draws nothing.
 * The title says "regular triangle", but the page states an isosceles
 * triangle BCE; it is equilateral only when B is the midpoint of AC.
 */
const CirclesAndRegularTriangleCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 250;
  const MARGIN = 12;
  const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };          // (200, 125)
  const HALF = Math.min(WIDTH, HEIGHT) / 2.5;              // 100
  const A = { x: CENTER.x - HALF, y: CENTER.y };           // (100, 125)
  const C = { x: CENTER.x + HALF, y: CENTER.y };           // (300, 125)
  const O = { x: CENTER.x, y: CENTER.y };                  // (200, 125)
  const B0 = { x: CENTER.x + HALF / 5, y: CENTER.y };      // (220, 125)
  const POINTS = ["B"];
  const OPTIONS = ["showNames", "showPremise", "showStatement", "showColors"];

  const copy = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const dot = (p, q, r) => (p.x - q.x) * (r.x - q.x) + (p.y - q.y) * (r.y - q.y);
  const angle = (v, p, q) => {
    const np = dist(v, p), nq = dist(v, q);
    if (!np || !nq) return NaN;
    return Math.acos(clamp(dot(p, v, q) / (np * nq), -1, 1));
  };

  /** The applet's initial configuration, with B 3/5 of the way from A to C. */
  function start(options) {
    const o = options || {};
    const B = o.B && finite(o.B)
      ? { x: clamp(o.B.x, MARGIN, WIDTH - MARGIN), y: CENTER.y }
      : copy(B0);
    const s = {
      A: o.A && finite(o.A) ? copy(o.A) : copy(A),
      B,
      C: o.C && finite(o.C) ? copy(o.C) : copy(C),
      O: o.O && finite(o.O) ? copy(o.O) : copy(O),
      moves: 0, explored: false,
    };
    for (const key of OPTIONS) s[key] = o[key] === undefined ? false : !!o[key];
    return s;
  }

  function legalMoves() {
    return POINTS.slice();
  }

  /** B slides along AC. Its y is fixed, exactly as CTKMoveableDoub.Fix(2)
   *  does in the applet; a drag outside the board is clamped. */
  function movePoint(s, name, p) {
    if (name !== "B" || !finite(p)) return s;
    const B = { x: clamp(p.x, MARGIN, WIDTH - MARGIN), y: s.B.y };
    if (B.x === s.B.x) return s;
    return Object.assign({}, s, { B, moves: s.moves + 1, explored: true });
  }

  /** The four checkboxes from the applet's panel. */
  function setOption(s, key, value) {
    if (OPTIONS.indexOf(key) < 0) return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /** Restore the opening drawing, keeping the display options. */
  function reset(s) {
    return start({
      showNames: s.showNames, showPremise: s.showPremise,
      showStatement: s.showStatement, showColors: s.showColors,
    });
  }

  /** GeoSDoub.IntersectX(line x = m*y + b, circle), the branch the applet
   *  takes for its vertical line from D to D + (0,200). */
  function intersectX(m, b, circle) {
    const a = m * m + 1;
    const k = m * (b - circle.x) - circle.y;
    const c = circle.y * circle.y + (b - circle.x) * (b - circle.x) -
      circle.r * circle.r;
    const disc = k * k - a * c;
    if (!(disc >= 0)) return [];
    const root = Math.sqrt(disc);
    const y1 = (-k + root) / a, y2 = (-k - root) / a;
    return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
  }

  /** Canvas.CommonPoint: the tangency point of two touching circles, on the
   *  line of their centres. The sign is the applet's d < r1 test. */
  function commonPoint(c1, c2) {
    const d = dist(c1, c2);
    const sign = d < c1.r ? 1 : -1;
    return {
      x: c1.x + (c2.x - c1.x) * (d + sign * c2.r) / d,
      y: c1.y + (c2.y - c1.y) * (d + sign * c2.r) / d,
    };
  }

  /** Everything the page draws, recomputed from B and the fixed diameter.
   *  When B leaves the open segment AC the applet's Compute returns early;
   *  we report noDraw and no derived geometry. */
  function compute(s) {
    const { A: a, B, C: c, O: o } = s;
    const base = {
      A: a, B, C: c, O: o, D: null, E: null, P: null, Q: null,
      big: { x: o.x, y: o.y, r: dist(a, o) },
      mid: null, small: null, tangencyBig: null, tangencyMid: null,
      noDraw: B.x <= a.x || B.x >= c.x,
      qbAngle: NaN, ab: Math.abs(B.x - a.x), eq: NaN,
    };
    if (base.noDraw) return base;

    /* MidCircle: centre P at the midpoint of AB, radius AB/2. */
    const halfAB = Math.abs(B.x - a.x) / 2;
    const mid = { x: a.x + halfAB, y: a.y, r: halfAB };

    /* D is the midpoint of BC; the vertical line through it meets S twice,
       and E is the upper crossing (the smaller y, since y grows downwards). */
    const D = { x: (B.x + c.x) / 2, y: B.y };
    const hits = intersectX(0, D.x, base.big);
    const E = hits.length
      ? (hits[0].y < D.y ? hits[0] : (hits[1] || hits[0]))
      : null;

    /* The two ratios behind the inscribed circle, straight from Compute. */
    const t = mid.r / base.big.r;
    const lift = t / (1 + t) * Math.sqrt(2 * (1 - t)) * (c.x - a.x);
    const radius = t * (1 - t) / (1 + t) * (c.x - a.x);

    /* Q is directly above B: this is the claim QB perpendicular to AC. */
    const Q = { x: B.x, y: B.y - lift };
    const small = { x: Q.x, y: Q.y, r: radius };
    const tangencyBig = commonPoint(base.big, small);
    const tangencyMid = commonPoint(mid, small);
    return Object.assign(base, {
      D, E, P: { x: mid.x, y: mid.y }, Q,
      mid, small, tangencyBig, tangencyMid,
      qbAngle: angle(B, Q, a),
      eq: E ? dist(B, E) - dist(c, E) : NaN,
    });
  }

  /** The line under the picture. An illustration has no winner to announce. */
  function describe(s) {
    const g = compute(s);
    if (g.noDraw || !g.E || !Number.isFinite(g.small.r)) {
      return "Put B between A and C to see the three circles.";
    }
    const r = (v) => Math.round(v);
    return `B is ${r(g.ab)} units from A. Q is straight above B, so QB meets AC at a right angle. ` +
      `The small circle (radius ${r(g.small.r)}) touches both circles and the sloping side BE.`;
  }

  /** No win, loss or finish: this is a demonstration the player explores. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, MARGIN, CENTER, HALF, A, C, O, B0, POINTS, OPTIONS,
    copy, finite, clamp, dist, cross, dot, angle,
    start, legalMoves, movePoint, setOption, reset,
    intersectX, commonPoint, compute, describe, result,
  };
})();
