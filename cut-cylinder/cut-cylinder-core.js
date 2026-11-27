"use strict";

/*
 * Cut the Cylinder — Alexander Bogomolny's CutCylinder applet, in plain maths.
 *
 * The Java 3D applet created a cylinder of radius 6 and height 18 (bytecode:
 * fstore 9 = 6.0f; new Cylinder(6.0f, 3.0f * 6.0f)) and a CTKPlane of size 20.
 * The mouse rotated and translated either object; the radio buttons chose
 * "separate" or "combined" motion and a "transparent" or "opaque" plane. It
 * did no classifying at all: the page states that the sections are circles,
 * ellipses and parallel lines that may coalesce.
 *
 * This core works in the cylinder's own coordinates. The axis is x, the round
 * side is y^2 + z^2 = R^2 with |x| <= H/2. A plane whose normal makes tilt
 * beta with the axis, at signed distance d from the centre, has normal
 * n = (cos beta, sin beta, 0) and equation n . P = d. In plane coordinates
 * P(u, v) = d n + u(-sin beta, cos beta, 0) + v(0, 0, 1) the cut satisfies
 *
 *     (cos(beta) u + d sin(beta))^2 + v^2 = R^2.
 *
 * So beta = 0 gives a circle, 0 < beta < 90 an ellipse, and beta = 90 gives
 * v = +/- sqrt(R^2 - d^2): two lines parallel to the axis, one when |d| = R.
 * A plane that misses the finite cylinder has no visible section.
 *
 * No document, no window, no storage: one global, CutCylinderCore. Positions
 * are plain data; every function takes a position and returns a new one.
 * Nothing can be won or lost — this is an illustration, not a game.
 */
