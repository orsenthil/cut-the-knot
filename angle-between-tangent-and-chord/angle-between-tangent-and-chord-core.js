"use strict";

/*
 * Angle Between Tangent And Chord — the geometry behind Alexander Bogomolny's
 * applet AngleBetweenTangentAndChord
 * (cut-the-knot.org/Curriculum/Geometry/AngleBetweenTangentAndChord.shtml).
 *
 * The 1896 Ibaragi sangaku on that page: the tangents from an outside point C
 * touch a circle at A and B; the incenter I of triangle ABC lies on the circle,
 * at the midpoint I' of the small arc AB. The proof uses the fact that the
 * angle between a tangent and a chord equals the inscribed angle standing on
 * the same chord in the alternate segment. Hence the four angles
 * CAI', I'AB, ABI' and I'BC are equal, so AI' and BI' are the bisectors at A
 * and B and I' is the incenter.
 *
 * The applet lets the player drag the centre O and the radius point R of the
 * given circle, and the outside point C. Its Compute() calls GetTangents(circle,
 * C) and GetIncircle(A, B, C); we reproduce that construction here. The
 * position is plain data; this file touches no DOM, no window and no storage.
 * It defines one global, AngleBetweenTangentAndChordCore.
 */

const AngleBetweenTangentAndChordCore = (() => {
  const WIDTH = 360;
  const HEIGHT = 240;
  const MIN_RADIUS = 14;   // keep the radius handle usable with a finger
  const HANDLES = ["O", "R", "C"];
  const OPTION_KEYS = ["showNames", "showStatement", "showHint"];
  // The applet's init(): O at (width/3, 2*height/3), radius = height/4,
  // R to the left of O, and C at (O.x + 3*radius, O.y/2). Our board is 360x240.
  const START = {
    O: { x: 120, y: 160 },
    R: { x: 60, y: 160 },
    C: { x: 300, y: 80 },
  };

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v) => Math.round(v * 1000) / 1000;
  const clampPoint = (p) => ({
    x: round(clamp(p.x, 8, WIDTH - 8)),
    y: round(clamp(p.y, 8, HEIGHT - 8)),
  });

  /** Angle at v between the rays to p and q, in radians in [0, PI]. */
  function angleAt(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
    if (!la || !lb) return 0;
    return Math.acos(clamp(dot(a, b) / (la * lb), -1, 1));
  }

  /** Perpendicular distance from p to the infinite line through a and b. */
  function distanceToLine(p, a, b) {
    const len = dist(a, b);
    return len < 1e-12 ? dist(p, a) : Math.abs(cross(sub(b, a), sub(p, a))) / len;
  }

  /* ------------------------------------------------------------- positions */

  /** The opening picture, with the applet's switch defaults. */
  function start(options) {
    const o = options || {};
    const state = {
      O: { ...START.O },
      R: { ...START.R },
      C: { ...START.C },
      showNames: true,      // the applet's ShowNames parameter defaults to "1"
      showStatement: false, // the other two checkboxes start unticked
      showHint: false,
      moves: 0,
      explored: false,
    };
    for (const name of HANDLES) {
      if (finite(o[name])) state[name] = clampPoint(o[name]);
    }
    for (const key of OPTION_KEYS) {
      if (typeof o[key] === "boolean") state[key] = o[key];
    }
    return state;
  }

  /** The moves a player can make: drag one of the three points, tick a switch, reset. */
  function legalMoves(state) {
    return [
      ...HANDLES.map((name) => ({ type: "point", name, point: state[name] })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key, value: !state[key] })),
      { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      if (!HANDLES.includes(m.name) || !finite(m.point)) return null;
      const p = clampPoint(m.point);
      if (m.name === "R") {
        const radius = dist(p, state.O);
        if (radius < MIN_RADIUS) {
          const away = dist(state.O, state.R) > 1e-9
            ? mul(sub(state.R, state.O), 1 / dist(state.O, state.R))
            : { x: -1, y: 0 };
          const pushed = clampPoint(add(state.O, mul(away, MIN_RADIUS)));
          next = { ...state, R: pushed };
        }
      }
      if (!next) next = { ...state, [m.name]: p };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key) || typeof m.value !== "boolean") return null;
      next = { ...state, [m.key]: m.value };
    } else if (m.type === "reset") {
      next = { ...start(), ...Object.fromEntries(OPTION_KEYS.map((k) => [k, state[k]])) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** A picture has no win or loss: it counts as explored once it has been changed. */
  function result(state) {
    return state && state.explored ? "done" : null;
  }

  /* ---------------------------------------------------------- the geometry */

  /**
   * Tangency points from C to the circle, from right triangles: with
   * u = (C-O)/d, the chord AB is perpendicular to OC and its midpoint M is
   * O + (r*r/d)*u. Its half length is r*sqrt(d*d-r*r)/d. The applet obtains
   * the same two points by intersecting the given circle with a circle centred
   * at C of radius sqrt(d*d-r*r) (GetTangents), which is transcribed
   * independently in porting/check-angle-between-tangent-and-chord.mjs.
   */
  function tangents(O, r, C) {
    const d = dist(O, C);
    // GetTangents returns null for d < r and [C,C] for d <= r + 0.1. Neither
    // gives a drawing, so both are reported as invalid here.
    if (!Number.isFinite(d) || r <= 0 || d <= r + 0.1) return null;
    const u = { x: (C.x - O.x) / d, y: (C.y - O.y) / d };
    const perp = { x: -u.y, y: u.x };
    const M = add(O, mul(u, (r * r) / d));
    const half = (r * Math.sqrt(d * d - r * r)) / d;
    return { A: add(M, mul(perp, half)), B: sub(M, mul(perp, half)), M, u };
  }

  /** Incenter by side-length weights; the applet's rotation method is the twin. */
  function incenter(A, B, C) {
    const a = dist(B, C), b = dist(A, C), c = dist(A, B);
    const p = a + b + c;
    if (!p) return null;
    return {
      x: (a * A.x + b * B.x + c * C.x) / p,
      y: (a * A.y + b * B.y + c * C.y) / p,
    };
  }

  /** Everything the picture needs at a position. */
  function compute(state) {
    const O = state && state.O, R = state && state.R, C = state && state.C;
    if (!finite(O) || !finite(R) || !finite(C)) return { valid: false, reason: "invalid" };
    const r = dist(O, R), d = dist(O, C);
    const t = tangents(O, r, C);
    if (!t) return { valid: false, reason: d <= r + 0.1 ? "outside" : "invalid", O, r, C };
    const { A, B, M, u } = t;
    const I = incenter(A, B, C);
    if (!I) return { valid: false, reason: "invalid", O, r, C };
    // I' is the midpoint of the small arc AB, on the ray from O towards C.
    const Ip = add(O, mul(u, r));
    const perimeter = dist(A, B) + dist(B, C) + dist(C, A);
    const inradius = Math.abs(cross(sub(B, A), sub(C, A))) / perimeter;
    // GetIncircle averages the three distances from I to the sides, but its
    // first call is NearestPoint(I, I, A): the line passes through I itself,
    // so that term is 0 and the applet draws a circle of radius 2/3 inradius.
    // Keep the quirk in the picture; the true inradius stays available above.
    const shownInradius = (
      distanceToLine(I, B, C) + distanceToLine(I, C, A)
    ) / 3;
    const angles = {
      CAI: angleAt(A, C, I),  // tangent CA with chord AI'
      IAB: angleAt(A, I, B),  // chord AI' with chord AB
      ABI: angleAt(B, A, I),  // inscribed angle on arc AI'
      IBC: angleAt(B, I, C),  // chord BI' with tangent BC
    };
    const halfArc = 0.5 * Math.acos(clamp(r / d, -1, 1));
    return {
      valid: true, reason: null, O, r, R, C, d, u, A, B, M, I, Ip, inradius, shownInradius, angles, halfArc,
    };
  }

  /** Residuals for the page's claims, used by the logic test and the status. */
  function residuals(g) {
    if (!g || !g.valid) return null;
    const { O, r, A, B, C, I, Ip, M, angles, halfArc, inradius } = g;
    const vals = Object.values(angles);
    let spread = 0;
    for (const a of vals) for (const b of vals) spread = Math.max(spread, Math.abs(a - b));
    return {
      tangent: Math.max(
        Math.abs(dot(sub(A, O), sub(C, A))) / (r * g.d),
        Math.abs(dot(sub(B, O), sub(C, B))) / (r * g.d),
      ),
      onCircle: Math.max(Math.abs(dist(O, A) - r), Math.abs(dist(O, B) - r)),
      IOnCircle: Math.abs(dist(O, I) - r),
      IAtArcMid: dist(I, Ip),
      arcsEqual: Math.abs(angleAt(O, A, Ip) - angleAt(O, Ip, B)),
      fourAngles: spread,
      bisectors: Math.max(Math.abs(angles.CAI - angles.IAB), Math.abs(angles.IBC - angles.ABI)),
      alternate: Math.max(Math.abs(angles.CAI - angles.ABI), Math.abs(angles.IBC - angles.IAB)),
      halfArc: Math.max(...vals.map((a) => Math.abs(a - halfArc))),
      inradius: Math.max(
        Math.abs(distanceToLine(I, A, B) - inradius),
        Math.abs(distanceToLine(I, B, C) - inradius),
        Math.abs(distanceToLine(I, C, A) - inradius),
      ),
      tangentLengths: Math.abs(dist(C, A) - dist(C, B)),
      chordMidpoint: dist(M, midpoint(A, B)),
    };
  }

  return {
    WIDTH, HEIGHT, MIN_RADIUS, HANDLES, OPTION_KEYS, START,
    add, sub, mul, dot, cross, dist, midpoint, finite, clamp, clampPoint,
    angleAt, distanceToLine, start, legalMoves, move, result,
    tangents, incenter, compute, residuals,
  };
})();
