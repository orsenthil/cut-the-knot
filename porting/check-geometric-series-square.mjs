#!/usr/bin/env node
"use strict";

/*
 * Logic test for geometric-series-square/geometric-series-square-core.js.
 *
 *   node porting/check-geometric-series-square.mjs
 *
 * 1. For each picture (2, 3, 4) and every N the picture is cut to: the
 *    shaded pieces never overlap, stay in the square, and their area is
 *    exactly the partial sum 1/q + 1/q^2 + ... + 1/q^(N-1).
 * 2. The page's three identities, exactly (BigInt) for every N up to 20:
 *    the limit minus the partial sum is 1/((q-1) q^k), so the sums tend to
 *    1, 1/2 and 1/3.
 * 3. Why the pictures prove it: for 3 the shaded cells mirrored in the
 *    diagonal land on unshaded cells (two equal halves); for 4 the
 *    unshaded, uncut quarters come in two copies of the shaded ones.
 * 4. The applet's order and counts of pieces, and N's range.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("geometric-series-square/geometric-series-square-core.js", "GeometricSeriesSquareCore");
const near = (a, b) => Math.abs(a - b) < 1e-12;
const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-15 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-15;

let areaOk = true, disjoint = true, inside = true, checked = 0;
for (const q of C.KINDS) {
  for (let n = 1; n <= C.MAX_N; n++) {
    const s = C.start({ kind: q, n });
    const k = Math.min(n - 1, C.MAX_DRAWN_DEPTH[q]);
    const P = C.pieces(s).filter((p) => p.painted);
    const area = P.reduce((t, p) => t + p.w * p.h, 0);
    const [a, b] = C.shaded(q, k);
    if (!near(area, Number(a) / Number(b))) areaOk = false;
    if (P.some((p) => p.x < -1e-12 || p.y < -1e-12 || p.x + p.w > 1 + 1e-12 || p.y + p.h > 1 + 1e-12)) inside = false;
    if (P.length < 400) for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (overlap(P[i], P[j])) disjoint = false;
    checked++;
  }
}
check(`the shaded area is exactly the partial sum (${checked} pictures)`, areaOk);
check("shaded pieces never overlap", disjoint);
check("and stay inside the square", inside);

let exact = true;
for (const q of C.KINDS) for (let k = 0; k <= 19; k++) {
  const [a, b] = C.shaded(q, k);
  const qb = BigInt(q), qk = qb ** BigInt(k);
  // limit L = 1/(q-1); L - a/b should be 1/((q-1) q^k)
  if (a * (qb - 1n) * qk !== b * (qk - 1n)) exact = false;
}
check("limit minus partial sum is exactly 1/((q-1) q^k) for k up to 19", exact);
equal("1/2 + 1/4 + ... tends to 1", C.LIMIT[2], "1");
equal("1/3 + 1/9 + ... tends to 1/2", C.LIMIT[3], "1/2");
equal("1/4 + 1/16 + ... tends to 1/3", C.LIMIT[4], "1/3");
equal("after 3 halvings 7/8 is shaded", C.shaded(2, 3).join("/"), "7/8");

{
  // 3: mirror in the diagonal y = x
  const s = C.start({ kind: 3, n: 5 });
  const all = C.pieces(s);
  const P = all.filter((p) => p.painted);
  const mirrored = P.map((p) => ({ x: p.y, y: p.x, w: p.h, h: p.w }));
  check("3: every shaded cell's mirror in the diagonal is unshaded", mirrored.every((m) => !P.some((p) => overlap(m, p))));
  check("3: so the shaded part is at most half, and the two halves match", P.every((p) => p.y >= p.x - 1e-12));
  // 4: uncut unshaded quarters: everything except the last top-right cell
  const t = C.start({ kind: 4, n: 6 });
  const Q = C.pieces(t);
  const shadedArea = Q.filter((p) => p.painted).reduce((a, p) => a + p.w * p.h, 0);
  const rest = Q.slice(0, -1).filter((p) => !p.painted).reduce((a, p) => a + p.w * p.h, 0);
  check("4: the unshaded quarters left behind have twice the shaded area", near(rest, 2 * shadedArea));
}

equal("N = 1 is the bare square", C.pieces(C.start({ kind: 2, n: 1 })).length, 1);
equal("2: one more piece per step", C.pieces(C.start({ kind: 2, n: 10 })).length, 10);
equal("4: three more pieces per step", C.pieces(C.start({ kind: 4, n: 10 })).length, 28);
equal("3: 1 + 6 + 18 + 54 pieces after three steps", C.pieces(C.start({ kind: 3, n: 4 })).length, 79);
{
  const p = C.pieces(C.start({ kind: 2, n: 3 }));
  check("2: the square's left half is shaded first, then the bottom of the right half",
    p[0].painted && p[0].x === 0 && p[0].w === 0.5 && p[1].painted && p[1].x === 0.5 && p[1].y === 0.5);
}
equal("N is held to 1..20", [C.start({ n: 0 }).n, C.start({ n: 99 }).n].join(","), "1,20");
equal("the sum written out", C.sumText(C.start({ kind: 3, n: 4 })), "1/3 + 1/9 + 1/27 = 13/27");

done("geometric-series-square");
