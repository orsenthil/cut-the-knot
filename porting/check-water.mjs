#!/usr/bin/env node
"use strict";

/*
 * Logic test for water/water-core.js.
 *
 *   node porting/check-water.mjs
 *
 * 1. The applet's defaults, option ranges, pour rule, Back and Reset.
 * 2. A second, literal transcription of WaterGlass.mouseClicked /
 *    ProcessPourEvent, compared with the core for every value of every jug
 *    and every source/destination pair over all capacities 0..5.
 * 3. The page's claim, checked exhaustively: for every coprime A, B up to 12
 *    whose sum C is within the applet's 0..20 capacity range, every whole
 *    amount 0..C turns up in jug C (and in some jug) in the breadth-first
 *    exploration of all reachable states.
 * 4. What happens when A and B are not coprime: only multiples of gcd(A, B)
 *    are reachable; also the related claim that C = A + B matters, with a
 *    gcd-1 counterexample where C is not A + B.
 * 5. The solver gives a shortest legal sequence, or null when impossible.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("water/water-core.js", "WaterCore");

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/* ------------------------------------------- the applet's own pour, again */

// WaterGlass.mouseClicked: on the second click,
//   amount = (int) min(dest.capacity - dest.value, source.value)
//   if amount <= 0, return; parent gets PUSH_STATE; destination += amount;
//   the source receives POUR and subtracts the same amount.
function appletPour(values, caps, from, to) {
  const howMuch = Math.trunc(Math.min(caps[to] - values[to], values[from]));
  if (howMuch <= 0) return null;
  const after = values.slice();
  after[to] += howMuch; // destination's mouseClicked
  after[from] -= howMuch; // source's ProcessPourEvent(POUR)
  return after;
}

/** All states reachable by that pour rule from (0, 0, C), plus their amounts. */
function explore(caps) {
  const startValues = [0, 0, caps[2]];
  const seen = new Set([startValues.join(",")]);
  const queue = [startValues];
  const amounts = new Set(startValues);
  const thirdJug = new Set([startValues[2]]);
  let invariant = true;
  for (let i = 0; i < queue.length; i++) {
    const v = queue[i];
    if (v[0] + v[1] + v[2] !== caps[2]) invariant = false;
    for (let from = 0; from < 3; from++) {
      for (let to = 0; to < 3; to++) {
        const w = appletPour(v, caps, from, to);
        if (!w) continue;
        const k = w.join(",");
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push(w);
        for (const x of w) amounts.add(x);
        thirdJug.add(w[2]);
      }
    }
  }
  return { states: queue, amounts, thirdJug, invariant };
}

/* ------------------------------------------------ 1. rules and option ranges */

{
  const s = C.start({});
  equal("default capacities are the applet's 3, 5, 8", s.caps, [3, 5, 8]);
  equal("default amounts are 0, 0, 8", s.values, [0, 0, 8]);
  equal("default target is the page's 4", s.target, 4);
  equal("a new game has no moves and no undo", [s.moves, s.history.length], [0, 0]);
  check("4 is not measured at the start", C.result(s) === null);

  const clamped = C.start({ capacities: [-4, 99, 6.9], values: [5, -2, 99], target: 50 });
  equal("capacities are held to 0..20 and truncated", clamped.caps, [0, 20, 6]);
  equal("amounts are held to 0..capacity", clamped.values, [0, 0, 6]);
  equal("target is held to 0..C", clamped.target, 6);
  check("the clamped C jug starts full", C.result(clamped) === "done");

  // min(source, free space in destination), copied from the bytecode
  const p0 = C.pour(s, 2, 1); // C -> B: B takes 5
  equal("C -> B pours until B is full", p0.values, [0, 5, 3]);
  equal("the pre-pour state is kept for Back", p0.history, [[0, 0, 8]]);
  equal("the amount poured is reported", p0.amount, 5);
  equal("a pour that would move nothing is refused", C.pour(p0, 0, 1), null);
  equal("pouring into a full jug is refused", C.pour(C.start({ values: [3, 5, 0] }), 2, 1), null);
  const p1 = C.pour(p0, 1, 0); // B -> A: A takes 3
  equal("B -> A pours until A is full", p1.values, [3, 2, 3]);
  equal("the original amounts are not changed", s.values, [0, 0, 8]);
  equal("Back restores the last amounts", C.undo(p1).values, [0, 5, 3]);
  equal("Reset restores the first amounts", C.reset(p1).values, [0, 0, 8]);
  equal("Back with an empty stack does nothing", C.undo(s), null);
  equal("Reset with an empty stack does nothing", C.reset(s), null);
  const selfPour = C.pour(C.start({ values: [1, 4, 3] }), 1, 1);
  equal("clicking a partly full jug twice is a no-op move", selfPour.values, [1, 4, 3]);
  equal("but it still counts as a move", selfPour.moves, 1);
  const edited = C.setCapacities(p1, [3, 5, 10]);
  equal("editing capacities clears the undo stack", [edited.history.length, edited.moves], [0, 0]);
  equal("editing capacity keeps amounts within it", C.setCapacities(p1, [1, 5, 8]).values, [1, 2, 3]);
  const water = C.setValues(p1, [3, 3, 2]);
  equal("editing amounts clears the undo stack", water.history.length, 0);
  equal("editing amounts clamps to the capacity", C.setValues(p1, [99, 2, 1]).values, [3, 2, 1]);
  equal("result uses any jug, not just C", C.result(C.start({ values: [4, 0, 4], target: 4 })), "done");
  check("an impossible target is detected", C.impossible(C.start({ capacities: [4, 6, 10], target: 5 })));
  check("a possible target is not called impossible", !C.impossible(s));
}

