"use strict";

/*
 * Pennies in Boxes - the logic behind Bogomolny's IntIter2 applet.
 * (cut-the-knot.org/SimpleGames/IntIter2.shtml.)
 *
 * Pennies lie in a few boxes. Pick two boxes; the one with more pennies pays
 * the other one exactly as many pennies as that one already holds. So if the
 * boxes hold p and q with p >= q,
 *
 *     (p, q)  ->  (p - q, 2q)
 *
 * The receiving box doubles, and the total never changes. The applet's
 * Compute() swaps the two boxes when the second one is the larger, so the
 * order of the clicks does not matter, and its Finished() asks for exactly one
 * non-empty box.
 *
 * Whether that can be reached depends on the deal. It always can when the
 * total is a power of two - that is the theorem on the page - and it never can
 * when the total is odd, because the last move doubles a box. Between those
 * two there is one clean test, and `winnable` is it:
 *
 *     one box is reachable  <=>  total / gcd(counts) is a power of two
 *
 * Divide every box by the gcd and the move rule is unchanged, so the "<=" half
 * is the page's own theorem applied to the scaled-down deal. The "=>" half is
 * the gcd argument: if g is the gcd now and g' the gcd after a move, then g'
 * divides p - q and 2q, hence 2p as well, so g' divides twice every count and
 * therefore g' | 2g. The gcd can only ever double, and a single box of N
 * pennies has gcd N, so N must be the starting gcd times a power of two.
 *
 * This file has no DOM. It defines the global PenniesCore.
 */

const PenniesCore = (function () {
  /** The move, on a plain array of counts. Returns a new array, or null. */
  function apply(counts, i, j) {
    if (i === j) return null;
    const p = counts[i];
    const q = counts[j];
    if (!p || !q) return null;          // an empty box can neither pay nor double
    const next = counts.slice();
    if (p >= q) { next[i] = p - q; next[j] = q + q; }
    else { next[j] = q - p; next[i] = p + p; }
    return next;
  }

  /** Which way the pennies would go: {from, to, amount}, or null. */
  function describe(counts, i, j) {
    if (i === j || !counts[i] || !counts[j]) return null;
    const [from, to] = counts[i] >= counts[j] ? [i, j] : [j, i];
    return { from, to, amount: counts[to] };
  }

  const nonEmpty = (counts) => counts.filter((n) => n > 0).length;
  const total = (counts) => counts.reduce((a, b) => a + b, 0);
  const isWon = (counts) => nonEmpty(counts) === 1;

  /** Boxes are interchangeable, so a position is its sorted non-zero counts. */
  const canonical = (counts) => counts.filter((n) => n > 0).sort((a, b) => a - b).join(",");

  /** Every position one move away, as canonical keys with a sample move. */
  function successors(counts) {
    const out = [];
    for (let i = 0; i < counts.length; i++) {
      for (let j = i + 1; j < counts.length; j++) {
        const next = apply(counts, i, j);
        if (next) out.push({ i, j, next });
      }
    }
    return out;
  }

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const gcdAll = (counts) => counts.filter((n) => n > 0).reduce((a, b) => gcd(a, b), 0);

  /**
   * The quick test: all the pennies can be gathered into one box exactly when
   * the total divided by the gcd of the boxes is a power of two. See the note
   * at the top; `canFinish` below is the slow search it is checked against.
   */
  function winnable(counts) {
    const n = total(counts);
    if (n === 0) return true;
    const scaled = n / gcdAll(counts);
    return (scaled & (scaled - 1)) === 0;
  }

  /**
   * Can the pennies be gathered into one box from here? A plain reachability
   * search: positions repeat, so the visited set is what stops the cycles.
   * This is the honest answer; `winnable` is the shortcut.
   */
  function canFinish(counts) {
    const start = counts.filter((n) => n > 0);
    if (start.length <= 1) return true;
    const seen = new Set();
    const stack = [start];
    while (stack.length) {
      const state = stack.pop();
      const key = canonical(state);
      if (seen.has(key)) continue;
      seen.add(key);
      if (isWon(state)) return true;
      for (const { next } of successors(state)) stack.push(next.filter((n) => n > 0));
    }
    return false;
  }

  /** The fewest moves to one box, as [i, j] pairs, or null if it cannot be done. */
  function solve(counts) {
    const start = counts.slice();
    if (isWon(start)) return [];
    const seen = new Map([[canonical(start), null]]);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const state of frontier) {
        for (const { i, j, next: after } of successors(state)) {
          const key = canonical(after);
          if (seen.has(key)) continue;
          seen.set(key, { from: canonical(state), move: [i, j], state: after });
          if (isWon(after)) {
            // Walk the trail back to the start.
            const moves = [];
            let at = key;
            while (seen.get(at)) {
              const step = seen.get(at);
              moves.unshift(step.move);
              at = step.from;
            }
            return moves;
          }
          next.push(after);
        }
      }
      frontier = next;
    }
    return null;
  }

  /**
   * The first move of a shortest solution, as [i, j], or null when the deal
   * cannot be gathered up at all. This is what the port's Hint button uses.
   *
   * It has to be a shortest-path move, not merely one that keeps the win in
   * reach: when the total is a power of two every move keeps it in reach, so
   * "any winning move" would happily walk round a cycle forever.
   */
  function hint(counts) {
    const moves = solve(counts);
    return moves && moves.length ? moves[0] : null;
  }

  /** The page's lemma: a move between two odd boxes leaves both even. */
  const bothOdd = (counts, i, j) => counts[i] % 2 === 1 && counts[j] % 2 === 1;

  /**
   * Deal `total` pennies into `boxes` boxes, every box with at least one, by
   * cutting the row of pennies at random places.
   */
  function deal(boxes, totalPennies, random = Math.random) {
    if (boxes < 2 || totalPennies < boxes) throw new Error("not enough pennies to go round");
    const cuts = new Set();
    while (cuts.size < boxes - 1) cuts.add(1 + Math.floor(random() * (totalPennies - 1)));
    const sorted = [...cuts].sort((a, b) => a - b);
    const counts = [];
    let last = 0;
    for (const cut of sorted) { counts.push(cut - last); last = cut; }
    counts.push(totalPennies - last);
    return counts;
  }

  /** One game: the counts, and the moves made, so a move can be taken back. */
  class Game {
    constructor(counts) {
      this.start = counts.slice();
      this.counts = counts.slice();
      this.history = [];
    }

    get finished() { return isWon(this.counts); }
    get total() { return total(this.counts); }

    /** Play the two clicked boxes. Returns {from, to, amount}, or null. */
    play(i, j) {
      const move = describe(this.counts, i, j);
      if (!move) return null;
      this.history.push(this.counts.slice());
      this.counts = apply(this.counts, i, j);
      return move;
    }

    undo() {
      const previous = this.history.pop();
      if (!previous) return false;
      this.counts = previous;
      return true;
    }

    reset() {
      this.counts = this.start.slice();
      this.history = [];
    }
  }

  return {
    apply, describe, successors, canonical, nonEmpty, total, isWon,
    gcdAll, winnable, canFinish, solve, hint, bothOdd, deal, Game,
  };
})();
