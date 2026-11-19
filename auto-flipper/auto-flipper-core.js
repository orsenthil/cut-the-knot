"use strict";

/*
 * Auto Flipper, from Alexander Bogomolny's applet AutoFlipper.
 *
 * A stack of N pancakes is numbered by size: 1 is the smallest, N the largest.
 * The stack is written top to bottom, e.g. [3, 1, 2]. One "flip" takes the
 * number M written on the TOP pancake and reverses the top M pancakes. Pancake
 * M therefore travels from the top to the M-th place from the top. When 1 is on
 * top a flip turns over a single pancake and changes nothing, so the process
 * stops there. The key idea is that each stack (a permutation of 1..N) has
 * exactly one successor, and this map has no cycles except those stopped
 * states; since there are only N! stacks, every run must end.
 *
 * This file is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global, AutoFlipperCore, so the page loads it with a
 * plain <script> and porting/check-auto-flipper.mjs loads it in Node.
 *
 * The position is plain data (numbers, arrays, plain objects), so it can be
 * saved and handed to the tutor as it is. Functions take a position and return
 * a new one; they do not change what they are given. Randomness is passed in
 * as an rng function so a run can be reproduced in the logic test.
 */
const AutoFlipperCore = (() => {
  // The applet's spinner is SpinnerNumberModel(5, 3, 16, 1).
  const MIN_N = 3;
  const MAX_N = 16;
  const DEFAULT_N = 5;

  function clampN(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_N;
    return Math.min(MAX_N, Math.max(MIN_N, Math.round(num)));
  }

  /** Reverse the top k entries of `stack`, leaving `stack` untouched. */
  function flip(stack, k) {
    const out = stack.slice();
    const count = Math.min(Math.max(0, Math.trunc(k)), out.length);
    for (let i = 0; i < Math.floor(count / 2); i++) {
      const tmp = out[i];
      out[i] = out[count - 1 - i];
      out[count - 1 - i] = tmp;
    }
    return out;
  }

  /** CheckFinished() in the applet: finished exactly when 1 is on top. */
  function isFinished(stack) {
    return stack.length > 0 && stack[0] === 1;
  }

  /** Build a full position from a bare stack. */
  function makePosition(stack, extra) {
    const s = stack.slice();
    return {
      n: s.length,
      stack: s,
      finished: isFinished(s),
      flips: 0,
      lastK: 0,
      lastKind: "auto",
      ...(extra || {}),
    };
  }

  /*
   * Shuffle() in the applet: while finished, do (int)(random*N)+5 flips, each
   * reversing (int)(random*N)+1 pancakes, then check again. The net effect is
   * a shuffled stack whose top is not 1. `rng` returns a number in [0,1).
   */
  function shuffle(n, rng) {
    const size = clampN(n);
    const random = typeof rng === "function" ? rng : Math.random;
    const randIntN = () => Math.min(size - 1, Math.floor(random() * size));
    let stack = Array.from({ length: size }, (_, i) => i + 1);
    let finished = true;
    // Math.random eventually escapes; the guard only stops a degenerate rng.
    let guard = 0;
    while (finished && guard++ < 100000) {
      const rounds = randIntN() + 5; // (int)(random*N) + 5
      for (let j = 0; j < rounds; j++) {
        stack = flip(stack, randIntN() + 1); // (int)(random*N) + 1
      }
      finished = isFinished(stack);
    }
    return stack;
  }

  /** The position a new game starts from. */
  function start(options) {
    const opts = options || {};
    let stack;
    if (opts.stack) {
      stack = opts.stack.slice();
    } else {
      stack = shuffle(opts.n == null ? DEFAULT_N : opts.n, opts.rng);
    }
    return makePosition(stack, { n: stack.length });
  }

  /** The only automatic move: read the top pancake and flip that many. */
  function autoFlip(state) {
    const k = state.stack[0];
    const stack = flip(state.stack, k);
    return {
      ...state,
      stack,
      finished: isFinished(stack),
      flips: state.flips + 1,
      lastK: k,
      lastKind: "auto",
    };
  }

  /*
   * The original also lets a mouse press flip a stack. mouseReleased() passes
   * the 0-based index returned by IsPancake() straight to Flip(int), so
   * clicking the pancake at index i reverses the top i pancakes (clicking the
   * top one flips none). This is a harmless quirk of the applet; keep it.
   */
  function manualFlip(state, index) {
    const k = Math.trunc(index);
    const stack = flip(state.stack, k);
    return {
      ...state,
      stack,
      finished: isFinished(stack),
      flips: state.flips + 1,
      lastK: k,
      lastKind: "manual",
    };
  }

  /** The moves allowed from this position. The demo only has the auto flip. */
  function legalMoves(state) {
    return state.finished ? [] : ["auto"];
  }

  /** "done" once 1 is on top; null while the stack is still turning. */
  function result(state) {
    return state.finished ? "done" : null;
  }

  /**
   * Apply a move: "auto" for the button, or a number for a manual flip at that
   * 0-based index. Returns null when the move is not allowed.
   */
  function move(state, action) {
    if (state.finished) return null;
    if (action === "auto") return autoFlip(state);
    if (typeof action === "number") return manualFlip(state, action);
    return null;
  }

  /** A sentence saying, in words, what the last flip did. */
  function describe(state) {
    const k = state.lastK;
    const landed = state.stack.indexOf(k); // -1 if k is not present
    let text = state.lastKind === "manual"
      ? `The top ${k} pancakes turned over`
      : `The top pancake was ${k}, so the top ${k} pancakes turned over`;
    if (landed >= 0) text += `; pancake ${k} is now ${landed + 1}${landed === 0 ? "st" : landed === 1 ? "nd" : landed === 2 ? "rd" : "th"} from the top`;
    return text + ".";
  }

  return {
    MIN_N, MAX_N, DEFAULT_N,
    clampN, flip, isFinished, makePosition, shuffle, start,
    autoFlip, manualFlip, legalMoves, result, move, describe,
  };
})();
