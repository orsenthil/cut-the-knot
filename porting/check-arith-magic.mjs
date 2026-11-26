#!/usr/bin/env node
"use strict";

/*
 * Logic test for arith-magic/arith-magic-core.js.
 *
 *   node porting/check-arith-magic.mjs
 *
 * 1. The board, sizes, limits and messages match ArithMagicCanvas.SetData and
 *    GetResult. ArithMagicCanvas' own methods are transcribed a second time
 *    (with occupied pairs [column, row], as in the bytecode) and compared with
 *    the core on every control value at every limit, for both operations and
 *    all sizes 2..10.
 * 2. CTKNumberLim.UpdateSlow/UpdateFast are transcribed from their bytecode
 *    and compared with the core over the whole -100..100 and 1..20 ranges.
 * 3. The page's claim is checked as a claim: every permutation (one square in
 *    every row and column) for sizes 2..7, twice for each operation, has the
 *    same total, equal to the sum/product of the controls. Picking two squares
 *    in one row does NOT keep the total, so the page's rule matters.
 * 4. The demo's "done" mark, Clear/Reset/options and plain-data position.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("arith-magic/arith-magic-core.js", "ArithMagicCore");

/* ---------------------------- the applet's own methods, transcribed twice */

// ArithMagicCanvas.SetData(): initial row (m_V) and column (m_H) values.
function appletStartValue(operation, which, random) {
  if (operation === "sum") {
    return which === "row" ? Math.floor(random() * 25) + 1 : Math.floor(random() * 19);
  }
  return Math.floor(random() * 19) + 1;
}

// ArithMagicCanvas.Draw(): the number in each square.
function appletCell(v, h, r, c, operation) {
  return operation === "product" ? v[r] * h[c] : v[r] + h[c];
}

// ArithMagicCanvas.GetResult(): occupied pairs are [column, row] and the
// applet reads V[pair[1]] and H[pair[0]], i.e. the clicked square's value.
function appletGetResult(v, h, occupied, operation) {
  if (occupied.length === 0) return null;
  let total = operation === "product" ? 1 : 0;
  for (const pair of occupied) {
    const term = appletCell(v, h, pair[1], pair[0], operation);
    if (operation === "product") total *= term;
    else total += term;
  }
  return (operation === "product" ? "Product so far:" : "Sum so far:") + total;
}

// CTKNumberLim.UpdateSlow() and UpdateFast(), straight from the bytecode.
function appletStep(value, operation, which, dir, fast) {
  const [min, max] = C.LIMITS[operation][which];
  const incr = C.LIMITS[operation][which === "row" ? "rowStep" : "colStep"];
  if (fast) {
    if (dir > 0 && value < max - incr + 1) return value + incr;
    if (dir < 0 && value > min + incr - 1) return value - incr;
    return value;
  }
  if (dir > 0 && value < max) return value + 1;
  if (dir < 0 && value > min) return value - 1;
  return value;
}

/** Every permutation of 0..n-1, i.e. every legal one-per-row/column choice. */
function* permutations(n) {
  const used = new Array(n).fill(false);
  const row = [];
  function* walk() {
    if (row.length === n) { yield row.slice(); return; }
    for (let c = 0; c < n; c++) {
      if (used[c]) continue;
      used[c] = true;
      row.push(c);
      yield* walk();
      row.pop();
      used[c] = false;
    }
  }
  yield* walk();
}

const sameTotal = (a, b) =>
  a === b || (Number.isFinite(a) && Number.isFinite(b) &&
    Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)));

/* ------------------------------------------ 1. the start, sizes and limits */

{
  const s = C.start();
  equal("default size follows the applet's NUM", s.size, 5);
  equal("default operation is addition", s.operation, "sum");
  equal("a new board has no crosses", s.selected, []);
  check("a new board is not revealed", C.result(s) === null);
  equal("no result line before the first pick", C.resultMessage(s), "");
  equal("running total is null before the first pick", C.runningTotal(s), null);
  for (let size = C.MIN_SIZE; size <= C.MAX_SIZE; size++) {
    const p = C.start({ size, rng: rng(size) });
    check(`size ${size} has ${size} row and ${size} column controls`,
      p.v.length === size && p.h.length === size && p.selected.length === 0);
    check(`size ${size}: start values are inside the applet's limits`,
      p.v.every((v) => v >= 1 && v <= 25) && p.h.every((h) => h >= 0 && h <= 18));
  }
  equal("size below the spinner's minimum is clamped", C.start({ size: 1 }).size, 2);
  equal("size above the spinner's maximum is clamped", C.start({ size: 99 }).size, 10);
  equal("a missing size falls back to NUM", C.start({ size: "?" }).size, 5);
  equal("the x checkbox selects products", C.start({ operation: "product" }).operation, "product");
  for (let size = 2; size <= 10; size++) {
    const p = C.start({ size, operation: "product", rng: rng(100 + size) });
    check(`product size ${size}: controls start in 1..19`,
      p.v.every((v) => v >= 1 && v <= 19) && p.h.every((h) => h >= 1 && h <= 19));
  }
}

