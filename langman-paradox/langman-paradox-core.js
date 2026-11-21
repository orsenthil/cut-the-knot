"use strict";

/*
 * Langman's Paradox, from Bogomolny's applet LangmanParadox.
 *
 * Harry Langman's dissection turns an F(n) by F(n) square into an
 * F(n-1) by F(n+1) rectangle using the same Fibonacci pieces. Cassini's
 * identity says the areas differ by exactly one square unit; the missing unit
 * shows up as a thin gap along the sloping join. The applet's "Cheat" box
 * exaggerates that gap so it can be seen for small n.
 *
 * The key idea is that the pieces keep their areas: only the outline of the
 * rearrangement is false. The logic test checks both arrangements by the
 * shoelace formula, the Cassini discrepancy for n = 4..12 and the cheat
 * setting's effect on the drawn gap alone.
 *
 * No document, no window, no storage: one global, LangmanParadoxCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const LangmanParadoxCore = (() => {
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
    return { n: 6, cheat: false };
  }

  function config(n) {
    const index = clamp(n, 6);
    const f = fibonacci(index);
    const a = fibonacci(index - 1);
    const b = fibonacci(index - 2);
    return { n: index, f, a, b, squareArea: f * f, rectangleArea: a * (f + a) };
  }

  function squarePieces(n) {
    const { f, a } = config(n);
    return [
      { name: "red", points: [{ x: 0, y: 0 }, { x: f, y: 0 }, { x: f, y: a }, { x: 0, y: a }] },
      { name: "olive", points: [{ x: 0, y: a }, { x: f, y: a }, { x: 0, y: f }] },
      { name: "blue", points: [{ x: 0, y: f }, { x: f, y: a }, { x: f, y: f }] },
    ];
  }

  function rectanglePieces(n) {
    const { f, a } = config(n);
    return [
      { name: "red", points: [{ x: 0, y: 0 }, { x: f, y: 0 }, { x: f, y: a }, { x: 0, y: a }] },
      { name: "olive", points: [{ x: f, y: 0 }, { x: f + a, y: 0 }, { x: f, y: a }] },
      { name: "blue", points: [{ x: f + a, y: 0 }, { x: f + a, y: a }, { x: f, y: a }] },
    ];
  }

  /** A sliver along the false diagonal; Cheat makes it visually thicker. */
  function sliver(n, cheat) {
    const { f, a } = config(n);
    const width = cheat ? 0.55 : 0.09;
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
    return {
      ...c,
      square, rectangle,
      pieceTotal,
      drawnTotal: rectangle.reduce((s, p) => s + p.area, 0),
      discrepancy: c.squareArea - c.rectangleArea,
      cassini: c.f ** 2 - c.a * (c.f + c.a),
      conserved: Math.abs(pieceTotal - c.squareArea) < 1e-9,
      sliver: sliver(state.n, state.cheat),
      cheat: state.cheat,
    };
  }

  function setN(state, value) { return { ...state, n: clamp(value, state.n) }; }
  function toggleCheat(state) { return { ...state, cheat: !state.cheat }; }

  return {
    MIN_N, MAX_N, fibonacci, clamp, polygonArea, start, config,
    squarePieces, rectanglePieces, sliver, analyze, setN, toggleCheat,
  };
})();
