"use strict";

/*
 * Altitude Mirror 2 — the geometry behind Alexander Bogomolny's applet.
 *
 * A, B are the ends of a diameter of a circle; C and D lie on the same
 * semicircle. E is where AD meets BC and F is the foot of the perpendicular
 * from E to AB. The claim (Greg Markowsky) is that EF bisects angle CFD.
 *
 * The key idea used here: reflecting C and D in AB gives C' and D' on the
 * same circle. For the hexagon A D C' B C D' the Pascal points are
 * E = AD n BC, F = DC' n CD' and E' = C'B n D'A. Symmetry puts F on AB and
 * on EE', so F is the foot of the altitude, and FC and FD are mirror images
 * in AB. As a bonus the common half-angle is exactly |angle(C) - angle(D)| / 2.
 *
 * This file is pure geometry: no document, no window, no storage. It defines
 * one global so the page loads it with a plain <script> and the Node check
 * loads it with load-core.mjs. A position is plain data (angles in radians
 * and three display flags); functions never change the position they get.
 */
const AltitudeMirror2Core = (() => {
  const EPS = 1e-9;

  /* The applet preferred a 400x250 canvas and put the circle at (height,
   * height/2) with radius min(width,height)/3. The board below is its shape,
   * with the circle centred so every labelled point has room. */
  const BOARD = Object.freeze({ cx: 200, cy: 125, r: 88 });

  /* Original ranges: D in [pi/8, pi/4] on the right, C in [3pi/4, 7pi/8]
   * on the left. Dragging a handle is kept inside its half of the arc so E
   * stays inside the circle, as in the applet. */
  const C_MIN = Math.PI / 2 + 0.12;
  const C_MAX = Math.PI - 0.12;
  const D_MIN = 0.12;
  const D_MAX = Math.PI / 2 - 0.12;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Keep an angle for a named handle inside its arc. */
  function clampAngle(which, angle) {
    if (!Number.isFinite(angle)) return null;
    return which === "C" ? clamp(angle, C_MIN, C_MAX)
      : which === "D" ? clamp(angle, D_MIN, D_MAX)
        : null;
  }

  /** The applet's starting angles (the middle of each of its two ranges). */
  function randomPosition(rand) {
    const r = typeof rand === "function" ? rand : () => 0.5;
    return {
      c: 3 * Math.PI / 4 + (r() * Math.PI) / 8,
      d: Math.PI / 8 + (r() * Math.PI) / 8,
    };
  }

  /** The position a new illustration starts from. */
  function start(options) {
    const o = options || {};
    const angles = o.random ? randomPosition(o.random) : randomPosition(() => 0.5);
    return {
      c: clampAngle("C", o.c === undefined ? angles.c : o.c),
      d: clampAngle("D", o.d === undefined ? angles.d : o.d),
      names: o.names !== false,
      hint: !!o.hint,
      statement: !!o.statement,
    };
  }

  /** Moves a handle to an angle, or flips one of the three display flags. */
  function move(state, m) {
    if (!state || !m) return null;
    if ((m.which === "C" || m.which === "D") && m.angle !== undefined) {
      const a = clampAngle(m.which, m.angle);
      if (a === null) return null;
      return m.which === "C" ? { ...state, c: a } : { ...state, d: a };
    }
    if (m.which === "names" || m.which === "hint" || m.which === "statement") {
      return { ...state, [m.which]: !state[m.which] };
    }
    if (m.which === "random") {
      const p = randomPosition(m.random);
      return { ...state, c: p.c, d: p.d };
    }
    return null;
  }

  /** An illustration has no win, loss or finish. */
  function result(state) {
    return state ? null : null;
  }

  function anglePoint(cx, cy, r, a) {
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  }

  function reflectInAB(p, cy) {
    return { x: p.x, y: 2 * cy - p.y };
  }

  /** Intersection of the two infinite lines, or null when parallel. */
  function intersect(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y;
    const sx = d.x - c.x, sy = d.y - c.y;
    const det = rx * sy - ry * sx;
    if (Math.abs(det) < EPS) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / det;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  /** Foot of the perpendicular from p to the line through a and b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Angle at v between the rays to p and q, in radians. */
  function angle(v, p, q) {
    const ax = p.x - v.x, ay = p.y - v.y;
    const bx = q.x - v.x, by = q.y - v.y;
    const na = Math.hypot(ax, ay), nb = Math.hypot(bx, by);
    if (!na || !nb) return 0;
    return Math.acos(clamp((ax * bx + ay * by) / (na * nb), -1, 1));
  }

  /**
   * Every point of the construction in board units, plus the measurements
   * the page talks about. A point outside the viewBox is still returned: the
   * page clips the lines it draws.
   */
  function geometry(state, board) {
    const b = board || BOARD;
    const cx = b.cx, cy = b.cy, r = b.r;
    const A = { x: cx - r, y: cy }, B = { x: cx + r, y: cy };
    const C = anglePoint(cx, cy, r, state.c);
    const D = anglePoint(cx, cy, r, state.d);
    const Cp = reflectInAB(C, cy), Dp = reflectInAB(D, cy);

    /* E = AD n BC; F is the nearest point of AB to E; E' is E reflected. */
    const E = intersect(A, D, B, C);
    if (!E) return { A, B, C, D, Cp, Dp, valid: false };
    const F = foot(E, A, B);
    const Ep = reflectInAB(E, cy);

    /* The other two Pascal points and the apex of triangle ABS. */
    const Fp = intersect(D, Cp, C, Dp);
    const E2 = intersect(Cp, B, Dp, A);
    const S = intersect(A, C, B, D);

    return { A, B, C, D, Cp, Dp, E, F, Ep, Fp, E2, S, valid: true };
  }

  /** Measurements used by the page and checked in porting/check-*.mjs. */
  function claims(state, board) {
    const g = geometry(state, board);
    if (!g.valid) return { valid: false };
    const { A, B, C, D, E, F, Ep, Fp, E2, S } = g;
    const half = Math.abs(state.c - state.d) / 2;
    return {
      valid: true,
      angleCFE: angle(F, C, E),
      angleEFD: angle(F, E, D),
      angleCFD: angle(F, C, D),
      halfAngle: half,
      /* Pascal line: E, F and E' must be collinear. */
      pascalCross: (E.x - F.x) * (E2.y - F.y) - (E.y - F.y) * (E2.x - F.x),
      /* The reflection points and the Pascal points must coincide. */
      fpGap: Fp ? Math.hypot(Fp.x - F.x, Fp.y - F.y) : Infinity,
      e2Gap: E2 ? Math.hypot(E2.x - Ep.x, E2.y - Ep.y) : Infinity,
      /* Inscribed angles over a diameter are right angles. */
      acb: (C.x - A.x) * (C.x - B.x) + (C.y - A.y) * (C.y - B.y),
      adb: (D.x - A.x) * (D.x - B.x) + (D.y - A.y) * (D.y - B.y),
      /* E is the orthocenter of ABS: AD ⟂ BD, BC ⟂ AC, EF ⟂ AB. */
      altitudeA: (D.x - A.x) * (B.x - D.x) + (D.y - A.y) * (B.y - D.y),
      altitudeB: (C.x - B.x) * (A.x - C.x) + (C.y - B.y) * (A.y - C.y),
      altitudeS: E.x - F.x,
      sameVertical: S ? S.x - F.x : Infinity,
    };
  }

  /** Project a board point onto the named handle's arc (for dragging). */
  function constrain(which, q, board) {
    const b = board || BOARD;
    const a = Math.atan2(b.cy - q.y, q.x - b.cx);
    return anglePoint(b.cx, b.cy, b.r, clampAngle(which, a));
  }

  return {
    BOARD, C_MIN, C_MAX, D_MIN, D_MAX, EPS,
    clampAngle, randomPosition, start, move, result,
    geometry, claims, constrain, intersect, foot, angle,
    reflectInAB, anglePoint,
  };
})();
