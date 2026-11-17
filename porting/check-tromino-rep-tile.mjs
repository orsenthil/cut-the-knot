#!/usr/bin/env node
"use strict";

/*
 * Logic test for tromino-rep-tile/tromino-rep-tile-core.js.
 *
 *   node porting/check-tromino-rep-tile.mjs
 *
 * 1. The core is compared with a second, literal transcription of the applet's
 *    Tromino2Board.SplitInTwo, Tromino2Piece.SplitUL/UR/LR/LL and
 *    Tromino2Canvas.Trominoing/Go, over EVERY hole on every board up to 16x16
 *    (340 boards) and every refinement press.
 * 2. The page's claims are checked on the same boards: the opening picture is
 *    a tiling, every press keeps it a tiling, the hole is never covered, the
 *    pieces never overlap, and after n-1 presses every piece is a unit L.
 *    The number of pieces is (4^n - 1)/3 at the end.
 * 3. The rep-4 property of the L is checked directly: the four children of a
 *    piece exactly cover it, for every orientation and every side 2..32.
 * 4. Ranges, illegal moves and the applet's restart are checked.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("tromino-rep-tile/tromino-rep-tile-core.js", "TrominoRepTileCore");

/* --------------------------------- 1. the applet's method, transcribed again */

/*
 * Tromino2Board in cell units (its A is one cell). X,Y are the board's
 * upper-left cell; I,J are the hole, local to the board.
 */
class AppletBoard {
  constructor(X, Y, N) {
    this.X = X;
    this.Y = Y;
    this.N = N;
    this.I = 0;
    this.J = 0;
  }
  CutSquare(i, j) {
    this.I = i;
    this.J = j;
  }
  GetType() {
    if (this.I < this.N / 2) return this.J < this.N / 2 ? C.UL : C.LL;
    return this.J < this.N / 2 ? C.UR : C.LR;
  }
  /** Tromino2Board.SplitInTwo, case by case. */
  SplitInTwo() {
    const h = this.N / 2;
    let square;
    switch (this.GetType()) {
      case C.UL:
        square = new AppletBoard(this.X, this.Y, h);
        square.CutSquare(this.I, this.J);
        break;
      case C.UR:
        square = new AppletBoard(this.X + h, this.Y, h);
        square.CutSquare(this.I - h, this.J);
        break;
      case C.LR:
        square = new AppletBoard(this.X + h, this.Y + h, h);
        square.CutSquare(this.I - h, this.J - h);
        break;
      case C.LL:
        square = new AppletBoard(this.X, this.Y + h, h);
        square.CutSquare(this.I, this.J - h);
        break;
    }
    return { Square: square, Tromino: { x: this.X, y: this.Y, side: h, which: this.GetType() } };
  }
}

/** Tromino2Piece.SplitUL/UR/LR/LL, written out with the applet's own offsets. */
function appletSplit(p) {
  const h = p.side / 2;
  const X = p.x;
  const Y = p.y;
  const out = [];
  const add = (x, y, which) => out.push({ x, y, side: h, which, color: (p.color + out.length) % C.NUM_COLORS });
  switch (p.which) {
    case C.UL:
      add(X + h, Y + h, C.UL); // X+A/2, Y+A/2
      add(X + 2 * h, Y, C.LL); // X+A,   Y
      add(X, Y + 2 * h, C.UR); // X,     Y+A
      add(X + 2 * h, Y + 2 * h, C.UL); // X+A,   Y+A
      break;
    case C.UR:
      add(X + h, Y + h, C.UR);
      add(X, Y, C.LR);
      add(X, Y + 2 * h, C.UR);
      add(X + 2 * h, Y + 2 * h, C.UL);
      break;
    case C.LR:
      add(X + h, Y + h, C.LR);
      add(X, Y, C.LR);
      add(X, Y + 2 * h, C.UR);
      add(X + 2 * h, Y, C.LL);
      break;
    case C.LL:
      add(X + h, Y + h, C.LL);
      add(X + 2 * h, Y, C.LL);
      add(X, Y, C.LR);
      add(X + 2 * h, Y + 2 * h, C.UL);
      break;
  }
  return out;
}

