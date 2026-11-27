#!/usr/bin/env node
"use strict";

/*
 * Logic test for deco-symmetry/deco-symmetry-core.js.
 *
 *   node porting/check-deco-symmetry.mjs
 *
 * 1. the opening triangle and the panel's options;
 * 2. a SECOND transcription of the applet's FindLargestAngle, Compute,
 *    IsAcute, ComputeRegular, ComputeAcute and MoveThem, compared with the
 *    core on an exhaustive integer grid and on 1,200 seeded random triangles;
 * 3. the page's claims: the pieces really move by rotation + translation (no
 *    flip), the frame lands on the bytecode's final polygon, the four pieces
 *    partition the triangle, two of them fuse so that only TWO CUTS are
 *    needed, and the acute alternative needs an acute triangle;
 * 4. an exhaustive search of single straight cuts on a grid along the sides:
 *    no direct two-piece cut for a scalene triangle, but one for an
 *    isosceles right triangle;
 * 5. input edge cases: clamping, dragging the whole triangle and immutability.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("deco-symmetry/deco-symmetry-core.js", "DecoSymmetryCore");
const TOL = 1e-7;
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const P = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const same = (a, b, tol = TOL) => !!a && !!b && Number.isFinite(a.x) && Number.isFinite(b.x) && P(a, b) <= tol;
const sameList = (a, b, tol = TOL) => a.length === b.length && a.every((p, i) => same(p, b[i], tol));
const stateOf = (K, L, M, opts = {}) => Object.assign({
  K: K, L: L, M: M,
  showNames: false, showHint: false, specialAcute: false,
  moving: false, done: false,
}, opts);

/* ------------------------------------------------------------ 1. the opening */

{
  const s = C.start();
  const w = 400, h = 250;
  const third = w / 3, half = h / 2, radius = Math.min(w, h) / 3, turn = 2.0943951023931953;
  check("the opening K follows the applet's fractions of the canvas",
    same(s.K, { x: third + radius - w / 6, y: half + h / 8 }));
  check("the opening L follows the applet's cosine and sine",
    same(s.L, { x: third + radius * Math.cos(turn) - w / 12, y: half - radius * Math.sin(turn) }));
  check("the opening M uses twice the applet's turn",
    same(s.M, { x: third + radius * Math.cos(2 * turn) - w / 12, y: half - radius * Math.sin(2 * turn) }));
  check("all three panel checkboxes start unticked, as AWT Checkbox does",
    !s.showNames && !s.showHint && !s.specialAcute && !s.moving && !s.done);
  const f = C.compute(s);
  check("the opening triangle is acute, so the applet enables Acute special", f.acute);
  check("the opening triangle is cut into four pieces", f.pieces.length === 4);
  check("the mirror is at x' = 400 - x, y' = y",
    same(f.Ap, { x: 400 - f.A.x, y: f.A.y }) &&
    same(f.Bp, { x: 400 - f.B.x, y: f.B.y }) &&
    same(f.Cp, { x: 400 - f.C.x, y: f.C.y }));
  check("P keeps the centroid's height and takes width minus its x",
    same(f.P, { x: 400 - f.G.x, y: f.G.y }));
}

/* ------------------------ 2. a second transcription of the applet's methods */

