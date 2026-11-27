"use strict";

/*
 * Directly Similar 2, from Alexander Bogomolny's applet DirectlySimilar2.
 *
 * The page claims: for two directly similar triangles ABC and A'B'C' and a
 * point P, put A1 = P + AA', B1 = P + BB', C1 = P + CC' (each AA' means the
 * step from A to A'); then A1B1C1 is similar to both triangles. The Java
 * canvas put S[k] = P + X[k] - X'[k], the opposite step, which is just the
 * half-turn of the page's figure about P and so has the same shape.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, DirectlySimilar2Core, so the page loads it
 * with a plain <script> and porting/check-directly-similar-2.mjs loads it in
 * Node. The position is plain data (points and a size), and functions return
 * new positions rather than changing the one they are given.
 *
 * The three methods below - signedAngle, rotate, intersect - are literal
 * transcriptions of GeoSDoub (from CTKGeometry.zip), which the original
 * canvas called to complete the second triangle. The floating-point order is
 * kept so the port gives the same numbers as the applet.
 */
const DirectlySimilar2Core = (() => {
  /** The applet was embedded on its cut-the-knot page at 500 by 500 pixels. */
  const WIDTH = 500;
  const HEIGHT = 500;
  /** Only these six points are dragged; C' is rebuilt from the angles of ABC. */
  const NAMES = ["A", "B", "C", "A'", "B'", "P"];

  /* Java's int division truncates toward zero; the sizes used here are positive. */
  const div = (a, b) => Math.trunc(a / b);

  /**
   * DirectlySimilar2Canvas.init(), with integer arithmetic in the same order.
   * Other canvas sizes are accepted so the test can cover the layout method.
   */
  function start(options) {
    const w = Math.trunc(options && options.width !== undefined ? options.width : WIDTH);
    const h = Math.trunc(options && options.height !== undefined ? options.height : HEIGHT);
    return {
      width: w,
      height: h,
      points: [
        { x: div(w, 10), y: div(h, 3) },       // A
        { x: div(5 * w, 9), y: div(3 * h, 5) }, // B
        { x: div(w, 3), y: div(h, 5) },        // C
        { x: div(w, 8), y: div(2 * h, 3) },    // D = A'
        { x: div(3 * w, 8), y: div(3 * h, 4) }, // E = B'
        { x: div(3 * w, 4), y: div(2 * h, 3) }, // P
      ],
    };
  }

  /** A copy of the position with point `index` moved; no other point changes. */
  function movePoint(state, index, p) {
    if (!Number.isInteger(index) || index < 0 || index >= state.points.length) return state;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    const points = state.points.map((q) => ({ x: q.x, y: q.y }));
    points[index] = { x: p.x, y: p.y };
    return { width: state.width, height: state.height, points };
  }

  /* --------------------------------------------------- GeoSDoub primitives */

  const sqDist = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
  const dist = (a, b) => Math.sqrt(sqDist(a, b));

  /** Sign of the cross product (b-a) x (c-a), as GeoSDoub.FindOrientation. */
  function orientation(a, b, c) {
    const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return v > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle: the signed turn from a->b to a->c. */
  function signedAngle(a, b, c) {
    const top = sqDist(a, b) + sqDist(a, c) - sqDist(b, c);
    const co = top / 2 / dist(a, b) / dist(a, c);
    const turn = orientation(a, b, c);
    const ang = Math.acos(co);
    /* The original has an unreachable guard here (a sum of squares < 0). */
    if (ang > 0.99 && (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y) < 0) return Math.PI;
    return turn === 1 ? ang : -ang;
  }

  /** GeoSDoub.Rotate: rotate b about a through `angle`, with a sign. */
  function rotate(a, b, angle, sign) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return {
      x: a.x + cs * (b.x - a.x) - sign * sn * (b.y - a.y),
      y: a.y + sign * sn * (b.x - a.x) + cs * (b.y - a.y),
    };
  }

  /** GeoSDoub.Intersect(a,b,c,d): crossing of the two lines, or NaN points. */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
  }

  /**
   * DirectlySimilar2Canvas.CompleteTriangle(), separated from the canvas so
   * the test can feed it any five points. Only A'=D and B'=E are dragged;
   * C'=F is rebuilt from the two signed angles of ABC. Returns null for the
   * same cases the Java method returns null (or would draw nothing).
   */
  function completed(a, b, c, d, e) {
    if (dist(d, e) < 0.1 || dist(a, b) < 0.1) return null;
    const atA = signedAngle(a, b, c);
    const atB = signedAngle(b, a, c);
    const rayAtD = rotate(d, e, atA, 1);
    const rayAtE = rotate(e, d, atB, 1);
    const f = intersect(d, rayAtD, e, rayAtE);
    if (!f) return null;
    if (f.x === 0 && f.y === 0) return null;
    if (Number.isNaN(f.x) || Number.isNaN(f.y)) return null;
    return f;
  }

  /** F for the current position, or null when it cannot be completed. */
  function complete(state) {
    const p = state.points;
    return completed(p[0], p[1], p[2], p[3], p[4]);
  }

  /**
   * DirectlySimilar2Canvas.TranslateLines(): A1 = P + A - A', and so on.
   * The Java array is rewritten on every draw, so this returns plain points.
   */
  function translated(state, f) {
    const p = state.points;
    if (!f) return null;
    return [
      { x: p[5].x + p[0].x - p[3].x, y: p[5].y + p[0].y - p[3].y },
      { x: p[5].x + p[1].x - p[4].x, y: p[5].y + p[1].y - p[4].y },
      { x: p[5].x + p[2].x - f.x, y: p[5].y + p[2].y - f.y },
    ];
  }

  /** The three triangles the applet draws, in its own order. */
  function figures(state) {
    const p = state.points;
    const abc = [p[0], p[1], p[2]];
    const primedF = complete(state);
    const primed = primedF ? [p[3], p[4], primedF] : null;
    return { abc, primed, third: translated(state, primedF), f: primedF };
  }

  /* -------------------------------------------------- checking similarity */

  /** Complex division (a+ib)/(c+id), used to compare two ordered triangles. */
  function complexDiv(a, b) {
    const den = b.x * b.x + b.y * b.y;
    return { x: (a.x * b.x + a.y * b.y) / den, y: (a.y * b.x - a.x * b.y) / den };
  }

  /**
   * How far the two triangles are from being *directly* similar in the given
   * correspondence: the two complex ratios t1-t0 / u1-u0 and t2-t0 / u2-u0
   * must agree. Zero means an exact rotation-and-scaling copy; Infinity means
   * a degenerate triangle or a zero-length side.
   */
  function similarityError(t, u) {
    if (!t || !u || t.length !== 3 || u.length !== 3) return Infinity;
    const u1 = { x: u[1].x - u[0].x, y: u[1].y - u[0].y };
    const u2 = { x: u[2].x - u[0].x, y: u[2].y - u[0].y };
    if (Math.hypot(u1.x, u1.y) < 1e-9 || Math.hypot(u2.x, u2.y) < 1e-9) return Infinity;
    const t1 = { x: t[1].x - t[0].x, y: t[1].y - t[0].y };
    const t2 = { x: t[2].x - t[0].x, y: t[2].y - t[0].y };
    const r1 = complexDiv(t1, u1), r2 = complexDiv(t2, u2);
    return Math.hypot(r1.x - r2.x, r1.y - r2.y);
  }

  /** Largest difference between matching corner angles, in degrees. */
  function angleError(t, u) {
    if (!t || !u || t.length !== 3 || u.length !== 3) return Infinity;
    const at = (z, i) => {
      const prev = z[(i + 2) % 3], here = z[i], next = z[(i + 1) % 3];
      const a = { x: prev.x - here.x, y: prev.y - here.y };
      const b = { x: next.x - here.x, y: next.y - here.y };
      const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y);
      if (!na || !nb) return NaN;
      const co = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (na * nb)));
      return Math.acos(co) * 180 / Math.PI;
    };
    let worst = 0;
    for (let i = 0; i < 3; i++) {
      const d = Math.abs(at(t, i) - at(u, i));
      if (!Number.isFinite(d)) return Infinity;
      worst = Math.max(worst, d);
    }
    return worst;
  }

  const isDirectlySimilar = (t, u, eps) => {
    const tol = eps === undefined ? 1e-6 : eps;
    return similarityError(t, u) <= tol && angleError(t, u) <= tol * 100;
  };

  /** The line under the board: a measurement, never a win or a loss. */
  function describe(state) {
    const f = figures(state);
    if (!f.third) {
      return "Move A' away from B', and A away from B, to complete the second triangle.";
    }
    const deg = Math.max(angleError(f.third, f.abc), angleError(f.third, f.primed));
    if (!Number.isFinite(deg)) {
      return "A1B1C1 has collapsed to a point: the two triangles are translates of one another.";
    }
    const word = deg < 0.01 ? "exactly" : "nearly";
    return `A1B1C1 matches both triangles ${word}: matching corners differ by only ${deg.toFixed(3)} degrees. Drag a dot to try another pair.`;
  }

  /** An illustration has no win, loss or end. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, NAMES,
    start, movePoint,
    sqDist, dist, orientation, signedAngle, rotate, intersect,
    completed, complete, translated, figures,
    complexDiv, similarityError, angleError, isDirectlySimilar,
    describe, result,
  };
})();
