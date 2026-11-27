#!/usr/bin/env node
"use strict";

/*
 * Logic test for escher-ceva-menelaus/escher-ceva-menelaus-core.js.
 *
 *   node porting/check-escher-ceva-menelaus.mjs
 *
 * What is checked:
 *  - the starting triangle, marks and grids against Canvas.init() for many
 *    board sizes; a second transcription of IntToMoveablebPoint, Snap, Ratio,
 *    Formula and the panel's stateChanged(), compared with the core over the
 *    whole 2..30 division range and thousands of mark configurations;
 *  - both claims on the page: (*) holds exactly when the three lines are
 *    concurrent (an independent barycentric determinant), over every integer
 *    mark choice on a 3-4-5 triangle; and the "twelve concurrences" count over
 *    all six ways of putting 3, 4 and 5 on the sides with Escher's adjacent
 *    division points;
 *  - the Ceva and Menelaus reductions described on the proof page, the
 *    spinner limits, the applet's 0.01 finish tolerance and the demo result.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("escher-ceva-menelaus/escher-ceva-menelaus-core.js", "EscherCevaMenelausCore");
const near = (a, b, tol = 1e-8) =>
  a === b || (Number.isNaN(a) && Number.isNaN(b)) ||
  (finite(a) && finite(b) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)));
const pointNear = (p, q, tol = 1e-8) => p && q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const finite = (v) => Number.isFinite(v);

/* ------------------------------------------------ the applet, from the bytecode */

/** LineGrid(a,b,N).IntToMoveablebPoint(i), op for op. */
function jIntToPoint(a, b, n, i) {
  const s2 = (b.x - a.x) / n, s4 = (b.y - a.y) / n;
  return { x: a.x + i * s2, y: a.y + i * s4 };
}

/** LineGrid.Snap(p): returns the integer index, or null when it refuses to snap. */
function jSnap(a, b, n, p) {
  const s2 = p.x - a.x, s4 = p.y - a.y;
  const s6 = (b.x - a.x) / n, s8 = (b.y - a.y) / n;
  const s10 = s6 * s6 + s8 * s8;
  if (s10 < 0.001) return null;
  const s12 = s6 * s2 + s8 * s4;
  const s14 = s12 / s10;
  return Math.round(s14);
}

/** EscherCevaMenelausCanvas.Ratio(a, b, c), op for op. */
function jRatio(a, b, c) {
  const s4 = c.x - b.x, s6 = c.y - b.y;
  const s8 = b.x - a.x, s10 = b.y - a.y;
  const s12 = c.x - a.x, s14 = c.y - a.y;
  return (s12 * s4 + s14 * s6) / (s12 * s8 + s14 * s10);
}

/** EscherCevaMenelausCanvas.Formula() on the nine given points. */
function jFormula(p) {
  const b1 = jRatio(p.A2, p.B1, p.A3);
  const b2 = jRatio(p.A3, p.B2, p.A1);
  const b3 = jRatio(p.A1, p.B3, p.A2);
  const c1 = 1 / jRatio(p.A2, p.C1, p.A3);
  const c2 = 1 / jRatio(p.A3, p.C2, p.A1);
  const c3 = 1 / jRatio(p.A1, p.C3, p.A2);
  return b1 * b2 * b3 + c1 * c2 * c3 + b1 * c1 + b2 * c2 + b3 * c3;
}

/** EscherCevaMenelausPanel.stateChanged(): SetN(AB,BC,CA), then MaintainPoints. */
function jStateChanged(pos, values) {
  const clamp = (v, fallback) => Math.max(2, Math.min(30, Math.round(Number(v) || fallback)));
  const panel = {
    AB: clamp(values.AB, 3), BC: clamp(values.BC, 4), CA: clamp(values.CA, 5),
  };
  const grid = { ...panel };
  const p = {};
  for (const k of ["A1", "A2", "A3"]) p[k] = pos.corners[k];
  for (const m of C.MARKS) {
    const [a, b] = C.ENDS_OF[C.SIDE_OF[m]];
    p[m] = jIntToPoint(pos.corners[a], pos.corners[b], grid[C.SIDE_OF[m]], pos.marks[m]);
  }
  return { panel, grid, points: p };
}

/* ------------------------------------------------------------ 1. the start */

