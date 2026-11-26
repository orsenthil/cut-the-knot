#!/usr/bin/env node
"use strict";

/*
 * Logic test for very-tiles/very-tiles-core.js.
 *
 *   node porting/check-very-tiles.mjs
 *
 * Checks, over all 21 of the applet's shuffles and many seeds:
 *   - every shuffle places the twelve problems and their hidden keys once;
 *   - every generated equation has exactly one whole-number answer, 1..12;
 *   - a second, literal transcription of VeryTilesExpression.SetId/MakeSum/
 *     MakeDiff agrees with problemFor over the whole choice space;
 *   - a second transcription of VeryTilesBox.DrawBack agrees with shape(),
 *     and the 12 numbers give 12 distinct (colour, corner) patterns;
 *   - tile-then-problem places, problem-then-blank-tile returns (including
 *     the applet's renumbering), selection toggles and blocked moves;
 *   - the correct assignment fills every gap and makes the patterns agree,
 *     while every transposition and every single wrong answer do not;
 *   - the page's claim that a missing tile means an earlier wrong match.
 */

import { loadCore, check, equal, done, rng as seeded } from "./lib/load-core.mjs";

const C = loadCore("very-tiles/very-tiles-core.js", "VeryTilesCore");
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

/** A second transcription of VeryTilesExpression, straight from javap. */
function originalProblem(answer, rand) {
  const Id = answer;
  const makeSum = (extra) => {
    const A = Math.floor(rand() * (Id + extra)), B = Id + extra - A;
    return { answer, op: 0, a: A, b: B, text: `${A} + ${B} = ?` };
  };
  const makeDiff = (flag) => {
    const B = Math.floor(rand() * 8), A = Id + B;
    return {
      answer, op: flag ? 1 : 2, a: A, b: B,
      text: flag ? `${B} + ? = ${A}` : `? + ${B} = ${A}`,
    };
  };
  if (Id <= 3) return makeDiff(rand() < 0.5 ? 1 : 0);
  if (rand() < 0.5) return makeSum(0);
  return makeDiff(rand() < 0.5 ? 1 : 0);
}

/** A second transcription of VeryTilesBox.DrawBack/GetOrigin, from javap. */
function originalShape(key, width = 50, height = 50) {
  const k = key % 6;
  const color = (k === 1 || k === 2) ? "blue" : ((k === 3 || k === 4) ? "green" : "red");
  let origin;
  switch (key) {
    case 1: case 3: case 5: origin = [width, 0]; break;
    case 2: case 4: case 6: origin = [0, 0]; break;
    case 7: case 9: case 11: origin = [width, height]; break;
    case 8: case 10: case 12: origin = [0, height]; break;
    default: origin = [0, 0];
  }
  const corner = origin[0] === width ? (origin[1] === 0 ? "tr" : "br")
                                     : (origin[1] === 0 ? "tl" : "bl");
  return { color, corner, origin };
}

/** All whole numbers that make a shown equation true. */
function solve(text) {
  const out = [];
  for (let v = 0; v <= 60; v++) {
    const m = /^(\d+) \+ (\d+) = (\d+)$/.exec(text.replace("?", String(v)));
    if (m && Number(m[1]) + Number(m[2]) === Number(m[3])) out.push(v);
  }
  return out;
}

/** Place the given number in each problem cell, tile first as in the applet. */
function fill(state, numbers) {
  let s = state;
  for (let pos = 0; pos < C.COUNT; pos++) {
    const tilePos = numbers[pos] - 1;
    s = C.activate(s, "tile", tilePos);
    s = C.activate(s, "problem", pos);
  }
  return s;
}

/* ------------------------------------------------- 1. the shuffles and keys */

equal("the applet has 21 shuffles of 12 cells", [C.NPERMS, C.COUNT], [21, 12]);
for (let p = 0; p < C.NPERMS; p++) {
  check(`shuffle ${p} is a permutation of the 12 cells`,
    C.PERMS[p].length === 12 && [...C.PERMS[p]].sort((a, b) => a - b).every((v, i) => v === i));
}
for (let p = 0; p < C.NPERMS; p++) {
  for (const seed of SEEDS) {
    const s = C.start({ pattern: p, seed });
    const answers = s.problems.map((x) => x.answer);
    check(`pattern ${p} seed ${seed}: answers are 1..12 once`,
      answers.slice().sort((a, b) => a - b).every((v, i) => v === i + 1));
    check(`pattern ${p} seed ${seed}: each cell's answer equals its hidden key`,
      s.problems.every((x, pos) => x.answer === s.keys[pos]));
    check(`pattern ${p} seed ${seed}: the shuffle and keys agree`,
      s.keys.every((key, pos) => s.perm[key - 1] === pos));
    check(`pattern ${p} seed ${seed}: every equation has one solution, 1..12`,
      s.problems.every((x) => equalSolutions(solve(x.text), x.answer)));
    check(`pattern ${p} seed ${seed}: tiles start at 1..12 in order`,
      s.tiles.every((t, pos) => t.value === pos + 1 && t.show));
  }
}
function equalSolutions(found, answer) { return found.length === 1 && found[0] === answer; }

