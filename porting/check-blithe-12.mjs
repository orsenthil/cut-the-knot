#!/usr/bin/env node
"use strict";

/*
 * Logic test for blithe-12/blithe-12-core.js.
 *
 *   node porting/check-blithe-12.mjs
 *
 * Checks the five home arrangements, all six circle turns and the permutation
 * display against a second, literal transcription of the applet's bytecode.
 * Then it proves the page's exact claim - "The Blithe12 puzzle is solvable for
 * any starting configuration" - by computing the order of the group generated
 * by the turns (Schreier-Sims), and by actually finding and applying a solving
 * sequence for 100 configurations, one parity per generator included.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("blithe-12/blithe-12-core.js", "Blithe12Core");

/* ------------------------------------------------- literal bytecode references */

const N = 12;
const ID = () => Array.from({ length: N }, (_, i) => i);

/** blithe12game.init(): m_Index, exactly as the bytecode fills it. */
const REF_INDEX = [[], [], []];
REF_INDEX[0] = [0, 3, 7, 8, 5, 1];
REF_INDEX[1] = [1, 4, 8, 9, 6, 2];
REF_INDEX[2] = [4, 7, 10, 11, 9, 5];

/** blithe12game.SetValues(): the home arrangement of each of the five games. */
function refSetValues(mode) {
  const v = new Array(N);
  for (let i = 0; i < N; i++) v[i] = 0;
  switch (mode) {
    case 0:
      for (const i of [0, 3, 2, 6, 10, 11]) v[i] = 0;
      for (const i of [1, 4, 5, 7, 8, 9]) v[i] = 1;
      break;
    case 1:
      for (const i of [0, 3]) v[i] = 0;
      for (const i of [2, 6]) v[i] = 1;
      for (const i of [10, 11]) v[i] = 2;
      for (const i of [1, 4, 5, 7, 8, 9]) v[i] = 6;
      break;
    case 2:
      for (const i of [0, 2, 3, 6, 10, 11]) v[i] = 2;
      for (const i of [1, 8]) v[i] = 3;
      for (const i of [5, 7]) v[i] = 4;
      for (const i of [4, 9]) v[i] = 5;
      break;
    case 3:
      for (const i of [0, 3]) v[i] = 0;
      for (const i of [2, 6]) v[i] = 1;
      for (const i of [10, 11]) v[i] = 2;
      for (const i of [1, 8]) v[i] = 3;
      for (const i of [5, 7]) v[i] = 4;
      for (const i of [4, 9]) v[i] = 5;
      break;
    default:
      // DisplayNumbers() prints RValues[i] itself; these are 1..12.
      for (let i = 0; i < N; i++) v[i] = i + 1;
  }
  return v;
}

/** ShiftM(circle) / ShiftP(circle), each assignment copied from the bytecode. */
function refShift(values, circle, plus) {
  const idx = REF_INDEX[circle];
  const out = values.slice();
  if (plus) {
    const t = out[idx[0]];
    out[idx[0]] = out[idx[1]];
    out[idx[1]] = out[idx[2]];
    out[idx[2]] = out[idx[3]];
    out[idx[3]] = out[idx[4]];
    out[idx[4]] = out[idx[5]];
    out[idx[5]] = t;
  } else {
    const t = out[idx[5]];
    out[idx[5]] = out[idx[4]];
    out[idx[4]] = out[idx[3]];
    out[idx[3]] = out[idx[2]];
    out[idx[2]] = out[idx[1]];
    out[idx[1]] = out[idx[0]];
    out[idx[0]] = t;
  }
  return out;
}

