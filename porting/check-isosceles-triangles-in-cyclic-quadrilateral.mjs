#!/usr/bin/env node
"use strict";

/*
 * Logic test for isosceles-triangles-in-cyclic-quadrilateral-core.js.
 *
 *   node porting/check-isosceles-triangles-in-cyclic-quadrilateral.mjs
 *
 * 1. The applet's Reset(), four circle-glider moves and four checkboxes.
 * 2. A second, literal transcription of the applet's Compute() — GeoSDoub's
 *    Intersect/Dist, CTKGeometryPlus.Prorate/Barycenter — compared with the
 *    core over every quadruple of 24 circle positions (331,776 cases), the
 *    initial position and seeded random continuous positions.
 * 3. Every claim on the page, over the same exhaustive grid and 3,000 random
 *    crossing configurations: AM = AD, BN = BC, angle CAD = angle CBD,
 *    AG/AD = BG/BC, M on AC, N on BD, triangle similarity, and, when M and N
 *    are distinct, MN || AB.
 * 4. The edge cases the page mentions: M = N = G, parallel chords, the
 *    short-distance guard in Prorate, and a counterexample to the page's
 *    closing remark that "the requirement that the chords cross is redundant".
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const SLUG = "isosceles-triangles-in-cyclic-quadrilateral";
const C = loadCore(`${SLUG}/${SLUG}-core.js`, "IsoscelesTrianglesInCyclicQuadrilateralCore");

const P = (x, y) => ({ x, y });
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cr = (a, b) => a.x * b.y - a.y * b.x;
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const closePoint = (p, q, t) => finite(p) === finite(q) && (!finite(p) || (Math.abs(p.x - q.x) <= t && Math.abs(p.y - q.y) <= t));
const close = (a, b, t) => Math.abs(a - b) <= t;
const R = 75, CENTER = P(200, 150);
const onCircle = (theta) => P(CENTER.x + R * Math.cos(theta), CENTER.y + R * Math.sin(theta));

/* ----------------------------------------- the applet's arithmetic, bytecode */

/* GeoSDoub.Dist(DoubPoint,DoubPoint) = sqrt(SqDist); SqDist is the sum of the
 * squared coordinate differences. */
function appletDist(p, q) {
  return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
}

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint): four line
 * coefficients, the 2x2 determinant, and |determinant| < 1 → NaN,NaN. */
function appletIntersect(a, b, c, e) {
  const a1 = b.y - a.y, b1 = a.x - b.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = e.y - c.y, b2 = c.x - e.x, c2 = c.x * e.y - c.y * e.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det);
}

/* CTKGeometryPlus.Prorate(p,q,r): r = r / Dist(p,q), then
 * p + r*(q-p); if Dist(p,q) < 0.1 the applet returns p unchanged. */
function appletProrate(p, q, r) {
  const length = appletDist(p, q);
  if (length < 0.1) return P(p.x, p.y);
  const t = r / length;
  return P(p.x + t * (q.x - p.x), p.y + t * (q.y - p.y));
}

