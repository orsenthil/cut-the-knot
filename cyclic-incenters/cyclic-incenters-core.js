"use strict";

/*
 * Cyclic Incenters — Alexander Bogomolny's applet CyclicIncenters, from the
 * cut-the-knot article by Darij Grinberg (after a conjecture by Christopher
 * Bradley).  Four points on a circle give four tangents; the tangents meet in
 * a quadrilateral that has the circle as its incircle.  Where its diagonals
 * cross, the four triangles have incenters X, Y, Z, W.  Bradley's claim is
 * that X, Y, Z, W always lie on one circle.
 *
 * The idea behind the code: every object is built from intersections of
 * lines, and an incenter is the intersection of two internal angle bisectors.
 * The circumcircle through X, Y, Z is then compared with W, for as many
 * configurations as the logic test cares to try.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, CyclicIncentersCore, so the page loads it
 * with a plain <script> and the logic test can load it in Node.  Positions
 * and results are plain data in the SVG's viewBox units.
 */

const CyclicIncentersCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 250 };
  const CENTER = { x: 200, y: 125 };
  // The applet uses min(width, height) / 4: 250 / 4 = 62.5 on its canvas.
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 4;
  // init(): A at 0, B at 1.2, C at 2.9, D at 4.5 radians, with the
  // canvas y axis pointing down (the last three use centre.y - r sin t).
  const START_ANGLES = [0, 1.2, 2.9, 4.5];
  const POINT_KEYS = ["A", "B", "C", "D"];
  // The applet's sixteen checkboxes, in the panel's order.
  const OPTION_KEYS = [
    "names", "diagonals", "bisectors", "inscribedDiagonals",
    "bigCircles", "smallCircles", "circle", "centerLines",
    "circumcircles", "inscribedPolygon", "addOn", "point",
    "segment", "tangents", "homotheties", "secondIteration",
  ];

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const onCircle = (t) => point(CENTER.x + RADIUS * Math.cos(t), CENTER.y - RADIUS * Math.sin(t));

  function unit(v) {
    const n = Math.hypot(v.x, v.y);
    return n > 0 ? point(v.x / n, v.y / n) : point(0, 0);
  }

  /** GeoSDoub.Intersect of the lines a-b and c-d; null when parallel. */
  function intersect(a, b, c, d) {
    if (![a, b, c, d].every(finite)) return null;
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const den = a1 * b2 - a2 * b1;
    if (!Number.isFinite(den) || Math.abs(den) < 1e-10) return null;
    const q = point((b1 * c2 - b2 * c1) / den, (c1 * a2 - c2 * a1) / den);
    return finite(q) ? q : null;
  }

  /** GeoSDoub.ComputeAngle: the ordinary angle at v, in radians. */
  function angle(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (!n) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / n)));
  }

  /** GeoSDoub.FindOrientation: +1 for a left turn, -1 otherwise. */
  function orientation(a, b, c) {
    return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate: turn b about a through t, with the given orientation. */
  function rotate(a, b, t, o) {
    const cs = Math.cos(t), sn = Math.sin(t);
    return point(
      a.x + cs * (b.x - a.x) - o * sn * (b.y - a.y),
      a.y + o * sn * (b.x - a.x) + cs * (b.y - a.y),
    );
  }

  /** GeoSDoub.FindIncenter: two internal bisectors, then their intersection. */
  function incenter(a, b, c) {
    const o = orientation(a, b, c);
    const r1 = rotate(a, b, angle(a, b, c) / 2, o);
    const r2 = rotate(b, c, angle(b, c, a) / 2, o);
    return intersect(a, r1, b, r2);
  }

  /** GeoSDoub.NearestPoint: the projection of p on the line a-b. */
  function nearestPoint(p, a, b) {
    const v = sub(b, a), n = dot(v, v);
    if (n < 0.1) return p;
    return add(a, mul(v, dot(sub(p, a), v) / n));
  }

  /** GeoSDoub.FindCircumcenter, with the canvas's mean of the three radii. */
  function circumcircle(a, b, c) {
    const m1 = midpoint(a, b), m2 = midpoint(b, c);
    const o = intersect(
      m1, point(m1.x + b.y - a.y, m1.y + a.x - b.x),
      m2, point(m2.x + c.y - b.y, m2.y + b.x - c.x),
    );
    if (!o) return null;
    return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
  }

  /** The canvas's GetIncircle: FindIncenter, then the mean of three feet. */
  function incircle(a, b, c) {
    const I = incenter(a, b, c);
    if (!I) return null;
    const r = (dist(I, nearestPoint(I, a, b))
      + dist(I, nearestPoint(I, b, c))
      + dist(I, nearestPoint(I, c, a))) / 3;
    return { c: I, r };
  }

  /** The canvas's GetTangent(circle, point): a line through p perpendicular
   *  to the radius, stored as two points. */
  function tangent(circle, p) {
    return { a: p, b: point(p.x - (p.y - circle.c.y), p.y + (p.x - circle.c.x)) };
  }

  function tangentIntersections(circle, points) {
    const lines = points.map((p) => tangent(circle, p));
    return {
      lines,
      vertices: lines.map((line, i) => intersect(line.a, line.b,
        lines[(i + 1) % lines.length].a, lines[(i + 1) % lines.length].b)),
    };
  }

  function distanceToLine(p, a, b) {
    const n = dist(a, b);
    return n > 0 ? Math.abs(cross(sub(p, a), sub(b, a))) / n : dist(p, a);
  }

  /** External center of similitude of two circles (the exsimilicenter). */
  function exsimilicenter(c1, c2) {
    if (!c1 || !c2 || Math.abs(c1.r - c2.r) < 1e-10) return null;
    const t = c1.r / (c1.r - c2.r);
    const p = point(c1.c.x + t * (c2.c.x - c1.c.x), c1.c.y + t * (c2.c.y - c1.c.y));
    return finite(p) ? p : null;
  }

  /** Project a dragged point back onto the applet's circle.  The fallback
   *  keeps a keyboard step valid if someone moves onto the centre. */
  function snap(p, fallback) {
    if (!finite(p)) return finite(fallback) ? { x: fallback.x, y: fallback.y } : null;
    const dx = p.x - CENTER.x, dy = p.y - CENTER.y;
    const n = Math.hypot(dx, dy);
    if (n < 1e-9) return finite(fallback) ? { x: fallback.x, y: fallback.y } : null;
    return point(CENTER.x + (dx * RADIUS) / n, CENTER.y + (dy * RADIUS) / n);
  }

  /* The applet's Defaults: the four points above, all checkboxes unchecked. */
  function start(options) {
    const o = options || {};
    const opts = {};
    for (const key of OPTION_KEYS) {
      opts[key] = o[key] === undefined ? false : !!o[key];
    }
    const s = {};
    POINT_KEYS.forEach((key, i) => { s[key] = onCircle(START_ANGLES[i]); });
    s.options = opts;
    s.explored = false;
    return s;
  }

  function reset(state) {
    const s = start(state && state.options);
    if (state) s.explored = !!state.explored;
    return s;
  }

  /** A move is just a new position for one of the four points on the circle. */
  function move(state, name, p) {
    if (!state || !POINT_KEYS.includes(name) || !finite(p)) return state;
    const q = snap(p, state[name]);
    if (!q) return state;
    return Object.assign({}, state, { [name]: q, explored: true });
  }

  function setOption(state, name, on) {
    if (!state || !state.options || !OPTION_KEYS.includes(name)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /* An illustration, not a game: there is no win and no loss. */
  function result(state) {
    return null;
  }

  /**
   * Everything the applet draws, from four points on its circle.  Returns
   * null only for a degenerate configuration (coincident points, parallel
   * tangents or diagonals), where the Java canvas would draw NaNs.
   */
  function compute(A, B, C, D) {
    if (![A, B, C, D].every(finite)) return null;
    if (dist(A, B) < 1e-9 || dist(B, C) < 1e-9 || dist(C, D) < 1e-9 || dist(D, A) < 1e-9) return null;

    // The circle through A, B, C, and the tangents at all four points.
    const main = circumcircle(A, B, C);
    if (!main || !(main.r > 1e-9)) return null;
    const tan = tangentIntersections(main, [A, B, C, D]);
    const [AB, BC, CD, DA] = tan.vertices;
    if (!tan.vertices.every(finite)) return null;

    // P: diagonals of the tangential quadrilateral; Q: diagonals of the
    // quadrilateral inscribed in the circle.  The applet passes Q, found at
    // the end of DrawConfiguration, into Properties().
    const P = intersect(AB, CD, BC, DA);
    const Q = intersect(A, C, B, D);
    if (!P || !Q) return null;

    // The four small incircles, X, Y, Z, W around P.
    const small = [incircle(P, AB, BC), incircle(P, BC, CD),
      incircle(P, CD, DA), incircle(P, DA, AB)];
    if (!small.every((c) => c && finite(c.c) && c.r > 1e-9)) return null;
    const [X, Y, Z, W] = small.map((c) => c.c);

    // Bradley's circle: through X, Y, Z, compared with W.
    const claim = circumcircle(X, Y, Z);
    if (!claim || !(claim.r > 1e-9)) return null;

    // The four big incircles, named as in the applet's u, U, t, T fields.
    const big = [incircle(DA, CD, BC), incircle(DA, AB, BC),
      incircle(AB, CD, BC), incircle(AB, CD, DA)];
    if (!big.every((c) => c && finite(c.c) && c.r > 1e-9)) return null;
    // The applet's ShowPoint: intersection of the centres of (A',C') and
    // (B',D').  It is O', the centre of the circle through X,Y,Z,W.
    const center = intersect(big[1].c, big[0].c, big[3].c, big[2].c);
    // The true exsimilicenters R and Q of the page's Theorems 4 and 15.
    const exsimR = exsimilicenter(big[1], big[0]);
    const exsimQ = exsimilicenter(big[2], big[3]);

    // Circumcircles of a corner and the two adjacent incenters.
    const circum = [circumcircle(AB, W, X), circumcircle(BC, X, Y),
      circumcircle(CD, Y, Z), circumcircle(DA, Z, W)];

    // Tangents to the claim circle at X, Y, Z, W; their intersections start
    // the "Second iteration" construction.
    const secondTan = tangentIntersections(claim, [X, Y, Z, W]);
    let second = null;
    if (secondTan.vertices.every(finite)) {
      const inner = secondTan.vertices.map((v, i) =>
        incircle(Q, v, secondTan.vertices[(i + 1) % 4]));
      if (inner.every((c) => c && finite(c.c) && c.r > 1e-9)) {
        const innerCircle = circumcircle(inner[0].c, inner[1].c, inner[2].c);
        if (innerCircle) {
          second = {
            circles: inner,
            circle: innerCircle,
            error: Math.abs(dist(inner[3].c, innerCircle.c) - innerCircle.r),
          };
        }
      }
    }

    const scale = Math.max(1, dist(AB, CD), dist(BC, DA),
      dist(AB, BC), dist(BC, CD), dist(CD, DA), dist(DA, AB));
    const tol = 1e-6 * scale;
    const circleError = Math.abs(dist(W, claim.c) - claim.r);
    const tangentError = Math.max(...tan.lines.map((line) =>
      Math.abs(distanceToLine(main.c, line.a, line.b) - main.r)));
    const xzError = distanceToLine(P, X, Z);
    const ywError = distanceToLine(P, Y, W);
    const centerError = center ? dist(center, claim.c) : Infinity;
    const diagonalError = dist(P, Q);
    const exsimXY = exsimR ? distanceToLine(exsimR, X, Y) : Infinity;
    const exsimZW = exsimR ? distanceToLine(exsimR, Z, W) : Infinity;
    const exsimYZ = exsimQ ? distanceToLine(exsimQ, Y, Z) : Infinity;
    const exsimWX = exsimQ ? distanceToLine(exsimQ, W, X) : Infinity;
    const powerError = exsimR
      ? Math.abs(dist(exsimR, X) * dist(exsimR, Y) - dist(exsimR, Z) * dist(exsimR, W))
      : Infinity;
    const radiiError = Math.abs(1 / small[0].r + 1 / small[2].r
      - 1 / small[1].r - 1 / small[3].r);

    return {
      A, B, C, D, main, tangents: tan.lines,
      quad: [AB, BC, CD, DA], P, Q,
      small, X, Y, Z, W, claim, big, center, exsimR, exsimQ, circum, second,
      measures: {
        circleError, tangentError, xzError, ywError, centerError,
        diagonalError, exsimXY, exsimZW, exsimYZ, exsimWX,
        powerError, radiiError,
      },
      claims: {
        concyclic: circleError <= tol,
        tangentSides: tangentError <= tol,
        throughP: xzError <= tol && ywError <= tol,
        centerOfCircle: centerError <= tol,
        sameDiagonals: diagonalError <= tol,
        // When two big circles have equal radii the exsimilicenter is at
        // infinity: the lines are parallel and the claim holds there too.
        exsimilicenter: (exsimR ? exsimXY <= tol && exsimZW <= tol : true)
          && (exsimQ ? exsimYZ <= tol && exsimWX <= tol : true),
        power: !exsimR || powerError <= tol * Math.max(1, scale),
        radii: radiiError <= 1e-6,
        secondConcyclic: !second || second.error <= tol,
      },
    };
  }

  function geometry(state) {
    if (!state) return null;
    return compute(state.A, state.B, state.C, state.D);
  }

  /** The status line: say what stayed true and how close W is to the circle. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a point so the four tangents and diagonals meet properly.";
    const e = g.measures.circleError;
    const word = g.claims.concyclic ? "are on one circle" : "are nearly on one circle";
    return `The four incenters X, Y, Z, W ${word} (W is off by ${e.toFixed(4)} in the drawing).`;
  }

  return {
    VIEW, CENTER, RADIUS, START_ANGLES, POINT_KEYS, OPTION_KEYS,
    point, add, sub, mul, dot, cross, dist, midpoint, unit, onCircle,
    finite, angle, orientation, rotate, incenter, nearestPoint,
    intersect, circumcircle, incircle, tangent, tangentIntersections,
    distanceToLine, exsimilicenter, snap,
    start, reset, move, setOption, result, compute, geometry, describe,
  };
})();