{
  let ok = true;
  for (let w = 100; w <= 1000; w += 100) {
    for (const h of [80, 300, 750]) {
      const s = C.start({ width: w, height: h });
      ok = ok && pointNear(s.corners.A1, { x: w / 2, y: h / 3 })
        && pointNear(s.corners.A2, { x: w / 3, y: 4 * h / 5 })
        && pointNear(s.corners.A3, { x: 3 * w / 4, y: 3 * h / 4 });
    }
  }
  check("Canvas.init() corner positions at 30 board sizes", ok);
  const s = C.start();
  equal("panel spinners start at 3, 4, 5", s.divisions, { AB: 3, BC: 4, CA: 5 });
  equal("canvas grids start at 3, 5, 4 (the applet's own quirk)", s.grid, { AB: 3, BC: 5, CA: 4 });
  equal("initial mark indices", s.marks, { B1: 4, C1: 3, B2: 1, C2: 0, B3: 2, C3: 1 });
  const v = C.numbers(s);
  check("the opening Escher picture has b = 1/4, 3, 1/2 and c = 3/2, 0, 1/2",
    near(v.B1, 0.25) && near(v.B2, 3) && near(v.B3, 0.5) &&
    near(v.C1, 1.5) && v.C2 === 0 && near(v.C3, 0.5));
  check("the opening picture satisfies (*)", near(C.formula(s), 1) && C.finished(s));
}

/* --------------------------------- 2. IntToMoveablebPoint / Snap, every grid */

{
  let ok = true, snapped = 0, refused = 0;
  const pos = C.start();
  for (let n = C.DIV_MIN; n <= C.DIV_MAX; n++) {
    for (const m of C.MARKS) {
      const side = C.SIDE_OF[m];
      const [a, b] = C.ENDS_OF[side].map((name) => pos.corners[name]);
      for (let i = -n; i <= 2 * n; i++) {
        const s = C.start({ grid: { ...pos.grid, [side]: n }, marks: { ...pos.marks, [m]: i } });
        ok = ok && pointNear(C.pointOnSide(s, m), jIntToPoint(a, b, n, i));
        for (const delta of [-0.49, -0.2, 0, 0.2, 0.49, 1.3]) {
          const step = jIntToPoint(a, b, n, 1);
          const raw = { x: a.x + step.x * (i + delta), y: a.y + step.y * (i + delta) };
          const expected = jSnap(a, b, n, raw);
          const actual = C.dragMark(s, m, raw).marks[m];
          if (expected === null) { refused++; ok = ok && actual === i; }
          else { snapped++; ok = ok && actual === expected; }
        }
      }
    }
  }
  check(`IntToMoveablebPoint and Snap match the bytecode in ${snapped} snaps and ${refused} refusals`, ok);
  const tiny = C.start({ corners: { A1: { x: 0, y: 0 }, A2: { x: 0.02, y: 0 }, A3: { x: 0, y: 100 } } });
  check("Snap returns early on a side shorter than sqrt(0.001)",
    C.dragMark(tiny, "B3", { x: 10, y: 0 }).marks.B3 === tiny.marks.B3);
  check("stepMark moves a mark by whole divisions in both directions",
    C.stepMark(C.start(), "C3", 2).marks.C3 === 3 &&
    C.stepMark(C.start(), "C3", -2).marks.C3 === -1 &&
    C.stepMark(C.start(), "A1", 1).marks.C3 === 1);
}

/* ------------------------------------------ 3. Ratio / Formula, second pass */

{
  const r = rng(20261127);
  let ratioOk = true, formulaOk = true, geomOk = true;
  for (let k = 0; k < 2000; k++) {
    const w = 200 + r() * 500, h = 150 + r() * 350;
    const pos = C.start({
      width: w, height: h,
      divisions: { AB: 2 + Math.floor(r() * 29), BC: 2 + Math.floor(r() * 29), CA: 2 + Math.floor(r() * 29) },
      marks: {
        B1: 1 + Math.floor(r() * 4), C1: Math.floor(r() * 5),
        B2: 1 + Math.floor(r() * 4), C2: Math.floor(r() * 5),
        B3: 1 + Math.floor(r() * 3), C3: Math.floor(r() * 3),
      },
    });
    const p = C.points(pos);
    ratioOk = ratioOk && near(C.ratio(p.A2, p.B1, p.A3), jRatio(p.A2, p.B1, p.A3))
      && near(C.ratio(p.A3, p.B2, p.A1), jRatio(p.A3, p.B2, p.A1))
      && near(C.ratio(p.A1, p.B3, p.A2), jRatio(p.A1, p.B3, p.A2))
      && near(C.ratio(p.A2, p.C1, p.A3), jRatio(p.A2, p.C1, p.A3))
      && near(C.ratio(p.A3, p.C2, p.A1), jRatio(p.A3, p.C2, p.A1))
      && near(C.ratio(p.A1, p.C3, p.A2), jRatio(p.A1, p.C3, p.A2));
    formulaOk = formulaOk && near(C.formula(pos), jFormula(p));
    const v = C.numbers(pos);
    /* At an endpoint the drawn point can land a rounding step past the
       corner, so the signed reciprocal is not stable; skip those here. */
    const interior = C.MARKS.every((m) => pos.marks[m] > 0 && pos.marks[m] < pos.grid[C.SIDE_OF[m]]);
    geomOk = geomOk && (!interior || (
      near(v.B1, C.ratio(p.A2, p.B1, p.A3))
      && near(v.B2, C.ratio(p.A3, p.B2, p.A1))
      && near(v.B3, C.ratio(p.A1, p.B3, p.A2))
      && near(v.C1, 1 / C.ratio(p.A2, p.C1, p.A3))
      && near(v.C2, 1 / C.ratio(p.A3, p.C2, p.A1))
      && near(v.C3, 1 / C.ratio(p.A1, p.C3, p.A2))
      && near(C.formulaFromIndices(pos), C.formula(pos))));
  }
  check("Ratio matches the bytecode at 12,000 triple calls", ratioOk);
  check("Formula matches the bytecode at 2,000 configurations across 2..30", formulaOk);
  check("index-derived b/c agree with the drawn points at 2,000 configurations", geomOk);
}

