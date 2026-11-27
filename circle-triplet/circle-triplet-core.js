"use strict";

/*
 * Circle Triplet — Alexander Bogomolny's illustration of Archimedes' twin
 * circles in an arbelos and L. Bankoff's brother circle (1974).  The big
 * semicircle has diameter AB and the two small ones have diameters AC and CB;
 * the twins and the brother all have radius r1*r2/(r1+r2).  The circle (O3)
 * tangent to all three semicircles touches the two small ones at K and L, and
 * the circumcircle of K, L and C is the brother — its centre lies directly
 * above (or below) C on the baseline.  Porting/check-circle-triplet.mjs checks
 * all of that against a second, literal transcription of the applet's own
 * Apollonius-circle computation.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, CircleTripletCore, so the page loads it with
 * a plain <script> and the logic test can load it in Node.  Positions are plain
 * objects in the SVG's viewBox coordinates.
 *
 * The old applet placed its three points on the line y = height/2 in a
 * 400x250 canvas and let A, B and C be dragged with a five-unit gap.  Those
 * limits are kept here.  The applet solved the tangent circles with a huge
 * circle standing in for the perpendicular through C and shifted the big
 * circle down by one pixel; this core uses the exact circles instead, so the
 * radius equality is exact rather than a pixel off.
 */

