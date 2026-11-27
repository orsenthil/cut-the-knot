#!/usr/bin/env node
"use strict";

/*
 * Logic test for conditional-probability/conditional-probability-core.js.
 *
 *   node porting/check-conditional-probability.mjs
 *
 * Checks the applet's start position, corner dragging, grid spinners, the
 * DecimalFormat display, the five probabilities, the two conditional-
 * probability formulas on the applet's page, the equivalence with independence
 * and the law of total probability on the manifest's article. A second,
 * literal transcription of ConditionalProbabilityCanvas.ComputePoly(),
 * Prob(), Compute() and Upgrade() (in pixel units, with Java's integer
 * division) is compared with the core for every Nx/Ny in 10..30 and for tens
 * of thousands of rectangle pairs. The 25x20 -> 24x20 dependence example from
 * the applet's own page is reproduced exactly.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("conditional-probability/conditional-probability-core.js", "ConditionalProbabilityCore");
const near = (a, b, tol = 1e-12) =>
  a === b || (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= tol;

/* ------------------------------------------------- a second transcription */

/*
 * ConditionalProbabilityCanvas.Reset() computes Dx = canvasWidth/(Nx+1) and
 * Dy = canvasHeight/(Ny+1) with Java integer division. The absolute pixel
 * size cancels out of Prob(), so a 440x360 canvas is used here. This code
 * follows the bytecode in pixels rather than reusing the core's cell counts.
 */
function bytecodeApplet(nx, ny, ra, rb) {
  const dx = Math.floor(440 / (nx + 1));
  const dy = Math.floor(360 / (ny + 1));
  const space = { x: 0, y: 0, w: dx * nx, h: dy * ny };
  const a = (v) => Math.round(v);

  function vertices(r) {
    return [
      { x: r.x * dx, y: r.y * dy },
      { x: r.x * dx, y: (r.y + r.h) * dy },
      { x: (r.x + r.w) * dx, y: (r.y + r.h) * dy },
      { x: (r.x + r.w) * dx, y: r.y * dy },
    ];
  }
  const V = [vertices(ra), vertices(rb)];

  // ComputePoly(k), verbatim: min of corners 0/2, min of 1/3, absolute
  // differences of corners 3/0 and 1/0, each passed through a(double).
  function ComputePoly(k) {
    const v = V[k];
    return {
      x: a(Math.min(v[0].x, v[2].x)),
      y: a(Math.min(v[1].y, v[3].y)),
      width: a(Math.abs(v[3].x - v[0].x)),
      height: a(Math.abs(v[1].y - v[0].y)),
    };
  }
  // java.awt.Rectangle.intersection in pixel units.
  function intersect(p, q) {
    const x = Math.max(p.x, q.x), y = Math.max(p.y, q.y);
    const x2 = Math.min(p.x + p.width, q.x + q.width);
    const y2 = Math.min(p.y + p.height, q.y + q.height);
    return { x, y, width: Math.max(0, x2 - x), height: Math.max(0, y2 - y) };
  }
  // Prob(Rectangle): Java int division for the four cell counts.
  function Prob(r) {
    const i = Math.trunc((r.x - space.x) / dx);
    const j = Math.trunc((r.y - space.y) / dy);
    const w = Math.trunc(r.width / dx);
    const h = Math.trunc(r.height / dy);
    if (i < 0 || j < 0 || r.width < 0 || r.height < 0) return 0;
    return (w * h) / (nx * ny);
  }

  const rects = [ComputePoly(0), ComputePoly(1)];
  const inter = intersect(rects[1], rects[0]); // the applet's order
  const pa = Prob(rects[0]), pb = Prob(rects[1]), pi = Prob(inter);
  return { pa, pb, pi, pab: pi / pb, pba: pi / pa };
}

