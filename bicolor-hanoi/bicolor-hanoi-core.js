"use strict";

/*
 * Bicolor Towers of Hanoi (Bogomolny's BiColorHanoi applet).
 *
 * Three pegs. Two towers, one on each of the first two pegs, both holding one
 * disk of every size from n down to 1, and both striped: the left tower is
 * gold at the bottom, the right one red, and the colours alternate upwards.
 * So there are two disks of every size, one of each colour.
 *
 * Moves are the ordinary Tower of Hanoi moves with one relaxation that the
 * applet's own CanSettle() allows: a disk may never land on a SMALLER disk,
 * but it may land on one of its own size (the applet rejects a drop only when
 * `top.Id() < moving.Id()`). That one relaxation is what makes doubled disks
 * cheap to shift, and the whole puzzle turns on it.
 *
 * Goal, from the cut-the-knot page: "make the towers monochrome", with "the
 * biggest disks at the bottom of the towers ... assumed to swap positions".
 * So the two towers must each end up one colour AND trade pegs: all the reds
 * where the gold tower stood, all the golds where the red tower stood.
 *
 * MINIMUM holds the fewest possible moves for 0..7 sizes. Every entry comes
 * from an exhaustive breadth-first search over all positions, re-derived for
 * the small cases by porting/check-bicolor-hanoi.mjs. Note 29 for three sizes:
 * the solution page on cut-the-knot offers 30 moves and asks "Is that right?".
 * It is not; 29 is enough.
 */

var BicolorHanoi = (function () {
  const GOLD = 0;
  const RED = 1;

  /** A disk is one integer: size in the high bits, colour in bit 0. */
  const disk = (size, colour) => (size << 1) | colour;
  const sizeOf = (d) => d >> 1;
  const colourOf = (d) => d & 1;

  const MIN_SIZES = 1;
  const MAX_SIZES = 8; // the applet's m_Max

  /**
   * Fewest moves for 0..7 sizes, by exhaustive search. 6 and 7 need the search
   * run from both ends to fit in memory. Eight sizes is past what the search
   * reaches, so minimum(8) is null and the page simply does not quote a target
   * there -- the applet offered the size, and nobody knows the answer for it.
   */
  const MINIMUM = [0, 3, 10, 29, 67, 147, 310, 640];

  /** The opening position: two striped towers, third peg empty. */
  function start(n) {
    const pegs = [[], [], []];
    for (let i = 0; i < n; i++) {
      const size = n - i; // biggest first, so it ends up at the bottom
      pegs[0].push(disk(size, i % 2 === 0 ? GOLD : RED));
      pegs[1].push(disk(size, i % 2 === 0 ? RED : GOLD));
    }
    return { n: n, pegs: pegs, moves: 0, history: [] };
  }

  const topOf = (state, peg) => {
    const stack = state.pegs[peg];
    return stack.length ? stack[stack.length - 1] : -1;
  };

  /** The applet's rule: nothing on a smaller disk, equal sizes allowed. */
  function legal(state, from, to) {
    if (!(from >= 0 && from < 3 && to >= 0 && to < 3) || from === to) return false;
    const moving = topOf(state, from);
    if (moving < 0) return false;
    const landing = topOf(state, to);
    return landing < 0 || sizeOf(landing) >= sizeOf(moving);
  }

  function move(state, from, to) {
    if (!legal(state, from, to)) return false;
    state.pegs[to].push(state.pegs[from].pop());
    state.history.push([from, to]);
    state.moves++;
    return true;
  }

  function undo(state) {
    const last = state.history.pop();
    if (!last) return false;
    state.pegs[last[0]].push(state.pegs[last[1]].pop());
    state.moves--;
    return true;
  }

  /**
   * Won when both towers are monochrome and have swapped pegs. A legal stack
   * is always sorted by size, so one colour on a peg of n disks is already the
   * finished tower.
   */
  function won(state) {
    const pegs = state.pegs;
    if (pegs[2].length || pegs[0].length !== state.n || pegs[1].length !== state.n) return false;
    return (
      pegs[0].every((d) => colourOf(d) === RED) && pegs[1].every((d) => colourOf(d) === GOLD)
    );
  }

  /** Fewest possible moves for n sizes, or null when it is not known here. */
  const minimum = (n) => (n >= 0 && n < MINIMUM.length ? MINIMUM[n] : null);

  const clone = (state) => ({
    n: state.n,
    pegs: state.pegs.map((s) => s.slice()),
    moves: state.moves,
    history: state.history.map((m) => m.slice()),
  });

  return {
    GOLD: GOLD,
    RED: RED,
    MIN_SIZES: MIN_SIZES,
    MAX_SIZES: MAX_SIZES,
    MINIMUM: MINIMUM,
    disk: disk,
    sizeOf: sizeOf,
    colourOf: colourOf,
    start: start,
    topOf: topOf,
    legal: legal,
    move: move,
    undo: undo,
    won: won,
    minimum: minimum,
    clone: clone,
  };
})();
