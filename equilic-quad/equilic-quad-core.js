"use strict";

/*
 * Equilic Quad — Alexander Bogomolny's applet EquilicQuad.
 *
 * A, B and S lie on one circle. C is on the line from B towards S and D on
 * the line from A towards S, both at the same distance from B and A. The
 * lines AD and BC therefore meet at S at 60 degrees: ABCD is equilic. The
 * applet builds the equilateral triangles ACP, DCQ and DBR by three 60-degree
 * rotations of the same handedness, and the page claims that their apexes
 * P, Q, R (and S) are collinear.
 *
 * This file is geometry and state only: no document, no window, no storage.
 * It defines one global, EquilicQuadCore, so a page loads it with a plain
 * <script> and porting/check-equilic-quad.mjs loads it in Node. Every point is
 * plain data in the SVG's 400 by 300 viewBox, and every function returns a new
 * state rather than changing the one it was given.
 */

const EquilicQuadCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 12;
  const TAU = 2 * Math.PI;
  const SIXTY = Math.PI / 3;
  /* applet init(): centre (w/2, 11h/20), radius min(w,h)/2.7. */
  const CIRCLE = { c: { x: VIEW.width / 2, y: (11 * VIEW.height) / 20 },
    r: Math.min(VIEW.width, VIEW.height) / 2.7 };
  const A_ANGLE = (5 * Math.PI) / 6;
  const B_ANGLE = Math.PI / 6;
  const S_ANGLE = (20 * Math.PI) / 11; // 327 3/11 degrees, as in the bytecode

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
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

  /** GeoSDoub.Rotate with orientation -1, as used in Compute(). */
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
    const t = (dot(sub(p, a), point(dx, dy))) / n2;
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

  /** The position a new diagram starts from (the applet's init()). */
  function start(options) {
    const o = options || {};
    const A = fromCircle(A_ANGLE), B = fromCircle(B_ANGLE), S = fromCircle(S_ANGLE);
    const length = Math.min(dist(A, S), dist(B, S)) / 2;
    return {
      A, B, S,
      C: locate(length, B, S),
      D: locate(length, A, S),
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

  /** The equilateral triangles and the collinear line, from Compute(). */
  function compute(state) {
    const { A, B, S } = state;
    if (![A, B, S, state.C, state.D].every(finite)
      || !finite(state.circle.c) || !Number.isFinite(state.circle.r)) return null;
    if (!(state.circle.r > 0)) return null;
    if (dist(state.C, S) < 1 || dist(state.D, S) < 1) return null;
    /* Applet AdjustC/AdjustD run on every repaint; repeat them here. */
    const C = locate(state.length, B, S), D = locate(state.length, A, S);
    if (!finite(C) || !finite(D)) return null;
    const P = rotate(A, C, SIXTY, -1);
    const Q = rotate(D, C, SIXTY, -1);
    const R = rotate(D, B, SIXTY, -1);
    if (![P, Q, R].every(finite)) return null;

    const scale = Math.max(1, dist(A, B), dist(A, C), dist(B, D),
      dist(C, D), dist(P, Q) || 1, dist(Q, R) || 1);
    const tol = 1e-9 * scale;
    const lineError = (p) =>
      Math.abs(cross(sub(Q, P), sub(p, P))) / (dist(P, Q) || 1);
    const measures = {
      pqrError: Math.abs(cross(sub(Q, P), sub(R, P))) / (dist(P, Q) || 1),
      sError: lineError(S),
      aqbError: Math.max(Math.abs(dist(A, Q) - dist(A, B)),
        Math.abs(dist(B, Q) - dist(A, B))),
      acpError: Math.max(Math.abs(dist(A, P) - dist(A, C)),
        Math.abs(dist(C, P) - dist(A, C))),
      dcqError: Math.max(Math.abs(dist(D, Q) - dist(D, C)),
        Math.abs(dist(C, Q) - dist(D, C))),
      dbrError: Math.max(Math.abs(dist(D, R) - dist(D, B)),
        Math.abs(dist(B, R) - dist(D, B))),
      pqError: Math.abs(dist(P, Q) - dist(B, C)),
      qrError: Math.abs(dist(Q, R) - dist(A, D)),
      adbcError: Math.abs(dist(A, D) - dist(B, C)),
    };
    const claims = {
      collinearPQR: measures.pqrError <= tol,
      collinearS: measures.sError <= tol,
      equilateralAQB: measures.aqbError <= tol,
      equilateralACP: measures.acpError <= tol,
      equilateralDCQ: measures.dcqError <= tol,
      equilateralDBR: measures.dbrError <= tol,
      pqEqualsBC: measures.pqError <= tol,
      qrEqualsAD: measures.qrError <= tol,
      adEqualsBC: measures.adbcError <= tol,
      /* The page says "away from AB": true when C and D lie on the segments
       * from B and A to S and S is on the arc opposite the chord AB. */
      awayFromAB: state.length > 0 && state.length < dist(B, S)
        && state.length < dist(A, S)
        && side(A, C, P) === -side(A, C, B)
        && side(D, C, Q) === -side(D, C, A)
        && side(D, B, R) === -side(D, B, A),
    };

    /* Applet DrawLine(g,P,R,S): extend whichever end puts S on the line. */
    let extended = null;
    if (inside(S, R, P)) extended = [P, S];
    else if (inside(P, R, S)) extended = [P, R];
    else if (inside(R, P, S)) extended = [P, S];

    return {
      A, B, C, D, S, P, Q, R, circle: state.circle,
      measures, claims, extended,
    };
  }

  function side(a, b, p) {
    const v = cross(sub(b, a), sub(p, a));
    return v > 0 ? 1 : v < 0 ? -1 : 0;
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
    if (!g) return "Move S, C or D so the three drawn points stay apart from S.";
    const line = `P, Q, R and S lie on one straight line (off by ${g.measures.sError.toFixed(2)} in the drawing).`;
    const proof = g.claims.equilateralAQB
      ? " Triangle AQB is equilateral, as in the article's proof."
      : " S is on the other arc, so the proof's triangle AQB is not equilateral, but the line still holds.";
    return line + proof;
  }

  return {
    VIEW, PAD, CIRCLE, A_ANGLE, B_ANGLE, S_ANGLE, TAU, SIXTY,
    point, add, sub, mul, dot, cross, dist, finite, clamp,
    fromCircle, locate, rotate, inside, nearestOnLine, onCircle, side,
    start, reset, move, setOption, legalMoves, compute, geometry,
    result, describe,
  };
})();
