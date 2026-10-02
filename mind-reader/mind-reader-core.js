"use strict";

/*
 * Pure logic for the Mind Reader (an arithmetic magic trick), ported from the
 * decompiled MindReaderNineCanvas.java of MindReaderNine.zip (Alexander
 * Bogomolny, cut-the-knot.org). No DOM, so it can be checked in Node.
 *
 * The table holds the numbers 0..98 in 11 columns and 9 rows, each with one of
 * 16 shapes. Every cell gets a random shape, then the cells 0, 9, 18, ..., 81
 * are all given the same "special" shape. A 2-digit number 10a + b minus its
 * digit sum is (10a + b) - (a + b) = 9a, a multiple of 9 between 9 and 81,
 * so whatever number the player picks, their result sits on the special
 * shape. Other cells can land on the special shape by chance too, as in the
 * original.
 *
 * Shapes are drawn as outlines inside a box (x, y, w, h), with the same
 * proportions and 4-unit margins as the applet's Shape.Draw_* methods, and
 * returned as SVG path data.
 */
const MindReader = (() => {
  const N = 10;
  const COLS = 11;
  const ROWS = 9;
  const CELLS = N * N - 1; // numbers 0..98

  const SHAPES = [
    "square", "triangle", "pentagon", "star", "circle", "star of David",
    "rhombus", "parallelogram", "rectangle", "oval", "dart", "hexagon",
    "envelope", "crossed diamond", "wheel", "split parallelogram",
  ];

  // The cells forced to the special shape: 9 * i for i = 0..N-1.
  function magicCells() {
    const cells = [];
    for (let i = 0; i < N; i++) cells.push(9 * i);
    return cells;
  }

  // Reset(): a random special shape, random shapes everywhere, then the
  // multiples of 9 overwritten with the special one.
  function newTable(random = Math.random) {
    const pick = () => Math.floor(random() * SHAPES.length);
    const special = pick();
    const figs = [];
    for (let i = 0; i < CELLS; i++) figs.push(pick());
    for (const c of magicCells()) figs[c] = special;
    return { special, figs };
  }

  function digitSumResult(num) {
    return num - (Math.floor(num / 10) + (num % 10));
  }

  // ---- shapes as SVG path data ----

  const f = (v) => +v.toFixed(2);
  const M = (x, y) => `M${f(x)} ${f(y)}`;
  const L = (x, y) => `L${f(x)} ${f(y)}`;

  function poly(pts, close = true) {
    return pts.map(([x, y], i) => (i ? L(x, y) : M(x, y))).join("") + (close ? "Z" : "");
  }

  function line(x1, y1, x2, y2) {
    return M(x1, y1) + L(x2, y2);
  }

  function ellipse(cx, cy, rx, ry) {
    return `${M(cx - rx, cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
  }

  // Regular {n/step} star polygon of radius min(w,h)/3; odd n point up.
  function nGon(x, y, w, h, n, step) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 3;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI / 2) * (n % 2 === 1 ? 1 : 0) + ((2 * Math.PI) / n) * i;
      pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]);
    }
    let d = "";
    for (let i = 0; i < n; i++) d += line(...pts[i], ...pts[(i + step) % n]);
    return d;
  }

  function circle(x, y, w, h) {
    const r = Math.min(w, h) / 3;
    return ellipse(x + w / 2, y + h / 2, r, r);
  }

  // Equilateral triangle (side 2/3 of the box), apex up.
  function triangle(x, y, w, h) {
    const s = (Math.min(w, h) * 2) / 3;
    const th = (s * Math.sqrt(3)) / 2;
    const x0 = x + (w - s) / 2;
    const y0 = y + (h - th) / 2;
    return { s, th, x0, y0, d: poly([[x0 + s / 2, y0], [x0, y0 + th], [x0 + s, y0 + th]]) };
  }

  function parallelogram(x, y, w, h) {
    const m = 4;
    const k = 4;
    return [[x + m + k, y + m], [x + w - m, y + m], [x + w - m - k, y + h - m], [x + m, y + h - m]];
  }

  function shapePath(type, x, y, w, h) {
    const m = 4;
    switch (type) {
      case 0: { // square, side 2/3 of the box
        const s = (Math.min(w, h) * 2) / 3;
        const x0 = x + (w - s) / 2;
        const y0 = y + (h - s) / 2;
        return poly([[x0, y0], [x0, y0 + s], [x0 + s, y0 + s], [x0 + s, y0]]);
      }
      case 1:
        return triangle(x, y, w, h).d;
      case 2:
        return nGon(x, y, w, h, 5, 1);
      case 3:
        return nGon(x, y, w, h, 5, 2);
      case 4:
        return circle(x, y, w, h);
      case 5: { // star of David: the triangle and its upside-down twin
        const t = triangle(x, y, w, h);
        const o = t.th / 3;
        return t.d + poly([[t.x0 + t.s / 2, t.y0 + t.th + o], [t.x0, t.y0 + o], [t.x0 + t.s, t.y0 + o]]);
      }
      case 6: // rhombus
        return poly([[x + w / 2, y + m], [x + m, y + h / 2], [x + w / 2, y + h - m], [x + w - m, y + h / 2]]);
      case 7:
        return poly(parallelogram(x, y, w, h));
      case 8: // rectangle
        return poly([[x + m, y + 6], [x + w - m, y + 6], [x + w - m, y + h - 6], [x + m, y + h - 6]]);
      case 9: { // oval, from a box 3/4 as wide; made visibly non-round
        let ow = (w * 3) / 4;
        let oh = h;
        if (Math.abs(ow - oh) < 8) {
          if (ow < oh) ow -= 8;
          else oh -= 8;
        }
        ow -= 4;
        oh -= 4;
        return ellipse(x + 4 + ow / 2, y + 4 + oh / 2, ow / 2, oh / 2);
      }
      case 10: // dart: an arrowhead pointing right
        return poly([[x + m, y + m], [x + w - m, y + h / 2], [x + m, y + h - m], [x + w / 3, y + h / 2]]);
      case 11:
        return nGon(x, y, w, h, 6, 1);
      case 12: { // envelope: a rectangle with both diagonals
        const [l, r, t, b] = [x + m, x + w - m, y + 6, y + h - 6];
        return poly([[l, t], [r, t], [r, b], [l, b]]) + line(l, t, r, b) + line(l, b, r, t);
      }
      case 13: { // crossed diamond: rhombus with both diagonals
        const [cx, cy] = [x + w / 2, y + h / 2];
        return shapePath(6, x, y, w, h) + line(cx, y + m, cx, y + h - m) + line(x + m, cy, x + w - m, cy);
      }
      case 14: // wheel: three diameters inside a circle
        return nGon(x, y, w, h, 6, 3) + circle(x, y, w, h);
      case 15: { // parallelogram cut into two triangles
        const p = parallelogram(x, y, w, h);
        return poly(p) + line(...p[0], ...p[2]);
      }
      default:
        return "";
    }
  }

  return { N, COLS, ROWS, CELLS, SHAPES, magicCells, newTable, digitSumResult, shapePath };
})();
