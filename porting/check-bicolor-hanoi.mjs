#!/usr/bin/env node
"use strict";

/*
 * Logic test for bicolor-hanoi/bicolor-hanoi-core.js.
 *
 * The puzzle: three pegs, two striped towers, two disks of every size (one
 * gold, one red). A disk may land on a bigger disk or on one of its own size,
 * never on a smaller one. Win by making both towers monochrome AND swapping
 * the pegs they stand on.
 *
 * What is checked, and why it is not taken on trust:
 *
 *   1. The opening position is the applet's Reset(): sizes n..1 bottom to top
 *      on the first two pegs, colours alternating, the two towers mirror
 *      images, third peg empty.
 *   2. The move rule is the applet's CanSettle(), which rejects a drop only
 *      when the landing disk is strictly smaller. Equal sizes stack.
 *   3. won() accepts only the swapped goal. In particular it rejects the much
 *      easier "sort the colours where they stand" position, which is what the
 *      puzzle would be without the cut-the-knot page's swap condition, and it
 *      rejects everything on one peg (the condition the applet itself tests,
 *      left over from the single-tower Hanoi applet it was built from).
 *   4. The MINIMUM table the page quotes is re-derived here by breadth-first
 *      search through the core's own legal()/move(), for every size it can be
 *      done quickly for. A table that drifted from the rules would show up.
 *   5. Nathan Bowler's 30-move solution for three sizes, from the solution
 *      page cut-the-knot links to, is replayed move by move: every move must
 *      be legal and it must finish the puzzle. That pins the rules and the
 *      goal to the published solution, and shows the 29 in the table is a
 *      genuine saving rather than a different puzzle.
 *   6. The page's claim that a doubled pile of k sizes moves peg-to-peg in
 *      2^(k+1) - 2 moves is checked by search too.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const H = loadCore("bicolor-hanoi/bicolor-hanoi-core.js", "BicolorHanoi");
const { GOLD, RED } = H;

const show = (state) =>
  state.pegs.map((s) => "[" + s.map((d) => H.sizeOf(d) + "gr"[H.colourOf(d)]).join(" ") + "]").join(" ");

/* ------------------------------------------------- 1. the opening position */

{
  const s = H.start(3);
  equal("start: three pegs", s.pegs.length, 3);
  equal("start: spare peg empty", s.pegs[2], []);
  equal("start: no moves yet", [s.moves, s.history.length], [0, 0]);
  equal("start: the applet's Reset position", show(s), "[3g 2r 1g] [3r 2g 1r] []");

  for (const n of [1, 2, 4, 5, 6]) {
    const t = H.start(n);
    const sizes = (peg) => t.pegs[peg].map(H.sizeOf);
    const down = Array.from({ length: n }, (_, i) => n - i);
    equal(`start n=${n}: left tower sizes descend`, sizes(0), down);
    equal(`start n=${n}: right tower sizes descend`, sizes(1), down);
    const colours = (peg) => t.pegs[peg].map(H.colourOf);
    check(
      `start n=${n}: colours alternate from gold at the bottom left`,
      colours(0).every((c, i) => c === (i % 2 === 0 ? GOLD : RED)),
      colours(0).join("")
    );
    check(
      `start n=${n}: the right tower is the mirror image`,
      colours(1).every((c, i) => c !== colours(0)[i]),
      colours(1).join("")
    );
  }
}

/* ------------------------------------------------------- 2. the move rule */

{
  const s = H.start(2); // [2g 1r] [2r 1g] []
  check("legal: small onto empty", H.legal(s, 0, 2));
  check("legal: size 1 onto size 1 (the applet allows equal sizes)", H.legal(s, 0, 1));
  check("illegal: a peg cannot feed itself", !H.legal(s, 0, 0));
  check("illegal: nothing to lift from an empty peg", !H.legal(s, 2, 0));
  check("illegal: off the board", !H.legal(s, 0, 3) && !H.legal(s, -1, 0));

  check("move: 1r onto the spare peg", H.move(s, 0, 2));
  equal("move: it went where it was sent", show(s), "[2g] [2r 1g] [1r]");
  equal("move: counted", s.moves, 1);
  check("illegal: size 2 onto size 1", !H.legal(s, 0, 2));
  check("illegal: refused moves do not happen", !H.move(s, 0, 2) && s.moves === 1);

  check("undo: steps back", H.undo(s));
  equal("undo: exactly back to the start", show(s), "[2g 1r] [2r 1g] []");
  equal("undo: and the counter with it", [s.moves, s.history.length], [0, 0]);
  check("undo: nothing left to undo", !H.undo(s));
}

/* ------------------------------------------------------ 3. the win condition */

{
  const n = 3;
  const mono = (peg, colour) => [3, 2, 1].map((size) => H.disk(size, colour));

  const swapped = { n, pegs: [mono(0, RED), mono(1, GOLD), []], moves: 0, history: [] };
  check("won: the towers monochrome and swapped", H.won(swapped));

  const inPlace = { n, pegs: [mono(0, GOLD), mono(1, RED), []], moves: 0, history: [] };
  check("not won: monochrome but still on their own pegs", !H.won(inPlace));

  const onSpare = { n, pegs: [[], mono(1, GOLD), mono(2, RED)], moves: 0, history: [] };
  check("not won: a tower parked on the spare peg is not a swap", !H.won(onSpare));

  const allOne = {
    n,
    pegs: [[], [], [3, 3, 2, 2, 1, 1].map((size, i) => H.disk(size, i % 2))],
    moves: 0,
    history: [],
  };
  check("not won: everything on one peg (the applet's own leftover test)", !H.won(allOne));

  check("not won: the opening position", !H.won(H.start(n)));
  check("not won: the opening position at one size either", !H.won(H.start(1)));
}