/** Is a fully filled equation a true sum? */
function trueEquation(text) {
  const m = /^(\d+) \+ (\d+) = (\d+)$/.exec(text);
  return !!m && Number(m[1]) + Number(m[2]) === Number(m[3]);
}

/* ------------------------- 2. a second transcription of the problem maker */

const CHOICES = [0, 0.25, 0.4999, 0.5, 0.7501, 0.9999];
let makerCases = 0;
for (let answer = 1; answer <= 12; answer++) {
  for (const a of CHOICES) for (const b of CHOICES) for (const c of CHOICES) {
    for (const extra of [0, 0.4999]) {
      const seq = [a, b, c, extra];
      let i = 0;
      const rand = () => seq[i++];
      const mine = C.problemFor(answer, rand);
      const used = i;
      i = 0;
      const theirs = originalProblem(answer, rand);
      check(`problem maker n=${answer} [${seq.join(",")}]`,
        JSON.stringify(mine) === JSON.stringify(theirs) && i === used,
        `${JSON.stringify(mine)} vs ${JSON.stringify(theirs)}`);
      makerCases++;
    }
  }
}
check("the problem maker was compared over the full choice space", makerCases === 12 * 6 ** 3 * 2);

/* -------------------------- 3. a second transcription of the star pattern */

for (let key = 1; key <= 12; key++) {
  const t = originalShape(key), mine = C.shape(key);
  check(`star for ${key}: same colour and corner as DrawBack`,
    mine.color === t.color && mine.corner === t.corner);
  check(`star for ${key}: the origin is inside the tile`,
    t.origin[0] === 0 || t.origin[0] === 50);
}
const combos = new Set(Array.from({ length: 12 }, (_, i) => {
  const x = C.shape(i + 1); return `${x.color}/${x.corner}`;
}));
equal("the 12 hidden numbers give 12 different patterns", combos.size, 12);
for (let p = 0; p < C.NPERMS; p++) {
  const s = C.start({ pattern: p, seed: 7 });
  const top = C.pattern(s, "tiles"), bottom = C.pattern(s, "problems");
  check(`pattern ${p}: both rows encode the same keys before matching`,
    top.every((x, pos) => x.key === bottom[pos].key &&
      x.color === bottom[pos].color && x.corner === bottom[pos].corner));
}

/* ------------------------------- 4. placing, returning and selecting tiles */

{
  let s = C.start({ pattern: 3, seed: 5 });
  s = C.activate(s, "problem", 0);
  equal("a problem can be selected", s.selected, { kind: "problem", pos: 0 });
  s = C.activate(s, "problem", 0);
  equal("clicking it again unselects it", s.selected, null);
  s = C.activate(s, "problem", 0);
  const before = s.answers[0];
  s = C.activate(s, "tile", 4); // a visible, unused tile cannot take an answer back
  equal("a problem then a visible tile does nothing", [s.answers[0], s.selected], [before, null]);

  s = C.start({ pattern: 3, seed: 5 });
  s = C.activate(s, "tile", s.keys[0] - 1);
  s = C.activate(s, "problem", 0);
  equal("tile then problem places the tile's number", s.answers[0], s.keys[0]);
  check("the used tile is blank and stays in its cell",
    !s.tiles[s.keys[0] - 1].show && s.tiles[s.keys[0] - 1].value === s.keys[0]);
  check("the filled equation is true", solve(C.equation(s, 0)).includes(s.answers[0]));

  const other = (s.keys[0] % 12) + 1;
  s = C.activate(s, "tile", other - 1);
  s = C.activate(s, "problem", 0);
  equal("an answered problem is not overwritten", s.answers[0], s.keys[0]);

  s = C.activate(s, "problem", 0);
  s = C.activate(s, "tile", s.keys[0] - 1);
  equal("problem then blank tile takes the answer back", s.answers[0], null);
  check("the returned tile shows its number again", s.tiles[s.keys[0] - 1].show);

  // The applet renumbers the clicked blank tile to the selected problem's old
  // answer, even when that tile was originally a different number, and lets a
  // blank tile be placed into another gap (so a number can appear twice).
  let t = C.start({ pattern: 0, seed: 2 });
  const a = t.keys[0], b = t.keys[1];
  t = C.activate(t, "tile", a - 1);
  t = C.activate(t, "problem", 0);
  t = C.activate(t, "tile", b - 1);
  t = C.activate(t, "problem", 1);
  t = C.activate(t, "problem", 1);
  t = C.activate(t, "tile", a - 1); // return the tile from problem 1
  equal("returning a wrong tile renumbers it to that problem's answer", t.tiles[a - 1].value, b);
  t = C.activate(t, "tile", b - 1);
  t = C.activate(t, "problem", 0);
  equal("a blank tile can be placed into an answered problem only after it is freed",
    t.answers[0], a);
  let freed = C.activate(C.activate(t, "tile", b - 1), "problem", 1); // put b back
  freed = C.activate(C.activate(freed, "problem", 1), "tile", b - 1); // then free it
  check("the second problem can be freed too", freed.answers[1] === null && freed.tiles[b - 1].show);
  const dup = C.activate(C.activate(freed, "tile", a - 1), "problem", 1);
  check("a blank tile from another problem is still reusable, as in the applet",
    dup.answers[0] === a && dup.answers[1] === b && !dup.tiles[a - 1].show);
}

