"use strict";

/*
 * Calendar Magic - the logic behind Bogomolny's calendar trick.
 * (Ported from the CalendarGame applet; see cut-the-knot.org/SimpleGames/Calendar.shtml.)
 *
 * A month printed Sunday-first is an arithmetic grid. If the date in the top
 * left corner of an n-by-n block is `a`, then the date r rows down and c
 * columns right of it is
 *
 *     a + 7r + c
 *
 * because one step right adds 1 day and one step down adds 7. Pick one date in
 * every row and every column of the block: the rows contribute 0,7,...,7(n-1)
 * once each and the columns contribute 0,1,...,n-1 once each, whatever order
 * they are paired in. So the total is fixed before a single date is chosen:
 *
 *     n*a + 7*(0+1+...+(n-1)) + (0+1+...+(n-1)) = n*a + 4*n*(n-1)
 *
 * For n = 4 that is 4a + 48, the number the original page predicts.
 *
 * This file has no DOM. It defines the global CalendarCore.
 */

const CalendarCore = (function () {
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // The applet's own range starts at 1900 (CalendarGameCanvas.m_Min); its page
  // caps it at 2037 only because of a Java library bug, so the port goes on.
  const MIN_YEAR = 1900;
  const MAX_YEAR = 2099;

  /** Gregorian leap year. */
  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  /** Days in month, month 0-11. */
  function daysInMonth(year, month) {
    const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return month === 1 && isLeapYear(year) ? 29 : lengths[month];
  }

  /**
   * Weekday of the 1st of the month, 0 = Sunday, by Zeller's congruence, so the
   * grid does not depend on the host's Date or locale.
   */
  function firstWeekday(year, month) {
    let m = month + 1;
    let y = year;
    if (m < 3) { m += 12; y -= 1; }
    const K = y % 100;
    const J = Math.floor(y / 100);
    // Zeller gives 0 = Saturday, so shift by 6 to land on 0 = Sunday.
    const h = (1 + Math.floor((13 * (m + 1)) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) + 5 * J) % 7;
    return (h + 6) % 7;
  }

  /**
   * The month as a grid of 7 columns (Sunday first). cells[row][col] is the date
   * number, or null for a blank. A date d sits at row (offset+d-1)/7, column
   * (offset+d-1)%7, where offset is the weekday of the 1st.
   */
  function monthGrid(year, month) {
    const offset = firstWeekday(year, month);
    const days = daysInMonth(year, month);
    const rows = Math.ceil((offset + days) / 7);
    const cells = [];
    for (let r = 0; r < rows; r++) cells.push(new Array(7).fill(null));
    for (let d = 1; d <= days; d++) {
      const i = offset + d - 1;
      cells[Math.floor(i / 7)][i % 7] = d;
    }
    return { year, month, offset, days, rows, cells };
  }

  /** The predicted total: one date per row and per column of an n-by-n block. */
  function squareSum(topLeftDate, n) {
    return n * topLeftDate + 4 * n * (n - 1);
  }

  /**
   * Can an n-by-n block anchored at (row, col) be used? The applet selects a
   * geometric rectangle and so allows blanks inside it, which leaves a square
   * that can never be completed; this port only offers blocks made of real
   * dates.
   */
  function squareFits(grid, row, col, n) {
    if (row < 0 || col < 0 || row + n > grid.rows || col + n > 7) return false;
    for (let r = row; r < row + n; r++) {
      for (let c = col; c < col + n; c++) {
        if (grid.cells[r][c] === null) return false;
      }
    }
    return true;
  }

  /** Every anchor (row, col) where an n-by-n block of real dates fits. */
  function anchors(grid, n) {
    const found = [];
    for (let r = 0; r + n <= grid.rows; r++) {
      for (let c = 0; c + n <= 7; c++) {
        if (squareFits(grid, r, c, n)) found.push({ row: r, col: c });
      }
    }
    return found;
  }

  /** The rejection messages, in the applet's own spirit. */
  const MESSAGES = {
    outside: "Pick a date inside the square.",
    same: "That date is already picked.",
    row: "You already have a pick in that row.",
    column: "You already have a pick in that column.",
    done: "The square is full - clear the picks to try another set.",
  };

  /**
   * One round: a chosen square, and the picks made inside it. `pick` mirrors
   * CalendarGameCanvas.CheckHit - one date per row and per column, nothing
   * outside the square, and the total is kept as it grows.
   */
  class Round {
    constructor(grid, row, col, n) {
      this.grid = grid;
      this.row = row;
      this.col = col;
      this.n = n;
      this.topLeft = grid.cells[row][col];
      this.prediction = squareSum(this.topLeft, n);
      this.picks = [];   // {row, col, date}, in click order
      this.total = 0;
    }

    get finished() {
      return this.picks.length === this.n;
    }

    contains(row, col) {
      return row >= this.row && row < this.row + this.n
        && col >= this.col && col < this.col + this.n;
    }

    /** Why a cell cannot be picked, or null if it can. */
    reject(row, col) {
      if (this.finished) return MESSAGES.done;
      if (!this.contains(row, col)) return MESSAGES.outside;
      for (const p of this.picks) {
        if (p.row === row && p.col === col) return MESSAGES.same;
        if (p.row === row) return MESSAGES.row;
        if (p.col === col) return MESSAGES.column;
      }
      return null;
    }

    /**
     * Try to pick the date at (row, col). Returns
     * {ok: true, date, total, finished} or {ok: false, message}.
     */
    pick(row, col) {
      const bad = this.reject(row, col);
      if (bad) return { ok: false, message: bad };
      const date = this.grid.cells[row][col];
      this.picks.push({ row, col, date });
      this.total += date;
      return { ok: true, date, total: this.total, finished: this.finished };
    }

    clearPicks() {
      this.picks = [];
      this.total = 0;
    }
  }

  return {
    MONTH_NAMES, DAY_NAMES, MIN_YEAR, MAX_YEAR, MESSAGES,
    isLeapYear, daysInMonth, firstWeekday, monthGrid,
    squareSum, squareFits, anchors, Round,
  };
})();
