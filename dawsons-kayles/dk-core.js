"use strict";

/*
 * Dawson's Kayles - the game from Alexander Bogomolny's applet
 * (classes/DawsonKayles.zip: DawsonKayles, DawsonKaylesCanvas, DawsonKaylesGame).
 *
 * Skittles stand on a circle. A move removes two *adjacent* skittles. The last
 * player able to move wins, so a skittle with no live neighbour is dead weight.
 * What is left after a few moves is a handful of separate arcs, and arcs do not
 * interact: the position is a sum of independent games.
 *
 * That makes it a Sprague-Grundy game. A row of n skittles has the Grundy value
 *
 *     G(n) = mex { G(a) XOR G(n - 2 - a) : 0 <= a <= n - 2 }
 *
 * because taking the pair at offset a splits the row into rows of a and
 * n - 2 - a. A whole position is lost for the player to move exactly when the
 * XOR of its arcs' G values is 0. The applet hard-codes 137 of these values;
 * they are recomputed here with the mex rule instead, and check-dawsons-kayles
 * compares the result against the applet's own table.
 *
 * play() is DawsonKaylesGame.Play transcribed: take the XOR, and if it is not 0
 * walk the arcs in order looking for a split that drives it to 0; otherwise (or
 * if no such split exists) move at random. One deliberate repair: the applet
 * drops runs of length 1 *before* joining a run that wraps past the end of the
 * array, so a position like "alive, dead..., alive" loses its wrap-around pair
 * and the opponent reads the board as finished. heaps() joins first, then drops.
 */
const DawsonKaylesCore = (() => {
  /** The applet's default board. */
  const DEFAULT_N = 18;
  const MIN_N = 4;
  const MAX_N = 40;

  /* ----------------------------------------------------------- Grundy values */

  const grundy = [0, 0];

  /** G(n) for a *row* of n skittles, by the mex rule, memoised. */
  function G(n) {
    for (let m = grundy.length; m <= n; m++) {
      const seen = new Set();
      for (let a = 0; a <= m - 2; a++) seen.add(grundy[a] ^ grundy[m - 2 - a]);
      let g = 0;
      while (seen.has(g)) g++;
      grundy[m] = g;
    }
    return grundy[n];
  }

  /* ------------------------------------------------------------- positions */

  /**
   * The live arcs of a circular board, as { start, len } with start a board
   * index and len >= 2. Runs that wrap past the end are joined, and lone
   * skittles - which have no move and Grundy value 0 - are then dropped.
   */
  function heaps(dots) {
    const n = dots.length;
    const runs = [];
    if (dots.every((d) => d)) {
      if (n >= 2) runs.push({ start: 0, len: n });
      return runs;
    }
    // Start the scan at a dead skittle, so no run can wrap past the scan's end.
    let from = dots.indexOf(0);
    if (from < 0) return runs;
    let i = 0;
    while (i < n) {
      const at = (from + i) % n;
      if (!dots[at]) { i++; continue; }
      let len = 0;
      while (len < n - i && dots[(from + i + len) % n]) len++;
      if (len >= 2) runs.push({ start: at, len });
      i += len;
    }
    return runs;
  }

  /** XOR of the arcs' Grundy values. 0 means the player to move is lost. */
  const nimSum = (dots) => heaps(dots).reduce((x, h) => x ^ G(h.len), 0);

  /** The applet's IsFinished: no two live skittles are neighbours. */
  function isFinished(dots) {
    const n = dots.length;
    for (let i = 0; i < n; i++) if (dots[i] && dots[(i + 1) % n]) return false;
    return true;
  }

  /** Indices i such that skittles i and i+1 (mod n) are both alive. */
  function legalMoves(dots) {
    const n = dots.length;
    const moves = [];
    for (let i = 0; i < n; i++) if (dots[i] && dots[(i + 1) % n]) moves.push(i);
    return moves;
  }

  /** Remove the pair at i; returns a new board. */
  function applyMove(dots, i) {
    const next = dots.slice();
    next[i] = 0;
    next[(i + 1) % dots.length] = 0;
    return next;
  }

  /* -------------------------------------------------------------- opponent */

  /** DawsonKaylesGame.MakeRandomMove. */
  function randomMove(hs, n, rand) {
    const h = hs[Math.floor(rand() * hs.length)];
    return (h.start + Math.floor(rand() * (h.len - 1))) % n;
  }

  /**
   * DawsonKaylesGame.Play: the index of the left skittle of the pair to take,
   * or -1 when there is no move. Perfect play whenever the position allows it.
   */
  function play(dots, rand) {
    const rnd = rand || Math.random;
    const n = dots.length;
    const hs = heaps(dots);
    if (!hs.length) return -1;
    const x = hs.reduce((acc, h) => acc ^ G(h.len), 0);
    if (x !== 0) {
      // MakeGoodMove: the first arc holding a split that zeroes the total.
      for (const h of hs) {
        const rest = x ^ G(h.len);
        for (let a = 0; a <= h.len - 2; a++) {
          if ((G(a) ^ G(h.len - a - 2)) === rest) return (h.start + a) % n;
        }
      }
    }
    return randomMove(hs, n, rnd);
  }

  /* ---------------------------------------------------------------- boards */

  /**
   * DawsonKaylesCanvas.Reset. "Full circle" leaves every skittle standing; the
   * applet otherwise knocks out a gap at 0 and one, two or three more at random
   * spacings, which is what turns the board into a sum of several arcs.
   */
  function newBoard(n, fullCircle, rand) {
    const rnd = rand || Math.random;
    const dots = new Array(n).fill(1);
    if (fullCircle) return dots;
    const span = n > 35 ? Math.floor(n / 4) : n > 25 ? Math.floor(n / 3) : Math.floor(n / 2);
    dots[0] = 0;
    let at = 1 + Math.floor(rnd() * span);
    dots[at] = 0;
    if (n > 25) {
      at = at + 1 + Math.floor(rnd() * span);
      dots[at] = 0;
      if (n > 35) {
        at = at + 1 + Math.floor(rnd() * span);
        dots[at] = 0;
      }
    }
    return dots;
  }

  return {
    DEFAULT_N,
    MIN_N,
    MAX_N,
    G,
    heaps,
    nimSum,
    isFinished,
    legalMoves,
    applyMove,
    play,
    newBoard,
  };
})();
