"use strict";

/*
 * Equal Areas in Equilateral Triangle, from Alexander Bogomolny's applet
 * EqualAreasInEquilateralTriangle (cut-the-knot.org). M is a point inside an
 * equilateral triangle ABC. Its feet on the three sides are A' (on BC),
 * B' (on CA) and C' (on AB). The six segments from M split ABC into six
 * small triangles; the applet colours them in six colours and shows two
 * horizontal bars of three pieces each.
 *
 * The key fact is a sum of products: the area of each small triangle is
 * half of (the distance from M to its side) times (its base on that side).
 * Summing the odd-indexed pieces and the even-indexed pieces gives the same
 * number for every M: half the whole triangle's doubled area, i.e. the
 * triangle's own area. This file is only that geometry: no document, no
 * window, no storage. It defines one global,
 * EqualAreasInEquilateralTriangleCore, so the page and the Node check can
 * both load it as a plain script. Positions are plain data.
 */
const EqualAreasInEquilateralTriangleCore = (() => {
  /* The applet's canvas is 600 by 500; the same construction at a smaller
     viewBox keeps room for the two area bars under the triangle. */
  const WIDTH = 420;
  const HEIGHT = 360;
  const SQRT3 = Math.sqrt(3);

  /** Applet Canvas.init(): side = min(width*sqrt(3)/2, height)*9/10. */
  function sideFor(width, height) {
    return (Math.min(width * SQRT3 / 2, height) * 9) / 10;
  }

  function makeTriangle(width, height) {
    const side = sideFor(width, height);
    const yGap = (height - side * SQRT3 / 2) / 2;
    const xGap = (width - side) / 2;
    return {
      side: side,
      A: { x: xGap, y: height - (yGap * 3) / 2 },
      B: { x: width - xGap, y: height - (yGap * 3) / 2 },
      C: { x: width / 2, y: yGap / 2 },
    };
  }

  /** New picture: same triangle as the applet, with M at (A + 3B + 2C)/6. */
  function start(options) {
    const o = options || {};
    const t = makeTriangle(o.width === undefined ? WIDTH : o.width,
      o.height === undefined ? HEIGHT : o.height);
    return {
      A: t.A, B: t.B, C: t.C,
      side: t.side,
      M: {
        x: (t.A.x + 3 * t.B.x + 2 * t.C.x) / 6,
        y: (t.A.y + 3 * t.B.y + 2 * t.C.y) / 6,
      },
      showNames: !!o.showNames,
      hint: !!o.hint,
      width: o.width === undefined ? WIDTH : o.width,
      height: o.height === undefined ? HEIGHT : o.height,
    };
  }

  /* Twice the signed area; the three tests of Canvas.DoDraw(). */
  function orientation(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  /** The applet draws only while M is in the same half-plane of all sides. */
  function inside(state, p) {
    const sign = orientation(state.A, state.B, state.C);
    if (!sign) return false;
    return orientation(p, state.B, state.C) * sign >= -1e-9 &&
      orientation(p, state.C, state.A) * sign >= -1e-9 &&
      orientation(p, state.A, state.B) * sign >= -1e-9;
  }

  /** Dragging outside leaves the picture as it was, as DoDraw does. */
  function moveM(state, p) {
    if (!inside(state, p)) return state;
    return Object.assign({}, state, { M: { x: p.x, y: p.y } });
  }

  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  function intersect(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const cross = rx * sy - ry * sx;
    if (Math.abs(cross) < 1e-12) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  function distance(p, q) {
    return Math.hypot(p.x - q.x, p.y - q.y);
  }

  function doubledArea(p, q, r) {
    return Math.abs(orientation(p, q, r));
  }

  /* Canvas.Compute(), in the applet's own order. W[i] is twice the area of
     triangles[i] (a base length times the height from M). */
  function geometry(state) {
    const A = state.A, B = state.B, C = state.C, M = state.M;
    const Ap = foot(M, B, C);
    const Bp = foot(M, C, A);
    const Cp = foot(M, A, B);

    const parallelBC = M.x + (C.x - B.x), parallelBCy = M.y + (C.y - B.y);
    const parallelAC = M.x + (C.x - A.x), parallelACy = M.y + (C.y - A.y);
    const parallelAB = M.x + (B.x - A.x), parallelABy = M.y + (B.y - A.y);
    const qBC = { x: parallelBC, y: parallelBCy };
    const qAC = { x: parallelAC, y: parallelACy };
    const qAB = { x: parallelAB, y: parallelABy };
    const Ab = intersect(qBC, M, A, B);
    const Ac = intersect(qBC, M, A, C);
    const Ba = intersect(qAC, M, B, A);
    const Bc = intersect(qAC, M, B, C);
    const Ca = intersect(qAB, M, C, A);
    const Cb = intersect(qAB, M, C, B);

    const W = [
      distance(M, Cp) * distance(A, Cp),
      distance(M, Cp) * distance(B, Cp),
      distance(M, Ap) * distance(B, Ap),
      distance(M, Ap) * distance(C, Ap),
      distance(M, Bp) * distance(C, Bp),
      distance(M, Bp) * distance(A, Bp),
    ];
    const triangles = [
      [M, A, Cp], [M, B, Cp], [M, B, Ap],
      [M, C, Ap], [M, C, Bp], [M, A, Bp],
    ];
    return { Ap: Ap, Bp: Bp, Cp: Cp, Ab: Ab, Ac: Ac, Ba: Ba, Bc: Bc,
      Ca: Ca, Cb: Cb, W: W, triangles: triangles };
  }

  /** The page's (1): odd pieces on the left, even pieces on the right. */
  function sums(state) {
    const W = geometry(state).W;
    return {
      left: W[5] + W[1] + W[3],
      right: W[2] + W[4] + W[0],
      all: W[0] + W[1] + W[2] + W[3] + W[4] + W[5],
      whole: doubledArea(state.A, state.B, state.C),
    };
  }

  function toggle(state, option) {
    if (option !== "showNames" && option !== "hint") return state;
    const next = Object.assign({}, state);
    next[option] = !state[option];
    return next;
  }

  function reset(state) {
    return start({ showNames: state.showNames, hint: state.hint });
  }

  function format(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  function status(state) {
    const s = sums(state);
    return `The three pieces in one group total ${format(s.left)} and the other three total ${format(s.right)} — the same area, half of the big triangle.`;
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT,
    sideFor: sideFor, makeTriangle: makeTriangle, start: start,
    orientation: orientation, inside: inside, moveM: moveM,
    foot: foot, intersect: intersect, distance: distance,
    doubledArea: doubledArea, geometry: geometry, sums: sums,
    toggle: toggle, reset: reset, status: status,
  };
})();
