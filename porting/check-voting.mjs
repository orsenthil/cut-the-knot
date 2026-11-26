#!/usr/bin/env node
"use strict";

/*
 * Logic test for voting/voting-core.js.
 *
 *   node porting/check-voting.mjs
 *
 * 1. The applet's default table (3 candidates, 2 ballots: 5 ABC, 4 BCA) and
 *    its exact score lines.
 * 2. Every schedule with 3 candidates, 2 or 3 ballots and at most 6 voters:
 *    ~19,000 elections, each scored a second time from the bytecode rules
 *    with a separate transcription (array positions, Java-Hashtable key order).
 *    This covers all 6 ballot orders and every tie among 0..6 voters.
 * 3. Tie rules: SortedVector keeps equal scores in insertion order; the final
 *    elimination pair is a tie ("nobody"); java.util.Hashtable's key order is
 *    checked against real Java output, including the rehash at 9 candidates.
 * 4. Editing (names, candidates, ballots, counts, swaps), the step-by-step
 *    elimination/pairwise/plurality moves, and the "done" result of the demo.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("voting/voting-core.js", "VotingCore");
const NAMES = ["A", "B", "C"];

/* ------------------------------------------------- a second transcription */

const hashRef = (s) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h >>> 0;
};
const flatBuckets = (flat, cap) => {
  const tabs = Array.from({ length: cap }, () => []);
  for (const name of flat) tabs[hashRef(name) % cap].unshift(name);
  const out = [];
  for (let i = cap - 1; i >= 0; i--) out.push(...tabs[i]);
  return out;
};
function hashtableRef(names) {
  let cap = 11, threshold = 8, flat = [];
  for (const name of names) {
    if (flat.length >= threshold) { cap = 2 * cap + 1; threshold = Math.floor(cap * 0.75); flat = flatBuckets(flat, cap); }
    flat = flatBuckets(flat.concat([name]), cap);
  }
  return flat;
}

/** ballots are [count, order] pairs; scores come back indexed by NAMES. */
function refPlurality(ballots) {
  const v = NAMES.map(() => 0);
  for (const [count, order] of ballots) v[NAMES.indexOf(order[0])] += count;
  return v;
}
function refBorda(ballots) {
  const v = NAMES.map(() => 0);
  for (const [count, order] of ballots) {
    order.forEach((name, rank) => { v[NAMES.indexOf(name)] += count * (NAMES.length - rank); });
  }
  return v;
}
function refPairwise(ballots) {
  const v = NAMES.map(() => 0);
  for (let i = 0; i < NAMES.length; i++) for (let j = i + 1; j < NAMES.length; j++) {
    let ci = 0, cj = 0;
    for (const [count, order] of ballots) {
      if (order.indexOf(NAMES[i]) < order.indexOf(NAMES[j])) ci += count; else cj += count;
    }
    if (ci > cj) v[i] += 1; else if (cj > ci) v[j] += 1; else { v[i] += 0.5; v[j] += 0.5; }
  }
  return v;
}
function refElimination(ballots) {
  const gone = [], rounds = [];
  for (let round = 1; round <= NAMES.length - 1; round++) {
    const active = NAMES.filter((n) => !gone.includes(n));
    const v = active.map(() => 0);
    for (const [count, order] of ballots) {
      const top = order.find((n) => active.includes(n));
      if (top) v[active.indexOf(top)] += count;
    }
    const ranked = hashtableRef(active).sort((x, y) => v[active.indexOf(y)] - v[active.indexOf(x)]);
    const weakest = ranked[ranked.length - 1];
    const winner = active.length === 2 ? (v[0] === v[1] ? null : ranked[0]) : undefined;
    rounds.push({ active, scores: v, ranked, weakest, winner });
    if (active.length === 2) break;
    gone.push(weakest);
  }
  return rounds;
}
const asArray = (obj, names) => names.map((n) => obj[n]);

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start();
  equal("default: three candidates, two ballots", [s.candidates, s.ballots.map((b) => b.count)], [NAMES, [5, 4]]);
  equal("default: plurality 5,4,0", asArray(C.plurality(s), NAMES), [5, 4, 0]);
  equal("default: Borda 19,22,13", asArray(C.borda(s), NAMES), [19, 22, 13]);
  equal("default: pairwise 2,1,0", asArray(C.pairwise(s).scores, NAMES), [2, 1, 0]);
  const last = C.eliminationRounds(s).slice().pop();
  equal("default: A wins the last elimination round", [last.number, last.winner, last.active.map((n) => last.scores[n])], [2, "A", [5, 4]]);
  equal("the four winners", ["plurality", "borda", "elimination", "pairwise"].map((m) => C.winners(s, m).join("")), ["A", "B", "A", "A"]);
  equal("Borda's printed breakdown", C.scoreLine(s, "A", "borda"), "A: 3×5 + 1×4 = 19");
  equal("plurality's printed line", C.scoreLine(s, "B", "plurality"), "B: 4 first place votes");
  check("a fresh exploration is not done", C.result(s) === null);
}

