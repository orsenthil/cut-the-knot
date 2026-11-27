#!/usr/bin/env node
"use strict";

/*
 * Logic test for fifteen/fifteen-core.js.
 *
 *   node porting/check-fifteen.mjs
 *
 * Part 1 transcribes fifteengame.Shift()/Cheat()/Reshuffle() and Permutation's
 * cycle printer a second time, straight from the bytecode, and compares them
 * with the core over every board size 3..7, all three modes and every cell of
 * many positions (tens of thousands of clicks).
 *
 * Part 2 tests the page's claims: the 4x4 invariant "inversions + blank row is
 * even or odd forever", the disappearance of that invariant on odd boards,
 * Wilson's two components (exhaustive BFS on every 3x3 position), and the
 * Cylinder/Moebius remark (also exhaustive at 3x3, sampled at 5 and 7).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("fifteen/fifteen-core.js", "FifteenCore");

const flat = (grid, n) => {
  const a = [];
  for (let col = 0; col < n; col++) for (let row = 0; row < n; row++) a.push(grid[col][row]);
  return a;
};
const grid = (tiles, n) => {
  const g = [];
  for (let col = 0; col < n; col++) g.push(tiles.slice(col * n, (col + 1) * n));
  return g;
};
const key = (tiles) => tiles.join(",");

/* ------------------------------------------------ 1. the rules and options */

{
  const s = C.start({});
  equal("the default board is 4x4", [s.n, s.mode], [4, 0]);
  equal("fresh tiles are in order", s.tiles, Array.from({ length: 16 }, (_, k) => k + 1));
  equal("the blank starts bottom right", [Math.floor(C.blankIndex(s) / 4), C.blankIndex(s) % 4], [3, 3]);
  // The counters are numbered by columns in the applet, so a solved board has
  // inversions when read row by row; only their parity is invariant.
  equal("fresh inversions", C.inversions(s), 36);
  equal("fresh blank row", C.blankRow(s), 4);
  equal("fresh parity", C.parity(s), 0);
  check("a fresh board counts as finished", C.result(s) === "done");
  equal("fresh cycle notation", C.cycles(s), "(1)(2)(3)(4)(5)(6)(7)(8)(9)(10)(11)(12)(13)(14)(15)(b)");
  equal("sizes are clamped to 3..7", [C.options({ n: 2 }).n, C.options({ n: 8 }).n, C.options({ n: 5.9 }).n], [3, 7, 5]);
  equal("modes are clamped to 0..2", [C.options({ mode: -1 }).mode, C.options({ mode: 9 }).mode], [0, 2]);
  equal("every permitted size has the right tile count", [3, 4, 5, 6, 7].map((n) => C.start({ n }).tiles.length), [9, 16, 25, 36, 49]);
}

/* ------------------------------------------------------ 2. moves and edges */

{
  const s = C.start({});
  equal("a row click slides the whole run", C.move(s, 3).tiles,
    [1, 2, 3, 16, 5, 6, 7, 4, 9, 10, 11, 8, 13, 14, 15, 12]);
  equal("a column click slides the whole run", C.move(s, 14).tiles,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 15]);
  check("a vertical slide flips the inversion parity on a 4x4 board",
    C.inversions(C.move(s, 14)) % 2 === 1);
  check("a vertical slide flips the blank-row parity too",
    C.blankRow(C.move(s, 14)) === 3);
  check("the two flips cancel in N", C.parity(C.move(s, 14)) === C.parity(s));
  check("clicking the blank is not a move", C.move(s, 15) === null);
  check("clicking off the blank's row and column is not a move", C.move(s, 0) === null);
  check("a click outside the board is not a move", C.move(s, -1) === null && C.move(s, 16) === null);
  equal("the six legal first moves on a 4x4 board", C.legalMoves(s), [3, 7, 11, 12, 13, 14]);
  equal("the four legal first moves on a 3x3 board", C.legalMoves(C.start({ n: 3 })), [2, 5, 6, 7]);
  const five = C.start({ n: 5, mode: 2 });
  const fiveMoved = C.move(five, 0);
  equal("a move keeps the board size and mode", [fiveMoved.n, fiveMoved.mode], [5, 2]);
  check("an unreachable cell is refused", C.move(five, 5) === null);

  // The Moebius bytecode swaps the reflected column on a bottom-row click
  // without checking which column was clicked. Keep that quirk.
  let m = C.start({ n: 4, mode: 2 });
  m = C.move(m, 12); // put the blank on the top row, column 3
  equal("Moebius blank is on the top row", [Math.floor(C.blankIndex(m) / 4), C.blankIndex(m) % 4], [3, 0]);
  const a = C.move(m, 3); // bottom row, column 0 (the reflected column)
  const b = C.move(m, 11); // bottom row, column 2 (not the reflected column)
  check("Moebius does swap a counter on a bottom-row click", key(a.tiles) !== key(m.tiles));
  equal("Moebius ignores which bottom-row counter was clicked", b.tiles, a.tiles);
  equal("the swap uses the reflected column, not the clicked one",
    [m.tiles[3], m.tiles[12]], [a.tiles[12], a.tiles[3]]);
}

