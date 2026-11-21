#!/usr/bin/env node
"use strict";

/*
 * Logic test for game-of-life/game-of-life-core.js.
 *
 *   1. Birth, survival and death on small hand-built configurations.
 *   2. A block is a still life; a blinker, toad and beacon have period two.
 *   3. A glider translates by one diagonal step after four generations, the
 *      reverse step restores the previous generation, and controls work.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("game-of-life/game-of-life-core.js", "GameOfLifeCore");
const parse = (rows) => rows.map((r) => r.split("").map((c) => c === "#"));
const state = (rows) => C.start({ size: rows.length, cells: parse(rows) });
const advance = (s, n) => { let at = s; for (let i = 0; i < n; i++) at = C.step(at); return at; };

{
  equal("empty population", C.population(state(["...", "...", "..."])), 0);
  const blinker = state([".....", ".....", "###..", ".....", "....."]);
  equal("a horizontal blinker", C.encode(blinker), "00000/00000/11100/00000/00000");
  equal("it becomes vertical", C.encode(C.step(blinker)), "00000/01000/01000/01000/00000");
  equal("with three cells", C.population(C.step(blinker)), 3);
  equal("blinker period two", C.encode(advance(blinker, 2)), C.encode(blinker));

  const lonely = state([".....", ".##..", ".....", ".....", "....."]);
  equal("two adjacent cells die", C.population(C.step(lonely)), 0);
  const crowded = state(["#####", "#####", "#####", "#####", "#####"]);
  check("the middle of a crowd dies", !C.step(crowded).cells[2][2]);
  check("some edge cells survive", C.population(C.step(crowded)) > 0);
}

{
  const block = state(["##...", "##...", ".....", ".....", "....."]);
  equal("a block is still", C.encode(C.step(block)), C.encode(block));
  const toad = state(["......", ".###..", "###...", "......", "......", "......"]);
  equal("a toad has period two", C.encode(advance(toad, 2)), C.encode(toad));
  const beacon = state(["##....", "##....", "..##..", "..##..", "......", "......"]);
  equal("a beacon has period two", C.encode(advance(beacon, 2)), C.encode(beacon));

  const glider = state([".#.....", "..#....", "###....", ".......", ".......", ".......", "......."]);
  const moved = advance(glider, 4);
  equal("the glider keeps five cells", C.population(moved), 5);
  check("the glider moved down and right", moved.cells[1][2] === true && moved.cells[0][1] === false);
  check("the glider differs from its start", C.encode(moved) !== C.encode(glider));
}

{
  const s = C.start({ size: 20 });
  equal("default empty", C.population(s), 0);
  equal("size clamped", C.start({ size: 99 }).size, 40);
  const rnd = rng(1970);
  const random = C.randomize(s, 15, rnd);
  equal("randomize places the requested cells", C.population(random), 15);
  equal("reverse is a no-op at the start", C.reverse(s), s);
  const stepped = C.step(random);
  equal("reverse restores the generation", C.encode(C.reverse(stepped)), C.encode(random));
  const toggled = C.toggle(s, 3, 4);
  check("a click toggles a cell", toggled.cells[4][3] && C.toggle(toggled, 3, 4).cells[4][3] === false);
  const pattern = C.place(s, "glider", 1, 1);
  equal("a placed glider has five cells", C.population(pattern), 5);
  equal("an unknown pattern is ignored", C.place(s, "nope", 1, 1), s);
  equal("analysis generation", C.analyze(stepped).generation, 1);
}

done("game-of-life");
