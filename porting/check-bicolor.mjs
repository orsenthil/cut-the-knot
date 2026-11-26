#!/usr/bin/env node
"use strict";

/*
 * Logic test for bicolor/bicolor-core.js.
 *
 *   node porting/check-bicolor.mjs
 *
 * The applet has no options except a four-item operation Choice and three
 * randomly chosen starting patterns over four bit positions. All of that is
 * small enough to check exhaustively: every (pattern, bit, variant) start, every
 * operation on every pair of square values, the page's truth tables and its two
 * worked claims (13 & 6 = 4 and a ^ b ^ b = a), and thousands of random drag
 * sequences. Section 3 re-derives the applet's computation from javap output as
 * an independent bit-by-bit implementation and compares it with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bicolor/bicolor-core.js", "BicolorCore");
const N = C.N;

/* ------------------------------------------------- independent transcription */

/* javap SelectThreePure: values[i] = (int)Math.pow(2,i) except at bit k. */
function bytecodePure(k) {
  const v = new Array(N).fill(-1);
  for (let i = 0; i < 4; i++) {
    if (i === k) continue;                 // if_icmpeq 126
    v[i] = Math.floor(Math.pow(2, i));     // d2i, iastore
  }
  return v;
}

/* javap SelectThree branches 0 (up), 1 (down) and 2 (accumulate), offsets
 * 52/135/217. In the first assignment `dup_x2; iastore; istore_2` stores
 * both values[p]=p and t=p; the mixed branch stores t=p+t instead of -1. */
function bytecodeThree(k, variant) {
  const v = new Array(N).fill(-1);
  let t = -1;
  const positions = variant === 1 ? [3, 2, 1, 0] : [0, 1, 2, 3];
  for (const i of positions) {
    if (i === k) continue;
    const p = Math.floor(Math.pow(2, i));
    if (t === -1) {
      v[p] = p;
      t = p;
    } else {
      const pPlusT = p + t;                // p, t, iadd; p, t, iadd; iastore
      v[pPlusT] = pPlusT;
      t = variant === 2 ? pPlusT : -1;
    }
  }
  return v;
}

/* javap SelectTwo offsets 128/155/182: three distinct powers p1,p2,p3 and
 * two of the three pairwise sums, written at their own indices. */
function bytecodeTwo(k, variant) {
  const v = new Array(N).fill(-1);
  const p = [];
  for (let i = 0; i < 4; i++) {
    if (i === k) continue;
    p.push(Math.floor(Math.pow(2, i)));
  }
  const [a, b, c] = p;
  const pairs = [
    [[a + b, a + b], [a + c, a + c]],
    [[a + b, a + b], [b + c, b + c]],
    [[c + b, c + b], [a + c, a + c]],
  ];
  for (const [at, val] of pairs[variant]) v[at] = val;
  return v;
}

const bytecodeGenerate = (mode, k, variant) =>
  mode === 0 ? bytecodePure(k) : mode === 1 ? bytecodeThree(k, variant) : bytecodeTwo(k, variant);

/* The three Boolean truth tables, built from four single-bit values instead
 * of JavaScript's bitwise operators, so the check does not share the core's
 * computation. */
const bitsOf = (n) => [8, 4, 2, 1].map((b) => (n & b ? 1 : 0));
const fromBits = (xs) => xs.reduce((n, x, i) => n + (x ? [8, 4, 2, 1][i] : 0), 0);
const boolOp = (fn) => [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => [a, b, fromBits(bitsOf(a).map((x, i) => fn(x, bitsOf(b)[i])))]);

/* javap Execute: selected is the drop cell, arg1 the source, arg2 the target.
 * Each operation is applied one bit at a time by boolOp's table. */
