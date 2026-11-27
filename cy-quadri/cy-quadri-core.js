"use strict";

/*
 * CyQuadri — Alexander Bogomolny's "Angle Bisectors in a Quadrilateral"
 * applet.  Drag the four corners of any quadrilateral.  Where neighbouring
 * angle bisectors meet, four new points appear; the old page claims those
 * four points always lie on one circle, and that the same is true when the
 * external bisectors are used instead.  Opposite angles of that new
 * quadrilateral then add to 180 degrees.
 *
 * The arithmetic here follows the applet's own classes: CyQuadriCanvas's
 * FindAngleBisector and Perp, and GeoSDoub's ComputeAngle, FindOrientation,
 * Rotate, Intersect and FindCircumcenter (including its |det| < 1 test and
 * its mean-of-three-distances radius).  This file is only geometry: no
 * document, no window.  It defines one global, CyQuadriCore, so the page
 * loads it with a plain <script> and the logic test loads it in Node.
 */
const CyQuadriCore = (() => {
  // The applet's documented WIDTH/HEIGHT defaults: "(400 will do)" and
  // "(300 will do)".  Reset() places its four points from these dimensions.
  const VIEW = { x: 0, y: 0, width: 400, height: 300 };
  const PAD = 16;                 // room for a handle and its name on screen
  const STEP = 40;               // Reset's local variable L4
  const DOWN = 60;               // Reset's local variable L5

  const point = (x, y) => ({ x, y });
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const midpoint = (p, q) => point((p.x + q.x) / 2, (p.y + q.y) / 2);
  const valid = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.ComputeAngle — the raw acos, deliberately without clamping. */
  function computeAngle(p, q, r) {
    const cos = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r))
      / (2 * dist(p, q) * dist(p, r));
    return Math.acos(cos);
  }

  /** GeoSDoub.FindOrientation: +1 when its cross expression is > 0, else -1. */
  function orientation(p, q, r) {
    const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(q about p by a, with the applet's orientation sign). */
  function rotate(p, q, a, sign) {
    const c = Math.cos(a), s = Math.sin(a);
    return point(
      p.x + c * (q.x - p.x) - sign * s * (q.y - p.y),
      p.y + sign * s * (q.x - p.x) + c * (q.y - p.y),
    );
  }

  /** CyQuadriCanvas.FindAngleBisector(p,q,r): rotate q about p by half the angle. */
  function angleBisector(p, q, r) {
    return rotate(p, q, computeAngle(p, q, r) / 2, orientation(p, q, r));
  }

  /** CyQuadriCanvas.Perp(p,q): the ray at right angles to p→q. */
  function perp(p, q) {
    return point(p.x + q.y - p.y, p.y - q.x + p.x);
  }

  /** GeoSDoub.Intersect of the two lines p-q and r-s.  Its |det|<1 case is
   *  represented by null rather than NaN so callers can hide a bad drawing. */
  function intersect(p, q, r, s) {
    if (![p, q, r, s].every(valid)) return null;
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    const x = (b1 * c2 - b2 * c1) / det;
    const y = (c1 * a2 - c2 * a1) / det;
    return valid(point(x, y)) ? point(x, y) : null;
  }

  /** GeoSDoub.FindCircumcenter, with the canvas's mean-of-three radius. */
  function circle(a, b, c) {
    const ab = midpoint(a, b), bc = midpoint(b, c);
    const o = intersect(
      ab, point(ab.x + b.y - a.y, ab.y - b.x + a.x),
      bc, point(bc.x + c.y - b.y, bc.y - c.x + b.x),
    );
    if (!o) return null;
    const r = (dist(o, a) + dist(o, b) + dist(o, c)) / 3;
    return r > 1e-9 ? { c: o, r } : null;
  }

  /** Keep a corner on the board, leaving room for its handle and label. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* Reset() on a 400x300 canvas: A=(W/2-2*40, H/3+60), B=(W/2+2*40,
   * H/3+2*40+60), C=(W/2+3*40, H/3-2*40+60) and D=(midpoint of A and C
   * shifted by (-40,-40)).  Internal is checked, External and Show angles
   * are not. */
  function start(options) {
    const o = options || {};
    const A = point(VIEW.width / 2 - 2 * STEP, VIEW.height / 3 + DOWN);
    const B = point(VIEW.width / 2 + 2 * STEP, VIEW.height / 3 + 2 * STEP + DOWN);
    const C = point(VIEW.width / 2 + 3 * STEP, VIEW.height / 3 - 2 * STEP + DOWN);
    const D = point((A.x + C.x) / 2 - 40, (A.y + C.y) / 2 - STEP);
    return {
      A, B, C, D,
      options: {
        internal: o.internal === undefined ? true : !!o.internal,
        angles: o.angles === undefined ? false : !!o.angles,
      },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function move(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name) || !p) return state;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  /* The applet's radio pair: "External bisectors" simply switches Internal
   * off in itemStateChanged.  Show angles is an independent checkbox. */
  function setOption(state, name, value) {
    if (name === "internal" || name === "external") {
      const internal = name === "external" ? !value : !!value;
      return Object.assign({}, state, {
        options: Object.assign({}, state.options, { internal }), explored: true,
      });
    }
    if (name !== "angles") return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { angles: !!value }), explored: true,
    });
  }

  /** Interior angle at q in the triangle p-q-r, in degrees, for reporting. */
  function angle(p, q, r) {
    if (![p, q, r].every(valid)) return NaN;
    const n = dist(q, p) * dist(q, r);
    if (!n) return NaN;
    const cos = Math.max(-1, Math.min(1, dot(sub(p, q), sub(r, q)) / n));
    return Math.acos(cos) * 180 / Math.PI;
  }

  function convexQuad(points) {
    const s = points.map((p, i) => cross(
      sub(points[(i + 1) % 4], p),
      sub(points[(i + 2) % 4], points[(i + 1) % 4]),
    ));
    return (s.every((v) => v > 0) || s.every((v) => v < 0))
      && Math.min(...s.map(Math.abs)) > 1e-6;
  }

  /**
   * The whole drawing from four corners.  `rays` are the points defining the
   * four bisector lines; `crossings` are the four new corners, in the order
   * AB, BC, CD, DA.  Returns null when the applet's own arithmetic would
   * produce NaN (a parallel pair of bisectors or a flat triangle).
   */
  function compute(a, b, c, d, internal) {
    if (![a, b, c, d].every(valid)) return null;
    if (Math.min(dist(a, b), dist(b, c), dist(c, d), dist(d, a)) < 1e-9) return null;

    const internalRays = {
      A: angleBisector(a, d, b),   // bisects angle DAB
      B: angleBisector(b, a, c),   // ABC
      C: angleBisector(c, b, d),   // BCD
      D: angleBisector(d, c, a),   // CDA
    };
    if (!Object.values(internalRays).every(valid)) return null;
    const rays = internal !== false ? internalRays : {
      A: perp(a, internalRays.A), B: perp(b, internalRays.B),
      C: perp(c, internalRays.C), D: perp(d, internalRays.D),
    };
    if (!Object.values(rays).every(valid)) return null;

    const crossings = {
      AB: intersect(a, rays.A, b, rays.B),
      BC: intersect(b, rays.B, c, rays.C),
      CD: intersect(c, rays.C, d, rays.D),
      DA: intersect(d, rays.D, a, rays.A),
    };
    if (!Object.values(crossings).every(valid)) return null;
    const cc = circle(crossings.AB, crossings.BC, crossings.CD);
    if (!cc) return null;

    const q = [crossings.AB, crossings.BC, crossings.CD, crossings.DA];
    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a));
    const tol = 1e-6 * scale;
    const errors = q.map((p) => Math.abs(dist(p, cc.c) - cc.r));
    const radialError = Math.max(...errors);
    const sums = [
      angle(q[3], q[0], q[1]) + angle(q[1], q[2], q[3]),
      angle(q[0], q[1], q[2]) + angle(q[2], q[3], q[0]),
    ];
    const convex = convexQuad(q);
    return {
      A: a, B: b, C: c, D: d, rays, internalRays, crossings, circle: cc,
      order: q, radialError, oppositeSums: sums, tol,
      claims: {
        // Concyclic is the page's claim; it holds for concave and crossed
        // starting quadrilaterals too, as the logic test checks.
        cyclic: radialError <= tol,
        // The 180-degree wording is about an ordinary (convex) quadrilateral.
        opposite180: convex && sums.every((v) => Number.isFinite(v) && Math.abs(v - 180) <= 1e-6),
      },
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D, state.options.internal);
  }

  /* This is an illustration, not a game: no win, loss or finish. */
  function result() {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the four bisectors meet in four points.";
    const mode = state.options.internal ? "Internal" : "External";
    return `${mode} bisectors: the four crossing points lie on one circle `
      + `(off by ${g.radialError.toExponential(1)} on this drawing). `
      + (state.options.angles ? "Angle marks are on." : "Tick Show angles to see the halves.");
  }

  return {
    VIEW, PAD, STEP, DOWN,
    point, sub, dot, cross, sqDist, dist, midpoint, valid,
    computeAngle, orientation, rotate, angleBisector, perp, intersect, circle, clamp,
    angle, convexQuad,
    start, reset, move, setOption, compute, geometry, result, describe,
  };
})();
