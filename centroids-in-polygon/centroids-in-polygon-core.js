"use strict";

/*
 * Centroids In Polygon — Alexander Bogomolny's applet CentroidsInPolygon.
 *
 * Let P = P1 ... PN be any polygon with a unit weight at every vertex.  Q[i]
 * is the centroid of the polygon left when P[i] is dropped, i.e. the average
 * of the other N-1 vertices.  Write S for the sum of all N vertices and
 * G = S/N.  Then
 *
 *     Q[i] = (S - P[i])/(N-1) = G - (P[i] - G)/(N-1).
 *
 * So every line P[i]Q[i] passes through G, with P[i]G/GQ[i] = N-1, and Q is a
 * copy of P scaled by -1/(N-1) about G.  For N = 3 this is the familiar
 * 2:1 split of a triangle's medians.
 *
 * The options come straight from CentroidsInPolygonPanel: N runs from 3 to 20
 * (CTKNumberCanvas.SetRange(3,20)), Cycle starts at 0 and advances by
 * (Cycle+1) % (N+1), and Hint is only enabled when Cycle != 0 and N == 4.
 * Changing N calls Reset() but leaves Cycle and Hint alone.  Reset() puts the
 * vertices on a circle of radius min(W,H)/4 about the canvas centre, with a
 * small random angle jitter; here that jitter is replaced by a deterministic
 * one so the starting picture is stable.  It changes no geometry.
 *
 * This file is only the geometry and the rules: no document, no window, no
 * storage.  It defines one global, CentroidsInPolygonCore, so the page loads
 * it with a plain <script> and porting/check-centroids-in-polygon.mjs loads
 * it in Node.  Positions are plain data in the SVG viewBox units.
 */
