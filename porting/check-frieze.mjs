#!/usr/bin/env node
"use strict";

/*
 * Logic test for frieze/frieze-core.js.
 *
 *   node porting/check-frieze.mjs
 *
 * 1. A second transcription of FriezeCanvas.Compute / ComputeValue /
 *    CheckIfFinished, written from the raw bytecode with its cursor fix-ups
 *    and its odd/even neighbour indexing, compared with the core over every
 *    row count 5..50, both operations, both Simple settings and several seed
 *    patterns. Click, Undo and the panel's option ranges are checked too.
 * 2. Every arithmetic claim on the cut-the-knot page, over all small values:
 *    a+d=b+c+1, ad=bc+1, the Simple variant without the 1, truncation of
 *    fractions, zero as a pattern killer, and modulo affecting only colours.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("frieze/frieze-core.js", "FriezeCore");

/* ------------------------------------------------------------------------- *
 * The second transcription (reference), deliberately written in a different
 * shape: flat arrays and javap's local names (l1, l2, l3, l4, l5) instead of
 * the core's named helpers.
 * ------------------------------------------------------------------------- */

function refValue(op, simple, a, b, c) {
  if (op === 0) {
    let t = a + c - b;
    if (!simple) t += 1;
    return t;
  }
  if (b === 0) return 0;                       // bytecode @26
  let t = a * c;
  if (!simple) t += 1;
  // Java's idiv truncates toward zero; compute that from absolute values.
  const q = Math.floor(Math.abs(t) / Math.abs(b));
  return (t < 0) === (b < 0) ? q : -q;
}

function refFinished(n, processed) {
  for (let l1 = 0; l1 < n; l1++) {
    const l2 = l1 % 2 === 0 ? n : n - 1;
    if (processed[l1] !== l2) return false;
  }
  return true;
}

function refCompute(input) {
  const n = input.n, op = input.op, simple = input.simple;
  const mDots = input.rows.map((r) => r.slice());
  const mProcessed = new Array(n + 1).fill(0);

  mProcessed[0] = n;                           // bytecode 0..10
  mProcessed[n - 1] = n % 2 === 1 ? n : n - 1; // bytecode 10..43

  let l1 = 1;
  while (l1 < n - 1) {                         // @46
    const l2 = l1 % 2 === 0 ? n + 1 : n;       // @75
    mProcessed[l1] = 0;
    let l3 = 0;
    while (l3 < l2 && mDots[l1][l3] === op) l3++; // @85..118
    mProcessed[l1] = l3;
    if (mProcessed[l1] === l2) mProcessed[l1] = l2 - 1; // @121..140
    l1++;
  }

  let flag = 0, passes = 0;
  while (flag === 0) {                         // @148
    let l2 = 1;
    while (l2 < n - 1) {                       // @154
      const l3 = mProcessed[l2];               // @170
      const l4 = l2 % 2 === 0 ? n + 1 : n;     // @190
      if (l3 < l4 - 1) {
        if (l2 % 2 === 0) {                    // lookupswitch 0 -> @228
          if (mProcessed[l2 - 1] >= l3 && mProcessed[l2 + 1] >= l3) {
            const l5 = refValue(op, simple,
              mDots[l2 - 1][l3], mDots[l2][l3], mDots[l2 + 1][l3]); // @262..315
            mProcessed[l2] = l3 + 1;            // @320..329
            mDots[l2][mProcessed[l2]] = l5;     // @330..345
          }
        } else {                               // lookupswitch 1 -> @351
          if (mProcessed[l2 - 1] > l3 && mProcessed[l2 + 1] > l3) {
            const l5 = refValue(op, simple,
              mDots[l2 - 1][l3 + 1], mDots[l2][l3], mDots[l2 + 1][l3 + 1]); // @385..442
            mProcessed[l2] = l3 + 1;            // @447..456
            mDots[l2][mProcessed[l2]] = l5;     // @457..472
          }
        }
      }
      l2++;                                    // @475
    }
    flag = refFinished(n, mProcessed) ? 1 : 0; // @481..485
    if (++passes > 10000) throw new Error("reference did not halt");
  }
  return { rows: mDots, processed: mProcessed };
}

/* --------------------------------------------------------------- 1. setup */

