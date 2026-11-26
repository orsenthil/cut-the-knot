"use strict";

/*
 * Auxetic Tessellation, from Alexander Bogomolny's applet AuxeticTessellation.
 *
 * Three draggable points A, B, C and their fourth parallelogram point D carry
 * four rectangles, one on each side of ABCD. Translating that ring of four
 * tiles fills the plane: the applet's Compute() and AddLayer(), read from the
 * bytecode, are transcribed below. The key idea behind the "auxetic" claim is
 * that the four tiles keep their own side lengths and right angles while the
 * hinge rhombus opens, so the area of one repeat of the pattern grows while
 * the fraction of it covered by the tiles falls.
 *
 * This file has no DOM and defines one global, AuxeticTessellationCore. The
 * position is plain data, so the page and the logic test can both use it.
 */

const AuxeticTessellationCore = (() => {
  // The applet's panel: two scroll bars divided by ten, a spinner, and the
  // radio pair. The cut-the-knot page embeds it with startLayer=1, Loose=1.
  const LIMITS = {
    alpha: { min: 0, max: 2.1, step: 0.1 },
    gamma: { min: 0, max: 2.1, step: 0.1 },
    layers: { min: 1, max: 25, step: 1 },
  };
  const DEFAULTS = {
    alpha: 0.5,
    gamma: 0.4,
    layers: 1,
    colorLayers: false,
    loose: true,
    width: 640,
    height: 460,
  };

  const P = (x, y) => ({ x: x, y: y });
  const add = (a, b) => P(a.x + b.x, a.y + b.y);
  const sub = (a, b) => P(a.x - b.x, a.y - b.y);
  const mul = (a, k) => P(a.x * k, a.y * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.FindOrientation: the sign of (b-a) x (c-a). */
  function orientation(a, b, c) {
    return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(p, q, angle, sign) from the bytecode. */
  function rotate(p, q, angle, sign) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    return P(p.x + c * dx - sign * s * dy, p.y + sign * s * dx + c * dy);
  }

  /** CTKGeometryPlus.Prorate: move p toward q by t, or leave p if q is too near. */
  function prorate(p, q, t) {
    const d = dist(p, q);
    if (d < 0.1) return P(p.x, p.y);
    const k = t / d;
    return P(p.x + k * (q.x - p.x), p.y + k * (q.y - p.y));
  }

  /** The applet's FourthPoint(): a parallelogram's opposite corner. */
  const fourth = (a, b, c) => add(sub(c, b), a);

  /**
   * AddRectangle(): the rectangle on side a-b, tucked toward c.
   * Factor alpha on sides A-B and C-D, gamma on B-C and D-A.
   */
  function rectangle(a, b, c, factor, layer) {
    const o = orientation(a, b, c);
    const p = rotate(a, b, Math.PI / 2, -o);
    const q = rotate(b, a, Math.PI / 2, o);
    const u = prorate(a, p, dist(a, p) * factor);
    const v = prorate(b, q, dist(b, q) * factor);
    return { V: [P(a.x, a.y), P(b.x, b.y), v, u], layer: layer || 0 };
  }

  /** Rectangle.Translate(): copy a tile by k times a lattice vector. */
  function translate(r, v, k) {
    const out = { V: r.V.map((p) => add(p, mul(v, k))), layer: r.layer };
    return out;
  }

  /** AdjacentIncircles-style projection of a point onto a line. */
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

  /** The opening position: A and C on a circle about B, as in the applet's init(). */
  function start(options) {
    const o = Object.assign({}, DEFAULTS, options || {});
    const radius = Math.min(o.width / 2, o.height / 2) - 15;
    const center = P(o.width / 2, o.height / 2);
    const fromCircle = (angle) =>
      P(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
    return {
      A: fromCircle((5 * Math.PI) / 4),
      B: fromCircle(0),
      C: fromCircle((-5 * Math.PI) / 4),
      alpha: clamp(o.alpha, LIMITS.alpha.min, LIMITS.alpha.max),
      gamma: clamp(o.gamma, LIMITS.gamma.min, LIMITS.gamma.max),
      layers: clamp(Math.round(o.layers), LIMITS.layers.min, LIMITS.layers.max),
      colorLayers: Boolean(o.colorLayers),
      loose: Boolean(o.loose),
      width: o.width,
      height: o.height,
    };
  }

  /** A new position with one control point (or one option) changed. */
  function withPoint(state, name, p) {
    const next = Object.assign({}, state);
    next[name] = P(p.x, p.y);
    return next;
  }

  function withOption(state, name, value) {
    const next = Object.assign({}, state);
    if (name === "layers") next.layers = clamp(Math.round(value), LIMITS.layers.min, LIMITS.layers.max);
    else if (name === "alpha" || name === "gamma") {
      next[name] = clamp(value, LIMITS[name].min, LIMITS[name].max);
    } else next[name] = Boolean(value);
    return next;
  }

  /** The applet's mousePressed(): a fixed hinge keeps A, C on circles and B on a line. */
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

  /** The four tiles and the translation vectors, without building every layer. */
  function lattice(state) {
    const A = state.A, B = state.B, Cc = state.C;
    const D = fourth(A, B, Cc);
    const base = [
      rectangle(A, B, Cc, state.alpha, 0),
      rectangle(B, Cc, D, state.gamma, 0),
      rectangle(Cc, D, A, state.alpha, 0),
      rectangle(D, A, B, state.gamma, 0),
    ];
    const v01 = sub(base[0].V[3], base[1].V[2]);
    const v02 = sub(base[0].V[0], base[2].V[2]);
    const v03 = sub(base[0].V[2], base[3].V[3]);
    const v13 = sub(base[3].V[0], base[1].V[2]);
    const u = sub(B, A);
    const w = sub(Cc, B);
    const area = Math.abs(cross(v01, v03));
    const covered = 2 * (state.alpha * dot(u, u) + state.gamma * dot(w, w));
    return {
      D: D,
      base: base,
      v01: v01, v02: v02, v03: v03, v13: v13,
      cross: cross(u, w),
      cellArea: area,
      covered: covered,
      density: area > 0 ? covered / area : null,
      spacing01: Math.hypot(v01.x, v01.y) > 0 ? area / Math.hypot(v01.x, v01.y) : 0,
      spacing03: Math.hypot(v03.x, v03.y) > 0 ? area / Math.hypot(v03.x, v03.y) : 0,
      sideAB: Math.hypot(u.x, u.y),
      sideBC: Math.hypot(w.x, w.y),
    };
  }

  /** Compute(): the ring, its twelve neighbours, then 23 more layers. */
  function tessellate(state) {
    const m = lattice(state);
    const base = m.base;
    const v01 = m.v01, v02 = m.v02, v03 = m.v03, v13 = m.v13;
    // Each entry uses either the base ring or an earlier entry, exactly as
    // the twelve aastore instructions in Compute() do.
    const tiles = [
      translate(base[3], v03, 1),
      translate(base[2], v03, 1),
      translate(base[0], v01, -1),
      translate(base[1], v02, -1),
      translate(base[2], v03, -1),
      translate(base[3], v03, -1),
      translate(base[1], v03, -1),
    ];
    tiles[7] = translate(tiles[5], v01, 1);
    tiles[8] = translate(tiles[6], v01, 1);
    tiles[9] = translate(base[2], v01, 1);
    tiles[10] = translate(tiles[8], v03, 1);
    tiles[11] = translate(tiles[9], v03, 1);
    for (const r of tiles) r.layer = 2;

    const layers = [base, tiles];
    let cur = tiles;
    let prev = base;
    for (let i = 0; i < 23; i++) {
      const next = addLayer(cur, prev, v01, v02, v03, v13, 3 + i);
      layers.push(next);
      prev = cur;
      cur = next;
    }
    return Object.assign({}, m, { layers: layers });
  }

  /** AddLayer() from the bytecode: eight new tiles around the previous ring. */
  function addLayer(cur, prev, v01, v02, v03, v13, index) {
    const out = new Array(cur.length + 8);
    const m = Math.floor(cur.length / 4) + 1;
    let k = 0;
    out[k++] = translate(cur[cur.length - 2], v03, 1);
    out[k++] = translate(index === 3 ? prev[0] : prev[prev.length - 1], v03, 1);
    for (let i = 0; i < m - 1; i++) out[k++] = translate(out[i], v01, -1);
    let j = k;
    out[k++] = translate(out[j - 2], v02, -1);
    for (let i = 0; i < m; i++) out[k++] = translate(out[j - 2], v03, -1);
    j = k;
    out[k++] = translate(out[j - 2], v13, 1);
    for (let i = 0; i < m; i++) out[k++] = translate(out[j - 2], v01, 1);
    j = k;
    out[k++] = translate(out[j - 2], v02, 1);
    for (let i = 0; i < m; i++) out[k++] = translate(out[j - 2], v03, 1);
    for (const r of out) if (r) r.layer = index;
    return out;
  }

  /**
   * Open the hinge rhombus by `degrees`, keeping the half-diagonals' length
   * and the centre fixed. This is the "stretch" the page talks about.
   */
  function openHinge(state, degrees) {
    const m = lattice(state);
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
    const theta = clamp(Math.atan2(b, a) + (degrees * Math.PI) / 180, 0.02, Math.PI / 2 - 0.02);
    const na = s * Math.cos(theta);
    const nb = s * Math.sin(theta);
    const B = add(center, mul(eBD, na));
    const D = sub(center, mul(eBD, na));
    const A = sub(center, mul(eAC, nb));
    const C = add(center, mul(eAC, nb));
    return Object.assign({}, state, { A: A, B: B, C: C, D: D });
  }

  return {
    LIMITS: LIMITS,
    DEFAULTS: DEFAULTS,
    P: P, add: add, sub: sub, mul: mul, dot: dot, cross: cross,
    dist: dist, clamp: clamp, orientation: orientation,
    rotate: rotate, prorate: prorate, fourth: fourth,
    rectangle: rectangle, translate: translate,
    projectOnLine: projectOnLine, projectOnCircle: projectOnCircle,
    start: start, withPoint: withPoint, withOption: withOption,
    constrainPoint: constrainPoint, lattice: lattice,
    tessellate: tessellate, addLayer: addLayer, openHinge: openHinge,
  };
})();
