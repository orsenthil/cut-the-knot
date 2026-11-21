"use strict";

/*
 * The Game of Fif, from Alexander Bogomolny's applet fif (a modification of Arthur van
 * Hoff's TicTacToe sample).
 *
 * Nine squares are numbered 1 to 9. You and the computer take turns choosing a square; the one
 * who first holds three numbers that add up to 15 wins. There are exactly eight such triples, and
 * they are the eight lines of the magic square
 *      4 9 2
 *      3 5 7
 *      8 1 6
 * so Fif is TicTacToe in disguise. The applet keeps the board as two bit masks over the nine
 * cells of that square: `white` is the computer and `black` is you. Read off the bytecode:
 *   won[m]      true when mask m contains a line (InitWons: the lines 7, 56, 448, 73, 146, 292, 273, 84);
 *   moves       the order the computer looks at the cells: 4 0 2 6 8 1 3 5 7 (centre, corners, edges);
 *   magic       cell i of the square holds number magic[i] + 1: 3 8 1 2 4 6 7 0 5;
 *   bestMove    for each free cell in that order: with chance 1/20 take it at once (the computer errs
 *               with probability 1/20, as the page says); if it wins, take it; if it lets you win with
 *               your next move skip it; otherwise remember the first such cell; at the end take the
 *               remembered cell, or else any free one;
 *   Start       the computer opens on a random one of the nine cells (when "I move first" is on);
 *   status      1 the computer holds a line, 2 you do, 3 the board is full, 0 otherwise;
 *   a click on a finished game clears it first and plays the clicked square.
 * Scores (computer : you) are kept until the page is left; Clear does not reset them.
 * The "I move first" box makes the computer open: this port calls it "Computer moves first".
 * The position is plain data; the random numbers come from a seed kept in it.
 */
