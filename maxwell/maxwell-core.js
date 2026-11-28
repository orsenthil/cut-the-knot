"use strict";

/*
 * Maxwell's theorem, from Alexander Bogomolny's applet Maxwell.
 *
 * Take a triangle ABC and any point P. Build a second triangle A'B'C' whose
 * sides follow the three lines AP, BP, CP: either parallel to them or at right
 * angles to them. Maxwell's theorem says the matching lines of A'B'C' -- the
 * ones parallel (or at right angles) to BC, CA, AB -- meet in one point P'.
 * The same fact, read backwards, is the symmetry of orthologic triangles.
 *
 * The one idea the code relies on is that every new point is an intersection
 * of two lines, so the whole construction is a few line intersections plus a
 * rescaling. The applet's own GeoSDoub.FindAltitude, GetParallelTo, Intersect,
 * FindCircumcenter, ComputeBarycenter and Scale are transcribed literally,
 * including the applet's 1-unit parallel test and its sign change when the
 * rôles of the two triangles are swapped.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, MaxwellCore, so the page loads it with a
 * plain <script> and porting/check-maxwell.mjs loads it in Node.
 *
 * The position is plain data (points, flags and numbers), so it can be saved
 * and handed to the tutor as it is. Every function returns a new position and
 * leaves the one it was given untouched.
 */
