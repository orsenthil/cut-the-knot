#!/usr/bin/env node
"use strict";

/*
 * Logic test for enemy-ambassadors/enemy-ambassadors-core.js.
 *
 *   node porting/check-enemy-ambassadors.mjs
 *
 * The page's claims: (1) the arc turn is the applet's Swap: compared with a plain
 * reversal of the arc for every N from 5 to 30 and every pair of places; (2) the
 * theorem: for N = 4 and N = 6, EVERY graph with nobody having more than n-1 enemies
 * and EVERY seating: the page's procedure finds its lucky pair B', A', and applying
 * it lowers the number of hostile neighbours by at least one, so repeating it ends at
 * zero; the same for 40,000 random graphs meeting the condition for N = 8 to 30; (3)
 * the condition is not necessary (all diagonals and no sides: every ambassador has
 * more than n-1 enemies and nobody is next to an enemy); (4) it is sufficient only
 * with the condition: a graph breaking it that has no good seating (a star) exists;
 * (5) the applet's own random graph does not always meet the condition (counted).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("enemy-ambassadors/enemy-ambassadors-core.js", "EnemyAmbassadorsCore");

{
  const s = C.start({});
  check("the board opens with 10 ambassadors in order", s.n === 10 && s.seat.join() === "0,1,2,3,4,5,6,7,8,9" && s.selected === -1);
  check("sizes run from 5 to 30", C.start({ n: 3 }).n === 5 && C.start({ n: 99 }).n === 30 && C.move(s, { type: "size", value: 31 }) === null && C.move(s, { type: "size", value: 30 }).n === 30);
  check("every enemy pair is two different ambassadors", s.enemies.every((p) => p[0] < p[1] && p[1] < s.n));
  const a = C.move(s, { type: "pick", place: 2 });
  check("one click selects a place, the same place again deselects it", a.selected === 2 && C.move(a, { type: "pick", place: 2 }).selected === -1);
  const b = C.move(a, { type: "pick", place: 5 });
  check("a second click turns the arc 2..5 over: 0 1 5 4 3 2 6 ...", b.seat.join() === "0,1,5,4,3,2,6,7,8,9" && b.selected === -1 && b.moves === 1);
  check("the old position is untouched", s.seat.join() === "0,1,2,3,4,5,6,7,8,9" && a.selected === 2);
  check("a place outside the board is refused", C.move(s, { type: "pick", place: 10 }) === null);
  check("two ambassadors that are neighbours swap places", C.move(C.move(s, { type: "pick", place: 3 }), { type: "pick", place: 4 }).seat.join() === "0,1,2,4,3,5,6,7,8,9");
  equal("the arc can wrap round the end of the numbering: 4,5,0,1 turned over", C.reverseArc([0, 1, 2, 3, 4, 5], 4, 1).join(), "5,4,2,3,1,0");
}

{
  let n = 0, bad = null;
  for (let N = 5; N <= 30; N++) for (let from = 0; from < N; from++) for (let to = 0; to < N; to++) {
    const seat = Array.from({ length: N }, (_, i) => i * 7 % 1000);
    const out = C.reverseArc(seat, from, to);
    // reference: the arc from..to (counterclockwise, inclusive) reversed in place, the rest unchanged
    const len = ((to - from + N) % N) + 1;
    const arc = []; for (let k = 0; k < len; k++) arc.push(seat[(from + k) % N]);
    const ref = seat.slice(); arc.reverse(); for (let k = 0; k < len; k++) ref[(from + k) % N] = arc[k];
    // for from === to the applet's loop does nothing (d = 0, no swaps), the same as reversing one place
    if (out.join() !== ref.join()) bad = `N=${N} ${from}->${to}`;
    if (C.reverseArc(out, from, to).join() !== seat.join()) bad = `twice N=${N} ${from}->${to}`;
    n++;
  }
  check(`the arc turn is a plain reversal of the arc (and its own inverse) for every N 5..30 and every pair of places (${n})`, bad === null, String(bad));
}

{
  // every graph on N = 4 and N = 6 with at most n-1 enemies each, every seating
  const perms = (k) => { const out = []; const a = Array.from({ length: k }, (_, i) => i); const rec = (i) => { if (i === k) { out.push(a.slice()); return; } for (let j = i; j < k; j++) { [a[i], a[j]] = [a[j], a[i]]; rec(i + 1); [a[i], a[j]] = [a[j], a[i]]; } }; rec(0); return out; };
  let graphs = 0, seatings = 0, bad = null;
  for (const N of [4, 6]) {
    const pairs = []; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) pairs.push([i, j]);
    const P = perms(N).filter((p) => p[0] === 0); // rotation does not matter: fix ambassador 0 at place 0
    for (let mask = 0; mask < 1 << pairs.length; mask++) {
      const enemies = pairs.filter((_, k) => mask >> k & 1);
      // (start() clamps N to 5..30, so the position is built by hand)
      const base = { n: N, enemies: enemies.map((p) => [p[0], p[1]]), seat: [], selected: -1, moves: 0 };
      if (Math.max(0, ...C.degrees(base)) > N / 2 - 1) continue;
      graphs++;
      for (const seat of P) {
        let s = { ...base, seat }; seatings++;
        let guard = 0;
        while (C.mishaps(s).length > 0 && guard++ < 2 * N) {
          const before = C.mishaps(s).length;
          const l = C.lucky(s);
          if (!l) { bad = `no lucky pair N=${N} mask=${mask} seat=${seat}`; break; }
          s = C.move(s, { type: "hint" });
          if (C.mishaps(s).length > before - 1) { bad = `not reduced N=${N} mask=${mask}`; break; }
        }
        if (bad || C.mishaps(s).length > 0) { bad = bad || `stuck N=${N}`; break; }
      }
      if (bad) break;
    }
  }
  check(`the page's procedure always finds a lucky pair and lowers the mishaps, for every graph with at most n-1 enemies each and every seating, N = 4 and 6 (${graphs} graphs, ${seatings} seatings)`, bad === null, String(bad));
}

{
  let seed = 31337, bad = null, runs = 0, steps = 0;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let t = 0; t < 40000 && !bad; t++) {
    const N = 2 * (4 + rnd(12)); // 8..30
    const maxDeg = N / 2 - 1;
    const deg = new Array(N).fill(0), pairs = [], seen = new Set();
    // fill with random edges until no more fit: a graph at the limit of the condition
    for (let tries = 0; tries < N * N * 3; tries++) {
      const a = rnd(N), b = rnd(N); if (a === b) continue;
      const key = Math.min(a, b) * N + Math.max(a, b);
      if (seen.has(key) || deg[a] >= maxDeg || deg[b] >= maxDeg) continue;
      seen.add(key); deg[a]++; deg[b]++; pairs.push([Math.min(a, b), Math.max(a, b)]);
    }
    const seat = Array.from({ length: N }, (_, i) => i);
    for (let k = N - 1; k > 0; k--) { const j = rnd(k + 1); [seat[k], seat[j]] = [seat[j], seat[k]]; }
    let s = { n: N, enemies: pairs, seat, selected: -1, moves: 0 };
    if (!C.meetsCondition(s)) { bad = "generator broke the condition"; break; }
    let guard = 0;
    while (C.mishaps(s).length > 0 && guard++ <= N) {
      const before = C.mishaps(s).length;
      if (!C.lucky(s)) { bad = `no lucky pair N=${N}`; break; }
      s = C.move(s, { type: "hint" }); steps++;
      if (C.mishaps(s).length > before - 1) bad = `not reduced N=${N}`;
    }
    if (C.mishaps(s).length > 0) bad = bad || `not finished N=${N}`;
    runs++;
  }
  check(`40,000 random graphs at the limit of the condition, N from 8 to 30: the procedure always ends with nobody next to an enemy (${steps} turns)`, bad === null, String(bad));
}

{
  // the condition is not necessary: all diagonals, no sides
  const N = 10, enemies = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const d = Math.min(j - i, N - (j - i)); if (d > 1) enemies.push([i, j]); }
  const s = { n: N, enemies, seat: Array.from({ length: N }, (_, i) => i), selected: -1, moves: 0 };
  check("all diagonals and no sides: everyone has 7 > n-1 = 4 enemies and still nobody sits next to an enemy", Math.min(...C.degrees(s)) === 7 && !C.meetsCondition(s) && C.mishaps(s).length === 0 && C.result(s) === "win");
  // and it is not sufficient without the condition: a star (one ambassador hated by all) can still be solved or not; K_{1,N-1} with
  // enemies of 0 being everybody leaves 0 next to two others, so it can never be solved.
  const star = { n: 6, enemies: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], seat: [0, 1, 2, 3, 4, 5], selected: -1, moves: 0 };
  let solvable = false;
  const perm = (a, k) => { if (k === a.length) { const t = { ...star, seat: a.slice() }; if (C.mishaps(t).length === 0) solvable = true; return; } for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; perm(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; } };
  perm([0, 1, 2, 3, 4, 5], 0);
  check("without the condition there may be no good seating: a star with one ambassador everyone hates", !solvable && !C.meetsCondition(star));
  // the applet's own generator
  let bad = 0, total = 0;
  for (let N = 6; N <= 30; N += 2) for (let seed = 1; seed <= 200; seed++) { const g = C.start({ n: N, seed }); total++; if (!C.meetsCondition(g)) bad++; }
  check(`the applet's random graph (N/4 picks each) often breaks the page's condition (${bad} of ${total} boards), so the hint says when it cannot help`, bad > 0 && bad < total);
}

done("enemy-ambassadors");
