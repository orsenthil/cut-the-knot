#!/usr/bin/env node
"use strict";

/*
 * Logic test for deficient-squares/deficient-squares-core.js.
 *
 *   node porting/check-deficient-squares.mjs
 *
 * 1. The core is compared with a second, literal transcription of the
 *    applet's click handling (TrominoPuzzleNCanvas.mouseClicked and
 *    TrominoPuzzleNCanvas$TroBlock.IsConsistent/AddSquare/SetType). Every
 *    ordered triple of clicks is tried on 2x2 and 4x4 boards; every ordered
 *    triple of distinct cells on an 8x8 board is checked for the same L test.
 * 2. Golomb's construction, written out separately, tiles EVERY deficient
 *    square board with side 2, 4, 8 and 16 (336 boards). The core must accept
 *    every piece without overlap or touching the gap, and must report a win
 *    only when the last piece goes down.
 * 3. The page's theorem (Chu-Johnsonbaugh) is checked by brute force: every
 *    deficient board of side 2..7 is searched exhaustively; the core's
 *    tileable() must agree with the search on every gap. The theorem's
 *    classification is then checked by playing a found tiling on the core for
 *    every tileable 5x5 and 7x7 gap, plus an 8x8 board.
 * 4. Rules and edge cases: sizes, the gap, Set blank, Remove last, bad clicks,
 *    the pocket test, and the piece-count formula for every side offered.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("deficient-squares/deficient-squares-core.js", "DeficientSquaresCore");

/* ---------------------------------- 1. the applet's click handling, again */

/** TrominoPuzzleNCanvas$Square, with cell size 1 and X0=Y0=0. */
class AppletSquare {
  constructor(I, J) { this.I = I; this.J = J; }
  Equals(o) { return o && this.I === o.I && this.J === o.J; }
  IsConsistent(o) { return !this.Equals(o) && Math.abs(this.I - o.I) + Math.abs(this.J - o.J) === 1; }
}

/** TrominoPuzzleNCanvas$TroBlock, straight from the bytecode. */
class AppletBlock {
  constructor(s1) { this.S1 = s1; this.S2 = null; this.S3 = null; this.Type = 0; }
  IsConsistent(sq) {
    if (!this.S1) return true;
    if (this.S1.Equals(sq)) return false;
    if (!this.S2) return this.S1.IsConsistent(sq);
    if (this.S3) return false;
    if (!this.S2.IsConsistent(sq)) return false;
    if (this.S1.I === this.S2.I && this.S2.I === sq.I) return false;
    if (this.S1.J === this.S2.J && this.S2.J === sq.J) return false;
    return true;
  }
  AddSquare(sq) {
    if (!this.S2) { this.S2 = sq; return false; }
    if (this.S1.I > sq.I) { this.S3 = this.S1; this.S1 = sq; }
    else { this.S3 = sq; }
    this.SetType();
    return true;
  }
  SetType() {
    if (this.S1.I === this.S2.I) this.Type = this.S1.J === this.S2.J + 1 ? 0 : 1;
    else this.Type = this.S2.J === this.S3.J + 1 ? 2 : 3;
  }
}

/**
 * TrominoPuzzleNCanvas.mouseClicked for one click, with a gap and an empty
 * board. Returns { block, placed } where placed is the finished block.
 */
function appletClick(state, block, sq) {
  if (sq.I < 0 || sq.I >= state.n || sq.J < 0 || sq.J >= state.n) return { block: null, placed: null };
  if (sq.I === state.blank.row && sq.J === state.blank.col) return { block: null, placed: null };
  if (state.mode === "blank") return { block, placed: null };
  if (block === null) block = new AppletBlock(sq);
  else {
    if (!block.IsConsistent(sq)) return { block: null, placed: null };
    if (block.AddSquare(sq)) return { block: null, placed: block };
  }
  return { block, placed: null };
}

const cellSet = (cells) => cells.map((c) => `${c.row ?? c.I},${c.col ?? c.J}`).sort().join(" ");

