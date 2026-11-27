"use strict";

/*
 * DeTemple — the construction from Alexander Bogomolny's applet DeTemple.
 *
 * Drag the four corners of a convex quadrilateral ABCD. The exterior angle
 * bisectors at A,B,C,D meet in E,F,G,H, which lie on one circle. Drop the
 * perpendiculars from E,F,G,H to AB,BC,CD,DA: they meet in P,Q,R,S, and the
 * circle inscribed in PQRS has the same centre as the circle through EFGH.
 *
 * Every formula here follows the applet's own bytecode: GeoSDoub.ComputeAngle,
 * FindOrientation, Rotate, Intersect (including its |det| < 1 NaN fallback),
 * FindCircumcenter, NearestPoint, and DeTempleCanvas.Compute / GetBisector /
 * GetPerp / GetSmallRadius / UpdateCenter.  The radius of the big circle is
 * the mean of the three centre-to-point distances, not an exact circumradius.
 *
 * No document, no window, no storage: one global, position as plain data.
 */
const DetempleCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 250 };
  const PAD = 14;
  const P = (x, y) => ({ x: x, y: y });

  /* ------------------------------------------------- the applet's arithmetic */

  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** GeoSDoub.FindOrientation: sign of the cross product (a→b) × (a→c). */
  function orientation(a, b, c) {
    const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: rotate q about p; a negative sign flips the turn. */
  function rotate(p, q, angle, sign) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return P(
      p.x + cs * (q.x - p.x) - sign * sn * (q.y - p.y),
      p.y + sign * sn * (q.x - p.x) + cs * (q.y - p.y),
    );
  }

  /** GeoSDoub.ComputeAngle: the angle at a, with no acos clamping. */
  function angle(a, b, c) {
    const cos = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c))
      / (2 * dist(a, b) * dist(a, c));
    return Math.acos(cos);
  }

  /** GeoSDoub.Intersect: null where the bytecode would return NaN,NaN. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1 || !Number.isFinite(det)) return null;
    const p = P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
    return Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  }

  /** GeoSDoub.NearestPoint(p,a,b): projection of p onto line a-b. */
  function nearest(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sqDist(a, p) < 0.1) return p;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return P(a.x + t * dx, a.y + t * dy);
  }

  /* ------------------------------------------------ the canvas's own helpers */

  /** GetBisector: the EXTERIOR bisector at p of the rays p→q and p→r. */
  function exteriorBisector(p, q, r) {
    // The second ray is reversed: r reflected in p.
    const mirror = P(2 * p.x - r.x, 2 * p.y - r.y);
    const hit = intersect(p, rotate(p, q, angle(p, q, mirror) / 2, orientation(p, q, mirror)), q, mirror);
    return hit ? { a: p, b: hit } : null;
  }

  /** GetPerp: the line through x perpendicular to p-q, with its foot. */
  function perpLine(x, p, q) {
    return { a: x, b: nearest(x, p, q) };
  }

  /*
   * GetCircumcircle: FindCircumcenter(E,F,G) and the mean of the three
   * distances to it (the applet's deliberate radius choice).
   */
  function circle(a, b, c) {
    const ab = mid(a, b), bc = mid(b, c);
    const centre = intersect(
      ab, P(ab.x + b.y - a.y, ab.y + a.x - b.x),
      bc, P(bc.x + c.y - b.y, bc.y + b.x - c.x),
    );
    if (!centre) return null;
    return { c: centre, r: (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3 };
  }

  /* GetSmallRadius: the mean of thefour centre-to-foot distances. */
  function smallRadius(big, P1, Q1, R1, S1) {
    const o = big.c;
    const t = nearest(P1, o, Q1), u = nearest(Q1, o, R1);
    const v = nearest(R1, o, S1), w = nearest(S1, o, P1);
    return (dist(t, o) + dist(u, o) + dist(v, o) + dist(w, o)) / 4;
  }

  const lineDistance = (p, a, b) => {
    const n = dist(a, b);
    return n > 0 ? Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / n : dist(p, a);
  };
  const onLine = (p, a, b, tol) => lineDistance(p, a, b) <= tol;
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /* ------------------------------------------------------------ the position */

  /** The applet's init() on its optimal 400x250 canvas. */
  function start(options) {
    const o = options || {};
    const cx = VIEW.width / 2, cy = VIEW.height / 2 - 20;
    const sc = Math.min(VIEW.width, VIEW.height) / 4;
    return {
      A: P(cx + sc * Math.cos(0.1), cy + sc * Math.sin(0.1)),
      B: P(cx + 1.1 * sc * Math.cos(5.235987755982989), cy + 1.1 * sc * Math.sin(5.235987755982989)),
      C: P(cx + sc * Math.cos(4.1887902047863905), cy + sc * Math.sin(4.1887902047863905)),
      D: P(cx + 1.2 * sc * Math.cos(1.727875959474386) - 50, cy + 1.2 * sc * Math.sin(1.727875959474386)),
      options: {
        names: o.names === undefined ? false : !!o.names,
        hint1: o.hint1 === undefined ? false : !!o.hint1,
        hint2: o.hint2 === undefined ? false : !!o.hint2,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function clamp(p) {
    return P(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  function move(state, name, p) {
    if (!["A", "B", "C", "D"].includes(name) || !finite(p)) return state;
    return Object.assign({}, state, { [name]: clamp(P(p.x, p.y)), explored: true });
  }

  function setOption(state, name, on) {
    if (!Object.prototype.hasOwnProperty.call(state.options, name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /* This is an illustration: no win, no loss, no finishing move. */
  function result() {
    return null;
  }

  /* ------------------------------------------------------------ the geometry */

  /** Every point of the drawing, from the four corners. */
  function compute(a, b, c, d) {
    if (![a, b, c, d].every(finite)) return null;
    if (dist(a, b) < 1e-9 || dist(b, c) < 1e-9 || dist(c, d) < 1e-9 || dist(d, a) < 1e-9) return null;

    const bisA = exteriorBisector(a, b, d);
    const bisB = exteriorBisector(b, c, a);
    const bisC = exteriorBisector(c, d, b);
    const bisD = exteriorBisector(d, a, c);
    if (!bisA || !bisB || !bisC || !bisD) return null;

    const E = intersect(bisA.a, bisA.b, bisB.a, bisB.b);
    const F = intersect(bisB.a, bisB.b, bisC.a, bisC.b);
    const G = intersect(bisC.a, bisC.b, bisD.a, bisD.b);
    const H = intersect(bisD.a, bisD.b, bisA.a, bisA.b);
    if (![E, F, G, H].every(finite)) return null;

    const big = circle(E, F, G);
    if (!big || !Number.isFinite(big.r)) return null;

    const perpE = perpLine(E, a, b), perpF = perpLine(F, b, c);
    const perpG = perpLine(G, c, d), perpH = perpLine(H, d, a);
    const P1 = intersect(perpE.a, perpE.b, perpF.a, perpF.b);
    const Q1 = intersect(perpF.a, perpF.b, perpG.a, perpG.b);
    const R1 = intersect(perpG.a, perpG.b, perpH.a, perpH.b);
    const S1 = intersect(perpH.a, perpH.b, perpE.a, perpE.b);
    if (![P1, Q1, R1, S1].every(finite)) return null;

    const small = { c: big.c, r: smallRadius(big, P1, Q1, R1, S1) };
    // UpdateCenter: the mean of P,Q,R,S, used for the marked centre.
    const centre = P((P1.x + Q1.x + R1.x + S1.x) / 4, (P1.y + Q1.y + R1.y + S1.y) / 4);

    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a),
      dist(a, c), dist(b, d), dist(E, F), dist(F, G));
    const tol = 1e-6 * scale;

    // The page's three observations about EFGH, measured on the drawing.
    const circleError = Math.max(
      Math.abs(dist(E, big.c) - big.r), Math.abs(dist(F, big.c) - big.r),
      Math.abs(dist(G, big.c) - big.r), Math.abs(dist(H, big.c) - big.r),
    );
    const oppositeAngles = angle(E, F, H) + angle(G, F, H);
    const squareAngleE = angle(E, F, H);
    const squareAngleF = angle(F, E, G);
    const sideEF = dist(E, F), sideFG = dist(F, G);

    // The incircle: O equidistant from the four sides of PQRS.
    const sideDistances = [
      lineDistance(big.c, P1, Q1), lineDistance(big.c, Q1, R1),
      lineDistance(big.c, R1, S1), lineDistance(big.c, S1, P1),
    ];
    const inradiusSpread = Math.max(...sideDistances) - Math.min(...sideDistances);
    const tangentialError = Math.abs(dist(P1, Q1) + dist(R1, S1) - dist(Q1, R1) - dist(S1, P1));

    // Perpendicular bisectors of EFGH's sides pass through the common centre.
    const bisectorSpread = Math.max(
      Math.abs(dist(big.c, E) - dist(big.c, F)),
      Math.abs(dist(big.c, F) - dist(big.c, G)),
      Math.abs(dist(big.c, G) - dist(big.c, H)),
      Math.abs(dist(big.c, H) - dist(big.c, E)),
    );

    // A parallelogram has the same midpoint for both diagonals; a rectangle
    // adds a right angle at B.
    const parallelogram = dist(mid(a, c), mid(b, d)) <= tol;
    const rightAtB = Math.abs((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) <= tol * scale;
    const rectangle = parallelogram && rightAtB;
    const degenerate = dist(P1, Q1) <= tol && dist(Q1, R1) <= tol && dist(R1, S1) <= tol;

    const claims = {
      cyclic: circleError <= tol && Math.abs(oppositeAngles - Math.PI) <= 1e-7,
      inscriptible: inradiusSpread <= 1e-5 * scale && tangentialError <= 1e-5 * scale,
      // The applet's blue small circle is a drawing aid using GetSmallRadius;
      // the true incircle of PQRS is at O because O lies on every bisector
      // of EFGH's sides.
      concentric: bisectorSpread <= tol,
      parallelogramIsRectangle: !parallelogram
        || (Math.abs(squareAngleE - Math.PI / 2) <= 1e-7 && Math.abs(squareAngleF - Math.PI / 2) <= 1e-7),
      rectangleIsSquare: !rectangle || (Math.abs(sideEF - sideFG) <= tol
        && Math.abs(squareAngleE - Math.PI / 2) <= 1e-7),
      degenerateAtCentre: !degenerate || dist(P1, big.c) <= tol,
    };

    return {
      A: a, B: b, C: c, D: d,
      E: E, F: F, G: G, H: H,
      P: P1, Q: Q1, R: R1, S: S1,
      bisectors: { A: bisA, B: bisB, C: bisC, D: bisD },
      feet: { E: perpE.b, F: perpF.b, G: perpG.b, H: perpH.b },
      tangency: { P: near(P1, E, F), Q: near(Q1, F, G), R: near(R1, G, H), S: near(S1, H, E) },
      big: big, small: small, centre: centre,
      scale: scale, tol: tol,
      measures: {
        circleError, oppositeAngles, squareAngleE, squareAngleF,
        sideEF, sideFG, inradiusSpread, tangentialError, bisectorSpread,
        sideDistances, smallRadius: small.r,
      },
      claims,
    };
  }

  // The tangency feet on the sides of EFGH, as in the applet's Compute().
  function near(p, a, b) {
    return nearest(p, a, b);
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the four points make a clear quadrilateral.";
    if (g.claims.degenerateAtCentre && dist(g.P, g.Q) <= g.tol) {
      return "EFGH lies on a circle. The four perpendiculars meet at O: PQRS has shrunk to the centre.";
    }
    return "EFGH lies on a circle. PQRS has an incircle with the same centre O.";
  }

  return {
    VIEW, PAD, P, sqDist, dist, mid, orientation, rotate, angle, intersect,
    nearest, exteriorBisector, perpLine, circle, smallRadius, lineDistance,
    clamp, start, reset, move, setOption, result, compute, geometry, describe,
  };
})();
