#!/usr/bin/env node
"use strict";

/*
 * Logic test for hare-hounds/hare-hounds-core.js.
 *
 *   1. The rules against the applet's Board class, transcribed a second time
 *      here (isValidMove, hareEscapes with Java's truncating division,
 *      hareIsTrapped's three hard-coded patterns, the stall counter and when
 *      isWin() checks what) and compared on every position reachable from the
 *      start, with every stall count.
 *   2. The connection table is the classic board: symmetric (a line from a
 *      to b is a line from b to a, left one way and right the other, or
 *      vertical both ways) and it has the lines of the drawing.
 *   3. The classic result (Winning Ways; Schuh): with best play the hounds,
 *      moving first, win. Here it comes from the exact solution, and the test
 *      also checks that the stall rule is what stops the hare winning from a
 *      hound stall rather than a hound mistake.
 *   4. The computer: Expert never throws away a won position and never
 *      loses one it could hold, from every reachable position; every level
 *      plays only legal moves; as the hounds, Expert beats a random hare
 *      every time.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("hare-hounds/hare-hounds-core.js", "HareHoundsCore");
const { HOUND, HARE, EMPTY, CONNECT } = H;

/* ----------------------------------------------- the applet, transcribed */

const jdiv = (a, b) => Math.trunc(a / b);
const applet = {
  isValidMove(b, from, to, animal) {
    if (from < 0 || from > 10 || to < 0 || to > 10 || b[to] !== 0) return false;
    if (animal === 1 && CONNECT[from][to] > 1) return true;
    if (animal === 2 && CONNECT[from][to] > 0) return true;
    return false;
  },
  getHare(b) { for (let k = 10; k >= 0; k--) if (b[k] === 2) return k; return -1; },
  hareEscapes(b) {
    let h = applet.getHare(b);
    if (h === 0) return true;
    h--;
    for (let k = 0; k < 10; k++) if (b[k] === 1) return jdiv(k - 1, 3) > jdiv(h, 3);
    return false;
  },
  hareIsTrapped(b) {
    switch (applet.getHare(b)) {
      case 4: return b[1] === 1 && b[5] === 1 && b[7] === 1;
      case 6: return b[3] === 1 && b[5] === 1 && b[9] === 1;
      case 10: return b[7] === 1 && b[8] === 1 && b[9] === 1;
      default: return false;
    }
  },
};

{
  const seen = new Set();
  const stack = [H.start()];
  let positions = 0;
  let bad = 0;
  while (stack.length) {
    const s = stack.pop();
    const k = s.b.join("") + s.turn + s.stall;
    if (seen.has(k) || s.winner) continue;
    seen.add(k);
    positions++;
    for (let from = 0; from < 11; from++) {
      for (let to = 0; to < 11; to++) {
        const mine = H.legal(s, from, to);
        const theirs = s.b[from] === s.turn && applet.isValidMove(s.b, from, to, s.turn);
        if (mine !== theirs) bad++;
        if (!mine) continue;
        const n = H.copy(s);
        H.play(n, from, to);
        // The applet: movePlayerPiece/moveHound update stallCount, then isWin(mover).
        const b = s.b.slice();
        let stall = s.stall;
        if (s.turn === HOUND) stall = CONNECT[from][to] === 2 ? stall + 1 : 0;
        b[to] = b[from];
        b[from] = 0;
        let winner = 0;
        if (s.turn === HARE) {
          if (applet.hareEscapes(b)) winner = HARE;
          else if (stall === 10) winner = HARE;
        } else if (applet.hareIsTrapped(b)) winner = HOUND;
        if (n.winner !== winner || n.stall !== stall) bad++;
        stack.push(n);
      }
    }
  }
  check(`the rules match the applet on all ${positions} reachable positions`, bad === 0, `${bad} differ`);
  check("there are many positions", positions > 1000);
}

/* ------------------------------------------------------- 2. the board */

