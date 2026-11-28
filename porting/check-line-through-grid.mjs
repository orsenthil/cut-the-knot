#!/usr/bin/env node
"use strict";

/*
 * Logic test for line-through-grid/line-through-grid-core.js.
 *
 *   node porting/check-line-through-grid.mjs
 *
 * The page's exact claim is S = M + N - gcd(M, N), with the special case
 * S = M + N - 1 when gcd = 1 and gcd(M, N) - 1 interior lattice points on the
 * diagonal. All three are checked for every M, N in 1..50 against a direct
 * enumeration of the crossed cells. Then the applet's own Draw method is
 * transcribed a second time, straight from its bytecode (Reset computes
 * A = min((H-20)/M, (W-20)/N), Draw tests a shrunken segment against the
 * diagonal and rejects cells whose far corners lie within 0.1px of it), and
 * compared with the core over the whole 50 x 50 parameter space at several
 * canvas sizes. Draw's 0.1px guard can split a cell that the exact formula
 * crosses when A <= 0.2px, so the check uses the applet's own page geometry
 * (500 x 450 and 520 x 420) where A is at least 8px; the deviation is
 * documented on the page and in the core.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("line-through-grid/line-through-grid-core.js", "LineThroughGridCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the applet's default spinners", [s.M, s.N], [6, 11]);
  check("an illustration has no win, loss or end", C.result(s) === null && C.result(C.move(s, { type: "N", value: 7 })) === null);
  check("the move sets only the named spinner",
    C.move(s, { type: "M", value: 4 }).M === 4 && C.move(s, { type: "M", value: 4 }).N === 11);
  check("a spinner below 1 is clamped", C.move(s, { type: "N", value: 0 }).N === 1);
  check("a spinner above 50 is clamped", C.move(s, { type: "M", value: 999 }).M === 50);
  check("a fractional spinner is rounded", C.move(s, { type: "N", value: 7.6 }).N === 8);
  check("a bad spinner value keeps the old one", C.move(s, { type: "M", value: "oops" }).M === 6);
  check("an unknown move is refused", C.move(s, { type: "bogus", value: 3 }) === null);
  check("a move never changes the position it was given", s.M === 6 && s.N === 11);
  check("reset keeps the defaults", C.move(s, { type: "reset" }).M === 6 && C.move(s, { type: "reset" }).N === 11);
  check("the saved position is plain data", C.position(s).crossed === 16 && C.position(s).gcd === 1);
}

/* ---------------------------------- 2. the page's claims, over every size */

{
  let formulaOk = true, specialOk = true, nodesOk = true, boundedOk = true, listOk = true;
  let count = 0;
  const samples = [
    [1, 1, 1], [1, 7, 7], [7, 1, 7], [2, 3, 4], [2, 5, 6], [3, 5, 7],
    [2, 4, 4], [3, 6, 6], [4, 6, 8], [6, 11, 16], [50, 50, 50],
  ];
  for (const [M, N, expected] of samples) {
    if (C.crossed({ M, N }) !== expected) listOk = false;
  }
  check("the page's worked examples (2x3, 2x5, 3x5, 2x4, 3x6, 4x6, 6x11)", listOk);

  for (let M = C.MIN; M <= C.MAX; M++) {
    for (let N = C.MIN; N <= C.MAX; N++) {
      const s = { M, N };
      const cells = C.crossedCells(s);
      const g = C.gcd(M, N);
      formulaOk = formulaOk && cells.length === M + N - g && C.crossed(s) === cells.length;
      nodesOk = nodesOk && C.interiorNodes(s) === g - 1;
      // Coprime rectangles obey the page's first, simpler formula; the others do not.
      const simple = C.coprimeFormula(s);
      if (g === 1) {
        specialOk = specialOk && simple === M + N - 1 && cells.length === simple;
      } else {
        specialOk = specialOk && simple === null && cells.length < M + N - 1;
      }
      // The count is bounded by the coprime value, with equality exactly when
      // no grid point lies on the diagonal (one less count per interior node).
      boundedOk = boundedOk && cells.length <= M + N - 1 &&
        (cells.length === M + N - 1) === (g === 1);
      // No cell is listed twice and every index is inside the rectangle.
      const keys = new Set(cells.map((c) => c.column + ":" + c.row));
      listOk = listOk && keys.size === cells.length &&
        cells.every((c) => c.column >= 0 && c.column < N && c.row >= 0 && c.row < M);
      count++;
    }
  }
  check(`S = M + N - gcd(M,N) matches brute-force cell counting for all ${count} sizes`, formulaOk);
  check("the coprime formula S = M+N-1 holds exactly when gcd = 1", specialOk);
  check("the diagonal passes through gcd(M,N)-1 interior lattice points", nodesOk);
  check("the count is at most M+N-1, reaching it exactly for coprime sizes", boundedOk);
  check("every crossed cell is listed once, in range", listOk);
}

/* ------------------------ 3. a second transcription of the applet's Draw */

