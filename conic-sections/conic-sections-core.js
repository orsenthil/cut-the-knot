"use strict";

/*
 * Conic Sections — Bogomolny's "Cut the Cone" applet, in two dimensions.
 *
 * The Java applet built two finite cones with com.sun.j3d.utils.geometry.Cone(6,
 * 12, 37, material), rotated them by + and - pi/2 about z and translated them
 * by + and - 6 along x. That puts both apexes at the origin: an unbounded
 * double cone with generators at distance height/radius along its axis. A
 * square CTKPlane(20) started at the origin and was rotated and translated by
 * the mouse. There was no code that named the curve: the page states the rule.
 *
 * The core works in the cross-section through the cone's axis and the plane's
 * normal. With the cone's axis along x, its equation is y^2 + z^2 = m^2 x^2,
 * m = radius / height = cot(alpha), where alpha is the generator/base angle.
 * The cutting plane is x - y tan(beta) = d. In plane coordinates (u, v) with
 * u along (sin beta, cos beta, 0) and v along z this becomes
 *
 *     A u^2 + B u + C + v^2 = 0,
 *     A = cos^2(beta) - m^2 sin^2(beta),
 *     B = -2 p sin(beta) cos(beta) (1 + m^2),   p = d cos(beta),
 *     C = p^2 (sin^2(beta) - m^2 cos^2(beta)).
 *
 * Since B^2/4 - A C = p^2 m^2, the sign of A alone decides the family:
 * beta < alpha gives an ellipse (a circle at beta = 0), beta = alpha a
 * parabola and beta > alpha a hyperbola. At p = 0 they degenerate to a point,
 * a line and a pair of lines. This is exactly the claim on the applet's page.
 *
 * This file is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global, ConicSectionsCore. Positions are plain data
 * and every function returns a new position. The picture is an illustration:
 * there is no win and no loss.
 */
