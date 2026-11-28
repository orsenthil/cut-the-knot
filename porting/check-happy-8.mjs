#!/usr/bin/env node
"use strict";

/*
 * Logic test for happy-8/happy-8-core.js.
 *
 *   node porting/check-happy-8.mjs
 *
 * Four independent things are checked:
 *   1. The core's six moves are compared, over every reachable arrangement at
 *      n = 4, 6, 8 (24, 720 and 40320 arrangements) and over many random ones
 *      at every size up to 14, with a second, literal transcription of the
 *      six Shift* methods from happy8game's bytecode (including their odd
 *      fix-up assignments at index 0 and M-1).
 *   2. The page's claims: the six control counters are 1, 8, 7, 3, 4, 5;
 *      upper controls turn clockwise and lower ones counterclockwise; the
 *      "Cycles" box shows the current permutation, not its inverse; and the
 *      theorem about which arrangements r and l can reach. The group orders
 *      are computed exactly by Schreier-Sims for every size 4..14. Here the
 *      theorem fails at six counters: <r,l> has 120 elements, not 720.
 *   3. The rules' edges: size buttons, Shuffle, Cheat, Home detection and the
 *      end-of-play status the page uses.
 *   4. A second transcription of Permutation.toCycles (mode 0) compared with
 *      the core's cycle notation on random arrangements at every size.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("happy-8/happy-8-core.js", "Happy8Core");
const SIZES = [4, 6, 8, 10, 12, 14];

/* ------------------------------------------- 1. literal bytecode transcription */

/*
 * happy8game.Shift* in the applet's own loop order. The decompiler prints
 * iastore operands in stack order, i.e. values[index] = values[...]: the
 * fix-ups at 0 and M-1 are easy to get wrong, hence this separate version.
 */
function appletShift(values, n, M, op) {
  const v = values.slice();
  let t, i;
  switch (op) {
    case "ShiftLeftP": // lower-left control, l
      t = v[M - 1];
      for (i = M - 1; i > 0; i--) v[i] = v[i - 1];
      v[0] = t;
      break;
    case "ShiftLeftM": // upper-left control, L
      t = v[0];
      for (i = 0; i < M - 1; i++) v[i] = v[i + 1];
      v[M - 1] = t;
      break;
    case "ShiftRightP": // lower-right control, r
      t = v[0];
      for (i = n; i >= M; i--) {
        if (i === n) v[0] = v[i - 1];
        else v[i] = v[i - 1];
      }
      v[M - 1] = t;
      break;
    case "ShiftRightM": // upper-right control, R
      t = v[0];
      for (i = M - 1; i < n; i++) {
        if (i === M - 1) v[0] = v[i];
        else v[i - 1] = v[i];
      }
      v[n - 1] = t;
      break;
    case "ShiftCircularP": // upper middle control, W
      t = v[0];
      for (i = 0; i < n - 1; i++) v[i] = v[i + 1];
      v[n - 1] = t;
      break;
    case "ShiftCircularM": // lower middle control, w
      t = v[n - 1];
      for (i = n - 1; i > 0; i--) v[i] = v[i - 1];
      v[0] = t;
      break;
    default:
      throw new Error("unknown shift " + op);
  }
  return v;
}

const METHOD = { l: "ShiftLeftP", L: "ShiftLeftM", r: "ShiftRightP", R: "ShiftRightM", w: "ShiftCircularM", W: "ShiftCircularP" };