/* ------------------------ 2. the core is the applet's pour, everywhere */

{
  let comparisons = 0;
  let mismatch = "";
  for (let a = 0; a <= 5; a++) {
    for (let b = 0; b <= 5; b++) {
      for (let c = 0; c <= 5; c++) {
        const caps = [a, b, c];
        for (let x = 0; x <= a; x++) {
          for (let y = 0; y <= b; y++) {
            for (let z = 0; z <= c; z++) {
              const values = [x, y, z];
              const s = C.start({ capacities: caps, values });
              for (let from = 0; from < 3; from++) {
                for (let to = 0; to < 3; to++) {
                  comparisons++;
                  const want = appletPour(values, caps, from, to);
                  const got = C.pour(s, from, to);
                  if ((want ? want.join(",") : null) !== (got ? got.values.join(",") : null)) {
                    mismatch ||= `${caps} ${values} ${from}->${to}: ${want} vs ${got?.values}`;
                  }
                  if (want && got && got.amount !== Math.trunc(Math.min(caps[to] - values[to], values[from]))) {
                    mismatch ||= `amount wrong at ${caps} ${values} ${from}->${to}`;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  check(`core pour matches the bytecode transcription in all ${comparisons} cases`, !mismatch, mismatch);
}

/* ---------------------- 3. the page's claim for coprime A, B with C = A+B */

{
  let pairs = 0;
  let missing = "";
  let notInvariant = "";
  let notInThird = "";
  for (let a = 1; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      if (gcd(a, b) !== 1 || a + b > C.CAP_MAX) continue; // C stays in the applet's 0..20 range
      pairs++;
      const caps = [a, b, a + b];
      const { amounts, thirdJug, invariant, states } = explore(caps);
      if (!invariant) notInvariant ||= `${a},${b}`;
      for (let t = 0; t <= a + b; t++) {
        if (!amounts.has(t)) missing ||= `${caps}: ${t}`;
        if (!thirdJug.has(t)) notInThird ||= `${caps}: ${t}`;
      }
      // The applet's own board (3, 5, 8) has the sixteen states the proof
      // describes; make sure the independent walk reaches all of them.
      if (a === 3 && b === 5) equal("the 3-5-8 board has 16 reachable states", states.length, 16);
    }
  }
  check(`${pairs} coprime pairs (A,B <= 12, A+B <= 20): every amount 0..C is reachable`, !missing, missing);
  check(`${pairs} coprime pairs: the big jug alone holds every amount 0..C`, !notInThird, notInThird);
  check("x + y + z = C is invariant in every reachable state", !notInvariant, notInvariant);
}

/* ------------------------------------ 4. what the page says about gcd and C */

{
  let pairs = 0;
  let badMultiple = "";
  let badNonMultiple = "";
  for (let a = 1; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      const g = gcd(a, b);
      if (g === 1 || a + b > C.CAP_MAX) continue;
      pairs++;
      const c = a + b;
      const { amounts } = explore([a, b, c]);
      for (const amount of amounts) {
        if (amount % g !== 0) badMultiple ||= `${a},${b}: ${amount}`;
      }
      for (let t = 1; t < c; t++) {
        if (t % g !== 0 && amounts.has(t)) badNonMultiple ||= `${a},${b}: ${t}`;
        if (t % g !== 0 && !C.impossible(C.start({ capacities: [a, b, c], target: t }))) {
          badNonMultiple ||= `impossible() missed ${t} for ${a},${b}`;
        }
      }
    }
  }
  check(`${pairs} non-coprime pairs up to 12: only multiples of gcd(A,B) occur`, !badMultiple, badMultiple);
  check(`${pairs} non-coprime pairs up to 12: no other amount is reachable`, !badNonMultiple, badNonMultiple);

  // Coprime is not enough on its own: the page's C = A + B is doing real
  // work. With jugs 1, 1, 5 the numbers share no common factor, yet 2 and 3
  // can never be isolated - the two small jugs can only hold at most 2.
  const odd = explore([1, 1, 5]);
  check("1,1,5 has no common factor but cannot measure 2", !odd.amounts.has(2));
  check("1,1,5 can still measure 3 in the big jug", odd.thirdJug.has(3));
  check("impossible() only uses gcd, so it does not claim to catch this", !C.impossible(C.start({ capacities: [1, 1, 5], target: 2 })));
}

/* ------------------------------------------------- 5. the solver is shortest */

function replay(caps, target, solution) {
  let s = C.start({ capacities: caps, target });
  for (const step of solution.steps) {
    const n = C.pour(s, step.from, step.to);
    if (!n) return `illegal pour ${step.from}->${step.to}`;
    s = n;
  }
  return C.result(s) === "done" ? null : "target not measured";
}

function shortestByExplore(caps, target) {
  const start = [0, 0, caps[2]];
  const seen = new Set([start.join(",")]);
  let frontier = [{ v: start, d: 0 }];
  while (frontier.length) {
    const found = frontier.find((node) => node.v.includes(target));
    if (found) return found.d;
    const next = [];
    for (const node of frontier) {
      for (let from = 0; from < 3; from++) {
        for (let to = 0; to < 3; to++) {
          const w = appletPour(node.v, caps, from, to);
          if (!w) continue;
          const k = w.join(",");
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ v: w, d: node.d + 1 });
        }
      }
    }
    frontier = next;
  }
  return null;
}

{
  const caps = [3, 5, 8];
  const solution = C.solve(caps, 4);
  check("the classic 3-5-8 puzzle has a solution", solution !== null);
  equal("the classic puzzle needs six pours", solution.length, 6);
  equal("the solver's steps are legal and end with 4 in a jug", replay(caps, 4, solution), null);
  equal("the independent walk agrees on six pours", shortestByExplore(caps, 4), 6);
  check("each step describes itself", solution.steps.every((s) => C.describe(s).length > 10));
  equal("the first pour is C into B", C.describe(solution.steps[0]), "Pour 5 from C into B.");
  check("solving an already-measured target takes no pours", C.solve(caps, 8).length === 0);

  let checked = 0;
  let wrongLength = "";
  let badReplay = "";
  let wrongNull = "";
  for (let a = 1; a <= 8; a++) {
    for (let b = a + 1; b <= 8; b++) {
      if (gcd(a, b) !== 1) continue;
      const cs = [a, b, a + b];
      for (let target = 0; target <= a + b; target++) {
        const got = C.solve(cs, target);
        const want = shortestByExplore(cs, target);
        checked++;
        if ((got ? got.length : null) !== want) wrongLength ||= `${cs} -> ${target}: ${got?.length} vs ${want}`;
        if (got) {
          const err = replay(cs, target, got);
          if (err) badReplay ||= `${cs} -> ${target}: ${err}`;
        }
      }
    }
  }
  check(`solver length is minimal for ${checked} coprime targets (A,B up to 8)`, !wrongLength, wrongLength);
  check("every returned solution replays legally to the target", !badReplay, badReplay);
  for (const [a, b, target] of [[4, 6, 3], [2, 4, 5], [6, 9, 4]]) {
    const got = C.solve([a, b, a + b], target);
    if (got) wrongNull ||= `${a},${b} -> ${target} should be impossible`;
  }
  check("the solver returns null for targets that are not multiples of gcd", !wrongNull, wrongNull);
  check("the solver also returns null for the 1,1,5 anomaly", C.solve([1, 1, 5], 2) === null);
}

done("water");
