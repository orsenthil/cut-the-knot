#!/usr/bin/env node
"use strict";

/*
 * Logic test for every-trapezoid-is-para/every-trapezoid-is-para-core.js.
 *
 *   node porting/check-every-trapezoid-is-para.mjs
 *
 * The page claims that a bogus derivation ("divide by z - x") proves
 * |AD| = |BC|, but the real conclusion is x = z (AG = CH). It also states
 * four similarity formulas, two algebraic identities and a parabola
 * monotonicity argument. This test checks all of them over a grid of 768
 * trapezoids plus 2,000 random ones, and compares every derived point with a
 * second, literal transcription of the applet's Compute() bytecode.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("every-trapezoid-is-para/every-trapezoid-is-para-core.js", "EveryTrapezoidIsParaCore");
const pt = (x, y) => ({ x, y });
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const trap = (ax, top, a, bx, bottom, b) => ({
  A: pt(ax, top), B: pt(bx, bottom), C: pt(bx + b, bottom), D: pt(ax + a, top),
  showNames: true, showStatement: false, showPremise: false, showHint: false, explored: false,
});

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the start's corners are the applet's init() positions", [s.A, s.B, s.C, s.D], [
    pt(180 - 400 / 12, 105 - 250 / 8), pt(180 - 400 / 6, 105 + 250 / 8),
    pt(180 + 400 / 6, 105 + 250 / 8), pt(180 + 400 / 18, 105 - 250 / 8),
  ]);
  check("the start keeps AD and BC horizontal", s.A.y === s.D.y && s.B.y === s.C.y);
  check("the start is a trapezoid with unequal bases", (() => {
    const g = C.compute(s);
    return g.a > 0 && g.b > g.a && !g.parallelogram && g.valid;
  })());
  check("names are shown on the explanatory applet's diagram", s.showNames === true);
  check("statement, premise and hint start hidden",
    !s.showStatement && !s.showPremise && !s.showHint);
  check("an illustration has no result to report", C.result(s) === null);
  check("compute finds both crossings at the start", (() => {
    const g = C.compute(s);
    return Number.isFinite(g.G.x) && Number.isFinite(g.H.x) &&
      g.G.x > s.A.x && g.G.x < s.C.x && g.H.x > s.A.x && g.H.x < s.C.x;
  })());
  check("the start's status names AG, CH and the unequal bases",
    /AG = CH/.test(C.describe(s)) && /bases are different/.test(C.describe(s)));
  check("an unknown option is refused", C.setOption(s, "nonesuch", true) === s);
  check("an unknown corner is refused", C.movePoint(s, "Q", pt(1, 1)) === s);
  check("a non-numeric pointer is refused",
    C.movePoint(s, "A", pt(NaN, 1)) === s && C.movePoint(s, "A", null) === s);
  check("each option toggles on and off and marks the picture explored", (() => {
    let t = s;
    for (const key of C.OPTION_KEYS) {
      t = C.setOption(t, key, true);
      if (t[key] !== true || !t.explored) return false;
      t = C.setOption(t, key, false);
      if (t[key] !== false) return false;
    }
    return true;
  })());
  check("the applet's length guard refuses a collapsed trapezoid", (() => {
    const g = C.compute(trap(100, 60, 1, 120, 190, 80));
    return !g.valid && g.G === undefined && g.H === undefined;
  })());
  check("a degenerate crossing returns an invalid picture", (() => {
    const g = C.compute(trap(100, 60, 50, 120, 60, 80));
    return !g.valid;
  })());
}

/* ------------------------- 2. a literal second transcription of the applet */

/* GeoSDoub.Intersect(p1,p2,p3,p4), from its bytecode: a1..c2, then the
   determinant d, with |d| < 1 giving NaN. Deliberately not the core's copy. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const d = a1 * b2 - a2 * b1;
  if (Math.abs(d) < 1) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / d, (c1 * a2 - c2 * a1) / d);
}

/* EveryTrapezoidIsParaCanvas.Compute(), from its bytecode: the two 2-unit
   length guards, E, F, G, H in that exact order. */