const MaxwellCore = (() => {
  const WIDTH = 600;      // the applet tag's WIDTH=600
  const HEIGHT = 450;     // the applet tag's HEIGHT=450
  const EPS = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clone = (p) => ({ x: p.x, y: p.y });

  /**
   * GeoSDoub.Intersect(a,b,c,d). The line coefficients and the absolute
   * one-unit test for parallel lines are the applet's, not a modernised version.
   */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindAltitude(p,a,b): the foot of the altitude from p onto ab. */
  function altitude(p, a, b) {
    return intersect(p, { x: p.x + b.y - a.y, y: p.y + a.x - b.x }, a, b);
  }

  /** GeoSDoub.GetParallelTo(a,b,c): a far point on the parallel through a. */
  function parallelPoint(a, b, c) {
    return { x: a.x + 100 * (b.x - c.x), y: a.y + 100 * (b.y - c.y) };
  }

  /** GeoSDoub.FindCircumcenter(a,b,c), as used for the opening point P. */
  function circumcenter(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const p1 = { x: m1.x + (b.y - a.y), y: m1.y - (b.x - a.x) };
    const p2 = { x: m2.x + (c.y - b.y), y: m2.y - (c.x - b.x) };
    return intersect(m1, p1, m2, p2);
  }

  const perimeter = (s, i) =>
    dist(s.A[i], s.B[i]) + dist(s.C[i], s.B[i]) + dist(s.A[i], s.C[i]);

  const centroid = (s, i) => ({
    x: (s.A[i].x + s.B[i].x + s.C[i].x) / 3,
    y: (s.A[i].y + s.B[i].y + s.C[i].y) / 3,
  });

  /** GeoSDoub.Scale(p, target, centre, factor) in the applet's argument order. */
  function scale(p, target, centre, factor) {
    return {
      x: target.x + (p.x - centre.x) * factor,
      y: target.y + (p.y - centre.y) * factor,
    };
  }

  /* ------------------------------------------------------ triangle updates */

  /** MaxwellCanvas.UpdateTriangleParallel(i), mutating a private copy. */
  function updateParallel(s, i) {
    const j = 1 - i;
    const Ai = s.A[i], Aj = s.A[j], Bj = s.B[j], Cj = s.C[j], Pj = s.P[j];
    let Ci;
    if (j === 0) {
      // The applet subtracts when rebuilding the base triangle and adds when
      // rebuilding the prime triangle. Keep the asymmetry.
      Ci = { x: Ai.x - (Bj.x - Pj.x), y: Ai.y - (Bj.y - Pj.y) };
    } else {
      Ci = { x: Ai.x + (Bj.x - Pj.x), y: Ai.y + (Bj.y - Pj.y) };
    }
    const t3 = parallelPoint(Ci, Aj, Pj);  // through C_i, parallel to A_jP_j
    const t4 = parallelPoint(Ai, Cj, Pj);  // through A_i, parallel to C_jP_j
    s.C[i] = Ci;                       // the Java canvas writes both fields first
    s.B[i] = intersect(Ai, t4, Ci, t3);
    const Bi = s.B[i];

    const factor = s.Pe / perimeter(s, i);
    const centre = centroid(s, i); // ComputeBarycenter(i), before scaling
    const Anew = scale(Ai, s.G[i], centre, factor);
    const Bnew = scale(Bi, s.G[i], centre, factor);
    const Cnew = scale(Ci, s.G[i], centre, factor);

    const t5 = parallelPoint(Anew, Bj, Cj); // through A_i, parallel to B_jC_j
    const t6 = parallelPoint(Bnew, Aj, Cj); // through B_i, parallel to A_jC_j
    const Pi = intersect(Anew, t5, Bnew, t6);

    s.A[i] = Anew; s.B[i] = Bnew; s.C[i] = Cnew; s.P[i] = Pi;
    return s;
  }

  /** MaxwellCanvas.UpdateTrianglePerpendicular(i), mutating a private copy. */
  function updatePerpendicular(s, i) {
    const j = 1 - i;
    const Ai = s.A[i], Aj = s.A[j], Bj = s.B[j], Cj = s.C[j], Pj = s.P[j];
    const Ci = { x: Ai.x + (Bj.y - Pj.y), y: Ai.y - (Bj.x - Pj.x) };
    const t3 = altitude(Ci, Aj, Pj);  // through C_i, perpendicular to A_jP_j
    const t4 = altitude(Ai, Cj, Pj);  // through A_i, perpendicular to C_jP_j
    s.C[i] = Ci;                      // the Java canvas writes both fields first
    s.B[i] = intersect(Ai, t4, Ci, t3);
    const Bi = s.B[i];

    const factor = s.Pe / perimeter(s, i);
    const centre = centroid(s, i);
    const Anew = scale(Ai, s.G[i], centre, factor);
    const Bnew = scale(Bi, s.G[i], centre, factor);
    const Cnew = scale(Ci, s.G[i], centre, factor);

    const t5 = altitude(Anew, Bj, Cj); // through A_i, perpendicular to B_jC_j
    const t6 = altitude(Bnew, Aj, Cj); // through B_i, perpendicular to A_jC_j
    const Pi = intersect(Anew, t5, Bnew, t6);

    s.A[i] = Anew; s.B[i] = Bnew; s.C[i] = Cnew; s.P[i] = Pi;
    return s;
  }

  function updateCopy(s, i) {
    return s.parallel ? updateParallel(s, i) : updatePerpendicular(s, i);
  }

  function copy(s) {
    return {
      width: s.width, height: s.height, parallel: s.parallel, target: s.target,
      Pe: s.Pe,
      A: s.A.map(clone), B: s.B.map(clone), C: s.C.map(clone),
      P: s.P.map(clone), G: s.G.map(clone),
    };
  }

  /** The position a new illustration starts from: MaxwellCanvas.init(). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const x0 = width / 3, y0 = height / 2;
    const s = Math.min(width, height) / 5;
    const at = (angle) => ({ x: x0 + s * Math.cos(angle), y: y0 + s * Math.sin(angle) });
    const s0 = {
      width, height, parallel: o.parallel !== false, target: 1, Pe: 0,
      A: [at(-1.6), { x: 0, y: 0 }],
      B: [at(-4.0), { x: 0, y: 0 }],
      C: [at(-0.2), { x: 0, y: 0 }],
      P: [circumcenter(at(-1.6), at(-4.0), at(-0.2)), { x: 0, y: 0 }],
      G: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    };
    s0.Pe = perimeter(s0, 0);
    s0.G[0] = centroid(s0, 0);
    s0.G[1] = { x: width - s0.G[0].x, y: s0.G[0].y };
    return updateCopy(s0, 1);
  }

  /** Move one stored point without running CheckForUpdate (a setup helper). */
  function place(state, name, q) {
    const m = /^([ABCP])([01])$/.exec(name);
    if (!m) return state;
    const s = copy(state);
    const letter = m[1], i = Number(m[2]);
    const at = letter === "A" ? s.A : letter === "B" ? s.B : letter === "C" ? s.C : s.P;
    at[i] = clone(q);
    return s;
  }

  /** MaxwellCanvas.UpdateTriangle(i) without a preceding drag. */
  function rebuild(state, i) {
    return updateCopy(copy(state), i);
  }

  /** MaxwellPanel.itemStateChanged: change the mode, update the same triangle. */
  function setParallel(state, parallel) {
    const s = copy(state);
    s.parallel = !!parallel;
    return updateCopy(s, s.target);
  }

  /** The applet's CheckForUpdate after one of its eight draggable points moves. */
  function movePoint(state, name, q) {
    const m = /^([ABCP])([01])$/.exec(name);
    if (!m) return state;
    const i = Number(m[2]);
    const s = copy(state);
    const letter = m[1];
    const at = letter === "A" ? s.A : letter === "B" ? s.B : letter === "C" ? s.C : s.P;
    at[i] = clone(q);

    // A, B or C of a triangle changes its perimeter; P does not.
    if (letter !== "P") {
      if (i === 0) s.Pe = perimeter(s, 0);
      else { s.Pe = perimeter(s, 1); }
    }
    s.G[i] = centroid(s, i);
    s.target = 1 - i;
    return updateCopy(s, s.target);
  }

  /** Dragging a whole MoveablePoly: translate A, B, C of one triangle. */
  function moveTriangle(state, i, delta) {
    const s = copy(state);
    for (const key of ["A", "B", "C"]) {
      s[key][i] = add(s[key][i], delta);
    }
    s.Pe = perimeter(s, i);
    s.G[i] = centroid(s, i);
    s.target = 1 - i;
    return updateCopy(s, s.target);
  }

  /* ------------------------------------------------------ measured claims */

  /** Line direction used for each matching cevian of triangle i. */
  function matchingDirection(s, i, vertex) {
    const j = 1 - i;
    const side = vertex === 0 ? sub(s.B[j], s.C[j])       // opposite A_j
      : vertex === 1 ? sub(s.A[j], s.C[j])                // opposite B_j
        : sub(s.A[j], s.B[j]);                            // opposite C_j
    return s.parallel ? side : { x: -side.y, y: side.x };
  }

  /** Residual of each of the three matching cevians through P_i, normalised. */
  function concurrency(s, i) {
    const j = 1 - i;
    const scale = Math.max(1, perimeter(s, j));
    const keys = ["A", "B", "C"];
    return keys.map((key, v) => {
      const dir = matchingDirection(s, i, v);
      const n = Math.hypot(dir.x, dir.y);
      if (!n || !Number.isFinite(n)) return NaN;
      return Math.abs(cross(sub(s.P[i], s[key][i]), dir)) / (n * scale);
    });
  }

  /** How well the sides of triangle i follow the cevians of triangle j. */
  function sideErrors(s, i) {
    const j = 1 - i;
    const pairs = [
      [sub(s.B[i], s.A[i]), sub(s.P[j], s.C[j])],
      [sub(s.C[i], s.B[i]), sub(s.P[j], s.A[j])],
      [sub(s.A[i], s.C[i]), sub(s.P[j], s.B[j])],
    ];
    const scale = Math.max(1, perimeter(s, j));
    return pairs.map(([u, v]) => {
      const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
      if (!nu || !nv) return NaN;
      const e = s.parallel ? Math.abs(cross(u, v)) : Math.abs(dot(u, v));
      return e / (nu * nv) * (Math.hypot(u.x, u.y) / scale);
    });
  }

  /**
   * The page's equation (3): a(c'-b') + b(a'-c') + c(b'-a') = 0, with the
   * real product of complex numbers read as the ordinary dot product.
   * rotate=true rotates the second triangle by a quarter turn about the
   * origin, which turns "parallel cevians" into "perpendicular cevians".
   */
  function orthologicSum(s, rotate) {
    const q = (p) => rotate ? { x: -p.y, y: p.x } : p;
    const ap = q(s.A[1]), bp = q(s.B[1]), cp = q(s.C[1]);
    return dot(s.A[0], sub(cp, bp)) + dot(s.B[0], sub(ap, cp)) + dot(s.C[0], sub(bp, ap));
  }

  /** Where a cevian of triangle i meets the opposite side, for drawing. */
  function cevianFoot(s, i, vertex) {
    const opposite = vertex === 0 ? [s.B[i], s.C[i]]
      : vertex === 1 ? [s.A[i], s.C[i]] : [s.A[i], s.B[i]];
    const from = vertex === 0 ? s.A[i] : vertex === 1 ? s.B[i] : s.C[i];
    return intersect(from, s.P[i], opposite[0], opposite[1]);
  }

  /** A short spoken description for the page's live status line. */
  function describe(s) {
    const e = concurrency(s, 1);
    const worst = Math.max(...e);
    const mode = s.parallel ? "Parallel" : "Perpendicular";
    if (!Number.isFinite(worst)) {
      return mode + ": this drag stretched the lines; move a dot to rebuild the picture.";
    }
    return mode + ": the lines through A', B', C' meet at P' (largest gap " + worst.toExponential(1) + ").";
  }

  return {
    start, setParallel, movePoint, moveTriangle, place, rebuild,
    perimeter, centroid, intersect, altitude, parallelPoint, circumcenter,
    matchingDirection, concurrency, sideErrors, orthologicSum,
    cevianFoot, describe, dist, dot, cross,
  };
})();
