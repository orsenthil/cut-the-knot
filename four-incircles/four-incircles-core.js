"use strict";

/*
 * Four Incircles, from Alexander Bogomolny's applet FourIncircles.
 *
 * Apex A stands above a straight base holding B, C, D and E in that order.
 * The two cevians AC and AD cut triangle ABE into three small triangles; their
 * incircles are the level-1 circles. Joining pairs gives triangles ABD and ACE
 * (level 2) and the whole triangle ABE (level 3). The Five Incircles Theorem
 * says the outer level-1 circles are equal exactly when the two level-2
 * circles are. With g(x) = (AM + signed distance of x from the altitude's
 * foot) / h, a triangle's inradius is h/2 * (1 - g_left/g_right), so the two
 * equality tests share the same numerator g_C*g_D - g_B*g_E.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, FourIncirclesCore, so the page loads it with
 * a plain <script> and porting/check-four-incircles.mjs loads it in Node.
 * The position is plain data and every function returns a new position.
 */
const FourIncirclesCore = (() => {
  const N = 4;
  const NAMES = ["B", "C", "D", "E"];
  /** The applet's own "Finished" test: a one-pixel tolerance on radii. */
  const MATCH = 1;
  const WIDTH = 400;
  const HEIGHT = 300;
  const EPS = 1e-10;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Foot of the perpendicular from p onto the line through a and b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Inradius: area / semiperimeter, by Heron's formula. */
  function inradius(a, b, c) {
    const x = distance(b, c), y = distance(c, a), z = distance(a, b);
    const s = (x + y + z) / 2;
    if (s <= 0) return 0;
    const product = (s - x) * (s - y) * (s - z);
    return product > 0 ? Math.sqrt(product / s) : 0;
  }

  /** Incenter: barycentric coordinates weighted by the opposite side lengths. */
  function incenter(a, b, c) {
    const x = distance(b, c), y = distance(c, a), z = distance(a, b);
    const sum = x + y + z;
    if (sum < EPS) return { x: a.x, y: a.y };
    return {
      x: (x * a.x + y * b.x + z * c.x) / sum,
      y: (x * a.y + y * b.y + z * c.y) / sum,
    };
  }

  function incircle(a, b, c) {
    return { center: incenter(a, b, c), radius: inradius(a, b, c) };
  }

  /** The applet's Reset: four jittered base points and the apex at (w/3, m). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const rng = typeof o.rng === "function" ? o.rng : Math.random;
    const margin = Math.min(width, height) / 5;
    const left = margin, right = width - margin;
    const baseY = height - margin / 2;
    const points = [];
    for (let i = 0; i < N; i++) {
      // Java: (int)(Math.random()*20) - 20/2, i.e. a jitter of -10..9.
      const jitter = Math.floor(rng() * 20) - 10;
      points.push({
        x: left + (right - left) * i / (N - 1) + jitter,
        y: baseY,
      });
    }
    return {
      n: N, width: width, height: height,
      left: left, right: right, baseY: baseY,
      apex: { x: Math.floor(width / 3), y: margin },
      points: points,
      showNames: !!o.showNames,
    };
  }

  function reset(state, options) {
    const o = options || {};
    return start({
      width: state.width, height: state.height,
      showNames: state.showNames, rng: o.rng,
    });
  }

  /** The triangles A, M[i], M[i+level] that DrawCircles(g, level) draws. */
  function circles(state, level) {
    const k = clamp(Math.round(level === undefined ? 1 : level), 1, state.n - 1);
    const out = [];
    for (let i = 0; i + k < state.n; i++) {
      out.push(incircle(state.apex, state.points[i], state.points[i + k]));
    }
    return out;
  }

  function radii(state, level) {
    return circles(state, level).map((c) => c.radius);
  }

  function spread(values) {
    if (!values.length) return 0;
    return Math.max.apply(null, values) - Math.min.apply(null, values);
  }

  /**
   * The applet's own Finished flag: in DrawCircles(g, 1) it remembers the
   * first radius and sets Finished when the last level-1 radius is within one
   * pixel of it. Nothing is won or lost; this only lights the three eyes.
   */
  function matched(state, tolerance) {
    const rs = radii(state, 1);
    return rs.length >= 2 && Math.abs(rs[0] - rs[rs.length - 1]) <=
      (tolerance === undefined ? MATCH : tolerance);
  }

  /** Levels drawn after Draw(): level 1 always, more once Finished is set. */
  function visibleLevels(state) {
    const out = [1];
    if (matched(state)) for (let k = 2; k < state.n; k++) out.push(k);
    return out;
  }

  /** The offset the applet stores on mousePressed for a dragged point. */
  function dragDelta(state, name) {
    if (name === "C") return state.points[2].x - state.points[1].x;
    if (name === "D") return state.points[1].x - state.points[2].x;
    return -1;
  }

  /**
   * Mouse drag / arrow-key nudge of one point. VerifyPoint clamps the pointer
   * to [3, w-3] x [3, h-3]; UpdateLocation then projects a base point onto
   * the base line. The applet also slides C and D together so their gap never
   * changes; that quirk is kept here for both pointer and keyboard moves.
   */
  function movePoint(state, name, q) {
    if (name === "A") {
      return {
        ...state,
        apex: { x: clamp(q.x, 3, state.width - 3), y: clamp(q.y, 3, state.height - 3) },
      };
    }
    const i = NAMES.indexOf(name);
    if (i < 0) return state;
    const points = state.points.map((p) => ({ x: p.x, y: p.y }));
    const x = clamp(q.x, 3, state.width - 3);
    const delta = dragDelta(state, name);
    points[i] = { x: x, y: state.baseY };
    if (name === "C") points[2] = { x: x + delta, y: state.baseY };
    if (name === "D") points[1] = { x: x + delta, y: state.baseY };
    return { ...state, points: points };
  }

  /**
   * Convenience (not an applet control): put the four base points so their
   * g-values form a geometric progression of common ratio `ratio`. That makes
   * every level-1 circle equal, which is statement (B) on the page.
   */
  function makeEqual(state, ratio) {
    const h = state.baseY - state.apex.y;
    if (h < EPS) return {
      ...state, points: state.points.map((p) => ({ x: p.x, y: p.y })),
    };
    const gAt = (x) => (Math.sqrt((x - state.apex.x) ** 2 + h * h) + (x - state.apex.x)) / h;
    const gLo = gAt(clamp(state.left, 3, state.width - 3));
    const gHi = gAt(clamp(state.right, 3, state.width - 3));
    const maxRatio = Math.pow(gHi / gLo, 1 / (N - 1));
    const q = clamp(Number(ratio) || 1.6, 1.01, Math.max(1.02, maxRatio));
    const g0 = Math.sqrt(gLo * gHi / Math.pow(q, N - 1));
    const points = [];
    for (let i = 0; i < N; i++) {
      const g = g0 * Math.pow(q, i);
      points.push({ x: state.apex.x + h * (g - 1 / g) / 2, y: state.baseY });
    }
    return { ...state, points: points };
  }

  /** The plain, JSON-friendly position saved for the record and the tutor. */
  function position(state) {
    return {
      apex: { x: state.apex.x, y: state.apex.y },
      points: state.points.map((p) => ({ x: p.x, y: p.y })),
      level1: radii(state, 1),
      level2: radii(state, 2),
      matched: matched(state),
    };
  }

  return {
    N: N, NAMES: NAMES, MATCH: MATCH, WIDTH: WIDTH, HEIGHT: HEIGHT,
    distance: distance, clamp: clamp, foot: foot,
    inradius: inradius, incenter: incenter, incircle: incircle,
    start: start, reset: reset, circles: circles, radii: radii,
    spread: spread, matched: matched, visibleLevels: visibleLevels,
    dragDelta: dragDelta, movePoint: movePoint, makeEqual: makeEqual,
    position: position,
  };
})();
