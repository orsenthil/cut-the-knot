#!/usr/bin/env node
"use strict";

/*
 * Logic test for maimed-cake/maimed-cake-core.js.
 *
 * The applet has no moves and no opponent: it draws a rectangle ABCD with the
 * corner UZRD missing and shows one straight cut that splits what is left
 * into two equal pieces. First the drawing rules and the drag rules are
 * checked. Then Compute, ComputeBelow, ComputeAbove, UpdateZ,
 * UpdateCoefficients, Redefine and VerifyZ are transcribed a second time,
 * straight from the bytecode (including the |det| < 1 and 0.1 guards), and
 * compared with the core over a grid of rectangles and Z positions plus
 * random drags. Finally the page's claims are checked over every case:
 * the triangle and parallel cuts really do halve the remaining cake, the
 * triangle BZQ is half of the leftover rectangle, BZ itself works when Z
 * lies on BD, and the printed "KBCMZL" split is examined rather than copied.
 *
 *   node porting/check-maimed-cake.mjs
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("maimed-cake/maimed-cake-core.js", "MaimedCakeCore");
const pt = (x, y) => ({ x, y });
const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
const add = (a, b) => pt(a.x + b.x, a.y + b.y);
const mul = (a, k) => pt(a.x * k, a.y * k);
const close = (a, b, eps = 1e-7) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const samePoint = (a, b, eps = 1e-7) => close(a.x, b.x, eps) && close(a.y, b.y, eps);
const signed = (ps) => {
  let s = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i], q = ps[(i + 1) % ps.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
};
const area = (ps) => Math.abs(signed(ps));

/* ---------------------------------------------- 1. rules and starting state */

{
  const s = C.start({});
  equal("the fixed rectangle keeps the applet's horizontal sides",
    [s.A, s.B, s.C, s.D], [pt(60, 55), pt(60, 245), pt(340, 245), pt(340, 55)]);
  check("Z starts at the saved fractions of B and D",
    close(s.Z.x, s.xc * s.B.x + (1 - s.xc) * s.D.x) &&
    close(s.Z.y, s.yc * s.B.y + (1 - s.yc) * s.D.y));
  check("the start uses the below-diagonal branch the article describes", C.compute(s).below === true);
  check("the parallel cut is the applet's initial option", s.para === true);
  check("hint and names are on by default, as the Show=1 parameter makes them",
    s.showHint === true && s.showNames === true);
  check("an illustration has no result to report", C.result(s) === null);
  const g = C.compute(s);
  check("both pieces together are the remaining cake", close(g.piece1Area + g.piece2Area, g.cakeArea));
  check("the start's two pieces are equal", close(g.piece1Area, g.piece2Area));
  check("the cake area is the big rectangle minus the nibbled corner",
    close(g.cakeArea, 280 * 190 - (340 - s.Z.x) * (s.Z.y - 55)));
  check("the parallel cut stays parallel to BZ", samePoint(sub(g.Q, g.P), sub(s.Z, s.B)));
  check("BP and ZQ have the same length as half of LU",
    close(Math.hypot(...Object.values(sub(g.P, s.B))), Math.hypot(...Object.values(mul(sub(g.U, g.L), 0.5)))));
  check("the options can be flipped and restored",
    C.setOption(C.setOption(s, "para", false), "para", true).para === true &&
    C.setOption(s, "showHint", false).showHint === false);
  check("an unknown option is refused", C.setOption(s, "nonesuch", true) === s);
  check("reset restores the picture but keeps the options", (() => {
    const r = C.reset(C.setOption(C.movePoint(s, "Z", pt(100, 100)), "para", false));
    return r.A.x === 60 && r.Z.x === s.Z.x && r.para === false && r.explored === false;
  })());
  check("an unknown handle is refused", C.movePoint(s, "X", pt(100, 100)) === s);
  check("a non-numeric pointer is refused",
    C.movePoint(s, "A", pt(NaN, 1)) === s && C.movePoint(s, "Z", null) === s);
  check("a drag never changes the object it was given", C.movePoint(s, "A", pt(100, 55)) !== s && s.A.x === 60);
  check("A has Fix(2): only x moves, and C follows", (() => {
    const m = C.movePoint(s, "A", pt(80, 200));
    return m.A.x === 80 && m.A.y === 55 && m.C.x === 60 + 340 - 80 && m.C.y === 245;
  })());
  check("B has Fix(2) and dragging it also updates Z", (() => {
    const m = C.movePoint(s, "B", pt(90, 99));
    return m.B.y === 245 && m.C.x === 90 + 340 - 60 &&
      close(m.Z.x, s.xc * m.B.x + (1 - s.xc) * m.D.x) && C.compute(m).below;
  })());
  check("C has Fix(2) and dragging it moves A", (() => {
    const m = C.movePoint(s, "C", pt(300, 99));
    return m.C.y === 245 && m.C.x === 300 && m.A.x === 340 + 60 - 300 && m.A.y === 55;
  })());
  check("Z can move freely and records its new fractions", (() => {
    const m = C.movePoint(s, "Z", pt(200, 180));
    return m.Z.x === 200 && m.Z.y === 180 &&
      close(m.xc, (200 - m.D.x) / (m.B.x - m.D.x)) &&
      close(m.yc, (180 - m.D.y) / (m.B.y - m.D.y));
  })());
  check("a Z dragged outside the ten-unit inset is refused",
    C.movePoint(s, "Z", pt(5, 5)) === s && C.movePoint(s, "Z", pt(395, 295)) === s);
  check("a Z near the inset edge is accepted", C.movePoint(s, "Z", pt(s.A.x + 30, s.A.y + 30)) !== s);
  check("a drag is remembered as explored", C.movePoint(s, "Z", pt(200, 180)).explored === true);
  check("the status names the cut and the two areas",
    /Parallel cut PQ/.test(C.describe(s)) && /right side CD/.test(C.describe(s)));
}

