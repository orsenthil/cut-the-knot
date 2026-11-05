"use strict";

/*
 * Dawson's Chess -- pure logic, no DOM. Ported from Alexander Bogomolny's
 * DawsonChess applet (cut-the-knot.org/Curriculum/Games/DawsonChess.shtml).
 * classes.zip holds only bytecode, so the rules below were read off
 * `javap -c -p` on DawsonChessCanvas.class and DawsonChessGame.class.
 *
 * The board is a ring of `Num` skittles, 10 to 60 of them, 18 by default
 * (DawsonChess.init: CTKNumberCanvas.SetRange(10, 60), default num 18).
 * A move knocks down one standing skittle *together with the two places next
 * to it* on the ring -- mouseClicked calls Exclude(i), Exclude((i+1)%N) and
 * Exclude((i-1+N)%N), always modulo N, so the ring really is a ring. Knocking
 * over an already-fallen place does nothing, so a move takes down 3 skittles
 * in mid-arc but only 2 at the end of an arc and 1 when the skittle is alone.
 * Whoever knocks down the last skittle wins ("You won" / "I won" in the
 * applet's own strings).
 *
 * The applet's "Full circle" checkbox is the opening, not the rule. Checked,
 * every place stands. Unchecked, Reset() punches gaps at random to break the
 * ring into arcs -- two gaps, or three above 25 skittles, or four above 35.
 * `openingRing` reproduces that arithmetic exactly.
 *
 * This is the octal game .137: from an arc of n you may take the whole arc
 * when n = 1, take 2 and leave one arc, or take 3 and leave zero, one or two
 * arcs. Arcs never merge, so a position is a disjunctive sum of arcs and the
 * Sprague-Grundy theorem applies: XOR the arcs' nim-values, and the player to
 * move loses exactly when that XOR is 0. `rowGrundy` is that nim-sequence,
 * computed here by the mex rule; the applet instead shipped it as a hard-coded
 * 136-entry table, and porting/check-dawsons-chess.mjs checks the two agree
 * entry for entry.
 *
 * One deliberate fix. The applet evaluates an unbroken ring of n skittles with
 * the *arc* value rowGrundy[n], but a full ring is not an arc: every first move
 * on it takes 3 places and leaves an arc of n-3, where a move at the end of an
 * arc takes only 2. So its "Full circle" openings were scored with the wrong
 * game. `cycleGrundy` scores them properly, and it also never misses the move
 * that takes a lone skittle, which the applet's GoodMove loop skipped. The
 * opponent is otherwise the applet's: the first move that drives the XOR to 0,
 * and a random standing skittle when there is no such move.
 */
const DawsonCore = (() => {
  const N_MIN = 10; // CTKNumberCanvas.SetRange(10, 60)
  const N_MAX = 60;
  const N_DEFAULT = 18; // getParameter("num"), 18 when absent

  /**
   * Nim-values of an arc of n skittles with a gap at each end, by the mex rule.
   * Clicking an end place takes 2 and leaves one arc of n-2; clicking the i-th
   * place of the arc (0-based, 0 < i < n-1) takes 3 and leaves arcs of i-1 and
   * n-i-2; and a lone skittle can simply be taken.
   */
  function buildRowGrundy(limit) {
    const g = [0];
    for (let n = 1; n <= limit; n++) {
      const seen = new Set();
      if (n === 1) {
        seen.add(0);
      } else {
        seen.add(g[n - 2]);
        for (let i = 1; i <= n - 2; i++) seen.add(g[i - 1] ^ g[n - i - 2]);
      }
      let m = 0;
      while (seen.has(m)) m++;
      g[n] = m;
    }
    return g;
  }

  /**
   * Nim-values of an unbroken ring of n places. Every move on a ring of 4 or
   * more takes exactly 3 adjacent places and leaves a single arc of n-3, and
   * by symmetry it does not matter which, so there is only ever one option to
   * take the mex of. A ring of 1, 2 or 3 is cleared by any single move.
   */
  function buildCycleGrundy(limit, rowG) {
    const g = [0];
    for (let n = 1; n <= limit; n++) {
      const only = n <= 3 ? 0 : rowG[n - 3];
      g[n] = only === 0 ? 1 : 0;
    }
    return g;
  }

  const rowGrundy = buildRowGrundy(N_MAX);
  const cycleGrundy = buildCycleGrundy(N_MAX, rowGrundy);

  /** Reset(): every place standing, with the applet's random gaps when !full. */
  function openingRing(n, full, rand = Math.random) {
    const up = new Array(n).fill(1);
    if (full) return up;
    const step = n > 35 ? Math.floor(n / 4) : n > 25 ? Math.floor(n / 3) : Math.floor(n / 2);
    let j = 0;
    up[j] = 0;
    j = j + 1 + Math.floor(rand() * step);
    up[j] = 0;
    if (n > 25) {
      j = j + 1 + Math.floor(rand() * step);
      up[j] = 0;
      if (n > 35) {
        j = j + 1 + Math.floor(rand() * step);
        up[j] = 0;
      }
    }
    return up;
  }

  /**
   * The position as a sum of independent parts: either one unbroken ring, or
   * the maximal arcs of standing skittles, each `{ start, len }` with `start`
   * the first standing place clockwise. Arcs can never merge, because a fallen
   * place stays fallen.
   */
  function decompose(up) {
    const n = up.length;
    const gap = up.indexOf(0);
    if (gap < 0) return { full: true, arcs: [{ start: 0, len: n }] };
    const arcs = [];
    let run = null;
    for (let k = 1; k <= n; k++) {
      const i = (gap + k) % n;
      if (up[i]) {
        if (!run) run = { start: i, len: 0 };
        run.len++;
      } else if (run) {
        arcs.push(run);
        run = null;
      }
    }
    return { full: false, arcs };
  }

  /** The Sprague-Grundy value of the whole position: 0 means the mover loses. */
  function value(up) {
    const { full, arcs } = decompose(up);
    if (!arcs.length) return 0;
    if (full) return cycleGrundy[arcs[0].len];
    return arcs.reduce((x, a) => x ^ rowGrundy[a.len], 0);
  }

  const standing = (up) => up.reduce((k, v) => k + v, 0);
  const isFinished = (up) => standing(up) === 0;
  const legalMoves = (up) => up.flatMap((v, i) => (v ? [i] : []));

  /** The three places a move at i knocks down: i and its two ring neighbours. */
  function footprint(up, i) {
    const n = up.length;
    const hit = new Set([i, (i + 1) % n, (i - 1 + n) % n]);
    return [...hit].filter((j) => up[j] === 1);
  }

  /** The move at i as a new ring, or null when nothing is standing there. */
  function move(up, i) {
    if (!up[i]) return null;
    const next = up.slice();
    for (const j of footprint(up, i)) next[j] = 0;
    return next;
  }

  /**
   * The computer's move, as a place to click, or -1 on an empty ring. Play()
   * in the applet: when the position is already lost it plays a random
   * standing skittle, otherwise it takes the first move that leaves a
   * zero-value position, which is a position its opponent cannot win from.
   */
  function bestMove(up, rand = Math.random) {
    const moves = legalMoves(up);
    if (!moves.length) return -1;
    for (const i of moves) {
      if (value(move(up, i)) === 0) return i;
    }
    return moves[Math.min(moves.length - 1, Math.floor(rand() * moves.length))];
  }

  return {
    N_MIN, N_MAX, N_DEFAULT,
    rowGrundy, cycleGrundy,
    openingRing, decompose, value,
    standing, isFinished, legalMoves, footprint, move, bestMove,
  };
})();
