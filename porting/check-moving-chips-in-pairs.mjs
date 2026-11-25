#!/usr/bin/env node
"use strict";

/*
 * Logic test for moving-chips-in-pairs/moving-chips-in-pairs-core.js.
 *
 *   node porting/check-moving-chips-in-pairs.mjs
 *
 * The rules. Then the page's two propositions: (1) an odd height can never be
 * solved (every move lowers the height by 2); (2) from an even height, always
 * moving two chips of the largest heights (any tie-breaking: tried with the
 * lowest columns, the highest columns and 20 random choices each) always ends with
 * every chip in the bottom row, over every placement for N = 3..8 (all N!). By exhaustive
 * search of every sequence of moves for N = 3..6: the game is solvable exactly when
 * N(N-1)/2 is even, i.e. N is 0 or 1 mod 4 (N = 4, 5; not 3, 6). The blocked position
 * has exactly one chip off the bottom, at an odd height. The page says the
 * signature (the sorted heights) has no gaps: checked along every strategy play.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("moving-chips-in-pairs/moving-chips-in-pairs-core.js", "ChipsCore");

/* ------------------------------------------------------------ 1. the rules */
{
  equal("N runs 3..20, 10 to begin with", [C.MIN_N, C.MAX_N, C.DEFAULT_N, C.clampN(1), C.clampN(99), C.clampN("x")], [3, 20, 10, 3, 20, 10]);
  const s = C.start({ n: 4, random: rng(3) });
  equal("one chip in every row and column", [[...s.rows].sort().join(), s.selected, s.history], ["0,1,2,3", [false, false, false, false], []]);
  equal("the starting height is N(N-1)/2 whatever the placement", [C.height(s), C.startHeight(4), C.height(C.start({ n: 10 })), C.startHeight(10)], [6, 6, 45, 45]);
  const t = { n: 4, rows: [0, 3, 1, 2], selected: [false, false, false, false], history: [] };
  equal("a chip in the bottom row cannot be picked", C.toggle(t, 1), null);
  const a = C.toggle(t, 0), b = C.toggle(a, 2);
  equal("pick two chips: Make move is available", [a.selected, C.canMove(a), C.canMove(b)], [[true, false, false, false], false, true]);
  equal("picking again unpicks", C.toggle(a, 0).selected, [false, false, false, false]);
  const three = C.toggle(b, 3);
  equal("a third chip can be picked but then Make move is off", [three.selected, C.canMove(three)], [[true, false, true, true], false]);
  const m = C.move(b);
  equal("the two picked chips slide one down and are put down", [m.rows, m.selected, m.history], [[1, 3, 2, 2], [false, false, false, false], [[0, 3, 1, 2]]]);
  equal("a move needs exactly two picked", [C.move(t), C.move(a)], [null, null]);
  equal("Remove last takes the move back", [C.undo(m).rows, C.undo(m).history.length, C.undo(t)], [[0, 3, 1, 2], 0, null]);
  equal("the height falls by 2", C.height(t) - C.height(m), 2);
  equal("a bad column", [C.toggle(t, 4), C.toggle(t, -1), C.toggle(t, 0.5)], [null, null, null]);
  equal("all at the bottom wins; one left off loses", [C.result({ n: 3, rows: [2, 2, 2], selected: [], history: [] }), C.result({ n: 3, rows: [2, 2, 1], selected: [], history: [] }), C.result({ n: 3, rows: [2, 1, 0], selected: [], history: [] })], ["win", "lose", null]);
  equal("the best pair for the strategy: the two highest, lower columns first", C.bestPair({ n: 4, rows: [0, 3, 1, 0], selected: [], history: [] }), [0, 3]);
  equal("no pair when fewer than two can move", C.bestPair({ n: 3, rows: [2, 2, 1], selected: [], history: [] }), null);
}