/* ---------------------------- 2. second transcription of the applet's code */

/* GeoSDoub.GetParallelTo(p,a,b), verbatim: p + 100*(a-b). */
function codeParallel(p, a, b) {
  return pt(p.x + 100 * (a.x - b.x), p.y + 100 * (a.y - b.y));
}

/* GeoSDoub.Intersect(p1,p2,p3,p4), including the |det| < 1 NaN guard. */
function codeIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const d = a1 * b2 - a2 * b1;
  if (Math.abs(d) < 1) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / d, (c1 * a2 - c2 * a1) / d);
}

/* InsideTest.IsInside(a,b,c) = (a-b)·(a-c) <= 0. */
function codeInside(a, b, c) {
  return (a.x - b.x) * (a.x - c.x) + (a.y - b.y) * (a.y - c.y) <= 0;
}

/* Compute, ComputeBelow and ComputeAbove, with the branch the bytecode takes. */
function codeCompute(s) {
  const { A, B, C, D, Z } = s;
  const U = codeIntersect(Z, codeParallel(Z, A, B), A, D);
  const R = codeIntersect(Z, codeParallel(Z, A, D), C, D);
  const local3 = codeIntersect(C, D, B, Z);
  const local4 = codeIntersect(A, D, B, Z);
  const below = codeInside(local3, B, local4);
  let M, K, L, P, Q;
  if (below) {
    M = codeIntersect(B, Z, C, D);
    const local1 = codeParallel(M, B, C);
    L = codeIntersect(M, local1, Z, U);
    K = codeIntersect(M, local1, A, B);
    if (s.para) {
      Q = pt(Z.x + (U.x - L.x) / 2, Z.y + (U.y - L.y) / 2);
      P = pt(B.x + (U.x - L.x) / 2, B.y + (U.y - L.y) / 2);
    } else {
      Q = pt(Z.x + U.x - L.x, Z.y + U.y - L.y);
      P = pt(B.x, B.y);
    }
  } else {
    M = codeIntersect(B, Z, A, D);
    const local1 = codeParallel(M, B, A);
    L = codeIntersect(M, local1, Z, R);
    K = codeIntersect(M, local1, C, B);
    if (s.para) {
      Q = pt(Z.x + (R.x - L.x) / 2, Z.y + (R.y - L.y) / 2);
      P = pt(B.x + (R.x - L.x) / 2, B.y + (R.y - L.y) / 2);
    } else {
      Q = pt(Z.x + R.x - L.x, Z.y + R.y - L.y);
      P = pt(B.x, B.y);
    }
  }
  return { U, R, M, K, L, P, Q, below };
}

