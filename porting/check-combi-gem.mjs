#!/usr/bin/env node
"use strict";

/*
 * Logic test for combi-gem/combi-gem-core.js.
 *
 *   node porting/check-combi-gem.mjs
 *
 * Three things are checked. (1) The core's computeSums is compared against a
 * second, literal transcription of the applet's Compute2..Compute5 over every
 * size (2..9), every number of summonds (2..5) and both Economize settings, on
 * several collections each time — including negative and repeated values.
 * (2) Every claim on the cut-the-knot page is searched exhaustively: the worked
 * example {2,3,6,9} / {1,4,7,8}; C(k,2) being strictly increasing; and, over
 * ALL multisets of sizes 1..9 drawn from 0..8, the theorem that equal lists of
 * pairwise sums can only happen when n is a power of two. The generalization
 * with s summonds is checked too, including the page's open question about
 * n = 3 and n = 9. (3) The controls, their ranges and the demo's end states.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("combi-gem/combi-gem-core.js", "CombiGemCore");

/* -------------------- a second transcription of the applet's own methods ---- */

// ComputeSums.FormHash(int[]): SortedVectorCI of the indices, then N + "0" for
// each (ComparableInteger.N stays an int, so "00", "10", "20", ...).
function refFormHash(arr) {
  return arr.slice().sort((a, b) => a - b).map((x) => x + "0").join("");
}

// ComputeSums.Compute2(int N, Vector v).
function refCompute2(N, v, econ) {
  const out = [];
  if (econ) {
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) out.push(v[i] + v[j]);
    }
  } else {
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        out.push(v[i] + v[j]);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

// ComputeSums.Compute3(int N, Vector v): skip i == j == k, dedup by FormHash.
function refCompute3(N, v, econ) {
  const out = [];
  const hash = new Set();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        if (k === i && k === j) continue;
        const sum = v[i] + v[j] + v[k];
        if (econ) {
          const h = refFormHash([i, j, k]);
          if (hash.has(h)) continue;
          hash.add(h);
        }
        out.push(sum);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

// ComputeSums.Compute4(int N, Vector v).
function refCompute4(N, v, econ) {
  const out = [];
  const hash = new Set();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        for (let l = 0; l < N; l++) {
          if (l === i && l === j && l === k) continue;
          const sum = v[i] + v[j] + v[k] + v[l];
          if (econ) {
            const h = refFormHash([i, j, k, l]);
            if (hash.has(h)) continue;
            hash.add(h);
          }
          out.push(sum);
        }
      }
    }
  }
  return out.sort((a, b) => a - b);
}

// ComputeSums.Compute5(int N, Vector v).
function refCompute5(N, v, econ) {
  const out = [];
  const hash = new Set();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        for (let l = 0; l < N; l++) {
          for (let m = 0; m < N; m++) {
            if (m === i && m === j && m === k && m === l) continue;
            const sum = v[i] + v[j] + v[k] + v[l] + v[m];
            if (econ) {
              const h = refFormHash([i, j, k, l, m]);
              if (hash.has(h)) continue;
              hash.add(h);
            }
            out.push(sum);
          }
        }
      }
    }
  }
  return out.sort((a, b) => a - b);
}

function refCompute(N, v, s, econ) {
  if (s === 2) return refCompute2(N, v, econ);
  if (s === 3) return refCompute3(N, v, econ);
  if (s === 4) return refCompute4(N, v, econ);
  return refCompute5(N, v, econ);
}

/** All nondecreasing arrays of length n with entries in [0, max] (a multiset). */
function multisets(n, max) {
  const out = [];
  const cur = [];
  (function rec(start, depth) {
    if (depth === n) { out.push(cur.slice()); return; }
    for (let v = start; v <= max; v++) { cur.push(v); rec(v, depth + 1); cur.pop(); }
  })(0, 0);
  return out;
}