/* ------------------------------- 3. a second transcription of the bytecode */

/** fifteengame.Shift(), with values indexed values[col][row]. */
function appletShift(values, n, mode, click) {
  const sq = n * n;
  const gridValues = values.map((row) => row.slice());
  let found = true, blankCol = 0, blankRow = 0;
  for (let i = 0; found && i < n; i++) {
    for (let j = 0; found && j < n; j++) {
      if (gridValues[i][j] === sq) { blankCol = i; blankRow = j; found = false; }
    }
  }
  const swap = (a, b, c, d) => {
    const t = gridValues[a][b];
    gridValues[a][b] = gridValues[c][d];
    gridValues[c][d] = t;
  };
  const shiftLeft = (row, to, from) => {
    for (let k = from; k < to; k++) gridValues[k][row] = gridValues[k + 1][row];
    gridValues[to][row] = sq;
  };
  const shiftRight = (row, to, from) => {
    for (let k = from; k > to; k--) gridValues[k][row] = gridValues[k - 1][row];
    gridValues[to][row] = sq;
  };
  const shiftTop = (col, to, from) => {
    for (let k = from; k > to; k--) gridValues[col][k] = gridValues[col][k - 1];
    gridValues[col][to] = sq;
  };
  const shiftBottom = (col, to, from) => {
    for (let k = from; k < to; k++) gridValues[col][k] = gridValues[col][k + 1];
    gridValues[col][to] = sq;
  };
  const x = click.col, y = click.row;
  if (y === blankRow) {
    if (x > blankCol) shiftLeft(blankRow, x, blankCol);
    else if (x < blankCol) shiftRight(blankRow, x, blankCol);
  } else if (mode === 2 && x === n - blankCol - 1 && x !== blankCol &&
             y === 0 && blankRow === n - 1) {
    swap(n - blankCol - 1, 0, blankCol, n - 1);
  } else if (mode === 2 && y === n - 1 && blankRow === 0) {
    swap(n - blankCol - 1, n - 1, blankCol, 0);
  } else if (x === blankCol) {
    if (mode === 1 && y === 0 && blankRow === n - 1) swap(blankCol, 0, blankCol, n - 1);
    else if (mode === 1 && y === n - 1 && blankRow === 0) swap(blankCol, 0, blankCol, n - 1);
    else if (y < blankRow) shiftTop(blankCol, y, blankRow);
    else if (y > blankRow) shiftBottom(blankCol, y, blankRow);
  }
  // SetSequence: sequence[GetIndex(i,j)-1] = values[i][j].
  const sequence = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sequence.push(gridValues[i][j]);
  let finished = true;
  for (let i = 0; i < n && finished; i++) {
    for (let j = 0; j < n; j++) {
      if (gridValues[i][j] !== i * n + j + 1) { finished = false; break; }
    }
  }
  return { tiles: sequence.slice(), finished };
}

{
  let clicks = 0;
  for (let n = 3; n <= 7; n++) {
    for (let mode = 0; mode <= 2; mode++) {
      const R = rng(n * 1000 + mode);
      const bases = [C.start({ n, mode }), C.cheat(C.start({ n, mode }))];
      for (let k = 0; k < 30; k++) bases.push(C.shuffle(bases[k % 2], R));
      let same = true;
      for (const base of bases) {
        for (let col = 0; col < n; col++) {
          for (let row = 0; row < n; row++) {
            const expected = appletShift(grid(base.tiles, n), n, mode, { col, row });
            const actual = C.move(base, col * n + row);
            clicks++;
            if (actual === null) {
              // The bytecode re-tests the old board after a click it ignores.
              if (key(expected.tiles) !== key(base.tiles)) same = false;
            } else if (key(actual.tiles) !== key(expected.tiles) ||
                       C.isSolved(actual) !== expected.finished) {
              same = false;
            }
          }
        }
      }
      check(`Shift matches the applet, n=${n} mode=${mode}`, same);
    }
  }
  check("the bytecode comparison covered every size and mode with many clicks", clicks > 12000);
}