/* ------------------- 2. the same starts and cell values as the bytecode */

{
  for (const operation of ["sum", "product"]) {
    for (let size = 2; size <= 10; size++) {
      const a = rng(5000 + size * 7 + (operation === "sum" ? 0 : 1));
      const b = rng(5000 + size * 7 + (operation === "sum" ? 0 : 1));
      const s = C.start({ size, operation, rng: a });
      const wantV = [], wantH = [];
      for (let i = 0; i < size; i++) {
        wantV.push(appletStartValue(operation, "row", b));
        wantH.push(appletStartValue(operation, "col", b));
      }
      equal(`${operation} ${size}x${size}: row controls match SetData`, s.v, wantV);
      equal(`${operation} ${size}x${size}: column controls match SetData`, s.h, wantH);
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          check(`${operation} ${size}: square ${r},${c} matches Draw`,
            C.cellValue(s, r, c) === appletCell(wantV, wantH, r, c, operation));
        }
      }
    }
  }
}

/* ------------------- 3. every control value against UpdateSlow/UpdateFast */

{
  const edgeValues = {
    sum: [-100, -99, -11, -10, -9, -5, 0, 5, 9, 10, 11, 95, 99, 100],
    product: [1, 2, 3, 4, 18, 19, 20],
  };
  for (const operation of ["sum", "product"]) {
    const [min, max] = C.LIMITS[operation].row;
    const all = [];
    for (let v = min; v <= max; v++) all.push(v); // whole input range
    for (const which of ["row", "col"]) {
      for (const value of all) {
        for (const dir of [-1, 1]) {
          for (const fast of [false, true]) {
            const s = C.start({ size: 2, operation, rng: rng(1) });
            s.v[0] = value; s.h[0] = value;
            const next = C.stepControl(s, which, 0, dir, fast);
            const got = which === "row" ? next.v[0] : next.h[0];
            check(`${operation} ${which} ${value} dir ${dir} fast ${fast}`,
              got === appletStep(value, operation, which, dir, fast),
              `applet says ${appletStep(value, operation, which, dir, fast)}, core says ${got}`);
          }
        }
      }
      for (const value of edgeValues[operation]) {
        check(`${operation} ${which}: ${value} is inside the limits`, value >= min && value <= max);
      }
    }
  }
  check("the slow sum-row step is one, as in UpdateSlow",
    C.stepControl({ size: 2, operation: "sum", v: [0, 0], h: [0, 0], selected: [] }, "row", 0, 1).v[0] === 1);
  const fast = { size: 2, operation: "sum", v: [0, 0], h: [0, 0], selected: [] };
  check("the fast sum-row step is ten, as in UpdateFast",
    C.stepControl(fast, "row", 0, 1, true).v[0] === 10);
  check("the fast sum-column step is five",
    C.stepControl(fast, "col", 0, 1, true).h[0] === 5);
  check("an out-of-range control press is refused", C.stepControl(fast, "col", 2, 1) === fast);
  check("a control with no direction is refused", C.stepControl(fast, "row", 0, 0) === fast);
}

/* --------------------- 4. GetResult: transcribe and compare every pick */

{
  const picks = [
    [[0, 0]], [[0, 1], [1, 0]], [[0, 0], [0, 1]], // the last one breaks the rule
    [[1, 1], [0, 1], [1, 0]], [[0, 0], [1, 1], [0, 1]],
  ];
  for (const operation of ["sum", "product"]) {
    const values = operation === "sum"
      ? [-100, -10, 0, 1, 5, 25, 100]
      : [1, 2, 3, 10, 19, 20];
    let n = 0;
    for (const a of values) {
      for (const b of values) {
        const s = C.start({ size: 2, operation, rng: rng(1) });
        s.v = [a, b]; s.h = [b, a];
        for (const cells of picks) {
          let p = s;
          for (const [r, c] of cells) p = C.toggle(p, r, c);
          // The applet stores [column, row]; reverse each pair here.
          const occupied = cells.map(([r, c]) => [c, r]);
          check(`${operation} v=${a},h=${b}, pick ${JSON.stringify(cells)}: GetResult`,
            C.resultMessage(p) === appletGetResult(s.v, s.h, occupied, operation),
            `core ${C.resultMessage(p)}, applet ${appletGetResult(s.v, s.h, occupied, operation)}`);
          n++;
        }
      }
    }
    check(`${operation}: ${n} GetResult comparisons ran`, n >= 100);
  }
  const demo = { size: 2, operation: "sum", v: [1, 2], h: [3, 4], selected: [] };
  equal("an exact Sum so far line", C.resultMessage(C.toggle(C.toggle(demo, 0, 1), 1, 0)), "Sum so far:10");
  const prod = { size: 2, operation: "product", v: [2, 3], h: [4, 5], selected: [] };
  equal("an exact Product so far line", C.resultMessage(C.toggle(prod, 0, 0)), "Product so far:8");
}

/* ------------------ 5. the page's claim: every one-per-row/column choice */

