#!/usr/bin/env node
"use strict";

/*
 * Logic test for make-move/make-move-core.js.
 *
 *   1. A second, literal transcription of the applet's ResetArray, Cheat,
 *      ToString, Shift (all four shift helpers) and its finished test, compared
 *      with the core on every square from many boards, including every board
 *      reachable within five slides and a deterministic set of shuffles.
 *   2. The page's claims: inversion counts of the four interesting boards,
 *      the parity invariant, and the claim that the swapped board has the
 *      same parity as a spelled message with its two O counters traded. The
 *      parity criterion for these very slide rules is checked exhaustively on
 *      the 3x3 version (all 9! boards), where full search is possible.
 *   3. Rule edge cases and the unsatisfiable win test in the original applet.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("make-move/make-move-core.js", "MakeMoveCore");

/* ------------------------------------- a literal second reading of the Java */

/* ResetArray(): values[i][j] = i*N + j + 1. */
function javaResetArray(n) {
  const a = [];
  for (let i = 0; i < n; i++) {
    a[i] = [];
    for (let j = 0; j < n; j++) a[i][j] = i * n + j + 1;
  }
  return a;
}

/* Cheat(): swap the last two counters, unless the gap is in one of them. */
function javaCheat(a, n) {
  const sq = n * n;
  let k = n - 1;
  if (a[n - 3][n - 1] === sq || a[n - 2][n - 1] === sq) k = n - 2;
  const t = a[n - 3][k];
  a[n - 3][k] = a[n - 2][k];
  a[n - 2][k] = t;
  return a;
}

/* ToString(): the tableswitch in the bytecode. */
function javaToString(v) {
  return ["", "M", "A", "K", "E", "Y", "O", "U", "R", "M", "O", "V", "E,", "K", "I", "D!"][v] || "";
}

/* The four Shift helpers, in the bytecode's (a, b, c) argument order. */
function javaShiftTop(a, p, q, s) { for (let t = s; t < q; t++) a[p][t] = a[p][t + 1]; a[p][q] = a.length * a.length; }
function javaShiftBottom(a, p, q, s) { for (let t = s; t > q; t--) a[p][t] = a[p][t - 1]; a[p][q] = a.length * a.length; }
function javaShiftLeft(a, p, q, s) { for (let t = s; t < q; t++) a[t][p] = a[t + 1][p]; a[q][p] = a.length * a.length; }
function javaShiftRight(a, p, q, s) { for (let t = s; t > q; t--) a[t][p] = a[t - 1][p]; a[q][p] = a.length * a.length; }

/* Shift(): find the gap, then slide its whole row or column into hit. */
function javaShift(values, hit) {
  const a = values.map((row) => row.slice()), n = a.length, sq = n * n;
  let searching = true, i = 0, j = 0;
  for (i = 0; i < n && searching; i++) {
    for (j = 0; j < n; j++) if (a[i][j] === sq) { searching = false; break; }
  }
  if (searching) return a;
  i--; // the loop advanced i once more between finding the gap and stopping
  if (hit.x === i) {
    if (hit.y > j) javaShiftTop(a, i, hit.y, j);
    else if (hit.y < j) javaShiftBottom(a, i, hit.y, j);
  } else if (hit.y === j) {
    if (hit.x > i) javaShiftLeft(a, j, hit.x, i);
    else if (hit.x < i) javaShiftRight(a, j, hit.x, i);
  }
  return a;
}

/*
 * Shift()'s finish test, transcribed literally. It demands 10 at (1,1),
 * 6 at (1,2) and the ordinary value everywhere else — including 10 at
 * (2,1) — so it asks for two copies of tile 10 and never for tile 7.
 */
function javaFinished(values) {
  const n = values.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (n === 4 && i === 1 && j === 1) { if (values[i][j] !== 10) return false; continue; }
      if (n === 4 && i === 1 && j === 2) { if (values[i][j] !== 6) return false; continue; }
      if (values[i][j] !== i * n + j + 1) return false;
    }
  }
  return true;
}

/* A board with the two O counters traded: the goal the page describes. */
function oSwapped(n = 4) {
  const a = javaResetArray(n);
  const t = a[1][1]; a[1][1] = a[2][1]; a[2][1] = t;
  return a;
}
/* A board with the two M counters traded: same letters, wrong counter order. */
function mSwapped(n = 4) {
  const a = javaResetArray(n);
  const t = a[0][0]; a[0][0] = a[2][0]; a[2][0] = t;
  return a;
}

const keyOf = (values) => values.map((row) => row.join(",")).join(";");

/* Breadth-first walk over boards under the applet's own slide rules. */
function reachable(n, maxDepth, from) {
  const first = from || C.start({ n });
  const depths = new Map([[keyOf(first.values), 0]]);
  const queue = [first];
  for (let head = 0; head < queue.length; head++) {
    const s = queue[head], depth = depths.get(keyOf(s.values));
    if (depth >= maxDepth) continue;
    for (const cell of C.legalMoves(s)) {
      const next = C.move(s, cell), k = keyOf(next.values);
      if (!depths.has(k)) { depths.set(k, depth + 1); queue.push(next); }
    }
  }
  return queue;
}