function appletBarycenter(p, q, r) {
  return P((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
}

/* IsoscelesTrianglesInCyclicQuadrilateralCanvas.Compute(), verbatim: G, M, N,
 * the line MN, and the centre used for the point names. */
function appletCompute(A, B, Cc, D) {
  const G = appletIntersect(A, Cc, B, D);
  const M = appletProrate(A, Cc, appletDist(A, D));
  const N = appletProrate(B, D, appletDist(B, Cc));
  const MN = [M, N];
  const nameCenter = appletBarycenter(M, N, G);
  return { G, M, N, MN, nameCenter };
}

/* Canvas.Reset() on the 400x300 board: circle (200,150) radius floor(300/4),
 * points at the four constants in the bytecode. */
function appletReset(W = 400, H = 300) {
  const radius = Math.floor(Math.min(W, H) / 4);
  const centre = P(W / 2, H / 2);
  const angles = [0.5235987755982988, 2.6179938779914944, 3.765191430678208, 5.235987755982989];
  return angles.map((theta) => P(centre.x + radius * Math.cos(theta), centre.y + radius * Math.sin(theta)));
}

/* An independent statement of the page's claim, not using the core. */
function pageClaim(A, B, Cc, D) {
  const r = appletCompute(A, B, Cc, D);
  const corners = [A, B, Cc, D];
  let separated = true;
  for (let i = 0; i < 4 && separated; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (appletDist(corners[i], corners[j]) <= 1e-6 * R) { separated = false; break; }
    }
  }
  const tAC = finite(r.G) ? appletDist(r.G, A) / appletDist(A, Cc) : NaN;
  const tBD = finite(r.G) ? appletDist(r.G, B) / appletDist(B, D) : NaN;
  return {
    amEqualsAd: close(appletDist(A, r.M), appletDist(A, D), 1e-9),
    bnEqualsBc: close(appletDist(B, r.N), appletDist(B, Cc), 1e-9),
    proportion: finite(r.G) && separated && close(appletDist(A, r.G) / appletDist(A, D),
      appletDist(B, r.G) / appletDist(B, Cc), 1e-9),
    parallel: appletDist(r.M, r.N) > 1e-7 &&
      Math.abs(cr(sub(r.M, r.N), sub(B, A))) <= 1e-9 * R * appletDist(A, B),
    crossing: separated && tAC > 0 && tAC < 1 && tBD > 0 && tBD < 1,
    mOnAC: Math.abs(cr(sub(r.M, A), sub(Cc, A))) <= 1e-9 * R,
    nOnBD: Math.abs(cr(sub(r.N, B), sub(D, B))) <= 1e-9 * R,
    mn: appletDist(r.M, r.N),
  };
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  const reset = appletReset();
  ["A", "B", "C", "D"].forEach((name, i) => {
    check(`Reset puts ${name} at the applet's position`, closePoint(s[name], reset[i], 1e-9));
  });
  check("the applet's centre is (200,150)", C.CIRCLE.center.x === 200 && C.CIRCLE.center.y === 150);
  check("the applet's radius is floor(min(W,H)/4) = 75", C.CIRCLE.radius === 75);
  check("all four checkboxes start unchecked", C.OPTIONS.every((name) => !s.options[name]));
  check("a new diagram is not explored and has no result", !s.explored && C.result(s) === null);
  const g = C.geometry(s);
  check("the starting diagram has a construction", !!g);
  check("the starting chords cross", g.claims.crossing);
  check("the starting M and N are distinct", g.claims.mnDefined);
  check("the starting diagram has MN parallel to AB", g.claims.mnParallelAb);
  check("the page's independent claim agrees at the start", pageClaim(s.A, s.B, s.C, s.D).parallel);
  check("the start description says the lines are parallel", /parallel to AB/.test(C.describe(s)));
}

{
  const s = C.start();
  const moved = C.move(s, "A", P(300, 60));
  check("a corner is projected back onto the circle",
    close(d(moved.A, C.CIRCLE.center), C.CIRCLE.radius, 1e-9));
  check("dragging projects along the radius",
    Math.abs((moved.A.x - 200) / (300 - 200) - (moved.A.y - 150) / (60 - 150)) < 1e-9);
  check("a move leaves the old position alone", s.A.x === resetX() && moved.explored && !s.explored);
  check("an unknown corner is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 4)) === s);
  const h = C.setOption(s, "hint", true);
  check("the Hint checkbox toggles on and marks the diagram explored",
    h.options.hint && h.explored && !s.options.hint);
  check("an unknown checkbox is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(h);
  check("Reset restores the points but keeps the checkboxes",
    closePoint(r.A, s.A, 1e-9) && r.options.hint && r.explored);
  for (const name of C.OPTIONS) {
    check(`Show ${name} is reported in the status line`,
      new RegExp(name === "premise" ? "tick marks" : name === "statement" ? "grey lines"
        : name === "hint" ? "equal angles" : "labelled")
        .test(C.describe(C.setOption(s, name, true))));
  }
}
function resetX() { return appletReset()[0].x; }

/* -------------------------------- 2. the core against the applet's method */

{
  let worstG = 0, worstM = 0, worstN = 0, worstCenter = 0, cases = 0;
  const angles = [];
  for (let i = 0; i < 24; i++) angles.push((i * Math.PI) / 12);
  const compare = (A, B, Cc, D) => {
    const a = appletCompute(A, B, Cc, D);
    const g = C.compute(A, B, Cc, D);
    if (!g) throw new Error("core returned no geometry for finite corners");
    worstG = Math.max(worstG, closePoint(g.G, a.G, 0) ? 0 : 1);
    worstM = Math.max(worstM, d(g.M, a.M));
    worstN = Math.max(worstN, d(g.N, a.N));
    worstCenter = Math.max(worstCenter, closePoint(g.nameCenter, a.nameCenter, 0) ? 0 : 1);
    cases++;
  };

  // Every quadruple of the 24 positions, including non-crossing orders.
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      for (let k = 0; k < 24; k++) {
        for (let l = 0; l < 24; l++) {
          compare(onCircle(angles[i]), onCircle(angles[j]), onCircle(angles[k]), onCircle(angles[l]));
        }
      }
    }
  }
  const s = C.start();
  compare(s.A, s.B, s.C, s.D);
  const rnd = rng(20261127);
  for (let i = 0; i < 3000; i++) {
    const t = Array.from({ length: 4 }, () => rnd() * 2 * Math.PI);
    compare(onCircle(t[0]), onCircle(t[1]), onCircle(t[2]), onCircle(t[3]));
  }

  check(`the grid compared ${cases} configurations with the applet's Compute()`, cases === 334777);
  check("G matches GeoSDoub.Intersect exactly on every case", worstG === 0);
  check("M matches CTKGeometryPlus.Prorate on every case", worstM <= 1e-9, `worst ${worstM}`);
  check("N matches CTKGeometryPlus.Prorate on every case", worstN <= 1e-9, `worst ${worstN}`);
  check("the name centre matches Barycenter exactly on every case", worstCenter === 0);
}

/* ------------------------------------------- 3. the page's claims, all cases */

{
  const angles = [];
  for (let i = 0; i < 24; i++) angles.push((i * Math.PI) / 12);
  let crossingCases = 0, nonCrossing = 0, nonCrossingFailures = 0, distinct = 0;
  let worstAm = 0, worstBn = 0, worstAngle = 0, worstRatio = 0, worstParallel = 0;
  let worstMCol = 0, worstNCol = 0, worstSimilar = 0;
  const test = (A, B, Cc, D) => {
    const g = C.compute(A, B, Cc, D);
    const p = pageClaim(A, B, Cc, D);
    if (!g || !p.crossing) { nonCrossing++; return; }
    crossingCases++;
    worstAm = Math.max(worstAm, g.measures.amError);
    worstBn = Math.max(worstBn, g.measures.bnError);
    worstAngle = Math.max(worstAngle, g.measures.inscribedError);
    worstRatio = Math.max(worstRatio, g.measures.proportionError);
    worstParallel = Math.max(worstParallel, g.measures.parallelError);
    worstMCol = Math.max(worstMCol, g.measures.mAlongAC);
    worstNCol = Math.max(worstNCol, g.measures.nAlongBD);
    // Near M = N the *ratios* are ill-conditioned even though MN is still
    // parallel; the exact similarity claim is asserted above only where MN
    // is a genuine line.  The error summary skips the near-degenerate cases.
    if (g.measures.mn > 1e-3 * R && g.measures.ag > 0.1 && g.measures.bg > 0.1) {
      worstSimilar = Math.max(worstSimilar, g.measures.similarityError);
    }
    if (!g.claims.amEqualsAd || !p.amEqualsAd) throw new Error("AM = AD failed");
    if (!g.claims.bnEqualsBc || !p.bnEqualsBc) throw new Error("BN = BC failed");
    if (!g.claims.inscribedAnglesEqual) throw new Error("inscribed angles failed");
    if (!g.claims.proportion || !p.proportion) throw new Error("AG/AD = BG/BC failed");
    if (!g.claims.mOnAc || !p.mOnAC || !g.claims.nOnBd || !p.nOnBD) throw new Error("collinearity failed");
    if (g.claims.mnDefined) {
      distinct++;
      if (!g.claims.similarTriangles) throw new Error("triangle similarity failed");
      if (!g.claims.mnParallelAb || !p.parallel) throw new Error("MN || AB failed");
    }
  };

  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      for (let k = 0; k < 24; k++) {
        for (let l = 0; l < 24; l++) {
          if (i === j || i === k || i === l || j === k || j === l || k === l) continue;
          test(onCircle(angles[i]), onCircle(angles[j]), onCircle(angles[k]), onCircle(angles[l]));
        }
      }
    }
  }
  const rnd = rng(99173);
  for (let i = 0; i < 3000; i++) {
    const t = Array.from({ length: 4 }, () => rnd() * 2 * Math.PI).sort((a, b) => a - b);
    test(onCircle(t[0]), onCircle(t[1]), onCircle(t[2]), onCircle(t[3]));
  }

  check(`exhaustive grid and random tests covered ${crossingCases} crossing configurations`,
    crossingCases > 100000);
  check("AM = AD throughout", worstAm <= 1e-9, `worst ${worstAm}`);
  check("BN = BC throughout", worstBn <= 1e-9, `worst ${worstBn}`);
  check("the inscribed angles CAD and CBD are equal throughout", worstAngle <= 1e-9,
    `worst ${worstAngle}`);
  check("AG/AD = BG/BC throughout", worstRatio <= 1e-9, `worst ${worstRatio}`);
  check("M stays on AC and N on BD", worstMCol <= 1e-9 && worstNCol <= 1e-9,
    `worst ${worstMCol}, ${worstNCol}`);
  check("triangles ABG and MNG have matching side ratios", worstSimilar <= 1e-9,
    `worst ${worstSimilar}`);
  check(`MN || AB in all ${distinct} configurations with M != N`, worstParallel <= 1e-9,
    `worst ${worstParallel}`);
  check("the grid also exercised non-crossing configurations", nonCrossing > 0);

  // The page's last remark is not true in general: with the labels in the
  // cyclic order A,C,B,D the chords do not cross and MN is not parallel.
  const badAngles = [Math.PI / 6, (210 * Math.PI) / 180, (150 * Math.PI) / 180, (300 * Math.PI) / 180];
  const bad = C.compute(...badAngles.map(onCircle));
  check("a concrete non-crossing configuration is not parallel",
    !bad.claims.crossing && !bad.claims.mnParallelAb && bad.measures.parallelError > 1,
    `parallel error ${bad.measures.parallelError}`);
  const badPage = pageClaim(...badAngles.map(onCircle));
  check("the independent page-claim function agrees on the counterexample",
    !badPage.crossing && !badPage.parallel);
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 24; j++) {
      for (let k = 0; k < 24; k++) {
        for (let l = 0; l < 24; l++) {
          if (new Set([i, j, k, l]).size < 4) continue;
          const g = C.compute(onCircle(angles[i]), onCircle(angles[j]), onCircle(angles[k]), onCircle(angles[l]));
          if (!g.claims.crossing && g.claims.mnDefined && g.measures.parallelError > 1e-6) nonCrossingFailures++;
        }
      }
    }
  }
  check(`the grid found ${nonCrossingFailures} counterexamples to "crossing is redundant"`,
    nonCrossingFailures > 0);
}

