#!/usr/bin/env node
"use strict";

/*
 * Logic test for abul-wafa-pythagoras/abul-wafa-pythagoras-core.js.
 *
 *   node porting/check-abul-wafa-pythagoras.mjs
 *
 * Covers the applet's start position, its corner-snapping and alignment
 * tolerance, the drag ranges, the right triangle A-B-E, and the identity
 * a² + b² = c² for every integer pair in the applet's size range and for
 * hundreds of seeded random pairs. The seven pieces are checked for area
 * preservation, for covering the square on the hypotenuse exactly once, and
 * for agreeing point by point with a second, literal transcription of the
 * applet's CreatePieces() bytecode.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("abul-wafa-pythagoras/abul-wafa-pythagoras-core.js", "AbulWafaPythagorasCore");
const P = C.pt;
const near = (p, q, tol = 1e-7) =>
  p && q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const nearNum = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start();
  check("start uses the applet's big-square side", nearNum(s.a, 93.75));
  check("start uses the applet's small-square side", nearNum(s.b, 62.5));
  check("start leaves the corners 187.5 apart", nearNum(s.gap.x, 187.5) && nearNum(s.gap.y, 0));
  check("the new illustration is not assembled", s.assembled === false);
  check("the start position is not aligned", !C.aligned(s));
}

/* ------------------------------------------- 2. dragging, snapping, limits */

{
  const s = C.start();
  check("a drop near the corner snaps onto it", C.aligned(C.withGap(s, 3, 2)));
  check("a drop just outside the snap distance stays apart", !C.aligned(C.withGap(s, 5.2, 0)));
  const exact = { a: 100, b: 50, gap: { x: 0.05, y: 0 }, assembled: false };
  check("alignment uses the applet's 0.1 tolerance", C.aligned(exact));
  const loose = { a: 100, b: 50, gap: { x: 0.2, y: 0 }, assembled: false };
  check("0.2 units apart is not aligned", !C.aligned(loose));

  const hi = C.withSide(s, "a", 9999);
  const lo = C.withSide(s, "a", -3);
  check("side a is clamped to 40..150", hi.a === 150 && lo.a === 40);
  const bh = C.withSide(s, "b", 9999);
  const bl = C.withSide(s, "b", -3);
  check("side b stays below side a", bh.b === bh.a - C.LIMITS.gap);
  check("side b is clamped to at least 20", bl.b === 20);
  const smallBig = C.withSide({ ...s, a: 45, b: 40 }, "a", 42);
  check("shrinking a shrinks b with it", smallBig.b === 32);
  const moved = C.withGap(s, 0, 0);
  check("dragging does not change the sizes", moved.a === s.a && moved.b === s.b);
}

/* -------------------------------------- 3. the right triangle and the law */

{
  let bad = 0;
  let pairs = 0;
  for (let a = 30; a <= 150; a++) {
    for (let b = 20; b < a; b++) {
      const t = C.triangle({ a, b });
      const ba = C.sub(t.A, t.B), be = C.sub(t.E, t.B);
      if (!nearNum(ba.x * be.x + ba.y * be.y, 0, 1e-9)) bad++;
      if (!nearNum(C.distance(t.A, t.B), a) || !nearNum(C.distance(t.B, t.E), b)) bad++;
      if (!C.identity(a, b).holds) bad++;
      pairs++;
    }
  }
  check(`the right triangle and a²+b²=c² hold for all ${pairs} integer pairs`, bad === 0, `${bad} failures`);

  const rand = rng(20261126);
  bad = 0;
  for (let i = 0; i < 600; i++) {
    const a = 40 + rand() * 110;
    const b = 20 + rand() * (a - 30 - 20);
    if (!C.identity(a, b).holds) bad++;
  }
  check("a²+b²=c² holds for 600 random right triangles", bad === 0, `${bad} failures`);
}

/* --------------------------- 4. the dissection keeps every piece's area */

const triangles = [];
{
  for (const [a, b] of [[93.75, 62.5], [150, 140], [40, 20], [120, 119], [100, 100], [150, 30]]) {
    triangles.push([a, b]);
  }
  const rand = rng(74);
  for (let i = 0; i < 300; i++) {
    const a = 40 + rand() * 110;
    triangles.push([a, 20 + rand() * (a - 30 - 20)]);
  }
}

