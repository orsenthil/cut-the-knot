#!/usr/bin/env node
"use strict";

/*
 * Logic test for grundy/grundy-core.js.
 *
 * The game: split one heap into two heaps of different sizes; the player who
 * cannot move (every heap 1 or 2) loses. What is checked:
 *
 *   1. The applet's table GrundyHeap.NimValue (sizes 0-39) equals the mex
 *      rule's values, and so does the cut-the-knot page's table (sizes 0-59,
 *      quoted from Winning Ways).
 *   2. Sprague-Grundy holds: a brute-force win/loss search over EVERY
 *      position of at most 30 squares in total (all 28,628 multisets of
 *      heaps) agrees that the player to move loses exactly when the XOR of
 *      the heaps' values is 0.
 *   3. The computer's good move, from every such position with a non-zero
 *      XOR and in several heap orders, is legal and leaves a losing position.
 *   4. The random move is always legal, never cuts a heap in half, and can
 *      reach every split point 2 .. size-1 the applet's formula allows.
 *   5. start(), playerMove() and the end of the game behave like the applet,
 *      including its quirk that "random" heaps are at least 3 long.
 *   6. Whole games: from a start with XOR 0 the computer beats every one of
 *      a few thousand random opponents; from a start with XOR not 0 the
 *      first player wins by always moving to XOR 0, whatever the computer's
 *      random choices.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const G = loadCore("grundy/grundy-core.js", "GrundyCore");

/* ------------------------------------------------------ 1. the Grundy table */

const mex = (set) => { let m = 0; while (set.has(m)) m++; return m; };
const grundy = [0];
for (let n = 1; n < 60; n++) {
  const opts = new Set();
  for (let a = 1; a < n - a; a++) opts.add(grundy[a] ^ grundy[n - a]);
  grundy.push(mex(opts));
}

equal("applet table has 40 entries", G.NIM_VALUE.length, 40);
equal("applet table = mex rule, sizes 0-39", G.NIM_VALUE, grundy.slice(0, 40));

const PAGE = [
  0, 0, 0, 1, 0, 2, 1, 0, 2, 1,
  0, 2, 1, 3, 2, 1, 3, 2, 4, 3,
  0, 4, 3, 0, 4, 3, 0, 4, 1, 2,
  3, 1, 2, 4, 1, 2, 4, 1, 2, 4,
  1, 5, 4, 1, 5, 4, 1, 5, 4, 1,
  0, 2, 1, 0, 2, 1, 5, 2, 1, 3,
];
equal("page table = mex rule, sizes 0-59", PAGE, grundy);
check("the table covers every heap the board allows", G.MAX_SIZE < G.NIM_VALUE.length);

/* --------------------------------- 2 and 3. every position up to 30 squares */

// Positions as sorted arrays of heap sizes > 2 (heaps of 1 or 2 are dead weight).
const key = (heaps) => heaps.filter((h) => h > 2).sort((a, b) => a - b).join(",");
const memo = new Map();
function toMoveLoses(heaps) {
  const k = key(heaps);
  if (memo.has(k)) return memo.get(k);
  const live = k === "" ? [] : k.split(",").map(Number);
  let loses = true;
  outer: for (let i = 0; i < live.length; i++) {
    for (let a = 1; a < live[i] - a; a++) {
      const next = live.slice();
      next.splice(i, 1, a, live[i] - a);
      if (toMoveLoses(next)) { loses = false; break outer; }
    }
  }
  memo.set(k, loses);
  return loses;
}

function* partitions(n, max = n) {
  if (n === 0) { yield []; return; }
  for (let first = Math.min(n, max); first >= 1; first--) {
    for (const rest of partitions(n - first, first)) yield [first, ...rest];
  }
}

