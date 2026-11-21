"use strict";

/*
 * Fibonacci numbers in an equilateral triangle, from Alexander Bogomolny's applet
 * EquilateralFibonacci (after B. McCartin and H. Walser, "Fibonacci Trapezoids").
 *
 * Take an equilateral triangle of side N cut into unit triangles. Colour the top
 * triangle and the one below it on the right edge; then colour isosceles
 * trapezoids, alternately hanging on the left and on the right edge, each of them
 * as tall as the next Fibonacci number. The rows they end on are 1, 2, 3, 5, 8, 13,
 * 21, ...; the top, the sides and the base of each trapezoid are three consecutive
 * Fibonacci numbers (a trapezoid with 60 degree angles has base = top + side, which
 * is the Fibonacci rule F(k+2) = F(k) + F(k+1)).
 *
 * The applet's construction (FillFib), in lattice coordinates (row i, place j) with
 * the apex at (0, 0): the point (i, j) is at x = j - i/2, y = i * sqrt(3)/2, in units
 * of one lattice side. With Fib = 1, 1, 2, 3, 5, 8, ...:
 *   the top triangle (0,0) (1,0) (1,1) and the triangle (1,1) (2,1) (2,2) are drawn at
 *   once; then for i = 1, 2, ... (up to 9), with a = 2 at the start:
 *     left trapezoid  rows a..b, b = a + Fib[2i-1]:   (a,0) (b,0) (b,Fib[2i]) (a,Fib[2i-2])
 *     right trapezoid rows b..c, c = b + Fib[2i]:     (b,Fib[2i]) (c,Fib[2i]) (c,c) (b,b)
 * and it stops as soon as a row would pass N. The spinner for N runs from 5 to 145 in
 * steps of 5 and opens on 20. The position is plain data; functions return new objects.
 */
const EquilateralFibonacciCore = (() => {
  const MIN_N = 5;
  const MAX_N = 145;
  const STEP = 5;
  const START_N = 20;
  const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

  /** A new position. */
  function start(options) {
    const o = options || {};
    const n = Number.isFinite(Number(o.n)) ? snap(Number(o.n)) : START_N;
    return { n, moves: 0, explored: false };
  }
  const snap = (v) => Math.max(MIN_N, Math.min(MAX_N, Math.round(v / STEP) * STEP));

  /** The lattice point (row i, place j) as plane coordinates in lattice units (y down). */
  const plane = (i, j) => [j - i / 2, (i * Math.sqrt(3)) / 2];

  const shape = (kind, side, k, pts, extra) => ({ kind, side, k, points: pts, ...extra });

  /** The coloured shapes for a triangle of side n, in the applet's order. */
  function shapes(n) {
    const out = [];
    out.push(shape("triangle", "top", 0, [[0, 0], [1, 0], [1, 1]], { rows: [0, 1], top: 0, leg: 1, base: 1 }));
    out.push(shape("triangle", "right", 0, [[1, 1], [2, 1], [2, 2]], { rows: [1, 2], top: 0, leg: 1, base: 1 }));
    let a = 2, b = 2;
    for (let i = 1; i < 10; i++) {
      a = b; b = a + FIB[2 * i - 1];
      if (b > n) break;
      out.push(shape("trapezoid", "left", i, [[a, 0], [b, 0], [b, FIB[2 * i]], [a, FIB[2 * i - 2]]], { rows: [a, b], top: FIB[2 * i - 2], leg: FIB[2 * i - 1], base: FIB[2 * i] }));
      a = b; b = a + FIB[2 * i];
      if (b > n) break;
      out.push(shape("trapezoid", "right", i, [[a, FIB[2 * i]], [b, FIB[2 * i]], [b, b], [a, a]], { rows: [a, b], top: a - FIB[2 * i], leg: FIB[2 * i], base: b - FIB[2 * i] }));
    }
    return out;
  }

  /** Euclidean length of a lattice segment between two (row, place) points, in lattice units. */
  function length(p, q) {
    const [x1, y1] = plane(p[0], p[1]), [x2, y2] = plane(q[0], q[1]);
    return Math.hypot(x2 - x1, y2 - y1);
  }

  /** The shape's measured sides from its corners: top, legs and base, as lengths. */
  function measure(sh) {
    const p = sh.points;
    if (sh.kind === "triangle") return { top: 0, leg: length(p[0], p[1]), base: length(p[1], p[2]), legs: [length(p[0], p[1]), length(p[0], p[2])] };
    // the left trapezoid's corners are (a,0) (b,0) (b,base) (a,top); the right one's are (a,f) (b,f) (b,b) (a,a)
    const sides = p.map((q, k) => length(q, p[(k + 1) % 4]));
    return sides; // four lengths round the polygon
  }

  /** Moves: {type:"n", value} (snapped to a multiple of 5 between 5 and 145), {type:"step", dir:+1|-1}, {type:"reset"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "n") { const v = Number(m.value); if (!Number.isFinite(v)) return null; return { n: snap(v), moves: s.moves + 1, explored: true }; }
    if (m.type === "step") { const n = s.n + (m.dir < 0 ? -STEP : STEP); if (n < MIN_N || n > MAX_N) return null; return { n, moves: s.moves + 1, explored: true }; }
    if (m.type === "reset") return start({});
    return null;
  }

  const legalMoves = (s) => [s.n > MIN_N ? { type: "step", dir: -1 } : null, s.n < MAX_N ? { type: "step", dir: 1 } : null].filter(Boolean);
  const result = (s) => (s.explored ? "done" : null);

  return { MIN_N, MAX_N, STEP, START_N, FIB, start, shapes, plane, length, measure, move, legalMoves, result };
})();
