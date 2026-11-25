#!/usr/bin/env node
"use strict";

/*
 * Logic test for northcotts-game/northcotts-game-core.js.
 *
 *   node porting/check-northcotts-game.mjs
 *
 * The rules and the applet's own tests for "has a move" (a row is stuck only
 * when the checker has a wall or the other checker on both sides), compared with
 * a second transcription of the applet's ThereAreMoves over every small board.
 * The computer's play against a literal transcription of MakeMove. Then the
 * page's claims, by solving the whole game on small boards (every position, the
 * moves of both players, with the reversible moves that add beans): the player to
 * move loses exactly when the nim-sum of the gaps is 0, no position is a draw
 * (the game must end), the computer always wins from a nim-sum 0 start against
 * any opponent, and a perfect player wins from any other start.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("northcotts-game/northcotts-game-core.js", "NorthcottCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const seq = [0.0, 0.5, 0.99, 0.3, 0.7, 0.7, 0.1, 0.1, 0.9]; let k = 0;
  const t = C.start({ nx: 11, ny: 2, random: () => seq[k++ % seq.length] });
  equal("a start puts different columns in each row; the player moves first", [t.white.length, t.black.length, t.turn, t.white.every((w, i) => w !== t.black[i])], [2, 2, "white", true]);
  equal("the board size is kept in the applet's ranges (width 11..20, height 2..20)", [C.start({ nx: 3, ny: 99 }).nx, C.start({ nx: 3, ny: 99 }).ny, C.start({ nx: 50, ny: 0 }).nx, C.start({ nx: 50, ny: 0 }).ny, C.start({}).nx, C.start({}).ny], [11, 20, 20, 2, 11, 6]);
  const p = { nx: 11, ny: 2, white: [2, 8], black: [6, 1], turn: "white" };
  equal("gaps and the nim-sum", [C.gaps(p), C.nimSum(p)], [[3, 6], 5]);
  equal("white at 2 with black at 6 can go to 0, 1, 3, 4, 5 (not over black, not to its own square)", C.targets(p, "white", 0), [0, 1, 3, 4, 5]);
  equal("white at 8 with black at 1 can go to 2..7, 9, 10", C.targets(p, "white", 1), [2, 3, 4, 5, 6, 7, 9, 10]);
  equal("black at 6 with white at 2 can go to 3, 4, 5, 7, 8, 9, 10", C.targets(p, "black", 0), [3, 4, 5, 7, 8, 9, 10]);
  const m = C.move(p, "white", 0, 4);
  equal("a move changes one checker and passes the turn", [m.white, m.black, m.turn], [[4, 8], [6, 1], "black"]);
  equal("the old position is untouched", p.white, [2, 8]);
  equal("illegal moves: jumping, landing on the other checker, staying, a bad row, the wrong turn", [C.move(p, "white", 0, 7), C.move(p, "white", 0, 6), C.move(p, "white", 0, 2), C.move(p, "white", 5, 1), C.move(p, "black", 0, 4)], [null, null, null, null, null]);
  const stuck = { nx: 11, ny: 2, white: [1, 9], black: [0, 10], turn: "black" };
  equal("black at the wall with white next to it is stuck (white is not: it can slide away); black to move with no move: the player wins", [C.hasMoves(stuck, "black"), C.hasMoves(stuck, "white"), C.result(stuck)], [false, true, "win"]);
  const whiteStuck = { nx: 11, ny: 2, white: [0, 10], black: [1, 9], turn: "white" };
  equal("white at the wall with black next to it in every row is stuck, and on white's turn that loses", [C.hasMoves(whiteStuck, "white"), C.result(whiteStuck)], [false, "lose"]);
  equal("a game in progress has no result", C.result(p), null);
  equal("a row where black is at the wall but white is not adjacent is not stuck", C.hasMoves({ nx: 11, ny: 1, white: [5], black: [0], turn: "black" }, "black"), true);
  equal("the hint reduces the heap with the top bit of the nim-sum (6 to 3, nim-sum 5 to 0) by moving white toward black", [C.hint(p), C.nimSum(C.move(p, "white", 1, 5))], [{ row: 1, to: 5 }, 0]);
}

/* ----- 2. "has a move" is the applet's ThereAreMoves, on every small board */
{
  // ThereAreMoves(side) counts the rows where the checker is boxed in: black at 0 with white at 1, or black at nx-1 with white at nx-2
  // (and the same for white); the side has a move unless every row is boxed in.
  function appletHasMoves(nx, whiteCols, blackCols, side) {
    let boxed = 0;
    for (let r = 0; r < whiteCols.length; r++) {
      const me = side === "black" ? blackCols[r] : whiteCols[r], other = side === "black" ? whiteCols[r] : blackCols[r];
      if ((me === 0 && other === 1) || (me === nx - 1 && other === nx - 2)) boxed++;
    }
    return boxed !== whiteCols.length;
  }
  let ok = true, count = 0;
  for (let nx = 2; nx <= 6; nx++) {
    for (let w1 = 0; w1 < nx; w1++) for (let b1 = 0; b1 < nx; b1++) {
      if (w1 === b1) continue;
      for (let w2 = 0; w2 < nx; w2++) for (let b2 = 0; b2 < nx; b2++) {
        if (w2 === b2) continue;
        for (const side of ["white", "black"]) {
          count++;
          const s = { nx, ny: 2, white: [w1, w2], black: [b1, b2], turn: side };
          if (C.hasMoves(s, side) !== appletHasMoves(nx, s.white, s.black, side)) ok = false;
        }
      }
    }
  }
  check(`"has a move" agrees with the applet's ThereAreMoves on all ${count} two-row positions of boards 2 to 6 wide`, ok);
  // and the number of moves is the number of empty squares on a checker's side
  let moves = true;
  for (let nx = 3; nx <= 6; nx++) for (let w = 0; w < nx; w++) for (let b = 0; b < nx; b++) {
    if (w === b) continue;
    const s = { nx, ny: 1, white: [w], black: [b], turn: "white" };
    const expect = w < b ? b - 1 : nx - 1 - b - 1; // squares strictly on w's side of b, minus w itself
    const free = w < b ? b : nx - 1 - b; // cells on w's side of b
    if (C.legalMoves(s, "white").length !== free - 1 || free - 1 !== (w < b ? expect : expect + 0)) moves = false;
  }
  check("the number of white's moves in a row is the squares on its side of black, less its own square", moves);
}