/* --------------------------------------------------- 4. edge cases and text */

{
  // C = PI makes AD = AG and BC = BG, so M = N = G and MN is not a line.
  const A = onCircle(Math.PI / 6), B = onCircle(5 * Math.PI / 6);
  const Cc = onCircle(Math.PI), D = onCircle(5 * Math.PI / 3);
  const g = C.compute(A, B, Cc, D);
  const a = appletCompute(A, B, Cc, D);
  check("M = N at the coincidence configuration", d(g.M, g.N) < 1e-9);
  check("M = N = G at the coincidence configuration", d(g.M, a.G) < 1e-9);
  check("the coincidence is reported as MN undefined", !g.claims.mnDefined);
  const s = C.start();
  const coincident = C.move(C.move(C.move(s, "C", Cc), "A", A), "D", D);
  check("the description mentions that M and N fell together",
    /fallen together/.test(C.describe(coincident)));
}

{
  // AC || BD: GeoSDoub.Intersect returns (NaN,NaN) but M and N are still built.
  const A = onCircle(0), B = onCircle(Math.PI), Cc = onCircle(Math.PI / 2), D = onCircle(3 * Math.PI / 2);
  const g = C.compute(A, B, Cc, D);
  const a = appletCompute(A, B, Cc, D);
  check("parallel chords give no finite G", !Number.isFinite(g.G.x) && !Number.isFinite(a.G.x));
  check("M and N are still found with G at infinity",
    closePoint(g.M, a.M, 1e-9) && closePoint(g.N, a.N, 1e-9));
  check("the name centre is NaN when G is NaN", !Number.isFinite(g.nameCenter.x));
  const s = C.move(C.move(C.move(C.move(C.start(), "A", A), "B", B), "C", Cc), "D", D);
  check("the description explains the parallel chords", /parallel, so G/.test(C.describe(s)));
}

