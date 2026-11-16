#!/usr/bin/env node
"use strict";

/*
 * Logic test for pigeon-checkers/pigeon-checkers-core.js.
 *
 * Initial triangle, jump rules and undo match the applet. The page's claim
 * that the goal is impossible is checked for every N from 2 to 20 via the
 * colouring invariant, and by exhaustive search for N = 2 and N = 3.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("pigeon-checkers/pigeon-checkers-core.js", "PigeonCheckersCore");

{
  const s = C.start({});
  equal("default N is 5", s.n, 5);
  equal("board is 6 by 5", [s.cols, s.rows], [6, 5]);
  equal("15 pegs at the start", C.pegCount(s), 15);
  equal("column 0 is full", s.board[0].every((v) => v === C.PEG), true);
  equal("last column is empty", s.board[5].every((v) => v === C.EMPTY), true);
}

{
  // y < N - x
  const s = C.start({ n: 3 });
  equal("N=3 has 6 pegs", C.pegCount(s), 6);
  equal("N=3 board 4×3", [s.cols, s.rows], [4, 3]);
}

{
  const s = C.start({ n: 2 });
  // From (0,0) over (0,1) is not distance 2. From (0,1) over (1,1) to (2,1)?
  check("some jump exists on N=2", C.legalMoves(s).length > 0);
  const m = C.legalMoves(s)[0];
  let next = C.click(s, m.from[0], m.from[1]);
  next = C.click(next, m.to[0], m.to[1]);
  equal("jump does not remove the mid peg", C.pegCount(next), C.pegCount(s));
  const midX = (m.from[0] + m.to[0]) >> 1;
  const midY = (m.from[1] + m.to[1]) >> 1;
  equal("mid still occupied", next.board[midX][midY], C.PEG);
  const back = C.undo(next);
  equal("undo restores the board", back.board, s.board);
}

{
  // Second transcription of the distance test.
  function refOk(di, dj) {
    return di * di + dj * dj === 4 || (Math.abs(di) === 2 && Math.abs(dj) === 2);
  }
  for (let di = -3; di <= 3; di++) {
    for (let dj = -3; dj <= 3; dj++) {
      if (di === 0 && dj === 0) continue;
      const s = C.start({ n: 5 });
      // Place a peg at (2,2), mid neighbour, empty target when in range.
      s.board = s.board.map((col) => col.map(() => C.EMPTY));
      const fx = 2, fy = 2;
      const tx = fx + di, ty = fy + dj;
      if (tx < 0 || ty < 0 || tx >= s.cols || ty >= s.rows) continue;
      const mx = (fx + tx) >> 1, my = (fy + ty) >> 1;
      s.board[fx][fy] = C.PEG;
      if (mx !== fx || my !== fy) s.board[mx][my] = C.PEG;
      s.board[tx][ty] = C.EMPTY;
      const want = refOk(di, dj) && (mx !== fx || my !== fy);
      equal(`canJump Δ(${di},${dj})`, C.canJump(s, fx, fy, tx, ty), want);
    }
  }
}

{
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    const inv = C.invariantBlocks(n);
    check(`N=${n}: colouring blocks the goal (${inv.kind} ${inv.left}≠${inv.right})`,
      inv.impossible && inv.left !== inv.right,
      JSON.stringify(inv));
  }
}

{
  // Exhaustive: N=2 never reaches all-on-right.
  function key(board) { return board.map((c) => c.join("")).join("|"); }
  function unreachable(n) {
    const start = C.start({ n });
    const q = [start];
    const seen = new Set([key(start.board)]);
    let found = false;
    while (q.length && seen.size < 200000) {
      const cur = q.shift();
      if (C.allOnRight(cur)) { found = true; break; }
      for (const m of C.legalMoves(cur)) {
        let next = C.click(cur, m.from[0], m.from[1]);
        next = C.click(next, m.to[0], m.to[1]);
        const k = key(next.board);
        if (seen.has(k)) continue;
        seen.add(k);
        q.push(next);
      }
    }
    return { found, seen: seen.size };
  }
  const r2 = unreachable(2);
  check("N=2: goal unreachable by exhaustive search", !r2.found, `states ${r2.seen}`);
  const r3 = unreachable(3);
  check("N=3: goal unreachable by exhaustive search", !r3.found, `states ${r3.seen}`);
}

done("pigeon-checkers");