{
  // Every ordered triple of clicks on 2x2 and 4x4 boards.
  for (const n of [2, 4]) {
    const s0 = C.start({ n, blank: { row: 0, col: 0 } });
    for (let a = 0; a < n * n; a++) {
      for (let b = 0; b < n * n; b++) {
        for (let c = 0; c < n * n; c++) {
          const cells = [a, b, c].map((k) => ({ row: Math.floor(k / n), col: k % n }));
          let block = null;
          let placed = null;
          for (const sq of cells) {
            const r = appletClick(s0, block, new AppletSquare(sq.row, sq.col));
            block = r.block;
            if (r.placed) placed = r.placed;
          }
          let s = s0;
          for (const sq of cells) s = C.click(s, sq.row, sq.col).state;
          const corePiece = s.pieces.length === 1 ? s.pieces[0] : null;
          check(`n ${n}: applet and core agree on clicks ` + a + "," + b + "," + c,
            (placed !== null) === (corePiece !== null) &&
            (placed === null || cellSet(corePiece.cells) === cellSet([placed.S1, placed.S2, placed.S3])),
            JSON.stringify(cells));
          if (placed) {
            // The applet's Type is the core's orientation turned by two.
            equal(`n ${n}: orientation of ${a},${b},${c}`, corePiece.type, (placed.Type + 2) % 4);
          }
        }
      }
    }
  }
}

{
  // Every ordered triple of distinct cells on an 8x8 board: the same L test.
  const n = 8;
  let lPaths = 0;
  for (let a = 0; a < n * n; a++) {
    for (let b = 0; b < n * n; b++) {
      if (b === a) continue;
      for (let c = 0; c < n * n; c++) {
        if (c === a || c === b) continue;
        const cells = [a, b, c].map((k) => ({ row: Math.floor(k / n), col: k % n }));
        const block = new AppletBlock(new AppletSquare(cells[0].row, cells[0].col));
        const okSecond = block.IsConsistent(new AppletSquare(cells[1].row, cells[1].col));
        check("8x8: second click adjacency " + a + "," + b,
          okSecond ===
          (Math.abs(cells[0].row - cells[1].row) + Math.abs(cells[0].col - cells[1].col) === 1));
        if (okSecond) {
          block.AddSquare(new AppletSquare(cells[1].row, cells[1].col));
          const okApplet = block.IsConsistent(new AppletSquare(cells[2].row, cells[2].col));
          const okCore = C.isLPath(cells);
          if (okApplet) lPaths++;
          check("8x8: the L test agrees on " + a + "," + b + "," + c, okApplet === okCore);
        }
      }
    }
  }
  check("8x8: all 392 L click paths were found", lPaths === 392, String(lPaths));
}

/* ------------------------------- 2. Golomb's construction on 2, 4, 8, 16 */

/**
 * The induction, written independently of the core's click code: split the
 * board into quarters, put one L round the centre covering the three quarters
 * without the gap, then repeat in each quarter.
 */
function golombTiling(n, blank) {
  if (n === 1) return [];
  const h = n / 2;
  const pieces = [];
  const quadrant = (r, c) => (r < h ? (c < h ? 0 : 1) : (c < h ? 3 : 2)); // UL,UR,LR,LL
  const holeQ = quadrant(blank.row, blank.col);
  const centre = [
    { q: 0, row: h - 1, col: h - 1 },
    { q: 1, row: h - 1, col: h },
    { q: 2, row: h, col: h },
    { q: 3, row: h, col: h - 1 },
  ];
  const around = centre.filter((c) => c.q !== holeQ).map(({ row, col }) => ({ row, col }));
  pieces.push({ cells: around, type: C.orientation(around) });

  const quarters = [
    { r: 0, c: 0, q: 0 },
    { r: 0, c: h, q: 1 },
    { r: h, c: h, q: 2 },
    { r: h, c: 0, q: 3 },
  ];
  for (const q of quarters) {
    const localBlank = q.q === holeQ
      ? { row: blank.row - q.r, col: blank.col - q.c }
      : (() => {
          const used = centre.find((c) => c.q === q.q);
          return { row: used.row - q.r, col: used.col - q.c };
        })();
    for (const p of golombTiling(h, localBlank)) {
      pieces.push({
        cells: p.cells.map((c) => ({ row: c.row + q.r, col: c.col + q.c })),
        type: p.type,
      });
    }
  }
  return pieces;
}

