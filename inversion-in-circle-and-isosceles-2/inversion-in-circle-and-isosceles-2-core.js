"use strict";

/*
 * Tangent circles and an isosceles triangle II, from Alexander Bogomolny's
 * applet InversionInCircleAndIsosceles2
 * (cut-the-knot.org/Curriculum/Geometry/InversionInCircleAndIsosceles2.shtml).
 *
 * A, B and C are dragged along one horizontal line, with A < B < C. Circle
 * (O) has diameter AC, circle (P) has diameter AB, and the perpendicular
 * bisector of BC cuts (O) at E and F, so BECF is a rhombus. EB and FB meet
 * (O) again at K and L; the perpendicular at B meets it at M and N. Circle
 * (Q) is tangent to (O), (P) and BE; the claim is that QB is perpendicular
 * to AC. The applet's Compute() builds Q directly from two numbers: with
 * t = AB/AC, the height of Q above AC is AC * t/(1+t) * sqrt(2(1-t)) and
 * its radius is AC * t(1-t)/(1+t). Those two formulas are the key idea here.
 *
 * Unlike the sibling applet (positive-power inversion and a Pythagorean
 * calculation), this solution inverts with negative power -BM^2 = -AB*BC.
 * That inversion fixes (O), swaps A and C, sends (P) to the vertical line
 * through C, and sends (Q) to the excircle (Q') of triangle BI_kI_l opposite
 * I_k. Since (Q') lies on the external bisector at B, BQQ' is perpendicular
 * to AC, proving the claim. The excenter and every other point below follow
 * the bytecode's own order of constructions.
 *
 * No DOM, no storage: the position is plain data (three points and the
 * display options), so it can be saved and given to the tutor as it is.
 */
