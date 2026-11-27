#!/usr/bin/env node
"use strict";

/*
 * Logic test for euclid-i43/euclid-i43-core.js.
 *
 *   node porting/check-euclid-i43.mjs
 *
 * 1. The applet's own methods are transcribed a second time, straight from
 *    EuclidI43Canvas.class / GeoSDoub.class / DoubLine.class bytecode: init(),
 *    SetN(), Redefine(), UpdateCoefficient() and AccommodatePoint(). They are
 *    compared with the core over every N from 0 to 10, every corner drag and
 *    hundreds of divider drags.
 * 2. The page's claims are searched rather than copied: for each N, each of
 *    many random parallelograms, and many dragged divisor positions, every
 *    grid rectangle is matched with its mirror across the diagonal and both
 *    its colour and its area are compared. With one point the green pair and
 *    the four-piece decomposition are checked exactly.
 * 3. The edge cases of the interface: bad moves, spinner bounds, and a
 *    demonstration that never produces a win or a loss.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("euclid-i43/euclid-i43-core.js", "EuclidI43Core");
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const nearPoint = (p, q, eps = 1e-7) =>
  Number.isFinite(p.x) && Number.isFinite(p.y) &&
  near(p.x, q.x, eps) && near(p.y, q.y, eps);
const nearQuad = (a, b) => a.length === b.length && a.every((p, i) => nearPoint(p, b[i]));
const rand = rng(43143);

/* ------------------------------------------------------------------ part 1 */

/* DoubLine.CreateMidPoint(z) = A*z + C*(1-z). */
function appletInitCorners(w, h) {
  const x0 = 20, y0 = 20;
  const top = w - 4 * x0;
  const A = { x: x0, y: y0 };
  const D = { x: x0 + top, y: y0 };
  const B = { x: w / 2 + w / 2 - D.x, y: h / 2 + h / 2 - D.y };
  const Cc = { x: B.x + top, y: B.y };
  return { A, B, C: Cc, D };
}

/* The literal loop in EuclidI43Canvas.init() for Max = 10. */
function appletZ(max) {
  const z = [];
  for (let i = 0; i < Math.floor(max / 2); i++) {
    z[2 * i] = (Math.floor(max / 2) + i + 1) / (max + 1);
    z[2 * i + 1] = (Math.floor(max / 2) - i) / (max + 1);
  }
  return z;
}

/* EuclidI43Canvas.SetN: MOd keeps Z[0..N-1] in insertion order. */
function appletSetN(n) {
  let old = 1;
  const moveables = [0];
  if (n > old) {
    for (let i = old; i < n; i++) moveables.push(i);
  } else {
    for (let i = n; i < old; i++) {
      const at = moveables.indexOf(i);
      if (at >= 0) moveables.splice(at, 1);
    }
  }
  old = n;
  return moveables;
}

/* GeoSDoub.GetParallelTo(p,a,b) and GeoSDoub.Intersect, from their bytecode. */
function appletParallel(p, a, b) {
  return { x: p.x + 100 * (a.x - b.x), y: p.y + 100 * (a.y - b.y) };
}
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const d = a1 * b2 - a2 * b1;
  if (Math.abs(d) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / d, y: (c1 * a2 - c2 * a1) / d };
}

/* EuclidI43Canvas.AccommodatePoint, in the order of its four FillPoly calls. */
function appletPieces(A, B, Cc, D, z) {
  const K = {
    x: A.x * z + Cc.x * (1 - z),
    y: A.y * z + Cc.y * (1 - z),
  };
  const dirAB = appletParallel(K, A, B);
  const dirAD = appletParallel(K, A, D);
  const E = appletIntersect(A, D, K, dirAB);
  const F = appletIntersect(B, Cc, K, dirAB);
  const G = appletIntersect(A, B, K, dirAD);
  const H = appletIntersect(Cc, D, K, dirAD);
  return {
    K,
    quads: [
      [A, G, K, E], [G, B, F, K], [H, D, E, K], [F, Cc, H, K],
    ],
  };
}

/* EuclidI43Canvas.Redefine(p1,p2,p3,p4): p1 = p2 + p4 - p3. */
function appletRedefine(p1, p2, p3, p4) {
  return { x: p2.x + p4.x - p3.x, y: p2.y + p4.y - p3.y };
}

/* DoubLine.UpdateMidPoint(Z) followed by UpdateCoefficient: recover z from
   the point projected onto AC, clamped to [0,1] (m_PointInSegment). */