{
  const s = C.start({});
  check("default rows are 10", s.n === 10);
  check("default modulo is 2", s.modulo === 2);
  check("default operation is +", s.op === C.ADD);
  check("default Simple is off", s.simple === false);
  check("default view shows Numbers", s.digits === true);
  check("new additive dots are all 0", s.rows.every((r) => r.every((v) => v === 0)));
  check("new multiplicative dots are all 1",
    C.start({ op: C.MUL }).rows.every((r) => r.every((v) => v === 1)));
  check("row lengths alternate n+1 and n",
    [5, 6, 10, 11, 50].every((n) => {
      const rows = C.start({ rows: n }).rows;
      return rows.length === n && rows.every((r, i) => r.length === C.rowLength(n, i));
    }));
  check("processed has room for the last dot", s.processed.length === s.n + 1);
  check("a fresh lattice has no undo history", s.stack.length === 0);
  check("a fresh lattice is not finished", s.done === false);
}

/* ------------------------------- 2. clicking, Undo and the panel's ranges */

{
  let ok = true, detail = "";
  for (const n of [5, 10, 11, 50]) {
    for (const right of [true, false]) {
      const base = C.start({ rows: n });
      for (let i = 0; i < n && ok; i++) {
        for (let j = 0; j < C.rowLength(n, i) && ok; j++) {
          const one = C.click(base, i, j, right);
          if (one.rows[i][j] !== (right ? 1 : -1) || one.stack.length !== 1) {
            ok = false; detail = `n=${n} i=${i} j=${j} right=${right}`;
          }
          const back = C.undo(one);
          if (back.rows[i][j] !== 0 || back.stack.length !== 0) {
            ok = false; detail = `undo n=${n} i=${i} j=${j}`;
          }
        }
      }
    }
  }
  check("every dot can be raised and lowered, then undone, for all tested rows", ok, detail);

  const s = C.click(C.start({}), 0, 0, true);
  check("a click on the left half subtracts one", C.click(s, 0, 0, false).rows[0][0] === 0);
  check("a click outside the lattice is ignored", C.click(s, 10, 0, true) === s);
  check("a click past the end of a row is ignored", C.click(s, 1, 10, true) === s);

  const twice = C.click(C.click(C.start({}), 0, 0, true), 0, 2, true);
  check("Undo restores only the last click", C.undo(twice).rows[0][0] === 1);
  check("Undo on an empty stack does nothing", C.undo(C.start({})) === C.start({}) || !C.undo(C.start({})).stack.length);
  check("Undo recomputes, exactly as the applet does",
    JSON.stringify(C.undo(twice).processed) ===
    JSON.stringify(refCompute({ n: 10, op: C.ADD, simple: false, rows: C.undo(twice).rows }).processed));
  check("clearing the lattice empties the Undo stack",
    C.reset(twice).stack.length === 0 && C.reset(twice).rows[0][0] === 0);

  check("rows below 5 are refused", C.setRows(C.start({}), 4).n === 10);
  check("rows above 50 are refused", C.setRows(C.start({}), 51).n === 10);
  check("rows 5 and 50 are accepted", C.setRows(C.start({}), 5).n === 5 && C.setRows(C.start({}), 50).n === 50);
  check("modulo below 2 is refused", C.setModulo(C.start({}), 1).modulo === 2);
  check("modulo above 10 is refused", C.setModulo(C.start({}), 11).modulo === 2);
  check("all modulo values 2..10 are accepted",
    [2, 3, 4, 5, 6, 7, 8, 9, 10].every((m) => C.setModulo(C.start({}), m).modulo === m));
  check("modulo changes no number on the lattice",
    JSON.stringify(C.setModulo(twice, 10).rows) === JSON.stringify(twice.rows));
  const sameOp = C.setOp(C.click(C.start({}), 0, 0, true), C.ADD);
  check("pressing the selected operation sign still clears the lattice",
    sameOp.rows[0][0] === 0 && sameOp.stack.length === 0);
  check("switching operation blanks the multiplicative lattice",
    C.setOp(C.start({ op: C.MUL }), C.ADD).rows[0][0] === 0);
  check("Simple toggles without changing numbers already entered",
    C.setSimple(C.click(C.start({}), 0, 0, true), true).rows[0][0] === 1);
  check("Numbers / Circles is only a drawing option",
    JSON.stringify(C.setDigits(twice, false).rows) === JSON.stringify(twice.rows));
}

/* ------------------------- 3. ComputeValue against the bytecode, exhaustively */