{
  const first = C.dissection(93.75, 62.5, P(350, -130));
  check("the applet cuts seven pieces", first.pieces.length === 7);
  check("five pieces come from the big square and two from the small one",
    first.pieces.filter((p) => p.color === 0).length === 5 &&
    first.pieces.filter((p) => p.color === 1).length === 2);

  let bad = 0;
  for (const [a, b] of triangles) {
    const d = C.dissection(a, b);
    for (const piece of d.pieces) {
      if (!nearNum(C.area(piece.start), C.area(piece.end), 1e-7)) bad++;
    }
  }
  check(`all seven pieces keep their area on ${triangles.length} triangles`, bad === 0, `${bad} failures`);

  bad = 0;
  for (const [a, b] of triangles) {
    const d = C.dissection(a, b);
    const total = d.pieces.reduce((sum, piece) => sum + C.area(piece.start), 0);
    const totalEnd = d.pieces.reduce((sum, piece) => sum + C.area(piece.end), 0);
    const square = C.area(d.square);
    if (!nearNum(total, a * a + b * b, 1e-6) ||
        !nearNum(totalEnd, a * a + b * b, 1e-6) ||
        !nearNum(square, d.c * d.c, 1e-6)) bad++;
  }
  check("piece areas, square areas and a²+b² agree on every triangle", bad === 0, `${bad} failures`);
}

/* -------------------------- 5. the pieces tile the hypotenuse square once */

function insidePolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

{
  let bad = 0, samples = 0;
  for (const [a, b] of triangles.slice(0, 12)) {
    const d = C.dissection(a, b);
    const q = d.points;
    const e1 = C.sub(q.Ap, q.Dp), e2 = C.sub(q.Cp, q.Dp);
    const cc = e1.x * e1.x + e1.y * e1.y;
    for (let i = 1; i < 40; i++) {
      for (let j = 1; j < 40; j++) {
        const u = i / 40, v = j / 40;
        const p = P(q.Dp.x + u * e1.x + v * e2.x, q.Dp.y + u * e1.y + v * e2.y);
        const dot1 = C.sub(p, q.Dp);
        const cu = (dot1.x * e1.x + dot1.y * e1.y) / cc;
        const cv = (dot1.x * e2.x + dot1.y * e2.y) / cc;
        if (cu < 0 || cu > 1 || cv < 0 || cv > 1) bad++;
        const covering = d.pieces.filter((piece) => insidePolygon(p, piece.end)).length;
        if (covering !== 1) bad++;
        samples++;
      }
    }
  }
  check(`${samples} points of the hypotenuse square are covered exactly once`, bad === 0, `${bad} failures`);

  bad = 0;
  for (const [a, b] of triangles) {
    const d = C.dissection(a, b);
    const q = d.points;
    const e1 = C.sub(q.Ap, q.Dp), e2 = C.sub(q.Cp, q.Dp);
    const cc = e1.x * e1.x + e1.y * e1.y;
    for (const piece of d.pieces) {
      for (const p of piece.end) {
        const v = C.sub(p, q.Dp);
        const u1 = (v.x * e1.x + v.y * e1.y) / cc;
        const u2 = (v.x * e2.x + v.y * e2.y) / cc;
        if (u1 < -1e-7 || u1 > 1 + 1e-7 || u2 < -1e-7 || u2 > 1 + 1e-7) bad++;
      }
    }
  }
  check("every final piece vertex lies in the square", bad === 0, `${bad} failures`);
}

/* ----------------- 6. a second transcription of the applet's CreatePieces */

/* GeoSDoub.Intersect, solved with Cramer's rule rather than the core's t. */
function meet2(p, q, r, s) {
  const ux = q.x - p.x, uy = q.y - p.y;
  const vx = s.x - r.x, vy = s.y - r.y;
  const den = ux * vy - uy * vx;
  if (den === 0) return null;
  const un = (r.x - p.x) * vy - (r.y - p.y) * vx;
  return P(p.x + (ux * un) / den, p.y + (uy * un) / den);
}