/* Written again from the bytecode, with independent arithmetic helpers. */
const J = {
  dist2(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; },
  angle(a, b, c) {
    const x = (this.dist2(a, b) + this.dist2(a, c) - this.dist2(b, c)) /
      (2 * Math.sqrt(this.dist2(a, b) * this.dist2(a, c)));
    return Math.acos(Math.max(-1, Math.min(1, x)));
  },
  /* GeoSDoub.FindOrientation's own (unusual) algebraic form. */
  orient(a, b, c) {
    const v = c.x * (b.y - a.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return v > 0 ? 1 : -1;
  },
  signed(a, b, c) {
    const theta = this.angle(a, b, c);
    return this.orient(a, b, c) === 1 ? theta : -theta;
  },
  /* GeoSDoub.Intersect, including its |det| < 1 -> NaN branch. */
  meet(a, b, c, d) {
    const u1 = a.y - b.y, v1 = b.x - a.x, w1 = a.x * b.y - a.y * b.x;
    const u2 = c.y - d.y, v2 = d.x - c.x, w2 = c.x * d.y - c.y * d.x;
    const det = u1 * v2 - u2 * v1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (v1 * w2 - v2 * w1) / det, y: (w1 * u2 - w2 * u1) / det };
  },
  /* GeoSDoub.NearestPoint: the projection of a onto the line through b and c. */
  proj(a, b, c) {
    if (this.dist2(b, a) < 0.1) return a;
    const ux = c.x - b.x, uy = c.y - b.y;
    const t = ((a.x - b.x) * ux + (a.y - b.y) * uy) / (ux * ux + uy * uy);
    return { x: b.x + ux * t, y: b.y + uy * t };
  },
  centre(a, b, c) {
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    return this.meet(m1,
      { x: m1.x + b.y - a.y, y: m1.y - b.x + a.x },
      m2,
      { x: m2.x + c.y - b.y, y: m2.y - c.x + b.x });
  },
  largest(K, L, M) {
    const a = this.angle(K, L, M), b = this.angle(L, M, K), c = this.angle(M, L, K);
    let A = K, B = L, Cc = M;
    if (a >= b && a >= c) { A = K; B = L; Cc = M; }
    if (b >= a && b >= c) { A = L; B = M; Cc = K; }
    if (c >= a && c >= b) { A = M; B = K; Cc = L; }
    return { A: A, B: B, C: Cc, angles: [a, b, c] };
  },
  /* Compute() + IsAcute() + ComputeRegular()/ComputeAcute() + MoveThem(). */
  compute(s) {
    const o = this.largest(s.K, s.L, s.M);
    const A = o.A, B = o.B, Cc = o.C;
    const G = { x: (A.x + B.x + Cc.x) / 3, y: (A.y + B.y + Cc.y) / 3 };
    const mirror = (p) => ({ x: 400 - G.x - (p.x - G.x), y: G.y + (p.y - G.y) });
    const Ap = mirror(A), Bp = mirror(B), Cp = mirror(Cc);
    const acute = o.angles.every((a) => a < Math.PI / 2);
    const special = acute && s.specialAcute;
    const out = { A: A, B: B, C: Cc, Ap: Ap, Bp: Bp, Cp: Cp, G: G,
      P: { x: 400 - G.x, y: G.y }, acute: acute, specialAcute: special };
    if (special) {
      out.O = this.centre(A, B, Cc);
      out.Op = this.centre(Ap, Bp, Cp);
      out.pieces = [
        [[out.O, A, B], [out.Op, Bp, Ap]],
        [[out.O, B, Cc], [out.Op, Cp, Bp]],
        [[out.O, Cc, A], [out.Op, Ap, Cp]],
      ];
    } else {
      out.D = this.proj(A, B, Cc);
      out.E = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      out.F = { x: (A.x + Cc.x) / 2, y: (A.y + Cc.y) / 2 };
      out.Dp = this.proj(Ap, Bp, Cp);
      out.Ep = { x: (Ap.x + Bp.x) / 2, y: (Ap.y + Bp.y) / 2 };
      out.Fp = { x: (Ap.x + Cp.x) / 2, y: (Ap.y + Cp.y) / 2 };
      out.pieces = [
        [[out.E, B, out.D], [out.Ep, out.Dp, Bp]],
        [[out.E, out.D, A], [out.Ep, Ap, out.Dp]],
        [[out.F, A, out.D], [out.Fp, out.Dp, Ap]],
        [[out.F, out.D, Cc], [out.Fp, Cp, out.Dp]],
      ];
    }
    return out;
  },
};

function compareTranscription(s, label) {
  const a = C.compute(s), b = J.compute(s);
  const bad = [];
  for (const key of ["A", "B", "C", "Ap", "Bp", "Cp", "G", "P", "D", "E", "F", "Dp", "Ep", "Fp", "O", "Op"]) {
    if ((a[key] == null) !== (b[key] == null) || (a[key] && !same(a[key], b[key], 1e-6))) bad.push(key);
  }
  if (a.pieces.length !== b.pieces.length) bad.push("piece count");
  else for (let i = 0; i < a.pieces.length; i++) {
    if (!sameList(a.pieces[i].from, b.pieces[i][0], 1e-6) ||
        !sameList(a.pieces[i].to, b.pieces[i][1], 1e-6)) bad.push("piece " + i);
  }
  check(label, bad.length === 0, bad.join(", "));
}

