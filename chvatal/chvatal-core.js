"use strict";

/*
 * Chvatal's Art Gallery theorem, from Alexander Bogomolny's applet "Chvatal"
 * (cut-the-knot.org, Curriculum/Combinatorics/Chvatal.shtml).
 *
 * The applet draws a simple polygon with N vertices. In its "Draw diagonals"
 * mode you repeatedly join two non-neighbouring corners with a diagonal; a
 * diagonal is refused if it has zero length, joins neighbours, crosses an
 * existing diagonal or a side, or leaves the polygon. Once N-3 non-crossing
 * diagonals have been placed the polygon is triangulated. The applet then
 * three-colours the vertices of the triangulation (every triangle gets all
 * three colours) and marks the vertices of the least frequent colour: those
 * corners see the whole interior. Fisk's proof of Chvatal's theorem is exactly
 * this construction, and because the three colour classes partition the N
 * vertices, the smallest class has at most floor(N/3) vertices.
 *
 * The key idea the code relies on is that the triangles of a triangulation
 * form a tree when two triangles are joined across their shared diagonal.
 * Starting from the seed colours of vertices 0 and 1, each neighbouring
 * triangle is forced to give its third vertex the remaining colour, so the
 * colouring is unique and can never contradict itself.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, ChvatalCore, so the page loads it with a
 * plain <script> and porting/check-chvatal.mjs loads it in Node. The position
 * is plain data (numbers, strings, arrays, plain objects), so it can be saved
 * and handed to the tutor as it is. Functions take a position and return a new
 * one; they do not change what they are given.
 */
