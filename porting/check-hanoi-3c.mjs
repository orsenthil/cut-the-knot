#!/usr/bin/env node
"use strict";

/*
 * Logic test for hanoi-3c/hanoi-3c-core.js.
 *
 *   1. Anderson's algorithm, as the applet runs it (Solution(N, 0, 1, 2)):
 *      for N = 1 .. 10 every move is legal and the end is the stated goal,
 *      with the colours turned one peg round, as the algorithm page says.
 *      After GATHER every disk is in one stack; after the two SHIFTs that
 *      stack is on peg 1 (the page's "peg 1", here the left peg).
 *   2. The page's PERMUTE(a, b, c, N). The page guesses "This will not work,
 *      I think, for non-cyclic permutations". It does: all six orders of the
 *      pegs are legal and solve the puzzle for N = 1 .. 5. The three cyclic
 *      orders give one derangement of the colours, the three non-cyclic ones
 *      give the other.
 *   3. Optimality, which the page leaves open ("it may not be optimal"):
 *      breadth-first search over every position for N = 1, 2, 3 finds the
 *      fewest moves to the stated goal, 5, 22 and 62, against the
 *      algorithm's 10, 38 and 102. For the applet's looser finish test
 *      (no peg holds a disk of its own colour) the fewest are 4, 13, 38.
 *   4. The rules: equal sizes stack, bigger on smaller does not.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const H = loadCore("hanoi-3c/hanoi-3c-core.js", "Hanoi3cCore");

const run = (n, moves) => {
  const s = H.start(n);
  let legal = true;
  for (const [a, b] of moves) if (!H.move(s, a, b)) { legal = false; break; }
  return { s, legal };
};

/* ------------------------------------------------- 1. the algorithm */

const ANDERSON = [];
for (let n = H.MIN_N; n <= H.MAX_N; n++) {
  const moves = H.solution(n);
  ANDERSON[n] = moves.length;
  const { s, legal } = run(n, moves);
  check(`N=${n}: every move is legal`, legal);
  check(`N=${n}: ends at the stated goal`, H.won(s));
  equal(`N=${n}: colours end one peg round`, s.pegs.map((p) => p[0].colour), [2, 0, 1]);

  const [g, s1, s2] = moves.phases;
  const afterGather = run(n, moves.slice(0, g)).s;
  check(`N=${n}: GATHER puts all 3N disks in one stack`, afterGather.pegs.some((p) => p.length === 3 * n));
  const afterShifts = run(n, moves.slice(0, s2)).s;
  equal(`N=${n}: the two SHIFTs leave the stack on the left peg`, afterShifts.pegs[0].length, 3 * n);
  check(`N=${n}: phases are in order`, g < s1 && s1 < s2 && s2 < moves.length);
}
equal("Anderson's move counts", ANDERSON.slice(1, 6), [10, 38, 102, 238, 518]);

/* ------------------------------------------------------- 2. PERMUTE */

const ORDERS = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]];
const cyclic = ([a, b, c]) => (b - a + 3) % 3 === 1 && (c - b + 3) % 3 === 1;
for (const n of [1, 2, 3, 4, 5]) {
  for (const order of ORDERS) {
    const { s, legal } = run(n, H.solution(n, ...order));
    check(`N=${n}: PERMUTE(${order}) is legal and solves it`, legal && H.won(s));
    equal(`N=${n}: PERMUTE(${order}) colour order`, s.pegs.map((p) => p[0].colour), cyclic(order) ? [2, 0, 1] : [1, 2, 0]);
  }
}

/* -------------------------------------------------- 3. optimality, BFS */

const key = (pegs) => pegs.map((p) => p.map((d) => d.size * 3 + d.colour).join(".")).join("|");
function fewest(n, goal) {
  const s0 = H.start(n);
  const seen = new Set([key(s0.pegs)]);
  let frontier = [s0.pegs];
  for (let depth = 0; frontier.length; depth++) {
    const next = [];
    for (const pegs of frontier) {
      if (goal({ n, pegs })) return depth;
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
          const t = { n, pegs: pegs.map((p) => p.slice()), moves: 0 };
          if (!H.move(t, a, b)) continue;
          const k = key(t.pegs);
          if (!seen.has(k)) { seen.add(k); next.push(t.pegs); }
        }
      }
    }
    frontier = next;
  }
  return null;
}
const STATED = [null, 5, 22, 62];
const LOOSE = [null, 4, 13, 38];
for (let n = 1; n <= 3; n++) {
  equal(`N=${n}: fewest moves to the stated goal`, fewest(n, H.won), STATED[n]);
  equal(`N=${n}: fewest moves to the applet's looser test`, fewest(n, H.appletFinished), LOOSE[n]);
  check(`N=${n}: Anderson's algorithm is not the shortest`, ANDERSON[n] > STATED[n]);
}

/* ------------------------------------------------------------ 4. rules */

{
  const s = H.start(2);
  check("a disk goes on a disk of its own size", H.move(s, 0, 1));
  check("a bigger disk never goes on a smaller one", !H.legal(s, 0, 1) && H.move(s, 0, 2) === false);
  check("nothing moves from a peg to itself", !H.legal(s, 1, 1));
  check("the start is not solved", !H.won(H.start(3)) && !H.appletFinished(H.start(3)));
  const loose = H.start(1);
  for (const [a, b] of [[0, 1], [2, 0], [1, 2], [1, 0]]) H.move(loose, a, b);
  check("4 moves pass the applet's test with mixed piles", H.appletFinished(loose) && !H.won(loose));
  equal("1 to 10 disks a colour, starting at 3", [H.MIN_N, H.MAX_N, H.DEFAULT_N], [1, 10, 3]);
}

done("hanoi-3c");
