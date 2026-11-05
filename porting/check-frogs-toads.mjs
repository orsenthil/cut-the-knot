#!/usr/bin/env node
"use strict";

/*
 * Logic test for frogs-toads/frogs-toads-core.js.
 *
 * The puzzle: N frogs on the left of a row, M toads on the right, one empty
 * square between. Frogs move right, toads left, by a slide into the empty
 * square or a jump over one animal of the other kind. Swap the two sides.
 *
 * What is checked, for every N and M the applet offers (1 to 5 each):
 *
 *   1. The core against the applet itself. FrogsAndToadsGame's int-array
 *      code (1 = left kind, 2 = right kind, 0 = empty) is written out again
 *      here from the bytecode, and the two are walked side by side through
 *      every reachable position: same legal pieces, same result of every
 *      move, same S/J and hole-move strings, same Finished()/OutOfMoves(),
 *      and undo returns exactly the previous position.
 *   2. The cut-the-knot page's claims, by enumerating every game. Where the
 *      enumeration disagrees with the page, the true statement is tested and
 *      the page's "Look for the math" says so:
 *      - every solution takes MN + M + N moves: MN jumps, M + N slides;
 *      - every S/J string is a palindrome;
 *      - with at least two animals a side there are exactly two solutions,
 *        with the same S/J string and different hole strings (the page says
 *        two for every N and M);
 *      - with a single frog or a single toad the number of solutions is the
 *        Fibonacci number F(k + 2), k being the size of the other side;
 *      - with at least two a side, the hole strings are palindromes exactly
 *        when N + M is even (the page says: exactly when M = N).
 *   3. The page's strategy remarks: with at least two a side, after the
 *      first move only one move keeps the puzzle solvable; and a Jump/Jump
 *      choice is always fatal, on every board.
 *   4. Dead ends are reachable on every board but 1 by 1, so "You are
 *      stuck!" can really be shown.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const F = loadCore("frogs-toads/frogs-toads-core.js", "FrogsToadsCore");
const { EMPTY, FROG, TOAD } = F;

const show = (s) => s.cells.map((v) => ".FT"[v]).join("");
const clone = (s) => ({ ...s, cells: s.cells.slice(), history: s.history.slice() });

/* ------------------------------------------- the applet, from the bytecode */

function appletGame(n1, n2) {
  const m = 1;
  const n = n1 + n2 + m;
  // InitValues(): the first N1 squares 1, square N1 cleared, the last N2 squares 2.
  const v = new Array(n).fill(0);
  for (let i = 0; i < n1; i++) v[i] = 1;
  v[n1] = 0;
  for (let i = n - n2; i < n; i++) v[i] = 2;
  return { n1, n2, n, v, stack: [], moves: "", hole: "" };
}

function appletCanMove(g, i) {
  const v = g.v;
  if (v[i] === 2) {
    if (i > 0 && v[i - 1] === 0) return true;
    if (i > 1 && v[i - 1] === 1 && v[i - 2] === 0) return true;
  } else if (v[i] === 1) {
    if (i < g.n - 1 && v[i + 1] === 0) return true;
    if (i < g.n - 2 && v[i + 1] === 2 && v[i + 2] === 0) return true;
  }
  return false;
}

function appletMakeMove(g, i) {
  const v = g.v;
  if (v[i] === 2) {
    if (i > 0 && v[i - 1] === 0) {
      v[i - 1] = 2; v[i] = 0; g.stack.push([i, i - 1]); g.moves += "S"; g.hole += "r"; return true;
    }
    if (i > 1 && v[i - 1] === 1 && v[i - 2] === 0) {
      v[i - 2] = 2; v[i] = 0; g.stack.push([i, i - 2]); g.moves += "J"; g.hole += "R"; return true;
    }
  } else if (v[i] === 1) {
    if (i < g.n - 1 && v[i + 1] === 0) {
      v[i + 1] = 1; v[i] = 0; g.stack.push([i, i + 1]); g.moves += "S"; g.hole += "l"; return true;
    }
    if (i < g.n - 2 && v[i + 1] === 2 && v[i + 2] === 0) {
      v[i + 2] = 1; v[i] = 0; g.stack.push([i, i + 2]); g.moves += "J"; g.hole += "L"; return true;
    }
  }
  return false;
}

function appletFinished(g) {
  for (let i = 0; i < g.n2; i++) if (g.v[i] !== 2) return false;
  for (let i = g.n - g.n1; i < g.n; i++) if (g.v[i] !== 1) return false;
  return true;
}

function appletOutOfMoves(g) {
  for (let i = 0; i < g.n; i++) if (g.v[i] !== 0 && appletCanMove(g, i)) return false;
  return true;
}

/* ---------------------------------------------- 1. core matches the applet */