/** Tromino2Canvas.Reset(boolean) + Trominoing: the opening picture. */
function appletStart(n, col, row, colors) {
  const board = new AppletBoard(0, 0, n);
  board.CutSquare(col, row);
  let step = n / 2;
  let square = board;
  const pieces = [];
  while (step >= 1) {
    const split = square.SplitInTwo();
    split.Tromino.color = colors[pieces.length % colors.length];
    pieces.push(split.Tromino);
    square = split.Square;
    step /= 2;
  }
  return { pieces, step: n / 2, level: 0 };
}

/** Tromino2Canvas.Go: one press, or null when it would restart. */
function appletGo(t, colors) {
  if (t.step < 2) return null; // Go calls Reset(false)
  let step = t.step / 2;
  const pieces = [];
  for (const p of t.pieces) {
    if (p.side > step) pieces.push(...appletSplit(p));
    else pieces.push(p);
  }
  return { pieces, step, level: t.level + 1, colors };
}

{
  const PALETTES = [
    [0, 1, 2, 3, 4, 5, 6],
    [3, 4, 5, 6, 0, 1, 2],
    [6, 5, 4, 3, 2, 1, 0],
  ];
  let boards = 0;
  let compared = 0;
  for (let exp = C.MIN_EXP; exp <= 4; exp++) {
    const n = 2 ** exp;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const colors = PALETTES[(col + row) % PALETTES.length];
        let want = appletStart(n, col, row, colors);
        let got = C.start({ exp, col, row, colors });
        equal(`opening picture matches the applet: ${n}x${n} (${col},${row})`, got.pieces, want.pieces);
        equal(`step starts at half the board: ${n}x${n} (${col},${row})`, got.step, want.step);
        compared++;
        for (let press = 1; press <= exp; press++) {
          const nextWant = appletGo(want, colors);
          if (!nextWant) {
            // The applet restarts with the same hole.
            const again = C.move(got, { type: "step" });
            equal(`the restart keeps the hole: ${n}x${n} (${col},${row})`, again.hole, { col, row });
            check(`the restart is the opening picture: ${n}x${n} (${col},${row})`,
              again.level === 0 && again.step === n / 2 && again.pieces.length === exp);
            want = appletStart(n, col, row, colors);
            got = again;
          } else {
            want = nextWant;
            got = C.step(got);
            equal(`One step matches the applet: ${n}x${n} (${col},${row}) press ${press}`, got.pieces, want.pieces);
            equal(`the step size matches: ${n}x${n} (${col},${row}) press ${press}`, got.step, want.step);
          }
          compared++;
        }
        boards++;
      }
    }
  }
  check(`applet transcription agrees on every hole (${boards} boards, ${compared} positions)`,
    boards === 340 && compared >= 340);
}

/* ------------------------------- 2. the page's claims, exhaustively checked */

/** Every unit cell a tiling covers, and the failures if it is not exact. */
function audit(state) {
  const n = state.n;
  const cover = new Map();
  for (const p of state.pieces) {
    if (p.side < 1 || p.side > n) return { error: `bad side ${p.side}` };
    if (p.x < 0 || p.y < 0 || p.x + 2 * p.side > n || p.y + 2 * p.side > n) {
      return { error: `piece outside the board at ${p.x},${p.y}` };
    }
    for (const c of C.pieceCells(p)) {
      const k = c.col + "," + c.row;
      if (cover.has(k)) return { error: `overlap at ${k}` };
      cover.set(k, p);
    }
  }
  if (cover.has(state.hole.col + "," + state.hole.row)) return { error: "the hole is covered" };
  if (cover.size !== n * n - 1) return { error: `covers ${cover.size} of ${n * n - 1} cells` };
  const area = state.pieces.reduce((sum, p) => sum + 3 * p.side * p.side, 0);
  if (area !== n * n - 1) return { error: `piece area ${area}` };
  const largest = Math.max(...state.pieces.map((p) => p.side));
  if (largest !== state.step) return { error: `largest piece ${largest}, step ${state.step}` };
  return { cover, area };
}

