"use strict";

/*
 * Carpet With a Hole, from Alexander Bogomolny's applet CarpetWithHole.
 *
 * The page cuts an NX by (NX-3) carpet (with a rectangular hole (NX-4) by 1)
 * along a staircase into two pieces. Slide one piece two cells sideways and one
 * cell up (or the other two cells down and one cell right) and the teeth mesh:
 * the two pieces tile an (NX-2) by (NX-2) square with no hole. The identity
 *   NX*(NX-3) - (NX-4) = (NX-2)^2
 * is the whole theorem, and each piece has half the square's area.
 *
 * Reset(), Poly1(), Poly2(), Poly.DefineDist() and Draw() in
 * CarpetWithHoleCanvas were transcribed from javap bytecode. NX is the long
 * side of the carpet; the applet's seven radio buttons call it 3x6 ... 15x18
 * and store 6, 8, ... 18. The opening picture is 9x12 (NX=12) with the grid on.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines the global CarpetWithHoleCore; every function takes a plain
 * position and returns a new one.
 */
const CarpetWithHoleCore = (() => {
  const WIDTH = 400;                 // applet's WIDTH parameter ("400 will do")
  const HEIGHT = 300;                // applet's HEIGHT parameter ("300 will do")
  const MARGIN = 40;                 // Reset()'s local constant
  const NX_OPTIONS = [6, 8, 10, 12, 14, 16, 18];
  const DEFAULT_NX = 12;
  const EPS = 1e-9;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const close = (a, b, tol = 1e-7) =>
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  const idiv = (a, b) => Math.trunc(a / b);          // Java integer division

  /** Reset(): the cell size A and the carpet's top-left corner. */
  function cell(nx, width, height) {
    const a = Math.min(
      idiv(width - 2 * MARGIN, nx + 2),
      idiv(height - 2 * MARGIN, nx - 1)
    );
    return {
      a,
      mx: idiv(width - nx * a, 2),
      my: idiv(height - (nx - 3) * a, 2),
    };
  }

  /** Poly1(): the left staircase piece, vertices in AddPoint order. */
  function poly1(nx, a, mx, my) {
    const k = idiv(nx - 4, 2);
    const p = [];
    let x = mx, y = my;
    const put = () => p.push({ x, y });
    put();
    for (let i = 0; i < k; i++) { x += 2 * a; put(); y += a; put(); }
    x = mx + 2 * a; put(); y += a; put();
    for (let i = 0; i < k; i++) { x += 2 * a; put(); y += a; put(); }
    x = mx; put();
    return p;
  }

  /** Poly2(): the right staircase piece, vertices in AddPoint order. */
  function poly2(nx, a, mx, my) {
    const k = idiv(nx - 4, 2);
    const p = [];
    let x = mx + 2 * a, y = my;
    const put = () => p.push({ x, y });
    put();
    for (let i = 0; i < k; i++) { y += a; put(); x += 2 * a; put(); }
    y += a; put();
    x = mx + 4 * a; put();
    for (let i = 0; i < k; i++) { y += a; put(); x += 2 * a; put(); }
    x = mx + nx * a; y = my; put();
    return p;
  }

  /** CarpetWithHoleCanvas$Poly.DefineDist(): snap tolerance in board units. */
  function minDist(nx) {
    const n = 4 * idiv(nx - 4, 2) + 4;       // vertex count of both polygons
    if (n < 9) return 2;
    if (n < 13) return 3;
    if (n > 24) return 5;
    return 4;
  }

  /** Draw(): the grid, as [p, q] segments in the carpet's opening position. */
  function gridLines(nx, a, mx, my) {
    const k = idiv(nx - 4, 2);
    const seg = (x1, y1, x2, y2) => [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    const out = [];
    for (let i = 0; i < 3; i++)
      out.push(seg(mx + i * a, my, mx + i * a, my + (nx - 3) * a));
    for (let j = 0; j < nx - 5; j++) {
      const x = mx + (j + 3) * a;
      out.push(seg(x, my, x, my + k * a));
      out.push(seg(x, my + (k + 1) * a, x, my + (nx - 3) * a));
    }
    for (let j = 0; j < nx - 2; j++)
      out.push(seg(mx, my + j * a, mx + nx * a, my + j * a));
    return out;
  }

  /** DrawOutline()/FillOutline(): the hole's rectangle. */
  function hole(nx, a, mx, my) {
    return {
      x: mx + 2 * a,
      y: my + idiv(nx - 4, 2) * a,
      w: (nx - 4) * a,
      h: a,
    };
  }

  /** Signed shoelace area, abs() for an ordinary area. */
  function area(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s / 2);
  }

  /** Translate a whole piece by a displacement. */
  const shift = (points, d) => points.map((p) => ({ x: p.x + d.x, y: p.y + d.y }));

  /** Count cells covered, overlapped and left outside by two placed pieces. */
  function tile(p1, p2, d1, d2, nx, a, mx, my, box) {
    const u = shift(p1, d1), v = shift(p2, d2);
    const inside = (p, poly) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const A = poly[i], B = poly[j];
        if ((A.y > p.y) !== (B.y > p.y) &&
            p.x < ((B.x - A.x) * (p.y - A.y)) / (B.y - A.y) + A.x) c = !c;
      }
      return c;
    };
    let covered = 0, overlap = 0, outside = 0;
    const y0 = box.y0 === undefined ? my : box.y0;
    for (let gy = 0; gy < box.h; gy++) {
      for (let gx = 0; gx < box.w; gx++) {
        const p = { x: mx + (gx + 0.5) * a, y: y0 + (gy + 0.5) * a };
        const inU = inside(p, u), inV = inside(p, v);
        const wanted = box.want(p);
        if (inU && inV) overlap++;
        if ((inU || inV) && !wanted) outside++;
        if ((inU || inV) && wanted) covered++;
      }
    }
    return { covered, overlap, outside };
  }

  /** The full drawing for an NX and a board size, in board coordinates. */
  function layout(nx, width, height) {
    const c = cell(nx, width, height);
    const { a, mx, my } = c;
    const k = idiv(nx - 4, 2);
    const p1 = poly1(nx, a, mx, my), p2 = poly2(nx, a, mx, my);
    const rect = { x: mx, y: my, w: nx * a, h: (nx - 3) * a };
    const holeRect = hole(nx, a, mx, my);
    const side = (nx - 2) * a;
    return {
      nx, width, height, a, mx, my, k,
      rect, hole: holeRect, minDist: minDist(nx),
      p1, p2, vertexCount: p1.length, grid: gridLines(nx, a, mx, my),
      // The snap targets from mousePressed: PolyL[0] and PolyR[1] swap.
      targetL: { x: 2 * a, y: a }, targetR: { x: -2 * a, y: -a },
      square: { x: mx, y: my - a, w: side, h: side, side },
      rectArea: nx * (nx - 3), holeArea: nx - 4,
      carpetArea: nx * (nx - 3) - (nx - 4),
      squareArea: (nx - 2) * (nx - 2),
      pieceArea1: area(p1) / (a * a), pieceArea2: area(p2) / (a * a),
    };
  }

  /** The opening position. Grid on, both pieces at the start, as in the applet. */
  function start(options) {
    const o = options || {};
    let nx = o.nx == null ? DEFAULT_NX : o.nx;
    if (!NX_OPTIONS.includes(nx)) nx = DEFAULT_NX;
    return {
      nx,
      width: o.width || WIDTH,
      height: o.height || HEIGHT,
      showGrid: o.showGrid === undefined ? true : !!o.showGrid,
      shiftL: { x: 0, y: 0 },
      shiftR: { x: 0, y: 0 },
      explored: false,
    };
  }

  /** Snap radius: the applet's per-vertex tolerance, generous enough to drag. */
  const snapRadius = (g) => Math.max(g.minDist, 0.4 * g.a);

  /**
   * One move. `nx` is a radio button, `grid` the checkbox, `drag` a piece's
   * handle, and `reset` the applet's Reset(): it relayouts at the same board
   * size but leaves the grid checkbox as it was.
   */
  function move(state, m) {
    if (!state || !m) return null;
    if (m.type === "reset")
      return start({ width: state.width, height: state.height, showGrid: state.showGrid });
    if (m.type === "nx") {
      if (!NX_OPTIONS.includes(m.value)) return null;
      return Object.assign({}, state, {
        nx: m.value, shiftL: { x: 0, y: 0 }, shiftR: { x: 0, y: 0 }, explored: false,
      });
    }
    if (m.type === "grid") {
      if (typeof m.value !== "boolean") return null;
      return Object.assign({}, state, { showGrid: m.value, explored: true });
    }
    if (m.type === "drag") {
      const g = layout(state.nx, state.width, state.height);
      const anchor = m.name === "L"
        ? { x: g.mx, y: g.my }
        : m.name === "R"
          ? { x: g.mx + 2 * g.a, y: g.my }
          : null;
      if (!anchor || !m.point || !Number.isFinite(m.point.x) || !Number.isFinite(m.point.y)) return null;
      const q = {
        x: clamp(m.point.x, 0, state.width),
        y: clamp(m.point.y, 0, state.height),
      };
      let d = { x: q.x - anchor.x, y: q.y - anchor.y };
      const target = m.name === "L" ? g.targetL : g.targetR;
      const snapped = Math.hypot(d.x - target.x, d.y - target.y) <= snapRadius(g);
      if (snapped) d = { x: target.x, y: target.y };
      const key = m.name === "L" ? "shiftL" : "shiftR";
      return Object.assign({}, state, { [key]: d, explored: true });
    }
    return null;
  }

  /** Everything the page draws and the test checks, for one position. */
  function compute(state) {
    const g = layout(state.nx, state.width, state.height);
    const p1 = shift(g.p1, state.shiftL), p2 = shift(g.p2, state.shiftR);
    const assembled =
      (state.shiftL.x === g.targetL.x && state.shiftL.y === g.targetL.y) ||
      (state.shiftR.x === g.targetR.x && state.shiftR.y === g.targetR.y);
    return Object.assign({}, g, {
      shiftL: state.shiftL, shiftR: state.shiftR, p1, p2,
      assembled, showGrid: state.showGrid, explored: state.explored,
      whole: !state.showGrid && !state.explored &&
        state.shiftL.x === 0 && state.shiftL.y === 0 &&
        state.shiftR.x === 0 && state.shiftR.y === 0,
    });
  }

  /** The page's claim and the identities the drawing relies on. */
  function claims(g) {
    const box = {
      w: g.nx, h: g.nx - 3,
      want: (p) => {
        const cx = (p.x - g.mx) / g.a - 0.5, cy = (p.y - g.my) / g.a - 0.5;
        return !(cx >= 2 && cx < g.nx - 2 && Math.abs(cy - g.k) < 0.5);
      },
    };
    const sq = {
      w: g.nx - 2, h: g.nx - 2, y0: g.my - g.a,
      want: () => true,
    };
    const startTile = tile(g.p1, g.p2, { x: 0, y: 0 }, { x: 0, y: 0 }, g.nx, g.a, g.mx, g.my, box);
    const squareTile = tile(g.p1, g.p2, { x: 0, y: 0 }, g.targetR, g.nx, g.a, g.mx, g.my, sq);
    return {
      areaIdentity: g.carpetArea === g.squareArea,
      halfAreas: close(g.pieceArea1, g.squareArea / 2) && close(g.pieceArea2, g.squareArea / 2),
      vertexCount: g.vertexCount === 4 * g.k + 4,
      gridCount: g.grid.length === 3 * g.nx - 9,
      holeSize: close(g.hole.w, (g.nx - 4) * g.a) && close(g.hole.h, g.a),
      positiveSize: g.a > 0,
      startTiles: startTile.covered === g.carpetArea &&
        startTile.overlap === 0 && startTile.outside === 0,
      squareTiles: squareTile.covered === g.squareArea &&
        squareTile.overlap === 0 && squareTile.outside === 0,
    };
  }

  /** A sentence for #status: plain words plus the real numbers. */
  function describe(state) {
    const g = compute(state);
    if (g.assembled)
      return `The two pieces make a ${g.nx - 2} by ${g.nx - 2} square: ` +
        `${g.squareArea} cells, the same as the ${g.nx} by ${g.nx - 3} carpet ` +
        `minus its ${g.nx - 4}-cell hole.`;
    return `A ${g.nx - 3} by ${g.nx} carpet with a ${g.nx - 4}-cell hole. ` +
      `Slide one piece 2 cells across and 1 cell up to make a ` +
      `${g.nx - 2} by ${g.nx - 2} square.`;
  }

  return {
    WIDTH, HEIGHT, MARGIN, NX_OPTIONS, DEFAULT_NX, EPS,
    clamp, close, idiv, cell, poly1, poly2, minDist, gridLines, hole,
    area, shift, layout, start, move, compute, claims, describe, snapRadius,
  };
})();