const random = rng(20261105);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.trunc(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const stateOf = (sizes) => ({
  heaps: sizes.map((size, i) => ({ id: i, row: i, at: 0, size })),
  nextId: sizes.length, turn: "computer", over: false, winner: null, last: null,
});

let positions = 0;
let sgMismatch = 0;
let goodBad = 0;
let goodMissing = 0;
for (let n = 1; n <= 30; n++) {
  for (const sizes of partitions(n)) {
    positions++;
    const xor = sizes.reduce((x, h) => x ^ grundy[h], 0);
    if (toMoveLoses(sizes) !== (xor === 0)) sgMismatch++;
    if (xor === 0) continue;
    for (const order of [sizes, sizes.slice().reverse(), shuffle(sizes.slice())]) {
      const s = stateOf(order);
      const m = G.goodMove(s);
      if (!m) { goodMissing++; continue; }
      if (m.k < 1 || m.k >= m.heap.size || m.k === m.heap.size - m.k) { goodBad++; continue; }
      const after = s.heaps.filter((h) => h !== m.heap).map((h) => h.size).concat([m.k, m.heap.size - m.k]);
      if (!toMoveLoses(after)) goodBad++;
    }
  }
}
equal("positions of up to 30 squares", positions, 28628);
check("Sprague-Grundy: loses exactly when the XOR is 0", sgMismatch === 0, `${sgMismatch} mismatches`);
check("a good move exists whenever the XOR is not 0", goodMissing === 0, `${goodMissing} missing`);
check("every good move is legal and leaves a lost position", goodBad === 0, `${goodBad} bad`);

/* ------------------------------------------------------ 4. the random move */

{
  const seen = new Map();
  let illegal = 0;
  for (let t = 0; t < 4000; t++) {
    const size = 3 + (t % 28);
    const s = stateOf([size, 1, 2]);
    // Force the random branch: make the XOR 0 by pairing the heap with an equal one.
    s.heaps.push({ id: 9, row: 1, at: 0, size });
    s.nextId = 10;
    const before = s.heaps.map((h) => h.size);
    const m = G.computerMove(s, random);
    const cut = m.k;
    if (cut < 2 || cut > size - 1 || cut === size - cut) illegal++;
    if (s.heaps.length !== before.length + 1) illegal++;
    if (!seen.has(size)) seen.set(size, new Set());
    seen.get(size).add(Math.min(cut, size - cut));
  }
  check("random moves are legal and never halve a heap", illegal === 0, `${illegal} illegal`);
  let gaps = 0;
  for (const [size, cuts] of seen) {
    for (let k = 2; k <= size - 1; k++) {
      if (k !== size - k && !cuts.has(Math.min(k, size - k))) gaps++;
    }
  }
  check("random moves reach every split the applet's formula allows", gaps === 0, `${gaps} never seen`);
}

/* ------------------------------------ 5. start, your move, the end of game */

{
  const s = G.start(G.DEFAULT_SIZE, G.DEFAULT_HEAPS);
  equal("the applet opens on one heap of 15", s.heaps.map((h) => h.size), [15]);
  equal("you move first", s.turn, "you");

  const r = G.start(20, 8, true, random);
  equal("random: first heap is the maximum", r.heaps[0].size, 20);
  check("random: the others are 3 .. max", r.heaps.slice(1).every((h) => h.size >= 3 && h.size <= 20));
  equal("random with max 2: the applet still makes heaps of 3", G.start(2, 3, true, () => 0.99).heaps.map((h) => h.size), [2, 3, 3]);
  check("not random: every heap is the maximum", G.start(9, 4, false).heaps.every((h) => h.size === 9));

  const t = G.start(8, 1);
  equal("cutting a heap in half is refused", G.playerMove(t, 0, 4), "equal");
  equal("cutting outside the heap does nothing", G.playerMove(t, 0, 8), "none");
  equal("a legal cut", G.playerMove(t, 0, 3), "ok");
  equal("the halves keep their place", t.heaps.map((h) => [h.at, h.size]), [[0, 3], [3, 5]]);
  equal("then it is the computer's turn", t.turn, "computer");
  equal("you cannot move on its turn", G.playerMove(t, t.heaps[0].id, 1), "none");

  const end = G.start(4, 1);
  G.playerMove(end, 0, 1); // 1 + 3
  G.computerMove(end, random); // 3 -> 2 + 1: no long heap
  check("the computer's last split wins", end.over && end.winner === "computer");
  const mine = G.start(3, 1);
  G.playerMove(mine, 0, 1);
  check("your last split wins", mine.over && mine.winner === "you");
}

/* ------------------------------------------------------- 6. whole games */

{
  let computerLost = 0;
  let games = 0;
  for (const size of [7, 20, 23, 26]) {
    equal(`heap ${size} has Grundy number 0`, grundy[size], 0);
    for (let t = 0; t < 1000; t++) {
      const s = G.start(size, 1);
      while (!s.over) {
        // A random opponent: any legal unequal cut.
        const cuts = [];
        for (const h of s.heaps) for (let k = 1; k < h.size; k++) if (k !== h.size - k) cuts.push([h.id, k]);
        const [id, k] = cuts[Math.trunc(random() * cuts.length)];
        G.playerMove(s, id, k);
        if (!s.over) G.computerMove(s, random);
      }
      games++;
      if (s.winner !== "computer") computerLost++;
    }
  }
  check(`the computer wins every one of ${games} games from an XOR-0 start`, computerLost === 0, `${computerLost} lost`);

  let firstLost = 0;
  let wins = 0;
  for (let size = 3; size <= G.MAX_SIZE; size++) {
    if (grundy[size] === 0) continue;
    for (let t = 0; t < 60; t++) {
      const s = G.start(size, 1);
      while (!s.over) {
        // Perfect play for you: the same rule, applied on your turn.
        const m = G.goodMove({ ...s, turn: "computer" });
        G.playerMove(s, m.heap.id, m.k);
        if (!s.over) G.computerMove(s, random);
      }
      wins++;
      if (s.winner !== "you") firstLost++;
    }
  }
  check(`moving to XOR 0 wins all ${wins} games from a winning start`, firstLost === 0, `${firstLost} lost`);
}

done("grundy");
