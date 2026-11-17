#!/usr/bin/env node
"use strict";

/*
 * Logic test for tromino/tromino-core.js.
 *
 *   node porting/check-tromino.mjs
 *
 * 1. The core is compared with a second, literal transcription of the
 *    applet's TrominoBoard.GetType/Split and TrominoCanvas.Go (in cell
 *    coordinates, cell size 1) over EVERY missing square for boards up to
 *    16x16: 4 + 16 + 64 + 256 = 340 boards, each run to completion.
 * 2. The page's theorem is checked exhaustively on the same 340 boards: the
 *    placed L-trominoes never overlap, never touch the hole, cover every
 *    other square exactly once, number (n^2 - 1)/3, and finish in n's
 *    exponent steps.
 * 3. Edge cases: option ranges, illegal moves, and the end-of-proof reset.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("tromino/tromino-core.js", "TrominoCore");

/* ---------------------------------------- 1. the applet's method, transcribed */

/*
 * A faithful second copy of the applet, straight from the bytecode.
 * TrominoBoard fields X,Y are pixel origins and A is the cell size; here we
 * use A = 1 so a cell is one unit, which makes X,Y the cell coordinates.
 */
class AppletBoard {
  constructor(X, Y, A, N) {
    this.X = X; this.Y = Y; this.A = A; this.N = N;
    this.I = 0; this.J = 0;
  }
  CutSquare(i, j) { this.I = i; this.J = j; }

  GetType() {
    if (this.I < this.N / 2) return this.J < this.N / 2 ? 0 : 3;
    return this.J < this.N / 2 ? 1 : 2;
  }

  GetCenterSquare() {
    // applet: X + N*A/2 - A, Y + N*A/2 - A
    return { col: this.X + (this.N * this.A) / 2 - this.A,
             row: this.Y + (this.N * this.A) / 2 - this.A };
  }

  Split(stack) {
    const n = this.N / 2; // local 3 in the bytecode
    const b4 = new AppletBoard(this.X, this.Y, this.A, n);
    const b5 = new AppletBoard(this.X + this.A * n, this.Y, this.A, n);
    const b6 = new AppletBoard(this.X + this.A * n, this.Y + this.A * n, this.A, n);
    const b7 = new AppletBoard(this.X, this.Y + this.A * n, this.A, n);
    switch (this.GetType()) {
      case 0:
        b4.CutSquare(this.I, this.J);
        b5.CutSquare(0, n - 1);
        b6.CutSquare(0, 0);
        b7.CutSquare(n - 1, 0);
        break;
      case 1:
        b4.CutSquare(n - 1, n - 1);
        b5.CutSquare(this.I - n, this.J);
        b6.CutSquare(0, 0);
        b7.CutSquare(n - 1, 0);
        break;
      case 2:
        b4.CutSquare(n - 1, n - 1);
        b5.CutSquare(0, n - 1);
        b6.CutSquare(this.I - n, this.J - n);
        b7.CutSquare(n - 1, 0);
        break;
      case 3:
        b4.CutSquare(n - 1, n - 1);
        b5.CutSquare(0, n - 1);
        b6.CutSquare(0, 0);
        b7.CutSquare(this.I, this.J - n);
        break;
    }
    stack.push(b4); stack.push(b5); stack.push(b6); stack.push(b7);
  }
}

/** TrominoCanvas.Go, run `exp` levels: the pieces it adds, in order. */
function appletProof(n, col, row) {
  let squares = [new AppletBoard(0, 0, 1, n)];
  squares[0].CutSquare(col, row);
  const pieces = [];
  for (let level = 0; level < Math.log2(n); level++) {
    const next = [];
    while (squares.length) {
      const b = squares.pop();
      const type = b.GetType();
      const centre = b.GetCenterSquare();
      pieces.push({ bx: centre.col, by: centre.row, type, color: level });
      b.Split(next);
    }
    squares = next;
  }
  return pieces;
}

