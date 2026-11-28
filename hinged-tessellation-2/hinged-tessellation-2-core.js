"use strict";

/*
 * Hinged Tessellation 2, from Alexander Bogomolny's applet HingedTessellation2.
 *
 * A regular (4,3,3,4,3) tiling is put on hinges: three draggable points A, B, C
 * carry the fourth corner D of a parallelogram, and quarter turns of its sides
 * build squares around them. Unlike HingedTessellation1, which keeps the
 * equilateral triangles rigid and lets the squares become rhombi, this applet
 * keeps the SQUARES rigid and lets the triangles stretch. With the hinges
 * locked, A and C stay on circles about B, so BA = BC and the three triangles
 * at A keep their angles summing to 360 degrees however far they are opened.
 * Opening them until each has a right angle pairs the triangles into squares
 * and gives the page's (4,4,4,4) derivative.
 *
 * The point positions, rotation signs, triangle list, edge list, colour rule
 * and layer translations below are transcribed from javap output of
 * HingedTessellation2Canvas and its Stranger inner class. This file has no
 * DOM and defines one global, HingedTessellation2Core; the position is plain
 * data, so the page and the Node logic test can both use it.
 */

const HingedTessellation2Core = (() => {
  // HingedTessellation2Panel: radio group HowColor and SpinnerNumberModel(0, 0, 15, 1).
  const MODES = { ONE_COLOR: 0, TWO_COLORS: 1, COLOR_LAYERS: 2 };
  const LIMITS = { layers: { min: 0, max: 15, step: 1 } };
  // The applet's Colors[] array: translucent blue, green, red, then seven more.
  const COLOR_NAMES = ["blue", "green", "red", "yellow", "cyan", "magenta",
    "gray", "lightGray", "orange", "pink"];
  const DEFAULTS = {
    width: 640, height: 460, // the WIDTH/HEIGHT in the page's <APPLET> tag
    layers: 4,               // the page's <param name="startLayer" value="4">
    colorMode: MODES.ONE_COLOR, // the panel's first radio button
    loose: false,            // no Loose=1 parameter on the page
  };
  const HALF_PI = Math.PI / 2;

  const P = (x, y) => ({ x: x, y: y });
  const add = (a, b) => P(a.x + b.x, a.y + b.y);
  const sub = (a, b) => P(a.x - b.x, a.y - b.y);
  const mul = (a, k) => P(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.FindOrientation: +1 when (b-a) x (c-a) is positive, else -1. */
  function orientation(a, b, c) {
    return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(centre, point, angle, sign) from the bytecode. */
  function rotate(centre, point, angle, sign) {
    const co = Math.cos(angle);
    const si = Math.sin(angle);
    const dx = point.x - centre.x;
    const dy = point.y - centre.y;
    return P(centre.x + co * dx - sign * si * dy,
      centre.y + sign * si * dx + co * dy);
  }

  /** The applet's FourthPoint(a,b,c) = c + a - b: a parallelogram corner. */
  const fourth = (a, b, c) => add(sub(c, b), a);

  /** GeoSDoub.ComputeSignedAngle(p,q,r): signed angle at p, in radians. */
  function signedAngle(p, q, r) {
    const pq = dist(p, q), pr = dist(p, r);
    if (!pq || !pr) return 0;
    const cosValue = clamp((pq * pq + pr * pr - dist(q, r) * dist(q, r)) / (2 * pq * pr), -1, 1);
    const base = Math.acos(cosValue);
    const o = orientation(p, q, r);
    return o === 1 ? base : -base;
  }

  /** Unsigned angle at a vertex, in radians. */
  function angle(vertex, p, q) {
    const a = sub(p, vertex), b = sub(q, vertex);
    if (!dist(vertex, p) || !dist(vertex, q)) return 0;
    return Math.acos(clamp(dot(a, b) / (dist(vertex, p) * dist(vertex, q)), -1, 1));
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

  /** init(): radius = floor(min(width,height)/3) - 2*60; angles 0, -120, +120. */
  function start(options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const radius = Math.floor(Math.min(o.width / 3, o.height / 3)) - 120;
    const centre = P(o.width / 2, o.height / 2);
    const fromCircle = (a) => P(centre.x + radius * Math.cos(a), centre.y + radius * Math.sin(a));
    return {
      A: fromCircle(-2.0943951023931953),
      B: fromCircle(0),
      C: fromCircle(2.0943951023931953),
      layers: clamp(Math.round(o.layers), LIMITS.layers.min, LIMITS.layers.max),
      colorMode: clamp(Math.round(o.colorMode), MODES.ONE_COLOR, MODES.COLOR_LAYERS),
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
    else if (name === "colorMode") next.colorMode = clamp(Math.round(value), MODES.ONE_COLOR, MODES.COLOR_LAYERS);
    else next[name] = Boolean(value);
    return next;
  }

  /** mousePressed(): A and C stay on circles about B; B stays on the bisector of AC. */
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

  /**
   * A preset that opens the hinge to a chosen apex angle at B while keeping
   * BA = BC, so it respects the same locked-hinge constraint as the applet.
   * 60 degrees is the regular (4,3,3,4,3) start; 90 degrees is the square
   * derivative the page describes.
   */
  function withApex(state, degrees) {
    const o = clamp(degrees, 1, 179) * Math.PI / 180;
    const r = dist(state.B, state.A);
    const at = (a) => P(state.B.x + r * Math.cos(a), state.B.y + r * Math.sin(a));
    return Object.assign({}, state, {
      A: at(Math.PI - o / 2),
      C: at(Math.PI + o / 2),
    });
  }

  /** The applet's colour choice inside Stranger.Draw(). */
  function colorPair(layer, id, colorMode) {
    const n = COLOR_NAMES.length;
    let first = 0, second = 0;
    if (colorMode === MODES.TWO_COLORS) {
      first = id % 2 === 0 ? 0 : 1;
      second = id % 2 === 0 ? 1 : 0;
    } else if (colorMode === MODES.COLOR_LAYERS) {
      first = layer % n;
      second = (layer + 2) % n;
    }
    return [first, second];
  }

  /**
   * One Stranger motif: the eight filled triangles, the 26 drawn edges and
   * the two lattice vectors. This is Stranger.Draw() from the bytecode.
   */
  function motif(A, B, C, layer, id, colorMode) {
    const o = orientation(B, A, C);
    const D = fourth(A, B, C);
    // The applet computes this signed angle and then never uses it: kept for
    // faithfulness, it has no effect on the picture.
    const unusedAngle = signedAngle(D, C, A);

    const N = rotate(B, C, HALF_PI, o);
    const Pp = rotate(C, B, HALF_PI, -o);
    const E = rotate(C, D, HALF_PI, o);
    const F = rotate(D, C, HALF_PI, -o);
    const I = rotate(D, A, HALF_PI, o);
    const K = rotate(A, D, HALF_PI, -o);
    const L = rotate(A, B, HALF_PI, o);
    const M = rotate(B, A, HALF_PI, -o);
    const H = fourth(F, D, I);
    const T = fourth(K, A, L);
    const Q = rotate(L, T, HALF_PI, -o);
    const R = P(E.x + L.x - Q.x, E.y + L.y - Q.y);

    const [c0, c1] = colorPair(layer, id, colorMode);
    const triangles = [
      { points: [A, B, C], color: c0 },
      { points: [C, E, Pp], color: c0 },
      { points: [A, K, L], color: c0 },
      { points: [D, H, I], color: c0 },
      { points: [L, M, Q], color: c0 },
      { points: [A, C, D], color: c1 },
      { points: [F, D, H], color: c1 },
      { points: [E, F, R], color: c1 },
    ];
    // Both A-K and K-A, and A-L twice: the applet really does draw these.
    const edges = [
      [A, B], [B, C], [C, D], [D, A], [B, N], [N, Pp], [Pp, C],
      [C, E], [E, F], [F, D], [K, A], [I, K], [I, D], [A, K],
      [L, M], [M, B], [A, L], [K, L], [A, L], [E, Pp],
      [H, F], [H, D], [H, I], [A, C], [E, R], [M, Q],
    ];

    return {
      A: A, B: B, C: C, D: D, N: N, P: Pp, E: E, F: F, I: I, K: K,
      L: L, M: M, H: H, Q: Q, R: R,
      orientation: o, unusedAngle: unusedAngle,
      layer: layer, id: id, colors: [c0, c1],
      triangles: triangles, edges: edges,
      V: sub(B, H), W: sub(L, Pp),
    };
  }

  /**
   * Canvas.Draw(): the base motif, then NLayers copies stepping along +W and
   * NLayers copies stepping along -W. (V is only passed to ShowOneLayer(), a
   * routine the applet never calls; the visible layers all use W.)
   */
  function tessellate(state) {
    const base = motif(state.A, state.B, state.C, 0, 0, state.colorMode);
    const motifs = [base];
    const W = base.W;
    for (let i = 1; i <= state.layers; i++) {
      const d = mul(W, i);
      motifs.push(motif(add(state.A, d), add(state.B, d), add(state.C, d), i, i, state.colorMode));
    }
    for (let i = 1; i <= state.layers; i++) {
      const d = mul(W, -i);
      motifs.push(motif(add(state.A, d), add(state.B, d), add(state.C, d), i, i, state.colorMode));
    }
    return { D: base.D, base: base, motifs: motifs, V: base.V, W: W };
  }

  /**
   * The five polygons at A, in the order that gives (4,3,3,4,3):
   * square ABML, triangle ABC, triangle ACD, square DAKI, triangle AKL.
   * Their angles add to 360 degrees for every locked-hinge position.
   */
  function vertexAngles(A, B, C) {
    const m = motif(A, B, C, 0, 0, MODES.ONE_COLOR);
    const deg = (v, p, q) => angle(v, p, q) * 180 / Math.PI;
    const parts = [
      deg(A, B, m.L),        // square ABML at A
      deg(A, B, C),          // triangle ABC at A
      deg(A, C, m.D),        // triangle ACD at A
      deg(A, m.D, m.K),      // square DAKI at A
      deg(A, m.K, m.L),      // triangle AKL at A
    ];
    return {
      parts: parts,
      sum: parts.reduce((x, y) => x + y, 0),
      apex: deg(B, A, C),
      squares: [
        [A, B, m.M, m.L], [m.D, A, m.K, m.I],
        [B, C, m.P, m.N], [C, m.D, m.F, m.E],
      ],
      triangles: [
        [A, B, C], [A, C, m.D], [A, m.K, m.L],
        [C, m.E, m.P], [m.D, m.H, m.I], [m.L, m.M, m.Q],
        [m.F, m.D, m.H], [m.E, m.F, m.R],
      ],
    };
  }

  return {
    MODES: MODES, LIMITS: LIMITS, COLOR_NAMES: COLOR_NAMES, DEFAULTS: DEFAULTS,
    P: P, add: add, sub: sub, mul: mul, dot: dot, cross: cross, dist: dist,
    clamp: clamp, orientation: orientation, rotate: rotate, fourth: fourth,
    signedAngle: signedAngle, angle: angle,
    projectOnLine: projectOnLine, projectOnCircle: projectOnCircle,
    start: start, withPoint: withPoint, withOption: withOption,
    constrainPoint: constrainPoint, withApex: withApex,
    colorPair: colorPair, motif: motif, tessellate: tessellate,
    vertexAngles: vertexAngles,
  };
})();
