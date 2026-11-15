"use strict";

/*
 * TODO(port): {{TITLE}}, from Alexander Bogomolny's applet {{APPLET}}.
 *
 * Say what the puzzle is, in two or three sentences, and then the one idea
 * the code relies on (the invariant, the strategy, the formula).
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, {{CORE_GLOBAL}}, so the page loads it with a
 * plain <script> and porting/check-{{SLUG}}.mjs loads it in Node.
 *
 * The position is plain data (numbers, strings, arrays, plain objects), so
 * it can be saved and handed to the tutor as it is. Functions take a
 * position and return a new one; they do not change what they are given.
 */
const {{CORE_GLOBAL}} = (() => {
  // TODO(port): the applet's own constants: sizes, ranges, starting values.

  /** The position a new game starts from. */
  function start(options) {
    // TODO(port)
    return { moves: 0 };
  }

  /** The moves allowed from this position. */
  function legalMoves(state) {
    // TODO(port)
    return [];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    // TODO(port)
    return null;
  }

  /** "win", "lose", "done", or null while the game goes on. */
  function result(state) {
    // TODO(port)
    return null;
  }

  // TODO(port): the applet's computer player, if it has one, transcribed
  // faithfully: same choices in the same positions.

  return { start, legalMoves, move, result };
})();