/* Deterministic shuffles of the tile order, for the Java-vs-core comparison. */
function shuffles(count) {
  const out = [], a = javaResetArray(4);
  let s = 123456789;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let k = 0; k < count; k++) {
    const flat = [].concat(...a.map((row) => row.slice()));
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = flat[i]; flat[i] = flat[j]; flat[j] = t;
    }
    const grid = [];
    for (let c = 0; c < 4; c++) grid.push(flat.slice(c * 4, c * 4 + 4));
    out.push({ n: 4, values: grid, moves: k, last: null });
  }
  return out;
}

/* ------------------------------------------------------- 1. the start boards */

equal("start is the applet's ResetArray board", C.start({}).values, javaResetArray(4));
equal("Reset is ResetArray followed by Cheat", C.reset({}).values, javaCheat(javaResetArray(4), 4));
equal("the other board sizes follow the same rule", C.start({ n: 3 }).values, javaResetArray(3));
{
  const labels = [];
  for (let v = 0; v <= 16; v++) labels.push(C.label(v) || "");
  const javaLabels = [];
  for (let v = 0; v <= 16; v++) javaLabels.push(javaToString(v));
  equal("ToString maps all fifteen counters and the gap", labels,
    ["", "M", "A", "K", "E", "Y", "O", "U", "R", "M", "O", "V", "E,", "K", "I", "D!", ""]);
  check("the second transcription has the same table", javaLabels.join("|") === labels.join("|"));
}
{
  const r = C.reset({});
  check("Reset swaps R and E, in the last two counters", C.label(r.values[1][3]) === "E," && C.label(r.values[2][3]) === "R");
  equal("Reset twice gives the same board", C.reset({}).values, r.values);
  check("the opening board already spells the message", C.isSolved(C.start({}).values, 4));
  check("the swapped board does not start out finished", C.result(C.reset({})) === null);
  check("the opening board is not reported as finished either", C.result(C.start({})) === null);
}

/* ------------------------------------------- 2. Slide = Java Shift, everywhere */

{
  const boards = [C.start({}), C.reset({}), C.start({ n: 3 }), ...shuffles(60), ...reachable(4, 5, C.reset({}))];
  let compared = 0;
  for (const s of boards) {
    const n = s.n;
    for (let c = 0; c < n; c++) {
      for (let r = 0; r < n; r++) {
        const hit = { x: c, y: r };
        const mine = C.move(s, hit);
        const java = javaShift(s.values, hit);
        const aligned = (c === C.emptyCell(s).x || r === C.emptyCell(s).y) &&
          !(c === C.emptyCell(s).x && r === C.emptyCell(s).y);
        check(`slide ${c},${r} on a board agrees with Shift (board ${compared})`,
          aligned ? !!mine && equalValues(mine.values, java) : mine === null && equalValues(java, s.values));
        compared++;
      }
    }
  }
  check("every square of every sample board was compared", compared > 8000, String(compared));
}
function equalValues(a, b) { return keyOf(a) === keyOf(b); }

{
  const s = C.reset({}); // gap at column 3, row 3
  const long = C.move(s, { x: 3, y: 0 });
  equal("a long vertical slide moves the whole run", long.values[3], [16, 13, 14, 15]);
  const wide = C.move(C.start({}), { x: 0, y: 3 });
  equal("a long horizontal slide moves the whole run", wide.values.map((row) => row[3]), [16, 4, 8, 12]);
  check("a diagonal square is refused", C.move(s, { x: 0, y: 0 }) === null);
  check("the empty square itself is refused", C.move(s, { x: 3, y: 3 }) === null);
  check("a square off the board is refused", C.move(s, { x: -1, y: 2 }) === null && C.move(s, { x: 2, y: 9 }) === null);
  const gap = C.emptyCell(s);
  equal("legal moves are exactly the gap's row and column", C.legalMoves(s),
    [0, 1, 2, 3].flatMap((c) => [0, 1, 2, 3]
      .filter((r) => (c === gap.x || r === gap.y) && !(c === gap.x && r === gap.y))
      .map((r) => ({ x: c, y: r }))).filter((v, i, all) => all.findIndex((w) => w.x === v.x && w.y === v.y) === i));
}

/* ------------------------------------------------ 3. the page's claims */