/* ------------------------------------------ 4. Cheat and Shuffle, transcribed */

function appletCheat(values, n) {
  const a = values.map((row) => row.slice());
  let i = n - 1;
  if (a[n - 3][n - 1] === n * n || a[n - 2][n - 1] === n * n) i = n - 2;
  const t = a[n - 3][i];
  a[n - 3][i] = a[n - 2][i];
  a[n - 2][i] = t;
  return flat(a, n);
}

function appletReshuffle(values, n, mode, rand) {
  let a = values.map((row) => row.slice());
  for (let k = 0; k < 4 * n * n; k++) {
    const col = Math.floor(n * rand());
    const row = Math.floor(n * rand());
    const which = Math.floor(2 * rand()); // fetched, then ignored
    const click = which === 0 ? { col, row } : { col, row };
    a = grid(appletShift(a, n, mode, click).tiles, n);
  }
  return flat(a, n);
}

{
  for (let n = 3; n <= 7; n++) {
    const R = rng(7000 + n);
    const fresh = C.start({ n });
    equal(`Cheat matches the applet, n=${n}`, C.cheat(fresh).tiles, appletCheat(grid(fresh.tiles, n), n));
    let same = true;
    let shuffled = fresh;
    for (let k = 0; k < 8; k++) {
      shuffled = C.shuffle(shuffled, R);
      if (key(C.cheat(shuffled).tiles) !== key(appletCheat(grid(shuffled.tiles, n), n))) same = false;
    }
    check(`Cheat matches on shuffled boards, n=${n}`, same);
    check(`Cheat changes the inversion parity, n=${n}`,
      C.inversions(C.cheat(fresh)) % 2 !== C.inversions(fresh) % 2);
    check(`Cheat switches the 4x4-type invariant on even n=${n}`,
      n % 2 === 1 || C.parity(C.cheat(fresh)) !== C.parity(fresh));

    for (let mode = 0; mode <= 2; mode++) {
      const R2 = rng(9000 + 100 * n + mode);
      const s = C.start({ n, mode });
      equal(`Shuffle matches the applet, n=${n} mode=${mode}`,
        C.shuffle(s, R2).tiles,
        appletReshuffle(grid(s.tiles, n), n, mode, rng(9000 + 100 * n + mode)));
    }
  }
  const c = C.cheat(C.start({}));
  equal("the 4x4 Cheat swaps two adjacent counters in the last column",
    [c.tiles[1 * 4 + 3], c.tiles[2 * 4 + 3]], [12, 8]);
  check("the Cheat position is not finished", C.result(c) === null);
}

/* --------------------------------------------------- 5. the page's claims */

function reachable(startState, limit) {
  const seen = new Set([key(startState.tiles)]);
  const queue = [[startState.tiles, 0]];
  const hist = [1];
  let head = 0;
  let parityChanged = false;
  let inversionChanged = false;
  while (head < queue.length) {
    const [tiles, depth] = queue[head++];
    const here = { n: startState.n, tiles };
    const p = C.parity(here);
    const i1 = C.inversions(here) % 2;
    for (let k = 0; k < startState.n * startState.n; k++) {
      const next = C.move({ n: startState.n, mode: startState.mode, tiles, moves: 0 }, k);
      if (!next) continue;
      if (C.parity(next) !== p) parityChanged = true;
      if (C.inversions(next) % 2 !== i1) inversionChanged = true;
      const id = key(next.tiles);
      if (!seen.has(id)) {
        seen.add(id);
        hist[depth + 1] = (hist[depth + 1] || 0) + 1;
        if (depth + 1 < limit) queue.push([next.tiles, depth + 1]);
      }
    }
  }
  return { seen, hist, parityChanged, inversionChanged };
}

