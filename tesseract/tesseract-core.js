"use strict";

/*
 * The Tesseract, from Alexander Bogomolny's applets Applet4D and Reper4D.
 *
 * The tesseract is the set of points (x, y, z, h) with every coordinate in
 * [0, 1]. Its 16 vertices, 32 edges, 24 squares and 8 cubes are the
 * coefficients of (2x + 1)^4. It is built inductively: a point moved along
 * x sweeps a segment, a segment moved along y a square, a square moved along
 * z a cube, a cube moved along h the tesseract. The picture is the
 * orthogonal projection, onto the screen, of the tesseract turned by six
 * rotations, one in each coordinate plane (XY, YZ, XZ, XH, YH, ZH). The
 * hyperplane Ax + By + Cz + Dh = E cuts it in a solid whose edges are where
 * the hyperplane crosses the 24 squares.
 *
 * The reper puzzle (Reper4D): two "repers" (pairs of perpendicular arrows)
 * sit on one of the 24 squares. One stays; the other can be moved to any of
 * the 8 squares that share an edge with its square, gliding without
 * rotation as if the two squares were unfolded into one plane. Bring it back
 * with the opposite orientation. A reper reversed this way has travelled
 * along a one-sided (Moebius-like) band of squares; going once round the
 * three squares that meet at an edge is the shortest way.
 *
 * Squares are named by their coordinates in the order x, y, z, h: a letter
 * for a free coordinate and 0 or 1 for a fixed one (X01H: y = 0, z = 1).
 * The construction animates each step over 15 frames, as NextStep did;
 * the starting angles are the applet's sliders: XY 18, YZ 130, XZ 54, XH 15,
 * YH 0, ZH 45 degrees; the hyperplane starts at (0.30527, -0.64047,
 * 0.43196, -0.22257; 0.15), each coefficient -2..2.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * TesseractCore. The positions are plain data.
 */
