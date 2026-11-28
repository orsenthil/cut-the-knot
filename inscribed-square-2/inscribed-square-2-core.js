"use strict";

/*
 * Inscribed Square 2, from Alexander Bogomolny's applet InscribedSquare2.
 *
 * Build a square on the side AB of a triangle, away from the third corner C.
 * The lines from C to the two far corners of that Vecten square cut AB at P
 * and Q. Verticals through P and Q meet AC and BC at P' and Q': the four
 * points P, Q, Q', P' form a square. The whole calculation is two rotations
 * by a right angle and a handful of line intersections; the same intersections
 * give the two square centres, which lie on a line through C.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, InscribedSquare2Core, so the page loads it
 * with a plain <script> and porting/check-inscribed-square-2.mjs loads it in
 * Node. The position is plain data (three points and two checkbox booleans),
 * so it can be saved and handed to the tutor as it is. Every function returns
 * a new position and leaves the one it was given untouched.
 */
const InscribedSquare2Core = (() => {
  // The Java canvas was 400 by 300 with the board x8 wide and the points 20
  // pixels below its middle. This SVG board is 360 by 240; the same fractions
  // put A and B at (135, 140) and the slightly skewed C at about (202.5, 71).
  const WIDTH = 360;
  const HEIGHT = 240;
  const MARGIN = 12;
  const HALF_PI = Math.PI / 2;
  const THIRD_PI = Math.PI / 3;
  const TOL = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  /**
   * GeoSDoub.Rotate(p, q, angle, sign) from classes.zip. `cos(HALF_PI)` is left
   * as Java computed it (a tiny non-zero number), exactly as in FormSquare.
   */
  function rotate(p, q, angle, sign) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return {
      x: p.x + c * (q.x - p.x) - sign * s * (q.y - p.y),
      y: p.y + sign * s * (q.x - p.x) + c * (q.y - p.y),
    };
  }

  /**
   * GeoSDoub.Intersect(p, q, r, s): determinant form, with the applet's own
   * near-parallel test (|determinant| < 1 gives NaN, not a relative epsilon).
   * These are infinite lines, not segments: the page says "sidelines".
   */
  function intersect(p, q, r, s) {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const den = a * b2 - a2 * b;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b * c2 - b2 * c) / den, y: (c * a2 - c2 * a) / den };
  }

  /** The applet's Perp(P, A, B): P plus the vector AB turned a quarter turn. */
  function perp(p, a, b) {
    return { x: p.x + a.y - b.y, y: p.y + b.x - a.x };
  }

  /** The Vecten square on AB. sign +1 is the side away from a C above AB. */
  function squareOn(a, b, sign) {
    return {
      ca: rotate(a, b, HALF_PI, sign),
      cb: rotate(b, a, HALF_PI, -sign),
    };
  }

  /** The opening figure. The archived page's explanation applet had names on. */
  function start(options) {
    const o = options || {};
    const cx = WIDTH / 2, cy = HEIGHT / 2, w = WIDTH / 8, off = 20;
    return {
      A: { x: cx - w, y: cy + off },
      B: { x: cx + w, y: cy + off },
      C: { x: cx + w * Math.cos(THIRD_PI), y: cy - w * Math.sin(THIRD_PI) - off / 2 },
      showNames: o.showNames === undefined ? true : !!o.showNames,
      showHint: !!o.showHint,
    };
  }

  /**
   * InscribedSquare2Canvas.Draw() in the bytecode: FormSquare, then P, P',
   * Q, Q', then the two square centres. `sign` is +1 for the outward Vecten
   * square the applet draws and -1 for the inward one the page also mentions.
   */
  function compute(s, sign) {
    const dir = sign === -1 ? -1 : 1;
    const { ca, cb } = squareOn(s.A, s.B, dir);
    const P = intersect(s.A, s.B, s.C, ca);
    const PP = intersect(P, perp(P, s.A, s.B), s.A, s.C);
    const Q = intersect(s.A, s.B, s.C, cb);
    const QQ = intersect(Q, perp(Q, s.A, s.B), s.B, s.C);
    const c1 = intersect(s.A, cb, s.B, ca);
    const c2 = intersect(P, QQ, Q, PP);
    return { A: s.A, B: s.B, C: s.C, CA: ca, CB: cb, P, PP, Q, QQ, c1, c2 };
  }

  /** Four equal sides, four right angles, a parallel top, and a real square. */
  function metrics(f) {
    const L = dist(f.A, f.B);
    const u = sub(f.B, f.A);
    const sides = [dist(f.P, f.Q), dist(f.P, f.PP), dist(f.PP, f.QQ), dist(f.Q, f.QQ)];
    const equalSides = (Math.max(...sides) - Math.min(...sides)) / L;
    const rightAngles = Math.max(
      Math.abs(dot(u, sub(f.PP, f.P))),
      Math.abs(dot(u, sub(f.QQ, f.Q))),
    ) / (L * L);
    const parallelTop = Math.abs(cross(u, sub(f.QQ, f.PP))) / (L * L);
    const vecten = Math.max(
      Math.abs(dist(f.A, f.CA) - L),
      Math.abs(dist(f.B, f.CB) - L),
      Math.abs(dot(u, sub(f.CA, f.A))),
      Math.abs(dot(u, sub(f.CB, f.B))),
    ) / L;
    const cp = sub(f.C, f.c1), cq = sub(f.C, f.c2);
    const collinear = Math.abs(cross(cp, cq)) / (dist(f.C, f.c1) * dist(f.C, f.c2));
    const homothety = Math.abs(
      dist(f.C, f.c2) / dist(f.C, f.c1) - dist(f.P, f.Q) / L,
    );
    return {
      valid: [f.CA, f.CB, f.P, f.PP, f.Q, f.QQ, f.c1, f.c2].every(finite),
      base: dist(f.P, f.Q),
      side: dist(f.P, f.PP),
      equalSides, rightAngles, parallelTop, vecten, collinear, homothety,
    };
  }

  /** Signed area: negative when C is above the directed side A -> B on screen. */
  function orientation(f) {
    return cross(sub(f.B, f.A), sub(f.C, f.A));
  }

  /** The side the page's formula predicts: base x altitude / (base + altitude). */
  function outwardSide(s) {
    const L = dist(s.A, s.B);
    const h = Math.abs(orientation({ A: s.A, B: s.B, C: s.C })) / L;
    return L === 0 ? NaN : (L * h) / (L + h);
  }

  /** The inward construction's side: base x altitude / |base - altitude|. */
  function inwardSide(s) {
    const L = dist(s.A, s.B);
    const h = Math.abs(orientation({ A: s.A, B: s.B, C: s.C })) / L;
    return L === 0 ? NaN : (L * h) / Math.abs(L - h);
  }

  /** Keep a dragged point on the board, as the applet's mouse handlers did. */
  function clampPoint(s, name, q) {
    return {
      x: Math.max(MARGIN, Math.min(WIDTH - MARGIN, q.x)),
      y: Math.max(MARGIN, Math.min(HEIGHT - MARGIN, q.y)),
    };
  }

  /** Move one of A, B, C; the other two and the checkboxes stay as they were. */
  function move(s, name, q) {
    if (!["A", "B", "C"].includes(name) || !q || !finite(q)) return s;
    return Object.assign({}, s, { [name]: clampPoint(s, name, q) });
  }

  /** One of the applet's two checkboxes. */
  function option(s, name, value) {
    if (!["showNames", "showHint"].includes(name)) return s;
    return Object.assign({}, s, { [name]: !!value });
  }

  /** The status line: what was built, with the measured side and scale ratio. */
  function describe(f, m) {
    const info = m || metrics(f);
    if (!info.valid) return "The lines do not meet here. Move a corner away from the others.";
    const L = dist(f.A, f.B);
    if (L < 1) return "Move A and B apart to make the square.";
    const side = info.base.toFixed(1);
    const ratio = (dist(f.C, f.c2) / dist(f.C, f.c1)).toFixed(2);
    const where = orientation(f) < 0
      ? "The red square sits inside the triangle."
      : "C is on the square's side of AB, so the red square lies outside the triangle.";
    return `PQ is ${side} units long. The two squares match at ${ratio} times scale from C. ${where}`;
  }

  return {
    WIDTH, HEIGHT, MARGIN, TOL,
    add, sub, mul, dot, cross, dist, finite, midpoint,
    rotate, intersect, perp, squareOn,
    start, compute, metrics, orientation, outwardSide, inwardSide,
    clampPoint, move, option, describe,
  };
})();
