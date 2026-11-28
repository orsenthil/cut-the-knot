#!/usr/bin/env node
"use strict";

/*
 * Logic test for lucky7/lucky7-core.js.
 *
 *   node porting/check-lucky7.mjs
 *
 * The first half is a second, literal transcription of the applet's own
 * shift methods (lucky7game.ShiftLeftM, ShiftRightP, ..), Reshuffle, Cheat,
 * Shift's hit tests and Permutation.toCyclesNonSpec in mode IgnoreZero, and
 * compares it with the core over every reachable position for sizes 3, 5
 * and 7 and over thousands of generated positions for 9, 11 and 13.
 *
 * The second half checks the page's claims: the BFS reachability counts,
 * Wilson's parity split, the exact permutations in Bogomolny's proof (n, m,
 * cmc^-1, ncmc^-1 and the c^k conjugates), and the Cheat button.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("lucky7/lucky7-core.js", "Lucky7Core");

const SIZE = [3, 5, 7, 9, 11, 13];
const factorial = (n) => { let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };

/* ------------------------------------------------------------------ *
 * The applet's own methods, transcribed a second time. These mutate a
 * plain object, exactly as the Java methods mutate lucky7game.m_Values.
 * ------------------------------------------------------------------ */

function appletStart(n) {
  return {
    n: n,
    m: Math.floor((n + 1) / 2) + 1, // m_M in reset()
    values: Array.from({ length: n + 1 }, (_, i) => i),
    justFinished: false,
  };
}

function shiftLeftM(s) { // click at XC[1]
  const held = s.values[1];
  for (let k = 1; k < s.m - 1; k++) s.values[k] = s.values[k + 1];
  s.values[s.m - 1] = held;
  return true;
}
function shiftRightP(s) { // click at XC[m]
  const held = s.values[s.n];
  for (let k = s.n; k > s.m - 1; k--) s.values[k] = s.values[k - 1];
  s.values[s.m - 1] = held;
  return true;
}
function shiftRightM(s) { // click at XC[n]
  const held = s.values[s.m - 1];
  for (let k = s.m - 1; k < s.n; k++) s.values[k] = s.values[k + 1];
  s.values[s.n] = held;
  return true;
}
function shiftLeftP(s) { // click at XC[m-2]
  const held = s.values[s.m - 1];
  for (let k = s.m - 1; k > 1; k--) s.values[k] = s.values[k - 1];
  s.values[1] = held;
  return true;
}
function shiftCircularP(s) { // click at XC[0]
  const held = s.values[1];
  for (let k = 1; k < s.n; k++) s.values[k] = s.values[k + 1];
  s.values[s.n] = held;
  return true;
}
function shiftCircularM(s) { // click at XC[m-1]
  const held = s.values[s.n];
  for (let k = s.n; k > 1; k--) s.values[k] = s.values[k - 1];
  s.values[1] = held;
  return true;
}

const APPLET = {
  leftM: shiftLeftM,
  rightP: shiftRightP,
  rightM: shiftRightM,
  leftP: shiftLeftP,
  circP: shiftCircularP,
  circM: shiftCircularM,
};

/** The order of the distance tests in lucky7game.Shift(Point). */
function appletHit(n, index) {
  const m = Math.floor((n + 1) / 2) + 1;
  const order = [[1, "leftM"], [n, "rightM"], [0, "circP"],
    [m - 2, "leftP"], [m, "rightP"], [m - 1, "circM"]];
  for (const [at, id] of order) if (at === index) return id;
  return null;
}

/** Shift()'s finish test, which it runs only after a successful shift. */
function appletShift(s, id) {
  const did = APPLET[id](s);
  if (did) {
    s.justFinished = true;
    for (let k = 0; k <= s.n; k++) if (s.values[k] !== k) s.justFinished = false;
  }
  return s;
}

/** lucky7game.Reshuffle(): 2n shifts, floor(random()*6) in switch order. */
const SHUFFLE_SWITCH = ["leftP", "rightP", "circM", "rightM", "circP", "leftM"];
function appletShuffle(s, random) {
  for (let k = 0; k < 2 * s.n; k++) {
    const choice = Math.min(5, Math.floor(random() * 6));
    APPLET[SHUFFLE_SWITCH[choice]](s);
  }
  s.justFinished = false;
  return s;
}