// Upgrade(): round each old pixel point to its old grid coordinate, then
// place it at the same coordinate in the new grid.
function bytecodeUpgrade(oldNx, oldNy, newNx, newNy, ra, rb) {
  const oldDx = Math.floor(440 / (oldNx + 1)), oldDy = Math.floor(360 / (oldNy + 1));
  const newDx = Math.floor(440 / (newNx + 1)), newDy = Math.floor(360 / (newNy + 1));
  const scale = (p, ox, oy, sx, sy) => ({
    x: Math.round((p.x - ox) / sx),
    y: Math.round((p.y - oy) / sy),
  });
  const clip = (v, hi) => Math.max(0, Math.min(hi, v)); // CheckAllPoints
  const up = (r) => {
    const p = scale({ x: r.x * oldDx, y: r.y * oldDy }, 0, 0, oldDx, oldDy);
    const q = scale({ x: (r.x + r.w) * oldDx, y: (r.y + r.h) * oldDy }, 0, 0, oldDx, oldDy);
    const x = clip(p.x, newNx), y = clip(p.y, newNy);
    return { x, y, w: clip(q.x, newNx) - x, h: clip(q.y, newNy) - y };
  };
  void newDx; void newDy;
  return { nx: newNx, ny: newNy, a: up(ra), b: up(rb) };
}

/* ------------------------------------------------------- 1. the start grid */

{
  const s = C.start();
  check("default sample space is 25 by 20", s.nx === 25 && s.ny === 20);
  equal("A starts at CreateRect(0,2,3,4,6)", s.a, { x: 2, y: 3, w: 4, h: 6 });
  equal("B starts at CreateRect(1,5,8,6,5)", s.b, { x: 5, y: 8, w: 6, h: 5 });
  check("Nx/Ny spinners run from 10 to 30", C.LIMITS.min === 10 && C.LIMITS.max === 30);
}

/* ------------------------------------- 2. dragging corners and changing Nx */

{
  const s = C.start();
  equal("top-left corner keeps the opposite corner", C.withCorner(s, "a", 0, { x: 1, y: 2 }).a,
    { x: 1, y: 2, w: 5, h: 7 });
  equal("bottom-left corner keeps the top-right corner", C.withCorner(s, "a", 1, { x: 1, y: 10 }).a,
    { x: 1, y: 3, w: 5, h: 7 });
  equal("bottom-right corner keeps the top-left corner", C.withCorner(s, "a", 2, { x: 8, y: 12 }).a,
    { x: 2, y: 3, w: 6, h: 9 });
  equal("top-right corner keeps the bottom-left corner", C.withCorner(s, "a", 3, { x: 9, y: 4 }).a,
    { x: 2, y: 4, w: 7, h: 5 });
  equal("crossing the opposite corner mirrors the rectangle", C.withCorner(s, "b", 0, { x: 20, y: 20 }).b,
    { x: 11, y: 13, w: 9, h: 7 });
  equal("a drag past the grid is clamped and snapped", C.withCorner(s, "a", 0, { x: 99.6, y: -4 }).a,
    { x: 6, y: 0, w: 19, h: 9 });
  equal("spinner values are clamped to 10..30", C.withGrid(s, 99, -3),
    { nx: 30, ny: 10, a: { x: 2, y: 3, w: 4, h: 6 }, b: { x: 5, y: 8, w: 6, h: 2 } });
  equal("a smaller grid clips a rectangle against the edge", C.withGrid(C.withRect(s, "a", { x: 24, y: 19, w: 4, h: 4 }), 10, 10).a,
    { x: 10, y: 10, w: 0, h: 0 });
  check("drag and resize never change the sample space", s.nx === 25 && s.ny === 20);
}

/* ------------------------------------- 3. displayed values at the start grid */

{
  const p = C.compute(C.start());
  check("P(A) = 24/500", near(p.pa, 24 / 500));
  check("P(B) = 30/500", near(p.pb, 30 / 500));
  check("P(A^B) = 1/500", near(p.pi, 1 / 500));
  check("P(A|B) = P(A^B)/P(B) = 1/30", near(p.pab, 1 / 30));
  check("P(B|A) = P(A^B)/P(A) = 1/24", near(p.pba, 1 / 24));
  equal("DecimalFormat shows the start values", [C.format(p.pa), C.format(p.pb), C.format(p.pi),
    C.format(p.pab), C.format(p.pba)],
  ["  0.048", "  0.06", "  0.002", "  0.03333", "  0.04167"]);
  equal("DecimalFormat rounds ties to even, as Java does", C.format(1 / 64), "  0.01562");
  equal("DecimalFormat keeps five places without trailing zeroes", C.format(1 / 32), "  0.03125");
  const empty = C.compute(C.withRect(C.withRect(C.start(), "b", { x: 0, y: 0, w: 0, h: 0 }), "a", { x: 0, y: 0, w: 4, h: 6 }));
  check("an empty B gives 0/0 = NaN for P(A|B)", Number.isNaN(empty.pab) && C.format(empty.pab) === "NaN");
  check("core agrees with the bytecode at the start position",
    near(p.pa, bytecodeApplet(25, 20, C.START_R.a, C.START_R.b).pa) &&
    near(p.pba, bytecodeApplet(25, 20, C.START_R.a, C.START_R.b).pba));
}

