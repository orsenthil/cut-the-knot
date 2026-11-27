"use strict";

/*
 * Equilic Quadrilateral I, A Variation — Alexander Bogomolny's applet
 * EquilocQuad1Tri. A and B are fixed on a circle; S, C and D can be dragged.
 * C and D are placed on the lines from B and A towards S at the same distance
 * from B and A, so AD = BC whatever the angle at S. Q is the apex of the
 * isosceles triangle on CD whose angle at Q equals the angle BSA.
 *
 * The cut-the-knot page says "Then S is the midpoint of the arc of the
 * circumcircle of ABS containing S." Read literally that says AS = BS, which
 * is false in the starting picture. The applet's construction, and the valid
 * proof linked from the original equilic page, put Q — not S — at the middle
 * of that arc. The true claim holds whenever the applet picks the apex on the
 * side away from AB; with its fixed handedness that is the side of AB where
 * the starting S lies. The logic test records both facts over thousands of
 * positions.
 *
 * This file is geometry and state only: no document, no window, no storage.
 * It defines one global, EquilocQuad1TriCore, so a page loads it with a plain
 * <script> and porting/check-equiloc-quad-1-tri.mjs loads it in Node. All
 * positions are plain objects in the SVG viewBox units. The arithmetic below
 * follows the bytecode: FromCircle, LocatePoint, NearestPoint, InsideTest,
 * ComputeAngle, FindCircumcenter/Intersect, IsoscelesApex, GetCircle,
 * AdjustC/AdjustD and Compute.
 */