const CircleTripletCore = (() => {
  const VIEW = { width: 400, height: 250 };
  const BASE_Y = Math.floor(VIEW.height / 2); // 125: the applet's row
  const MARGIN = 30; // the applet's m_Margin
  const GAP = 5; // the applet's PointIsEligible margin
  const P = (x, y) => ({ x: x, y: y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Where a dragged handle may go: on the baseline, between its neighbours. */
  function project(state, name, p) {
    if (!p || !Number.isFinite(p.x)) return state[name];
    const step = GAP + 1;
    if (name === "A") return P(clamp(p.x, GAP, state.C.x - step), BASE_Y);
    if (name === "B") return P(clamp(p.x, state.C.x + step, VIEW.width - GAP), BASE_Y);
    if (name === "C") return P(clamp(p.x, state.A.x + step, state.B.x - step), BASE_Y);
    return state[name];
  }

  /** The applet's starting points: A=(105,125), B=(295,125), C=0.3A+0.7B. */
  function start(options) {
    const o = options || {};
    const half = Math.min(VIEW.width, VIEW.height) / 2 - MARGIN;
    const A = P(VIEW.width / 2 - half, BASE_Y);
    const B = P(VIEW.width / 2 + half, BASE_Y);
    return {
      A: A,
      B: B,
      C: P(0.3 * A.x + 0.7 * B.x, BASE_Y),
      options: {
        names: o.names === undefined ? true : !!o.names,
        hint: !!o.hint,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function legalMoves(state) {
    return ["A", "B", "C"];
  }

  function move(state, name, p) {
    if (!legalMoves(state).includes(name) || !p || !Number.isFinite(p.x)) return state;
    return Object.assign({}, state, { [name]: project(state, name, p), explored: true });
  }

  function setOption(state, name, on) {
    if (!(name in state.options)) return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!on }),
      explored: true,
    });
  }

  /** An illustration has no win and no loss. */
  function result(state) {
    return null;
  }

  /** The point on the segment between two externally tangent circles. */
  function tangentPoint(c, r, other, s) {
    const t = r / (r + s);
    return P(c.x + t * (other.x - c.x), c.y + t * (other.y - c.y));
  }

  /**
   * Every point of the exact figure.  R3 is Proposition 6's radius, p is the
   * twins' radius, and W3 is the circumcircle of K, L, C.  reflected is the
   * same construction below the baseline, the view the applet's bytecode
   * actually draws for (O3).
   */
  function geometry(state) {
    const A = state.A, B = state.B, C = state.C;
    const r1 = (C.x - A.x) / 2;
    const r2 = (B.x - C.x) / 2;
    const R = (B.x - A.x) / 2;
    if (!(r1 > 1e-6 && r2 > 1e-6)) return null;

    const O = mid(A, B), O1 = mid(A, C), O2 = mid(C, B);
    const p = r1 * r2 / R;
    const R3 = R * r1 * r2 / (r1 * r1 + r1 * r2 + r2 * r2);

    const twin1 = {
      c: P(C.x - p, BASE_Y - Math.sqrt(Math.max(0, (r1 + p) ** 2 - (C.x - p - O1.x) ** 2))),
      r: p,
    };
    const twin2 = {
      c: P(C.x + p, BASE_Y - Math.sqrt(Math.max(0, (r2 + p) ** 2 - (C.x + p - O2.x) ** 2))),
      r: p,
    };

    const shift = R3 * (r1 - r2) / R;
    const lift = Math.sqrt(Math.max(0, (r1 + R3) ** 2 - (r1 + shift) ** 2));
    const brother = { c: P(C.x + shift, BASE_Y - lift), r: R3 };
    const reflected = { c: P(C.x + shift, BASE_Y + lift), r: R3 };

    const K = tangentPoint(O1, r1, brother.c, R3);
    const L = tangentPoint(O2, r2, brother.c, R3);
    const Kref = tangentPoint(O1, r1, reflected.c, R3);
    const Lref = tangentPoint(O2, r2, reflected.c, R3);

    const W3 = { c: P(C.x, BASE_Y - p), r: p };
    const W3ref = { c: P(C.x, BASE_Y + p), r: p };
    const D = P(C.x, BASE_Y - Math.sqrt((C.x - A.x) * (B.x - C.x)));
    const inversion = { c: A, r: Math.sqrt((C.x - A.x) * (B.x - A.x)) };

    const all = [O, O1, O2, twin1.c, twin2.c, brother.c, reflected.c, K, L, Kref, Lref, D];
    if (!all.every(finite) || !Number.isFinite(p) || !Number.isFinite(R3)) return null;

    return {
      A: A, B: B, C: C, O: O, O1: O1, O2: O2, D: D,
      big: { c: O, r: R }, left: { c: O1, r: r1 }, right: { c: O2, r: r2 },
      twin1: twin1, twin2: twin2,
      brother: brother, reflected: reflected,
      K: K, L: L, Kref: Kref, Lref: Lref,
      W3: W3, W3ref: W3ref, inversion: inversion,
      r1: r1, r2: r2, R: R, p: p, R3: R3,
    };
  }

  /** Invert a circle in the hint's inversion circle; null if it passes through A. */
  function invertCircle(circle, inversion) {
    const d2 = dist(circle.c, inversion.c) ** 2;
    const den = d2 - circle.r * circle.r;
    if (Math.abs(den) < 1e-9) return null;
    const k = inversion.r * inversion.r;
    return {
      c: P(inversion.c.x + k * (circle.c.x - inversion.c.x) / den,
           inversion.c.y + k * (circle.c.y - inversion.c.y) / den),
      r: Math.abs(k * circle.r / den),
    };
  }

  /** Spoken status line; the test checks the numbers it reports. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move C away from A or B to make the two semicircles.";
    return "AC " + Math.round(2 * g.r1) + ", CB " + Math.round(2 * g.r2) +
      ". The twins and the brother have radius " + g.p.toFixed(1) +
      "; the circle touching all three has radius " + g.R3.toFixed(1) + ".";
  }

  return {
    VIEW: VIEW, BASE_Y: BASE_Y, MARGIN: MARGIN, GAP: GAP,
    start: start, reset: reset, legalMoves: legalMoves, move: move,
    setOption: setOption, project: project, result: result,
    geometry: geometry, describe: describe, invertCircle: invertCircle,
    dist: dist, mid: mid, tangentPoint: tangentPoint,
  };
})();