{
  // The proposition and Wilson's two components, exhaustively on 3x3.
  const s = C.start({ n: 3 });
  const even = reachable(s, Infinity);
  equal("plain 3x3 has exactly 9!/2 positions", even.seen.size, 181440);
  check("plain 3x3 always changes N's parity (the proposition fails at n=3)", even.parityChanged);
  check("plain 3x3 preserves inversion parity", !even.inversionChanged);
  const odd = reachable(C.cheat(s), Infinity);
  equal("Cheat reaches the other 3x3 component", odd.seen.size, 181440);
  let overlap = 0;
  for (const k of odd.seen) if (even.seen.has(k)) overlap++;
  equal("the two 3x3 components are disjoint", overlap, 0);
  equal("together they are all 9! arrangements", even.seen.size + odd.seen.size, 362880);

  // The Cylinder/Moebius remark: at 3x3 each wrap variant reaches everything.
  const cyl = reachable(C.start({ n: 3, mode: C.CYLINDER }), Infinity);
  equal("Cylinder 3x3 is one component (always solvable)", cyl.seen.size, 362880);
  check("Cylinder 3x3 can change N's parity", cyl.parityChanged);
  const moe = reachable(C.start({ n: 3, mode: C.MOEBIUS }), Infinity);
  equal("Moebius 3x3 is one component (always solvable)", moe.seen.size, 362880);
  check("Moebius 3x3 can change N's parity", moe.parityChanged);

  // The 4x4 proposition: BFS from solved, and long random walks.
  const four = reachable(C.start({}), 9);
  check("plain 4x4 never changes N's parity over 55k positions", !four.parityChanged);
  check("plain 4x4 does change inversion parity", four.inversionChanged);
  check("plain 4x4 BFS reached the expected depth count", four.seen.size > 50000);
  const c4 = C.cheat(C.start({}));
  check("the Cheated 4x4 lies in the unreachable parity class", C.parity(c4) !== C.parity(C.start({})));
  check("the Cheated 4x4 is not solved", !C.isSolved(c4));

  // Every other size: local invariance over many shuffled configurations.
  for (let n = 3; n <= 7; n++) {
    for (let mode = 0; mode <= 2; mode++) {
      const R = rng(30000 + 100 * n + mode);
      let s = C.start({ n, mode });
      let parityFlips = 0, inversionFlips = 0, moves = 0;
      for (let round = 0; round < 40; round++) {
        s = C.shuffle(s, R);
        const p = C.parity(s);
        const iv = C.inversions(s) % 2;
        for (let k = 0; k < n * n; k++) {
          const next = C.move(s, k);
          if (!next) continue;
          moves++;
          if (C.parity(next) !== p) parityFlips++;
          if (C.inversions(next) % 2 !== iv) inversionFlips++;
        }
      }
      const wrap = mode === C.MOEBIUS;
      const invariantParity = n % 2 === 0 && !wrap;
      check(`n=${n} mode=${mode}: N parity ${invariantParity ? "preserved" : "can change"} over ${moves} moves`,
        invariantParity ? parityFlips === 0 : parityFlips > 0);
      check(`n=${n} mode=${mode}: inversion parity ${mode === C.PLAIN && n % 2 ? "preserved" : "can change"}`,
        mode === C.PLAIN && n % 2 === 1 ? inversionFlips === 0 : inversionFlips > 0);
    }
  }
}

/* --------------------------------------- 6. the cycle display, transcribed */

{
  let same = true;
  for (let n = 3; n <= 5; n++) {
    const R = rng(50000 + n);
    let s = C.start({ n });
    for (let k = 0; k < 20; k++) {
      const seq = s.tiles;
      const seen = new Array(n * n).fill(false);
      let expected = "";
      let idx = seen.indexOf(false);
      while (idx !== -1) {
        expected += "(";
        let first = true;
        while (!seen[idx]) {
          const v = seq[idx];
          expected += (first ? "" : ",") + (v === n * n ? "b" : String(v));
          first = false;
          seen[idx] = true;
          idx = v - 1;
          if (seen[idx]) expected += ")";
        }
        idx = seen.indexOf(false);
      }
      if (C.cycles(s) !== expected) same = false;
      s = C.shuffle(s, R);
    }
  }
  check("cycle notation matches Permutation.toCyclesSpec", same);
}

done("fifteen");
