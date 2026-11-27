"use strict";

/*
 * Dancing Squares, from Paul Brown's cut-the-knot applet DancingSquares.
 *
 * Three points A, B, C are the hinges of a rhombus ABCD (D = A + C - B). A
 * square hangs off each side; reflecting those four squares across their free
 * edges grows a plane tessellation. Dragging the hinges changes every square's
 * angle but never its shape - the squares are rigid - so the whole pattern
 * expands and finally closes up again as a grid of squares turned a quarter
 * turn. The construction below is Compute(), AddLayer() and AddLayer7() read
 * from javap output; the squares come from AddSquare()/AddSquare1(), which use
 * GeoSDoub.FindOrientation and Rotate.
 *
 * This file has no DOM and defines one global, DancingSquaresCore. The
 * position is plain data, so the page and the logic test can both use it.
 */

const DancingSquaresCore = (() => {
  // The applet's panel: a "Show names" check box, One color / Color layers
  // radios, and a startLayer spinner of 0..15. The live page embeds it with
  // startLayer=4; its second copy adds Loose=1.
  const LIMITS = {
    layers: { min: 0, max: 15, step: 1 },
  };
  const DEFAULTS = {
    layers: 4,
    colorLayers: false,
    showNames: false,
    loose: false,
    width: 640,
    height: 560,
  };
  const QUARTER = Math.PI / 2;

  const P = (x, y) => ({ x: x, y: y });
  const add = (a, b) => P(a.x + b.x, a.y + b.y);
  const sub = (a, b) => P(a.x - b.x, a.y - b.y);
  const mul = (a, k) => P(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.FindOrientation: the sign of (b-a) x (c-a); never zero. */
  function orientation(a, b, c) {
    const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return v > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(p, q, angle, sign): rotate q about p by sign*angle. */
  function rotate(p, q, angle, sign) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    return P(p.x + c * dx - sign * s * dy, p.y + sign * s * dx + c * dy);
  }

  /** The applet's FourthPoint(): C.x + A.x - B.x in the bytecode's order. */
  const fourth = (a, b, c) => P(c.x + a.x - b.x, c.y + a.y - b.y);

  /** AddSquare(a, b, c, layer): the square on a-b, on the side away from c. */
  function square(a, b, c, layer) {
    const o = orientation(a, b, c);
    return {
      V: [P(a.x, a.y), P(b.x, b.y), rotate(b, a, QUARTER, o), rotate(a, b, QUARTER, -o)],
      layer: layer || 0,
    };
  }

  /** AddSquare1(a, b, c, layer): the same square, traversed the other way. */
  function square1(a, b, c, layer) {
    const o = orientation(b, a, c);
    return {
      V: [P(b.x, b.y), P(a.x, a.y), rotate(a, b, QUARTER, o), rotate(b, a, QUARTER, -o)],
      layer: layer || 0,
    };
  }

  /** AddTwoSquares(): two squares sharing the diagonal of the hinge parallelogram. */
  function addTwoSquares(a, b, c, layer) {
    const s = fourth(a, b, c);
    return [square1(s, a, b, layer), square1(c, s, a, layer)];
  }

  /** GetLayer() from the bytecode: which tile of the previous ring to use. */
  function getLayer(i, layers) {
    const k = 2 * layers - 1;
    return k * Math.floor(i / layers) + 2 * (i % layers);
  }

  /** AddLayer() from the bytecode: the twelve tiles around the first ring. */
  function addLayer(prev, layers, A) {
    const out = new Array(layers === 2 ? 6 : prev.length * 3);
    let pair = addTwoSquares(prev[0].V[2], prev[0].V[1], prev[1].V[3], layers);
    out[0] = pair[0];
    out[1] = pair[1];
    const limit = layers === 2 ? 2 : prev.length;
    for (let i = 1; i < limit; i++) {
      const next = addTwoSquares(prev[i].V[2], prev[i].V[1], prev[(i + 1) % prev.length].V[3], layers);
      const bridge = square(next[0].V[3], pair[1].V[2], A, layers);
      if (layers !== 2) out[3 * (i - 1) + 2] = bridge;
      out[3 * i] = next[0];
      out[3 * i + 1] = next[1];
      pair = next;
    }
    if (layers !== 2) {
      out[out.length - 1] = square1(out[10].V[2], out[0].V[3], A, 1);
    }
    return out;
  }

  /** AddLayer7() from the bytecode: a ring of 8*layers+4 tiles. */
  function addLayer7(prev, layers, A) {
    const out = new Array(8 * layers + 4);
    let count = 0;
    for (let i = 0; i < 4 * layers; i++) {
      const j = (getLayer(i, layers) - 1 + prev.length) % prev.length;
      const k = (j + 1) % prev.length;
      const mirror = i % layers === 0 ? 0 : 2;
      const pair = addTwoSquares(prev[j].V[3], prev[j].V[mirror], prev[k].V[2], layers);
      const shift = Math.floor(count / layers);
      out[2 * i + shift] = pair[0];
      out[2 * i + 1 + shift] = pair[1];
      count++;
    }
    for (let i = 0; i < out.length; i++) {
      if (out[i]) continue;
      const before = (i - 1 + out.length) % out.length;
      const after = (i + 1) % out.length;
      out[i] = square(out[after].V[3], out[before].V[2], A, layers);
    }
    return out;
  }

  /** Compute(): the first ring, then layers 1 through 15. */
  function tessellate(state) {
    const A = state.A, B = state.B, C = state.C;
    const D = fourth(A, B, C);
    const base = [
      square(A, B, C, 0),
      square(B, C, D, 0),
      square(C, D, A, 0),
      square(D, A, B, 0),
    ];
    const layers = [base];
    let cur = addLayer(base, 1, A);
    layers.push(cur);
    for (let i = 2; i < 16; i++) {
      cur = addLayer7(cur, i, A);
      layers.push(cur);
    }
    return { D: D, base: base, layers: layers };
  }

  /** The opening position, straight from the applet's init(). */
  function start(options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    // The applet's own radius: min(width/3, height/3) minus two 60-pixel bands.
    const radius = Math.min(o.width / 3, o.height / 3) - 120;
    const center = P(o.width / 2, o.height / 2);
    const fromCircle = (angle) =>
      P(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
    return {
      A: fromCircle((5 * Math.PI) / 4),
      B: fromCircle(0),
      C: fromCircle((-5 * Math.PI) / 4),
      layers: clamp(Math.round(o.layers), LIMITS.layers.min, LIMITS.layers.max),
      colorLayers: Boolean(o.colorLayers),
      showNames: Boolean(o.showNames),
      loose: Boolean(o.loose),
      width: o.width,
      height: o.height,
    };
  }

  function withPoint(state, name, p) {
    const next = Object.assign({}, state);
    next[name] = P(p.x, p.y);
    return next;
  }

  function withOption(state, name, value) {
    const next = Object.assign({}, state);
    if (name === "layers") next.layers = clamp(Math.round(value), LIMITS.layers.min, LIMITS.layers.max);
    else next[name] = Boolean(value);
    return next;
  }

  function projectOnLine(p, a, b) {
    const d = sub(b, a);
    const n = dot(d, d);
    if (!n) return P(a.x, a.y);
    return add(a, mul(d, dot(sub(p, a), d) / n));
  }

  function projectOnCircle(p, c, r) {
    const d = sub(p, c);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-12) return P(c.x + r, c.y);
    return add(c, mul(d, r / len));
  }

  /** The applet's mousePressed(): a fixed hinge keeps A, C on circles, B on a line. */
  function constrainPoint(state, name, p) {
    if (state.loose) return P(p.x, p.y);
    if (name === "A") return projectOnCircle(p, state.B, dist(state.B, state.C));
    if (name === "C") return projectOnCircle(p, state.B, dist(state.B, state.A));
    if (name === "B") {
      const mid = mul(add(state.A, state.C), 0.5);
      const d = sub(state.C, state.A);
      return projectOnLine(p, mid, add(mid, P(-d.y, d.x)));
    }
    return P(p.x, p.y);
  }

  /** A symmetric hinge: A and C opposite, B and D opposite, diagonals at right angles. */
  function hinge(angle, side) {
    const s = side || 2;
    return {
      A: P(0, -s * Math.sin(angle)),
      B: P(s * Math.cos(angle), 0),
      C: P(0, s * Math.sin(angle)),
    };
  }

  /**
   * Open the hinge by `degrees`, keeping the four side lengths and the centre
   * fixed. Half the angle at B is atan(half AC / half BD).
   */
  function openHinge(state, degrees) {
    const m = tessellate(state);
    const center = mul(add(state.A, state.C), 0.5);
    let eAC = sub(state.C, state.A);
    let eBD = sub(state.B, m.D);
    const nAC = Math.hypot(eAC.x, eAC.y);
    const nBD = Math.hypot(eBD.x, eBD.y);
    if (nAC < 1e-9 || nBD < 1e-9) return state;
    eAC = mul(eAC, 1 / nAC);
    eBD = mul(eBD, 1 / nBD);
    const a = nBD / 2;
    const b = nAC / 2;
    const s = Math.hypot(a, b);
    const theta = clamp(Math.atan2(b, a) + (degrees * Math.PI) / 180, 0.01, Math.PI / 2 - 0.01);
    const na = s * Math.cos(theta);
    const nb = s * Math.sin(theta);
    return Object.assign({}, state, {
      A: sub(center, mul(eAC, nb)),
      C: add(center, mul(eAC, nb)),
      B: add(center, mul(eBD, na)),
      D: sub(center, mul(eBD, na)),
    });
  }

  /** The four base squares, the repeat's translation steps and its area. */
  function lattice(state) {
    const m = tessellate(state);
    const base = m.base;
    // Two lattice steps connect the base squares; two squares lie in each cell.
    const v1 = sub(base[1].V[3], base[0].V[0]);
    const v2 = sub(base[0].V[1], base[2].V[3]);
    const v3 = sub(base[0].V[3], base[1].V[2]);
    const u = sub(state.B, state.A);
    const cell = Math.abs(cross(v1, v2));
    const squareArea = dot(u, u);
    const ac = dist(state.A, state.C);
    const bd = dist(state.B, m.D);
    return {
      D: m.D,
      base: base,
      v1: v1,
      v2: v2,
      v3: v3,
      side: Math.sqrt(squareArea),
      area: squareArea,
      cell: cell,
      spacing1: Math.hypot(v1.x, v1.y),
      spacing2: Math.hypot(v2.x, v2.y),
      density: cell > 0 ? (2 * squareArea) / cell : null,
      // Half the angle at B is atan(|AC| / |BD|) for a hinged rhombus.
      hingeAngle: 2 * Math.atan2(ac, bd),
      // The first side of square ABCD starts horizontal when the angle is 0.
      squareAngle: Math.atan2(u.y, u.x),
    };
  }

  return {
    LIMITS: LIMITS, DEFAULTS: DEFAULTS, QUARTER: QUARTER,
    P: P, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, clamp: clamp, orientation: orientation, rotate: rotate,
    fourth: fourth, square: square, square1: square1,
    addTwoSquares: addTwoSquares, getLayer: getLayer,
    addLayer: addLayer, addLayer7: addLayer7, tessellate: tessellate,
    start: start, withPoint: withPoint, withOption: withOption,
    constrainPoint: constrainPoint, hinge: hinge, openHinge: openHinge,
    lattice: lattice,
  };
})();
