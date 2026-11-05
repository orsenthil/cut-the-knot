"use strict";

/*
 * Eight Digits Puzzle - the logic behind Bogomolny's applet.
 * (EightDigitPuzzleCanvas; cut-the-knot.org/SimpleGames/EightDigitPuzzle.shtml.)
 *
 * Eight circles are laid out like this, and circles that touch - sideways,
 * up and down or cornerwise - are neighbours:
 *
 *         (0)
 *      (1)(2)(3)
 *      (4)(5)(6)
 *         (7)
 *
 * Put the digits 1 to 8 in the circles so that no two consecutive digits land
 * in neighbouring circles.
 *
 * The 17 edges below are the applet's own Edges table, and they are exactly the
 * pairs of circles a chess king could step between in that figure. Circles 2
 * and 5 touch six others each: every circle except one.
 *
 * This file has no DOM. It defines the global EightDigitsCore.
 */

const EightDigitsCore = (function () {
  /** Where each circle sits, in grid squares: {col, row}. */
  const CELLS = [
    { col: 1, row: 0 },
    { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
    { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 },
    { col: 1, row: 3 },
  ];

  /** The applet's Edges table: which circles are neighbours. */
  const EDGES = [
    [0, 1], [0, 2], [0, 3],
    [1, 2], [1, 4], [1, 5],
    [2, 3], [2, 4], [2, 5], [2, 6],
    [3, 5], [3, 6],
    [4, 5], [4, 7],
    [5, 6], [5, 7],
    [6, 7],
  ];

  const N = CELLS.length;

  const NEIGHBOURS = (() => {
    const n = Array.from({ length: N }, () => []);
    for (const [a, b] of EDGES) { n[a].push(b); n[b].push(a); }
    return n.map((list) => list.slice().sort((x, y) => x - y));
  })();

  const isNeighbour = (a, b) => NEIGHBOURS[a].includes(b);

  /** The pairs that are *not* neighbours - the complementary graph. */
  const COMPLEMENT = (() => {
    const out = [];
    for (let a = 0; a < N; a++) {
      for (let b = a + 1; b < N; b++) if (!isNeighbour(a, b)) out.push([a, b]);
    }
    return out;
  })();

  const COMPLEMENT_NEIGHBOURS = (() => {
    const n = Array.from({ length: N }, () => []);
    for (const [a, b] of COMPLEMENT) { n[a].push(b); n[b].push(a); }
    return n;
  })();

  /* ------------------------------------------------------- the symmetries */

  /** maps[i] = the circle that circle i is sent to. */
  const SYMMETRIES = (() => {
    const find = (col, row) => CELLS.findIndex((c) => c.col === col && c.row === row);
    const build = (f) => CELLS.map(({ col, row }) => {
      const { col: c, row: r } = f(col, row);
      return find(c, r);
    });
    return {
      identity: build((col, row) => ({ col, row })),
      mirrorLeftRight: build((col, row) => ({ col: 2 - col, row })),
      mirrorTopBottom: build((col, row) => ({ col, row: 3 - row })),
      halfTurn: build((col, row) => ({ col: 2 - col, row: 3 - row })),
    };
  })();

  /** Move a placement through a symmetry: out[map[i]] = placement[i]. */
  function applySymmetry(placement, map) {
    const out = new Array(N).fill(null);
    for (let i = 0; i < N; i++) out[map[i]] = placement[i];
    return out;
  }

  /** Swap every digit d for 9 - d. Consecutive stays consecutive. */
  const reverseDigits = (placement) => placement.map((d) => (d === null ? null : 9 - d));

  /* ------------------------------------------------------------- the rules */

  /** Every pair of neighbouring circles holding consecutive digits. */
  function conflicts(placement) {
    const out = [];
    for (const [a, b] of EDGES) {
      const x = placement[a];
      const y = placement[b];
      if (x !== null && y !== null && Math.abs(x - y) === 1) out.push([a, b]);
    }
    return out;
  }

  const isSolution = (placement) =>
    placement.length === N
    && placement.every((d) => Number.isInteger(d) && d >= 1 && d <= N)
    && new Set(placement).size === N
    && conflicts(placement).length === 0;

  /** Every way to fill all eight circles. There are four. */
  function solutions() {
    const found = [];
    const placement = new Array(N).fill(null);
    const used = new Array(N + 1).fill(false);
    (function fill(cell) {
      if (cell === N) { found.push(placement.slice()); return; }
      for (let d = 1; d <= N; d++) {
        if (used[d]) continue;
        let clash = false;
        for (const other of NEIGHBOURS[cell]) {
          if (other < cell && Math.abs(placement[other] - d) === 1) { clash = true; break; }
        }
        if (clash) continue;
        used[d] = true;
        placement[cell] = d;
        fill(cell + 1);
        placement[cell] = null;
        used[d] = false;
      }
    })(0);
    return found;
  }

  /* -------------------------------------------------------------- the game */

  /**
   * One round. Digits are placed in order 1, 2, 3, ... by clicking a circle,
   * as in the applet; a clash is allowed but flagged, and clicking the circle
   * holding the last digit takes it back.
   *
   * The applet remembered only the clash made by the latest placement, so an
   * earlier clash could be forgotten and the puzzle declared finished with two
   * consecutive digits still touching. Here the whole board is checked after
   * every move.
   */
  class Game {
    constructor() {
      this.reset();
    }

    reset() {
      this.placement = new Array(N).fill(null);
      this.order = [];   // circles, in the order they were filled
    }

    /** The digit that the next click will place, or null when the board is full. */
    get nextDigit() {
      return this.order.length < N ? this.order.length + 1 : null;
    }

    get conflicts() {
      return conflicts(this.placement);
    }

    get finished() {
      return this.order.length === N && this.conflicts.length === 0;
    }

    /** The circle holding the digit placed last, or null. */
    get lastCell() {
      return this.order.length ? this.order[this.order.length - 1] : null;
    }

    /**
     * Click a circle. Filling an empty one places the next digit; clicking the
     * one that holds the last digit takes it back.
     * Returns {action: "place"|"undo"|"none", cell, digit, clash}.
     */
    click(cell) {
      if (this.placement[cell] !== null) {
        if (cell === this.lastCell) {
          const digit = this.placement[cell];
          this.undo();
          return { action: "undo", cell, digit, clash: null };
        }
        return { action: "none", cell, digit: this.placement[cell], clash: null };
      }
      const digit = this.nextDigit;
      if (digit === null) return { action: "none", cell, digit: null, clash: null };
      this.placement[cell] = digit;
      this.order.push(cell);
      // The clash this move made, if any: a neighbour holding digit +/- 1.
      let clash = null;
      for (const other of NEIGHBOURS[cell]) {
        const d = this.placement[other];
        if (d !== null && Math.abs(d - digit) === 1) { clash = [other, cell]; break; }
      }
      return { action: "place", cell, digit, clash };
    }

    undo() {
      const cell = this.order.pop();
      if (cell === undefined) return null;
      const digit = this.placement[cell];
      this.placement[cell] = null;
      return { cell, digit };
    }
  }

  return {
    N, CELLS, EDGES, NEIGHBOURS, COMPLEMENT, COMPLEMENT_NEIGHBOURS, SYMMETRIES,
    isNeighbour, conflicts, isSolution, solutions, applySymmetry, reverseDigits,
    Game,
  };
})();
