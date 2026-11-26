#!/usr/bin/env node
"use strict";

/*
 * Logic test for tromino-monomino/tromino-monomino-core.js.
 *
 *   node porting/check-tromino-monomino.mjs
 *
 * 1. Every straight tromino covers one square of each colour in both of
 *    Golomb's colourings; on 8 x 8 one colour class has 22 squares.
 * 2. The page's answers by exhaustive search (a full covering tried for
 *    every place of the monomino): 8 x 8 allows exactly c3, c6, f3, f6;
 *    7 x 7 exactly the 9 squares with both coordinates 0 mod 3; and on every
 *    square board 4, 5, 7, 8, 10 the monomino fits exactly where the
 *    colourings balance.
 * 3. N x M boards with NM = 2 mod 3 need two monominoes: on 4 x 5 and 5 x 7
 *    some pairs work and many do not. Every pair that works balances both
 *    colourings, but here balance is not enough: a few balanced pairs fail
 *    (on 4 x 5, the squares b4 and d4).
 * 4. The applet's moves: two squares two apart in a row or column, no
 *    overlap (not even on a tromino's middle square), Remove last, finish.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("tromino-monomino/tromino-monomino-core.js", "TrominoMonominoCore");

{
  let all = true;
  for (let i = 0; i < 20; i++) for (let j = 0; j < 18; j++) for (const p of [[i, j, i, j + 2], [i, j, i + 2, j]]) {
    const cs = C.cells(p);
    const a = new Set(cs.map(([x, y]) => C.colourA(x, y))), b = new Set(cs.map(([x, y]) => C.colourB(x, y)));
    if (a.size !== 3 || b.size !== 3) all = false;
  }
  check("every straight tromino covers all three colours of both colourings", all);
  const cnt = [0, 0, 0];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) cnt[C.colourA(i, j)]++;
  equal("on 8 x 8 the colour classes have 21, 22 and 21 squares", cnt.join(" "), "21 22 21");
}

const fits = (n, m) => {
  const out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if (C.cover(n, m, [[i, j]])) out.push([i, j]);
  return out;
};
{
  const s8 = C.start();
  equal("8 x 8: the monomino fits only at c3, c6, f3, f6", fits(8, 8).map(([i, j]) => C.name(s8, i, j)).sort().join(" "), "c3 c6 f3 f6");
  const f7 = fits(7, 7);
  check("7 x 7: exactly 9 places, both coordinates 0, 3 or 6", f7.length === 9 && f7.every(([i, j]) => i % 3 === 0 && j % 3 === 0));
  let same = true;
  for (const n of [4, 5, 7, 8, 10]) {
    const f = new Set(fits(n, n).map(([i, j]) => i * n + j));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (f.has(i * n + j) !== C.balanced(n, n, [[i, j]])) same = false;
  }
  check("on 4, 5, 7, 8 and 10 square boards it fits exactly where both colourings balance", same);
  const t = C.cover(8, 8, [[5, 2]]);
  check("and the covering found leaving c3 really covers the other 63 squares once", t && t.length === 21 && new Set(t.flatMap((p) => C.cells(p).map(([i, j]) => i * 8 + j))).size === 63);
}

{
  let same = true, some = true, notEnough = 0;
  for (const [n, m] of [[4, 5], [5, 7]]) {
    let good = 0, bad = 0;
    for (let a = 0; a < n * m; a++) for (let b = a + 1; b < n * m; b++) {
      const h = [[Math.floor(a / m), a % m], [Math.floor(b / m), b % m]];
      const ok = !!C.cover(n, m, h);
      if (ok && !C.balanced(n, m, h)) same = false;
      if (!ok && C.balanced(n, m, h)) notEnough++;
      ok ? good++ : bad++;
    }
    if (!(good > 0 && bad > good)) some = false;
  }
  check("4 x 5 and 5 x 7 need two monominoes: some pairs work, most do not", some);
  check("every pair that works balances both colourings", same);
  check(`but balance is not enough: ${notEnough} balanced pairs cannot be completed`, notEnough === 5 && !C.cover(4, 5, [[0, 1], [0, 3]]) && C.balanced(4, 5, [[0, 1], [0, 3]]));
}

{
  let s = C.start();
  equal("defaults: 8 x 8, 21 trominoes to place", `${s.n}x${s.m} ${C.target(s)}`, "8x8 21");
  check("a tromino needs two squares two apart in a row or column", C.place(s, 0, 0, 0, 1) === null && C.place(s, 0, 0, 2, 2) === null && C.place(s, 0, 0, 0, 2) !== null);
  s = C.place(s, 0, 0, 0, 2);
  check("no square twice, not even the middle one (the applet allowed starting there)", C.place(s, 0, 1, 2, 1) === null && C.place(s, 0, 2, 0, 4) === null);
  equal("Remove last", C.removeLast(s).pieces.length, 0);
  let w = C.start();
  for (const p of C.cover(8, 8, [[2, 2]])) w = C.place(w, ...p);
  check("21 trominoes placed: finished, the free square is c6", C.result(w) === "win" && C.name(w, ...C.free(w)[0]) === "c6" && C.place(w, 2, 2, 2, 2) === null);
  check("sizes are held to 3..20; NxM keeps both", C.start({ n: 2 }).n === 3 && C.start({ n: 30, m: 5 }).m === 5 && C.start({ n: 30 }).n === 20);
  const before = JSON.stringify(s);
  C.place(s, 4, 4, 4, 6);
  equal("a move leaves the old position alone", JSON.stringify(s), before);
}

done("tromino-monomino");
