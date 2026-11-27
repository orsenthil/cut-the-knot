"use strict";

/*
 * Circle Square Circle: the geometry behind two cut-the-knot pictures.
 *
 * The applet CircleSquareCircle draws a square A, the circle C inscribed in
 * it, a second square B inscribed in C, and the circle C2 inscribed in B. B
 * turns as a scroll bar moves (0..50 degrees, starting at 5). Its key fact is
 * that every side of every square inscribed in C is tangent to C2, because
 * the distance from the centre to such a side is always R/sqrt(2). Hence the
 * inner circle has exactly half the area of the outer one.
 *
 * The cut-the-knot page filed under this applet's name is a different picture:
 * the Gothic cupola sangaku. There a small square of side x fits under two
 * quarter circles of a square of side S, and a circle of radius r sits on it.
 * The page's claims are x = 3S/5 and r = 39S/320; both follow from two
 * Pythagorean equations and are checked below.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, CircleSquareCircleCore, so the page loads it
 * with a plain <script> and porting/check-circle-square-circle.mjs loads it in
 * Node. Positions are plain data and every function returns a new position.
 */
const CircleSquareCircleCore = (() => {
  const EPS = 1e-10;
  const ANGLE_MIN = 0;
  const ANGLE_MAX = 50;
  const ANGLE_DEFAULT = 5; // JScrollBar(VERTICAL, 5, 0, 0, 50) in the applet
  const BOARD_WIDTH = 360;
  const BOARD_HEIGHT = 260;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const point = (x, y) => ({ x: x, y: y });

  /** Distance from p to the infinite line through a and b. */
  function distanceToLine(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) return distance(p, a);
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
  }

  /* ----------------------------- the Gothic cupola (the verified page) ----- */

  /** The page's answer for a big square of side side. */
  function fit(side) {
    return { x: 3 * side / 5, r: 39 * side / 320 };
  }

  /**
   * Radius of the circle tangent to both quarter circles when the small
   * square has side x: (side/2)^2 + (x+r)^2 = (side-r)^2.
   */
  function radiusFor(side, x) {
    if (side <= 0 || x < 0 || x >= side) return 0;
    return (3 * side * side / 4 - x * x) / (2 * (side + x));
  }

  /** A cupola: bottom-left A, bottom-right B, small side x, circle radius r. */
  function cupolaStart(options) {
    const o = options || {};
    const side = o.side === undefined ? 200 : Math.max(1, Number(o.side) || 200);
    const left = o.left === undefined ? 80 : Number(o.left);
    const baseY = o.baseY === undefined ? 235 : Number(o.baseY);
    const exact = fit(side);
    return {
      left: left, baseY: baseY, side: side,
      x: o.x === undefined ? exact.x : clamp(Number(o.x) || 0, 0, side),
      r: o.r === undefined ? exact.r : clamp(Number(o.r) || 0, 0, side),
    };
  }

  /** All the named points and circles of the cupola, in board units. */
  function cupolaPoints(s) {
    const A = point(s.left, s.baseY);
    const B = point(s.left + s.side, s.baseY);
    const TL = point(s.left, s.baseY - s.side);
    const TR = point(s.left + s.side, s.baseY - s.side);
    const x0 = s.left + (s.side - s.x) / 2;
    const x1 = s.left + (s.side + s.x) / 2;
    const top = s.baseY - s.x;
    const G = point(x1, top);
    const O = point(s.left + s.side / 2, top - s.r);
    return {
      A: A, B: B, TL: TL, TR: TR, G: G, O: O,
      square: [point(x0, s.baseY), point(x1, s.baseY), point(x1, top), point(x0, top)],
      quarterLeft: { center: A, radius: s.side },
      quarterRight: { center: B, radius: s.side },
      circle: { center: O, radius: s.r },
    };
  }

  /**
   * How far the two tangencies are from holding. Zero at x = 3S/5 and
   * r = 39S/320. The corner G must lie on the left quarter circle, and the
   * circle's centre must be side - r away from A.
   */
  function cupolaErrors(s) {
    const p = cupolaPoints(s);
    return {
      corner: distance(p.A, p.G) - s.side,
      tangent: distance(p.A, p.O) - (s.side - s.r),
    };
  }

  /** Drag the upper right corner of the small square: it sets x. */
  function moveCorner(s, q) {
    const x = clamp(2 * (q.x - s.left) - s.side, 6, s.side - 6);
    return Object.assign({}, s, { x: x });
  }

  /** Drag the circle's centre: it sets r, leaving x alone. */
  function moveCircle(s, q) {
    const r = clamp(s.baseY - s.x - q.y, 1, s.side);
    return Object.assign({}, s, { r: r });
  }

  /** Drag a bottom corner: the whole picture scales, so a fit stays a fit. */
  function resize(s, side) {
    const next = clamp(Number(side), 60, 320);
    const ratio = next / s.side;
    return Object.assign({}, s, {
      side: next, x: s.x * ratio, r: s.r * ratio,
    });
  }

  /** Drag the bottom-left corner: the whole picture moves. */
  function translate(s, q) {
    return Object.assign({}, s, { left: q.x, baseY: q.y });
  }

  /** Snap to the page's exact answer, keeping the big square where it is. */
  function makeFit(s) {
    return Object.assign({}, s, fit(s.side));
  }

  /* --------------------------- the applet's own picture (the bytecode) ----- */

  /**
   * init(): cx = width/2, cy = height/2, and the radius is the integer
   * division min(width, height)/3, as in the Java bytecode.
   */
  function appletStart(options) {
    const o = options || {};
    const width = o.width === undefined ? BOARD_WIDTH : Number(o.width);
    const height = o.height === undefined ? BOARD_HEIGHT : Number(o.height);
    return {
      width: width, height: height,
      cx: width / 2, cy: height / 2,
      R: Math.floor(Math.min(width, height) / 3),
      angle: o.angle === undefined ? ANGLE_DEFAULT : clamp(Math.round(Number(o.angle)), ANGLE_MIN, ANGLE_MAX),
    };
  }

  /** Corner(cx, cy, radius, angle) from the applet: centre + radius * (cos, sin). */
  function corner(cx, cy, radius, angle) {
    return point(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }

  /** A[0..3]: the square that circumscribes C, starting top left. */
  function appletA(s) {
    return [
      point(s.cx - s.R, s.cy - s.R), point(s.cx - s.R, s.cy + s.R),
      point(s.cx + s.R, s.cy + s.R), point(s.cx + s.R, s.cy - s.R),
    ];
  }

  /** M[0..3]: the midpoints of A's sides, left, bottom, right, top. */
  function appletM(s) {
    return [
      point(s.cx - s.R, s.cy), point(s.cx, s.cy + s.R),
      point(s.cx + s.R, s.cy), point(s.cx, s.cy - s.R),
    ];
  }

  /** DoubCircle C and C2 from init(): C touches A, C2 touches every B. */
  function appletCircles(s) {
    const center = point(s.cx, s.cy);
    return {
      outer: { center: center, radius: s.R },
      inner: { center: center, radius: s.R / Math.sqrt(2) },
    };
  }

  /**
   * Compute(): B[i] = Corner(cx, cy, R, theta + i*pi/2 + pi/4), with theta
   * the scroll bar's degrees in radians. The same R for every i is why B is
   * a square inscribed in C at every angle.
   */
  function appletB(s) {
    const theta = Math.PI * s.angle / 180;
    const out = [];
    for (let i = 0; i < 4; i++) {
      out.push(corner(s.cx, s.cy, s.R, theta + i * Math.PI / 2 + Math.PI / 4));
    }
    return out;
  }

  /** The unused local h in Compute(): (A1.y - A0.y)/2/sqrt(2) = R/sqrt(2). */
  function apothem(s) {
    const A = appletA(s);
    return (A[1].y - A[0].y) / 2 / Math.sqrt(2);
  }

  /** Which scroll-bar angle would put B[0] at this point? B repeats every 90°. */
  function angleFromPoint(s, q) {
    let deg = Math.atan2(q.y - s.cy, q.x - s.cx) * 180 / Math.PI - 45;
    deg = ((deg % 90) + 90) % 90;
    if (deg > 90 - 1e-7) deg = 0; // a corner on a quadrant boundary after rounding
    return clamp(Math.round(deg), ANGLE_MIN, ANGLE_MAX);
  }

  /** Move the outer circle's centre. */
  function moveCentre(s, q) {
    return Object.assign({}, s, { cx: q.x, cy: q.y });
  }

  /** Drag one corner of A: it changes the common radius of C and C2. */
  function resizeApplet(s, q, which) {
    const i = which === undefined ? 2 : which;
    const cornerA = appletA(s)[i];
    const dx = cornerA.x - s.cx, dy = cornerA.y - s.cy;
    const along = (q.x - s.cx) * dx + (q.y - s.cy) * dy;
    const len = Math.hypot(dx, dy);
    const R = clamp(along / (len || 1), 25, s.height / 2 - 14);
    return Object.assign({}, s, { R: R });
  }

  /* ------------------------------------------------ the saved position ----- */

  /** Plain data for the player's record and the tutor. */
  function position(cupola, applet) {
    return {
      cupola: {
        left: cupola.left, baseY: cupola.baseY, side: cupola.side,
        x: cupola.x, r: cupola.r,
        error: cupolaErrors(cupola),
      },
      applet: { cx: applet.cx, cy: applet.cy, R: applet.R, angle: applet.angle },
    };
  }

  return {
    EPS: EPS, ANGLE_MIN: ANGLE_MIN, ANGLE_MAX: ANGLE_MAX, ANGLE_DEFAULT: ANGLE_DEFAULT,
    BOARD_WIDTH: BOARD_WIDTH, BOARD_HEIGHT: BOARD_HEIGHT,
    clamp: clamp, distance: distance, distanceToLine: distanceToLine,
    fit: fit, radiusFor: radiusFor, cupolaStart: cupolaStart, cupolaPoints: cupolaPoints,
    cupolaErrors: cupolaErrors, moveCorner: moveCorner, moveCircle: moveCircle,
    resize: resize, translate: translate, makeFit: makeFit,
    appletStart: appletStart, corner: corner, appletA: appletA, appletM: appletM,
    appletCircles: appletCircles, appletB: appletB, apothem: apothem,
    angleFromPoint: angleFromPoint, moveCentre: moveCentre, resizeApplet: resizeApplet,
    position: position,
  };
})();