/* -------------------------- 3. the computer's moves against MakeMove literally */
{
  function applet(s, random) {
    const NY = s.ny, NX = s.nx, heaps = new Array(NY);
    let x = 0;
    for (let i = 0; i < NY; i++) { heaps[i] = Math.abs(s.white[i] - s.black[i]) - 1; x ^= heaps[i]; }
    let pt;
    if (x === 0) pt = makeRandom(); else pt = makeRight(x);
    return { row: pt.x, to: pt.y };
    function makeRight(xr) {
      let m = 0, idx = 0, d;
      for (let i = 0; i < NY; i++) if (m < (heaps[i] & xr)) { m = heaps[i] & xr; idx = i; }
      d = heaps[idx] - (xr ^ heaps[idx]);
      const bc = s.black[idx];
      return { x: idx, y: s.white[idx] > s.black[idx] ? bc + d : bc - d };
    }
    function makeRandom() {
      let L1 = -1, L2 = 0;
      for (L2 = 0; L2 < NY; L2++) { L1 = heaps[L2]; if (L1 !== 0) break; }
      if (L2 < NY && L1 !== 0) {
        const d = Math.trunc(L1 * random() + 1), bc = s.black[L2];
        return { x: L2, y: s.white[L2] > s.black[L2] ? bc + d : bc - d };
      }
      for (let i = 0; i < NY; i++) { const b = s.black[i]; if (b !== 0 && b < s.white[i]) return { x: i, y: Math.trunc(b * random()) }; }
      for (let i = 0; i < NY; i++) { const b = s.black[i]; if (b !== NX - 1 && b > s.white[i]) return { x: i, y: b + Math.trunc((NX - b - 1) * random() + 1) }; }
      return { x: 0, y: 0 };
    }
  }
  const r = rng(99);
  let ok = true, legal = true, n = 0;
  for (let t = 0; t < 100000; t++) {
    const nx = 11 + Math.floor(r() * 10), ny = 2 + Math.floor(r() * 8);
    const s = C.start({ nx, ny, random: r });
    const s2 = { ...s, turn: "black" };
    // sometimes a board with many zero gaps, so the retreat branches are reached
    if (t % 3 === 0) for (let i = 0; i < ny; i++) if (r() < 0.8) s2.black[i] = Math.max(0, Math.min(nx - 1, s2.white[i] + (r() < 0.5 ? 1 : -1)));
    if (!s2.white.every((w, i) => w !== s2.black[i])) continue;
    if (!C.hasMoves(s2, "black")) continue;
    n++;
    const seed = r();
    const mine = C.computerMove(s2, () => seed), ref = applet(s2, () => seed);
    if (JSON.stringify(mine) !== JSON.stringify(ref)) ok = false;
    if (!C.move(s2, "black", mine.row, mine.to)) legal = false;
  }
  check(`the computer's move equals the applet's MakeMove on ${n} random positions (with the same random numbers)`, ok);
  check("and it is always a legal move", legal);
}