function choose(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start({});
  equal("a new collection is the applet's 1, 2, 3, 4", s.nums, [1, 2, 3, 4]);
  equal("a new collection has 4 members", s.n, 4);
  equal("a new collection uses 2 summonds", s.s, 2);
  equal("Economize starts on", s.economize, true);
  equal("the starting list of sums is 3, 4, 5, 5, 6, 7", C.sums(s), [3, 4, 5, 5, 6, 7]);
  check("a demo never wins or loses", C.result(s) === null);
  check("the position is plain JSON", JSON.parse(JSON.stringify(s)).n === 4);
  check("all five moves are legal", C.legalMoves(s).length === 5);
  check("unknown moves are refused", C.move(s, { type: "nonsense" }) === null);
  check("a move with no type is refused", C.move(s, {}) === null);
  check("a null move is refused", C.move(s, null) === null);
  const before = JSON.stringify(s);
  C.move(s, { type: "setNumber", index: 0, delta: 1 });
  C.move(s, { type: "setSize", size: 9 });
  equal("moves do not mutate the position", JSON.stringify(s), before);
}

{
  let s = C.start({});
  s = C.move(s, { type: "setNumber", index: 2, delta: 5 });
  equal("tapping a number's right half adds one at a time", s.nums, [1, 2, 8, 4]);
  s = C.move(s, { type: "setNumber", index: 2, delta: -3 });
  equal("tapping a number's left half subtracts", s.nums, [1, 2, 5, 4]);
  s = C.move(s, { type: "setNumber", index: 2, value: 0 });
  equal("an absolute value of zero is honoured", s.nums[2], 0);
  check("a negative index is refused", C.move(s, { type: "setNumber", index: -1, delta: 1 }) === null);
  check("an index past the visible size is refused", C.move(s, { type: "setNumber", index: 9, delta: 1 }) === null);

  s = C.move(s, { type: "setSize", size: 9 });
  equal("Set size grows to 9", s.n, 9);
  equal("new numbers are filled in as 5, 6, 7, 8, 9", s.nums.slice(4), [5, 6, 7, 8, 9]);
  s = C.move(s, { type: "setSize", size: 2 });
  equal("Set size shrinks to 2", s.n, 2);
  equal("shrinking keeps the hidden numbers, as the applet does", s.nums.length, 9);
  s = C.move(s, { type: "setSize", size: 6 });
  equal("growing again restores the edited hidden numbers", s.nums.slice(2, 6), [0, 4, 5, 6]);

  equal("a size below the range clamps to 2", C.move(s, { type: "setSize", size: 1 }).n, 2);
  equal("a size above the range clamps to 9", C.move(s, { type: "setSize", size: 99 }).n, 9);
  s = C.move(s, { type: "setSummonds", s: 5 });
  equal("#summonds can be set to 5", s.s, 5);
  equal("#summonds below the range clamps to 2", C.move(s, { type: "setSummonds", s: 1 }).s, 2);
  equal("#summonds above the range clamps to 5", C.move(s, { type: "setSummonds", s: 8 }).s, 5);
  s = C.move(s, { type: "setEconomize" });
  equal("Economize toggles off", s.economize, false);
  s = C.move(s, { type: "setEconomize", value: true });
  equal("Economize toggles back on", s.economize, true);
  equal("reset restores the applet's start", C.move(s, { type: "reset" }), C.start({}));
}

/* ------------------------ 2. the applet's own methods, over the whole space */