/* --------------------- 4. the core against the bytecode, all Nx and Ny */

{
  const rand = rng(19990622);
  let bad = 0, cases = 0;
  for (let nx = C.LIMITS.min; nx <= C.LIMITS.max; nx++) {
    for (let ny = C.LIMITS.min; ny <= C.LIMITS.max; ny++) {
      let s = C.withGrid(C.start(), nx, ny);
      for (let i = 0; i < 30; i++) {
        const r = () => ({
          x: Math.floor(rand() * (nx + 1)), y: Math.floor(rand() * (ny + 1)),
          w: Math.floor(rand() * (nx + 2)), h: Math.floor(rand() * (ny + 2)),
        });
        s = C.withRect(s, "a", r());
        s = C.withRect(s, "b", r());
        if (i % 7 === 0) s = C.withCorner(s, "a", i % 4, { x: rand() * nx, y: rand() * ny });
        const p = C.compute(s);
        const b = bytecodeApplet(nx, ny, s.a, s.b);
        if (!near(p.pa, b.pa) || !near(p.pb, b.pb) || !near(p.pi, b.pi) ||
            !near(p.pab, b.pab, 1e-9) || !near(p.pba, b.pba, 1e-9)) bad++;
        cases++;
      }
    }
  }
  check(`five probabilities match the bytecode transcription in all ${cases} grid-and-rectangle cases`, bad === 0, `${bad} mismatches`);

  // Exhaustive rectangle pairs on the smallest grid: every A against a
  // spread of B's, including zero-size and edge-touching rectangles.
  bad = 0; cases = 0;
  const rects = [];
  for (let x = 0; x <= 10; x++) for (let y = 0; y <= 10; y++)
    for (let w = 0; w <= 10 - x; w++) for (let h = 0; h <= 10 - y; h++) rects.push({ x, y, w, h });
  const bs = rects.filter((_, i) => i % 137 === 0);
  for (const ra of rects) {
    for (const rb of bs) {
      const p = C.compute({ nx: 10, ny: 10, a: ra, b: rb });
      const b = bytecodeApplet(10, 10, ra, rb);
      if (!near(p.pa, b.pa) || !near(p.pb, b.pb) || !near(p.pi, b.pi) ||
          !near(p.pab, b.pab, 1e-9) || !near(p.pba, b.pba, 1e-9)) bad++;
      cases++;
    }
  }
  check(`the bytecode agrees for all ${cases} rectangle pairs on a 10x10 grid`, bad === 0, `${bad} mismatches`);

  // Upgrade() from the bytecode puts points at the same grid coordinates.
  bad = 0; cases = 0;
  for (let nx = 10; nx <= 30; nx++) for (let ny = 10; ny <= 30; ny++) {
    const s = C.withGrid(C.start(), nx, ny);
    const t = bytecodeUpgrade(25, 20, nx, ny, C.START_R.a, C.START_R.b);
    if (JSON.stringify(t.a) !== JSON.stringify(s.a) || JSON.stringify(t.b) !== JSON.stringify(s.b)) bad++;
    cases++;
  }
  check(`Upgrade() keeps the same grid cells for all ${cases} spinner settings`, bad === 0, `${bad} mismatches`);
}

/* ------------------------------ 5. the page's formulas and their edge cases */

