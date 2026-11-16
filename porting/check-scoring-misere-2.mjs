#!/usr/bin/env node
"use strict";

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("scoring-misere-2/scoring-misere-2-core.js", "ScoringMisere2Core");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ heaps: [5, 3], maxMove: 3 });
  equal("start heaps", s.heaps, [5, 3]);
  check("can take 1..3 from heap 0", C.legalMoves(s).some((m) => m.heap === 0 && m.take === 3));
  const a = C.applyMove(s, 0, 2);
  equal("after take 2", a.heaps, [3, 3]);
}

{
  let s = C.start({ heaps: [1, 0], maxMove: 3 });
  s = C.applyMove(s, 0, 1);
  check("taking last loses", s.over && s.winner === "computer");
}

{
  let s = C.start({ heaps: [1, 1], maxMove: 3, turn: "you" });
  s = C.applyMove(s, 0, 1); // leave (0,1)
  s = C.playComputer(s, () => 0);
  check("computer forced to take last — you win", s.over && s.winner === "you");
}

/* ------------------------------------------- 2. page formula vs search */

{
  // Misère: mover who faces (0,0) never happens; (0,1)/(1,0) is a loss (must take last).
  // Recursive: toMoveWins(a,b)
  const memo = new Map();
  function key(a, b, M) {
    return a + "," + b + "," + M;
  }
  function toMoveWins(a, b, M) {
    if (a < b) return toMoveWins(b, a, M);
    const k = key(a, b, M);
    if (memo.has(k)) return memo.get(k);
    if (a === 0 && b === 0) {
      memo.set(k, true); // unable to move — misère win (unreachable as start-of-turn after a move ends)
      return true;
    }
    let win = false;
    for (const [h, n] of [[0, a], [1, b]]) {
      for (let t = 1; t <= Math.min(M, n); t++) {
        const na = h === 0 ? a - t : a;
        const nb = h === 1 ? b - t : b;
        if (na === 0 && nb === 0) continue; // taking last loses
        if (!toMoveWins(na, nb, M)) {
          win = true;
          break;
        }
      }
      if (win) break;
    }
    memo.set(k, win);
    return win;
  }

  for (const M of [2, 3, 4, 5]) {
    for (let a = 0; a <= 12; a++) {
      for (let b = 0; b <= 12; b++) {
        if (a === 0 && b === 0) continue;
        const page = C.secondPlayerWins(a, b, M); // second wins = first to move loses
        const firstWins = toMoveWins(a, b, M);
        check(
          "formula M=" + M + " (" + a + "," + b + ")",
          page === !firstWins,
        );
      }
    }
  }
}

/* ----------------------------- 3. computer answers */

{
  // From an N-position (first wins), computer as second still replies; from P, human errs.
  const s = C.start({ heaps: [4, 1], maxMove: 3, turn: "computer" }); // 4≡0,1≡1 → P for first? second wins means first loses
  check("4,1 is P (second wins)", C.secondPlayerWins(4, 1, 3));
  // Computer to move from P should leave an N... wait if it's computer's turn on a P for the player to move, computer loses with perfect play.
  const m = C.computerMove(s, () => 0.2);
  check("computer returns a legal move", m && m.take >= 1 && m.take <= 3);
  const next = C.applyMove(s, m.heap, m.take);
  check("reply leaves first-player win (N)", !C.secondPlayerWins(next.heaps[0], next.heaps[1], 3) || next.over);
}

{
  // Equal rem 2,2 with M=3: second wins. (6,6) ≡ (2,2).
  const s = C.start({ heaps: [6, 6], maxMove: 3, turn: "computer" });
  check("(6,6) second wins", C.secondPlayerWins(6, 6, 3));
  const m = C.computerMove(s, () => 0);
  const next = C.applyMove(s, m.heap, m.take);
  check("from P leaves N or terminal", next.over || !C.secondPlayerWins(next.heaps[0], next.heaps[1], 3));
}

done("scoring-misere-2");
