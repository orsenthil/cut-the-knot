#!/usr/bin/env node
"use strict";

/*
<<<<<<< HEAD
 * Logic test for bicolor-hanoi/bicolor-hanoi-core.js.
 *
 * The puzzle: three pegs, two striped towers, two disks of every size (one
 * gold, one red). A disk may land on a bigger disk or on one of its own size,
 * never on a smaller one. Win by making both towers monochrome AND swapping
 * the pegs they stand on.
 *
 * What is checked, and why it is not taken on trust:
 *
 *   1. The opening position is the applet's Reset(): sizes n..1 bottom to top
 *      on the first two pegs, colours alternating, the two towers mirror
 *      images, third peg empty.
 *   2. The move rule is the applet's CanSettle(), which rejects a drop only
 *      when the landing disk is strictly smaller. Equal sizes stack.
 *   3. won() accepts only the swapped goal. In particular it rejects the much
 *      easier "sort the colours where they stand" position, which is what the
 *      puzzle would be without the cut-the-knot page's swap condition, and it
 *      rejects everything on one peg (the condition the applet itself tests,
 *      left over from the single-tower Hanoi applet it was built from).
 *   4. The MINIMUM table the page quotes is re-derived here by breadth-first
 *      search through the core's own legal()/move(), for every size it can be
 *      done quickly for. A table that drifted from the rules would show up.
 *   5. Nathan Bowler's 30-move solution for three sizes, from the solution
 *      page cut-the-knot links to, is replayed move by move: every move must
 *      be legal and it must finish the puzzle. That pins the rules and the
 *      goal to the published solution, and shows the 29 in the table is a
 *      genuine saving rather than a different puzzle.
 *   6. The page's claim that a doubled pile of k sizes moves peg-to-peg in
 *      2^(k+1) - 2 moves is checked by search too.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const H = loadCore("bicolor-hanoi/bicolor-hanoi-core.js", "BicolorHanoi");
const { GOLD, RED } = H;

const show = (state) =>
  state.pegs.map((s) => "[" + s.map((d) => H.sizeOf(d) + "gr"[H.colourOf(d)]).join(" ") + "]").join(" ");

/* ------------------------------------------------- 1. the opening position */

{
  const s = H.start(3);
  equal("start: three pegs", s.pegs.length, 3);
  equal("start: spare peg empty", s.pegs[2], []);
  equal("start: no moves yet", [s.moves, s.history.length], [0, 0]);
  equal("start: the applet's Reset position", show(s), "[3g 2r 1g] [3r 2g 1r] []");

  for (const n of [1, 2, 4, 5, 6]) {
    const t = H.start(n);
    const sizes = (peg) => t.pegs[peg].map(H.sizeOf);
    const down = Array.from({ length: n }, (_, i) => n - i);
    equal(`start n=${n}: left tower sizes descend`, sizes(0), down);
    equal(`start n=${n}: right tower sizes descend`, sizes(1), down);
    const colours = (peg) => t.pegs[peg].map(H.colourOf);
    check(
      `start n=${n}: colours alternate from gold at the bottom left`,
      colours(0).every((c, i) => c === (i % 2 === 0 ? GOLD : RED)),
      colours(0).join("")
    );
    check(
      `start n=${n}: the right tower is the mirror image`,
      colours(1).every((c, i) => c !== colours(0)[i]),
      colours(1).join("")
    );
  }
}

/* ------------------------------------------------------- 2. the move rule */

