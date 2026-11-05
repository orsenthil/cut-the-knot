#!/usr/bin/env node
"use strict";

/*
 * Logic test for dawsons-chess/dawson-core.js.
 *
 * The game: skittles stand at the N places of a ring. A move knocks down one
 * standing skittle together with the two places next to it, so it takes 3 in
 * mid-arc, 2 at the end of an arc and 1 when the skittle is alone. Whoever
 * knocks down the last skittle wins.
 *
 * Nothing here trusts the core's theory. The ground truth is a raw search:
 * `bruteGrundy` reads the ring as a bitmask and takes the mex over the moves of
 * the ring itself, with no arcs, no table and no XOR. Everything the core
 * claims is checked against it:
 *
 *   - `value` on every one of the 2^n ring positions for n = 3..14, which is
 *     the whole Sprague-Grundy story at once: that arcs are independent, that
 *     their nim-values XOR, that `rowGrundy` is right, and that an unbroken
 *     ring is a different game from an arc of the same length;
 *   - `cycleGrundy[n]` for n up to 18, so the deliberate fix to the applet's
 *     handling of a full ring is checked past the sizes the sweep reaches;
 *   - `rowGrundy` against the 136-entry table the applet shipped hard-coded in
 *     DawsonChessGame.<init>, entry for entry, and against the table printed on
 *     the cut-the-knot page;
 *   - `bestMove` played out exhaustively against every possible reply, so it is
 *     confirmed as a winning strategy and not merely a plausible one;
 *   - `openingRing` against the gap arithmetic in DawsonChessCanvas.Reset().
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("dawsons-chess/dawson-core.js", "DawsonCore");

/* --------------------------- 1. the move rule, straight from the bytecode */

{
  // mouseClicked: Exclude(i), Exclude((i+1)%N), Exclude((i-1+N)%N). The
  // neighbours are the fixed places next door, always modulo N, and knocking
  // over a place that is already down does nothing.
  equal("mid-arc: three go down", C.move([1, 1, 1, 1, 1, 0], 2), [1, 0, 0, 0, 1, 0]);
  equal("at the end of an arc: only two go down", C.move([0, 1, 1, 1, 1, 0], 1), [0, 0, 0, 1, 1, 0]);
  equal("a lone skittle: just itself", C.move([0, 1, 0, 1, 1, 0], 1), [0, 0, 0, 1, 1, 0]);
  equal("place 0 reaches round to place N-1", C.move([1, 1, 1, 1, 1], 0), [0, 0, 1, 1, 0]);
  equal("a place that is down cannot be clicked", C.move([0, 1, 1], 0), null);

  const ring = [1, 1, 1, 1];
  C.move(ring, 1);
  equal("move does not mutate its argument", ring, [1, 1, 1, 1]);

  equal("footprint lists only the places still standing", C.footprint([0, 1, 1, 1, 0], 1), [1, 2]);
  equal("a ring of 2: one move clears it", C.move([1, 1], 0), [0, 0]);
  equal("a ring of 1: one move clears it", C.move([1], 0), [0]);
}

/* ------------------------------------------- 2. the position breaks into arcs */

{
  equal("no gaps: one unbroken ring", C.decompose([1, 1, 1]), { full: true, arcs: [{ start: 0, len: 3 }] });
  equal("one gap: one arc, read from the gap", C.decompose([1, 0, 1, 1]), { full: false, arcs: [{ start: 2, len: 3 }] });
  equal("two gaps: two independent arcs", C.decompose([1, 0, 1, 1, 0, 1]), {
    full: false,
    arcs: [{ start: 2, len: 2 }, { start: 5, len: 2 }],
  });
  equal("an empty ring has no arcs", C.decompose([0, 0]), { full: false, arcs: [] });
  equal("an empty ring is worth 0", C.value([0, 0, 0]), 0);

  // Arcs can never merge, which is what makes the position a sum of games.
  const rand = rng(20261105);
  let moves = 0;
  for (let t = 0; t < 3000; t++) {
    const n = 4 + Math.floor(rand() * 12);
    const up = Array.from({ length: n }, () => (rand() < 0.65 ? 1 : 0));
    if (up.every((v) => v === 1)) continue;
    const before = C.decompose(up).arcs.length;
    for (const i of C.legalMoves(up)) {
      moves++;
      const after = C.decompose(C.move(up, i)).arcs;
      check(
        `a move never joins two arcs (n=${n}, ${up.join("")} at ${i})`,
        after.length <= before + 1,
      );
    }
  }
  check(`arc counts checked over ${moves} moves`, moves > 10000, `only ${moves}`);
}

