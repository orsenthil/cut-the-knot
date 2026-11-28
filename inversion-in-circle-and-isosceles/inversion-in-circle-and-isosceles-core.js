"use strict";

/*
 * Inversion in a Circle and an Isosceles Triangle, from Alexander Bogomolny's
 * applet InversionInCircleAndIsosceles and the article "Tangent Circles and an
 * Isosceles Triangle" (cut-the-knot.org/Curriculum/Geometry/
 * InversionInCircleAndIsosceles.shtml). The exact claim is: circle S has
 * diameter AC, B lies on AC, G has diameter AB, E is the upper point of S on
 * the perpendicular bisector of BC (so BCE is isosceles), and W is the circle
 * touching S, G and BE inside the curvilinear triangle. Then the centre Q of
 * W lies on the perpendicular to AC through B.
 *
 * This file holds only the geometry: no document, no window, one global.
 * The formulas are the ones in InversionInCircleAndIsoscelesCanvas.Compute and
 * ComputeInversion: with R = min(w,h)/2.5, t = |AB|/(2R),
 *   d = 2R * (t/(1+t)) * sqrt(2(1-t)),       r = 2R * t(1-t)/(1+t),
 * the centre of W is (B.x, B.y - d) and its radius is r. The inversion circle
 * is centred at B with radius R/1.5; A', C', E', U and V are its images and
 * the images of S, G, W and the two sides through E are found analytically.
 */