/* ------------------------- 5. the correct answer and every wrong answer */

for (let p = 0; p < C.NPERMS; p++) {
  for (const seed of SEEDS) {
    const s0 = C.start({ pattern: p, seed });
    const right = s0.problems.map((x) => x.answer);

    const won = fill(s0, right);
    check(`pattern ${p} seed ${seed}: the right matches fill every gap`, C.allAnswered(won));
    check(`pattern ${p} seed ${seed}: the result is a finished demo`, C.result(won) === "done");
    check(`pattern ${p} seed ${seed}: the two patterns agree`, C.patternsAgree(won));
    check(`pattern ${p} seed ${seed}: all twelve filled equations are true`,
      won.problems.every((_, pos) => trueEquation(C.equation(won, pos))));
    check(`pattern ${p} seed ${seed}: pattern mode is now available`,
      C.setMode(won, "pattern").mode === "pattern");

    const shifted = right.map((_, i) => right[(i + 1) % 12]);
    const shiftedState = fill(s0, shifted);
    check(`pattern ${p} seed ${seed}: a cyclic shift disagrees`,
      C.allAnswered(shiftedState) && !C.patternsAgree(shiftedState));

    for (let pos = 0; pos < 12; pos++) {
      const oneWrong = right.slice();
      oneWrong[pos] = right[(pos + 1) % 12];
      const t = fill(s0, oneWrong);
      check(`pattern ${p} seed ${seed}: one wrong match at ${pos} disagrees`,
        C.allAnswered(t) && !C.patternsAgree(t));
    }
    const early = C.start({ pattern: p, seed });
    equal("pattern mode is refused while gaps remain", C.setMode(early, "pattern"), early);
  }
}

/* ------------------- 6. all transpositions of the intended assignment */

for (let p = 0; p < C.NPERMS; p++) {
  const s0 = C.start({ pattern: p, seed: 11 });
  const right = s0.problems.map((x) => x.answer);
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      const swapped = right.slice();
      [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
      const s = fill(s0, swapped);
      check(`pattern ${p}: swapping problems ${i} and ${j} breaks the agreement`,
        C.allAnswered(s) && !C.patternsAgree(s));
    }
  }
}

/* ----------------------------- 7. the page's claim and the record position */

for (let p = 0; p < C.NPERMS; p++) {
  for (const seed of SEEDS) {
    const s = C.start({ pattern: p, seed });
    check(`pattern ${p} seed ${seed}: a needed tile is always there until an earlier match is wrong`,
      s.problems.every((x) => s.tiles.some((t) => t.show && t.value === x.answer)));
    const rec = C.snapshot(C.setMode(fill(s, s.problems.map((x) => x.answer)), "pattern"));
    check(`pattern ${p} seed ${seed}: the saved position is plain data`,
      JSON.stringify(rec) === JSON.stringify(JSON.parse(JSON.stringify(rec))) &&
      rec.intended.length === 12 && rec.keys.length === 12 && rec.mode === "pattern");
  }
}

{
  let s = C.start({ pattern: 4, seed: 9 });
  const t = C.restart(s);
  check("Reset picks a different shuffle", t.pattern !== s.pattern);
  check("Reset advances the seed", t.seed === s.seed + 1);
  check("Reset clears every answer", t.answers.every((a) => a === null));
  const picks = new Set();
  for (let i = 0; i < 300; i++) picks.add(C.randomPattern(6));
  check("Reset never repeats the previous shuffle", !picks.has(6) && picks.size > 5);
  check("start is deterministic for a seed",
    JSON.stringify(C.start({ pattern: 4, seed: 9 })) === JSON.stringify(C.start({ pattern: 4, seed: 9 })));
}

done("very-tiles");
