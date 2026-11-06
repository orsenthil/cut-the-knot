"use strict";

/*
 * Kayles - the game from Alexander Bogomolny's Kayles applet
 * (classes/Kayles.zip: KaylesCanvas, KaylesGame).
 *
 * Skittles stand on a circle. A move knocks down one skittle, or two that
 * stand side by side; the last player to move wins. After a few moves the
 * board is a handful of separate arcs, which do not interact, so the position
 * is a sum of independent games and the Sprague-Grundy theory applies. A row
 * of n skittles has the Grundy value
 *
 *     G(n) = mex { G(a) XOR G(n-1-a), G(a) XOR G(n-2-a) }
 *
 * (knock one down, or a pair, leaving rows of a and the rest), and a position
 * is lost for the player to move exactly when the XOR of its arcs' values is 0.
 * The applet hard-codes 84 of these values; they are recomputed here with the
 * mex rule, and porting/check-kayles.mjs compares them with the applet's table.
 *
 * play() is KaylesGame.Play read off the bytecode: build the arcs (KaylesGame's
 * constructor: runs of standing skittles, a run that wraps past the end joined
 * to the first one), take the XOR, and if it is not 0 walk the arcs in order
 * looking for a single and then a pair that drives it to 0; otherwise move at
 * random (MakeRandomMove). Moves are { at, pair }: knock down skittle `at`, and
 * also at + 1 if `pair`.
 *
 * Like the applet, an unbroken full circle is valued as a row of n. That is
 * not its true value, but it does not matter: every first move on a full
 * circle loses (the page's mirror strategy), so whatever the computer picks
 * there, it is already lost.
 */

var KaylesCore = (function () {
  const DEFAULT_N = 18;
  const MIN_N = 10; // the "#Skittles" CTKNumberCanvas range
  const MAX_N = 60;

  const grundy = [0];
  function G(n) {
    for (let m = grundy.length; m <= n; m++) {
      const seen = new Set();
      for (let a = 0; a <= m - 1; a++) seen.add(grundy[a] ^ grundy[m - 1 - a]);
      for (let a = 0; a <= m - 2; a++) seen.add(grundy[a] ^ grundy[m - 2 - a]);
      let g = 0;
      while (seen.has(g)) g++;
      grundy[m] = g;
    }
    return grundy[n];
  }

  /** KaylesGame's constructor: the arcs, as { start, len }. */
  function heaps(dots) {
    const n = dots.length;
    const hs = [];
    let i = 0;
    while (i < n) {
      while (i < n && !dots[i]) i++;
      if (i === n) break;
      let j = i;
      while (j < n && dots[j]) j++;
      hs.push({ start: i, len: j - i });
      i = j;
    }
    if (hs.length > 1) {
      const first = hs[0];
      const last = hs[hs.length - 1];
      if (last.start + last.len === n && first.start === 0) {
        last.len += first.len;
        hs.shift();
      }
    }
    return hs;
  }

  const isFinished = (dots) => dots.every((d) => !d);

  function legal(dots, m) {
    const n = dots.length;
    if (!dots[m.at]) return false;
    return !m.pair || dots[(m.at + 1) % n];
  }

  function applyMove(dots, m) {
    const next = dots.slice();
    next[m.at] = 0;
    if (m.pair) next[(m.at + 1) % dots.length] = 0;
    return next;
  }

  /** MakeRandomMove(): a random arc, a single or a pair at random, at a random place in it. */
  function randomMove(hs, n, rnd) {
    const h = hs[Math.trunc(rnd() * hs.length)];
    if (h.len === 1) return { at: h.start, pair: false };
    const pair = Math.trunc(rnd() * 2) === 1;
    const off = Math.trunc(rnd() * (h.len - (pair ? 1 : 0)));
    return { at: (h.start + off) % n, pair };
  }

  /** Play(): the computer's move, or null if nothing stands. */
  function play(dots, rnd = Math.random) {
    const n = dots.length;
    const hs = heaps(dots);
    if (!hs.length) return null;
    const x = hs.reduce((acc, h) => acc ^ G(h.len), 0);
    if (x !== 0) {
      for (const h of hs) {
        const target = x ^ G(h.len);
        for (let k = 0; k < h.len; k++) if ((G(k) ^ G(h.len - k - 1)) === target) return { at: (h.start + k) % n, pair: false };
        for (let k = 0; k < h.len - 1; k++) if ((G(k) ^ G(h.len - k - 2)) === target) return { at: (h.start + k) % n, pair: true };
      }
    }
    return randomMove(hs, n, rnd);
  }

  /**
   * Reset(): every skittle up; unless "Full circle", knock out skittle 0 and one,
   * two or three more at random spacings (more for bigger boards).
   */
  function newBoard(n, fullCircle, rnd = Math.random) {
    const dots = new Array(n).fill(1);
    if (fullCircle) return dots;
    const span = n > 35 ? Math.trunc(n / 4) : n > 25 ? Math.trunc(n / 3) : Math.trunc(n / 2);
    dots[0] = 0;
    let at = 1 + Math.trunc(rnd() * span);
    dots[at] = 0;
    if (n > 25) {
      at = at + 1 + Math.trunc(rnd() * span);
      dots[at] = 0;
      if (n > 35) {
        at = at + 1 + Math.trunc(rnd() * span);
        dots[at] = 0;
      }
    }
    return dots;
  }

  return { DEFAULT_N, MIN_N, MAX_N, G, heaps, isFinished, legal, applyMove, play, newBoard };
})();
