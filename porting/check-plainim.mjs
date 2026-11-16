#!/usr/bin/env node
"use strict";

/*
 * Logic test for plainim/plainim-core.js.
 *
 *   node porting/check-plainim.mjs
 *
 * Checks the move rules against the applet's MakeMove test, that every legal
 * move lowers its heap (Nim equivalence), that MakeRightMove matches a second
 * transcription of the bytecode over every small position, and that a legal
 * move to an empty board ends the game with the right winner in both normal
 * and misère play.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("plainim/plainim-core.js", "PlainimCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ cols: 5, rows: 3, heaps: [0b10101, 0b01010, 0b00100] });
  check("a new game is not over", C.result(s) === null);
  check("nim-sum of the fixed start", C.nimSum(s) === (0b10101 ^ 0b01010 ^ 0b00100));
  check("cols and rows clamped", C.start({ cols: 1, rows: 99 }).cols === 3 && C.start({ cols: 1, rows: 99 }).rows === 12);
}

{
  // Toggle must stay in one row; leftmost selection must remove a chip.
  // On 4 columns, bitForCol(col) is 8,4,2,1 — heap 0b1100 = cols 0 and 1.
  let s = C.start({ cols: 4, rows: 2, heaps: [0b1100, 0b0010] });
  s = C.toggle(s, 0, 0); // select leftmost chip
  check("selecting a chip sets the row", s.selectedRow === 0 && C.isLegalSelection(s));
  s = C.toggle(s, 1, 0);
  check("a second row is refused", s.announce === "Selections must be in a single row!" && s.selectedRow === 0);

  s = C.start({ cols: 4, rows: 2, heaps: [0b1000, 0] });
  s = C.toggle(s, 0, 1); // empty cell only — leftmost selection has no chip
  check("add-only selection is illegal", C.isLegalSelection(s) === false);
  const bad = C.makeMove(s);
  check("Make Move rejects an add-only mask", bad.ok === false && /can't/i.test(bad.state.announce));
}

{
  // Legal: remove leftmost chip of the selection; may add to its right.
  let s = C.start({ cols: 4, rows: 2, heaps: [0b1000, 0] }); // only col 0 of row 0
  s = C.toggle(s, 0, 0); // remove
  s = C.toggle(s, 0, 3); // add at rightmost
  check("remove-left add-right is legal", C.isLegalSelection(s));
  const ok = C.makeMove(s);
  check("after the move the heap is 0b0001", ok.ok && ok.state.heaps[0] === 0b0001);
  check("a legal move lowers the heap", 0b0001 < 0b1000);
}

{
  // Taking the last chip wins (normal) / loses (misère). Rows min is 2, so
  // the second heap stays empty.
  let s = C.start({ cols: 3, rows: 2, heaps: [0b001, 0], misere: false });
  s = C.toggle(s, 0, 2);
  const win = C.makeMove(s);
  check("normal: taking the last chip wins", win.ok && win.state.over && C.result(win.state) === "win");

  s = C.start({ cols: 3, rows: 2, heaps: [0b001, 0], misere: true, wins: 0, losses: 0 });
  s = C.toggle(s, 0, 2);
  const lose = C.makeMove(s);
  check("misère: taking the last chip loses", lose.ok && lose.state.over && C.result(lose.state) === "lose");
}

/* ------------------------------------------- 2. every case, where it is small */

{
  // Every legal mask strictly lowers its heap (binary Nim reading).
  let nLegal = 0;
  for (let cols = 3; cols <= 6; cols++) {
    const limit = C.maxHeap(cols);
    for (let heap = 0; heap <= limit; heap++) {
      for (let mask = 1; mask <= limit; mask++) {
        if (!C.isLegalMask(heap, cols, mask)) continue;
        nLegal++;
        const next = heap ^ mask;
        check("legal move lowers heap " + heap + " ^ " + mask, next < heap);
      }
    }
  }
  check("found many legal masks on small boards", nLegal > 100);
}

