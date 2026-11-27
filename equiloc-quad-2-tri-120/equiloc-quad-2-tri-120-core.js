"use strict";

/*
 * Equiloc Quad 2Tri 120 — Alexander Bogomolny's applet EquilocQuad2Tri120.
 *
 * A, B and the draggable S lie on one circle. C slides on the line from B to
 * S and D on the line from A to S, both at the same signed distance from B
 * and A, so AD = BC: ABCD is "antiequilic". On the arc where angle ASB is
 * 120 degrees, rotating C about A by +60 degrees and D about B by -60
 * degrees gives the same point, and that point lies on the bisector of angle
 * ASB. The page calls AD and BC the "opposite diagonals" of the shape; in
 * the quadrilateral ABCD they are opposite sides meeting at S.
 *
 * This file is geometry and state only: no document, no window, no storage.
 * It defines one global, EquilocQuad2Tri120Core, so a page loads it with a
 * plain <script> and porting/check-equiloc-quad-2-tri-120.mjs loads it in
 * Node. Every point is plain data in the SVG's 400 by 300 viewBox and every
 * function returns a new state rather than changing the one it was given.
 */

const EquilocQuad2Tri120Core = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 12;
  const TAU = 2 * Math.PI;
  const SIXTY = Math.PI / 3;
  /* Applet init(): centre (w/2, 11h/20), radius min(w,h)/2.7. */
  const CIRCLE = { c: { x: VIEW.width / 2, y: (11 * VIEW.height) / 20 },
    r: Math.min(VIEW.width, VIEW.height) / 2.7 };
  /* Bytecode angles on that circle: -5pi/6, -pi/6, -11pi/21. */
  const A_ANGLE = (-5 * Math.PI) / 6;
  const B_ANGLE = -Math.PI / 6;
  const S_ANGLE = (-11 * Math.PI) / 21;
  /* Applet T: circle centre plus one radius in the y direction. */
  const T = { x: CIRCLE.c.x, y: CIRCLE.c.y + CIRCLE.r };

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const unit = (p) => {
    const n = Math.hypot(p.x, p.y);
    return n > 0 ? point(p.x / n, p.y / n) : point(NaN, NaN);
  };
  const clamp = (p) => point(
    Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
    Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
  );

  /** Applet FromCircle: centre + radius (cos angle, sin angle). */
  function fromCircle(angle) {
    return point(CIRCLE.c.x + CIRCLE.r * Math.cos(angle),
      CIRCLE.c.y + CIRCLE.r * Math.sin(angle));
  }

  /** Applet LocatePoint: walk `length` from p towards q (negative = away). */
  function locate(length, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const n = Math.hypot(dx, dy);
    if (!(n > 0)) return point(NaN, NaN);
    return point(p.x + (length * dx) / n, p.y + (length * dy) / n);
  }

  /** GeoSDoub.Rotate, with the applet's orientation multiplier. */
  function rotate(centre, p, angle, orientation) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return point(
      centre.x + cs * (p.x - centre.x) - orientation * sn * (p.y - centre.y),
      centre.y + orientation * sn * (p.x - centre.x) + cs * (p.y - centre.y),
    );
  }

  /** InsideTest.IsInside(a,b,c): true when the angle at a is at least 90°. */
  function inside(a, b, c) {
    return dot(sub(a, b), sub(a, c)) <= 0;
  }

  /** GeoSDoub.NearestPoint(p,a,b), including its 0.1 squared-distance guard. */
  function nearestOnLine(p, a, b) {
    if (dot(sub(p, a), sub(p, a)) < 0.1) return point(p.x, p.y);
    const dx = b.x - a.x, dy = b.y - a.y;
    const n2 = dx * dx + dy * dy;
    if (!(n2 > 0)) return point(p.x, p.y);
    const t = dot(sub(p, a), point(dx, dy)) / n2;
    return point(a.x + t * dx, a.y + t * dy);
  }

  /** Keep a dragged S on the circle, exactly as RestrictToCircle does. */
  function onCircle(p) {
    const n = dist(p, CIRCLE.c);
    if (!(n > 0)) return null;
    const k = CIRCLE.r / n;
    return point(CIRCLE.c.x + (p.x - CIRCLE.c.x) * k,
      CIRCLE.c.y + (p.y - CIRCLE.c.y) * k);
  }

  /** GeoSDoub.Intersect of two lines; NaN,NaN when |det| < 1 as in bytecode. */
  function intersect(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return point(NaN, NaN);
    return point((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det);
  }

  function side(a, b, p) {
    const v = cross(sub(b, a), sub(p, a));
    return v > 0 ? 1 : v < 0 ? -1 : 0;
  }

  /** The position a new diagram starts from (the applet's init()). */
  function start(options) {
    const o = options || {};
    const A = fromCircle(A_ANGLE), B = fromCircle(B_ANGLE), S = fromCircle(S_ANGLE);
    const length = Math.min(dist(A, S), dist(B, S)) / 2;
    return {
      A, B, S, T: point(T.x, T.y),
      C: locate(length, B, S), D: locate(length, A, S),
      length,
      circle: { c: point(CIRCLE.c.x, CIRCLE.c.y), r: CIRCLE.r },
      options: {
        names: o.names === undefined ? true : !!o.names,
        construction: o.construction === undefined ? false : !!o.construction,
        hint: o.hint === undefined ? false : !!o.hint,
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
   * Move one of the three draggable points. S stays on the circle; C and D
   * slide on the two secants. Dragging C or D also sets the signed common
   * length used for both, just as UpgradeDistance() does.
   */
  function move(state, name, p) {
    if (!p || !finite(p) || (name !== "S" && name !== "C" && name !== "D")) return state;
    if (name === "S") {
      const s = onCircle(p);
      if (!s || !finite(s)) return state;
      /* Within a unit of A or B the secant collapses and the applet's
       * LocatePoint divides by (almost) zero; keep the last good picture. */
      if (dist(s, state.A) < 1 || dist(s, state.B) < 1) return state;
      return Object.assign({}, state, {
        S: s,
        C: locate(state.length, state.B, s),
        D: locate(state.length, state.A, s),
        explored: true,
      });
    }
    if (name === "C") {
      const c = nearestOnLine(p, state.B, state.S);
      if (!finite(c)) return state;
      const signed = (inside(state.B, c, state.S) ? -1 : 1) * dist(state.B, c);
      return Object.assign({}, state, {
        C: c, length: signed,
        D: locate(signed, state.A, state.S),
        explored: true,
      });
    }
    const d = nearestOnLine(p, state.A, state.S);
    if (!finite(d)) return state;
    const signed = (inside(state.A, d, state.S) ? -1 : 1) * dist(state.A, d);
    return Object.assign({}, state, {
      D: d, length: signed,
      C: locate(signed, state.B, state.S),
      explored: true,
    });
  }

  function setOption(state, name, on) {
    if (name !== "names" && name !== "construction" && name !== "hint") return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  function legalMoves() {
    return ["S", "C", "D"];
  }

  /**
   * Applet Compute(): re-adjust C and D, make the two 60-degree rotations
   * (P, R) and the two helper rotations (M, N), and intersect AM with BN.
   */
  function compute(state) {
    const { A, B, S, T: tip } = state;
    if (![A, B, S, state.C, state.D, tip].every(finite)
      || !finite(state.circle.c) || !Number.isFinite(state.circle.r)) return null;
    if (!(state.circle.r > 0)) return null;
    if (dist(state.C, S) < 1 || dist(state.D, S) < 1) return null;
    /* Applet AdjustC/AdjustD run on every repaint. */
    const C = locate(state.length, B, S), D = locate(state.length, A, S);
    const P = rotate(A, C, SIXTY, 1);
    const R = rotate(B, D, SIXTY, -1);
    const M = rotate(A, D, SIXTY, 1);
    const N = rotate(B, C, SIXTY, -1);
    const K = intersect(A, M, B, N);
    if (![C, D, P, R, M, N].every(finite)) return null;

    const scale = Math.max(1, dist(A, B), dist(A, C), dist(B, D),
      dist(P, R) || 1, dist(S, tip));
    const tol = 1e-9 * scale;
    const equi = (x, y, z) => Math.max(Math.abs(dist(x, y) - dist(x, z)),
      Math.abs(dist(y, z) - dist(x, y)));

    /* Internal bisector of angle ASB: the sum of the two unit rays. */
    const u = unit(sub(A, S)), v = unit(sub(B, S));
    const bis = add(u, v);
    const bisLen = Math.hypot(bis.x, bis.y);
    const sp = sub(P, S);
    const bisError = bisLen > 0 ? Math.abs(cross(bis, sp)) / bisLen : Infinity;
    const bisProjection = bisLen > 0 ? dot(bis, sp) / bisLen : -Infinity;

    const ua = sub(A, S), ub = sub(B, S);
    const cosASB = dot(ua, ub) / (Math.hypot(ua.x, ua.y) * Math.hypot(ub.x, ub.y));
    const asbAngle = (Math.acos(Math.max(-1, Math.min(1, cosASB))) * 180) / Math.PI;
    const ac = sub(C, A), db = sub(B, D);
    const cosDiag = dot(ac, db) / (Math.hypot(ac.x, ac.y) * Math.hypot(db.x, db.y));
    const diagAngle = (Math.acos(Math.max(-1, Math.min(1, cosDiag))) * 180) / Math.PI;

    const measures = {
      prError: dist(P, R),
      bisError, bisProjection,
      acpError: equi(A, C, P),
      dbrError: equi(B, D, R),
      admError: equi(A, D, M),
      bcnError: equi(B, C, N),
      abtError: equi(A, B, tip),
      adbcError: Math.abs(dist(A, D) - dist(B, C)),
      asbAngle, diagAngle,
    };
    const claims = {
      apexesCoincide: measures.prError <= tol,
      onBisector: measures.bisError <= tol && measures.bisProjection > 0,
      equilateralACP: measures.acpError <= tol,
      equilateralDBR: measures.dbrError <= tol,
      equilateralADM: measures.admError <= tol,
      equilateralBCN: measures.bcnError <= tol,
      equilateralABT: measures.abtError <= tol,
      adEqualsBC: measures.adbcError <= tol,
      asbIs120: Math.abs(asbAngle - 120) < 1e-6,
      towardsAB: side(A, C, P) === side(A, C, B)
        && side(B, D, R) === side(B, D, A),
    };

    return {
      A, B, C, D, S, T: tip, P, R, M, N, K,
      circle: state.circle, measures, claims,
      /* ShowNames drops the R label once the two tips are this far apart. */
      showR: dist(P, R) <= 10,
    };
  }

  function geometry(state) {
    return compute(state);
  }

  /* This is a picture, not a game: there is nothing to win or lose. */
  function result() {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move S, C or D so the two sloping lines stay apart.";
    if (g.claims.apexesCoincide && g.claims.onBisector) {
      return `P and R meet at one point on the blue S–T line (angle ASB is ${g.measures.asbAngle.toFixed(1)}°).`;
    }
    return `P and R are ${g.measures.prError.toFixed(1)} units apart: with S on this arc angle ASB is ${g.measures.asbAngle.toFixed(1)}°, so the two tips no longer meet.`;
  }

  return {
    VIEW, PAD, CIRCLE, A_ANGLE, B_ANGLE, S_ANGLE, TAU, SIXTY, T,
    point, add, sub, mul, dot, cross, dist, finite, unit, clamp,
    fromCircle, locate, rotate, inside, nearestOnLine, onCircle, intersect, side,
    start, reset, move, setOption, legalMoves, compute, geometry,
    result, describe,
  };
})();
