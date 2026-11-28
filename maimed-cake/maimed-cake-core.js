"use strict";

/*
 * Maimed Cake, from Alexander Bogomolny's applet MaimedCake.
 *
 * A rectangle ABCD has a smaller rectangle UZRD cut off at corner D. The
 * applet draws a straight cut from B to Q (or the parallel cut P→Q) and
 * colours the two pieces of the remaining L-shape. Its first approximation
 * is the line BZ, extended to meet CD or AD at M; the horizontal or vertical
 * through M meets ZU or ZR at L and the far side at K. Adding the triangle
 * BZQ, whose area is half the little rectangle AKLU (or KLRC), fixes the
 * imbalance. The parallel cut translates the whole segment BZ by half of
 * that same small vector, so BP = ZQ and the cut stays parallel to BZ.
 *
 * This file is only the geometry: no document, no window, no storage. It
 * defines one global, MaimedCakeCore. Intersections use the same 1-unit
 * determinant guard as GeoSDoub.Intersect, and the inset used to reject a
 * bad drag is the applet's VerifyZ polygon (ten units in from each corner).
 */
const MaimedCakeCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const INSET = 10;
  const PARALLEL = 100;

  const copy = (p) => ({ x: p.x, y: p.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clampToBoard = (p) => ({
    x: clamp(p.x, 0, WIDTH),
    y: clamp(p.y, 0, HEIGHT),
  });
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });
  const midHalf = (p, q) => scale(sub(p, q), 0.5);

  /* GeoSDoub.GetParallelTo(p,a,b): 100 times the vector a→b from p. */
  function parallel(p, a, b) {
    return add(p, scale(sub(a, b), PARALLEL));
  }

  /* GeoSDoub.Intersect(p1,p2,p3,p4), with its |determinant| < 1 NaN guard. */
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
  }

  /* InsideTest.IsInside(a,b,c): the angle at a is at least a right angle. */
  function isInside(a, b, c) {
    return (a.x - b.x) * (a.x - c.x) + (a.y - b.y) * (a.y - c.y) <= 0;
  }

  /* Signed shoelace area, and its absolute value for the coloured pieces. */
  function signed(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      s += p.x * q.y - q.x * p.y;
    }
    return s / 2;
  }
  const area = (points) => Math.abs(signed(points));
  const triangle = (p, q, r) => area([p, q, r]);
  const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

  /* The four corners of the applet's VerifyZ polygon, rounded as its
     java.awt.Polygon.addPoint(Math.round(...)) does. */
  function inset(s) {
    const ac = sub(s.C, s.A), bd = sub(s.D, s.B);
    const u = scale(ac, INSET / Math.hypot(ac.x, ac.y));
    const v = scale(bd, INSET / Math.hypot(bd.x, bd.y));
    const round = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });
    return [round(add(s.A, u)), round(add(s.B, v)),
      round(sub(s.C, u)), round(sub(s.D, v))];
  }

  /* Even-odd crossing test for the (convex, axis-aligned) inset polygon. */
  function contains(poly, p) {
    let hits = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a.y > p.y) !== (b.y > p.y)) {
        const x = a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y);
        if (x > p.x) hits++;
      }
    }
    return (hits & 1) === 1;
  }

  function verifyZ(s, p) {
    const q = p || s.Z;
    return finite(q) && contains(inset(s), { x: Math.round(q.x), y: Math.round(q.y) });
  }

  /* UpdateCoefficientX/Y from the bytecode: the 0.1 guards come first. */
  function coefficient(b, d, z) {
    const num = b - d, den = z - d;
    if (Math.abs(num) < 0.1) return Math.abs(den) < 0.1 ? 1 : 100000;
    return den / num;
  }

  function withCoefficients(s) {
    return Object.assign({}, s, {
      xc: coefficient(s.B.x, s.D.x, s.Z.x),
      yc: coefficient(s.B.y, s.D.y, s.Z.y),
    });
  }

  /* UpdateZ: Z sits on the line BD at the saved fractions of B-D. */
  function withZ(s) {
    const z = {
      x: s.xc * s.B.x + (1 - s.xc) * s.D.x,
      y: s.yc * s.B.y + (1 - s.yc) * s.D.y,
    };
    return Object.assign({}, s, { Z: z });
  }

  /** A fixed, reproducible picture, in the branch the article describes. */
  function start(options) {
    const o = options || {};
    const s = {
      A: { x: 60, y: 55 }, B: { x: 60, y: 245 },
      C: { x: 340, y: 245 }, D: { x: 340, y: 55 },
      para: o.para === undefined ? true : !!o.para,
      showHint: o.showHint === undefined ? true : !!o.showHint,
      showNames: o.showNames === undefined ? true : !!o.showNames,
      explored: false,
      xc: 0.35, yc: 0.62,
    };
    return withZ(s);
  }

  /* The applet's init(): pick the two corner positions at random, keep the
     sides parallel to the screen, and place Z at its initial 0.2/0.3 fractions. */
  function randomize(s) {
    const ax = 20 + 5 * Math.random();              // 20 + 20*random*(W/2)/4
    const ay = 20 + 7.5 * Math.random();            // 20 + 20*random*(H/2)/4
    const next = {
      A: { x: ax, y: ay }, B: { x: ax, y: HEIGHT - ay },
      C: { x: WIDTH - ax, y: HEIGHT - ay }, D: { x: WIDTH - ax, y: ay },
      para: s.para, showHint: s.showHint, showNames: s.showNames,
      explored: false, xc: 0.2, yc: 0.3,
    };
    return withZ(next);
  }

  /** Back to the fixed picture, keeping the player's options. */
  function reset(s) {
    return start({ para: s.para, showHint: s.showHint, showNames: s.showNames });
  }

  /* One handle moved. A, B and C have Fix(2) in the applet: only x changes.
     Redefine(C,B,A,D) after A or B, Redefine(A,D,C,B) after C. Moving B also
     moves Z at fixed coefficients; moving Z updates the coefficients. A move
     that leaves Z outside the ten-unit inset is refused, as VerifyZ refuses
     it in the applet. */
  function movePoint(s, name, p) {
    if (!["A", "B", "C", "D", "Z"].includes(name) || !finite(p)) return s;
    const q = clampToBoard(p);
    let next = Object.assign({}, s, {
      A: copy(s.A), B: copy(s.B), C: copy(s.C), D: copy(s.D), Z: copy(s.Z),
    });
    if (name === "Z") {
      next.Z = q;
      next = withCoefficients(next);
    } else {
      const moved = { x: q.x, y: s[name].y };
      if (name === "A") {
        next.A = moved;
        next.C = add(s.B, sub(s.D, moved));        // Redefine(C,B,A,D): B + D - A
      } else if (name === "B") {
        next.B = moved;
        next.C = add(moved, sub(s.D, s.A));        // Redefine(C,B,A,D): B + D - A
        next = withZ(next);
      } else {
        next[name] = moved;
        next.A = add(s.D, sub(s.B, moved));        // Redefine(A,D,C,B): D + B - C
      }
    }
    /* The applet only asks VerifyZ; it does not pull a dependent corner back
       into the canvas. The page's handles clamp the pointer before calling
       here, so the visible diagram stays on the board. */
    const corners = [next.A, next.B, next.C, next.D, next.Z];
    if (corners.some((v) => !finite(v))) return s;
    if (!verifyZ(next, next.Z)) return s;
    return Object.assign(next, { explored: true });
  }

  function setOption(s, key, value) {
    if (!["para", "showHint", "showNames"].includes(key)) return s;
    return Object.assign({}, s, { [key]: !!value, explored: true });
  }

  /** Every point and area the page draws, straight from the applet's code. */
  function compute(s) {
    const { A, B, C, D, Z } = s;
    const U = intersect(Z, parallel(Z, A, B), A, D);
    const R = intersect(Z, parallel(Z, A, D), C, D);
    const hitCD = intersect(C, D, B, Z);
    const hitAD = intersect(A, D, B, Z);
    const below = isInside(hitCD, B, hitAD);

    let M, K, L, P, Q, piece1, piece2, leftover;
    const shift = s.para ? 0.5 : 1;
    if (below) {
      M = intersect(B, Z, C, D);
      const throughM = parallel(M, B, C);
      L = intersect(M, throughM, Z, U);
      K = intersect(M, throughM, A, B);
      const v = scale(sub(U, L), shift);
      Q = add(Z, v);
      P = s.para ? add(B, v) : B;
      piece1 = [A, P, Q, U];
      piece2 = [P, B, C, R, Z, Q];
      leftover = [A, K, L, U];
    } else {
      M = intersect(B, Z, A, D);
      const throughM = parallel(M, B, A);
      L = intersect(M, throughM, Z, R);
      K = intersect(M, throughM, C, B);
      const v = scale(sub(R, L), shift);
      Q = add(Z, v);
      P = s.para ? add(B, v) : B;
      piece1 = [C, P, Q, R];
      piece2 = [P, B, A, U, Z, Q];
      leftover = [K, L, R, C];
    }
    const points = [U, R, M, K, L, P, Q];
    const valid = points.every(finite);
    const cake = [A, B, C, R, Z, U];
    return {
      A, B, C, D, Z, U, R, M, K, L, P, Q,
      below, para: !!s.para, piece1, piece2, leftover,
      cut: [P, Q], cake, removed: [U, Z, R, D],
      valid,
      cakeArea: area(cake),
      half: area(cake) / 2,
      piece1Area: valid ? area(piece1) : NaN,
      piece2Area: valid ? area(piece2) : NaN,
      leftoverArea: valid ? area(leftover) : NaN,
      triangleArea: valid ? triangle(B, Z, Q) : NaN,
      /* The first approximation cuts the real cake evenly below the diagonal. */
      approx1: valid ? area(below ? [K, B, Z, L] : [B, A, U, Z]) : NaN,
      approx2: valid ? area(below ? [B, C, R, Z] : [B, C, R, Z]) : NaN,
      /* The printed KBCMZL, with M in place of R: kept for the article note. */
      printedSplit1: valid && below ? area([K, B, Z, L]) : NaN,
      printedSplit2: valid && below ? area([B, C, M, Z]) : NaN,
    };
  }

  /** A short status line: an illustration has no winner to announce. */
  function describe(s) {
    const g = compute(s);
    const r = (v) => Math.round(v);
    if (!g.valid) return "Drag the corner back into the cake to see the cut.";
    const name = g.para ? "Parallel cut PQ" : "Triangle cut BQ";
    const side = g.below ? "right side CD" : "top side AD";
    return `${name}: BZ first meets the ${side}. The two pieces cover ${r(g.piece1Area)} and ${r(g.piece2Area)} square units of the ${r(g.cakeArea)} left.`;
  }

  /** No win, no loss: this is a demonstration. */
  function result() {
    return null;
  }

  return {
    WIDTH, HEIGHT, INSET, PARALLEL,
    copy, clamp, clampToBoard, finite, add, sub, scale,
    parallel, intersect, isInside, signed, area, triangle, near,
    inset, contains, verifyZ, coefficient, withCoefficients, withZ,
    start, randomize, reset, movePoint, setOption,
    compute, describe, result,
  };
})();