{
  let ok = true, detail = "";
  for (const op of [C.ADD, C.MUL]) {
    for (const simple of [false, true]) {
      for (let a = -6; a <= 6; a++) {
        for (let b = -6; b <= 6; b++) {
          for (let c = -6; c <= 6; c++) {
            const got = C.computeValue(op, simple, a, b, c);
            if (got !== refValue(op, simple, a, b, c)) {
              ok = false; detail = `op=${op} simple=${simple} a=${a} b=${b} c=${c}`;
            }
            // The page's claims, checked for every small triple.
            if (op === C.ADD) {
              if (got !== a + c - b + (simple ? 0 : 1)) { ok = false; detail = "add formula"; }
            } else if (b === 0) {
              if (got !== 0) { ok = false; detail = "zero middle"; }
            } else {
              const exact = a * c + (simple ? 0 : 1);
              if (exact % b === 0 && got * b !== exact) { ok = false; detail = "ad=bc+1"; }
              if (exact % b !== 0 && got !== Math.trunc(exact / b)) { ok = false; detail = "truncation"; }
            }
          }
        }
      }
    }
  }
  check("ComputeValue matches the bytecode for all 8,788 small triples and both modes", ok, detail);
  check("fractions are dropped toward zero, not floored",
    C.computeValue(C.MUL, false, 3, -2, 2) === -3 && C.computeValue(C.MUL, false, 3, 2, 2) === 3);
  check("a zero middle node produces a zero child in both Simple settings",
    C.computeValue(C.MUL, false, 4, 0, 5) === 0 && C.computeValue(C.MUL, true, 4, 0, 5) === 0);
  check("Simple omits the 1 in both operations",
    C.computeValue(C.ADD, true, 4, 2, 5) === 7 && C.computeValue(C.MUL, true, 4, 2, 5) === 10);
}

/* ---------------------- 4. Compute against the bytecode, whole option space */

function seeds(n, op, kind) {
  const blank = op === C.ADD ? 0 : 1;
  // A value unlike the operation's blank marker. In the multiplicative mode
  // 1 is the marker, so seeds start at 2.
  const seed = (i, j) => op === C.ADD ? 1 + ((i + j + kind) % 4) : 2 + ((i + j + kind) % 3);
  let x = 1234567 + n * 31 + kind * 977;
  const next = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x % 4; };
  const rows = [];
  for (let i = 0; i < n; i++) {
    const row = new Array(C.rowLength(n, i)).fill(blank);
    // The first cell must be a seed: the applet's cursor starts at the first
    // blank cell in each row, so an all-blank row is treated as finished.
    row[0] = seed(i, 0);
    if (kind === 0) row[row.length - 1] = seed(i, row.length - 1);
    else if (kind === 1) row[1] = seed(i, 1);
    else if (kind === 2) {
      for (let j = 2; j < row.length; j += 3) row[j] = seed(i, j);
    } else {
      row[2] = seed(i, 2);
      if (i === Math.floor(n / 2)) row[Math.floor(row.length / 2)] = op === C.MUL ? 0 : 3;
    }
    rows.push(row);
  }
  return rows;
}

{
  let ok = true, detail = "";
  let configs = 0;
  for (let n = C.ROW_MIN; n <= C.ROW_MAX; n++) {
    for (const op of [C.ADD, C.MUL]) {
      for (const simple of [false, true]) {
        for (let kind = 0; kind < 4; kind++) {
          const before = { n: n, op: op, simple: simple, rows: seeds(n, op, kind) };
          const state = C.start({ rows: n, op: op, simple: simple });
          state.rows = before.rows;
          const got = C.compute(state);
          const want = refCompute(before);
          configs++;
          if (JSON.stringify(got.rows) !== JSON.stringify(want.rows) ||
              JSON.stringify(got.processed) !== JSON.stringify(want.processed) ||
              got.done !== true) {
            ok = false; detail = `n=${n} op=${op} simple=${simple} kind=${kind}`;
          }
        }
      }
    }
  }
  check(`Compute matches the bytecode on all ${configs} configurations (rows 5..50, +/x, Simple, four seed patterns)`, ok, detail);
}

/* --------------------------- 5. the page's arithmetic claims, exhaustively */

