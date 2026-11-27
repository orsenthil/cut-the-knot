"use strict";

/*
 * Deco Symmetry 3, from Alexander Bogomolny's applet DecoSymmetry3.
 *
 * The picture cuts a triangle into three kites and moves them, by rotations
 * and translations only, into the mirror image of the triangle. Every kite
 * has one corner at the incenter O and the opposite corner at a vertex; its
 * other two corners are the feet of the perpendiculars from O to the two
 * sides at that vertex. A reflection in the kite's own diagonal through O
 * and that vertex swaps the two feet, so the mirror of the whole picture is
 * obtained from the original kite by one rotation (or a translation when the
 * diagonals are parallel to the mirror line). Nothing is ever flipped.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, DecoSymmetry3Core, so the page loads it
 * with a plain <script> and porting/check-deco-symmetry-3.mjs loads it in Node.
 * The position is plain data so it can be saved and handed to the tutor.
 */
const DecoSymmetry3Core = (() => {
  // getParameterInfo says 400 by 250 "seems optimal"; those are the applet's
  // own canvas numbers and the SVG board uses the same viewBox.
  const WIDTH = 400;
  const HEIGHT = 250;
  const MARGIN = 12;
  const NSteps = 50; // DecoSymmetry3Canvas.NSteps
  const EPS = 1e-9;

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const mul = (p, k) => pt(p.x * k, p.y * k);
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /* The next functions are direct transcriptions of GeoSDoub's bytecode:
     FindOrientation, ComputeAngle, ComputeSignedAngle, Rotate, Intersect,
     FindIncenter and NearestPoint. Keeping their odd branches (an orientation
     of -1 for collinear points, the 0.1 early return in NearestPoint) means
     the core agrees with the Java construction, not just with the theorem. */

  function findOrientation(a, b, c) {
    return c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1;
  }

  function computeAngle(a, b, c) {
    const num = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / 2;
    return Math.acos(num / (dist(a, b) * dist(a, c)));
  }

  function computeSignedAngle(a, b, c) {
    const angle = computeAngle(a, b, c);
    return findOrientation(a, b, c) === 1 ? angle : -angle;
  }

  function rotate(a, b, angle, sign) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    return pt(
      a.x + cs * (b.x - a.x) - sign * sn * (b.y - a.y),
      a.y + sign * sn * (b.x - a.x) + cs * (b.y - a.y));
  }

  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, a2 = b.x - a.x, a3 = a.x * b.y - b.x * a.y;
    const b1 = c.y - d.y, b2 = d.x - c.x, b3 = c.x * d.y - d.x * c.y;
    const det = a2 * b1 - b2 * a1;
    if (Math.abs(det) < 1) return pt(NaN, NaN); // GeoSDoub.Intersect's guard
    return pt((a3 * b2 - b3 * a2) / det, (a1 * b3 - b1 * a3) / det);
  }

  /** The same point by side-length weights; used only if the Java bisectors
      lose precision on a very thin triangle. */
  function weightedIncenter(a, b, c) {
    const la = dist(b, c), lb = dist(c, a), lc = dist(a, b), total = la + lb + lc;
    if (!Number.isFinite(total) || total === 0) return pt(NaN, NaN);
    return pt((la * a.x + lb * b.x + lc * c.x) / total,
      (la * a.y + lb * b.y + lc * c.y) / total);
  }

  function findIncenter(a, b, c) {
    const orientation = findOrientation(a, b, c);
    const bisectorA = rotate(a, b, computeAngle(a, b, c) / 2, orientation);
    const bisectorB = rotate(b, c, computeAngle(b, c, a) / 2, orientation);
    const viaBisectors = intersect(a, bisectorA, b, bisectorB);
    const viaWeights = weightedIncenter(a, b, c);
    // GeoSDoub.Intersect guards with |det| < 1 and can return a quite wrong
    // point just above that guard. The weighted form is algebraically the
    // same incenter, so use it when the Java value is missing or inaccurate.
    const scale = Math.max(1, dist(a, b), dist(b, c), dist(c, a));
    return finitePoint(viaBisectors) && dist(viaBisectors, viaWeights) <= 1e-8 * scale
      ? viaBisectors : viaWeights;
  }

  function nearestPoint(p, a, b) {
    // GeoSDoub.NearestPoint has an early return when |a-p|^2 < 0.1. On a very
    // thin triangle the incenter lies within that distance of a vertex, which
    // makes a foot collapse onto O and contradicts the page's claim that the
    // dissection works for every triangle. Keep the guard only for an exact
    // coincidence, where the foot really is the vertex.
    if (sqDist(a, p) < 1e-12) return p;
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return pt(a.x + dx * t, a.y + dy * t);
  }

  function barycenter(points) {
    const sum = points.reduce((acc, p) => add(acc, p), pt(0, 0));
    return mul(sum, 1 / points.length);
  }

  function average(a, b, c) {
    return pt((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
  }

  /** The opening triangle: the applet's init() fractions of its canvas. */
  function start() {
    const third = WIDTH / 3;
    const half = HEIGHT / 2;
    const radius = Math.min(WIDTH, HEIGHT) / 3;
    const turn = 2 * Math.PI / 3;
    return {
      A: pt(third + radius - WIDTH / 6, half + HEIGHT / 8),
      B: pt(third + radius * Math.cos(turn), half - radius * Math.sin(turn)),
      C: pt(third + radius * Math.cos(2 * turn), half - WIDTH / 12 - radius * Math.sin(2 * turn)),
      showNames: false,
      showHint: false,
      moving: false,
      step: 0,
      moved: false,
    };
  }

  function clampPoint(q) {
    return pt(
      Math.max(MARGIN, Math.min(WIDTH - MARGIN, q.x)),
      Math.max(MARGIN, Math.min(HEIGHT - MARGIN, q.y)));
  }

  /** Move a vertex; a changed triangle is no longer a finished demonstration. */
  function move(s, name, q) {
    if (!["A", "B", "C"].includes(name) || !finitePoint(q)) return s;
    return Object.assign({}, s, {
      [name]: clampPoint(q), moving: false, step: 0, moved: false,
    });
  }

  /** The applet's two checkboxes. */
  function option(s, name, value) {
    if (!["showNames", "showHint"].includes(name)) return s;
    return Object.assign({}, s, { [name]: !!value, moving: false });
  }

  /**
   * Every point of the applet's Compute(), plus the rotation each of its three
   * MovingPieces needs. `valid` is false only for a collapsed triangle, where
   * the Java construction has NaNs and there is nothing to show.
   */
  function compute(s) {
    const { A, B, C } = s;
    const area = cross(sub(B, A), sub(C, A)) / 2;
    if (![A, B, C].every(finitePoint) || Math.abs(area) < 1e-6) {
      return { valid: false, A, B, C, pieces: [] };
    }
    const centroid = average(A, B, C);
    const mirror = (p) => pt(WIDTH - p.x, p.y);
    // Compute() sets P.y from the centroid and P.x = width - centroid.x.
    const P = pt(WIDTH - centroid.x, centroid.y);
    const Ap = mirror(A), Bp = mirror(B), Cp = mirror(C);

    const O = findIncenter(A, B, C);
    const D = nearestPoint(O, B, C);
    const E = nearestPoint(O, C, A);
    const F = nearestPoint(O, A, B);
    if (![O, D, E, F].every(finitePoint)) return { valid: false, A, B, C, pieces: [] };
    const Op = mirror(O), Dp = mirror(D), Ep = mirror(E), Fp = mirror(F);

    // The order of the final four points is the applet's MovingPieces order:
    // the two feet are swapped, because reflection in the kite's own diagonal
    // already exchanges them before the global mirror is applied.
    const definitions = [
      { name: "C", initial: [O, D, C, E], final: [Op, Ep, Cp, Dp], vertex: C, feet: [D, E] },
      { name: "A", initial: [O, E, A, F], final: [Op, Fp, Ap, Ep], vertex: A, feet: [E, F] },
      { name: "B", initial: [O, F, B, D], final: [Op, Dp, Bp, Fp], vertex: B, feet: [F, D] },
    ];
    const scale = Math.max(dist(A, B), dist(B, C), dist(C, A));
    const pieces = definitions.map((def) => {
      // SetRotatingPoly's angle: q = p1 + (f2 - f1), then the signed angle
      // p1-p2-q. The Java fallback for a NaN angle is PI.
      const q = add(def.initial[0], sub(def.final[1], def.final[0]));
      let angle = computeSignedAngle(def.initial[0], def.initial[1], q);
      if (!Number.isFinite(angle)) angle = Math.PI;
      const axis = sub(def.vertex, O);
      // Its rotation centre is where this kite's diagonal meets the mirror
      // line x = WIDTH/2. A parallel diagonal gives a pure translation.
      const center = Math.abs(axis.x) > EPS
        ? pt(WIDTH / 2, O.y + (WIDTH / 2 - O.x) * axis.y / axis.x)
        : null;
      const translation = center ? null : pt(WIDTH - 2 * O.x, 0);
      // The law-of-cosines angle loses precision when a nearly vertical
      // diagonal puts the centre far off the board. The same angle is
      // pi - 2*alpha for the diagonal's direction; use it only when the Java
      // value fails to bring the kite onto its mirror position.
      const landing = center
        ? Math.max(...def.initial.map((v, i) => dist(rotate(center, v, angle, 1),
          def.final[i])))
        : Math.max(...def.initial.map((v, i) => dist(add(v, translation), def.final[i])));
      if (!Number.isFinite(landing) || landing > 1e-7 * scale) {
        const algebraic = Math.PI - 2 * Math.atan2(axis.y, axis.x);
        angle = algebraic + 2 * Math.PI * Math.round((angle - algebraic) / (2 * Math.PI));
      }
      return {
        name: def.name,
        initial: def.initial,
        final: def.final,
        feet: def.feet,
        axis: def.axis || axis,
        angle,
        center,
        translation,
        start: barycenter(def.initial),
        goal: barycenter(def.final),
      };
    });
    if (!pieces.every((p) => finitePoint(p.center || p.translation) && Number.isFinite(p.angle))) {
      return { valid: false, A, B, C, pieces: [] };
    }
    const hintRadius = (dist(O, D) + dist(O, E) + dist(O, F)) / 3;
    return {
      valid: true, A, B, C, Ap, Bp, Cp, O, D, E, F, Op, Dp, Ep, Fp,
      P, centroid, pieces, hintRadius, area: Math.abs(area),
    };
  }

  /** The three kites at one moment of the Java animation (0 <= t <= 1). */
  function pose(piece, t) {
    const k = Math.max(0, Math.min(1, t));
    if (!piece.center) return piece.initial.map((v) => add(v, mul(piece.translation, k)));
    return piece.initial.map((v) => rotate(piece.center, v, piece.angle * k, 1));
  }

  function startMove(s) {
    return compute(s).valid ? Object.assign({}, s, { moving: true, step: 0, moved: false }) : s;
  }

  /** Advance the animation one of the applet's 50 steps. */
  function advance(s) {
    if (!s.moving) return s;
    const step = s.step + 1;
    return step >= NSteps
      ? Object.assign({}, s, { moving: false, step: NSteps, moved: true })
      : Object.assign({}, s, { step });
  }

  /** "done" is how the player's record hears that this demo was explored. */
  function result(s) {
    return s.moved ? "done" : null;
  }

  function describe(f, s) {
    if (!f.valid) return "Put the three corners so they make a proper triangle.";
    if (s.moved) {
      const angles = f.pieces.map((p) => Math.round(p.angle * 180 / Math.PI)).join(", ");
      return `Done: the three kites turned ${angles} degrees and now fill the mirror triangle. No piece was flipped.`;
    }
    if (s.moving) return `Turning the kites, step ${s.step} of ${NSteps}.`;
    return "Each piece is a kite: two sides reach the incenter O and two sides reach a corner. Press Move them to turn all three into the mirror triangle.";
  }

  return {
    WIDTH, HEIGHT, MARGIN, NSteps, EPS,
    add, sub, mul, cross, sqDist, dist, finitePoint,
    findOrientation, computeAngle, computeSignedAngle, rotate, intersect,
    findIncenter, nearestPoint, barycenter, average,
    start, clampPoint, move, option, compute, pose,
    startMove, advance, result, describe,
  };
})();