{
  let boards = 0, pieces = 0;
  for (let exp = C.MIN_EXP; exp <= 4; exp++) {
    const n = 2 ** exp;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const expected = appletProof(n, col, row);
        let s = C.start({ exp, col, row });
        const got = [];
        for (let level = 0; level < exp; level++) {
          s = C.step(s);
          for (const p of s.trominoes.slice(got.length)) got.push({ bx: p.bx, by: p.by, type: p.type, color: p.color });
        }
        equal(`core matches applet: ${n}x${n} hole (${col},${row})`, got, expected);
        boards++; pieces += expected.length;
      }
    }
  }
  check(`applet transcription agrees on every hole (${boards} boards, ${pieces} pieces)`, boards === 340);
}

/* ----------------------------------- 2. the page's theorem, checked exhaustively */

{
  let boards = 0;
  for (let exp = C.MIN_EXP; exp <= 4; exp++) {
    const n = 2 ** exp;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        let s = C.start({ exp, col, row });
        check(`start is not finished: ${n}x${n} (${col},${row})`, C.result(s) === null);
        for (let level = 0; level < exp; level++) s = C.step(s);
        check(`finished after ${exp} steps: ${n}x${n} (${col},${row})`, C.result(s) === "done");

        // Every L is three cells of a 2x2 block; count them.
        const need = (n * n - 1) / 3;
        equal(`tromino count: ${n}x${n} (${col},${row})`, s.trominoes.length, need);

        const cover = new Map();
        for (const p of s.trominoes) {
          const cells = C.pieceCells(p);
          equal(`an L has three cells: ${n}x${n} (${col},${row})`, cells.length, 3);
          for (const c of cells) {
            check(`cell in board: ${n}x${n} (${col},${row})`,
              c.col >= 0 && c.col < n && c.row >= 0 && c.row < n);
            const k = c.col + "," + c.row;
            check(`no overlap: ${n}x${n} (${col},${row}) at ${k}`, !cover.has(k));
            cover.set(k, p);
          }
        }
        check(`the hole is never covered: ${n}x${n} (${col},${row})`, !cover.has(col + "," + row));
        check(`every other cell is covered: ${n}x${n} (${col},${row})`, cover.size === n * n - 1);
        boards++;
      }
    }
  }
  check(`theorem holds on every board up to 16x16 (${boards} boards)`, boards === 340);
}

/* ------------------------------------------------- 3. options and end states */

{
  const s = C.start({ exp: 4, col: 3, row: 5 });
  equal("default start places the hole", s.hole, { col: 3, row: 5 });
  equal("board size is 2^exp", s.n, 16);

  check("exp below the range is clamped", C.start({ exp: 0 }).exp === C.MIN_EXP);
  check("exp above the range is clamped", C.start({ exp: 99 }).exp === C.MAX_EXP);
  check("a hole outside the board is clamped", C.start({ exp: 3, col: 99, row: -5 }).hole.col === 7);

  let done4 = C.start({ exp: 3, col: 2, row: 6 });
  for (let i = 0; i < 3; i++) done4 = C.step(done4);
  check("done at the last level", C.result(done4) === "done");
  const again = C.step(done4);
  check("stepping past the end resets the proof", again.level === 0 && again.trominoes.length === 0);
  equal("the reset keeps the same hole", again.hole, { col: 2, row: 6 });

  check("a hole move inside the board works", C.move(s, { type: "hole", col: 0, row: 15 }).hole.col === 0);
  check("a hole move off the board is refused", C.move(s, { type: "hole", col: 16, row: 0 }) === null);
  check("an exponent move keeps the hole", C.move(s, { type: "exp", exp: 5 }).hole.row === 5);
  check("an unknown move is refused", C.move(s, { type: "nonsense" }) === null);

  // The number of colours cycles as the applet's ColorN does.
  let s6 = C.start({ exp: 7, col: 0, row: 0 });
  const colours = [];
  for (let i = 0; i < 7; i++) {
    s6 = C.step(s6);
    colours.push(s6.trominoes[s6.trominoes.length - 1].color);
  }
  equal("colours cycle 0..5 then wrap", colours, [0, 1, 2, 3, 4, 5, 0]);
}

done("tromino");