/** Permutation.toCyclesNonSpec() with m_Mode == 2, from its bytecode. */
function refCycles(values) {
  const fromI = (i) => i + 1;
  const fromV = (v) => v - 1;
  const findUnchecked = (checked) => {
    for (let i = 0; i < N; i++) if (!checked[i]) return i;
    return -1;
  };
  const checked = new Array(N).fill(false);
  let text = "";
  for (;;) {
    let i = findUnchecked(checked);
    if (i === -1) break;
    text += "(";
    let first = true;
    for (;;) {
      const member = fromI(i);
      text += first ? String(member) : String(member);
      first = false;
      checked[i] = true;
      i = fromV(values[i]);
      if (checked[i]) break;
    }
    text += ")";
  }
  return text;
}

/** blithe12game.Shift(): which controller turns which circle which way. */
const REF_CONTROLLERS = [
  [0, 0, +1], // counter 1 -> ShiftM(0)
  [3, 0, -1], // counter 4 -> ShiftP(0)
  [2, 1, -1], // counter 3 -> ShiftP(1)
  [6, 1, +1], // counter 7 -> ShiftM(1)
  [10, 2, +1], // counter 11 -> ShiftM(2)
  [11, 2, -1], // counter 12 -> ShiftP(2)
];

/* ---------------------------------------------------- permutation group tools */

const GEN = [
  { circle: 0, dir: +1 }, { circle: 0, dir: -1 },
  { circle: 1, dir: +1 }, { circle: 1, dir: -1 },
  { circle: 2, dir: +1 }, { circle: 2, dir: -1 },
];
const mul = (a, b) => ID().map((_, i) => a[b[i]]);
const inv = (p) => { const q = new Array(N); p.forEach((v, i) => { q[v] = i; }); return q; };
const key = (p) => p.join(",");
const invWord = (w) => w.slice().reverse().map((i) => i ^ 1);
function simplify(w) {
  let out = [];
  for (const i of w) {
    if (out.length && out[out.length - 1] === (i ^ 1)) out.pop();
    else out.push(i);
  }
  return out;
}
/** The position permutation of a turn: counter at i goes to perm[i]. */
function genPerm(g) {
  const p = ID();
  const idx = REF_INDEX[g.circle];
  for (let k = 0; k < 6; k++) {
    // ShiftM puts the counter at k+1 into slot k: it moves backwards along idx.
    const to = g.dir > 0 ? (k + 5) % 6 : (k + 1) % 6;
    p[idx[k]] = idx[to];
  }
  return p;
}

/** Schreier-Sims stabilizer chain and |G| for the six turns. */
function stabilizerChain() {
  let gens = GEN.map((g, i) => ({ p: genPerm(g), w: [i] }));
  const chain = [];
  for (let level = 0; level < N; level++) {
    const base = level;
    const reps = new Map();
    reps.set(base, { p: ID(), w: [] });
    const queue = [base];
    while (queue.length) {
      const x = queue.shift();
      const u = reps.get(x);
      for (const g of gens) {
        const y = g.p[u.p[base]];
        if (!reps.has(y)) {
          reps.set(y, { p: mul(g.p, u.p), w: u.w.concat(g.w) });
          queue.push(y);
        }
      }
    }
    const next = new Map();
    for (const u of reps.values()) {
      for (const g of gens) {
        const v = reps.get(g.p[u.p[base]]);
        const s = mul(inv(v.p), mul(g.p, u.p));
        if (key(s) !== key(ID()) && !next.has(key(s))) {
          next.set(key(s), { p: s, w: simplify(u.w.concat(g.w, invWord(v.w))) });
        }
      }
    }
    chain.push({ base, reps, orbit: reps.size });
    gens = [...next.values()];
  }
  return { chain, order: chain.reduce((n, c) => n * c.orbit, 1) };
}

/** Express a position permutation as a word in the six original turns. */
function express(target, chain) {
  let r = target;
  let word = [];
  for (const { base, reps } of chain) {
    const u = reps.get(r[base]);
    if (!u) return null;
    word = u.w.concat(word);
    r = mul(inv(u.p), r);
  }
  return key(r) === key(ID()) ? simplify(word) : null;
}

