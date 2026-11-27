"use strict";

/*
 * Eyeball — the geometry behind Alexander Bogomolny's applet Eyeball
 * (cut-the-knot.org/Curriculum/Geometry/Eyeball.shtml; the Java version is
 * archived in the Wayback Machine's 2009 capture of that page).
 *
 * Two circles C(A, rA) and C(B, rB). The tangents from A to the second circle
 * cut the first circle in a chord PQ; the tangents from B to the first circle
 * cut the second circle in a chord RS. The page claims PQ = RS, and more
 * precisely PQ = RS = 2*rA*rB/AB. Each tangent makes a right triangle with the
 * touched radius, so a chord's half length is r*sin(theta) = rA*rB/AB.
 *
 * The applet's init() puts A at (w/4, h/2) with radius min(w,h)/6, and B at
 * (12w/11, h/2) with radius min(w,h)/4. For its 600x400 canvas B (and most of
 * its circle) lie beyond the right edge; this port widens the drawing board to
 * 780 units so all four draggable points can be reached. The construction is
 * otherwise unchanged: DrawTangents, ScaleToC, the optional diameter circle
 * and the two optional circumcircles are all reproduced. The two checkboxes
 * are the applet's "Draw extra circles" and "Draw rectangle".
 *
 * No DOM, no window, no storage. One global, EyeballCore. Positions are plain
 * data, so they can be saved for the player's record and the tutor.
 */