/* ---------------------------------------- 4. the minimum table, re-derived */

/** Breadth-first search through the core's own rules. */
function minimumBySearch(n) {
  const key = (s) => s.pegs.map((p) => p.join(",")).join("|");
  let frontier = [H.start(n)];
  const seen = new Set([key(frontier[0])]);
  if (H.won(frontier[0])) return 0;
  for (let d = 1; d < 2000; d++) {
    const next = [];
    for (const s of frontier) {
      for (let from = 0; from < 3; from++) {
        for (let to = 0; to < 3; to++) {
          if (!H.legal(s, from, to)) continue;
          const t = H.clone(s);
          H.move(t, from, to);
          const k = key(t);
          if (seen.has(k)) continue;
          seen.add(k);
          if (H.won(t)) return d;
          next.push(t);
        }
      }
    }
    if (!next.length) return Infinity;
    frontier = next;
  }
  return Infinity;
}

{
  // The applet's spinner goes to m_Max = 8, so the page offers 8 sizes too.
  // The search only reaches 7, so the table is allowed to stop short of the
  // largest board -- what it may not do is guess.
  equal("the size range is the applet's", [H.MIN_SIZES, H.MAX_SIZES], [1, 8]);
  equal("the table covers 0..7", H.MINIMUM.length, 8);
  equal("minimum(0): nothing to do", H.minimum(0), 0);
  equal("minimum(8) admits it is not known", H.minimum(8), null);
  equal("minimum() off the end is honest", H.minimum(H.MAX_SIZES + 1), null);
  // n = 5, 6 and 7 are in the table from a search run from both ends offline;
  // 1..4 are cheap enough to redo on every verify.
  for (let n = 1; n <= 4; n++) {
    equal(`minimum(${n}) by search`, minimumBySearch(n), H.MINIMUM[n]);
  }
  // The entries the quick search cannot reach still have to sit below Nathan
  // Bowler's published strategy, L(k) = 11(2^(k-1) - 1) - 3(k-2), which is a
  // real upper bound on the minimum: 329 for six sizes and 678 for seven.
  for (let n = 5; n < H.MINIMUM.length; n++) {
    const bowler = 11 * (2 ** (n - 1) - 1) - 3 * (n - 2);
    check(`minimum(${n}) = ${H.MINIMUM[n]} does not exceed Bowler's ${bowler}`, H.MINIMUM[n] <= bowler);
  }
  check("minimum grows with the board", H.MINIMUM.every((v, i) => i === 0 || v > H.MINIMUM[i - 1]));
}

/* ------------------------------- 5. the published 30-move solution replayed */

{
  // https://www.cut-the-knot.org/recurrence/BicolorHanoiSolution.shtml
  const BOWLER =
    "10.12.02.02.01.20.20.21.01.01.02.10.10.12.12.02.02.10.21.21.20.20.10.10.21.02.02.01.20.21";
  const seq = BOWLER.split(".").map((m) => [Number(m[0]), Number(m[1])]);
  equal("Bowler's solution is 30 moves", seq.length, 30);

  const s = H.start(3);
  let illegal = -1;
  seq.forEach(([from, to], i) => {
    if (illegal < 0 && !H.move(s, from, to)) illegal = i;
  });
  equal("every move in it is legal under these rules", illegal, -1);
  check("and it finishes the puzzle", H.won(s), show(s));
  check("so 29 is one move better, not a different puzzle", H.MINIMUM[3] === 29 && 29 < seq.length);
}

/* --------------------------- 6. a doubled pile costs 2^(k+1) - 2 to shift */

{
  /** Fewest moves to shift a pile of two disks of each of k sizes, peg 0 to 2. */
  function pileCost(k) {
    const pegs = [[], [], []];
    for (let size = k; size >= 1; size--) {
      pegs[0].push(H.disk(size, GOLD), H.disk(size, RED));
    }
    const state = { n: k, pegs, moves: 0, history: [] };
    // Equal disks are interchangeable for this question, so key on sizes only.
    const key = (s) => s.pegs.map((p) => p.map(H.sizeOf).join(",")).join("|");
    const done = (s) => s.pegs[0].length === 0 && s.pegs[1].length === 0;
    let frontier = [state];
    const seen = new Set([key(state)]);
    for (let d = 1; d < 500; d++) {
      const next = [];
      for (const s of frontier) {
        for (let from = 0; from < 3; from++) {
          for (let to = 0; to < 3; to++) {
            if (!H.legal(s, from, to)) continue;
            const t = H.clone(s);
            H.move(t, from, to);
            const kk = key(t);
            if (seen.has(kk)) continue;
            seen.add(kk);
            if (done(t)) return d;
            next.push(t);
          }
        }
      }
      if (!next.length) return Infinity;
      frontier = next;
    }
    return Infinity;
  }
  for (let k = 1; k <= 4; k++) {
    equal(`a doubled pile of ${k} sizes shifts in 2^${k + 1} - 2 moves`, pileCost(k), 2 ** (k + 1) - 2);
  }
}

done("bicolor-hanoi");