/** lucky7game.Cheat(): swap values[1] and values[2]; no finish test. */
function appletCheat(s) {
  const held = s.values[1];
  s.values[1] = s.values[2];
  s.values[2] = held;
  return s;
}

/** Permutation.toCyclesNonSpec() with SetMode(1), i.e. IgnoreZero. */
function appletCycles(s) {
  const n = s.n;
  const checked = new Array(n + 1).fill(false);
  checked[0] = true;
  let out = "";
  const findUnchecked = () => {
    for (let k = 1; k <= n; k++) if (!checked[k]) return k;
    return -1;
  };
  let i = findUnchecked();
  while (i !== -1) {
    out += "(";
    let first = true;
    do {
      out += (first ? "" : " ") + (i === 0 ? n : i);
      first = false;
      checked[i] = true;
      const v = s.values[i];
      i = v === n ? 0 : v; // fromV(): the top counter stands for the hole
    } while (!checked[i]);
    out += ")";
    i = findUnchecked();
  }
  return out;
}

/** Ordinary cycle notation, used for the page's proof (no IgnoreZero trick). */
function plainCycles(values) {
  const n = values.length - 1;
  const seen = new Array(n + 1).fill(false);
  let out = "";
  for (let i = 1; i <= n; i++) {
    if (seen[i]) continue;
    let k = i, first = true;
    out += "(";
    do {
      out += (first ? "" : " ") + k;
      first = false;
      seen[k] = true;
      k = values[k];
    } while (!seen[k]);
    out += ")";
  }
  return out;
}

const toCore = (s) => ({ n: s.n, values: s.values.slice(), solved: s.justFinished, moves: 0 });
const key = (values) => values.slice(1).join(",");
const snapshot = (s) => ({ values: s.values.slice(), solved: s.justFinished });