/* Literal transcription of the bytecode's locals S1, S3, S5 and fields. */
function applet(a, b, P0) {
  const A = P(0, 0), B = P(a, 0), C = P(a, -a), D = P(0, -a);
  const A1 = P(0, 0), B1 = P(b, 0), C1 = P(b, -b), D1 = P(0, -b);
  const S1 = Math.abs(B.x - A.x);   // a
  const S3 = Math.abs(B1.x - A1.x); // b
  const S5 = Math.abs(S1 - S3);
  const E = P(B.x, B.y - S3);
  const F = P(D.x + S3, D.y);
  const K = meet2(A, E, B1, C1);
  const Dp = P0;
  const Ap = P(Dp.x + S1, Dp.y + S3);
  const Bp = P(Ap.x + S3, Ap.y - S1);
  const Cp = P(Bp.x - S1, Bp.y - S3);
  const Ep = P(Ap.x, Ap.y - S3);
  const Fp = P(Bp.x - S3, Bp.y);
  const Gp = P(Cp.x, Cp.y + S3);
  const Hp = P(Dp.x + S3, Dp.y);
  const Sp = P(Dp.x + S1 - S3, Dp.y);
  const Ip = meet2(P(Sp.x, Sp.y + (Dp.x - Ep.x)), Sp, Dp, Ap);
  const Jp = P(Bp.x - S3, Bp.y);
  const Kp = meet2(Jp, P(Jp.x, Jp.y + (Bp.x - Jp.x)), Cp, Bp);
  const points = { A, B, C, D, A1, B1, C1, D1, E, F, K, Dp, Ap, Bp, Cp,
    Ep, Fp, Gp, Hp, Sp, Ip, Jp, Kp };
  const pieces = [
    { name: "triangle-1", start: [A, F, D], end: [Ap, Bp, Fp] },
    { name: "triangle-2", start: [A, B1, F], end: [Dp, Hp, Cp] },
    { name: "triangle-3", start: [C1, K, E], end: [Sp, Ip, Dp] },
    { name: "quad-4", start: [B1, B, E, K], end: [Jp, Gp, Cp, Kp] },
    { name: "quad-5", start: [C1, E, C, F], end: [Hp, Ep, Fp, Gp] },
    { name: "triangle-6", start: [A1, B1, K], end: [Bp, Jp, Kp] },
    { name: "quad-7", start: [A, K, C1, D1], end: [Ap, Ip, Sp, Ep] },
  ];
  return { points, pieces, S5 };
}

{
  let badPoints = 0, badPieces = 0, badK = 0, badS5 = 0;
  for (const [a, b] of triangles) {
    const target = P(350, -130);
    const ours = C.dissection(a, b, target);
    const theirs = applet(a, b, target);
    for (const name in theirs.points) {
      if (!near(ours.points[name], theirs.points[name], 1e-6)) badPoints++;
    }
    ours.pieces.forEach((piece, i) => {
      const ref = theirs.pieces[i];
      if (piece.name !== ref.name) badPieces++;
      piece.start.forEach((p, k) => { if (!near(p, ref.start[k], 1e-6)) badPieces++; });
      piece.end.forEach((p, k) => { if (!near(p, ref.end[k], 1e-6)) badPieces++; });
    });
    const k = ours.points.K;
    if (!near(k, P(b, -(b * b) / a), 1e-6)) badK++;
    if (!nearNum(theirs.S5, Math.abs(a - b))) badS5++;
  }
  check(`all ${triangles.length} constructions match the applet's points`, badPoints === 0, `${badPoints} differences`);
  check("all seven pieces match the applet's vertices", badPieces === 0, `${badPieces} differences`);
  check("K is the intersection at (b, -b²/a)", badK === 0, `${badK} failures`);
  check("the applet's S5 is |a-b|", badS5 === 0, `${badS5} failures`);
}

/* -------------------------------------------- 7. the saved position is data */

{
  const s = C.withGap(C.withSide(C.start(), "a", 120), 0, 0);
  const roundTrip = JSON.parse(JSON.stringify(s));
  equal("the player's position survives JSON unchanged", roundTrip, s);
  check("a settled position is aligned and ready for the dissection", C.aligned(roundTrip));
}

done("abul-wafa-pythagoras");
