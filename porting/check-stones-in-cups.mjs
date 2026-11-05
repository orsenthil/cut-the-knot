#!/usr/bin/env node
"use strict";

/*
 * Logic test for stones-in-cups/cups-core.js.
 *
 * The procedure (Mathematics Magazine problem #1388, Barry Cipra, 1992): n cups
 * in a circle, k stones in each of the first n-e, a hand beside one of them. A
 * move empties the cup under the hand one stone at a time into the following
 * cups, counterclockwise, and the hand follows the last stone dropped.
 *
 * What is checked:
 *
 *   1. The mechanics match BarryCipraCanvas - the opening layout, the wrap
 *      round the circle, the hand landing on the last stone, stones conserved,
 *      and a hand that starts beside an empty cup being unable to move.
 *   2. Problem #1388 itself, with no empty cups. Two different statements are
 *      distinguished, because the applet stops on the weaker one:
 *        - every run reaches a position with all kn stones in SOME single cup
 *          (that is BarryCipraCanvas.IsFinished, so it is what the port stops
 *          on), and
 *        - the full orbit also contains the position with all kn stones in the
 *          ORIGINAL cup, which is what the problem actually asks you to prove.
 *      The second is usually reached much later than the first, so a port that
 *      conflated them would read as a wrong answer to the problem.
 *   3. The counterexample the applet was built to find. The cut-the-knot page
 *      reports that n=6, k=2, one empty cup and the hand at cup #1 rotates in
 *      twelve moves to a shifted copy of itself without ever gathering; that
 *      configuration and that number are checked literally.
 *
 * `analyze` terminates only because a move is invertible, so the orbit through
 * the opening position is a pure cycle rather than a lasso. That is checked
 * too: the reported period really does bring the position back, and no earlier
 * move does.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("stones-in-cups/cups-core.js", "CupsCore");

/** Walk the whole orbit. Terminates because the map is a bijection. */
function orbit(setup, limit = 200000) {
  const s = C.create(setup);
  const from = C.key(s);
  const allInOriginal = (() => {
    const a = new Array(s.n).fill(0);
    a[s.start] = C.total(s);
    return a.join(",") + "|" + s.start;
  })();
  let hitOriginalCup = false;
  let firstGather = null;
  for (let m = 1; m <= limit; m++) {
    C.move(s);
    const k = C.key(s);
    if (k === allInOriginal) hitOriginalCup = true;
    if (firstGather === null && C.gathered(s)) firstGather = { move: m, cup: C.loneCup(s) };
    if (k === from) return { period: m, hitOriginalCup: hitOriginalCup, firstGather: firstGather };
  }
  return { period: null, hitOriginalCup: hitOriginalCup, firstGather: firstGather };
}

/* ------------------------------------------------- 1. the mechanics of a move */

{
  const s = C.create({ cups: 6, stones: 2, empties: 1, start: 0 });
  equal("the opening layout fills all but the last e cups", s.counts, [2, 2, 2, 2, 2, 0]);
  equal("the hand starts beside the chosen cup", s.hand, 0);
  equal("no moves made yet", s.moves, 0);
  equal("total() counts only the filled cups", C.total(s), 10);

  C.move(s);
  // Cup 0 held 2 stones, so they go into cups 1 and 2 and the hand follows.
  equal("a move drops the stones into the cups that follow", s.counts, [0, 3, 3, 2, 2, 0]);
  equal("the hand ends beside the cup that got the last stone", s.hand, 2);
  equal("the move counter advances", s.moves, 1);
}

{
  const s = C.create({ cups: 4, stones: 1, empties: 0, start: 3 });
  C.move(s);
  equal("a move from the last cup wraps round to cup 0", s.counts, [2, 1, 1, 0]);
  equal("and the hand wraps with it", s.hand, 0);
}

{
  // A move with more stones than cups goes round more than once.
  const s = C.create({ cups: 3, stones: 1, empties: 0, start: 0 });
  s.counts = [7, 0, 0];
  equal("7 stones round 3 cups: two laps, plus one more", (C.move(s), s.counts), [2, 3, 2]);
  // Three laps would be cups 1,2,0,1,2,0,1 - the last stone lands in cup 1.
  equal("the 7th stone lands in cup 1", s.hand, 1);
}

{
  // Animating a move stone by stone must land where the whole move lands.
  const a = C.create({ cups: 7, stones: 3, empties: 2, start: 1 });
  const b = C.clone(a);
  C.move(a);
  C.pickUp(b);
  while (b.held > 0) C.dropOne(b);
  equal("stone-by-stone agrees with the whole move", C.key(b), C.key(a));
  equal("and so does the move counter", b.moves, a.moves);
}

{
  const s = C.create({ cups: 9, stones: 4, empties: 3, start: 0 });
  const want = C.total(s);
  let conserved = true;
  let handOnStones = true;
  for (let i = 0; i < 2000; i++) {
    C.move(s);
    if (s.counts.reduce((x, y) => x + y, 0) !== want) conserved = false;
    if (s.counts[s.hand] === 0) handOnStones = false;
  }
  check("stones are conserved over 2000 moves", conserved);
  check("after a move the hand always rests on a non-empty cup", handOnStones);
}

{
  // In the applet SetOneMove() returns false and nothing happens. Only the
  // opening position can be like this, since every move fills the cup it ends on.
  const setup = { cups: 5, stones: 2, empties: 2, start: 4 };
  const s = C.create(setup);
  equal("the chosen start cup is one of the empty ones", s.counts[s.hand], 0);
  check("no move is possible from an empty cup", C.move(s) === false);
  equal("and nothing changed", s.counts, [2, 2, 2, 0, 0]);
  equal("analyze() calls that stuck", C.analyze(setup).outcome, "stuck");
}