const InversionInCircleAndIsoscelesCore = (() => {
  // Canvas.init(): width 400, height 250, so min(w,h)/2.5 = 100.
  const WIDTH = 400;
  const HEIGHT = 250;
  const CX = WIDTH / 2;
  const CY = HEIGHT / 2;
  const R = Math.min(WIDTH, HEIGHT) / 2.5;
  // init(): B starts at cx + R/5, i.e. 0.6 of the way from A to C.
  const START_T = 0.6;
  // Compute(): NoDraw when B is not strictly between A and C. The handle is
  // kept just inside that interval so the picture always has a configuration.
  const GAP = 2;
  const MIN_T = GAP / (2 * R);
  const EPS = 1e-9;

  const clampT = (t) => {
    if (!Number.isFinite(t)) return START_T;
    return Math.max(MIN_T, Math.min(1 - MIN_T, t));
  };

  /** Plain data: the fraction of AC where B sits. */
  function start(options) {
    const t = options && options.t !== undefined ? options.t : START_T;
    return { t: clampT(t) };
  }

  function setT(state, t) {
    return { t: clampT(t) };
  }

  function fractionAtX(x) {
    return clampT((x - (CX - R)) / (2 * R));
  }

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;

  /** The whole original configuration, in board units (y grows downwards). */
  function geometry(state) {
    const t = clampT(state && state.t);
    const bx = CX - R + 2 * R * t;
    const O = { x: CX, y: CY };
    const A = { x: CX - R, y: CY };
    const B = { x: bx, y: CY };
    const C = { x: CX + R, y: CY };
    const a = Math.abs(bx - A.x);
    const b = Math.abs(C.x - bx);
    const u = (bx - CX) / R;

    // Compute(): G is the circle with diameter AB.
    const midR = a / 2;
    const mid = { center: { x: A.x + midR, y: A.y }, radius: midR };

    // Compute(): E is the intersection of the vertical line through the
    // midpoint of BC with S, above the diameter (the drawing shows E above).
    const D = { x: (B.x + C.x) / 2, y: B.y };
    const E = { x: D.x, y: CY - Math.sqrt(Math.max(0, R * R - (D.x - CX) * (D.x - CX))) };

    // Compute(), literally in bytecode order: sqrt(2*(1-t)) * t/(1+t) * AC.
    const param = midR / R;
    const drop = 2 * R * (param / (1 + param)) * Math.sqrt(2 * (1 - param));
    const q = 2 * R * param * (1 - param) / (1 + param);
    const small = { center: { x: B.x, y: B.y - drop }, radius: q };

    // init()/Compute(): the inversion circle is rebuilt around the current B.
    const inv = { center: { x: B.x, y: B.y }, radius: R / 1.5 };

    return {
      t: t, R: R, O: O, A: A, B: B, C: C, D: D, E: E,
      big: { center: O, radius: R },
      mid: mid,
      small: small,
      inversion: inv,
      a: a, b: b, u: u,
      parameter: param,
      drop: drop,
      radius: q,
    };
  }

  /** Inversion of a point in the circle (center, radius). */
  function invertPoint(inv, p) {
    const dx = p.x - inv.center.x, dy = p.y - inv.center.y;
    const d2 = dx * dx + dy * dy;
    const k = inv.radius * inv.radius / d2;
    return { x: inv.center.x + k * dx, y: inv.center.y + k * dy };
  }

  /**
   * Inversion of a circle. A circle through the centre becomes a line; every
   * other circle becomes a circle. The result is {kind:"circle",center,radius}
   * or {kind:"line",a,b} with a,b two points on the image line.
   */
  function invertCircle(inv, circle, span) {
    const dx = circle.center.x - inv.center.x;
    const dy = circle.center.y - inv.center.y;
    const d2 = dx * dx + dy * dy;
    const r = circle.radius;
    const rho2 = inv.radius * inv.radius;
    if (Math.abs(d2 - r * r) < EPS * Math.max(1, r * r)) {
      // G passes through B; its image is the line perpendicular to BC that
      // touches the image of S at A'.
      const nx = dx / r, ny = dy / r;
      const off = rho2 / (2 * r);
      const half = span || 2 * R;
      const base = { x: inv.center.x + off * nx, y: inv.center.y + off * ny };
      return {
        kind: "line",
        a: { x: base.x + half * ny, y: base.y - half * nx },
        b: { x: base.x - half * ny, y: base.y + half * nx },
        offset: off,
        normal: { x: nx, y: ny },
      };
    }
    const den = d2 - r * r;
    return {
      kind: "circle",
      center: { x: inv.center.x + rho2 * dx / den, y: inv.center.y + rho2 * dy / den },
      radius: Math.abs(rho2 * r / den),
    };
  }

  /** Inversion of a line through a and b; a line through B stays a line. */
  function invertLine(inv, a, b, span) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const n = { x: -dy / len, y: dx / len };
    const signed = dot(n, { x: a.x - inv.center.x, y: a.y - inv.center.y });
    if (Math.abs(signed) < EPS) return { kind: "line", a: a, b: b };
    const off = inv.radius * inv.radius / (2 * signed);
    return {
      kind: "circle",
      center: { x: inv.center.x + off * n.x, y: inv.center.y + off * n.y },
      radius: Math.abs(off),
    };
  }

  /** Where the line through p,q crosses the vertical line x = x0. */
  function pointAtX(p, q, x0) {
    const dx = q.x - p.x;
    if (Math.abs(dx) < EPS) return { x: x0, y: p.y };
    return { x: x0, y: p.y + (q.y - p.y) * (x0 - p.x) / dx };
  }

  /**
   * ComputeInversion(): the image of every object the five proof steps use.
   * A', C', E' are inverses of A, C, E; U is G' meet E'B; V is the centre of
   * W'; L is the centre of S'.
   */
  function inversion(state) {
    const g = geometry(state);
    const inv = g.inversion;
    const Ap = invertPoint(inv, g.A);
    const Cp = invertPoint(inv, g.C);
    const Ep = invertPoint(inv, g.E);
    const bigImage = invertCircle(inv, g.big);
    const midImage = invertCircle(inv, g.mid);
    const smallImage = invertCircle(inv, g.small);
    const ceImage = invertLine(inv, g.C, g.E);
    const beImage = invertLine(inv, g.B, g.E);
    const U = pointAtX(g.B, g.E, Ap.x);
    return {
      Ap: Ap, Cp: Cp, Ep: Ep,
      U: U,
      V: smallImage.kind === "circle" ? smallImage.center : null,
      L: bigImage.kind === "circle" ? bigImage.center : null,
      rho: inv.radius,
      inversion: inv,
      bigImage: bigImage,
      midImage: midImage,
      smallImage: smallImage,
      beImage: beImage,
      ceImage: ceImage,
    };
  }

  /** Numbers printed beside the picture and checked in the logic test. */
  function measurements(state) {
    const g = geometry(state);
    const q = g.small.center;
    const lineDist = Math.abs((g.E.x - g.B.x) * (q.y - g.B.y) -
      (g.E.y - g.B.y) * (q.x - g.B.x)) / dist(g.B, g.E);
    return {
      // The exact claim: QB is perpendicular to AC.
      offset: q.x - g.B.x,
      // W touches S internally, G externally, and BE.
      toS: dist(q, g.O),
      sGap: Math.abs(dist(q, g.O) - (g.R - g.radius)),
      toG: dist(q, g.mid.center),
      gGap: Math.abs(dist(q, g.mid.center) - (g.mid.radius + g.radius)),
      lineDist: lineDist,
      lineGap: Math.abs(lineDist - g.radius),
      // BCE is isosceles by construction.
      be: dist(g.B, g.E),
      ce: dist(g.C, g.E),
      eGap: Math.abs(dist(g.B, g.E) - dist(g.C, g.E)),
    };
  }

  /** Compact, JSON-safe position for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    const round = (v) => Number(v.toFixed(6));
    return {
      t: round(g.t),
      B: { x: round(g.B.x), y: round(g.B.y) },
      Q: { x: round(g.small.center.x), y: round(g.small.center.y) },
      radius: round(g.radius),
      offset: round(g.small.center.x - g.B.x),
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, CX: CX, CY: CY, R: R,
    START_T: START_T, MIN_T: MIN_T, MAX_T: 1 - MIN_T, EPS: EPS,
    start: start, setT: setT, clampT: clampT, fractionAtX: fractionAtX,
    geometry: geometry, invertPoint: invertPoint, invertCircle: invertCircle,
    invertLine: invertLine, pointAtX: pointAtX, inversion: inversion,
    measurements: measurements, position: position,
    dist: dist, dot: dot,
  };
})();
