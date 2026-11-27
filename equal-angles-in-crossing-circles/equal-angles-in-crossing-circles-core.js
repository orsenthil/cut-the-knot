"use strict";

/*
 * Equal Chords in Crossing Circles, from Alexander Bogomolny's applet
 * EqualAnglesInCrossingCircles (cut-the-knot.org/Curriculum/Geometry/
 * EqualAnglesInCrossingCircles.shtml; the page still embeds the Java applet).
 *
 * Two circles through P and Q cross there. A, C lie on circle E and B, D on
 * circle F. AB and CD are straight lines through P that make equal angles
 * with the common chord PQ; the theorem says those two chords are equal.
 * The applet's AMoved()/DMoved() construct the four ends: reflect one end in
 * PQ, join the reflection to P, and take the second meeting with its circle.
 * Compute() redraws both circles from A,P,Q and D,P,Q and, for the hint,
 * draws through Q a line parallel to CD to get C' and D'.
 *
 * This file is only the geometry: no DOM, no storage, no global besides
 * EqualAnglesInCrossingCirclesCore. Positions are plain data so they can be
 * saved for the player's record and handed to the tutor unchanged.
 */
const EqualAnglesInCrossingCirclesCore = (() => {
  /** The SVG viewBox; the page uses the same numbers. */
  const VIEW = { width: 420, height: 280 };
  const MARGIN = 8;
  /** The applet stops drawing when any of the five defining distances is < 2. */
  const MIN_DIST = 2;
  const PARALLEL = 100;

  /** The start taken from init(): P,Q on a vertical chord, A left, D right. */
  const START = {
    P: { x: 210, y: 112 }, Q: { x: 210, y: 168 },
    A: { x: 126, y: 140 }, D: { x: 252, y: 168 },
    options: { mode: "chord", names: false, hint: false, statement: false },
    last: "A", moves: 0,
  };

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clampToBoard = (p) => ({
    x: Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
    y: Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
  });
  const copy = (p) => ({ x: p.x, y: p.y });

  /** GeoSDoub.Intersect of two lines: NaN when the determinant is < 1. */
  function lineCross(a, b, c, d) {
    const ay = a.y - b.y, bx = b.x - a.x;
    const c1 = a.x * b.y - a.y * b.x;
    const cy = c.y - d.y, dx = d.x - c.x;
    const c2 = c.x * d.y - c.y * d.x;
    const det = ay * dx - cy * bx;
    if (!Number.isFinite(det) || Math.abs(det) < 1) return null;
    return { x: (bx * c2 - dx * c1) / det, y: (c1 * cy - c2 * ay) / det };
  }

  /** GeoSDoub.FindCircumcenter, in the applet's own a,b,c order. */
  function circumcenter(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const p1 = { x: m1.x + a.y - b.y, y: m1.y + b.x - a.x };
    const p2 = { x: m2.x + c.y - b.y, y: m2.y + b.x - c.x };
    const o = lineCross(m1, p1, m2, p2);
    if (!o || !finitePoint(o)) return null;
    return o;
  }

  /** GetCircle(): the centre and the mean distance to its three points. */
  function getCircle(a, b, c) {
    const center = circumcenter(a, b, c);
    if (!center) return null;
    const radius = (dist(center, a) + dist(center, b) + dist(center, c)) / 3;
    if (!Number.isFinite(radius)) return null;
    return { center, radius };
  }

  /** The two crossings of the infinite line ab with a circle. */
  function lineCircle(a, b, circle) {
    if (!circle) return null;
    const { center: c, radius: r } = circle;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!Number.isFinite(len2) || len2 === 0) return null;
    const t = ((c.x - a.x) * dx + (c.y - a.y) * dy) / len2;
    const px = a.x + dx * t, py = a.y + dy * t;
    const h2 = r * r - ((px - c.x) ** 2 + (py - c.y) ** 2);
    if (!Number.isFinite(h2) || h2 < 0) return null;
    const h = Math.sqrt(h2 / len2);
    return [{ x: px - dx * h, y: py - dy * h }, { x: px + dx * h, y: py + dy * h }];
  }

  /** GeoSDoub.ReflectPointInLine: a mirror in the line through a and b. */
  function reflect(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!Number.isFinite(len2) || len2 === 0) return null;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: 2 * (a.x + dx * t) - p.x, y: 2 * (a.y + dy * t) - p.y };
  }

  /** The applet's Other(array, reference): skip a crossing within 3 of ref. */
  function other(crossings, ref) {
    if (!crossings || !crossings[0] || !crossings[1]) return null;
    return dist(crossings[0], ref) < 3 ? crossings[1] : crossings[0];
  }

  /** Angle at v, from GeoSDoub.ComputeAngle. */
  function angle(v, p, q) {
    const a = dist(v, p), b = dist(v, q), c = dist(p, q);
    if (!a || !b) return NaN;
    const cos = (a * a + b * b - c * c) / (2 * a * b);
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** The five distances Compute() guards, and both circumcircles. */
  function circleData(s) {
    if (![s.P, s.Q, s.A, s.D].every(finitePoint)) return null;
    if (dist(s.A, s.P) < MIN_DIST || dist(s.A, s.Q) < MIN_DIST ||
        dist(s.D, s.P) < MIN_DIST || dist(s.D, s.Q) < MIN_DIST ||
        dist(s.P, s.Q) < MIN_DIST) return null;
    const E = getCircle(s.A, s.P, s.Q);
    const F = getCircle(s.D, s.P, s.Q);
    if (!E || !F) return null;
    return { E, F };
  }

  /**
   * AMoved() when from is A (or P), DMoved() when from is D (or Q).
   * FixOtherPoint() silently leaves a point where it was when a line misses
   * its circle, so this keeps the previous value on a failed step.
   */
  function derive(s, from, circles) {
    const data = circles || circleData(s);
    if (!data) return s;
    const { E, F } = data;
    const out = { ...s };
    const fix = (a, b, circle, key) => {
      const p = other(lineCircle(a, b, circle), s.P);
      if (p) out[key] = p;
    };
    if (from === "D" || from === "Q") {
      fix(s.D, s.P, E, "C");
      const Cp = out.C;
      const reflC = reflect(Cp, s.P, s.Q);
      if (reflC) fix(reflC, s.P, F, "B");
      const reflD = reflect(s.D, s.P, s.Q);
      if (reflD) fix(reflD, s.P, E, "A");
    } else {
      fix(s.A, s.P, F, "B");
      const reflB = reflect(out.B, s.P, s.Q);
      if (reflB) fix(reflB, s.P, F, "D");
      const reflA = reflect(s.A, s.P, s.Q);
      if (reflA) fix(reflA, s.P, E, "C");
    }
    return out;
  }

  /** TranslateCD(): through Q draw the parallel of CD, then take C', D'. */
  function translateCD(s, circles, C, D) {
    if (!circles || !finitePoint(C) || !finitePoint(D)) return null;
    const near = {
      x: s.Q.x + PARALLEL * (C.x - D.x),
      y: s.Q.y + PARALLEL * (C.y - D.y),
    };
    const epic = other(lineCircle(near, s.Q, circles.E), s.Q);
    const dp = other(lineCircle(near, s.Q, circles.F), s.Q);
    if (!epic || !dp) return null;
    return { near, Cprime: epic, Dprime: dp };
  }

  /** The whole construction as plain data, for the page and the logic test. */
  function geometry(state) {
    const s = derive(state, state.last, circleData(state));
    const data = circleData(s);
    if (!data) return { valid: false, reason: "guard", E: null, F: null };
    const { E, F } = data;
    const { A, B, C, D } = s;
    if (![A, B, C, D].every(finitePoint)) {
      return { valid: false, reason: "no-crossing", E, F };
    }
    const ab = dist(A, B), cd = dist(C, D);
    if (!Number.isFinite(ab) || !Number.isFinite(cd)) {
      return { valid: false, reason: "no-crossing", E, F };
    }
    const translation = translateCD(s, data, C, D);
    const u = { x: (B.x - A.x) / ab, y: (B.y - A.y) / ab };
    const ef = { x: F.center.x - E.center.x, y: F.center.y - E.center.y };
    return {
      valid: true, reason: null, E, F,
      A, B, C, D,
      ab, cd,
      chordDiff: ab - cd,
      translation,
      cpDp: translation ? dist(translation.Cprime, translation.Dprime) : null,
      angles: {
        a: angle(s.P, A, s.Q),
        c: angle(s.P, C, s.Q),
        b: angle(s.P, B, s.Q),
        d: angle(s.P, D, s.Q),
      },
      /** Twice the projection of the centre line onto the chord direction. */
      projectionAB: 2 * (ef.x * u.x + ef.y * u.y),
      linePQ: { a: s.P, b: s.Q },
      lineEF: { a: E.center, b: F.center },
    };
  }

  function start(options) {
    const s = {
      P: copy(START.P), Q: copy(START.Q), A: copy(START.A), D: copy(START.D),
      options: { ...START.options }, last: START.last, moves: 0,
    };
    if (options) {
      for (const k of ["mode", "names", "hint", "statement"]) {
        if (k in options) s.options[k] = options[k];
      }
    }
    return derive(s, s.last);
  }

  /** Snap A/D onto their circle in "chord" mode, as RestrictToCircle does. */
  function onCircle(center, radius, p) {
    const d = dist(center, p);
    if (!d || !Number.isFinite(d)) return copy(p);
    return {
      x: center.x + (p.x - center.x) * radius / d,
      y: center.y + (p.y - center.y) * radius / d,
    };
  }

  /** Drag one of the four points. P/A re-derive from A, Q/D from D. */
  function movePoint(state, name, point) {
    if (!finitePoint(point)) return state;
    if (!["P", "Q", "A", "D"].includes(name)) return state;
    const p = clampToBoard(point);
    const data = circleData(state);
    let s = { ...state, options: { ...state.options }, moves: state.moves + 1 };
    if (name === "A" && state.options.mode === "chord" && data) {
      s.A = onCircle(data.E.center, data.E.radius, p);
    } else if (name === "D" && state.options.mode === "chord" && data) {
      s.D = onCircle(data.F.center, data.F.radius, p);
    } else {
      s[name] = p;
    }
    s.last = (name === "A" || name === "P") ? "A" : "D";
    return derive(s, s.last);
  }

  function setOption(state, name, value) {
    if (!(name in state.options)) return state;
    if (name === "mode" && value !== "chord" && value !== "circles") return state;
    const next = { ...state, options: { ...state.options } };
    next.options[name] = name === "mode" ? value : Boolean(value);
    return next;
  }

  /** An illustration has no win or loss: exploring it is the whole point. */
  function result(state) {
    return null;
  }

  return {
    VIEW, START, MIN_DIST, PARALLEL,
    start, movePoint, setOption, geometry, result,
    dist, angle, reflect, circumcenter, getCircle, lineCircle, lineCross,
    derive, translateCD, clampToBoard, onCircle,
  };
})();
