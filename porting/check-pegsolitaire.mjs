#!/usr/bin/env node
"use strict";

/*
 * Logic test for pegsolitaire/pegsolitaire-core.js.
 *
 * Boards match the applet's Set* methods; jumps, undo and CheckPos are
 * checked against a second transcription. Cross is solved by exhaustive
 * search; Central solitaire's peg count and a known first move are checked.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("pegsolitaire/pegsolitaire-core.js", "PegsolitaireCore");

equal("ten named puzzles", C.PUZZLES.length, 10);
equal("default puzzle is Central solitaire", C.start({}).name, "Central solitaire");
equal("default has 32 pegs", C.pegCount(C.start({})), 32);
equal("default centre is empty", C.start({}).board[3][3], C.EMPTY);
equal("default wants the centre", C.start({}).centerGoal, true);

{
  // English board: four corner 2×2 blocks are outside.
  const b = C.start({}).board;
  equal("corner outside", b[0][0], C.OUT);
  equal("arm is a hole", b[0][3] !== C.OUT, true);
  equal("Skewed is reverse-goal", C.start({ gameNo: 7 }).centerGoal, false);
  equal("Double goal starts with two holes", C.pegCount(C.start({ gameNo: 8 })), 31);
}

/* Second transcription of an orthogonal jump of length 2. */
function refCanJump(board, fi, fj, ti, tj) {
  const peg = (v) => v === 1 || v === 3;
  if (!peg(board[fi][fj])) return false;
  if (board[ti][tj] !== 2) return false;
  const di = ti - fi;
  const dj = tj - fj;
  if (Math.sqrt(di * di + dj * dj) !== 2) return false;
  const mi = (fi + ti) >> 1;
  const mj = (fj + tj) >> 1;
  return peg(board[mi][mj]);
}

{
  const s = C.start({ gameNo: 6 });
  // From central: (3,1) can jump right over (3,2) into (3,3).
  check("central: (3,1)→(3,3) is legal", C.canJump(s, 3, 1, 3, 3));
  check("ref agrees", refCanJump(s.board, 3, 1, 3, 3));
  check("no diagonal jump", !C.canJump(s, 2, 2, 4, 4));
  const after = C.click(C.click(s, 3, 1), 3, 3);
  equal("after jump the from-cell is empty", after.board[3][1], C.EMPTY);
  equal("after jump the mid-cell is empty", after.board[3][2], C.EMPTY);
  equal("after jump the to-cell is a peg", after.board[3][3], C.PEG);
  equal("one peg removed", C.pegCount(after), 31);
  equal("history records the jump", after.history.length, 1);
  const back = C.undo(after);
  equal("undo restores peg count", C.pegCount(back), 32);
  equal("undo clears history", back.history.length, 0);
  equal("undo restores the centre hole", back.board[3][3], C.EMPTY);
}

{
  // Cross has six pegs; solve by BFS (state space is tiny).
  function key(board) {
    return board.map((r) => r.join("")).join("|");
  }
  const start = C.start({ gameNo: 0 });
  equal("Cross has 6 pegs", C.pegCount(start), 6);
  const queue = [start];
  const seen = new Set([key(start.board)]);
  let solved = false;
  let examined = 0;
  while (queue.length && examined < 20000) {
    const cur = queue.shift();
    examined++;
    if (C.isWon(cur)) { solved = true; break; }
    for (const m of C.legalMoves(cur)) {
      let next = C.click(cur, m.from[0], m.from[1]);
      next = C.click(next, m.to[0], m.to[1]);
      const k = key(next.board);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push(next);
    }
  }
  check("Cross is solvable to a centre peg", solved);
  check("Cross search stayed small", examined < 5000, `examined ${examined}`);
}

{
  // Page / applet: centre goal means only the centre may hold a peg.
  const s = C.start({ gameNo: 0 });
  // Manually place one peg at centre, clear the rest of the holes.
  const won = {
    ...s,
    board: s.board.map((row, i) => row.map((v, j) => {
      if (v === C.OUT) return C.OUT;
      return i === 3 && j === 3 ? C.PEG : C.EMPTY;
    })),
  };
  check("single centre peg wins a centre-goal puzzle", C.isWon(won));
  const extra = C.copyBoard(won.board);
  extra[3][4] = C.PEG;
  check("an extra peg fails centre-goal", !C.isWon({ ...won, board: extra }));
}

{
  // Reverse goal (Skewed): win when no starting peg remains.
  const s = C.start({ gameNo: 7 });
  const cleared = {
    ...s,
    board: s.board.map((row, i) => row.map((v, j) => {
      if (v === C.OUT) return C.OUT;
      return C.EMPTY;
    })),
  };
  check("empty board wins a reverse-goal puzzle", C.isWon(cleared));
  check("starting Skewed is not already won", !C.isWon(s));
}

{
  // Design mode toggles a hole.
  let s = C.start({ gameNo: 9 });
  s = { ...s, designing: true };
  const before = s.board[3][4];
  equal("design starts with a peg at (3,4)", before, C.PEG);
  s = C.click(s, 3, 4);
  equal("design removes a peg", s.board[3][4], C.EMPTY);
  s = C.click(s, 3, 4);
  equal("design puts a peg back", s.board[3][4], C.PEG);
}

{
  // Selecting then clicking elsewhere without a jump deselects.
  let s = C.start({});
  s = C.click(s, 1, 3);
  equal("selected cell marked", s.board[1][3], C.SELECTED);
  s = C.click(s, 0, 3); // empty / invalid
  equal("invalid target clears selection", s.selected, null);
  equal("peg restored", s.board[1][3], C.PEG);
}

done("pegsolitaire");
