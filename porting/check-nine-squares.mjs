#!/usr/bin/env node
"use strict";

/*
 * Logic test for nine-squares/nine-squares-core.js.
 *
 *   node porting/check-nine-squares.mjs
 *
 * The nine sides for each a, the black and the two red squares that never
 * change, the layout compared with a second, closed-form placement of every
 * square; the page's argument (the top row and the bottom row have the same
 * width, so c = 4); and the claim that a = 9 gives a rectangle of nine
 * different squares with no gaps (33 by 32): over a = 3..15 and then up to
 * 500, a = 9 is the only a where the squares fit together exactly.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("nine-squares/nine-squares-core.js", "NineSquaresCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("starts at the applet's default (spinner 4)", s, { a: 4 });
  equal("a is kept in 3..15", [C.setA(s, 0).a, C.setA(s, 9).a, C.setA(s, 99).a, C.setA(s, 7.6).a, C.setA(s, "x")], [3, 9, 15, 8, null]);
  equal("the nine sides at a = 9 are 1, 9, 10, 14, 18, 8, 4, 7, 15", C.sides({ a: 9 }), [1, 9, 10, 14, 18, 8, 4, 7, 15]);
  equal("the squares have the page's labels in order", C.squares({ a: 9 }).map((q) => q.label), ["1", "a", "a + 1", "a + 5", "a + 9", "a − 1", "4", "a − 2", "15"]);
  let fixed = true;
  for (let a = 3; a <= 15; a++) { const q = C.squares({ a }); if (q[0].side !== 1 || q[6].side !== 4 || q[8].side !== 15) fixed = false; }
  check("the black square is always 1 and the red ones always 4 and 15", fixed);
  let moves = true;
  for (let a = 3; a < 15; a++) { const p = C.sides({ a }), q = C.sides({ a: a + 1 }); [1, 2, 3, 4, 5, 7].forEach((i) => { if (q[i] !== p[i] + 1) moves = false; }); }
  check("the other six squares (indices 1-5 and 7) each grow by 1 when a grows by 1", moves);
  equal("the old position is not changed", C.setA(s, 12), { a: 12 }) ;
  equal("setA leaves the old position alone", s, { a: 4 });
}

/* ------------------------- 2. the layout is the same as a closed-form placement */
{
  // For each square, its upper-left corner and side as functions of A = a + 1 (the applet's variable)
  // with the black square at the origin and y pointing down. Worked out from Compute().
  const closed = (a) => {
    const A = a + 1;
    return [
      [0, 0, 1],                    // black
      [0, -(A - 1), A - 1],         // blue, above the black square
      [-A, -(A - 1), A],            // left of the blue
      [-2 * A - 4, -(A - 1), A + 4], // left again
      [-2 * A - 4, 5, A + 8],       // under that
      [1, 0, A - 2],                // right of the black, under the blue
      [-A, 1, 4],                   // red 4 under the third
      [-A + 4, 1, A - 3],           // next to it
      [-A + 4, A - 2, 15],          // red 15 under that
    ];
  };
  let ok = true, bad = "";
  for (let a = 3; a <= 60; a++) {
    const q = C.squares({ a }).map((s) => [s.x, s.y, s.side]);
    if (JSON.stringify(q) !== JSON.stringify(closed(a))) { ok = false; bad = `a=${a}`; }
  }
  check("every square's corner and side agree with the closed-form placement, a = 3..60", ok, bad);
}

/* ------------------------------------- 3. the page's argument: c = 4, for every a */
{
  // top row: a + (a + 1) + (a + 1 + c); bottom row: (a + 1 + 2c) + (a - 2) + (a - 1)
  let ok = true;
  for (let a = 3; a <= 500; a++) for (let c = -20; c <= 20; c++) {
    const top = a + (a + 1) + (a + 1 + c), bottom = (a + 1 + 2 * c) + (a - 2) + (a - 1);
    if ((top === bottom) !== (c === 4)) ok = false;
  }
  check("top row = bottom row only when c = 4, for every a from 3 to 500", ok);
  // in the picture: the top row of three squares and the bottom row of three squares at a = 9 are both 33 wide
  const q = C.squares({ a: 9 });
  equal("at a = 9 the top three squares (9, 10, 14) have total width 33", q[1].side + q[2].side + q[3].side + 0, 33);
  // the page's bottom row: a + 1 + 2c = 18, a - 2 = 7, a - 1 = 8: the same 33 (the sides, not the picture's position)
  equal("and the three of the bottom (18, 7, 8) have total width 33", q[4].side + q[7].side + q[5].side, 33);
  // the second constant: 15. The page says it can be checked the same way: the right column heights
  let h = true;
  for (let a = 3; a <= 200; a++) {
    const b = C.bounds({ a });
    // top-to-bottom through the left column: (a + 5) + (a + 9) is the height whatever the 15 is, and the
    // right edge is a - ... the red 15 sits under a - 2 and its top is a - 1 below the top of the blue square's bottom
    const left = C.squares({ a });
    if (left[3].side + left[4].side !== 2 * a + 14) h = false;
    if (b.height < 0) h = false;
  }
  check("the left column (a + 5) + (a + 9) = 2a + 14 tall, for every a", h);
}

/* --------------------------------------- 4. only a = 9 gives a perfect rectangle */
{
  const tilingAs = [];
  for (let a = 3; a <= 500; a++) if (C.tiles({ a })) tilingAs.push(a);
  equal("the squares fit together exactly (no gaps, no overlap) only at a = 9, for a = 3..500", tilingAs, [9]);
  const d = C.describe({ a: 9 });
  equal("at a = 9: a 33 by 32 rectangle, no overlaps, no gap, nine different sides", [d.width, d.height, d.overlaps, d.gap, d.tiles, d.distinct], [33, 32, 0, 0, true, true]);
  equal("the area is 33 x 32 = 1056", C.totalArea({ a: 9 }), 1056);
  // every cell of the 33 x 32 rectangle is covered exactly once at a = 9
  const b = C.bounds({ a: 9 }), cover = new Map();
  for (const s of C.squares({ a: 9 })) for (let x = s.x; x < s.x + s.side; x++) for (let y = s.y; y < s.y + s.side; y++) cover.set(`${x},${y}`, (cover.get(`${x},${y}`) || 0) + 1);
  let once = cover.size === 33 * 32;
  for (const v of cover.values()) if (v !== 1) once = false;
  check("every one of the 33 x 32 unit cells is covered by exactly one square", once);
  equal("the bounds at a = 9 start at the left and the top of the picture", [b.left, b.top, b.right, b.bottom], [-24, -9, 9, 23]);
  // elsewhere something is wrong: either overlap or a gap
  let bad = 0;
  for (let a = 3; a <= 15; a++) if (a !== 9) { const e = C.describe({ a }); if (e.overlaps === 0 && e.gap === 0) bad++; }
  equal("for each other a from 3 to 15 there is an overlap or a gap", bad, 0);
  // the page lists the sides as a + 1 + 2c = 18 etc.; with different a no side is repeated at a = 9 (so the squares are unequal)
  // and the all-different sides are 1, 4, 7, 8, 9, 10, 14, 15, 18: the classic list for the 32 x 33 rectangle
  equal("the sides sorted: 1 4 7 8 9 10 14 15 18", C.sides({ a: 9 }).slice().sort((x, y) => x - y), [1, 4, 7, 8, 9, 10, 14, 15, 18]);
  equal("the sum of the areas is 1056 = 1+16+49+64+81+100+196+225+324", [1, 4, 7, 8, 9, 10, 14, 15, 18].reduce((t, s) => t + s * s, 0), 1056);
}

done("nine-squares");