{
  let count = 0, allGood = true;
  for (let x1 = 20; x1 <= 380; x1 += 60) for (let y1 = 20; y1 <= 220; y1 += 50)
    for (let x2 = 20; x2 <= 380; x2 += 90) for (let y2 = 20; y2 <= 220; y2 += 70)
      for (let x3 = 20; x3 <= 380; x3 += 120) for (let y3 = 20; y3 <= 220; y3 += 90) {
        const K = { x: x1, y: y1 }, L = { x: x2, y: y2 }, M = { x: x3, y: y3 };
        if (Math.abs((L.x - K.x) * (M.y - K.y) - (L.y - K.y) * (M.x - K.x)) < 100) continue;
        for (const special of [false, true]) {
          const s = stateOf(K, L, M, { specialAcute: special });
          const a = C.compute(s), b = J.compute(s);
          if (!sameList([a.A, a.B, a.C, a.Ap, a.Bp, a.Cp, a.P],
              [b.A, b.B, b.C, b.Ap, b.Bp, b.Cp, b.P], 1e-6) ||
              a.pieces.length !== b.pieces.length ||
              a.pieces.some((p, i) => !sameList(p.from, b.pieces[i][0], 1e-6) ||
                !sameList(p.to, b.pieces[i][1], 1e-6))) allGood = false;
          count++;
        }
      }
  check(`the core matches the bytecode transcription on ${count} grid triangles`, allGood);
  const r = rng(20261127);
  let randomGood = true, acuteSeen = 0, specialSeen = 0, regularSeen = 0;
  for (let i = 0; i < 1200; i++) {
    const K = { x: 10 + r() * 380, y: 10 + r() * 230 };
    const L = { x: 10 + r() * 380, y: 10 + r() * 230 };
    const M = { x: 10 + r() * 380, y: 10 + r() * 230 };
    const s = stateOf(K, L, M, { specialAcute: r() < 0.5 });
    const a = C.compute(s), b = J.compute(s);
    if (a.acute) acuteSeen++;
    if (a.specialAcute) specialSeen++; else regularSeen++;
    if (!sameList([a.A, a.B, a.C, a.Ap, a.Bp, a.Cp, a.P],
        [b.A, b.B, b.C, b.Ap, b.Bp, b.Cp, b.P], 1e-6) ||
        a.acute !== b.acute || a.specialAcute !== b.specialAcute ||
        a.pieces.length !== b.pieces.length ||
        a.pieces.some((p, j) => !sameList(p.from, b.pieces[j][0], 1e-6) ||
          !sameList(p.to, b.pieces[j][1], 1e-6))) randomGood = false;
  }
  check("the core matches the bytecode transcription on 1,200 random triangles", randomGood);
  check("the random sweep covers both constructions", acuteSeen > 50 && specialSeen > 20 && regularSeen > 200);
}

/* ---------------------------------------------- 3. the page's stated claims */

/* Polygon area, with the sign kept: the pieces must keep their orientation. */
function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

{
  const r = rng(731);
  let allDirect = true, allFramed = true, allArea = true, allMirror = true, worst = 0;
  for (let i = 0; i < 600; i++) {
    const K = { x: 20 + r() * 360, y: 20 + r() * 210 };
    const L = { x: 20 + r() * 360, y: 210 - r() * 210 };
    const M = { x: 20 + r() * 360, y: r() < 0.5 ? 20 + r() * 60 : 190 + r() * 60 };
    const f = C.compute(stateOf(K, L, M, { specialAcute: r() < 0.5 }));
    const triangle = [f.A, f.B, f.C], mirrored = [f.Ap, f.Bp, f.Cp];
    if (!near(signedArea(triangle), -signedArea(mirrored), 1e-6)) allMirror = false;
    let area = 0, targetArea = 0;
    for (const piece of f.pieces) {
      const m = C.rigidMap(piece.from, piece.to);
      if (!m || m.error > 1e-6 || !C.directlyCongruent(piece.from, piece.to, 1e-6)) allDirect = false;
      worst = Math.max(worst, m ? m.error : Infinity);
      const final = C.frame(piece, 1);
      if (!sameList(final, piece.to, 1e-6)) allFramed = false;
      area += signedArea(piece.from);
      targetArea += signedArea(piece.to);
    }
    if (!near(Math.abs(area), Math.abs(signedArea(triangle)), 1e-5) ||
        !near(Math.abs(targetArea), Math.abs(signedArea(mirrored)), 1e-5)) allArea = false;
  }
  check("every piece is congruent to its target by rotation + translation", allDirect, `worst ${worst}`);
  check("the applet's rotation data lands each piece exactly on its final polygon", allFramed);
  check("the pieces tile the original and the mirror triangle by area", allArea);
  check("the mirror image reverses the signed area, as a reflection must", allMirror);
}

