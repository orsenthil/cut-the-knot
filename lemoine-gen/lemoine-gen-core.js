"use strict";

/*
 * Lemoine Gen, from Alexander Bogomolny's LemoineGen applet.
 *
 * Start with a triangle ABC and a free point M. From a moving point P the
 * applet draws the line through P parallel to AM and meets it with BC; that
 * is the red step. The blue step drops a perpendicular from P to a side line.
 * The two walks cycle through the sides, and the applet redraws their last
 * three positions while a timer keeps the picture alive. The key fact used
 * by the test is that both walks are affine maps: after three steps each
 * lands on the same side, so the map on one side has a fixed point. That
 * fixed point has barycentrics (1/y : 1/z : 1/x) when M has (x : y : z);
 * taking M at the symmedian point gives the ordinary Lemoine iterations.
 *
 * No document, no window, no storage: one global, LemoineGenCore. The state
 * is plain data so the page can hand it to the progress tracker.
 */
const LemoineGenCore = (() => {
  "use strict";

  const SIDES = [[1, 2], [2, 0], [0, 1]]; // BC, CA, AB, the order of m_Lines
  const BIG_NUMBER = 24;                  // the applet's Vector trimming limit
  const PARALLEL_SCALE = 100;             // GeoSDoub.GetParallelTo's factor

  const pt = (x, y) => ({ x, y });
  const samePoint = (a, b) =>
    !!a && !!b && Number.isFinite(a.x) && Number.isFinite(b.x) &&
    Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

  /** GeoSDoub.Intersect: lines p..q and a..b, in homogeneous coordinates. */
  function intersect(p, q, a, b) {
    const d1 = q.x - p.x, d2 = q.y - p.y;
    const d3 = b.x - a.x, d4 = b.y - a.y;
    const c1 = p.x * q.y - p.y * q.x;
    const c2 = a.x * b.y - a.y * b.x;
    const det = d1 * d4 - d2 * d3;
    if (Math.abs(det) < 1e-12) return pt(NaN, NaN);
    return pt((d1 * c2 - d3 * c1) / det, (d2 * c2 - d4 * c1) / det);
  }

  /** NearestPoint(P,a,b): the perpendicular foot, with the applet's guard. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if ((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) < 0.1) return p;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / len2;
    return pt(a.x + dx * t, a.y + dy * t);
  }

  /** GetParallelTo(P,M,V) = P + 100 * (M - V). */
  function parallelPoint(p, m, v) {
    return pt(p.x + PARALLEL_SCALE * (m.x - v.x),
      p.y + PARALLEL_SCALE * (m.y - v.y));
  }

  /** Signed area factor: twice the area with the orientation kept. */
  function area2(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  /** Barycentrics.FromPoint: the sub-areas are flipped to match ABC's turn. */
  function orientation(a, b, c) {
    return area2(a, b, c) > 0 ? 1 : -1;
  }
  function barycentric(p, vertices) {
    const [a, b, c] = vertices;
    const total = area2(a, b, c);
    const turn = orientation(a, b, c);
    const subs = [area2(p, b, c), area2(a, p, c), area2(a, b, p)];
    const turns = [orientation(p, b, c), orientation(a, p, c), orientation(a, b, p)];
    return subs.map((value, i) => (turn === turns[i] ? value : -value) / total);
  }

  /** The point with the given barycentric coordinates (not normalised here). */
  function fromBarycentric(w, vertices) {
    const sum = w[0] + w[1] + w[2];
    return pt((w[0] * vertices[0].x + w[1] * vertices[1].x + w[2] * vertices[2].x) / sum,
      (w[0] * vertices[0].y + w[1] * vertices[1].y + w[2] * vertices[2].y) / sum);
  }

  /** ComputeCenter(): the fixed point of the two cycles. Null if a weight is 0. */
  function center(vertices, m) {
    const w = barycentric(m, vertices);
    if (w[0] === 0 || w[1] === 0 || w[2] === 0) return null;
    const inv = [1 / w[0], 1 / w[1], 1 / w[2]];
    return fromBarycentric([inv[1] + inv[2], inv[2] + inv[0], inv[0] + inv[1]], vertices);
  }

  /** Reflect(P, C) = 2C - P, exactly as in the canvas. */
  function reflect(p, c) {
    return pt(2 * c.x - p.x, 2 * c.y - p.y);
  }

  /** The symmedian point (Lemoine point) a²:b²:c² of the triangle. */
  function symmedianPoint(vertices) {
    const [a, b, c] = vertices;
    const sa = Math.hypot(b.x - c.x, b.y - c.y);
    const sb = Math.hypot(c.x - a.x, c.y - a.y);
    const sc = Math.hypot(a.x - b.x, a.y - b.y);
    return fromBarycentric([sa * sa, sb * sb, sc * sc], vertices);
  }

  /**
   * GetThePoint(P, side, vertex, useReflected): intersect the line through P
   * parallel to M-vertex with the given side. `reflected` is the applet's
   * m_iM switch, which is never switched on in LemoineGen.
   */
  function getThePoint(p, vertices, sideIndex, vertexIndex, m, reflected) {
    const [u, v] = SIDES[sideIndex];
    const guide = reflected ? m.iM : m.point;
    return intersect(p, parallelPoint(p, guide, vertices[vertexIndex]),
      vertices[u], vertices[v]);
  }

  /** CollectIterations(): one step of each walk with the current `which`. */
  function collect(state) {
    const n = state.red.length;
    if (n < 1) return state;
    const which = state.which;
    const lastRed = state.red[n - 1];
    const lastBlue = state.blue[n - 1];
    const red = getThePoint(lastRed, state.ABC, which, which, state, false);

    const nextSide = which === 1 ? 2 : which === 2 ? 1 : 0;
    const foot = nearestPoint(lastBlue, state.ABC[SIDES[nextSide][0]],
      state.ABC[SIDES[nextSide][1]]);
    const blue = getThePoint(foot, state.ABC, nextSide, nextSide, state, false);

    const reds = state.red.concat([red]);
    const blues = state.blue.concat([blue]);
    return { ...state, red: reds, blue: blues };
  }

  /** ClearVector: the applet keeps at most 24 entries when Which is 0. */
  function trimVector(vector, which) {
    if (vector.length < 3 || vector.length <= BIG_NUMBER) return vector;
    const first = vector.length - which - 4;
    return vector.slice(Math.max(0, first));
  }

  /** TrimVectors(): keep the oldest surviving point of each walk. */
  function trim(state) {
    const red = trimVector(state.red, state.which);
    const blue = trimVector(state.blue, state.which);
    const seed = red.length ? red[0] : state.seed;
    return { ...state, red: [seed], blue: [seed], which: 0 };
  }

  /**
   * The starting configuration. `GetPoint(i)` places the corners on a circle
   * of radius min(width,height)/3 about the canvas centre, with the start
   * point M at (A + 2B + 2C)/5 (the symmedian point of an equilateral start).
   */
  function start(options) {
    const o = options || {};
    const width = o.width || 500;   // the applet tag: WIDTH=500 HEIGHT=300
    const height = o.height || 300;
    const radius = Math.floor(Math.min(width, height) / 3);
    const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
    const circlePoint = (i) => pt(
      Math.trunc(cx + radius * Math.cos(2 * Math.PI * (i - 1) / 3)),
      Math.trunc(cy + radius * Math.sin(2 * Math.PI * (i - 1) / 3)));
    const ABC = [circlePoint(0), circlePoint(1), circlePoint(2)];
    const m = o.M || pt((ABC[0].x + 2 * ABC[1].x + 2 * ABC[2].x) / 5,
      (ABC[0].y + 2 * ABC[1].y + 2 * ABC[2].y) / 5);
    const seed = o.seed || pt(Math.floor(width / 2), Math.floor(height / 2));
    return {
      ABC,
      point: m,
      iM: null,
      seed,
      red: [seed],
      blue: [seed],
      which: 0,
      running: false,
      show: { red: false, blue: false, connections: false, center: false,
        reflection: false, cevians: false },
    };
  }

  /** movePoint: drag one of A, B, C or M and trim the two walks. */
  function movePoint(state, name, p) {
    if (["A", "B", "C"].indexOf(name) >= 0) {
      const ABC = state.ABC.slice();
      ABC[["A", "B", "C"].indexOf(name)] = pt(p.x, p.y);
      return trim({ ...state, ABC, seed: p });
    }
    if (name === "M") return trim({ ...state, point: pt(p.x, p.y), seed: p });
    return state;
  }

  /** restart: a click away from the four handles starts both walks again. */
  function restart(state, p) {
    return { ...state, red: [pt(p.x, p.y)], blue: [pt(p.x, p.y)], which: 0,
      running: true, seed: pt(p.x, p.y) };
  }

  /** step: one CollectIterations() followed by Which = (Which + 1) mod 3. */
  function step(state) {
    const next = collect(state);
    return {
      ...next,
      red: trimVector(next.red, state.which),
      blue: trimVector(next.blue, state.which),
      which: (state.which + 1) % 3,
    };
  }

  /** run: keep stepping until the walks settle, or for at most `limit` steps. */
  function run(state, limit) {
    let s = state;
    const max = limit === undefined ? 60 : limit;
    for (let i = 0; i < max; i++) {
      const next = step(s);
      const n = next.red.length;
      if (n >= 7 && samePoint(next.red[n - 1], s.red[s.red.length - 1]) &&
        samePoint(next.blue[n - 1], s.blue[s.blue.length - 1])) return next;
      s = next;
    }
    return s;
  }

  /** toggle one of the six checkboxes; Red and Blue also stop the timer. */
  function toggle(state, name, on) {
    if (!(name in state.show)) return state;
    const show = { ...state.show, [name]: !!on };
    return { ...state, show, running: false };
  }

  /** legalMoves/result/move: an illustration has no win or loss. */
  function legalMoves(state) {
    return ["A", "B", "C", "M"];
  }
  function result(state) {
    return null;
  }
  function move(state, m) {
    if (!m) return null;
    if (m.type === "step") return step(state);
    if (m.type === "run") return run(state, m.limit);
    if (m.type === "restart") return restart(state, m.point);
    if (m.type === "toggle") return toggle(state, m.name, m.on);
    if (m.name) return movePoint(state, m.name, m.point);
    return null;
  }

  return {
    start, move, legalMoves, result, step, run, collect, trim, trimVector,
    intersect, nearestPoint, parallelPoint, center, reflect, barycentric,
    fromBarycentric, symmedianPoint, geo: { getThePoint, area2 },
    SIDES, BIG_NUMBER, PARALLEL_SCALE,
  };
})();