{
  let boards = 0;
  for (let exp = C.MIN_EXP; exp <= 4; exp++) {
    const n = 2 ** exp;
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        let s = C.start({ exp, col, row });
        const first = audit(s);
        check(`the opening picture tiles the board: ${n}x${n} (${col},${row})`, !first.error, first.error);
        check(`it has one L per size: ${n}x${n} (${col},${row})`, s.pieces.length === exp);

        const presses = exp - 1; // 2x2 is already one unit L
        for (let i = 0; i < presses; i++) {
          s = C.step(s);
          const a = audit(s);
          check(`step ${i + 1} still tiles: ${n}x${n} (${col},${row})`, !a.error, a.error);
          check(`step ${i + 1} is not done yet: ${n}x${n} (${col},${row})`,
            C.result(s) === null || i === presses - 1);
        }
        check(`done after ${presses} presses: ${n}x${n} (${col},${row})`, C.result(s) === "done");
        equal(`piece count is (4^n-1)/3: ${n}x${n} (${col},${row})`,
          s.pieces.length, (n * n - 1) / 3);
        check(`every piece is a unit L: ${n}x${n} (${col},${row})`,
          s.pieces.every((p) => p.side === 1), JSON.stringify(s.pieces.map((p) => p.side).slice(0, 8)));
        boards++;
      }
    }
  }
  check(`the theorem holds on every hole up to 16x16 (${boards} boards)`, boards === 340);
}

/* ------------------------------------------- 3. the L is a rep-4 tile */

{
  let checked = 0;
  for (const side of [2, 4, 8, 16, 32]) {
    for (let which = 0; which < 4; which++) {
      const parent = { x: 0, y: 0, side, which, color: 5 };
      const children = C.splitPiece(parent);
      check(`a ${side}-L has four children (missing ${which})`, children.length === 4);
      check(`the children are half the side (missing ${which})`, children.every((c) => c.side === side / 2));
      check(`the children take the parent's colour family (missing ${which})`,
        JSON.stringify(children.map((c) => c.color)) === JSON.stringify([5, 6, 0, 1]));
      const parentCells = new Map(C.pieceCells(parent).map((c) => [c.col + "," + c.row, c]));
      const childCells = new Map();
      let bad = "";
      for (const child of children) {
        for (const c of C.pieceCells(child)) {
          const k = c.col + "," + c.row;
          if (childCells.has(k)) bad = `overlap at ${k}`;
          if (!parentCells.has(k)) bad = `outside the parent at ${k}`;
          childCells.set(k, c);
        }
      }
      check(`the four children cover the ${side}-L exactly (missing ${which})`,
        !bad && childCells.size === parentCells.size, bad || `${childCells.size} vs ${parentCells.size}`);
      checked++;
    }
  }
  check(`the rep-4 tiling checked for ${checked} pieces`, checked === 20);
}

/* ------------------------------------------- 4. ranges, moves and restarts */

