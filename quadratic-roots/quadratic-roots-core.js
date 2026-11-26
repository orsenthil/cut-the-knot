"use strict";

/*
 * Geometric construction of the roots of a quadratic, from Bogomolny's
 * applet QuadraticRoots (after Adler and Lill).
 *
 * Draw the broken line A(0,a) -> B(0,0) -> C(b,0) -> D(b,c). The circle with
 * diameter AD meets the x-axis where AXD is a right angle. Writing the
 * meeting point as x = a*t gives a*t² - b*t + c = 0. Note the applet's sign
 * convention: it solves ax² - bx + c = 0, not ax² + bx + c = 0, as the page
 * itself explains. All geometry here is plain functions of (a, b, c), with no
 * DOM, no storage and one global, so the Node test can check it exhaustively.
 */
const QuadraticRootsCore = (() => {
  const LIMITS = { a: [-5, 5], b: [-10, 10], c: [-10, 10] };
  const DEFAULTS = { a: 1.5, b: 5, c: 3 };

  function clamp(value, [lo, hi]) {
    const v = Number(value);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : 0;
  }

  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  /** The full construction: points, circle, helper points and both roots. */
  function geometry(position) {
    const { a, b, c } = position;
    const A = { x: 0, y: a };
    const B = { x: 0, y: 0 };
    const C = { x: b, y: 0 };
    const D = { x: b, y: c };
    const center = mid(A, D);
    const radius = dist(A, D) / 2;
    const discriminant = b * b - 4 * a * c;

    /* E is where AD crosses the x-axis; F is where the perpendicular at E
     * meets CD (the vertical line x = b), making angle AEF a right angle. */
    let E = null;
    let F = null;
    if (Math.abs(a - c) > 1e-12) {
      E = { x: (a * b) / (a - c), y: 0 };
      F = { x: b, y: (-b * (b - E.x)) / (c - a) };
    }

    let xRoots = [];
    if (Math.abs(discriminant) < 1e-12) xRoots = [b / 2];
    else if (discriminant > 0) {
      const s = Math.sqrt(discriminant);
      xRoots = [(b - s) / 2, (b + s) / 2];
    }
    const roots = Math.abs(a) > 1e-12
      ? xRoots.map((x) => x / a)
      : (Math.abs(b) > 1e-12 ? [c / b] : []);
    const kind = Math.abs(a) < 1e-12 ? "linear"
      : discriminant < -1e-12 ? "none"
        : Math.abs(discriminant) < 1e-12 ? "double" : "two";

    return { A, B, C, D, center, radius, E, F, xRoots, roots, discriminant, kind };
  }

  /** The position a new demo starts from. */
  function start(options = {}) {
    return {
      a: clamp(options.a ?? DEFAULTS.a, LIMITS.a),
      b: clamp(options.b ?? DEFAULTS.b, LIMITS.b),
      c: clamp(options.c ?? DEFAULTS.c, LIMITS.c),
      showHint: !!options.showHint,
      showNames: !!options.showNames,
      explored: false,
      message: "Move a slider, then watch where the circle meets the line.",
    };
  }

  function explain(position) {
    const g = geometry(position);
    const text = g.kind === "none"
      ? "The circle misses the line: this equation has no real roots."
      : g.kind === "double"
        ? `The circle just touches the line: one double root, ${g.roots[0].toFixed(2)}.`
        : g.kind === "linear"
          ? `With a = 0 this is a line, not a parabola: the root is ${g.roots[0].toFixed(2)}.`
          : `The circle cuts the line twice: roots ${g.roots[0].toFixed(2)} and ${g.roots[1].toFixed(2)}.`;
    return `Solving ${position.a}x² − ${position.b}x + ${position.c} = 0. ${text}`;
  }

  function setCoefficient(position, key, value) {
    if (!(key in LIMITS)) return position;
    const next = { ...position, [key]: clamp(value, LIMITS[key]) };
    return { ...next, explored: true, message: explain(next) };
  }

  function toggle(position, key) {
    if (key !== "showHint" && key !== "showNames") return position;
    const next = { ...position, [key]: !position[key] };
    return { ...next, explored: true, message: explain(next) };
  }

  function reset(position) {
    const next = { ...start(), showHint: position.showHint, showNames: position.showNames };
    return { ...next, explored: true, message: explain(next) };
  }

  /** "done" once the player has explored the construction. */
  function result(position) {
    return position.explored ? "done" : null;
  }

  return {
    LIMITS, DEFAULTS, start, geometry, explain, setCoefficient, toggle,
    reset, result, sub, dot, dist, mid,
  };
})();
