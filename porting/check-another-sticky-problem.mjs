#!/usr/bin/env node
"use strict";

/*
 * Logic test for another-sticky-problem/another-sticky-problem-core.js.
 *
 *   node porting/check-another-sticky-problem.mjs
 *
 * 1. The rules, straight from the applet and the page: the start is N and
 *    N+1, a break cuts one stick into two positive pieces, and a removal takes
 *    k sticks of length k when at least k of them exist. Bad clicks and bad
 *    removals are refused.
 * 2. The page's strategy is checked as a fact over EVERY position with total
 *    length at most 21 and no stick longer than 11: from a set-A position
 *    every legal move lands in B; from every set-B position some legal move
 *    lands back in A. It is also checked that A is exactly the losing set,
 *    by solving the game from every one of those positions.
 * 3. The start position is solved for N = 1..12 and is losing for the player
 *    to move, so the second player wins; for N = 1..30 a human playing every
 *    random legal move against the computer always loses, on several seeds.
 * 4. The computer is compared with a second, literal transcription of
 *    TwoStickStartCanvas.Play and its helpers. Both use the same seeded random
 *    draws; the resulting position, the kind of move and the number of draws
 *    must agree on every position above, on every start N = 1..30, and on
 *    every position reachable from the starts for N = 1..8.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("another-sticky-problem/another-sticky-problem-core.js", "AnotherStickyProblemCore");

/* ---------------------------------------------------------------- helpers */

const sorted = (sticks) => sticks.slice().sort((a, b) => a - b);
const key = (sticks) => sorted(sticks).join(",");
const stateOf = (n, sticks) => ({ n, sticks: sticks.slice() });

/**
 * Every nondecreasing multiset of positive integers with sum at most maxSum
 * and each part at most maxPart, including the empty one. This is every
 * position a game can hold, since a break keeps the total and a removal only
 * lowers it, and no stick can grow.
 */
function* partitions(maxPart, maxSum) {
  const parts = [];
  function* walk(remaining, min) {
    yield parts.slice();
    for (let p = min; p <= Math.min(maxPart, remaining); p++) {
      parts.push(p);
      yield* walk(remaining - p, p);
      parts.pop();
    }
  }
  yield* walk(maxSum, 1);
}

/** All positions reachable from the start with every legal move tried. */
function reachable(n) {
  const start = C.start({ n });
  const seen = new Map([[key(start.sticks), start.sticks.slice()]]);
  const stack = [key(start.sticks)];
  while (stack.length) {
    const sticks = seen.get(stack.pop());
    const state = stateOf(n, sticks);
    for (const m of C.legalMoves(state)) {
      const next = C.move(state, m);
      const k = key(next.sticks);
      if (!seen.has(k)) {
        seen.set(k, next.sticks.slice());
        stack.push(k);
      }
    }
  }
  return [...seen.values()];
}

/*
 * The applet's computer, written a second time from the bytecode, with the
 * heaps as objects so they can be removed by identity as java.util.Vector
 * does. `random` is injected so both versions can consume the same sequence.
 */
