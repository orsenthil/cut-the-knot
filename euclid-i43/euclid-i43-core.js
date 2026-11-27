"use strict";

/*
 * Euclid I.43, from Alexander Bogomolny's applet EuclidI43.
 *
 * The applet keeps a parallelogram ABCD whose top side AD and bottom side BC
 * stay horizontal (all four corners are Fix(2): dragging changes only x). A
 * point K on the diagonal AC has the lines through it parallel to AB and AD
 * drawn across the parallelogram. Those two lines cut out four pieces: one at
 * A, one at C, and a green pair on opposite sides of the diagonal. Euclid I.43
 * says the green pair has equal area. The page adds that up to ten such points
 * may be used and that the equality survives any number of them.
 *
 * The core reproduces the applet's own numbers and geometry: the 400x300
 * canvas, the fixed initial corners, the ten coefficients z[i] in the applet's
 * peculiar order, the horizontal drags with Redefine, the projection of a
 * dragged divisor point back onto the diagonal, and the four quadrilaterals
 * drawn for each divisor point in that order. It also records the coloured
 * cell that each grid rectangle finally shows, which is what checks the
 * page's "any number of points" claim. No document, no window, no storage:
 * one global, EuclidI43Core, with plain data in and plain data out.
 */
const EuclidI43Core = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const MAX = 10;
  const EDGE = 12;   // keep draggable points inside the frame
  const MIN_SIDE = 40;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });

  /* GeoSDoub.GetParallelTo(p, a, b): p + 100 * (a - b). */
  const parallel = (p, a, b) => add(p, scale(sub(a, b), 100));

  /* GeoSDoub.Intersect, straight from its bytecode, including the |d|<1
     guard that returns NaN when the two lines are (nearly) parallel. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  /* The coefficient z[i] is the weight of A in DoubLine.CreateMidPoint:
     K = A*z[i] + C*(1-z[i]). The loop is the one in EuclidI43Canvas.init(). */
  function appletCoefficients(max) {
    const z = new Array(max).fill(NaN);
    for (let i = 0; i < Math.floor(max / 2); i++) {
      z[2 * i] = (Math.floor(max / 2) + i + 1) / (max + 1);
      z[2 * i + 1] = (Math.floor(max / 2) - i) / (max + 1);
    }
    return z;
  }

  const INITIAL_Z = appletCoefficients(MAX);

  /** The starting picture, exactly as EuclidI43Canvas.init() builds it. */
  function start(options) {
    const o = options || {};
    const n = o.N === undefined ? 1 : clamp(Math.round(o.N), 0, MAX);
    return {
      A: { x: 20, y: 20 },
      B: { x: 60, y: 280 },
      C: { x: 380, y: 280 },
      D: { x: 340, y: 20 },
      N: n,
      z: INITIAL_Z.slice(),
      explored: false,
    };
  }

  /** Back to the fixed picture; the number of divisor points is kept. */
  function reset(s) {
    return start({ N: s.N });
  }

  /** A fresh slant, still with horizontal top and bottom and the same z. */
  function randomize(s) {
    /* Keep a readable slant: a side of 210..300 units, with the bottom side
       offset by at most 70 units from the top, all inside the frame. */
    const side = 210 + Math.random() * 90;
    const ax = 30 + Math.random() * (WIDTH - EDGE - side - 30);
    const bx = clamp(ax + (Math.random() - 0.5) * 140, EDGE, WIDTH - EDGE - side);
    return {
      A: { x: ax, y: 20 },
      B: { x: bx, y: 280 },
      C: { x: bx + side, y: 280 },
      D: { x: ax + side, y: 20 },
      N: s.N,
      z: s.z.slice(),
      explored: true,
    };
  }

  /* The PVNumeric spinner in the applet runs from 0 to 10. SetN adds/removes
     Z[i] from the end, so the active points are always the first N of Z. */
  function setN(s, n) {
    if (!Number.isFinite(n)) return s;
    const next = clamp(Math.round(n), 0, MAX);
    if (next === s.N) return s;
    return Object.assign({}, s, { N: next, explored: true });
  }

  /*
   * All four corners are fixed in y; only x moves. Redefine(p1,p2,p3,p4)
   * writes p1 = p2 + p4 - p3. Dragging A or B calls Redefine(C,B,A,D), so
   * C = B + D - A; dragging C or D calls Redefine(A,D,C,B), so
   * A = D + B - C. The UI clamps the dragged x so the dependent corner and
   * the side length stay usable (the applet itself did not clamp).
   */
  function moveCorner(s, name, p) {
    if (!p || !Number.isFinite(p.x) || !["A", "B", "C", "D"].includes(name)) return s;
    const A = s.A, B = s.B, C = s.C, D = s.D;
    let nA = A, nB = B, nC = C, nD = D;
    const x0 = clamp(p.x, EDGE, WIDTH - EDGE);
    let x = x0, nx;
    if (name === "A") {
      /* Redefine(C,B,A,D): C = B + D - A (new A). */
      x = clamp(x0, B.x + D.x - (WIDTH - EDGE), B.x + D.x - EDGE);
      nx = B.x + D.x - x;
      if (Math.abs(D.x - x) < MIN_SIDE) return s;
      nA = { x, y: A.y };
      nC = { x: nx, y: C.y };
    } else if (name === "B") {
      /* Same call, but the dragged point is B: C = B + D - A. */
      x = clamp(x0, A.x + EDGE - D.x, A.x + WIDTH - EDGE - D.x);
      nx = x + D.x - A.x;
      nB = { x, y: B.y };
      nC = { x: nx, y: C.y };
    } else if (name === "C") {
      /* Redefine(A,D,C,B): A = D + B - C (new C). */
      x = clamp(x0, D.x + B.x - (WIDTH - EDGE), D.x + B.x - EDGE);
      nx = D.x + B.x - x;
      if (Math.abs(x - B.x) < MIN_SIDE) return s;
      nC = { x, y: C.y };
      nA = { x: nx, y: A.y };
    } else {
      /* Same call, but the dragged point is D: A = D + B - C. */
      x = clamp(x0, EDGE + C.x - B.x, WIDTH - EDGE + C.x - B.x);
      nx = x + B.x - C.x;
      if (Math.abs(x - B.x) < MIN_SIDE) return s;
      nD = { x, y: D.y };
      nA = { x: nx, y: A.y };
    }
    return Object.assign({}, s, { A: nA, B: nB, C: nC, D: nD, explored: true });
  }

  /* A divisor point is RestrictToLine(diagonal). UpdateLocation adds the
     mouse delta then projects onto AC; UpdateCoefficient recovers z, clamped
     to [0,1] by DoubLine's m_PointInSegment. Here z is the weight of A, so
     z_new = 1 - (projected fraction from A to C). */
  function moveDivider(s, i, p) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return s;
    if (!Number.isInteger(i) || i < 0 || i >= s.N) return s;
    const d = sub(s.C, s.A);
    const len2 = sqDist(s.A, s.C);
    if (!(len2 > 0)) return s;
    const along = clamp(dot(sub(p, s.A), d) / len2, 0, 1);
    const z = s.z.slice();
    z[i] = 1 - along;
    return Object.assign({}, s, { z, explored: true });
  }

  const areaOf = (pts) => {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return Math.abs(sum) / 2;
  };

  /** The four quadrilaterals EuclidI43Canvas.AccommodatePoint fills for K. */
  function piecesFor(A, B, C, D, z) {
    const K = add(scale(A, z), scale(C, 1 - z));
    const dirAB = parallel(K, A, B);
    const dirAD = parallel(K, A, D);
    const E = intersect(A, D, K, dirAB);   // on AD
    const F = intersect(B, C, K, dirAB);   // on BC
    const G = intersect(A, B, K, dirAD);   // on AB
    const H = intersect(C, D, K, dirAD);   // on CD
    return {
      K, E, F, G, H,
      quads: [
        { kind: "a", points: [A, G, K, E] },
        { kind: "m", points: [G, B, F, K] },
        { kind: "m", points: [H, D, E, K] },
        { kind: "c", points: [F, C, H, K] },
      ],
    };
  }

  /*
   * The last-filled colour of a grid rectangle. The grid lines are exactly
   * the divisors' parameters t = 1 - z, plus the ends 0 and 1. A square at t
   * covers a cell when the cell lies wholly inside it: red when both upper
   * bounds are <= t, blue when both lower bounds are >= t, green when one
   * coordinate is below t and the other above. The applet draws i = 0..N-1,
   * so the last matching i wins. Mirroring u and v leaves the matching i and
   * the colour unchanged, which is the page's general claim.
   */
  function cellsFor(s) {
    const t = [];
    for (let i = 0; i < s.N; i++) t.push(1 - s.z[i]);
    const b = [0].concat(t.slice().sort((p, q) => p - q), [1]);
    const det = Math.abs(
      (s.B.x - s.A.x) * (s.D.y - s.A.y) - (s.B.y - s.A.y) * (s.D.x - s.A.x)
    );
    const cells = [];
    const EPS = 1e-9;
    for (let ui = 0; ui < b.length - 1; ui++) {
      for (let vi = 0; vi < b.length - 1; vi++) {
        const loU = b[ui], hiU = b[ui + 1], loV = b[vi], hiV = b[vi + 1];
        if (hiU - loU < EPS || hiV - loV < EPS) continue;
        let color = null, last = -1;
        for (let i = 0; i < s.N; i++) {
          const p = 1 - s.z[i];
          let kind = null;
          if (p >= hiU - EPS && p >= hiV - EPS) kind = "a";
          else if (p <= loU + EPS && p >= hiV - EPS) kind = "m";
          else if (p >= hiU - EPS && p <= loV + EPS) kind = "m";
          else if (p <= loU + EPS && p <= loV + EPS) kind = "c";
          if (kind) { color = kind; last = i; }
        }
        if (color === null) continue;
        cells.push({
          ui, vi, color, last,
          area: det * (hiU - loU) * (hiV - loV),
          tU: (loU + hiU) / 2, tV: (loV + hiV) / 2,
        });
      }
    }
    return cells;
  }

  /** Everything the page draws and everything the logic test checks. */
  function compute(s) {
    const quads = [];
    const dividers = [];
    for (let i = 0; i < MAX; i++) {
      if (i < s.N) {
        const piece = piecesFor(s.A, s.B, s.C, s.D, s.z[i]);
        dividers.push(piece.K);
        for (const q of piece.quads) {
          quads.push(Object.assign({ i }, q, { area: areaOf(q.points) }));
        }
      } else {
        dividers.push(null);
      }
    }
    const cells = cellsFor(s);
    const green = quads.filter((q) => q.kind === "m");
    let pairs = 0, matching = 0;
    const key = new Map();
    for (const c of cells) {
      key.set(`${c.ui},${c.vi}`, c);
    }
    for (const c of cells) {
      const mate = key.get(`${c.vi},${c.ui}`);
      if (!mate) continue;
      pairs++;
      if (c.color === mate.color && Math.abs(c.area - mate.area) < 1e-7) matching++;
    }
    return {
      A: s.A, B: s.B, C: s.C, D: s.D,
      N: s.N, z: s.z.slice(), dividers, quads, cells,
      greenAreas: green.map((q) => q.area),
      parallelogramArea: areaOf([s.A, s.B, s.C, s.D]),
      pairs, matching, allPairsMatch: pairs === matching,
    };
  }

  /** The line under the picture. An illustration has no winner. */
  function describe(s) {
    const g = compute(s);
    if (s.N === 0) {
      return "No divisor points. Use + to put one on the diagonal.";
    }
    const first = g.quads.filter((q) => q.i === 0 && q.kind === "m");
    const r = (v) => Math.round(v);
    return `${s.N} point${s.N === 1 ? "" : "s"} on the diagonal: pieces of the same colour on opposite sides match. ` +
      `The first green pair covers ${r(first[0].area)} and ${r(first[1].area)} square units.`;
  }

  /** Nothing can be won or lost here: it is a demonstration. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, MAX, EDGE, MIN_SIDE, INITIAL_Z,
    clamp, copy, sqDist, dot, sub, add, scale, parallel, intersect,
    appletCoefficients, areaOf, piecesFor,
    start, reset, randomize, setN, moveCorner, moveDivider,
    compute, cellsFor, describe, result,
  };
})();