{
  let permutationsChecked = 0;
  for (let size = 2; size <= 7; size++) {
    for (const operation of ["sum", "product"]) {
      // Two boards per size: ordinary random controls and controls at their
      // extremes, where the products are large.
      for (const extreme of [false, true]) {
        const s = C.start({ size, operation, rng: rng(size * 31 + (operation === "sum" ? 0 : 1)) });
        if (extreme) {
          const hi = operation === "sum" ? 100 : 20;
          s.v = new Array(size).fill(hi);
          s.h = new Array(size).fill(1);
        }
        const fixed = C.predictedTotal(s);
        let firstTotal = null;
        let count = 0;
        for (const perm of permutations(size)) {
          let p = s;
          for (let r = 0; r < size; r++) p = C.toggle(p, r, perm[r]);
          const total = C.runningTotal(p);
          check(`${operation} ${size}x${size}${extreme ? " extremes" : ""}: permutation ${perm.join("")} is revealed`,
            C.result(p) === "done" && C.isFull(p) && C.isTransversal(p));
          check(`${operation} ${size}x${size}${extreme ? " extremes" : ""}: permutation ${perm.join("")} keeps the total`,
            sameTotal(total, fixed), `${total} vs ${fixed}`);
          if (firstTotal === null) firstTotal = total;
          else check(`${operation} ${size}x${size}: permutation ${perm.join("")} equals the first`, sameTotal(total, firstTotal));
          // The applet's own transcription must agree on each selected square.
          equal(`${operation} ${size}x${size}: permutation ${perm.join("")} matches GetResult`,
            C.resultMessage(p),
            appletGetResult(s.v, s.h, perm.map((c, r) => [c, r]), operation));
          count++;
        }
        check(`${operation} ${size}x${size}: all ${size}! = ${count} choices were walked`,
          count === Array.from({ length: size }, (_, i) => i + 1).reduce((a, b) => a * b, 1));
        permutationsChecked += count;
      }
    }
  }
  const expectedPermutations = 2 * 2 * Array.from({ length: 6 }, (_, i) => {
    let f = 1;
    for (let k = 2; k <= i + 2; k++) f *= k;
    return f;
  }).reduce((a, b) => a + b, 0);
  check(`exhaustive check walked ${permutationsChecked} transversals`, permutationsChecked === expectedPermutations);

  // The page says one square per row AND column. Two in one row is not a
  // transversal and does change the total, even with N squares selected.
  const s = C.start({ size: 3, operation: "sum", rng: rng(7) });
  let sameRow = s;
  for (const [r, c] of [[0, 0], [0, 1], [1, 2]]) sameRow = C.toggle(sameRow, r, c);
  check("N squares in the wrong rows light the applet's faces but are not the trick",
    C.isFull(sameRow) && C.result(sameRow) === null && !C.isTransversal(sameRow));
  check("two squares in one row change the sum", C.runningTotal(sameRow) !== C.predictedTotal(sameRow));
  let transversal = s;
  for (const [r, c] of [[0, 0], [1, 1], [2, 2]]) transversal = C.toggle(transversal, r, c);
  check("the diagonal is a transversal and is done", C.isTransversal(transversal) && C.result(transversal) === "done");
}

/* ------------------------- 6. clicks, options and the plain-data position */

{
  const s = C.start({ size: 4, operation: "sum", rng: rng(42) });
  const once = C.toggle(s, 1, 2);
  equal("a click selects exactly one square", once.selected, [[1, 2]]);
  check("the first click is on", C.isSelected(once, 1, 2));
  equal("a second click on the same square takes it away", C.toggle(once, 1, 2).selected, []);
  check("a third square in the same row is still allowed by the applet",
    !C.isTransversal(C.toggle(C.toggle(s, 0, 0), 0, 1)));
  check("clicks outside the board are refused", C.toggle(s, -1, 0) === s && C.toggle(s, 0, 4) === s);
  check("the starting position is not mutated by a click", s.selected.length === 0 && once.selected.length === 1);
  equal("Clear empties the crosses but keeps the numbers",
    C.clear(once).v, s.v);
  equal("Clear leaves an empty board unchanged", C.clear(s), s);
  equal("a new size rebuilds the board with that size", C.setSize(once, 8).size, 8);
  equal("a new size clears the crosses", C.setSize(once, 8).selected, []);
  equal("the operation switch keeps the size", C.setOperation(once, "product").size, 4);
  equal("the operation switch clears the crosses", C.setOperation(once, "product").selected, []);
  check("every legal move is accepted", C.legalMoves(s).every((m) => C.move(s, m) !== null));
  check("a move of an unknown type is refused", C.move(s, { type: "nonsense" }) === null);
  equal("the position survives a JSON round trip", JSON.parse(JSON.stringify(once)), once);
  const before = JSON.stringify(once);
  for (const m of C.legalMoves(once)) C.move(once, m);
  equal("no move mutates the position it was given", JSON.stringify(once), before);
  check("a control step changes only that control", (() => {
    const next = C.stepControl(once, "col", 1, 1);
    return next.h[1] === once.h[1] + 1 &&
      next.v.join() === once.v.join() &&
      next.h.every((v, i) => i === 1 || v === once.h[i]);
  })());
}

done("arith-magic");