class AppletPlay {
  constructor(n, sticks, random) {
    this.n = n;
    this.random = random;
    this.nextId = 0;
    this.heaps = sticks.map((w) => this.newHeap(w));
  }
  newHeap(w) {
    return { id: this.nextId++, w };
  }
  removeHeap(h) {
    const i = this.heaps.indexOf(h);
    if (i >= 0) this.heaps.splice(i, 1);
  }
  /** TwoStickStartHeap.Split: first half `at`, second half width - at. */
  splitHeap(h, at) {
    if (!(at >= 1 && at < h.w)) throw new Error(`bad split of ${h.w} at ${at}`);
    const first = this.newHeap(at);
    const second = this.newHeap(h.w - at);
    this.heaps.push(first, second); // addElement(first); addElement(second)
    this.removeHeap(h);
  }
  /** TwoStickStartCanvas.Split(int length, int a, int b). */
  splitLength(length, a, b) {
    for (const h of this.heaps) {
      if (h.w === length) {
        this.splitHeap(h, this.random() < 0.5 ? a : b);
        return true;
      }
    }
    return false;
  }
  /** TwoStickStartCanvas.SplitRandom. */
  splitRandom() {
    const candidates = this.heaps.filter((h) => h.w > 1);
    const h = candidates[Math.trunc(this.random() * candidates.length)];
    const at = Math.trunc(this.random() * (h.w - 2) + 1);
    this.splitHeap(h, at);
  }
  /** TwoStickStartCanvas.SplitEvenOddly. */
  splitEvenOddly() {
    let chosen = null;
    for (const h of this.heaps) {
      if (h.w % 2 !== 0) continue;
      if (chosen === null) {
        chosen = h;
        if (this.random() < 0.5) break;
      } else {
        chosen = h;
        break;
      }
    }
    if (chosen === null) return;
    const at = 2 * Math.trunc(this.random() * Math.floor(chosen.w / 2)) + 1;
    this.splitHeap(chosen, at);
  }
  /** TwoStickStartCanvas.SplitOneEven. */
  splitOneEven() {
    for (const h of this.heaps.slice()) {
      if (h.w % 2 !== 0) continue;
      const at = 2 * Math.trunc(this.random() * Math.floor(h.w / 2)) + 1;
      this.splitHeap(h, at);
    }
  }
  /** TwoStickStartCanvas.CanRemoveSize. */
  canRemoveSize(counts) {
    const sizes = [];
    for (let i = 0; i < counts.length; i++) if (counts[i] >= i + 1) sizes.push(i);
    if (sizes.length === 0) return -1;
    return sizes[Math.trunc(this.random() * sizes.length)] + 1;
  }
  /** TwoStickStartCanvas.FindAndRemoveSize. */
  findAndRemoveSize(length) {
    const chosen = [];
    for (const h of this.heaps) {
      if (chosen.length >= length) break;
      if (h.w === length) chosen.push(h);
    }
    if (chosen.length < length) {
      this.splitRandom();
      return;
    }
    for (const h of chosen) this.removeHeap(h);
  }
  /** TwoStickStartCanvas.MakeRandomMove. */
  makeRandomMove(counts) {
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] === i + 1 && this.random() < 0.25) {
        this.findAndRemoveSize(i + 1);
        return;
      }
    }
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] === i + 1 && this.random() < 0.25) {
        const a = Math.trunc(1 + this.random() * Math.abs(i - 1));
        this.splitLength(i + 1, a, i + 1 - a);
        return;
      }
    }
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > 0) {
        this.findAndRemoveSize(i + 1);
        return;
      }
    }
  }
  /** TwoStickStartCanvas.Play. */
  play() {
    const counts = new Array(this.n + 1).fill(0);
    for (const h of this.heaps) counts[h.w - 1]++;
    let total = 0;
    let even = 0;
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > 0) total += counts[i];
      if (counts[i] !== 0 && i % 2 === 1) even += counts[i];
    }
    if (total % 2 === 0) {
      if (even >= 2) this.makeRandomMove(counts);
      else if (even === 1) this.splitRandom();
      else this.makeRandomMove(counts);
    } else if (even > 2) {
      this.makeRandomMove(counts);
    } else if (even === 2) {
      this.splitEvenOddly();
    } else if (even === 1) {
      const length = this.canRemoveSize(counts);
      if (length === -1 || this.random() < 0.5) this.splitOneEven();
      else this.findAndRemoveSize(length);
    } else {
      const length = this.canRemoveSize(counts);
      const splittable = this.heaps.some((h) => h.w > 1);
      if (length === -1) {
        if (splittable) this.splitRandom();
      } else if (!splittable) {
        this.findAndRemoveSize(length);
      } else if (this.random() < 0.5) {
        this.splitRandom();
      } else {
        this.findAndRemoveSize(length);
      }
    }
    return this.heaps.map((h) => h.w);
  }
}

/** A seeded source that counts the draws it has served. */
function counted(seed) {
  const next = rng(seed);
  let draws = 0;
  return {
    random: () => {
      draws++;
      return next();
    },
    draws: () => draws,
  };
}

/** Compare the core's computer move with the literal applet transcription. */
function compareComputer(label, state, seed) {
  const before = sorted(state.sticks);
  const coreCount = counted(seed);
  const appCount = counted(seed);
  const move = C.computerMove(state, coreCount.random);
  const applet = new AppletPlay(state.n, state.sticks, appCount.random);
  const afterApplet = applet.play();
  const afterCore = move ? C.move(state, move).sticks : before;
  const moved = afterApplet.length !== before.length;
  const kind = move ? move.type : null;
  const kindApplet = afterApplet.length > before.length ? "break"
    : afterApplet.length < before.length ? "remove" : null;
  check(
    `${label}: the same move as the applet (seed ${seed})`,
    key(before) === key(state.sticks) &&
      key(afterCore) === key(afterApplet) &&
      kind === kindApplet &&
      !!(move || moved) === !!move &&
      coreCount.draws() === appCount.draws(),
    `core ${key(afterCore)} ${kind} after ${coreCount.draws()} draws, ` +
      `applet ${key(afterApplet)} ${kindApplet} after ${appCount.draws()} draws`,
  );
}

