"use strict";

/*
 * CircleOfSimilitude — Alexander Bogomolny's "Circle of Similitude" applet.
 *
 * Two circles outside one another have an inner centre P (where the common
 * internal tangents meet) and an outer centre Q (where the common external
 * tangents meet). The circle on PQ as diameter is the Circle of Similitude.
 * For every point T on it, d1/d2 = R1/R2 and d_i² = t_i² + R_i², so the two
 * tangent lengths t1, t2 are in the ratio of the radii too, and the circles
 * are seen from T under the same angle.
 *
 * The applet finds P and Q from its tangent construction, then puts the
 * circle's centre at the average of the x coordinates of P and Q with the y
 * of the first centre. That is right only when the two centres are level;
 * this core uses the true midpoint of PQ so the theorem holds however the
 * circles are dragged. Its P and Q, and its circle when the centres are
 * level, are checked against a second transcription of the bytecode.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, CircleOfSimilitudeCore, so the page loads it
 * with a plain <script> and porting/check-circle-of-similitude.mjs loads it in
 * Node. Positions are plain objects in the SVG's viewBox units.
 */

const CircleOfSimilitudeCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 14;
  const THETA = Math.PI / 3;          // the applet's starting point T
  const EPS = 1e-9;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* The two centres of similarity, from the bytecode's tangent intersections.
   * P divides C1C2 internally in the ratio R1:R2; Q divides it externally. */
  function centres(g) {
    const internal = point(
      (g.r1 * g.C2.x + g.r2 * g.C1.x) / (g.r1 + g.r2),
      (g.r1 * g.C2.y + g.r2 * g.C1.y) / (g.r1 + g.r2),
    );
    const external = Math.abs(g.r1 - g.r2) < EPS ? null : point(
      (g.r1 * g.C2.x - g.r2 * g.C1.x) / (g.r1 - g.r2),
      (g.r1 * g.C2.y - g.r2 * g.C1.y) / (g.r1 - g.r2),
    );
    return { P: internal, Q: external };
  }

  /* Tangent points from an outside point X to a circle, used to draw the
   * common tangents through P and Q. The two rays from T to a circle use the
   * same helper, with X = T. */
  function tangentsFrom(X, c, r) {
    const v = sub(X, c);
    const d = Math.hypot(v.x, v.y);
    if (!(d > r + EPS)) return null;
    const base = add(c, mul(v, (r * r) / (d * d)));
    const off = point(-v.y / d, v.x / d);
    const k = (r * Math.sqrt(d * d - r * r)) / d;
    return [add(base, mul(off, k)), sub(base, mul(off, k))];
  }

  /** Everything the drawing needs, recomputed from the four circle handles. */
  function compute(state) {
    const C1 = state ? state.C1 : null;
    const C2 = state ? state.C2 : null;
    if (!C1 || !C2 || !state.R1 || !state.R2) return null;
    const r1 = dist(C1, state.R1);
    const r2 = dist(C2, state.R2);
    const sep = dist(C1, C2);
    if (!(r1 > EPS) || !(r2 > EPS) || !(sep > EPS)) {
      return { C1, C2, r1, r2, sep, valid: false,
        reason: "Give each circle a radius and keep their centres apart." };
    }
    // The page assumes the circles lie outside one another: internal tangents
    // exist only then. The applet also stops drawing CS without them.
    if (sep <= r1 + r2 + EPS) {
      return { C1, C2, r1, r2, sep, valid: false,
        reason: "Move the circles apart until the crossing tangents appear." };
    }
    const { P, Q } = centres({ C1, C2, r1, r2 });
    if (!Q) {
      // Equal radii: Q is at infinity and the locus is the perpendicular
      // bisector of C1C2, the same limit as the Apollonian circle at ratio 1.
      const m = midpoint(C1, C2);
      const d = sub(C2, C1);
      return { C1, C2, r1, r2, sep, P, Q: null, valid: true, line: { m, n: d },
        cs: null, reason: "Equal radii: the circle has become a straight line." };
    }
    const cs = { c: midpoint(P, Q), r: dist(P, Q) / 2 };
    return { C1, C2, r1, r2, sep, P, Q, valid: true, cs, line: null, reason: "" };
  }

  /** Common tangent lines, given two points on each line for the SVG. */
  function commonTangents(g) {
    if (!g || !g.valid) return { external: [], internal: [] };
    const external = [];
    const internal = [];
    if (g.Q) {
      const ps = tangentsFrom(g.Q, g.C1, g.r1);
      if (ps) for (const p of ps) {
        external.push([p, add(g.Q, mul(sub(p, g.Q), g.r2 / g.r1))]);
      }
    }
    const ps = tangentsFrom(g.P, g.C1, g.r1);
    if (ps) for (const p of ps) {
      internal.push([p, add(g.P, mul(sub(p, g.P), -g.r2 / g.r1))]);
    }
    return { external, internal };
  }

  /* Keep T on the circle (or, for equal radii, on the perpendicular
   * bisector), as the applet's RestrictToCircle / UpdateBPoints do. */
  function project(g, p) {
    if (!g || !g.valid) return p;
    if (g.cs) {
      const from = dist(p, g.cs.c);
      if (!(from > EPS)) return point(g.cs.c.x + g.cs.r, g.cs.c.y);
      return add(g.cs.c, mul(sub(p, g.cs.c), g.cs.r / from));
    }
    const n = g.line.n;
    const nn = n.x * n.x + n.y * n.y;
    const t = ((p.x - g.line.m.x) * n.x + (p.y - g.line.m.y) * n.y) / nn;
    return sub(p, mul(n, t));
  }

  function restrict(state, p) {
    return project(compute(state), clamp(p));
  }

  /** The applet's starting picture, in a 400x300 viewBox. */
  function start(options) {
    const o = options || {};
    const cx = VIEW.width / 2, cy = VIEW.height / 2, g = VIEW.width / 4;
    const C1 = point(cx - g, cy);
    const R1 = point(C1.x - VIEW.width / 7, C1.y);
    const C2 = point(cx + g, cy);
    const R2 = point(C2.x + VIEW.width / 20, C2.y);
    const state = {
      C1, R1, C2, R2, T: point(0, 0),
      options: {
        names: o.names === undefined ? true : !!o.names,
        hint: !!o.hint,
      },
      explored: false,
    };
    const g0 = compute(state);
    const T = g0.cs
      ? point(g0.cs.c.x - g0.cs.r * Math.cos(THETA), g0.cs.c.y - g0.cs.r * Math.sin(THETA))
      : point(state.C2.x, state.C1.y - 40);
    state.T = project(g0, T);
    return state;
  }

  function reset(state) {
    const s = start(state ? state.options : {});
    s.explored = state ? state.explored : false;
    return s;
  }

  const NAMES = ["C1", "R1", "C2", "R2", "T"];

  function move(state, name, p) {
    if (!NAMES.includes(name) || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    const next = Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
    next.T = project(compute(next), name === "T" ? next.T : state.T);
    return next;
  }

  function setOption(state, name, value) {
    if (name !== "names" && name !== "hint") return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { [name]: !!value }),
      explored: true,
    });
  }

  function geometry(state) {
    const g = compute(state);
    if (!g || !g.valid) return g;
    const c1 = dist(state.T, g.C1), c2 = dist(state.T, g.C2);
    const t1 = c1 > g.r1 ? Math.sqrt(c1 * c1 - g.r1 * g.r1) : 0;
    const t2 = c2 > g.r2 ? Math.sqrt(c2 * c2 - g.r2 * g.r2) : 0;
    const angle1 = c1 > g.r1 ? 2 * Math.asin(g.r1 / c1) : Math.PI;
    const angle2 = c2 > g.r2 ? 2 * Math.asin(g.r2 / c2) : Math.PI;
    return Object.assign({}, g, {
      T: state.T,
      d1: c1, d2: c2, t1, t2,
      ratio: g.r1 / g.r2,
      measured: c2 > EPS ? c1 / c2 : 0,
      tangentRatio: t2 > EPS ? t1 / t2 : 0,
      angle1, angle2,
      fromT1: tangentsFrom(state.T, g.C1, g.r1),
      fromT2: tangentsFrom(state.T, g.C2, g.r2),
      tangents: commonTangents(g),
    });
  }

  /* A picture, not a game: there is no win and no loss. */
  function result() {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g || !g.valid) return g && g.reason ? g.reason : "Drag the circles apart to see the construction.";
    const deg = (g.angle1 * 180 / Math.PI).toFixed(1);
    if (!g.Q) {
      return `R1 = R2: CS is the line midway between the centres. At T, d1/d2 = ${g.measured.toFixed(3)}, t1/t2 = ${g.tangentRatio.toFixed(3)}, and both angles are ${deg}°.`;
    }
    return `At T: d1/d2 = ${g.measured.toFixed(3)}, R1/R2 = ${g.ratio.toFixed(3)}, t1/t2 = ${g.tangentRatio.toFixed(3)}; both circles are seen at ${deg}°.`;
  }

  return {
    VIEW: VIEW, PAD: PAD, EPS: EPS, THETA: THETA,
    point: point, add: add, sub: sub, mul: mul, dist: dist, midpoint: midpoint,
    clamp: clamp, centres: centres, tangentsFrom: tangentsFrom,
    start: start, reset: reset, move: move, setOption: setOption,
    compute: compute, commonTangents: commonTangents, project: project,
    restrict: restrict, geometry: geometry, result: result, describe: describe,
  };
})();
