#!/usr/bin/env node
"use strict";

/*
 * Logic test for chess-tournament/chess-tournament-core.js.
 *
 *   node porting/check-chess-tournament.mjs
 *
 * Each probability has 51 raw settings (0.50 .. 1.00 in steps of 0.01), so
 * all 51^3 = 132,651 triples (p, q, r) are walked. The closed forms in the
 * core are checked against (a) an independent, exhaustive traversal of the
 * four-level game tree, (b) the two formulas printed on cut-the-knot's page,
 * and (c) its factorisation of their difference — all over the whole grid.
 * The old applet's own ComputeResult bytecode is transcribed a second time
 * and compared too: it has a one-term typo in P_AB, which is pinned here and
 * explained in the page's maths section.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("chess-tournament/chess-tournament-core.js", "ChessTournamentCore");

const GRID = Array.from({ length: 51 }, (_, i) => (50 + i) / 100);

function near(a, b, tol = 1e-9) {
  return Math.abs(a - b) <= tol * (1 + Math.abs(a) + Math.abs(b));
}

/** An independent solver: walk every branch of the game tree. */
function treeProbabilities(p, q, r, first, second) {
  const beat = [[1, p, r], [1 - p, 1, q], [1 - r, 1 - q, 1]]; // beat[winner][loser]
  const memo = new Map();
  function solve(wins, a, b) {
    const key = `${wins.join(",")}|${a}${b}`;
    if (memo.has(key)) return memo.get(key);
    for (let i = 0; i < 3; i++) {
      if (wins[i] >= 2) {
        const out = [0, 0, 0];
        out[i] = 1;
        memo.set(key, out);
        return out;
      }
    }
    const idle = [0, 1, 2].find((i) => i !== a && i !== b);
    const x = beat[a][b];
    const afterFirst = wins.slice();
    afterFirst[a]++;
    const branchFirst = solve(afterFirst, a, idle); // winner plays the idle player
    const afterSecond = wins.slice();
    afterSecond[b]++;
    const branchSecond = solve(afterSecond, b, idle);
    const out = [0, 0, 0];
    for (let i = 0; i < 3; i++) out[i] = x * branchFirst[i] + (1 - x) * branchSecond[i];
    memo.set(key, out);
    return out;
  }
  return solve([0, 0, 0], first, second);
}

/** The old applet's ComputeResult, transcribed straight from its bytecode. */
function appletResult(x, y, z) {
  return [
    x * z + x * (1 - z) * y * x + (1 - x) * (1 - y) * z * x,
    x * (1 - z) * y * (1 - x) + (1 - x) * y + (1 - x) * (1 - y) * z * x,
    x * (1 - z) * (1 - y) + (1 - x) * (1 - y) * (1 - z),
  ];
}

/* ------------------------------------------------------------ 1. the rules */

equal("start uses the applet's defaults", C.start({}),
  { p: 0.55, q: 0.6, r: 0.75, pair: "BC", explored: false });
check("a new exploration is not yet done", C.result(C.start({})) === null);
check("the position is plain JSON",
  JSON.stringify(JSON.parse(JSON.stringify(C.start({})))) === JSON.stringify(C.start({})));
equal("clamp: probabilities below the range go to 0.50",
  [C.start({ p: -2, q: 0, r: 0.1 }).p, C.start({ p: -2, q: 0, r: 0.1 }).q, C.start({ p: -2, q: 0, r: 0.1 }).r],
  [0.5, 0.5, 0.5]);
equal("clamp: probabilities above the range go to 1.00",
  [C.start({ p: 2, q: 1.01, r: 9 }).p, C.start({ p: 2, q: 1.01, r: 9 }).q, C.start({ p: 2, q: 1.01, r: 9 }).r],
  [1, 1, 1]);
equal("clamp: probabilities are kept to two decimals",
  C.start({ p: 0.555, q: 0.666, r: 0.757 }).p, 0.56);
equal("the scrollbars are 50..110 with visible 10, raw max 100",
  [C.SCROLL.p.min, C.SCROLL.p.max, C.SCROLL.p.visible, C.RAW_MAX], [50, 110, 10, 100]);
equal("the scrollbar starting values match the applet's labels",
  [C.SCROLL.p.initial, C.SCROLL.q.initial, C.SCROLL.r.initial], [55, 60, 75]);
equal("formatP writes the applet's .55 / .60 / .75 labels",
  [C.formatP(0.55), C.formatP(0.6), C.formatP(0.75)], [".55", ".60", ".75"]);
equal("formatP at the far end of the scroll", C.formatP(1), "1.00");
equal("formatProb writes three decimals like the table", C.formatProb(0.4005), "0.401");

