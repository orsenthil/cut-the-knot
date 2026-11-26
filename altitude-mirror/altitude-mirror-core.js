"use strict";

/*
 * Altitude Mirror, from Alexander Bogomolny's applet AltitudeMirror.
 *
 * Take a triangle ABC, drop the altitude AH, and choose any point P on that
 * altitude. Lines CP and BP meet AB and AC again at E and D. The mirror
 * property says that the altitude AH reflects the line HD to the line HE, so
 * (when H lies between B and C) the angles BHE and CHD are equal, and AH cuts
 * the angle DHE in two. The key calculation is an analytic one: every point is
 * an intersection of two lines, and a reflection across AH exchanges the two
 * lines through H. The same calculation also gives AF = AG for the line
 * through A parallel to BC, which is the applet's proof of the property.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, AltitudeMirrorCore, so the page loads it
 * with a plain <script> and porting/check-altitude-mirror.mjs loads it in Node.
 *
 * The position is plain data (points and three checkbox booleans), so it can
 * be saved and handed to the tutor as it is. Every function returns a new
 * position and leaves the one it was given untouched.
 */
const AltitudeMirrorCore = (() => {
  // The Java canvas was 400 by 300. The SVG board is 360 by 240, and the
  // opening points use the applet's own fractions of the canvas: B and C sit
  // a quarter of the width either side of the middle, five sixths of the way
  // down; A sits a third of the way to the left of the middle at a third of
  // the height. P starts two thirds of the way from A to H.
  const WIDTH = 360;
  const HEIGHT = 240;
  const MARGIN = 14;
  const EPS = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const len = (p) => Math.hypot(p.x, p.y);
  const dist = (p, q) => len(sub(p, q));

  /** Foot of the perpendicular from p to the line through a and b. */
  function foot(p, a, b) {
    const d = sub(b, a);
    const n = dot(d, d);
    if (n < EPS) return { x: a.x, y: a.y };
    return add(a, mul(d, dot(sub(p, a), d) / n));
  }

  /** Intersection of line(a,b) with line(c,d); null when they are parallel. */
  function intersect(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = cross(r, s);
    if (Math.abs(den) < 1e-10) return null;
    return add(a, mul(r, cross(sub(c, a), s) / den));
  }

  /**
   * GeoSDoub.GetParallelTo(A,B,C) in the applet: a point 100 base-lengths
   * away from A in the B-to-C direction. Only the line through A and this
   * point matters; the far distance keeps its intersections well conditioned.
   */
  function parallelPoint(a, b, c) {
    return { x: a.x + 100 * (b.x - c.x), y: a.y + 100 * (b.y - c.y) };
  }

  /** The position a new illustration starts from. */
  function start() {
    return {
      A: { x: 150, y: 80 },
      B: { x: 90, y: 200 },
      C: { x: 270, y: 200 },
      P: { x: 150, y: 160 },
      showNames: true,
      showStatement: false,
      showHint: false,
    };
  }

  /** Every point of the applet's construction, from a position. */
  function compute(s) {
    const { A, B, C, P } = s;
    const H = foot(A, B, C);
    const Q = parallelPoint(A, B, C);
    const E = intersect(A, B, C, P); // CP meets AB
    const D = intersect(A, C, B, P); // BP meets AC
    const F = E ? intersect(H, E, A, Q) : null; // HE meets the parallel through A
    const G = D ? intersect(H, D, A, Q) : null; // HD meets the parallel through A
    return { A, B, C, P, H, Q, E, D, F, G };
  }

  /** The smaller angle between two rays at v, in radians. */
  function angle(v, p, q) {
    const u = sub(p, v), w = sub(q, v);
    const nu = len(u), nw = len(w);
    if (nu < EPS || nw < EPS) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(u, w) / (nu * nw))));
  }

  /** The smaller angle between two *lines* through v, in [0, PI/2]. */
  function lineAngle(v, p, q) {
    const u = sub(p, v), w = sub(q, v);
    return Math.atan2(Math.abs(cross(u, w)), Math.abs(dot(u, w)));
  }

  /** All the angles the applet draws, plus the line angles used by the test. */
  function angles(f) {
    if (!f.E || !f.D) return null;
    return {
      bhe: angle(f.H, f.B, f.E),
      chd: angle(f.H, f.C, f.D),
      dha: angle(f.H, f.D, f.A),
      ahe: angle(f.H, f.A, f.E),
      hbhe: lineAngle(f.H, f.B, f.E),
      hchd: lineAngle(f.H, f.C, f.D),
      dhah: lineAngle(f.H, f.D, f.A),
      ehah: lineAngle(f.H, f.E, f.A),
    };
  }

  /** Errors in the claims, scaled to the size of the drawing where needed. */
  function errors(f) {
    const a = angles(f);
    if (!a) return null;
    const scale = Math.max(1, dist(f.A, f.H), dist(f.B, f.C));
    const af = f.F ? dist(f.A, f.F) : NaN;
    const ag = f.G ? dist(f.A, f.G) : NaN;
    return {
      ray: Math.abs(a.bhe - a.chd),
      bisector: Math.abs(a.dha - a.ahe),
      lines: Math.max(Math.abs(a.hbhe - a.hchd), Math.abs(a.dhah - a.ehah)),
      afag: Math.abs(af - ag) / scale,
      // Haruki's two length formulas from the proof on the original page.
      afFormula: f.F && f.E && f.B
        ? Math.abs(af - (dist(f.A, f.E) * dist(f.B, f.H)) / dist(f.B, f.E)) / scale
        : NaN,
      agFormula: f.G && f.D && f.C
        ? Math.abs(ag - (dist(f.A, f.D) * dist(f.C, f.H)) / dist(f.C, f.D)) / scale
        : NaN,
    };
  }

  /** Where the altitude from B meets AC, used for the orthocenter. */
  function altitudeFootFromB(s) {
    return foot(s.B, s.A, s.C);
  }

  /** Where the altitude from C meets AB, used for the orthocenter. */
  function altitudeFootFromC(s) {
    return foot(s.C, s.A, s.B);
  }

  /** The common point of the three altitudes. */
  function orthocenter(s) {
    const H = foot(s.A, s.B, s.C);
    return intersect(s.A, H, s.B, altitudeFootFromB(s));
  }

  /** The orthic triangle: the three feet of the altitudes. */
  function orthic(s) {
    return {
      H: foot(s.A, s.B, s.C),
      D: altitudeFootFromB(s),
      E: altitudeFootFromC(s),
    };
  }

  /** True when the foot H is on the segment BC, as the page's claim requires. */
  function hBetween(f) {
    return dot(sub(f.H, f.B), sub(f.H, f.C)) <= 1e-7;
  }

  /** Keep a dragged point inside the board; P is a slider on the altitude. */
  function clampPoint(s, name, q) {
    if (name === "P") {
      const H = foot(s.A, s.B, s.C);
      const p = foot(q, s.A, H); // the applet glides P along the altitude line
      return {
        x: Math.max(-80, Math.min(WIDTH + 80, p.x)),
        y: Math.max(-80, Math.min(HEIGHT + 80, p.y)),
      };
    }
    return {
      x: Math.max(MARGIN, Math.min(WIDTH - MARGIN, q.x)),
      y: Math.max(MARGIN, Math.min(HEIGHT - MARGIN, q.y)),
    };
  }

  /**
   * Move one named point. Vertices move freely; after a vertex moves the foot
   * H is recomputed and P is glided back onto the new altitude, so the picture
   * always shows the configuration the theorem is about.
   */
  function move(s, name, q) {
    if (!["A", "B", "C", "P"].includes(name) || !q) return s;
    const next = Object.assign({}, s, { [name]: clampPoint(s, name, q) });
    if (name !== "P") next.P = clampPoint(next, "P", s.P);
    return next;
  }

  /** One of the applet's three checkboxes. */
  function option(s, name, value) {
    if (!["showNames", "showStatement", "showHint"].includes(name)) return s;
    return Object.assign({}, s, { [name]: !!value });
  }

  /** The status line: numbers in degrees, and an honest note for obtuse cases. */
  function describe(f) {
    const a = angles(f);
    if (!a) return "The lines are parallel here. Move a vertex to see the mirror.";
    const deg = (r) => (r * 180 / Math.PI).toFixed(1) + "\u00b0";
    const side = hBetween(f)
      ? "H lies between B and C."
      : "H lies outside BC, so the page's angle claim does not apply.";
    return `${side} Angle BHE = ${deg(a.bhe)}, angle CHD = ${deg(a.chd)}; AH bisects DHE: ${deg(a.dha)} and ${deg(a.ahe)}.`;
  }

  return {
    WIDTH, HEIGHT, EPS,
    add, sub, mul, dot, cross, len, dist,
    foot, intersect, parallelPoint,
    start, compute, angle, lineAngle, angles, errors,
    altitudeFootFromB, altitudeFootFromC, orthocenter, orthic, hBetween,
    clampPoint, move, option, describe,
  };
})();
