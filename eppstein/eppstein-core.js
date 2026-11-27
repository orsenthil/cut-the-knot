"use strict";

/*
 * Eppstein, from Alexander Bogomolny's applet Eppstein.
 *
 * The three draggable corners A, B, C are the centres of three mutually
 * tangent circles: the radius at A is (b + c - a)/2 = s - a, and likewise at
 * B and C. The applet solves Apollonius' problem for those three circles with
 * its ApolloniusCircle.Compute(1, 1, 1); of the two answers the first is the
 * small inner Soddy circle and the second the Soddy circle enclosing them.
 * For each answer it joins opposite points of tangency: the point where the
 * Soddy circle touches a vertex circle to the point where the other two
 * vertex circles touch. The three joins always pass through one point, the
 * weighted centre M of the four circles. That point is Eppstein's point.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, EppsteinCore, so the page loads it with a
 * plain <script> and porting/check-eppstein.mjs loads it in Node. The position
 * is plain data and every function returns a new value.
 */
const EppsteinCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  // EppsteinCanvas.init: centre + min(width, height)/5 times (cos, sin) of
  // these angles. Java's y axis points down, exactly as in our SVG viewBox.
  const START_ANGLES = [-1.6, -4.0, -0.2];
  const EPS = 1e-10;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  function weighted(points, curvatures) {
    let ax = 0, ay = 0, sum = 0;
    for (let i = 0; i < points.length; i++) {
      ax += points[i].x * curvatures[i];
      ay += points[i].y * curvatures[i];
      sum += curvatures[i];
    }
    if (Math.abs(sum) < EPS) return null;
    return { x: ax / sum, y: ay / sum };
  }

  /** The one non-degenerate position the applet starts from. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const cx = width / 2, cy = height / 2;
    const scale = Math.min(width, height) / 5;
    const p = START_ANGLES.map((a) => ({
      x: cx + scale * Math.cos(a),
      y: cy + scale * Math.sin(a),
    }));
    return { width: width, height: height, A: p[0], B: p[1], C: p[2], inner: true };
  }

  /** The Reset/New diagram button: the applet's start, same board size. */
  function reset(state) {
    return start({ width: state.width, height: state.height });
  }

  function setPoint(state, name, point) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    return { ...state, [name]: { x: point.x, y: point.y } };
  }

  function setInner(state, inner) {
    return { ...state, inner: !!inner };
  }

  /** Sides a = BC, b = CA, c = AB and the three mutually tangent circles. */
  function triplets(state) {
    const a = distance(state.B, state.C);
    const b = distance(state.C, state.A);
    const c = distance(state.A, state.B);
    const s = (a + b + c) / 2;
    return {
      a: a, b: b, c: c, s: s,
      radii: { A: s - a, B: s - b, C: s - c },
      circles: [
        { x: state.A.x, y: state.A.y, r: (-a + b + c) / 2 },
        { x: state.B.x, y: state.B.y, r: (a - b + c) / 2 },
        { x: state.C.x, y: state.C.y, r: (a + b - c) / 2 },
      ],
    };
  }

  /*
   * A literal transcription of ApolloniusCircle.SetCircles + Compute. `e`
   * are the three signs passed to Compute; the applet always uses 1, 1, 1.
   * The Tangent convention in Compute is |t| for the radius and
   * (X*t + G, Y*t + I) for the centre, with t from the quadratic below.
   * Returns null at exactly the guards in the bytecode, else two circles.
   */
  function apollonius(circles, e0, e1, e2) {
    const c0 = circles[0], c1 = circles[1], c2 = circles[2];
    const info = (c) => c.x * c.x + c.y * c.y - c.r * c.r;

    // SetCircles: the radical centre and the linear system for X, Y.
    const A1 = 2 * (c1.x - c0.x), A2 = 2 * (c2.x - c0.x);
    const B1 = 2 * (c1.y - c0.y), B2 = 2 * (c2.y - c0.y);
    const o = info(c0);
    const D1 = o - info(c1), D2 = o - info(c2);
    const K = A1 * B2 - A2 * B1;
    // TreatZeroDeterminant returns null on every path in the applet.
    if (Math.abs(K) < 0.01) return null;
    const G = (B1 * D2 - B2 * D1) / K;
    const I = -(A1 * D2 - A2 * D1) / K;

    // Compute: b1, b2 solve the signed tangency equations.
    const b1 = 2 * (e0 * c0.r - e1 * c1.r);
    const b2 = 2 * (e0 * c0.r - e2 * c2.r);
    const X = (B1 * b2 - B2 * b1) / K;
    const Y = -(A1 * b2 - A2 * b1) / K;
    const Q = X * X + Y * Y - 1;
    if (Math.abs(Q) < 0.001) return null;

    const S = 2 * (X * G + Y * I - X * c0.x - Y * c0.y + e0 * c0.r);
    const R = G * G + I * I - 2 * G * c0.x - 2 * I * c0.y + o;
    const disc = S * S - 4 * Q * R;
    if (disc < 0) return null;
    const sqrt = Math.sqrt(disc);
    const roots = [(-S + sqrt) / (2 * Q), (-S - sqrt) / (2 * Q)];
    return roots.map((t) => ({
      x: X * t + G, y: Y * t + I, r: Math.abs(t), t: t,
    }));
  }

  /** The two Soddy circles for a triangle's vertex circles. */
  function soddyCircles(state) {
    return apollonius(triplets(state).circles, 1, 1, 1);
  }

  /*
   * EppsteinCanvas.Tangent. For two externally tangent circles and flag 0
   * this is their point of contact. Flag 1 is the internal weighted point,
   * which is what the enclosing Soddy circle needs.
   */
  function tangent(c1, c2, flag) {
    const r1 = c1.r, r2 = c2.r;
    return flag
      ? {
          x: (c1.x * r2 - c2.x * r1) / (r2 - r1),
          y: (c1.y * r2 - c2.y * r1) / (r2 - r1),
        }
      : {
          x: (c1.x * r2 + c2.x * r1) / (r1 + r2),
          y: (c1.y * r2 + c2.y * r1) / (r1 + r2),
        };
  }

  function lineIntersection(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const cross = rx * sy - ry * sx;
    if (Math.abs(cross) < EPS) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  /**
   * Everything the picture needs. `inner === true` picks solution 0 (the
   * small circle in the gap); false picks solution 1 (the enclosing circle).
   * Curvatures are signed: the enclosing circle gets a negative curvature.
   */
  function geometry(state) {
    const tri = triplets(state);
    const sols = soddyCircles(state);
    if (!sols || !sols[0] || !sols[1]) return null;
    const index = state.inner ? 0 : 1;
    const pick = sols[index];
    const S = { x: pick.x, y: pick.y, r: pick.r };
    const curvatures = [
      1 / tri.circles[0].r, 1 / tri.circles[1].r, 1 / tri.circles[2].r,
      (state.inner ? 1 : -1) / pick.r,
    ];
    const M = weighted(
      [state.A, state.B, state.C, { x: S.x, y: S.y }], curvatures,
    );
    if (!M) return null;

    // EppsteinCanvas.Draw: GetLine(S, vertex i, other vertices, index === 1).
    const flag = index === 1;
    const SA = tangent(S, tri.circles[0], flag);
    const SB = tangent(S, tri.circles[1], flag);
    const SC = tangent(S, tri.circles[2], flag);
    const BC = tangent(tri.circles[1], tri.circles[2], false);
    const CA = tangent(tri.circles[2], tri.circles[0], false);
    const AB = tangent(tri.circles[0], tri.circles[1], false);
    const lines = [
      { a: SA, b: BC },
      { a: SB, b: CA },
      { a: SC, b: AB },
    ];

    // The Gergonne point is the same weighted average of the three vertices.
    const Ge = weighted([state.A, state.B, state.C], curvatures.slice(0, 3));
    // In a very thin triangle two of the three lines can be parallel to
    // floating-point precision; try all three pairs before falling back to M.
    let meet = lineIntersection(lines[0].a, lines[0].b, lines[1].a, lines[1].b);
    if (!meet) meet = lineIntersection(lines[0].a, lines[0].b, lines[2].a, lines[2].b);
    if (!meet) meet = lineIntersection(lines[1].a, lines[1].b, lines[2].a, lines[2].b);
    if (!meet) meet = M;

    return {
      sides: tri,
      circles: tri.circles,
      soddy: sols,
      index: index,
      S: S,
      curvatures: curvatures,
      M: M,
      Ge: Ge,
      eppstein: meet,
      tangencies: { SA: SA, SB: SB, SC: SC, AB: AB, BC: BC, CA: CA },
      lines: lines,
    };
  }

  /** A plain, saveable description of what a player has explored. */
  function position(state) {
    return {
      A: { x: state.A.x, y: state.A.y },
      B: { x: state.B.x, y: state.B.y },
      C: { x: state.C.x, y: state.C.y },
      inner: state.inner,
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT,
    start: start, reset: reset, setPoint: setPoint, setInner: setInner,
    triplets: triplets, apollonius: apollonius, soddyCircles: soddyCircles,
    tangent: tangent, geometry: geometry, position: position,
    distance: distance, weighted: weighted, lineIntersection: lineIntersection,
  };
})();
