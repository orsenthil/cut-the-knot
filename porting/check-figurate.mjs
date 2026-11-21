#!/usr/bin/env node
"use strict";

/*
 * Logic test for figurate/figurate-core.js.
 *
 *   node porting/check-figurate.mjs
 *
 * The page's four identities are summed from the cells themselves, never from the formula: for
 * EVERY n up to the applet's 14 and for every n up to 300 in a larger table,
 *   (1) the n by n corner sums to (1 + ... + n)^2 = [n(n+1)/2]^2,
 *   (2) the nth row and column together (the diagonal counted once) sum to n^3 = 2n(1 + ... + n) - n^2,
 *   (3) the diagonal sums to 1^2 + ... + n^2 = n(n+1)(2n+1)/6,
 *   (4) the anti-diagonal sums to n*1 + (n-1)*2 + ... + 1*n = n(n+1)(n+2)/6;
 * and the page's reasoning is followed too: the rows of the corner sum to k * n(n+1)/2, and the
 * gnomon is the row n plus the column n minus the corner n^2. The hover rule (which n a cell
 * picks) is checked for every cell of the 14 by 14 table in each mode.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("figurate/figurate-core.js", "FigurateCore");

{
  const s = C.start({});
  check("the applet opens on Triangular squares with no cell chosen", s.mode === "triangular-squares" && s.n === 0 && C.result(s) === null);
  check("the table runs to 14", C.SIZE === 14 && C.move(s, { type: "n", value: 15 }) === null && C.move(s, { type: "n", value: 14 }).n === 14 && C.move(s, { type: "n", value: -1 }) === null);
  check("hovering a cell chooses n and counts as exploring", C.move(s, { type: "hover", col: 3, row: 5 }).n === 5 && C.result(C.move(s, { type: "hover", col: 3, row: 5 })) === "done" && C.result(C.move(s, { type: "hover", col: 0, row: 5 })) === null);
  check("hovering outside the table chooses nothing", C.hoverIndex("cubes", 15, 3) === 0 && C.hoverIndex("cubes", 3, 0) === 0 && C.hoverIndex("tetrahedral", 14, 14) === 0);
  check("the four modes", C.move(s, { type: "mode", value: "cubes" }).mode === "cubes" && C.move(s, { type: "mode", value: "bogus" }) === null && C.MODES.length === 4);
  check("the old position is untouched", s.n === 0 && s.moves === 0);
  check("the page's example: the 4 by 4 corner sums to (1+2+3+4)^2 = 100 and the gnomon of 4 to 64", C.identity("triangular-squares", 4).sum === 100 && C.identity("cubes", 4).sum === 64);
}

{
  let bad = null, n = 0;
  const T = (k) => (k * (k + 1)) / 2;
  for (let k = 1; k <= 300; k++) {
    const a = C.identity("triangular-squares", k), b = C.identity("cubes", k), c = C.identity("squares", k), d = C.identity("tetrahedral", k);
    if (a.sum !== T(k) ** 2 || !a.holds) bad = `(1) at ${k}`;
    if (b.sum !== k ** 3 || b.sum !== 2 * k * T(k) - k * k || !b.holds) bad = `(2) at ${k}`;
    if (c.sum !== (k * (k + 1) * (2 * k + 1)) / 6 || !c.holds) bad = `(3) at ${k}`;
    if (d.sum !== (k * (k + 1) * (k + 2)) / 6 || !d.holds) bad = `(4) at ${k}`;
    // the page's reasoning for (1): row r of the corner sums to r * n(n+1)/2
    for (let r = 1; r <= k; r++) if (C.cells("triangular-squares", k).filter(([, rr]) => rr === r).reduce((s, [cc, rr]) => s + cc * rr, 0) !== r * T(k)) bad = `row ${r} of (1) at ${k}`;
    // (2): the nth row plus the nth column minus the corner n^2
    const rowSum = [...Array(k)].reduce((s, _, i) => s + (i + 1) * k, 0);
    if (b.sum !== 2 * rowSum - k * k) bad = `gnomon at ${k}`;
    if (b.cells.length !== 2 * k - 1 || new Set(b.cells.map((x) => x.join())).size !== 2 * k - 1) bad = `gnomon cells at ${k}`;
    if (d.cells.some(([cc, rr]) => cc + rr !== k + 1) || d.cells.length !== k) bad = `anti-diagonal cells at ${k}`;
    n++;
  }
  check(`all four identities hold for every n from 1 to 300, summed from the lit cells (${n} values of n)`, bad === null, String(bad));
  let ok = true;
  for (const mode of C.MODES) for (let col = 1; col <= 14; col++) for (let row = 1; row <= 14; row++) {
    const h = C.hoverIndex(mode, col, row);
    if (mode === "tetrahedral") { if (h !== (col + row - 1 <= 14 ? col + row - 1 : 0)) ok = false; if (h > 0 && !C.cells(mode, h).some(([x, y]) => x === col && y === row)) ok = false; }
    else { if (h !== Math.max(col, row)) ok = false; if (!C.cells(mode, h).some(([x, y]) => x === col && y === row) && mode !== "squares") ok = false; }
  }
  check("the cell under the pointer is always among the lit cells (Triangular squares, Cubes, Tetrahedral: every cell of the 14 x 14 table); for Squares n = max(column, row)", ok);
  check("the formulas' text is written the way the applet writes them", C.identity("tetrahedral", 5).text.includes("5·(5 + 1)·(5 + 2)/6 = 35") && C.identity("squares", 4).text.includes("= 30") && C.identity("triangular-squares", 3).text.includes("= 36"));
}

done("figurate");