/** Home position p -> current position q, for each counter (ties in order). */
function sigmaOf(state) {
  const map = new Array(N);
  for (const v of new Set(state.home)) {
    const hp = [], cp = [];
    for (let i = 0; i < N; i++) {
      if (state.home[i] === v) hp.push(i);
      if (state.values[i] === v) cp.push(i);
    }
    hp.forEach((p, k) => { map[p] = cp[k]; });
  }
  return map;
}
function applyWord(state, word) {
  let s = state;
  for (const i of word) s = C.move(s, GEN[i]);
  return s;
}

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start({});
  equal("the default game is 12 Numbers", s.mode, 4);
  equal("a new game starts at home", s.values, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  check("a new game has made no moves", s.moves === 0);
  check("cycles are hidden off 12 Numbers", C.start({ mode: 0, hint: true }).hint === false);
  check("cycles can be shown on 12 Numbers", C.start({ mode: 4, hint: true }).hint === true);
  check("an out-of-range mode falls back to 12 Numbers", C.start({ mode: 99 }).mode === 4);
  check("there is no win or loss in an illustration", C.result(s) === null && C.result(C.shuffle(s, rng(3))) === null);
}

/* ------------------------------------------- 2. every case, where it is small */

{
  for (let mode = 0; mode < 5; mode++) {
    equal(`home arrangement of game ${mode}`, C.homeValues(mode), refSetValues(mode));
    equal(`start() uses that arrangement (mode ${mode})`, C.start({ mode }).values, refSetValues(mode));
  }
  equal("2-color game really has two colours", [...new Set(C.homeValues(0))].sort(), [0, 1]);
  equal("4-color (middle) uses gray for all six crossings",
    [1, 4, 5, 7, 8, 9].map((i) => C.homeValues(1)[i]), [6, 6, 6, 6, 6, 6]);
  equal("4-color (border) uses one colour for all six outer counters",
    [...new Set([0, 2, 3, 6, 10, 11].map((i) => C.homeValues(2)[i]))], [2]);
  equal("6-color game has three pure circles and three mixed crossings",
    [[0, 3], [2, 6], [10, 11], [1, 8], [5, 7], [4, 9]].map((ix) => C.homeValues(3)[ix[0]]),
    [0, 1, 2, 3, 4, 5]);
  equal("the six counters on each circle match the bytecode", C.CIRCLES, REF_INDEX);
  equal("the six controllers match Shift() in the bytecode", C.CONTROLLERS,
    REF_CONTROLLERS.map(([counter, circle, dir]) => ({ counter, circle, dir })));
  equal("the five option names match the Choice", C.MODE_NAMES, [
    "2 color puzzle", "4 colors puzzle (middle)", "4 colors puzzle (border)", "6 colors puzzle", "12 Numbers",
  ]);
}

{
  const random = rng(20261126);
  let equalM = 0, equalP = 0, roundTrips = 0, orderSix = 0, preserves = 0;
  for (let mode = 0; mode < 5; mode++) {
    let state = C.start({ mode });
    for (let t = 0; t < 120; t++) {
      state = C.shuffle(state, random);
      for (let circle = 0; circle < 3; circle++) {
        for (const dir of [+1, -1]) {
          const got = C.move(state, { circle, dir }).values;
          const want = refShift(state.values, circle, dir === +1);
          if (JSON.stringify(got) === JSON.stringify(want)) (dir === +1 ? equalM++ : equalP++);
          const back = C.move(C.move(state, { circle, dir }), { circle, dir: -dir });
          if (JSON.stringify(back.values) === JSON.stringify(state.values)) roundTrips++;
          let six = state;
          for (let k = 0; k < 6; k++) six = C.move(six, { circle, dir });
          if (JSON.stringify(six.values) === JSON.stringify(state.values)) orderSix++;
          const before = state.values.slice().sort((a, b) => a - b);
          const after = got.slice().sort((a, b) => a - b);
          if (JSON.stringify(before) === JSON.stringify(after)) preserves++;
        }
      }
    }
  }
  check("ShiftM matches the bytecode in 1800 configurations", equalM === 1800, `${equalM}/1800`);
  check("ShiftP matches the bytecode in 1800 configurations", equalP === 1800, `${equalP}/1800`);
  check("every turn is undone by the opposite turn", roundTrips === 3600, `${roundTrips}/3600`);
  check("every turn has order six", orderSix === 3600, `${orderSix}/3600`);
  check("turns only rearrange counters", preserves === 3600, `${preserves}/3600`);
  equal("an illegal turn is refused", C.move(C.start({}), { circle: 3, dir: 1 }), null);
  equal("an illegal direction is refused", C.move(C.start({}), { circle: 0, dir: 0 }), null);
  check("a turn adds one to the move count", C.move(C.start({}), { circle: 0, dir: 1 }).moves === 1);
}

