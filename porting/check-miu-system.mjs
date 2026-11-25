#!/usr/bin/env node
"use strict";

/*
 * Logic test for miu-system/miu-system-core.js.
 *
 *   node porting/check-miu-system.mjs
 *
 * The rules on the applet's own examples (MIIII goes to MUI or MIU by rule 3), the
 * button availability, the choice of a place, Remove last and the 10,000 limit.
 * Then the page's answer, that MU is not a theorem: the number of I's is never a
 * multiple of 3 (checked on every theorem reachable by a search of words up to
 * 16 letters) and the search never meets MU.
 * Also what is true: every theorem starts with M and has no other M, and every
 * word M(I|U)* with up to 7 letters after the M whose I count is not a multiple
 * of 3 is reachable. The reachable set is computed independently with the rules
 * written as plain regular-expression style functions.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("miu-system/miu-system-core.js", "MIUCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("one axiom, MI", [s.theorems, s.pending], [["MI"], null]);
  equal("buttons at the start: rules 1 and 2 only, nothing to remove", C.available(s), { rules: [true, true, false, false], remove: false });
  const a = C.press(s, 1);
  equal("rule 1: MI gives MIU, on top of the list", a.theorems, ["MIU", "MI"]);
  const b = C.press(s, 2);
  equal("rule 2: MI gives MII", b.theorems, ["MII", "MI"]);
  equal("rule 1 needs a word ending in I", C.press(a, 1), null);
  equal("rules 3 and 4 need III and UU", [C.press(a, 3), C.press(a, 4)], [null, null]);
  const iiii = { theorems: ["MIIII"], pending: null };
  equal("MIIII has two places for rule 3", C.places("MIIII", 3), [1, 2]);
  const p = C.press(iiii, 3);
  equal("rule 3 on MIIII waits for the player, with every button off", [p.pending, C.available(p)], [{ rule: 3, text: "MIIII" }, { rules: [false, false, false, false], remove: false }]);
  equal("clicking letter 1 gives MUI, letter 2 gives MIU", [C.choose(p, 1).theorems[0], C.choose(p, 2).theorems[0]], ["MUI", "MIU"]);
  equal("a letter that does not start III is refused", [C.choose(p, 0), C.choose(p, 3), C.choose(p, 4)], [null, null, null]);
  equal("buttons are off while choosing", [C.press(p, 2), C.removeLast(p)], [null, null]);
  equal("cancel gives the choice up", C.cancel(p).pending, null);
  equal("one place: rule 3 applies at once", C.press({ theorems: ["MIIIU"], pending: null }, 3).theorems[0], "MUU");
  equal("rule 4 drops UU: MUU gives M, one place", C.press({ theorems: ["MUU"], pending: null }, 4).theorems[0], "M");
  equal("rule 4 on MUUUU asks (places 1, 2, 3) and removes the two letters chosen", [C.places("MUUUU", 4), C.choose(C.press({ theorems: ["MUUUU"], pending: null }, 4), 2).theorems[0]], [[1, 2, 3], "MUU"]);
  equal("rule 2 doubles everything after the M: MIU gives MIUIU", C.press(a, 2).theorems[0], "MIUIU");
  const r = C.removeLast(C.press(a, 2));
  equal("Remove last takes back the newest theorem", r.theorems, ["MIU", "MI"]);
  equal("but never the axiom", C.removeLast(s), null);
  // the limit
  let big = { theorems: ["MI" + "U".repeat(4900)], pending: null };
  const dbl = C.press(big, 2);
  equal("a theorem of 4,902 letters doubles to 9,803, under the limit: (4,902 -> 9,803)", dbl.theorems[0].length, 9803);
  const dbl2 = C.press(dbl, 2);
  equal("a doubled theorem of 19,605 letters is not added (limit 10,000), the list is unchanged", [dbl2.theorems.length, dbl2.theorems[0].length], [2, 9803]);
  equal("the 'MU' flag is off", C.isMU(s), false);
  equal("the applet's three button labels", C.LABELS, ["MxI  => MxIU", "Mx  => Mxx", "MxIIIy  => MxUy", "MxUUy  => Mxy"]);
}

/* ------------- 2. the puzzle: search every word up to 26 letters from MI */
{
  const next = (w) => {
    const out = [];
    if (w.endsWith("I")) out.push(w + "U");
    out.push(w + w.slice(1));
    for (let i = w.indexOf("III"); i >= 0; i = w.indexOf("III", i + 1)) out.push(w.slice(0, i) + "U" + w.slice(i + 3));
    for (let i = w.indexOf("UU"); i >= 0; i = w.indexOf("UU", i + 1)) out.push(w.slice(0, i) + w.slice(i + 2));
    return out;
  };
  const LIMIT = 26;
  const depth = new Map([["MI", 0]]);
  let frontier = ["MI"];
  while (frontier.length) {
    const nf = [];
    for (const w of frontier) for (const n of next(w)) if (n.length <= LIMIT && !depth.has(n)) { depth.set(n, depth.get(w) + 1); nf.push(n); }
    frontier = nf;
  }
  const words = [...depth.keys()];
  const iCount = (w) => [...w].filter((c) => c === "I").length;
  console.log(`  (${words.length.toLocaleString()} theorems of up to ${LIMIT} letters, the longest derivation needing ${[...depth.values()].reduce((a, b) => Math.max(a, b), 0)} steps)`);
  equal("MU is never reached", depth.has("MU"), false);
  equal("the number of I's is never a multiple of 3 (the invariant)", words.filter((w) => iCount(w) % 3 === 0).length, 0);
  equal("every theorem is M then I's and U's: one M, in front", words.every((w) => w[0] === "M" && /^M[IU]*$/.test(w)), true);
  // our core agrees with this independent search on the rules
  let bad = 0;
  for (const w of words.slice(0, 3000)) {
    const mine = [];
    for (const rule of [1, 2, 3, 4]) {
      if (!C.applicable(w, rule)) continue;
      if (rule <= 2) mine.push(C.applyAt(w, rule, 0)); else for (const i of C.places(w, rule)) mine.push(C.applyAt(w, rule, i));
    }
    if (JSON.stringify(mine.sort()) !== JSON.stringify(next(w).sort())) bad++;
  }
  equal("the core's rules give exactly the successors of the independent search (first 3,000 theorems)", bad, 0);
  // what is true: every M(I|U)* word of up to 7 letters after M whose I count is not a multiple of 3
  let missing = [], tested = 0;
  const gen = (n) => { const r = [""]; for (let k = 1; k <= n; k++) for (let m = 0; m < 1 << k; m++) r.push(Array.from({ length: k }, (_, j) => (m >> j & 1 ? "I" : "U")).join("")); return r; };
  for (const x of gen(7)) { const w = "M" + x; if (x.length && iCount(w) % 3 !== 0) { tested++; if (!depth.has(w)) missing.push(w); } }
  equal(`all ${tested} words M(I|U)* of up to 7 letters whose I count is not a multiple of 3 are theorems`, missing.slice(0, 5), []);
  // an invariant proof on each rule
  const ruleKeeps = (w, n) => n.every((v) => iCount(v) % 3 !== 0);
  equal("each rule keeps the I count away from a multiple of 3 (checked on every theorem found)", words.every((w) => ruleKeeps(w, next(w))), true);
}

done("miu-system");