{
  let boards = 0;
  let piecesChecked = 0;
  for (const n of [2, 4, 8, 16]) {
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        boards++;
        let s = C.start({ n, blank: { row: r, col } });
        const pieces = golombTiling(n, { row: r, col });
        equal(`board ${n} gap ${r},${col}: piece count`, pieces.length, (n * n - 1) / 3);
        for (let i = 0; i < pieces.length; i++) {
          const p = pieces[i];
          piecesChecked++;
          check(`board ${n} gap ${r},${col}: construction piece ${i} is an L`, C.orientation(p.cells) === p.type);
          const next = C.place(s, p.cells);
          check(`board ${n} gap ${r},${col}: piece ${i} fits`, next !== null);
          if (!next) break;
          s = next;
          if (i < pieces.length - 1) {
            check(`board ${n} gap ${r},${col}: no early win at piece ${i}`, C.result(s) === null);
          }
        }
        check(`board ${n} gap ${r},${col}: the tiling wins`, C.result(s) === "win");
        check(`board ${n} gap ${r},${col}: every free cell is covered`, C.coveredCount(s) === n * n - 1);
        check(`board ${n} gap ${r},${col}: no room left`, C.canPlace(s) === false);
      }
    }
  }
  check("every power-of-two board up to 16x16 was tiled", boards === 340, String(boards));
  check("thousands of pieces were placed", piecesChecked > 10000, String(piecesChecked));
}

/* --------------------- 3. the theorem, checked by brute-force search */

/**
 * Find one tiling of a deficient board by backtracking on the first free cell,
 * or null when there is none. Independent of the core.
 */
function findTiling(n, blank) {
  const free = new Set();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) free.add(r + "," + c);
  free.delete(blank.row + "," + blank.col);
  const shapes = [
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0]],
  ];
  function rec() {
    if (free.size === 0) return [];
    let first = null;
    for (let r = 0; r < n && !first; r++) {
      for (let c = 0; c < n && !first; c++) if (free.has(r + "," + c)) first = { r, c };
    }
    const seen = new Set();
    for (let br = first.r - 1; br <= first.r; br++) {
      for (let bc = first.c - 1; bc <= first.c; bc++) {
        for (const shape of shapes) {
          const cells = shape.map(([dr, dc]) => [br + dr, bc + dc]);
          if (!cells.some(([r, c]) => r === first.r && c === first.c)) continue;
          if (!cells.every(([r, c]) => r >= 0 && r < n && c >= 0 && c < n && free.has(r + "," + c))) continue;
          const id = cells.map(([r, c]) => r + "," + c).sort().join("|");
          if (seen.has(id)) continue;
          seen.add(id);
          for (const [r, c] of cells) free.delete(r + "," + c);
          const rest = rec();
          for (const [r, c] of cells) free.add(r + "," + c);
          if (rest) return [{ cells: cells.map(([r, c]) => ({ row: r, col: c })) }].concat(rest);
        }
      }
    }
    return null;
  }
  return rec();
}

