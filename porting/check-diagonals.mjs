#!/usr/bin/env node
"use strict";

/*
 * Logic test for diagonals/diagonals-core.js.
 *
 * The page's claim is that in a convex n-gon, however you draw non-crossing
 * diagonals and in whatever order, when no more will fit you have exactly
 * n-3 of them. The port rests on that twice over: it is the win condition,
 * and it is the reason the player can never get stuck.
 *
 * So the test does not take it on faith:
 *
 *   1. The combinatorial crossing test is checked against real geometry -
 *      every pair of chords of a regular n-gon, compared with a segment
 *      intersection worked out in coordinates.
 *   2. Maximality is checked by search. For n = 4..9 every reachable maximal
 *      set is enumerated depth-first and must have n-3 diagonals; for n up to
 *      16 random greedy fills must all end at n-3 with no legal move left.
 *   3. The by-products the page mentions are checked: n(n-3)/2 diagonals in
 *      all, and n-2 triangles, the latter counted from the real faces of the
 *      drawing rather than from the formula.
 *   4. The applet's own refusals are reproduced, including the one case where
 *      the port deliberately differs: BarryCipra-style, DiagonalsCanvas never
 *      checked for a repeated diagonal and would draw it twice.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const D = loadCore("diagonals/diagonals-core.js", "DiagonalsCore");

/* ------------------------------ 1. the crossing test against real geometry */

/** Where vertex i of a regular n-gon sits. */
const vertex = (i, n) => {
  const t = (2 * Math.PI * i) / n;
  return { x: Math.cos(t), y: Math.sin(t) };
};

/** Do the open segments a-b and c-d meet, as plain coordinate geometry? */
function segmentsCross(n, a, b, c, d) {
  const [p, q, r, s] = [vertex(a, n), vertex(b, n), vertex(c, n), vertex(d, n)];
  const side = (o, u, v) => Math.sign((u.x - o.x) * (v.y - o.y) - (u.y - o.y) * (v.x - o.x));
  const d1 = side(p, q, r);
  const d2 = side(p, q, s);
  const d3 = side(r, s, p);
  const d4 = side(r, s, q);
  return d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0 && d1 !== d2 && d3 !== d4;
}

{
  let pairs = 0;
  let wrong = 0;
  for (let n = 4; n <= 11; n++) {
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        if (D.isSide(n, a, b)) continue;
        for (let c = 0; c < n; c++) {
          for (let e = c + 1; e < n; e++) {
            if (D.isSide(n, c, e)) continue;
            if (a === c && b === e) continue;
            const state = { n: n, diagonals: [[c, e]] };
            const said = D.crosses(state, a, b);
            const truth = segmentsCross(n, a, b, c, e);
            pairs++;
            if (said !== truth) {
              wrong++;
              if (wrong < 4) {
                console.error(`  FAIL n=${n} (${a},${b}) vs (${c},${e}): core says ${said}, geometry says ${truth}`);
              }
            }
          }
        }
      }
    }
  }
  check(`the index test matches real geometry on all ${pairs} chord pairs`, wrong === 0, `${wrong} disagreed`);
}

{
  // Diagonals that share a vertex touch, but do not cross.
  const s = { n: 6, diagonals: [[0, 3]] };
  check("a diagonal sharing a vertex does not cross", !D.crosses(s, 0, 2));
  check("a diagonal on one side does not cross", !D.crosses(s, 1, 2) && !D.crosses(s, 4, 5));
  check("a diagonal straddling it does cross", D.crosses(s, 2, 4));
  check("1-5 straddles 0-3 the other way, so it crosses too", D.crosses(s, 1, 5));
  check("and so does 2-5", D.crosses(s, 2, 5));
}

/* -------------------------------------- 2. every maximal set has n-3 in it */

{
  // Exhaustive: visit every reachable set of diagonals, and record the size of
  // each one that cannot be extended.
  function explore(state, seen, dead) {
    const key = state.diagonals.map((d) => d.join("-")).sort().join(",");
    if (seen.has(key)) return;
    seen.add(key);
    const moves = D.legalMoves(state);
    if (moves.length === 0) {
      dead.add(state.diagonals.length);
      return;
    }
    for (const [a, b] of moves) {
      explore({ n: state.n, diagonals: state.diagonals.concat([[a, b]]) }, seen, dead);
    }
  }

  for (let n = 4; n <= 9; n++) {
    const seen = new Set();
    const dead = new Set();
    explore(D.create(n), seen, dead);
    equal(`n=${n}: every way of playing it out ends with the same count`, [...dead], [D.maxDiagonals(n)]);
    check(`n=${n}: and there was more than one way to play it`, seen.size > 1, `${seen.size} positions`);
  }
}

{
  // Bigger polygons, by random greedy fill: it must always end at n-3, and
  // "no legal move left" and "n-3 drawn" must be the same moment.
  let seed = 12345;
  const rand = (k) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % k;
  };
  for (let n = 4; n <= 16; n++) {
    for (let trial = 0; trial < 40; trial++) {
      const s = D.create(n);
      let stoppedEarly = false;
      for (;;) {
        const moves = D.legalMoves(s);
        if (moves.length === 0) break;
        if (D.isComplete(s)) { stoppedEarly = true; break; }
        const [a, b] = moves[rand(moves.length)];
        equal(`n=${n}: a move legalMoves offered is accepted`, D.add(s, a, b), "ok");
      }
      check(`n=${n} trial ${trial}: legal moves run out exactly at n-3`, !stoppedEarly);
      equal(`n=${n} trial ${trial}: ends with n-3 diagonals`, s.diagonals.length, D.maxDiagonals(n));
      check(`n=${n} trial ${trial}: and the core calls it complete`, D.isComplete(s));
    }
  }
}

