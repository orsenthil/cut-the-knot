"use strict";

/*
 * Eight Point Circle — Alexander Bogomolny's applet EightPointCircle.
 *
 * The applet keeps a quadrilateral A,B,C,D whose diagonals AC and BD stay
 * perpendicular: dragging A or C moves the other one in x, dragging B or D
 * moves the other one in y. P,Q,R,S are the side midpoints; E,F,G,H are the
 * feet of the perpendiculars from those midpoints to the opposite sides.
 * The page claims that P,Q,R,S,E,F,G,H all lie on one circle, centred at the
 * intersection K of PR and QS (the centre of mass of the four corners).
 *
 * The construction below is the applet's own arithmetic: MidPoint(), the
 * projection GeoSDoub.NearestPoint(point, a, b), the line intersection
 * GeoSDoub.Intersect() with its |determinant| >= 1 guard, and the radius
 * (Dist(K,P)+Dist(K,Q)+Dist(K,R)+Dist(K,S))/4.  The claims are then measured
 * independently from those points, so a false claim could be seen.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, EightPointCircleCore, so the page loads it
 * with a plain <script> and porting/check-eight-point-circle.mjs loads it in
 * Node. Positions are plain data in the SVG viewBox units.
 */
const EightPointCircleCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 250 };
  const PAD = 16;

  const point = (x, y) => ({ x, y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Keep a corner inside the board, with room for its handle and label. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /*
   * EightPointCircleCanvas.init(), on the applet's optimal 400x250 canvas:
   *   cx = W/2, cy = H/2, r = floor(min(W,H)*7/15)  (Java's int division)
   *   A = (cx + r cos(-2), cy + r sin(-2))
   *   D = (cx + r cos( 0.2), cy + r sin( 0.2))
   *   B = reflect D in the vertical line x=cx, then move B left by 30
   *   C = reflect A in the horizontal line y=cy
   * GetOtherH/GetOtherV really project the circle's centre onto a far
   * horizontal/vertical line through D/A, i.e. (cx, D.y) and (A.x, cy).
   * The two ±30 nudges are part of the original starting picture.
   */
  function start(options) {
    const o = options || {};
    const w = VIEW.width, h = VIEW.height;
    const cx = w / 2, cy = h / 2;
    const r = Math.floor(Math.min(w, h) * 7 / 15);
    const A = point(cx + r * Math.cos(-2), cy + r * Math.sin(-2));
    const D0 = point(cx + r * Math.cos(0.2), cy + r * Math.sin(0.2));
    // The applet computes B from D before nudging D to the right.
    const B = point(2 * cx - D0.x - 30, D0.y);
    const D = point(D0.x + 30, D0.y);
    const C = point(A.x, 2 * cy - A.y);
    return {
      A: clamp(A), B: clamp(B), C: clamp(C), D: clamp(D),
      options: {
        diagonals: o.diagonals === undefined ? false : !!o.diagonals,
        labels: o.labels === undefined ? false : !!o.labels,
        hint: o.hint === undefined ? false : !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  /*
   * EightPointCircleCanvas.mouseDragged(): the mover first moves the selected
   * corner, then the applet copies just the one coordinate that keeps AC
   * vertical and BD horizontal.
   */
  function move(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name)) return state;
    if (!finitePoint(p)) return state;
    const next = Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
    if (name === "A") next.C = point(next.A.x, next.C.y);
    if (name === "C") next.A = point(next.C.x, next.A.y);
    if (name === "B") next.D = point(next.D.x, next.B.y);
    if (name === "D") next.B = point(next.B.x, next.D.y);
    return next;
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /* GeoSDoub.NearestPoint(p, a, b): the foot of the perpendicular from p to
   * the infinite line a-b. The 0.1 early return is the applet's own guard. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if ((a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y) <= 0.1) {
      return point(p.x, p.y);
    }
    if (!len2 || !Number.isFinite(len2)) return point(NaN, NaN);
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return point(a.x + t * dx, a.y + t * dy);
  }

  /* GeoSDoub.Intersect(a, b, c, d) from its bytecode, including the guard
   * abs(det) < 1 -> (NaN, NaN) instead of a point at infinity. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /**
   * The whole drawing, from the four corners. P..S are the side midpoints,
   * E..H the perpendicular feet, K the intersection of PR and QS, radius the
   * applet's average of the four distances K-P .. K-S. Returns null when the
   * four corners do not make a drawable quadrilateral.
   */
  function compute(A, B, C, D) {
    const corners = [A, B, C, D];
    if (!corners.every(finitePoint)) return null;

    // P = mid(A,B), Q = mid(B,C), R = mid(C,D), S = mid(D,A).
    const P = midpoint(A, B), Q = midpoint(B, C), R = midpoint(C, D), S = midpoint(D, A);
    // E from P to CD, F from Q to DA, G from R to AB, H from S to BC.
    const E = foot(P, C, D), F = foot(Q, D, A), G = foot(R, A, B), H = foot(S, B, C);
    if (![E, F, G, H].every(finitePoint)) return null;

    const K = intersect(P, R, Q, S);
    if (!finitePoint(K)) return null;
    const radius = (dist(K, P) + dist(K, Q) + dist(K, R) + dist(K, S)) / 4;
    if (!(radius > 1e-6) || !Number.isFinite(radius)) return null;

    const scale = Math.max(1, dist(A, B), dist(B, C), dist(C, D), dist(D, A),
      dist(A, C), dist(B, D));
    const tol = 1e-7 * scale;
    const vectorAngle = (u, v) => {
      const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
      return n > 0 ? Math.abs(dot(u, v)) / n : 0;
    };
    const angleError = (a, b, c) => {
      const u = sub(b, a), v = sub(c, a);
      const lu = Math.hypot(u.x, u.y), lv = Math.hypot(v.x, v.y);
      // A foot can coincide with a diameter endpoint; then there is no angle
      // to measure and the floating-point direction of a zero vector is junk.
      return lu * lv <= tol * tol ? 0 : Math.abs(dot(u, v)) / (lu * lv);
    };

    // The page's claims, measured rather than assumed.
    const orthogonal = vectorAngle(sub(C, A), sub(D, B)) <= 1e-9;
    const rectSide = angleError(Q, P, R) <= 1e-9;
    const rectOther = angleError(R, Q, S) <= 1e-9;
    const rectangle = rectSide && rectOther
      && Math.abs(dist(P, Q) - dist(S, R)) <= tol
      && Math.abs(dist(Q, R) - dist(P, S)) <= tol;

    const centre = point((A.x + B.x + C.x + D.x) / 4, (A.y + B.y + C.y + D.y) / 4);
    const centroid = dist(K, centre) <= tol;
    const midPR = midpoint(P, R), midQS = midpoint(Q, S);
    const diameters = dist(K, midPR) <= tol && dist(K, midQS) <= tol
      && Math.abs(dist(P, R) - dist(Q, S)) <= tol;

    const mids = [P, Q, R, S];
    const feet = [E, F, G, H];
    const midErrors = mids.map((p) => Math.abs(dist(K, p) - radius));
    const feetErrors = feet.map((p) => Math.abs(dist(K, p) - radius));
    const midpointsOnCircle = midErrors.every((e) => e <= tol);
    const feetOnCircle = feetErrors.every((e) => e <= tol);

    // Any point of a circle sees a diameter at a right angle. Both PR and QS
    // are diameters, so each foot must see both of them at 90 degrees.
    const rightAnglePairs = [
      [E, P, R], [E, Q, S], [F, P, R], [F, Q, S],
      [G, P, R], [G, Q, S], [H, P, R], [H, Q, S],
    ];
    const angleErrors = rightAnglePairs.map(([p, u, v]) => angleError(p, u, v));
    const rightAngles = angleErrors.every((e) => e <= 1e-8);

    const claims = {
      orthogonal: orthogonal,
      rectangle: rectangle,
      centroid: centroid,
      diameters: diameters,
      midpointsOnCircle: midpointsOnCircle,
      feetOnCircle: feetOnCircle,
      rightAngles: rightAngles,
      allEight: midpointsOnCircle && feetOnCircle,
    };
    const measures = {
      centreError: dist(K, centre),
      diameterError: Math.abs(dist(P, R) - dist(Q, S)),
      midError: Math.max(...midErrors),
      footError: Math.max(...feetErrors),
      angleError: Math.max(...angleErrors),
    };
    const diagonals = [[A, C], [B, D]];
    const sides = [[A, B], [B, C], [C, D], [D, A]];
    const drops = [[P, E], [Q, F], [R, G], [S, H]];
    const hintLines = [[P, R], [Q, S], [P, Q], [Q, R], [R, S], [S, P]];

    return {
      A: A, B: B, C: C, D: D,
      P: P, Q: Q, R: R, S: S, E: E, F: F, G: G, H: H, K: K,
      radius: radius,
      diagonals: diagonals, sides: sides, drops: drops, hintLines: hintLines,
      claims: claims, measures: measures, tol: tol,
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  /* An illustration: nothing to win, lose or finish. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Drag the corners apart to draw the eight-point circle.";
    let text = g.claims.allEight
      ? "All eight marked points sit on one circle, centred at K."
      : "The eight marked points do not all sit on one circle.";
    if (state.options.diagonals) text += " The diagonals AC and BD cross at right angles.";
    if (state.options.hint) text += " PR and QS are diameters of the rectangle PQRS.";
    if (state.options.labels) text += " The labels name every midpoint and foot.";
    return text;
  }

  return {
    VIEW: VIEW, PAD: PAD,
    point: point, dist: dist, midpoint: midpoint, sub: sub, dot: dot,
    clamp: clamp, foot: foot, intersect: intersect,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, geometry: geometry, result: result, describe: describe,
  };
})();
