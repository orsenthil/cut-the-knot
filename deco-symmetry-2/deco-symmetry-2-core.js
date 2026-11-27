"use strict";

/*
 * DecoSymmetry2 — the dissection behind Bogomolny's applet DecoSymmetry2.
 *
 * The page states the problem of Which Way Did the Bicycle Go? #9: cut any
 * triangle into pieces that, using only rotations and translations (no flips),
 * make the mirror image of the triangle. It says "It can be done in just two
 * cuts". The applet's Compute() shows one construction: name the vertex at the
 * largest angle A, drop the perpendicular AD to the opposite side BC, and cut
 * from D to the midpoints E of AB and F of AC. That gives three pieces — the
 * triangle EBD, the quadrilateral FAED and the triangle FDC — so two straight
 * cuts suffice. The mirror triangle is drawn by reflecting every point in the
 * vertical middle line of the canvas; each piece is sent to the corresponding
 * piece of that mirror by a rotation and a translation, never by a flip.
 *
 * This differs from the sibling DecoSymmetry: that applet splits the general
 * triangle into four pieces and has a "special acute" switch that uses the
 * circumcenter instead. DecoSymmetry2 has neither: it joins the two triangles
 * at A into one quadrilateral and uses the foot D for every triangle.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, DecoSymmetry2Core, so the page loads it with a plain
 * <script> and porting/check-deco-symmetry-2.mjs loads it in Node. All points
 * are plain {x, y} objects; functions take plain data and return new objects.
 */
