#!/usr/bin/env node
"use strict";

/*
 * Logic test for life-like-automaton/life-like-automaton-core.js.
 *
 *   1. Rule strings and preset definitions, including Conway's B3/S23.
 *   2. Conway matches the standard blinker; Seeds empties the board (S is
 *      empty); Life without Death never reduces the population.
 *   3. Toggling rules, reverse and randomize.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("life-like-automaton/life-like-automaton-core.js", "LifeLikeAutomatonCore");
const parse = (rows) => rows.map((r) => r.split("").map((c) => c === "#"));
const state = (rows, opts = {}) => C.start({ size: rows.length, cells: parse(rows), ...opts });
const encode = (cells) => cells.map((r) => r.map((v) => v ? 1 : 0).join("")).join("/");

{
  const s = C.start();
  equal("default rule", C.ruleString(s), "B3/S23");
  equal("default preset", s.preset, "conway");
  equal("highlife rule", C.ruleString(C.start({ preset: "highlife" })), "B36/S23");
  equal("seeds rule", C.ruleString(C.start({ preset: "seeds" })), "B2/S");
  equal("blank survival formats correctly", C.ruleString(C.start({ preset: "seeds" })), "B2/S");
  equal("size clamped", C.start({ size: 99 }).size, 40);
}

{
  const blink = state([".....", ".....", "###..", ".....", "....."]);
  equal("Conway blinker", encode(C.step(blink).cells), "00000/01000/01000/01000/00000");
  equal("Conway blinker period", encode(C.step(C.step(blink)).cells), encode(blink.cells));

  const seeds = state([".....", ".###..", ".....", ".....", "....."], { preset: "seeds" });
  const seeded = C.step(seeds);
  check("Seeds kills every live cell", !seeded.cells[1][1] && !seeded.cells[1][2] && !seeded.cells[1][3]);
  const emptyBirth = state([".....", ".....", ".....", ".....", "....."], { preset: "seeds" });
  equal("Seeds stays empty", C.population(C.step(emptyBirth)), 0);

  const deathless = state([".....", ".###..", ".....", ".....", "....."], { preset: "lifeWithoutDeath" });
  const grown = C.step(deathless);
  check("Life without Death keeps its cells", C.population(grown) >= C.population(deathless));
  let at = grown;
  let neverDropped = true;
  let previous = C.population(at);
  for (let i = 0; i < 5; i++) {
    at = C.step(at);
    const now = C.population(at);
    if (now < previous) neverDropped = false;
    previous = now;
  }
  check("population never decreases", neverDropped);
}

{
  const s = C.start();
  const b = C.setRule(s, "birth", 6);
  equal("birth toggled on", C.ruleString(b), "B36/S23");
  const off = C.setRule(b, "birth", 3);
  equal("birth toggled off", C.ruleString(off), "B6/S23");
  equal("toggled rules lose the preset", off.preset, null);
  const back = C.setPreset(off, "highlife");
  equal("a preset restores rules", C.ruleString(back), "B36/S23");
  equal("an unknown preset is ignored", C.setPreset(back, "nope"), back);

  const stepped = C.step(s);
  equal("reverse restores the board", encode(C.reverse(stepped).cells), encode(s.cells));
  const toggled = C.toggle(s, 2, 3);
  check("clicking toggles a cell", toggled.cells[3][2] && C.toggle(toggled, 2, 3).cells[3][2] === false);
  const rnd = rng(1970);
  const random = C.randomize(s, 12, rnd);
  equal("randomize places cells", C.population(random), 12);
  equal("analysis reports the rule", C.analyze(back).rule, "B36/S23");
}

done("life-like-automaton");
