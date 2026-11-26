"use strict";

/*
 * The Puzzlers' Pigeonhole, first applet: dots on the nodes of a square
 * lattice. The midpoint of two lattice points is a lattice point exactly when
 * their x's have the same parity and their y's have the same parity. There are
 * only four parity classes (odd/odd, odd/even, even/odd, even/even), so among
 * five dots two share a class and the segment between them has a lattice
 * midpoint (and so contains other lattice points). Four dots can avoid it,
 * one in each class. The applet's GetCross finds the first such pair.
 *
 * No DOM. The global is PigeonholeCore.
 */
var PigeonholeCore = (function () {
  const COLS = 12, ROWS = 9;

  function parityClass(p) { return ((p.x % 2) + 2) % 2 * 2 + (((p.y % 2) + 2) % 2); }

  /** The first pair (i, j), i < j in the applet's scan order, whose x and y differences are both even. */
  function findPair(points) {
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const dx = Math.abs(points[i].x - points[j].x), dy = Math.abs(points[i].y - points[j].y);
        if (dx % 2 === 0 && dy % 2 === 0) return [Math.min(i, j), Math.max(i, j)];
      }
    }
    return null;
  }

  /** The midpoint of two lattice points when it is a lattice point, else null. */
  function midpoint(a, b) {
    const sx = a.x + b.x, sy = a.y + b.y;
    return sx % 2 === 0 && sy % 2 === 0 ? { x: sx / 2, y: sy / 2 } : null;
  }

  /** The lattice points strictly between a and b on their segment (it has gcd - 1 of them). */
  function between(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const g = (function gcd(p, q) { return q === 0 ? Math.abs(p) : gcd(q, p % q); })(dx, dy);
    const out = [];
    for (let k = 1; k < g; k++) out.push({ x: a.x + (dx / g) * k, y: a.y + (dy / g) * k });
    return out;
  }

  function same(a, b) { return a.x === b.x && a.y === b.y; }

  function free(points, x, y, except) {
    return x >= 0 && y >= 0 && x < COLS && y < ROWS && !points.some((p, i) => i !== except && p.x === x && p.y === y);
  }

  /** Four dots, one in each parity class: the arrangement that has no pair. */
  function safeFour() { return [{ x: 2, y: 2 }, { x: 5, y: 2 }, { x: 2, y: 5 }, { x: 5, y: 5 }].map((p) => ({ x: p.x, y: p.y })); }

  function start(opts) {
    opts = opts || {};
    const n = opts.n === 4 ? 4 : 5, random = opts.random || Math.random;
    const points = [];
    while (points.length < n) {
      const x = 1 + Math.floor(random() * (COLS - 2)), y = 1 + Math.floor(random() * (ROWS - 2));
      if (free(points, x, y, -1)) points.push({ x, y });
    }
    return { n, points };
  }

  /** Move dot i to node (x, y) when it is free and on the board. */
  function move(s, i, x, y) {
    if (!free(s.points, x, y, i)) return null;
    const points = s.points.map((p, k) => (k === i ? { x, y } : p));
    return { n: s.n, points };
  }

  /** Switch between four and five dots: the new dot goes to a free node; the last one is dropped. */
  function setN(s, n, random) {
    n = n === 4 ? 4 : 5;
    if (n === s.n) return s;
    if (n === 4) return { n, points: s.points.slice(0, 4) };
    const points = s.points.slice();
    const rnd = random || Math.random;
    for (;;) {
      const x = 1 + Math.floor(rnd() * (COLS - 2)), y = 1 + Math.floor(rnd() * (ROWS - 2));
      if (free(points, x, y, -1)) { points.push({ x, y }); break; }
    }
    return { n, points };
  }

  return { COLS, ROWS, parityClass, findPair, midpoint, between, same, free, safeFour, start, move, setN };
})();