{
  const s = C.start({ exp: 4, col: 3, row: 5 });
  equal("the default hole is where it was put", s.hole, { col: 3, row: 5 });
  equal("the default board is 2^exp", s.n, 16);
  equal("the opening picture has exp pieces", s.pieces.length, 4);
  equal("the opening step is half the board", s.step, 8);

  check("exp below the range is clamped", C.start({ exp: 0 }).exp === C.MIN_EXP);
  check("exp above the range is clamped", C.start({ exp: 99 }).exp === C.MAX_EXP);
  check("a hole outside the board is clamped", C.start({ exp: 3, col: 99, row: -5 }).hole.col === 7);
  check("a hole above the board is clamped", C.start({ exp: 3, col: 99, row: -5 }).hole.row === 0);

  check("a hole move inside the board works", C.move(s, { type: "hole", col: 0, row: 15 }).hole.col === 0);
  check("a hole move off the board is refused", C.move(s, { type: "hole", col: 16, row: 0 }) === null);
  check("a negative hole is refused", C.move(s, { type: "hole", col: -1, row: 0 }) === null);
  check("an exponent move keeps the hole", C.move(s, { type: "exp", exp: 5 }).hole.row === 5);
  check("an exponent move clamps", C.move(s, { type: "exp", exp: -3 }).exp === C.MIN_EXP);
  check("an exponent move needs a number", C.move(s, { type: "exp", exp: "wide" }) === null);
  check("a reset keeps the hole and returns to the opening", (() => {
    const r = C.move(s, { type: "reset" });
    return r.level === 0 && r.step === 8 && r.hole.row === 5;
  })());
  check("an unknown move is refused", C.move(s, { type: "nonsense" }) === null);
  check("a missing state is refused", C.move(null, { type: "step" }) === null);

  // The applet's Step shrinks by half each press, then the next press restarts.
  let t = C.start({ exp: 3, col: 2, row: 6 });
  const steps = [];
  const counts = [t.pieces.length];
  for (let i = 0; i < 3; i++) {
    t = C.step(t);
    steps.push(t.step);
    counts.push(t.pieces.length);
  }
  equal("step sizes halve: 4, 2, 1, then a restart", steps, [2, 1, 4]);
  equal("piece counts on an 8x8 board: 3, 6, 21, then 3", counts, [3, 6, 21, 3]);
  check("the last press restarted at level 0", t.level === 0 && t.hole.col === 2 && t.hole.row === 6);

  // The 2x2 board: already one L, so the first press restarts, as in the applet.
  const tiny = C.start({ exp: 1, col: 1, row: 0 });
  check("a 2x2 board is already done", C.result(tiny) === "done" && tiny.pieces.length === 1);
  const tinyAgain = C.step(tiny);
  check("One step on 2x2 restarts with the same hole",
    tinyAgain.level === 0 && tinyAgain.step === 1 && tinyAgain.hole.col === 1);

  // Colours come from the parent on each split: parent + 0,1,2,3 mod 7.
  const c = C.start({ exp: 2, col: 0, row: 0, colors: [5, 6] });
  check("the opening colours are the supplied ones",
    JSON.stringify(c.pieces.map((p) => p.color)) === JSON.stringify([5, 6]));
  const split = C.step(c);
  check("the four children wrap the colour at 7",
    JSON.stringify(split.pieces.slice(0, 4).map((p) => p.color)) === JSON.stringify([5, 6, 0, 1]));

  // Two largest boards: the initial picture and the final counts.
  for (const exp of [5, 6, 7]) {
    const n = 2 ** exp;
    let big = C.start({ exp, col: n - 1, row: 0 });
    for (let i = 0; i < exp - 1; i++) big = C.step(big);
    check(`a ${n}x${n} board finishes in ${exp - 1} presses`, C.result(big) === "done");
    equal(`a ${n}x${n} board needs (4^n-1)/3 unit Ls`, big.pieces.length, (n * n - 1) / 3);
  }
  // And the final 32x32 tiling covers every hole cell but one, once.
  let mid = C.start({ exp: 5, col: 17, row: 31 });
  for (let i = 0; i < 4; i++) mid = C.step(mid);
  const a = audit(mid);
  check("a finished 32x32 board is an exact tiling", !a.error, a.error);
  equal("a finished 32x32 board has 341 pieces", mid.pieces.length, 341);

  check("legalMoves offers One step", JSON.stringify(C.legalMoves(s)) === JSON.stringify([{ type: "step" }]));
}

done("tromino-rep-tile");
