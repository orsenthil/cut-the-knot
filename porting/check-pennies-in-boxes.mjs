#!/usr/bin/env node
"use strict";

/*
 * Logic test for pennies-in-boxes/pennies-core.js.
 *
 * The move: pick two boxes holding p and q pennies with p >= q; the fuller one
 * pays the other q pennies, so (p, q) -> (p - q, 2q). The goal is one box.
 *
 * The cut-the-knot page states two theorems, and both are checked here by
 * exhausting every deal rather than by trusting the code:
 *
 *   - any deal can be reduced to at most two non-empty boxes;
 *   - a deal whose total is a power of two can always be gathered into one.
 *
 * A third fact, that an odd total can never reach one box, is checked too: the
 * last move doubles a box, so the total would have to be even.
 *
 * Every deal of N pennies into k boxes, for the ranges below, is enumerated
 * and run through the core's own search.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const P = loadCore("pennies-in-boxes/pennies-core.js", "PenniesCore");

/** Every way to deal `total` pennies into exactly `boxes` non-empty boxes. */
function deals(total, boxes) {
  const out = [];
  const walk = (left, slots, acc) => {
    if (slots === 1) { out.push([...acc, left]); return; }
    for (let n = 1; n <= left - (slots - 1); n++) walk(left - n, slots - 1, [...acc, n]);
  };
  if (total >= boxes) walk(total, boxes, []);
  return out;
}

/* --------------------------------------------------------- 1. the move */

{
  equal("the fuller box pays the other what it holds", P.apply([5, 3], 0, 1), [2, 6]);
  equal("and it works the other way round too", P.apply([3, 5], 0, 1), [6, 2]);
  equal("equal boxes empty one of them", P.apply([4, 4], 0, 1), [0, 8]);
  equal("other boxes are untouched", P.apply([5, 1, 7], 0, 2), [10, 1, 2]);
  equal("a box cannot pay itself", P.apply([5, 3], 1, 1), null);
  equal("an empty box takes no part", P.apply([5, 0], 0, 1), null);

  equal("the click order does not matter", P.describe([3, 5], 0, 1), P.describe([3, 5], 1, 0));
  equal("the pennies go from the fuller box", P.describe([3, 5], 0, 1), { from: 1, to: 0, amount: 3 });

  let kept = 0;
  for (const d of deals(12, 3)) {
    for (const { next } of P.successors(d)) if (P.total(next) !== 12) kept++;
  }
  equal("no move changes the total", kept, 0);

  // The page's lemma for the power-of-two proof.
  let oddPairs = 0;
  let bothEven = 0;
  for (const d of deals(14, 3)) {
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        if (!P.bothOdd(d, i, j)) continue;
        oddPairs++;
        const after = P.apply(d, i, j);
        if (after[i] % 2 === 0 && after[j] % 2 === 0) bothEven++;
      }
    }
  }
  check("there are odd pairs to test", oddPairs > 50, `${oddPairs}`);
  equal("a move between two odd boxes leaves both even", bothEven, oddPairs);
}

/* ------------------------------------- 2. powers of two always come good */

{
  let tested = 0;
  const stubborn = [];
  for (const total of [2, 4, 8, 16]) {
    for (let boxes = 2; boxes <= Math.min(5, total); boxes++) {
      for (const d of deals(total, boxes)) {
        tested++;
        if (!P.canFinish(d)) stubborn.push(`${total}: ${d.join("+")}`);
      }
    }
  }
  check("plenty of deals tested", tested > 1000, `${tested} deals`);
  equal("every power-of-two deal can be gathered into one box", stubborn.slice(0, 5), []);

  // And the solutions are real: replay the shortest one found, move by move.
  let replayFailures = 0;
  for (const total of [2, 4, 8, 16]) {
    for (const d of deals(total, 3)) {
      const moves = P.solve(d);
      if (!moves) { replayFailures++; continue; }
      const game = new P.Game(d);
      for (const [i, j] of moves) if (!game.play(i, j)) replayFailures++;
      if (!game.finished || game.total !== total) replayFailures++;
    }
  }
  equal("and every solution replays to a win", replayFailures, 0);
}