function same(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/* ---------------------------------------------------- the start and the moves */

{
  for (const n of SIZES) {
    const s = C.start({ n });
    equal(`home at ${n} counters`, s.values, C.home(n));
    check(`home at ${n} starts un-finished`, C.result(s) === null);
    check(`home at ${n} has counter n at seat 0`, s.values[0] === n);
    equal(`six moves at ${n}`, C.legalMoves(s), C.MOVES);
    check(`every move is allowed at ${n}`, C.MOVES.every((m) => C.move(s, m) !== null));
    check(`an unknown move is refused at ${n}`, C.move(s, "x") === null);
    check(`home is recognised at ${n}`, C.isHome(s.values, n));
  }
  check("the size buttons start at 8", C.start({}).n === 8);
  check("fewer than four counters is clamped", C.start({ n: 2 }).n === 4);
  check("more than fourteen counters is clamped", C.start({ n: 16 }).n === 14);
  check("an odd size is rounded up", C.start({ n: 7 }).n === 8);
  check("each circle has n/2+1 counters at 8", C.halfCount(8) === 5);
  check("the two circles share two counters at 8", 2 * C.halfCount(8) - 2 === 8);
}

/* --------------------------- 2. core against bytecode over all small layouts */

for (const n of [4, 6, 8]) {
  const M = C.halfCount(n);
  const start = C.home(n);
  const seen = new Set([start.join(",")]);
  const queue = [start];
  let compared = 0, bad = 0;
  while (queue.length) {
    const v = queue.shift();
    for (const m of C.MOVES) {
      const expected = appletShift(v, n, M, METHOD[m]);
      const actual = C.move({ n, values: v, moves: 0, solved: false }, m).values;
      if (!same(actual, expected)) bad++;
      compared++;
      const key = expected.join(",");
      if (!seen.has(key)) { seen.add(key); queue.push(expected); }
    }
  }
  check(`all ${compared} moves at n=${n} match the applet's loops`, bad === 0, `${bad} wrong`);
  check(`every arrangement at n=${n} is a permutation`, [...seen].every((k) => {
    const v = k.split(",").map(Number);
    return v.slice().sort((a, b) => a - b).every((x, i) => x === i + 1);
  }));
  check(`the number of arrangements at n=${n} is the group order`, [[4, 24], [6, 720], [8, 40320]]
    .find(([x]) => x === n)[1] === seen.size, `got ${seen.size}`);
}

/* Random arrangements at the larger sizes, against the same transcription. */
{
  const random = rng(20261127);
  for (const n of [10, 12, 14]) {
    const M = C.halfCount(n);
    let bad = 0;
    for (let trial = 0; trial < 200; trial++) {
      const v = C.home(n);
      for (let k = n - 1; k > 0; k--) {
        const j = Math.floor(random() * (k + 1));
        const t = v[k]; v[k] = v[j]; v[j] = t;
      }
      for (const m of C.MOVES) {
        if (!same(C.move({ n, values: v, moves: 0, solved: false }, m).values,
          appletShift(v, n, M, METHOD[m]))) bad++;
      }
    }
    check(`1200 random moves at n=${n} match the applet's loops`, bad === 0, `${bad} wrong`);
  }
}

/* ------------------------------------------------ 3. the page's control claims */

{
  const n = 8, M = C.halfCount(n), labels = C.home(n);
  // The order in which the page lists them: upper-left, upper crossing,
  // upper-right, lower-left, lower crossing, lower-right.
  const listed = [1, 0, n - 1, M - 2, M - 1, M];
  equal("the six control counters are 1, 8, 7, 3, 4, 5",
    listed.map((i) => labels[i]), [1, 8, 7, 3, 4, 5]);
  const seats = C.controlSeats(n);
  equal("the six moves sit on the seats the Shift hit test checks", seats,
    { l: 3, r: 5, w: 4, L: 1, R: 7, W: 0 });
  for (const m of C.MOVES) {
    check(`seat of ${m} really triggers ${m}`, C.moveAt(seats[m], n) === m);
  }
  // Upper controls are the clockwise ones; lower controls turn counterclockwise.
  const upper = ["L", "R", "W"], lower = ["l", "r", "w"];
  check("upper counters turn clockwise", upper.every((m) => C.CLOCKWISE[m]));
  check("lower counters turn counterclockwise", lower.every((m) => !C.CLOCKWISE[m]));
  check("the upper seats are above the crossing on the left/right circles",
    upper.every((m) => {
      const i = seats[m];
      const a = i === 0 || i === 1 || i === M - 1 || i === M - 2
        ? Math.PI / M + i * (2 * Math.PI / M)
        : Math.PI + Math.PI / M + (i - M + 1) * (2 * Math.PI / M);
      return Math.sin(a) > 0;
    }));
  check("the lower seats are below the crossing",
    lower.every((m) => {
      const i = seats[m];
      const a = i === 0 || i === 1 || i === M - 1 || i === M - 2
        ? Math.PI / M + i * (2 * Math.PI / M)
        : Math.PI + Math.PI / M + (i - M + 1) * (2 * Math.PI / M);
      return Math.sin(a) < 0;
    }));
  check("l and L are inverse at 8", same(C.move(C.move(C.start({ n: 8 }), "l"), "L").values, C.home(8)));
  check("r and R are inverse at 8", same(C.move(C.move(C.start({ n: 8 }), "r"), "R").values, C.home(8)));
  check("w and W are inverse at 8", same(C.move(C.move(C.start({ n: 8 }), "w"), "W").values, C.home(8)));
  check("five left turns return a circle to where it was",
    same(Array.from({ length: 5 }).reduce((v) => appletShift(v, 8, 5, "ShiftLeftP"), C.home(8)), C.home(8)));
}

/* ------------------------------------------------------ 4. Shuffle and Cheat */

{
  const random = rng(42);
  const s = C.start({ n: 8 });
  const shuffled = C.shuffle(s, random);
  check("Shuffle keeps all eight counters", shuffled.values.slice().sort((a, b) => a - b)
    .every((x, i) => x === i + 1));
  check("Shuffle usually changes the arrangement", !same(shuffled.values, s.values));
  check("Shuffle does not claim a finished play", shuffled.solved === false);
  check("Shuffle restarts the move count", shuffled.moves === 0);
  check("the original position was not changed", same(s.values, C.home(8)));
  // The applet's tableswitch is 0..5 = l, r, w, R, W, L.
  const pick = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
  let k = 0;
  const scripted = C.shuffle(s, () => pick[k++] / 6);
  let literal = s.values.slice();
  for (const p of pick) literal = appletShift(literal, 8, 5, METHOD[["l", "r", "w", "R", "W", "L"][p]]);
  check("Shuffle's random table matches the bytecode tableswitch", same(scripted.values, literal));

  const cheated = C.cheat(s);
  equal("Cheat swaps counters 1 and 2", [cheated.values[1], cheated.values[2]], [2, 1]);
  check("Cheat leaves the other seats alone",
    cheated.values.every((v, i) => i === 1 || i === 2 || v === s.values[i]));
  check("Cheat makes an odd arrangement", C.parity(cheated.values) === 1);
  check("Home has even parity", C.parity(C.home(8)) === 0);
  for (const n of SIZES) {
    const random2 = rng(n * 7);
    let wrong = 0;
    const state = C.start({ n });
    for (let i = 0; i < 100; i++) {
      let v = C.shuffle(state, random2).values;
      const M = C.halfCount(n);
      for (const m of C.MOVES) {
        const before = C.parity(v);
        v = C.move({ n, values: v, moves: 0, solved: false }, m).values;
        const step = (M - 1) % 2; // parity of an M-cycle
        const expected = (m === "w" || m === "W") ? (n - 1) % 2 : step;
        if (C.parity(v) !== (before + expected) % 2) wrong++;
      }
    }
    check(`parity of every move is the parity of its cycle at n=${n}`, wrong === 0, `${wrong} wrong`);
  }
}

/* ----------------------------------------------------- 5. the finished state */

{
  for (const n of SIZES) {
    const s = C.start({ n });
    check(`a single press at ${n} is not Home`, C.result(C.move(s, "l")) === null);
    let back = s;
    for (const m of C.MOVES) back = C.move(back, m);
    check(`doing all six moves at ${n} is not Home`, C.result(back) === null);
    const undone = C.move(C.move(s, "w"), "W");
    check(`w then W at ${n} ends the play as "done"`, C.result(undone) === "done");
    check(`the result line has no win or loss at ${n}`,
      C.result(undone) !== "win" && C.result(undone) !== "lose");
    check(`the move count is kept at ${n}`, C.move(s, "l").moves === 1);
    check("Home itself is not marked finished", C.isHome(s.values, n) && !C.result(s));
  }
}

/* ------------------------------- 6. the "Cycles" display (second transcription) */

// Permutation.toCyclesNonSpec, m_Mode = 0, transcribed from the bytecode.
function appletCycles(n, values) {
  const used = new Array(n).fill(false);
  let out = "";
  const fromI = (i) => (i === 0 ? n : i);
  const fromV = (v) => (v === n ? 0 : v);
  const find = () => {
    for (let i = 1; i <= n; i++) {
      const j = i === n ? 0 : i;
      if (!used[j]) return j;
    }
    return -1;
  };
  let i = find();
  while (i !== -1) {
    out += "(";
    let first = true;
    do {
      if (first) { out += "" + fromI(i); first = false; }
      else out += "" + fromI(i);
      used[i] = true;
      i = fromV(values[i]);
    } while (!used[i]);
    out += ")";
    i = find();
  }
  return out;
}

{
  const random = rng(99);
  for (const n of SIZES) {
    // Mode 0 prints every seat, including one-seat cycles, with no separators.
    const fixed = Array.from({ length: n }, (_, i) => `(${i + 1})`).join("");
    check(`Home prints ${n} one-seat cycles`, C.cycles(C.start({ n })) === fixed);
    let wrong = 0;
    for (let t = 0; t < 100; t++) {
      const state = C.shuffle(C.start({ n }), random);
      if (C.cycles(state) !== appletCycles(n, state.values)) wrong++;
    }
    check(`100 cycle strings at ${n} match Permutation.toCycles`, wrong === 0, `${wrong} wrong`);
  }
  // A 3-cycle counter-clockwise: counter 1 -> seat 2, 2 -> seat 3, 3 -> seat 1.
  const v = C.home(8);
  [v[1], v[2], v[3]] = [3, 1, 2];
  equal("a 3-cycle is printed in cycle notation", C.cycles({ n: 8, values: v }),
    "(132)(4)(5)(6)(7)(8)");
  // The inverse has reversed cycles, so the page's "needed to solve" wording
  // describes the current shuffle, not the moves that undo it.
  check("the displayed cycles are the current arrangement, not its inverse",
    C.cycles({ n: 8, values: v }) !== C.cycles({ n: 8, values: [v[0], v[3], v[2], v[1], ...v.slice(4)] }));
}

/* --------------------- 7. the theorem: exact group orders by Schreier-Sims */

function identity(n) { return Array.from({ length: n }, (_, i) => i); }
function compose(a, b) { return a.map((_, i) => a[b[i]]); } // apply b, then a
function inverse(p) { const q = []; p.forEach((v, i) => { q[v] = i; }); return q; }
function isIdentity(p) { return p.every((v, i) => v === i); }
function mapFromCycle(n, seats) {
  const p = identity(n);
  for (let k = 0; k < seats.length; k++) p[seats[k]] = seats[(k + 1) % seats.length];
  return p;
}
function literalGenerators(n) {
  const M = Math.floor(n / 2) + 1;
  return {
    l: mapFromCycle(n, Array.from({ length: M }, (_, i) => i)),
    r: mapFromCycle(n, [0, M - 1, ...Array.from({ length: n - M }, (_, i) => M + i)]),
    w: mapFromCycle(n, Array.from({ length: n }, (_, i) => i)),
  };
}
/** Exact order of <generators> on n points (a plain Schreier-Sims orbit tower). */
function groupOrder(n, generators) {
  let level = generators.slice();
  let order = 1;
  for (let beta = 0; beta < n; beta++) {
    const transversal = new Map([[beta, identity(n)]]);
    const stack = [beta];
    while (stack.length) {
      const x = stack.pop();
      for (const g of level) {
        const y = g[x];
        if (!transversal.has(y)) { transversal.set(y, compose(g, transversal.get(x))); stack.push(y); }
      }
    }
    if (transversal.size === 1) continue;
    order *= transversal.size;
    const next = new Map();
    for (const [x, ux] of transversal) {
      for (const g of level) {
        const h = compose(compose(inverse(transversal.get(g[x])), g), ux);
        if (!isIdentity(h)) next.set(h.join(","), h);
      }
    }
    level = [...next.values()];
    if (!level.length) break;
  }
  return order;
}
function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
function orbitOnPairs(n, generators) {
  const seen = new Set(), stack = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) {
    seen.add(a + ":" + b); stack.push([a, b]);
  }
  while (stack.length) {
    const [a, b] = stack.pop();
    for (const g of generators) {
      const x = [g[a], g[b]], key = x.join(":");
      if (!seen.has(key)) { seen.add(key); stack.push(x); }
    }
  }
  return seen.size;
}

