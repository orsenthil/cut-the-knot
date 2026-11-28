"use strict";

/*
 * Mac Laurin's construction of conics — the geometry behind Bogomolny's applet.
 *
 * A triangle ABC has B on a line l and C on a line m. Its side BC must pass
 * through a fixed point W, so choosing B fixes C as (BW) ∩ m. The other sides
 * must pass through fixed points U (on AB) and V (on AC), so A is (BU) ∩ (CV).
 * When B slides along l, A traces a conic; when U, V and W are collinear the
 * conic breaks into a straight line through l ∩ m.
 *
 * This is a faithful transcription of MacLaurinConicsCanvas: its 0.7 glider
 * parameter, its -1.4 placement of W, the |det| < 1 NaN guard of GeoSDoub.Intersect,
 * the nearest-point projection of a point onto a line, the "cheating" choice of
 * which glider stays put when W is dragged, and the reset of the traced points
 * whenever a fixed point or a given line is moved.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, MaclaurinConicsCore, so the page loads it with a plain
 * <script> and porting/check-maclaurin-conics.mjs loads it in Node. The position
 * is plain data (numbers, strings, arrays and plain objects); every function
 * takes a position and returns new values without changing what it was given.
 */
const MaclaurinConicsCore = (() => {
  const VIEW = { width: 400, height: 300 };
  const COEF = 0.7;              // DoubLine.CreateMidPoint(Coef) in init()
  const W_COEF = -1.4;           // DoubLine.CreateMidPoint(-1.4) in init()
  const HANDLES = ["L0", "L1", "M0", "M1", "B", "C", "U", "V", "W"];

  const copy = (p) => ({ x: p.x, y: p.y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const line = (p, q) => ({ p: copy(p), q: copy(q) });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** DoubLine.CreateMidPoint(t): t·p1 + (1−t)·p2. */
  function createMidPoint(l, t) {
    return {
      x: t * l.p.x + (1 - t) * l.q.x,
      y: t * l.p.y + (1 - t) * l.q.y,
    };
  }

  /** GeoSDoub.Intersect: a Cramer solve with the applet's |det| < 1 guard. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  const intersectLines = (l, m) => intersect(l.p, l.q, m.p, m.q);

  /** GeoSDoub.NearestPoint(p, line): project, unless p is within 0.1 of p1. */
  function nearestPoint(p, l) {
    const dx = l.q.x - l.p.x, dy = l.q.y - l.p.y;
    if ((l.p.x - p.x) ** 2 + (l.p.y - p.y) ** 2 < 0.1) return copy(p);
    const t = ((p.x - l.p.x) * dx + (p.y - l.p.y) * dy) / (dx * dx + dy * dy || 1);
    return { x: l.p.x + dx * t, y: l.p.y + dy * t };
  }

  /** The starting board: the two given lines, the gliders and the fixed points. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? VIEW.width : o.width;
    const height = o.height === undefined ? VIEW.height : o.height;
    const hx = width / 2, hy = height / 2;
    const ends = [
      [
        { x: hx + Math.floor(width / 10), y: 0 },
        { x: hx, y: height },
      ],
      [
        { x: 0, y: hy },
        { x: width, y: hy },
      ],
    ];
    const B = createMidPoint(line(ends[0][0], ends[0][1]), COEF);
    const C = createMidPoint(line(ends[1][0], ends[1][1]), COEF);
    const U = { x: Math.floor(width / 4), y: Math.floor(height / 4) };
    const V = { x: Math.floor(3 * width / 4), y: Math.floor(height / 4) };
    const W = createMidPoint(line(B, C), W_COEF);
    const s = {
      width, height, coef: COEF, ends,
      B, C, U, V, W,
      names: true, extra: false, collect: true, explored: false,
      trace: [],
    };
    const x = compute(s).X;
    s.trace = finite(x) ? [copy(x)] : [];
    return s;
  }

  /** The two given lines, the moving triangle, A and the extra Pascal points. */
  function compute(state) {
    const l = line(state.ends[0][0], state.ends[0][1]);
    const m = line(state.ends[1][0], state.ends[1][1]);
    const sides = [
      line(state.B, state.U),
      line(state.C, state.V),
      line(state.B, state.C),
    ];
    const x = intersectLines(sides[0], sides[1]);
    const extraLines = [line(state.W, state.U), line(state.W, state.V)];
    const extraPoints = [
      intersectLines(extraLines[1], l),
      intersectLines(extraLines[0], m),
      intersectLines(l, m),
    ];
    return {
      l, m, sides, X: x, extraLines, extraPoints,
      lCapM: extraPoints[2],
    };
  }

  /** Reset(): the applet drops the locus whenever a fixed object is moved. */
  function clearTrace(state) {
    return { ...state, trace: [], collect: false };
  }

  /** UpgradePointOnLine(): put a glider back at the line's stored fraction. */
  function upgradePointOnLine(state, i) {
    const p = createMidPoint(line(state.ends[i][0], state.ends[i][1]), state.coef);
    const gliders = [copy(state.B), copy(state.C)];
    gliders[i] = p;
    return { ...state, B: gliders[0], C: gliders[1] };
  }

  /**
   * UpgradeLineThroughPoint(): keep the other glider on its line, on the line
   * through the moving glider and W. This is what makes BC pass through W.
   */
  function upgradeLineThroughPoint(state, i) {
    const j = 1 - i;
    const moving = i === 0 ? state.B : state.C;
    const otherLine = line(state.ends[j][0], state.ends[j][1]);
    const q = intersectLines(line(moving, state.W), otherLine);
    if (!finite(q)) return state;
    return i === 0 ? { ...state, C: q } : { ...state, B: q };
  }

  /** CheatingPointUpgrade(): hold the glider nearer W, move the farther one. */
  function cheatingPointUpgrade(state) {
    const i = dist(state.W, state.B) > dist(state.W, state.C) ? 1 : 0;
    return upgradeLineThroughPoint(state, i);
  }

  /** CollectPoints: append A once the new point is more than one unit away. */
  function withTrace(state) {
    if (!state.collect) return state;
    const x = compute(state).X;
    if (!finite(x)) return state;
    const last = state.trace[state.trace.length - 1];
    if (last && dist(last, x) <= 1) return state;
    return { ...state, trace: [...state.trace, copy(x)] };
  }

  /** The moves the picture offers: nine draggable points. */
  function legalMoves() { return HANDLES.slice(); }

  /** Move one of the nine handles to p, with the applet's follow-up fix-ups. */
  function move(state, who, p) {
    if (HANDLES.indexOf(who) < 0 || !finite(p)) return state;
    let s = { ...state };
    if (who === "B" || who === "C") {
      const i = who === "B" ? 0 : 1;
      s[i === 0 ? "B" : "C"] = nearestPoint(p, line(s.ends[i][0], s.ends[i][1]));
      s.collect = true;                       // FindMovingPoint set CollectPoints
      s = upgradeLineThroughPoint(s, i);
    } else if (who === "W") {
      s = clearTrace({ ...s, W: copy(p) });
      s = cheatingPointUpgrade(s);
    } else if (who === "U" || who === "V") {
      s = clearTrace({ ...s, [who]: copy(p) });
    } else {
      const i = who === "L0" || who === "L1" ? 0 : 1;
      const end = who === "L0" || who === "M0" ? 0 : 1;
      const ends = s.ends.map((pair) => pair.map(copy));
      ends[i][end] = copy(p);
      s = clearTrace({ ...s, ends });
      s = upgradePointOnLine(s, i);
      if (dist(s.B, s.C) > 1) s = cheatingPointUpgrade(s);
    }
    return withTrace(s);
  }

  /** A legal board position, small enough to hand to the tutor. */
  function position(state) {
    return {
      ends: state.ends.map((pair) => pair.map(copy)),
      B: copy(state.B), C: copy(state.C),
      U: copy(state.U), V: copy(state.V), W: copy(state.W),
      names: state.names, extra: state.extra,
      trace: state.trace.slice(-24).map(copy),
    };
  }

  /** Make U, V and W collinear without disturbing the current B and C. */
  function straightLinePreset(state) {
    const initial = start({ width: state.width, height: state.height });
    const s = { ...state, U: initial.U, V: initial.V };
    const bc = line(state.B, state.C);
    const uv = line(s.U, s.V);
    const w = intersectLines(bc, uv);
    s.W = finite(w) ? w : { x: (s.U.x + s.V.x) / 2, y: (s.U.y + s.V.y) / 2 };
    s.collect = true;
    s.explored = false;
    s.trace = [];
    return withTrace(s);
  }

  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  /** Signed distance from p to the infinite line ab. */
  function pointLineDistance(p, a, b) {
    const len = dist(a, b);
    return len ? Math.abs(cross(a, b, p)) / len : Infinity;
  }

  function collinear(a, b, c) {
    const scale = Math.max(1, dist(a, b), dist(a, c), dist(b, c));
    return Math.abs(cross(a, b, c)) <= 1e-9 * scale * scale;
  }

  /** Solve A v = b by Gaussian elimination with partial pivoting. */
  function solve(A, b) {
    const n = b.length;
    const a = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
      }
      if (Math.abs(a[pivot][col]) < 1e-14) return null;
      [a[col], a[pivot]] = [a[pivot], a[col]];
      for (let r = col + 1; r < n; r++) {
        const f = a[r][col] / a[col][col];
        for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
      }
    }
    const v = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = a[i][n];
      for (let j = i + 1; j < n; j++) sum -= a[i][j] * v[j];
      v[i] = sum / a[i][i];
    }
    return v;
  }

  /**
   * Least-squares conic a x² + b xy + c y² + d x + e y + 1 = 0, fitted to the
   * traced A positions. Coordinates are centred and scaled first so the normal
   * equations stay well conditioned on a 400 by 300 board.
   */
  function fitConic(points) {
    const pts = points.filter(finite);
    if (pts.length < 5) return null;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const sc = Math.max(1, ...pts.map((p) => Math.hypot(p.x - cx, p.y - cy)));
    const rows = pts.map((p) => {
      const x = (p.x - cx) / sc, y = (p.y - cy) / sc;
      return [x * x, x * y, y * y, x, y, -1];
    });
    const A = Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 5 }, (_, j) => rows.reduce((s, r) => s + r[i] * r[j], 0)));
    const b = Array.from({ length: 5 }, (_, i) => rows.reduce((s, r) => s + r[i] * r[5], 0));
    const v = solve(A, b);
    if (!v) return null;
    const [a, bb, c, d, e] = v;
    let maxResidual = 0;
    for (let i = 0; i < pts.length; i++) {
      const px = (pts[i].x - cx) / sc;
      const py = (pts[i].y - cy) / sc;
      const f = a * px * px + bb * px * py + c * py * py + d * px + e * py + 1;
      const gx = 2 * a * px + bb * py + d, gy = bb * px + 2 * c * py + e;
      maxResidual = Math.max(maxResidual, Math.abs(f) / (Math.hypot(gx, gy) || 1) * sc);
    }
    return { maxResidual, discriminant: bb * bb - 4 * a * c };
  }

  /** Test the page's claim on the positions the player has actually traced. */
  function classify(state) {
    const g = compute(state);
    /* Only points near the board are visible; very distant ones come from
       nearly parallel sides and would only spoil the numerical fit. */
    const pts = state.trace.filter((p) => finite(p) &&
      Math.abs(p.x) <= 4 * state.width && Math.abs(p.y) <= 4 * state.height);
    const degenerate = collinear(state.U, state.V, state.W);
    if (degenerate) {
      const through = finite(g.lCapM) ? g.lCapM : pts[0];
      let maxResidual = 0;
      for (const p of pts) maxResidual = Math.max(maxResidual, pointLineDistance(p, through, pts[0] || state.B));
      return {
        kind: "line", degenerate: true, passes: pts.length >= 3 && maxResidual < 0.5,
        maxResidual, through: copy(through), count: pts.length,
      };
    }
    const fit = fitConic(pts);
    return {
      kind: "conic", degenerate: false,
      passes: Boolean(fit && pts.length >= 5 && fit.maxResidual < 0.5),
      maxResidual: fit ? fit.maxResidual : Infinity,
      discriminant: fit ? fit.discriminant : NaN,
      count: pts.length,
    };
  }

  /** The status line: what the applet would tell the player right now. */
  function describe(state) {
    const x = compute(state).X;
    const where = finite(x)
      ? `A is at (${Math.round(x.x)}, ${Math.round(x.y)}).`
      : "The moving sides are parallel here; A has run off the board.";
    const kind = collinear(state.U, state.V, state.W)
      ? "U, V and W lie on one line."
      : "U, V and W are not on one line.";
    return `${where} ${kind} ${state.trace.length} positions traced.`;
  }

  /** An illustration has no win and no loss. */
  function result() { return null; }

  return {
    VIEW, COEF, HANDLES,
    start, compute, move, legalMoves, result, position, classify, describe,
    createMidPoint, intersect, nearestPoint,
    upgradePointOnLine, upgradeLineThroughPoint, cheatingPointUpgrade,
    clearTrace, withTrace, straightLinePreset,
    collinear, dist, pointLineDistance, fitConic,
  };
})();
