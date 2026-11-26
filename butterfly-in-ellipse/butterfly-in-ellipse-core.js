"use strict";

/*
 * Butterfly in Ellipse — the geometry behind Bogomolny's illustration.
 *
 * Four (or more) vertices P[0..N-1] sit on an ellipse. Side i joins P[i] to
 * P[i-1], and L[i] is the point where that side crosses a fixed straight line.
 * Drag one vertex along the ellipse and the applet keeps every L[i] pinned:
 * it walks backwards around the polygon, replacing each earlier vertex by the
 * second place where the line through the previous L and the previous vertex
 * meets the ellipse. For an even-sided polygon the last side then passes
 * through the remaining L too — the butterfly porism. The page proves it with
 * two applications of Pascal's hexagon theorem and notes that incidences are
 * projective, so an ellipse is no harder than a circle.
 *
 * The arithmetic is the applet's own: the ellipse is a unit circle stretched
 * by (A, B) and shifted to its centre; line intersections are GeoSDoub's
 * Cramer solve with its "|det| < 1 means NaN" guard; and a secant's second
 * ellipse crossing comes from the same circle transform with the applet's
 * root order (the root with +sqrt first).
 *
 * This file is logic only: no document, no window, no storage. It defines one
 * global, ButterflyInEllipseCore, so a page loads it with a plain <script> and
 * porting/check-butterfly-in-ellipse.mjs loads it in Node. Positions are plain
 * data, and no function changes the position it is given.
 */