const TesseractCore = (() => {
  const AXES = ["x", "y", "z", "h"];
  const LETTERS = ["X", "Y", "Z", "H"];
  const ANGLES = { xy: 18, yz: 130, xz: 54, xh: 15, yh: 0, zh: 45 };
  const PLANE = { A: 0.3052699863910675, B: -0.640470027923584, C: 0.43195998668670654, D: -0.22257000207901, E: 0.15000000596046448 };
  const ANIM_STEPS = 15;
  const STEP_NAMES = ["a point", "a segment", "a square", "a cube", "the tesseract"];

  /** The 16 vertices as 0/1 tuples, indexed by the binary number xyzh (x the low bit). */
  const VERTS = Array.from({ length: 16 }, (_, i) => [i & 1, (i >> 1) & 1, (i >> 2) & 1, (i >> 3) & 1]);
  /** The 32 edges: pairs of vertices differing in one coordinate. */
  const EDGES = [];
  for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) if (!(i >> k & 1)) EDGES.push([i, i | (1 << k), k]);

  /** The 24 squares: two free axes, two fixed with values. */
  const SQUARES = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    const fixed = [0, 1, 2, 3].filter((k) => k !== a && k !== b);
    for (let v = 0; v < 4; v++) {
      const vals = { [fixed[0]]: v & 1, [fixed[1]]: (v >> 1) & 1 };
      SQUARES.push({ free: [a, b], fixed: vals, name: nameOf([a, b], vals) });
    }
  }
  function nameOf(free, fixed) {
    return [0, 1, 2, 3].map((k) => (free.includes(k) ? LETTERS[k] : String(fixed[k]))).join("");
  }
  const squareIndex = (name) => SQUARES.findIndex((s) => s.name === name);
  /** The four corners of a square in order round it. */
  function corners(sq) {
    const [a, b] = sq.free;
    return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([p, q]) => {
      const v = [0, 0, 0, 0];
      for (const k in sq.fixed) v[k] = sq.fixed[k];
      v[a] = p; v[b] = q;
      return v;
    });
  }

  /* ---------------------------------------------------- rotation and view */

  /** The rotation for the six angles (degrees), applied in the applet's order XY, YZ, XZ, XH, YH, ZH. */
  function rotation(angles) {
    let M = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    const planes = [["xy", 0, 1], ["yz", 1, 2], ["xz", 0, 2], ["xh", 0, 3], ["yh", 1, 3], ["zh", 2, 3]];
    for (const [key, i, j] of planes) {
      const t = ((angles[key] || 0) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
      const R = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
      R[i][i] = c; R[i][j] = -s; R[j][i] = s; R[j][j] = c;
      M = mul(R, M);
    }
    return M;
  }
  function mul(A, B) {
    return A.map((row) => B[0].map((_, j) => row.reduce((t, a, k) => t + a * B[k][j], 0)));
  }
  /** A 4D point turned about the centre (or about the origin O). */
  function turn(M, p, fixOrigin) {
    const c = fixOrigin ? 0 : 0.5;
    const q = p.map((x) => x - c);
    return M.map((row) => row.reduce((t, a, k) => t + a * q[k], 0));
  }
  const det = (M) => {
    // 4x4 determinant by expansion (to test that the rotation is proper)
    const m3 = (A) => A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) - A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) + A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0]);
    return M[0].reduce((t, a, j) => t + (j % 2 ? -1 : 1) * a * m3(M.slice(1).map((r) => r.filter((_, k) => k !== j))), 0);
  };

  /* --------------------------------------------------- the construction */

  /**
   * What is drawn at construction step k (0 point .. 4 tesseract) and
   * fraction t of its animation: the vertices (4D points) and edges, the
   * last dimension's copy sliding out from 0 to 1.
   */
  function construction(k, t) {
    const n = Math.max(0, Math.min(4, k));
    const pts = [], edges = [];
    const count = 1 << n;
    for (let i = 0; i < count; i++) {
      const v = [0, 0, 0, 0];
      for (let d = 0; d < n; d++) v[d] = (i >> d) & 1;
      if (n > 0 && v[n - 1] === 1) v[n - 1] = t; // the copy being swept out
      pts.push(v);
    }
    for (let i = 0; i < count; i++) for (let d = 0; d < n; d++) if (!(i >> d & 1)) edges.push([i, i | (1 << d), d]);
    return { pts, edges };
  }

  /** Counts of k-dimensional parts of the n-cube: the coefficients of (2x + 1)^n. */
  function faceCounts(n) {
    const out = [];
    for (let k = 0; k <= n; k++) out.push(binom(n, k) * 2 ** (n - k));
    return out;
  }
  function binom(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }

  /* --------------------------------------------------- the cross-section */

  /**
   * Where the hyperplane Ax + By + Cz + Dh = E meets the tesseract: for each
   * square, the segment between the points where it crosses the square's
   * edges. Returns {segments: [[p, q, squareName]], points}.
   */
  function section(P) {
    const f = (v) => P.A * v[0] + P.B * v[1] + P.C * v[2] + P.D * v[3] - P.E;
    const cross = new Map();
    const pointOn = (i, j) => {
      const key = `${i},${j}`;
      if (cross.has(key)) return cross.get(key);
      const a = VERTS[i], b = VERTS[j], fa = f(a), fb = f(b);
      let p = null;
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) { const t = fa / (fa - fb); p = a.map((x, k) => x + t * (b[k] - x)); }
      else if (fa === 0) p = a.slice();
      cross.set(key, p);
      return p;
    };
    const idx = (v) => v[0] + 2 * v[1] + 4 * v[2] + 8 * v[3];
    const segments = [];
    for (const sq of SQUARES) {
      const cs = corners(sq).map(idx), hits = [];
      for (let e = 0; e < 4; e++) {
        const i = cs[e], j = cs[(e + 1) % 4];
        const p = pointOn(Math.min(i, j), Math.max(i, j));
        if (p && !hits.some((q) => q.every((x, k) => Math.abs(x - p[k]) < 1e-12))) hits.push(p);
      }
      if (hits.length === 2) segments.push([hits[0], hits[1], sq.name]);
    }
    const points = [...cross.values()].filter(Boolean);
    return { segments, points };
  }

  /* ---------------------------------------------------------- the reper */

  /**
   * A reper on a square: two arrows, each +1 or -1 times a free axis of the
   * square, perpendicular. Position: {fixed: square index, moving: square
   * index, reper: [[axis, sign], [axis, sign]], fixedReper, history}.
   */
  function startPuzzle(options = {}) {
    const rnd = typeof options.random === "function" ? options.random : Math.random;
    const i = Number.isInteger(options.square) ? options.square : Math.trunc(rnd() * 24);
    const sq = SQUARES[i];
    const reper = [[sq.free[0], 1], [sq.free[1], 1]];
    return { fixed: i, moving: i, fixedReper: reper.map((r) => r.slice()), reper: reper.map((r) => r.slice()), history: [] };
  }

  /** The 8 squares sharing an edge with square i, and how the reper glides there. */
  function neighbours(i) {
    const S = SQUARES[i], out = [];
    for (const f of S.free) {
      const g = S.free.find((k) => k !== f);
      for (const beta of [0, 1]) {
        for (const c of Object.keys(S.fixed).map(Number)) {
          const d = Object.keys(S.fixed).map(Number).find((k) => k !== c);
          const fixed = { [f]: beta, [d]: S.fixed[d] };
          const free = [g, c].sort((p, q) => p - q);
          out.push({ to: squareIndex(nameOf(free, fixed)), across: { axis: f, value: beta }, into: c, keep: g });
        }
      }
    }
    return out;
  }

  /** Move the moving reper to neighbour j (an index of neighbours(moving)). */
  function glide(state, j) {
    const nb = neighbours(state.moving)[j];
    if (!nb) return null;
    const S = SQUARES[state.moving];
    const reper = state.reper.map(([axis, sign]) => {
      if (axis === nb.keep) return [axis, sign];
      // the arrow across the shared edge: unfolded flat, "towards the edge" in S
      // carries straight on into T, where it points "away from the edge"
      const awayS = nb.across.value === 0 ? 1 : -1;
      const awayT = S.fixed[nb.into] === 0 ? 1 : -1;
      return [nb.into, -sign * awayS * awayT];
    });
    return { ...state, moving: nb.to, reper, history: state.history.concat([state.moving]) };
  }

  /** Move to the neighbour square with this name. */
  function glideTo(state, name) {
    const j = neighbours(state.moving).findIndex((n) => SQUARES[n.to].name === name);
    return j < 0 ? null : glide(state, j);
  }

  /** Back: the previous square, with the reper as it was. */
  function back(state, previous) { return previous || null; }

  /** On the fixed square, +1 if the repers agree in orientation, -1 if not; null elsewhere. */
  function orientation(state) {
    if (state.moving !== state.fixed) return null;
    const [a, b] = SQUARES[state.fixed].free;
    const vec = ([axis, sign]) => [axis === a ? sign : 0, axis === b ? sign : 0];
    const d = ([u, v]) => { const p = vec(u), q = vec(v); return p[0] * q[1] - p[1] * q[0]; };
    return Math.sign(d(state.reper)) * Math.sign(d(state.fixedReper));
  }

  const solved = (state) => orientation(state) === -1;
  const result = (state) => (solved(state) ? "win" : null);

  /** Repeat: the moving reper back on the fixed square, as at the start. */
  const repeat = (state) => startPuzzle({ square: state.fixed });

  const reperText = (state) => state.reper.map(([axis, sign]) => `${sign > 0 ? "+" : "-"}${AXES[axis]}`).join(", ");

  return {
    AXES, LETTERS, ANGLES, PLANE, ANIM_STEPS, STEP_NAMES, VERTS, EDGES, SQUARES, nameOf, squareIndex, corners,
    rotation, turn, det, construction, faceCounts, section,
    startPuzzle, neighbours, glide, glideTo, back, orientation, solved, result, repeat, reperText,
  };
})();
