"use strict";

/*
 * Brides' Chair, after Alexander Bogomolny's BridesChair applet (August 2003).
 *
 * The picture starts with a triangle ABC and puts a square on each side,
 * outside the triangle. Joining each corner of the triangle to the two nearest
 * square corners gives three "flank" triangles. When ABC has a right angle the
 * picture is the Bride's Chair: the big square is exactly the two small ones.
 *
 * The key idea the code relies on is a quarter turn. GeoSDoub.Rotate turns a
 * point about a centre by an angle in screen coordinates (y grows downwards),
 * with direction +1 rotating clockwise on screen. FormSquare makes the far
 * corners of a square on PQ as Rotate(P,Q,90,+1) and Rotate(Q,P,90,-1).
 * Everything else - equal flank areas, the median/altitude of length BC/2,
 * the slider's 90-degree coincidence - is a consequence of that one turn.
 *
 * This file is only the geometry. No document, no window, no storage. It
 * defines one global, BridesChairCore, and every position is plain JSON.
 */
const BridesChairCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const ROTATION_MIN = 0;
  const ROTATION_MAX = 95; // the applet's Scrollbar(0, 0, 5, 0, 95)
  const ROTATION_STEP = 1;
  const QUARTER = Math.PI / 2;

  const OPTION_KEYS = ["showNames", "showLines", "fillTriangles", "medians"];

  // ---- plain vector arithmetic, with y pointing down as on the canvas ----

  function point(x, y) { return { x, y }; }
  function add(a, b) { return point(a.x + b.x, a.y + b.y); }
  function sub(a, b) { return point(a.x - b.x, a.y - b.y); }
  function scale(a, k) { return point(a.x * k, a.y * k); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function dist2(a, b) { const d = sub(a, b); return dot(d, d); }
  function dist(a, b) { return Math.sqrt(dist2(a, b)); }
  function midpoint(a, b) { return point((a.x + b.x) / 2, (a.y + b.y) / 2); }

  /** Twice the signed area: positive when a, b, c run clockwise on screen. */
  function signedArea2(a, b, c) { return cross(sub(b, a), sub(c, a)); }
  function area(a, b, c) { return Math.abs(signedArea2(a, b, c)) / 2; }

  /**
   * Faithful transcription of GeoSDoub.Rotate(c, p, angle, dir):
   *   x' = cx + cos*(px-cx) - dir*sin*(py-cy)
   *   y' = cy + dir*sin*(px-cx) + cos*(py-cy)
   */
  function rotate(c, p, angle, dir) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const d = dir === undefined ? 1 : dir;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return point(c.x + cos * dx - d * sin * dy, c.y + d * sin * dx + cos * dy);
  }

  /** Translate the applet's degrees-to-radians conversion. */
  function turn(c, p, degrees, dir) {
    return rotate(c, p, (degrees * Math.PI) / 180, dir === undefined ? 1 : dir);
  }

  /** FormSquare(P,Q,R,S): the two far corners of the square on side PQ. */
  function squareOn(p, q) {
    return { first: rotate(p, q, QUARTER, 1), second: rotate(q, p, QUARTER, -1) };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function copyPoint(p) { return point(p.x, p.y); }
  function copyPointMap(m) {
    const out = {};
    for (const k of Object.keys(m)) out[k] = copyPoint(m[k]);
    return out;
  }

  /** The starting figure, taken from BridesChairCanvas.init() at 400 x 300. */
  function start(options) {
    const opts = options || {};
    const w = opts.width || WIDTH;
    const h = opts.height || HEIGHT;
    const cx = w / 2;
    const cy = h / 2;
    const d = w / 8;
    const A = point(cx - d, cy + 2);
    const B = point(cx + d, cy + 2);
    const C = point(cx - d * Math.cos(Math.PI / 3), cy - d * Math.sin(Math.PI / 3) - 20);
    const state = {
      A, B, C,
      rotation: ROTATION_MIN,
      showNames: false,
      showLines: false,
      fillTriangles: false,
      medians: false,
      selected: 0,
      explored: false,
    };
    for (const key of OPTION_KEYS) {
      if (Object.prototype.hasOwnProperty.call(opts, key)) state[key] = Boolean(opts[key]);
    }
    return state;
  }

  /** The whole position as plain JSON, for Track.state and the tutor. */
  function snapshot(state) {
    return {
      A: copyPoint(state.A), B: copyPoint(state.B), C: copyPoint(state.C),
      rotation: state.rotation,
      showNames: state.showNames,
      showLines: state.showLines,
      fillTriangles: state.fillTriangles,
      medians: state.medians,
      selected: state.selected,
      explored: state.explored,
    };
  }

  /**
   * The labelled points of the figure. Names match the applet's fields:
   * the square on AB gives CA and CB, the one on BC gives AB and AC, and the
   * one on CA gives BC and BA. The flank at A is A-BA-CA.
   */
  function geometry(state) {
    const { A, B, C } = state;
    const onAB = squareOn(A, B);
    const onBC = squareOn(B, C);
    const onCA = squareOn(C, A);
    const CA = onAB.first;
    const CB = onAB.second;
    const AB = onBC.first;
    const AC = onBC.second;
    const BC = onCA.first;
    const BA = onCA.second;

    // The slider rotates the A-flank's two far corners about A, clockwise.
    const moving = state.rotation > 0;
    const movedBA = moving ? turn(A, BA, state.rotation, 1) : copyPoint(BA);
    const movedCA = moving ? turn(A, CA, state.rotation, 1) : copyPoint(CA);
    const movedMid = midpoint(movedBA, movedCA);

    return {
      A: copyPoint(A), B: copyPoint(B), C: copyPoint(C),
      AB: copyPoint(AB), AC: copyPoint(AC), BA: copyPoint(BA),
      BC: copyPoint(BC), CA: copyPoint(CA), CB: copyPoint(CB),
      flanks: {
        A: [copyPoint(A), copyPoint(BA), copyPoint(CA)],
        B: [copyPoint(B), copyPoint(AB), copyPoint(CB)],
        C: [copyPoint(C), copyPoint(AC), copyPoint(BC)],
      },
      squares: {
        AB: [copyPoint(A), copyPoint(CA), copyPoint(CB), copyPoint(B)],
        BC: [copyPoint(B), copyPoint(AB), copyPoint(AC), copyPoint(C)],
        CA: [copyPoint(C), copyPoint(BC), copyPoint(BA), copyPoint(A)],
      },
      medians: {
        A: midpoint(BA, CA),
        B: midpoint(AB, CB),
        C: midpoint(AC, BC),
      },
      centers: {
        AB: midpoint(A, CB),
        BC: midpoint(B, AC),
        CA: midpoint(C, BA),
      },
      moving,
      movedBA,
      movedCA,
      movedMid,
      rotation: state.rotation,
    };
  }

  /** The moves the page exposes: select, drag, turn the slider, options, presets. */
  function legalMoves(state) {
    const moves = [{ type: "reset" }, { type: "right" }];
    for (let i = 0; i < 3; i++) moves.push({ type: "select", index: i });
    for (let i = 0; i < 3; i++) {
      for (const [x, y] of [[40, 40], [WIDTH - 40, HEIGHT - 40]]) {
        moves.push({ type: "vertex", index: i, x, y });
      }
    }
    for (const value of [ROTATION_MIN, 45, 90, ROTATION_MAX]) {
      moves.push({ type: "rotation", value });
    }
    for (const key of OPTION_KEYS) {
      moves.push({ type: "option", key, value: !state[key] });
    }
    return moves;
  }

  /** Pure state transition. The named points are A=0, B=1, C=2. */
  function move(state, action) {
    if (!action) return state;
    if (action.type === "reset") return start({});
    if (action.type === "right") {
      const A = copyPoint(state.A);
      const B = copyPoint(state.B);
      const ab = sub(B, A);
      const len = Math.sqrt(dot(ab, ab));
      const perp = point(-ab.y / len, ab.x / len);
      const up = perp.y > 0 ? scale(perp, -1) : perp;
      const C = add(midpoint(A, B), scale(up, len / 2));
      return Object.assign(snapshot(state), { A, B, C, rotation: 0, explored: true });
    }
    if (action.type === "select") {
      const index = clamp(Math.round(action.index), 0, 2);
      return Object.assign(snapshot(state), { selected: index });
    }
    if (action.type === "vertex") {
      const index = clamp(Math.round(action.index), 0, 2);
      const p = point(clamp(action.x, 8, WIDTH - 8), clamp(action.y, 8, HEIGHT - 8));
      const vertices = [copyPoint(state.A), copyPoint(state.B), copyPoint(state.C)];
      vertices[index] = p;
      // mousePressed() in the applet stops the rotation on any drag.
      return Object.assign(snapshot(state), {
        A: vertices[0], B: vertices[1], C: vertices[2],
        rotation: 0, selected: index, explored: true,
      });
    }
    if (action.type === "rotation") {
      const value = clamp(Math.round(action.value), ROTATION_MIN, ROTATION_MAX);
      return Object.assign(snapshot(state), { rotation: value, explored: true });
    }
    if (action.type === "option" && OPTION_KEYS.indexOf(action.key) >= 0) {
      const next = snapshot(state);
      next[action.key] = Boolean(action.value);
      // itemStateChanged() sets Rotate=false and calls ResetScroll().
      next.rotation = 0;
      next.explored = true;
      return next;
    }
    return state;
  }

  /** A demo has no loser: it is "done" once the player has explored it. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    WIDTH, HEIGHT, ROTATION_MIN, ROTATION_MAX, ROTATION_STEP, OPTION_KEYS,
    point, add, sub, scale, dot, cross, dist, dist2, midpoint, area, signedArea2,
    rotate, turn, squareOn, clamp,
    start, snapshot, geometry, legalMoves, move, result,
  };
})();
