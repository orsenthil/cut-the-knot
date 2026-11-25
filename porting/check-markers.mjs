#!/usr/bin/env node
"use strict";

/*
 * Logic test for markers/markers-core.js.
 *
 *   node porting/check-markers.mjs
 *
 * The method's promises, checked on every placement of the markers on a short
 * rail (2 and 3 players, every ordered marker position) and on 2,000 random
 * deals for 2..10 players: every player is served exactly once; each piece is
 * exactly one of the player's own N pieces (between consecutive markers of the
 * player, the ends counting), so by that player's own measure it is worth 1/N;
 * the pieces never overlap; and what is left over is exactly the gaps. A second
 * transcription of the applet's loop (the Hashtable of served players, written
 * from the bytecode) is compared on every case. The random deal is the
 * applet's.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("markers/markers-core.js", "MarkersCore");

/* A second transcription of DrawPartition + FindLeastCompetitor. */
function applet(state) {
  const { n, rail, markers } = state;
  const served = {}; // the applet's Hashtable of player -> true
  const out = [];
  for (let k = 0; k < n - 1; k++) {
    let bestP = -1, bestX = 1e9;
    for (let p = 0; p < n; p++) if (served[p] === undefined && markers[p][k] < bestX) { bestP = p; bestX = markers[p][k]; }
    const x0 = k === 0 ? 0 : markers[bestP][k - 1];
    out.push([bestP, x0, markers[bestP][k]]);
    served[bestP] = true;
  }
  let p = 0; while (served[p] !== undefined) p++;
  out.push([p, markers[p][n - 2], rail]);
  return out;
}

function verify(state, label) {
  const d = C.divide(state), { n, rail } = state;
  const errs = [];
  if (d.awards.length !== n) errs.push("count");
  if (new Set(d.awards.map((a) => a.player)).size !== n) errs.push("each player once");
  for (const a of d.awards) {
    const pts = [0, ...state.markers[a.player], rail];
    const ok = pts.some((v, i) => i + 1 < pts.length && pts[i] === a.from && pts[i + 1] === a.to);
    if (!ok) errs.push("piece is one of the player's own " + a.player);
    if (a.to < a.from) errs.push("backwards");
  }
  const segs = d.awards.filter((a) => a.to > a.from).sort((a, b) => a.from - b.from);
  for (let i = 1; i < segs.length; i++) if (segs[i].from < segs[i - 1].to) errs.push("overlap");
  const covered = segs.reduce((t, a) => t + (a.to - a.from), 0);
  if (covered + C.leftover(d) !== rail) errs.push("leftover is the gaps");
  const ap = applet(state);
  if (JSON.stringify(ap) !== JSON.stringify(d.awards.map((a) => [a.player, a.from, a.to]))) errs.push("matches the applet's loop");
  return errs;
}

/* ------------------------------------------------------------ 1. the rules */
{
  equal("clampN", [C.clampN(1), C.clampN(11), C.clampN("4"), C.clampN("x")], [2, 10, 4, 3]);
  const s = C.start({ n: 4, random: rng(2) });
  equal("n players with n-1 markers each", [s.n, s.markers.length, s.markers.every((m) => m.length === 3)], [4, 4, true]);
  equal("markers are whole numbers inside the rail, in order", s.markers.every((m) => m.every((v, i) => Number.isInteger(v) && v >= 0 && v <= 400 && (i === 0 || v >= m[i - 1]))), true);
  // marker i lies in the middle third of the i-th of n-1 equal zones
  const z = 400 / 3;
  equal("each marker is in its zone's middle third", s.markers.every((m) => m.every((v, i) => v >= Math.round(z * (i + 1 / 3)) && v <= Math.round(z * (i + 2 / 3)))), true);
  const t = { n: 3, rail: 400, markers: [[100, 250], [120, 200], [90, 300]] };
  const d = C.divide(t);
  equal("a worked case: player 3 (90) first, then player 2 (second marker 200 beats 250), player 1 last", d.awards.map((a) => [a.player, a.from, a.to]), [[2, 0, 90], [1, 120, 200], [0, 250, 400]]);
  equal("that leaves 0..0, 90..120, 200..250 over", d.left, [[90, 120], [200, 250]]);
  equal("that case keeps every promise", verify(t), []);
  equal("move keeps a marker between its neighbours", [C.move(t, 0, 0, 500).markers[0], C.move(t, 0, 1, 50).markers[0], C.move(t, 0, 1, 999).markers[0]], [[250, 250], [100, 100], [100, 400]]);
  equal("move refuses nonsense", [C.move(t, 5, 0, 1), C.move(t, 0, 2, 1), C.move(t, 0, 0, NaN)], [null, null, null]);
  equal("the old position is unchanged", t.markers[0], [100, 250]);
  equal("result is done", C.result(t), "done");
}

/* -------- 2. every placement on a short rail: 2 players, 3 players */
for (const [n, rail] of [[2, 12], [3, 7]]) {
  let cases = 0, bad = 0, firstBad = null;
  const pos = []; // all non-decreasing marker tuples for one player
  const rec = (arr) => { if (arr.length === n - 1) { pos.push(arr.slice()); return; } for (let v = arr.length ? arr[arr.length - 1] : 0; v <= rail; v++) { arr.push(v); rec(arr); arr.pop(); } };
  rec([]);
  const idx = Array(n).fill(0);
  const total = Math.pow(pos.length, n);
  for (let c = 0; c < total; c++) {
    let x = c; const markers = [];
    for (let p = 0; p < n; p++) { markers.push(pos[x % pos.length]); x = Math.floor(x / pos.length); }
    cases++;
    const errs = verify({ n, rail, markers }, "");
    if (errs.length) { bad++; firstBad = firstBad || JSON.stringify([markers, errs]); }
  }
  equal(`n=${n}, rail ${rail}: all ${cases.toLocaleString()} placements satisfy every promise`, bad, 0);
  if (firstBad) console.error("  first bad:", firstBad);
}

/* -------------------------------------------- 3. random deals, 2..10 players */
{
  const random = rng(77);
  for (let n = 2; n <= 10; n++) {
    let bad = 0, withLeft = 0, tot = 0;
    for (let i = 0; i < 2000; i++) {
      const s = C.start({ n, random });
      if (verify(s).length) bad++;
      const l = C.leftover(C.divide(s)); tot += l; if (l > 0) withLeft++;
    }
    equal(`n=${n}: 2000 random deals satisfy every promise`, bad, 0);
    if (n === 3 || n === 10) console.log(`  (n=${n}: ${withLeft} of 2000 deals leave something over, mean ${(tot / 2000).toFixed(1)} of 400)`);
  }
}

done("markers");