/* --------------------------------- the ground truth: a search with no theory */

/**
 * The true Sprague-Grundy value of a ring position, by definition: the mex of
 * the values of the positions one move leads to. The ring is a bitmask and the
 * moves are taken on the ring itself, so this knows nothing about arcs, about
 * `rowGrundy` or about XOR.
 */
function bruteGrundy(n) {
  const memo = new Map();
  const g = (mask) => {
    if (mask === 0) return 0;
    const hit = memo.get(mask);
    if (hit !== undefined) return hit;
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      const hitMask = (1 << i) | (1 << ((i + 1) % n)) | (1 << ((i - 1 + n) % n));
      seen.add(g(mask & ~hitMask));
    }
    let m = 0;
    while (seen.has(m)) m++;
    memo.set(mask, m);
    return m;
  };
  return g;
}

const toRing = (mask, n) => Array.from({ length: n }, (_, i) => (mask >> i) & 1);

/* -------------------- 3. value() against the search, over every position */

{
  let states = 0;
  for (let n = 3; n <= 14; n++) {
    const g = bruteGrundy(n);
    for (let mask = 0; mask < 1 << n; mask++) {
      states++;
      const up = toRing(mask, n);
      const claimed = C.value(up);
      const truth = g(mask);
      check(
        `value matches the search (n=${n}, ${up.join("")})`,
        claimed === truth,
        `core says ${claimed}, search says ${truth}`,
      );
    }
  }
  check(`swept ${states} ring positions`, states > 32000, `only ${states}`);
}

/* ------------- 4. the full ring is its own game, not an arc of the same size */

{
  for (let n = 1; n <= 18; n++) {
    const g = bruteGrundy(n);
    const truth = g((1 << n) - 1);
    equal(`cycleGrundy[${n}]`, C.cycleGrundy[n], truth);
  }
  // The applet scored an unbroken ring with rowGrundy[n], which is a different
  // game: on a ring every first move takes 3 places, where at the end of an arc
  // it takes only 2. These are sizes where that goes wrong.
  const wrong = [];
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    if ((C.rowGrundy[n] === 0) !== (C.cycleGrundy[n] === 0)) wrong.push(n);
  }
  check(
    "the applet's reading of a full ring disagrees on who wins at many sizes",
    wrong.length > 20,
    `only ${wrong.length}: ${wrong.join(" ")}`,
  );
}

/* ---------------------------- 5. rowGrundy against the applet's own table */

{
  // DawsonChessGame.<init> builds `Value` as a 136-entry int[]; these are those
  // entries, read off `javap -c -p`. The first hundred are also the table
  // printed on the cut-the-knot page.
  const APPLET = (
    "0 1 1 2 0 3 1 1 0 3 3 2 2 4 0 5 2 2 3 3 0 1 1 3 0 2 1 1 0 4 5 2 7 4 0 1 1 2 0 3 " +
    "1 1 0 3 3 2 2 4 4 5 5 2 3 3 0 1 1 3 0 2 1 1 0 4 5 3 7 4 8 1 1 2 0 3 1 1 0 3 3 2 " +
    "2 4 4 5 5 9 3 3 0 1 1 3 0 2 1 1 0 4 5 3 7 4 8 1 1 2 0 3 1 1 0 3 3 2 2 4 4 5 5 9 " +
    "3 3 0 1 1 3 0 2 1 1 0 4 5 3 7 4"
  ).split(" ").map(Number);
  equal("the applet table has 136 entries", APPLET.length, 136);

  equal("rowGrundy is built up to N_MAX", C.rowGrundy.length, C.N_MAX + 1);
  for (let n = 0; n <= C.N_MAX; n++) {
    equal(`rowGrundy[${n}] matches the applet's Value[${n}]`, C.rowGrundy[n], APPLET[n]);
  }

  // The claim the page's math section makes about the sequence. Re-derived here
  // past the core's own table, which only reaches the largest ring you can set.
  const long = (() => {
    const g = [0];
    for (let n = 1; n <= 600; n++) {
      const seen = new Set([n === 1 ? 0 : g[n - 2]]);
      for (let i = 1; i <= n - 2; i++) seen.add(g[i - 1] ^ g[n - i - 2]);
      let m = 0;
      while (seen.has(m)) m++;
      g[n] = m;
    }
    return g;
  })();
  for (let n = 0; n <= C.N_MAX; n++) {
    equal(`the long table agrees with the core at ${n}`, long[n], C.rowGrundy[n]);
  }
  const breaks = [];
  for (let n = 0; n + 34 < long.length; n++) {
    if (long[n] !== long[n + 34]) breaks.push(n);
  }
  equal("period 34, broken only at 14, 16, 31, 34 and 51", breaks, [14, 16, 31, 34, 51]);
  equal("no arc is worth more than 9", Math.max(...long), 9);
}

