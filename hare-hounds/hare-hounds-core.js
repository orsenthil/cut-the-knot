"use strict";

/*
 * Hare and Hounds - the rules and an opponent.
 *
 * An 11-point board: a point on the left (0), three columns of three points
 * (1-3, 4-6, 7-9, top to bottom) and a point on the right (10). Three hounds
 * start on 0, 1 and 3, the hare on 10, and the hounds move first. Every
 * animal steps along a line to an empty point; the hare may go any way, the
 * hounds never to the left. The hounds win by trapping the hare so it cannot
 * move. The hare wins by getting past them (once every hound is to its
 * right it can never be caught) or if the hounds stall: ten vertical moves
 * in a row by the hounds hand the game to the hare.
 *
 * The rules are the cut-the-knot applet's (its Board class: the connection
 * table below, the starting points, the escape test, the stall count and
 * when each is checked). The applet itself is Robert Kirkland's "Hare and
 * Hounds 2.0" (mazeworks.com), all rights reserved, so its computer player is
 * not used. This one is written from scratch, and it is exact: the board is
 * small enough to solve outright (the game cannot last forever - a hound's
 * move to the right cannot be undone and vertical moves are capped by the
 * stall rule), so every position has a known outcome and distance to the
 * end. Expert always plays a best move; the lower levels play one only some
 * of the time.
 */

var HareHoundsCore = (function () {
  const EMPTY = 0;
  const HOUND = 1;
  const HARE = 2;
  const STALL_LIMIT = 10;
  const LEVELS = { beginner: 0.35, intermediate: 0.75, expert: 1 }; // chance of playing a best move

  // connect[a][b]: 0 no line, 1 the step goes left, 2 vertical, 3 right (the applet's table).
  const CONNECT = [
    [0, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 2, 0, 3, 3, 0, 0, 0, 0, 0],
    [1, 2, 0, 2, 0, 3, 0, 0, 0, 0, 0],
    [1, 0, 2, 0, 0, 3, 3, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 2, 0, 3, 0, 0, 0],
    [0, 1, 1, 1, 2, 0, 2, 3, 3, 3, 0],
    [0, 0, 0, 1, 0, 2, 0, 0, 0, 3, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 2, 0, 3],
    [0, 0, 0, 0, 0, 1, 0, 2, 0, 2, 3],
    [0, 0, 0, 0, 0, 1, 1, 0, 2, 0, 3],
    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
  ];

  // Java's int division truncates toward zero, so point 0 counts as column 0, like points 1-3.
  const column = (p) => Math.trunc((p - 1) / 3);

  function start() {
    const b = new Array(11).fill(EMPTY);
    b[0] = b[1] = b[3] = HOUND;
    b[10] = HARE;
    return { b, turn: HOUND, stall: 0, winner: EMPTY, reason: "" };
  }

  const hareAt = (s) => s.b.indexOf(HARE);

  /** isValidMove(): to an empty point along a line; hounds only vertically or to the right. */
  function legal(s, from, to) {
    if (s.winner || s.b[from] !== s.turn || s.b[to] !== EMPTY) return false;
    const c = CONNECT[from][to];
    return s.turn === HOUND ? c > 1 : c > 0;
  }

  function moves(s, side = s.turn) {
    const out = [];
    for (let a = 0; a < 11; a++) {
      if (s.b[a] !== side) continue;
      for (let t = 0; t < 11; t++) {
        if (s.b[t] !== EMPTY) continue;
        const c = CONNECT[a][t];
        if (side === HOUND ? c > 1 : c > 0) out.push([a, t]);
      }
    }
    return out;
  }

  /** hareEscapes(): the hare reached point 0, or the left-most hound is right of it. */
  function hareEscapes(s) {
    const h = hareAt(s);
    if (h === 0) return true;
    for (let k = 0; k < 10; k++) if (s.b[k] === HOUND) return column(k) > column(h);
    return false;
  }

  /** The hounds win when the hare has no move (the applet tests the three points where that can happen). */
  const hareTrapped = (s) => moves(s, HARE).length === 0;

  function play(s, from, to) {
    if (!legal(s, from, to)) return false;
    const mover = s.turn;
    if (mover === HOUND) s.stall = CONNECT[from][to] === 2 ? s.stall + 1 : 0;
    s.b[to] = mover;
    s.b[from] = EMPTY;
    s.turn = mover === HOUND ? HARE : HOUND;
    // isWin(): after a hare move, escape or stalling; after a hound move, a trapped hare.
    if (mover === HARE) {
      if (hareEscapes(s)) { s.winner = HARE; s.reason = "escape"; }
      else if (s.stall === STALL_LIMIT) { s.winner = HARE; s.reason = "stalling"; }
    } else if (hareTrapped(s)) {
      s.winner = HOUND;
      s.reason = "trapped";
    }
    return true;
  }

  const copy = (s) => ({ b: s.b.slice(), turn: s.turn, stall: s.stall, winner: s.winner, reason: s.reason });
  const keyOf = (s) => s.b.join("") + s.turn + "," + s.stall;

  /**
   * The exact value of a position for the side to move: { win, plies }.
   * win is true if the side to move wins with best play; plies counts the
   * moves to the end with the winner hurrying and the loser holding out.
   */
  const memo = new Map();
  function solve(s) {
    if (s.winner) return { win: s.winner === s.turn, plies: 0 };
    const k = keyOf(s);
    if (memo.has(k)) return memo.get(k);
    const options = moves(s);
    let result;
    if (!options.length) {
      // Only the hounds can be stuck for moves without the game being over; then the hare is free.
      result = { win: false, plies: 0 };
    } else {
      let bestWin = null;
      let bestLoss = null;
      for (const [a, t] of options) {
        const n = copy(s);
        play(n, a, t);
        const v = solve(n);
        const wins = n.winner ? n.winner === s.turn : !v.win;
        const plies = v.plies + 1;
        if (wins) { if (!bestWin || plies < bestWin.plies) bestWin = { win: true, plies }; }
        else if (!bestLoss || plies > bestLoss.plies) bestLoss = { win: false, plies };
      }
      result = bestWin || bestLoss;
    }
    memo.set(k, result);
    return result;
  }

  /** Best moves for the side to move: winning fastest, or losing slowest. */
  function bestMoves(s) {
    const scored = moves(s).map(([a, t]) => {
      const n = copy(s);
      play(n, a, t);
      const v = solve(n);
      const wins = n.winner ? n.winner === s.turn : !v.win;
      return { move: [a, t], wins, plies: v.plies + 1 };
    });
    const winning = scored.filter((x) => x.wins);
    const pool = winning.length ? winning : scored;
    const target = winning.length ? Math.min(...pool.map((x) => x.plies)) : Math.max(...pool.map((x) => x.plies));
    return pool.filter((x) => x.plies === target).map((x) => x.move);
  }

  function chooseMove(s, level = "beginner", rnd = Math.random) {
    const all = moves(s);
    if (!all.length) return null;
    const p = LEVELS[level] ?? 1;
    const pool = rnd() < p ? bestMoves(s) : all;
    return pool[Math.floor(rnd() * pool.length)];
  }

  return {
    EMPTY, HOUND, HARE, STALL_LIMIT, LEVELS, CONNECT,
    column, start, hareAt, legal, moves, hareEscapes, hareTrapped, play, copy, solve, bestMoves, chooseMove,
  };
})();
