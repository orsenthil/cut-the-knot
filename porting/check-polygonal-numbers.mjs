#!/usr/bin/env node
"use strict";

/*
 * Logic test for polygonal-numbers/polygonal-numbers-core.js.
 *
 *   node porting/check-polygonal-numbers.mjs
 *
 * For every option the applet allows (3..20 sides, size 1..15, 270 pictures):
 * the core's dots against a second transcription of DrawOnePolygon in the
 * applet's pixel units, the distinct dot count against the formula
 * P(N, n) = (N-2) n (n-1)/2 + n with n = size + 1, the gnomons, and the
 * well-known sequences.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("polygonal-numbers/polygonal-numbers-core.js", "PolygonalNumbersCore");

/* ------------------------------------------------------------ 1. the options */

{
  const s = C.start({});
  check("the applet starts at 5 sides, size 2", s.sides === 5 && s.size === 2);
  check("sides are kept in 3..20", C.start({ sides: 2 }).sides === 3 && C.start({ sides: 21 }).sides === 20);
  check("size is kept in 1..15", C.start({ size: 0 }).size === 1 && C.start({ size: 16 }).size === 15);
  equal("the start picture is the 3rd pentagonal number, 12", C.describe(s), { sides: 5, n: 3, dots: 12, newDots: 7 });
}

/* ------------------------- 2. every picture, against the applet's DrawOnePolygon */

// DrawOnePolygon(g, x, y, side, k, r): walk N sides from (x, y), k dots each,
// starting at half the interior angle and turning by pi - interior.
function applet(N, NSize, unit) {
  const pts = [];
  for (let L8 = 1; L8 <= NSize; L8++) {
    const L4 = unit * L8, L5 = L8;
    let L8p = { x: 40, y: 150 };
    const L9 = (Math.PI * (N - 2)) / N;
    let L11 = L9 / 2;
    for (let L13 = 0; L13 < N; L13++) {
      const L14 = { x: L8p.x + L4 * Math.cos(L11), y: L8p.y + L4 * Math.sin(L11) };
      for (let L15 = 0; L15 < L5; L15++) pts.push({ x: L8p.x + (L15 * (L14.x - L8p.x)) / L5, y: L8p.y + (L15 * (L14.y - L8p.y)) / L5 });
      L11 = L11 - (Math.PI - L9);
      L8p = L14;
    }
  }
  return pts;
}

{
  let pictures = 0, sameDots = 0, formula = 0, layers = 0;
  for (let N = 3; N <= 20; N++) for (let size = 1; size <= 15; size++) {
    pictures++;
    const s = C.start({ sides: N, size });
    const mine = C.dots(s);
    const unit = 15;
    const ref = applet(N, size, unit);
    // Distinct applet dots, up to rounding, and every core dot among them.
    const key = (p) => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
    const refSet = new Set(ref.map(key));
    const mineSet = new Set(mine.map((p) => key({ x: 40 + p.x * unit, y: 150 + p.y * unit })));
    if (refSet.size === mineSet.size && [...mineSet].every((k) => refSet.has(k))) sameDots++;
    if (mine.length === C.polygonal(N, size + 1) && C.describe(s).dots === mine.length) formula++;
    // The polygon of side 1 also holds the shared corner, the "1" the count starts from.
    const outer = mine.filter((p) => p.layer === size).length - (size === 1 ? 1 : 0);
    if (outer === C.gnomon(N, size)) layers++;
  }
  check(`the core draws the applet's dots in all ${pictures} pictures`, sameDots === pictures);
  check(`the distinct dots number P(N, size + 1) in all ${pictures} pictures`, formula === pictures);
  check(`the polygon of side k adds (N - 2) k + 1 new dots, all ${pictures} pictures`, layers === pictures);
}

/* ------------------------------------------------------------- 3. the claims */

{
  const seq = (N) => [1, 2, 3, 4, 5, 6].map((n) => C.polygonal(N, n));
  equal("triangular numbers", seq(3), [1, 3, 6, 10, 15, 21]);
  equal("square numbers", seq(4), [1, 4, 9, 16, 25, 36]);
  equal("pentagonal numbers", seq(5), [1, 5, 12, 22, 35, 51]);
  equal("hexagonal numbers", seq(6), [1, 6, 15, 28, 45, 66]);
  let nicomachus = true, euler = true;
  for (let N = 4; N <= 20; N++) for (let n = 1; n <= 16; n++) {
    // P(N, n) = P(N - 1, n) + T(n - 1), and P(N, n) = (N - 2) T(n - 1) + n.
    if (C.polygonal(N, n) !== C.polygonal(N - 1, n) + C.polygonal(3, n - 1)) nicomachus = false;
    if (C.polygonal(N, n) !== (N - 2) * C.polygonal(3, n - 1) + n) euler = false;
  }
  check("one more side adds a triangular number: P(N, n) = P(N-1, n) + T(n-1)", nicomachus);
  check("P(N, n) = (N - 2) T(n - 1) + n", euler);
  let hexTri = true;
  for (let n = 1; n <= 16; n++) if (C.polygonal(6, n) !== C.polygonal(3, 2 * n - 1)) hexTri = false;
  check("every hexagonal number is a triangular number: H(n) = T(2n - 1)", hexTri);
  let sq = true;
  for (let n = 1; n <= 16; n++) if (C.polygonal(3, n) + C.polygonal(3, n + 1) !== (n + 1) * (n + 1)) sq = false;
  check("two triangular numbers in a row make a square", sq);
}

done("polygonal-numbers");
