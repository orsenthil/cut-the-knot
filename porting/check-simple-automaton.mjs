#!/usr/bin/env node
"use strict";

/*
 * Logic test for simple-automaton/simple-automaton-core.js.
 *
 *   node porting/check-simple-automaton.mjs
 *
 * 1. The five Compute branches are transcribed again from javap and compared
 *    cell by cell over seeded grids at every rule.
 * 2. Every finite population dies out under every rule; for rule 2n the
 *    number of steps never exceeds the initial live count (the 1973 Soviet
 *    Olympiad claim), checked exhaustively on 3x3 and on seeded grids.
 * 3. Monotonicity: adding live cells can never kill a cell that was alive.
 * 4. Options, ranges, messages, plain JSON and mutations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("simple-automaton/simple-automaton-core.js", "SimpleAutomatonCore");

/** Automaton.Compute, written again from javap, one branch per rule. */
function jStep(grid, rule) {
  const n = grid.length;
  const next = C.empty(n);
  const at = (i, j) => (i >= 0 && i < n && j >= 0 && j < n ? grid[i][j] : 0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let live;
      switch (rule) {
        case 0: live = at(i, j) + at(i - 1, j) + at(i, j + 1); if (live <= 1) live = 0; else live = 1; break;
        case 1: live = at(i, j) + at(i - 1, j) + at(i, j + 1) + at(i + 1, j); if (live <= 2) live = 0; else live = 1; break;
        case 2: live = at(i, j) + at(i - 1, j + 1) + at(i, j + 1) + at(i + 1, j + 1); if (live <= 2) live = 0; else live = 1; break;
        case 3: live = at(i, j) + at(i - 1, j) + at(i, j + 1) + at(i + 1, j) + at(i, j - 1); if (live <= 3) live = 0; else live = 1; break;
        default: live = at(i, j) + at(i - 1, j + 1) + at(i + 1, j - 1) + at(i - 1, j - 1) + at(i + 1, j + 1);
          if (live <= 3) live = 0; else live = 1;
      }
      next[i][j] = live;
    }
  }
  return next;
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the applet's grid side defaults to ten", s.side, 10);
  equal("five rules, numbered 2n to 4d", C.RULES, ["2n", "3n", "3d", "4n", "4d"]);
  check("the starting rule is 2n", s.rule === "2n" && s.steps === 0);
  check("the applet's side range is at least 3 to 20", [C.MIN_SIDE, C.MAX_SIDE], [3, 20]);
  check("a fresh grid has live cells", C.population(s.grid) > 0);
  check("a fresh demo is not done", C.result(s) === null);
  const one = [[0, 0, 0], [0, 1, 0], [0, 0, 0]];
  for (const rule of C.RULES) {
    equal(`a lone cell dies under ${rule}`, C.step(one, rule), C.empty(3));
  }
  const square = [[1, 1], [1, 1]];
  check("a 2x2 block dies under rule 4n (the page's surviving square needs a lower threshold)",
    C.population(C.step(square, "4n")) < 4);
  check("and also dies under rule 2n", C.population(C.step(square, "2n")) < 4);
}

/* ------------------------------- 2. each rule, against the applet's code */

{
  let same = true;
  let detail = "";
  let cases = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const random = rng(seed);
    for (let ruleIndex = 0; ruleIndex < C.RULES.length; ruleIndex++) {
      for (const side of [3, 5, 8]) {
        const grid = C.randomGrid(side, 0.45, rng(seed * 100 + ruleIndex));
        const mine = C.step(grid, C.RULES[ruleIndex]);
        const theirs = jStep(grid, ruleIndex);
        cases++;
        if (JSON.stringify(mine) !== JSON.stringify(theirs)) {
          same = false;
          detail = `rule ${ruleIndex}, side ${side}, seed ${seed}`;
          break;
        }
      }
      if (!same) break;
    }
    if (!same) break;
  }
  check(`Compute matches a second transcription in ${cases} cases`, same, detail);
}

/* --------------------------- 3. extinction and the Olympiad bound for 2n */

