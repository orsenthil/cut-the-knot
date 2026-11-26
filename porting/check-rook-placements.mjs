#!/usr/bin/env node
"use strict";

/*
 * Logic test for rook-placements/rook-placements-core.js.
 *
 *   node porting/check-rook-placements.mjs
 *
 * 1. The count of placements is the permanent of the 0/1 board, computed
 *    independently as the sum of the n! products, on random boards.
 * 2. The quick existence test (augmenting paths) agrees with "count > 0",
 *    and with Hall's condition checked over every set of rows (n <= 6).
 * 3. Every generated board has 3 to 12 placements; the full board has n!.
 * 4. The game: only open, unattacked squares; a full placement is recorded
 *    once; finding them all wins.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("rook-placements/rook-placements-core.js", "RookPlacementsCore");

const perms = (n) => { if (n === 0) return [[]]; const o = []; for (const p of perms(n - 1)) for (let k = 0; k <= p.length; k++) o.push([...p.slice(0, k), n - 1, ...p.slice(k)]); return o; };
const permanent = (m) => perms(m.length).reduce((s, p) => s + p.reduce((a, j, i) => a * (m[i][j] ? 1 : 0), 1), 0);

{
  const r = C.rng(42);
  let same = true, ex = true, hall = true;
  for (let k = 0; k < 600; k++) {
    const n = 2 + (k % 5);
    const open = Array.from({ length: n }, () => Array.from({ length: n }, () => r() < 0.5));
    const c = C.count(open);
    if (c !== permanent(open)) same = false;
    if (C.exists(open) !== c > 0) ex = false;
    let ok = true;
    for (let mask = 1; mask < 1 << n; mask++) {
      const rows = [...Array(n).keys()].filter((i) => (mask >> i) & 1);
      const cols = new Set(); rows.forEach((i) => open[i].forEach((v, j) => v && cols.add(j)));
      if (cols.size < rows.length) ok = false;
    }
    if (ok !== c > 0) hall = false;
  }
  check("on 600 random boards the count is the permanent of the 0/1 matrix", same);
  check("the quick augmenting-path test says yes exactly when the count is positive", ex);
  check("and agrees with Hall's condition on every set of rows", hall);
}
{
  let ok = true;
  for (const n of C.SIZES) for (let seed = 1; seed <= 12; seed++) { const c = C.count(C.board(n, seed)); if (c < 3 || c > 12) ok = false; }
  check("boards 1 to 12 of every size have 3 to 12 placements", ok);
  check("boards are the same every time for the same seed", JSON.stringify(C.board(5, 3)) === JSON.stringify(C.board(5, 3)));
  equal("a board with no blocked squares has n! placements", C.count(Array.from({ length: 5 }, () => Array(5).fill(true))), 120);
}
{
  let s = C.start({ n: 4, open: [[1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 1, 1], [0, 0, 1, 1]].map((r) => r.map(Boolean)) });
  equal("two 2 x 2 blocks: 2 x 2 = 4 placements", C.total(s), 4);
  check("a blocked square or an attacked one is refused", C.toggle(s, 0, 2) === null && C.toggle(C.toggle(s, 0, 0), 1, 0) === null);
  for (const p of C.placements(s.open)) { s = C.clear(s); p.forEach((j, i) => { s = C.toggle(s, i, j); }); s = C.toggle(s, 0, p[0]); s = C.toggle(s, 0, p[0]); }
  check("each placement is recorded once, and finding all four wins", s.found.length === 4 && C.result(s) === "win");
  const t = C.start();
  const before = JSON.stringify(t);
  C.toggle(t, 0, t.open[0].indexOf(true));
  equal("a move leaves the old position alone", JSON.stringify(t), before);
}
done("rook-placements");