{
  const g = literalGenerators(8);
  equal("the core's generators are the applet's cycles", C.generators(8), g);
  for (const n of SIZES) {
    const pageN = n / 2 - 1;
    const { l, r, w } = literalGenerators(n);
    const lr = groupOrder(n, [l, r]);
    const lrw = groupOrder(n, [l, r, w]);
    check(`<l,r> is 2-transitive at ${n}`, orbitOnPairs(n, [l, r]) === n * (n - 1));
    check(`<l,r,w> is 2-transitive at ${n}`, orbitOnPairs(n, [l, r, w]) === n * (n - 1));
    if (pageN % 2 === 1) {
      check(`n=${pageN} odd: <l,r> is every even permutation at ${n}`, lr === factorial(n) / 2, `got ${lr}`);
      check(`n=${pageN} odd: adding w gives every permutation at ${n}`, lrw === factorial(n), `got ${lrw}`);
    } else if (n === 6) {
      // The page's theorem says S_6 here. It is false: these two 4-cycles
      // generate a group of order 120, one fifth of all arrangements.
      check("n=2 even: the page's claim fails at 6 counters", lr === 120, `got ${lr}`);
      check("n=2 even: adding w still gives all 720 arrangements at 6", lrw === 720, `got ${lrw}`);
      check("n=2 even: six counters have unsolvable-by-l,r arrangements", lr < factorial(n));
    } else {
      check(`n=${pageN} even: <l,r> is every permutation at ${n}`, lr === factorial(n), `got ${lr}`);
      check(`n=${pageN} even: <l,r,w> is every permutation at ${n}`, lrw === factorial(n), `got ${lrw}`);
    }
  }
  check("an odd shuffle has the same cycle lengths as its inverse",
    (() => {
      const v = C.home(8);
      [v[1], v[2], v[3]] = [3, 1, 2];
      const invV = C.home(8);
      [invV[1], invV[2], invV[3]] = [2, 3, 1];
      return C.cycles({ n: 8, values: v }).length === C.cycles({ n: 8, values: invV }).length;
    })());
}

done("happy-8");