{
  const random = rng(20261120);
  let compared = 0;
  for (let n = C.MIN_SIZE; n <= C.MAX_SIZE; n++) {
    const rising = [];
    const flat = [];
    const alternating = [];
    for (let i = 0; i < n; i++) {
      rising.push(i + 1);
      flat.push(3);
      alternating.push(i % 2 === 0 ? -2 : 7);
    }
    const vectors = [rising, flat, alternating];
    for (let t = 0; t < 4; t++) {
      vectors.push(Array.from({ length: n }, () => random() * 13 - 4 | 0));
    }
    for (const v of vectors) {
      for (let s = C.MIN_SUMMONDS; s <= C.MAX_SUMMONDS; s++) {
        for (const econ of [true, false]) {
          const want = refCompute(n, v, s, econ);
          const got = C.computeSums(v, s, econ);
          equal(`Compute${s} n=${n} econ=${econ} v=${v.join(",")}`, got, want);
          check(`the printed list is nondecreasing n=${n} s=${s} econ=${econ}`,
            got.every((x, i) => i === 0 || got[i - 1] <= x));
          compared++;
        }
      }
    }
  }
  check("the whole option space was compared", compared === 8 * 7 * 4 * 2);
}

{
  // The exact number of entries the applet adds: one per index multiset when
  // Economize is on (less the all-equal ones), one per ordered tuple otherwise.
  let count = 0;
  for (let n = C.MIN_SIZE; n <= C.MAX_SIZE; n++) {
    for (let s = C.MIN_SUMMONDS; s <= C.MAX_SUMMONDS; s++) {
      const flat = new Array(n).fill(2);
      equal(`Economize entry count n=${n} s=${s}`, C.computeSums(flat, s, true).length, choose(n + s - 1, s) - n);
      equal(`non-Economize entry count n=${n} s=${s}`, C.computeSums(flat, s, false).length, Math.pow(n, s) - n);
      count += 2;
    }
  }
  check("all 64 entry counts were checked", count === 64);
}

/* ------------------------------------------------ 3. the page's claims ---- */

{
  // "A = {2, 3, 6, 9} and B = {1, 4, 7, 8}, then A2 = B2 = {5,8,9,11,12,15}."
  const A = [2, 3, 6, 9];
  const B = [1, 4, 7, 8];
  const want = [5, 8, 9, 11, 12, 15];
  equal("the page's example A2", C.computeSums(A, 2, true), want);
  equal("the page's example B2", C.computeSums(B, 2, true), want);
  equal("A2 = B2 for the page's example", C.computeSums(A, 2, true), C.computeSums(B, 2, true));
  check("A and B really are different", A.join(",") !== B.join(","));

  // "the number C(k,2) = k(k-1)/2 of unordered pairs is strictly increasing."
  for (let k = 1; k < 40; k++) {
    check(`C(k,2) grows from ${k} to ${k + 1}`, C.pairCount(k + 1) > C.pairCount(k));
    equal(`C(k,2) formula at k=${k}`, C.pairCount(k), (k * (k - 1)) / 2);
  }
}

{
  // Exhaustive theorem search: every multiset of size 1..9 drawn from 0..8,
  // grouped by its list of pairwise sums. A collision is only legal at a
  // power of two; the test finds them at 1, 2, 4 and 8 and nowhere else.
  const groupsFound = new Map();
  for (let n = 1; n <= C.MAX_SIZE; n++) {
    const groups = new Map();
    for (const a of multisets(n, 8)) {
      const key = JSON.stringify(C.computeSums(a, 2, true));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    }
    let collisions = 0;
    for (const arr of groups.values()) if (arr.length > 1) collisions++;
    groupsFound.set(n, collisions);
    check(`n=${n}: every collision has n a power of two`, collisions === 0 || C.isPowerOfTwo(n));
    if (n === 1 || n === 2 || n === 4 || n === 8) {
      check(`n=${n}: a power of two does have collisions`, collisions > 0);
    } else {
      equal(`n=${n}: no distinct A, B with A2 = B2`, collisions, 0);
    }
  }
  check("the search actually covered all nine sizes", groupsFound.size === 9);
}

