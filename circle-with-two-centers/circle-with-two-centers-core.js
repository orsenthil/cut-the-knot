"use strict";

/*
 * A Circle With Two Centers, from Alexander Bogomolny's applet
 * CircleWithTwoCenters (the Fallacies section of cut-the-knot.org).
 *
 * Pick an angle BAC. At B and at C erect lines that look perpendicular to AB
 * and AC; they meet at D. Draw the circle through B, C and D. It meets AB again
 * at E and AC again at F. Both angles DBE and DCF look right, so DE and DF look
 * like diameters: the midpoints of DE and DF look like two different centres
 * of one circle. The trick is in the drawing: in "cheat" mode the two lines are
 * tilted by the applet's own factor (1 - eps)*(2*eps)/pi times the angle at A,
 * so they are NOT quite perpendicular. With true perpendiculars both E and F
 * coincide with A, both "centres" are the midpoint of AD, and there is only one
 * centre - exactly the explanation on the page.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CircleWithTwoCentersCore. The position is plain data
 * (the three draggable points, three display options and two counters), so it
 * can be saved and handed to the tutor as it is. Functions return new
 * positions; they never change the one they are given.
 */
const CircleWithTwoCentersCore = (() => {
  const EPS = 0.4; // the applet's fuzz factor, eps = 0.4
  const W = 600;   // coordinate space of the board (its viewBox), in "pixels"
  const H = 400;

  // The starting angle: A is on the left, B lower right, C upper right. Both
  // rays slope, so in cheat mode BOTH perpendiculars are visibly tilted.
  const DEFAULT = {
    A: { x: 90, y: 300 },
    B: { x: 330, y: 340 },
    C: { x: 310, y: 80 },
  };
  const POINTS = ["A", "B", "C"];
  const OPTIONS = ["cheat", "showNames", "showHint"];

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function copy(p) {
    return { x: p.x, y: p.y };
  }

  function sqDist(p, q) {
    const dx = p.x - q.x;
    const dy = p.y - q.y;
    return dx * dx + dy * dy;
  }

  function dist(p, q) {
    return Math.sqrt(sqDist(p, q));
  }

  function midpoint(p, q) {
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }

  /** GeoSDoub.ComputeAngle(p, q, r): the angle at q, in radians. */
  function angleAt(p, q, r) {
    const a = sqDist(q, p);
    const b = sqDist(q, r);
    const c = sqDist(p, r);
    const den = 2 * Math.sqrt(a) * Math.sqrt(b);
    if (!den) return NaN;
    return Math.acos(clamp((a + b - c) / den, -1, 1));
  }

  /** GeoSDoub.Intersect of the lines p0-p1 and p2-p3 (NaN point if parallel). */
  function intersect(p0, p1, p2, p3) {
    const a1 = p0.y - p1.y;
    const b1 = p1.x - p0.x;
    const c1 = p0.x * p1.y - p0.y * p1.x;
    const a2 = p2.y - p3.y;
    const b2 = p3.x - p2.x;
    const c2 = p2.x * p3.y - p2.y * p3.x;
    const den = a1 * b2 - a2 * b1;
    // The applet treats a denominator under one pixel as parallel. Keeping
    // that guard here also stops a near-flat angle from producing a point at
    // a million miles away when the three dragged points are almost collinear.
    if (!Number.isFinite(den) || Math.abs(den) < 1) {
      return { x: NaN, y: NaN };
    }
    return {
      x: (b1 * c2 - b2 * c1) / den,
      y: (c1 * a2 - c2 * a1) / den,
    };
  }

  /** GeoSDoub.FindCircumcenter: intersection of two perpendicular bisectors. */
  function circumcenter(p0, p1, p2) {
    const m1 = midpoint(p0, p1);
    const m2 = midpoint(p1, p2);
    const n1 = { x: m1.x + (p1.y - p0.y), y: m1.y - (p1.x - p0.x) };
    const n2 = { x: m2.x + (p2.y - p1.y), y: m2.y - (p2.x - p1.x) };
    return intersect(m1, n1, m2, n2);
  }

  /** GetCircle: centre is the circumcenter, radius the mean of the three radii. */
  function circleFrom3(p0, p1, p2) {
    const c = circumcenter(p0, p1, p2);
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
    const r = (dist(c, p0) + dist(c, p1) + dist(c, p2)) / 3;
    return Number.isFinite(r) && r > 0 ? { x: c.x, y: c.y, r } : null;
  }

  /** GeoSDoub.Intersect(DoubLine, DoubCircle): the two crossings of a line. */
  function lineCircle(p0, p1, circle) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const fx = p0.x - circle.x;
    const fy = p0.y - circle.y;
    const a = dx * dx + dy * dy;
    if (!a) return null;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circle.r * circle.r;
    const disc = b * b - 4 * a * c;
    if (!Number.isFinite(disc) || disc < 0) return null;
    const s = Math.sqrt(disc);
    const t1 = (-b - s) / (2 * a);
    const t2 = (-b + s) / (2 * a);
    return [
      { x: p0.x + t1 * dx, y: p0.y + t1 * dy },
      { x: p0.x + t2 * dx, y: p0.y + t2 * dy },
    ];
  }

  /** GeoSDoub.Other: of two crossings, the one that is not the given point. */
  function other(pts, p) {
    if (!pts) return null;
    return dist(pts[0], p) >= dist(pts[1], p) ? pts[0] : pts[1];
  }

  /** The position a new exploration starts from. */
  function start(options) {
    const o = options || {};
    return {
      A: o.A ? { x: o.A.x, y: o.A.y } : copy(DEFAULT.A),
      B: o.B ? { x: o.B.x, y: o.B.y } : copy(DEFAULT.B),
      C: o.C ? { x: o.C.x, y: o.C.y } : copy(DEFAULT.C),
      cheat: o.cheat !== false,       // the page's first applet uses cheat=1
      showNames: o.showNames !== false,
      showHint: !!o.showHint,
      moves: 0,
      toggles: 0,
    };
  }

  /** The three points the player can drag. */
  function legalMoves() {
    return POINTS.slice();
  }

  /** The position after dragging one of the three points, or null if refused. */
  function move(state, m) {
    if (!m || POINTS.indexOf(m.point) < 0) return null;
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
    const next = Object.assign({}, state);
    next[m.point] = { x: clamp(m.x, 0, W), y: clamp(m.y, 0, H) };
    next.moves = state.moves + 1;
    return next;
  }

  /** A small arrow-key step of one point: keeps the same clamping as drag. */
  function nudge(state, point, dx, dy) {
    const p = state[point];
    if (!p) return null;
    return move(state, { point, x: p.x + dx, y: p.y + dy });
  }

  /** Set the checkboxes. Toggling cheat counts as comparing the two drawings. */
  function setOptions(state, opts) {
    const next = Object.assign({}, state);
    let toggled = false;
    OPTIONS.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(opts, k)) {
        const v = !!opts[k];
        if (k === "cheat" && v !== state.cheat) toggled = true;
        next[k] = v;
      }
    });
    if (toggled) next.toggles = state.toggles + 1;
    return next;
  }

  /** Put the three points back, keeping the display options and the counters. */
  function reset(state) {
    const fresh = start({
      cheat: state.cheat,
      showNames: state.showNames,
      showHint: state.showHint,
    });
    fresh.moves = state.moves;
    fresh.toggles = state.toggles;
    return fresh;
  }

  /** A demo has no win or loss; it is finished once it has been explored. */
  function result(state) {
    return state.moves > 0 && state.toggles > 0 ? "done" : null;
  }

  /**
   * The whole construction, transcribed from Canvas.Compute(). Positions that
   * cannot be drawn (the angle is 0 or 180 degrees, so the perpendiculars are
   * parallel, or the circle is degenerate) come back with degenerate: true.
   */
  function geometry(state) {
    const A = state.A;
    const B = state.B;
    const C = state.C;
    const angle = angleAt(A, B, C);
    const shift = state.cheat
      ? 1 + (1 - EPS) * (2 * EPS) / Math.PI * angle
      : 1;

    // The two lines that stand in for the perpendiculars at B and at C.
    const pb = { x: B.x + (B.y - A.y) * shift, y: B.y - (B.x - A.x) };
    const pc = { x: C.x - (C.y - A.y) * shift, y: C.y + (C.x - A.x) };
    const D = intersect(B, pb, C, pc);
    const bad = (p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y);
    if (bad(D)) {
      return {
        A, B, C, angle, shift, pb, pc,
        D: null, E: null, F: null, circle: null,
        centerB: null, centerC: null, degenerate: true,
      };
    }
    const circle = circleFrom3(B, C, D);
    if (!circle) {
      return {
        A, B, C, angle, shift, pb, pc, D,
        E: null, F: null, circle: null,
        centerB: null, centerC: null, degenerate: true,
      };
    }

    let E;
    let F;
    let centerB;
    let centerC;
    if (state.cheat) {
      E = other(lineCircle(A, B, circle), B);
      F = other(lineCircle(A, C, circle), C);
      centerB = E ? midpoint(D, E) : null;
      centerC = F ? midpoint(D, F) : null;
    } else {
      // The honest drawing: both second crossings are A and both midpoints
      // are the midpoint of AD (which is the circumcenter).
      E = copy(A);
      F = copy(A);
      centerB = midpoint(D, A);
      centerC = midpoint(D, A);
    }
    return {
      A, B, C, angle, shift, pb, pc, D, E, F, circle,
      centerB, centerC, degenerate: bad(E) || bad(F),
    };
  }

  return {
    start, legalMoves, move, nudge, setOptions, reset, result, geometry,
    W, H, EPS,
  };
})();