const ChvatalCore = (() => {
  // The applet's own constants (ChvatalPanel / ChvatalCanvas).
  const N_MIN = 4;          // SpinnerNumberModel lower bound
  const N_MAX = 40;         // SpinnerNumberModel upper bound
  const N_DEFAULT = 5;      // the "N" spinner's initial value
  const DIAGONALS_FOR_COMPLETE = 3; // a triangulation needs n - 3 diagonals

  // The applet's m_Results array, in bytecode order.
  const MSG = [
    "A diagonal of zero length? Indeed!", // 0: same vertex
    "Diagonals should not cross.",          // 1: crosses an existing diagonal
    "Diagonals should not cross sides.",    // 2: neighbours, or a side meets a diagonal
    "Please reset the board.",              // 3: a diagonal asked for after finishing
    "Sides should not cross.",              // 4: two polygon sides cross
    "Outside diagonals make no sense.",     // 5: midpoint outside the polygon
  ];

  /** Java's SpinnerNumberModel(5, 4, 40, 1): clamp and round. */
  function clampN(n) {
    if (!Number.isFinite(n)) return N_DEFAULT;
    return Math.min(N_MAX, Math.max(N_MIN, Math.round(n)));
  }

  /** A tiny deterministic PRNG, used when the page wants a fresh polygon. */
  function makeRandom(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /**
   * The polygon the applet's MakeDots() builds: points equally spaced around
   * a circle with a small angular jitter, which keeps the polygon simple.
   */
  function makePoints(n, seed) {
    const rnd = makeRandom(seed === undefined ? 1 : seed);
    const step = (2 * Math.PI) / n;
    const cx = 160;
    const cy = 100;
    const radius = 70;
    const points = [];
    for (let i = 0; i < n; i++) {
      const jitter = (rnd() * 2 - 1) * (step / 4.4);
      const angle = i * step + jitter;
      points.push({
        x: Math.round(cx + radius * Math.cos(angle)),
        y: Math.round(cy + radius * Math.sin(angle)),
      });
    }
    return points;
  }

  /** Two vertices are neighbours on the polygon boundary (applet IsNext). */
  function adjacent(a, b, n) {
    const d = Math.abs(a - b);
    return d === 1 || d === n - 1;
  }

  /** Midpoint of two points (the applet's Midpoint). */
  function midpoint(p, q) {
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }

  /** Twice the signed area of triangle a,b,c: sign tells the turning. */
  function orient(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  /**
   * The applet's SegmentsCross: do the interiors of AB and CD cross? Shared
   * endpoints are not a crossing (diagonals from one corner are allowed), so
   * only strict, opposite orientation on both segments counts.
   */
  function segmentsCross(a, b, c, d) {
    const d1 = orient(c, d, a);
    const d2 = orient(c, d, b);
    const d3 = orient(a, b, c);
    const d4 = orient(a, b, d);
    const eps = 1e-9;
    const opp = (u, v) => (u > eps && v < -eps) || (u < -eps && v > eps);
    if (opp(d1, d2) && opp(d3, d4)) {
      return midpoint(midpoint(a, b), midpoint(c, d));
    }
    return null;
  }

  /** Even-odd point in polygon, matching java.awt.Polygon.contains. */
  function pointInPolygon(p, points) {
    let inside = false;
    const n = points.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = points[i];
      const b = points[j];
      const intersect = (a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /** The diagonals currently on the board, as ordered pairs. */
  function drawnDiagonals(state) {
    return state.diagonals.map((d) => [d.a, d.b]);
  }

  /**
   * The check the applet runs when a diagonal is released (mouseReleased).
   * Returns one of m_Results, or null when the diagonal is accepted.
   */
  function validateDiagonal(state, a, b) {
    if (state.finished) return MSG[3];       // "Please reset the board."
    if (a === b) return MSG[0];              // zero length
    if (adjacent(a, b, state.n)) return MSG[2]; // neighbours: IsNext
    const pa = state.points[a];
    const pb = state.points[b];
    for (const d of state.diagonals) {
      // The applet skips a stored diagonal that shares an endpoint.
      if (d.a === a || d.a === b || d.b === a || d.b === b) continue;
      if (segmentsCross(pa, pb, state.points[d.a], state.points[d.b])) return MSG[1];
    }
    if (!pointInPolygon(midpoint(pa, pb), state.points)) return MSG[5];
    return null;
  }

  /**
   * The check the applet runs after a vertex is dragged (FullTest), in the
   * same order as the bytecode: diagonals cross, sides cross, sides meet
   * diagonals, diagonals outside.
   */
  function validateGeometry(state) {
    const n = state.n;
    const pts = state.points;
    const diags = drawnDiagonals(state);
    for (let i = 0; i < diags.length; i++) {
      for (let j = i + 1; j < diags.length; j++) {
        const [a, b] = diags[i];
        const [c, d] = diags[j];
        if (a === c || a === d || b === c || b === d) continue;
        if (segmentsCross(pts[a], pts[b], pts[c], pts[d])) return MSG[1];
      }
    }
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      for (let k = i + 1; k < n; k++) {
        const k2 = (k + 1) % n;
        if (i === k || i === k2 || i2 === k || i2 === k2) continue;
        if (segmentsCross(pts[i], pts[i2], pts[k], pts[k2])) return MSG[4];
      }
    }
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      for (const [a, b] of diags) {
        if (a === i || a === i2 || b === i || b === i2) continue;
        if (segmentsCross(pts[i], pts[i2], pts[a], pts[b])) return MSG[2];
      }
    }
    for (const [a, b] of diags) {
      if (!pointInPolygon(midpoint(pts[a], pts[b]), pts)) return MSG[5];
    }
    return null;
  }

  /**
   * Fisk's three-colouring of a triangulation, transcribed from the applet's
   * Triangulation constructor, Populate() and GetLeastFrequentColor().
   *
   * The adjacency of the triangulation is built from the polygon sides and
   * the drawn diagonals. Vertices 0 and 1 are seeded with colours 0 and 1.
   * Populate(a, b) removes the edge a-b and, for every vertex k still joined
   * to both a and b, makes the triangle (a, b, k), gives k the remaining
   * colour 3 - colour[a] - colour[b], and recurses on (a, k) and (b, k).
   * The dual graph is a tree, so no vertex is ever coloured twice.
   */
  function triangulate(n, points, diagonals) {
    const adj = [];
    for (let i = 0; i < n; i++) adj.push(new Set());
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      adj[i].add(j);
      adj[j].add(i);
    }
    for (const d of diagonals) {
      adj[d.a].add(d.b);
      adj[d.b].add(d.a);
    }

    const colors = new Array(n).fill(-1);
    colors[0] = 0;
    colors[1] = 1;
    const triangles = [];

    function populate(a, b) {
      adj[a].delete(b);
      adj[b].delete(a);
      const common = [];
      adj[a].forEach((k) => {
        if (k !== b && adj[b].has(k) && colors[k] === -1) common.push(k);
      });
      for (const k of common) {
        colors[k] = 3 - colors[a] - colors[b];
        triangles.push([a, b, k]);
      }
      for (const k of common) {
        populate(a, k);
        populate(b, k);
      }
    }
    populate(0, 1);

    const counts = [0, 0, 0];
    for (const c of colors) if (c >= 0 && c < 3) counts[c]++;

    // GetLeastFrequentColor: best starts at 0, then colours 1 and 2 are tried;
    // strict "<" means a tie keeps the lower colour.
    let leastColor = 0;
    for (let c = 1; c < 3; c++) {
      if (counts[c] < counts[leastColor]) leastColor = c;
    }
    const guards = [];
    for (let i = 0; i < n; i++) if (colors[i] === leastColor) guards.push(i);

    return {
      colors,
      triangles,
      counts,
      leastColor,
      guards,
      guardCount: guards.length,
      complete: colors.every((c) => c >= 0),
    };
  }

  /** The position a new game starts from (the applet's Reset + MakeDots). */
  function start(options) {
    const o = options || {};
    const n = clampN(o.n === undefined ? N_DEFAULT : o.n);
    const seed = o.seed === undefined ? 1 : o.seed;
    const points = o.points && o.points.length === n
      ? o.points.map((p) => ({ x: p.x, y: p.y }))
      : makePoints(n, seed);
    return {
      n,
      seed,
      points,
      diagonals: [],
      mode: o.mode === "move" ? "move" : "draw",
      message: null,
      finished: false,
      analysis: null,
    };
  }

  /** How many diagonals a complete triangulation of an n-gon needs: n - 3. */
  function neededDiagonals(n) {
    return clampN(n) - DIAGONALS_FOR_COMPLETE;
  }

  /** The legal diagonals from this position (none once triangulated). */
  function legalMoves(state) {
    if (!state || state.finished) return [];
    const out = [];
    for (let a = 0; a < state.n; a++) {
      for (let b = a + 1; b < state.n; b++) {
        if (adjacent(a, b, state.n)) continue;
        if (validateDiagonal(state, a, b) !== null) continue;
        out.push({ type: "diagonal", a, b });
      }
    }
    return out;
  }

  /** The position after a move, or null for an unknown move. */
  function move(state, m) {
    if (!state || !m) return null;
    switch (m.type) {
      case "diagonal": {
        const a = m.a;
        const b = m.b;
        if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 ||
            a >= state.n || b >= state.n) return null;
        const why = validateDiagonal(state, a, b);
        if (why !== null) return Object.assign({}, state, { message: why });
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        const diagonals = state.diagonals.concat([{ a: lo, b: hi }]);
        const finished = diagonals.length === neededDiagonals(state.n);
        return Object.assign({}, state, {
          diagonals,
          finished,
          message: null,
          analysis: finished ? triangulate(state.n, state.points, diagonals) : null,
        });
      }
      case "mode":
        if (m.mode !== "draw" && m.mode !== "move") return null;
        return Object.assign({}, state, { mode: m.mode, message: null });
      case "setPoint": {
        const i = m.index;
        if (!Number.isInteger(i) || i < 0 || i >= state.n) return null;
        const points = state.points.map((p, k) =>
          k === i ? { x: Number(m.x) || 0, y: Number(m.y) || 0 } : p);
        const next = Object.assign({}, state, { points });
        const why = validateGeometry(next);
        return Object.assign({}, next, { message: why });
      }
      case "setN":
        return start({
          n: m.n,
          seed: state.seed + 1,
          mode: state.mode,
        });
      case "pop": {
        if (state.diagonals.length === 0) return Object.assign({}, state, { message: null });
        const diagonals = state.diagonals.slice(0, -1);
        return Object.assign({}, state, {
          diagonals,
          finished: false,
          analysis: null,
          message: null,
        });
      }
      case "reset":
        return start({ n: state.n, seed: state.seed + 1, mode: state.mode });
      default:
        return null;
    }
  }

  /** "done" when the polygon has been triangulated; a demo never wins. */
  function result(state) {
    return state && state.finished ? "done" : null;
  }

  /** The mathematical bound floor(n / 3), as on the cut-the-knot page. */
  function floorThird(n) {
    return Math.floor(n / 3);
  }

  return {
    N_MIN, N_MAX, N_DEFAULT, DIAGONALS_FOR_COMPLETE, MSG,
    clampN, makePoints, adjacent, midpoint, orient, segmentsCross,
    pointInPolygon, validateDiagonal, validateGeometry, triangulate,
    start, neededDiagonals, legalMoves, move, result, floorThird,
  };
})();
