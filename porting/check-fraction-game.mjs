#!/usr/bin/env node
"use strict";

/*
 * Logic test for fraction-game/fraction-core.js.
 *
 * Three things need checking, and the last one is the interesting one.
 *
 *   1. The Stern-Brocot parents really are the best approximations with a
 *      smaller denominator, checked against a brute-force search.
 *   2. value() is order-preserving. That is what makes the parents the only
 *      options worth considering: a bigger number is worth more to Left, so
 *      the largest number below x beats every other move Left has.
 *   3. The whole game is solved outright for small boards, and the answer is
 *      compared with the sum of the values. The same solve measures the
 *      applet's greedy opponent, which is a heuristic and does lose games it
 *      should win - the test records exactly how often, so a change in the
 *      opponent cannot slip through unnoticed.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const F = loadCore("fraction-game/fraction-core.js", "FractionGameCore");
const { LEFT, RIGHT, frac, cmp, text, num } = F;
const other = (w) => (w === LEFT ? RIGHT : LEFT);

/** Every reduced fraction with |p| <= max and 1 <= q <= max, ascending. */
function universe(max) {
  const out = [];
  for (let q = 1; q <= max; q++) {
    for (let p = -max; p <= max; p++) {
      const f = frac(p, q);
      if (f.p === p && f.q === q) out.push(f);
    }
  }
  out.sort(cmp);
  return out;
}

/* ------------------------------------------------- 1. the parents are best */

{
  equal("the page's example: 2/5 sits between 1/3 and 1/2", F.parents(frac(2, 5)), {
    lower: { p: 1, q: 3 },
    upper: { p: 1, q: 2 },
  });
  equal("an integer has no right parent", F.parents(frac(3, 1)), { lower: { p: 2, q: 1 }, upper: null });
  equal("0 has no parents at all", F.parents(frac(0, 1)), { lower: null, upper: null });

  for (let q = 2; q <= 30; q++) {
    for (let p = 1; p <= 4 * q; p++) {
      const x = frac(p, q);
      if (x.q !== q) continue;
      const { lower, upper } = F.parents(x);
      // brute force: the closest fractions below and above with a smaller q
      let bestLo = null;
      let bestHi = null;
      for (let d = 1; d < q; d++) {
        for (let n = -1; n <= 4 * q + 1; n++) {
          const y = { p: n, q: d };
          if (cmp(y, x) < 0 && (!bestLo || cmp(y, bestLo) > 0)) bestLo = y;
          if (cmp(y, x) > 0 && (!bestHi || cmp(y, bestHi) < 0)) bestHi = y;
        }
      }
      check(`lower parent of ${text(x)} is the closest below`, cmp(lower, bestLo) === 0,
        `got ${text(lower)}, best ${text(bestLo)}`);
      check(`upper parent of ${text(x)} is the closest above`, cmp(upper, bestHi) === 0,
        `got ${text(upper)}, best ${text(bestHi)}`);
      // the defining mediant property
      equal(`${text(x)} is the mediant of its parents`, frac(lower.p + upper.p, lower.q + upper.q), x);
      equal(`the parents' denominators add up for ${text(x)}`, lower.q + upper.q, x.q);
    }
  }
}

/* ------------------------------------------- 2. value() preserves the order */

{
  equal("value(1/2) is 1/2", F.value(frac(1, 2)), { p: 1, q: 2 });
  equal("value(1/3) is 1/4", F.value(frac(1, 3)), { p: 1, q: 4 });
  equal("value(2/5) is 3/8", F.value(frac(2, 5)), { p: 3, q: 8 });
  equal("an integer is worth itself", F.value(frac(-4, 1)), { p: -4, q: 1 });

  const all = universe(16);
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1];
    const b = all[i];
    check(`value rises from ${text(a)} to ${text(b)}`, cmp(F.value(a), F.value(b)) < 0,
      `${text(F.value(a))} vs ${text(F.value(b))}`);
  }
  for (const x of all) {
    const v = F.value(x);
    const d = v.q;
    check(`value(${text(x)}) = ${text(v)} is dyadic`, (d & (d - 1)) === 0, `denominator ${d}`);
    equal(`value(-x) = -value(x) at ${text(x)}`, F.value(F.neg(x)), F.neg(v));
  }

  // Because value rises with x, the parent really is the best move there is.
  for (const x of universe(12)) {
    for (const who of [LEFT, RIGHT]) {
      const moves = F.legalMoves(x, who, 12);
      const s = F.suggest(x, who);
      if (!moves.length) {
        check(`no move from ${text(x)} for ${who}, and none suggested`, s === null);
        continue;
      }
      check(`the move suggested from ${text(x)} for ${who} is legal`, s && F.isLegal(x, s, who));
      // best = the option whose value is most favourable to the mover
      let best = moves[0];
      for (const m of moves) {
        const better = who === LEFT ? cmp(F.value(m), F.value(best)) > 0 : cmp(F.value(m), F.value(best)) < 0;
        if (better) best = m;
      }
      equal(`${who}'s best move from ${text(x)}`, s, best);
    }
  }
}

/* --------------------------------- 3. solve the game and grade the opponent */