const EyeballCore = (() => {
  const APPLET_WIDTH = 600;
  const APPLET_HEIGHT = 400;
  const WIDTH = 780;   // widened board: the applet's second centre sits at 654.5
  const HEIGHT = 400;
  const MIN_RADIUS = 12; // keep a radius handle usable with a finger
  const HANDLES = ["A", "RA", "B", "RB"];
  const OPTION_KEYS = ["showExtra", "showRectangle"];
  const START = {
    A: { x: APPLET_WIDTH / 4, y: APPLET_HEIGHT / 2 },
    RA: { x: APPLET_WIDTH / 4, y: APPLET_HEIGHT / 2 - Math.min(APPLET_WIDTH, APPLET_HEIGHT) / 6 },
    B: { x: 12 * APPLET_WIDTH / 11, y: APPLET_HEIGHT / 2 },
    RB: { x: 12 * APPLET_WIDTH / 11, y: APPLET_HEIGHT / 2 + Math.min(APPLET_WIDTH, APPLET_HEIGHT) / 4 },
  };

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v) => Math.round(v * 1000) / 1000;
  const clampPoint = (p) => ({
    x: round(clamp(p.x, 8, WIDTH - 8)),
    y: round(clamp(p.y, 8, HEIGHT - 8)),
  });

  /* ------------------------------------------------------------- positions */

  /** The opening picture and the applet's two unticked checkboxes. */
  function start(options) {
    const o = options || {};
    const state = {
      A: { ...START.A }, RA: { ...START.RA },
      B: { ...START.B }, RB: { ...START.RB },
      showExtra: false,      // "Draw extra circles"
      showRectangle: false,  // "Draw rectangle"
      moves: 0,
      explored: false,
    };
    for (const name of HANDLES) {
      if (finite(o[name])) state[name] = clampPoint(o[name]);
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /** A drag of any point, a tick of either checkbox, or Reset. */
  function legalMoves(state) {
    return [
      ...HANDLES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!HANDLES.includes(m.name) || !finite(m.point)) return null;
      let p = clampPoint(m.point);
      if (m.name === "RA" || m.name === "RB") {
        const centre = m.name === "RA" ? state.A : state.B;
        const other = m.name === "RA" ? state.RA : state.RB;
        if (dist(centre, p) < MIN_RADIUS) {
          const d0 = dist(centre, other);
          const away = d0 > 1e-9 ? mul(sub(other, centre), 1 / d0) : { x: 0, y: -1 };
          p = clampPoint(add(centre, mul(away, MIN_RADIUS)));
        }
      }
      next = { ...state, [m.name]: p };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** An illustration has no win or loss: it is done once it has been explored. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* ---------------------------------------------------------- the geometry */

  /**
   * The applet's DrawTangents(touched, other): touch the circle `touched`
   * from the centre of `other`, then ScaleToC carries those touch rays out to
   * `other`'s circumference. `chord` is the segment cut on `other`; `touch`
   * holds the two perpendicular touch points on `touched`.
   *
   * Analytically, with d = AB and e the unit vector from the touched centre
   * towards the other centre, the touch point is
   *   S + (r*r/d)e ± (r*sqrt(d*d-r*r)/d)e-perp,
   * and the chord endpoint is other + (rOther/sqrt(d*d-r*r))(touch - other).
   * The bytecode's circle-intersection version is transcribed independently
   * in porting/check-eyeball.mjs and compared over thousands of positions.
   */
  function tangentPair(touched, touchedR, other, otherR) {
    const d = dist(touched, other);
    const disc = d * d - touchedR * touchedR;
    if (!Number.isFinite(d) || touchedR <= 0 || !(disc > 0)) return null;
    const e = mul(sub(other, touched), 1 / d);
    const perp = { x: -e.y, y: e.x };
    const h = Math.sqrt(disc);
    const foot = add(touched, mul(e, (touchedR * touchedR) / d));
    const spread = mul(perp, (touchedR * h) / d);
    let touch = [add(foot, spread), sub(foot, spread)];
    let chord = touch.map((X) => add(other, mul(sub(X, other), otherR / h)));
    // GeoSDoub.Intersect lists the larger y root first (larger x when the
    // centres are nearly vertically aligned). Keep that order: the extra
    // circles are built from matching indices of the two tangent pairs.
    const yBranch = Math.abs(other.x - touched.x) <= 1;
    if (yBranch ? touch[0].x < touch[1].x : touch[0].y < touch[1].y) {
      touch = [touch[1], touch[0]];
      chord = [chord[1], chord[0]];
    }
    return { touch, chord, foot, h, d };
  }

  /** Perpendicular bisectors meet here; the applet then averages three distances. */
  function circumcircle(a, b, c) {
    const ab = sub(b, a), ac = sub(c, a);
    const det = cross(ab, ac);
    // GeoSDoub.Intersect returns (NaN,NaN) when |det| < 1; report that as none.
    if (Math.abs(det) < 1) return null;
    const den = 2 * det;
    const b2 = dot(ab, ab), c2 = dot(ac, ac);
    const centre = add(a, {
      x: (b2 * ac.y - c2 * ab.y) / den,
      y: (ab.x * c2 - ac.x * b2) / den,
    });
    // GetCircle in EyeballCanvas takes the mean of the three distances rather
    // than any one of them; keep that quirk in the picture.
    const radius = (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3;
    return { centre, radius };
  }

  /** Everything the drawing needs at a position. */
  function compute(state) {
    const { A, RA, B, RB } = state || {};
    if (![A, RA, B, RB].every(finite)) {
      return { valid: false, reason: "invalid", A: state.A, B: state.B, rA: 1, rB: 1 };
    }
    const rA = dist(A, RA), rB = dist(B, RB), d = dist(A, B);
    const fromB = tangentPair(B, rB, A, rA);   // chord PQ on circle A
    const fromA = tangentPair(A, rA, B, rB);   // chord RS on circle B
    const base = { A, B, rA, rB, d, fromA, fromB };
    if (!fromA || !fromB) {
      return { ...base, valid: false, reason: "no tangents", PQ: null, RS: null };
    }
    const PQ = fromB.chord, RS = fromA.chord;
    const extra = [
      circumcircle(fromA.touch[0], fromB.touch[0], RS[0]),
      circumcircle(fromA.touch[1], fromB.touch[1], RS[1]),
    ];
    return {
      ...base, valid: true, reason: null, PQ, RS, extra,
      diameter: { centre: midpoint(A, B), radius: d / 2 },
      pq: dist(PQ[0], PQ[1]), rs: dist(RS[0], RS[1]),
      formula: (2 * rA * rB) / d,
    };
  }

  /** Residuals behind the page's claims, used by the logic test. */
  function residuals(g) {
    if (!g || !g.valid) return null;
    const { A, B, rA, rB, PQ, RS, fromA, fromB, formula } = g;
    const onCircle = (points, centre, r) =>
      Math.max(...points.map((p) => Math.abs(dist(p, centre) - r)));
    // The radius to each touch point is at right angles to the tangent ray
    // from the other centre.
    const tangentRight = Math.max(
      Math.abs(dot(sub(fromA.touch[0], A), sub(fromA.touch[0], B))),
      Math.abs(dot(sub(fromA.touch[1], A), sub(fromA.touch[1], B))),
      Math.abs(dot(sub(fromB.touch[0], B), sub(fromB.touch[0], A))),
      Math.abs(dot(sub(fromB.touch[1], B), sub(fromB.touch[1], A))),
    );
    const u = mul(sub(B, A), 1 / g.d);
    const lineOffset = (p) => Math.abs(cross(sub(p, A), u));
    const midPQ = midpoint(PQ[0], PQ[1]), midRS = midpoint(RS[0], RS[1]);
    return {
      equalChords: Math.abs(g.pq - g.rs),
      chordFormula: Math.max(Math.abs(g.pq - formula), Math.abs(g.rs - formula)),
      PQOnA: onCircle(PQ, A, rA),
      RSOnB: onCircle(RS, B, rB),
      touchOnA: onCircle(fromA.touch, A, rA),
      touchOnB: onCircle(fromB.touch, B, rB),
      tangentRight,
      chordPerpendicular: Math.max(
        Math.abs(dot(sub(PQ[0], PQ[1]), sub(B, A))) / (g.pq * g.d),
        Math.abs(dot(sub(RS[0], RS[1]), sub(B, A))) / (g.rs * g.d),
      ),
      midOnAB: Math.max(lineOffset(midPQ), lineOffset(midRS)),
      rectangleSides: Math.abs(dist(PQ[0], RS[0]) - dist(PQ[1], RS[1])),
      // The applet builds the extra circle through two touch points and one
      // chord point; its mean radius still passes through that third point.
      extraThroughThird: g.extra.every((c, i) =>
        !c || Math.abs(dist(c.centre, [RS[0], RS[1]][i]) - c.radius) < 1e-6) ? 0 : 1,
    };
  }

  return {
    APPLET_WIDTH, APPLET_HEIGHT, WIDTH, HEIGHT, MIN_RADIUS, HANDLES, OPTION_KEYS, START,
    add, sub, mul, dot, cross, dist, midpoint, finite, clamp, clampPoint,
    start, legalMoves, move, result, tangentPair, circumcircle, compute, residuals,
  };
})();
