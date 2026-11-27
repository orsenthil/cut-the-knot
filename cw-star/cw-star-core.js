"use strict";

/*
 * CWStar: Alexander Bogomolny's Star Construction of Shapes of Constant Width.
 *
 * The Java applet draws an equilateral star polygon {n/d}, d = floor(n/2),
 * n = 3 + 2 * (N slider), and draws arcs of radius L about its vertices from
 * each vertex to the vertex before the next one. Those arcs bound a curve of
 * width exactly L, provided the star's sides cross and n is odd. A second,
 * wider construction uses arcs of radius L + a and fills each gap at a
 * vertex with an arc of radius a; its width is L + 2a. Pressing Start rolls
 * the curve by turning every point except one about that point, then
 * translating the result back to the same bounding lines.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CwStarCore, so a page loads it with a plain
 * <script> and porting/check-cw-star.mjs loads it in Node. Positions are plain
 * data: option values and point coordinates in viewBox units.
 */
const CwStarCore = (() => {
  const PI = Math.PI;
  const DEGREES = 180 / PI;
  const EAST = 200; // the applet probes with points 200 units east/south
  const PROBE = 100;
  const VIEW = { width: 500, height: 300 };

  /* The four AWT scrollbars: value, minimum, maximum, initial value. */
  const LIMITS = Object.freeze({
    steps: { min: 0, max: 10, initial: 1 },   // N : 5, 7, 9, ... 23 vertices
    length: { min: 50, max: 310, initial: 100 },
    addOn: { min: 0, max: 160, initial: 40 },
    speed: { min: 0, max: 22, initial: 5 },
  });

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mod = (a, b) => ((a % b) + b) % b;
  const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const roundDeg = (radians) => Math.round(radians * DEGREES);
  const copyPoints = (points) => points.map((p) => ({ x: p.x, y: p.y }));

  /* GeoSDoub.FindOrientation: +1 for a clockwise turn on the screen. */
  function orientation(o, p, q) {
    const cross = (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
    return cross > 0 ? 1 : -1;
  }

  /*
   * GeoSDoub.ComputeSignedAngle, straight from its bytecode. The 0.99 guard
   * is kept even though its dot product is always non-negative in the applet
   * (it squares p - o twice), so the early PI return is never taken.
   */
  function signedAngle(o, p, q) {
    const cos = ((sqDist(o, p) + sqDist(o, q) - sqDist(p, q)) / 2) / dist(o, p) / dist(o, q);
    const angle = Math.acos(clamp(cos, -1, 1));
    if (angle > 0.99 && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < 0) return PI;
    return orientation(o, p, q) === 1 ? angle : -angle;
  }

  /** GeoSDoub.Rotate(centre, point, radians, 1). */
  function rotate(centre, p, radians) {
    const c = Math.cos(radians), s = Math.sin(radians);
    const dx = p.x - centre.x, dy = p.y - centre.y;
    return { x: centre.x + c * dx - s * dy, y: centre.y + s * dx + c * dy };
  }

  function stepsToN(steps) { return 3 + 2 * steps; }

  /** The applet's CreateBasePolygon, including its two small degeneracy fixes. */
  function verticesFor(steps, length, view) {
    const n = stepsToN(steps);
    const d = Math.floor(n / 2);
    const step = (2 * PI * d) / n;
    const radius = length / (2 * Math.sin(step / 2));
    const cx = view.width / 2, cy = view.height / 2;
    const points = [];
    for (let i = 0; i < n; i++) {
      points.push({
        x: cx + radius * Math.cos(step * i),
        y: cy + radius * Math.sin(step * i),
      });
    }
    if (n === 3) points[0].y += 0.1; // unreachable from the slider, but in the code
    points[Math.floor(n / 2)].x += 1;
    return points;
  }

  /** A fresh position. Changing Length or N also resets the star, as in the applet. */
  function start(options) {
    const o = options || {};
    const steps = clamp(Math.round(o.steps === undefined ? LIMITS.steps.initial : o.steps),
      LIMITS.steps.min, LIMITS.steps.max);
    const length = clamp(o.length === undefined ? LIMITS.length.initial : o.length,
      LIMITS.length.min, LIMITS.length.max);
    const addOn = clamp(o.addOn === undefined ? LIMITS.addOn.initial : o.addOn,
      LIMITS.addOn.min, LIMITS.addOn.max);
    const speed = clamp(o.speed === undefined ? LIMITS.speed.initial : o.speed,
      LIMITS.speed.min, LIMITS.speed.max);
    const view = o.view || VIEW;
    return { steps, length, addOn, speed, view: { ...view }, points: verticesFor(steps, length, view) };
  }

  function setOption(state, name, value) {
    const next = { ...state, view: { ...state.view } };
    if (name === "steps" || name === "length") {
      next[name] = clamp(Math.round(value), LIMITS[name].min, LIMITS[name].max);
      next.points = verticesFor(next.steps, next.length, next.view);
      delete next.currentIndex;
      delete next.angleToGo;
      delete next.xFixed;
      delete next.yFixed;
    } else if (name === "addOn" || name === "speed") {
      next[name] = clamp(Math.round(value), LIMITS[name].min, LIMITS[name].max);
    } else {
      return state;
    }
    return next;
  }

  /** RestrictToCircle: the dragged vertex stays one side-length from its next neighbour. */
  function restrictToCircle(centre, radius, p) {
    const dx = p.x - centre.x, dy = p.y - centre.y;
    const d = Math.hypot(dx, dy);
    if (!d) return null;
    return { x: centre.x + (radius * dx) / d, y: centre.y + (radius * dy) / d };
  }

  /*
   * MouseEvent handling for a vertex i: UpdateLocation restricts i to the
   * circle about i+1, then ManualUpdate places i-1 from the midpoint of i
   * and i-2 so both sides meeting at i-1 keep length L.
   */
  function movePoint(state, index, target) {
    const n = state.points.length;
    const i = ((Math.round(index) % n) + n) % n;
    const points = copyPoints(state.points);
    const restricted = restrictToCircle(points[(i + 1) % n], state.length, target);
    if (!restricted) return state;
    points[i] = restricted;
    const prev = (i + n - 1) % n, before = (i + n - 2) % n;
    const mid = { x: (points[i].x + points[before].x) / 2, y: (points[i].y + points[before].y) / 2 };
    const radius = dist(mid, points[before]);
    const height = Math.sqrt(state.length * state.length - radius * radius);
    if (!radius || !Number.isFinite(height)) return state;
    points[prev] = {
      x: mid.x - ((points[before].y - mid.y) * height) / radius,
      y: mid.y + ((points[before].x - mid.x) * height) / radius,
    };
    return { ...state, points };
  }

  /*
   * CWShapeRotation.DrawShape: start and sweep, in whole Java degrees, of the
   * arc about vertex i. Negative sweeps are clockwise on the screen. The
   * 90/45-degree correction resolves ties when a probe ray is nearly aligned.
   */
  function arcAngles(points, i) {
    const n = points.length;
    const p = points[(i - 1 + n) % n], q = points[i], r = points[(i + 1) % n];
    const east = { x: q.x + EAST, y: q.y };
    const south = { x: q.x, y: q.y + EAST };
    const start = mod(-roundDeg(signedAngle(q, east, r)) + 720, 360);
    const sweep = -roundDeg(signedAngle(q, r, p));
    const southStart = mod(-roundDeg(signedAngle(q, south, r)) - 90 + 720, 360);
    let chosen = start;
    if (chosen !== southStart) {
      const diagonal = { x: q.x + EAST, y: q.y + EAST };
      const diagonalStart = mod(-roundDeg(signedAngle(q, diagonal, r)) - 45 + 720, 360);
      if (southStart === diagonalStart) chosen = southStart;
    }
    return { start: chosen, sweep };
  }

  /** Every arc the applet draws at one position, with both radii when AddOn > 0. */
  function arcs(state) {
    const { points, length, addOn } = state;
    return points.map((q, i) => {
      const { start, sweep } = arcAngles(points, i);
      const p = points[(i - 1 + points.length) % points.length];
      const r = points[(i + 1) % points.length];
      const t = addOn / length;
      return {
        index: i, centre: q, start, sweep,
        radius: length,
        outerRadius: length + addOn,
        gapRadius: addOn,
        gapStart: start + 180,
        extensionPrev: { x: q.x + (q.x - p.x) * t, y: q.y + (q.y - p.y) * t },
        extensionNext: { x: q.x + (q.x - r.x) * t, y: q.y + (q.y - r.y) * t },
      };
    });
  }

  /** A point of one arc. Java drawArc uses angles going counter-clockwise on screen. */
  function arcPoint(arc, radius, degrees) {
    const a = degrees / DEGREES;
    return { x: arc.centre.x + radius * Math.cos(a), y: arc.centre.y - radius * Math.sin(a) };
  }

  /** A dense sample of the boundary: the short arcs, or the wide arcs plus gaps. */
  function boundary(state, widened) {
    const result = [];
    for (const arc of arcs(state)) {
      const pieces = widened
        ? [[arc.outerRadius, arc.start], [arc.gapRadius, arc.gapStart]]
        : [[arc.radius, arc.start]];
      for (const [radius, start] of pieces) {
        if (radius <= 0) continue;
        const steps = Math.max(2, Math.ceil(Math.abs(arc.sweep) * 4));
        for (let k = 0; k <= steps; k++) {
          result.push(arcPoint(arc, radius, start + (arc.sweep * k) / steps));
        }
      }
    }
    return result;
  }

  /** Widths of the sampled curve in many directions; the claim is min = max. */
  function widths(points, directions) {
    let min = Infinity, max = -Infinity;
    for (let k = 0; k < directions; k++) {
      const a = (2 * PI * k) / directions;
      const ux = Math.cos(a), uy = Math.sin(a);
      let lo = Infinity, hi = -Infinity;
      for (const p of points) {
        const v = p.x * ux + p.y * uy;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      min = Math.min(min, hi - lo);
      max = Math.max(max, hi - lo);
    }
    return { min, max };
  }

  /* ---------------------------------------------------------- rolling motion */

  function lowExtremeActive(points, i, axis) {
    const n = points.length;
    const centre = points[i];
    const probe = axis === "h"
      ? { x: centre.x, y: centre.y - PROBE }
      : { x: centre.x - PROBE, y: centre.y };
    const a = signedAngle(probe, centre, points[(i - 1 + n) % n]);
    const b = signedAngle(probe, centre, points[(i + 1) % n]);
    return a * b > 0;
  }

  function extremeIndex(points, axis, wantMin) {
    let best = -1, value = wantMin ? Infinity : -Infinity;
    for (let i = 0; i < points.length; i++) {
      const v = points[i][axis];
      if ((wantMin && v < value) || (!wantMin && v > value)) { value = v; best = i; }
    }
    return { index: best, value };
  }

  /*
   * ComputeLeftLine / ComputeTopLine: where the applet draws its guide line
   * and later pins the figure while it rolls.
   */
  function guideLine(state, axis) {
    const lo = extremeIndex(state.points, axis, true);
    const hi = extremeIndex(state.points, axis, false);
    const radius = Math.round(state.length + state.addOn);
    const active = lowExtremeActive(state.points, lo.index, axis === "x" ? "v" : "h");
    const value = active ? Math.round(hi.value) - radius : Math.round(lo.value) - Math.round(state.addOn);
    return value - 1;
  }

  function computeFirstAngle(points, i) {
    const q = points[i];
    const probe = { x: q.x, y: q.y - PROBE };
    return -signedAngle(probe, q, points[(i - 1 + points.length) % points.length]);
  }

  function firstWorkingIndex(points) {
    let min = { index: -1, value: Infinity }, max = { index: -1, value: -Infinity };
    for (let i = 0; i < points.length; i++) {
      if (points[i].x < min.value) min = { index: i, value: points[i].x };
      if (points[i].x > max.value) max = { index: i, value: points[i].x };
    }
    return lowExtremeActive(points, min.index, "v") ? max.index : min.index;
  }

  function startRoll(state) {
    const i = firstWorkingIndex(state.points);
    return {
      ...state, points: copyPoints(state.points), currentIndex: i,
      angleToGo: computeFirstAngle(state.points, i),
      xFixed: guideLine(state, "x"), yFixed: guideLine(state, "y"),
    };
  }

  /** One CWShapeRotation.Rotate step, transcribed exactly. */
  function rollStep(state) {
    const rolling = state.currentIndex === undefined ? startRoll(state) : state;
    const points = copyPoints(rolling.points);
    /* The applet turns by the full increment; only the countdown is clipped. */
    const step = (rolling.speed * PI) / 180;
    const index = rolling.currentIndex;
    for (let j = 0; j < points.length; j++) {
      if (j !== index) points[j] = rotate(points[index], points[j], step);
    }
    let angleToGo = rolling.angleToGo - Math.min(rolling.angleToGo, step);
    let currentIndex = index;
    if (angleToGo <= 0) {
      currentIndex = (index + 1) % points.length;
      angleToGo = computeFirstAngle(points, currentIndex);
    }
    const next = { ...rolling, points, currentIndex, angleToGo };
    const dx = next.xFixed - guideLine(next, "x");
    const dy = next.yFixed - guideLine(next, "y");
    next.points = points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    return next;
  }

  /** The status line: a description of what the construction is showing. */
  function describe(state) {
    const n = state.points.length;
    const width = widths(boundary(state, false), 72);
    const spread = Math.abs(width.max - width.min);
    const measured = (width.min + width.max) / 2;
    let text = `${n} points, side length ${state.length}; the arcs make a shape of width about ${Math.round(measured)}`;
    if (state.addOn > 0) {
      const wide = widths(boundary(state, true), 72);
      text += `, and the wider outline about ${Math.round((wide.min + wide.max) / 2)}`;
    }
    text += ".";
    return spread < 2 ? text : `${text} (Edges differ by ${spread.toFixed(1)} after rounding to whole degrees.)`;
  }

  return {
    LIMITS, VIEW, DEGREES,
    stepsToN, signedAngle, orientation, rotate, verticesFor,
    start, setOption, restrictToCircle, movePoint,
    arcAngles, arcs, arcPoint, boundary, widths,
    lowExtremeActive, extremeIndex, guideLine, firstWorkingIndex,
    computeFirstAngle, startRoll, rollStep, describe,
  };
})();