/** Solve normal play from a multiset; true when the player to move loses. */
const losingMemo = new Map();
function isLosing(sticks) {
  const k = key(sticks);
  if (losingMemo.has(k)) return losingMemo.get(k);
  const state = stateOf(30, sticks);
  let losing = true;
  for (const m of C.legalMoves(state)) {
    if (isLosing(C.move(state, m).sticks)) {
      losing = false;
      break;
    }
  }
  losingMemo.set(k, losing);
  return losing;
}

/* ---------------------------------------------------------- 1. the rules */

{
  const start = C.start({});
  equal("the default start is N = 10 with sticks 10 and 11", start, { n: 10, sticks: [10, 11] });
  equal("N is clamped up to 1", C.start({ n: 0 }).sticks, [1, 2]);
  equal("N is clamped down to 30", C.start({ n: 99 }).sticks, [30, 31]);
  equal("a missing N falls back to 10", C.start({ n: NaN }).sticks, [10, 11]);
  equal("a given position is kept", C.start({ n: 3, sticks: [2, 2, 3] }), { n: 3, sticks: [2, 2, 3] });
  equal("a position with a stick over N+1 falls back", C.start({ n: 3, sticks: [4, 4] }).sticks, [3, 4]);
  equal("a position with too little length is kept", C.start({ n: 3, sticks: [1] }).sticks, [1]);

  const s = stateOf(3, [2, 2]);
  equal("counts by length", C.counts(s), { 2: 2 });
  equal("counts indexed by length - 1", C.countsArray(s), [0, 2, 0, 0]);
  equal("the number of sticks", C.totalSticks(s), 2);
  equal("the total length", C.totalLength(s), 4);
  equal("the number of even sticks", C.evenSticks(s), 2);
  check("the applet's N+1 slots hold length N+1", C.countsArray(stateOf(10, [11]))[10] === 1);

  // Break: at is 1..length-1; the two pieces keep the length.
  const three = stateOf(3, [3]);
  equal("a break at 1 gives 1 and 2", C.split(three, 0, 1), { n: 3, sticks: [1, 2] });
  equal("a break at 2 gives 2 and 1", C.split(three, 0, 2), { n: 3, sticks: [2, 1] });
  check("a break at 0 is refused", C.split(three, 0, 0) === null);
  check("a break at the whole length is refused", C.split(three, 0, 3) === null);
  check("a break of a missing stick is refused", C.split(three, 1, 1) === null);
  check("a break of a length-1 stick is refused", C.split(stateOf(3, [1, 2]), 0, 1) === null);
  check("a break leaves the position alone", JSON.stringify(three) === JSON.stringify({ n: 3, sticks: [3] }));

  // Removal: k sticks of length k, and at least k of them.
  const four = stateOf(4, [2, 2, 2, 3]);
  equal("removable lengths", C.removableLengths(four), [2]);
  check("two 2-sticks can be removed", C.canRemove(four, 2) === true);
  check("three 2-sticks cannot be removed as the length-3 move", C.canRemove(four, 3) === false);
  equal("two of the three 2-sticks go", C.remove(four, 2), { n: 4, sticks: [2, 3] });
  equal("the clicked stick can be named", C.remove(four, 2, 2), { n: 4, sticks: [2, 3] });
  equal("an index of another length is ignored", C.remove(four, 2, 3), { n: 4, sticks: [2, 3] });
  check("a removal of too few sticks is refused", C.remove(stateOf(3, [3, 3]), 3) === null);
  check("a removal of zero-length sticks is refused", C.canRemove(stateOf(1, [1]), 0) === false);
  equal("one 1-stick is removable", C.remove(stateOf(2, [1, 1, 2]), 1), { n: 2, sticks: [1, 2] });
  check("a removal leaves the position alone", JSON.stringify(four) === JSON.stringify({ n: 4, sticks: [2, 2, 2, 3] }));

  const one = stateOf(1, [1]);
  equal("a 1-stick has no break but one removal", C.legalMoves(one), [{ type: "remove", length: 1, count: 1 }]);
  equal("a 3-stick has two breaks and no removal", C.legalMoves(three), [
    { type: "break", stick: 0, length: 3, at: 1 },
    { type: "break", stick: 0, length: 3, at: 2 },
  ]);
  equal("move applies a break", C.move(three, { type: "break", stick: 0, at: 2 }), { n: 3, sticks: [2, 1] });
  equal("move applies a removal", C.move(stateOf(2, [1, 1]), { type: "remove", length: 1 }), { n: 2, sticks: [1] });
  check("move refuses an unknown kind", C.move(three, { type: "burn" }) === null);
  check("move refuses nothing", C.move(three, null) === null);

  // Sets A and B.
  equal("the empty position is A", C.classOf(stateOf(1, [])), "A");
  equal("the start is A: 2 sticks, one even", C.classOf(stateOf(4, [4, 5])), "A");
  equal("an odd number of sticks is B", C.classOf(stateOf(1, [1])), "B");
  equal("one even stick and odd count is B", C.classOf(stateOf(1, [2])), "B");
  equal("two even sticks and even count is outside A and B", C.classOf(stateOf(1, [2, 2])), null);
  equal("three even sticks and odd count is outside A and B", C.classOf(stateOf(1, [2, 2, 2])), null);
  equal("two even sticks and odd count is B", C.classOf(stateOf(2, [2, 2, 1])), "B");

  equal("a new game is not over", C.isOver(start), false);
  equal("the empty position is over", C.isOver(stateOf(1, [])), true);

  const view = C.position(stateOf(3, [1, 2]));
  equal("the saved position has the four fields and the reading", view, {
    n: 3,
    sticks: [1, 2],
    totalSticks: 2,
    totalLength: 3,
    evenSticks: 1,
    counts: { 1: 1, 2: 1 },
    class: "A",
    removable: [1],
    over: false,
  });
}