/* ------------ 4. solve the whole game on small boards: it is Nim in disguise */
{
  // Positions: (white cols, black cols, side to move). Solve by retrograde analysis:
  // the side to move with no move loses; a position is lost if every move leads to a won position;
  // won if some move leads to a lost one; anything left is a draw (the game going on for ever).
  function solve(nx, ny) {
    const pairs = [];
    for (let w = 0; w < nx; w++) for (let b = 0; b < nx; b++) if (w !== b) pairs.push([w, b]);
    const P = pairs.length;
    const total = Math.pow(P, ny) * 2;
    const dec = (code) => { const rows = []; let c = code >> 1; for (let r = 0; r < ny; r++) { rows.push(pairs[c % P]); c = Math.floor(c / P); } return { rows, side: code & 1 }; };
    const enc = (rows, side) => { let c = 0; for (let r = ny - 1; r >= 0; r--) c = c * P + rows[r].idx; return c * 2 + side; };
    pairs.forEach((p, i) => { p.idx = i; });
    const state = new Int8Array(total); // 0 unknown, 1 won for side to move, -1 lost
    const succ = (code) => {
      const { rows, side } = dec(code), out = [];
      for (let r = 0; r < ny; r++) {
        const [w, b] = rows[r], me = side === 0 ? w : b, other = side === 0 ? b : w;
        const lo = me < other ? 0 : other + 1, hi = me < other ? other - 1 : nx - 1;
        for (let c = lo; c <= hi; c++) if (c !== me) {
          const nr = rows.slice(); nr[r] = side === 0 ? pairs[pairs.findIndex((q) => q[0] === c && q[1] === b)] : pairs[pairs.findIndex((q) => q[0] === w && q[1] === c)];
          out.push(enc(nr, 1 - side));
        }
      }
      return out;
    };
    const succs = new Array(total);
    for (let c = 0; c < total; c++) succs[c] = succ(c);
    const preds = Array.from({ length: total }, () => []);
    for (let c = 0; c < total; c++) for (const t of succs[c]) preds[t].push(c);
    const pending = new Int32Array(total);
    const queue = [];
    for (let c = 0; c < total; c++) { pending[c] = succs[c].length; if (succs[c].length === 0) { state[c] = -1; queue.push(c); } }
    while (queue.length) {
      const c = queue.pop();
      for (const p of preds[c]) {
        if (state[p] !== 0) continue;
        if (state[c] === -1) { state[p] = 1; queue.push(p); }
        else if (--pending[p] === 0) { state[p] = -1; queue.push(p); }
      }
    }
    return { total, dec, state };
  }
  for (const [nx, ny] of [[4, 1], [5, 1], [6, 1], [4, 2], [5, 2], [6, 2], [7, 2], [4, 3], [5, 3], [6, 3]]) {
    const { total, dec, state } = solve(nx, ny);
    let draws = 0, mismatch = 0;
    for (let c = 0; c < total; c++) {
      if (state[c] === 0) { draws++; continue; }
      const { rows } = dec(c);
      const x = rows.reduce((t, [w, b]) => t ^ (Math.abs(w - b) - 1), 0);
      if ((state[c] === -1) !== (x === 0)) mismatch++;
    }
    check(`${nx} wide, ${ny} row${ny > 1 ? "s" : ""}: all ${total} positions solved: no draws, and the side to move loses exactly when the nim-sum of the gaps is 0`, draws === 0 && mismatch === 0, `draws ${draws}, mismatches ${mismatch}`);
  }
}

/* --------- 5. play whole games: the computer against opponents, ends always */
{
  const r = rng(5);
  const perfectMove = (s) => C.hint(s) || (() => { const ms = C.legalMoves(s, "white"); return ms[Math.floor(r() * ms.length)]; })();
  const randomMove = (s, side) => { const ms = C.legalMoves(s, side); return ms[Math.floor(r() * ms.length)]; };
  let cWins = 0, zeroStarts = 0, hWins = 0, nonzeroStarts = 0, longest = 0, finished = true;
  for (let g = 0; g < 4000; g++) {
    for (const mode of ["random", "perfect"]) {
      let s = C.start({ nx: 11 + Math.floor(r() * 10), ny: 2 + Math.floor(r() * 6), random: r });
      const zero = C.nimSum(s) === 0;
      if (C.result(s)) continue;
      let plies = 0;
      while (!C.result(s)) {
        const mv = s.turn === "white" ? (mode === "perfect" ? perfectMove(s) : randomMove(s, "white")) : C.computerMove(s, r);
        const next = C.move(s, s.turn, mv.row, mv.to);
        if (!next) { finished = false; break; }
        s = next;
        if (++plies > 4000) { finished = false; break; }
      }
      longest = Math.max(longest, plies);
      const res = C.result(s);
      if (zero) { zeroStarts++; if (res === "lose") cWins++; }
      else if (mode === "perfect") { nonzeroStarts++; if (res === "win") hWins++; }
    }
  }
  check(`every one of the games ended in a legal sequence (the longest took ${longest} moves)`, finished);
  equal(`from a nim-sum 0 start the computer won all ${zeroStarts} games against random and against perfect players`, cWins, zeroStarts);
  equal(`from any other start a perfect player won all ${nonzeroStarts} games against the computer`, hWins, nonzeroStarts);
}

done("northcotts-game");
