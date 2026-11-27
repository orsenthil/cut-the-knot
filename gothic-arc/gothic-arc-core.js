"use strict";

/*
 * Gothic Arc, from Alexander Bogomolny's applet GothicArc.
 *
 * Two arcs of equal radius meet at the top C of the Gothic arc OBC. A chain
 * of circles is drawn, each touching the semicircle on OB, the Gothic arc and
 * its neighbours. The key idea is that this picture embeds into an arbelos
 * with a Pappus chain: with the big radius written as R, the ideal chain has
 * R_n = R/(2 + n^2), and every triangle formed by a centre, its foot on OB
 * and the midpoint D is Pythagorean.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, GothicArcCore, so the page loads it with a
 * plain <script> and porting/check-gothic-arc.mjs loads it in Node. Every
 * function returns plain data, and every position can be handed to the tutor
 * as it is.
 */
const GothicArcCore = (() => {
  /** GothicArc.init(): its applet parameters and fixed constants. */
  const DEFAULT_WIDTH = 500;   // the WIDTH parameter on the cut-the-knot page
  const DEFAULT_HEIGHT = 400;  // the HEIGHT parameter on the cut-the-knot page
  const MARGIN = 30;
  const NUM = 7;               // GothicArcCanvas.Num
  const OFFSET = 2;            // C is two pixels right of the midpoint of AB
  const BUFFER = 1;            // the applet inflates a neighbour by one pixel

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const circleInfo = (c) => c.center.x * c.center.x + c.center.y * c.center.y - c.radius * c.radius;

  /** Foot of the perpendicular from p onto the line through a and b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Upper intersection of two circles whose centres have the same y. */
  function upperIntersection(c1, c2) {
    const dx = c2.center.x - c1.center.x;
    if (Math.abs(dx) < 1e-12) return null;
    const a = (c1.radius * c1.radius - c2.radius * c2.radius + dx * dx) / (2 * dx);
    const h2 = c1.radius * c1.radius - a * a;
    if (h2 < 0) return null;
    return { x: c1.center.x + a, y: c1.center.y - Math.sqrt(h2) };
  }

  /** The unsigned angle at v, in degrees, as GeoSDoub.ComputeAngle does. */
  function angleDegrees(v, p, q) {
    const a = { x: p.x - v.x, y: p.y - v.y };
    const b = { x: q.x - v.x, y: q.y - v.y };
    const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y);
    if (!na || !nb) return 0;
    const c = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (na * nb)));
    return Math.acos(c) * 180 / Math.PI;
  }

  /**
   * GothicArcCanvas.init, with A and B supplied directly. The rectangle is
   * only used to place those two points; afterwards every construction uses
   * the same formulas as the applet, whatever the base length.
   */
  function fromEndpoints(a, b, extra) {
    const e = extra || {};
    const base = { x: a.x, y: a.y };
    const radius = b.x - a.x;
    const cPoint = { x: (a.x + b.x) / 2 + OFFSET, y: a.y };
    const rightBig = { center: midpoint(a, b), radius: radius / 2 };
    const leftBig = { center: { x: b.x, y: b.y }, radius: radius / 2 - BUFFER };
    const top = upperIntersection(leftBig, rightBig);
    const d = top ? foot(top, a, b) : { x: b.x, y: a.y };
    const angleC = top ? Math.round(angleDegrees(cPoint, top, b)) : 90;
    const o1 = midpoint(a, cPoint), o2 = midpoint(b, cPoint);
    const leftCircle = { center: o1, radius: distance(o1, cPoint) };
    const rightCircle = { center: o2, radius: distance(o2, cPoint) };
    return {
      width: e.width === undefined ? DEFAULT_WIDTH : e.width,
      height: e.height === undefined ? DEFAULT_HEIGHT : e.height,
      showNames: !!e.showNames,
      showGothic: e.showGothic !== false,
      a: base, b: { x: b.x, y: b.y },
      c: cPoint, top: top, d: d, angleC: angleC,
      rightBig: rightBig, leftBig: leftBig,
      leftCircle: leftCircle, rightCircle: rightCircle,
      count: e.count === undefined ? NUM : e.count,
    };
  }

  /** The applet's rectangle and its two base points, for any WIDTH/HEIGHT. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? DEFAULT_WIDTH : o.width;
    const height = o.height === undefined ? DEFAULT_HEIGHT : o.height;
    const margin = MARGIN;
    const side = Math.min(width - 2 * margin, 2 * (height - 2 * margin));
    const y = height - 2 * margin - side / 2;
    const a = { x: margin, y: (2 * y + side) / 2 };
    const b = { x: margin + side, y: a.y };
    return fromEndpoints(a, b, {
      width: width, height: height,
      showNames: o.showNames !== undefined ? o.showNames : true, // <param name="Show" value="1">
      showGothic: o.showGothic !== undefined ? o.showGothic : true,
      count: o.count,
    });
  }

  /** Drag an endpoint: the construction is rebuilt from the new base. */
  function withEndpoints(state, a, b) {
    return fromEndpoints(a, b, state);
  }

  /** The option checkboxes, with the applet's radio choice between modes. */
  function withOptions(state, options) {
    const o = options || {};
    const merged = {
      width: state.width, height: state.height,
      showNames: o.showNames === undefined ? state.showNames : !!o.showNames,
      showGothic: o.showGothic === undefined ? state.showGothic : !!o.showGothic,
      count: o.count === undefined ? state.count : o.count,
    };
    return fromEndpoints(state.a, state.b, merged);
  }

  /** Refresh after the page changes size; the base stays where it is. */
  function reset(state) {
    return start({
      width: state.width, height: state.height,
      showNames: state.showNames, showGothic: state.showGothic,
      count: state.count,
    });
  }

  /** DoubCircle(c, r + 1) shifted one pixel down: the applet's buffer. */
  function inflate(c) {
    return { center: { x: c.center.x, y: c.center.y + BUFFER }, radius: c.radius + BUFFER };
  }

  /**
   * ApolloniusCircle.Compute(s0, s1, s2), transcribed from the bytecode.
   * Returns the two signed tangent circles or null at the applet's own
   * thresholds (|K| < 0.01, |L| < 0.001, negative discriminant).
   */
  function compute(gs, signs) {
    const c0 = gs[0], c1 = gs[1], c2 = gs[2];
    const s0 = signs[0], s1 = signs[1], s2 = signs[2];
    const a1 = 2 * (c1.center.x - c0.center.x);
    const a2 = 2 * (c2.center.x - c0.center.x);
    const b1 = 2 * (c1.center.y - c0.center.y);
    const b2 = 2 * (c2.center.y - c0.center.y);
    const o = circleInfo(c0);
    const d1 = o - circleInfo(c1);
    const d2 = o - circleInfo(c2);
    const k = a1 * b2 - a2 * b1;
    if (Math.abs(k) < 0.01) return null; // TreatZeroDeterminant always returns null
    const g = (b1 * d2 - b2 * d1) / k;
    const i = -(a1 * d2 - a2 * d1) / k;
    const e1 = 2 * (s0 * c0.radius - s1 * c1.radius);
    const e2 = 2 * (s0 * c0.radius - s2 * c2.radius);
    const v = (b1 * e2 - b2 * e1) / k;
    const w = -(a1 * e2 - a2 * e1) / k;
    const l = v * v + w * w - 1;
    if (Math.abs(l) < 0.001) return null;
    const cc = 2 * (v * g + w * i - v * c0.center.x - w * c0.center.y + s0 * c0.radius);
    const q = g * g + i * i - 2 * g * c0.center.x - 2 * i * c0.center.y + o;
    let disc = cc * cc - 4 * l * q;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const make = (root) => {
      const t = Math.abs(root);
      return { center: { x: v * root + g, y: w * root + i }, radius: t, signedRadius: root };
    };
    return [make((-cc + disc) / (2 * l)), make((-cc - disc) / (2 * l))];
  }

  /**
   * DrawSmallCircle/DrawOneCircle: SetCircles(prev, rightCircle,
   * inflate(rightBigCircle)) and Compute(1, 1, -1). UsedCircles is a fresh
   * Vector on every call, so WasUsed(pair[0]) is always false and the first
   * root is always the one drawn. A null step ends the chain.
   */
  function chain(state) {
    const out = [];
    let previous = state.leftCircle;
    for (let n = 1; n <= state.count; n++) {
      const pair = compute([inflate(previous), state.rightCircle, inflate(state.rightBig)], [1, 1, -1]);
      if (!pair) break;
      previous = pair[0];
      out.push({ center: { x: previous.center.x, y: previous.center.y }, radius: previous.radius });
    }
    return out;
  }

  /**
   * The ideal Pappus chain the page describes. Here R is the radius of the
   * big semicircle and OD = R/2; the formulas are exact, unlike the drawn
   * chain where each step inflates its neighbour by one pixel.
   */
  function ideal(R, n) {
    const den = 2 + n * n;
    const radius = R / den;
    const height = 2 * n * R / den;            // O_n P_n = 2 n R_n
    const dx = (n * n - 4) * R / (2 * den);    // signed D P_n
    return {
      index: n, radius: radius, height: height, dx: dx,
      dDistance: (n * n + 4) * R / (2 * den),  // D O_n
      oDistance: R * (n * n - 1) / den,        // O P_n
      ooDistance: R * (n * n + 1) / den,       // O O_n
      fractionOfOD: 2 / den,                   // R_n / (R/2)
    };
  }

  /** The exact Euclid triples behind the right triangles (n > 1). */
  function pythagoras(n) {
    return { dLeg: n * n - 4, heightLeg: 4 * n, dHyp: n * n + 4,
             oLeg: n * n - 1, oHeightLeg: 2 * n, oHyp: n * n + 1 };
  }

  /** How far a drawn circle is from the three tangencies the applet asks for. */
  function tangencyErrors(state, circles) {
    const out = [];
    for (let i = 0; i < circles.length; i++) {
      const previous = i === 0 ? state.leftCircle : circles[i - 1];
      const targets = [
        { circle: inflate(state.rightBig), sign: -1 },
        { circle: state.rightCircle, sign: 1 },
        { circle: inflate(previous), sign: 1 },
      ];
      out.push(targets.map((t) => {
        const d = distance(circles[i].center, t.circle.center);
        const want = t.sign < 0 ? Math.abs(t.circle.radius - circles[i].radius)
          : t.circle.radius + circles[i].radius;
        return Math.abs(d - want);
      }));
    }
    return out;
  }

  /** Plain data for the player's record and the tutor. */
  function position(state) {
    const drawn = chain(state);
    const r = state.b.x - state.a.x;
    return {
      width: state.width, height: state.height,
      showNames: state.showNames, showGothic: state.showGothic,
      a: state.a, b: state.b, c: state.c, top: state.top, d: state.d,
      angleC: state.angleC, radius: r / 2, od: r / 2 / 2,
      drawn: drawn,
      ideal: [1, 2, 3, 6].map((n) => ({ n: n, radius: ideal(r / 2, n).radius })),
    };
  }

  return {
    DEFAULT_WIDTH: DEFAULT_WIDTH, DEFAULT_HEIGHT: DEFAULT_HEIGHT,
    MARGIN: MARGIN, NUM: NUM, OFFSET: OFFSET, BUFFER: BUFFER,
    distance: distance, midpoint: midpoint, foot: foot,
    fromEndpoints: fromEndpoints, start: start, withEndpoints: withEndpoints,
    withOptions: withOptions, reset: reset, inflate: inflate,
    compute: compute, chain: chain, ideal: ideal, pythagoras: pythagoras,
    tangencyErrors: tangencyErrors, position: position,
  };
})();