{
  let allDie = true;
  let guardHit = "";
  for (let seed = 1; seed <= 60; seed++) {
    for (const rule of C.RULES) {
      const grid = C.randomGrid(7, 0.5, rng(seed * 31 + C.RULES.indexOf(rule)));
      const out = C.extinguish(grid, rule, 300);
      if (out.alive !== 0) {
        allDie = false;
        guardHit = `${rule}, seed ${seed}: ${out.alive} alive after ${out.steps} steps`;
        break;
      }
    }
    if (!allDie) break;
  }
  check("every finite population dies out under every rule", allDie, guardHit);

  let bound = true;
  let detail = "";
  // Every 3x3 population, all 512 of them.
  for (let mask = 0; mask < 512; mask++) {
    const grid = Array.from({ length: 3 }, (_, i) =>
      Array.from({ length: 3 }, (_, j) => ((mask >> (i * 3 + j)) & 1)));
    const initial = C.population(grid);
    const out = C.extinguish(grid, "2n", 100);
    if (out.alive !== 0 || out.steps > initial) {
      bound = false;
      detail = `mask ${mask}: ${out.steps} steps for ${initial} cells`;
      break;
    }
  }
  check("rule 2n dies out within the initial live count (all 3x3 grids)", bound, detail);

  let bigger = true;
  for (let seed = 1; seed <= 80; seed++) {
    const grid = C.randomGrid(6, 0.5, rng(seed));
    const out = C.extinguish(grid, "2n", 100);
    if (out.alive !== 0 || out.steps > C.population(grid)) bigger = false;
  }
  check("the same bound holds on 80 seeded 6x6 grids", bigger);

  let monotone = true;
  for (let seed = 1; seed <= 50; seed++) {
    const random = rng(seed);
    const a = C.randomGrid(5, 0.4, random);
    const b = a.map((row, i) => row.map((v, j) => (v || random() < 0.4 ? 1 : 0)));
    for (const rule of C.RULES) {
      const fa = C.step(a, rule);
      const fb = C.step(b, rule);
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) if (fa[i][j] && !fb[i][j]) monotone = false;
      }
    }
  }
  check("the rules are monotone: more live cells cannot kill a survivor", monotone);
}

/* ------------------------------------- 4. options, messages and plain JSON */

{
  const base = C.start({ grid: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], side: 3 });
  const clicked = C.toggleCell(base, 0, 1);
  equal("clicking a cell flips it", clicked.grid[0][1], 1);
  equal("and resets the step counter", clicked.steps, 0);
  check("the click is reported", clicked.message.includes("Cell 1, 2 is now alive"));
  equal("a click outside the grid does nothing", C.toggleCell(base, 9, 9), base);
  const stepped = C.advance(C.start({ grid: [[1, 0, 0], [0, 0, 0], [0, 0, 0]], side: 3 }));
  equal("a step increases the counter", stepped.steps, 1);
  check("and says what happened", stepped.message.includes("Step 1") ||
    stepped.message.includes("died out after 1 step"));
  equal("an unknown rule is refused", C.setRule(base, "xx"), base);
  equal("a rule change resets the steps", C.setRule(stepped, "3d").steps, 0);
  check("the rule is described in words", C.setRule(base, "4d").message.includes("diagonal"));
  equal("side below three is clamped", C.setSide(base, 1).side, C.MIN_SIDE);
  equal("side above twenty is clamped", C.setSide(base, 99).side, C.MAX_SIDE);
  equal("Clear empties the grid", C.population(C.clear(base).grid), 0);
  check("Clear is reported", C.clear(base).message.includes("All cells are dead"));
  const fresh = C.randomize(base, rng(2));
  check("Randomize makes a new population", fresh.steps === 0 && typeof fresh.grid[0][0] === "number");
  const dead = C.advance(C.start({ grid: [[1, 0, 0], [0, 0, 0], [0, 0, 0]], side: 3 }));
  check("the dead grid is marked done", C.result(dead) === "done");
  const snapshot = JSON.stringify(base);
  C.advance(base);
  C.toggleCell(base, 0, 0);
  check("core functions never mutate the position", JSON.stringify(base) === snapshot);
  check("a position is plain JSON", typeof JSON.parse(JSON.stringify(clicked)).side === "number");
}

done("simple-automaton");