{
  // From any heaps of width ≤ 4 and ≤ 3 rows, a non-zero nim-sum has a
  // move to nim-sum 0, and MakeRightMove finds one (normal play).
  let positions = 0;
  for (let cols = 3; cols <= 4; cols++) {
    const limit = C.maxHeap(cols);
    for (let a = 0; a <= limit; a++) {
      for (let b = 0; b <= limit; b++) {
        for (let c = 0; c <= (cols === 3 ? limit : 0); c++) {
          const heaps = cols === 3 ? [a, b, c] : [a, b];
          const rows = heaps.length;
          if (heaps.every((h) => h === 0)) continue;
          const s = C.start({ cols, rows, heaps, misere: false });
          const sum = C.nimSum(s);
          positions++;
          if (sum === 0) {
            check("P-position has no winning move", C.winningMoves(s).length === 0);
          } else {
            const wins = C.winningMoves(s);
            check("N-position has a move to nim-sum 0", wins.length > 0);
            const pick = C.chooseComputerMove(s, () => 0);
            const after = s.heaps.slice();
            after[pick.row] ^= pick.mask;
            const x = after.reduce((p, h) => p ^ h, 0);
            check("MakeRightMove leaves nim-sum 0", x === 0);
          }
        }
      }
    }
  }
  check("walked many small positions", positions > 200);
}

{
  // Random start heaps always fit and are non-empty.
  for (let i = 0; i < 40; i++) {
    const s = C.start({ cols: 5, rows: 4 }, () => i / 40);
    check("random heaps in 1.." + C.maxHeap(5), s.heaps.every((h) => h >= 1 && h <= C.maxHeap(5)));
  }
}

/* ----------------------------- 3. the same answers as the applet's own method */

{
  // Second transcription of MakeRightMove / MakeRandomMove / misère endgame.
  function appletRight(heaps, sum) {
    let best = 0;
    let row = 0;
    for (let r = 0; r < heaps.length; r++) {
      const v = heaps[r] & sum;
      if (best < v) {
        best = v;
        row = r;
      }
    }
    return { row, mask: sum };
  }

  function appletRandom(heaps, cols, rnd) {
    let row = -1;
    for (let r = 0; r < heaps.length; r++) {
      if (heaps[r] !== 0) {
        row = r;
        break;
      }
    }
    let mask = 0;
    for (let col = 0; col < cols; col++) {
      const bit = C.bitForCol(cols, col);
      if (heaps[row] & bit) {
        mask = bit;
        break;
      }
    }
    mask = mask + Math.trunc(rnd() * mask);
    return { row, mask };
  }

  function appletMyMove(heaps, cols, misere, rnd) {
    let sum = 0;
    for (const h of heaps) sum ^= h;
    if (misere) {
      let ones = 0;
      let zeros = 0;
      for (const h of heaps) {
        if (h === 1) ones++;
        else if (h === 0) zeros++;
      }
      if (ones === heaps.length - 1 - zeros) {
        let row = -1;
        let mask = 0;
        for (let r = 0; r < heaps.length; r++) {
          if (heaps[r] > 1) {
            row = r;
            mask = ones % 2 !== 0 ? heaps[r] ^ 1 : heaps[r];
          }
        }
        if (row >= 0) return { row, mask };
      }
      if (sum !== 0) return appletRight(heaps, sum);
      return appletRandom(heaps, cols, rnd);
    }
    if (sum !== 0) return appletRight(heaps, sum);
    return appletRandom(heaps, cols, rnd);
  }

  let compared = 0;
  for (let cols = 3; cols <= 5; cols++) {
    const limit = Math.min(C.maxHeap(cols), 15);
    for (let a = 0; a <= limit; a++) {
      for (let b = 0; b <= limit; b++) {
        if (a === 0 && b === 0) continue;
        for (const misere of [false, true]) {
          const heaps = [a, b];
          const s = C.start({ cols, rows: 2, heaps, misere });
          const rnd = () => 0.3;
          const core = C.chooseComputerMove(s, rnd);
          const ref = appletMyMove(heaps, cols, misere, rnd);
          check(
            "core matches applet MyMove " + heaps + " misere=" + misere,
            core.row === ref.row && core.mask === ref.mask,
          );
          compared++;
        }
      }
    }
  }
  check("compared MyMove on many boards", compared > 100);
}

{
  // Computer taking the last chip: normal win, misère loss.
  let s = C.start({ cols: 3, rows: 2, heaps: [0b001, 0], misere: false });
  s = Object.assign({}, s, { turn: "computer" });
  const cwin = C.computerMove(s, () => 0);
  check("computer takes last chip and wins (normal)", cwin.over && C.result(cwin) === "lose");

  s = C.start({ cols: 3, rows: 2, heaps: [0b001, 0], misere: true });
  s = Object.assign({}, s, { turn: "computer" });
  const close = C.computerMove(s, () => 0);
  check("computer takes last chip and loses (misère)", close.over && C.result(close) === "win");
}

done("plainim");
