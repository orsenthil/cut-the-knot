"use strict";

/*
 * Pick's theorem on a geoboard. The player puts vertices on the nodes of a
 * square lattice, one after another; the last one joins the first. When the
 * sides do not cross, the applet announces B (nodes on the border), I (nodes
 * inside) and the area, which Pick's formula gives as A = I + B/2 - 1.
 *
 * B is counted edge by edge as gcd(|dx|, |dy|), I by testing every node of the
 * board against the polygon (a second way of counting, which is what lets the
 * test below check the formula against the shoelace area).
 *
 * No DOM. The global is PickCore.
 */
var PickCore = (function () {
  const COLS = 14, ROWS = 10;

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }

  function det(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }

  function onSegment(a, b, p) {
    return det(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
  }

  /** Do the closed segments ab and cd share a point? */
  function touch(a, b, c, d) {
    const d1 = det(a, b, c), d2 = det(a, b, d), d3 = det(c, d, a), d4 = det(c, d, b);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
  }

  /** Twice the signed area (shoelace). */
  function area2(poly) {
    let s = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p.x * q.y - q.x * p.y; }
    return s;
  }

  /** A polygon is simple (and has an area) when at least 3 nodes are used, no side meets another except neighbours at their shared vertex. */
  function isSimple(poly) {
    const n = poly.length;
    if (n < 3) return false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (poly[i].x === poly[j].x && poly[i].y === poly[j].y) return false;
    if (area2(poly) === 0) return false;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        const c = poly[j], d = poly[(j + 1) % n];
        if (j === i + 1 || (i === 0 && j === n - 1)) {
          // neighbours: they may only share their common vertex (no folding back along each other)
          const shared = j === i + 1 ? b : a;
          const e1 = j === i + 1 ? a : b, e2 = j === i + 1 ? d : c;
          if (det(shared, e1, e2) === 0 && (e1.x - shared.x) * (e2.x - shared.x) + (e1.y - shared.y) * (e2.y - shared.y) > 0) return false;
        } else if (touch(a, b, c, d)) return false;
      }
    }
    return true;
  }

  /** Nodes on the border: the sum of gcd(|dx|, |dy|) over the sides. */
  function boundary(poly) {
    let b = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; b += gcd(q.x - p.x, q.y - p.y); }
    return b;
  }

  function onBorder(poly, p) {
    for (let i = 0; i < poly.length; i++) if (onSegment(poly[i], poly[(i + 1) % poly.length], p)) return true;
    return false;
  }

  /** Strictly inside by the even-odd rule, for a node not on the border. */
  function inside(poly, p) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }

  /** Classify every node of the board: 0 outside, 1 on the border, 2 inside. */
  function classify(poly, cols, rows) {
    const out = [];
    for (let x = 0; x < cols; x++) {
      out.push([]);
      for (let y = 0; y < rows; y++) {
        const p = { x, y };
        out[x].push(onBorder(poly, p) ? 1 : inside(poly, p) ? 2 : 0);
      }
    }
    return out;
  }

  /** B, I, the area by Pick's formula (twice it, an integer) and the shoelace area, or null when not simple. */
  function measure(poly, cols, rows) {
    if (!isSimple(poly)) return null;
    const grid = classify(poly, cols || COLS, rows || ROWS);
    let b = 0, i = 0;
    grid.forEach((col) => col.forEach((v) => { if (v === 1) b++; else if (v === 2) i++; }));
    return { B: b, I: i, twiceArea: 2 * i + b - 2, shoelace2: Math.abs(area2(poly)), B_gcd: boundary(poly) };
  }

  /** The area as the applet writes it: 5 or 5.5. */
  function areaText(twice) { return twice % 2 === 0 ? String(twice / 2) : Math.floor(twice / 2) + ".5"; }

  function start() { return { poly: [] }; }

  function addNode(s, x, y) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return s;
    if (s.poly.some((p) => p.x === x && p.y === y)) return s;
    return { poly: s.poly.concat([{ x, y }]) };
  }

  function deleteNode(s, x, y) {
    return { poly: s.poly.filter((p) => !(p.x === x && p.y === y)) };
  }

  return { COLS, ROWS, gcd, isSimple, area2, boundary, classify, measure, areaText, start, addNode, deleteNode };
})();
