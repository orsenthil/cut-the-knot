#!/usr/bin/env node
"use strict";

/*
 * Logic test for coin-change/coin-change-core.js.
 *
 *   node porting/check-coin-change.mjs
 *
 * The applet is a calculator: for an amount (1 .. 30000) and a subset of its
 * eight denominations it shows the number of ways to change every amount from
 * 1 up to the chosen one. Its own method builds GeoPoly generating functions
 * (long[] coefficients, convolved by GeoPoly.Times) and reads Coefs[1..amount].
 *
 * That method is transcribed literally below (AppletPoly / appletTimes /
 * appletWays) and compared with the core's running-sum DP over the whole small
 * parameter space: every one of the 2^8 = 256 denomination subsets for every
 * amount 1 .. 120. A second, independent brute-force enumeration of coin
 * multisets checks both for all amounts 0 .. 20 and every subset. The page's
 * question ("in how many ways ...") has no formula, minimum or "always" claim
 * to falsify, so what is checked is that the counts really are the numbers of
 * combinations, including the classic 292 ways to change a dollar.
 *
 * Porting note: the applet stored counts in 64-bit longs and could overflow;
 * the core uses exact BigInts, so the two agree everywhere the applet does not
 * overflow (all amounts tested here).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("coin-change/coin-change-core.js", "CoinChangeCore");

const POWERS = C.POWERS; // [1, 2, 5, 10, 20, 25, 50, 100]
const SUBSETS = [];
for (let mask = 0; mask < 256; mask++) {
  SUBSETS.push(POWERS.filter((_, i) => (mask >> i) & 1));
}

/* ------------------------------------------------ the applet's own method */

/** GeoPoly(int power): Coefs[k] = 1 for k a multiple of power, else 0;
 *  power 0 is the constant polynomial 1 (only Coefs[0] set). */
function AppletPoly(power, max) {
  this.Power = power;
  this.Coefs = new Array(max + 1).fill(0n);
  if (power === 0) {
    this.Coefs[0] = 1n; // DefineCoefficients: the early return for Power == 0
    return;
  }
  for (let k = 0; k <= max; k += power) this.Coefs[k] = 1n;
}

/** GeoPoly.Times: result[i] += this.Coefs[i - j] for j = 0, p, 2p, ... <= i. */
function appletTimes(acc, other, max) {
  const result = new Array(max + 1).fill(0n);
  for (let i = 0; i <= max; i++) {
    for (let j = 0; j <= i; j += other.Power) {
      result[i] += acc.Coefs[i - j];
    }
  }
  acc.Coefs = result;
  return acc;
}

/** CoinChangeTable.Compute(amount, denoms) -> Coefs[0..amount]. */
function appletWays(amount, denoms) {
  let acc = new AppletPoly(0, amount);
  for (const d of POWERS) {
    if (denoms.indexOf(d) !== -1) acc = appletTimes(acc, new AppletPoly(d, amount), amount);
  }
  return acc.Coefs;
}

/** Independent reference: enumerate every multiset of coins summing to n. */
function bruteWays(amount, denoms) {
  const ds = denoms.slice().sort((a, b) => a - b);
  let count = 0n;
  (function rec(i, left) {
    if (i === ds.length) {
      if (left === 0) count += 1n;
      return;
    }
    const d = ds[i];
    for (let k = 0; k * d <= left; k++) rec(i + 1, left - k * d);
  })(0, amount);
  return count;
}

/* ------------------------------------------------------------ 1. the rules */

equal("start uses the applet's defaults", C.start({}), {
  denoms: [1, 5, 10, 25, 50], amount: 100, explored: false,
});
check("a new exploration is not done", C.result(C.start({})) === null);
equal("amount below the spinner minimum clamps to 1", C.start({ amount: -8 }).amount, 1);
equal("amount above the spinner maximum clamps to 30000", C.start({ amount: 99999 }).amount, 30000);
equal("amount is rounded to the spinner's step", C.start({ amount: 100.6 }).amount, 101);
equal("a missing amount uses 100", C.start({ denoms: [2] }).amount, 100);
check("the position is plain JSON", JSON.parse(JSON.stringify(C.start({}))).amount === 100);
equal("denominations are filtered, deduplicated and sorted",
  C.normalizeDenoms([100, 5, 5, 3, 1, "10"]), [1, 5, 10, 100]);
equal("an empty denomination list stays empty", C.normalizeDenoms([]), []);

/* -------------------------------------- 2. the core against the applet's own method */

{
  let bad = 0;
  let firstBad = "";
  let compared = 0;
  for (const subset of SUBSETS) {
    for (let amount = 1; amount <= 120; amount++) {
      const got = C.ways(amount, subset);
      const ref = appletWays(amount, subset);
      compared++;
      if (got.length !== ref.length) { bad++; continue; }
      for (let n = 0; n <= amount; n++) {
        if (got[n] !== ref[n]) {
          bad++;
          if (!firstBad) firstBad = `amount ${amount}, coins [${subset}], n=${n}: ${got[n]} vs ${ref[n]}`;
          break;
        }
      }
    }
  }
  check(`core DP equals the applet's GeoPoly method for all 256 coin sets and amounts 1..120 (${compared} cases)`,
    bad === 0, `${bad} mismatches; ${firstBad}`);
}

