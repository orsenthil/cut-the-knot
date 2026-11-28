"use strict";

/*
 * Menelaus From Ceva — the illustration on Bogomolny's page of that name.
 *
 * A triangle ABC has three points on its side lines: E on AC, D on BC and F
 * on AB. The applet begins with E two thirds of the way from A to C, D one
 * third of the way from B to C, and F where the line DE meets AB. Dragging a
 * corner or one of the three side points always rebuilds just enough of the
 * picture to keep F, D and E on one straight line. The page proves that this
 * collinearity is the same as Menelaus' product
 *   (AF/BF)(BD/CD)(CE/AE) = 1
 * by applying Ceva's theorem in six triangles. "Show add-ons" draws the
 * extra cevians and their crossings X, Y, Z used in that proof.
 *
 * This is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global, MenelausFromCevaCore, so the page loads it
 * with a plain <script> and porting/check-menelaus-from-ceva.mjs loads it in
 * Node. Positions are plain data and can be handed to the tutor as they are.
 */
const MenelausFromCevaCore = (() => {
  const WIDTH = 400;               // the applet's own default WIDTH parameter
  const HEIGHT = 300;              // the applet's own default HEIGHT parameter
  const SIDE = { E: ["A", "C"], D: ["B", "C"], F: ["A", "B"] };
  const HANDLES = ["A", "B", "C", "D", "E", "F"];

  const copy = (p) => ({ x: p.x, y: p.y });
  const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
  /** Java's (int) cast truncates towards zero, unlike Math.floor. */
  const jint = (v) => (v < 0 ? Math.ceil(v) : Math.floor(v));

  /** MenelausFromCevaCanvas.GetPoint(i): the three original corner offsets. */
  function getPoint(i, width, height) {
    const w = width === undefined ? WIDTH : width;
    const h = height === undefined ? HEIGHT : height;
    const r = jint(Math.min(w, h) / 5);
    let x = jint(w / 2 + r * Math.cos((2 * Math.PI * (i - 1)) / 3));
    let y = jint(h / 2 + r * Math.sin((2 * Math.PI * (i - 1)) / 3) + 40);
    if (i === 0) { x -= 70; y += 60; }
    if (i === 1) x += 100;
    if (i === 2) x -= 200;
    return { x: x, y: y };
  }

  /** MoveableLinComb(p, q, t) = t*p + (1-t)*q, transcribed from the bytecode. */
  function linComb(p, q, t) {
    return {
      x: t * p.x + (1 - t) * q.x,
      y: t * p.y + (1 - t) * q.y,
    };
  }

  /**
   * GeoSDoub.Intersect(p, q, r, s): the crossing of the two infinite lines.
   * The applet returns NaN coordinates when the determinant is below 1.
   */
  function intersect(p, q, r, s) {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const d = r.y - s.y, e = s.x - r.x, f = r.x * s.y - r.y * s.x;
    const det = a * e - d * b;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b * f - e * c) / det, y: (c * d - f * a) / det };
  }

  /**
   * GeoSDoub.NearestPoint(p, a, b), the restriction used by E, D and F.
   * The applet leaves the point alone when it is within sqrt(0.1) of a.
   */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const sq = (a.x - p.x) * (a.x - p.x) + (a.y - p.y) * (a.y - p.y);
    if (sq >= 0.1 && dx * dx + dy * dy !== 0) {
      const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
      return { x: a.x + dx * t, y: a.y + dy * t };
    }
    return copy(p);
  }

  /** The position a new picture starts from. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const corners = o.corners
      ? { A: copy(o.corners.A), B: copy(o.corners.B), C: copy(o.corners.C) }
      : { A: getPoint(0, width, height), B: getPoint(1, width, height), C: getPoint(2, width, height) };
    const E = linComb(corners.A, corners.C, 2 / 3);
    const D = linComb(corners.B, corners.C, 1 / 3);
    const state = {
      A: corners.A, B: corners.B, C: corners.C, E: E, D: D,
      F: intersect(corners.A, corners.B, D, E),
      showAddOns: Boolean(o.showAddOns), selected: null,
    };
    return state;
  }

  /** All six drawn points, in board units, for the page and for the tutor. */
  function points(state) {
    const out = {};
    for (const name of HANDLES) out[name] = copy(state[name]);
    return out;
  }

  /** UpdateLocation of the dragged dot: a free corner, or a point on a side. */
  function movePoint(state, name, delta) {
    const p = state[name];
    const q = { x: p.x + delta.x, y: p.y + delta.y };
    const side = SIDE[name];
    return side ? nearestPoint(q, state[side[0]], state[side[1]]) : q;
  }

  /**
   * IsHit(p.x, p.y) followed by UpdateLocation(p.x, p.y) on a restricted dot:
   * the dot stays where it is except that it snaps to the (moved) side line.
   */
  function refresh(state, name) {
    const side = SIDE[name];
    return side ? nearestPoint(state[name], state[side[0]], state[side[1]]) : copy(state[name]);
  }

  /**
   * MenelausFromCevaCanvas.DrawMenelausFromCeva's update chain. Dragging A
   * refreshes E and rebuilds F; dragging C refreshes D and rebuilds E;
   * dragging B refreshes F and rebuilds D; dragging a side dot rebuilds the
   * next one in the cycle E -> D -> F -> E. The three dots stay collinear.
   */
  function drag(state, name, delta) {
    if (!state[name]) return state;
    const next = { ...state, [name]: movePoint(state, name, delta), selected: name };
    let flag = 0;
    if (name === "A") { next.E = refresh(next, "E"); flag = 3; }
    else if (name === "C") { next.D = refresh(next, "D"); flag = 2; }
    if (name === "B") { next.F = refresh(next, "F"); flag = 1; }
    if (name === "F" || flag === 2) next.E = intersect(next.F, next.D, next.A, next.C);
    if (name === "D" || flag === 3) next.F = intersect(next.D, next.E, next.B, next.A);
    if (name === "E" || flag === 1) next.D = intersect(next.E, next.F, next.C, next.B);
    return next;
  }

  /** The signed fraction of a point along the directed line a -> b. */
  function parameter(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return NaN;
    return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  }

  /** Directed length PQ / QR when P, Q and R lie on one line. */
  function signedRatio(P, Q, R) {
    const dx = R.x - P.x, dy = R.y - P.y;
    const den = (R.x - Q.x) * dx + (R.y - Q.y) * dy;
    if (den === 0) return NaN;
    return ((Q.x - P.x) * dx + (Q.y - P.y) * dy) / den;
  }

  /** The page's Menelaus product, with directed segments, from side fractions. */
  function ratios(state) {
    const u = parameter(state.F, state.A, state.B);
    const v = parameter(state.D, state.B, state.C);
    const w = parameter(state.E, state.C, state.A);
    const AF_BF = u / (u - 1);
    const BD_CD = v / (v - 1);
    const CE_AE = w / (w - 1);
    return {
      u: u, v: v, w: w,
      AF_BF: AF_BF, BD_CD: BD_CD, CE_AE: CE_AE,
      product: AF_BF * BD_CD * CE_AE,
    };
  }

  /** E, D and F on one line? The cross product is scaled to be unit-free. */
  function collinear(state) {
    const e = state.E, d = state.D, f = state.F;
    if (!finite(e) || !finite(d) || !finite(f)) return false;
    const ax = e.x - d.x, ay = e.y - d.y, bx = f.x - d.x, by = f.y - d.y;
    const scale = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (scale === 0) return false;
    return Math.abs(ax * by - ay * bx) <= 1e-9 * scale;
  }

  /** The page's X, Y and Z, from the bytecode's Intersect calls. */
  function crossings(state) {
    return {
      X: intersect(state.B, state.E, state.A, state.D),
      Y: intersect(state.A, state.D, state.C, state.F),
      Z: intersect(state.B, state.E, state.C, state.F),
    };
  }

  /** The six Ceva identities in the page's table, each equal to 1. */
  function cevaIdentities(state) {
    const { A, B, C, D, E, F } = state;
    const x = crossings(state);
    return {
      one: signedRatio(A, F, B) * signedRatio(B, x.X, E) * signedRatio(E, C, A),
      two: signedRatio(C, E, A) * signedRatio(A, x.Y, D) * signedRatio(D, B, C),
      three: signedRatio(B, D, C) * signedRatio(C, x.Z, F) * signedRatio(F, A, B),
      four: signedRatio(E, x.X, B) * signedRatio(B, C, D) * signedRatio(D, F, E),
      five: signedRatio(D, x.Y, A) * signedRatio(A, B, F) * signedRatio(F, E, D),
      six: signedRatio(F, x.Z, C) * signedRatio(C, A, E) * signedRatio(E, D, F),
    };
  }

  /** Everything the page says under the picture, in one plain-data object. */
  function evaluate(state) {
    const r = ratios(state);
    return {
      points: points(state),
      ratios: r,
      collinear: collinear(state),
      crossings: crossings(state),
      identities: cevaIdentities(state),
    };
  }

  function format(value, digits) {
    if (!Number.isFinite(value)) return String(value);
    const d = Math.max(0, Math.min(6, jint(digits === undefined ? 3 : digits)));
    return value.toFixed(d).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  /** An illustration: there is no win and no loss. */
  function result(/* state */) { return null; }

  return {
    WIDTH, HEIGHT, HANDLES, SIDE,
    getPoint, linComb, intersect, nearestPoint,
    start, points, movePoint, refresh, drag,
    parameter, signedRatio, ratios, collinear, crossings, cevaIdentities,
    evaluate, format, result,
  };
})();