/* ------------------------- 6. bestMove is a winning strategy, played out */

{
  // From a position with a non-zero value the computer must win however its
  // opponent answers. Checked by playing bestMove and branching over every
  // legal reply, down to the empty ring.
  let positions = 0;
  for (let n = 3; n <= 11; n++) {
    const memo = new Map();
    /** The computer is to move on `up`. Does it take the last skittle? */
    const cpuWins = (up) => {
      const key = up.join("");
      const hit = memo.get(key);
      if (hit !== undefined) return hit;
      const i = C.bestMove(up);
      if (i < 0) return false; // nothing to move on: the opponent took the last one
      const after = C.move(up, i);
      let ok = C.isFinished(after);
      if (!ok) ok = C.legalMoves(after).every((j) => cpuWins(C.move(after, j)));
      memo.set(key, ok);
      return ok;
    };
    for (let mask = 1; mask < 1 << n; mask++) {
      const up = toRing(mask, n);
      if (C.value(up) === 0) continue; // a lost position; bestMove plays at random
      positions++;
      check(`bestMove wins from a non-zero position (n=${n}, ${up.join("")})`, cpuWins(up));
    }
  }
  check(`strategy played out from ${positions} winning positions`, positions > 1500, `only ${positions}`);

  // And it only ever plays legally, including from the lost positions.
  const rand = rng(7);
  for (let t = 0; t < 2000; t++) {
    const n = C.N_MIN + Math.floor(rand() * (C.N_MAX - C.N_MIN + 1));
    let up = C.openingRing(n, rand() < 0.5, rand);
    let plies = 0;
    while (!C.isFinished(up)) {
      const i = C.bestMove(up, rand);
      check(`bestMove returns a standing place (n=${n})`, i >= 0 && up[i] === 1);
      const before = C.standing(up);
      up = C.move(up, i);
      check(`every move knocks down 1 to 3 skittles (n=${n})`, before - C.standing(up) >= 1 && before - C.standing(up) <= 3);
      plies++;
      check(`the game terminates (n=${n})`, plies <= n);
    }
  }
}

/* ------------------------------ 7. openingRing, against Reset() in the applet */

{
  equal("N_MIN, N_MAX, N_DEFAULT are the applet's", [C.N_MIN, C.N_MAX, C.N_DEFAULT], [10, 60, 18]);

  const rand = rng(99);
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    equal(`full circle: every place stands (n=${n})`, C.standing(C.openingRing(n, true, rand)), n);
    check(`full circle: one unbroken ring (n=${n})`, C.decompose(C.openingRing(n, true, rand)).full);

    // Reset(): Dots[0] is always knocked out, then one more gap, a third above
    // 25 places and a fourth above 35, each a random step of 1..floor(n/k)
    // further round.
    const wantGaps = n > 35 ? 4 : n > 25 ? 3 : 2;
    for (let t = 0; t < 400; t++) {
      const up = C.openingRing(n, false, rand);
      equal(`broken ring has ${wantGaps} gaps (n=${n})`, n - C.standing(up), wantGaps);
      equal(`place 0 is always one of them (n=${n})`, up[0], 0);
      check(`every place is 0 or 1 (n=${n})`, up.every((v) => v === 0 || v === 1));
      equal(`the gaps leave ${wantGaps} arcs at most (n=${n})`, C.decompose(up).arcs.length <= wantGaps, true);
    }
  }
}

done("dawsons-chess");