/* --------------------------------------------------------- 4. the (*) claim */

{
  const div = { AB: 3, BC: 4, CA: 5 };
  let tested = 0, mismatches = 0, hits = 0;
  /* Every integer mark choice, including the endpoints, on a 3-4-5 triangle. */
  for (let iB1 = 0; iB1 <= div.BC; iB1++) for (let iC1 = 0; iC1 <= div.BC; iC1++)
  for (let iB2 = 0; iB2 <= div.CA; iB2++) for (let iC2 = 0; iC2 <= div.CA; iC2++)
  for (let iB3 = 0; iB3 <= div.AB; iB3++) for (let iC3 = 0; iC3 <= div.AB; iC3++) {
    const s = C.fromIndices(div, iB1, iC1, iB2, iC2, iB3, iC3);
    const f = C.formulaFromIndices(s);
    if (!finite(f)) continue;
    const ls = C.lines(s);
    if (ls.some((l) => !l || Math.hypot(l.x, l.y, l.z) < 1e-8)) continue; // undefined line
    tested++;
    if (near(f, 1, 1e-9)) hits++;
    const equalTruth = near(f, 1, 1e-9) === C.concurrent(s);
    if (!equalTruth) mismatches++;
  }
  check(`${tested} integer 3-4-5 configurations: (*) agrees with the drawn lines`, mismatches === 0,
    `${mismatches} disagreements`);
  check(`the 3-4-5 grid has ${hits} finite integer configurations satisfying (*)`, hits === 271);

  /* Independent check at larger sizes: formula from indices vs the determinant. */
  const r = rng(97531);
  let big = 0, bad = 0;
  for (let k = 0; k < 4000; k++) {
    const d = { AB: 2 + Math.floor(r() * 29), BC: 2 + Math.floor(r() * 29), CA: 2 + Math.floor(r() * 29) };
    const pick = (n) => Math.floor(r() * (n + 1));
    const s = C.fromIndices(d, pick(d.BC), pick(d.BC), pick(d.CA), pick(d.CA), pick(d.AB), pick(d.AB));
    const f = C.formulaFromIndices(s);
    if (!finite(f) || C.lines(s).some((l) => !l || Math.hypot(l.x, l.y, l.z) < 1e-8)) continue;
    big++;
    if ((near(f, 1, 1e-9) !== C.concurrent(s))) bad++;
  }
  check(`${big} random configurations up to 30 divisions: (*) iff concurrent`, bad === 0,
    `${bad} disagreements`);
}

/* ----------------------------------------- 5. the "twelve concurrences" claim */

