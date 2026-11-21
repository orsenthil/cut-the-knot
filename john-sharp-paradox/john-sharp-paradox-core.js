"use strict";

/*
 * John Sharp's Paradox, from Bogomolny's applet JohnSharpParadox.
 *
 * A square of side F(n) is cut into three pieces: a rectangle F(n-1) by F(n)
 * and two triangles that split the remaining strip along a diagonal. The
 * pieces are rearranged into a rectangle F(n-1) by F(n+1), whose area differs
 * from the square by exactly one square unit. The difference is Cassini's
 * identity: F(n)^2 - F(n-1)F(n+1) = (-1)^n. The missing or extra unit is
 * hidden along the false diagonal, where the slope 5/13 is mimicked by 8/8.
 *
 * The key idea is that the pieces keep their areas; only the outline of the
 * rearranged rectangle is deceptive. The logic test checks the areas by the
 * shoelace formula, Cassini's identity and the one-unit discrepancy for many
 * Fibonacci indices.
 *
 * No document, no window, no storage: one global, JohnSharpParadoxCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const JohnSharpParadoxCore = (() => {
  const MIN_N = 4;
  const MAX_N = 12;

  function fibonacci(n) {
    let a = 0;
    let b = 1;
    for (let i = 0; i < n; i++) [a, b] = [b, a + b];
    return a;
  }

  const clamp = (v, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(MIN_N, Math.min(MAX_N, n)) : fb;
  };

  /** Signed area of a polygon by the shoelace formula. */
  function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  }

  function start() {
    return { n: 7, revealed: false };
  }

  function config(n) {
    const index = clamp(n, 7);
    const f = fibonacci(index);
    const a = fibonacci(index - 1);
    const b = fibonacci(index - 2);
    return { n: index, f, a, b, squareArea: f * f, rectangleArea: a * (f + a) };
  }

  /** The three pieces as cut from the square (y points up). */
  function squarePieces(n) {
    const { f, a } = config(n);
    return [
      { name: "red", points: [{ x: 0, y: 0 }, { x: f, y: 0 }, { x: f, y: a }, { x: 0, y: a }] },
      { name: "olive", points: [{ x: 0, y: a }, { x: f, y: a }, { x: 0, y: f }] },
      { name: "magenta", points: [{ x: 0, y: f }, { x: f, y: a }, { x: f, y: f }] },
    ];
  }

  /** The same pieces placed in the F(n-1) by F(n+1) outline. */
  function rectanglePieces(n) {
    const { f, a } = config(n);
    return [
      { name: "red", points: [{ x: 0, y: 0 }, { x: f, y: 0 }, { x: f, y: a }, { x: 0, y: a }] },
      { name: "olive", points: [{ x: f, y: 0 }, { x: f + a, y: 0 }, { x: f, y: a }] },
      { name: "magenta", points: [{ x: f + a, y: 0 }, { x: f + a, y: a }, { x: f, y: a }] },
    ];
  }

  /** A thin strip along the false diagonal whose area is the discrepancy. */
  function sliver(n) {
    const { f, a } = config(n);
    const width = 0.12; // visual thickness, not to scale with the unit area
    return [
      { x: f, y: a }, { x: f + a, y: 0 },
      { x: f + a, y: width }, { x: f, y: a + width },
    ];
  }

  function analyze(state) {
    const c = config(state.n);
    const square = squarePieces(state.n).map((p) => ({ ...p, area: polygonArea(p.points) }));
    const rectangle = rectanglePieces(state.n).map((p) => ({ ...p, area: polygonArea(p.points) }));
    const pieceTotal = square.reduce((s, p) => s + p.area, 0);
    const drawnTotal = rectangle.reduce((s, p) => s + p.area, 0);
    return {
      ...c,
      square, rectangle,
      pieceTotal,
      drawnTotal,
      discrepancy: c.squareArea - c.rectangleArea,
      cassini: c.f ** 2 - c.a * (c.f + c.a),
      conserved: Math.abs(pieceTotal - c.squareArea) < 1e-9,
      sliver: sliver(state.n),
      revealed: state.revealed,
    };
  }

  function setN(state, value) {
    return { ...state, n: clamp(value, state.n) };
  }
  function reveal(state) {
    return { ...state, revealed: !state.revealed };
  }

  return { MIN_N, MAX_N, fibonacci, clamp, polygonArea, start, config, squarePieces, rectanglePieces, sliver, analyze, setN, reveal };
})();