{
  // A few larger spot checks: the applet's O(amount^2) convolution is too slow
  // to run up to its 30000 limit, but these bigger cases still cross-check it.
  const examples = [[], [1], [2], C.DEFAULT_DENOMS, POWERS, [5, 10, 25], [1, 2, 5]];
  let bad = 0;
  for (const amount of [150, 200, 300]) {
    for (const subset of examples) {
      const got = C.ways(amount, subset);
      const ref = appletWays(amount, subset);
      for (let n = 0; n <= amount; n++) if (got[n] !== ref[n]) { bad++; break; }
    }
  }
  check("larger spot checks (amounts 150, 200, 300) also match the applet", bad === 0, `${bad} bad`);
}

/* --------------------------------- 3. the page's question, checked exhaustively */

{
  let bad = 0;
  for (const subset of SUBSETS) {
    for (let amount = 0; amount <= 20; amount++) {
      if (C.ways(amount, subset)[amount] !== bruteWays(amount, subset)) bad++;
    }
  }
  check("counts equal brute-force multiset enumeration for every coin set, amounts 0..20", bad === 0,
    `${bad} mismatches`);
}

equal("classic: 292 ways to change a dollar with 1,5,10,25,50", C.countWays(100, [1, 5, 10, 25, 50]), "292");
equal("242 ways with 1,5,10,25 only", C.countWays(100, [1, 5, 10, 25]), "242");
equal("adding a 100 coin gives 293 ways", C.countWays(100, [1, 5, 10, 25, 50, 100]), "293");
equal("one coin of value 1 makes every amount in exactly one way", C.countWays(77, [1]), "1");
equal("with only 2s, even amounts have one way, odd amounts none",
  [C.countWays(8, [2]), C.countWays(9, [2])], ["1", "0"]);
equal("with no coins, positive amounts have no ways", C.countWays(50, []), "0");
check("ways[0] is 1: the empty selection of coins", C.ways(50, [1, 5, 10])[0] === 1n);
equal("the table starts at amount 1 and ends at the chosen amount",
  [C.table({ amount: 5, denoms: [1, 2] })[0].amount, C.table({ amount: 5, denoms: [1, 2] })[4].amount],
  [1, 5]);
equal("the table row agrees with countWays",
  C.table({ amount: 100, denoms: [1, 5, 10, 25, 50] })[99].ways, "292");

{
  // The running sum processes one coin type at a time. With W_k(n) the ways
  // using only the first k coins, adding coin d = d_k gives the combination
  // recurrence W_k(n) = W_(k-1)(n) + W_k(n - d) (not a sum over all coins,
  // which would count orderings). Check it for every prefix of every coin set.
  let bad = 0;
  for (const subset of SUBSETS.filter((s) => s.length > 0)) {
    for (let k = 1; k <= subset.length; k++) {
      const prev = C.ways(100, subset.slice(0, k - 1));
      const cur = C.ways(100, subset.slice(0, k));
      const d = subset[k - 1];
      for (let n = d; n <= 100; n++) if (cur[n] !== prev[n] + cur[n - d]) bad++;
    }
  }
  check("W_k(n) = W_(k-1)(n) + W_k(n - d_k) for every coin-type prefix", bad === 0, `${bad} bad`);
}

{
  // With a 1-coin present, every amount can be made, so the count can only grow.
  let bad = 0;
  for (const subset of SUBSETS.filter((s) => s.indexOf(1) !== -1)) {
    const w = C.ways(100, subset);
    for (let n = 2; n <= 100; n++) if (w[n] < w[n - 1]) bad++;
  }
  check("counts never decrease with amount when a 1-coin is available", bad === 0, `${bad} drops`);
}

{
  // Every denomination is offered and no others are accepted.
  check("all eight applet denominations are present", POWERS.length === 8 &&
    POWERS.every((d, i) => d === [1, 2, 5, 10, 20, 25, 50, 100][i]));
  check("the default selection is the US coins 1,5,10,25,50",
    JSON.stringify(C.DEFAULT_DENOMS) === JSON.stringify([1, 5, 10, 25, 50]));
}

/* ---------------------------------------- 4. the controls and how it ends */

{
  const s = C.start({});
  check("toggling a coin on adds it, off removes it",
    C.toggleDenom(s, 2).denoms.indexOf(2) !== -1 && C.toggleDenom(C.toggleDenom(s, 2), 2).denoms.indexOf(2) === -1);
  check("toggling an unknown coin changes nothing", C.toggleDenom(s, 7).denoms.join() === s.denoms.join());
  check("setDenoms replaces the whole selection", C.setDenoms(s, [2, 100]).denoms.join() === "2,100");
  check("setAmount keeps the coins and clamps out-of-range values",
    C.setAmount(s, 50000).amount === 30000 && C.setAmount(s, 0).amount === 1 &&
    C.setAmount(s, 50000).denoms.join() === s.denoms.join());
  check("changing an option resets the explored flag", C.explore(s).explored === true &&
    C.setAmount(C.explore(s), 200).explored === false &&
    C.toggleDenom(C.explore(s), 2).explored === false);
  check("compute ends the demo with done", C.result(C.explore(s)) === "done");
  check("an all-coins, max-amount position still computes (exact big counts)",
    C.countWays(30000, POWERS).length > 10);
  check("empty coins is a dead end: every amount has 0 ways",
    C.table({ amount: 12, denoms: [] }).every((r) => r.ways === "0"));
}

done("coin-change");
