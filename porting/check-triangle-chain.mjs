#!/usr/bin/env node
"use strict";

/*
 * Logic test for triangle-chain/triangle-chain-core.js.
 *
 *   node porting/check-triangle-chain.mjs
 *
 * 1. The grid: n^2 triangles, n(n+1)/2 up and n(n-1)/2 down, and every
 *    adjacency joins an up triangle to a down one (the chessboard colouring).
 * 2. The page's answer, exhaustively for n = 2..5 (a search over every
 *    chain from every start): the longest chain has exactly n^2 - n + 1
 *    triangles; it starts and ends on up triangles.
 * 3. That number is reached for every n the applet allows (2..16) by the
 *    snake, which the core's own click rule accepts step by step.
 * 4. The clicks: an X for a triangle that is not next to the last one or
 *    is already counted, Remove last, the win, the range.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("triangle-chain/triangle-chain-core.js", "TriangleChainCore");

{
  let counts = true, bip = true;
  for (let n = 2; n <= 16; n++) {
    const T = C.triangles(n);
    const up = T.filter(C.isUp).length;
    if (T.length !== n * n || up !== (n * (n + 1)) / 2) counts = false;
    for (const a of T) for (const b of T) if (C.adjacent(a, b) && C.isUp(a) === C.isUp(b)) bip = false;
  }
  check("n^2 small triangles, n(n+1)/2 pointing up, for n = 2..16", counts);
  check("every step joins an up triangle to a down one", bip);
}

{
  let ok = true, ends = true;
  for (let n = 2; n <= 5; n++) {
    const T = C.triangles(n), idx = new Map(T.map((t, i) => [`${t.k},${t.p}`, i]));
    const nb = T.map((a) => T.map((b, j) => (C.adjacent(a, b) ? j : -1)).filter((j) => j >= 0));
    let best = 0, bestEndsUp = true;
    const seen = new Array(T.length).fill(false);
    const dfs = (i, len, first) => {
      if (len > best) { best = len; bestEndsUp = C.isUp(T[i]) && C.isUp(T[first]); }
      else if (len === best && !(C.isUp(T[i]) && C.isUp(T[first]))) bestEndsUp = false;
      for (const j of nb[i]) if (!seen[j]) { seen[j] = true; dfs(j, len + 1, first); seen[j] = false; }
    };
    for (let s = 0; s < T.length; s++) { seen[s] = true; dfs(s, 1, s); seen[s] = false; }
    if (best !== C.best(n)) ok = false;
    if (!bestEndsUp) ends = false;
    void idx;
  }
  check("for n = 2..5 the longest chain has exactly n^2 - n + 1 triangles (every chain searched)", ok);
  check("and every longest chain starts and ends on an up triangle", ends);
}

{
  let snake = true;
  for (let n = 2; n <= 16; n++) {
    let s = C.start({ n });
    for (const t of C.longestChain(n)) s = C.click(s, t.k, t.p);
    if (C.count(s) !== C.best(n) || s.stack.some((t) => t.x) || C.result(s) !== "win") snake = false;
  }
  check("the snake reaches n^2 - n + 1 for every n from 2 to 16, accepted step by step", snake);
}

{
  let s = C.start();
  equal("defaults: n = 5, best 21", `${s.n} ${C.best(s.n)}`, "5 21");
  s = C.click(s, 2, 2);
  s = C.click(s, 4, 0);
  check("a triangle not next to the last gets an X and is not counted", s.stack[1].x && C.count(s) === 1);
  s = C.removeLast(s);
  s = C.click(s, 2, 3);
  s = C.click(s, 2, 2);
  check("stepping back into a counted triangle gets an X", s.stack[2].x && C.count(s) === 2);
  s = C.removeLast(C.removeLast(s));
  equal("Remove last", C.count(s), 1);
  check("n is held to 2..16; triangles off the grid are refused", C.start({ n: 1 }).n === 2 && C.start({ n: 40 }).n === 16 && C.click(s, 1, 3) === null);
  const before = JSON.stringify(s);
  C.click(s, 1, 1);
  equal("a click leaves the old position alone", JSON.stringify(s), before);
}

done("triangle-chain");