{
  const s = H.start(2); // [2g 1r] [2r 1g] []
  check("legal: small onto empty", H.legal(s, 0, 2));
  check("legal: size 1 onto size 1 (the applet allows equal sizes)", H.legal(s, 0, 1));
  check("illegal: a peg cannot feed itself", !H.legal(s, 0, 0));
  check("illegal: nothing to lift from an empty peg", !H.legal(s, 2, 0));
  check("illegal: off the board", !H.legal(s, 0, 3) && !H.legal(s, -1, 0));

  check("move: 1r onto the spare peg", H.move(s, 0, 2));
  equal("move: it went where it was sent", show(s), "[2g] [2r 1g] [1r]");
  equal("move: counted", s.moves, 1);
  check("illegal: size 2 onto size 1", !H.legal(s, 0, 2));
  check("illegal: refused moves do not happen", !H.move(s, 0, 2) && s.moves === 1);

  check("undo: steps back", H.undo(s));
  equal("undo: exactly back to the start", show(s), "[2g 1r] [2r 1g] []");
  equal("undo: and the counter with it", [s.moves, s.history.length], [0, 0]);
  check("undo: nothing left to undo", !H.undo(s));
}

/* ------------------------------------------------------ 3. the win condition */

{
  const n = 3;
  const mono = (peg, colour) => [3, 2, 1].map((size) => H.disk(size, colour));

  const swapped = { n, pegs: [mono(0, RED), mono(1, GOLD), []], moves: 0, history: [] };
  check("won: the towers monochrome and swapped", H.won(swapped));

  const inPlace = { n, pegs: [mono(0, GOLD), mono(1, RED), []], moves: 0, history: [] };
  check("not won: monochrome but still on their own pegs", !H.won(inPlace));

  const onSpare = { n, pegs: [[], mono(1, GOLD), mono(2, RED)], moves: 0, history: [] };
  check("not won: a tower parked on the spare peg is not a swap", !H.won(onSpare));

  const allOne = {
    n,
    pegs: [[], [], [3, 3, 2, 2, 1, 1].map((size, i) => H.disk(size, i % 2))],
    moves: 0,
    history: [],
  };
  check("not won: everything on one peg (the applet's own leftover test)", !H.won(allOne));

  check("not won: the opening position", !H.won(H.start(n)));
  check("not won: the opening position at one size either", !H.won(H.start(1)));
}

/* ---------------------------------------- 4. the minimum table, re-derived */

/** Breadth-first search through the core's own rules. */
function minimumBySearch(n) {
  const key = (s) => s.pegs.map((p) => p.join(",")).join("|");
  let frontier = [H.start(n)];
  const seen = new Set([key(frontier[0])]);
  if (H.won(frontier[0])) return 0;
  for (let d = 1; d < 2000; d++) {
    const next = [];
    for (const s of frontier) {
      for (let from = 0; from < 3; from++) {
        for (let to = 0; to < 3; to++) {
          if (!H.legal(s, from, to)) continue;
          const t = H.clone(s);
          H.move(t, from, to);
          const k = key(t);
          if (seen.has(k)) continue;
          seen.add(k);
          if (H.won(t)) return d;
          next.push(t);
        }
      }
    }
    if (!next.length) return Infinity;
    frontier = next;
  }
  return Infinity;
}

{
  equal("minimum table shape", H.MINIMUM.length, H.MAX_SIZES + 1);
  equal("minimum(0): nothing to do", H.minimum(0), 0);
  equal("minimum() off the end is honest", H.minimum(H.MAX_SIZES + 1), null);
  // n = 5 and 6 are in the table from the same search run offline; 1..4 are
  // cheap enough to redo on every verify.
  for (let n = 1; n <= 4; n++) {
    equal(`minimum(${n}) by search`, minimumBySearch(n), H.MINIMUM[n]);
  }
  check("minimum grows with the board", H.MINIMUM.every((v, i) => i === 0 || v > H.MINIMUM[i - 1]));
}

/* ------------------------------- 5. the published 30-move solution replayed */

{
  // https://www.cut-the-knot.org/recurrence/BicolorHanoiSolution.shtml
  const BOWLER =
    "10.12.02.02.01.20.20.21.01.01.02.10.10.12.12.02.02.10.21.21.20.20.10.10.21.02.02.01.20.21";
  const seq = BOWLER.split(".").map((m) => [Number(m[0]), Number(m[1])]);
  equal("Bowler's solution is 30 moves", seq.length, 30);

  const s = H.start(3);
  let illegal = -1;
  seq.forEach(([from, to], i) => {
    if (illegal < 0 && !H.move(s, from, to)) illegal = i;
  });
  equal("every move in it is legal under these rules", illegal, -1);
  check("and it finishes the puzzle", H.won(s), show(s));
  check("so 29 is one move better, not a different puzzle", H.MINIMUM[3] === 29 && 29 < seq.length);
}

