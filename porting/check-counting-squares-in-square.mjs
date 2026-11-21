#!/usr/bin/env node
"use strict";

/*
 * Logic test for counting-squares-in-square/counting-squares-in-square-core.js.
 *
 *   node porting/check-counting-squares-in-square.mjs
 *
 * Exhaustive for N = 1..12 and every M = 1..N: drag the square to every
 * lattice position over and beyond the board, and paint exactly (N - M + 1)^2
 * cells; compared with a brute-force count of M x M squares on the grid (every
 * upper left corner whose square fits). The total T(N) = N(N+1)(2N+1)/6 is
 * checked for N = 1..40, both by summing (N - M + 1)^2 and by brute force for
 * N <= 12. The paint test is checked on a fine sweep around a cell centre, the
 * N and M controls on every pair 1..40.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("counting-squares-in-square/counting-squares-in-square-core.js", "CountingSquaresInSquareCore");

// A brute-force count of M x M grid squares inside an N x N grid.
function brute(n, m) {
  let c = 0;
  for (let x = 0; x + m <= n; x++) for (let y = 0; y + m <= n; y++) c++;
  return c;
}

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  check("a new game is not over", C.result(s) === null);
  equal("opens with N = 4 and M = 2", [s.n, s.m], [4, 2]);
  equal("the moving square starts at the lower right", s.pos, { x: 2, y: 2 });
  equal("the starting place is already painted", [C.paintedCount(s), s.painted[2 * 3 + 2]], [1, true]);
  equal("a 4 x 4 grid has 9 places for a 2 x 2 square", C.side(s) ** 2, 9);
  const d = C.move(s, { type: "drag", x: 0, y: 0 });
  check("dragging to the upper left paints that place", d.painted[0] && C.paintedCount(d) === 2 && d.moves === 1 && d.explored);
  check("the old position is untouched", C.paintedCount(s) === 1 && s.moves === 0);
  equal("a drag past the edge stays in the margin", C.move(s, { type: "drag", x: -99, y: 99 }).pos, { x: -1.5, y: 3.5 });
  check("a drag between cells paints nothing new", C.paintedCount(C.move(s, { type: "drag", x: 0.5, y: 0.5 })) === 1);
  check("bad moves are refused", C.move(s, null) === null && C.move(s, { type: "drag", x: NaN, y: 0 }) === null && C.move(s, { type: "n", value: "x" }) === null && C.move(s, { type: "nope" }) === null);
  equal("N below M is lifted to M", (({ n, m }) => [n, m])(C.move(C.start({ n: 5, m: 5 }), { type: "n", value: 2 })), [5, 5]);
  const big = C.move(s, { type: "m", value: 7 });
  equal("M above N leaves no places and N stays", [big.n, big.m, C.side(big), big.painted.length], [4, 7, 0, 0]);
  check("with no places the demo is never done", C.result(C.move(big, { type: "drag", x: 0, y: 0 })) === null);
  equal("values are kept in 1..40", [C.move(s, { type: "n", value: 99 }).n, C.move(s, { type: "n", value: -4 }).n, C.move(s, { type: "m", value: 0 }).m], [40, 2, 1]);
  const r = C.move(d, { type: "reset" });
  check("reset repaints only the starting place", C.paintedCount(r) === 1 && r.moves === 0 && !r.explored);
}

/* -------------------------------------------------- 2. every case, where small */
{
  let bad = 0, n = 0;
  for (let N = 1; N <= 12; N++) for (let M = 1; M <= N; M++) {
    let s = C.start({ n: N, m: M });
    // drag to every lattice upper left corner, inside and beyond the board
    for (let x = -1; x <= N - M + 1; x++) for (let y = -1; y <= N - M + 1; y++) {
      const t = C.move(s, { type: "drag", x, y });
      s = t || s;
    }
    n++;
    if (C.paintedCount(s) !== brute(N, M) || C.paintedCount(s) !== C.places(N, M) || C.paintedCount(s) !== (N - M + 1) ** 2) bad++;
    if (C.result(s) !== "done") bad++;
  }
  equal(`a full sweep paints exactly (N-M+1)^2 cells for every N <= 12, M <= N (${n})`, bad, 0);

  // Only whole squares fit: no cell outside the places can ever be painted.
  bad = 0;
  for (let N = 1; N <= 8; N++) for (let M = 1; M <= N; M++) {
    const s0 = C.start({ n: N, m: M });
    if (s0.painted.length !== C.places(N, M)) bad++;
  }
  equal("the grid of places has side N - M + 1", bad, 0);

  // The total of all sizes: sum of squares equals the closed form, and brute force.
  bad = 0;
  for (let N = 1; N <= 40; N++) {
    if (C.total(N) !== (N * (N + 1) * (2 * N + 1)) / 6) bad++;
    let t = 0;
    for (let k = 1; k <= N; k++) t += k * k; // the sum of the first N squares, as the page says
    if (t !== C.total(N)) bad++;
    if (N <= 12) {
      let b = 0;
      for (let M = 1; M <= N; M++) b += brute(N, M);
      if (b !== C.total(N)) bad++;
    }
  }
  equal("T(N) = N(N+1)(2N+1)/6 for N = 1..40, by summing and by brute force", bad, 0);
  check("N = 5 has 55 squares (25 + 16 + 9 + 4 + 1)", C.total(5) === 55 && C.places(5, 1) === 25 && C.places(5, 5) === 1);

  // The paint test: strictly less than a third of a cell from the centre.
  const s = C.start({ n: 3, m: 1 });
  const at = (dx, dy) => C.paintedCount(C.move(C.move(s, { type: "drag", x: 0, y: 0 }), { type: "drag", x: 1 + dx, y: 1 + dy })); // cell (1,1)
  const base = C.paintedCount(C.move(s, { type: "drag", x: 0, y: 0 }));
  check("the cell centre paints", at(0, 0) === base + 1);
  check("just inside a third paints", at(0.33, 0) === base + 1 && at(0, -0.33) === base + 1);
  check("just beyond a third does not paint", at(0.3334, 0) === base && at(0, 0.3334) === base && at(0.4, 0) === base);
  check("a diagonal offset is judged by its distance", at(0.23, 0.23) === base + 1 && at(0.25, 0.25) === base && at(0.3, 0.3) === base);

  // Every N and M pair: the controls.
  bad = 0; n = 0;
  for (let N = 1; N <= 40; N++) for (let M = 1; M <= 40; M++) {
    n++;
    const a = C.move(C.start({ n: N, m: M }), { type: "n", value: N });
    const b = C.move(C.start({ n: N, m: M }), { type: "m", value: M });
    const wantN = Math.max(N, M);
    if (a.n !== wantN || a.m !== M || b.n !== wantN || b.m !== M) bad++;
    if (a.painted.length !== C.places(wantN, M)) bad++;
  }
  equal(`the N and M controls agree for all 1..40 pairs (${n})`, bad, 0);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // Reset(): small squares at Square.x + A*i, Square.y + A*j for i, j < N - M + 1; the moving
  // square starts at Square.x + width - M*A: cell index N - M. Rebuilt with the applet's arithmetic.
  let bad = 0;
  for (let N = 1; N <= 40; N += 3) for (let M = 1; M <= N; M += 2) {
    const A = 10;
    const Sx = 100, Sy = 100, side = A * N;
    const start = { x: Sx + side - M * A, y: Sy + side - M * A };
    const loc = { x: start.x + A / 2, y: start.y + A / 2 };
    let filled = 0;
    for (let i = 0; i < N - M + 1; i++) for (let j = 0; j < N - M + 1; j++) {
      const q = { x: Sx + A * i + A / 2, y: Sy + A * j + A / 2 };
      if (Math.hypot(q.x - loc.x, q.y - loc.y) < A / 3) filled++;
    }
    if (filled !== 1 || C.paintedCount(C.start({ n: N, m: M })) !== 1) bad++;
  }
  equal("the opening position paints exactly the lower right place, as the applet's CheckFilled does", bad, 0);
}

done("counting-squares-in-square");