{
  let bad = 0, checked = 0, degenerate = 0;
  for (let nx = 10; nx <= 30; nx += 2) for (let ny = 10; ny <= 30; ny += 2) {
    const rand = rng(nx * 100 + ny);
    for (let i = 0; i < 200; i++) {
      const r = () => ({
        x: Math.floor(rand() * nx), y: Math.floor(rand() * ny),
        w: 1 + Math.floor(rand() * (nx - 1)), h: 1 + Math.floor(rand() * (ny - 1)),
      });
      let ra = r(), rb = r();
      ra.w = Math.min(ra.w, nx - ra.x); ra.h = Math.min(ra.h, ny - ra.y);
      rb.w = Math.min(rb.w, nx - rb.x); rb.h = Math.min(rb.h, ny - rb.y);
      const p = C.compute({ nx, ny, a: ra, b: rb });
      if (near(p.pab, p.pa, 1e-12) !== C.independent(p)) { bad++; continue; }
      if (near(p.pba, p.pb, 1e-12) !== C.independent(p)) { bad++; continue; }
      // P(A|B) = P(A^B)/P(B), P(B|A) = P(A^B)/P(A) on every case.
      if (!near(p.pab, p.pi / p.pb) || !near(p.pba, p.pi / p.pa)) bad++;
      checked++;
    }
  }
  check(`P(A|B)=P(A) iff P(B|A)=P(B) iff P(A^B)=P(A)P(B) in ${checked} positive cases`, bad === 0, `${bad} mismatches`);

  // With an empty event the applet shows NaN for its conditional, so the
  // page's "or which is the same" needs P(A), P(B) > 0.
  for (const nx of [10, 25, 30]) {
    const zero = C.compute({ nx, ny: 20, a: { x: 0, y: 0, w: 4, h: 5 }, b: { x: 0, y: 0, w: 0, h: 5 } });
    if (C.independent(zero) !== null || !Number.isNaN(zero.pab) || zero.pba !== 0) degenerate++;
  }
  check("the equivalence is reported as undefined when an event has no cells", degenerate === 0);

  // Brodie's article (the URL in the manifest) states the law of total
  // probability for mutually exclusive, exhaustive events. Split the grid
  // into vertical strips B_i and verify both forms exhaustively in Nx, Ny.
  bad = 0; checked = 0;
  for (let nx = 10; nx <= 30; nx++) for (let ny = 10; ny <= 30; ny++) {
    const s = C.withGrid(C.start(), nx, ny);
    for (let x = 0; x < nx; x++) for (const [y, h] of [[0, ny], [1, Math.max(1, ny - 2)]]) {
      const ra = { x, y, w: 1, h };
      let sumJoint = 0, sumConditional = 0;
      for (let k = 0; k < nx; k++) {
        const rb = { x: k, y: 0, w: 1, h: ny };
        const p = C.compute({ nx, ny, a: ra, b: rb });
        sumJoint += p.pi;
        sumConditional += p.pab * p.pb;
      }
      const pa = C.compute({ nx, ny, a: ra, b: { x: 0, y: 0, w: nx, h: ny } }).pa;
      if (!near(sumJoint, pa, 1e-12) || !near(sumConditional, pa, 1e-12)) bad++;
      checked++;
    }
  }
  check(`law of total probability holds for ${checked} partitions of every grid`, bad === 0, `${bad} failures`);

  // The applet's page: independent on 25x20, dependent on 24x20 while the
  // two conditional probabilities stay the same.
  let s = C.withRect(C.start(), "a", { x: 2, y: 3, w: 4, h: 5 }); // 20 cells
  s = C.withRect(s, "b", { x: 5, y: 7, w: 5, h: 5 });             // 25 cells, overlap 1
  const p25 = C.compute(s);
  check("the page's 25x20 example is independent", C.independent(p25) === true && near(p25.pab, p25.pa));
  const s24 = C.withGrid(s, 24, 20);
  const p24 = C.compute(s24);
  check("the same rectangles become dependent on 24x20", C.independent(p24) === false && !near(p24.pab, p24.pa));
  check("the two conditional probabilities survive the grid change",
    near(p24.pab, p25.pab) && near(p24.pba, p25.pba));
  check("the page's example has P(A^B) = P(A)P(B) only on 25x20",
    p25.cells.i * p25.total === p25.cells.a * p25.cells.b &&
    p24.cells.i * p24.total !== p24.cells.a * p24.cells.b);
}

done("conditional-probability");
