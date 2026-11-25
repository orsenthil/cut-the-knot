#!/usr/bin/env node
"use strict";

/*
 * Logic test for memory/memory-core.js.
 *
 *   node porting/check-memory.mjs
 *
 * The deal: 20 cards, 10 pairs with equal Ids, Ids 0..29, in every mode, over
 * 300 seeds each. The match rule for every mode and every pair of Ids (the
 * applet's Equals written again). The expression cards, for every Id 0..29 and
 * 200 seeds in each of modes 5, 6 and 7: the expression really comes to the Id
 * (to Id + 3 in Addition), differences have a non-negative smaller part, products
 * use whole factors, quotients divide exactly by 1..10; both cards of a pair
 * show the same value. Then the play: perfect play clears the board in 10
 * turns, a wrong pair turns back, and only two cards are ever up.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("memory/memory-core.js", "MemoryCore");

/* ------------------------------------------------------------ 1. the rules */
{
  equal("5 by 4 cards, ids below 30, 72 shape-colour combinations", [C.COLS, C.ROWS, C.MAX_NUMBER, C.ABS_MAX], [5, 4, 30, 72]);
  equal("eight modes with the applet's captions", [C.MODES.length, C.MODES[0].caption, C.MODES[2].caption, C.MODES[4].caption, C.MODES[7].caption], [8, "Match Count", "Match Shape and Color", "Match Shape, Color and Count", "Match Result of Operations"]);
  equal("the default mode is Shape", C.start({ random: rng(1) }).which, 2);
  equal("clampWhich", [C.clampWhich(-1), C.clampWhich(8), C.clampWhich(5), C.clampWhich("x")], [2, 2, 5, 2]);
  equal("id 29: shape 5, colour 2, count 5", [C.shapeOf(29), C.colourOf(29), C.countOf(29)], [5, 2, 5]);
  equal("id 0: shape 0, colour 0, count 1", [C.shapeOf(0), C.colourOf(0), C.countOf(0)], [0, 0, 1]);
}

/* ------------------------------------------------- 2. the deal, in every mode */
for (let which = 0; which <= 7; which++) {
  let bad = 0, tot = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const s = C.start({ which, random: rng(seed * 31 + which) });
    tot++;
    const ok = s.ids.length === 20 && s.ids.every((v) => Number.isInteger(v) && v >= 0 && v < 30) && s.matched.every((m) => m === false) && s.showing.length === 0 && s.turns === 0;
    // every Id value occurs an even number of times (pairs), and at least ten cards pair up
    const counts = {}; s.ids.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    const pairedUp = Object.values(counts).every((c) => c % 2 === 0);
    // each card has a partner (a different card with the same Id)
    if (!ok || !pairedUp) bad++;
    if (which >= 5 ? s.texts.some((t) => !t) : s.texts.some((t) => t !== null)) bad++;
  }
  equal(`mode ${which}: ${tot} deals are 10 pairs of Ids 0..29 and unmatched`, bad, 0);
}

/* ------------------------------------------- 3. the match rule, every pair of Ids */
{
  const appletEquals = (which, a, b) => {
    if (which === 0) return (a % 5) + 1 === (b % 5) + 1;
    if (which === 1) return (a % 5) + 1 === (b % 5) + 1 && Math.floor(a / 12) === Math.floor(b / 12);
    return a === b;
  };
  let bad = 0, n = 0, symmetric = 0;
  for (let which = 0; which <= 7; which++) for (let a = 0; a < 30; a++) for (let b = 0; b < 30; b++) {
    n++; if (C.equals(which, a, b) !== appletEquals(which, a, b)) bad++;
    if (C.equals(which, a, b) !== C.equals(which, b, a)) symmetric++;
  }
  equal(`the match rule agrees with the applet's Equals for ${n} (mode, Id, Id) cases`, bad, 0);
  equal("matching is symmetric", symmetric, 0);
  equal("mode 0: Ids 5 and 10 match (count 1), 5 and 6 do not", [C.equals(0, 5, 10), C.equals(0, 5, 6)], [true, false]);
  equal("mode 1: Ids 0 and 5 match (count 1, colour 0), 0 and 15 do not (colour 1)", [C.equals(1, 0, 5), C.equals(1, 0, 15)], [true, false]);
  equal("mode 2: only equal Ids match", [C.equals(2, 7, 7), C.equals(2, 7, 19)], [true, false]);
}