function bytecodeExecute(values, op, selected, arg1, arg2) {
  const out = values.slice();
  if (selected === -1) return out;
  const a = out[arg1], b = out[arg2];
  if (op === 3) {
    out[selected] = N - 1 - a;             // N-1 - values[arg1], ignores arg2
    return out;
  }
  if (b === -1) { out[selected] = a; return out; } // the applet's copy branch
  const table = boolOp([(x, y) => x && y, (x, y) => x || y, (x, y) => x !== y][op]);
  out[selected] = fromBits(bitsOf(a).map((x, i) => table.find((row) => row[0] === x && row[1] === bitsOf(b)[i])[2]));
  return out;
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ rand: rng(1) });
  equal("a new puzzle has sixteen cells", s.values.length, 16);
  check("only -1 and 0..15 appear", s.values.every((v) => v === -1 || (v >= 0 && v < 16)));
  check("a puzzle starts with two or three coloured squares",
    [2, 3].includes(s.values.filter((v) => v !== -1).length));
  check("a fresh puzzle is not finished", C.result(s) === null && !C.isSolved(s));
  check("the four operations keep the applet's labels",
    JSON.stringify(C.OPS.map((o) => o.label)) ===
      JSON.stringify(["& (AND)", "V (OR)", "^ (XOR)", "~ (NOT)"]));
}

/* ------------------------------------------- 2. every start, every option */

{
  let starts = 0;
  for (let mode = 0; mode < 3; mode++) {
    for (let k = 0; k < 4; k++) {
      for (let variant = 0; variant < 3; variant++) {
        const got = C.generate(mode, k, variant);
        equal(`start ${mode}/${k}/${variant}`, got, bytecodeGenerate(mode, k, variant));
        check(`start ${mode}/${k}/${variant} has only valid values`,
          got.every((v) => v === -1 || (v >= 0 && v < 16)));
        // SelectThreePure writes 2^i at cell i; the other two patterns write
        // a number at the cell with that number's index (a partial solution).
        check(`start ${mode}/${k}/${variant} places its numbers as the applet does`,
          got.every((v, i) => v === -1 ||
            (mode === 0 ? v === Math.pow(2, i) : v === i)));
        starts++;
      }
    }
  }
  check("all 36 starting patterns were compared", starts === 36);
  check("every NewGame random choice is in range",
    [0, 1, 2].every((m) => [0, 1, 2, 3].every((k) => {
      const s = C.start({ rand: (() => { const q = [m / 3 + 0.01, k / 4 + 0.01, 0.01]; let i = 0; return () => q[i++]; })() });
      return s.mode === m && s.k === k && s.variant === 0;
    })));
  check("start copies neither its input nor its values between calls",
    C.start({ mode: 0, k: 1, variant: 0 }).values[1] === -1 &&
    C.start({ mode: 0, k: 0, variant: 0 }).values[1] === 2);
}

/* ------------------------------------------- the page's claims, exhaustively */

{
  const cl = C.claims();
  equal("AND truth table", cl.and, boolOp((a, b) => a && b));
  equal("OR truth table", cl.or, boolOp((a, b) => a || b));
  equal("XOR truth table", cl.xor, boolOp((a, b) => a !== b));
  check('the page claims "13 & 6 = 4", and it is true', cl.workedExample === 4);
  equal("13 in binary is 1101", C.binary(13), "1101");
  equal("6 in binary is 0110", C.binary(6), "0110");
  equal("4 in binary is 0100", C.binary(4), "0100");
  check('the page claims "a ^ b ^ b = a", true for all 256 pairs', cl.xorInvolution === true);
  check("the goal writes 0..15 left to right, top to bottom",
    cl.goal.every((v, i) => v === i && C.bits(v).length === 4));
  equal("bits of 5", C.bits(5), [0, 1, 0, 1]);
  check("all four bitwise claims hold", cl.and.length === 4 && cl.or.length === 4 &&
    cl.xor.length === 4 && cl.workedExample === 4 && cl.xorInvolution);
}

/* ---------------------------------------------- 3. Execute over every case */