{
  // The page's induction: if A2 = B2 then A' = A + (B+m) and B' = B + (A+m)
  // also have equal pairwise sums, doubling the common size.
  let A = [1, 4];
  let B = [2, 3];
  const m = 10;
  equal("base pair A2 = B2", C.computeSums(A, 2, true), C.computeSums(B, 2, true));
  for (const size of [4, 8]) {
    const Ap = A.concat(B.map((x) => x + m));
    const Bp = B.concat(A.map((x) => x + m));
    equal(`induction at size ${size}: A2 = B2`, C.computeSums(Ap, 2, true), C.computeSums(Bp, 2, true));
    check(`induction at size ${size}: the collections differ`, Ap.join(",") !== Bp.join(","));
    equal(`induction at size ${size}: the size doubled`, Ap.length, size);
    check(`induction at size ${size}: n is a power of two`, C.isPowerOfTwo(Ap.length));
    A = Ap; B = Bp;
  }
}

{
  // The generalization: the derivation yields n^(s-1) = s^(k-1), so the
  // smallest integer n is s itself and the next (for s = 3) is s^2 = 9.
  for (let s = 2; s <= C.MAX_SUMMONDS; s++) {
    for (let k = 1; k <= 9; k++) {
      const n = Math.pow(s, (k - 1) / (s - 1));
      if (Number.isInteger(n)) {
        check(`n^(s-1) = s^(k-1) at s=${s} k=${k}`, Math.abs(Math.pow(n, s - 1) - Math.pow(s, k - 1)) < 1e-9);
      }
    }
  }
  for (const s of [2, 3, 4, 5]) {
    const n = Math.pow(s, (s - 1) / (s - 1)); // k = s in n^(s-1) = s^(k-1)
    check(`n = s is a candidate at s=${s}`, Number.isInteger(n) && n === s &&
      Math.abs(Math.pow(n, s - 1) - Math.pow(s, s - 1)) < 1e-9);
  }
  equal("the next candidate for s = 3 is n = 9", Math.pow(3, (5 - 1) / (3 - 1)), 9);

  // The page's open question: "try A3 = B3 for n = 3 or n = 9 (or think of
  // whether this is at all possible)". An exhaustive search answers it: n = 3
  // works, and the page's guess "A = B provided n is a power of s" is false.
  const found = [];
  for (const a of multisets(3, 8)) {
    const key = JSON.stringify(C.computeSums(a, 3, true));
    for (const b of multisets(3, 8)) {
      if (a.join(",") >= b.join(",")) continue;
      if (key === JSON.stringify(C.computeSums(b, 3, true))) found.push([a, b]);
    }
  }
  check("n = 3 does admit distinct A, B with the same A3", found.length > 0);
  if (found.length) {
    const [a, b] = found[0];
    equal("an explicit A3 = B3 example matches", C.computeSums(a, 3, true), C.computeSums(b, 3, true));
    check("n = 3 is a power of s = 3, yet A differs from B", 3 === Math.pow(3, 1) && a.join(",") !== b.join(","));
  }
  for (let n = 1; n <= 9; n++) {
    check(`n=${n} power-of-two helper`, C.isPowerOfTwo(n) === (n === 1 || n === 2 || n === 4 || n === 8));
  }
}

/* --------------------------------- 4. the words the page shows the player - */

{
  const s = C.start({});
  const d = C.describe(s);
  check("the status sentence names A", /A = \{1, 2, 3, 4\}/.test(d.text));
  check("the status sentence names A2", /A₂ has 6 sums/.test(d.text));
  check("the status sentence lists the sums", /3, 4, 5, 5, 6, 7/.test(d.text));
  equal("the sentence agrees with the tally", d.count, d.sums.length);
  check("distinct sums are counted honestly", d.distinct === new Set(d.sums).size);

  const big = C.move(s, { type: "setSize", size: 9 });
  const ds = C.describe(C.move(big, { type: "setSummonds", s: 5 }));
  check("a long list is truncated for the status line", /…/.test(ds.text));
  check("the full list is still available", ds.sums.length > 20);
  check("every status sentence is in words", [s, big, C.move(s, { type: "setEconomize" })].every((x) => /[a-z]{3}/.test(C.describe(x).text)));
}

done("combi-gem");
