"use strict";

/*
 * From 500 — the geometry behind Alexander Bogomolny's applet From500
 * (cut-the-knot.org/Curriculum/Geometry/From500.shtml, "A Tangent in Concurrency").
 *
 * The page's claim: for a semicircle AXB with diameter AB and centre O, the
 * tangents at A, X and B are drawn; AX and BX extended past X meet the tangents
 * at B and A in Z and Y. Then the tangent at X, the line YZ and the line AB are
 * either all parallel or all meet in one point P. The proof on the page uses
 * equal tangents from U (where the tangent at X meets the tangent at A) to show
 * that U is the midpoint of AY, and similarly V is the midpoint of BZ.
 *
 * This file reproduces the applet's construction: From500Canvas.Draw() calls
 * Perp(A,O), Perp(B,O), Perp(X,O), intersects those lines with XB and XA using
 * GeoSDoub.Intersect, and intersects YZ with the tangent at X to get P. The
 * position is plain data (two draggable points and two switches); this file
 * touches no DOM, no window and no storage. It defines one global,
 * From500Core. porting/check-from-500.mjs transcribes the applet's own
 * Perp/Intersect methods a second time and compares them here over the whole
 * range of positions.
 */

const From500Core = (() => {
  // The applet is 500x400. Its Reset puts O at (width/3, 3*height/4), takes
  // radius 60 and a random angle in [PI/4, 5*PI/12] above AB. We use the middle
  // of that range so the opening picture is repeatable.
  const WIDTH = 500;
  const HEIGHT = 400;
  const RADIUS = 60;
  const ANGLE_MIN = Math.PI / 4;
  const ANGLE_MAX = (5 * Math.PI) / 12;
  const ANGLE_START = Math.PI / 3;
  const MARGIN = 8;
  const MIN_RADIUS = 12; // a guard against dragging X onto O (the applet has none)
  const HANDLES = ["O", "X"];
  const OPTION_KEYS = ["showNames", "showHint"];
  const O_START = { x: WIDTH / 3, y: (HEIGHT * 3) / 4 };
  const X_START = {
    x: O_START.x + RADIUS * Math.cos(ANGLE_START),
    y: O_START.y - RADIUS * Math.sin(ANGLE_START),
  };

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const notAPoint = () => ({ x: NaN, y: NaN });
  const clampToBoard = (p) => ({
    x: clamp(p.x, MARGIN, WIDTH - MARGIN),
    y: clamp(p.y, MARGIN, HEIGHT - MARGIN),
  });
  const clampRadius = (p, O, atLeast) => {
    const d = dist(p, O);
    if (d >= atLeast) return p;
    if (d > 1e-9) return add(O, mul(sub(p, O), atLeast / d));
    return { x: O.x + atLeast, y: O.y };
  };

  /* ------------------------------------------------------------- positions */

  /** The opening picture. `angle` is optional, in the applet's random range. */
  function start(options) {
    const o = options || {};
    let angle = ANGLE_START;
    if (typeof o.angle === "number" && Number.isFinite(o.angle)) {
      angle = clamp(o.angle, ANGLE_MIN, ANGLE_MAX);
    }
    const state = {
      O: { ...O_START },
      X: {
        x: O_START.x + RADIUS * Math.cos(angle),
        y: O_START.y - RADIUS * Math.sin(angle),
      },
      // The cut-the-knot page passes no ShowNames parameter, so both applet
      // checkboxes start unticked.
      showNames: false,
      showHint: false,
      moves: 0,
      explored: false,
    };
    if (finite(o.O)) state.O = clampToBoard(o.O);
    if (finite(o.X)) state.X = clampToBoard(o.X);
    state.X = clampToBoard(clampRadius(state.X, state.O, MIN_RADIUS));
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /** Dragging O or X, flipping either switch, and Reset — the applet's controls. */
  function legalMoves(state) {
    return [
      ...HANDLES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!HANDLES.includes(m.name) || !finite(m.point)) return null;
      const p = clampToBoard(m.point);
      if (m.name === "X") {
        next = { ...state, X: clampToBoard(clampRadius(p, state.O, MIN_RADIUS)) };
      } else {
        // Moving O carries neither the radius nor X with it, as in the applet:
        // O and X are independent MoveablePoints.
        next = { ...state, O: p, X: clampToBoard(clampRadius(state.X, p, MIN_RADIUS)) };
      }
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = start();
      for (const key of OPTION_KEYS) next[key] = state[key]; // switches survive Reset
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture cannot be won or lost; it counts as explored once changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* ------------------------------------------------------------ the drawing */

  /** From500Canvas.Perp(p,q): a line through p at right angles to pq, with
   *  the same second point the bytecode builds (ten pixels out). */
  function perpLine(p, q) {
    return {
      p,
      q: { x: p.x + (q.y - p.y) * 10, y: p.y - (q.x - p.x) * 10 },
    };
  }

  function line(p, q) {
    return { p, q };
  }

  /** Line intersection in parametric form. GeoSDoub.Intersect returns NaN for
   *  a determinant smaller than one (a pixel-scale test for parallelism); we
   *  keep the same cut-off so the drawing agrees with the applet. The check
   *  script transcribes the applet's general-form coefficients separately. */
  function intersect(l, m) {
    const r = sub(l.q, l.p), s = sub(m.q, m.p);
    const det = cross(r, s);
    if (!Number.isFinite(det) || Math.abs(det) < 1) return notAPoint();
    const t = cross(sub(m.p, l.p), s) / det;
    return add(l.p, mul(r, t));
  }

  /** Everything the page draws, from the two points the player can move. */
  function compute(state) {
    if (!state || !finite(state.O) || !finite(state.X)) {
      return { valid: false, reason: "invalid", O: { x: NaN, y: NaN }, X: { x: NaN, y: NaN } };
    }
    const O = state.O, X = state.X;
    const r = dist(O, X);
    if (r < 1e-9) return { valid: false, reason: "invalid", O, X, r };

    const A = { x: O.x - r, y: O.y };
    const B = { x: O.x + r, y: O.y };
    const TA = perpLine(A, O);
    const TB = perpLine(B, O);
    const TX = perpLine(X, O);
    const XB = line(X, B);
    const XA = line(X, A);

    const Y = intersect(TA, XB);
    const Z = intersect(TB, XA);
    const YZ = line(Y, Z);
    const P = intersect(YZ, TX);
    const U = intersect(TA, TX);
    const V = intersect(TB, TX);

    const valid = finite(Y) && finite(Z) && finite(U) && finite(V);
    // X on the diameter makes XA or XB degenerate: there is no Y or Z.
    const onDiameter = Math.abs(cross(sub(X, A), sub(X, B))) < 1e-9;
    return {
      valid: valid && !onDiameter,
      reason: onDiameter ? "diameter" : valid ? null : "degenerate",
      O, X, r, A, B,
      TA, TB, TX, XB, XA, YZ, AB: line(A, B),
      Y, Z, P, U, V,
      parallel: !finite(P),
    };
  }

  /* ---------------------------------------------------------- claim residuals */

  /** Perpendicular distance from a point to an infinite line p->q. */
  function distanceToLine(p, l) {
    const d = sub(l.q, l.p);
    const n = Math.hypot(d.x, d.y);
    return n < 1e-12 ? dist(p, l.p) : Math.abs(cross(d, sub(p, l.p))) / n;
  }

  /** Residuals for every claim on the cut-the-knot page. Compare with r to
   *  make them scale-free, and use relative comparisons in the logic test. */
  function residuals(g) {
    if (!g || !g.valid) return null;
    const { O, X, r, A, B, Y, Z, U, V, P, TA, TB, TX, YZ } = g;
    const len = (p, q) => dist(p, q);
    const rel = (v) => Math.abs(v) / r;
    // Cosine of the angle between a radius and the tangent at its endpoint:
    // zero means the line really is a tangent.
    const perpendicular = (p, center, l) =>
      Math.abs(dot(sub(p, center), sub(l.q, l.p))) / (r * dist(l.p, l.q));
    const all = {
      tangentAtA: perpendicular(A, O, TA),
      tangentAtB: perpendicular(B, O, TB),
      tangentAtX: perpendicular(X, O, TX),
      UOnTA: rel(distanceToLine(U, TA)),
      VOnTB: rel(distanceToLine(V, TB)),
      UOnTX: rel(distanceToLine(U, TX)),
      VOnTX: rel(distanceToLine(V, TX)),
      YOnTA: rel(distanceToLine(Y, TA)),
      YOnXB: rel(distanceToLine(Y, g.XB)),
      ZOnTB: rel(distanceToLine(Z, TB)),
      ZOnXA: rel(distanceToLine(Z, g.XA)),
      UIsMidpointAY: rel(dist(U, midpoint(A, Y))),
      VIsMidpointBZ: rel(dist(V, midpoint(B, Z))),
      UATangents: rel(Math.max(
        Math.abs(len(U, A) - len(U, X)),
        Math.abs(len(U, X) - len(U, Y)),
      )),
      VBTangents: rel(Math.max(
        Math.abs(len(V, B) - len(V, X)),
        Math.abs(len(V, X) - len(V, Z)),
      )),
      POnTX: g.parallel ? 0 : rel(distanceToLine(P, TX)),
      POnYZ: g.parallel ? 0 : rel(distanceToLine(P, YZ)),
      POnAB: g.parallel ? 0 : rel(P.y - O.y),
      parallelTX: Math.abs(cross(sub(TX.q, TX.p), sub(B, A)))
        / (dist(TX.p, TX.q) * dist(A, B)),
      parallelYZ: Math.abs(cross(sub(YZ.q, YZ.p), sub(B, A)))
        / (dist(YZ.p, YZ.q) * dist(A, B)),
    };
    return all;
  }

  return {
    WIDTH, HEIGHT, RADIUS, ANGLE_MIN, ANGLE_MAX, ANGLE_START,
    MARGIN, MIN_RADIUS, HANDLES, OPTION_KEYS, O_START, X_START,
    add, sub, mul, dot, cross, dist, midpoint, finite, clamp, clampToBoard, clampRadius,
    start, legalMoves, move, result,
    perpLine, line, intersect, compute, distanceToLine, residuals,
  };
})();
