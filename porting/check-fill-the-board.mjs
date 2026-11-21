#!/usr/bin/env node
"use strict";

/*
 * Logic test for fill-the-board/fill-the-board-core.js.
 *
 *   node porting/check-fill-the-board.mjs
 *
 * The page's claims, by searching every starting configuration rather than trusting them:
 *   (a) N chips on a diagonal fill the N by N board, in N - 1 steps (N = 2 to 15);
 *   (b) no configuration of fewer than N chips fills it: every configuration with at most N - 1
 *       chips, for N = 2 to 5 (all 2^(N*N) configurations for N <= 4), and the reason, the perimeter
 *       never grows, is checked at every step of every configuration for N <= 4 and 20,000 random
 *       configurations on larger boards;
 *   (c) with N chips the fastest fills take N - 1 steps ("one of the fastest") and the slowest take
 *       the maximum found by the search (the page invites you to find them: 1, 4, 9, 14 steps for N = 2 to 5), for N = 2 to 5;
 *   (d) the board a configuration ends on does not depend on the order in which squares are added.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("fill-the-board/fill-the-board-core.js", "FillTheBoardCore");

{
  const s = C.start({});
  check("the board opens 4 by 4, empty, in Set up", s.n === 4 && C.count(s) === 0 && s.playing === false && C.result(s) === null);
  check("N runs from 2 to 15", C.start({ n: 1 }).n === 2 && C.start({ n: 99 }).n === 15 && C.move(s, { type: "size", value: 16 }) === null && C.move(s, { type: "size", value: 15 }).n === 15);
  const t = C.move(s, { type: "toggle", x: 1, y: 2 });
  check("in Set up a click puts a chip (step 0) and a second click takes it away", t.grid[1][2] === 0 && C.move(t, { type: "toggle", x: 1, y: 2 }).grid[1][2] === -1 && s.grid[1][2] === -1);
  check("a click outside the board is refused", C.move(s, { type: "toggle", x: 4, y: 0 }) === null && C.move(s, { type: "toggle", x: -1, y: 0 }) === null);
  const p = C.move(t, { type: "mode", value: "play" });
  check("in Play a click does nothing and One step is allowed", C.move(p, { type: "toggle", x: 0, y: 0 }) === null && C.move(p, { type: "step" }) !== null && C.move(s, { type: "step" }) === null);
  // two chips and the square between: a 3x3 corner. (0,0) and (1,1) chips: squares (0,1) and (1,0) have two neighbours
  let q = C.start({ n: 3 }); q = C.move(q, { type: "toggle", x: 0, y: 0 }); q = C.move(q, { type: "toggle", x: 1, y: 1 }); q = C.move(q, { type: "mode", value: "play" }); q = C.move(q, { type: "step" });
  check("one step adds every square with two occupied neighbours, numbered with the step", q.step === 1 && q.grid[0][1] === 1 && q.grid[1][0] === 1 && q.grid[0][0] === 0 && q.grid[2][2] === -1);
  const back = C.move(q, { type: "mode", value: "setup" });
  check("going back to Set up removes the added squares and keeps the chips", back.grid[0][1] === -1 && back.grid[0][0] === 0 && back.grid[1][1] === 0 && back.step === 0 && back.playing === false);
  check("Reset empties the board", C.count(C.move(q, { type: "reset" })) === 0);
}

{
  // (a) the diagonal
  let ok = true;
  for (let n = 2; n <= 15; n++) { const r = C.run(n, Array.from({ length: n }, (_, i) => [i, i])); if (!r.full || r.steps !== n - 1) ok = false; }
  check("N chips on the diagonal fill the board in N - 1 steps, N = 2 to 15", ok);
  // the game's own flow: win when full
  let w = C.start({ n: 5 }); for (let i = 0; i < 5; i++) w = C.move(w, { type: "toggle", x: i, y: i }); w = C.move(w, { type: "mode", value: "play" });
  for (let k = 0; k < 4; k++) w = C.move(w, { type: "step" });
  check("played through the game, the diagonal wins after 4 steps and then One step is refused", C.result(w) === "win" && w.step === 4 && C.move(w, { type: "step" }) === null);
  let l = C.start({ n: 4 }); l = C.move(l, { type: "toggle", x: 0, y: 0 }); l = C.move(l, { type: "mode", value: "play" }); l = C.move(l, { type: "step" });
  check("one lonely chip: a step adds nothing and the game is lost", C.result(l) === "lose");
}

function configsWithAtMost(n, k, visit) {
  const cells = n * n; const idx = [];
  const rec = (start, left) => { visit(idx); if (left === 0) return; for (let i = start; i < cells; i++) { idx.push(i); rec(i + 1, left - 1); idx.pop(); } };
  rec(0, k);
}

{
  // (b) fewer than N chips never fill the board; and the perimeter never grows
  const stats = [];
  let bad = null, perimBad = null, checked = 0;
  for (let n = 2; n <= 5; n++) {
    let configs = 0, fills = 0;
    configsWithAtMost(n, n - 1, (idx) => {
      configs++;
      const r = C.run(n, idx.map((i) => [Math.floor(i / n), i % n]));
      if (r.full) { fills++; bad = bad || `${n}: ${idx}`; }
    });
    stats.push(`N=${n}: ${configs} configurations`);
    checked += configs;
  }
  check(`no configuration of fewer than N chips fills the board, for every one with at most N - 1 chips, N = 2 to 5 (${stats.join(", ")})`, bad === null, String(bad));
  // the perimeter: at every step of every configuration for N <= 4, then random ones on larger boards
  const allCells = (n) => { const cs = []; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) cs.push([x, y]); return cs; };
  let steps = 0;
  for (let n = 2; n <= 4; n++) {
    const cs = allCells(n);
    for (let mask = 1; mask < 1 << (n * n); mask++) {
      let grid = Array.from({ length: n }, () => new Array(n).fill(-1));
      cs.forEach(([x, y], i) => { if (mask >> i & 1) grid[x][y] = 0; });
      let p = C.perimeter(grid, n), step = 0;
      while (true) {
        step++;
        const e = C.expand(grid, n, step);
        if (e.added === 0) break;
        const q = C.perimeter(e.grid, n);
        if (q > p) perimBad = `perimeter grew at N=${n} mask ${mask}`;
        p = q; grid = e.grid; steps++;
      }
    }
  }
  let seed = 17;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let t = 0; t < 20000; t++) {
    const n = 5 + rnd(11);
    let grid = Array.from({ length: n }, () => new Array(n).fill(-1));
    const k = 1 + rnd(2 * n);
    for (let i = 0; i < k; i++) grid[rnd(n)][rnd(n)] = 0;
    let p = C.perimeter(grid, n), step = 0;
    while (true) { step++; const e = C.expand(grid, n, step); if (e.added === 0) break; const q = C.perimeter(e.grid, n); if (q > p) perimBad = `perimeter grew at random N=${n}`; p = q; grid = e.grid; steps++; }
  }
  check(`the perimeter of the occupied squares never grows, at any step (${steps} steps checked)`, perimBad === null, String(perimBad));
}

{
  // (c) fastest and slowest fills with exactly N chips
  const rows = [];
  let ok = true;
  for (let n = 2; n <= 5; n++) {
    let fast = Infinity, slow = 0, nfills = 0, total = 0;
    const cells = n * n, idx = [];
    const rec = (start, left) => {
      if (left === 0) { total++; const r = C.run(n, idx.map((i) => [Math.floor(i / n), i % n])); if (r.full) { nfills++; fast = Math.min(fast, r.steps); slow = Math.max(slow, r.steps); } return; }
      for (let i = start; i <= cells - left; i++) { idx.push(i); rec(i + 1, left - 1); idx.pop(); }
    };
    rec(0, n);
    rows.push({ n, total, nfills, fast, slow });
    if (fast !== n - 1) ok = false;
  }
  console.log("   (N chips: " + rows.map((r) => `N=${r.n}: ${r.nfills} of ${r.total} fill the board, fastest ${r.fast} steps, slowest ${r.slow}`).join("; ") + ")");
  check("with exactly N chips the fastest fill takes N - 1 steps (the diagonal is one of the fastest), N = 2 to 5, over every configuration", ok);
  // (d) order of addition does not matter: a sequential closure reaches the same board
  let seed = 3, same = true;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let t = 0; t < 3000; t++) {
    const n = 3 + rnd(6);
    const chipCells = []; for (let i = 0, k = 1 + rnd(n + 3); i < k; i++) chipCells.push([rnd(n), rnd(n)]);
    const sync = C.run(n, chipCells).grid.map((r) => r.map((v) => (v === -1 ? 0 : 1)));
    // one square at a time, in a random order
    const g = Array.from({ length: n }, () => new Array(n).fill(0)); chipCells.forEach(([x, y]) => { g[x][y] = 1; });
    let changed = true;
    while (changed) {
      changed = false;
      const order = []; for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) order.push([x, y]);
      for (let i = order.length - 1; i > 0; i--) { const j = rnd(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
      for (const [x, y] of order) if (!g[x][y]) { let k = 0; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const a = x + dx, b = y + dy; if (a >= 0 && a < n && b >= 0 && b < n && g[a][b]) k++; } if (k >= 2) { g[x][y] = 1; changed = true; } }
    }
    if (JSON.stringify(g) !== JSON.stringify(sync)) same = false;
  }
  check("the board a configuration ends on does not depend on the order of the additions (3,000 random configurations)", same);
}

done("fill-the-board");
