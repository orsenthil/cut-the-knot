"use strict";

/*
 * Flipping Pancakes -- pure logic, no DOM. Ported from Alexander Bogomolny's
 * Flipper applet (cut-the-knot.org/SimpleGames/Flipper.shtml; the applet calls
 * itself "Flipping Pancakes"). classes.zip has only the .class files, so the
 * rules came off `javap -c -p FlipperCanvas.class`.
 *
 * A stack of n pancakes, all different sizes. Position 0 is the bottom of the
 * stack and position n-1 the top; the pancake on position i is written as a
 * number, and the stack is sorted when m_Pancakes[i] === i for every i
 * (CheckFinished), with the biggest pancake at the bottom. Slide a flipper
 * under a pancake and everything from there upwards turns over.
 *
 * The applet has two knobs on that move, and both come straight out of Flip():
 *
 *   private void Flip(int i) { if (m_Gap) Transpose(i); else FullFlip(i); m_Num++; }
 *
 *   m_Dist   how far up the flip reaches. -1 is the applet's "top": all the
 *            way to the top of the stack. Otherwise the flip ends at
 *            min(i + m_Dist, n - 1), a fixed-width flip.
 *   m_Gap    the "Scarce" checkbox. Instead of turning the run over,
 *            Transpose() swaps only its two end pancakes and leaves everything
 *            between them alone.
 *
 * Both are kept here. `span` in this module is how many pancakes the flip
 * covers, which is m_Dist + 1, because that is what a player can see; SPAN_ALL
 * stands for m_Dist === -1.
 *
 * Shuffle() scrambles by repeating random flips, so every stack it deals can
 * be solved by undoing them, and it counts how many it used so the player's
 * total can be compared against it. Two of its quirks are reproduced below.
 */
const PancakeCore = (() => {
  const N_MIN = 3; // FlipperPanel m_Lower
  const N_MAX = 40; // FlipperPanel m_Upper, and the canvas m_Max
  const N_DEFAULT = 5; // the canvas m_N
  const SPAN_ALL = 0; // the applet's m_Dist === -1

  const sorted = (n) => Array.from({ length: n }, (_, i) => i);
  const isSorted = (stack) => stack.every((v, i) => v === i);

  /** m_Dist from a span: SPAN_ALL is -1, otherwise span - 1. */
  const distOf = (span) => (span === SPAN_ALL ? -1 : span - 1);

  /** The run a flip at i covers, as [i, end] inclusive. */
  function range(n, i, span) {
    const dist = distOf(span);
    const end = dist === -1 ? n - 1 : Math.min(i + dist, n - 1);
    return [i, end];
  }

  /**
   * Flip(i). Returns a new stack, or null when i is off the stack. A flip whose
   * run is a single pancake changes nothing -- it is the M_n the cut-the-knot
   * page points out is missing from the move set -- and `isNoop` spots it.
   */
  function flip(stack, i, span, scarce) {
    const n = stack.length;
    if (!Number.isInteger(i) || i < 0 || i >= n) return null;
    const [lo, hi] = range(n, i, span);
    const next = stack.slice();
    if (scarce) {
      // Transpose(): only the two ends change places.
      const t = next[lo];
      next[lo] = next[hi];
      next[hi] = t;
    } else {
      // FullFlip(): the whole run turns over.
      for (let a = lo, b = hi; a < b; a++, b--) {
        const t = next[a];
        next[a] = next[b];
        next[b] = t;
      }
    }
    return next;
  }

  const isNoop = (n, i, span) => {
    const [lo, hi] = range(n, i, span);
    return lo === hi;
  };

  /** Every flip that would change something. */
  function legalFlips(n, span) {
    const out = [];
    for (let i = 0; i < n; i++) if (!isNoop(n, i, span)) out.push(i);
    return out;
  }

  /**
   * Shuffle(). Two applet quirks are kept on purpose:
   *  - the number of scrambling flips is `(int)(n * random()) + m_Num`, and
   *    Reset() only zeroes m_Num *after* shuffling, so the scramble grows with
   *    however many moves the previous game took. `carried` is that m_Num.
   *  - it never picks the top pancake (`(int)((n - 1) * random())`), whose flip
   *    would do nothing, and it deals again if the stack came out sorted.
   */
  function scramble(n, span, scarce, carried = 0, rand = Math.random) {
    let stack = sorted(n);
    let used = carried;
    let announced = 0;
    do {
      const count = Math.floor(n * rand()) + used;
      for (let k = 0; k < count; k++) {
        stack = flip(stack, Math.floor((n - 1) * rand()), span, scarce);
        used++;
      }
      announced = count;
    } while (isSorted(stack));
    return { stack, scrambleFlips: announced };
  }

  /**
   * The cut-the-knot page's own strategy, for flips that reach the top:
   * bring the next pancake to the top, then flip it down into place. It needs
   * at most 2n - 3 flips, which is the page's upper bound.
   */
  function pageStrategy(stack) {
    const n = stack.length;
    let s = stack.slice();
    const flips = [];
    const take = (i) => { flips.push(i); s = flip(s, i, SPAN_ALL, false); };
    for (let t = 0; t <= n - 3; t++) {
      const j = s.indexOf(t);
      if (j === t) continue;
      if (j !== n - 1) take(j); // send it to the top
      take(t); // and flip it down onto its place
    }
    if (!isSorted(s)) take(n - 2); // the last two are either right or swapped
    return flips;
  }

  /** The pancake numbers: the worst case over all stacks of n. OEIS A058986. */
  const PANCAKE_NUMBERS = [0, 0, 1, 3, 4, 5, 7, 8, 9];

  return {
    N_MIN, N_MAX, N_DEFAULT, SPAN_ALL, PANCAKE_NUMBERS,
    sorted, isSorted, distOf, range, flip, isNoop, legalFlips, scramble, pageStrategy,
  };
})();
