"use strict";

/*
 * Midline in Similar Triangles, from Alexander Bogomolny's applet
 * MidlineInSimTris (a problem of Ayoub B. Ayoub, Math Magazine, 2001).
 *
 * On the sides of triangle ABC, three similar and similarly turned triangles
 * AKB, BLC and CNA are drawn. D is the midpoint of AB, E of KL, and F of BC.
 * The claim: DE is parallel to CN and half as long; indeed D - E = (N - C) / 2.
 *
 * Writing points as complex numbers, the triangles being similar and similarly
 * turned means one spiral similarity, with centre the start of each side,
 * takes the side to the apex: K = A + z (B - A), L = B + z (C - B), N = C + z
 * (A - C) for one complex number z (its size is the ratio, its argument the
 * turn; a negative real part turns the triangles inwards). The player drags
 * A, B, C and L, so z = (L - B) / (C - B) is read from where L is.
 *
 * The position is plain data: { A, B, C, L } with each { x, y } on a
 * WIDTH by HEIGHT board (y down).
 */
const MidlineCore = (() => {
  const WIDTH = 400, HEIGHT = 300;

  /** The applet's first picture: C and B along the top, A below, L above BC. */
  function start() {
    return {
      A: { x: Math.floor((WIDTH * 2) / 3), y: Math.floor((HEIGHT * 7) / 8) },
      B: { x: WIDTH - WIDTH / 5, y: HEIGHT / 4 },
      C: { x: WIDTH / 5, y: HEIGHT / 4 },
      L: { x: WIDTH / 2, y: Math.floor(HEIGHT / 8) },
    };
  }

  const NAMES = ["A", "B", "C", "L"];

  /* complex arithmetic on {x, y} */
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const mul = (p, q) => ({ x: p.x * q.x - p.y * q.y, y: p.x * q.y + p.y * q.x });
  const div = (p, q) => { const d = q.x * q.x + q.y * q.y; return { x: (p.x * q.x + p.y * q.y) / d, y: (p.y * q.x - p.x * q.y) / d }; };
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** The spiral similarity z read from the position (null when B = C). */
  function ratio(state) {
    const bc = sub(state.C, state.B);
    if (Math.hypot(bc.x, bc.y) < 1e-9) return null;
    return div(sub(state.L, state.B), bc);
  }

  /** All the constructed points, or null if B = C. */
  function compute(state) {
    const z = ratio(state);
    if (!z) return null;
    const { A, B, C, L } = state;
    const K = add(A, mul(z, sub(B, A)));
    const N = add(C, mul(z, sub(A, C)));
    const D = mid(A, B), E = mid(K, L), F = mid(B, C);
    return { A, B, C, K, L, N, D, E, F, z };
  }

  /** Is DE parallel to CN, and DE / CN? (parallel: zero cross product, up to a tolerance). */
  function claim(c) {
    const de = sub(c.E, c.D), cn = sub(c.N, c.C);
    const cross = de.x * cn.y - de.y * cn.x;
    const len = Math.hypot(cn.x, cn.y);
    return { cross, ratio: len < 1e-9 ? null : Math.hypot(de.x, de.y) / len, parallel: Math.abs(cross) <= 1e-9 * Math.max(1, len * len), vectorHalf: Math.hypot(de.x + cn.x / 2, de.y + cn.y / 2) < 1e-9 * Math.max(1, len) };
  }

  /** Are the triangles drawn outward? (L on the other side of BC from A.) */
  function outward(state) {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return cross(state.B, state.C, state.L) * cross(state.B, state.C, state.A) < 0;
  }

  /** Move a point (A, B, C or L), keeping it on the board. null for an unknown point. */
  function move(state, name, x, y) {
    if (!NAMES.includes(name) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { ...state, [name]: { x: Math.max(0, Math.min(WIDTH, x)), y: Math.max(0, Math.min(HEIGHT, y)) } };
  }

  return { WIDTH, HEIGHT, NAMES, start, ratio, compute, claim, outward, move, dist };
})();