function appletCompute(s) {
  const A = s.A, B = s.B, Cc = s.C, D = s.D;
  if (dist(A, D) < 2 || dist(A, B) < 2) return null;
  const E = pt(Cc.x + D.x - A.x, Cc.y);
  const F = pt(A.x + B.x - Cc.x, A.y);
  const G = appletIntersect(A, Cc, B, D);
  const H = appletIntersect(A, Cc, E, F);
  return { E, F, G, H };
}

/* A grid covering short and long top bases, shifted left or right, narrow and
   wide bottom bases, and both heights; plus a reproducible random sample. */
const shapes = [];
for (const ax of [20, 60, 100, 140]) {
  for (const a of [35, 60, 90, 120]) {
    for (const bx of [30, 80, 130]) {
      for (const b of [40, 80, 120, 160]) {
        for (const top of [50, 80]) {
          for (const bottom of [170, 200]) shapes.push(trap(ax, top, a, bx, bottom, b));
        }
      }
    }
  }
}
const rand = rng(20261127);
for (let i = 0; i < 2000; i++) {
  const a = 30 + rand() * 130;
  const b = 30 + rand() * 150;
  const ax = 20 + rand() * (350 - a);
  const bx = 20 + rand() * (350 - b);
  shapes.push(trap(ax, 30 + rand() * 70, a, bx, 160 + rand() * 60, b));
}
check("the grid and the random sample include both base orders",
  shapes.some((s) => s.D.x - s.A.x < s.C.x - s.B.x) &&
  shapes.some((s) => s.D.x - s.A.x > s.C.x - s.B.x), `${shapes.length} shapes`);

{
  let badE = 0, badF = 0, badG = 0, badH = 0, badValid = 0;
  for (const s of shapes) {
    const g = C.compute(s), a = appletCompute(s);
    if (!g.valid || !a) { badValid++; continue; }
    if (!near(g.E.x, a.E.x, 1e-8) || !near(g.E.y, a.E.y, 1e-8)) badE++;
    if (!near(g.F.x, a.F.x, 1e-8) || !near(g.F.y, a.F.y, 1e-8)) badF++;
    if (!near(g.G.x, a.G.x, 1e-8) || !near(g.G.y, a.G.y, 1e-8)) badG++;
    if (!near(g.H.x, a.H.x, 1e-8) || !near(g.H.y, a.H.y, 1e-8)) badH++;
  }
  check(`all ${shapes.length} pictures are computed by both`, badValid === 0, `${badValid} bad`);
  check(`all ${shapes.length} E points match bytecode Compute`, badE === 0, `${badE} bad`);
  check(`all ${shapes.length} F points match bytecode Compute`, badF === 0, `${badF} bad`);
  check(`all ${shapes.length} G points match bytecode GeoSDoub.Intersect`, badG === 0, `${badG} bad`);
  check(`all ${shapes.length} H points match bytecode GeoSDoub.Intersect`, badH === 0, `${badH} bad`);
  check("GeoSDoub.Intersect's |d| < 1 guard gives NaN in both", (() => {
    const p = appletIntersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1));
    const q = C.intersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1));
    return Number.isNaN(p.x) && Number.isNaN(q.x);
  })());
}

/* --------------------------------------- 3. every claim the page makes */