const DecoSymmetry2Core = (() => {
  const EPS = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist2 = (p, q) => Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2);
  const dist = (p, q) => Math.sqrt(dist2(p, q));
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const centroid = (p, q, r) => ({
    x: (p.x + q.x + r.x) / 3,
    y: (p.y + q.y + r.y) / 3,
  });
  const barycenter = (points) => {
    let x = 0, y = 0;
    for (const p of points) { x += p.x; y += p.y; }
    return { x: x / points.length, y: y / points.length };
  };

  /** GeoSDoub.ComputeAngle: the angle at p, by the law of cosines. */
  function angleAt(p, q, r) {
    const pq = dist(p, q), pr = dist(p, r);
    if (!pq || !pr) return 0;
    const c = (dist2(p, q) + dist2(p, r) - dist2(q, r)) / (2 * pq * pr);
    return Math.acos(c);
  }

  /** GeoSDoub.NearestPoint(A, B, C): the foot of the perpendicular from A to BC. */
  function nearestPoint(a, b, c) {
    if (dist2(b, a) < 0.1) return { x: a.x, y: a.y };
    const dx = c.x - b.x, dy = c.y - b.y;
    const t = ((a.x - b.x) * dx + (a.y - b.y) * dy) / (dx * dx + dy * dy);
    return { x: b.x + dx * t, y: b.y + dy * t };
  }

  /** Signed area of a polygon; positive for one winding, negative for the other. */
  function signedArea(points) {
    let twice = 0;
    for (let i = 0; i < points.length; i++) {
      const q = points[i], r = points[(i + 1) % points.length];
      twice += q.x * r.y - r.x * q.y;
    }
    return twice / 2;
  }

  const area = (points) => Math.abs(signedArea(points));

  /* ------------------------------------------------------------ the position */

  /**
   * The starting triangle, as DecoSymmetry2Canvas.init places it on the
   * applet's 500x400 canvas: K = (W/3 + r - W/6, H/2 + H/8),
   * L = (W/3 + r cos 120°, H/2 - r sin 120°),
   * M = (W/3 + r cos 240° - W/12, H/2 - r sin 240°), r = min(W, H)/3.
   */
  function start(width = 500, height = 400) {
    const cx = width / 3, cy = height / 2;
    const r = Math.min(width, height) / 3;
    const t = 2 * Math.PI / 3;
    return {
      width: width,
      height: height,
      K: { x: cx + r - width / 6, y: cy + height / 8 },
      L: { x: cx + r * Math.cos(t), y: cy - r * Math.sin(t) },
      M: { x: cx + r * Math.cos(2 * t) - width / 12, y: cy - r * Math.sin(2 * t) },
    };
  }

  /** A new position with one corner moved. `state` is never changed. */
  function withPoint(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name)) return state;
    return Object.assign({}, state, { [name]: { x: p.x, y: p.y } });
  }

  /** FindLargestAngle(): the literal three >= tests, in the applet's order. */
  function largestAngle(state) {
    const a = angleAt(state.K, state.L, state.M);
    const b = angleAt(state.L, state.M, state.K);
    const c = angleAt(state.M, state.L, state.K);
    let A = state.K, B = state.L, C = state.M;
    if (a >= b && a >= c) { A = state.K; B = state.L; C = state.M; }
    if (b >= a && b >= c) { A = state.L; B = state.M; C = state.K; }
    if (c >= a && c >= b) { A = state.M; B = state.K; C = state.L; }
    return { A: A, B: B, C: C, angles: [a, b, c] };
  }

  /**
   * Compute(): A at the largest angle, D the foot on BC, E/F the midpoints of
   * AB/AC; the same points on the reflected triangle; and the three source
   * pieces paired with their three destinations. The target vertex orders are
   * the reverse of the reflected source orders, which is what makes each move
   * a rotation rather than a flip.
   */
  function compute(state) {
    const largest = largestAngle(state);
    const A = largest.A, B = largest.B, C = largest.C;
    const avg = centroid(A, B, C);
    const P = { x: state.width - avg.x, y: avg.y };
    const mirror = (p) => ({ x: P.x - (p.x - avg.x), y: P.y + (p.y - avg.y) });
    const Ap = mirror(A), Bp = mirror(B), Cp = mirror(C);

    const D = nearestPoint(A, B, C);
    const E = midpoint(A, B);
    const F = midpoint(A, C);
    const Dp = nearestPoint(Ap, Bp, Cp);
    const Ep = midpoint(Ap, Bp);
    const Fp = midpoint(Ap, Cp);

    const pieces = [
      [E, B, D],
      [F, A, E, D],
      [F, D, C],
    ];
    const targets = [
      [Ep, Dp, Bp],
      [Fp, Dp, Ep, Ap],
      [Fp, Cp, Dp],
    ];
    return {
      A: A, B: B, C: C, P: P,
      Ap: Ap, Bp: Bp, Cp: Cp,
      D: D, E: E, F: F,
      Dp: Dp, Ep: Ep, Fp: Fp,
      pieces: pieces,
      targets: targets,
      cuts: [[D, E], [D, F]],
      angles: largest.angles,
    };
  }

  /**
   * The rotation/translation taking a source piece onto its target. The angle
   * is measured from the first edge of each polygon to the first edge of the
   * destination, as in SetRotatingPoly() and ComputeSignedAngle().
   */
  function motion(piece, target) {
    const center = barycenter(piece);
    const goal = barycenter(target);
    const u = sub(piece[1], piece[0]);
    const v = sub(target[1], target[0]);
    const angle = Math.atan2(cross(u, v), dot(u, v));
    return { source: piece, center: center, goal: goal, angle: angle };
  }

  /** Where the moving piece is at t=0 (source) or t=1 (exact target). */
  function place(m, t) {
    const a = m.angle * t;
    const co = Math.cos(a), si = Math.sin(a);
    const shift = {
      x: (m.goal.x - m.center.x) * t,
      y: (m.goal.y - m.center.y) * t,
    };
    return m.source.map((p) => {
      const dx = p.x - m.center.x, dy = p.y - m.center.y;
      return {
        x: m.center.x + dx * co - dy * si + shift.x,
        y: m.center.y + dx * si + dy * co + shift.y,
      };
    });
  }

  /** GeoSDoub.ComputeSignedAngle, kept separate for the logic test. */
  function signedAngle(p, q, r) {
    const pq = dist(p, q), pr = dist(p, r);
    if (!pq || !pr) return 0;
    let c = (dist2(p, q) + dist2(p, r) - dist2(q, r)) / (2 * pq * pr);
    const orientation = cross(sub(q, p), sub(r, p)) > 0 ? 1 : -1;
    const a = Math.acos(Math.max(-1, Math.min(1, c)));
    if (a > 0.99 && dot(sub(q, p), sub(q, p)) === 0) return Math.PI;
    return orientation * a;
  }

  /**
   * Does a rotation plus a translation (never a reflection) take every vertex
   * of `piece` onto the matching vertex of `target`?
   */
  function rotationMatches(piece, target) {
    if (piece.length !== target.length || piece.length < 2) return false;
    const m = motion(piece, target);
    const at = place(m, 1);
    const scale = Math.max(1, ...piece.map((p) => dist(p, m.center)));
    const tol = 1e-7 * scale;
    for (let i = 0; i < at.length; i++) {
      if (dist(at[i], target[i]) > tol) return false;
    }
    // A flip would reverse the winding of the polygon.
    if (Math.sign(signedArea(piece)) !== Math.sign(signedArea(target))) return false;
    return true;
  }

  /** The measurements and claims used by the page and by the logic test. */
  function measurements(state) {
    const c = compute(state);
    const triArea = area([c.A, c.B, c.C]);
    const mirrorArea = area([c.Ap, c.Bp, c.Cp]);
    const sourceAreas = c.pieces.map(area);
    const targetAreas = c.targets.map(area);
    const bc = sub(c.C, c.B);
    const footT = bc.x ? (c.D.x - c.B.x) / bc.x : (bc.y ? (c.D.y - c.B.y) / bc.y : NaN);
    return {
      construction: c,
      triangleArea: triArea,
      mirrorArea: mirrorArea,
      sourceAreas: sourceAreas,
      targetAreas: targetAreas,
      footT: footT,
      footOnSide: Number.isFinite(footT) && footT >= -1e-7 && footT <= 1 + 1e-7,
      rightAngle: Math.abs(dot(sub(c.A, c.D), bc)) <= 1e-6 * dist(c.A, c.D) * dist(c.B, c.C),
      pieces: c.pieces.length,
      cuts: c.cuts.length,
      partition: triArea > 1e-6 &&
        Math.abs(sourceAreas.reduce((a, b) => a + b, 0) - triArea) <= 1e-7 * triArea &&
        Math.abs(targetAreas.reduce((a, b) => a + b, 0) - mirrorArea) <= 1e-7 * mirrorArea,
      rotations: c.pieces.map((p, i) => rotationMatches(p, c.targets[i])),
    };
  }

  return {
    start: start,
    withPoint: withPoint,
    largestAngle: largestAngle,
    compute: compute,
    motion: motion,
    place: place,
    signedAngle: signedAngle,
    rotationMatches: rotationMatches,
    measurements: measurements,
    angleAt: angleAt,
    nearestPoint: nearestPoint,
    signedArea: signedArea,
    area: area,
    barycenter: barycenter,
  };
})();