/* ------------------------------------------------- 4. the expression cards */
{
  let bad = { value: 0, diff: 0, prod: 0, quot: 0, parse: 0, factor: 0 }, ops = { "+": 0, "-": 0, "*": 0, "/": 0 }, cases = 0;
  const secondFactor = (id) => { if (id <= 1) return 1; for (let d = 2; d < Math.trunc(Math.sqrt(id)); d++) if (id % d === 0) return d; return 1; };
  for (const which of [5, 6, 7]) for (let id = 0; id < 30; id++) for (let seed = 1; seed <= 200; seed++) {
    cases++;
    const e = C.expression(which, id, rng(seed * 977 + id));
    const want = which === 5 ? id + 3 : id;
    ops[e.op]++;
    if (e.value !== want || C.valueOf(e.text) !== want) bad.value++;
    if (C.valueOf(e.text) === null) bad.parse++;
    if (e.op === "-" && !(e.b >= 0 && e.a - e.b === id && e.b <= id / 2)) bad.diff++;
    if (e.op === "*" && !(e.a * e.b === id && Number.isInteger(e.a) && Number.isInteger(e.b))) bad.prod++;
    if (e.op === "/" && !(e.b >= 1 && e.b <= 10 && e.a % e.b === 0 && e.a / e.b === id)) bad.quot++;
    if (C.aFactor(id) !== secondFactor(id)) bad.factor++;
    if (which === 5 && e.op !== "+") bad.value++;
    if (which === 6 && !["+", "-"].includes(e.op)) bad.value++;
  }
  equal(`${cases} expression cards: each comes to its Id (Id + 3 in Addition)`, bad.value, 0);
  equal("differences: a - b = Id with 0 <= b <= Id/2", bad.diff, 0);
  equal("products: whole factors", bad.prod, 0);
  equal("quotients: exact, divisor 1 to 10", bad.quot, 0);
  equal("every expression parses", bad.parse, 0);
  equal("the smallest-factor search agrees with the applet's loop", bad.factor, 0);
  check("all four operations occur in All Ops", Object.values(ops).every((v) => v > 0), JSON.stringify(ops));
  equal("a prime Id has the product 1 times itself", C.aFactor(13), 1);
  equal("the factor of 12 is 2, of 9 is 1 (the loop stops below the root)", [C.aFactor(12), C.aFactor(9)], [2, 1]);
  const s = C.start({ which: 7, random: rng(8) });
  equal("both cards of a pair come to the same value in All Ops", s.ids.every((id, i) => C.valueOf(s.texts[i]) === id), true);
}

/* --------------------------------------------------------------- 5. the play */
{
  const s0 = C.start({ which: 2, random: rng(42) });
  const find = (ids, i, matched) => ids.findIndex((v, j) => j !== i && !matched[j] && v === ids[i]);
  let s = s0, turns = 0;
  for (let i = 0; i < 20 && !C.finished(s); i++) {
    if (s.matched[i]) continue;
    const j = find(s.ids, i, s.matched);
    s = C.flip(s, i); check("first card turns", s !== null);
    s = C.flip(s, j); check("second card turns", s !== null);
    equal("two cards up are to be judged", C.needsJudging(s), true);
    equal("a third card is refused", C.flip(s, [...s0.ids.keys()].find((k) => !s.showing.includes(k) && !s.matched[k])), null);
    s = C.judge(s); turns++;
  }
  equal("perfect play clears the board in 10 turns, one win", [C.finished(s), s.turns, C.result(s)], [true, 10, "win"]);
  // a wrong pair turns back
  const t = C.start({ which: 2, random: rng(43) });
  const a = 0, b = t.ids.findIndex((v, j) => j !== 0 && v !== t.ids[0]);
  let u = C.flip(C.flip(t, a), b);
  u = C.judge(u);
  equal("a wrong pair turns back and counts a turn", [u.showing.length, u.matched.some(Boolean), u.turns], [0, false, 1]);
  equal("flipping the same card twice is refused", C.flip(C.flip(t, 3), 3), null);
  equal("a matched card cannot be turned again", C.flip({ ...t, matched: t.matched.map((_, i) => i === 4) }, 4), null);
  equal("a bad card number", [C.flip(t, -1), C.flip(t, 20), C.flip(t, 1.5)], [null, null, null]);
  equal("judging with fewer than two up is refused", C.judge(C.flip(t, 0)), null);
  equal("the old position is not changed", t.showing, []);
  // in count mode, different shapes with the same count match
  const m = { ...C.start({ which: 0, random: rng(7) }) };
  const ids = m.ids.slice(); ids[0] = 5; ids[1] = 10;
  const v = C.judge(C.flip(C.flip({ ...m, ids }, 0), 1));
  equal("count mode: 5 and 10 (both count 1) match", [v.matched[0], v.matched[1]], [true, true]);
}

done("memory");