function randomFrom(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

/** Every permutation reachable from home using the six shift methods. */
function reachable(n) {
  const start = appletStart(n);
  const seen = new Map([[key(start.values), start.values.slice()]]);
  const queue = [start.values.slice()];
  for (let at = 0; at < queue.length; at++) {
    const values = queue[at];
    for (const id of Object.keys(APPLET)) {
      const s = { n: n, m: Math.floor((n + 1) / 2) + 1, values: values.slice(), justFinished: false };
      APPLET[id](s);
      const k = key(s.values);
      if (!seen.has(k)) { seen.set(k, s.values.slice()); queue.push(s.values.slice()); }
    }
  }
  return seen;
}

/* ------------------------------------------------------------ 1. the rules */

for (const n of SIZE) {
  const s = C.start({ n: n });
  check(`start ${n} has ${n} counters and an empty top place`,
    s.values.length === n + 1 && s.values[0] === 0 && s.values.slice(1).every((v, i) => v === i + 1));
  check(`start ${n} is not finished and its result is null`, !s.solved && C.result(s) === null);
}
check("odd sizes are kept, even sizes step down, out-of-range sizes clamp",
  C.normalizeN(4) === 3 && C.normalizeN(12) === 11 && C.normalizeN(2) === 3 && C.normalizeN(99) === 13);
check("the size buttons stop at 3 and 13",
  C.resize(C.start({ n: 3 }), -2).n === 3 && C.resize(C.start({ n: 13 }), 2).n === 13);
check("the applet's middle index m_M and hit-test order match the core",
  SIZE.every((n) => C.middle(n) === Math.floor((n + 1) / 2) + 1 &&
    Array.from({ length: n + 1 }, (_, i) => i).every((i) => C.hitMove(n, i) === appletHit(n, i))));
check("the seven-counter controls sit at places 1, 7, 0, 3, 5, 4",
  C.MOVE_IDS.map((id) => C.controlIndex(7, id)).join(",") === "1,7,0,3,5,4");

/* ----------------------- 2. every shift, against the applet's own methods */

for (const n of SIZE) {
  let ok = true;
  for (const id of C.MOVE_IDS) {
    const a = appletStart(n);
    const b = C.start({ n: n });
    appletShift(a, id);
    const moved = C.move(b, id);
    if (JSON.stringify(snapshot(a)) !== JSON.stringify({ values: moved.values, solved: moved.solved })) ok = false;
  }
  check(`all six shifts from home match the applet at n=${n}`, ok);
}
check("an unknown move is refused without changing the position",
  C.move(C.start({}), "nonsense") === null);
for (const n of [3, 5, 7]) {
  let ok = true;
  for (const [p, q] of [["leftM", "leftP"], ["rightM", "rightP"], ["circP", "circM"]]) {
    let s = C.start({ n: n });
    s = C.move(s, p);
    s = C.move(s, q);
    if (!C.isHome(s.values) || s.solved !== true || C.result(s) !== "done") ok = false;
  }
  check(`each shift undone by its partner returns home at n=${n}`, ok);
}

/* --------------- 3. every reachable position, against the second transcript */

for (const n of [3, 5, 7]) {
  const states = reachable(n);
  let movesOk = true, cyclesOk = true, count = 0;
  for (const values of states.values()) {
    const a0 = appletStart(n);
    a0.values = values.slice();
    const b0 = { n: n, values: values.slice(), solved: false, moves: 0 };
    if (C.cycles(b0) !== appletCycles(a0)) cyclesOk = false;
    for (const id of C.MOVE_IDS) {
      const a = appletStart(n);
      a.values = values.slice();
      appletShift(a, id);
      const b = C.move(b0, id);
      count++;
      if (JSON.stringify(snapshot(a)) !== JSON.stringify({ values: b.values, solved: b.solved })) movesOk = false;
    }
  }
  check(`all ${count} shift results match the applet at n=${n}`, movesOk);
  check(`cycles display matches Permutation.toCycles for all ${states.size} positions at n=${n}`, cyclesOk);
}

/* ---- 4. generated positions for the larger sizes, all six shifts and cycles */

for (const n of [9, 11, 13]) {
  let ok = true, cyclesOk = true;
  for (let seed = 1; seed <= 200; seed++) {
    const random = randomFrom(seed * 7919 + n);
    const a = appletStart(n);
    for (let k = 0; k < 40; k++) APPLET[SHUFFLE_SWITCH[Math.min(5, Math.floor(random() * 6))]](a);
    const b = toCore(a);
    if (C.cycles(b) !== appletCycles(a)) cyclesOk = false;
    for (const id of C.MOVE_IDS) {
      const aa = appletStart(n); aa.values = a.values.slice();
      appletShift(aa, id);
      const bb = C.move(b, id);
      if (JSON.stringify(snapshot(aa)) !== JSON.stringify({ values: bb.values, solved: bb.solved })) ok = false;
    }
  }
  check(`1200 shifts from generated positions match the applet at n=${n}`, ok);
  check(`cycles display matches the applet on 200 positions at n=${n}`, cyclesOk);
}

/* ----------------------- 5. Shuffle and Cheat from the applet's bytecode */

for (const n of SIZE) {
  let shuffleOk = true, cheatOk = true;
  for (let seed = 1; seed <= 30; seed++) {
    const a = appletShuffle(appletStart(n), randomFrom(seed * 104729 + n));
    const b = C.shuffle(C.start({ n: n }), randomFrom(seed * 104729 + n));
    if (JSON.stringify(a.values) !== JSON.stringify(b.values) || b.solved !== false) shuffleOk = false;

    const c = appletCheat(appletStart(n));
    const d = C.cheat(C.start({ n: n }));
    if (JSON.stringify(c.values) !== JSON.stringify(d.values)) cheatOk = false;

    const e = appletCheat(a);
    const f = C.cheat(b);
    if (JSON.stringify(e.values) !== JSON.stringify(f.values)) cheatOk = false;
  }
  check(`Shuffle matches 2n random shifts at n=${n}`, shuffleOk);
  check(`Cheat swaps counters 1 and 2 at n=${n}`, cheatOk);
}
check("Cheat from home shows the transposition (1 2) in the cycles display",
  C.cycles(C.cheat(C.start({ n: 7 }))) === "(1 2)(3)(4)(5)(6)(7)");
check("home shows seven one-element cycles",
  C.cycles(C.start({ n: 7 })) === "(1)(2)(3)(4)(5)(6)(7)");

/* ------------------------------------------- 6. the page's claims, exhaustively */

{
  const r3 = reachable(3), r5 = reachable(5), r7 = reachable(7), r9 = reachable(9);
  check("3 counters: all 6 = 3! arrangements are reachable", r3.size === factorial(3));
  check("5 counters: exactly 60 = 5!/2 arrangements (even only) are reachable", r5.size === factorial(5) / 2);
  check("7 counters: all 5040 = 7! arrangements are reachable", r7.size === factorial(7));
  check("9 counters: exactly 181440 = 9!/2 arrangements (even only) are reachable", r9.size === factorial(9) / 2);

  let oddFound = false, evenOnly = true;
  for (const values of r9.values()) {
    let inversions = 0;
    for (let i = 1; i <= 9; i++) for (let j = i + 1; j <= 9; j++) if (values[i] > values[j]) inversions++;
    if (inversions % 2 === 1) evenOnly = false;
  }
  check("every reachable arrangement at n=9 is an even permutation", evenOnly);

  for (const n of SIZE) {
    const parities = C.MOVE_IDS.map((id) => {
      const s = appletStart(n);
      APPLET[id](s);
      const len = id.startsWith("left") || id.startsWith("right") ? (n + 1) / 2 : n;
      return (len - 1) % 2 === 1 ? "odd" : "even"; // a k-cycle has parity k-1
    });
    const allEven = parities.every((p) => p === "even");
    const someOdd = parities.some((p) => p === "odd");
    check(`generator parity at n=${n}: ${n % 4 === 1 ? "all even" : "at least one odd"}`,
      (n % 4 === 1 && allEven && !someOdd) || (n % 4 === 3 && someOdd));
  }
}

/* ---- 7. Bogomolny's proof: n, m, cmc^-1, ncmc^-1 and the adjacent swaps ---- */

{
  const n = 7;
  const a = (s) => APPLET.leftM(s);
  const b = (s) => APPLET.rightM(s);
  const bi = (s) => APPLET.rightP(s);
  const c = (s) => APPLET.circP(s);
  const ci = (s) => APPLET.circM(s);
  const word = (s, moves) => { for (const g of moves) g(s); return s; };
  const fresh = () => appletStart(n);
  const N_WORD = [a, a, bi, a, a, bi, a, a, b, a, a, b];
  const M_WORD = [a, a, b, a, a, b, a, a, b, a, a, b, a, a, b]; // (aab)^5

  equal("n = aab^-1 aab^-1 aabaab is (1)(2 4)(3)(5)(6 7)",
    word(fresh(), N_WORD).values, [0, 1, 4, 3, 2, 5, 7, 6]);
  check("the proof's n has the page's cycle notation",
    plainCycles(word(fresh(), N_WORD).values) === "(1)(2 4)(3)(5)(6 7)");

  equal("m = (aab)^5 is (1 3)(2)(4)(5)(6)(7)",
    word(fresh(), M_WORD).values, [0, 3, 2, 1, 4, 5, 6, 7]);
  check("the proof's m has the page's cycle notation",
    plainCycles(word(fresh(), M_WORD).values) === "(1 3)(2)(4)(5)(6)(7)");

  const cmci = word(fresh(), [c, ...M_WORD, ci]).values;
  check("cmc^-1 = (1)(2 4)(3)(5)(6)(7)",
    plainCycles(cmci) === "(1)(2 4)(3)(5)(6)(7)");
  const adjacent = word(fresh(), [...N_WORD, c, ...M_WORD, ci]).values;
  check("ncmc^-1 is the single adjacent swap (6 7)",
    plainCycles(adjacent) === "(1)(2)(3)(4)(5)(6 7)");

  let ok = true;
  for (let k = 0; k < 7; k++) {
    const s = fresh();
    for (let t = 0; t < k; t++) c(s);
    word(s, [...N_WORD, c, ...M_WORD, ci]);
    for (let t = 0; t < k; t++) ci(s);
    const p = ((6 + k - 1) % 7) + 1;
    const q = ((7 + k - 1) % 7) + 1;
    const expected = Array.from({ length: 8 }, (_, i) => i);
    expected[p] = q; expected[q] = p;
    if (JSON.stringify(s.values) !== JSON.stringify(expected)) ok = false;
  }
  check("c^k ncmc^-1 c^-k swaps the adjacent pair (6+k, 7+k) for every k", ok);
}

done("lucky7");