/* ------------------------------------------- 3. an odd total never does */

{
  let wrong = 0;
  let tested = 0;
  for (const total of [3, 5, 7, 9, 11, 13, 15]) {
    for (let boxes = 2; boxes <= Math.min(4, total); boxes++) {
      for (const d of deals(total, boxes)) {
        tested++;
        if (P.canFinish(d) || P.solve(d) !== null) wrong++;
      }
    }
  }
  check("odd deals tested", tested > 500, `${tested}`);
  equal("no odd total can ever be gathered into one box", wrong, 0);

  // Even is not enough on its own: 12 has deals that cannot be finished.
  const stuck12 = deals(12, 3).filter((d) => !P.canFinish(d));
  check("some 12-penny deals are hopeless too", stuck12.length > 0, `${stuck12.length} of ${deals(12, 3).length}`);
  check("1+2+9 is one of them", !P.canFinish([1, 2, 9]));
  check("so is 3+4+5", !P.canFinish([3, 4, 5]));
  equal("3+3+6 is the only 12-penny deal in three boxes that works",
    [...new Set(deals(12, 3).filter((d) => P.canFinish(d))
      .map((d) => d.slice().sort((a, b) => a - b).join("+")))], ["3+3+6"]);
}

/* ------------------------------------------ 4. two boxes are always reachable */

{
  /** Reachability search for a state with at most two non-empty boxes. */
  const canReachTwo = (counts) => {
    const seen = new Set();
    const stack = [counts.filter((n) => n > 0)];
    while (stack.length) {
      const state = stack.pop();
      const key = P.canonical(state);
      if (seen.has(key)) continue;
      seen.add(key);
      if (P.nonEmpty(state) <= 2) return true;
      for (const { next } of P.successors(state)) stack.push(next.filter((n) => n > 0));
    }
    return false;
  };

  let tested = 0;
  const bad = [];
  for (let total = 3; total <= 16; total++) {
    for (let boxes = 3; boxes <= Math.min(4, total); boxes++) {
      for (const d of deals(total, boxes)) {
        tested++;
        if (!canReachTwo(d)) bad.push(d.join("+"));
      }
    }
  }
  check("deals tested for the two-box theorem", tested > 500, `${tested}`);
  equal("every deal can be squeezed into two boxes", bad.slice(0, 5), []);
}

/* -------------------------------------- 5. the gcd test matches the search */

{
  // winnable() claims one box is reachable exactly when total/gcd is a power
  // of two. The search above is the ground truth; here they are compared on
  // every deal of up to 26 pennies into up to four boxes, and of up to 18 into
  // five.
  let tested = 0;
  const disagree = [];
  for (let total = 2; total <= 26; total++) {
    for (let boxes = 2; boxes <= Math.min(4, total); boxes++) {
      for (const d of deals(total, boxes)) {
        tested++;
        if (P.winnable(d) !== P.canFinish(d)) disagree.push(d.join("+"));
      }
    }
  }
  for (let total = 5; total <= 18; total++) {
    for (const d of deals(total, 5)) {
      tested++;
      if (P.winnable(d) !== P.canFinish(d)) disagree.push(d.join("+"));
    }
  }
  check("the gcd test was given a real workout", tested > 25000, `${tested} deals`);
  equal("the gcd test agrees with the search on every one", disagree.slice(0, 5), []);

  equal("the gcd of a deal", P.gcdAll([6, 10, 8]), 2);
  check("3+5+8: gcd 1, total 16, a power of two", P.winnable([3, 5, 8]));
  check("2+4+6: gcd 2, total 6, which halves to 3", !P.winnable([2, 4, 6]));
  check("4+4+4: gcd 4, total 12, which reduces to 3", !P.winnable([4, 4, 4]));
  check("3+3+6: gcd 3, total 12, which reduces to 4", P.winnable([3, 3, 6]));

  // The gcd can only ever double - the step the proof turns on.
  let grew = 0;
  let doubled = 0;
  for (const d of deals(18, 3)) {
    const g = P.gcdAll(d);
    for (const { next } of P.successors(d)) {
      const g2 = P.gcdAll(next);
      if (g2 !== g) grew++;
      if (g2 % g !== 0 || ![1, 2].includes(g2 / g)) doubled++;
    }
  }
  check("the gcd does change sometimes", grew > 0, `${grew} moves changed it`);
  equal("but a move can only leave the gcd alone or double it", doubled, 0);
}