{
  const solved = javaResetArray(4), swapped = C.reset({}), oGoal = oSwapped(), mMove = mSwapped();
  equal("solved board has zero inversions", C.inversions(solved, 4), 0);
  equal("the swapped board has seven inversions", C.inversions(swapped.values, 4), 7);
  equal("the O-swapped message has seven inversions too", C.inversions(oGoal, 4), 7);
  equal("the M-swapped message has fifteen inversions", C.inversions(mMove, 4), 15);
  check("the reset board and the O-swapped goal share inversion parity",
    C.inversions(swapped.values, 4) % 2 === C.inversions(oGoal, 4) % 2);
  check("the ordinary goal has the opposite parity",
    C.inversions(solved, 4) % 2 !== C.inversions(swapped.values, 4) % 2);
  check("the intended goal accepts either order of the two O counters",
    C.isSolved(solved, 4) && C.isSolved(oGoal, 4));
  check("the intended goal refuses the swapped M counters",
    !C.isSolved(mMove, 4) && !C.isSolved(swapped.values, 4));
}

{
  /* Every transposition of two numbered counters flips inversion parity;
     two transpositions restore it. (The blank is left out of the count, as
     the puzzle's inversion definition does.) */
  const base = javaResetArray(4).map((row) => row.slice());
  const cells = [];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) if (!(c === 3 && r === 3)) cells.push([c, r]);
  const swapCells = (a, p, q) => {
    const t = a[p[0]][p[1]]; a[p[0]][p[1]] = a[q[0]][q[1]]; a[q[0]][q[1]] = t;
  };
  let pairs = 0, doubles = 0;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = base.map((row) => row.slice());
      const before = C.inversions(a, 4) % 2;
      swapCells(a, cells[i], cells[j]);
      check(`swapping counters ${i},${j} flips inversion parity`, C.inversions(a, 4) % 2 !== before);
      for (let k = 0; k < cells.length; k++) {
        for (let l = k + 1; l < cells.length; l++) {
          const b = a.map((row) => row.slice());
          swapCells(b, cells[k], cells[l]);
          check(`two swaps (${i},${j}) and (${k},${l}) restore parity`,
            C.inversions(b, 4) % 2 === before);
          doubles++;
        }
      }
      pairs++;
    }
  }
  check("all transpositions and all pairs of transpositions were tried", pairs === 105 && doubles === 105 * 105);
}

{
  /* The cut-the-knot theory reads the board in columns (the order in which
     its letters are printed) and adds the empty square's column number: that
     sum has the same parity after every slide. */
  const classOf = (s) => (C.inversions(s.values, 4) + C.emptyCell(s).x + 1) % 2;
  const boards = reachable(4, 5, C.reset({}));
  const parity = classOf(C.reset({}));
  equal("the swapped board is in the odd class", parity, 1);
  equal("the spelled board is in the even class", classOf(C.start({})), 0);
  equal("the O-swapped message is in the odd class", classOf({ n: 4, values: oSwapped() }), 1);
  for (const s of boards) {
    check(`slide preserves the parity class on board ${keyOf(s.values)}`, classOf(s) === parity);
    check(`the applet's unfinished test is never true on ${keyOf(s.values)}`, !javaFinished(s.values));
  }
}

{
  /* Full search on 3x3: these slide rules reach exactly the half of all
     boards with the right inversion parity (the parity criterion itself). */
  const boards = reachable(3, Infinity);
  equal("the 3x3 slide rules reach exactly half of all 9! boards", boards.length, 362880 / 2);
  const parity = C.inversions(C.start({ n: 3 }).values, 3) % 2;
  for (const s of boards) {
    check(`3x3 board ${keyOf(s.values)} has the starting parity`, C.inversions(s.values, 3) % 2 === parity);
  }
}

/* ---------------------------------- 4. the applet's own unsatisfiable test */

{
  equal("the ordinary spelled board fails the applet's test", javaFinished(javaResetArray(4)), false);
  equal("the O-swapped spelled board fails the applet's test", javaFinished(oSwapped()), false);
  equal("the reset board fails the applet's test", javaFinished(C.reset({}).values), false);
  /* It asks for 10 at both (1,1) and (2,1), and never asks for tile 7. */
  const mustBe = new Map();
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let v = c * 4 + r + 1;
      if (c === 1 && r === 1) v = 10;
      if (c === 1 && r === 2) v = 6;
      mustBe.set(v, (mustBe.get(v) || 0) + 1);
    }
  }
  check("the applet's test demands tile 10 in two squares", mustBe.get(10) === 2);
  check("the applet's test never demands tile 7", !mustBe.has(7));
}

/* --------------------------------- 5. an actual way back to the message */

{
  /* Found by A* over these same slide rules; replayed from the Reset board.
     It ends with the two O counters traded, which is the goal the page means. */
  const solution = [
    { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 3 }, { x: 1, y: 3 },
    { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 2, y: 3 },
    { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 },
    { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 3, y: 3 },
  ];
  let s = C.reset({});
  for (const cell of solution) {
    const next = C.move(s, cell);
    check(`solution move ${cell.x},${cell.y} is legal`, !!next);
    if (!next) break;
    s = next;
  }
  equal("the solution takes sixteen slides", s.moves, 16);
  check("the swapped board really can spell the message again", C.isSolved(s.values, 4));
  equal("reaching the message finishes the play", C.result(s), "done");
}

done("make-move");