const CutCylinderCore = (() => {
  // From the applet's bytecode and CTKPlane(alColor, 20).
  const RADIUS = 6;                 // fstore 9 = 6.0f
  const HEIGHT = 18;                // 3.0f * fload 9
  const HALF_HEIGHT = HEIGHT / 2;
  const PLANE_SIZE = 20;            // CTKPlane(color, 20)
  const TILT_STEP = 1;              // degrees, for the keyboard and sliders
  const MIN_TILT = 0;
  const MAX_TILT = 90;
  const MIN_OFFSET = -12;
  const MAX_OFFSET = 12;
  const DEFAULT_TILT = 30;          // the applet's first cylinder rotation: pi/6
  const DEFAULT_OFFSET = 2;
  const EPS = 1e-9;

  const PI = Math.PI;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const radians = (deg) => (deg * PI) / 180;
  const degrees = (rad) => (rad * 180) / PI;
  const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? EPS : eps);

  /** The position a new picture starts from. Options may override the numbers. */
  function start(options) {
    const o = options || {};
    const num = (v, fallback, lo, hi) =>
      Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
    return {
      tilt: num(o.tilt, DEFAULT_TILT, MIN_TILT, MAX_TILT),
      offset: num(o.offset, DEFAULT_OFFSET, MIN_OFFSET, MAX_OFFSET),
      transparent: o.transparent === undefined ? true : !!o.transparent,
      linked: o.linked === undefined ? false : !!o.linked,
    };
  }

  function setTilt(state, value) {
    if (!Number.isFinite(value)) return state;
    return Object.assign({}, state, { tilt: clamp(value, MIN_TILT, MAX_TILT) });
  }

  function setOffset(state, value) {
    if (!Number.isFinite(value)) return state;
    return Object.assign({}, state, { offset: clamp(value, MIN_OFFSET, MAX_OFFSET) });
  }

  function toggleTransparent(state) {
    return Object.assign({}, state, { transparent: !state.transparent });
  }

  /** In the applet this attaches the plane to the cylinder's branch group. */
  function toggleLinked(state) {
    return Object.assign({}, state, { linked: !state.linked });
  }

  /** The four cuts named on the page, plus the tangent and reset pictures. */
  function preset(state, name) {
    if (name === "circle") return setOffset(setTilt(state, 0), DEFAULT_OFFSET);
    if (name === "ellipse") return setOffset(setTilt(state, 30), DEFAULT_OFFSET);
    if (name === "lines") return setOffset(setTilt(state, 90), 2);
    if (name === "touch") return setOffset(setTilt(state, 90), RADIUS);
    if (name === "reset") return start({ transparent: state.transparent, linked: state.linked });
    return state;
  }

  /** The geometric family, before asking whether the finite cylinder is hit. */
  function analyse(state) {
    const tilt = state.tilt;
    const d = state.offset;
    const b = radians(tilt);
    const c = Math.cos(b), s = Math.sin(b);
    const alongAxis = Math.abs(c) < EPS; // tilt = 90 degrees
    let family, gap = 0;
    if (alongAxis) {
      const dist = Math.abs(d);
      family = dist < RADIUS - EPS ? "lines" : dist <= RADIUS + EPS ? "line" : "none";
      gap = 2 * Math.sqrt(Math.max(0, RADIUS * RADIUS - d * d));
    } else {
      family = tilt === 0 ? "circle" : "ellipse";
    }
    const centerU = alongAxis ? 0 : -d * s / c;
    const semiU = alongAxis ? Infinity : RADIUS / c;
    const semiV = RADIUS;
    /* The plane crosses the axis at x = d / cos(beta); the oval reaches
       R tan(beta) either side of that point. */
    const centerX = alongAxis ? 0 : d / c;
    const xSpread = alongAxis ? HALF_HEIGHT : RADIUS * Math.tan(b);
    const visible = family === "none" ? false
      : alongAxis ? true
        : centerX - xSpread <= HALF_HEIGHT + EPS && centerX + xSpread >= -HALF_HEIGHT - EPS;
    return {
      tilt: tilt, offset: d, radius: RADIUS, halfHeight: HALF_HEIGHT,
      cos: c, sin: s, alongAxis: alongAxis, family: family, visible: visible,
      centerU: centerU, centerX: centerX, semiU: semiU, semiV: semiV,
      xSpread: xSpread, gap: gap,
      foot: { x: d * c, y: d * s, z: 0 },
    };
  }

  /** Put a point of the plane's own (u, v) grid back into cylinder space. */
  function toSpace(state, uv) {
    const b = radians(state.tilt);
    const c = Math.cos(b), s = Math.sin(b);
    return {
      x: state.offset * c - uv.u * s,
      y: state.offset * s + uv.u * c,
      z: uv.v,
    };
  }

  /**
   * Polylines in plane coordinates (u, v). A circle or ellipse is one closed
   * polyline, clipped to the finite cylinder's length; a plane along the axis
   * gives one or two straight lines from x = -H/2 to x = +H/2.
   */
  function sectionPoints(state, resolution) {
    const a = analyse(state);
    if (!a.visible) return [];
    if (a.alongAxis) {
      const v = Math.sqrt(Math.max(0, RADIUS * RADIUS - state.offset * state.offset));
      const lines = [];
      if (v > EPS) lines.push([{ u: -HALF_HEIGHT, v: -v }, { u: HALF_HEIGHT, v: -v }]);
      lines.push([{ u: -HALF_HEIGHT, v: v }, { u: HALF_HEIGHT, v: v }]);
      return lines;
    }
    const n = Math.max(24, resolution || 160);
    /* x(t) = centerX - xSpread cos(t). Solve the end limits for cos(t)
       instead of sampling blindly: near a parallel cut the visible arc can
       be less than a degree wide. It appears once or twice around the oval. */
    const intervals = [];
    if (a.xSpread <= EPS) {
      intervals.push([0, 2 * PI]);
    } else {
      const lo = clamp((a.centerX - HALF_HEIGHT) / a.xSpread, -1, 1);
      const hi = clamp((a.centerX + HALF_HEIGHT) / a.xSpread, -1, 1);
      if (lo > hi) return [];
      if (near(lo, -1) && near(hi, 1, 1e-8)) {
        intervals.push([0, 2 * PI]);
      } else {
        const t0 = Math.acos(hi), t1 = Math.acos(lo);
        intervals.push([t0, t1]);
        if (t0 > EPS) intervals.push([2 * PI - t1, 2 * PI - t0]);
      }
    }
    const lines = [];
    for (const [t0, t1] of intervals) {
      const count = Math.max(2, Math.ceil((n * (t1 - t0)) / (2 * PI)));
      const pts = [];
      for (let i = 0; i <= count; i++) {
        const t = t0 + ((t1 - t0) * i) / count;
        pts.push({
          u: a.centerU + a.semiU * Math.cos(t),
          v: a.semiV * Math.sin(t),
        });
      }
      if (pts.length > 1) lines.push(pts);
    }
    return lines;
  }

  /**
   * The cutting line in the side view (cylinder axis horizontal): cos(tilt) x
   * + sin(tilt) y = d, clipped to a rectangle. Two (x, y) points or null.
   */
  function planeSegment(state, box) {
    const b = box || { xMin: -12, xMax: 12, yMin: -9, yMax: 9 };
    const a = analyse(state);
    const foot = { x: a.foot.x, y: a.foot.y };
    const dir = { x: -a.sin, y: a.cos }; // along the plane, in the side view
    let lo = -Infinity, hi = Infinity;
    const slabs = [
      [foot.x, dir.x, b.xMin, b.xMax],
      [foot.y, dir.y, b.yMin, b.yMax],
    ];
    for (const [start, delta, min, max] of slabs) {
      if (Math.abs(delta) < EPS) {
        if (start < min - EPS || start > max + EPS) return null;
        continue;
      }
      let t0 = (min - start) / delta, t1 = (max - start) / delta;
      if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp; }
      lo = Math.max(lo, t0);
      hi = Math.min(hi, t1);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return null;
    return [
      { x: foot.x + dir.x * lo, y: foot.y + dir.y * lo },
      { x: foot.x + dir.x * hi, y: foot.y + dir.y * hi },
    ];
  }

  /** A short status line; the algebra belongs in the page's maths section. */
  function describe(state) {
    const a = analyse(state);
    if (!a.visible) {
      return { title: "No section", text: "The plane misses the cylinder." };
    }
    if (a.family === "circle") {
      return {
        title: "Circle",
        text: "The plane is straight across the cylinder, so the cut is a circle of radius 6.",
      };
    }
    if (a.family === "ellipse") {
      return {
        title: "Ellipse",
        text: `The plane leans ${state.tilt.toFixed(1)}\u00b0 from straight across, so the circle stretches into an ellipse.`,
      };
    }
    if (a.family === "line") {
      return {
        title: "One line",
        text: "The plane runs along the cylinder and just touches its side: the two lines have joined into one.",
      };
    }
    const gap = a.gap.toFixed(1);
    return {
      title: "Two parallel lines",
      text: `The plane runs along the cylinder's axis. It cuts two lines ${gap} units apart; slide it out to make them join.`,
    };
  }

  return {
    PI: PI, RADIUS: RADIUS, HEIGHT: HEIGHT, HALF_HEIGHT: HALF_HEIGHT,
    PLANE_SIZE: PLANE_SIZE, TILT_STEP: TILT_STEP,
    MIN_TILT: MIN_TILT, MAX_TILT: MAX_TILT,
    MIN_OFFSET: MIN_OFFSET, MAX_OFFSET: MAX_OFFSET,
    DEFAULT_TILT: DEFAULT_TILT, DEFAULT_OFFSET: DEFAULT_OFFSET,
    clamp: clamp, radians: radians, degrees: degrees,
    start: start, setTilt: setTilt, setOffset: setOffset,
    toggleTransparent: toggleTransparent, toggleLinked: toggleLinked,
    preset: preset, analyse: analyse, toSpace: toSpace,
    sectionPoints: sectionPoints, planeSegment: planeSegment, describe: describe,
  };
})();