{
  // e = n-1 leaves one loaded cup, which already satisfies IsFinished().
  const r = C.analyze({ cups: 5, stones: 3, empties: 4, start: 0 });
  equal("one loaded cup is already gathered", r.outcome, "gathers");
  equal("in zero moves", r.moves, 0);
}

/* --------------------- 2. problem #1388, the case with no empty cups */

{
  let gathers = 0;
  let longestFirst = { move: -1 };
  let longestOriginal = { period: -1 };
  for (let n = 2; n <= 8; n++) {
    for (let k = 1; k <= 3; k++) {
      for (const start of [0, n - 1]) {
        const setup = { cups: n, stones: k, empties: 0, start: start };
        const o = orbit(setup);
        if (o.period === null) {
          check(`n=${n} k=${k} start=${start}: the orbit closes`, false, "hit the move limit");
          continue;
        }
        // The weaker statement, which is what the applet stops on.
        check(`n=${n} k=${k} start=${start}: all stones reach a single cup`, o.firstGather !== null);
        // The problem as actually stated.
        check(`n=${n} k=${k} start=${start}: and the ORIGINAL cup is reached too`, o.hitOriginalCup);

        const a = C.analyze(setup);
        equal(`n=${n} k=${k} start=${start}: analyze() agrees it gathers`, a.outcome, "gathers");
        equal(`n=${n} k=${k} start=${start}: at the same move`, a.moves, o.firstGather.move);
        equal(`n=${n} k=${k} start=${start}: in the same cup`, a.cup, o.firstGather.cup);
        gathers++;
        if (o.firstGather.move > longestFirst.move) longestFirst = { n: n, k: k, move: o.firstGather.move };
        if (o.period > longestOriginal.period) longestOriginal = { n: n, k: k, period: o.period };
      }
    }
  }
  check("no setup without empty cups fails to gather", gathers === 7 * 3 * 2, `${gathers} setups checked`);
  console.log(`     (longest wait for a single cup: ${longestFirst.move} moves at n=${longestFirst.n} k=${longestFirst.k};`);
  console.log(`      longest orbit: ${longestOriginal.period} moves at n=${longestOriginal.n} k=${longestOriginal.k})`);
}

{
  // The smallest case, by hand. [1,1] hand at cup 0 -> [0,2] hand at cup 1:
  // both stones in one cup after a single move, but in cup 1, not cup 0. The
  // original cup only fills at move 3, two moves later.
  const setup = { cups: 2, stones: 1, empties: 0, start: 0 };
  const r = C.analyze(setup);
  equal("n=2, k=1 gathers after one move", r.moves, 1);
  equal("but in the other cup", r.cup, 1);
  const o = orbit(setup);
  equal("its orbit is 4 moves long", o.period, 4);
  check("and the original cup does fill somewhere in it", o.hitOriginalCup);
}

/* --------------------------- 3. the counterexample the applet was built for */

{
  // From the cut-the-knot page: "with n = 6, k = 2, one empty cup at the 6th
  // position and the hand at cup #1, in twelve moves the configuration rotates
  // so that the empty cup comes to the 4th position with the hand at cup #5
  // without ever getting all the stones in a single cup."
  const setup = { cups: 6, stones: 2, empties: 1, start: 0 };
  const s = C.create(setup);
  let gatheredEver = false;
  for (let m = 0; m < 12; m++) {
    C.move(s);
    if (C.gathered(s)) gatheredEver = true;
  }
  check("the counterexample never gathers in those twelve moves", !gatheredEver);
  equal("after 12 moves the empty cup has moved to the 4th position", s.counts, [2, 2, 2, 0, 2, 2]);
  equal("and the hand is beside cup #5, i.e. index 4", s.hand, 4);

  const r = C.analyze(setup);
  equal("so this setup never gathers at all", r.outcome, "cycles");
  // Those twelve moves rotate the picture two cups along, so three rounds of
  // them - 36 moves - bring it back to exactly where it started.
  equal("and its orbit is 3 x 12 moves long", r.period, 36);
}

{
  // The reported period must really be the period: a return, and the first one.
  const setup = { cups: 6, stones: 2, empties: 1, start: 0 };
  const period = C.analyze(setup).period;
  const s = C.create(setup);
  const from = C.key(s);
  let earlyReturn = false;
  for (let m = 1; m < period; m++) {
    C.move(s);
    if (C.key(s) === from) earlyReturn = true;
  }
  check("the position does not return before the reported period", !earlyReturn);
  C.move(s);
  equal("and it returns exactly at it", C.key(s), from);
}

{
  // Empty cups are what break the claim, but they do not always break it. The
  // real test is that every setup reaches one of the three verdicts - which is
  // the invertibility argument doing its work.
  const tally = { gathers: 0, cycles: 0, stuck: 0 };
  let unresolved = 0;
  for (let n = 2; n <= 8; n++) {
    for (let k = 1; k <= 3; k++) {
      for (let e = 1; e < n; e++) {
        for (let start = 0; start < n; start++) {
          const r = C.analyze({ cups: n, stones: k, empties: e, start: start }, 200000);
          if (r.outcome in tally) tally[r.outcome]++;
          else unresolved++;
        }
      }
    }
  }
  equal("every setup with empty cups reaches a verdict", unresolved, 0);
  check("some of them never gather", tally.cycles > 0, `${tally.cycles} do not`);
  check("and some still do", tally.gathers > 0, `${tally.gathers} do`);
  console.log(`     (with empty cups: ${tally.gathers} gather, ${tally.cycles} cycle for ever, ${tally.stuck} start stuck)`);
}

done("stones-in-cups");
