"use strict";

/*
 * 3-Colors Tower of Hanoi (Bogomolny's Hanoi3c applet) - rules and solver.
 *
 * Three pegs, each holding a tower of N disks of its own colour. A disk may
 * go on an empty peg, a bigger disk, or a disk of the SAME size. The goal,
 * as the cut-the-knot pages state it, is a derangement of the stacks: every
 * peg ends up with a complete single-colour tower again, but no tower is
 * back on the peg it started on.
 *
 * The solver is Stuart Anderson's algorithm, which the applet implements in
 * Hanoi3cCanvas.Solution/GATHER/SPREAD/SHIFT/MOVE; those are read off the
 * bytecode here line for line. GATHER collects every disk into one stack,
 * two SHIFTs carry the stack round the pegs, and SPREAD deals it back out,
 * "fooled" by the rotated pegs into putting each colour somewhere new.
 *
 * The applet's own finish test, CompleteDerangement(), is looser: it only
 * asks that no peg holds a disk of its starting colour, so mixed piles pass
 * (one disk a colour is "solved" in 4 moves). The port uses the stated goal;
 * appletFinished() keeps the applet's test for porting/check-hanoi-3c.mjs.
 */

var Hanoi3cCore = (function () {
  const MIN_N = 1;
  const MAX_N = 10; // Hanoi3cPanel's spinner: 1 to 10, starting at 3
  const DEFAULT_N = 3;

  /** Peg p starts with colour p; disks are {size, colour}, bottom first, size N the largest. */
  function start(n) {
    const pegs = [0, 1, 2].map((colour) => {
      const stack = [];
      for (let size = n; size >= 1; size--) stack.push({ size, colour });
      return stack;
    });
    return { n, pegs, moves: 0, touched: false };
  }

  const topOf = (s, p) => s.pegs[p][s.pegs[p].length - 1] || null;

  /** CanSettle(): no disk on a smaller one; equal sizes may stack. */
  function legal(s, from, to) {
    if (from === to) return false;
    const d = topOf(s, from);
    if (!d) return false;
    const t = topOf(s, to);
    return !t || t.size >= d.size;
  }

  function move(s, from, to) {
    if (!legal(s, from, to)) return false;
    s.pegs[to].push(s.pegs[from].pop());
    s.moves++;
    return true;
  }

  /** The stated goal: each peg a full tower of one colour, none on its own peg. */
  function won(s) {
    return s.pegs.every((stack, p) =>
      stack.length === s.n && stack.every((d) => d.colour === stack[0].colour) && stack[0].colour !== p);
  }

  /** The applet's CompleteDerangement() test, kept for reference. */
  function appletFinished(s) {
    return s.pegs.every((stack, p) => stack.every((d) => d.colour !== p));
  }

  /**
   * Solution(N, 0, 1, 2) and its helpers, as a list of [from, to] moves.
   * With other pegs it is the page's PERMUTE(a, b, c, N). out.phases marks
   * where GATHER, the two SHIFTs and SPREAD end.
   */
  function solution(n, a = 0, b = 1, c = 2) {
    const out = [];
    out.phases = [];
    const MOVE = (x, y) => out.push([x, y]);
    function SHIFT(x, y, z, k) {
      if (k <= 0) return;
      SHIFT(x, z, y, k - 1);
      MOVE(x, y);
      MOVE(x, y);
      MOVE(x, y);
      SHIFT(z, y, x, k - 1);
    }
    function GATHER(x, y, z, k) {
      if (k > 1) GATHER(y, z, x, k - 1);
      MOVE(y, z);
      SHIFT(x, y, z, k - 1);
      MOVE(x, z);
      SHIFT(y, z, x, k - 1);
    }
    function SPREAD(x, y, z, k) {
      SHIFT(x, y, z, k - 1);
      MOVE(x, z);
      SHIFT(y, z, x, k - 1);
      MOVE(x, y);
      if (k > 1) SPREAD(z, x, y, k - 1);
    }
    if (n === 0) return out;
    GATHER(a, b, c, n);
    out.phases.push(out.length);
    SHIFT(c, b, a, n);
    out.phases.push(out.length);
    SHIFT(b, a, c, n);
    out.phases.push(out.length);
    SPREAD(a, c, b, n);
    out.phases.push(out.length);
    return out;
  }

  return { MIN_N, MAX_N, DEFAULT_N, start, topOf, legal, move, won, appletFinished, solution };
})();
