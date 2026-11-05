#!/usr/bin/env node
"use strict";

/*
 * Logic test for hanoi/hanoi-core.js.
 *
 *   1. solution(n) is hanoicanvas.Solution(N, 0, 1, 2): for n = 1 .. 10 it
 *      is legal from the start, ends solved, and takes 2^n - 1 moves; for
 *      n = 3 and n = 4 it is exactly the move list printed on the
 *      cut-the-knot page.
 *   2. The page's claim that 2^n - 1 is the fewest possible: breadth-first
 *      search from the start, for n = 1 .. 8.
 *   3. suggest() is hanoicanvas.Help(), transcribed here a second time from
 *      the bytecode (ring Ids, the m_Tower stacks, peek() and all) and
 *      compared on every one of the 3^n positions for n = 1 .. 8. From
 *      every position, following suggest() is legal and reaches the goal in
 *      exactly the fewest moves that breadth-first search finds.
 *   4. The rules: no disk on a smaller one, an empty peg takes anything, the
 *      win test, and the applet's two closing messages.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const H = loadCore("hanoi/hanoi-core.js", "HanoiCore");

/* ------------------------------------------------------- 1. the recursion */

const NAMES = ["Src", "Aux", "Dst"];
const PAGE_3 = ["Src-Dst", "Src-Aux", "Dst-Aux", "Src-Dst", "Aux-Src", "Aux-Dst", "Src-Dst"];
const PAGE_4 = [
  "Src-Aux", "Src-Dst", "Aux-Dst", "Src-Aux", "Dst-Src", "Dst-Aux", "Src-Aux", "Src-Dst",
  "Aux-Dst", "Aux-Src", "Dst-Src", "Aux-Dst", "Src-Aux", "Src-Dst", "Aux-Dst",
];
const named = (moves) => moves.map(([a, b]) => NAMES[a] + "-" + NAMES[b]);
equal("Solution(3) is the page's list", named(H.solution(3)), PAGE_3);
equal("Solution(4) is the page's list", named(H.solution(4)), PAGE_4);

for (let n = H.MIN_DISKS; n <= H.MAX_DISKS; n++) {
  const s = H.start(n);
  const moves = H.solution(n);
  const allLegal = moves.every(([a, b]) => H.move(s, a, b));
  check(`Solution(${n}) is legal and solves it`, allLegal && H.won(s));
  equal(`Solution(${n}) takes 2^n - 1 moves`, moves.length, 2 ** n - 1);
  equal(`${n} disks: closing message`, H.verdict(s), "Congratulations! Hope you enjoyed it.");
}

// The page's tip: in the perfect solution the smallest disk makes every other
// move, always stepping round the pegs the same way.
for (let n = 1; n <= H.MAX_DISKS; n++) {
  const s = H.start(n);
  const steps = new Set();
  let everyOther = true;
  H.solution(n).forEach(([a, b], i) => {
    const smallest = H.top(s, a) === 1;
    if (smallest !== (i % 2 === 0)) everyOther = false;
    if (smallest) steps.add((b - a + 3) % 3);
    H.move(s, a, b);
  });
  check(`${n} disks: the smallest disk moves every other turn`, everyOther);
  check(`${n} disks: always the same way round`, steps.size === 1);
}

/* ------------------------------------- 2 and 3. every position, BFS distance */

// A position is the peg of each disk, disk 1 first.
const encode = (pegOf) => pegOf.join("");
function fromPegOf(pegOf) {
  const n = pegOf.length;
  const s = H.start(n);
  s.pegs = [[], [], []];
  for (let d = n; d >= 1; d--) s.pegs[pegOf[d - 1]].push(d);
  return s;
}
function neighbours(pegOf) {
  const out = [];
  const tops = [0, 0, 0].map(() => Infinity);
  pegOf.forEach((p, i) => { if (i + 1 < tops[p]) tops[p] = i + 1; });
  for (let a = 0; a < 3; a++) {
    if (tops[a] === Infinity) continue;
    for (let b = 0; b < 3; b++) {
      if (a !== b && tops[a] < tops[b]) {
        const next = pegOf.slice();
        next[tops[a] - 1] = b;
        out.push(next);
      }
    }
  }
  return out;
}
function bfs(fromKey, n) {
  const dist = new Map([[fromKey, 0]]);
  const queue = [fromKey.split("").map(Number)];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    const d = dist.get(encode(cur));
    for (const nb of neighbours(cur)) {
      const k = encode(nb);
      if (!dist.has(k)) { dist.set(k, d + 1); queue.push(nb); }
    }
  }
  return dist;
}

