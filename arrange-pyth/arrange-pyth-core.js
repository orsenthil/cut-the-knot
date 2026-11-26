"use strict";

/*
 * "Pythagorean Theorem By Rearrangement" (Proof #36 inside the applet),
 * Alexander Bogomolny's ArrangePyth.
 *
 * The canvas holds two equal squares. A draggable point M sits on the bottom
 * edge of the left square; if A = distance(L0, M) and B = distance(M, L1),
 * then A + B is the side S of a square. The applet cuts the left square into
 * four right triangles with legs A and B plus a square on the third side c,
 * and cuts the right square into the same four triangles plus two squares of
 * sides A and B. Removing the four triangles from both squares leaves
 * c² = A² + B². This file computes those pieces and their areas.
 *
 * Coordinates are the applet's own: x grows right, y grows down, and every
 * position is integer canvas pixels. The mouse handler only moves M when the
 * pointer is on the bottom edge within 20 pixels (mousePressed/mouseDragged),
 * so canGrab() and withM() reproduce that test. The start point is one third
 * of the way along the bottom edge, exactly as init() sets it.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, ArrangePythCore, so the page loads it
 * with a plain <script> and porting/check-arrange-pyth.mjs loads it in Node.
 * Functions take plain data and return new plain data.
 */
const ArrangePythCore = (() => {
  const APPLET = { width: 500, height: 300, pad: 20, band: 20 };

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /**
   * init() transcribed: `side = min(width/2, height/2) - 40` with Java's
   * integer division, the two squares' corners at x and x + width/2, and
   * their top edge at y. L = left square, R = right square, corners clockwise
   * from bottom-left.
   */
  function layout(width = APPLET.width, height = APPLET.height) {
    const w = Math.trunc(width), h = Math.trunc(height);
    const halfW = Math.floor(w / 2);
    const side = Math.min(halfW, Math.floor(h / 2)) - 2 * APPLET.pad;
    const x = Math.floor((halfW - side) / 2);
    const y = Math.floor((h - side) / 2);
    const L = [
      pt(x, h - y), pt(x + side, h - y),
      pt(x + side, y), pt(x, y),
    ];
    const R = [
      pt(x + halfW, h - y), pt(x + side + halfW, h - y),
      pt(x + side + halfW, y), pt(x + halfW, y),
    ];
    return { width: w, height: h, side, x, y, halfW, L, R };
  }

  /** The position a new illustration starts from, straight from init(). */
  function start(width = APPLET.width, height = APPLET.height) {
    const g = layout(width, height);
    // init(): M = new Point((L0.x + L1.x) / 3, L0.y), with integer division.
    const mx = Math.floor((g.L[0].x + g.L[1].x) / 3);
    const my = g.L[0].y;
    return { width: g.width, height: g.height, m: pt(mx, my), a: mx - g.L[0].x, b: g.L[1].x - mx };
  }

  /** mousePressed/mouseDragged: only the bottom edge's 40-pixel band is live. */
  function canGrab(state, x, y) {
    const g = layout(state.width, state.height);
    return x >= g.L[0].x && x <= g.L[1].x &&
      y >= g.L[0].y - APPLET.band && y <= g.L[0].y + APPLET.band;
  }

  /** Move M along the bottom edge; a fractional mouse x is rounded, as in AWT. */
  function withM(state, x, y) {
    if (y !== undefined && !canGrab(state, x, y)) return state;
    const g = layout(state.width, state.height);
    const mx = clamp(Math.round(x), g.L[0].x, g.L[1].x);
    return {
      width: state.width, height: state.height,
      m: pt(mx, g.L[0].y), a: mx - g.L[0].x, b: g.L[1].x - mx,
    };
  }

  /** Put M at the middle of the edge (not in the applet; a page convenience). */
  function midpoint(state) {
    const g = layout(state.width, state.height);
    return withM(state, g.L[0].x + Math.floor(g.side / 2));
  }

  /** Twice the signed area of a polygon, and its area (shoelace). */
  function signed2(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum;
  }
  const area = (points) => Math.abs(signed2(points)) / 2;

  /**
   * DrawLPyth() and DrawRPyth() transcribed. Each piece lists its vertices in
   * the order the applet adds them to its Polygon; `color` is the applet's
   * yellow (triangles) or red (squares). Points are absolute canvas pixels.
   */
  function pieces(state) {
    const g = layout(state.width, state.height);
    const A = state.a, B = state.b, S = g.side;
    const L = g.L, R = g.R, M = state.m;

    // DrawLPyth locals: p1 above L0, p2 right of L3, p3 below L2.
    const p1 = pt(L[0].x, L[0].y - B);
    const p2 = pt(L[3].x + B, L[3].y);
    const p3 = pt(L[2].x, L[2].y + B);
    const left = [
      { name: "left-triangle-1", color: "yellow", points: [L[0], M, p1] },
      { name: "left-triangle-2", color: "yellow", points: [p1, L[3], p2] },
      { name: "left-triangle-3", color: "yellow", points: [p2, L[2], p3] },
      { name: "left-triangle-4", color: "yellow", points: [p3, L[1], M] },
      { name: "hypotenuse-square", color: "red", points: [p1, p2, p3, M] },
    ];

    // DrawRPyth locals: q2 above R0 by B and A right of it, q3 above R0,
    // q4 right of R3, q5 below R2, q6 right of R0.
    const q2 = pt(R[0].x + A, R[0].y - B);
    const q3 = pt(R[0].x, R[0].y - B);
    const q4 = pt(R[3].x + A, R[3].y);
    const q5 = pt(R[2].x, R[2].y + A);
    const q6 = pt(R[0].x + A, R[0].y);
    const right = [
      { name: "right-triangle-1", color: "yellow", points: [R[0], q2, q6] },
      { name: "right-triangle-2", color: "yellow", points: [R[0], q3, q2] },
      { name: "right-triangle-3", color: "yellow", points: [R[2], q2, q4] },
      { name: "right-triangle-4", color: "yellow", points: [R[2], q5, q2] },
      { name: "square-a", color: "red", points: [R[3], q4, q2, q3] },
      { name: "square-b", color: "red", points: [R[1], q6, q2, q5] },
    ];

    return { left, right, local: { p1, p2, p3, q2, q3, q4, q5, q6 } };
  }

  /** The numbers a player can check, measured on the drawn polygons. */
  function measures(state) {
    const p = pieces(state);
    const redLeft = p.left.find((piece) => piece.name === "hypotenuse-square");
    const redRight = p.right.filter((piece) => piece.color === "red");
    const edge = (poly, i) => Math.hypot(
      poly.points[(i + 1) % poly.points.length].x - poly.points[i].x,
      poly.points[(i + 1) % poly.points.length].y - poly.points[i].y,
    );
    const a2 = state.a * state.a, b2 = state.b * state.b;
    return {
      a: state.a, b: state.b, side: layout(state.width, state.height).side,
      a2, b2, c2: a2 + b2,
      hypotenuseSide: edge(redLeft, 0),
      hypotenuseArea: area(redLeft.points),
      squareAArea: area(redRight[0].points),
      squareBArea: area(redRight[1].points),
      leftArea: p.left.reduce((sum, piece) => sum + area(piece.points), 0),
      rightArea: p.right.reduce((sum, piece) => sum + area(piece.points), 0),
      triangleAreas: p.left.filter((x) => x.color === "yellow").map((x) => area(x.points)),
    };
  }

  return {
    APPLET, pt, add, clamp,
    layout, start, canGrab, withM, midpoint, signed2, area, pieces, measures,
  };
})();