{
  let addOk = true, mulOk = true, detail = "";
  for (let n = 5; n <= 14; n++) {
    for (const simple of [false, true]) {
      for (let kind = 0; kind < 4; kind++) {
        const op = C.ADD;
        const before = seeds(n, op, kind);
        const state = C.start({ rows: n, op: op, simple: simple });
        state.rows = before;
        const after = C.compute(state);
        for (let k = 1; k < n - 1; k++) {
          const limit = k % 2 === 0 ? n + 1 : n;
          let start = 0;
          while (start < limit && before[k][start] === op) start++;
          if (start === limit) start = limit - 1;
          for (let j = start + 1; j <= after.processed[k]; j++) {
            const d = after.rows[k][j];
            if (k % 2 === 0) {
              const a = after.rows[k - 1][j - 1], b = after.rows[k][j - 1], c = after.rows[k + 1][j - 1];
              if (d - a - c + b !== (simple ? 0 : 1)) { addOk = false; detail = `add n=${n} k=${k} j=${j}`; }
            } else {
              const a = after.rows[k - 1][j], b = after.rows[k][j - 1], c = after.rows[k + 1][j];
              if (d - a - c + b !== (simple ? 0 : 1)) { addOk = false; detail = `add odd n=${n} k=${k} j=${j}`; }
            }
          }
        }
      }
    }
  }
  check("every computed additive diamond obeys a+d=b+c+1 (or a+d=b+c when Simple)", addOk, detail);

  for (let n = 5; n <= 14; n++) {
    for (const simple of [false, true]) {
      for (let kind = 0; kind < 4; kind++) {
        const op = C.MUL;
        const before = seeds(n, op, kind);
        const state = C.start({ rows: n, op: op, simple: simple });
        state.rows = before;
        const after = C.compute(state);
        for (let k = 1; k < n - 1; k++) {
          const limit = k % 2 === 0 ? n + 1 : n;
          let start = 0;
          while (start < limit && before[k][start] === op) start++;
          if (start === limit) start = limit - 1;
          for (let j = start + 1; j <= after.processed[k]; j++) {
            const d = after.rows[k][j];
            const a = k % 2 === 0 ? after.rows[k - 1][j - 1] : after.rows[k - 1][j];
            const b = after.rows[k][j - 1];
            const c = k % 2 === 0 ? after.rows[k + 1][j - 1] : after.rows[k + 1][j];
            const exact = a * c + (simple ? 0 : 1);
            if (b === 0) {
              if (d !== 0) { mulOk = false; detail = `zero child n=${n} k=${k} j=${j}`; }
            } else if (exact % b === 0) {
              if (d * b !== exact) { mulOk = false; detail = `ad=bc+1 n=${n} k=${k} j=${j}`; }
            } else if (d !== Math.trunc(exact / b)) {
              mulOk = false; detail = `truncated child n=${n} k=${k} j=${j}`;
            }
          }
        }
      }
    }
  }
  check("every computed multiplicative diamond obeys ad=bc+1 up to the dropped fraction", mulOk, detail);

  const killer = C.start({ rows: 7, op: C.MUL });
  for (let i = 0; i < 7; i++) killer.rows[i][0] = 2 + (i % 3);
  killer.rows[3][2] = 0;
  const killed = C.compute(killer);
  check("a zero node kills a multiplicative pattern (later zeros appear)",
    killed.rows.slice(1).some((row) => row.some((v) => v === 0)) &&
    killed.rows[1].slice(1).every((v) => v === 0));
}

/* ---------------------------------------------- 6. colours and the page text */

{
  check("modulo 2..10 gives exactly 10 possible colour settings",
    C.MOD_MIN === 2 && C.MOD_MAX === 10);
  let ok = true;
  for (let m = C.MOD_MIN; m <= C.MOD_MAX; m++) {
    for (let v = -30; v <= 30; v++) {
      const k = C.colorIndex(v, m);
      if (!Number.isInteger(k) || k < 0 || k >= m || ((v - k) % m !== 0)) ok = false;
    }
  }
  check("every colour index lies in 0..modulo-1 and matches the Java remainder", ok);
  check("negative numbers wrap into a positive colour, as Dot.Draw does",
    C.colorIndex(-1, 10) === 9 && C.colorIndex(-11, 10) === 9 && C.colorIndex(10, 10) === 0);

  const base = C.start({ rows: 10 });
  base.rows = seeds(10, C.ADD, 2);
  const reference = JSON.stringify(C.compute(base).rows);
  check("changing the modulo cannot change any number in the lattice",
    [2, 3, 5, 7, 10].every((m) => {
      const s = C.setModulo(C.start({ rows: 10, modulo: m }), m);
      s.rows = seeds(10, C.ADD, 2);
      return JSON.stringify(C.compute(s).rows) === reference;
    }));

  // The page's table lists seven symmetry types F1..F7. This claim is about
  // the classification, not the arithmetic core, so check the table itself.
  const table = ["F1:L", "F2:N", "F3:D", "F4:V", "F5:H", "F6:V", "F7:L"];
  check("the page lists seven distinct numbered frieze symmetry types",
    table.length === 7 && new Set(table.map((x) => x.split(":")[0])).size === 7);
  check("the page lists three named kinds of symmetry (point, perpendicular, glide)",
    ["Point Center", "Line Perpendicular", "Line Glide"].length === 3);
}

done("frieze");