{
  let compared = 0;
  let tilingsPlayed = 0;
  for (const n of [2, 3, 4, 5, 6, 7]) {
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        compared++;
        const tiling = findTiling(n, { row: r, col: c });
        const possible = tiling !== null;
        equal(`side ${n} gap ${r},${c}: tileable() matches the search`, C.tileable(n, { row: r, col: c }), possible);
        if (!possible) {
          const s = C.start({ n, blank: { row: r, col: c } });
          check(`side ${n} gap ${r},${c}: a fresh impossible board is not won`,
            C.result(s) === null && C.tileable(n, { row: r, col: c }) === false);
          continue;
        }
        tilingsPlayed++;
        equal(`side ${n} gap ${r},${c}: the search found the right number of pieces`,
          tiling.length, (n * n - 1) / 3);
        let s = C.start({ n, blank: { row: r, col: c } });
        for (let i = 0; i < tiling.length; i++) {
          const next = C.place(s, tiling[i].cells);
          check(`side ${n} gap ${r},${c}: searched piece ${i} fits`, next !== null);
          if (!next) break;
          s = next;
          if (i < tiling.length - 1) {
            check(`side ${n} gap ${r},${c}: no early win at piece ${i}`, C.result(s) === null);
          }
        }
        check(`side ${n} gap ${r},${c}: the searched tiling wins`, C.result(s) === "win");
        check(`side ${n} gap ${r},${c}: no room left`, C.canPlace(s) === false);
      }
    }
  }
  check("every board of side 2..7 was searched", compared === 4 + 9 + 16 + 25 + 36 + 49, String(compared));
  check("many found tilings were played on the core", tilingsPlayed > 70, String(tilingsPlayed));

  // An 8x8 board found by search, to exercise a bigger even side.
  const big = findTiling(8, { row: 3, col: 6 });
  check("an 8x8 board with a found gap can be tiled", big !== null && big.length === 21);
  let s8 = C.start({ n: 8, blank: { row: 3, col: 6 } });
  for (const p of big || []) s8 = C.place(s8, p.cells);
  check("the searched 8x8 tiling wins", C.result(s8) === "win");
}

{
  // The page's exceptional 5x5 case: exactly the four corners and the centre.
  let good = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const yes = C.tileable(5, { row: r, col: c });
      check(`5x5 gap ${r},${c}: only even/even gaps tile`, yes === (r % 2 === 0 && c % 2 === 0));
      if (yes) good++;
    }
  }
  check("the 5x5 board has nine working gaps", good === 9, String(good));
}

/* ------------------------------------------------- 4. rules and edge cases */

{
  const s = C.start({ n: 4, blank: { row: 1, col: 2 } });
  equal("a fresh 4x4 board", [s.n, s.blank.row, s.blank.col, s.pieces.length, C.result(s)], [4, 1, 2, 0, null]);
  check("the default side is 5", C.start({}).n === 5);
  check("the side range is 2..24", [C.start({ n: 0 }).n, C.start({ n: 99 }).n].join(",") === "2,24");
  check("a fresh board has room", C.canPlace(s) === true);
  check("an 18x18 board cannot be tiled", C.tileable(18, { row: 0, col: 0 }) === false);
  check("a 24x24 board needs no pieces", C.piecesNeeded(24) === null);
}

{
  // The three-click rule, one step at a time on a 4x4 board.
  const s0 = C.start({ n: 4, blank: { row: 0, col: 0 } });
  let r = C.click(s0, 0, 1);
  equal("first click starts a piece", [r.effect, r.state.pending.length, r.state.pieces.length], ["started", 1, 0]);
  r = C.click(r.state, 2, 1);
  equal("a far second click cancels it", [r.effect, r.state.pending.length], ["cancelled", 0]);
  r = C.click(r.state, 0, 1);
  r = C.click(r.state, 0, 2);
  equal("an adjacent second click extends", [r.effect, r.state.pending.length], ["extended", 2]);
  r = C.click(r.state, 1, 0);
  equal("a third click not touching the second cancels", [r.effect, r.state.pending.length], ["cancelled", 0]);
  r = C.click(r.state, 0, 1);
  r = C.click(r.state, 1, 1);
  r = C.click(r.state, 1, 2);
  equal("three clicks in an L place a piece", [r.effect, r.state.pieces.length, r.state.pieces[0].type], ["placed", 1, C.UR]);
}

{
  // Clicks that must do nothing.
  const s = C.start({ n: 4, blank: { row: 0, col: 0 } });
  equal("outside click", C.click(s, -1, 0).effect, "ignored");
  equal("click on the gap", C.click(s, 0, 0).effect, "ignored");
  const placed = C.place(s, [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }]);
  equal("click on a covered square", C.click(placed, 0, 1).effect, "ignored");
  check("a covered square is not free", C.isFree(placed, 0, 1) === false);
  check("the gap is not free", C.isFree(s, 0, 0) === false);
}

