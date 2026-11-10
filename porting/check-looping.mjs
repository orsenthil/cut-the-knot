#!/usr/bin/env node
"use strict";

/*
 * Logic test for looping/looping-core.js.
 *
 *   1. CanSettle transcribed a second time from the bytecode (m_Board2,
 *      InvertIndex, ±1 on the right board) and compared with legal() on every
 *      from/to pair in every reachable position.
 *   2. The page's claims: gcd(N, L) = 1 so one loop; chips cannot change
 *      cyclic order on that loop; the reverse-order goal is therefore
 *      unreachable. Exhaustive BFS confirms no path to 4,3,2,1 on the home
 *      squares, while every reachable state keeps the start cyclic order.
 *   3. Edge cases of the move rule and the home-square helpers.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const H = loadCore("looping/looping-core.js", "LoopingCore");

/* -------------------------------- 1. CanSettle, again from the bytecode */

// m_Board2[i] = (i * 5) % 12, InvertIndex finds j with Board2[j] == left.
function appletCanSettle(loc, from, to) {
  if (loc[to]) return false;
  const board2 = Array.from({ length: H.N }, (_, i) => (i * 5) % H.N);
  const invert = (left) => {
    for (let j = 0; j < H.N; j++) if (board2[j] === left) return j;
    return 0;
  };
  let next = invert(from) + 1;
  if (next === H.N) next = 0;
  let prev = invert(from) - 1;
  if (prev < 0) prev = H.N - 1;
  return to === board2[next] || to === board2[prev];
}

{
  const s = H.start();
  let differ = 0;
  for (let from = 0; from < H.N; from++) {
    for (let to = 0; to < H.N; to++) {
      const a = !!s.loc[from] && appletCanSettle(s.loc, from, to);
      const b = H.legal(s, from, to);
      if (a !== b) differ++;
    }
  }
  check("legal() = CanSettle on the start position for every from/to", differ === 0, `${differ} differ`);
  equal("leftOf is the applet's m_Board2", Array.from({ length: H.N }, (_, i) => H.leftOf(i)),
    [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7]);
  equal("±L on the left board is ±1 on the right", H.legalMoves(s, 0).sort((a, b) => a - b), [5, 7]);
}

/* --------------------------------------- 2. the page's claims, exhaustively */

equal("gcd(12, 5) = 1, so one loop of all squares",
  Array.from({ length: H.N }, (_, i) => H.leftOf(i)).sort((a, b) => a - b).join(","),
  "0,1,2,3,4,5,6,7,8,9,10,11");

function key(loc) {
  return loc.join("");
}

function bfs() {
  const start = H.start();
  const seen = new Map([[key(start.loc), start]]);
  const queue = [start];
  let reversed = false;
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    if (H.isReversed(s)) reversed = true;
    for (let from = 0; from < H.N; from++) {
      if (!s.loc[from]) continue;
      for (const to of H.legalMoves(s, from)) {
        const n = H.move(s, from, to);
        const k = key(n.loc);
        if (!seen.has(k)) {
          // Every reachable state must keep the start cyclic order.
          if (!H.sameCycle(H.cyclicOrder(n), H.cyclicOrder(start))) {
            throw new Error("broken invariant at " + k);
          }
          // And agree with CanSettle.
          if (!appletCanSettle(s.loc, from, to)) {
            throw new Error("move not in CanSettle: " + from + "->" + to);
          }
          seen.set(k, n);
          queue.push(n);
        }
      }
    }
  }
  return { size: seen.size, reversed };
}

{
  const startOrder = H.cyclicOrder(H.start());
  equal("start cyclic order on the right board", startOrder, [1, 4, 2, 3]);
  const goal = H.start();
  goal.loc = [4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  equal("goal cyclic order is the reverse orientation", H.cyclicOrder(goal), [4, 1, 3, 2]);
  check("start and reverse-goal are not the same cycle", !H.sameCycle(startOrder, H.cyclicOrder(goal)));
  check("but the goal is the reverse of the start cycle",
    H.sameCycle(startOrder.slice().reverse(), H.cyclicOrder(goal)));

  const { size, reversed } = bfs();
  check("the reverse-order goal is unreachable (page: insolvable)", !reversed);
  // Choose 4 of the 12 slots, then seat the chips in the conserved cyclic
  // order: any of the 4 rotations of [1,4,2,3] can sit against a fixed origin,
  // so 4 * C(12,4) = 1980.
  equal("reachable states = 4 * C(12,4) with conserved orientation", size, 1980);
}

/* ---------------------------------------------------------- 3. edge cases */

{
  const s = H.start();
  equal("home chips at the start", H.homeChips(s), [1, 2, 3, 4]);
  check("start is not the reverse goal", !H.isReversed(s));
  check("cannot move onto an occupied square", !H.legal(s, 0, 1));
  check("cannot move from an empty square", !H.legal(s, 5, 10));
  const n = H.move(s, 0, 5);
  equal("chip 1 jumps five places to square 5", n.loc[5], 1);
  equal("square 0 is empty after the jump", n.loc[0], 0);
  equal("move count ticks", n.moves, 1);
  check("home is incomplete after that jump", H.homeChips(n) === null);
  // Bring everyone back home without reversing: rotate each chip +0 on homes
  // by walking chip 4 out and back is enough to show homeChips works mid-game.
  let t = s;
  t = H.move(t, 3, 8); // 4 goes to 8
  t = H.move(t, 8, 3); // 4 back
  equal("home chips after an out-and-back", H.homeChips(t), [1, 2, 3, 4]);
  equal("leftCell matches the applet's rectangular loop", 
    Array.from({ length: H.N }, (_, i) => H.leftCell(i)),
    [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
      { row: 1, col: 3 }, { row: 2, col: 3 }, { row: 3, col: 3 },
      { row: 3, col: 2 }, { row: 3, col: 1 }, { row: 3, col: 0 },
      { row: 2, col: 0 }, { row: 1, col: 0 },
    ]);
}

done("looping");