const ConicSectionsCore = (() => {
  const PI = Math.PI;
  /* Bytecode: fstore 9 = 6.0f; Cone(6.0f, 2 * 6.0f, 37, appearance). */
  const CONE_RADIUS = 6;
  const CONE_HEIGHT = 12;
  const CONE_FLAGS = 37;
  const PLANE_SIZE = 20;
  const SLOPE = CONE_RADIUS / CONE_HEIGHT; // m = cot(alpha)
  const ALPHA = (Math.atan2(CONE_HEIGHT, CONE_RADIUS) * 180) / PI;
  const MIN_BETA = 0; // beta is acute and may be zero (page)
  const MAX_BETA = 80;
  const MIN_OFFSET = -12;
  const MAX_OFFSET = 12;
  const DEFAULT_BETA = 25;
  const DEFAULT_OFFSET = 7;
  const EPS = 1e-9;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const radians = (deg) => (deg * PI) / 180;
  const degrees = (rad) => (rad * 180) / PI;

  /** The position a new picture starts from. Options may override the two numbers. */
  function start(options) {
    const o = options || {};
    const num = (v, fallback, lo, hi) =>
      Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
    return {
      beta: num(o.beta, DEFAULT_BETA, MIN_BETA, MAX_BETA),
      offset: num(o.offset, DEFAULT_OFFSET, MIN_OFFSET, MAX_OFFSET),
      transparent: o.transparent === undefined ? true : !!o.transparent,
      linked: o.linked === undefined ? false : !!o.linked,
    };
  }

  function setBeta(state, value) {
    if (!Number.isFinite(value)) return state;
    return Object.assign({}, state, {
      beta: clamp(value, MIN_BETA, MAX_BETA),
    });
  }

  function setOffset(state, value) {
    if (!Number.isFinite(value)) return state;
    return Object.assign({}, state, {
      offset: clamp(value, MIN_OFFSET, MAX_OFFSET),
    });
  }

  function toggleTransparent(state) {
    return Object.assign({}, state, { transparent: !state.transparent });
  }

  function toggleLinked(state) {
    return Object.assign({}, state, { linked: !state.linked });
  }

  /** The five pictures the page talks about, plus the three vertex cases. */
  function preset(state, name) {
    if (name === "circle") return setOffset(setBeta(state, 0), DEFAULT_OFFSET);
    if (name === "ellipse") return setOffset(setBeta(state, 30), DEFAULT_OFFSET);
    if (name === "parabola") return setOffset(setBeta(state, ALPHA), DEFAULT_OFFSET);
    if (name === "hyperbola") return setOffset(setBeta(state, 75), DEFAULT_OFFSET);
    if (name === "vertex") return setOffset(state, 0);
    return state;
  }

  /** beta against alpha: -1 below (ellipse), 0 equal (parabola), +1 above. */
  function relation(beta) {
    if (Math.abs(beta - ALPHA) < 1e-10) return 0;
    return beta < ALPHA ? -1 : 1;
  }

  function analyse(state) {
    const beta = state.beta;
    const d = state.offset;
    const b = radians(beta);
    const sb = Math.sin(b), cb = Math.cos(b);
    const p = d * cb; // signed distance from the vertex to the plane
    const A = cb * cb - SLOPE * SLOPE * sb * sb;
    const B = -2 * p * sb * cb * (1 + SLOPE * SLOPE);
    const C = p * p * (sb * sb - SLOPE * SLOPE * cb * cb);
    const disc = p * p * SLOPE * SLOPE; // B^2/4 - A C
    const rel = relation(beta);
    const family = rel < 0 ? "ellipse" : rel === 0 ? "parabola" : "hyperbola";
    const degenerate = Math.abs(p) < EPS;
    const detail = degenerate
      ? (family === "ellipse" ? "point" : family === "parabola" ? "line" : "lines")
      : (family === "ellipse" && beta === 0 ? "circle" : null);
    const centerU = Math.abs(A) < EPS ? 0 : -B / (2 * A);
    const scaleU = Math.abs(A) < EPS || disc <= 0 ? 0 : Math.sqrt(disc) / Math.abs(A);
    const scaleV = Math.abs(A) < EPS || disc <= 0 ? 0 : Math.sqrt(disc) / Math.sqrt(Math.abs(A));
    return {
      beta: beta, offset: d, alpha: ALPHA, relation: rel,
      family: family, detail: detail, degenerate: degenerate,
      p: p, A: A, B: B, C: C, disc: disc,
      centerU: centerU, scaleU: scaleU, scaleV: scaleV,
    };
  }

  /**
   * Polylines in plane coordinates (u, v). One for an ellipse or a parabola,
   * two for a hyperbola, one or two straight lines at the vertex.
   */
  function sectionPoints(a, resolution) {
    const n = resolution || 64;
    if (a.degenerate) {
      if (a.detail === "point") return [[{ u: 0, v: 0 }]];
      if (a.detail === "line") {
        return [[{ u: -6, v: 0 }, { u: 6, v: 0 }]];
      }
      const slope = Math.sqrt(Math.abs(a.A)); // v = +/- sqrt(|A|) u
      return [[{ u: -6, v: slope * 6 }, { u: 6, v: slope * -6 }],
        [{ u: -6, v: slope * -6 }, { u: 6, v: slope * 6 }]];
    }
    if (a.family === "ellipse") {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = (2 * PI * i) / n;
        pts.push({ u: a.centerU + a.scaleU * Math.cos(t), v: a.scaleV * Math.sin(t) });
      }
      return [pts];
    }
    if (a.family === "parabola") {
      // - (C + v^2) / B = 0; B is never zero when p != 0 and beta = alpha.
      const vertexU = -a.C / a.B;
      const vMax = Math.sqrt(Math.abs(a.B) * (Math.abs(vertexU) + 3));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const v = -vMax + (2 * vMax * i) / n;
        pts.push({ u: -(a.C + v * v) / a.B, v: v });
      }
      return [pts];
    }
    const branches = [];
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = -1.6 + (3.2 * i) / n;
        pts.push({ u: a.centerU + side * a.scaleU * Math.cosh(t), v: a.scaleV * Math.sinh(t) });
      }
      branches.push(pts);
    }
    return branches;
  }

  /**
   * The plane x - y tan(beta) = d clipped to a rectangle of the side view.
   * Returns two (x, y) points in cone units, or null when it misses the box.
   */
  function planeSegment(state, bounds) {
    const box = bounds || { xMin: -14, xMax: 14, yMin: -8, yMax: 8 };
    const s = Math.tan(radians(state.beta));
    if (Math.abs(s) < EPS) {
      if (state.offset < box.xMin || state.offset > box.xMax) return null;
      return [{ x: state.offset, y: box.yMin }, { x: state.offset, y: box.yMax }];
    }
    const yAtX = (x) => (x - state.offset) / s;
    const lo = Math.max(box.yMin, Math.min(yAtX(box.xMin), yAtX(box.xMax)));
    const hi = Math.min(box.yMax, Math.max(yAtX(box.xMin), yAtX(box.xMax)));
    if (lo > hi) return null;
    return [{ x: state.offset + s * lo, y: lo }, { x: state.offset + s * hi, y: hi }];
  }

  /** Where a plane point (u, v) sits in the cone's own 3-D coordinates. */
  function toSpace(state, uv) {
    const b = radians(state.beta);
    const sb = Math.sin(b), cb = Math.cos(b);
    const p = state.offset * cb; // foot of the perpendicular from the vertex
    const x = p * cb + uv.u * sb;
    const y = -p * sb + uv.u * cb;
    return { x: x, y: y, z: uv.v };
  }

  /** A short status line; the algebra stays in the maths section. */
  function describe(state) {
    const a = analyse(state);
    const beta = a.beta.toFixed(1);
    const alpha = a.alpha.toFixed(1);
    const cmp = a.relation < 0 ? "less than" : a.relation === 0 ? "equal to" : "greater than";
    if (a.detail === "point") {
      return { title: "Point", text: `The plane passes through the vertex: the section is a point.` };
    }
    if (a.detail === "line") {
      return { title: "Line", text: `The plane passes through the vertex and is parallel to a generator: the section is one line.` };
    }
    if (a.detail === "lines") {
      return { title: "Pair of lines", text: `The plane passes through the vertex: the section is a pair of lines.` };
    }
    if (a.detail === "circle") {
      return { title: "Circle", text: `Circle: the plane's tilt (0\u00b0) is zero, so it is parallel to the cone's base.` };
    }
    const names = { ellipse: "Ellipse", parabola: "Parabola", hyperbola: "Hyperbola" };
    const extra = a.family === "ellipse" ? " It cuts just one half of the cone."
      : a.family === "parabola" ? " It runs parallel to a generator."
        : " It cuts both halves of the cone.";
    return {
      title: names[a.family],
      text: `${names[a.family]}: the plane's tilt (${beta}\u00b0) is ${cmp} the generator's tilt (${alpha}\u00b0).${extra}`,
    };
  }

  return {
    PI: PI, CONE_RADIUS: CONE_RADIUS, CONE_HEIGHT: CONE_HEIGHT,
    CONE_FLAGS: CONE_FLAGS, PLANE_SIZE: PLANE_SIZE, SLOPE: SLOPE, ALPHA: ALPHA,
    MIN_BETA: MIN_BETA, MAX_BETA: MAX_BETA,
    MIN_OFFSET: MIN_OFFSET, MAX_OFFSET: MAX_OFFSET,
    DEFAULT_BETA: DEFAULT_BETA, DEFAULT_OFFSET: DEFAULT_OFFSET,
    clamp: clamp, radians: radians, degrees: degrees,
    start: start, setBeta: setBeta, setOffset: setOffset,
    toggleTransparent: toggleTransparent, toggleLinked: toggleLinked,
    preset: preset, relation: relation, analyse: analyse,
    sectionPoints: sectionPoints, planeSegment: planeSegment,
    toSpace: toSpace, describe: describe,
  };
})();