/* --------------------------- 6. a doubled pile costs 2^(k+1) - 2 to shift */

{
  /** Fewest moves to shift a pile of two disks of each of k sizes, peg 0 to 2. */
  function pileCost(k) {
    const pegs = [[], [], []];
    for (let size = k; size >= 1; size--) {
      pegs[0].push(H.disk(size, GOLD), H.disk(size, RED));
    }
    const state = { n: k, pegs, moves: 0, history: [] };
    // Equal disks are interchangeable for this question, so key on sizes only.
    const key = (s) => s.pegs.map((p) => p.map(H.sizeOf).join(",")).join("|");
    const done = (s) => s.pegs[0].length === 0 && s.pegs[1].length === 0;
    let frontier = [state];
    const seen = new Set([key(state)]);
    for (let d = 1; d < 500; d++) {
      const next = [];
      for (const s of frontier) {
        for (let from = 0; from < 3; from++) {
          for (let to = 0; to < 3; to++) {
            if (!H.legal(s, from, to)) continue;
            const t = H.clone(s);
            H.move(t, from, to);
            const kk = key(t);
            if (seen.has(kk)) continue;
            seen.add(kk);
            if (done(t)) return d;
            next.push(t);
          }
        }
      }
      if (!next.length) return Infinity;
      frontier = next;
    }
    return Infinity;
  }
  for (let k = 1; k <= 4; k++) {
    equal(`a doubled pile of ${k} sizes shifts in 2^${k + 1} - 2 moves`, pileCost(k), 2 ** (k + 1) - 2);
=======
 * Logic test for bicolor-hanoi/hanoi-core.js.
 *
 * The puzzle: three pegs. Two of them start with a tower of N rings, sizes N
 * down to 1, and the two rings of each size are opposite colours, so the
 * towers are striped the opposite way round. Move one ring at a time, never
 * onto a smaller ring -- but a ring MAY sit on another of its own size, which
 * is what makes this more than two separate Hanois. Get every ring onto the
 * third peg.
 *
 * The core carries a table of the least number of moves for N = 1..8. The
 * table is not taken on trust: an independent breadth-first search here
 * rebuilds it from scratch. The search works on a different representation
 * from the core's -- for each size, how its two rings are split between the
 * three pegs, which is all that matters for legality -- so it is a real second
 * opinion rather than the same code twice. Its answers are then replayed
 * through the core's own move() to be sure the core agrees they are legal and
 * that they finish the puzzle.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("bicolor-hanoi/hanoi-core.js", "HanoiCore");
const sizes = (pegs) => pegs.map((p) => p.map((r) => r.size));
const colors = (pegs) => pegs.map((p) => p.map((r) => r.color));

/* ------------------------------------------------------------- 1. the setup */

{
  equal("the applet's range of N", [H.N_MIN, H.N_MAX, H.N_DEFAULT], [1, 8, 3]);

  const p = H.start(3);
  equal("two towers of 3, biggest at the bottom", sizes(p), [[3, 2, 1], [3, 2, 1], []]);
  // Reset(): the colour flips on every level and the two towers are opposite.
  equal("peg 0 is striped", colors(p)[0], [1, 0, 1]);
  equal("peg 1 is striped the other way", colors(p)[1], [0, 1, 0]);

  for (let n = H.N_MIN; n <= H.N_MAX; n++) {
    const pegs = H.start(n);
    equal(`N=${n}: ${2 * n} rings in all`, pegs.flat().length, 2 * n);
    equal(`N=${n}: the third peg starts empty`, pegs[2].length, 0);
    for (let k = 0; k < n; k++) {
      check(`N=${n} level ${k}: the two rings of a size are opposite colours`,
        pegs[0][k].color !== pegs[1][k].color);
      equal(`N=${n} level ${k}: the sizes match across the towers`, pegs[0][k].size, pegs[1][k].size);
    }
  }
}

/* -------------------------------------------------------- 2. the move rule */

{
  const p = H.start(2); // [[2,1],[2,1],[]]
  equal("a ring may land on an empty peg", sizes(H.move(p, 0, 2)), [[2], [2, 1], [1]]);
  // CanSettle refuses only a strictly smaller landing ring, so same-on-same is fine.
  equal("a ring may sit on another of its own size", sizes(H.move(p, 0, 1)), [[2], [2, 1, 1], []]);
  equal("a bigger ring may not sit on a smaller one", H.moveProblem(H.move(p, 0, 2), 0, 2), "bigger");
  equal("an empty peg has nothing to lift", H.moveProblem(p, 2, 0), "empty");
  equal("a peg is not a move", H.moveProblem(p, 0, 0), "same");
  equal("an illegal move returns null", H.move(p, 2, 0), null);
  equal("move does not mutate its argument", sizes(p), [[2, 1], [2, 1], []]);

  check("the start is not already won", !H.isWon(H.start(3)));
  check("everything on the free peg is a win", H.isWon([[], [], [{ size: 1, color: 0 }]]));
  check("a ring left on peg 1 is not a win", !H.isWon([[], [{ size: 1, color: 0 }], []]));
}

/* ------------------------------------------------- 3. rebuild the move table */

/**
 * Breadth-first search over the whole position space, in its own encoding: one
 * base-6 digit per size saying how that size's two rings are split between the
 * three pegs. The ordering inside a peg is forced (biggest at the bottom), so
 * that split is the entire position.
 */
function shortest(N) {
  const SPLITS = [[2, 0, 0], [0, 2, 0], [0, 0, 2], [1, 1, 0], [1, 0, 1], [0, 1, 1]];
  const CODE = new Map(SPLITS.map((s, i) => [s.join(","), i]));
  const pow = Array.from({ length: N + 1 }, (_, i) => 6 ** i);
  const decode = (code) => Array.from({ length: N }, (_, s) => SPLITS[Math.floor(code / pow[s]) % 6]);
  const encode = (sp) => sp.reduce((k, s, i) => k + CODE.get(s.join(",")) * pow[i], 0);

  const startCode = encode(Array.from({ length: N }, () => [1, 1, 0]));
  const goalCode = encode(Array.from({ length: N }, () => [0, 0, 2]));
  const dist = new Int32Array(pow[N]).fill(-1);
  dist[startCode] = 0;
  let frontier = [startCode];
  let d = 0;
  while (frontier.length && dist[goalCode] === -1) {
    const next = [];
    for (const code of frontier) {
      const sp = decode(code);
      const top = [Infinity, Infinity, Infinity]; // smallest size on each peg
      for (let s = N - 1; s >= 0; s--) for (let p = 0; p < 3; p++) if (sp[s][p] > 0) top[p] = s;
      for (let from = 0; from < 3; from++) {
        const s = top[from];
        if (s === Infinity) continue;
        for (let to = 0; to < 3; to++) {
          if (to === from || (top[to] !== Infinity && top[to] < s)) continue;
          const copy = sp.map((x) => x.slice());
          copy[s][from]--;
          copy[s][to]++;
          const k = encode(copy);
          if (dist[k] === -1) { dist[k] = d + 1; next.push(k); }
        }
      }
    }
    frontier = next;
    d++;
  }
  return dist[goalCode];
}

{
  const rebuilt = [0];
  for (let n = H.N_MIN; n <= H.N_MAX; n++) rebuilt.push(shortest(n));
  equal("the shortest-solution table, rebuilt by breadth-first search", rebuilt, H.OPTIMUM);

  // The numbers the classic puzzle would predict, for contrast: two separate
  // Hanois would be 2^(N+1) - 2, and every one of these is more than that.
  equal("N=1: two single rings, one move each, and 2^2-2 = 2 is exact", H.OPTIMUM[1], 2);
  for (let n = 2; n <= H.N_MAX; n++) {
    check(`N=${n}: ${H.OPTIMUM[n]} is more than two Hanois would suggest (2^(N+1)-2 = ${2 ** (n + 1) - 2})`,
      H.OPTIMUM[n] > 2 ** (n + 1) - 2);
  }

  // And the recurrence the page's math section quotes. It is a pattern read
  // off the search, not a proof; it also holds at N=9, where the search gives
  // 1690 (too slow to redo here, so the table stops at the applet's N=8).
  for (let n = 1; n <= H.N_MAX; n++) {
    equal(`N=${n}: a(n) = 2a(n-1) + ceil(3n/2)`, H.byRecurrence(n), H.OPTIMUM[n]);
  }
}

/* ------------------------------ 4. the search's answers really are playable */

/** Walks a breadth-first path back out of the search and replays it. */
function shortestPath(N) {
  // Re-run the search keeping predecessors, in the core's own representation
  // this time, so what comes out is a list of (from, to) the core accepts.
  const key = (pegs) => pegs.map((p) => p.map((r) => r.size).join(".")).join("|");
  const startPegs = H.start(N);
  const prev = new Map([[key(startPegs), null]]);
  const states = new Map([[key(startPegs), startPegs]]);
  let frontier = [startPegs];
  let goal = null;
  while (frontier.length && !goal) {
    const next = [];
    for (const pegs of frontier) {
      for (const [f, t] of H.legalMoves(pegs)) {
        const after = H.move(pegs, f, t);
        const k = key(after);
        if (prev.has(k)) continue;
        prev.set(k, [key(pegs), f, t]);
        states.set(k, after);
        if (H.isWon(after)) { goal = k; break; }
        next.push(after);
      }
      if (goal) break;
    }
    frontier = next;
  }
  if (!goal) return null;
  const path = [];
  for (let k = goal; prev.get(k); k = prev.get(k)[0]) path.unshift(prev.get(k).slice(1));
  return path;
}

{
  for (let n = 1; n <= 5; n++) {
    const path = shortestPath(n);
    check(`N=${n}: a shortest solution exists`, Array.isArray(path));
    equal(`N=${n}: and it is ${H.OPTIMUM[n]} moves long`, path.length, H.OPTIMUM[n]);
    let pegs = H.start(n);
    let bad = null;
    for (const [f, t] of path) {
      const after = H.move(pegs, f, t);
      if (!after) { bad = `illegal move ${f}->${t}`; break; }
      pegs = after;
    }
    equal(`N=${n}: every move of it is legal`, bad, null);
    check(`N=${n}: and it finishes the puzzle`, H.isWon(pegs));
    equal(`N=${n}: with all ${2 * n} rings on the free peg`, pegs[2].length, 2 * n);
  }
}

/* --------------------------------------- 5. nothing illegal ever slips through */

{
  // Random play from every starting size: a peg must always stay sorted, and
  // no ring may ever end up on a smaller one.
  const rand = rng(31337);
  for (let n = 1; n <= H.N_MAX; n++) {
    let pegs = H.start(n);
    for (let step = 0; step < 600; step++) {
      const moves = H.legalMoves(pegs);
      if (!moves.length) break;
      const [f, t] = moves[Math.floor(rand() * moves.length)];
      pegs = H.move(pegs, f, t);
      for (let p = 0; p < 3; p++) {
        for (let i = 1; i < pegs[p].length; i++) {
          if (pegs[p][i].size > pegs[p][i - 1].size) {
            check(`N=${n}: peg ${p} went out of order at step ${step}`, false);
            step = 1e9;
          }
        }
      }
      if (pegs.flat().length !== 2 * n) {
        check(`N=${n}: a ring went missing at step ${step}`, false);
        break;
      }
    }
    check(`N=${n}: 600 random moves kept every peg sorted`, true);
>>>>>>> 7870066 (Add Bicolor Towers of Hanoi puzzle)
  }
}

done("bicolor-hanoi");
