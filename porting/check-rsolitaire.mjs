#!/usr/bin/env node
"use strict";

/*
 * Logic test for rsolitaire/rsolitaire-core.js.
 *
 *   node porting/check-rsolitaire.mjs
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("rsolitaire/rsolitaire-core.js", "RsolitaireCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ gameNo: 6 });
  equal("default is Central solitaire", s.name, "Central solitaire");
  equal("starts with one centre peg", C.pegCount(s), 1);
  equal("centre is peg", s.board[3][3], C.PEG);
  equal("a neighbour hole is empty", s.board[3][1], C.EMPTY);
  check("goal centre is empty", s.goal[3][3] === C.EMPTY);
  check("goal has 32 pegs", (() => {
    let n = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) if (s.goal[i][j] === C.PEG) n++;
    return n === 32;
  })());
}

{
  let s = C.start({ gameNo: 0 });
  equal("Cross starts with 1 peg", C.pegCount(s), 1);
  // Reverse of the known forward Cross solution
  const path = [
    { from: [3, 3], to: [3, 1] },
    { from: [3, 2], to: [1, 2] },
    { from: [2, 2], to: [4, 2] },
    { from: [3, 2], to: [3, 4] },
    { from: [1, 2], to: [3, 2] },
  ];
  for (const m of path) {
    check("legal reverse jump " + JSON.stringify(m), C.canJump(s, m.from[0], m.from[1], m.to[0], m.to[1]));
    s = C.click(s, m.from[0], m.from[1]);
    s = C.click(s, m.to[0], m.to[1]);
  }
  check("Cross reverse is won", s.won && C.isWon(s));
  equal("Cross reverse ends with 6 pegs", C.pegCount(s), 6);
}

{
  let s = C.start({ gameNo: 0 });
  s = C.click(s, 3, 3);
  s = C.click(s, 3, 1);
  equal("one reverse jump adds a peg", C.pegCount(s), 2);
  const back = C.undo(s);
  equal("Undo restores one peg", C.pegCount(back), 1);
  equal("Undo clears centre neighbour", back.board[3][1], C.EMPTY);
}

/* ------------------------------------------- 2. every case, where it is small */

{
  for (let g = 0; g < C.NAMES.length; g++) {
    const s = C.start({ gameNo: g });
    equal("name g=" + g, s.name, C.NAMES[g]);
    check("start not already won g=" + g, !C.isWon(s));
    const pegs = g === 8 ? 2 : 1;
    equal("start pegs g=" + g, C.pegCount(s), pegs);
    // Every reverse jump raises peg count by 1
    for (const m of C.legalMoves(s)) {
      let t = C.click(s, m.from[0], m.from[1]);
      t = C.click(t, m.to[0], m.to[1]);
      equal("peg +1 after jump g=" + g, C.pegCount(t), pegs + 1);
    }
  }
}

{
  // BFS: Cross reverse is solvable in exactly 5 moves (dual of forward)
  function key(board) {
    return board.map((r) => r.join("")).join("|");
  }
  const start = C.start({ gameNo: 0 });
  const q = [{ state: start, depth: 0 }];
  const seen = new Set([key(start.board)]);
  let found = -1;
  while (q.length) {
    const { state, depth } = q.shift();
    if (C.isWon(state)) { found = depth; break; }
    if (depth >= 8) continue;
    for (const m of C.legalMoves(state)) {
      let t = C.click(state, m.from[0], m.from[1]);
      t = C.click(t, m.to[0], m.to[1]);
      const k = key(t.board);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ state: t, depth: depth + 1 });
    }
  }
  equal("Cross reverse shortest length", found, 5);
}

/* ----------------------------- 3. second transcription */

{
  // Forward jump dual: empty mid + peg at to ⇒ reverse from to to from
  function forwardCan(board, fi, fj, ti, tj) {
    if (board[fi][fj] !== C.PEG) return false;
    if (board[ti][tj] !== C.EMPTY) return false;
    const di = ti - fi, dj = tj - fj;
    if (di * di + dj * dj !== 4 || (di && dj)) return false;
    const mi = (fi + ti) >> 1, mj = (fj + tj) >> 1;
    return board[mi][mj] === C.PEG;
  }
  // On a mid-game reverse Cross board, each reverse move's dual is a forward move
  let s = C.start({ gameNo: 0 });
  s = C.click(s, 3, 3);
  s = C.click(s, 3, 1);
  for (const m of C.legalMoves(s)) {
    const board = C.copyBoard(s.board);
    // After reverse m, the dual forward would be to→from on the post-board…
    let t = C.click(s, m.from[0], m.from[1]);
    t = C.click(t, m.to[0], m.to[1]);
    check(
      "dual forward exists after reverse",
      forwardCan(t.board, m.to[0], m.to[1], m.from[0], m.from[1]),
    );
    void board;
  }
}

{
  // Skewed / Double goal starts match applet SetStartingPosition
  equal("Skewed start peg at 2,2", C.start({ gameNo: 7 }).board[2][2], C.PEG);
  equal("Double start pegs", [C.start({ gameNo: 8 }).board[2][2], C.start({ gameNo: 8 }).board[4][4]], [C.PEG, C.PEG]);
}

done("rsolitaire");