/* ----------------------------------------- 3. the counts the page mentions */

{
  for (let n = 4; n <= 20; n++) {
    equal(`n=${n}: an empty polygon offers n(n-3)/2 diagonals`, D.legalMoves(D.create(n)).length, D.allDiagonals(n));
  }
  equal("a pentagon has 5 diagonals in all", D.allDiagonals(5), 5);
  equal("a hexagon has 9", D.allDiagonals(6), 9);
  equal("but only n-3 of them can be drawn without crossing", D.maxDiagonals(6), 3);
}

{
  /**
   * Count the triangles a finished drawing really cuts the polygon into, by
   * walking the faces of the planar graph rather than trusting n-2.
   */
  function faces(state) {
    const n = state.n;
    const nbr = Array.from({ length: n }, () => []);
    const edge = (a, b) => { nbr[a].push(b); nbr[b].push(a); };
    for (let i = 0; i < n; i++) edge(i, (i + 1) % n);
    for (const [a, b] of state.diagonals) edge(a, b);

    const angle = (from, to) => {
      const p = vertex(from, n);
      const q = vertex(to, n);
      return Math.atan2(q.y - p.y, q.x - p.x);
    };
    for (let v = 0; v < n; v++) nbr[v].sort((x, y) => angle(v, x) - angle(v, y));

    // Walk every directed edge once, always taking the next neighbour
    // clockwise; each walk traces one face.
    const used = new Set();
    const found = [];
    for (let v = 0; v < n; v++) {
      for (const w of nbr[v]) {
        if (used.has(v + ">" + w)) continue;
        const face = [];
        let [a, b] = [v, w];
        for (;;) {
          used.add(a + ">" + b);
          face.push(a);
          const ring = nbr[b];
          const back = ring.indexOf(a);
          const next = ring[(back - 1 + ring.length) % ring.length];
          [a, b] = [b, next];
          if (a === v && b === w) break;
        }
        found.push(face);
      }
    }
    // One of those walks traces the outside of the polygon; the rest are the
    // pieces it was cut into.
    return found.length - 1;
  }

  let seed = 999;
  const rand = (k) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % k; };
  for (let n = 4; n <= 12; n++) {
    const s = D.create(n);
    for (;;) {
      const moves = D.legalMoves(s);
      if (!moves.length) break;
      const [a, b] = moves[rand(moves.length)];
      D.add(s, a, b);
    }
    equal(`n=${n}: the finished drawing really has n-2 pieces`, faces(s), D.triangleCount(n));
  }
}

/* --------------------------------------------- 4. the applet's own refusals */

{
  const s = D.create(6);
  equal("a vertex joined to itself", D.classify(s, 2, 2), "same");
  equal("neighbours are a side, not a diagonal", D.classify(s, 2, 3), "side");
  equal("and so are the two ends of the list", D.classify(s, 5, 0), "side");
  equal("a real diagonal is fine", D.add(s, 0, 2), "ok");
  equal("drawing it the other way round is the same diagonal", D.classify(s, 2, 0), "duplicate");
  check("the core stored it in order", s.diagonals[0][0] === 0 && s.diagonals[0][1] === 2);
  equal("a crossing one is refused", D.classify(s, 1, 4), "crosses");
  equal("one that only touches it is fine", D.add(s, 2, 4), "ok");
  equal("and one more fills the hexagon", D.add(s, 2, 5), "ok");
  check("which completes it", D.isComplete(s));
  equal("after that nothing may be drawn", D.classify(s, 0, 3), "finished");
  equal("and legalMoves is empty", D.legalMoves(s).length, 0);
}

{
  // A refused move must leave the board untouched.
  const s = D.create(7);
  D.add(s, 0, 3);
  const before = JSON.stringify(s.diagonals);
  for (const [a, b] of [[1, 1], [1, 2], [0, 3], [2, 5]]) D.add(s, a, b);
  equal("no refused move changes the board", JSON.stringify(s.diagonals), before);
}

{
  // A square is the smallest case: two diagonals, and they cross.
  const s = D.create(4);
  equal("a square allows exactly one diagonal", D.maxDiagonals(4), 1);
  equal("either of them", D.add(s, 0, 2), "ok");
  equal("but then the other is out of the question", D.classify(s, 1, 3), "finished");
  const t = D.create(4);
  check("and before that it is refused for crossing", D.crosses({ n: 4, diagonals: [[0, 2]] }, 1, 3));
  equal("a square's only legal pair of moves", D.legalMoves(t).length, 2);
}

{
  // The spinner's range, as in DiagonalsPanel.
  equal("the smallest polygon is a square", D.create(2).n, 4);
  equal("and the largest a 40-gon", D.create(99).n, 40);
}

done("diagonals");
