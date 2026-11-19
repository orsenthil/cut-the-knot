#!/usr/bin/env node
"use strict";

/*
 * Logic test for bachet/bachet-core.js.
 *
 *   node porting/check-bachet.mjs
 *
 *   1. Options and the applet's ranges; the number of pairs and appearances.
 *   2. The grid is a bijection onto 1..M, and the trick works for EVERY pair,
 *      every N, both Straight/Randomize settings and several seeds -- checked
 *      by locating the cards in the finished grid (independent of generation).
 *   3. The page's concrete N=4 table and its "row-pair names the pair" claim.
 *   4. buildGrid compared with a literal second transcription of BachetOb.Reset
 *      over the whole option space.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("bachet/bachet-core.js", "BachetCore");

const optionGrid = [];
for (let n = C.MIN_N; n <= C.MAX_N; n++) {
  for (const straight of [false, true]) {
    for (const randomized of [false, true]) {
      for (const seed of [1, 2, 7, 12345]) optionGrid.push({ n, straight, randomized, seed });
    }
  }
}

/* --------------------------------------------------- 1. options and counts */

{
  equal("n clamped low", C.makeOptions({ n: 0 }).n, 3);
  equal("n clamped high", C.makeOptions({ n: 99 }).n, 6);
  equal("n default", C.makeOptions({}).n, 4);
  equal("bad n falls back", C.makeOptions({ n: "x" }).n, 4);
  equal("randomized defaults on", C.makeOptions({}).randomized, true);
  equal("straight defaults off", C.makeOptions({}).straight, false);
  for (const n of [3, 4, 5, 6]) {
    const s = C.start({ n, straight: true, randomized: false });
    const M = n * (n + 1);
    equal(`M = N(N+1) for ${n}`, s.labels.length, M);
    equal(`stage-1 pairs = N(N+1)/2 for ${n}`, s.pairs.length, M / 2);
    equal(`grid is N by N+1 for ${n}`, s.rows.length, n);
    check(`every grid row has N+1 cells for ${n}`, s.rows.every((row) => row.length === n + 1));
    equal(`stage-1 row lengths sum to pairs for ${n}`,
      C.STAGE1_ROWS[n].reduce((a, b) => a + b, 0), M / 2);

    // The page: "each object appearing N+1 times" among the pairs.
    for (let object = 0; object < n; object++) {
      let appearances = 0;
      for (const p of s.pairs) {
        if (p.a === object) appearances++;
        if (p.b === object) appearances++;
      }
      equal(`object ${object} appears N+1 times for ${n}`, appearances, n + 1);
    }
  }
}

/* ---------------------------- 2. the grid is a bijection and the trick works */

{
  let boards = 0;
  let pairChecks = 0;
  for (const opt of optionGrid) {
    const s = C.start(opt);
    boards++;
    const M = opt.n * (opt.n + 1);

    // Every card 1..M appears exactly once in the grid.
    const seen = s.rows.flat().slice().sort((a, b) => a - b);
    check(`grid is a permutation of 1..M (${JSON.stringify(opt)})`,
      seen.length === M && seen.every((v, i) => v === i + 1));
    check(`every row has distinct cards (${JSON.stringify(opt)})`,
      s.rows.every((row) => new Set(row).size === row.length));

    // For every displayed pair, its two cards really lie in rows a and b;
    // naming those rows recovers exactly those two cards.
    for (let t = 0; t < s.pairs.length; t++) {
      const p = s.pairs[t];
      const [L, R] = p.labels;
      const locL = C.locate(s, L);
      const locR = C.locate(s, R);
      check(`both cards of pair ${t} are located (${JSON.stringify(opt)})`, !!locL && !!locR);
      if (!locL || !locR) continue;
      const rowsOfPair = [locL[0], locR[0]].sort((a, b) => a - b);
      const expectedRows = [p.a, p.b].sort((a, b) => a - b);
      equal(`pair ${t} occupies rows a,b (${JSON.stringify(opt)})`, rowsOfPair, expectedRows);

      const revealed = C.reportSelection(C.play(s), locL[0], locR[0]).answer;
      check(`rows reveal cards of pair ${t} (${JSON.stringify(opt)})`,
        !!revealed && revealed[0] === L && revealed[1] === R);
      const reversed = C.reportSelection(C.play(s), locR[0], locL[0]).answer;
      check(`reversed rows reveal the same pair ${t}`, !!reversed && reversed[0] === L && reversed[1] === R);
      pairChecks++;
    }
  }
  equal("every option combination was checked", boards, optionGrid.length);
  check("all pairs over all options were checked", pairChecks >= boards * 6);
}

/* ----------------------------- 3. the page's concrete claims and messages */