function appletCoefficient(A, B, Cc, D, point) {
  const dx = Cc.x - A.x, dy = Cc.y - A.y;
  const len2 = (A.x - Cc.x) ** 2 + (A.y - Cc.y) ** 2;
  let t = -((A.x - Cc.x) * (Cc.x - point.x) + (A.y - Cc.y) * (Cc.y - point.y)) / len2;
  t = C.clamp(t, 0, 1);
  /* The point after UpdateDPoints would be A*t + Cc*(1-t). */
  return { t, point: { x: A.x * t + Cc.x * (1 - t), y: A.y * t + Cc.y * (1 - t) } };
}

{
  const s = C.start({});
  const init = appletInitCorners(400, 300);
  equal("init corner A", s.A, init.A);
  equal("init corner B", s.B, init.B);
  equal("init corner C", s.C, init.C);
  equal("init corner D", s.D, init.D);
  equal("init N is one", s.N, 1);
  equal("init z coefficients", s.z, appletZ(10));
  equal("applet's first divisor is at z=6/11", s.z[0], 6 / 11);
  check("applet's divisor order is not sorted", s.z[0] > s.z[1] && s.z[1] < s.z[2]);
  check("all ten divisors lie strictly inside the diagonal", s.z.every((z) => z > 0 && z < 1));
}

/* Every spinner value, against SetN's add/remove loop. */
for (let n = 0; n <= C.MAX; n++) {
  const s = C.setN(C.start({}), n);
  const active = C.compute(s).dividers.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  equal(`SetN(${n}) keeps the first ${n} divisors`, active, appletSetN(n));
  equal(`N=${n} agrees with the spinner`, s.N, n);
}

/* AccommodatePoint, for every N and a spread of shapes, compared quad by quad. */
{
  let cases = 0;
  for (let n = 1; n <= C.MAX; n++) {
    for (let trial = 0; trial < 24; trial++) {
      let s = C.start({ N: n });
      if (trial > 0) {
        s = C.moveCorner(s, "A", { x: 20 + rand() * 180, y: 20 });
        s = C.moveCorner(s, "B", { x: 20 + rand() * 180, y: 280 });
        if (rand() < 0.5) s = C.moveCorner(s, "D", { x: 180 + rand() * 200, y: 20 });
      }
      for (let i = 0; i < n; i++) {
        if (rand() < 0.4) {
          s = C.moveDivider(s, i, {
            x: s.A.x + rand() * (s.C.x - s.A.x),
            y: s.A.y + rand() * (s.C.y - s.A.y),
          });
        }
      }
      const got = C.compute(s);
      for (let i = 0; i < n; i++) {
        const want = appletPieces(s.A, s.B, s.C, s.D, s.z[i]);
        check(`AccommodatePoint N=${n} trial=${trial} K${i}`,
          nearPoint(got.dividers[i], want.K));
        for (let k = 0; k < 4; k++) {
          const gq = got.quads.find((q) => q.i === i && ["a", "m", "m", "c"][k] === q.kind &&
            nearQuad(q.points, want.quads[k]));
          check(`FillPoly ${k} N=${n} trial=${trial} i=${i}`, !!gq);
        }
      }
      cases++;
    }
  }
  check("AccommodatePoint compared over 240 configurations", cases === 240);
}

/* Redefine, for each corner and for positions far outside the applet canvas. */
{
  let cases = 0;
  for (const name of ["A", "B", "C", "D"]) {
    for (let trial = 0; trial < 30; trial++) {
      const s0 = C.start({ N: 3 });
      const x = name === "A" || name === "B" ? -40 + rand() * 300 : 120 + rand() * 200;
      const s = C.moveCorner(s0, name, { x, y: trial % 2 ? 20 : 280 });
      check(`drag ${name} is accepted`, s !== s0);
      let expected;
      if (name === "A") expected = appletRedefine(s0.C, s0.B, s.A, s0.D);
      else if (name === "B") expected = appletRedefine(s0.C, s.B, s0.A, s0.D);
      else if (name === "C") expected = appletRedefine(s.A, s0.D, s.C, s0.B);
      else expected = appletRedefine(s.A, s.D, s0.C, s0.B);
      const dep = name === "A" || name === "B" ? s.C : s.A;
      check(`Redefine for ${name} trial=${trial}`, nearPoint(dep, expected));
      check(`${name} keeps its y row`, near(s[name].y, s0[name].y));
      cases++;
    }
  }
  check("all four corner drags compared", cases === 120);
}

/* UpdateCoefficient / UpdateDPoints for each divisor and many target points. */
{
  let cases = 0;
  for (let i = 0; i < C.MAX; i++) {
    let s = C.setN(C.start({}), C.MAX);
    for (let trial = 0; trial < 30; trial++) {
      const along = rand();
      const point = {
        x: s.A.x + along * (s.C.x - s.A.x) + (rand() - 0.5) * 60,
        y: s.A.y + along * (s.C.y - s.A.y) + (rand() - 0.5) * 60,
      };
      const next = C.moveDivider(s, i, point);
      const want = appletCoefficient(s.A, s.B, s.C, s.D, point);
      check(`UpdateCoefficient i=${i} trial=${trial}`, near(next.z[i], want.t));
      check(`divisor ${i} stays on AC`, nearPoint(C.compute(next).dividers[i], want.point));
      s = next;
      cases++;
    }
  }
  check("UpdateCoefficient compared over 300 drags", cases === 300);
}

