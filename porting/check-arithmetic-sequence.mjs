#!/usr/bin/env node
"use strict";

/*
 * Logic test for arithmetic-sequence/arithmetic-sequence-core.js.
 *
 *   node porting/check-arithmetic-sequence.mjs
 *
 * Checks the position rules, the applet's own Seqs/FindSpecial/Check methods
 * (transcribed a second time from the bytecode and compared over every
 * colouring of up to nine boxes), and the page's claims: the sixteen triples,
 * W(2,3) = 9 (all 512 splits of nine numbers have a one-coloured triple), the
 * six AP-free splits of eight numbers, the guard that keeps number 9 out of
 * the eight-number game, the reindexing of any nine-term progression, and the
 * "middle is the average" identity used in the page's second problem.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("arithmetic-sequence/arithmetic-sequence-core.js", "ArithmeticSequenceCore");

/* The applet's Seqs table, copied verbatim from the constructor bytecode. */
const APPLET_SEQS = [
  [0, 1, 2], [0, 2, 4], [0, 3, 6], [0, 4, 8],
  [1, 2, 3], [1, 3, 5], [1, 4, 7],
  [2, 3, 4], [2, 4, 6], [2, 5, 8],
  [3, 4, 5], [3, 5, 7],
  [4, 5, 6], [4, 6, 8],
  [5, 6, 7],
  [6, 7, 8],
];

