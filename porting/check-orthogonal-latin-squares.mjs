#!/usr/bin/env node
"use strict";

/*
 * Logic test for orthogonal-latin-squares/orthogonal-latin-squares-core.js.
 *
 *   node porting/check-orthogonal-latin-squares.mjs
 *
 * The rules (a new board, the shuffles, swaps in one row, rotating a row or a
 * column, the two squares). The definitions, by counting every Latin square of
 * order 2 to 5 and every pair of order 2 to 4: 2, 12, 576 and 161,280 Latin
 * squares; 0, 72 and 6,912 ordered orthogonal pairs (none of order 2). The
 * applet's success test against the true one: it compares only cells that are
 * below and to the right of each other, so it accepts 18,432 pairs of order 4
 * of which only 6,912 are orthogonal (written out here from its bytecode).
 * The constructions: for every order from 3 to 20 that has one, the two squares
 * are Latin and orthogonal; orders 2, 6, 10, 14 and 18 have none here (2 has
 * none at all, shown above; 6 has none by Tarry's 1900 theorem, Euler's 36
 * officers; 10, 14, 18 do exist but need cleverer constructions).
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("orthogonal-latin-squares/orthogonal-latin-squares-core.js", "LatinCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const id = C.start({ n: 4, randomize: false });
  equal("without Randomize each row of both squares is a, b, c, d", [id.left, id.right], [[[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]], [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]]);
  const r = rng(8);
  let perm = true;
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(r() * 19), s = C.start({ n, random: r });
    for (const m of [s.left, s.right]) for (const row of m) if (new Set(row).size !== n || Math.min(...row) !== 0 || Math.max(...row) !== n - 1) perm = false;
  }
  check("with Randomize every row of both squares is a shuffle of the letters (300 boards, orders 2..20)", perm);
  equal("the order is kept in 2..20; the default is 4", [C.start({ n: 1 }).n, C.start({ n: 99 }).n, C.start({}).n], [2, 20, 4]);
  // the applet's shuffle: k from n down to 2, swap row[k-1] with row[floor(random * k)]
  const row = [0, 1, 2, 3, 4], seq = [0.9, 0.1, 0.5, 0.0]; let q = 0;
  const s5 = C.start({ n: 5, random: () => seq[q++ % 4] });
  check("the shuffle is the applet's PermuteRow (swap the last with a random earlier one, then the next)", (() => { const expect = [0, 1, 2, 3, 4]; let i = 0; const rr = () => seq[i++ % 4]; for (let k = 5; k > 1; k--) { const j = Math.floor(rr() * k); [expect[k - 1], expect[j]] = [expect[j], expect[k - 1]]; } return JSON.stringify(s5.left[0]) === JSON.stringify(expect); })());

  const b = { n: 4, left: [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]], right: [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]], apply: "left" };
  const sw = C.swap(b, 1, 0, 1, 3);
  equal("a swap exchanges two letters of the chosen square in one row only", [sw.left[1], sw.right[1], b.left[1]], [[0, 2, 3, 1], [0, 1, 2, 3], [1, 2, 3, 0]]);
  equal("swapping on the right changes the right square", [C.swap({ ...b, apply: "right" }, 0, 1, 0, 2).right[0], C.swap({ ...b, apply: "right" }, 0, 1, 0, 2).left[0]], [[0, 2, 1, 3], [0, 1, 2, 3]]);
  equal("cells in different rows (or the same cell, or off the board) cannot be swapped", [C.swap(b, 0, 0, 1, 0), C.swap(b, 0, 0, 0, 0), C.swap(b, 0, 0, 0, 4), C.swap(b, -1, 0, -1, 1)], [null, null, null, null]);
  equal("rotate a row left and right", [C.rotateRow(b, 1, "left").left[1], C.rotateRow(b, 1, "right").left[1]], [[2, 3, 0, 1], [0, 1, 2, 3]]);
  equal("rotate a column up and down", [C.rotateCol(b, 0, "up").left.map((x) => x[0]), C.rotateCol(b, 0, "down").left.map((x) => x[0])], [[1, 2, 3, 0], [3, 0, 1, 2]]);
  equal("bad rotations are refused", [C.rotateRow(b, 4, "left"), C.rotateRow(b, 0, "up"), C.rotateCol(b, 0, "left"), C.rotateCol(b, -1, "up")], [null, null, null, null]);
  equal("choosing the square", [C.setApply(b, "right").apply, C.setApply(b, "both")], ["right", null]);
  equal("the old board is untouched", [b.left[1], b.apply], [[1, 2, 3, 0], "left"]);
  const st = C.status(b);
  equal("the cyclic square i + j is Latin; the all-rows-equal right square is not; so not solved", [st.latinLeft, st.latinRight, C.solved(b)], [true, false, false]);
  // rotating a row or column of a Latin square can stop it being Latin; rows stay permutations when rotated
  let rowsOk = true;
  for (let t = 0; t < 200; t++) { const s = C.start({ n: 6, random: r }); const x = C.rotateRow(s, t % 6, t % 2 ? "left" : "right"); if (new Set(x.left[t % 6]).size !== 6 && s.apply === "left") rowsOk = false; }
  check("rotating a row keeps it a shuffle of the letters", rowsOk);
}

/* ------------------------------ 2. count Latin squares and orthogonal pairs */
{
  function latinSquares(n) {
    const out = [], sq = Array.from({ length: n }, () => new Array(n).fill(-1));
    (function go(pos) {
      if (pos === n * n) { out.push(sq.map((r) => r.slice())); return; }
      const r = Math.floor(pos / n), c = pos % n;
      for (let v = 0; v < n; v++) {
        let ok = true;
        for (let k = 0; k < c; k++) if (sq[r][k] === v) ok = false;
        for (let k = 0; k < r; k++) if (sq[k][c] === v) ok = false;
        if (!ok) continue;
        sq[r][c] = v; go(pos + 1); sq[r][c] = -1;
      }
    })(0);
    return out;
  }
  const L = {};
  for (let n = 2; n <= 5; n++) L[n] = latinSquares(n);
  equal("the number of Latin squares of order 2, 3, 4, 5", [2, 3, 4, 5].map((n) => L[n].length), [2, 12, 576, 161280]);
  check("isLatin accepts every one of them", [2, 3, 4].every((n) => L[n].every((m) => C.isLatin(m))));
  let notLatin = true;
  for (const n of [3, 4]) for (const m of L[n]) { const bad = m.map((r) => r.slice()); [bad[0][0], bad[0][1]] = [bad[0][1], bad[0][0]]; if (C.isLatin(bad)) notLatin = false; }
  check("and refuses a Latin square with two letters swapped in one row (orders 3 and 4: its columns break)", notLatin);

  // ordered pairs that are orthogonal, by the definition and by the core; and by the applet's own loops
  function appletCheck(A, B, n) {
    // CheckFinished, second half: every cell against cells strictly below AND strictly to the right
    for (let r1 = 0; r1 < n; r1++) for (let c1 = 0; c1 < n; c1++) for (let r2 = r1 + 1; r2 < n; r2++) for (let c2 = c1 + 1; c2 < n; c2++) if (A[r1][c1] === A[r2][c2] && B[r1][c1] === B[r2][c2]) return false;
    return true;
  }
  const counts = {};
  for (const n of [2, 3, 4]) {
    let orth = 0, weak = 0, mismatch = 0;
    for (const A of L[n]) for (const B of L[n]) {
      const truth = new Set(A.flatMap((row, i) => row.map((v, j) => v * n + B[i][j]))).size === n * n;
      const board = { n, left: A, right: B, apply: "left" };
      if (C.solved(board) !== truth) mismatch++;
      if (truth) orth++;
      if (appletCheck(A, B, n)) weak++;
    }
    counts[n] = { orth, weak, mismatch };
  }
  equal("ordered orthogonal pairs of Latin squares: none of order 2, 72 of order 3, 6,912 of order 4", [counts[2].orth, counts[3].orth, counts[4].orth], [0, 72, 6912]);
  equal("the core's verdict equals the definition on every pair of order 2, 3 and 4", [counts[2].mismatch, counts[3].mismatch, counts[4].mismatch], [0, 0, 0]);
  equal("the applet's weaker test accepts 72 pairs of order 3 (all orthogonal) but 18,432 of order 4, of which only 6,912 are orthogonal", [counts[3].weak, counts[4].weak], [72, 18432]);
  // an actual example for the page: two Latin squares of order 4 that the applet would call solved but are not orthogonal
  let example = null;
  for (const A of L[4]) { for (const B of L[4]) { if (appletCheck(A, B, 4) && !C.solved({ n: 4, left: A, right: B, apply: "left" })) { example = [A, B]; break; } } if (example) break; }
  check("such an example exists, and the core refuses it", example !== null && C.repeatedPairs({ n: 4, left: example[0], right: example[1], apply: "left" }).length > 0);
  // some Latin square of order 5 has an orthogonal mate (the construction below also shows that)
  const A5 = C.solution(5)[0];
  let mates = 0;
  for (const B of L[5]) if (C.solved({ n: 5, left: A5, right: B, apply: "left" })) mates++;
  check(`the cyclic Latin square of order 5 (i + j) has ${mates} orthogonal mates among the 161,280`, mates > 0);
}