/* ------------------------------------------------------------------ part 2 */

/* The page: "parallelograms and triangles of the same color that lie on
   opposite sides of the diagonal have equal areas." With one divisor the
   applet fills two green quadrilaterals, one on each side. */
{
  let cases = 0;
  for (let trial = 0; trial < 250; trial++) {
    let s = C.start({ N: 1 });
    s = C.moveCorner(s, "A", { x: 10 + rand() * 200, y: 20 });
    s = C.moveCorner(s, "B", { x: 10 + rand() * 200, y: 280 });
    if (rand() < 0.5) s = C.moveCorner(s, "D", { x: 200 + rand() * 190, y: 20 });
    s = C.moveDivider(s, 0, {
      x: s.A.x + rand() * (s.C.x - s.A.x),
      y: s.A.y + rand() * (s.C.y - s.A.y),
    });
    const g = C.compute(s);
    const greens = g.quads.filter((q) => q.kind === "m");
    check("single point: two green pieces", greens.length === 2);
    check("single point: green areas equal", near(greens[0].area, greens[1].area));
    check("single point: four pieces tile the parallelogram",
      near(g.quads.reduce((a, q) => a + q.area, 0), g.parallelogramArea, 1e-6));
    check("single point: status calls them equal", /match/.test(C.describe(s)));
    cases++;
  }
  check("single-point claim checked on 250 shapes and positions", cases === 250);
}

/* "The applet allows up to 10 divisor points. The statement remains true for
   any number of points." Match every final-colour grid cell with its mirror
   across the diagonal, for all N and for both default and dragged z values. */
{
  let cellsChecked = 0, configurations = 0;
  for (let n = 1; n <= C.MAX; n++) {
    for (let trial = 0; trial < 14; trial++) {
      let s = C.start({ N: n });
      s = C.moveCorner(s, "A", { x: 15 + rand() * 190, y: 20 });
      s = C.moveCorner(s, "B", { x: 15 + rand() * 190, y: 280 });
      if (rand() < 0.5) s = C.moveCorner(s, "D", { x: 190 + rand() * 195, y: 20 });
      if (trial % 2 === 1) {
        s = C.moveDivider(s, Math.floor(rand() * n), {
          x: s.A.x + rand() * (s.C.x - s.A.x),
          y: s.A.y + rand() * (s.C.y - s.A.y),
        });
      }
      const g = C.compute(s);
      check(`N=${n} trial=${trial}: all mirrored cells match`, g.allPairsMatch);
      check(`N=${n} trial=${trial}: at least one pair`, g.pairs > 0);
      cellsChecked += g.cells.length;
      configurations++;
    }
  }
  check("general claim checked on 140 configurations", configurations === 140);
  check("general claim checked on thousands of cells", cellsChecked > 1000);
}

/* With no divisor points the picture is just the diagonal; equal areas hold
   trivially and describe() asks the player to add one. */
{
  const s = C.setN(C.start({}), 0);
  const g = C.compute(s);
  check("N=0 has no pieces", g.quads.length === 0);
  check("N=0 has no cells", g.cells.length === 0);
  check("N=0 has no pairs but does not claim a failure", g.pairs === 0 && g.allPairsMatch);
  check("N=0 status asks for a point", /Use \+/.test(C.describe(s)));
}

/* ------------------------------------------------------------------ part 3 */

{
  const s = C.start({});
  check("unknown corner is ignored", C.moveCorner(s, "X", { x: 100, y: 100 }) === s);
  check("NaN corner is ignored", C.moveCorner(s, "A", { x: NaN, y: 20 }) === s);
  check("inactive divisor is ignored", C.moveDivider(s, 1, { x: 100, y: 100 }) === s);
  check("NaN divisor is ignored", C.moveDivider(s, 0, { x: NaN, y: NaN }) === s);
  check("non-finite N is ignored", C.setN(s, Infinity) === s);
  check("N below range clamps to 0", C.setN(s, -7).N === 0);
  check("N above range clamps to 10", C.setN(s, 99).N === 10);
  check("an illustration is never won", C.result(s) === null);
  check("a changed shape is never won", C.result(C.randomize(s)) === null);
  check("reset keeps the spinner value", C.reset(C.setN(s, 7)).N === 7);
  check("reset restores the coefficients",
    JSON.stringify(C.reset(C.moveDivider(s, 0, s.C)).z) === JSON.stringify(C.INITIAL_Z));
}

done("euclid-i43");