{
  let badXZ = 0, bad3 = 0, bad4 = 0, badPara = 0, badRatio = 0;
  let bad1 = 0, bad2 = 0, badSigned = 0, badReciprocal = 0, badParabola = 0;
  let badDivide = 0, unequal = 0, pictured = 0, maxXZ = 0;
  for (const s of shapes) {
    const g = C.compute(s);
    if (!g.valid) { badXZ++; continue; }
    /* The conclusion: AG = CH, however long the two bases are. */
    const err = Math.abs(g.x - g.z);
    maxXZ = Math.max(maxXZ, err);
    if (err > 1e-6) badXZ++;
    /* (3) and (4): x / BF = z / BF = a / (a + b). */
    if (!near(g.x / g.BF, g.a / (g.a + g.b), 1e-7) ||
        !near(g.z / g.BF, g.a / (g.a + g.b), 1e-7)) bad3++;
    if (!near(g.predictedX, g.x, 1e-6) || !near(g.predictedZ, g.z, 1e-6)) bad4++;
    /* AFBC and ACED are parallelograms, so BF || AC || DE. */
    if (Math.abs(g.paraAFBC[0]) > 1e-8 || Math.abs(g.paraAFBC[1]) > 1e-8 ||
        Math.abs(g.paraACED[0]) > 1e-8 || Math.abs(g.paraACED[1]) > 1e-8) badPara++;
    /* Similar triangles: CG / AG = AH / CH = b / a. */
    if (!near(g.ratioCGAG, g.b / g.a, 1e-7) || !near(g.ratioAHCH, g.b / g.a, 1e-7)) badRatio++;
    /* (1) and (2) as the page draws them: order A, G, H, C, so y > 0. */
    if (g.pictured) {
      pictured++;
      if (!near(g.eq1, g.x, 1e-6) || !near(g.eq2, g.z, 1e-6) || !(g.y >= 0)) bad1++;
      /* The page's algebra: (x+y)/z = (z+y)/x, f(x) = f(z), and f is
         strictly increasing for w > -y/2. */
      if (!near((g.x + g.y) / g.z, (g.z + g.y) / g.x, 1e-6) ||
          !near(g.fX, g.fZ, 1e-6) || !near(g.ratioAHCH, (g.x + g.y) / g.z, 1e-6)) badReciprocal++;
      if (!near(g.fZ - g.fX, (g.z - g.x) * (g.z + g.x + g.y), 1e-6)) badParabola++;
      if (!near(g.fX, g.fZ, 1e-6) && g.x !== g.z) badParabola++;
    }
    /* With GH signed along AC, (1) and (2) hold in either base order. */
    if (!near(g.eq1Signed, g.x, 1e-6) || !near(g.eq2Signed, g.z, 1e-6)) badSigned++;
    /* z - x = (a/b)(x - z) forces z = x, since 1 + a/b > 0. */
    if (!near(g.z - g.x, (g.a / g.b) * (g.x - g.z), 1e-6)) badDivide++;
    if (!g.parallelogram) unequal++;
  }
  check(`${shapes.length} configurations keep AG = CH (max error ${maxXZ.toExponential(1)})`,
    badXZ === 0, `${badXZ} bad`);
  check(`${shapes.length} configurations satisfy x / BF = z / BF = a / (a + b)`, bad3 === 0, `${bad3} bad`);
  check(`${shapes.length} configurations satisfy formulas (3) and (4)`, bad4 === 0, `${bad4} bad`);
  check(`${shapes.length} configurations make AFBC and ACED parallelograms`, badPara === 0, `${badPara} bad`);
  check(`${shapes.length} configurations satisfy CG / AG = AH / CH = b / a`, badRatio === 0, `${badRatio} bad`);
  check(`${pictured} pictured-order cases satisfy formulas (1) and (2) with y >= 0`,
    pictured > 0 && bad1 === 0, `${bad1} bad`);
  check(`${shapes.length} configurations satisfy (1) and (2) with signed GH`, badSigned === 0, `${badSigned} bad`);
  check(`${pictured} pictured-order cases satisfy (x+y)/z = (z+y)/x = b/a`,
    badReciprocal === 0, `${badReciprocal} bad`);
  check(`${pictured} pictured-order cases satisfy f(x)=f(z) and f increasing past -y/2`,
    badParabola === 0, `${badParabola} bad`);
  check(`${shapes.length} configurations satisfy the page's z - x = (a/b)(x - z)`,
    badDivide === 0, `${badDivide} bad`);
  check(`not every trapezoid is a parallelogram: ${unequal} cases have a != b yet AG = CH`,
    unequal > 0);
  check("the faulty division would give a/b = -1 for x != z", near(10 / -10, -1));
  /* f is a parabola with vertex (-y/2, -y²/4): check the actual monotonicity
     claim algebraically, not just at x and z. */
  check("f(w) = w² + wy is strictly increasing for every w > -y/2", (() => {
    for (const y of [-30, -1, 0, 1, 30]) {
      for (const w of [-y / 2 + 0.01, -y / 2 + 0.1, 5 - y / 2, 40 - y / 2]) {
        const f = (v) => v * v + v * y;
        if (!(f(w + 0.01) > f(w))) return false;
      }
    }
    return true;
  })());
}