/* ------------------------------ 2. exhaustive search for N = 3..6 */
function solveSearch(rows, n) {
  const seen = new Map();
  const go = (r) => {
    const key = r.join();
    if (seen.has(key)) return seen.get(key);
    seen.set(key, false);
    if (r.every((x) => x === n - 1)) { seen.set(key, true); return true; }
    const mov = r.map((x, c) => (x < n - 1 ? c : -1)).filter((c) => c >= 0);
    for (let i = 0; i < mov.length; i++) for (let j = i + 1; j < mov.length; j++) {
      const q = r.slice(); q[mov[i]]++; q[mov[j]]++;
      if (go(q)) { seen.set(key, true); return true; }
    }
    return false;
  };
  return go(rows);
}
function* perms(n) {
  const a = Array.from({ length: n }, (_, i) => i), c = Array(n).fill(0);
  yield a.slice();
  for (let i = 0; i < n;) { if (c[i] < i) { const j = i % 2 ? c[i] : 0; [a[i], a[j]] = [a[j], a[i]]; yield a.slice(); c[i]++; i = 0; } else { c[i] = 0; i++; } }
}
{
  for (let n = 3; n <= 6; n++) {
    let solvable = 0, total = 0, mismatch = 0;
    for (const p of perms(n)) { total++; const s = solveSearch(p, n); if (s) solvable++; if (s !== (C.startHeight(n) % 2 === 0)) mismatch++; }
    equal(`N = ${n}: all ${total} placements are ${C.startHeight(n) % 2 === 0 ? "solvable" : "unsolvable"} by exhaustive search (height ${C.startHeight(n)})`, [mismatch, solvable], [0, C.startHeight(n) % 2 === 0 ? total : 0]);
  }
  equal("solvable exactly when N is 0 or 1 mod 4 (N = 3..20)", Array.from({ length: 18 }, (_, i) => i + 3).filter((n) => C.startHeight(n) % 2 === 0), [4, 5, 8, 9, 12, 13, 16, 17, 20]);
}

/* ------------- 3. the strategy, for every placement and every tie-break */
{
  for (let n = 3; n <= 8; n++) {
    let plays = 0, bad = 0, gap = 0, lost = 0, wrongBlocked = 0;
    const even = C.startHeight(n) % 2 === 0, r = rng(n * 91);
    for (const p of perms(n)) {
      for (const mode of ["low", "high", "r1", "r2", "r3", "r4", "r5"]) {
        let s = { n, rows: p.slice(), selected: Array(n).fill(false), history: [] };
        plays++;
        let guard = 0;
        while (C.result(s) === null && guard++ < 1000) {
          // the heights of the chips; the signature (sorted heights) has no gaps
          const hs = s.rows.map((x) => n - 1 - x).sort((a, b) => a - b);
          for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) gap++;
          // the two chips with the largest heights, ties broken by the mode
          const movable = s.rows.map((x, c) => ({ c, h: n - 1 - x })).filter((x) => x.h > 0);
          const hmax = movable.map((x) => x.h).sort((a, b) => b - a);
          const need = [hmax[0], hmax[1]];
          const picks = [];
          const pool = movable.slice();
          for (const h of need) {
            const cand = pool.filter((x) => x.h === h);
            const choose = mode === "low" ? cand[0] : mode === "high" ? cand[cand.length - 1] : cand[Math.floor(r() * cand.length)];
            picks.push(choose.c); pool.splice(pool.indexOf(choose), 1);
          }
          let t = s; for (const c of picks) t = C.toggle(t, c);
          s = C.move(t);
        }
        if (even) { if (C.result(s) !== "win") bad++; } else { if (C.result(s) !== "lose") lost++; if (C.height(s) % 2 === 0) wrongBlocked++; }
      }
    }
    if (even) equal(`N = ${n}: height ${C.startHeight(n)} is even: ${plays.toLocaleString()} strategy plays (all placements, 7 tie-breaks) all end with every chip at the bottom, never a gap in the signature`, [bad, gap], [0, 0]);
    else equal(`N = ${n}: height ${C.startHeight(n)} is odd: all ${plays.toLocaleString()} strategy plays end blocked with one chip left at an odd height`, [lost, wrongBlocked], [0, 0]);
  }
}

done("moving-chips-in-pairs");