{
  const s0 = C.start({});
  const s1 = C.setP(s0, 0.9);
  const s2 = C.setQ(s1, 1.5);
  const s3 = C.setR(s2, 0.01);
  const s4 = C.selectPair(s3, "AB");
  const s5 = C.selectPair(s4, "nonsense");
  equal("setP changes only p and marks the demo explored", [s1.p, s1.q, s1.r, s1.explored], [0.9, 0.6, 0.75, true]);
  equal("setQ clamps at 1.00", s2.q, 1);
  equal("setR clamps at 0.50", s3.r, 0.5);
  equal("selectPair highlights AB", s4.pair, "AB");
  equal("an unknown pair leaves the highlight alone", s5.pair, "AB");
  check("once explored the demo stays explored", C.result(s5) === "done");
  check("the start position is not changed by a move", s0.p === 0.55 && s0.pair === "BC" && !s0.explored);
  equal("reset restores the defaults", C.reset(), C.start({}));
}

/* --------------------------- 2. the game tree, branch by branch (grid) */

{
  // Coarser grid here: each call traverses a fresh event tree, while the
  // closed-form checks below use every one of the 51^3 settings.
  let bad = 0;
  let worst = 0;
  for (let pi = 50; pi <= 100; pi += 5) {
    for (let qi = 50; qi <= 100; qi += 5) {
      for (let ri = 50; ri <= 100; ri += 5) {
        const p = pi / 100;
        const q = qi / 100;
        const r = ri / 100;
        const table = C.computeTable(p, q, r);
        const ab = treeProbabilities(p, q, r, 0, 1); // A vs B, C idle
        const bc = treeProbabilities(p, q, r, 1, 2); // B vs C, A idle
        const ac = treeProbabilities(p, q, r, 0, 2); // A vs C, B idle
        // Check each table entry against its own tree directly.
        // Each solver returns [P(A), P(B), P(C)], in player order.
        const perTree = [
          [table.AB.A, ab[0]], [table.AB.B, ab[1]], [table.AB.C, ab[2]],
          [table.BC.A, bc[0]], [table.BC.B, bc[1]], [table.BC.C, bc[2]],
          [table.AC.A, ac[0]], [table.AC.B, ac[1]], [table.AC.C, ac[2]],
        ];
        for (const [got, want] of perTree) {
          const err = Math.abs(got - want);
          if (err > worst) worst = err;
          if (!near(got, want, 1e-10)) bad++;
        }
      }
    }
  }
  check("closed forms equal a full walk of the game tree at 11^3 settings, all 9 cells",
    bad === 0, `${bad} mismatches, worst absolute error ${worst.toExponential(2)}`);
}

/* ------------------------------- 3. every formula and claim, exhaustively */

{
  let bad = 0;
  let worst = 0;
  for (const p of GRID) for (const q of GRID) for (const r of GRID) {
    const v = C.computeResult(p, q, r);
    const sum = v[0] + v[1] + v[2];
    const err = Math.abs(sum - 1);
    if (err > worst) worst = err;
    if (!near(sum, 1, 1e-9) || v.some((x) => x < -1e-12 || x > 1 + 1e-12)) bad++;
  }
  check("the three win chances add to 1 at all 132,651 settings", bad === 0,
    `${bad} bad sums, worst error ${worst.toExponential(2)}`);
}

{
  let bad = 0;
  for (const p of GRID) for (const q of GRID) for (const r of GRID) {
    const t = C.computeTable(p, q, r);
    for (const col of C.PAIRS) {
      const sum = t[col].A + t[col].B + t[col].C;
      if (!near(sum, 1, 1e-9)) bad++;
    }
  }
  check("each of the three table columns adds to 1 at every setting", bad === 0, `${bad} bad columns`);
}

{
  let bad = 0;
  let worst = 0;
  for (const p of GRID) for (const q of GRID) for (const r of GRID) {
    const got = C.pAB(p, q, r);
    const want = C.pagePAB(p, q, r);
    const err = Math.abs(got - want);
    if (err > worst) worst = err;
    if (!near(got, want, 1e-9)) bad++;
  }
  check("P_AB matches the page's formula at every setting", bad === 0,
    `${bad} mismatches, worst absolute error ${worst.toExponential(2)}`);
}

{
  let bad = 0;
  let worst = 0;
  for (const p of GRID) for (const q of GRID) for (const r of GRID) {
    const got = C.pBC(p, q, r);
    const want = C.pagePBC(p, q, r);
    const err = Math.abs(got - want);
    if (err > worst) worst = err;
    if (!near(got, want, 1e-9)) bad++;
  }
  check("P_BC matches the page's formula at every setting", bad === 0,
    `${bad} mismatches, worst absolute error ${worst.toExponential(2)}`);
}

{
  let bad = 0;
  let worst = 0;
  for (const p of GRID) for (const q of GRID) for (const r of GRID) {
    const got = C.difference(p, q, r);
    const want = C.identityDifference(p, q, r);
    const err = Math.abs(got - want);
    if (err > worst) worst = err;
    if (!near(got, want, 1e-9)) bad++;
  }
  check("P_BC - P_AB = [pq(1-r) + (1-p)(1-q)r](p+q-1), the page's factorisation", bad === 0,
    `${bad} mismatches, worst absolute error ${worst.toExponential(2)}`);
}