/* --------------------------------------- 4. dragging and the picture's UI */

{
  const rand2 = rng(777);
  let badShape = 0, badBounds = 0;
  for (let i = 0; i < 1000; i++) {
    const s = shapes[Math.floor(rand2() * shapes.length)];
    const name = ["A", "B", "C", "D"][Math.floor(rand2() * 4)];
    const m = C.movePoint(s, name, pt(rand2() * 460 - 30, rand2() * 320 - 30));
    const g = C.compute(m);
    if (m.A.y !== m.D.y || m.B.y !== m.C.y || m.D.x - m.A.x < C.MIN_SIDE - 1e-9 ||
        m.C.x - m.B.x < C.MIN_SIDE - 1e-9 || m.B.y - m.A.y < C.MIN_SIDE - 1e-9 ||
        !g.valid || m.explored !== true) badShape++;
    for (const p of [m.A, m.B, m.C, m.D]) {
      if (p.x < C.MARGIN - 1e-9 || p.x > C.WIDTH - C.MARGIN + 1e-9 ||
          p.y < C.MARGIN - 1e-9 || p.y > C.HEIGHT - C.MARGIN + 1e-9) badBounds++;
    }
  }
  check("1000 random drags of any corner keep a valid pictured trapezoid", badShape === 0, `${badShape} bad`);
  check("1000 random drags keep all four corners on the board", badBounds === 0, `${badBounds} bad`);
  const s = C.start({});
  check("dragging A copies its y to D and leaves the old state alone", (() => {
    const m = C.movePoint(s, "A", pt(120, 90));
    return m.A === s.A ? false : m.A.x === 120 && m.A.y === 90 && m.D.y === 90 &&
      s.A.x === 180 - 400 / 12 && s.D.y === s.A.y;
  })());
  check("dragging C copies its y to B", (() => {
    const m = C.movePoint(s, "C", pt(260, 120));
    return m.C.y === 120 && m.B.y === 120 && m.B.x === s.B.x;
  })());
  check("a drag far off the board is clamped", (() => {
    const m = C.movePoint(s, "A", pt(-999, 999));
    return m.A.x === C.MARGIN && m.A.y === s.B.y - C.MIN_SIDE;
  })());
  check("reset restores the picture but keeps the four options", (() => {
    const m = C.setOption(C.movePoint(C.start({}), "D", pt(240, 90)), "showHint", true);
    const r = C.reset(m);
    return r.A.x === s.A.x && r.D.x === s.D.x && r.showHint === true && r.explored === false;
  })());
  check("200 new shapes stay on the board with unequal bases in the pictured order", (() => {
    for (let i = 0; i < 200; i++) {
      const r = C.randomize(s), g = C.compute(r);
      if (!g.valid || !g.pictured || g.parallelogram || !r.explored ||
          [r.A, r.B, r.C, r.D].some((p) => p.x < C.MARGIN - 1e-9 ||
            p.x > C.WIDTH - C.MARGIN + 1e-9 || p.y < C.MARGIN - 1e-9 ||
            p.y > C.HEIGHT - C.MARGIN + 1e-9) ||
          !near(g.x, g.z, 1e-6)) return false;
    }
    return true;
  })());
  check("the status never announces a win or a loss", (() => {
    for (const v of [s, C.randomize(s), C.movePoint(s, "B", pt(100, 200))]) {
      if (C.result(v) !== null || /win|lose|won/i.test(C.describe(v))) return false;
    }
    return true;
  })());
}

done("every-trapezoid-is-para");