/* UpdateCoefficientX/Y: B-D is the numerator pair, Z-D the denominator pair. */
function codeCoefficient(b, d, z) {
  const num = b - d, den = z - d;
  if (Math.abs(num) < 0.1) return Math.abs(den) < 0.1 ? 1 : 100000;
  return den / num;
}

/* UpdateZ: Z.x = XCoef*B.x + (1-XCoef)*D.x, and likewise for y. */
function codeUpdateZ(s) {
  return pt(s.xc * s.B.x + (1 - s.xc) * s.D.x,
    s.yc * s.B.y + (1 - s.yc) * s.D.y);
}

/* VerifyZ: the rounded ten-unit inset from A→C and B→D, then Polygon.contains.
   Written with reversed edge order and a strict crossing test, so it is an
   independent transcription of the same hit test even for a slanted inset. */
function codeVerifyZ(s, z) {
  const ac = sub(s.C, s.A), bd = sub(s.D, s.B);
  const u = mul(ac, 10 / Math.hypot(ac.x, ac.y));
  const v = mul(bd, 10 / Math.hypot(bd.x, bd.y));
  const poly = [
    pt(Math.round(s.A.x + u.x), Math.round(s.A.y + u.y)),
    pt(Math.round(s.B.x + v.x), Math.round(s.B.y + v.y)),
    pt(Math.round(s.C.x - u.x), Math.round(s.C.y - u.y)),
    pt(Math.round(s.D.x - v.x), Math.round(s.D.y - v.y)),
  ];
  const p = pt(Math.round(z.x), Math.round(z.y));
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/* Redefine(target,a,b,c) = a + c - b: the target is arg1, then arg2 + arg4 - arg3. */
function codeRedefine(a, b, c) {
  return pt(a.x + c.x - b.x, a.y + c.y - b.y);
}

const configurations = [];
for (const W of [180, 240, 280, 340]) {
  for (const H of [150, 190, 250]) {
    for (let xi = 1; xi <= 9; xi++) {
      for (let yi = 1; yi <= 9; yi++) {
        const xc = xi / 10, yc = yi / 10;
        for (const para of [false, true]) {
          const s = {
            A: pt(20, 20), B: pt(20, 20 + H), C: pt(20 + W, 20 + H), D: pt(20 + W, 20),
            Z: pt(xc * 20 + (1 - xc) * (20 + W), yc * (20 + H) + (1 - yc) * 20),
            xc, yc, para, showHint: true, showNames: true, explored: false,
          };
          configurations.push(s);
        }
      }
    }
  }
}
const rand = rng(6122);
for (let i = 0; i < 1200; i++) {
  const W = 120 + rand() * 240, H = 100 + rand() * 180;
  const xc = 0.05 + rand() * 0.9, yc = 0.05 + rand() * 0.9;
  const para = rand() < 0.5;
  configurations.push({
    A: pt(20, 20), B: pt(20, 20 + H), C: pt(20 + W, 20 + H), D: pt(20 + W, 20),
    Z: pt(xc * 20 + (1 - xc) * (20 + W), yc * (20 + H) + (1 - yc) * 20),
    xc, yc, para, showHint: true, showNames: true, explored: false,
  });
}

{
  let badPoint = 0, badBranch = 0, badZ = 0;
  let belowCount = 0, aboveCount = 0;
  for (const s of configurations) {
    const core = C.compute(s);
    const code = codeCompute(s);
    for (const key of ["U", "R", "M", "K", "L", "P", "Q"]) {
      if (!samePoint(core[key], code[key], 1e-8)) badPoint++;
    }
    if (core.below !== code.below) badBranch++;
    if (core.below) belowCount++; else aboveCount++;
    if (codeVerifyZ(s, s.Z) !== C.verifyZ(s, s.Z)) badZ++;
  }
  check(`${configurations.length} configurations: all seven computed points match a second transcription`,
    badPoint === 0, `${badPoint} wrong`);
  check("the branch choice (CD first vs AD first) matches the bytecode everywhere", badBranch === 0);
  check("VerifyZ agrees with a second transcription everywhere", badZ === 0);
  check("the grid covers both branches", belowCount > 500 && aboveCount > 500,
    `below ${belowCount}, above ${aboveCount}`);
}

/* The drag rules, transcribed as the mouse handlers do them. */
function codeDrag(s, name, raw) {
  const p = pt(Math.max(0, Math.min(C.WIDTH, raw.x)), Math.max(0, Math.min(C.HEIGHT, raw.y)));
  let A = s.A, B = s.B, Cc = s.C, D = s.D, Z = s.Z, xc = s.xc, yc = s.yc;
  if (name === "Z") {
    Z = p;
    xc = codeCoefficient(B.x, D.x, Z.x);
    yc = codeCoefficient(B.y, D.y, Z.y);
  } else {
    const moved = pt(p.x, s[name].y); // Fix(2)
    if (name === "A") { A = moved; Cc = codeRedefine(B, A, D); }
    else if (name === "B") { B = moved; Cc = codeRedefine(B, A, D); Z = codeUpdateZ({ B, D, xc, yc }); }
    else if (name === "C") { Cc = moved; A = codeRedefine(D, Cc, B); }
    else { D = moved; A = codeRedefine(D, Cc, B); }
  }
  const next = { A, B, C: Cc, D, Z, xc, yc };
  if (!codeVerifyZ(next, Z)) return s; // the applet restores the spare point
  return Object.assign({}, next, { explored: true });
}

{
  let bad = 0;
  const randDrag = rng(271828);
  for (let i = 0; i < 3000; i++) {
    let a = C.start({ para: randDrag() < 0.5 });
    if (i % 5 === 0) a = C.randomize(a);
    const name = ["A", "B", "C", "Z"][Math.floor(randDrag() * 4)];
    const raw = pt(randDrag() * 440 - 20, randDrag() * 340 - 20);
    const mine = C.movePoint(a, name, raw);
    const code = codeDrag(a, name, raw);
    if (!samePoint(mine.A, code.A, 1e-9) || !samePoint(mine.B, code.B, 1e-9) ||
        !samePoint(mine.C, code.C, 1e-9) || !samePoint(mine.D, code.D, 1e-9) ||
        !samePoint(mine.Z, code.Z, 1e-9) || !close(mine.xc, code.xc, 1e-9) ||
        !close(mine.yc, code.yc, 1e-9)) bad++;
  }
  check("3000 random drags of every handle match the applet's VerifyZ/Redefine/UpdateZ", bad === 0,
    `${bad} wrong`);
  check("the coefficient guards match the bytecode at zero denominators",
    C.coefficient(0, 0, 0) === 1 && C.coefficient(0, 0, 5) === 100000 &&
    C.coefficient(5, 0, 0) === 0);
}

/* ------------------------------------------------- 3. the page's claims */

{
  let unequalCuts = 0, badSum = 0, badTriangle = 0, badParallel = 0, badApprox = 0;
  for (const s of configurations) {
    const g = C.compute(s);
    if (!g.valid) continue;
    if (!close(g.piece1Area, g.piece2Area, 2e-7)) unequalCuts++;
    if (!close(g.piece1Area + g.piece2Area, g.cakeArea, 2e-7)) badSum++;
    const expectedTriangle = g.leftoverArea * (s.para ? 0.25 : 0.5);
    if (!close(g.triangleArea, expectedTriangle, 2e-7)) badTriangle++;
    if (s.para && (!samePoint(sub(g.Q, g.P), sub(s.Z, s.B), 1e-8) ||
        !samePoint(sub(g.P, s.B), sub(g.Q, s.Z), 1e-8))) badParallel++;
    /* BZ itself already halves the real cake below the diagonal. */
    if (g.below && !close(g.approx1, g.approx2, 2e-7)) badApprox++;
  }
  check(`${configurations.length} configurations: triangle cut BQ halves the maimed cake`,
    unequalCuts === 0 && badSum === 0, `${unequalCuts} unequal, ${badSum} wrong total`);
  check("the parallel cut PQ halves the cake too, and is parallel to BZ", badParallel === 0);
  check("triangle BZQ is half the leftover rectangle (or a quarter in parallel mode)",
    badTriangle === 0, `${badTriangle} wrong`);
  check("below the diagonal, BZ already splits the real L-shape KBCRZL evenly",
    badApprox === 0, `${badApprox} wrong`);
}

{
  /* Had Z been on BD, the cut BQ collapses to BZ and still halves the cake. */
  let bad = 0, collapsed = 0;
  for (let i = 1; i <= 19; i++) {
    for (const H of [150, 190, 250]) {
      const W = 280, k = i / 20;
      const s = {
        A: pt(20, 20), B: pt(20, 20 + H), C: pt(20 + W, 20 + H), D: pt(20 + W, 20),
        Z: pt(20 + W * (1 - k), 20 + H * k), xc: k, yc: k,
        para: false, showHint: true, showNames: true, explored: false,
      };
      const g = C.compute(s);
      if (!samePoint(g.P, s.B, 1e-8) || !samePoint(g.Q, s.Z, 1e-8)) bad++;
      if (!close(g.approx1, g.approx2, 1e-7)) bad++;
      if (!close(g.piece1Area, g.piece2Area, 1e-7)) bad++;
      if (close(g.Q.x, s.Z.x, 1e-7) && close(g.Q.y, s.Z.y, 1e-7)) collapsed++;
    }
  }
  check("on the diagonal BD, BQ is exactly BZ for all 57 positions", collapsed === 57 && bad === 0,
    `${collapsed} collapsed, ${bad} wrong`);
}

{
  /* The page says BZ divides "KBCMZL" evenly. It does not: M is the hit on
     the line CD, which can lie above R inside the removed corner. Below the
     diagonal, BZ splits the real cake part KBCRZL into equal KBZL and BCRZ. */
  const s = C.start({ para: false });
  const g = C.compute(s);
  check("the printed KBCMZL claim is false off the diagonal, and the test says so",
    !close(g.printedSplit1, g.printedSplit2) &&
    close(g.approx1, g.approx2),
    `KBCMZL ${Math.round(g.printedSplit1)} vs ${Math.round(g.printedSplit2)}`);
  let bad = 0;
  for (const cfg of configurations) {
    const gg = C.compute(cfg);
    if (gg.below && gg.valid && close(gg.printedSplit1, gg.printedSplit2)) bad++;
  }
  check("KBCMZL is not the equal split for any grid case", bad === 0, `${bad} cases`);
  /* Above the diagonal the equal halves are BCRZ and BAUZ + the triangle. */
  let aboveBad = 0;
  for (const cfg of configurations) {
    const gg = C.compute(cfg);
    if (!gg.valid || gg.below || cfg.para) continue;
    if (!close(gg.approx1 + gg.leftoverArea / 2, gg.cakeArea / 2, 2e-7)) aboveBad++;
  }
  check("above the diagonal, BAUZ plus the triangle is half the cake", aboveBad === 0,
    `${aboveBad} wrong`);
}

{
  /* Degenerate input must not throw or invent finite points. */
  const s = C.start({});
  const flat = Object.assign({}, s, { B: pt(s.B.x, s.A.y + 0.05), C: pt(s.C.x, s.A.y + 0.05) });
  const g = C.compute(flat);
  check("a nearly flat cake reports unusable intersections instead of crashing",
    typeof g.valid === "boolean" && Number.isFinite(g.cakeArea));
  check("a random new shape is a valid rectangle with Z inside the inset", (() => {
    const r = C.randomize(s);
    return r.A.x === r.B.x && r.D.x === r.C.x && r.A.y === r.D.y && r.B.y === r.C.y &&
      C.verifyZ(r, r.Z) && C.compute(r).valid;
  })());
}

done("maimed-cake");