// Help(), again from the bytecode: pos[] from the stacks, then the loop.
function appletHelp(s) {
  const n = s.n;
  const pos = new Array(n);
  for (let t = 0; t < 3; t++) for (const id of s.pegs[t]) pos[id - 1] = t;
  let i = 2;
  let found = -1;
  for (let k = n; k > 0; k--) {
    const stack = s.pegs[pos[k - 1]];
    const peek = stack[stack.length - 1];
    if (i === pos[k - 1]) continue;
    if (peek === k) {
      if (s.pegs[i].length === 0) { found = k; break; }
      const other = s.pegs[i][s.pegs[i].length - 1];
      if (other > k) { found = k; break; }
      i = 3 - i - pos[k - 1];
    } else {
      i = 3 - i - pos[k - 1];
    }
  }
  return found === -1 ? null : [pos[found - 1], i];
}

for (let n = 1; n <= 8; n++) {
  const goal = "2".repeat(n);
  const toGoal = bfs(goal, n); // moves are reversible, so distance to goal = distance from goal
  equal(`${n} disks: all 3^n positions are reachable`, toGoal.size, 3 ** n);
  equal(`${n} disks: the fewest moves from the start is 2^n - 1`, toGoal.get("0".repeat(n)), 2 ** n - 1);

  let differ = 0;
  let notOptimal = 0;
  for (const key of toGoal.keys()) {
    const s = fromPegOf(key.split("").map(Number));
    const a = H.suggest(s);
    const b = appletHelp(s);
    if (JSON.stringify(a) !== JSON.stringify(b)) differ++;
    let steps = 0;
    while (!H.won(s) && steps <= 2 ** n) {
      const m = H.suggest(s);
      if (!m || !H.move(s, m[0], m[1])) { steps = Infinity; break; }
      steps++;
    }
    if (!H.won(s) || steps !== toGoal.get(key)) notOptimal++;
  }
  check(`${n} disks: suggest() = the applet's Help() on every position`, differ === 0, `${differ} differ`);
  check(`${n} disks: following suggest() is optimal from every position`, notOptimal === 0, `${notOptimal} not optimal`);
}

/* --------------------------------------------------------------- 4. rules */

{
  const s = H.start(3);
  check("cannot move from an empty peg", !H.legal(s, 1, 2));
  check("cannot drop on the same peg", !H.legal(s, 0, 0));
  check("a disk goes on an empty peg", H.move(s, 0, 2));
  check("no disk on a smaller one", !H.legal(s, 0, 2));
  check("a smaller disk on a bigger one", H.move(s, 0, 1) && H.move(s, 2, 1));
  equal("pegs after three moves", s.pegs, [[3], [2, 1], []]);
  check("not solved yet", !H.won(s));
  equal("suggest() at the end is null", H.suggest(Object.assign(H.start(2), { pegs: [[], [], [2, 1]] })), null);
  const winLong = H.start(1);
  H.move(winLong, 0, 1); H.move(winLong, 1, 2);
  check("one disk, two moves, solved", H.won(winLong));
  equal("more than 2^n - 1 moves: the other message", H.verdict(winLong), "Congratulations! Try using fewer moves.");
  equal("default is 4 disks", H.DEFAULT_DISKS, 4);
  equal("1 to 10 disks", [H.MIN_DISKS, H.MAX_DISKS], [1, 10]);
}

done("hanoi");