/* ------------------------------------------------- 3. the constructions */
{
  const built = [], none = [];
  let ok = true;
  for (let n = 2; n <= 20; n++) {
    const s = C.solution(n);
    if (!s) { none.push(n); continue; }
    built.push(n);
    const board = { n, left: s[0], right: s[1], apply: "left" };
    const st = C.status(board);
    if (!st.solved || !C.solved(C.solved_board(n)) || s[0].length !== n || s[0].some((r) => r.length !== n)) ok = false;
    if (s[0].some((r) => r.some((v) => v < 0 || v >= n)) || s[1].some((r) => r.some((v) => v < 0 || v >= n))) ok = false;
  }
  check(`orders ${built.join(", ")}: each construction gives two Latin squares that are orthogonal`, ok);
  equal("orders without a construction here: 2, 6, 10, 14, 18", none, [2, 6, 10, 14, 18]);
  // every Latin square pair the construction gives keeps every letter: both squares use letters 0..n-1 only
  const s8 = C.solution(8);
  check("order 8 (the field with 8 elements) and order 12 (4 times 3) have the full set of letters in each row", s8[0].every((r) => new Set(r).size === 8) && C.solution(12)[0].every((r) => new Set(r).size === 12));
}

/* ------------------------- 4. every move can be undone, so no move can spoil a board for good */
{
  const r = rng(12);
  let undo = true, n = 0;
  for (let t = 0; t < 3000; t++) {
    const size = 2 + Math.floor(r() * 7), s = { ...C.start({ n: size, random: r }), apply: r() < 0.5 ? "left" : "right" };
    const i = Math.floor(r() * size), j = Math.floor(r() * size), key = (x) => JSON.stringify([x.left, x.right]);
    const kind = t % 3;
    let moved, back;
    if (kind === 0) { moved = C.swap(s, i, 0, i, size - 1); back = moved && C.swap(moved, i, 0, i, size - 1); }
    else if (kind === 1) { const d = r() < 0.5 ? "left" : "right"; moved = C.rotateRow(s, i, d); back = C.rotateRow(moved, i, d === "left" ? "right" : "left"); }
    else { const d = r() < 0.5 ? "up" : "down"; moved = C.rotateCol(s, j, d); back = C.rotateCol(moved, j, d === "up" ? "down" : "up"); }
    n++;
    if (size === 1 || !back || key(back) !== key(s)) undo = false;
  }
  check(`each swap, row rotation and column rotation is undone by its opposite (${n} random moves)`, undo);
  // a rotation of the whole row by n places is the identity
  const s = C.start({ n: 7, random: r });
  let full = s;
  for (let k = 0; k < 7; k++) full = C.rotateRow(full, 2, "left");
  equal("seven rotations of a row of seven return the row", full.left, s.left);
}

done("orthogonal-latin-squares");