/* --------------------------- 2. every case, where the numbers are small */

// Every position with total length at most 21 and no stick longer than 11.
const EVERYTHING = [...partitions(11, 21)];
{
  check("the exhaustive sweep really has every partition", EVERYTHING.length > 3000);
  let inA = 0;
  let inB = 0;
  let outside = 0;
  let checkedMoves = 0;
  for (const sticks of EVERYTHING) {
    const state = stateOf(10, sticks);
    const cls = C.classOf(state);
    const moves = C.legalMoves(state);
    if (cls === "A") {
      inA++;
      if (sticks.length > 0) check("a nonempty A position has a move", moves.length > 0, key(sticks));
      for (const m of moves) {
        checkedMoves++;
        const next = C.move(state, m);
        check(
          `from A, ${JSON.stringify(m)} on [${key(sticks)}] lands in B`,
          next !== null && C.classOf(next) === "B",
          next ? `landed in ${C.classOf(next)} as [${key(next.sticks)}]` : "the move failed",
        );
      }
    } else if (cls === "B") {
      inB++;
      check(
        `from B, [${key(sticks)}] has a move back to A`,
        moves.some((m) => C.classOf(C.move(state, m)) === "A"),
        `${moves.length} legal moves`,
      );
    } else {
      outside++;
    }
  }
  check("the sweep saw both sets", inA > 100 && inB > 100);
  check("the sweep tried many moves", checkedMoves > 1000);
  check("every sweep position was classified A, B or neither", inA + inB + outside === EVERYTHING.length);

  // The strategy says A is exactly the losing set.
  let solved = 0;
  for (const sticks of EVERYTHING) {
    const cls = C.classOf(stateOf(10, sticks));
    if (cls !== "A" && cls !== "B") continue;
    solved++;
    check(
      `[${key(sticks)}] is ${cls === "A" ? "losing" : "winning"} for the player to move`,
      isLosing(sticks) === (cls === "A"),
      `class ${cls}, ${isLosing(sticks) ? "losing" : "winning"}`,
    );
  }
  check("the solver decided every A and B position", solved === inA + inB);
}

// Every position reachable from a start is a legal position for that N, and
// arbitrary play can leave A and B (only the strategy keeps it there), so the
// sweep records that too.
{
  let positions = 0;
  let inSets = 0;
  for (let n = 1; n <= 8; n++) {
    const seen = reachable(n);
    positions += seen.length;
    for (const sticks of seen) {
      check(
        `reachable from N = ${n}: [${key(sticks)}] is a legal position`,
        sticks.every((v) => v >= 1 && v <= n + 1) && sticks.reduce((a, b) => a + b, 0) <= 2 * n + 1,
      );
      if (C.classOf(stateOf(n, sticks)) !== null) inSets++;
    }
    check(`the N = ${n} sweep reaches the start and the end`,
      seen.some((s) => key(s) === key([n, n + 1])) && seen.some((s) => key(s) === ""));
  }
  check("the reachable sweeps are not trivial", positions > 500);
  check("arbitrary play reaches positions outside A and B", inSets < positions);
}