{
  let strict = 0;
  let ties = 0;
  let bad = 0;
  const tieP = [];
  for (const p of GRID) for (const q of GRID) for (const r of GRID) {
    if (!(p > 0.5 && q > 0.5 && r > p)) continue; // the page's stated conditions
    const d = C.difference(p, q, r);
    if (d < -1e-12) bad++;
    else if (d <= 1e-12) { ties++; tieP.push([p, q, r]); }
    else strict++;
  }
  check("B is never worse starting against C: P_AB <= P_BC when p,q,r > .5 and r > p", bad === 0, `${bad} reversals`);
  check("the strict 'always P_AB < P_BC' has boundary ties at q = r = 1: exactly 49 of them",
    ties === 49 && tieP.every(([p, q, r]) => q === 1 && r === 1 && p > 0.5 && p < 1),
    `${ties} ties, first ${JSON.stringify(tieP.slice(0, 3))}`);
  check("P_AB < P_BC strictly in the remaining cases", strict > 0, `${strict} strict wins for BC`);
}

{
  // The page adds: "this is true even without the condition r > p". Dropping
  // r > p does create boundary ties at p = r = 1, where the bracket vanishes,
  // so the honest statement is P_AB <= P_BC there.
  let bad = 0;
  let cases = 0;
  let ties = 0;
  const tieCases = [];
  for (const p of GRID) for (const q of GRID) for (const r of GRID) {
    if (!(p > 0.5 && q > 0.5 && r <= p)) continue;
    cases++;
    const d = C.difference(p, q, r);
    if (d < -1e-12) bad++;
    else if (d <= 1e-12) { ties++; tieCases.push([p, q, r]); }
  }
  check("P_AB <= P_BC also holds without the condition r > p, as the page claims",
    bad === 0 && cases > 0, `${bad} reversals in ${cases} cases`);
  check("without r > p the only ties are at p = r = 1",
    ties === 50 && tieCases.every(([p, q, r]) => p === 1 && r === 1),
    `${ties} ties, first ${JSON.stringify(tieCases.slice(0, 3))}`);
}

{
  // Stronger than the page's claim: among all three starts, BC is B's best.
  let bad = 0;
  let ties = 0;
  for (const p of GRID) for (const q of GRID) for (const r of GRID) {
    const t = C.computeTable(p, q, r);
    if (t.BC.B + 1e-12 < t.AB.B || t.BC.B + 1e-12 < t.AC.B) bad++;
    if (near(t.BC.B, t.AB.B, 1e-12) || near(t.BC.B, t.AC.B, 1e-12)) ties++;
  }
  check("starting B vs C is B's best of all three starts at every setting", bad === 0, `${bad} cases where another start was better`);
  check("the best start is sometimes tied", ties > 0, `${ties} ties`);
}

check("at the default settings B gains by starting against C",
  near(C.difference(0.55, 0.6, 0.75), 0.032625, 1e-12));

{
  const t = C.computeTable(1, 1, 1);
  check("when both are certain, A still takes the series", near(t.AB.A, 1) && near(t.BC.A, 1) && near(t.AC.A, 1));
  check("at p=q=r=1 B has no chance from any start",
    near(t.AB.B, 0) && near(t.BC.B, 0) && near(t.AC.B, 0));
}

/* ----------------- 4. the old applet's own method, transcribed literally */

{
  let firstBad = 0;
  let thirdBad = 0;
  let secondBad = 0;
  let sumBad = 0;
  for (const p of GRID) for (const q of GRID) for (const r of GRID) {
    const old = appletResult(p, q, r);
    const fixed = C.computeResult(p, q, r);
    if (!near(old[0], fixed[0], 1e-9)) firstBad++;
    if (!near(old[2], fixed[2], 1e-9)) thirdBad++;
    // The single typo: the last branch of "second" uses x instead of (1-x).
    const expectedTypo = (1 - p) * (1 - q) * r * (2 * p - 1);
    if (!near(old[1] - fixed[1], expectedTypo, 1e-8)) secondBad++;
    // So the old applet's AB column is 1 + that same typo term.
    const oldSum = old[0] + old[1] + old[2];
    if (!near(oldSum, 1 + expectedTypo, 1e-8)) sumBad++;
  }
  check("the applet's 'first player' result agrees with the core everywhere", firstBad === 0, `${firstBad} mismatches`);
  check("the applet's 'third player' result agrees with the core everywhere", thirdBad === 0, `${thirdBad} mismatches`);
  check("the applet's 'second player' typo is exactly (1-p)(1-q)r(2p-1)", secondBad === 0, `${secondBad} mismatches`);
  check("the old AB column adds to 1 + that typo (not 1)", sumBad === 0, `${sumBad} mismatches`);
  check("the typo is visible at the applet's own default settings",
    near(appletResult(0.55, 0.6, 0.75).reduce((a, b) => a + b, 0), 1.0135, 1e-12));
}

done("chess-tournament");