/* --------------------------------- 2. every small schedule, twice counted */

const perms = (list) => {
  if (list.length < 2) return [list];
  const out = [];
  list.forEach((x, i) => perms(list.filter((_, k) => k !== i)).forEach((p) => out.push([x, ...p])));
  return out;
};
{
  const ORDERS = perms(NAMES);
  function* parts(total, k) {
    if (k === 1) { yield [total]; return; }
    for (let x = 0; x <= total; x++) for (const rest of parts(total - x, k - 1)) yield [x, ...rest];
  }
  let n = 0, pl = true, bo = true, pa = true, el = true, sums = true, condorcet = true, fair = true;
  for (let nb = 2; nb <= 3; nb++) {
    for (let total = 0; total <= 6; total++) for (const cs of parts(total, nb)) {
      for (const o1 of ORDERS) for (const o2 of ORDERS) {
        const orders = nb === 2 ? [[o1, o2]] : ORDERS.map((o3) => [o1, o2, o3]);
        for (const os of orders) {
          const ballots = os.map((order, i) => [cs[i], order]);
          const s = C.start({ candidates: NAMES, ballots: ballots.map(([count, order]) => ({ count, order })) });
          n++;
          const V = cs.reduce((a, b) => a + b, 0);
          const rp = refPlurality(ballots), rb = refBorda(ballots), rpair = refPairwise(ballots), re = refElimination(ballots);
          if (asArray(C.plurality(s), NAMES).join() !== rp.join()) pl = false;
          if (asArray(C.borda(s), NAMES).join() !== rb.join()) bo = false;
          if (asArray(C.pairwise(s).scores, NAMES).join() !== rpair.join()) pa = false;
          const coreRounds = C.eliminationRounds(s);
          if (coreRounds.length !== re.length) el = false;
          else re.forEach((r, i) => {
            const cr = coreRounds[i];
            if (cr.active.map((name) => cr.scores[name]).join() !== r.scores.join()) el = false;
            if (cr.weakest !== r.weakest || cr.winner !== r.winner || cr.ranked.join() !== r.ranked.join()) el = false;
          });
          if (rp.reduce((a, b) => a + b, 0) !== V || rb.reduce((a, b) => a + b, 0) !== V * 6) sums = false;
          if (rpair.reduce((a, b) => a + b, 0) !== 3) sums = false;
          const final = re[re.length - 1];
          if (final.winner) {
            const other = final.active.find((name) => name !== final.winner);
            if (final.scores[final.active.indexOf(final.winner)] <= final.scores[final.active.indexOf(other)]) fair = false;
          }
          for (let i = 0; i < 3; i++) {
            let beatsAll = true;
            for (let j = 0; j < 3 && beatsAll; j++) {
              if (i === j) continue;
              let vi = 0, vj = 0;
              for (const [count, order] of ballots) {
                if (order.indexOf(NAMES[i]) < order.indexOf(NAMES[j])) vi += count; else vj += count;
              }
              if (vi <= vj) beatsAll = false;
            }
            if (beatsAll && rpair[i] !== 2) condorcet = false;
          }
        }
      }
    }
  }
  check(`plurality matches the bytecode transcription (${n} schedules)`, pl);
  check(`Borda's n, n-1, ... points match (${n} schedules)`, bo);
  check(`pairwise 1 / .5 / 0 points match (${n} schedules)`, pa);
  check(`every elimination round, weakest and winner match (${n} schedules)`, el);
  check(`score totals: plurality = voters, Borda = 6 x voters, pairwise = 3 (${n})`, sums);
  check("a Condorcet winner always gets both pairwise points", condorcet);
  check("the elimination winner beat the other finalist, or it is a tie", fair);
}

/* -------------------------------------------------------- 3. tie behaviour */

{
  equal("Hashtable keys A,B,C", C.hashtableOrder(["A", "B", "C"]), ["A", "C", "B"]);
  equal("Hashtable keys A..E", C.hashtableOrder(["A", "B", "C", "D", "E"]), ["A", "E", "D", "C", "B"]);
  equal("Hashtable keys A..J (after rehash)", C.hashtableOrder("ABCDEFGHIJ".split("")), "DCBAJIHGFE".split(""));
  equal("Hashtable keys with real words", C.hashtableOrder(["Alice", "Bob", "Carol", "Dave"]), ["Bob", "Dave", "Alice", "Carol"]);
  equal("Hashtable keys with rehash and two-letter names", C.hashtableOrder(["X", "Y", "Z", "W", "Q", "R", "S", "T", "U", "V", "AA", "AB"]), ["Z", "Y", "X", "W", "V", "U", "T", "S", "R", "Q", "AB", "AA"]);
  equal("equal scores keep insertion order", C.ranked({ A: 2, B: 2, C: 2 }, ["C", "A", "B"]), ["C", "A", "B"]);
  equal("higher scores come first, ties stay put", C.ranked({ A: 1, B: 3, C: 3, D: 0 }, ["A", "B", "C", "D"]), ["B", "C", "A", "D"]);

  const tied = C.start({ candidates: ["A", "B"], ballots: [{ count: 3, order: ["A", "B"] }, { count: 3, order: ["B", "A"] }] });
  const tr = C.eliminationRounds(tied).slice().pop();
  check("two equal finalists: nobody wins", tr.winner === null && C.winners(tied, "elimination").join("") === "AB");
  equal("equal first places: the last Hashtable key is weakest", C.eliminationRounds(C.start({ candidates: NAMES, ballots: [{ count: 2, order: NAMES }, { count: 2, order: ["C", "B", "A"] }] }))[0].weakest, "B");
  const empty = C.start({ candidates: NAMES, ballots: [{ count: 0, order: NAMES }, { count: 0, order: NAMES }] });
  equal("zero voters: all three tied everywhere", ["plurality", "borda", "elimination", "pairwise"].map((m) => C.winners(empty, m).length), [3, 3, 2, 3]);
  check("zero voters: no method has a single winner", ["plurality", "borda", "elimination", "pairwise"].every((m) => C.tie(empty, m)));
}