/* The union of two triangles sharing an edge, with a consistent direction. */
function fuse(a, b) {
  const shared = a.filter((p) => b.some((q) => C.dist(p, q) < 1e-6));
  if (shared.length !== 2) return null;
  const u = shared[0], v = shared[1];
  const wa = a.find((p) => C.dist(p, u) > 1e-6 && C.dist(p, v) > 1e-6);
  const wb = b.find((p) => C.dist(p, u) > 1e-6 && C.dist(p, v) > 1e-6);
  const poly = [wa, u, wb, v];
  return signedArea(poly) * signedArea(a) < 0 ? poly.reverse() : poly;
}

{
  // Nathan Bowler's remark: the second and third pieces share the altitude AD.
  // E is the midpoint of AB and F the midpoint of AC, and in the two right
  // triangles ADB, ADC we have ED = EA and FD = FA. So E-D-F-A is a kite,
  // symmetric about AD; it can be moved rigidly to its mirror. The other two
  // pieces are cut off by the two segments DE and DF -- just TWO cuts.
  let fused = true, direct3 = true, twoCuts = true;
  const r = rng(919);
  for (let i = 0; i < 400; i++) {
    const K = { x: 20 + r() * 360, y: 20 + r() * 210 };
    const L = { x: 20 + r() * 360, y: 20 + r() * 210 };
    const M = { x: 20 + r() * 360, y: 20 + r() * 210 };
    const f = C.compute(stateOf(K, L, M));
    if (f.specialAcute) continue;
    const p1 = f.pieces[1], p2 = f.pieces[2];
    if (!same(p1.from[1], p2.from[2]) || !same(p1.from[2], p2.from[1]) ||
        !same(p1.to[2], p2.to[1]) || !same(p1.to[1], p2.to[2])) fused = false;
    if (!near(C.dist(f.A, f.E) + C.dist(f.E, f.B), C.dist(f.A, f.B), 1e-6) ||
        !near(C.dist(f.A, f.F) + C.dist(f.F, f.C), C.dist(f.A, f.C), 1e-6) ||
        !near(C.dist(f.B, f.D) + C.dist(f.D, f.C), C.dist(f.B, f.C), 1e-6)) twoCuts = false;
    const kite = fuse(p1.from, p2.from), targetKite = fuse(p1.to, p2.to);
    if (!kite || !targetKite || !C.directlyCongruent(kite, targetKite, 1e-6)) direct3 = false;
    const three = [f.pieces[0].from, kite, f.pieces[3].from];
    const threeTo = [f.pieces[0].to, targetKite, f.pieces[3].to];
    for (let j = 0; j < 3; j++) if (!C.directlyCongruent(three[j], threeTo[j], 1e-6)) direct3 = false;
  }
  check("the second and third pieces share the altitude AD", fused);
  check("E, F and D lie on AB, AC and BC, so DE and DF are two straight cuts", twoCuts);
  check("E-D-F-A is a kite that moves rigidly onto its mirror, giving three pieces", direct3);
}

{
  const obtuse = stateOf({ x: 60, y: 60 }, { x: 300, y: 70 }, { x: 340, y: 200 }, { specialAcute: true });
  const f = C.compute(obtuse);
  const acute = C.compute(stateOf({ x: 200, y: 190 }, { x: 90, y: 40 }, { x: 310, y: 40 }, { specialAcute: true }));
  check("Acute special is forced off for a non-acute triangle", !f.acute && !f.specialAcute && f.pieces.length === 4);
  check("Acute special gives three pieces when the triangle is acute", acute.acute && acute.specialAcute && acute.pieces.length === 3);
  check("the acute centre is equidistant from the three corners",
    near(C.dist(acute.O, acute.A), C.dist(acute.O, acute.B), 1e-6) &&
    near(C.dist(acute.O, acute.B), C.dist(acute.O, acute.C), 1e-6));
  const right = C.compute(stateOf({ x: 80, y: 180 }, { x: 320, y: 180 }, { x: 80, y: 60 }));
  check("a right triangle is not acute, so it keeps the regular dissection", !right.acute && right.pieces.length === 4);
}

