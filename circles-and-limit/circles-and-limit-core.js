"use strict";

/*
 * Two Circles and a Limit — the logic behind Alexander Bogomolny's
 * `CirclesAndLimit` applet.
 *
 * A fixed circle of radius a = 3 is centred at S = (a, 0) = (3, 0), so it
 * passes through the origin O = (0, 0). A second circle is centred at O and
 * has a variable radius r (0 < r <= 2a). It meets the positive y-axis at
 * A = (0, r) and the negative one at C = (0, -r). The two circles meet in the
 * upper half-plane at B. Extend the line AB until it crosses the x-axis at E.
 * The surprising fact is that E does not run off to infinity as r shrinks:
 * it approaches the fixed point (4a, 0) = (12, 0).
 *
 * The one idea the code relies on is the closed form for that crossing. The
 * circles meet where x = r^2/(2a) and y = r*sqrt(1 - (r/(2a))^2); putting
 * A = (0, r) and B together, the line AB cuts y = 0 at
 *     x_E = 2a (1 + sqrt(1 - (r/(2a))^2)),
 * which tends to 4a as r -> 0. The applet encodes the same fact twice: its
 * geometric construction draws the point, and when AB is parallel to the
 * axis (r -> 0) it falls back to E.x = O.x + 4 * (stationary radius).
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, CirclesAndLimitCore, so the page loads it
 * with a plain <script> and porting/check-circles-and-limit.mjs loads it in
 * Node. The position is plain JSON (numbers, booleans, strings, arrays and
 * plain objects) so it can be saved and handed to the tutor as it is.
 */