{
  // The applet's 0.1 guard: a very short AC makes M = A, and a short BD makes N = B.
  const A = onCircle(0.3), B = onCircle(2.0);
  const Cc = onCircle(0.301), D = onCircle(2.001);
  const g = C.compute(A, B, Cc, D);
  const a = appletCompute(A, B, Cc, D);
  check("the short-distance guard returns M = A", closePoint(g.M, A, 0) && closePoint(a.M, A, 0));
  check("the short-distance guard returns N = B", closePoint(g.N, B, 0) && closePoint(a.N, B, 0));
}

{
  // An extension case: Prorate puts M past C when AD > AC, yet MN stays parallel.
  const A = onCircle(Math.PI / 6), B = onCircle(5 * Math.PI / 6);
  const Cc = onCircle(160 * Math.PI / 180), D = onCircle(210 * Math.PI / 180);
  const g = C.compute(A, B, Cc, D);
  const tAC = (g.G.x - A.x) / (Cc.x - A.x);
  check("G can lie between A and C with M beyond C", tAC > 0 && tAC < 1 &&
    d(g.M, A) > d(Cc, A) && g.claims.mnParallelAb);
  check("the corresponding applet computation agrees",
    closePoint(g.M, appletCompute(A, B, Cc, D).M, 1e-9));
}

done(SLUG);