{
  // Illegal pieces and undo.
  const s = C.start({ n: 4, blank: { row: 0, col: 0 } });
  const straight = [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }];
  check("a straight tromino is refused", C.place(s, straight) === null);
  check("a diagonal piece is refused", C.place(s, [{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 2 }]) === null);
  check("a piece over the gap is refused", C.place(s, [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }]) === null);
  check("an off-board piece is refused", C.place(s, [{ row: 3, col: 3 }, { row: 3, col: 4 }, { row: 2, col: 4 }]) === null);
  const one = C.place(s, [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }]);
  const two = C.place(one, [{ row: 1, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 2 }]);
  equal("Remove last drops one piece", C.removeLast(two).pieces.length, 1);
  check("Remove last on an empty board is refused", C.removeLast(s) === null);
}

{
  // Set blank mode: entering clears the board, as the applet does.
  let s = C.start({ n: 4, blank: { row: 0, col: 0 } });
  s = C.place(s, [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }]);
  s = C.setMode(s, "blank");
  equal("Set blank clears the board", [s.pieces.length, s.mode], [0, "blank"]);
  s = C.click(s, 2, 3).state;
  equal("a click moves the gap", [s.blank.row, s.blank.col], [2, 3]);
  s = C.setMode(s, "play");
  equal("Play keeps the chosen gap", [s.mode, s.blank.row, s.blank.col], ["play", 2, 3]);
  equal("Set blank refuses a cell off the board", C.setBlank(s, 4, 0), null);
}

{
  // The pocket test agrees with a brute-force search over every piece.
  function bruteCanPlace(state) {
    const free = (r, c) => C.isFree(state, r, c);
    for (let r = 0; r < state.n; r++) {
      for (let c = 0; c < state.n; c++) {
        if (!free(r, c)) continue;
        const around = [[0, 1], [1, 0], [-1, 0], [0, -1]];
        const opposite = (i, j) => (i === 0 && j === 3) || (i === 3 && j === 0) || (i === 1 && j === 2) || (i === 2 && j === 1);
        for (let i = 0; i < 4; i++) {
          for (let j = i + 1; j < 4; j++) {
            if (opposite(i, j)) continue;
            const a = around[i], b = around[j];
            if (free(r + a[0], c + a[1]) && free(r + b[0], c + b[1])) return true;
          }
        }
      }
    }
    return false;
  }
  let seed = 11;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let compared = 0;
  for (let trial = 0; trial < 300; trial++) {
    let s = C.start({ n: 7, blank: { row: Math.floor(rand() * 7), col: Math.floor(rand() * 7) } });
    const target = Math.floor(rand() * 12);
    for (let i = 0; i < target; i++) {
      const free = [];
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (C.isFree(s, r, c)) free.push({ row: r, col: c });
      if (!free.length) break;
      const corner = free[Math.floor(rand() * free.length)];
      const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
      const opposite = (i, j) => (i === 0 && j === 3) || (i === 3 && j === 0) || (i === 1 && j === 2) || (i === 2 && j === 1);
      let placed = false;
      for (let i = 0; i < 4 && !placed; i++) {
        for (let j = i + 1; j < 4 && !placed; j++) {
          if (opposite(i, j)) continue;
          const a = { row: corner.row + dirs[i][0], col: corner.col + dirs[i][1] };
          const b = { row: corner.row + dirs[j][0], col: corner.col + dirs[j][1] };
          if (C.isFree(s, a.row, a.col) && C.isFree(s, b.row, b.col)) {
            const next = C.place(s, [a, corner, b]);
            if (next) { s = next; placed = true; }
          }
        }
      }
      if (!placed) break;
    }
    compared++;
    check("pocket test matches brute force", C.canPlace(s) === bruteCanPlace(s));
  }
  check("pocket test was compared often", compared === 300, String(compared));
}

{
  // The piece count, for every board the panel offers.
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    const needed = C.piecesNeeded(n);
    if ((n * n - 1) % 3 !== 0) {
      check(`side ${n}: no whole number of pieces`, needed === null);
    } else {
      check(`side ${n}: (n^2-1)/3 is the piece count`, needed === (n * n - 1) / 3);
      const s = C.start({ n, blank: { row: n - 1, col: n - 1 } });
      check(`side ${n}: starts with no win`, C.result(s) === null);
    }
  }
}

done("deficient-squares");