{
  const random = rng(77);
  let cyclesOk = 0;
  for (let mode = 0; mode < 5; mode++) {
    let state = C.start({ mode });
    cyclesOk += C.cycles(state.values) === refCycles(state.values) ? 1 : 0;
    for (let t = 0; t < 60; t++) {
      state = C.shuffle(state, random);
      cyclesOk += C.cycles(state.values) === refCycles(state.values) ? 1 : 0;
    }
  }
  check("the cycle display matches Permutation.toCycles() 305 times", cyclesOk === 305, `${cyclesOk}/305`);
  equal("the identity is twelve one-element cycles", C.cycles(C.start({}).values),
    "(1)(2)(3)(4)(5)(6)(7)(8)(9)(10)(11)(12)");
  equal("a single turn is one 6-cycle", C.cycles(C.move(C.start({}), { circle: 0, dir: +1 }).values),
    "(148962)(3)(5)(7)(10)(11)(12)");
}

/* -------------------------------------- 3. the page's claim: any order can be undone */

{
  const { chain, order } = stabilizerChain();
  const factorial12 = 479001600;
  check("the turns act transitively on all twelve positions", chain[0].orbit === 12);
  check("the orbit sizes are 12, 11, ..., 1", chain.every((c, i) => c.orbit === N - i));
  check("the six turns generate all 12! permutations", order === factorial12, `${order}`);
  check("a 6-cycle is odd, so odd orders are reachable too", GEN.some((g) => {
    const p = genPerm(g);
    let inversions = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (p[i] > p[j]) inversions++;
    return inversions % 2 === 1;
  }));

  const random = rng(1234567);
  let solved = 0;
  for (let mode = 0; mode < 5; mode++) {
    for (let t = 0; t < 20; t++) {
      let state = C.start({ mode });
      state = C.shuffle(state, random);
      state = C.move(state, GEN[Math.floor(random() * 6)]);
      const sigma = sigmaOf(state);
      check(`the home-to-current map is a permutation (mode ${mode}, case ${t})`,
        sigma.slice().sort((a, b) => a - b).join() === ID().join());
      const word = express(inv(sigma), chain);
      check(`a solving word exists (mode ${mode}, case ${t})`, word !== null);
      if (word) {
        const done = applyWord(state, word);
        if (C.isHome(done)) solved++;
      }
    }
  }
  check("100 shuffled configurations were actually solved", solved === 100, `${solved}/100`);
}

{
  const s = C.start({});
  const shuffled = C.shuffle(s, rng(9));
  check("shuffle really changes the order", !C.isHome(shuffled));
  equal("shuffle makes 36 turns", shuffled.moves, 36);
  check("reset restores the home order", C.isHome(C.reset(shuffled)));
  equal("reset clears the move count", C.reset(shuffled).moves, 0);
  const cheated = C.cheat(s);
  equal("cheat swaps only counters 1 and 4", cheated.values,
    [4, 2, 3, 1, 5, 6, 7, 8, 9, 10, 11, 12]);
  check("home is recognised", C.isHome(s) && !C.isHome(cheated));
}

done("blithe-12");
