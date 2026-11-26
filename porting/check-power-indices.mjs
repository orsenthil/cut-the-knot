#!/usr/bin/env node
"use strict";

/*
 * Logic test for power-indices/power-indices-core.js.
 *
 *   node porting/check-power-indices.mjs
 *
 * 1. The data sets: the four the applet's page lists, as given there.
 * 2. The generating-polynomial indices against brute force (the Weighted
 *    Voting port's core, which lists every coalition), on every system of
 *    2..4 players with weights 0..4 and every quota, and 400 random systems
 *    of 5..10 players; and the polynomial against a transcription of the
 *    applet's ComputePoly.
 * 3. Known values: the UN Security Council (421/2145 and 4/2145 for
 *    Shapley-Shubik, 848 and 84 swings of 5,080 for Banzhaf), and the shares
 *    adding to 1 for every data set.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("power-indices/power-indices-core.js", "PowerIndicesCore");
const B = loadCore("power-index/power-index-core.js", "PowerIndexCore");

/* ----------------------------------------------------------- 1. the data sets */

{
  equal("the four data sets of the page", C.DATA.map((d) => d.name), ["Electoral College (1990)", "Electoral College (2000)", "European Union", "Security Council"]);
  const ec = C.start({});
  check("the applet opens on the first: Electoral College (1990), quota 270 of 538, 51 players", ec.set === "Electoral College (1990)" && ec.quota === 270 && C.total(ec) === 538 && ec.players.length === 51);
  check("the 2000 college also has 538 votes", C.total(C.start({ set: "Electoral College (2000)" })) === 538);
  const eu = C.start({ set: "European Union" });
  check("the European Union: 15 members, 87 votes, quota 62", eu.players.length === 15 && C.total(eu) === 87 && eu.quota === 62);
  const sc = C.start({ set: "Security Council" });
  check("the Security Council: 5 members with 7 and 10 with 1, quota 39", sc.players.filter((p) => p[1] === 7).length === 5 && sc.players.filter((p) => p[1] === 1).length === 10 && sc.quota === 39);
  check("a change makes the set Custom", C.move(sc, { type: "quota", value: 40 }).set === "Custom" && C.move(sc, { type: "add" }).players.length === 16);
  check("the last player cannot be removed", C.move(C.start({ quota: 1, players: [["A", 1]] }), { type: "remove", index: 0 }) === null);
  check("a quota above the total gives no indices", C.compute(C.start({ quota: 50, players: [["A", 3], ["B", 2]] })) === null);
}

/* ---------------------------------------- 2. against brute force and the applet */

{
  let systems = 0, same = 0;
  const near = (a, b) => Math.abs(a - b) < 1e-12;
  const tryOne = (q, w) => {
    systems++;
    const fast = C.compute(C.start({ quota: q, players: w.map((x, i) => [`P${i}`, x]) }));
    const slow = B.indices(B.start({ quota: q, votes: w }));
    const okB = w.every((_, i) => fast.banzhaf[i] === slow.banzhaf.counts[i]) && Number(fast.banzhafTotal) === slow.banzhaf.total;
    const okS = w.every((_, i) => near(fast.shapley[i], slow.shapley.counts[i] / slow.shapley.total));
    if (okB && okS) same++;
  };
  const lists = (n) => (n === 0 ? [[]] : lists(n - 1).flatMap((l) => [0, 1, 2, 3, 4].map((v) => [...l, v])));
  for (let n = 2; n <= 4; n++) for (const w of lists(n)) {
    const t = w.reduce((a, b) => a + b, 0);
    for (let q = 1; q <= t; q++) tryOne(q, w);
  }
  let seed = 5;
  const rnd = (k) => ((seed = (seed * 1103515245 + 12345) % 2147483648) % k);
  for (let k = 0; k < 400; k++) {
    const n = 5 + rnd(6), w = Array.from({ length: n }, () => rnd(15));
    const t = w.reduce((a, b) => a + b, 0);
    if (t > 0) tryOne(1 + rnd(t), w);
  }
  check(`both indices match brute force on ${systems} systems`, same === systems);

  // The applet's IntPoly.ComputePoly: Coefs[0] = 1; for each power p, for s from
  // length - p - 1 down to 0, if Coefs[s] != 0 then Coefs[s + p] += Coefs[s].
  const applet = (powers, len) => {
    const c = new Array(len).fill(0); c[0] = 1;
    for (const p of powers) for (let s = len - p - 1; s >= 0; s--) if (c[s] !== 0) c[s + p] += c[s];
    return c;
  };
  let polys = 0, polysOk = 0;
  for (const d of C.DATA) {
    const w = d.players.map((p) => p[1]);
    for (let i = 0; i < w.length; i++) {
      polys++;
      const mine = Array.from(C.poly(w, i, d.quota));
      if (JSON.stringify(mine) === JSON.stringify(applet(w.filter((_, j) => j !== i), d.quota))) polysOk++;
    }
  }
  check(`the polynomials match the applet's ComputePoly for every player of every data set (${polys})`, polysOk === polys);
}

/* --------------------------------------------------------- 3. known values */

{
  const sc = C.compute(C.start({ set: "Security Council" }));
  check("Security Council: a permanent member has Shapley-Shubik 421/2145", Math.abs(sc.shapley[0] - 421 / 2145) < 1e-12);
  check("Security Council: a non-permanent member has 4/2145", Math.abs(sc.shapley[14] - 4 / 2145) < 1e-12);
  check("Security Council: Banzhaf swings 848 and 84 of 5,080", sc.banzhaf[0] === 848 && sc.banzhaf[14] === 84 && sc.banzhafTotal === 5080n);
  let sums = true;
  for (const d of C.DATA) {
    const r = C.compute(C.start({ set: d.name }));
    if (Math.abs(r.shapley.reduce((a, b) => a + b, 0) - 1) > 1e-9 || Math.abs(r.banzhafShare.reduce((a, b) => a + b, 0) - 1) > 1e-9) sums = false;
  }
  check("in every data set each index's shares add up to 1", sums);
  const eu = C.compute(C.start({ set: "European Union" }));
  check("European Union: Luxembourg (2 votes) is not a dummy, but has the least power", eu.banzhaf[14] > 0 && Math.min(...eu.shapley) === eu.shapley[14]);
  const ec = C.compute(C.start({}));
  check("Electoral College (1990): California's Banzhaf share is more than its vote share 54/538", ec.banzhafShare[0] > 54 / 538);
}

done("power-indices");
