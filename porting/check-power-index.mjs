#!/usr/bin/env node
"use strict";

/*
 * Logic test for power-index/power-index-core.js.
 *
 *   node porting/check-power-index.mjs
 *
 * 1. The options: the page's start [6: 4, 3, 2, 1], adding and dropping players.
 * 2. Both indices against a second transcription of the applet's
 *    ComputeBanzhaf (binary strings) and ComputeSS (NextPerm over all n!
 *    orders, FindPivotal), for every system with n = 2..4, votes 0..4 and every
 *    quota up to the total, and random systems with n up to 7.
 * 3. The page's claims: [5: 3, 2, 1] has a dummy; every order has exactly one
 *    pivotal player when q <= total; and a few facts the math section uses.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("power-index/power-index-core.js", "PowerIndexCore");

/* ------------------------------------------------------------ 1. the options */

{
  const s = C.start({});
  equal("the page's applet starts at [6: 4, 3, 2, 1], indices off", s, { quota: 6, votes: [4, 3, 2, 1], compute: false });
  check("a new player gets 1 + (int)(20 random) votes", C.move(s, { type: "players", value: 5 }, () => 0.999).votes[4] === 20 && C.move(s, { type: "players", value: 5 }, () => 0).votes[4] === 1);
  equal("dropping a player drops the last one", C.move(s, { type: "players", value: 2 }).votes, [4, 3]);
  check("players are kept in 2..15", C.move(s, { type: "players", value: 1 }).votes.length === 2 && C.move(s, { type: "players", value: 40 }).votes.length === 15);
  check("votes are 0..1000 and the quota 1..1000", C.move(s, { type: "votes", index: 0, value: -3 }).votes[0] === 0 && C.move(s, { type: "votes", index: 0, value: 5000 }).votes[0] === 1000 && C.move(s, { type: "quota", value: 0 }).quota === 1);
  check("with the quota above the total there are no indices", C.indices(C.start({ quota: 11, votes: [4, 3, 2, 1] })) === null);
}

/* ------------------------------------- 2. against the applet's enumerations */

function appletBanzhaf(q, w) {
  const n = w.length, B = new Array(n).fill(0);
  for (let L5 = 1; L5 <= 2 ** n - 1; L5++) {
    const L6 = L5.toString(2).padStart(n, "0");
    let sum = 0;
    for (let i = 0; i < n; i++) if (L6[i] === "1") sum += w[i];
    const win = sum < q ? 0 : sum;
    if (!win) continue;
    for (let i = 0; i < n; i++) if (L6[i] === "1" && win - w[i] < q) B[i]++;
  }
  return B;
}

function appletSS(q, w) {
  const n = w.length;
  let perm = w.map((_, i) => i + 1);
  const fact = [1, 1, 2, 6, 24, 120, 720, 5040][n];
  const SS = new Array(n).fill(0);
  const nextPerm = (a) => {
    a = a.slice();
    let i = a.length - 1;
    while (a[i - 1] >= a[i]) i--;
    let j = a.length;
    while (a[j - 1] <= a[i - 1]) j--;
    [a[i - 1], a[j - 1]] = [a[j - 1], a[i - 1]];
    i++; j = a.length;
    while (i < j) { [a[i - 1], a[j - 1]] = [a[j - 1], a[i - 1]]; i++; j--; }
    return a;
  };
  for (let k = 0; k < fact; k++) {
    let sum = 0, piv = 0;
    for (const p of perm) { sum += w[p - 1]; if (sum >= q) { piv = p - 1; break; } }
    SS[piv]++;
    if (k === fact - 1) break;
    perm = nextPerm(perm);
  }
  return SS;
}