for (const N of F.COUNTS) {
  for (const M of F.COUNTS) {
    const label = `${N} frogs, ${M} toads`;
    const s0 = F.start(N, M);
    const g0 = appletGame(N, M);
    equal(`${label}: opening row`, s0.cells, g0.v);
    equal(`${label}: row length`, s0.cells.length, N + M + 1);

    let positions = 0;
    let mismatches = 0;
    const seen = new Set();
    (function walk(s, g) {
      const key = show(s) + "|" + s.moves + "|" + s.holeMoves;
      if (seen.has(key)) return;
      seen.add(key);
      positions++;
      if (F.won(s) !== appletFinished(g)) mismatches++;
      if (F.stuck(s) !== appletOutOfMoves(g)) mismatches++;
      for (let i = 0; i < s.cells.length; i++) {
        const canCore = s.cells[i] !== EMPTY && !!F.target(s, i);
        if (canCore !== (g.v[i] !== 0 && appletCanMove(g, i))) mismatches++;
        const s2 = clone(s);
        const g2 = { ...g, v: g.v.slice(), stack: g.stack.slice() };
        const ok = F.move(s2, i);
        if (ok !== appletMakeMove(g2, i)) { mismatches++; continue; }
        if (!ok) continue;
        if (show(s2) !== g2.v.map((x) => ".FT"[x]).join("")) mismatches++;
        if (s2.moves !== g2.moves || s2.holeMoves !== g2.hole) mismatches++;
        const s3 = clone(s2);
        F.undo(s3);
        if (show(s3) !== show(s) || s3.moves !== s.moves || s3.holeMoves !== s.holeMoves) mismatches++;
        walk(s2, g2);
      }
    })(s0, g0);
    check(`${label}: core and applet agree on all ${positions} positions`, mismatches === 0, `${mismatches} mismatches`);
  }
}

{
  const s = F.start(3, 3);
  check("undo on a fresh board does nothing", F.undo(s) === false && show(s) === "FFF.TTT");
  const back = F.start(1, 1);
  back.cells = [EMPTY, FROG, TOAD]; // the hole is behind the frog and the toad
  check("a frog cannot move backwards", F.target(back, 1) === null);
  const t = F.start(2, 2); // FF.TT
  check("cannot jump over your own kind", F.target(t, 0) === null);
  check("toad slides left into the hole", F.move(t, 3) && show(t) === "FFT.T" && t.holeMoves === "r");
  check("frog jumps the toad", F.move(t, 1) && show(t) === "F.TFT" && t.moves === "SJ" && t.holeMoves === "rL");
}

/* -------------------------------------- 2 and 3. every game, enumerated */

const isPal = (str) => str === [...str].reverse().join("");
const fib = (k) => { let a = 0, b = 1; for (let i = 0; i < k; i++) [a, b] = [b, a + b]; return a; };

for (const N of F.COUNTS) {
  for (const M of F.COUNTS) {
    const label = `${N} frogs, ${M} toads`;
    const solutions = [];
    const deadEnds = [];
    let forcedOk = true;
    let jumpJumpFatal = true;
    const solvable = new Map();

    function canSolve(s) {
      const key = show(s);
      if (solvable.has(key)) return solvable.get(key);
      let ok = F.won(s);
      if (!ok) {
        for (let i = 0; i < s.cells.length && !ok; i++) {
          const s2 = clone(s);
          if (F.move(s2, i) && canSolve(s2)) ok = true;
        }
      }
      solvable.set(key, ok);
      return ok;
    }

    (function walk(s) {
      if (F.won(s)) { solutions.push({ moves: s.moves, hole: s.holeMoves }); return; }
      const options = [];
      for (let i = 0; i < s.cells.length; i++) {
        const t = F.target(s, i);
        if (t) options.push({ i, jump: t.jump });
      }
      if (options.length === 0) { deadEnds.push(show(s)); return; }
      const good = options.filter((o) => { const s2 = clone(s); F.move(s2, o.i); return canSolve(s2); });
      if (s.history.length > 0 && good.length > 1) forcedOk = false;
      if (options.length === 2 && options.every((o) => o.jump) && good.length > 0) jumpJumpFatal = false;
      for (const o of options) { const s2 = clone(s); F.move(s2, o.i); walk(s2); }
    })(F.start(N, M));

    const min = F.minimum(N, M);
    const lone = N === 1 || M === 1;
    for (const sol of solutions) {
      equal(`${label}: solution length is MN+M+N`, sol.moves.length, min);
      equal(`${label}: MN jumps`, [...sol.moves].filter((c) => c === "J").length, N * M);
      equal(`${label}: M+N slides`, [...sol.moves].filter((c) => c === "S").length, N + M);
      check(`${label}: S/J string is a palindrome`, isPal(sol.moves), sol.moves);
    }
    if (lone) {
      equal(`${label}: Fibonacci many solutions`, solutions.length, fib(Math.max(N, M) + 2));
    } else {
      equal(`${label}: exactly two solutions`, solutions.length, 2);
      equal(`${label}: both solutions have the same S/J string`, solutions[0].moves, solutions[1].moves);
      check(`${label}: the hole strings differ`, solutions[0].hole !== solutions[1].hole);
      for (const sol of solutions) {
        check(`${label}: hole string palindromic exactly when N+M is even`, isPal(sol.hole) === ((N + M) % 2 === 0), sol.hole);
      }
      check(`${label}: after the first move the right move is forced`, forcedOk);
    }
    check(`${label}: a Jump/Jump choice is always fatal`, jumpJumpFatal);
    if (N + M > 2) check(`${label}: dead ends are reachable`, deadEnds.length > 0);
  }
}

done("frogs-toads");
