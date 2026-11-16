#!/usr/bin/env node
"use strict";

/*
 * Logic test for reverse-desert/reverse-desert-core.js.
 *
 *   node porting/check-reverse-desert.mjs
 *
 * Checks the reverse-jump rules, win detection, undo, and that the default
 * start is solvable (BFS) — the page's goal is reachable.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("reverse-desert/reverse-desert-core.js", "ReverseDesertCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("default 6×(3+2) with one top-centre scout", s.cols === 6 && s.rows === 5 && s.board[3][0] === C.SCOUT);
  check("desert not yet clear", C.desertClear(s) === false && C.result(s) === null);
  check("dims clamped", C.start({ cols: 1, habitable: 99, level: 99 }).cols === 4);
}

{
  // Reverse jump: from (2,0) over empty (2,1) to (2,2) — need scout at (2,0).
  let s = C.start({ cols: 4, habitable: 3, level: 2 });
  // Clear default and place scout at (1,0)
  s = C.setSetting(s, true);
  s = C.click(s, 2, 0); // toggle off default centre if any — default centre is floor(4/2)=2
  // After setDims-like start, centre is (2,0). Toggle it off then put (1,0).
  s = C.start({ cols: 4, habitable: 3, level: 2 });
  // default scout at (2,0). Select and jump down to (2,2).
  s = C.click(s, 2, 0);
  check("selected", s.selected && s.board[2][0] === C.SELECTED);
  s = C.click(s, 2, 2);
  check("after reverse jump mid and dest have scouts", s.board[2][0] === C.EMPTY && s.board[2][1] === C.SCOUT && s.board[2][2] === C.SCOUT);
  check("scout count grew by 1", C.scoutCount(s) === 2);

  const back = C.undo(s);
  check("Take back restores one scout at origin", back.board[2][0] === C.SCOUT && C.scoutCount(back) === 1);
}

{
  // Cannot jump over a scout or onto occupied.
  let s = C.start({ cols: 4, habitable: 3, level: 2 });
  s = C.click(s, 2, 0);
  s = C.click(s, 2, 1); // only 1 step — illegal
  check("non-distance-2 deselects", s.selected === null && s.board[2][0] === C.SCOUT);
}

{
  // Win: desert empty.
  let s = C.start({ cols: 4, habitable: 3, level: 2 });
  // Manually place only below desert
  s = Object.assign({}, s, {
    board: s.board.map((col, x) => col.map((_, y) => (y >= 2 && x === 1 ? C.SCOUT : C.EMPTY))),
    won: false,
  });
  // Force check via a no-op path — set won through desertClear after a dummy move
  check("desert clear when only habitable has scouts", C.desertClear(s) === true);
}

/* ------------------------------------------- 2. every case, where it is small */

{
  // BFS: default board is solvable.
  function key(state) {
    return state.board.map((c) => c.join("")).join("|");
  }
  function bfs(start) {
    const q = [start];
    const seen = new Set([key(start)]);
    const parent = new Map();
    while (q.length) {
      const cur = q.shift();
      if (C.desertClear(cur)) return { found: true, state: cur, parent, seen: seen.size };
      for (const m of C.legalMoves(cur)) {
        let next = C.click(cur, m.from.x, m.from.y);
        next = C.click(next, m.to.x, m.to.y);
        const k = key(next);
        if (seen.has(k)) continue;
        seen.add(k);
        parent.set(k, { prev: key(cur), move: m });
        if (seen.size > 20000) return { found: false, seen: seen.size };
        q.push(next);
      }
    }
    return { found: false, seen: seen.size };
  }

  const small = C.start({ cols: 4, habitable: 3, level: 2 });
  const r = bfs(small);
  check("4×(3+2) default is solvable", r.found === true, "seen=" + r.seen);

  // Legal moves never create a scout on an occupied mid
  let movesChecked = 0;
  const s0 = C.start({ cols: 5, habitable: 3, level: 2 });
  for (const m of C.legalMoves(s0)) {
    let n = C.click(s0, m.from.x, m.from.y);
    n = C.click(n, m.to.x, m.to.y);
    check("move increases scout count by 1", C.scoutCount(n) === C.scoutCount(s0) + 1);
    movesChecked++;
  }
  check("checked opening moves", movesChecked >= 1);
}

/* ----------------------------- 3. second transcription of the jump rule */

{
  function appletJump(board, cols, rows, fx, fy, tx, ty) {
    const mx = (fx + tx) >> 1;
    const my = (fy + ty) >> 1;
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return null;
    if (board[tx][ty] !== 0) return null;
    if (Math.abs(fx - tx) + Math.abs(fy - ty) !== 2) return null;
    if (board[mx][my] !== 0) return null;
    const b = board.map((c) => c.slice());
    b[fx][fy] = 0;
    b[tx][ty] = 1;
    b[mx][my] = 1;
    return b;
  }

  const s = C.start({ cols: 6, habitable: 3, level: 2 });
  for (const m of C.legalMoves(s)) {
    let n = C.click(s, m.from.x, m.from.y);
    n = C.click(n, m.to.x, m.to.y);
    const ref = appletJump(s.board, s.cols, s.rows, m.from.x, m.from.y, m.to.x, m.to.y);
    equal("core jump matches applet", n.board, ref);
  }
}

{
  // Undo twice, reset, set-position toggle.
  let s = C.start({ cols: 4, habitable: 3, level: 2 });
  s = C.click(s, 2, 0);
  s = C.click(s, 2, 2);
  s = C.click(s, 2, 2);
  s = C.click(s, 0, 2);
  check("two jumps leave three scouts", C.scoutCount(s) === 3);
  s = C.undo(s);
  s = C.undo(s);
  check("double Take back restores the start", C.scoutCount(s) === 1 && s.board[2][0] === C.SCOUT);
  s = C.setSetting(s, true);
  s = C.click(s, 0, 0);
  check("Set position can add a scout", s.starting[0][0] === C.SCOUT);
  s = C.click(s, 0, 0);
  check("Set position can remove it again", s.starting[0][0] === C.EMPTY);
}

done("reverse-desert");
