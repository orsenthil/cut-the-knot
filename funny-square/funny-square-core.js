"use strict";

/*
 * Funny Square ("Square From Nowhere"), from Alexander Bogomolny's applet
 * FunnySquare. Three points A, P, R lie on one horizontal line. Q is placed so
 * that AP = QR; perpendiculars at P, Q and R have lengths PR, QR and PQ. The
 * ends B, C, D of those perpendiculars then form a square.
 *
 * The key idea: if u = AP (= QR) and v = PR (= AQ), then, in canvas
 * coordinates (y downward), AB = (v, u) and AD = (u, -v). Their dot product is
 * zero and their lengths are equal, so ABCD is a square. This stays true when
 * P and Q fall outside AR: u and v are then signed lengths, and the same two
 * vectors still work.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, FunnySquareCore, so the page loads it with a
 * plain <script> and porting/check-funny-square.mjs loads it in Node. The
 * position is plain data and every function returns a new position.
 */
const FunnySquareCore = (() => {
  /** The applet's suggested canvas is 600x550; this board keeps its ratios. */
  const WIDTH = 480;
  const HEIGHT = 440;
  const PAD = 16;
  const OPTIONS = ["showNames", "hint", "construction"];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const copy = (p) => ({ x: p.x, y: p.y });

  /** Applet init(): R at (width - width/4, height/2 + height/10), A at width/4. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const quarter = Math.floor(width / 4);
    const tenth = Math.floor(height / 10);
    const y = Math.floor(height / 2) + tenth;
    const a = { x: quarter, y: y };
    const r = { x: width - quarter, y: y };
    const p = { x: a.x + (r.x - a.x) / 3, y: y };
    return {
      width: width, height: height, a: a, p: p, r: r,
      showNames: o.showNames === undefined ? true : !!o.showNames,
      hint: !!o.hint,
      construction: !!o.construction,
    };
  }

  /** The three dots a, p and r can be dragged; the derived points cannot. */
  function legalMoves() {
    return ["a", "p", "r"];
  }

  /**
   * Applet UpdatePoints: the selected dot takes the new x and y, and the y of
   * all three dots follows it. The x of the other two dots stays put.
   */
  function move(state, m) {
    if (!m || legalMoves().indexOf(m.handle) < 0) return null;
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
    const next = { ...state };
    next[m.handle] = {
      x: clamp(m.x, PAD, state.width - PAD),
      y: clamp(m.y, PAD, state.height - PAD),
    };
    const y = next[m.handle].y;
    next.a = { ...next.a, y: y };
    next.p = { ...next.p, y: y };
    next.r = { ...next.r, y: y };
    return next;
  }

  /** The page's New diagram button: a fresh board with the same settings. */
  function reset(state) {
    return start({
      width: state.width, height: state.height,
      showNames: state.showNames, hint: state.hint, construction: state.construction,
    });
  }

  /** A picture has no winner: it is finished as soon as it has been explored. */
  function result() {
    return null;
  }

  /** The three checkboxes of the original panel. */
  function toggle(state, key) {
    if (OPTIONS.indexOf(key) < 0) return null;
    return { ...state, [key]: !state[key] };
  }

  /** Applet Compute(), following the page's AP = QR relation. */
  function compute(state) {
    const left = state.a.x <= state.r.x ? copy(state.a) : copy(state.r);
    const right = state.a.x <= state.r.x ? copy(state.r) : copy(state.a);
    const P = copy(state.p);
    // AP = QR, so Q sits QR = AP back from R. The old bytecode used
    // R.x - P.x - A.x, which only agrees when A.x is 0; see the maths section.
    const Q = { x: right.x - (P.x - left.x), y: P.y };
    const D = { x: P.x, y: P.y - (Q.x - left.x) }; // PD = PR = AQ
    const B = { x: Q.x, y: Q.y + (right.x - Q.x) }; // QB = QR = AP
    const C = { x: right.x, y: right.y - (Q.x - P.x) }; // RC = PQ
    const T = { x: right.x, y: B.y }; // BT || AR, on the extension of RC
    return { A: left, R: right, P: P, Q: Q, D: D, B: B, C: C, T: T };
  }

  /** Lengths and corner dot products used by the page's status line. */
  function metrics(f) {
    const len = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
    const dot = (v, p, q) =>
      (p.x - v.x) * (q.x - v.x) + (p.y - v.y) * (q.y - v.y);
    return {
      AP: len(f.A, f.P), QR: len(f.Q, f.R),
      PR: len(f.P, f.R), AQ: len(f.A, f.Q),
      PD: len(f.P, f.D), QB: len(f.Q, f.B),
      RC: len(f.R, f.C), PQ: len(f.P, f.Q),
      RT: len(f.R, f.T), CT: len(f.C, f.T), BT: len(f.B, f.T),
      sides: [len(f.A, f.B), len(f.B, f.C), len(f.C, f.D), len(f.D, f.A)],
      corners: [dot(f.A, f.B, f.D), dot(f.B, f.A, f.C),
        dot(f.C, f.B, f.D), dot(f.D, f.C, f.A)],
    };
  }

  /** Plain board-unit data for the player's record and the tutor. */
  function position(state) {
    return {
      a: copy(state.a), p: copy(state.p), r: copy(state.r),
      showNames: state.showNames, hint: state.hint, construction: state.construction,
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, PAD: PAD,
    start: start, reset: reset, legalMoves: legalMoves, move: move, result: result,
    toggle: toggle, compute: compute, metrics: metrics, position: position,
  };
})();