/* --------------------------------------------------------------- 4. moves */

{
  let s = C.start({ method: "plurality" });
  const before = JSON.stringify(s);
  s = C.reveal(s, "A");
  equal("revealing a candidate adds one line", s.revealed, ["A"]);
  check("a candidate cannot be revealed twice", C.reveal(s, "A") === null && C.reveal(s, "X") === null);
  check("the old position is untouched", JSON.stringify(C.start()) === before);
  s = C.reveal(C.reveal(s, "B"), "C");
  check("all candidates revealed: the demo is done", C.result(s) === "done" && C.legalMoves(s).length === 0);

  s = C.start({ method: "pairwise" });
  check("same candidate, repeated pair and wrong method are refused", C.compare(s, "A", "A") === null && C.compare(C.compare(s, "A", "B"), "B", "A") === null && C.compare(C.setMethod(s, "plurality"), "A", "B") === null);
  s = C.compare(C.compare(C.compare(s, "A", "B"), "A", "C"), "B", "C");
  check("all three duels: the demo is done", C.result(s) === "done" && C.pairCount(s) === 3 && C.legalMoves(s).length === 0);
  check("unordered pair keyed by name order", C.compare(s, "C", "A") === null);

  s = C.start({ method: "elimination" });
  check("elimination starts before round one", s.round === 0 && C.result(s) === null);
  s = C.eliminate(s);
  equal("first press shows round 1", [s.round, C.eliminationRound(s).number], [1, 1]);
  s = C.eliminate(s);
  equal("second press declares the winner", [s.round, C.eliminationRound(s).winner, C.result(s)], [2, "A", "done"]);
  equal("a third press restores the rounds", C.eliminate(s).round, 0);
}

/* -------------------------------------------------------------- 5. editing */

{
  let s = C.start();
  equal("candidate range is 2..40", [C.setCandidates(s, 1).candidates.length, C.setCandidates(s, 99).candidates.length], [2, 40]);
  equal("new candidates are appended to every ballot", C.setCandidates(s, 4).ballots.map((b) => b.order.join("")), ["ABCD", "BCAD"]);
  equal("removing candidates keeps each ballot a permutation", C.setCandidates(s, 2).ballots.map((b) => b.order.join("")), ["AB", "BA"]);
  equal("ballot range is 2..40", [C.setBallots(s, 1).ballots.length, C.setBallots(s, 99).ballots.length], [2, 40]);
  equal("voter counts are held to 0..9999", [C.setCount(s, 0, -4).ballots[0].count, C.setCount(s, 0, 100000).ballots[0].count], [0, 9999]);
  equal("a swap moves one candidate up a ballot", C.moveUp(s, 0, 1).ballots[0].order.join(""), "BAC");
  check("bad swaps and ballots are refused", C.moveUp(s, 0, 0) === null && C.moveUp(s, 9, 1) === null && C.setCount(s, 9, 1) === null);
  equal("typed names separated by commas", C.setNames(s, "Alice, Bob, Carol").candidates, ["Alice", "Bob", "Carol"]);
  equal("typed names separated by spaces", C.setNames(s, "X Y Z").candidates, ["X", "Y", "Z"]);
  check("duplicate or too few names are refused", C.setNames(s, "A,A,B") === null && C.setNames(s, "A") === null);
  check("changing method clears earlier reveals", C.setMethod(C.reveal(s, "A"), "borda").revealed.length === 0);
  check("editing the schedule clears earlier reveals", C.setCount(C.reveal(s, "A"), 0, 6).revealed.length === 0);
  equal("move() dispatches the same changes", C.move(s, { type: "swap", ballot: 0, index: 1 }).ballots[0].order.join(""), "BAC");
  check("a position is plain saved data", JSON.parse(JSON.stringify(C.reveal(s, "B"))).revealed.join() === "B");
}

done("voting");
