"use strict";

/*
 * Full House - Erich Friedman's puzzle, as shipped in Bogomolny's applet.
 * (FullHouseBoard/FullHouseCanvas; cut-the-knot.org/Curriculum/Games/FullHouse.shtml.)
 *
 * A few squares of a grid are blocked. Draw a path that covers every other
 * square exactly once. The catch is that the path cannot turn when it feels
 * like it: once it is moving it keeps going until the way ahead is shut - by
 * the edge of the board, by a blocked square, or by a square it has already
 * been through. Only then may it turn.
 *
 * So a move is not a step, it is a whole slide: pick a direction and the path
 * runs as far as it can go. That is the applet's own rule, from
 * FullHouseBoard.FindAvailableCellInRow/Col, which walks on until it meets a
 * cell that must not be crossed and stops at the last free one.
 *
 * PUZZLES are the applet's four hard-coded tables (Positions5..Positions8),
 * read out of the bytecode: 23 boards of 5x5, 28 of 6x6, 17 of 7x7 and 7 of
 * 8x8, each listed as the [row, column] of its blocked squares.
 *
 * This file has no DOM. It defines the global FullHouseCore.
 */

const FullHouseCore = (function () {
  const PUZZLES = {
    5: [
      [[0,0],[1,3]],
      [[0,1],[0,2]],
      [[0,2],[1,1]],
      [[0,0],[0,1],[4,0]],
      [[0,0],[0,1],[4,2]],
      [[0,0],[0,3],[2,4]],
      [[0,3],[1,1],[4,2]],
      [[0,2],[1,1],[2,3]],
      [[0,0],[2,3],[3,3]],
      [[0,0],[2,3],[4,2]],
      [[0,0],[1,2],[4,4]],
      [[0,1],[0,2],[1,1]],
      [[0,0],[1,2],[2,4],[4,3]],
      [[3,0],[1,1],[1,2],[2,4]],
      [[0,0],[0,1],[3,2],[2,4]],
      [[0,0],[1,0],[2,0],[3,4],[4,4]],
      [[0,0],[0,1],[0,2],[0,3],[2,2]],
      [[0,0],[0,1],[0,2],[0,3],[3,1]],
      [[0,0],[0,1],[0,2],[0,3],[3,3]],
      [[0,0],[0,1],[0,2],[0,3],[1,0],[2,0]],
      [[0,0],[0,1],[0,2],[0,3],[1,3],[2,1]],
      [[0,0],[0,1],[0,2],[0,3],[2,1],[2,2]],
      [[0,0],[0,1],[0,2],[2,2],[4,3],[4,4]],
    ],
    6: [
      [[0,0],[1,2]],
      [[0,0],[0,3]],
      [[0,0],[2,3]],
      [[0,2],[3,2]],
      [[1,1],[3,4]],
      [[0,1],[2,2]],
      [[0,2],[1,2],[4,4]],
      [[0,0],[0,1],[2,1]],
      [[0,0],[0,1],[2,3]],
      [[0,0],[0,1],[4,1]],
      [[0,0],[0,1],[5,3]],
      [[0,0],[0,3],[2,2]],
      [[0,0],[1,2],[3,3],[5,0]],
      [[1,1],[1,4],[3,2],[4,4]],
      [[1,3],[1,4],[2,0],[4,1]],
      [[0,5],[1,1],[3,4],[3,5]],
      [[0,2],[0,3],[5,4],[5,5]],
      [[0,0],[2,1],[2,5],[4,4],[5,0]],
      [[0,0],[2,1],[4,0],[5,0],[5,3]],
      [[0,0],[1,2],[4,1],[4,5],[5,5]],
      [[0,3],[1,3],[2,0],[2,5],[4,1]],
      [[1,1],[1,2],[2,4],[3,4],[5,2],[5,5]],
      [[0,5],[1,5],[4,2],[4,3],[5,0],[5,5]],
      [[0,0],[1,0],[2,0],[3,0],[4,5],[5,5]],
      [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[2,2]],
      [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,2]],
      [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[3,3]],
      [[0,0],[0,1],[0,2],[0,3],[2,1],[5,4],[5,5]],
    ],
    7: [
      [[0,0],[3,3]],
      [[6,6],[1,3]],
      [[0,0],[2,4]],
      [[0,2],[3,3]],
      [[0,1],[2,2],[3,3]],
      [[0,0],[0,3],[0,4]],
      [[1,5],[2,2],[2,3],[4,2],[5,4]],
      [[0,0],[1,0],[3,1],[3,3],[5,2]],
      [[1,3],[4,4],[4,5],[5,4],[6,6]],
      [[0,0],[2,1],[2,3],[2,4],[4,2],[4,6]],
      [[2,4],[3,1],[4,1],[4,3],[4,5],[6,0]],
      [[1,2],[2,2],[2,4],[4,1],[6,0]],
      [[1,5],[2,1],[4,0],[6,5],[6,6]],
      [[2,4],[4,1],[5,1],[5,5],[6,3]],
      [[1,3],[2,1],[4,5],[6,6]],
      [[0,0],[1,0],[2,0],[3,0],[4,0],[5,6],[6,6]],
      [[0,0],[1,0],[2,0],[3,0],[4,0],[5,6],[6,6],[0,3],[0,4]],
    ],
    8: [
      [[0,0],[2,3]],
      [[0,0],[0,3],[0,4],[0,5]],
      [[1,3],[2,5],[3,5],[6,2],[7,0]],
      [[0,0],[1,2],[5,4],[6,1],[7,3]],
      [[1,3],[5,5],[5,6],[6,5],[7,7]],
      [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,7],[7,7]],
      [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,7],[7,7],[0,3],[0,4],[0,5]],
    ],  };

  const SIZES = [5, 6, 7, 8];
  const DIRECTIONS = [
    { name: "up", dr: -1, dc: 0 },
    { name: "down", dr: 1, dc: 0 },
    { name: "left", dr: 0, dc: -1 },
    { name: "right", dr: 0, dc: 1 },
  ];

  const EMPTY = 0;
  const BLOCKED = 1;
  const TRAVERSED = 2;

  /**
   * One board being played. `grid[r][c]` is EMPTY, BLOCKED or TRAVERSED, and
   * `legs` holds the end square of each slide, so a leg can be taken back.
   */
  class Board {
    constructor(size, blocked) {
      this.size = size;
      this.blocked = blocked.map(([r, c]) => [r, c]);
      this.reset();
    }

    static fromLibrary(size, index) {
      const list = PUZZLES[size];
      if (!list) throw new Error(`no puzzles of size ${size}`);
      return new Board(size, list[((index % list.length) + list.length) % list.length]);
    }

    reset() {
      const n = this.size;
      this.grid = Array.from({ length: n }, () => new Array(n).fill(EMPTY));
      for (const [r, c] of this.blocked) this.grid[r][c] = BLOCKED;
      this.legs = [];     // {from: [r,c] | null, to: [r,c], cells: [[r,c], ...]}
      this.path = [];     // every square covered, in the order it was covered
    }

    get empties() {
      let n = 0;
      for (const row of this.grid) for (const cell of row) if (cell !== BLOCKED) n++;
      return n;
    }

    get head() {
      return this.path.length ? this.path[this.path.length - 1] : null;
    }

    get started() {
      return this.path.length > 0;
    }

    /** Every empty square covered? */
    get finished() {
      return this.path.length === this.empties;
    }

    inside(r, c) {
      return r >= 0 && r < this.size && c >= 0 && c < this.size;
    }

    /** The applet's DoNotCross: blocked, or already walked over. */
    crossable(r, c) {
      return this.inside(r, c) && this.grid[r][c] === EMPTY;
    }

    /**
     * Where a slide from the head in direction d would end, or null if the
     * path cannot go that way at all.
     */
    slideEnd(d) {
      if (!this.started) return null;
      const [hr, hc] = this.head;
      let r = hr + d.dr;
      let c = hc + d.dc;
      if (!this.crossable(r, c)) return null;
      while (this.crossable(r + d.dr, c + d.dc)) { r += d.dr; c += d.dc; }
      return [r, c];
    }

    /** The directions the path can still take. */
    availableDirections() {
      return DIRECTIONS.filter((d) => this.slideEnd(d) !== null);
    }

    /** Started, not finished and with nowhere to go. */
    get stuck() {
      return this.started && !this.finished && this.availableDirections().length === 0;
    }

    /**
     * Click a square, as in the applet: the first click starts the path there,
     * and a later click on a square in line with the head slides the path that
     * way - all the way, however near the square clicked. Returns the squares
     * newly covered, or null if the click is not a move.
     */
    click(r, c) {
      const d = this.clickDirection(r, c);
      if (d === undefined) return null;
      return d === null ? this.extend([[r, c]], null) : this.move(d);
    }

    /** Would clicking here be a move? */
    canClick(r, c) {
      return this.clickDirection(r, c) !== undefined;
    }

    /**
     * The direction a click on (r, c) would send the path: null for the very
     * first click, undefined when the click is not a move at all.
     */
    clickDirection(r, c) {
      if (!this.crossable(r, c)) return undefined;
      if (!this.started) return null;
      const [hr, hc] = this.head;
      if (r !== hr && c !== hc) return undefined;
      const d = DIRECTIONS.find((x) => x.dr === Math.sign(r - hr) && x.dc === Math.sign(c - hc));
      if (!d) return undefined;
      // Nothing crossed on the way may be blocked or already walked over.
      for (let rr = hr + d.dr, cc = hc + d.dc; rr !== r || cc !== c; rr += d.dr, cc += d.dc) {
        if (!this.crossable(rr, cc)) return undefined;
      }
      return d;
    }

    /** Slide in a direction. Returns the squares newly covered, or null. */
    move(d) {
      const end = this.slideEnd(d);
      if (!end) return null;
      const [hr, hc] = this.head;
      const cells = [];
      for (let r = hr + d.dr, c = hc + d.dc; ; r += d.dr, c += d.dc) {
        cells.push([r, c]);
        if (r === end[0] && c === end[1]) break;
      }
      return this.extend(cells, [hr, hc]);
    }

    extend(cells, from) {
      for (const [r, c] of cells) {
        this.grid[r][c] = TRAVERSED;
        this.path.push([r, c]);
      }
      this.legs.push({ from, to: cells[cells.length - 1], cells });
      return cells;
    }

    /** Take back the last slide (the applet's RemoveLasLeg). */
    undo() {
      const leg = this.legs.pop();
      if (!leg) return null;
      for (const [r, c] of leg.cells) {
        this.grid[r][c] = EMPTY;
        this.path.pop();
      }
      return leg;
    }
  }

  /**
   * Find a path that covers the board, by trying every starting square and
   * then every direction still open. Returns the squares in order, or null.
   */
  function solve(size, blocked) {
    const board = new Board(size, blocked);
    const target = board.empties;

    const walk = () => {
      if (board.path.length === target) return true;
      for (const d of DIRECTIONS) {
        if (board.move(d) === null) continue;
        if (walk()) return true;
        board.undo();
      }
      return false;
    };

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board.grid[r][c] !== EMPTY) continue;
        board.click(r, c);
        if (walk()) return board.path.map(([pr, pc]) => [pr, pc]);
        board.reset();
      }
    }
    return null;
  }

  return { PUZZLES, SIZES, DIRECTIONS, EMPTY, BLOCKED, TRAVERSED, Board, solve };
})();
