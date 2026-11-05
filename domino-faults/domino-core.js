"use strict";

/*
 * Dominoes on a Chessboard (Bogomolny's DominoCovering applet).
 *
 * Cover an N by M board with 2x1 dominoes so that no grid line runs clean
 * across it. A line that no domino crosses is a fault line, and the applet
 * draws every one of them doubled; its CheckFinished() declares success only
 * when the number of dominoes is N*M/2 AND AllLinedCrossed() finds every
 * interior line crossed.
 *
 * The cut-the-knot page's theorem, which this file encodes in faultFree():
 * an N by M board has a fault-free covering exactly when N*M is even, both
 * sides are bigger than 4, and the board is not the 6 by 6. The 6 by 6 is the
 * famous exception, and the page's own argument is short: no line can be
 * crossed by exactly one domino, the 6 by 6 has 10 interior lines, and 10
 * lines times 2 dominoes would cover 40 squares on a board of 36.
 *
 * porting/check-domino-faults.mjs checks that claim the hard way, by
 * enumerating tilings of every small board rather than trusting the formula.
 */

var DominoCore = (function () {
  const index = (s, r, c) => r * s.cols + c;
  const inside = (s, r, c) => r >= 0 && r < s.rows && c >= 0 && c < s.cols;

  function create(rows, cols) {
    return {
      rows: rows,
      cols: cols,
      cover: new Array(rows * cols).fill(-1), // square -> domino number, or -1
      dominoes: [], // { r, c, vertical }: r,c is the top-left square it covers
    };
  }

  const free = (s, r, c) => inside(s, r, c) && s.cover[index(s, r, c)] < 0;

  const adjacent = (r1, c1, r2, c2) => Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;

  /** The applet's rule: two free squares sharing an edge, nothing diagonal. */
  function place(s, r1, c1, r2, c2) {
    if (!adjacent(r1, c1, r2, c2)) return false;
    if (!free(s, r1, c1) || !free(s, r2, c2)) return false;
    const d = { r: Math.min(r1, r2), c: Math.min(c1, c2), vertical: r1 !== r2 };
    s.dominoes.push(d);
    const n = s.dominoes.length - 1;
    s.cover[index(s, r1, c1)] = n;
    s.cover[index(s, r2, c2)] = n;
    return true;
  }

  /** Drops domino number n and renumbers the squares the others own. */
  function removeNumber(s, n) {
    if (n < 0 || n >= s.dominoes.length) return false;
    s.dominoes.splice(n, 1);
    for (let i = 0; i < s.cover.length; i++) {
      if (s.cover[i] === n) s.cover[i] = -1;
      else if (s.cover[i] > n) s.cover[i]--;
    }
    return true;
  }

  const removeLast = (s) => removeNumber(s, s.dominoes.length - 1);
  const removeAt = (s, r, c) => (inside(s, r, c) ? removeNumber(s, s.cover[index(s, r, c)]) : false);

  const dominoAt = (s, r, c) => (inside(s, r, c) ? s.cover[index(s, r, c)] : -1);

  /**
   * The interior lines no domino crosses. Line h is the one between rows
   * h-1 and h, so only a vertical domino sitting on row h-1 crosses it.
   */
  function faults(s) {
    const horizontal = [];
    const vertical = [];
    for (let h = 1; h < s.rows; h++) {
      if (!s.dominoes.some((d) => d.vertical && d.r === h - 1)) horizontal.push(h);
    }
    for (let v = 1; v < s.cols; v++) {
      if (!s.dominoes.some((d) => !d.vertical && d.c === v - 1)) vertical.push(v);
    }
    return { horizontal: horizontal, vertical: vertical };
  }

  const faultCount = (s) => {
    const f = faults(s);
    return f.horizontal.length + f.vertical.length;
  };

  const isFull = (s) => s.dominoes.length * 2 === s.rows * s.cols;

  const won = (s) => isFull(s) && faultCount(s) === 0;

  /** A board can be covered at all only if it has an even number of squares. */
  const coverable = (rows, cols) => (rows * cols) % 2 === 0;

  /** The page's theorem: when a fault-free covering exists. */
  const faultFree = (rows, cols) =>
    coverable(rows, cols) && rows > 4 && cols > 4 && !(rows === 6 && cols === 6);

  return {
    create: create,
    inside: inside,
    free: free,
    adjacent: adjacent,
    place: place,
    removeLast: removeLast,
    removeAt: removeAt,
    dominoAt: dominoAt,
    faults: faults,
    faultCount: faultCount,
    isFull: isFull,
    won: won,
    coverable: coverable,
    faultFree: faultFree,
  };
})();
