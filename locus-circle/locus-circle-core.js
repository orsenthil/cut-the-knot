"use strict";

/*
 * LocusCircle — Alexander Bogomolny's "Locus of Points in a Given Ratio to
 * Two Points" applet, transcribed from classes/LocusCircle.zip.
 *
 * The applet divides AB internally at M and externally at N so that
 * AM/BM = AN/BN = NB/NC.  The circle with MN as a diameter is the locus of
 * points P with AP/BP = NB/NC; P is always projected back onto that circle.
 * When NB = NC the true locus is the perpendicular bisector of AB.  The old
 * applet put N at x = 1000000 instead, which only stands in for that line
 * when AB is horizontal; this port follows the article and draws the exact
 * line (the logic test measures the difference).
 *
 * No document, no window, no storage: one global, LocusCircleCore.  Positions
 * are plain objects in the SVG viewBox units, safe to save for the tutor.
 */
const LocusCircleCore = (() => {
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 16;
  const N_MIN = 1;
  const N_MAX = 15;
  const NB_DEFAULT = 4;          // the panel's initial text fields
  const NC_DEFAULT = 3;
  const SENTINEL_X = 1000000;    // CutE when NB == NC
  const HALF_PI_3 = Math.PI / 3; // the applet's fixed starting angle
  const EPS = 1e-9;

  const point = (x, y) => ({ x, y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const lerp = (p, q, t) => point(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /** The spinner and its text field both allow whole numbers from 1 to 15. */
  function clampCount(v, fallback) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(N_MIN, Math.min(N_MAX, n));
  }

  /** The canvas init() construction on the applet's reference 400x300 size. */
  function start(options) {
    const o = options || {};
    const s2 = VIEW.width / 3;
    const s4 = VIEW.height * 3 / 5;
    const s6 = VIEW.width / 4;
    const s8 = 50;
    const A = point(s2 - s6, s4 + s8);
    const B = point(s2 - s6 / 5, s4 + s8);
    const P0 = point(
      s2 + s2 * Math.cos(HALF_PI_3) / 4 - s6 / 2 - s8 / 4,
      s4 - s2 * Math.sin(HALF_PI_3) / 4 - s8 / 4,
    );
    const state = {
      A: A, B: B, P: P0,
      options: {
        nb: clampCount(o.nb === undefined ? NB_DEFAULT : o.nb, NB_DEFAULT),
        nc: clampCount(o.nc === undefined ? NC_DEFAULT : o.nc, NC_DEFAULT),
        names: o.names === undefined ? false : !!o.names,
        hint: o.hint === undefined ? false : !!o.hint,
        extra: o.extra === undefined ? false : !!o.extra,
      },
      explored: false,
    };
    return Object.assign({}, state, { P: project(compute(state.A, state.B, state.options.nb, state.options.nc), P0) });
  }

  /** Reset restores the original drawing, keeping the chosen options. */
  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  /* CutI(A, B, NB, NC): the internal division point M. */
  function cutI(a, b, nb, nc) {
    const den = nb + nc;
    return point((nc * a.x + nb * b.x) / den, (nc * a.y + nb * b.y) / den);
  }

  /* CutE(A, B, NB, NC): the external division point N, with the applet's
   * far-away sentinel when the denominator is zero. */
  function cutE(a, b, nb, nc) {
    const den = nb - nc;
    if (den === 0) return point(SENTINEL_X, a.y);
    return point((nb * b.x - nc * a.x) / den, (nb * b.y - nc * a.y) / den);
  }

  function circleFromDiameter(d, e) {
    return { c: midpoint(d, e), r: dist(d, e) / 2 };
  }

  /** The literal applet circle, including its r = 1 sentinel; used by tests. */
  function appletCircle(a, b, nb, nc) {
    return circleFromDiameter(cutI(a, b, nb, nc), cutE(a, b, nb, nc));
  }

  /** The locus from the current A, B and the two spinner values. */
  function compute(a, b, nb, nc) {
    if (!(dist(a, b) > EPS)) return null;
    const D = cutI(a, b, nb, nc);
    const atOne = nb === nc;
    const E = atOne ? null : cutE(a, b, nb, nc);
    return {
      A: a, B: b, nb: nb, nc: nc, r: nb / nc, d: dist(a, b),
      M: D, N: E,
      circle: atOne ? null : circleFromDiameter(D, E),
      line: atOne ? { m: midpoint(a, b), n: sub(b, a) } : null,
    };
  }

  /** Move P onto the circle radially, or onto the bisector orthogonally. */
  function project(g, p) {
    if (!g) return p;
    if (g.circle) {
      const c = g.circle.c;
      const from = dist(p, c);
      if (!(from > EPS)) return point(c.x + g.circle.r, c.y);
      return point(c.x + (p.x - c.x) * g.circle.r / from,
                   c.y + (p.y - c.y) * g.circle.r / from);
    }
    const n = g.line.n;
    const nn = dist(n, point(0, 0));
    const t = ((p.x - g.line.m.x) * n.x + (p.y - g.line.m.y) * n.y) / (nn * nn);
    return sub(p, mul(n, t));
  }

  function restrict(state, p) {
    return project(compute(state.A, state.B, state.options.nb, state.options.nc), clamp(p));
  }

  /** Drag A, B or P; A and B redraw the whole locus, P only slides along it. */
  function move(state, name, p) {
    if (name !== "A" && name !== "B" && name !== "P") return state;
    const q = clamp(point(p.x, p.y));
    const next = Object.assign({}, state, { [name]: q, explored: true });
    next.P = name === "P" ? restrict(state, q) : restrict(next, state.P);
    return next;
  }

  /** Change a spinner or a checkbox. Changing a count replays Reset. */
  function setOption(state, name, value) {
    if (!(name in state.options)) return state;
    const o = Object.assign({}, state.options);
    if (name === "nb" || name === "nc") {
      const fallback = name === "nb" ? NB_DEFAULT : NC_DEFAULT;
      o[name] = clampCount(value, fallback);
    } else {
      o[name] = !!value;
    }
    const next = Object.assign({}, state, { options: o, explored: true });
    if (name === "nb" || name === "nc") next.P = restrict(next, state.P);
    return next;
  }

  /** Everything the drawing needs, recomputed from the three handles. */
  function geometry(state) {
    return compute(state.A, state.B, state.options.nb, state.options.nc);
  }

  /**
   * The pink parallels of the applet's Hint and Extra drawing.  They cut AM
   * into NB equal parts, MB into NC equal parts, and (when hinted) the line
   * from the nearer end of AB to N into NB parts.  Each pair of endpoints is
   * one segment of a parallel through the matching point on AP or PB.
   */
  function hintSegments(state) {
    const g = geometry(state);
    if (!g) return [];
    const out = [];
    for (let i = 1; i < state.options.nb; i++) {
      const t = i / state.options.nb;
      out.push({ from: lerp(g.A, state.P, t), to: lerp(g.A, g.M, t), kind: "inner" });
    }
    for (let i = 1; i < state.options.nc; i++) {
      const t = i / state.options.nc;
      out.push({ from: lerp(state.P, g.B, t), to: lerp(g.M, g.B, t), kind: "inner" });
    }
    if (state.options.hint && g.N) {
      for (let i = 1; i < state.options.nb; i++) {
        const t = i / state.options.nb;
        if (state.options.nb > state.options.nc) {
          out.push({ from: lerp(state.P, g.A, t), to: lerp(g.A, g.N, 1 - t), kind: "outer" });
        } else {
          out.push({ from: lerp(state.P, g.B, t), to: lerp(g.B, g.N, 1 - t), kind: "outer" });
        }
      }
    }
    return out;
  }

  /** Independent closed form used by the logic test: centre and radius. */
  function locus(a, b, r) {
    if (!(r > 0) || !(dist(a, b) > EPS)) return null;
    if (Math.abs(r - 1) < EPS) return { line: { m: midpoint(a, b), n: sub(b, a) } };
    const k = r * r / (r * r - 1);
    return { c: add(a, mul(sub(b, a), k)), r: Math.abs(r / (r * r - 1)) * dist(a, b) };
  }

  /* A picture, not a game: no win, no loss, no final move. */
  function result() {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Drag A and B apart to see the locus.";
    const measured = dist(state.P, state.A) / Math.max(dist(state.P, state.B), EPS);
    const rText = `${state.options.nb}/${state.options.nc}`;
    if (g.line) {
      return `NB/NC = ${rText}: P lies on the perpendicular bisector of AB; AP/BP at P = ${measured.toFixed(3)}.`;
    }
    return `NB/NC = ${rText}: AP/BP at P = ${measured.toFixed(3)}; circle centre (${g.circle.c.x.toFixed(0)}, ${g.circle.c.y.toFixed(0)}), radius ${g.circle.r.toFixed(0)}.`;
  }

  return {
    VIEW: VIEW, PAD: PAD, N_MIN: N_MIN, N_MAX: N_MAX,
    NB_DEFAULT: NB_DEFAULT, NC_DEFAULT: NC_DEFAULT, SENTINEL_X: SENTINEL_X, EPS: EPS,
    point: point, add: add, sub: sub, mul: mul, dist: dist, midpoint: midpoint, lerp: lerp,
    clamp: clamp, clampCount: clampCount,
    start: start, reset: reset, move: move, setOption: setOption,
    cutI: cutI, cutE: cutE, circleFromDiameter: circleFromDiameter,
    appletCircle: appletCircle, compute: compute, project: project, restrict: restrict,
    geometry: geometry, hintSegments: hintSegments, locus: locus,
    result: result, describe: describe,
  };
})();
