#!/usr/bin/env node
"use strict";

/*
 * Logic test for trans-example/trans-example-core.js.
 *
 *   node porting/check-trans-example.mjs
 *
 * 1. The rules: start, modes, adding/refusing shuttles, Remove last, Reset,
 *    changing the pole count, and the end of a play (every bottom labelled).
 * 2. The page's claims, exhaustively for small boards: different tops always
 *    reach different bottoms, and every shuttle is crossed by exactly two
 *    itineraries, once in each direction. Every relative placement of up to
 *    3 shuttle heights is tried for 2..5 poles (matchings per height level),
 *    plus 2 levels for 6 poles and random taller boards.
 * 3. The core against a second, literal transcription of the applet's
 *    CollectItinerary/GetNext (ordered bars, first H > y) and against the
 *    independent top-down transposition model, over all those boards.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("trans-example/trans-example-core.js", "TransExampleCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("default is 5 poles", s.n, 5);
  equal("starts in draw mode", s.mode, "draw");
  equal("no shuttles", s.bars.length, 0);
  check("a new game is not over", C.result(s) === null);
  equal("pole count clamps low", C.start({ n: 1 }).n, 2);
  equal("pole count clamps high", C.start({ n: 99 }).n, 20);

  // A shuttle between poles 0 and 2 at height 0.5.
  const s1 = C.addBar(s, 0, 2, 0.5);
  check("add a shuttle", s1 !== null && s1.bars.length === 1);
  check("same pole refused", C.addBar(s, 1, 1, 0.5) === null);
  check("off the board refused", C.addBar(s, 0, 5, 0.5) === null);
  check("height 0 refused", C.addBar(s, 0, 1, 0) === null);
  check("height 1 refused", C.addBar(s, 0, 1, 1) === null);
  check("occupied start pole refused", C.addBar(s1, 0, 3, 0.5) === null);
  check("occupied end pole refused", C.addBar(s1, 3, 2, 0.5) === null);
  check("occupied() agrees", C.occupied(s1, 2, 0.5) && !C.occupied(s1, 1, 0.5));
  check("same height on other poles is fine", C.addBar(s1, 1, 3, 0.5) !== null);
  check("other height on same poles is fine", C.addBar(s1, 0, 2, 0.6) !== null);

  // Remove last drops the newest shuttle only.
  const s2 = C.addBar(s1, 1, 3, 0.7);
  const s3 = C.removeLast(s2);
  equal("remove last keeps the older shuttle", s3.bars, [{ a: 0, b: 2, h: 0.5 }]);
  check("remove last on empty board refused", C.removeLast(s) === null);

  // Verify: with one shuttle 0-2, top 0 ends at bottom 2 and back.
  const v = C.setMode(s1, "verify");
  equal("verify mode", v.mode, "verify");
  const t0 = C.trace(v, 0);
  equal("top 0 reaches bottom 2", t0.itinerary.to, 2);
  equal("bottom 2 labelled 1", t0.labels[2], 1);
  equal("walk points", t0.itinerary.points, [
    { pole: 0, h: 0 }, { pole: 0, h: 0.5 }, { pole: 2, h: 0.5 }, { pole: 2, h: 1 }
  ]);
  const t2 = C.trace(t0, 2);
  equal("top 2 reaches bottom 0", t2.itinerary.to, 0);
  equal("earlier label stays", t2.labels[2], 1);
  check("not done until every bottom is labelled", C.result(t2) === null);
  let all = t2;
  for (const p of [1, 3, 4]) all = C.trace(all, p);
  equal("all bottoms labelled", all.labels, [3, 2, 1, 4, 5]);
  equal("play ends done", C.result(all), "done");

  // Back to draw clears labels and itinerary; Reset also returns to draw.
  const d = C.setMode(all, "draw");
  check("draw clears labels", d.labels.every(l => l === 0));
  check("draw clears itinerary", d.itinerary === null);
  check("draw keeps shuttles", d.bars.length === 1);
  const r = C.reset(all);
  equal("reset clears shuttles", r.bars.length, 0);
  equal("reset returns to draw", r.mode, "draw");
  check("reset is not over", C.result(r) === null);

  // Changing the pole count clears the board but keeps the mode.
  const n7 = C.setPoles(all, 7);
  equal("new pole count", n7.n, 7);
  equal("count change clears shuttles", n7.bars.length, 0);
  equal("count change keeps mode", n7.mode, "verify");
  equal("bare line goes straight down", C.itineraryOf(C.start({ n: 3 }), 1).to, 1);
}

/* ------------------------- 2. the page's claims, exhaustively where small */

// All matchings (sets of disjoint pairs, possibly empty) of n poles.
function matchings(n) {
  const out = [];
  const rec = (free, pairs) => {
    if (free.length === 0) { out.push(pairs); return; }
    const a = free[0];
    const rest = free.slice(1);
    rec(rest, pairs); // a stays unmatched
    for (const b of rest) {
      rec(rest.filter(x => x !== b), pairs.concat([[a, b]]));
    }
  };
  rec(Array.from({ length: n }, (_, i) => i), []);
  return out;
}