// The start is losing for the first player, so the second player wins.
for (let n = 1; n <= 12; n++) {
  check(`N = ${n}: the start is in A`, C.classOf(stateOf(n, [n, n + 1])) === "A");
  check(`N = ${n}: the second player wins`, isLosing([n, n + 1]), `start [${n},${n + 1}]`);
}

// A human playing any legal move loses to the computer.
{
  let games = 0;
  let computerWins = 0;
  for (let n = 1; n <= 30; n++) {
    for (let seed = 1; seed <= 8; seed++) {
      const rand = rng(seed * 1000 + n);
      let state = C.start({ n });
      let humanTurn = true;
      let ok = true;
      let reason = "";
      let guard = 0;
      while (!C.isOver(state)) {
        if (guard++ > 5000) { ok = false; reason = "the game did not end"; break; }
        if (humanTurn) {
          const moves = C.legalMoves(state);
          if (C.classOf(state) !== "A") { ok = false; reason = "the human was not on A"; break; }
          const next = C.move(state, moves[Math.floor(rand() * moves.length)]);
          if (!next || C.classOf(next) !== "B") { ok = false; reason = "a human move did not land in B"; break; }
          state = next;
          humanTurn = false;
        } else {
          if (C.classOf(state) !== "B") { ok = false; reason = "the computer was not on B"; break; }
          const move = C.computerMove(state, rand);
          const next = move && C.move(state, move);
          if (!next || C.classOf(next) !== "A") { ok = false; reason = "the computer did not land in A"; break; }
          state = next;
          humanTurn = true;
        }
      }
      games++;
      // After the loop, humanTurn is true exactly when the computer moved last.
      if (ok && humanTurn) computerWins++;
      else if (ok) reason = "the human made the last move";
      check(`N = ${n}, seed ${seed}: the computer wins from the start`, ok && humanTurn, reason);
    }
  }
  check("many games were played out", games === 240 && computerWins === games);
}

/* ------------------------- 3. the applet's own method, a second time */

// Every position in the exhaustive sweep, on four seeds.
{
  let compared = 0;
  for (const sticks of EVERYTHING) {
    for (const seed of [1, 2, 3, 4]) {
      compareComputer(`[${key(sticks)}]`, stateOf(10, sticks), seed);
      compared++;
    }
  }
  check("the computer was compared on every sweep position", compared === EVERYTHING.length * 4);
}

// Every start N = 1..30: the whole option range, on eight seeds.
for (let n = 1; n <= 30; n++) {
  for (let seed = 1; seed <= 8; seed++) {
    compareComputer(`N = ${n}`, stateOf(n, [n, n + 1]), seed);
  }
}

// Every position reachable from the starts for N = 1..8, on two seeds.
{
  let compared = 0;
  for (let n = 1; n <= 8; n++) {
    for (const sticks of reachable(n)) {
      for (const seed of [1, 2]) {
        compareComputer(`N = ${n} [${key(sticks)}]`, stateOf(n, sticks), seed);
        compared++;
      }
    }
  }
  check("the computer was compared on the reachable positions", compared > 1000);
}

// The computer never makes an illegal move, and lands in A from every B.
{
  let checked = 0;
  for (const sticks of EVERYTHING) {
    const state = stateOf(10, sticks);
    if (sticks.length === 0) continue;
    const cls = C.classOf(state);
    for (let seed = 1; seed <= 4; seed++) {
      const move = C.computerMove(state, rng(seed));
      const next = move && C.move(state, move);
      check(
        `computer: a legal move from [${key(sticks)}]`,
        next !== null,
        `got ${JSON.stringify(move)}`,
      );
      if (cls === "B") {
        check(
          `computer: [${key(sticks)}] is B and the move lands in A`,
          C.classOf(next) === "A",
          `landed in ${next && C.classOf(next)}`,
        );
      }
      checked++;
    }
  }
  check("the computer was asked for many moves", checked > 10000);
}

// The empty position has no move at all.
{
  check("the computer has no move in an empty position", C.computerMove(stateOf(3, []), rng(1)) === null);
  equal("the empty position has no legal moves", C.legalMoves(stateOf(3, [])), []);
}

done("another-sticky-problem");
