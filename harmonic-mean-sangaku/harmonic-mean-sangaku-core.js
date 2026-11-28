"use strict";

/*
 * Harmonic Mean Sangaku, from Alexander Bogomolny's applet HarmonicMeanSangaku.
 *
 * Two upright walls AE (left) and BD (right) stand on the same ground line AB.
 * The ladders AD and BE cross at P; C is the point of the ground directly
 * below P. The surprising fact on the page is that CP does not depend on how
 * far apart the walls are, and in fact 1/CP = 1/AE + 1/BD.
 *
 * The code keeps four draggable points A, B, D, E. Dragging a point applies
 * exactly the fix-ups in the applet's UpgradePoints: the ground stays level
 * and each wall stays upright. P is the intersection of the two infinite
 * lines AD and BE, using the same determinant test as GeoSDoub.Intersect.
 * All lengths are directed: y grows downwards on the screen, so a wall that
 * is pulled below the ground simply has a negative length.
 *
 * No document, no window, no storage: this file defines one global so the
 * page loads it with a plain <script> and Node loads it in the logic test.
 */

const HarmonicMeanSangakuCore = (() => {
  const HANDLES = ["A", "B", "D", "E"];
  const DIAGONAL_DET_MIN = 1; // GeoSDoub.Intersect: |det| < 1 gives NaN

  const copy = (p) => ({ x: p.x, y: p.y });

  /**
   * Intersection of the infinite lines a-b and c-d, transcribed from
   * GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint).
   */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y;
    const b1 = b.x - a.x;
    const c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y;
    const b2 = d.x - c.x;
    const c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - b1 * a2;
    if (!(Math.abs(det) >= DIAGONAL_DET_MIN)) return { x: NaN, y: NaN };
    return {
      x: (b1 * c2 - c1 * b2) / det,
      y: (c1 * a2 - c2 * a1) / det,
    };
  }

  /** The applet's Compute: skip when the wall feet are less than a pixel apart. */
  function recompute(state) {
    if (Math.abs(state.A.x - state.B.x) < 1) return state;
    const P = intersect(state.A, state.D, state.B, state.E);
    return { ...state, P, C: { x: P.x, y: state.A.y } };
  }

  /** The starting picture: the canvas size and integer divisions of init(). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 500 : o.width;
    const height = o.height === undefined ? 400 : o.height;
    const ground = Math.trunc((height * 5) / 6);
    const inset = Math.trunc(width / 6);
    const size = Math.trunc(Math.min(width, height) / 7);
    const A = { x: inset, y: ground };
    const B = { x: width - inset, y: ground };
    const D = { x: B.x, y: B.y - size };
    const E = { x: A.x, y: A.y - 2 * size };
    const show = o.show === undefined ? true : !!o.show;
    return recompute({
      width, height, A, B, D, E,
      showNames: o.showNames === undefined ? show : !!o.showNames,
      showHint: o.showHint === undefined ? show : !!o.showHint,
      checked: false,
      drags: 0,
    });
  }

  /**
   * A drag of one of the four points, with the applet's UpgradePoints fix-ups
   * applied: dragging a wall foot levels the ground with the other foot, and
   * dragging a top moves the foot of that same wall sideways.
   */
  function withPoint(state, name, point) {
    const p = copy(point);
    let A = copy(state.A), B = copy(state.B), D = copy(state.D), E = copy(state.E);
    if (name === "B") {
      B = p;
      A = { x: A.x, y: B.y };
      D = { x: B.x, y: D.y };
    } else if (name === "A") {
      A = p;
      B = { x: B.x, y: A.y };
      E = { x: A.x, y: E.y };
    } else if (name === "D") {
      D = p;
      B = { x: D.x, y: B.y };
    } else if (name === "E") {
      E = p;
      A = { x: E.x, y: A.y };
    } else {
      return state;
    }
    return recompute({ ...state, A, B, D, E, checked: false, drags: state.drags + 1 });
  }

  /** The named handles a player can move. */
  function legalMoves(state) {
    return HANDLES.slice();
  }

  /** Move form used by the page: { name, point }. */
  function move(state, m) {
    return m ? withPoint(state, m.name, m.point) : null;
  }

  /** Directed lengths, foot distances and the two sides of the page's claim. */
  function measure(state) {
    const { A, B, D, E, P, C } = state;
    const ae = A.y - E.y;
    const bd = B.y - D.y;
    const cp = P ? A.y - P.y : NaN;
    const ac = P ? P.x - A.x : NaN;
    const bc = P ? B.x - P.x : NaN;
    const finite = [ae, bd, cp, ac, bc].every(Number.isFinite);
    const harmonic = (2 * ae * bd) / (ae + bd);
    const left = 1 / cp;
    const right = 1 / ae + 1 / bd;
    const residual = Math.abs(left - right);
    return {
      ae, bd, cp, ac, bc, harmonic,
      wall: B.x - A.x,
      left, right, residual,
      finite,
      holds: finite && ae !== 0 && bd !== 0 && cp !== 0 && residual < 1e-8,
      parallel: !Number.isFinite(P ? P.x : NaN),
      tooClose: Math.abs(A.x - B.x) < 1,
    };
  }

  /** The page's picture has no win or loss; this only marks it as explored. */
  function checkClaim(state) {
    const m = measure(state);
    return { ...state, checked: m.holds };
  }

  function result(state) {
    return state.checked ? "done" : null;
  }

  return {
    start, withPoint, legalMoves, move, measure, checkClaim, result, intersect, recompute,
  };
})();
