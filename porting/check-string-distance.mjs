#!/usr/bin/env node
"use strict";

/*
 * Logic test for string-distance/string-distance-core.js.
 *
 *   node porting/check-string-distance.mjs
 *
 * 1. The page's example: H("abc", "bca") = 3, L("abc", "bca") = 2.
 * 2. Over every string of length 0..4 on the letters a, b (and many random
 *    longer ones on a, b, c): L is the true fewest number of single-letter
 *    edits (breadth-first search over edits), the edits read back from the
 *    table really turn s into t, both distances are metrics (zero only for
 *    equal strings, symmetric, triangle inequality), and L <= H for equal
 *    lengths.
 * 3. The applet's messages, case folding and the list of reports.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("string-distance/string-distance-core.js", "StringDistanceCore");

equal("H(abc, bca) = 3", C.hamming("abc", "bca"), 3);
equal("L(abc, bca) = 2", C.levenshtein("abc", "bca"), 2);

const words = [""];
for (let len = 1; len <= 4; len++) for (let k = 0; k < 2 ** len; k++) words.push(k.toString(2).padStart(len, "0").replace(/0/g, "a").replace(/1/g, "b"));

{
  // BFS distances from each word, with edits inside strings of length <= 5
  const alphabet = ["a", "b"];
  const neighbours = (w) => {
    const out = new Set();
    for (let i = 0; i <= w.length; i++) for (const c of alphabet) if (w.length < 5) out.add(w.slice(0, i) + c + w.slice(i));
    for (let i = 0; i < w.length; i++) { out.add(w.slice(0, i) + w.slice(i + 1)); for (const c of alphabet) out.add(w.slice(0, i) + c + w.slice(i + 1)); }
    out.delete(w);
    return out;
  };
  let bfsOK = true, pairs = 0;
  for (const s of words) {
    const dist = new Map([[s, 0]]); let q = [s];
    while (q.length) { const nq = []; for (const w of q) for (const v of neighbours(w)) if (!dist.has(v)) { dist.set(v, dist.get(w) + 1); nq.push(v); } q = nq; }
    for (const t of words) { pairs++; if (dist.get(t) !== C.levenshtein(s, t)) bfsOK = false; }
  }
  check(`L is the fewest edits, for all ${pairs} pairs of a,b-strings up to length 4`, bfsOK);
}

{
  // replaying an alignment: the from-letters spell s, the to-letters spell t
  const replay = (al) => [al.map((x) => x[1]).join(""), al.map((x) => x[2]).join("")];
  const R = rng(3);
  const rand = () => Array.from({ length: Math.floor(R() * 8) }, () => "abc"[Math.floor(R() * 3)]).join("");
  let editsOK = true, metric = true, lessH = true;
  for (let k = 0; k < 3000; k++) {
    const s = rand(), t = rand(), r = rand();
    const al = C.alignment(s, t), [from, to] = replay(al);
    if (from !== s || to !== t || al.filter((x) => x[0] !== "keep").length !== C.levenshtein(s, t)) editsOK = false;
    if (al.some((x) => (x[0] === "keep") !== (x[1] === x[2]))) editsOK = false;
    const L = (x, y) => C.levenshtein(x, y);
    if ((L(s, t) === 0) !== (s === t) || L(s, t) !== L(t, s) || L(s, t) > L(s, r) + L(r, t)) metric = false;
    const u = rand().padEnd(s.length, "a").slice(0, s.length);
    const H = C.hamming(s, u);
    if ((H === 0) !== (s === u) || H !== C.hamming(u, s)) metric = false;
    const v = rand().padEnd(s.length, "b").slice(0, s.length);
    if (C.hamming(s, v) > C.hamming(s, u) + C.hamming(u, v)) metric = false;
    if (C.levenshtein(s, u) > H) lessH = false;
  }
  check("the alignment read back from the table turns s into t in exactly L edits", editsOK);
  check("both distances are metrics (3,000 random triples)", metric);
  check("for equal lengths L <= H", lessH);
}

{
  equal("Hamming on different lengths: the applet's two messages", C.report("abc", "ab", "hamming").join(" | "), "Strings are of different lengths! | Please use Levenshtein's distance!");
  equal("case is ignored unless asked", `${C.hamming("ABC", "abc")} ${C.hamming("ABC", "abc", true)}`, "0 3");
  equal("the report keeps the strings as typed", C.report("Kitten", "sitting", "levenshtein")[0], 'L("Kitten", "sitting") = 3');
  equal("kitten to sitting in three edits", C.edits("kitten", "sitting").join("; "), 'replace "k" with "s"; replace "e" with "i"; insert "g"');
  equal("the table's corners", JSON.stringify([C.table("ab", "")[2][0], C.table("", "abc")[0][3]]), "[2,3]");
  let st = C.start();
  st = C.doIt(st, "abc", "bca");
  st = C.doIt({ ...st, method: "levenshtein" }, "abc", "bca");
  equal("each Do it! adds to the list", st.lines.join(" | "), 'H("abc", "bca") = 3 | L("abc", "bca") = 2');
  equal("empty strings", `${C.hamming("", "")} ${C.levenshtein("", "")}`, "0 0");
}

done("string-distance");
