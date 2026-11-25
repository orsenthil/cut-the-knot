"use strict";

/*
 * Northcott's Game, from Alexander Bogomolny's applet Northcott.
 *
 * Every row of a board has two checkers, one white and one black. A move
 * slides one of your own checkers along its row, to any empty square, without
 * jumping over the other checker. You play white and move first; the computer
 * plays black; whoever cannot move loses (the last move wins).
 *
 * It looks as if the two players have different pieces, but it is Nim in
 * disguise: the number of empty squares between the two checkers of a row is a
 * heap of beans. Moving your checker toward the other removes beans; moving it
 * away adds some, but the opponent can take exactly those away again, so the
 * extra beans change nothing. The player to move loses exactly when the
 * nim-sum (XOR) of the gaps is 0.
 *
 * The computer's play is the applet's MakeMove, transcribed: if the nim-sum
 * of the gaps is not 0 it makes the Nim move (the heap with the biggest
 * heap-AND-nim-sum is reduced to heap XOR nim-sum, by moving black toward
 * white); if it is 0 it takes a random number of beans from the first
 * non-empty heap; if every gap is 0 it retreats: the first black checker that
 * is not at the left wall and is left of its white checker jumps to a random
 * square further left, else the first one not at the right wall and right of
 * its white checker to a random square further right.
 *
 * Position (plain data): { nx, ny, white, black, turn } with the columns of
 * each row's two checkers (0-based) and turn "white" or "black". One global,
 * NorthcottCore, no DOM.
 */
const NorthcottCore = (() => {
  const MIN_NX = 11, MAX_NX = 20, DEFAULT_NX = 11;     // the applet's Width spinner
  const MIN_NY = 2, MAX_NY = 20, DEFAULT_NY = 6;       // and its Height spinner

  const clamp = (v, lo, hi, d) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };

  /**
   * A new board. In each row the white checker is in a random column and the
   * black one in a different random column, as in the applet's Reset. The
   * player (white) moves first.
   */
  function start(options) {
    const o = options || {};
    const random = o.random || Math.random;
    const nx = clamp(o.nx === undefined ? DEFAULT_NX : o.nx, MIN_NX, MAX_NX, DEFAULT_NX);
    const ny = clamp(o.ny === undefined ? DEFAULT_NY : o.ny, MIN_NY, MAX_NY, DEFAULT_NY);
    const white = [], black = [];
    for (let r = 0; r < ny; r++) {
      const w = Math.floor(random() * nx);
      let b = Math.floor(random() * nx);
      while (b === w) b = Math.floor(random() * nx);
      white.push(w);
      black.push(b);
    }
    return { nx, ny, white, black, turn: "white" };
  }

  /** The number of empty squares between the two checkers of each row: the heaps. */
  const gaps = (s) => s.white.map((w, r) => Math.abs(w - s.black[r]) - 1);

  /** The XOR of the heaps. */
  const nimSum = (s) => gaps(s).reduce((x, g) => x ^ g, 0);

  /** The squares a checker can slide to: the empty squares on its own side of the other checker. */
  function targets(s, side, row) {
    const mine = side === "white" ? s.white[row] : s.black[row];
    const other = side === "white" ? s.black[row] : s.white[row];
    const out = [];
    if (mine < other) for (let c = 0; c < other; c++) { if (c !== mine) out.push(c); }
    else for (let c = other + 1; c < s.nx; c++) { if (c !== mine) out.push(c); }
    return out;
  }

  /** Every move of a side: { row, to }. */
  function legalMoves(s, side) {
    const out = [];
    for (let r = 0; r < s.ny; r++) for (const to of targets(s, side, r)) out.push({ row: r, to });
    return out;
  }

  /** Whether the side has a move: not every one of its checkers is boxed in. */
  function hasMoves(s, side) {
    for (let r = 0; r < s.ny; r++) if (targets(s, side, r).length > 0) return true;
    return false;
  }

  /** The position after side moves its checker in `row` to column `to`, or null if that is not allowed. */
  function move(s, side, row, to) {
    if (s.turn !== side || (side !== "white" && side !== "black")) return null;
    if (!Number.isInteger(row) || row < 0 || row >= s.ny) return null;
    if (!targets(s, side, row).includes(to)) return null;
    const white = s.white.slice(), black = s.black.slice();
    (side === "white" ? white : black)[row] = to;
    return { nx: s.nx, ny: s.ny, white, black, turn: side === "white" ? "black" : "white" };
  }

  /**
   * "win" (the player, white, has won), "lose" (the computer has), or null
   * while the game goes on. The side to move with no move loses.
   */
  function result(s) {
    if (hasMoves(s, s.turn)) return null;
    return s.turn === "black" ? "win" : "lose";
  }

  /**
   * The computer's move, as the applet chooses it: { row, to }. `random` is
   * called as the applet calls Math.random.
   */
  function computerMove(s, random) {
    const rnd = random || Math.random;
    const heaps = gaps(s);
    const x = heaps.reduce((t, g) => t ^ g, 0);
    // black moves toward white by delta squares (delta < 0 moves away)
    const toward = (row, delta) => ({ row, to: s.white[row] > s.black[row] ? s.black[row] + delta : s.black[row] - delta });
    if (x !== 0) {
      // MakeRightMove: the heap with the largest (heap AND nim-sum)
      let best = 0, row = 0;
      for (let r = 0; r < s.ny; r++) if (best < (heaps[r] & x)) { best = heaps[r] & x; row = r; }
      return toward(row, heaps[row] - (heaps[row] ^ x));
    }
    // MakeRandomMove: the first non-empty heap, a random number of beans from it
    for (let r = 0; r < s.ny; r++) {
      const g = heaps[r];
      if (g !== 0) return toward(r, Math.trunc(g * rnd() + 1));
    }
    // every gap is zero: retreat to the left, or else to the right
    for (let r = 0; r < s.ny; r++) {
      const b = s.black[r];
      if (b !== 0 && b < s.white[r]) return { row: r, to: Math.trunc(b * rnd()) };
    }
    for (let r = 0; r < s.ny; r++) {
      const b = s.black[r];
      if (b !== s.nx - 1 && b > s.white[r]) return { row: r, to: b + Math.trunc((s.nx - b - 1) * rnd() + 1) };
    }
    return { row: 0, to: 0 }; // the applet's last resort; it cannot be reached while black has a move
  }

  /** A winning move for the player when there is one: bring the nim-sum to 0 by moving white toward black. */
  function hint(s) {
    if (s.turn !== "white") return null;
    const heaps = gaps(s), x = heaps.reduce((t, g) => t ^ g, 0);
    if (x === 0) return null;
    let best = 0, row = 0;
    for (let r = 0; r < s.ny; r++) if (best < (heaps[r] & x)) { best = heaps[r] & x; row = r; }
    const d = heaps[row] - (heaps[row] ^ x);
    return { row, to: s.black[row] > s.white[row] ? s.white[row] + d : s.white[row] - d };
  }

  return { MIN_NX, MAX_NX, DEFAULT_NX, MIN_NY, MAX_NY, DEFAULT_NY, start, gaps, nimSum, targets, legalMoves, hasMoves, move, result, computerMove, hint };
})();