const CentroidsInPolygonCore = (() => {
  /* The applet suggests 400x300; the SVG uses the same viewBox. */
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 18;
  const N_MIN = 3;
  const N_MAX = 20;
  const CENTER = { x: VIEW.width / 2, y: VIEW.height / 2 };
  const RADIUS = Math.min(VIEW.width, VIEW.height) / 4; // Reset()'s L5

  const point = (x, y) => ({ x, y });
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function valid(p) {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  }

  /** Keep a vertex inside the board, with room for its handle and label. */
  function clampPoint(p) {
    return point(
      clamp(p.x, VIEW.x + PAD, VIEW.x + VIEW.width - PAD),
      clamp(p.y, VIEW.y + PAD, VIEW.y + VIEW.height - PAD),
    );
  }

  function nOf(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return clamp(Math.round(n), N_MIN, N_MAX);
  }

  /** Reset(): the vertices sit on a circle, one full turn divided by N. */
  function layout(n) {
    const points = [];
    for (let i = 0; i < n; i++) {
      /* Reset() adds (PI/N) * Math.random() to 2*PI*i/N.  A reproducible
       * jitter in that same interval keeps the slightly uneven starting
       * polygon without making the page jump on every load. */
      const jitter = (Math.PI / n) * (((i * 7 + 3) % 11) / 11);
      const angle = ((2 * Math.PI) / n) * i + jitter;
      points.push(point(CENTER.x + RADIUS * Math.cos(angle), CENTER.y + RADIUS * Math.sin(angle)));
    }
    return points;
  }

  /** The position a new diagram starts from (N = 4, Cycle = 0, Hint off). */
  function start(options) {
    const o = options || {};
    const n = nOf(o.n === undefined ? 4 : o.n, 4);
    return {
      n: n,
      points: layout(n),
      cycle: 0,
      hint: false,
      explored: false,
    };
  }

  /** Reset() rebuilds the vertices but does not touch Cycle or Hint. */
  function reset(state) {
    const s = start({ n: state.n });
    s.cycle = state.cycle;
    s.hint = state.hint;
    s.explored = state.explored;
    return s;
  }

  /** The panel's number canvas: a change rebuilds the polygon, keeping Cycle. */
  function setN(state, value) {
    const n = nOf(value, state.n);
    if (n === state.n) return state;
    const s = start({ n: n });
    s.cycle = state.cycle;
    s.hint = state.hint;
    s.explored = true;
    return s;
  }

  /** The Cycle button: Cycle = (Cycle + 1) % (N + 1). */
  function cycle(state) {
    return Object.assign({}, state, {
      cycle: (state.cycle + 1) % (state.n + 1),
      explored: true,
    });
  }

  /* CentroidsInPolygonPanel enables Hint only for a 4-gon with Cycle != 0.
   * Disabling a Java checkbox does not uncheck it, so hint stays in the state. */
  function hintEnabled(state) {
    return state.n === 4 && state.cycle !== 0;
  }

  function setHint(state, on) {
    if (!hintEnabled(state)) return state;
    return Object.assign({}, state, { hint: !!on, explored: true });
  }

  /** Drag one vertex; the index is 0-based. */
  function movePoint(state, index, p) {
    if (!Number.isInteger(index) || index < 0 || index >= state.n || !valid(p)) return state;
    const points = state.points.slice();
    points[index] = clampPoint(p);
    return Object.assign({}, state, { points: points, explored: true });
  }

  /* BaryCenter(int i), transcribed from the bytecode: add every P[j] except
   * P[i], then divide the two sums by (N-1) as doubles. */
  function barycenterExcept(points, i) {
    let x = 0, y = 0;
    for (let j = 0; j < points.length; j++) {
      if (j === i) continue;
      x += points[j].x;
      y += points[j].y;
    }
    return point(x / (points.length - 1), y / (points.length - 1));
  }

  /* BaryCenter(DoubPoint, DoubPoint) — the midpoint used by DrawHint. */
  function barycenterOfPair(p, q) {
    return point((p.x + q.x) / 2, (p.y + q.y) / 2);
  }

  function distToLine(p, a, b) {
    const d = dist(a, b);
    if (d === 0) return dist(p, a);
    return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / d;
  }

  function geometry(state) {
    if (!state || !Array.isArray(state.points) || state.points.length !== state.n) return null;
    if (state.n < N_MIN || state.n > N_MAX || !state.points.every(valid)) return null;
    const P = state.points;
    const n = state.n;

    // The barycenter G of all the vertices, and each Q[i] from BaryCenter(i).
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += P[i].x; sy += P[i].y; }
    const G = point(sx / n, sy / n);
    const Q = [];
    for (let i = 0; i < n; i++) Q.push(barycenterExcept(P, i));

    let scale = 1;
    for (let i = 0; i < n; i++) scale = Math.max(scale, dist(P[i], G));
    const tol = 1e-9 * scale;

    let lineError = 0, homothetyError = 0, ratioError = 0;
    let between = true, nonDegenerate = true;
    for (let i = 0; i < n; i++) {
      lineError = Math.max(lineError, distToLine(G, P[i], Q[i]));

      // G must lie between P[i] and Q[i], not just on the same infinite line.
      const v = sub(Q[i], P[i]);
      const t = dot(sub(G, P[i]), v) / Math.max(dot(v, v), Number.MIN_VALUE);
      if (t < -1e-9 || t > 1 + 1e-9) between = false;

      // Q[i] - G = -(P[i] - G)/(n-1): this is the whole claim in one line.
      const expected = add(G, mul(sub(G, P[i]), 1 / (n - 1)));
      homothetyError = Math.max(homothetyError, dist(Q[i], expected));

      const pg = dist(P[i], G), gq = dist(G, Q[i]);
      if (gq <= tol || pg <= tol) nonDegenerate = false;
      else ratioError = Math.max(ratioError, Math.abs(pg / gq - (n - 1)));
    }

    /* DrawPolys(g, Cycle-1): for Cycle > 0 it joins every vertex except
     * P[Cycle-1] into an (N-1)-gon and marks that vertex's Q with a dot. */
    let highlighted = null;
    if (state.cycle !== 0) {
      const excluded = (state.cycle - 1) % n;
      const rest = [];
      for (let k = 1; k < n; k++) rest.push(P[(excluded + k) % n]);
      const hintLines = [];
      if (n === 4) {
        const a = (excluded + 1) % 4, b = (excluded + 2) % 4, c = (excluded + 3) % 4;
        // DrawHint(g, Cycle-1): midpoint of two of the three corners to the third.
        hintLines.push([barycenterOfPair(P[a], P[b]), P[c]]);
        hintLines.push([barycenterOfPair(P[b], P[c]), P[a]]);
        hintLines.push([barycenterOfPair(P[c], P[a]), P[b]]);
      }
      highlighted = {
        index: excluded,
        vertex: P[excluded],
        centroid: Q[excluded],
        polygon: rest,
        hintLines: hintLines,
      };
    }

    return {
      n: n, P: P, Q: Q, G: G,
      cycle: state.cycle,
      hint: state.hint && hintEnabled(state),
      highlighted: highlighted,
      measures: {
        lineError: lineError,
        homothetyError: homothetyError,
        ratioError: ratioError,
        scale: scale,
      },
      claims: {
        concurrent: lineError <= tol && between,
        ratio: nonDegenerate && ratioError <= 1e-7 * (n - 1),
        homothety: homothetyError <= tol,
      },
      degenerate: !nonDegenerate,
      tol: tol,
    };
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move the corners so they make a polygon with room to see it.";
    if (g.degenerate) return "Pull a corner away from the middle: a line cannot be divided when its two ends land on the same spot.";
    let text = `All ${g.n} lines meet at one dot, and each is cut in the ratio ${g.n - 1} to 1.`;
    if (g.highlighted) {
      text += ` Vertex ${g.highlighted.index + 1} is picked out: the other ${g.n - 1} corners have the marked centre.`;
    }
    if (g.hint) text += " The Hint draws the three medians of the triangle made by the other corners.";
    return text;
  }

  /* An illustration has no win, no loss and no finishing move. */
  function result(state) {
    return null;
  }

  /** The plain, storable position for Track.state() and the tutor. */
  function snapshot(state) {
    const g = geometry(state);
    return {
      n: state.n,
      points: state.points.map((p) => point(p.x, p.y)),
      cycle: state.cycle,
      hint: state.hint,
      Q: g ? g.Q.map((p) => point(p.x, p.y)) : null,
      G: g ? point(g.G.x, g.G.y) : null,
      claims: g ? g.claims : null,
    };
  }

  return {
    VIEW: VIEW, PAD: PAD, N_MIN: N_MIN, N_MAX: N_MAX, CENTER: CENTER, RADIUS: RADIUS,
    point: point, sub: sub, add: add, mul: mul, dist: dist, dot: dot,
    midpoint: midpoint, clamp: clamp, clampPoint: clampPoint,
    start: start, reset: reset, setN: setN, cycle: cycle,
    hintEnabled: hintEnabled, setHint: setHint, movePoint: movePoint,
    barycenterExcept: barycenterExcept, barycenterOfPair: barycenterOfPair,
    geometry: geometry, describe: describe, result: result, snapshot: snapshot,
  };
})();