/* ------------------------------------------------- 6. solve, hint, deal */

{
  equal("a solved deal needs no moves", P.solve([8]), []);
  equal("3+5+8 takes four moves", P.solve([3, 5, 8]).length, 4);

  // No shorter sequence exists: three moves is not enough, by brute force.
  const reachableIn = (counts, depth) => {
    if (P.isWon(counts)) return true;
    if (depth === 0) return false;
    return P.successors(counts).some(({ next }) => reachableIn(next, depth - 1));
  };
  check("and three would not do", !reachableIn([3, 5, 8], 3));

  const h = P.hint([3, 5, 8]);
  check("a hint is offered when the deal can be won", Array.isArray(h));
  check("and the hint shortens the job",
    P.solve(P.apply([3, 5, 8], h[0], h[1])).length === P.solve([3, 5, 8]).length - 1);
  equal("no hint is offered when it cannot", P.hint([1, 2, 9]), null);

  // Following the hint must actually finish, not walk round a cycle. When the
  // total is a power of two every move keeps the win in reach, so a hint that
  // only asked for that could loop for ever.
  let hintFailures = 0;
  let longest = 0;
  const followed = [];
  for (const total of [8, 16, 12, 18]) {
    for (let boxes = 2; boxes <= 4; boxes++) {
      for (const d of deals(total, boxes)) {
        if (!P.canFinish(d)) { if (P.hint(d) !== null) hintFailures++; continue; }
        const game = new P.Game(d);
        let steps = 0;
        while (!game.finished && steps < 40) {
          const move = P.hint(game.counts);
          if (!move) break;
          if (!game.play(move[0], move[1])) break;
          steps++;
        }
        followed.push(steps);
        longest = Math.max(longest, steps);
        if (!game.finished) hintFailures++;
      }
    }
  }
  check("hints were followed on plenty of deals", followed.length > 500, `${followed.length} deals`);
  equal("following the hint always ends with one box", hintFailures, 0);
  check("and it never takes many moves", longest <= 12, `longest run was ${longest}`);

  const random = rng(7);
  let dealProblems = 0;
  for (let i = 0; i < 300; i++) {
    const boxes = 2 + (i % 5);
    const total = 8 + (i % 17);
    const d = P.deal(boxes, total, random);
    if (d.length !== boxes || P.total(d) !== total || d.some((n) => n < 1)) dealProblems++;
  }
  equal("deals have the right number of boxes, none empty, and the right total", dealProblems, 0);
}

/* ------------------------------------------------------------ 7. a game */

{
  const g = new P.Game([3, 5, 8]);
  check("not won at the start", !g.finished);
  equal("the total", g.total, 16);
  equal("a move between two empty-handed boxes is refused", g.play(0, 0), null);

  const move = g.play(0, 1);
  equal("3 and 5 become 6 and 2", g.counts, [6, 2, 8]);
  equal("the move is reported", move, { from: 1, to: 0, amount: 3 });

  check("undo puts the pennies back", g.undo() && g.counts.join() === "3,5,8");
  check("undo at the start does nothing", !g.undo());

  for (const [i, j] of P.solve(g.counts)) g.play(i, j);
  check("playing the solution wins", g.finished);
  equal("all 16 pennies in one box", g.counts.filter((n) => n > 0), [16]);

  g.reset();
  equal("reset deals the same pennies again", g.counts, [3, 5, 8]);
  equal("and forgets the moves", g.history.length, 0);
}

done("pennies-in-boxes");