/* Literal re-derivation from javap, deliberately not calling the core. */
const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
function cross2(a, b, c, d) {
  const z = (p, q, r) => {
    const v = cross(p, q, r);
    return Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : 2;
  };
  const o1 = z(a, b, c), o2 = z(a, b, d), o3 = z(c, d, a), o4 = z(c, d, b);
  const within = (p, q, r) =>
    Math.min(p.x, q.x) - 1e-9 <= r.x && r.x <= Math.max(p.x, q.x) + 1e-9 &&
    Math.min(p.y, q.y) - 1e-9 <= r.y && r.y <= Math.max(p.y, q.y) + 1e-9;
  return (o1 !== o2 && o3 !== o4) ||
    (o1 === 0 && within(a, b, c)) || (o2 === 0 && within(a, b, d)) ||
    (o3 === 0 && within(c, d, a)) || (o4 === 0 && within(c, d, b));
}
/* GeoSDoub.Dist: project p onto the infinite line a->b, then take |p-foot|. */
function dist2(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return 0;
  const u = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return Math.sqrt((a.x - p.x + dx * u) ** 2 + (a.y - p.y + dy * u) ** 2);
}
const jdiv2 = (a, b) => Math.trunc(a / b);

/** LineThroughGridCanvas.Reset + Draw, written again from the bytecode. */
function drawApplet(M, N, width, height) {
  const padding = 10;
  const A = Math.min(jdiv2(height - 2 * padding, M), jdiv2(width - 2 * padding, N));
  if (A <= 0) return null;
  const w = A * N, h = A * M;
  const x = jdiv2(width - w, 2), y = jdiv2(height - h, 2);
  const topLeft = { x: x, y: y }, bottomRight = { x: x + w, y: y + h };
  const EPS = 0.1;
  const cells = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const from = { x: x + A * (i + 1) + EPS, y: y + A * j - EPS };
      const to = { x: x + A * i - EPS, y: y + A * (j + 1) + EPS };
      if (!cross2(from, to, topLeft, bottomRight)) continue;
      const cornerA = { x: x + A * (i + 1), y: y + A * j };
      const cornerB = { x: x + A * i, y: y + A * (j + 1) };
      if (dist2(cornerA, topLeft, bottomRight) <= EPS) continue;
      if (dist2(cornerB, topLeft, bottomRight) <= EPS) continue;
      cells.push([i, j]);
    }
  }
  return cells;
}

{
  let same = true, counted = 0, formulaOk = true, guardCases = 0, guardDiffs = 0;
  let safeCounted = 0;
  for (const [width, height] of [[500, 450], [520, 420], [400, 300], [1000, 900], [80, 70], [50, 45]]) {
    for (let M = 1; M <= C.MAX; M++) {
      for (let N = 1; N <= C.MAX; N++) {
        const theirs = drawApplet(M, N, width, height);
        if (theirs === null) continue;
        const step = Math.min(jdiv2(height - 20, M), jdiv2(width - 20, N));
        const coreCells = C.paintedCells({ M, N }, { width, height }).map((c) => [c.column, c.row]);
        const aux = JSON.stringify(theirs) === JSON.stringify(coreCells);
        if (!aux) { same = false; if (counted < 3) console.error(`  mismatch at ${width}x${height}, M=${M}, N=${N}`); }
        counted++;
        // The applet's 0.1px guard can split a cell when the step is only a few
        // pixels. At a step of 10px or more no corner is that close to the
        // diagonal except a true lattice point, so the page formula is exact.
        if (step >= 10) {
          formulaOk = formulaOk && theirs.length === M + N - C.gcd(M, N);
          safeCounted++;
        } else if (step > 0 && step * C.gcd(M, N) >= 1) {
          guardCases++;
          if (theirs.length !== M + N - C.gcd(M, N)) guardDiffs++;
        }
      }
    }
  }
  check(`the core's Draw matches a second transcription in all ${counted} runs`, same);
  check(`the applet's painted cells follow the page formula for all ${safeCounted} sizes with a >=10px cell`, formulaOk);
  // The guard is a real quirk: at a cell of a few pixels it can paint a cell
  // the exact formula does not cross (and vice versa). Pin the deviation.
  check(`the 0.1px guard changes the count in ${guardDiffs} of ${guardCases} small-cell runs`, guardDiffs > 0);
}

/* ------------------------------------- 4. geometry behind the page's proof */

{
  // One lattice point is crossed at a time (t = k/g). Between consecutive
  // crossings each step goes through exactly one new grid line, so a cell is
  // entered once per step; that is the invariant behind the formula.
  let stepsOk = true, crossingsOk = true;
  for (let M = 1; M <= 40; M++) {
    for (let N = 1; N <= 40; N++) {
      const g = C.gcd(M, N);
      const points = [];
      for (let k = 0; k <= g; k++) points.push({ x: (N * k) / g, y: (M * k) / g });
      crossingsOk = crossingsOk && points.length === g + 1 &&
        points.every((p, k) => k === 0 || (p.x > points[k - 1].x && p.y > points[k - 1].y));
      // Between two lattice points, the diagonal crosses (M/g - 1) horizontal
      // and (N/g - 1) vertical lines, giving M/g + N/g - 1 cells per segment.
      const perSegment = M / g + N / g - 1;
      stepsOk = stepsOk && Math.abs(g * perSegment - (M + N - g)) < 1e-9;
    }
  }
  check("the diagonal visits gcd+1 lattice points in order", crossingsOk);
  check("g times (M/g + N/g - 1) equals M + N - gcd", stepsOk);
}

done("line-through-grid");
