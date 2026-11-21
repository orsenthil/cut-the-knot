"use strict";

/*
 * Hooper's Paradox, from Bogomolny's applet HooperParadox.
 *
 * A rectangle is cut into two triangles and two trapezoids. Rearranged, the
 * same four pieces seem to make two rectangles whose total area differs from
 * the original: the classic 3 by 10 rectangle (area 30) becomes a 2 by 6 and
 * a 4 by 5 (32). The trick is that the pieces do not quite line up — a thin
 * gap or overlap is spread along the joins, too small to notice in a drawing.
 *
 * The key idea is area conservation: the pieces keep their total area, so any
 * apparent gain is a geometric illusion. Fibonacci ratios make the mismatch
 * smallest and the deception best. The logic test checks area conservation,
 * the shoelace areas of the pieces and the Fibonacci/Cassini relation.
 *
 * No document, no window, no storage: one global, HooperParadoxCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const HooperParadoxCore = (() => {
  function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  }

  /**
   * Cut a w by h rectangle into four pieces using a sloping line: two triangles
   * at the corners and two trapezoids. `a` is the horizontal leg of a triangle.
   */
  function dissection(w, h, a) {
    const cut = Math.max(1, Math.min(Math.floor(w / 2) - 1, Math.trunc(a)));
    const mid = w / 2;
    const pieces = [
      { name: "triangle 1", points: [{ x: 0, y: 0 }, { x: cut, y: 0 }, { x: 0, y: h }] },
      { name: "triangle 2", points: [{ x: w, y: h }, { x: w - cut, y: h }, { x: w, y: 0 }] },
      { name: "trapezoid 1", points: [{ x: cut, y: 0 }, { x: mid, y: 0 }, { x: mid, y: h }, { x: 0, y: h }] },
      { name: "trapezoid 2", points: [{ x: mid, y: 0 }, { x: w, y: 0 }, { x: w - cut, y: h }, { x: mid, y: h }] },
    ];
    return { w, h, cut, pieces };
  }

  /** The total area of the pieces always equals the original rectangle. */
  function analyze(w, h, a) {
    const d = dissection(w, h, a);
    const areas = d.pieces.map((p) => polygonArea(p.points));
    const pieceTotal = areas.reduce((x, y) => x + y, 0);
    return {
      w, h, cut: d.cut,
      pieces: d.pieces.map((p, i) => ({ name: p.name, points: p.points, area: areas[i] })),
      originalArea: w * h,
      pieceTotal,
      conserved: Math.abs(pieceTotal - w * h) < 1e-9,
    };
  }

  function fibonacci(n) {
    let a = 0;
    let b = 1;
    for (let i = 0; i < n; i++) [a, b] = [b, a + b];
    return a;
  }

  /** Cassini's identity: F(n-1)F(n+1) - F(n)^2 = (-1)^n. */
  function cassini(n) {
    return fibonacci(n - 1) * fibonacci(n + 1) - fibonacci(n) ** 2;
  }

  function start() {
    return { w: 10, h: 3, cut: 4 };
  }

  function set(state, key, value) {
    return { ...state, [key]: Math.max(2, Math.min(20, Math.trunc(Number(value)) || 2)) };
  }

  return { MIN: 2, MAX: 20, polygonArea, dissection, analyze, fibonacci, cassini, start, set };
})();
