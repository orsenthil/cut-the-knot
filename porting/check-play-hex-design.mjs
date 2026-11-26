#!/usr/bin/env node
"use strict";

/*
 * Logic test for play-hex-design/play-hex-design-core.js.
 *
 *   node porting/check-play-hex-design.mjs
 *
 * 1. The rules: first click, a new node, a misstep, Back, a full board.
 * 2. The core against a second transcription of the applet's Legible/Push/Pop
 *    (a Stack of nodes), on every click from many positions for N = 3..7.
 * 3. The claims: the product is a 60-degree clockwise turn (checked with real
 *    coordinates), the operation is a quasigroup for every N = 3..40, and the
 *    board can be filled with no missteps from any first node, for every N.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("play-hex-design/play-hex-design-core.js", "PlayHexDesignCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("a new game is 3 x 3, empty and not over", s.n === 3 && s.moves.length === 0 && C.result(s) === null);
  check("sizes are kept in 3..40", C.start({ n: 2 }).n === 3 && C.start({ n: 41 }).n === 40 && C.start({ n: 12 }).n === 12);
  check("no such node is refused", C.click(s, [3, 0]) === null && C.click(s, [-1, 0]) === null && C.click(s, null) === null);
  const a = C.click(s, [1, 1]);
  equal("the first click selects that node", a.moves, [[1, 1]]);
  const b = C.click(a, [1, 1]);
  check("clicking the last node itself is a misstep (L * L = L)", b.missed === 1 && b.moves.length === 1 && b.alert.join() === "1,1");
  const c = C.click(a, [2, 1]);
  equal("a new product is selected and becomes the last node", c.moves, [[1, 1], C.product(3, [2, 1], [1, 1])]);
  check("Back forgets the last node and keeps the missteps", C.back(C.click(b, [2, 1])).moves.length === 1 && C.back(C.click(b, [2, 1])).missed === 1);
  check("Back on an empty board changes nothing", C.back(s) === s);
}

/* ------------------------- 2. the core against the applet's Legible and Push */

function applet(n, clicks) {
  const Multiply = (p1, p2) => [(p2[0] + p2[1] - p1[1] + n) % n, (p1[0] + p1[1] - p2[0] + n) % n];
  const Moves = [];
  let NMissed = 0;
  const has = (q) => Moves.some((m) => m[0] === q[0] && m[1] === q[1]);
  for (const p of clicks) {
    if (p === "back") { if (Moves.length > 0) Moves.pop(); continue; }
    // Legible: an empty stack throws on pop, which returns true.
    let legible = true;
    if (Moves.length > 0) legible = !has(Multiply(p, Moves[Moves.length - 1]));
    if (!legible) { NMissed++; continue; }
    if (Moves.length === 0) { Moves.push(p); continue; }
    const L3 = Moves.pop();
    Moves.push(L3, Multiply(p, L3));
  }
  return { Moves, NMissed };
}

{
  let seed = 7;
  const rnd = (k) => ((seed = (seed * 1103515245 + 12345) % 2147483648) % k);
  let agree = 0, runs = 0;
  for (let n = 3; n <= 7; n++) for (let run = 0; run < 60; run++) {
    const clicks = [];
    let s = C.start({ n });
    for (let k = 0; k < 3 * n * n; k++) {
      const p = rnd(9) === 0 ? "back" : [rnd(n), rnd(n)];
      clicks.push(p);
      s = p === "back" ? C.back(s) : (C.click(s, p) || s);
      if (C.filled(s)) break;
    }
    const ref = applet(n, clicks);
    runs++;
    if (JSON.stringify(ref.Moves) === JSON.stringify(s.moves) && ref.NMissed === s.missed) agree++;
  }
  check(`the core and the applet agree on ${runs} random games, N = 3..7`, agree === runs);
}

/* ------------------------------------------------------------- 3. the claims */

{
  // Real coordinates: node (i, j) is at (i + j/2, j*sqrt(3)/2), j up the screen.
  const at = ([i, j]) => [i + j / 2, (j * Math.sqrt(3)) / 2];
  const n = 40; // big enough that the turns below do not wrap
  let rotations = 0, ok = 0;
  for (const p of [[20, 20], [18, 21], [22, 17]]) for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) {
    const l = [p[0] + di, p[1] + dj];
    const r = C.product(n, p, l);
    const [px, py] = at(p), [lx, ly] = at(l), [rx, ry] = at(r);
    const c = Math.cos(-Math.PI / 3), sn = Math.sin(-Math.PI / 3);
    const ex = px + (lx - px) * c - (ly - py) * sn, ey = py + (lx - px) * sn + (ly - py) * c;
    rotations++;
    if (Math.hypot(ex - rx, ey - ry) < 1e-9) ok++;
  }
  check(`P * L is L turned 60 degrees clockwise about P (${rotations} cases)`, ok === rotations);

  // A quasigroup (every row and column of the table is a permutation) and idempotent.
  let latin = true, idem = true, inverse = true;
  for (let N = 3; N <= 40; N++) {
    for (let a = 0; a < N * N && latin; a++) {
      const A = [a % N, Math.floor(a / N)];
      const row = new Set(), col = new Set();
      for (let b = 0; b < N * N; b++) {
        const B = [b % N, Math.floor(b / N)];
        row.add(C.product(N, A, B).join()); col.add(C.product(N, B, A).join());
        if (N <= 12 && C.product(N, C.solveFor(N, A, B), A).join() !== B.join()) inverse = false;
      }
      if (row.size !== N * N || col.size !== N * N) latin = false;
      if (C.product(N, A, A).join() !== A.join()) idem = false;
    }
  }
  check("for N = 3..40 each row and column of the product table is a permutation (a quasigroup)", latin);
  check("every node times itself is itself (idempotent)", idem);
  check("solveFor gives the click that reaches any node, N = 3..12", inverse);

  // Fill every board with no missteps, from every first node for small N.
  let fills = 0, perfect = 0;
  for (let N = 3; N <= 40; N++) {
    const starts = N <= 6 ? N * N : 1;
    for (let f = 0; f < starts; f++) {
      let s = C.click(C.start({ n: N }), [f % N, Math.floor(f / N)]);
      for (let t = 0; t < N * N && !C.filled(s); t++) {
        const target = [t % N, Math.floor(t / N)];
        if (C.isSelected(s, target)) continue;
        s = C.click(s, C.solveFor(N, C.last(s), target));
      }
      fills++;
      if (C.result(s) === "win" && s.missed === 0 && C.click(s, [0, 0]) === null) perfect++;
    }
  }
  check(`every board fills with no missteps (${fills} games, N = 3..40)`, perfect === fills);
}

done("play-hex-design");
