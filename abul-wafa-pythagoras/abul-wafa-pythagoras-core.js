"use strict";

/*
 * Abul Wafa al-Buzjani's dissection of the Pythagorean theorem, as in
 * Alexander Bogomolny's applet AbulWafaPythagoras.
 *
 * Two squares of sides a and b start with their lower-left corners apart.
 * The player slides the smaller one until its corner meets the other's
 * corner (the applet calls this CheckSetupReady, dist(A, A1) <= 0.1), then
 * seven pieces cut from the two squares can be moved into the square on the
 * hypotenuse. The key fact is that every piece keeps its area and shape, so
 * a² + b² is exactly the area of the third square, whatever a and b are.
 *
 * Coordinates follow the applet's canvas: y grows downwards, a square's
 * lower-left corner is A and its other corners are B = A + (a, 0),
 * C = A + (a, -a), D = A + (0, -a). All points here are relative to the
 * shared corner A = (0, 0); the assembled square is placed with its corner
 * Dp at the point `at` passed to dissection().
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, AbulWafaPythagorasCore, so the page
 * loads it with a plain <script> and the logic test loads it in Node.
 * Functions take plain data and return new plain data.
 */
const AbulWafaPythagorasCore = (() => {
  const EPS = 1e-12;

  // The applet's canvas is 500x400. Its init() puts the big square's corner
  // at (width/8, 7*height/8) with side 1.5*width/8, and the small square at
  // (width/2, 7*height/8) with side width/8.
  const APPLET = { width: 500, height: 400, snap: 5, ready: 0.1 };
  const LIMITS = { minA: 40, maxA: 150, minB: 20, gap: 10 };

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Intersection of line(p,q) with line(r,s); null when parallel. */
  function meet(p, q, r, s) {
    const ux = q.x - p.x, uy = q.y - p.y;
    const vx = s.x - r.x, vy = s.y - r.y;
    const cross = ux * vy - uy * vx;
    if (Math.abs(cross) < EPS) return null;
    const t = ((r.x - p.x) * vy - (r.y - p.y) * vx) / cross;
    return add(p, pt(ux * t, uy * t));
  }

  /** Twice the signed area of a polygon (shoelace). */
  function signed2(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum;
  }
  const area = (points) => Math.abs(signed2(points)) / 2;

  /** The position a new illustration starts from, straight from init(). */
  function start() {
    const big = 1.5 * (APPLET.width / 8);
    const small = APPLET.width / 8;
    return {
      a: big,
      b: small,
      gap: { x: APPLET.width / 2 - APPLET.width / 8, y: 0 },
      assembled: false,
    };
  }

  /** Whether the two lower-left corners coincide closely enough. */
  function aligned(state) {
    return distance(state.gap, pt(0, 0)) <= APPLET.ready;
  }

  /** Move the small square's corner; a close drop snaps it onto the big one. */
  function withGap(state, x, y) {
    let gap = pt(x, y);
    if (distance(gap, pt(0, 0)) < APPLET.snap) gap = pt(0, 0);
    return { a: state.a, b: state.b, gap, assembled: state.assembled };
  }

  /** Resize a square. `which` is "a" (big) or "b" (small/triangle leg). */
  function withSide(state, which, value) {
    if (which === "a") {
      const a = clamp(value, LIMITS.minA, LIMITS.maxA);
      return {
        a,
        b: Math.min(state.b, a - LIMITS.gap),
        gap: { ...state.gap },
        assembled: state.assembled,
      };
    }
    const b = clamp(value, LIMITS.minB, state.a - LIMITS.gap);
    return { a: state.a, b, gap: { ...state.gap }, assembled: state.assembled };
  }

  /** The right triangle A-B-E drawn in the big square: legs a and b. */
  function triangle(state) {
    const A = pt(0, 0), B = pt(state.a, 0), E = pt(state.a, -state.b);
    return { A, B, E, a: state.a, b: state.b, c: Math.hypot(state.a, state.b) };
  }

  /**
   * The applet's CreatePieces(), transcribed. All points are relative to the
   * shared corner A; `at` is where the assembled square's Dp corner sits.
   * Each piece carries its starting vertices, its destination vertices and
   * the applet's colour group (Color0 = big square, Color1 = small square).
   */
  function dissection(a, b, at) {
    const Dp = at || pt(a + b + 40, -a);

    // Big square A B C D and small square A1 B1 C1 D1 (A1 == A).
    const A = pt(0, 0), B = pt(a, 0), C = pt(a, -a), D = pt(0, -a);
    const A1 = pt(0, 0), B1 = pt(b, 0), C1 = pt(b, -b), D1 = pt(0, -b);

    // The cuts: E on the right side, F on the top side, K where A-E meets
    // the small square's right side.
    const E = pt(B.x, B.y - b);
    const F = pt(D.x + b, D.y);
    const K = meet(A, E, B1, C1);

    // The square on the hypotenuse: Dp -> Ap -> Bp -> Cp, with Ap-Dp the
    // vector (a, b) and Bp-Ap the vector (b, -a).
    const Ap = add(Dp, pt(a, b));
    const Bp = add(Ap, pt(b, -a));
    const Cp = add(Bp, pt(-a, -b));
    const Ep = pt(Ap.x, Ap.y - b);
    const Fp = pt(Bp.x - b, Bp.y);
    const Gp = pt(Cp.x, Cp.y + b);
    const Hp = pt(Dp.x + b, Dp.y);
    const Sp = pt(Dp.x + a - b, Dp.y);
    const Ip = meet(pt(Sp.x, Sp.y + (Dp.x - Ep.x)), Sp, Dp, Ap);
    const Jp = pt(Bp.x - b, Bp.y);
    const Kp = meet(Jp, pt(Jp.x, Jp.y + (Bp.x - Jp.x)), Cp, Bp);

    // The seven MoveablePoly objects, in the order CreatePieces adds them.
    const pieces = [
      { name: "triangle-1", color: 0, start: [A, F, D], end: [Ap, Bp, Fp] },
      { name: "triangle-2", color: 0, start: [A, B1, F], end: [Dp, Hp, Cp] },
      { name: "triangle-3", color: 0, start: [C1, K, E], end: [Sp, Ip, Dp] },
      { name: "quad-4", color: 0, start: [B1, B, E, K], end: [Jp, Gp, Cp, Kp] },
      { name: "quad-5", color: 0, start: [C1, E, C, F], end: [Hp, Ep, Fp, Gp] },
      { name: "triangle-6", color: 1, start: [A1, B1, K], end: [Bp, Jp, Kp] },
      { name: "quad-7", color: 1, start: [A, K, C1, D1], end: [Ap, Ip, Sp, Ep] },
    ];

    return {
      a, b, c: Math.hypot(a, b),
      points: { A, B, C, D, A1, B1, C1, D1, E, F, K,
        Dp, Ap, Bp, Cp, Ep, Fp, Gp, Hp, Sp, Ip, Jp, Kp },
      square: [Dp, Ap, Bp, Cp],
      pieces,
    };
  }

  /** Numbers a player can check: the two legs and the hypotenuse squared. */
  function identity(a, b) {
    const a2 = a * a, b2 = b * b;
    const c = Math.hypot(a, b), c2 = c * c;
    return { a2, b2, c2, c, holds: Math.abs(a2 + b2 - c2) < 1e-9 * Math.max(1, c2) };
  }

  return {
    APPLET, LIMITS,
    pt, add, sub, distance, clamp, meet, area,
    start, aligned, withGap, withSide, triangle, dissection, identity,
  };
})();
