"use strict";

/*
 * Two Perpendiculars From a Point to a Line, from Alexander Bogomolny's
 * applet TwoFallacies (after Bradis, Lapses in Mathematical Reasoning).
 *
 * Draw circles on AB and AC as diameters. Line BC meets the first again at
 * D and the second at E. Angles ADB and AEC are inscribed in semicircles,
 * so both are right: two perpendiculars from A to BC? And the circles meet
 * again at K, with angles AKB and AKC right, so B, K, C seem to lie on a
 * second straight line through B and C besides BC.
 *
 * The way out: D, E and K are one point, the foot of the perpendicular from
 * A to BC. A correct figure shows only one point. The applet "cheats": it
 * slides each circle's centre a few pixels along the perpendicular bisector
 * (5 px in its 400 x 300 picture, the two circles in opposite directions,
 * UpgradeCenter). The circles still pass through A, B and C, but AB and AC
 * are no longer diameters, so the right angles are a little off and the
 * three points come apart.
 *
 * Transcribed from TwoFallaciesCanvas.Compute: centres at the midpoints of
 * AB and AC, pushed by Shift perpendicular to AB and AC when cheating;
 * radii |A - centre|; K the circles' second common point; D and E the
 * second points of BC on each circle (or K when not cheating). Coordinates
 * are pixels of the applet's 400 x 300 picture, y pointing down.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * TwoPerpendicularsCore. The position is plain data.
 */
const TwoPerpendicularsCore = (() => {
  const W = 400, H = 300, SHIFT = 5;

  /** The applet's starting triangle (init, for a 400 x 300 canvas), enlarged 1.3 times. */
  function start(options = {}) {
    const cx = W / 2, cy = H / 2, r = W / 8, up = 20, k = H / 8;
    const A = [cx - r, cy + up - k];
    const C = [cx + r * Math.cos(Math.PI / 3), cy - r * Math.sin(Math.PI / 3) - up / 2 - k];
    const B = [(A[0] + C[0]) / 2, H - up - k];
    // The applet's triangle, enlarged 1.3 times about the centre so it fills the picture.
    const big = (P) => [cx + 1.3 * (P[0] - cx), cy + 1.3 * (P[1] - cy)];
    [A, B, C].forEach((P, i) => { [A, B, C][i].splice(0, 2, ...big(P)); });
    const ok = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
    return {
      A: ok(options.A) ? options.A.slice() : A,
      B: ok(options.B) ? options.B.slice() : B,
      C: ok(options.C) ? options.C.slice() : C,
      cheat: options.cheat !== false,
      fallacy: options.fallacy === 2 ? 2 : 1,
    };
  }

  const mid = (P, Q) => [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
  const dist = (P, Q) => Math.hypot(P[0] - Q[0], P[1] - Q[1]);

  /** UpgradeCenter: the centre pushed by shift, perpendicular to PQ. */
  function upgrade(P, centre, Q, shift) {
    const t = shift / dist(P, Q);
    return [centre[0] + t * (P[1] - Q[1]), centre[1] - t * (P[0] - Q[0])];
  }

  /** Intersections of two circles. */
  function circles(c1, r1, c2, r2) {
    const d = dist(c1, c2);
    if (d === 0 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const ux = (c2[0] - c1[0]) / d, uy = (c2[1] - c1[1]) / d;
    const px = c1[0] + a * ux, py = c1[1] + a * uy;
    return [[px - h * uy, py + h * ux], [px + h * uy, py - h * ux]];
  }

  /** Intersections of the line PQ with a circle. */
  function lineCircle(P, Q, c, r) {
    const dx = Q[0] - P[0], dy = Q[1] - P[1];
    const fx = P[0] - c[0], fy = P[1] - c[1];
    const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), cc = fx * fx + fy * fy - r * r;
    const disc = b * b - 4 * a * cc;
    if (a === 0 || disc < 0) return [];
    const s = Math.sqrt(disc);
    return [(-b - s) / (2 * a), (-b + s) / (2 * a)].map((t) => [P[0] + t * dx, P[1] + t * dy]);
  }

  /** Other: of two points, the one not at P (the applet: closer than 1 px means "at P"). */
  const other = (pts, P) => (pts.length < 2 ? null : dist(pts[0], P) < 1 ? pts[1] : pts[0]);

  /** Compute: centres, radii, K, D (on AB's circle) and E (on AC's circle). */
  function figure(s) {
    const shift = s.cheat ? SHIFT : 0;
    const cB = upgrade(s.A, mid(s.A, s.B), s.B, shift), rB = dist(s.A, cB);
    const cC = upgrade(s.A, mid(s.A, s.C), s.C, -shift), rC = dist(s.A, cC);
    const K = other(circles(cB, rB, cC, rC), s.A);
    let D = K, E = K;
    if (s.cheat) {
      D = other(lineCircle(s.B, s.C, cB, rB), s.B);
      E = other(lineCircle(s.B, s.C, cC, rC), s.C);
    }
    return { cB, rB, cC, rC, K, D, E };
  }

  /** The foot of the perpendicular from A to BC. */
  function foot(s) {
    const [bx, by] = s.B, dx = s.C[0] - bx, dy = s.C[1] - by;
    const t = ((s.A[0] - bx) * dx + (s.A[1] - by) * dy) / (dx * dx + dy * dy);
    return [bx + t * dx, by + t * dy];
  }

  /** The angle PQR at Q, in degrees. */
  function angle(P, Q, R) {
    const a = [P[0] - Q[0], P[1] - Q[1]], b = [R[0] - Q[0], R[1] - Q[1]];
    return (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))) * 180) / Math.PI;
  }

  /** Move a point (A, B or C), or the whole triangle by (dx, dy); kept in the picture. */
  function move(s, which, x, y) {
    const clamp = (p) => [Math.max(0, Math.min(W, p[0])), Math.max(0, Math.min(H, p[1]))];
    if (which === "A" || which === "B" || which === "C") {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const t = { ...s, [which]: clamp([x, y]) };
      return dist(t.A, t.B) < 2 || dist(t.A, t.C) < 2 || dist(t.B, t.C) < 2 ? null : t;
    }
    if (which === "all") {
      const xs = [s.A[0], s.B[0], s.C[0]], ys = [s.A[1], s.B[1], s.C[1]];
      const dx = Math.max(-Math.min(...xs), Math.min(W - Math.max(...xs), x)), dy = Math.max(-Math.min(...ys), Math.min(H - Math.max(...ys), y));
      const sh = (p) => [p[0] + dx, p[1] + dy];
      return { ...s, A: sh(s.A), B: sh(s.B), C: sh(s.C) };
    }
    return null;
  }

  const set = (s, key, value) => (key === "cheat" ? { ...s, cheat: !!value } : key === "fallacy" ? { ...s, fallacy: value === 2 ? 2 : 1 } : null);
  const result = () => null;

  return { W, H, SHIFT, start, upgrade, circles, lineCircle, figure, foot, angle, move, set, dist, result };
})();