{
  const perms = [
    [3, 4, 5], [3, 5, 4], [4, 3, 5], [4, 5, 3], [5, 3, 4], [5, 4, 3],
  ];
  const found = [];
  let reverse = 0;
  for (const [ab, bc, ca] of perms) {
    const div = { AB: ab, BC: bc, CA: ca };
    for (let iB1 = 1; iB1 <= bc; iB1++) for (let iB2 = 1; iB2 <= ca; iB2++)
    for (let iB3 = 1; iB3 <= ab; iB3++) {
      const adjacent = C.fromIndices(div, iB1, iB1 - 1, iB2, iB2 - 1, iB3, iB3 - 1);
      if (near(C.formulaFromIndices(adjacent), 1, 1e-9) && C.concurrent(adjacent)) {
        found.push({ div, i: [iB1, iB2, iB3] });
      }
      if (iB1 < bc && iB2 < ca && iB3 < ab) {
        const mirror = C.fromIndices(div, iB1, iB1 + 1, iB2, iB2 + 1, iB3, iB3 + 1);
        if (near(C.formulaFromIndices(mirror), 1, 1e-9) && C.concurrent(mirror)) reverse++;
      }
    }
  }
  check("exactly twelve Escher patterns across the six 3-4-5 side assignments", found.length === 12,
    `found ${found.length}`);
  check("each of the twelve really satisfies (*) and has finite concurrent lines",
    found.every((x) => finite(C.formulaFromIndices(C.fromIndices(x.div, ...x.i.flatMap((v) => [v, v - 1]))))));
  check("the opposite adjacent pattern gives no extra concurrence", reverse === 0, `found ${reverse}`);
  const initial = C.start();
  check("the opening picture is one of the twelve", found.some((x) => x.div.AB === 3 && x.div.BC === 5 &&
    x.div.CA === 4 && x.i[0] === 4 && x.i[1] === 1 && x.i[2] === 2));
}

/* --------------------------------- 6. Ceva and Menelaus as special cases */

{
  const r = rng(24680);
  let cevaOk = true, menelausOk = true, tested = 0;
  for (let k = 0; k < 600; k++) {
    const d = { AB: 2 + Math.floor(r() * 29), BC: 2 + Math.floor(r() * 29), CA: 2 + Math.floor(r() * 29) };
    const i1 = 1 + Math.floor(r() * (d.BC - 1));
    const i2 = 1 + Math.floor(r() * (d.CA - 1));
    const i3 = 1 + Math.floor(r() * (d.AB - 1));
    const ceva = C.fromIndices(d, i1, 0, i2, 0, i3, 0);
    const product = (d.BC - i1) / i1 * (d.CA - i2) / i2 * (d.AB - i3) / i3;
    cevaOk = cevaOk && near(C.formulaFromIndices(ceva), product)
      && (near(product, 1, 1e-9) === C.concurrent(ceva));
    const menelaus = C.fromIndices(d, i1, i1, i2, i2, i3, i3);
    const p = (d.BC - i1) / i1 * (d.CA - i2) / i2 * (d.AB - i3) / i3;
    const f = C.formulaFromIndices(menelaus);
    menelausOk = menelausOk && near(f, p + 1 / p + 3)
      && (near(f, 1, 1e-9) === near(p, -1, 1e-9))
      && (near(p, -1, 1e-9) === C.concurrent(menelaus));
    tested++;
  }
  check(`${tested} Ceva cases: c = 0 gives (*) <=> b1b2b3 = 1`, cevaOk);
  check(`${tested} Menelaus cases: B = C gives (*) <=> b1b2b3 = -1`, menelausOk);
}

/* ------------------------------------- 7. options, finish flag and result */

{
  const s = C.start();
  const a = C.setDivisions(s, { AB: 1, BC: 31, CA: 7.6 });
  const j = jStateChanged(s, { AB: 1, BC: 31, CA: 7.6 });
  equal("spinner values clamp to 2..30 and round", a.divisions, j.panel);
  equal("all three grids follow the panel after stateChanged", a.grid, j.grid);
  check("marks stay at the same integer indices", C.MARKS.every((m) => a.marks[m] === s.marks[m]));
  const p = C.points(a), jp = j.points;
  check("MaintainPoint places every mark with the new N", C.MARKS.every((m) => pointNear(p[m], jp[m])));
  equal("reset restores the panel and the applet's 3-5-4 quirk", C.start().grid, C.GRID_START);
  equal("options clamps out-of-range and missing values", C.options({ AB: -5, BC: 100, CA: "7" }),
    { AB: 2, BC: 30, CA: 7 });
  check("the applet's 0.01 finish tolerance is used", C.finished(C.start()) === true &&
    C.finished(C.fromIndices({ AB: 3, BC: 4, CA: 5 }, 1, 0, 1, 0, 1, 0)) === false);
  check("an illustration has no win or loss", C.result(C.start()) === null);
  check("format trims trailing zeroes without eating integer zeroes",
    C.format(1, 3) === "1" && C.format(1.5, 3) === "1.5" && C.format(10, 3) === "10");
  const ev = C.evaluate(C.start());
  check("evaluate reports the formula, the true concurrency and the center",
    near(ev.formula, 1) && ev.finished && ev.concurrent && ev.crossings.center !== null);
}

done("escher-ceva-menelaus");
