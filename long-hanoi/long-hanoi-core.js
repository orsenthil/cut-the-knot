"use strict";

/*
 * Tower of Hanoi, the Hard Way (Bogomolny's LongHanoi applet) - the rules,
 * the long solution, and the position numbering it is built on.
 *
 * The usual puzzle asks for the fewest moves. Kai Birger Nielsen's variation
 * asks for the most: move the N disks from the left peg to the right peg
 * without ever bringing back a position you have already had. Disks are
 * numbered by size, 1 the smallest, as the applet's ring Id().
 *
 *   solution(n) is longhanoicanvas.Solution(N, Src, Aux, Dst), the recursion
 *   on the cut-the-knot page. The big disk visits all three pegs:
 *
 *       Solve(N-1, Src, Aux, Dst), Src->Aux,
 *       Solve(N-1, Dst, Aux, Src), Aux->Dst,
 *       Solve(N-1, Src, Aux, Dst)
 *
 *   That is 3^N - 1 moves, and it passes through every one of the 3^N
 *   positions exactly once, so it is the longest route there can be.
 *
 *   Because it is a route through all the positions, every position has a
 *   place on it. rank() computes that place straight from the position, by
 *   reading the disks from the biggest down: the big disk is on Src during
 *   the first third of the route, on Aux during the second and on Dst
 *   during the last, and the Src/Dst roles swap for the middle third.
 *   unrank() runs it backwards, so suggest() is just "the next place on the
 *   route".
 *
 * Two parts of the applet are leftovers from the plain Hanoi applet it was
 * copied from, and both contradict the puzzle its page states, so the page
 * wins (CLAUDE.md section 1):
 *
 *   - Approve() praises you for using FEWER than 2^N moves, which is the
 *     opposite of this puzzle. verdict() measures you against 3^N - 1.
 *   - Help() suggests the next move of the SHORTEST solution. suggest()
 *     gives the next move of the longest one instead.
 *
 * The applet also never checked for repeated positions; it only animated the
 * long solution. Enforcing the page's "without returning to a previous
 * configuration" is what makes this a puzzle you can play, so move() refuses
 * a move that repeats, and stuck() reports a dead end.
 *
 * porting/check-long-hanoi.mjs checks all of this over every position for up
 * to 8 disks.
 */

var LongHanoiCore = (function () {
  const MIN_DISKS = 1;
  const MAX_DISKS = 10; // LongHanoiPanel's spinner: 1 to 10, starting at 4
  const DEFAULT_DISKS = 4;
  const SRC = 0;
  const AUX = 1;
  const DST = 2;

  /** Pegs are arrays of disk sizes, bottom first. */
  function start(n) {
    const pegs = [[], [], []];
    for (let d = n; d >= 1; d--) pegs[SRC].push(d);
    const s = { n, pegs, moves: 0, touched: false, seen: new Set() };
    s.seen.add(key(s));
    return s;
  }

  const top = (s, p) => (s.pegs[p].length ? s.pegs[p][s.pegs[p].length - 1] : 0);

  /** A position as the peg of disk 1, then disk 2, and so on: an N-digit base-3 number. */
  function key(s) {
    const pegOf = new Array(s.n);
    for (let p = 0; p < 3; p++) for (const d of s.pegs[p]) pegOf[d - 1] = p;
    return pegOf.join("");
  }

  /** CanSettle(): any disk may go on an empty peg or on a bigger disk. */
  function legal(s, from, to) {
    if (from === to || !s.pegs[from].length) return false;
    const t = top(s, to);
    return t === 0 || t > top(s, from);
  }

  /** The variation's extra rule: a legal move that would bring back an earlier position. */
  function repeats(s, from, to) {
    if (!legal(s, from, to)) return false;
    const after = key(s).split("");
    after[top(s, from) - 1] = String(to);
    return s.seen.has(after.join(""));
  }

  function move(s, from, to) {
    if (!legal(s, from, to) || repeats(s, from, to)) return false;
    s.pegs[to].push(s.pegs[from].pop());
    s.seen.add(key(s));
    s.moves++;
    s.touched = true;
    return true;
  }

  /** CanSettle()'s finish test: the left and middle pegs empty, every disk on the right. */
  function won(s) {
    return s.pegs[SRC].length === 0 && s.pegs[AUX].length === 0 && s.pegs[DST].length === s.n;
  }

  /** A dead end: not home, and every legal move would repeat a position. */
  function stuck(s) {
    if (won(s)) return false;
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        if (legal(s, a, b) && !repeats(s, a, b)) return false;
      }
    }
    return true;
  }

  /** 3^n positions, so at most 3^n - 1 moves without repeating one. */
  const longest = (n) => 3 ** n - 1;

  function verdict(s) {
    const max = longest(s.n);
    if (s.moves === max) return "Congratulations! All " + max + " moves \u2014 the longest route there is.";
    return "Congratulations! " + s.moves + " moves. The longest route takes " + max + ".";
  }

  /** Solution(N, Src, Aux, Dst), as a list of [from, to]. */
  function solution(n, src = SRC, aux = AUX, dst = DST, out = []) {
    if (n === 0) return out;
    solution(n - 1, src, aux, dst, out);
    out.push([src, aux]);
    solution(n - 1, dst, aux, src, out);
    out.push([aux, dst]);
    solution(n - 1, src, aux, dst, out);
    return out;
  }

  /** How many moves of the long route have been made by the time it reaches this position. */
  function rank(s) {
    const pegOf = key(s).split("").map(Number);
    let src = SRC;
    let dst = DST;
    let r = 0;
    for (let d = s.n; d >= 1; d--) {
      const block = 3 ** (d - 1);
      if (pegOf[d - 1] === AUX) {
        r += block; // the middle third of the route, which runs Dst -> Src
        const swap = src; src = dst; dst = swap;
      } else if (pegOf[d - 1] === dst) {
        r += 2 * block;
      }
    }
    return r;
  }

  /** The position the long route is in after r moves, as the peg of each disk. */
  function unrank(n, r) {
    const pegOf = new Array(n);
    let src = SRC;
    let dst = DST;
    for (let d = n; d >= 1; d--) {
      const block = 3 ** (d - 1);
      const third = Math.floor(r / block);
      r -= third * block;
      if (third === 0) {
        pegOf[d - 1] = src;
      } else if (third === 1) {
        pegOf[d - 1] = AUX;
        const swap = src; src = dst; dst = swap;
      } else {
        pegOf[d - 1] = dst;
      }
    }
    return pegOf;
  }

  /**
   * The next move of the long route from wherever you are, or null when you
   * are home or that step would go back to a position you have used.
   */
  function suggest(s) {
    const r = rank(s);
    if (r >= longest(s.n)) return null;
    const next = unrank(s.n, r + 1);
    if (s.seen.has(next.join(""))) return null;
    const now = key(s).split("").map(Number);
    for (let d = 1; d <= s.n; d++) {
      if (now[d - 1] !== next[d - 1]) return [now[d - 1], next[d - 1]];
    }
    return null;
  }

  return {
    MIN_DISKS, MAX_DISKS, DEFAULT_DISKS, SRC, AUX, DST,
    start, top, key, legal, repeats, move, won, stuck, longest, verdict,
    solution, rank, unrank, suggest,
  };
})();
