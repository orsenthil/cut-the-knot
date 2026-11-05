"use strict";

/*
 * Toads and Frogs (Bogomolny's FrogsAndToads applet) - the rules.
 *
 * A row of N + M + 1 squares: N frogs on the left, M toads on the right,
 * one empty square between them. Frogs only move right, toads only move
 * left. A move is a Slide into the empty square next door, or a Jump over
 * one square into it - and a jump is allowed only over an animal of the
 * OTHER kind. The goal is the toads in the M leftmost squares and the
 * frogs in the N rightmost ones.
 *
 * This is the applet's FrogsAndToadsGame read off the bytecode: InitValues()
 * for the opening row, CanMove()/MakeMove() for the move rule (slide first,
 * then jump), Finished() for the goal, OutOfMoves() for "You are stuck!",
 * and MoveBack() for the Back button. The applet keeps two move strings as
 * it goes, and so does this: one in S (slide) and J (jump), and one for the
 * hole, which goes r or R (one or two squares right) when a toad moves into
 * it and l or L when a frog does.
 *
 * Key fact the page relies on (checked exhaustively in
 * porting/check-frogs-toads.mjs): every solution takes exactly MN + M + N
 * moves, MN of them jumps, and there are exactly two solutions.
 */

var FrogsToadsCore = (function () {
  const EMPTY = 0;
  const FROG = 1;
  const TOAD = 2;

  const COUNTS = [1, 2, 3, 4, 5]; // the applet's CTKNumberLim limits; it opens on 3 and 3

  /** N frogs, one hole, M toads. */
  function start(frogs, toads) {
    const cells = [];
    for (let i = 0; i < frogs; i++) cells.push(FROG);
    cells.push(EMPTY);
    for (let i = 0; i < toads; i++) cells.push(TOAD);
    return { frogs, toads, cells, history: [], moves: "", holeMoves: "" };
  }

  /**
   * Where the animal on square i would go, and whether it is a jump, or null
   * if it cannot move. The order of the tests is CanMove()'s.
   */
  function target(s, i) {
    const c = s.cells;
    if (c[i] === TOAD) {
      if (i > 0 && c[i - 1] === EMPTY) return { to: i - 1, jump: false };
      if (i > 1 && c[i - 1] === FROG && c[i - 2] === EMPTY) return { to: i - 2, jump: true };
    } else if (c[i] === FROG) {
      if (i < c.length - 1 && c[i + 1] === EMPTY) return { to: i + 1, jump: false };
      if (i < c.length - 2 && c[i + 1] === TOAD && c[i + 2] === EMPTY) return { to: i + 2, jump: true };
    }
    return null;
  }

  /** MakeMove(): move the animal on square i. Returns false if it cannot move. */
  function move(s, i) {
    const t = target(s, i);
    if (!t) return false;
    const who = s.cells[i];
    s.cells[t.to] = who;
    s.cells[i] = EMPTY;
    s.history.push([i, t.to]);
    s.moves += t.jump ? "J" : "S";
    // The hole goes the other way from the animal, the same distance.
    const hole = who === TOAD ? "r" : "l";
    s.holeMoves += t.jump ? hole.toUpperCase() : hole;
    return true;
  }

  /** MoveBack(): undo the last move. Returns false if there is nothing to undo. */
  function undo(s) {
    const last = s.history.pop();
    if (!last) return false;
    const [from, to] = last;
    s.cells[from] = s.cells[to];
    s.cells[to] = EMPTY;
    s.moves = s.moves.slice(0, -1);
    s.holeMoves = s.holeMoves.slice(0, -1);
    return true;
  }

  /** Finished(): toads in the M leftmost squares, frogs in the N rightmost. */
  function won(s) {
    const c = s.cells;
    for (let i = 0; i < s.toads; i++) if (c[i] !== TOAD) return false;
    for (let i = c.length - s.frogs; i < c.length; i++) if (c[i] !== FROG) return false;
    return true;
  }

  /** OutOfMoves(): no animal can move. */
  function stuck(s) {
    for (let i = 0; i < s.cells.length; i++) if (s.cells[i] !== EMPTY && target(s, i)) return false;
    return true;
  }

  /** The page's formula for the fewest (and only) number of moves. */
  function minimum(frogs, toads) {
    return frogs * toads + frogs + toads;
  }

  return { EMPTY, FROG, TOAD, COUNTS, start, target, move, undo, won, stuck, minimum };
})();