const ButterflyInEllipseCore = (() => {
  const EPS = 1e-9;
  const VIEW = { width: 400, height: 300 };
  const N_MIN = 4;
  const N_MAX = 20;
  const POINT_NAMES = "ABCDEFGHIJKLMNOPQRST".split("");
  /* The four labels the applet's "Show names" checkbox prints for N = 4. */
  const L_NAMES = ["da", "ab", "bc", "cd"];

  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));

  /** A deterministic Math.random, so a picture can be replayed and saved. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** CTKEllipse(MoveablePoint[]): corners V0,V1 and V1,V2 fix centre and radii. */
  function ellipseFrom(V) {
    return {
      center: { x: (V[0].x + V[1].x) / 2, y: (V[1].y + V[2].y) / 2 },
      inf: { x: (V[0].x + V[1].x) / 2 + 200, y: (V[1].y + V[2].y) / 2 },
      A: (V[1].x - V[0].x) / 2,
      B: (V[1].y - V[2].y) / 2,
    };
  }

  /** CTKEllipse.EllipseAt(t). */
  function pointAt(e, t) {
    return { x: e.center.x + e.A * Math.cos(t), y: e.center.y + e.B * Math.sin(t) };
  }

  /** GeoSDoub.FindOrientation(a,b,c): +1 for a left turn, else -1. */
  function orientation(a, b, c) {
    const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle(a,b,c), used by CTKEllipse.KeepOnEllipse. */
  function signedAngle(a, b, c) {
    const cosv = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) /
      (2 * dist(a, b) * dist(a, c));
    const angle = Math.acos(Math.min(1, Math.max(-1, cosv)));
    return orientation(a, b, c) === 1 ? angle : -angle;
  }

  /** CTKEllipse.KeepOnEllipse: slide a dragged point back onto the ellipse. */
  function keepOnEllipse(e, p) {
    if (Math.abs(e.A) < EPS || Math.abs(e.B) < EPS) return copy(p);
    const u = { x: (p.x - e.center.x) / e.A, y: (p.y - e.center.y) / e.B };
    if (sqDist(u, { x: 0, y: 0 }) < EPS * EPS) return pointAt(e, 0);
    const onUnitCircle = { x: e.center.x + u.x, y: e.center.y + u.y };
    return pointAt(e, signedAngle(e.center, e.inf, onUnitCircle));
  }

  /** CTKEllipse.MaintainRect: the moved corner is mirrored across the centre. */
  function maintainRect(V, index, p) {
    const c = ellipseFrom(V).center;
    const dx = c.x - p.x, dy = c.y - p.y;
    const v = V.map(copy);
    v[index] = copy(p);
    const set = (i, x, y) => { v[i].x = x; v[i].y = y; };
    if (index === 0) {
      set(1, c.x + dx, c.y - dy); set(2, c.x + dx, c.y + dy); set(3, c.x - dx, c.y + dy);
    } else if (index === 1) {
      set(0, c.x + dx, c.y - dy); set(2, c.x - dx, c.y + dy); set(3, c.x + dx, c.y + dy);
    } else if (index === 2) {
      set(0, c.x + dx, c.y + dy); set(1, c.x - dx, c.y + dy); set(3, c.x + dx, c.y - dy);
    } else if (index === 3) {
      set(0, c.x - dx, c.y + dy); set(1, c.x + dx, c.y + dy); set(2, c.x + dx, c.y - dy);
    }
    return v;
  }

  /** GeoSDoub.Intersect(a,b,c,d), with the applet's |det| < 1 NaN guard. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (c2 * b1 - c1 * b2) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  /** DoubCircle(0,0,1000) ∩ DoubLine(p,q), with the applet's root order. */
  function circleLine(p, q) {
    if (Math.abs(p.y - q.y) > 1) {
      const m = (p.x - q.x) / (p.y - q.y);
      const b0 = q.x - m * q.y;
      const a = m * m + 1;
      const bb = m * b0; // the circle is centred at (0,0)
      const c = b0 * b0 - 1000 * 1000;
      const disc = bb * bb - a * c;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const y1 = (-bb + s) / a, y2 = (-bb - s) / a;
      return [{ x: m * y1 + b0, y: y1 }, { x: m * y2 + b0, y: y2 }];
    }
    if (Math.abs(p.x - q.x) > 1) {
      const m = (p.y - q.y) / (p.x - q.x);
      const b0 = q.y - m * q.x;
      const a = m * m + 1;
      const bb = m * b0; // the circle is centred at (0,0)
      const c = b0 * b0 - 1000 * 1000;
      const disc = bb * bb - a * c;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const x1 = (-bb + s) / a, x2 = (-bb - s) / a;
      return [{ x: x1, y: m * x1 + b0 }, { x: x2, y: m * x2 + b0 }];
    }
    return null;
  }

  /** CTKEllipse.Intersect(a,b,c): a line's two crossings with the ellipse. */
  function ellipseIntersect(e, a, b, c) {
    const d = a * e.center.x + b * e.center.y + c;
    const sa = a * e.A, sb = b * e.B; // coefficients after the stretch
    const p = { x: 0, y: (-1000 * d) / sb };
    const q = { x: (-1000 * d) / sa, y: 0 };
    const hits = circleLine(p, q);
    if (!hits) return null;
    return hits.map((h) => ({
      x: (h.x * e.A) / 1000 + e.center.x,
      y: (h.y * e.B) / 1000 + e.center.y,
    }));
  }

  /** ButterflyInEllipseCanvas.GetLineCoefs(a,b): A*x + B*y + C = 0. */
  function lineCoefs(a, b) {
    const A = b.y - a.y;
    const B = -(b.x - a.x);
    /* The bytecode stores C = -a.x*A + a.y*(b.x-a.x) = -a.x*A - a.y*B. */
    return [A, B, -a.x * A - a.y * B];
  }

  /** ButterflyInEllipseCanvas.Other(hits,b): the crossing that is not b. */
  function other(hits, b, fallback) {
    if (!hits) return fallback;
    try {
      return dist(hits[0], b) < 1 ? hits[1] : hits[0];
    } catch (_) {
      return fallback;
    }
  }

  /**
   * ButterflyInEllipseCanvas.Intersect(a,b,c): the second crossing of the
   * ellipse by the line through a and b, or c when that line misses it.
   */
  function secant(e, a, b, fallback) {
    /* Reflect b in a, then a in that image: 3b - 2a, still on line ab. */
    const inner = { x: 2 * a.x - b.x, y: 2 * a.y - b.y };
    const far = { x: 2 * b.x - inner.x, y: 2 * b.y - inner.y };
    const coefs = lineCoefs(far, b);
    return other(ellipseIntersect(e, coefs[0], coefs[1], coefs[2]), b, fallback);
  }

  /** AdjustPointOnLine(i): side P[i]—P[i-1] meets the fixed line at L[i]. */
  function adjustPointOnLine(state, i) {
    const n = state.n;
    const j = (i + n - 1) % n;
    return intersect(state.P[i], state.P[j], state.line.p, state.line.q);
  }

  function adjustPointsOnLine(state) {
    return state.P.map((_, i) => adjustPointOnLine(state, i));
  }

  /**
   * AdjustPointOnEllipse(k): with L fixed, walk backwards around the polygon.
   * The last side is left alone — that is the one the butterfly theorem pins.
   */
  function adjustPointOnEllipse(state, k) {
    const e = ellipseFrom(state.V);
    const P = state.P.map(copy), L = state.L.map(copy);
    let prev = k;
    for (let s = state.n - 1; s > 0; s--) {
      const j = (k + s) % state.n;
      P[j] = secant(e, L[prev], P[prev], P[j]);
      prev = j;
    }
    return P;
  }

  /** AdjustLinks(L[k]): slide one crossing, rebuild P[k] and the next L. */
  function adjustLinks(state, k, target) {
    const e = ellipseFrom(state.V);
    const P = state.P.map(copy), L = state.L.map(copy);
    const j = (k + state.n - 1) % state.n;
    L[k] = copy(target);
    P[k] = secant(e, L[k], P[j], P[k]);
    const next = { ...state, P, L };
    L[(k + 1) % state.n] = adjustPointOnLine(next, (k + 1) % state.n);
    return { P, L };
  }

  /** The line the applet starts with: (0, floor(2h/7)) to (w, floor(7h/8)). */
  function defaultLine(view) {
    return {
      p: { x: 0, y: Math.floor((2 * view.height) / 7) },
      q: { x: view.width, y: Math.floor((7 * view.height) / 8) },
    };
  }

  /**
   * Reset(): rectangle corners width/3 and height/3 from the centre, then
   * vertices at i*pi/n plus a small jitter, alternating with a half turn.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? VIEW.width : o.width;
    const height = o.height === undefined ? VIEW.height : o.height;
    const view = { width, height };
    const n = Math.max(N_MIN, Math.min(N_MAX, o.n === undefined ? 4 : Math.round(o.n)));
    const seed = o.seed === undefined ? 1 : o.seed;
    if (o.V && o.P && o.line) {
      return {
        view, n, seed,
        V: o.V.map(copy), P: o.P.map(copy),
        L: o.L ? o.L.map(copy) : [],
        line: { p: copy(o.line.p), q: copy(o.line.q) },
        names: Boolean(o.names) && n === 4,
        explored: Boolean(o.explored),
      };
    }
    const cx = width / 2, cy = height / 2;
    const rx = width / 3, ry = height / 3;
    const V = [
      { x: cx - rx, y: cy + ry }, { x: cx + rx, y: cy + ry },
      { x: cx + rx, y: cy - ry }, { x: cx - rx, y: cy - ry },
    ];
    const e = ellipseFrom(V);
    const random = rng(seed);
    const P = [];
    for (let i = 0; i < n; i++) {
      const t = (Math.PI / n) * i + (random() - 0.5) * (Math.PI / 8) +
        (i % 2 === 0 ? Math.PI : 0);
      P.push(pointAt(e, t));
    }
    const line = defaultLine(view);
    const base = { view, n, seed, V, P, L: [], line,
      names: Boolean(o.names) && n === 4, explored: Boolean(o.explored) };
    return { ...base, L: adjustPointsOnLine(base) };
  }

  /** Keep a handle inside the drawing area. */
  function clamp(p, state) {
    const v = (state && state.view) || VIEW;
    return {
      x: Math.max(6, Math.min(v.width - 6, p.x)),
      y: Math.max(6, Math.min(v.height - 6, p.y)),
    };
  }

  /** The applet refuses rectangle drags within 10 px of a centre line. */
  function clampCorner(p, state) {
    const q = clamp(p, state);
    const c = ellipseFrom(state.V).center;
    const dx = q.x - c.x, dy = q.y - c.y;
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    return {
      x: c.x + sx * Math.max(11, Math.abs(dx)),
      y: c.y + sy * Math.max(11, Math.abs(dy)),
    };
  }

  /** Orthogonal projection of p onto the fixed line, clamped to its ends. */
  function onLine(p, line) {
    const dx = line.q.x - line.p.x, dy = line.q.y - line.p.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? ((p.x - line.p.x) * dx + (p.y - line.p.y) * dy) / len2 : 0;
    const u = Math.max(0, Math.min(1, t));
    return { x: line.p.x + dx * u, y: line.p.y + dy * u };
  }

  const distToLine = (p, a, b) => {
    const len = dist(a, b);
    if (len < EPS) return Infinity;
    return Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / len;
  };

  /**
   * Move a named handle. V0..V3 reshape the ellipse; P0..P19 or A..T slide on
   * it; F0..F19 (or L0..L19) slide along the fixed line; m1/m2 move its ends.
   */
  function move(state, name, point) {
    const p = clamp(point, state);
    if (/^V[0-3]$/.test(name)) {
      const index = Number(name.slice(1));
      const V = maintainRect(state.V, index, clampCorner(p, state));
      const e = ellipseFrom(V);
      const next = { ...state, V, P: state.P.map((q) => keepOnEllipse(e, q)) };
      return { ...next, L: adjustPointsOnLine(next) };
    }
    if (name === "m1" || name === "m2") {
      const line = { p: copy(state.line.p), q: copy(state.line.q) };
      line[name === "m1" ? "p" : "q"] = p;
      const next = { ...state, line };
      return { ...next, L: adjustPointsOnLine(next) };
    }
    let index = -1;
    if (/^P\d+$/.test(name) || /^L\d+$/.test(name) || /^F\d+$/.test(name)) {
      index = Number(name.slice(1));
    } else if (name.length === 1) {
      index = POINT_NAMES.indexOf(name);
    }
    if (index >= 0 && index < state.n) {
      if (/^[LF]\d+$/.test(name)) {
        const changed = adjustLinks(state, index, onLine(p, state.line));
        return { ...state, P: changed.P, L: changed.L };
      }
      const P = state.P.map(copy);
      P[index] = keepOnEllipse(ellipseFrom(state.V), p);
      /* Drag this vertex, then let its fixed crossings move the other ones. */
      return { ...state, P: adjustPointOnEllipse({ ...state, P }, index) };
    }
    return state;
  }

  /**
   * Measure the picture: every vertex on the ellipse, every F on the line,
   * and every side meeting the line exactly where its F says it does.
   */
  function claims(state) {
    const e = ellipseFrom(state.V);
    const scale = 4 * Math.max(1, Math.abs(e.center.x), Math.abs(e.center.y),
      Math.abs(e.A), Math.abs(e.B));
    const tol = 1e-4 * scale;
    const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
    /* A side can meet the line far outside the board, so measure its error
       against the size of the numbers involved, not just the board. */
    const onEllipse = state.P.every((p) => finite(p) && Math.abs(
      ((p.x - e.center.x) ** 2) / (e.A * e.A) +
      ((p.y - e.center.y) ** 2) / (e.B * e.B) - 1) < 1e-3);
    const collinear = state.L.every((p) => finite(p) && distToLine(p, state.line.p, state.line.q) < tol);
    const sides = [];
    for (let i = 0; i < state.n; i++) {
      const j = (i + state.n - 1) % state.n;
      const hit = intersect(state.P[i], state.P[j], state.line.p, state.line.q);
      const room = Math.max(tol, Math.hypot(hit.x, hit.y), Math.hypot(state.L[i].x, state.L[i].y)) * 1e-4;
      sides.push(finite(hit) && finite(state.L[i]) && dist(hit, state.L[i]) < room);
    }
    return { onEllipse, collinear, sides, holds: onEllipse && collinear && sides.every(Boolean), tol };
  }

  /** A short status line for the illustration; there is no win or loss. */
  function describe(state) {
    const c = claims(state);
    if (!c.collinear || c.sides.some((ok) => !ok)) {
      return "Move a dot until every side of the polygon meets the straight line at its own crossing point.";
    }
    if (state.explored) {
      return `The crossings stayed put: the butterfly theorem holds for this ${state.n === 4 ? "quadrilateral" : state.n + "-sided polygon"}.`;
    }
    return "Each side meets the straight line at a fixed dot. Drag a dot on the oval and see what happens to the last side.";
  }

  /** Plain board-unit data, ready for Track and the tutor. */
  function position(state) {
    return {
      view: { ...state.view }, n: state.n, seed: state.seed,
      V: state.V.map(copy), P: state.P.map(copy), L: state.L.map(copy),
      line: { p: copy(state.line.p), q: copy(state.line.q) },
      names: state.names, explored: state.explored,
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, VIEW, N_MIN, N_MAX, POINT_NAMES, L_NAMES,
    copy, dist, sqDist, rng, ellipseFrom, pointAt, orientation, signedAngle,
    keepOnEllipse, maintainRect, intersect, circleLine, ellipseIntersect,
    lineCoefs, other, secant, adjustPointOnLine, adjustPointsOnLine,
    adjustPointOnEllipse, adjustLinks, defaultLine, start, clamp, clampCorner,
    onLine, distToLine, move, claims, describe, position, result,
  };
})();
