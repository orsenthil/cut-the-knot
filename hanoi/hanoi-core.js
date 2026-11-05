"use strict";

/*
 * Tower of Hanoi (Bogomolny's hanoi applet) - the rules and both solvers.
 *
 * N disks start on the left peg, largest at the bottom. Move them all to
 * the right peg, one disk at a time, never putting a disk on a smaller one.
 * Disks are numbered by size, 1 the smallest, as the applet's ring Id().
 *
 * Two solvers, both read off the bytecode:
 *
 *   solution(n) is hanoicanvas.Solution(N, Src, Aux, Dst), the recursion
 *   on the cut-the-knot page: move N-1 disks out of the way, move the
 *   bottom disk, move the N-1 back on top. The Slow and Fast buttons play
 *   it, and only from the starting position, as in the applet.
 *
 *   suggest(s) is hanoicanvas.Help(), the "Suggest move" button, which the
 *   page credits to Romek Zylla. It works from ANY position: walk down from
 *   the biggest disk with a target peg (the right peg to start with). A
 *   disk already on its target needs nothing. A disk that is free and can
 *   go on its target is the move. Otherwise the disks above it must first
 *   go to the third peg, so that becomes the target for the next disk down.
 *
 * porting/check-hanoi.mjs checks both against breadth-first search over
 * every position for up to 8 disks.
 */

var HanoiCore = (function () {
  const MIN_DISKS = 1;
  const MAX_DISKS = 10; // hncontrol's spinner: 1 to 10, starting at 4
  const DEFAULT_DISKS = 4;
  const SRC = 0;
  const AUX = 1;
  const DST = 2;

  /** Pegs are arrays of disk sizes, bottom first. */
  function start(n) {
    const pegs = [[], [], []];
    for (let d = n; d >= 1; d--) pegs[SRC].push(d);
    return { n, pegs, moves: 0, touched: false };
  }

  const top = (s, p) => (s.pegs[p].length ? s.pegs[p][s.pegs[p].length - 1] : 0);

  /** CanSettle(): any disk may go on an empty peg or on a bigger disk. */
  function legal(s, from, to) {
    if (from === to || !s.pegs[from].length) return false;
    const t = top(s, to);
    return t === 0 || t > top(s, from);
  }

  function move(s, from, to) {
    if (!legal(s, from, to)) return false;
    s.pegs[to].push(s.pegs[from].pop());
    s.moves++;
    s.touched = true;
    return true;
  }

  /** CanSettle()'s finish test: the left and middle pegs empty, every disk on the right. */
  function won(s) {
    return s.pegs[SRC].length === 0 && s.pegs[AUX].length === 0 && s.pegs[DST].length === s.n;
  }

  const minimum = (n) => 2 ** n - 1;

  /** Approve(): fewer than 2^N moves means the fewest possible. */
  function verdict(s) {
    return s.moves < 2 ** s.n ? "Congratulations! Hope you enjoyed it." : "Congratulations! Try using fewer moves.";
  }

  /** Solution(N, Src, Aux, Dst), as a list of [from, to]. */
  function solution(n, src = SRC, aux = AUX, dst = DST, out = []) {
    if (n === 0) return out;
    solution(n - 1, src, dst, aux, out);
    out.push([src, dst]);
    solution(n - 1, aux, src, dst, out);
    return out;
  }

  /** Help(): the next move towards the right peg from any position, or null when solved. */
  function suggest(s) {
    const pegOf = [];
    s.pegs.forEach((stack, p) => stack.forEach((d) => { pegOf[d - 1] = p; }));
    let target = DST;
    for (let d = s.n; d >= 1; d--) {
      const p = pegOf[d - 1];
      if (p === target) continue;
      if (top(s, p) === d) {
        const t = top(s, target);
        if (t === 0 || t > d) return [p, target];
      }
      target = 3 - target - p;
    }
    return null;
  }

  return {
    MIN_DISKS, MAX_DISKS, DEFAULT_DISKS, SRC, AUX, DST,
    start, top, legal, move, won, minimum, verdict, solution, suggest,
  };
})();