/* -------------------------- 4. the one-cut claim, searched exhaustively */

function boundaryPoints(tri, n) {
  const out = [];
  for (let e = 0; e < 3; e++) for (let k = 0; k < n; k++) {
    const t = k / n, a = tri[e], b = tri[(e + 1) % 3];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, e: e });
  }
  return out;
}

function singleCuts(tri, n) {
  const p = boundaryPoints(tri, n), out = [];
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
    if (p[i].e === p[j].e) continue;
    const a = [], b = [];
    for (let k = i; ; k = (k + 1) % p.length) { a.push({ x: p[k].x, y: p[k].y }); if (k === j) break; }
    for (let k = j; ; k = (k + 1) % p.length) { b.push({ x: p[k].x, y: p[k].y }); if (k === i) break; }
    out.push([a, b]);
  }
  return out;
}

function hasOneCut(tri, n) {
  const mirror = tri.map((p) => ({ x: 400 - p.x, y: p.y })).reverse();
  const left = singleCuts(tri, n), right = singleCuts(mirror, n);
  for (const a of left) for (const b of right) {
    if ((C.directlyCongruent(a[0], b[0]) && C.directlyCongruent(a[1], b[1])) ||
        (C.directlyCongruent(a[0], b[1]) && C.directlyCongruent(a[1], b[0]))) return true;
  }
  return false;
}

{
  const scalene = [{ x: 60, y: 190 }, { x: 330, y: 70 }, { x: 220, y: 210 }];
  const right = [{ x: 80, y: 180 }, { x: 320, y: 180 }, { x: 80, y: 60 }];
  const isosceles = [{ x: 40, y: 200 }, { x: 200, y: 200 }, { x: 40, y: 40 }];
  check("no single straight cut of this scalene triangle works (8 sample points per side)", !hasOneCut(scalene, 8));
  check("no single straight cut of this unequal-leg right triangle works", !hasOneCut(right, 8));
  check("a single cut does work for an isosceles right triangle", hasOneCut(isosceles, 6));
  // Documented deviation: FindOrientation is not the geometric cross product,
  // so the applet's signed turn can differ from the turn that lands a piece.
  let signDiffs = 0;
  const rr = rng(431);
  for (let i = 0; i < 300; i++) {
    const a = { x: 10 + rr() * 380, y: 10 + rr() * 230 };
    const b = { x: 10 + rr() * 380, y: 10 + rr() * 230 };
    const c = { x: 10 + rr() * 380, y: 10 + rr() * 230 };
    const java = C.signedAngle(a, b, c), geometric = C.turnAngle(a, b, c);
    if (Number.isFinite(java) && Number.isFinite(geometric) && Math.abs(java - geometric) > 1e-9) signDiffs++;
  }
  check("the applet's signed turn really does differ from the geometric one somewhere", signDiffs > 0);
}

/* ------------------------------------------------ 5. moves and edge cases */

{
  const s = C.start();
  const moved = C.move(s, "K", { x: 1000, y: -100 });
  check("dragging clamps a corner inside the board", moved.K.x === 394 && moved.K.y === 6);
  check("moving does not mutate the given position", s.K.x !== moved.K.x);
  const dragged = C.move(s, "all", { dx: 40, dy: 15 });
  check("dragging the whole triangle preserves its shape",
    near(C.dist(dragged.K, dragged.L), C.dist(s.K, s.L)) &&
    near(C.dist(dragged.L, dragged.M), C.dist(s.L, s.M)) &&
    near(dragged.K.x - s.K.x, 40) && near(dragged.K.y - s.K.y, 15));
  const pinned = C.move(s, "all", { dx: 10000, dy: -10000 });
  check("a whole-triangle drag stops at the board edge",
    Math.max(pinned.K.x, pinned.L.x, pinned.M.x) <= 394 &&
    Math.min(pinned.K.y, pinned.L.y, pinned.M.y) >= 6);
  const ticked = C.option(s, "specialAcute", true);
  check("ticking Acute special changes only that option", ticked.specialAcute && !s.specialAcute);
  const moving = C.option(ticked, "moving", true);
  check("Move them disables the panel through the moving flag", moving.moving && !s.moving);
  equal("an unknown drag is ignored", C.move(s, "Z", { x: 3, y: 4 }), s);
  check("the status describes the finished dissection",
    /mirror image/.test(C.describe(C.compute(s), { moving: false, done: true })));
}

done("deco-symmetry");