{
  const MAX = 6;
  const pool = universe(MAX);
  const key = (board, who) => board.map(text).sort().join(" ") + "|" + who;

  const movesFor = (x, who) => F.legalMoves(x, who, MAX);

  const solved = new Map();
  /** Can `who` win this board, moving now, against perfect play? */
  function canWin(board, who) {
    const k = key(board, who);
    if (solved.has(k)) return solved.get(k);
    let win = false;
    outer: for (let i = 0; i < board.length && !win; i++) {
      for (const y of movesFor(board[i], who)) {
        const next = board.slice();
        next[i] = y;
        if (!canWin(next, other(who))) { win = true; break outer; }
      }
    }
    solved.set(k, win);
    return win;
  }

  // One fraction, then two: the sum of the values must call every game right.
  let graded = 0;
  let greedyRight = 0;
  for (const a of pool) {
    for (const who of [LEFT, RIGHT]) {
      const board = [a];
      equal(`value calls the one-fraction game ${text(a)} with ${who} to move`,
        F.winner(board, who) === who, canWin(board, who));
    }
  }
  for (let i = 0; i < pool.length; i++) {
    for (let j = i; j < pool.length; j++) {
      const board = [pool[i], pool[j]];
      for (const who of [LEFT, RIGHT]) {
        equal(`value calls ${board.map(text).join(" + ")} with ${who} to move`,
          F.winner(board, who) === who, canWin(board, who));

        // Grade the applet's greedy opponent: from a position it should win,
        // does its own move keep the win?
        if (canWin(board, who)) {
          const mv = F.pickMove(board, who);
          check(`greedy finds a move on ${board.map(text).join(" + ")}`, mv !== null);
          if (mv) {
            check(`greedy plays legally on ${board.map(text).join(" + ")}`,
              F.isLegal(board[mv.index], mv.to, who));
            const next = board.slice();
            next[mv.index] = mv.to;
            graded++;
            if (!canWin(next, other(who))) greedyRight++;
          }
        }
      }
    }
  }
  // Three fractions as well, on a coarser sweep: the greedy opponent has to
  // choose which fraction to touch, and that is where a heuristic can slip.
  for (let i = 0; i < pool.length; i += 2) {
    for (let j = i; j < pool.length; j += 3) {
      for (let k = j; k < pool.length; k += 5) {
        const board = [pool[i], pool[j], pool[k]];
        for (const who of [LEFT, RIGHT]) {
          equal(`value calls ${board.map(text).join(" + ")} with ${who} to move`,
            F.winner(board, who) === who, canWin(board, who));
          if (!canWin(board, who)) continue;
          const mv = F.pickMove(board, who);
          check(`greedy finds a move on ${board.map(text).join(" + ")}`, mv !== null);
          if (!mv) continue;
          const next = board.slice();
          next[mv.index] = mv.to;
          graded++;
          if (!canWin(next, other(who))) greedyRight++;
        }
      }
    }
  }

  // The applet is greedy on the numbers, not on their game values, so it is
  // not perfect. The sweep is fixed, so pin both figures rather than pretending
  // the opponent is flawless.
  equal("the sweep grades 1855 won positions", graded, 1855);
  equal("greedy keeps the win in all but two of them", greedyRight, 1853);

  // One of the two, written out, because it is the whole point of the flaw:
  // the move that shifts the *number* least shifts the *value* most.
  {
    const board = [frac(-3, 5), frac(1, 5), frac(3, 5)];
    equal("the example board is worth 1/16 to Left", F.boardValue(board), { p: 1, q: 16 });
    check("so Left wins it", canWin(board, LEFT));
    const greedy = F.pickMove(board, LEFT);
    equal("greedy touches -3/5", board[greedy.index], { p: -3, q: 5 });
    equal("and moves it to -2/3", greedy.to, { p: -2, q: 3 });
    const afterGreedy = board.slice();
    afterGreedy[greedy.index] = greedy.to;
    equal("which leaves -1/16, a loss", F.boardValue(afterGreedy), { p: -1, q: 16 });
    check("and Right now wins", canWin(afterGreedy, RIGHT));
    // The move that actually wins changes the number most and the value least.
    const right = [frac(-3, 5), frac(0, 1), frac(3, 5)];
    equal("1/5 -> 0 leaves 0", F.boardValue(right), { p: 0, q: 1 });
    check("and Right, to move, is lost", !canWin(right, RIGHT));
    check("yet -3/5 -> -2/3 moves the number less",
      Math.abs(num(frac(-2, 3)) - num(frac(-3, 5))) < Math.abs(num(frac(0, 1)) - num(frac(1, 5))));
  }
}

/* ----------------------------------------- 4. boards, bounds and an ending */

{
  let s = 20260101;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);

  for (let count = F.MIN_COUNT; count <= F.MAX_COUNT; count++) {
    for (let max = F.MIN_MAX; max <= F.MAX_MAX; max++) {
      const board = F.newBoard(count, max, rnd);
      equal(`newBoard(${count}, ${max}) has ${count} fractions`, board.length, count);
      for (const x of board) {
        check(`|numerator| <= ${max} in ${text(x)}`, Math.abs(x.p) <= max);
        check(`1 <= denominator <= ${max} in ${text(x)}`, x.q >= 1 && x.q <= max);
        equal(`${text(x)} is in lowest terms`, frac(x.p, x.q), x);
      }

      // Play it out with both sides greedy; it has to finish.
      let b = board.slice();
      let who = LEFT;
      let turns = 0;
      while (turns < 400) {
        const mv = F.pickMove(b, who);
        if (!mv) break;
        check(`move ${text(mv.to)} for ${who} is legal`, F.isLegal(b[mv.index], mv.to, who));
        b = b.slice();
        b[mv.index] = mv.to;
        who = other(who);
        turns++;
      }
      check(`count=${count} max=${max}: the game ends`, turns < 400, `${turns} turns`);
      check(`count=${count} max=${max}: the loser really is stuck`, F.isStuck(b, who));
    }
  }
}

done("check-fraction-game");
