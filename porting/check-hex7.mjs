#!/usr/bin/env node
"use strict";

/*
 * Logic test for hex7/hex7-core.js.
 *
 *   1. "Hex can't end in a draw": on every full board of size 1 to 4 (all
 *      2^(n*n) colourings, 65,536 for 4 by 4) exactly one side connects;
 *      200,000 random full 7 by 7 boards agree.
 *   2. The first player's advantage, which the page proves by strategy
 *      stealing: solved exactly by game-tree search, the first player wins
 *      every board from 1 by 1 to 4 by 4 with perfect play. With the centre
 *      blocked for the first move, as in this game, the 3 by 3 first player
 *      still wins.
 *   3. The rules: White moves first, the centre is refused on move 1 and
 *      only then, cells fill once, and a chain wins for the right side only.
 *   4. The computer: it always plays a legal cell, never the centre on move
 *      1, takes a winning cell, blocks the opponent's, beats a random player
 *      almost always at both levels and as both colours, and answers in
 *      reasonable time.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("hex7/hex7-core.js", "Hex7Core");
const { WHITE, BLACK, EMPTY, N, CENTRE } = H;

/* ------------------------------------------------------- 1. no draws */

for (let n = 1; n <= 4; n++) {
  const cells = new Array(n * n);
  let bad = 0;
  for (let mask = 0; mask < 2 ** (n * n); mask++) {
    for (let k = 0; k < n * n; k++) cells[k] = mask & (1 << k) ? WHITE : BLACK;
    if (H.connects(cells, WHITE, n) === H.connects(cells, BLACK, n)) bad++;
  }
  check(`${n}x${n}: every full board has exactly one winner (${2 ** (n * n)} boards)`, bad === 0, `${bad} bad`);
}
{
  const random = rng(77);
  const cells = new Array(N * N);
  let bad = 0;
  for (let t = 0; t < 200000; t++) {
    for (let k = 0; k < N * N; k++) cells[k] = random() < 0.5 ? WHITE : BLACK;
    if (H.connects(cells, WHITE) === H.connects(cells, BLACK)) bad++;
  }
  check("7x7: 200,000 random full boards each have exactly one winner", bad === 0, `${bad} bad`);
}

/* -------------------------------------------- 2. the first player wins */

function firstPlayerWins(n, blockCentre) {
  const memo = new Map();
  const centre = n % 2 ? ((n - 1) / 2) * n + (n - 1) / 2 : -1;
  const cells = new Array(n * n).fill(EMPTY);
  // Returns true if the side to move wins with perfect play.
  function wins(side, ply) {
    const key = cells.join("") + side;
    if (memo.has(key)) return memo.get(key);
    let result = false;
    for (let k = 0; k < n * n && !result; k++) {
      if (cells[k] !== EMPTY) continue;
      if (blockCentre && ply === 1 && k === centre) continue;
      cells[k] = side;
      if (H.connects(cells, side, n) || !wins(H.other(side), ply + 1)) result = true;
      cells[k] = EMPTY;
    }
    memo.set(key, result);
    return result;
  }
  return wins(WHITE, 1);
}
for (let n = 1; n <= 4; n++) check(`${n}x${n}: the first player wins with perfect play`, firstPlayerWins(n, false));
check("3x3 with the centre blocked on move 1: the first player still wins", firstPlayerWins(3, true));

/* --------------------------------------------------------- 3. the rules */

{
  const s = H.start();
  equal("White moves first", s.turn, WHITE);
  check("the centre is refused on move 1", !H.legal(s, CENTRE) && !H.play(s, CENTRE));
  check("any other cell is fine", H.play(s, 0));
  equal("then Black", s.turn, BLACK);
  check("the centre is open from move 2", H.legal(s, CENTRE));
  check("a filled cell cannot be played again", !H.play(s, 0));

  const col = new Array(N * N).fill(EMPTY);
  for (let r = 0; r < N; r++) col[r * N + 2] = WHITE; // a straight top-to-bottom column
  check("a top-to-bottom chain wins for White", H.connects(col, WHITE));
  const asBlack = col.map((v) => (v === WHITE ? BLACK : EMPTY));
  check("the same cells do not win for Black", !H.connects(asBlack, BLACK));
  const row = new Array(N * N).fill(EMPTY);
  for (let c = 0; c < N; c++) row[4 * N + c] = BLACK;
  check("a left-to-right chain wins for Black", H.connects(row, BLACK));
  const diag = new Array(N * N).fill(EMPTY);
  for (let r = 0; r < N; r++) diag[r * N + (N - 1 - r)] = WHITE; // the short diagonal is connected
  check("the short diagonal is a chain", H.connects(diag, WHITE));
  const longDiag = new Array(N * N).fill(EMPTY);
  for (let r = 0; r < N; r++) longDiag[r * N + r] = WHITE; // the long diagonal is not
  check("the long diagonal is not a chain", !H.connects(longDiag, WHITE));
}

/* ------------------------------------------------------ 4. the computer */

{
  const random = rng(2024);
  const s = H.start();
  for (let t = 0; t < 40; t++) {
    const k = H.chooseMove(H.start(), "basic", random);
    if (k === CENTRE || k < 0) { check("never the centre on move 1", false); break; }
  }
  // A winning cell: White has column 2 except row 6.
  for (let r = 0; r < N - 1; r++) { s.cells[r * N + 2] = WHITE; s.cells[r * N + 5] = BLACK; }
  s.ply = 13;
  s.turn = WHITE;
  const winCell = H.chooseMove(s, "basic", random);
  s.cells[winCell] = WHITE;
  check("takes a winning cell", H.connects(s.cells, WHITE));
  s.cells[winCell] = EMPTY;
  // Give White one finishing cell only, then it is Black's move.
  s.cells[6 * N + 1] = BLACK;
  s.turn = BLACK;
  equal("blocks the opponent's only winning cell", H.chooseMove(s, "basic", random), 6 * N + 2);

  function match(level, computer, games, seed) {
    const r = rng(seed);
    let won = 0;
    let illegal = 0;
    for (let g = 0; g < games; g++) {
      const st = H.start();
      while (st.winner === EMPTY) {
        let k;
        if (st.turn === computer) {
          k = H.chooseMove(st, level, r);
        } else {
          const ms = H.legalMoves(st);
          k = ms[Math.floor(r() * ms.length)];
        }
        if (!H.play(st, k)) { illegal++; break; }
      }
      if (st.winner === computer) won++;
    }
    return { won, illegal };
  }
  for (const level of ["basic", "advanced"]) {
    for (const side of [WHITE, BLACK]) {
      const games = level === "basic" ? 60 : 20;
      const { won, illegal } = match(level, side, games, 10 + side);
      equal(`${level} as ${side === WHITE ? "White" : "Black"}: no illegal moves`, illegal, 0);
      check(`${level} as ${side === WHITE ? "White" : "Black"} beats a random player (${won}/${games})`, won >= games * 0.95);
    }
  }

  const t0 = Date.now();
  H.chooseMove(H.start(), "advanced", rng(5));
  const ms = Date.now() - t0;
  check(`an advanced opening move takes under 1.5 s (${ms} ms)`, ms < 1500);
}

done("hex7");
