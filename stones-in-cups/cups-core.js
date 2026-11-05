"use strict";

/*
 * Stones in Cups - the procedure from Mathematics Magazine problem #1388
 * (Barry Cipra, 1992), as Bogomolny's BarryCipra applet implements it.
 *
 * n cups stand in a circle. The first n-e of them hold k stones each and the
 * last e are empty. A hand rests beside one cup. One MOVE: pick up every
 * stone in the cup under the hand, then drop them one at a time into the
 * cups that follow, going counterclockwise. The hand stays beside the cup
 * that received the last stone, so the next move is always forced.
 *
 * With no empty cups the original problem asks you to prove every run ends
 * with all kn stones back in the cup you started at.
 *
 * The idea this code leans on is that a move is INVERTIBLE: given a position
 * you can read off the one before it (take the stones under the hand, then
 * walk clockwise removing one stone from each cup until you meet an empty
 * one, and pour everything held into it). So "next position" is a bijection
 * on a finite set of positions, every orbit is a pure cycle, and iterating
 * must come back to the exact position it started from. That is why
 * `analyze` can settle "gathers" or "never gathers" by simulation in
 * finitely many moves instead of guessing: it runs until the stones are
 * gathered or until the start position comes round again.
 */

var CupsCore = (function () {
  /** Build the starting position. Mirrors BarryCipraCanvas.Reset(). */
  function create(setup) {
    const n = Math.max(1, Math.floor(setup.cups));
    const k = Math.max(1, Math.floor(setup.stones));
    // The applet reduces both of these mod n (SetNEmpties / SetStartPos).
    const empties = ((Math.floor(setup.empties || 0) % n) + n) % n;
    const start = ((Math.floor(setup.start || 0) % n) + n) % n;

    const counts = new Array(n).fill(0);
    for (let i = 0; i < n - empties; i++) counts[i] = k;

    return { n: n, k: k, empties: empties, start: start, counts: counts, hand: start, held: 0, moves: 0 };
  }

  function clone(s) {
    return {
      n: s.n, k: s.k, empties: s.empties, start: s.start,
      counts: s.counts.slice(), hand: s.hand, held: s.held, moves: s.moves,
    };
  }

  /** A position, as a comparable string: the cup contents plus where the hand is. */
  function key(s) {
    return s.counts.join(",") + "|" + s.hand;
  }

  function total(s) {
    return (s.n - s.empties) * s.k;
  }

  /**
   * Pick up the stones under the hand, ready to be dropped one at a time.
   * Returns false when that cup is empty, which can only happen on the very
   * first move: every later move leaves the hand on a cup it just filled.
   * Mirrors SetOneMove().
   */
  function pickUp(s) {
    if (s.held > 0) return true;
    if (s.counts[s.hand] === 0) return false;
    s.held = s.counts[s.hand];
    s.counts[s.hand] = 0;
    s.moves++;
    return true;
  }

  /** Drop one held stone into the next cup counterclockwise. Mirrors OneStep(). */
  function dropOne(s) {
    if (s.held <= 0) return false;
    s.held--;
    s.hand = (s.hand + 1) % s.n;
    s.counts[s.hand]++;
    return true;
  }

  /** One whole move: pick up, then drop the lot. */
  function move(s) {
    if (!pickUp(s)) return false;
    while (s.held > 0) dropOne(s);
    return true;
  }

  /** All the stones in a single cup. Mirrors IsFinished(). */
  function gathered(s) {
    if (s.held > 0) return false;
    let nonEmpty = 0;
    let where = -1;
    for (let i = 0; i < s.n; i++) {
      if (s.counts[i] > 0) { nonEmpty++; where = i; }
    }
    return nonEmpty === 1 && s.counts[where] === total(s);
  }

  /** The one cup holding stones, or -1. */
  function loneCup(s) {
    return gathered(s) ? s.counts.findIndex((c) => c > 0) : -1;
  }

  /**
   * Run the procedure from a starting setup until it either gathers every
   * stone into one cup or returns to the position it began at.
   *
   * Returns one of:
   *   { outcome: "gathers", moves, cup }   - all stones in cup `cup` after `moves` moves
   *   { outcome: "cycles", period }        - back to the start position, never gathered
   *   { outcome: "stuck" }                 - the hand began beside an empty cup
   *   { outcome: "unknown", moves }        - hit `limit` first (only for huge setups)
   */
  function analyze(setup, limit) {
    limit = limit || 2000000;
    const s = create(setup);
    if (gathered(s)) return { outcome: "gathers", moves: 0, cup: loneCup(s) };
    if (s.counts[s.hand] === 0) return { outcome: "stuck" };

    const startKey = key(s);
    for (let m = 1; m <= limit; m++) {
      move(s);
      if (gathered(s)) return { outcome: "gathers", moves: m, cup: loneCup(s) };
      if (key(s) === startKey) return { outcome: "cycles", period: m };
    }
    return { outcome: "unknown", moves: limit };
  }

  return {
    create: create,
    clone: clone,
    key: key,
    total: total,
    pickUp: pickUp,
    dropOne: dropOne,
    move: move,
    gathered: gathered,
    loneCup: loneCup,
    analyze: analyze,
  };
})();
