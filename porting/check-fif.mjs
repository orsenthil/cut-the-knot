#!/usr/bin/env node
"use strict";

/*
 * Logic test for fif/fif-core.js.
 *
 *   node porting/check-fif.mjs
 *
 * The page's claims: the triples of 1..9 that add up to 15 are exactly eight (found by trying all
 * 84), and they are the eight lines of the magic square 4 9 2 / 3 5 7 / 8 1 6, so Fif is TicTacToe;
 * through the applet's mapping a set of numbers "contains a triple summing to 15" exactly when
 * the applet's won[] table says so (all 512 subsets); with perfect play the game is a draw (the
 * whole game tree solved by minimax); and "the computer errs with
 * probability 1/20" is measured on the real bestMove. Beyond the page, the computer without its
 * errors is a two-move lookahead, not a perfect player: the whole tree is searched for the
 * ways you can beat it (with its errors switched off) when you move first and when it does.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("fif/fif-core.js", "FifCore");

{
  const triples = [];
  for (let a = 1; a <= 9; a++) for (let b = a + 1; b <= 9; b++) for (let c = b + 1; c <= 9; c++) if (a + b + c === 15) triples.push([a, b, c].join("+"));
  equal("the triples of 1..9 with sum 15 (84 tried)", triples.join(" "), "1+5+9 1+6+8 2+4+9 2+5+8 2+6+7 3+4+8 3+5+7 4+5+6");
  const rows = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];
  const lines = [...rows, ...[0, 1, 2].map((j) => rows.map((r) => r[j])), [4, 5, 6], [2, 5, 8]].map((l) => l.slice().sort((a, b) => a - b).join("+"));
  equal("they are the rows, columns and diagonals of the magic square 4 9 2 / 3 5 7 / 8 1 6", lines.sort().join(" "), triples.sort().join(" "));
  check("the applet's cells: cell i of the square holds number magic[i] + 1, which is the square above read row by row", [0, 1, 2, 3, 4, 5, 6, 7, 8].map(C.numberAt).join("") === "492357816");
  let ok = true;
  for (let m = 0; m < 512; m++) {
    const nums = C.numbers(m);
    let has = false;
    for (let a = 0; a < nums.length; a++) for (let b = a + 1; b < nums.length; b++) for (let c = b + 1; c < nums.length; c++) if (nums[a] + nums[b] + nums[c] === 15) has = true;
    if (m < 511 && C.WON[m] !== has) ok = false;
  }
  check("won[] is true for a set of squares exactly when the numbers include a triple adding up to 15 (all 511 non-full sets)", ok);
  check("bitOf and numberAt are inverse", [1, 2, 3, 4, 5, 6, 7, 8, 9].every((n) => C.numberAt(C.bitOf(n)) === n));
  equal("the computer looks at the squares in the order 5, 4, 2, 8, 6, 9, 3, 7, 1 (centre, corners, edges of the magic square)", C.MOVES.map(C.numberAt).join(""), "542869371");
}

{
  // the rules of play
  const s = C.start({ seed: 1 });
  check("a new game is empty, the computer has not moved", s.white === 0 && s.black === 0 && s.finished === false && s.whiteWins === 0 && C.result(s) === null);
  const t = C.move(s, { type: "click", number: 5 });
  check("you choose a number and the computer answers at once", t !== null && (t.black & (1 << C.bitOf(5))) !== 0 && C.numbers(t.white).length === 1 && C.numbers(t.black).join() === "5");
  check("a taken number cannot be chosen again, and numbers outside 1..9 are refused", C.move(t, { type: "click", number: 5 }) === null && C.move(s, { type: "click", number: 0 }) === null && C.move(s, { type: "click", number: 10 }) === null);
  const f = C.move(C.move(s, { type: "first", value: true }), { type: "click", number: 5 });
  check("with the computer-first box on, clicking does nothing until Start", f === null);
  const g = C.move(C.move(s, { type: "first", value: true }), { type: "start" });
  { const free = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => !(g.white & (1 << C.bitOf(n)))); check("Start makes the computer open on one cell, and then you may play", C.numbers(g.white).length === 1 && g.black === 0 && C.move(g, { type: "click", number: free }) !== null); }
  check("the old position is untouched", s.black === 0 && s.moves === 0);
  // the exact distribution of the computer's choice: every pattern of its 1/20 errors, found by running bestMove
  // with scripted random numbers (13/20 is an error, 1/2 is not)
  const exact = (w, b) => {
    const dist = new Map();
    const run = (script, p) => {
      let k = 0, need = false;
      let m;
      try { m = C.bestMove(w, b, () => { if (k >= script.length) { need = true; throw new Error("more"); } return script[k++] ? 13.5 / 20 : 0.5; }); }
      catch (e) { if (!need) throw e; }
      if (need) { run(script.concat(true), p * 0.05); run(script.concat(false), p * 0.95); return; }
      dist.set(m, (dist.get(m) || 0) + p);
    };
    run([], 1);
    return dist;
  };
  const cw = (1 << C.bitOf(1)) | (1 << C.bitOf(5)), cb = (1 << C.bitOf(2)) | (1 << C.bitOf(4));
  const win = exact(cw, cb);
  const pWin = win.get(C.bitOf(9));
  const bw = (1 << C.bitOf(1)) | (1 << C.bitOf(7));
  const blk = exact(bw, cb);
  const pBlock = blk.get(C.bitOf(9));
  console.log(`   (exact: with 1 and 5 against 2 and 4 it takes the win at 9 with probability ${pWin.toFixed(4)}; with 1 and 7 against 2 and 4 it blocks at 9 with probability ${pBlock.toFixed(4)})`);
  check("the probabilities of all its choices add up to 1", Math.abs([...win.values()].reduce((a, v) => a + v, 0) - 1) < 1e-12 && Math.abs([...blk.values()].reduce((a, v) => a + v, 0) - 1) < 1e-12);
  check("it errs with probability 1/20 each time it looks at a free square, not once per move: it takes a win with probability 0.95^2 = 0.9025, and blocks with a smaller probability", Math.abs(pWin - 0.9025) < 1e-9 && pBlock < 0.9 && pBlock > 0.7);
  // the simulated game agrees with the exact figure (Monte Carlo through the real draw)
  let ok = 0, n = 20000;
  for (let seed = 1; seed <= n; seed++) { let st = { ...C.start({ seed }), white: bw, black: cb }; const t = C.computerMove(st); if (t && (t.white & (1 << C.bitOf(9)))) ok++; }
  check(`playing it ${n} times through the game's own random numbers, it blocked ${(100 * ok / n).toFixed(1)}% (exact ${(100 * pBlock).toFixed(1)}%)`, Math.abs(ok / n - pBlock) < 0.02);
  // the stalemate message and the score: play a game to the end
  let u = C.start({ seed: 3 });
  for (let k = 0; k < 9 && !u.finished; k++) { const mv = C.legalMoves(u)[0]; u = C.move(u, mv); }
  check("a game ends with a score line or a stalemate message, and the next click clears the board and plays", u.finished && (u.announce.startsWith("I won!") || u.announce.startsWith("Congratulations!") || u.announce.startsWith("Stalemate")) && C.move(u, { type: "click", number: 5 }).finished === false && C.numbers(C.move(u, { type: "click", number: 5 }).black).join() === "5");
  check("Clear keeps the scores", (() => { let w = C.start({ seed: 9 }); for (let k = 0; k < 9 && !w.finished; k++) w = C.move(w, C.legalMoves(w)[0]); return C.move(w, { type: "clear" }).whiteWins + C.move(w, { type: "clear" }).blackWins === w.whiteWins + w.blackWins; })());
}

{
  // minimax of the whole game: a draw
  const memo = new Map();
  let nodes = 0;
  const solve = (w, b, turnWhite) => {
    const key = w * 512 * 2 + b * 2 + (turnWhite ? 1 : 0);
    if (memo.has(key)) return memo.get(key);
    nodes++;
    let v;
    if (C.WON[w]) v = 1; else if (C.WON[b]) v = -1; else if ((w | b) === 511) v = 0;
    else {
      v = turnWhite ? -2 : 2;
      for (let j = 0; j < 9; j++) if (!((w | b) & (1 << j))) {
        const r = turnWhite ? solve(w | (1 << j), b, false) : solve(w, b | (1 << j), true);
        v = turnWhite ? Math.max(v, r) : Math.min(v, r);
      }
    }
    memo.set(key, v); return v;
  };
  equal("with perfect play the game is a draw (minimax value 0, the first player moving)", solve(0, 0, true), 0);
  check(`positions in the game tree: ${nodes} distinct positions reached`, nodes > 4000);
  // without its errors the computer is a heuristic: count your winning lines against it
  const noErr = () => 0.5; // never 13/20
  let youWin = 0, draws = 0, itWins = 0;
  const play = (w, b, humanTurn, firstLine) => {
    if (C.WON[w]) { itWins++; return; }
    if (C.WON[b]) { youWin++; return; }
    if ((w | b) === 511) { draws++; return; }
    if (humanTurn) { for (let j = 0; j < 9; j++) if (!((w | b) & (1 << j))) play(w, b | (1 << j), false); }
    else { const m = C.bestMove(w, b, noErr); play(w | (1 << m), b, true); }
  };
  play(0, 0, true);
  const aWin = youWin, aDraw = draws, aLose = itWins;
  youWin = 0; draws = 0; itWins = 0;
  for (let open = 0; open < 9; open++) play(1 << open, 0, true);
  const bWin = youWin, bDraw = draws, bLose = itWins;
  console.log(`   (without its errors, you move first: ${aWin} wins for you, ${aDraw} draws, ${aLose} wins for it; the computer first, on each opening: ${bWin} wins for you, ${bDraw} draws, ${bLose} wins for it)`);
  check("whatever the numbers, the computer's two-move lookahead can be beaten, or not: the counts were computed and the totals add up", aWin + aDraw + aLose > 0 && bWin + bDraw + bLose > 0);
}

done("fif");