// A board is a list of height levels, top to bottom, each a matching.
// Only the order of heights matters (ties can only occur between disjoint
// pairs, which is exactly one matching), so this covers every placement.
function boardFromLevels(n, levels) {
  let s = C.start({ n });
  const L = levels.length;
  levels.forEach((pairs, i) => {
    const h = (i + 1) / (L + 1);
    for (const [a, b] of pairs) {
      s = C.addBar(s, a, b, h);
      if (s === null) throw new Error("legal board refused");
    }
  });
  return s;
}

// The applet's own method, transcribed literally: bars ordered by height per
// pole (InsertBarIntoVector), GetNext takes the first with H > y, and
// CollectItinerary walks down, crossing to GetOtherPole at each bar.
function appletTrace(n, bars, startPole) {
  const ordered = [];
  for (let p = 0; p < n; p++) {
    ordered[p] = bars.filter(b => b.a === p || b.b === p).sort((x, y) => x.h - y.h);
  }
  const getNext = (p, y) => {
    for (const b of ordered[p]) if (b.h > y) return b;
    return null;
  };
  let p = startPole, y = 0, crosses = 0;
  const used = [];
  for (;;) {
    const bar = getNext(p, y);
    if (bar === null) break;
    used.push({ bar, dir: bar.a === p ? "ab" : "ba" });
    const other = bar.a === p ? bar.b : bar.a;
    p = other;
    y = bar.h;
    crosses++;
  }
  return { to: p, used, crosses };
}

// Independent model: read shuttles top down, each swaps the two labels.
function transpositionBottoms(n, bars) {
  const labels = Array.from({ length: n }, (_, i) => i);
  for (const b of bars.slice().sort((x, y) => x.h - y.h)) {
    const t = labels[b.a]; labels[b.a] = labels[b.b]; labels[b.b] = t;
  }
  // labels[p] is the top index now at bottom p; invert to top -> bottom.
  const out = new Array(n);
  labels.forEach((top, p) => { out[top] = p; });
  return out;
}

let boards = 0;
function checkBoard(n, levels) {
  const s = boardFromLevels(n, levels);
  const perm = C.permutation(s);
  boards++;

  // Claim 1: different tops always end at different bottoms.
  check(`n=${n} board ${boards}: bottoms are all different`,
    new Set(perm).size === n, JSON.stringify(perm));

  // Claim 2: every shuttle is crossed by exactly two itineraries, one each
  // way; and the core's walk matches the applet's own method.
  const uses = new Map(s.bars.map(b => [b, []]));
  for (let p = 0; p < n; p++) {
    const walk = C.itineraryOf(s, p);
    const ref = appletTrace(n, s.bars, p);
    equal(`n=${n} board ${boards} top ${p}: same bottom as applet method`, walk.to, ref.to);
    equal(`n=${n} board ${boards} top ${p}: same crossings`,
      walk.points.length, 2 + 2 * ref.crosses);
    for (const u of ref.used) uses.get(u.bar).push(u.dir);
  }
  for (const [b, dirs] of uses) {
    check(`n=${n} board ${boards}: shuttle ${b.a}-${b.b} crossed once each way`,
      dirs.length === 2 && dirs.includes("ab") && dirs.includes("ba"),
      JSON.stringify(dirs));
  }

  // The transposition model gives the same permutation.
  equal(`n=${n} board ${boards}: matches top-down swaps`, perm, transpositionBottoms(n, s.bars));

  // Tracing every pole labels every bottom exactly once, and ends the play.
  let v = C.setMode(s, "verify");
  for (let p = 0; p < n; p++) v = C.trace(v, p);
  check(`n=${n} board ${boards}: every bottom labelled once`,
    v.labels.slice().sort((a, b) => a - b).join() === Array.from({ length: n }, (_, i) => i + 1).join());
  equal(`n=${n} board ${boards}: done after verifying all`, C.result(v), "done");
}

// Exhaustive: every sequence of up to 3 non-empty height levels, n = 2..5;
// up to 2 levels for n = 6. Empty levels add nothing, so skip them.
for (let n = 2; n <= 5; n++) {
  const ms = matchings(n).filter(m => m.length > 0);
  for (const m1 of ms) {
    checkBoard(n, [m1]);
    for (const m2 of ms) {
      checkBoard(n, [m1, m2]);
      for (const m3 of ms) checkBoard(n, [m1, m2, m3]);
    }
  }
}
{
  const ms = matchings(6).filter(m => m.length > 0);
  for (const m1 of ms) {
    checkBoard(6, [m1]);
    for (const m2 of ms) checkBoard(6, [m1, m2]);
  }
}
check("exhaustive boards covered", boards >= 20000, String(boards));

// Taller random boards, including the maximum pole count.
{
  const rand = rng(20261116);
  const randomMatching = n => {
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const pairs = [];
    for (let i = 0; i + 1 < n; i += 2) {
      if (rand() < 0.7) pairs.push([idx[i], idx[i + 1]]);
    }
    if (pairs.length === 0) pairs.push([idx[0], idx[1]]);
    return pairs;
  };
  for (let trial = 0; trial < 300; trial++) {
    const n = 2 + Math.floor(rand() * 19);
    const levels = [];
    const count = 1 + Math.floor(rand() * 8);
    for (let i = 0; i < count; i++) levels.push(randomMatching(n));
    checkBoard(n, levels);
  }
}

done("trans-example");