{
  let asym = 0;
  for (let a = 0; a < 11; a++) {
    for (let b = 0; b < 11; b++) {
      const x = CONNECT[a][b];
      const y = CONNECT[b][a];
      if ((x === 0) !== (y === 0) || (x === 2 && y !== 2) || (x === 1 && y !== 3) || (x === 3 && y !== 1)) asym++;
    }
  }
  equal("the board's lines read the same both ways", asym, 0);
  let lines = 0;
  for (let a = 0; a < 11; a++) for (let b = a + 1; b < 11; b++) if (CONNECT[a][b]) lines++;
  equal("the board has 22 lines", lines, 22);
  equal("hounds start on 0, 1, 3 and the hare on 10", H.start().b.join(""), "11010000002");
  equal("the hounds move first", H.start().turn, HOUND);
  // Three hounds can only trap the hare on a point with three lines: 0, 4, 6 and 10.
  // On 0 the hare has already escaped, which leaves the applet's three patterns.
  const degree = CONNECT.map((r) => r.filter(Boolean).length);
  equal("points with three lines", degree.map((d, p) => (d === 3 ? p : -1)).filter((p) => p >= 0), [0, 4, 6, 10]);
}

/* ------------------------------------------- 3. the hounds win, exactly */

{
  const v = H.solve(H.start());
  check("with best play the hounds (moving first) win", v.win);
  console.log(`  the hounds win in at most ${v.plies} moves (both sides counted) against best defence`);
  // The stall rule bites: from a position where the hounds could only shuffle, they lose.
  const s = H.start();
  s.stall = 9; // nine vertical moves already: a tenth hands the game to the hare
  s.b = new Array(11).fill(EMPTY);
  s.b[1] = s.b[6] = s.b[9] = HOUND; // 1 can still step down to 2
  s.b[10] = HARE;
  const vertical = H.moves(s).filter(([a, t]) => CONNECT[a][t] === 2);
  check("there is a vertical move to try", vertical.length > 0);
  const n = H.copy(s);
  H.play(n, ...vertical[0]);
  H.play(n, ...H.moves(n)[0]);
  equal("a tenth vertical hound move, then any hare move: the hare wins by stalling", [n.winner, n.reason], [HARE, "stalling"]);
}

/* ----------------------------------------------------- 4. the computer */

{
  // Expert from every reachable position keeps the outcome the solver promises.
  const seen = new Set();
  const stack = [H.start()];
  let bad = 0;
  let checked = 0;
  while (stack.length) {
    const s = stack.pop();
    const k = s.b.join("") + s.turn + s.stall;
    if (seen.has(k) || s.winner) continue;
    seen.add(k);
    const v = H.solve(s);
    for (const m of H.bestMoves(s)) {
      const n = H.copy(s);
      H.play(n, ...m);
      const keeps = n.winner ? n.winner === s.turn : !H.solve(n).win;
      if (keeps !== v.win) bad++;
    }
    checked++;
    for (const [a, t] of H.moves(s)) {
      const n = H.copy(s);
      H.play(n, a, t);
      stack.push(n);
    }
  }
  check(`Expert keeps the solved outcome from all ${checked} positions`, bad === 0, `${bad} bad`);

  const random = rng(99);
  const wins = {};
  for (const level of Object.keys(H.LEVELS)) {
    let illegal = 0;
    let houndWins = 0;
    const games = 200;
    for (let g = 0; g < games; g++) {
      const s = H.start();
      for (let ply = 0; ply < 400 && !s.winner; ply++) {
        const m = s.turn === HOUND ? H.chooseMove(s, level, random) : H.moves(s)[Math.floor(random() * H.moves(s).length)];
        if (!m) break;
        if (!H.play(s, ...m)) { illegal++; break; }
      }
      if (s.winner === HOUND) houndWins++;
    }
    equal(`${level}: no illegal moves`, illegal, 0);
    wins[level] = houndWins;
  }
  console.log(`  hounds vs a random hare, 200 games each: ${JSON.stringify(wins)}`);
  equal("expert hounds beat a random hare in every game", wins.expert, 200);
  check("the levels are in order of strength", wins.beginner <= wins.intermediate && wins.intermediate <= wins.expert);
  equal("levels, as the applet's", Object.keys(H.LEVELS), ["beginner", "intermediate", "expert"]);
}

done("hare-hounds");
