"use strict";

/*
 * General Polygon Construction, from Bogomolny's applet GenCon.
 *
 * Given points M_1..M_n and angles a_1..a_n, the desired polygon A_1..A_n has
 * each triangle A_i M_i A_{i+1} isosceles with apex angle a_i at M_i. Rotating
 * a point successively about M_1 by a_1, then M_2 by a_2, ... composes into a
 * single direct isometry: a rotation by the total angle about a fixed point
 * (unless the total is a multiple of 360 degrees, when it is a translation or
 * the identity and the construction breaks down).
 *
 * The key idea is that A_1 is that fixed point. The logic test checks the
 * rotation composition, the fixed point, the isosceles triangles and the
 * special cases for the problems on the applet's page (60, 90, 180 degrees).
 *
 * No document, no window, no storage: one global, GenConConstructionCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const GenConConstructionCore = (() => {
  const DEG = Math.PI / 180;

  function rotate(p, center, degrees) {
    const a = degrees * DEG;
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return {
      x: center.x + dx * c - dy * s,
      y: center.y + dx * s + dy * c,
    };
  }

  /** Compose the rotations about all n points, in order. */
  function compose(start, points, angles) {
    let p = { x: start.x, y: start.y };
    for (let i = 0; i < points.length; i++) p = rotate(p, points[i], angles[i] || 0);
    return p;
  }

  function totalAngle(angles) {
    return angles.reduce((a, b) => a + b, 0);
  }

  /** Linear (rotational) part of the composite map: a rotation by the total. */
  function linearPart(degrees) {
    const a = degrees * DEG;
    return { c: Math.cos(a), s: Math.sin(a) };
  }

  /**
   * The fixed point of the composite affine map x -> R*x + t. Sample two
   * points to recover t, then solve (I - R) F = t.
   */
  function fixedPoint(points, angles) {
    const total = totalAngle(angles);
    const normalized = ((total % 360) + 360) % 360;
    if (Math.abs(normalized) < 1e-9 || Math.abs(normalized - 360) < 1e-9) return null;
    const { c, s } = linearPart(total);
    const p0 = { x: 0, y: 0 };
    const p1 = compose(p0, points, angles);
    const t = { x: p1.x, y: p1.y }; // R*p0 = 0
    const a11 = 1 - c;
    const a12 = s;
    const a21 = -s;
    const a22 = 1 - c;
    const det = a11 * a22 - a12 * a21;
    if (Math.abs(det) < 1e-12) return null;
    return {
      x: (a22 * t.x - a12 * t.y) / det,
      y: (-a21 * t.x + a11 * t.y) / det,
    };
  }

  /** The polygon vertex A_{i+1} is the rotation of A_i about M_i by a_i. */
  function polygon(points, angles) {
    const a1 = fixedPoint(points, angles);
    if (!a1) return null;
    const vertices = [a1];
    let at = a1;
    for (let i = 0; i < points.length; i++) {
      at = rotate(at, points[i], angles[i] || 0);
      vertices.push(at);
    }
    return vertices;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function start() {
    // The classic second Yaglom problem: centres of outward squares on a
    // triangle, with angles 90 degrees.
    return {
      points: [{ x: 100, y: 300 }, { x: 320, y: 300 }, { x: 200, y: 110 }],
      angles: [90, 90, 90],
      total: 270,
    };
  }

  function setAngle(state, index, value) {
    const angles = state.angles.slice();
    angles[index] = Math.max(-360, Math.min(360, Math.trunc(Number(value)) || 0));
    return { ...state, angles, total: totalAngle(angles) };
  }

  function movePoint(state, index, p) {
    const points = state.points.slice();
    points[index] = { x: p.x, y: p.y };
    return { ...state, points };
  }

  return { DEG, rotate, compose, totalAngle, linearPart, fixedPoint, polygon, dist, start, setAngle, movePoint };
})();