const FifCore = (() => {
  const MOVES = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  const MAGIC = [3, 8, 1, 2, 4, 6, 7, 0, 5];
  const LINES = [7, 56, 448, 73, 146, 292, 273, 84];
  const FULL = 511;
  const WON = new Array(512).fill(false);
  for (const line of LINES) for (let m = 0; m < 511; m++) if ((m & line) === line) WON[m] = true;

  const RESULTS = ["I won! It's now", "Congratulations! You won! It's now", "Stalemate... Let's try again"];

  /** The bit (cell of the magic square) of number n (1..9): the applet's translate. */
  const bitOf = (n) => MAGIC.indexOf(n - 1);
  /** The number (1..9) at cell j: translateback + 1. */
  const numberAt = (j) => MAGIC[j] + 1;
  /** The numbers in a mask, sorted. */
  const numbers = (mask) => { const out = []; for (let j = 0; j < 9; j++) if (mask & (1 << j)) out.push(numberAt(j)); return out.sort((a, b) => a - b); };

  /** A pseudo-random number in [0, 1) from the state's generator, and the advanced state. */
  function draw(s) {
    const r = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
    return [r / 4294967296, { ...s, rng: r }];
  }

  /** A new game. Options: first (the computer opens, after Start), seed. */
  function start(options) {
    const o = options || {};
    const seed = Number.isFinite(Number(o.seed)) ? Math.trunc(Number(o.seed)) : 20240;
    return { white: 0, black: 0, first: !!o.first, finished: false, whiteWins: 0, blackWins: 0, announce: "", rng: (Math.imul(seed || 1, 2654435761) ^ 0x5bd1e995) >>> 0, moves: 0 };
  }

  /** 0 going on, 1 the computer won, 2 you won, 3 stalemate (the applet's status()). */
  function status(s) {
    if (WON[s.white]) return 1;
    if (WON[s.black]) return 2;
    return (s.black | s.white) === FULL ? 3 : 0;
  }

  /**
   * The computer's cell (bestMove) for masks white (computer) and black (you); `draws` supplies the
   * random numbers: a function returning a number in [0, 1). Returns -1 when the board is full.
   */
  function bestMove(white, black, draws) {
    let best = -1;
    loop:
    for (let i = 0; i < 9; i++) {
      const mw = MOVES[i];
      if ((white & (1 << mw)) !== 0 || (black & (1 << mw)) !== 0) continue;
      if (Math.trunc(draws() * 20) === 13) return mw;
      const pw = white | (1 << mw);
      if (WON[pw]) return mw;
      for (let mb = 0; mb < 9; mb++) {
        if ((pw & (1 << mb)) === 0 && (black & (1 << mb)) === 0) {
          if (WON[black | (1 << mb)]) continue loop;
        }
      }
      if (best === -1) best = mw;
    }
    if (best !== -1) return best;
    for (let i = 0; i < 9; i++) { const mw = MOVES[i]; if ((white & (1 << mw)) === 0 && (black & (1 << mw)) === 0) return mw; }
    return -1;
  }

  /** The computer's move (myMove): the new position, or null when the board is full. */
  function computerMove(s) {
    if ((s.black | s.white) === FULL) return null;
    let t = s;
    const m = bestMove(s.white, s.black, () => { const [v, n] = draw(t); t = n; return v; });
    if (m < 0) return null;
    return { ...t, white: t.white | (1 << m) };
  }

  /** The score line after a finished game. */
  const announceOf = (s, r) => (r === 1 ? `${RESULTS[0]} ${s.whiteWins}:${s.blackWins}` : r === 2 ? `${RESULTS[1]} ${s.whiteWins}:${s.blackWins}` : RESULTS[2]);

  /** Finish bookkeeping after a move, as mouseClicked does. */
  function settle(s) {
    const r = status(s);
    if (r === 0) return s;
    const t = { ...s, finished: true, whiteWins: s.whiteWins + (r === 1 ? 1 : 0), blackWins: s.blackWins + (r === 2 ? 1 : 0) };
    return { ...t, announce: announceOf(t, r) };
  }

  /**
   * Moves: {type:"click", number} (1..9): your choice of number (a click on a finished game clears it first;
   * with the computer-first box on, nothing happens until Start); {type:"start"}: the computer opens on a random cell;
   * {type:"clear"}; {type:"first", value}.
   */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "clear") return { ...s, white: 0, black: 0, finished: false, announce: "", moves: s.moves };
    if (m.type === "first") return { ...s, white: 0, black: 0, finished: false, announce: "", first: !!m.value };
    if (m.type === "start") {
      const [r, t] = draw({ ...s, white: 0, black: 0, finished: false, announce: "" });
      return { ...t, white: 1 << Math.trunc(r * 9), black: 0, moves: s.moves + 1 };
    }
    if (m.type === "click") {
      const n = Math.trunc(Number(m.number));
      if (!(n >= 1 && n <= 9)) return null;
      if (s.first && s.white === 0 && !s.finished) return null; // press Start first
      let t = s;
      if (status(t) !== 0) t = { ...t, white: 0, black: 0, finished: false, announce: "" }; // a click on a finished game clears it
      const bit = 1 << bitOf(n);
      if ((t.black | t.white) & bit) return null;
      t = { ...t, black: t.black | bit, moves: t.moves + 1 };
      t = settle(t);
      if (!t.finished) { const c = computerMove(t); if (c) t = settle(c); }
      return t;
    }
    return null;
  }

  /** The numbers you may choose now. */
  function legalMoves(s) {
    if (s.finished) return [{ type: "clear" }];
    if (s.first && s.white === 0) return [{ type: "start" }];
    const out = [];
    for (let n = 1; n <= 9; n++) if (!((s.black | s.white) & (1 << bitOf(n)))) out.push({ type: "click", number: n });
    return out;
  }

  /** "win" when you won the game, "lose" when the computer did, "done" for a stalemate, else null. */
  function result(s) {
    const r = status(s);
    return r === 2 ? "win" : r === 1 ? "lose" : r === 3 ? "done" : null;
  }

  return { MOVES, MAGIC, LINES, WON, RESULTS, bitOf, numberAt, numbers, start, status, bestMove, computerMove, move, legalMoves, result };
})();