{
  let cases = 0;
  for (let op = 0; op < 4; op++) {
    for (let source = 0; source < N; source++) {
      for (let target = 0; target < N; target++) {
        const before = new Array(N).fill(-1);
        before[source] = source;
        before[target] = target;           // same cell when source === target
        const state = { values: before, op, selected: target, arg1: source, arg2: target,
                        mode: 0, k: 0, variant: 0 };
        const got = C.execute(state).values;
        const want = bytecodeExecute(before, op, target, source, target);
        equal(`execute op${op} ${source}->${target}`, got, want);
        cases++;
      }
    }
  }
  check("all 1024 operation/value cases agree with the bytecode", cases === 1024);

  /* A drop onto a blank square: AND/OR/XOR copy, NOT flips the source. */
  for (const op of [0, 1, 2]) {
    const before = new Array(N).fill(-1);
    before[7] = 5;
    const s = { values: before, op, selected: 9, arg1: 7, arg2: 9, mode: 0, k: 0, variant: 0 };
    check(`op ${op} drops a coloured square onto a blank one as a copy`,
      C.execute(s).values[9] === 5);
  }
  const nots = { values: new Array(N).fill(-1), op: 3, selected: 9, arg1: 7, arg2: 9, mode: 0, k: 0, variant: 0 };
  nots.values[7] = 5;
  check("NOT ignores the target and gives 15 - source", C.execute(nots).values[9] === 10);
  check("execute leaves the source square alone", C.execute(nots).values[7] === 5);
}

/* ------------------------------------- 4. drags, clicks and finished states */

{
  const s = C.start({ mode: 0, k: 0, variant: 0, op: 2 });
  const before = s.values.slice();
  check("a blank source is only a click", C.drag(s, 0, 5).values.every((v, i) => v === before[i]));
  check("a click highlights the target", C.drag(s, 0, 5).selected === 5);
  const moved = C.drag(s, 1, 2);
  check("a real drag changes the target but not the source",
    moved.values[2] === (before[1] ^ before[2]) && moved.values[1] === before[1]);
  check("setOp only accepts the applet's four operations",
    [-1, 4, 99, 1.5].every((op) => C.setOp(s, op).op === s.op) && C.setOp(s, 3).op === 3);

  const solved = { values: Array.from({ length: N }, (_, i) => i), op: 0,
                   selected: -1, arg1: -1, arg2: -1, mode: 0, k: 0, variant: 0 };
  check("the exact goal counts as finished", C.isSolved(solved) && C.result(solved) === "done");
  check("there is no win or loss in this illustration", C.result(s) === null);
  let wrong = 0;
  for (let i = 0; i < N; i++) {
    const bad = { ...solved, values: solved.values.slice() };
    bad.values[i] = (i + 1) % N;
    if (C.isSolved(bad)) wrong++;
  }
  check("one wrong square is not finished, in any position", wrong === 0);
  check("correctCount and filledCount agree with the goal",
    C.correctCount(s) === s.values.filter((v, i) => v === i).length &&
    C.filledCount(s) === s.values.filter((v) => v !== -1).length);
}

/* ------------------------- 5. random games against the independent method */

{
  const rand = rng(20261126);
  let games = 0, moves = 0, mismatches = 0;
  for (let game = 0; game < 200; game++) {
    const mode = Math.floor(rand() * 3), k = Math.floor(rand() * 4), variant = Math.floor(rand() * 3);
    let state = C.start({ mode, k, variant, op: Math.floor(rand() * 4) });
    let want = state.values.slice();
    games++;
    for (let step = 0; step < 20; step++) {
      const source = Math.floor(rand() * N), target = Math.floor(rand() * N);
      const op = state.op;
      if (state.values[source] !== -1) {
        want = bytecodeExecute(want, op, target, source, target);
      }
      state = C.drag(state, source, target);
      moves++;
      if (JSON.stringify(state.values) !== JSON.stringify(want)) mismatches++;
      if (rand() < 0.2) state = C.setOp(state, Math.floor(rand() * 4));
    }
  }
  check("200 random games x 20 drags match the bytecode method", games === 200 && moves === 4000);
  check("no random drag disagreed with the applet's computation", mismatches === 0);
}

/* ----------------------------------------- 6. the applet's own colour table */

{
  check("sixteen fixed colours, one per B4 tuple", C.COLORS.length === 16);
  equal("colour 13 from the applet constructor", C.COLORS[13], [255, 127, 255]);
  equal("text colour 13 from the applet constructor", C.INK[13], [0, 127, 0]);
  equal("colour 15 is white in the applet", C.COLORS[15], [255, 255, 255]);
  equal("colour 0 is black in the applet", C.COLORS[0], [0, 0, 0]);
}

done("bicolor");