{
  // Straight list, no randomize, N=4: the page's own table of ordered pairs.
  const s = C.start({ n: 4, straight: true, randomized: false });
  equal("page's N=4 grid, row 1", s.rows[0], [1, 2, 3, 5, 7]);
  equal("page's N=4 grid, row 2", s.rows[1], [4, 9, 10, 11, 13]);
  equal("page's N=4 grid, row 3", s.rows[2], [6, 12, 15, 16, 17]);
  equal("page's N=4 grid, row 4", s.rows[3], [8, 14, 18, 19, 20]);

  // Every grid cell belongs to exactly one pair. The diagonal pair {r,r}
  // sits in columns r and r+1; earlier rows occupy the columns before r,
  // later rows the columns after r+1.
  for (let r = 0; r < s.n; r++) {
    for (let c = 0; c < s.n + 1; c++) {
      let k1;
      let k2;
      if (c < r) { k1 = c; k2 = r; }
      else if (c === r || c === r + 1) { k1 = r; k2 = r; }
      else { k1 = r; k2 = c - 1; }
      const key = String(k1) + String(k2);
      check(`cell ${r},${c} belongs to pair ${key}`, s.table[key].includes(s.rows[r][c]));
    }
    // The page: the companion of the diagonal pair is one column to the right.
    check(`diagonal companion sits at row ${r}, column ${r + 1}`, s.rows[r][r + 1] === s.table[String(r) + String(r)][1]);
  }

  // The announcements and the stage transitions match BachetOb's strings.
  equal("first-stage announcement", C.announcement(s), ["Select a pair of numbers.", "Click Proceed!"]);
  const second = C.play(s);
  equal("second stage", second.stage, C.SECOND);
  equal("second-stage announcement", C.announcement(second),
    ["Click on the left of the rows", "that contain your numbers."]);
  equal("just started", C.justStarted(s), true);
  equal("not finished at first stage", C.finished(s), false);
  const final = C.reportSelection(second, 2, 0);
  equal("finished after naming rows", C.finished(final), true);
  equal("final answer for rows 0 and 2", final.answer, [5, 6]);
  equal("final announcement names the cards", C.announcement(final),
    ["Your numbers are 5 and 6", "Press Reset!"]);
  equal("a -1 row reveals nothing", C.reportSelection(second, -1, 0).answer, null);

  // The page: Straight lists the labels in order; Randomize shuffles them and
  // may even move a pair's two cards between its two rows.
  equal("straight lists labels in order", C.start({ n: 5, straight: true }).labels,
    Array.from({ length: 30 }, (_, i) => i + 1));
  const loose = C.start({ n: 5, straight: false, seed: 9 });
  check("non-straight labels are a permutation",
    loose.labels.slice().sort((x, y) => x - y).every((v, i) => v === i + 1));
  check("non-straight labels differ from the straight list",
    JSON.stringify(loose.labels) !== JSON.stringify(C.start({ n: 5, straight: true, seed: 9 }).labels));
  for (const seed of [1, 2, 3]) {
    const plain = C.start({ n: 5, straight: true, randomized: false, seed });
    const mixed = C.start({ n: 5, straight: true, randomized: true, seed });
    check(`Randomize changes the displayed grid (seed ${seed})`,
      JSON.stringify(plain.rows) !== JSON.stringify(mixed.rows));
    // Each pair still lives in exactly its own two rows after the shuffle.
    check(`Randomize keeps every pair in its rows (seed ${seed})`, mixed.pairs.every((p) => {
      const lr = C.locate(mixed, p.labels[0]);
      const rr = C.locate(mixed, p.labels[1]);
      return lr && rr && [lr[0], rr[0]].sort((x, y) => x - y)[0] === p.a
        && [lr[0], rr[0]].sort((x, y) => x - y)[1] === p.b;
    }));
  }

  const restarted = C.restart(s);
  equal("reset keeps the options", [restarted.n, restarted.straight, restarted.randomized], [4, true, false]);
  equal("reset moves back to first stage", restarted.stage, C.FIRST);
  check("reset advances the seed", restarted.seed === s.seed + 1);
}

/* ----------------------- 4. a second transcription of BachetOb.Reset's loop */

/*
 * Written directly from the bytecode: the same a/b counters, the same two
 * ternary placements per branch, the same StringBuffer-style "ab" keys.
 */
function appletReset(n, P, Aux, swaps) {
  const M = n * (n + 1);
  const Rows = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  const Hash = Object.create(null);
  let i = 0;
  let j = 0;
  for (let k = 0; k < M; k += 2) {
    const pair = { x: P[k], y: P[k + 1] };
    const flip = !!swaps[k / 2];
    if (i === j) {
      Hash["" + i + i] = [pair.x, pair.y];
      Rows[i][Aux[i][j] - 1] = flip ? pair.y : pair.x; j++;
      Rows[i][Aux[i][j] - 1] = flip ? pair.x : pair.y; j++;
    } else if (j < n + 1) {
      Hash["" + i + (j - 1)] = [pair.x, pair.y];
      Rows[i][Aux[i][j] - 1] = flip ? pair.y : pair.x;
      Rows[j - 1][Aux[j - 1][i] - 1] = flip ? pair.x : pair.y;
      j++;
    } else {
      i++;
      j = i;
      Hash["" + i + i] = [pair.x, pair.y];
      Rows[i][Aux[i][j] - 1] = flip ? pair.y : pair.x; j++;
      Rows[i][Aux[i][j] - 1] = flip ? pair.x : pair.y; j++;
    }
  }
  return { rows: Rows, table: Hash };
}

{
  let compared = 0;
  for (const opt of optionGrid) {
    const s = C.start(opt);
    const ref = appletReset(s.n, s.labels, s.aux, s.swaps);
    equal(`applet Reset grid (${JSON.stringify(opt)})`, s.rows, ref.rows);
    equal(`applet Reset row table (${JSON.stringify(opt)})`, s.table, ref.table);
    compared++;
  }
  equal("compared the whole option space", compared, optionGrid.length);
}

done("bachet");