const CirclesAndLimitCore = (() => {
  const DEFAULT_A = 3; // the puzzle's fixed circle: radius 3, centre (3, 0)
  const DEFAULT_R = 2; // a comfortable opening radius
  const R_MIN = 0.1; // the smallest radius the on-screen slider reaches
  const R_MAX = 2 * DEFAULT_A; // beyond 2a the circles stop meeting

  const EPS = 1e-12;
  const PROOFS = [1, 2, 3];

  /** The radius is only drawable while the two circles actually meet. */
  function validR(a, r) {
    return Number.isFinite(a) && a > 0 &&
      Number.isFinite(r) && r > 0 && r <= 2 * a + EPS;
  }

  /** The position a new exploration starts from. */
  function start(options) {
    const opt = options || {};
    const a = Number.isFinite(opt.a) && opt.a > 0 ? Number(opt.a) : DEFAULT_A;
    let r = Number(opt.r);
    if (!validR(a, r)) r = Math.min(DEFAULT_R, 2 * a);
    return {
      a,
      r,
      showNames: opt.showNames === true,
      showHint: opt.showHint === true,
      proof: PROOFS.indexOf(opt.proof) >= 0 ? opt.proof : 1,
      explored: false,
    };
  }

  /* ------------------------------------------------------ geometry helpers */

  /** The two crossings of circles (c0,r0) and (c1,r1), or null if none. */
  function circleIntersections(c0, r0, c1, r1) {
    const dx = c1.x - c0.x;
    const dy = c1.y - c0.y;
    const d = Math.hypot(dx, dy);
    if (!(d > 0) || d > r0 + r1 + EPS || d < Math.abs(r0 - r1) - EPS) return null;
    const along = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h2 = r0 * r0 - along * along;
    if (h2 < -EPS) return null;
    const h = Math.sqrt(Math.max(0, h2));
    const bx = c0.x + (along * dx) / d;
    const by = c0.y + (along * dy) / d;
    const px = (-dy / d) * h;
    const py = (dx / d) * h;
    return [{ x: bx + px, y: by + py }, { x: bx - px, y: by - py }];
  }

  /**
   * Intersection of the lines p0p1 and p2p3, using the same homogeneous
   * coefficients as GeoSDoub.Intersect in the applet. A near-zero determinant
   * means "parallel" (the applet used a screen-space threshold of 1; here the
   * units are mathematical, so a small epsilon does the same job).
   */
  function lineIntersect(p0, p1, p2, p3) {
    const a1 = p0.y - p1.y;
    const b1 = p1.x - p0.x;
    const c1 = p0.x * p1.y - p0.y * p1.x;
    const a2 = p2.y - p3.y;
    const b2 = p3.x - p2.x;
    const c2 = p2.x * p3.y - p2.y * p3.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < EPS) return null;
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** Where the line p0p1 cuts a circle — used by the third geometric proof. */
  function lineCircleIntersections(p0, p1, centre, radius) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (!(len > 0)) return null;
    const ux = dx / len;
    const uy = dy / len;
    const fx = p0.x - centre.x;
    const fy = p0.y - centre.y;
    const b = 2 * (fx * ux + fy * uy);
    const c = fx * fx + fy * fy - radius * radius;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    return [
      { x: p0.x + ((-b + root) / 2) * ux, y: p0.y + ((-b + root) / 2) * uy },
      { x: p0.x + ((-b - root) / 2) * ux, y: p0.y + ((-b - root) / 2) * uy },
    ];
  }

  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** Of two crossings, the one farther from ref (the applet's Other()). */
  function other(points, ref) {
    if (!points) return null;
    return dist(points[0], ref) >= dist(points[1], ref) ? points[0] : points[1];
  }

  /* ------------------------------------------------------------ closed form */

  const sOf = (r, a) => Math.sqrt(Math.max(0, 1 - Math.pow(r / (2 * a), 2)));
  const xOfE = (r, a) => 2 * a * (1 + sOf(r, a)); // the crossing, in closed form
  const limitX = (a) => 4 * a; // where it ends up as r -> 0

  /**
   * All the points of the picture in mathematical coordinates (y up).
   * Mirrors Compute() and Compute1/2/3() of CirclesAndLimitCanvas.
   */
  function compute(state) {
    const a = state.a;
    const r = state.r;
    const O = { x: 0, y: 0 };
    const S = { x: a, y: 0 };
    const limit = { x: limitX(a), y: 0 };
    const A = { x: 0, y: r };
    let C = { x: 0, y: -r };

    const pts = circleIntersections(O, r, S, a);
    if (!pts) {
      return { valid: false, O, S, A, B: null, C, E: limit, D: null, F: null, limit };
    }
    const B = pts[0].y >= pts[1].y ? pts[0] : pts[1];

    let E = lineIntersect(A, B, O, S);
    if (!E || !Number.isFinite(E.x)) E = { x: O.x + 4 * a, y: O.y };

    let D = null;
    let F = null;
    if (state.proof === 1) {
      D = lineIntersect(B, C, O, S);
      F = { x: S.x + a, y: O.y };
    } else if (state.proof === 2) {
      D = midpoint(O, B);
      F = midpoint(A, B);
    } else if (state.proof === 3) {
      F = midpoint(A, B);
      // the second place the ray OF meets the fixed circle, not O itself
      D = other(lineCircleIntersections(O, F, S, a), O);
      // Compute3 in the applet relabels this right-hand point as C
      C = { x: S.x + a, y: O.y };
    }
    return { valid: true, O, S, A, B, C, E, D, F, limit };
  }

  /* ------------------------------------------------------------ interaction */

  function setR(state, r) {
    if (!validR(state.a, r)) return state;
    return Object.assign({}, state, { r: Number(r), explored: true });
  }
  function setShowNames(state, value) {
    return Object.assign({}, state, { showNames: value === true, explored: true });
  }
  function setShowHint(state, value) {
    return Object.assign({}, state, { showHint: value === true, explored: true });
  }
  function setProof(state, proof) {
    if (PROOFS.indexOf(proof) < 0) return state;
    return Object.assign({}, state, { proof, explored: true });
  }

  /** A demo has no winner: it is finished once the player has explored it. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  /** A sentence in words saying what changed, for #status. */
  function describe(action, state) {
    const pic = compute(state);
    const ex = pic.valid ? pic.E.x : limitX(state.a);
    const target = limitX(state.a);
    switch (action) {
      case "r":
        return "The small circle now has radius r = " + state.r.toFixed(2) +
          ". Point E is at x = " + ex.toFixed(2) + ", on its way to the limit at " + target + ".";
      case "names":
        return state.showNames ? "The point names are now shown." : "The point names are now hidden.";
      case "hint":
        return state.showHint
          ? "The hint is on: points D and F are the helpers that explain the limit at " + target + "."
          : "The hint is off; only the two circles and the line AB are drawn.";
      case "proof":
        return "Showing geometric proof " + state.proof + " of the limit.";
      case "reset":
        return "Back to the start: the small circle has radius r = " + state.r.toFixed(2) + ".";
      default:
        return "";
    }
  }

  return {
    DEFAULT_A, DEFAULT_R, R_MIN, R_MAX,
    validR, start,
    circleIntersections, lineIntersect, lineCircleIntersections, midpoint, dist, other,
    sOf, xOfE, limitX, compute,
    setR, setShowNames, setShowHint, setProof, result, describe,
  };
})();