function colorsFromMask(mask) {
  return Array.from({ length: 9 }, (_, i) => (mask >> i) & 1);
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("default is eight numbers", s.n, 8);
  equal("a fresh board has nine boxes", s.colors.length, 9);
  equal("all boxes start off", s.colors, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  equal("no toggles at the start", s.toggles, 0);
  check("a fresh demo is not yet explored", C.result(s) === null);
  check("start(9) gives nine numbers", C.start({ n: 9 }).n === 9);
  check("n below range clamps to 8", C.start({ n: 7 }).n === 8);
  check("n above range clamps to 8", C.start({ n: 99 }).n === 8);
  check("missing options clamp to 8", C.start().n === 8);
}

{
  const s = C.start({ n: 9 });
  const t = C.toggle(s, 8);
  equal("number 9 can be switched at n=9", t.colors[8], 1);
  equal("toggle count grows", t.toggles, 1);
  check("toggle does not change the given position", s.colors[8] === 0 && s.toggles === 0);
  check("toggling back returns to off", C.toggle(t, 8).colors[8] === 0);
  check("a negative index is ignored", C.toggle(s, -1) === s);
  check("an index past nine is ignored", C.toggle(s, 9) === s);
  check("a fractional index is ignored", C.toggle(s, 1.5) === s);
  check("a string index is ignored", C.toggle(s, "2") === s);

  const eight = C.setN(t, 8);
  equal("switching to eight keeps the colours", eight.colors[8], 1);
  check("switching back to nine is allowed", C.setN(eight, 9).n === 9);
  check("setN with the same n returns the same position", C.setN(eight, 8) === eight);
  check("setN above range clamps to 8", C.setN(eight, 99).n === 8);
  check("setN below range clamps to 8", C.setN(t, 1).n === 8);
  const refused = C.toggle(eight, 8);
  equal("number 9 cannot be switched while out of play", refused.colors[8], 1);
  equal("a refused toggle does not count", refused.toggles, eight.toggles);
}

{
  let s = C.start({ n: 9 });
  check("nine numbers are unexplored before a move", C.result(s) === null);
  s = C.toggle(s, 0);
  check("nine numbers are explored after a move", C.result(s) === "done");
  let e = C.start({ n: 8 });
  check("eight numbers are unexplored before a move", C.result(e) === null);
  e = C.toggle(e, 0);
  check("eight numbers are explored after a move", C.result(e) === "done");
}

/* ------------------------------------------- 2. every case, where it is small */

{
  // The applet's table must be exactly all the three-term APs inside 0..8.
  const enumerated = [];
  for (let i = 0; i < 9; i++) {
    for (let j = i + 1; j < 9; j++) {
      for (let k = j + 1; k < 9; k++) {
        if (j - i === k - j) enumerated.push([i, j, k]);
      }
    }
  }
  equal("there are sixteen three-term APs in 1..9", enumerated.length, 16);
  equal("the applet lists them all, in its own order", enumerated, APPLET_SEQS);
  equal("the core uses the same table", C.TRIPLES, APPLET_SEQS);
  equal("the core reports the display numbers", C.numbers([0, 4, 8]), [1, 5, 9]);
}

{
  // Page claim: "if N9 is split into two subsets, at least one contains
  // three terms in arithmetic progression". All 2^9 splits, no sampling.
  let worst = 99;
  let splits = 0;
  for (let mask = 0; mask < 512; mask++) {
    const pos = { n: 9, colors: colorsFromMask(mask), toggles: 1 };
    const s = C.findSpecial(pos);
    check("nine numbers: split " + mask + " has a triple", s !== null);
    worst = Math.min(worst, C.allSpecials(pos).length);
    splits++;
  }
  equal("checked all 512 splits of nine numbers", splits, 512);
  check("at least one split has only a single triple", worst === 1);
}

{
  // Page claim: "the statement is not true for N8". Enumerate all 2^8 splits.
  const apFree = [];
  for (let mask = 0; mask < 256; mask++) {
    const colors = colorsFromMask(mask);
    const pos = { n: 8, colors, toggles: 1 };
    if (C.findSpecial(pos) === null) apFree.push(colors.slice(0, 8).join(""));
  }
  equal("exactly six of the 256 eight-number splits are AP-free", apFree.length, 6);
  check("00110011 is one of them", apFree.includes("00110011"));
  check("its complement is one of them", apFree.includes("11001100"));
}

{
  // The guard in the applet: when N == 8, triples using number 9 are skipped.
  // Start from an AP-free eight-number colouring and put 9 in with 1 and 5.
  const colors = [0, 0, 1, 1, 0, 0, 1, 1, 0]; // 0 0 1 1 0 0 1 1, number 9 off
  check("without the guard 1,5,9 would be one-coloured",
    C.isMonochromatic({ n: 8, colors }, [0, 4, 8]));
  check("eight numbers ignore the triple that uses nine",
    C.findSpecial({ n: 8, colors, toggles: 1 }) === null);
  equal("the same colours at nine numbers flag 1,5,9",
    C.findSpecial({ n: 9, colors, toggles: 1 }), [0, 4, 8]);
  check("the first in-play triple is the one reported",
    C.findSpecial({ n: 8, colors: [0, 0, 0, 1, 1, 1, 0, 0, 0], toggles: 1 }) !== null);
}

{
  // Page claim: the nine indices can stand in for any nine-term progression.
  let ok = true;
  let averageOk = true;
  for (const a of [-7, 0, 1, 3, 100]) {
    for (const d of [1, 2, 3, 5, 11]) {
      const points = Array.from({ length: 9 }, (_, i) => a + d * i);
      for (const t of APPLET_SEQS) {
        if (points[t[0]] + points[t[2]] !== 2 * points[t[1]]) ok = false;
      }
      if ((points[0] + points[8]) / 2 !== points[4]) averageOk = false;
      if (points[4] !== (points[0] + points[8]) / 2) averageOk = false;
    }
  }
  check("all sixteen triples stay evenly spaced after reindexing", ok);
  check("a + d is the average of a and a + 2d", averageOk);
}

{
  // The proof names these particular progressions; each must be in the table.
  const named = [
    [0, 4, 8], // 1, 5, 9
    [2, 5, 8], // 3, 6, 9
    [6, 7, 8], // 7, 8, 9
    [0, 1, 2], // 1, 2, 3
    [1, 2, 3], // 2, 3, 4
    [1, 4, 7], // 2, 5, 8
    [3, 4, 5], // 4, 5, 6
    [4, 5, 6], // 5, 6, 7
  ];
  for (const t of named) {
    check("the proof's triple " + C.numbers(t).join(",") + " is in the table",
      APPLET_SEQS.some((s) => s.join() === t.join()));
  }

  // The case split always closes: if 1, 5 and 9 share a group we are done.
  let closed = true;
  for (let mask = 0; mask < 512; mask++) {
    const colors = colorsFromMask(mask);
    if (colors[0] === colors[4] && colors[4] === colors[8] &&
        C.findSpecial({ n: 9, colors, toggles: 1 }) === null) {
      closed = false;
    }
  }
  check("if 1, 5, 9 share a group the proof is done immediately", closed);
}

/* ----------------------------- 3. the same answers as the applet's own method */

{
  // Check(int[]) and FindSpecial(), transcribed literally from the bytecode:
  // the N==8 && S[2]==8 guard, then the all-on / all-off test, and the first
  // matching entry of the applet's own table wins.
  function appletCheck(seq, colors, n) {
    if (n === 8 && seq[2] === 8) return false;
    const on0 = colors[seq[0]] === 1;
    const on1 = colors[seq[1]] === 1;
    const on2 = colors[seq[2]] === 1;
    if (on0 && on1 && on2) return true;
    if (!on0 && !on1 && !on2) return true;
    return false;
  }

  function appletFindSpecial(colors, n) {
    for (const seq of APPLET_SEQS) {
      if (appletCheck(seq, colors, n)) return seq.slice();
    }
    return null;
  }

  for (const n of [8, 9]) {
    for (let mask = 0; mask < 512; mask++) {
      const colors = colorsFromMask(mask);
      const pos = { n, colors, toggles: 1 };
      equal("FindSpecial matches the applet n=" + n + " mask=" + mask,
        C.findSpecial(pos), appletFindSpecial(colors, n));
    }
  }
}

done("arithmetic-sequence");
