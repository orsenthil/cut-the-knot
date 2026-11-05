"use strict";

/*
 * Hex on a 7 by 7 board - the rules and an opponent.
 *
 * Two players take turns filling cells of a rhombus of hexagons. White
 * wants a chain of white cells joining the top and bottom rows; Black wants
 * one joining the left and right columns. White moves first, and, as on the
 * cut-the-knot page, the centre cell is off limits for the very first move,
 * to blunt the first player's advantage.
 *
 * The rules (board size, who moves first, which edges each side joins, the
 * blocked centre, the two levels) are the Hex7 applet's. Its computer
 * player is not: that applet is Robert Kirkland's "Hex 2.0", all rights
 * reserved, so this opponent is written from scratch instead. It is a plain
 * Monte Carlo player. Hex suits that well, because a full board always has
 * exactly one winner: to judge a move, fill the rest of the board at random
 * many times and count how often the side that moved wins. Before sampling
 * it takes a winning cell if it has one and blocks the opponent's if it
 * must. "Basic" samples a few games per move, "Advanced" many more.
 *
 * Cells are numbered r * 7 + c. Neighbours of (r, c) are the six cells
 * (r-1, c), (r-1, c+1), (r, c-1), (r, c+1), (r+1, c-1), (r+1, c).
 */

var Hex7Core = (function () {
  const N = 7;
  const EMPTY = 0;
  const WHITE = 1;
  const BLACK = 2;
  const CENTRE = 3 * N + 3;
  const LEVELS = { basic: 12, advanced: 1500 }; // random games per candidate move

  const other = (side) => (side === WHITE ? BLACK : WHITE);

  function neighbourTable(n) {
    const table = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const list = [];
        for (const [dr, dc] of [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]]) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < n && cc >= 0 && cc < n) list.push(rr * n + cc);
        }
        table.push(list);
      }
    }
    return table;
  }
  const TABLES = {};
  const neighbours = (n) => TABLES[n] || (TABLES[n] = neighbourTable(n));

  /** Does `side` join its two edges? Works for any board size n. */
  function connects(cells, side, n = N) {
    const nb = neighbours(n);
    const seen = new Uint8Array(n * n);
    const stack = [];
    for (let i = 0; i < n; i++) {
      const start = side === WHITE ? i : i * n; // White: the top row; Black: the left column
      if (cells[start] === side) {
        seen[start] = 1;
        stack.push(start);
      }
    }
    while (stack.length) {
      const k = stack.pop();
      const r = Math.floor(k / n);
      const c = k % n;
      if ((side === WHITE && r === n - 1) || (side === BLACK && c === n - 1)) return true;
      for (const j of nb[k]) {
        if (!seen[j] && cells[j] === side) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    return false;
  }

  function start() {
    return { cells: new Array(N * N).fill(EMPTY), turn: WHITE, ply: 1, winner: EMPTY, last: -1 };
  }

  /** May the side to move play cell k? The centre is blocked on the first move. */
  function legal(s, k) {
    return s.winner === EMPTY && s.cells[k] === EMPTY && !(s.ply === 1 && k === CENTRE);
  }

  function play(s, k) {
    if (!legal(s, k)) return false;
    s.cells[k] = s.turn;
    s.last = k;
    if (connects(s.cells, s.turn)) s.winner = s.turn;
    s.turn = other(s.turn);
    s.ply++;
    return true;
  }

  function legalMoves(s) {
    const out = [];
    for (let k = 0; k < N * N; k++) if (legal(s, k)) out.push(k);
    return out;
  }

  /** A cell that wins at once for `side`, or -1. */
  function winningCell(s, side) {
    for (const k of legalMoves(s)) {
      s.cells[k] = side;
      const wins = connects(s.cells, side);
      s.cells[k] = EMPTY;
      if (wins) return k;
    }
    return -1;
  }

  /** Fill every empty cell at random, alternating from `toMove`, and say who won. */
  function randomFinish(cells, toMove, rnd, empties) {
    for (let i = empties.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = empties[i];
      empties[i] = empties[j];
      empties[j] = t;
    }
    let side = toMove;
    for (const k of empties) {
      cells[k] = side;
      side = other(side);
    }
    // On a full board exactly one side connects, so checking White is enough.
    const winner = connects(cells, WHITE) ? WHITE : BLACK;
    for (const k of empties) cells[k] = EMPTY;
    return winner;
  }

  /** The computer's move for the side to move. */
  function chooseMove(s, level = "advanced", rnd = Math.random) {
    const me = s.turn;
    const moves = legalMoves(s);
    if (!moves.length) return -1;
    const win = winningCell(s, me);
    if (win >= 0) return win;
    const block = winningCell(s, other(me));
    if (block >= 0 && legal(s, block)) return block;

    const games = LEVELS[level] || LEVELS.advanced;
    const cells = s.cells.slice();
    let best = moves[0];
    let bestScore = -1;
    for (const k of moves) {
      cells[k] = me;
      const empties = [];
      for (let j = 0; j < N * N; j++) if (cells[j] === EMPTY) empties.push(j);
      let wins = 0;
      for (let g = 0; g < games; g++) if (randomFinish(cells, other(me), rnd, empties) === me) wins++;
      cells[k] = EMPTY;
      // Ties go to the cell nearer the centre, which is where Hex is decided.
      const r = Math.floor(k / N);
      const c = k % N;
      const score = wins + (1e-3 * (6 - Math.abs(r - 3) - Math.abs(c - 3) - Math.abs(r + c - 6))) / 6;
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
    return best;
  }

  return {
    N, EMPTY, WHITE, BLACK, CENTRE, LEVELS,
    other, neighbours, connects, start, legal, play, legalMoves, winningCell, chooseMove,
  };
})();