{
  let systems = 0, bOk = 0, sOk = 0;
  const tryOne = (q, w) => {
    systems++;
    const s = C.start({ quota: q, votes: w });
    if (JSON.stringify(C.banzhaf(s).counts) === JSON.stringify(appletBanzhaf(q, w))) bOk++;
    if (JSON.stringify(C.shapley(s).counts) === JSON.stringify(appletSS(q, w))) sOk++;
  };
  const lists = (n) => (n === 0 ? [[]] : lists(n - 1).flatMap((l) => [0, 1, 2, 3, 4].map((v) => [...l, v])));
  for (let n = 2; n <= 4; n++) for (const w of lists(n)) {
    const t = w.reduce((a, b) => a + b, 0);
    for (let q = 1; q <= t; q++) tryOne(q, w);
  }
  let seed = 11;
  const rnd = (k) => ((seed = (seed * 1103515245 + 12345) % 2147483648) % k);
  for (let k = 0; k < 300; k++) {
    const n = 5 + rnd(3), w = Array.from({ length: n }, () => rnd(21));
    const t = w.reduce((a, b) => a + b, 0);
    if (t > 0) tryOne(1 + rnd(t), w);
  }
  check(`Banzhaf counts match the applet's on ${systems} systems`, bOk === systems);
  check(`Shapley-Shubik counts match the applet's n! orders on ${systems} systems`, sOk === systems);
}

/* ------------------------------------------------------------- 3. the claims */

{
  const d = C.indices(C.start({ quota: 5, votes: [3, 2, 1] }));
  check("in [5: 3, 2, 1] the one-vote player is a dummy", d.dummies.join() === "2" && d.shapley.counts[2] === 0);
  equal("[5: 3, 2, 1]: Banzhaf 2/4, 2/4, 0 and Shapley-Shubik 3/6, 3/6, 0", [d.banzhaf.counts, d.shapley.counts], [[2, 2, 0], [3, 3, 0]]);
  const p = C.indices(C.start({}));
  equal("[6: 4, 3, 2, 1]: Banzhaf counts", p.banzhaf.counts, [5, 3, 3, 1]);
  equal("[6: 4, 3, 2, 1]: Shapley-Shubik counts of 24", p.shapley.counts, [10, 6, 6, 2]);
  // Every order has one pivotal player: the counts add up to n!, for all the systems above.
  let sums = true, dummySame = true;
  const lists = (n) => (n === 0 ? [[]] : lists(n - 1).flatMap((l) => [0, 1, 2, 3].map((v) => [...l, v])));
  for (let n = 2; n <= 5; n++) for (const w of lists(n)) {
    const t = w.reduce((a, b) => a + b, 0);
    for (let q = 1; q <= t; q++) {
      const r = C.indices(C.start({ quota: q, votes: w }));
      if (r.shapley.counts.reduce((a, b) => a + b, 0) !== C.factorials[n]) sums = false;
      // A player is a dummy for Banzhaf exactly when it is never pivotal.
      for (let i = 0; i < n; i++) if ((r.banzhaf.counts[i] === 0) !== (r.shapley.counts[i] === 0)) dummySame = false;
    }
  }
  check("with q <= total every order has exactly one pivotal player (the counts add to n!)", sums);
  check("Banzhaf and Shapley-Shubik agree on who is a dummy", dummySame);
  const big = C.indices(C.start({ quota: 51, votes: [8, 8, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 1] }));
  check("15 players are counted exactly (15! orders)", big.shapley.counts.reduce((a, b) => a + b, 0) === 1307674368000);
  const unequal = C.indices(C.start({ quota: 3, votes: [2, 1, 1] }));
  check("votes are not power: [3: 2, 1, 1] gives the 2-vote player 3/5 Banzhaf and 4/6 Shapley-Shubik", unequal.banzhaf.counts.join() === "3,1,1" && unequal.shapley.counts.join() === "4,1,1");
  const dict = C.indices(C.start({ quota: 6, votes: [6, 3, 2] }));
  check("a player who reaches the quota alone is a dictator, the others dummies", dict.dictators.join() === "0" && dict.dummies.join() === "1,2");
}

done("power-index");