const EquilocQuad1TriCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 12;                       // only a presentation clamp for handles
  const CIRCLE = {
    c: { x: VIEW.width / 2, y: (11 * VIEW.height) / 20 },
    r: Math.min(VIEW.width, VIEW.height) / 2.7,
  };
  /* init(): 2.6179938779914944 = 5*pi/6, 0.5235987755982988 = pi/6,
   * 5.711986642890533 = 20*pi/11. */
  const A_ANGLE = 2.6179938779914944;
  const B_ANGLE = 0.5235987755982988;
  const S_ANGLE = 5.711986642890533;
  const ANGLE_GUARD = 0.1;              // Compute(): skip Q at a tiny angle
  const APEX_MIN_DIST = 1;              // IsoscelesApex(): null if CD < 1

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (p) => point(
    Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
    Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
  );

  /** FromCircle(circle, angle): centre + radius * (cos, sin). */
  function fromCircle(angle, circle) {
    const c = circle || CIRCLE;
    return point(c.c.x + c.r * Math.cos(angle), c.c.y + c.r * Math.sin(angle));
  }

  /** LocatePoint(length, p, q): walk `length` from p towards q (negative = away). */
  function locate(length, p, q) {
    const d = dist(q, p);
    if (!(d > 0)) return point(NaN, NaN);
    return point(p.x + ((q.x - p.x) * length) / d,
      p.y + ((q.y - p.y) * length) / d);
  }

  /** GeoSDoub.NearestPoint(p, a, b): projection onto the whole line a-b. */
  function nearestOnLine(p, a, b) {
    if (sqDist(p, a) < 0.1) return point(p.x, p.y);
    const dx = b.x - a.x, dy = b.y - a.y;
    const n2 = dx * dx + dy * dy;
    if (!(n2 > 0)) return point(p.x, p.y);
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / n2;
    return point(a.x + t * dx, a.y + t * dy);
  }

  /** InsideTest.IsInside(a,b,c): (a-b).(a-c) <= 0. */
  function inside(a, b, c) {
    return dot(sub(a, b), sub(a, c)) <= 0;
  }

  /** GeoSDoub.ComputeAngle(p,q,r): unsigned acos of the law-of-cosines value. */
  function computeAngle(p, q, r) {
    const v = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) /
      (2 * dist(p, q) * dist(p, r));
    return Math.acos(v);
  }

  /** GeoSDoub.Intersect: the two lines p-u and q-v, NaN when |det| < 1. */
  function intersect(p, u, q, v) {
    const a1 = p.y - u.y, b1 = u.x - p.x, c1 = p.x * u.y - p.y * u.x;
    const a2 = q.y - v.y, b2 = v.x - q.x, c2 = q.x * v.y - q.y * v.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /** GeoSDoub.FindCircumcenter(a,b,c), then the perpendicular-bisector lines. */
  function findCircumcenter(a, b, c) {
    const mid1 = point((a.x + b.x) / 2, (a.y + b.y) / 2);
    const mid2 = point((b.x + c.x) / 2, (b.y + c.y) / 2);
    const u = point(mid1.x + b.y - a.y, mid1.y - b.x + a.x);
    const v = point(mid2.x + c.y - b.y, mid2.y - c.x + b.x);
    return intersect(mid1, u, mid2, v);
  }

  /** GetCircle(a,b,s): GetRadius is the average of the three distances. */
  function getCircle(a, b, s) {
    const c = findCircumcenter(a, b, s);
    return { c, r: (dist(c, a) + dist(c, b) + dist(c, s)) / 3 };
  }

  /** IsoscelesApex(p,q,angle), bytecode verbatim (the guard uses Dist < 1). */
  function isoscelesApex(p, q, angle) {
    if (dist(p, q) < APEX_MIN_DIST) return null;
    const m = point((p.x + q.x) / 2, (p.y + q.y) / 2);
    const perp = point(p.y - m.y, m.x - p.x);
    const t = Math.tan(angle / 2);
    return point(m.x - perp.x / t, m.y - perp.y / t);
  }

  /** FindCircumcenter-based arc midpoint, independently of Q. */
  function arcMidpoint(a, b, s) {
    const c = findCircumcenter(a, b, s);
    const r = dist(c, a);
    const chord = sub(b, a);
    const len = Math.hypot(chord.x, chord.y);
    if (!(len > 0)) return null;
    const n = point(-chord.y / len, chord.x / len);
    const first = add(c, mul(n, r));
    const second = sub(c, mul(n, r));
    const sideOf = (p) => cross(sub(b, a), sub(p, a));
    return sideOf(first) * sideOf(s) >= 0 ? first : second;
  }

  /** The position a new diagram starts from (the applet's init()). */
  function start(options) {
    const o = options || {};
    const A = fromCircle(A_ANGLE), B = fromCircle(B_ANGLE), S = fromCircle(S_ANGLE);
    const length = Math.min(dist(A, S), dist(B, S)) / 2;
    const C = locate(length, B, S), D = locate(length, A, S);
    return {
      A, B, S, C, D, length,
      options: {
        names: o.names === undefined ? true : !!o.names,
        construction: !!o.construction,
        hint: !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  /**
   * Drag one of the three handles. S is free; C slides on the line B-S and
   * D on A-S, and a C or D drag resets the signed common length exactly as
   * UpgradeDistance() does. A drag that would collapse a secant is refused.
   */
  function move(state, name, p) {
    if ((name !== "S" && name !== "C" && name !== "D") || !finite(p)) return state;
    const { A, B, S } = state;
    if (dist(S, A) < 1 || dist(S, B) < 1) return state;
    if (name === "S") {
      if (dist(p, A) < 1 || dist(p, B) < 1) return state;
      return Object.assign({}, state, {
        S: point(p.x, p.y),
        C: locate(state.length, B, p),
        D: locate(state.length, A, p),
        explored: true,
      });
    }
    if (name === "C") {
      const c = nearestOnLine(p, B, S);
      const signed = (inside(B, c, S) ? -1 : 1) * dist(B, c);
      return Object.assign({}, state, {
        C: c, length: signed,
        D: locate(signed, A, S),
        explored: true,
      });
    }
    const d = nearestOnLine(p, A, S);
    const signed = (inside(A, d, S) ? -1 : 1) * dist(A, d);
    return Object.assign({}, state, {
      D: d, length: signed,
      C: locate(signed, B, S),
      explored: true,
    });
  }

  function legalMoves() {
    return ["S", "C", "D"];
  }

  function setOption(state, name, on) {
    if (name !== "names" && name !== "construction" && name !== "hint") return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** One repaint: Compute() plus the arc and congruence measurements. */
  function compute(state) {
    const { A, B, S } = state;
    if (![A, B, S].every(finite) || !Number.isFinite(state.length)) return null;
    if (dist(S, A) < 1 || dist(S, B) < 1) return null;
    const circle = getCircle(A, B, S);
    if (!finite(circle.c) || !Number.isFinite(circle.r)) return null;
    /* AdjustC/AdjustD run on every repaint, even after a free S drag. */
    const C = locate(state.length, B, S), D = locate(state.length, A, S);
    if (![C, D].every(finite)) return null;
    const angle = computeAngle(S, A, B);
    if (!Number.isFinite(angle)) return null;
    const Q = Math.abs(angle) > ANGLE_GUARD ? isoscelesApex(D, C, angle) : null;
    /* -angle flips tan(angle/2), giving the other isosceles apex. */
    const otherQ = Math.abs(angle) > ANGLE_GUARD
      ? isoscelesApex(D, C, -angle) : null;
    const arc = arcMidpoint(A, B, S);
    if (!finite(arc)) return null;

    const scale = Math.max(1, dist(A, B), dist(A, S), dist(B, S),
      dist(A, D), dist(B, C), dist(C, D), circle.r);
    const tol = 1e-8 * scale;
    const angleAtQ = Q ? computeAngle(Q, C, D) : NaN;
    const measures = {
      adbcError: Math.abs(dist(A, D) - dist(B, C)),
      apexAngleError: Q ? Math.abs(angleAtQ - angle) : NaN,
      arcError: Q ? dist(Q, arc) : NaN,
      otherArcError: otherQ ? dist(otherQ, arc) : NaN,
      qaError: Q ? Math.abs(dist(Q, A) - dist(Q, B)) : NaN,
      sArcError: dist(S, arc),
    };
    const claims = {
      adEqualsBC: measures.adbcError <= tol,
      apexAngleMatches: Q !== null && measures.apexAngleError <= tol,
      qIsArcMidpoint: Q !== null && measures.arcError <= tol,
      otherIsArcMidpoint: otherQ !== null && measures.otherArcError <= tol,
      /* The page's sentence, read literally: S is the arc's midpoint. */
      pageClaimLiteral: measures.sArcError <= tol,
      /* The side of AB on which the applet draws Q (and its starting S). */
      qSameSideAsS: !!Q && cross(sub(B, A), sub(Q, A)) * cross(sub(B, A), sub(S, A)) > 0,
    };
    return {
      A, B, S, C, D, Q, otherQ, arc, circle, angle, length: state.length,
      measures, claims, tol,
    };
  }

  function geometry(state) {
    return compute(state);
  }

  /* A picture, not a game: no win, no loss and no finishing move. */
  function result() {
    return null;
  }

  function side(a, b, p) {
    return cross(sub(b, a), sub(p, a));
  }

  /** Short status line: what is true in the picture the player has made. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move S, C or D so the two lines and the triangle stay well defined.";
    if (g.claims.qIsArcMidpoint) {
      let text = "Q is halfway along the arc from A to B that passes through S.";
      if (state.options.hint) text += " The two marked triangles ADQ and BCQ match.";
      return text;
    }
    if (g.Q) {
      return "Q is not on that arc's midpoint here: put S on the starting side of AB to see the page's picture.";
    }
    return "Move S away from A and B to rebuild the isosceles triangle on CD.";
  }

  return {
    VIEW, PAD, CIRCLE, A_ANGLE, B_ANGLE, S_ANGLE, ANGLE_GUARD, APEX_MIN_DIST,
    point, add, sub, mul, dot, cross, sqDist, dist, finite, clamp,
    fromCircle, locate, nearestOnLine, inside, computeAngle, intersect,
    findCircumcenter, getCircle, isoscelesApex, arcMidpoint,
    start, reset, move, legalMoves, setOption, compute, geometry,
    result, side, describe,
  };
})();
