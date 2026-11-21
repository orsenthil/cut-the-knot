#!/usr/bin/env node
"use strict";

/*
 * Logic test for integer-rectangle/integer-rectangle-core.js.
 *
 *   1. The area integral on known rectangles and the two sufficient conditions.
 *   2. The page's "if and only if", checked exhaustively on a fine quarter-grid
 *      of positions and sizes: computed balance matches the rule everywhere.
 *   3. The three-piece decomposition covers the rectangle, and its even-sided
 *      pieces balance. A scaled chessboard checks the tiling corollary.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("integer-rectangle/integer-rectangle-core.js", "IntegerRectangleCore");

{
  const s = C.start();
  equal("board side", C.BOARD, 8);
  equal("default width", s.w, 2.5);
  equal("position clamped to board", C.set(s, "x", 99).x, 5.5);
  equal("size clamped to board", C.set(s, "w", 99).w, 7.5);
  equal("size has a minimum", C.set(s, "w", 0).w, 0.25);

  const whole = C.areas({ x: 0, y: 0, w: 2, h: 2 });
  equal("a 2 by 2 block balances", whole.balanced, true);
  equal("a 2 by 2 block has total area 4", whole.total, 4);
  const odd = C.areas({ x: 0.25, y: 0.25, w: 1, h: 1 });
  equal("an odd square does not balance", odd.balanced, false);
  equal("an odd square still has area 1", odd.total, 1);
  check("even width is recognised", C.evenSide(4));
  check("odd width is not", !C.evenSide(3));
  check("a centre on a vertical grid line is recognised", C.centerOnGridLine({ x: 0.25, y: 0.1, w: 1.5, h: 1.3 }));
  check("a centre on no grid line is not", !C.centerOnGridLine({ x: 0.25, y: 0.25, w: 1, h: 1 }));
  for (const w of [1, 1.25, 2.5, 2.75, 3.5]) {
    const centered = C.centerX({ x: 0.25, y: 0.25, w, h: 1 });
    check(`centering a rectangle of width ${w} balances it`,
      C.centerOnGridLine(centered) && C.areas(centered).balanced);
  }
}

{
  let cases = 0;
  let agrees = 0;
  const quarters = (n) => Array.from({ length: n }, (_, i) => i / 4);
  for (const x of quarters(8)) {
    for (const y of quarters(8)) {
      for (const w of quarters(18).map((v) => v + 0.25)) {
        for (const h of quarters(18).map((v) => v + 0.25)) {
          const rect = { x, y, w, h };
          const computed = C.areas(rect).balanced;
          cases++;
          if (computed === C.balancedByRule(rect)) agrees++;
        }
      }
    }
  }
  equal("all positions and sizes checked", cases, 8 * 8 * 18 * 18);
  equal("the rule matches the computed areas everywhere", agrees, cases);
}

{
  let covered = 0;
  let piecesOk = 0;
  let evenBalanced = 0;
  let smallOk = 0;
  let cases = 0;
  for (let x = 0; x <= 2; x += 0.5) {
    for (let y = 0; y <= 2; y += 0.5) {
      for (let w = 0.25; w <= 5; w += 0.25) {
        for (let h = 0.25; h <= 5; h += 0.25) {
          const rect = { x, y, w, h };
          const pieces = C.decompose(rect);
          const total = pieces.reduce((sum, p) => sum + p.w * p.h, 0);
          cases++;
          if (pieces.length <= 3) piecesOk++;
          if (Math.abs(total - w * h) < 1e-7) covered++;
          let ok = true;
          let small = true;
          for (const p of pieces) {
            if ((C.evenSide(p.w) || C.evenSide(p.h)) && !C.areas(p).balanced) ok = false;
            if (p.kind === "both sides < 2" && !(p.w < 2 && p.h < 2)) small = false;
          }
          if (ok) evenBalanced++;
          if (small) smallOk++;
        }
      }
    }
  }
  equal("all decompositions were tried", cases, 10000);
  equal("at most three pieces", piecesOk, cases);
  equal("the pieces cover the original area", covered, cases);
  equal("even-sided pieces balance", evenBalanced, cases);
  equal("the last piece has both sides under two", smallOk, cases);
}

{
  // Corollary: with squares of side 1/2, a tile with an integer side has an
  // even side on the finer grid, so each tile balances. Areas add, so the
  // ambient rectangle balances too — hence it has an integer side.
  const tiles = [
    { x: 0, y: 0, w: 1, h: 3 },   // 1 by 3
    { x: 1, y: 0, w: 2, h: 3 },   // 2 by 3
  ];
  const scale = (r) => ({ x: 2 * r.x, y: 2 * r.y, w: 2 * r.w, h: 2 * r.h });
  const scaled = tiles.map(scale);
  const ambient = { x: 0, y: 0, w: 6, h: 6 };
  let sums = 0;
  for (const t of scaled) sums += C.areas(t).light;
  const whole = C.areas(ambient);
  check("every scaled tile has an even side", scaled.every((t) => C.evenSide(t.w) || C.evenSide(t.h)));
  check("the scaled tiles balance", scaled.every((t) => C.areas(t).balanced));
  check("their light areas add to the whole", Math.abs(sums - whole.light) < 1e-7);
  check("the ambient rectangle balances and has an even side", whole.balanced && C.evenSide(ambient.w));
}

done("integer-rectangle");