const InversionInCircleAndIsosceles2Core = (() => {
  /** The SVG's user-unit rectangle; the page's viewBox must match. */
  const VIEW = { width: 400, height: 340 };
  const MARGIN = 12;

  /* The applet's init(): the diameter is min(W,H)/3.5*2 about the centre,
     B sits at centre + min(W,H)/17.5, and the baseline is above the middle
     so that the inverted circle (Q') still fits in the drawing. */
  const SPAN = (2 * Math.min(VIEW.width, VIEW.height)) / 3.5;
  const START = {
    A: { x: VIEW.width / 2 - SPAN / 2, y: 105 },
    B: { x: VIEW.width / 2 + SPAN / 14, y: 105 },
    C: { x: VIEW.width / 2 + SPAN / 2, y: 105 },
  };

  const DEFAULT_OPTIONS = { names: false, premise: false, statement: false, step: 0 };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const pt = (x, y) => ({ x, y });

  function clampToBoard(p) {
    return pt(
      Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    );
  }

  /** Foot of the perpendicular from p to the infinite line a-b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return null;
    const s = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return pt(a.x + dx * s, a.y + dy * s);
  }

  /** Intersection of line(a,b) and line(c,d); null when parallel. */
  function intersect(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const cross = rx * sy - ry * sx;
    if (Math.abs(cross) < 1e-12) return null;
    const u = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
    return pt(a.x + rx * u, a.y + ry * u);
  }

  /** The two points where the infinite line p-q cuts a circle. */
  function circleLine(circle, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (!len) return null;
    const ux = dx / len, uy = dy / len;
    const along = (circle.x - p.x) * ux + (circle.y - p.y) * uy;
    const h2 = circle.r * circle.r -
      ((circle.x - p.x) * (circle.x - p.x) + (circle.y - p.y) * (circle.y - p.y) - along * along);
    if (h2 < 0) return null;
    const h = Math.sqrt(h2);
    return [pt(p.x + ux * (along - h), p.y + uy * (along - h)),
      pt(p.x + ux * (along + h), p.y + uy * (along + h))];
  }

  /** GeoSDoub.Other(): the intersection farther from the given point. */
  function other(points, reference) {
    if (!points) return null;
    return dist(points[0], reference) < dist(points[1], reference) ? points[1] : points[0];
  }

  /** The excenter of triangle U,V,W opposite U (GeoSDoub.FindExcenter). */
  function excenter(U, V, W) {
    const a = dist(V, W), b = dist(W, U), c = dist(U, V);
    const den = -a + b + c;
    if (Math.abs(den) < 1e-12) return null;
    return pt((-a * U.x + b * V.x + c * W.x) / den,
      (-a * U.y + b * V.y + c * W.y) / den);
  }

  /** Radius the applet gives an excircle: the mean of three side distances. */
  function excircleRadius(centre, U, V, W) {
    const ds = [foot(centre, U, V), foot(centre, V, W), foot(centre, W, U)]
      .filter(Boolean).map((f) => dist(centre, f));
    return ds.length === 3 ? ds.reduce((a, b) => a + b, 0) / 3 : null;
  }

  /** ArrangeABC(): sort A and C by x, then keep B between them. */
  function arrange(Ap, Bp, Cp) {
    let A = Ap.x <= Cp.x ? Ap : Cp;
    let C = Ap.x <= Cp.x ? Cp : Ap;
    let B = Bp;
    if (Bp.x < A.x) { B = A; A = Bp; }
    else if (Bp.x > C.x) { B = C; C = Bp; }
    return { A, B, C };
  }

  /**
   * Every point of the drawing, computed from a position. `valid` is false
   * when A, B and C have collapsed (the Gergonne construction is undefined);
   * no caller ever sees NaN coordinates in that case.
   */
  function geometry(state) {
    const invalid = { valid: false };
    if (!state || ![state.A, state.B, state.C].every(finite)) return invalid;
    const { A, B, C } = arrange(state.A, state.B, state.C);
    const AC = C.x - A.x;
    if (!Number.isFinite(AC) || AC < 1e-6 || B.x <= A.x + 1e-6 || B.x >= C.x - 1e-6) return invalid;

    /* (O) with diameter AC, (P) with diameter AB. */
    const O = pt((A.x + C.x) / 2, (A.y + C.y) / 2);
    const R = AC / 2;
    const big = { x: O.x, y: O.y, r: R };
    const AB = Math.abs(B.x - A.x);
    const P = pt(A.x + AB / 2, A.y);
    const rP = AB / 2;

    /* The perpendicular bisector of BC: E above, F below the baseline. */
    const D = pt((B.x + C.x) / 2, B.y);
    const chord = circleLine(big, D, pt(D.x, D.y + 200));
    if (!chord) return invalid;
    const high = chord[0].y < chord[1].y ? chord[0] : chord[1];
    const low = high === chord[0] ? chord[1] : chord[0];
    const E = high.y < D.y ? high : low;   // bytecode: pts[0].y < D.y ? pts[0] : pts[1]
    const F = other(chord, E);

    /* EBK and FBL cut (O) for the second time. */
    const K = other(circleLine(big, E, B), E);
    const L = other(circleLine(big, F, B), F);
    if (![K, L].every(finite)) return invalid;

    /* The perpendicular at B cuts (O) at M (above) and N (below). */
    const mn = circleLine(big, pt(B.x, B.y - 200), B);
    if (!mn) return invalid;
    const M = mn[0].y <= mn[1].y ? mn[0] : mn[1];
    const N = other(mn, M);
    if (![M, N].every(finite)) return invalid;
    const rBM = dist(B, M);

    /* (Q), the orange circle tangent to (O), (P) and BE: the two formulas
       transcribed from Compute(), where t = rP / R = AB / AC. */
    const t = rP / R;
    const height = AC * (t / (1 + t)) * Math.sqrt(2 * (1 - t));
    const Q = pt(B.x, B.y - height);
    const rQ = AC * (t * (1 - t)) / (1 + t);

    /* LineP is the vertical through C; Ik and Il are K- and L-excenters of
       triangle CKL in the applet's construction. */
    const lineP = { a: pt(C.x, C.y), b: pt(C.x, C.y - 200) };
    const Ik = intersect(K, E, lineP.a, lineP.b);
    const Il = intersect(L, F, lineP.a, lineP.b);
    if (![Ik, Il].every(finite)) return invalid;
    const QpCentre = excenter(Ik, B, Il);
    if (!finite(QpCentre)) return invalid;
    const rQp = excircleRadius(QpCentre, Ik, B, Il);
    if (!Number.isFinite(rQp)) return invalid;

    return {
      valid: true, A, B, C, O, R, P, rP, D, E, F, K, L, M, N,
      Q, rQ, BQ: { a: B, b: Q },
      circleMN: { x: B.x, y: B.y, r: rBM },
      lineP, Circleb: { x: B.x, y: B.y, r: Math.abs(B.x - K.x) },
      Ik, Il, Qp: { x: QpCentre.x, y: QpCentre.y, r: rQp },
      BE: { a: B, b: E }, BF: { a: B, b: F },
      AB: { a: A, b: B }, BC: { a: B, b: C },
      power: AB * (C.x - B.x), t,
      labels: { O: O, P: P, Q: Q, B: B, C: C, A: A, E: E, F: F, K: K, L: L, M: M, N: N, Ik: Ik, Il: Il },
    };
  }

  /** Inversion with negative power -BM^2 about B. */
  function inverse(g, X) {
    const dx = X.x - g.B.x, dy = X.y - g.B.y;
    const k = -g.power / (dx * dx + dy * dy);
    return pt(g.B.x + k * dx, g.B.y + k * dy);
  }

  function defaultOptions() {
    return { ...DEFAULT_OPTIONS };
  }

  /** A fresh position; no option of the applet changes the construction. */
  function start(options) {
    const opts = defaultOptions();
    if (options) for (const k of Object.keys(opts)) if (k in options) {
      if (k === "step") opts.step = Math.max(0, Math.min(4, Math.trunc(options.step)));
      else opts[k] = Boolean(options[k]);
    }
    return {
      A: { ...START.A }, B: { ...START.B }, C: { ...START.C },
      options: opts, touches: 0,
    };
  }

  /** Move a handle: the applet keeps all three points on one horizontal line. */
  function movePoint(state, name, point) {
    if (!["A", "B", "C"].includes(name) || !finite(point)) return state;
    const p = clampToBoard(point);
    const points = { A: { ...state.A }, B: { ...state.B }, C: { ...state.C } };
    points[name] = p;
    const y = p.y;
    for (const n of ["A", "B", "C"]) points[n].y = y;
    return { ...state, ...points, touches: state.touches + 1 };
  }

  function setOption(state, name, value) {
    if (!(name in state.options)) return state;
    if (name === "step") {
      const step = Number(value);
      if (!Number.isFinite(step)) return state;
      return { ...state, options: { ...state.options, step: Math.max(0, Math.min(4, Math.trunc(step))) } };
    }
    return { ...state, options: { ...state.options, [name]: Boolean(value) } };
  }

  /** An illustration has no win or loss: it is explored, which Track handles. */
  function result(state) {
    return null;
  }

  return {
    VIEW, MARGIN, START, DEFAULT_OPTIONS, start, movePoint, setOption, result,
    geometry, inverse, dist, foot, intersect, circleLine, excenter, clampToBoard,
    arrange, other,
  };
})();
