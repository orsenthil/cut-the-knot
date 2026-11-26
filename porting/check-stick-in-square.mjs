#!/usr/bin/env node
"use strict";

/*
 * Logic test for stick-in-square/stick-in-square-core.js.
 *
 *   node porting/check-stick-in-square.mjs
 *
 * 1. The page's three inequalities are equivalent to the pieces all being
 *    under 1/2, and on a fine grid the pink region is exactly the two
 *    triangles centre - midpoints: area 1/4; the green triangles have area
 *    1/4 too, and 1/3 of the rest is pink (the tempting wrong answer).
 * 2. The two-step experiment never lands in green, and its chance is
 *    2 ln 2 - 1 (integrated, and simulated); the one-step chance is 1/4.
 * 3. Asimov's thorn (x > 1/2, xy < 1/2, x(1-y) < 1/2) has area ln 2 - 1/2:
 *    the chance when the piece broken second is the left one, whatever its
 *    length; double it for "the longer piece".
 * 4. The applet's starting point; moves leave the position alone.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("stick-in-square/stick-in-square-core.js", "StickInSquareCore");
const near = (a, b, e) => Math.abs(a - b) < e;
const N = 1200;

{
  let pink = 0, green = 0, ineq = true, shape = true;
  const inTri = (P, T) => {
    const s = T.map((A, i) => { const B = T[(i + 1) % 3]; return (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]); });
    return s.every((v) => v > 0) || s.every((v) => v < 0);
  };
  const T1 = [[0, 0.5], [0.5, 0.5], [0.5, 1]], T2 = [[0.5, 0], [0.5, 0.5], [1, 0.5]];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i + 0.5) / N, y = (j + 0.5) / N;
    const [a, b, c] = C.pieces(x, y);
    const page = a < b + c && b < a + c && c < a + b;
    if (page !== C.forms([a, b, c])) ineq = false;
    const r = C.region(x, y);
    if ((r === "pink") !== (inTri([x, y], T1) || inTri([x, y], T2))) shape = false;
    if (r === "pink") pink++; else if (r === "green") green++;
  }
  check("the three triangle inequalities say exactly: every piece under 1/2", ineq);
  check("the pink region is the two triangles joining the centre to side midpoints", shape);
  check(`pink is 1/4 of the square (${(pink / N / N).toFixed(4)})`, near(pink / N / N, 0.25, 1e-3));
  check(`green is 1/4 too, and pink is 1/3 of the other 3/4 (${(pink / (N * N - green)).toFixed(4)})`, near(green / N / N, 0.25, 1e-3) && near(pink / (N * N - green), 1 / 3, 1e-3));
}

{
  let never = true, hits = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const p = C.experiment("two", (i + 0.5) / N, (j + 0.5) / N);
    if (C.region(p.x, p.y) === "green") never = false;
    if (C.region(p.x, p.y) === "pink") hits++;
  }
  check("the two-step experiment never lands in green", never);
  check(`its chance is 2 ln 2 - 1 = 0.3863, not 1/3 (integral ${(hits / N / N).toFixed(4)})`, near(hits / N / N, C.EXACT.two, 1e-3));
  const one = C.run(C.start({ mode: "one", seed: 3 }), 100000).state, two = C.run(C.start({ mode: "two", seed: 3 }), 100000).state;
  check("100,000 experiments each way land within 0.006 of 1/4 and 2 ln 2 - 1", near(one.hits / one.tries, 0.25, 0.006) && near(two.hits / two.tries, C.EXACT.two, 0.006));
}

{
  let thorn = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = (i + 0.5) / N, y = (j + 0.5) / N;
    if (x > 0.5 && x * y < 0.5 && x * (1 - y) < 0.5) thorn++;
  }
  check(`Asimov's thorn has area ln 2 - 1/2 = 0.1931 (${(thorn / N / N).toFixed(4)}), half of 2 ln 2 - 1`, near(thorn / N / N, Math.log(2) - 0.5, 1e-3));
}

{
  const s = C.start();
  equal("the applet's P = (2V0 + 4V1 + 3V2)/9 is x = 1/3, y = 2/9", `${s.x.toFixed(4)} ${s.y.toFixed(4)}`, "0.3333 0.2222");
  equal("pieces there: 2/9, 1/9, 2/3: no triangle, and in a green corner", C.pieces(s.x, s.y).map((v) => Math.round(v * 9)).join(" ") + " " + C.region(s.x, s.y), "2 1 6 green");
  const t = C.triangle(C.pieces(0.3, 0.7));
  check("pieces 0.3, 0.4, 0.3 make a triangle with those sides", t && near(Math.hypot(t[2][0] - t[1][0], t[2][1]), 0.3, 1e-9));
  const before = JSON.stringify(s);
  C.run(s, 5); C.moveTo(s, 0.9, 0.9);
  equal("moves leave the old position alone", JSON.stringify(s), before);
  check("points are held to the square", C.moveTo(s, -1, 3).x === 0 && C.moveTo(s, -1, 3).y === 1);
}

done("stick-in-square");
