#!/usr/bin/env node
"use strict";

/*
 * Logic test for two-color-solitaire/two-color-solitaire-core.js.
 *
 *   node porting/check-two-color-solitaire.mjs
 *
 * 1. The core is compared with a second, literal transcription of the
 *    applet's click handling (TwoColorSolitaireCanvas.CheckClick): the two
 *    cards on either side of a gap, the parity test, and the circle closing.
 * 2. Every shuffle of the two halves is explored for sides 4, 6, 8 and 10.
 *    The number of cards stays even, red and blue keep alternating, and the
 *    two differences oddRed-oddBlue and evenRed-evenBlue never change along
 *    any line of play.
 * 3. The magic trick is checked as a fact, not just from the page: for sides
 *    divisible by 4 (4, 8, and 40 sampled shuffles each of 12, 16, 20 and 40)
 *    no explored line loses; for sides 6 and 10, which are even but not
 *    divisible by 4, every shuffle has a losing line. A canonical 6-card deal
 *    is played to a stuck position to check the "lose" result.
 * 4. Rules and edge cases: the side range and step, permutations, the
 *    wrapping gap, refused moves, and win/loss detection.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("two-color-solitaire/two-color-solitaire-core.js", "TwoColorSolitaireCore");

/* ---------------------------------- 1. the applet's click handling, again */

/**
 * A literal transcription of TwoColorSolitaireCanvas.CheckClick's decision:
 * Dots is the circle order, and a click on gap i removes positions i and
 * (i+1) mod N when the values have the same parity.
 */
function appletClick(order, i) {
  const m = order.length;
  if (m < 2 || !Number.isInteger(i) || i < 0 || i >= m) return null;
  const a = order[i], b = order[(i + 1) % m];
  if (a % 2 !== b % 2) return null;
  const next = [];
  for (let j = 0; j < m; j++) {
    if (j !== i && j !== (i + 1) % m) next.push(order[j]);
  }
  return next;
}

{
  const states = [
    C.start({ n: 4 }).order,
    C.start({ n: 6 }).order,
    C.start({ n: 10, order: [7, 2, 9, 4, 1, 10, 3, 6, 5, 8] }).order,
    [],
  ];
  for (const order of states) {
    const state = { n: order.length, order };
    for (let i = -1; i <= order.length; i++) {
      const expected = appletClick(order, i);
      const next = C.removePair(state, i);
      equal(`n ${order.length}: gap ${i} matches the applet`,
        next === null ? null : next.order,
        expected);
    }
  }
}

/* --------------------------- 2 and 3. every shuffle, every line of play */

function permutations(values) {
  if (values.length <= 1) return [values.slice()];
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const rest = values.slice(0, i).concat(values.slice(i + 1));
    for (const p of permutations(rest)) out.push([values[i]].concat(p));
  }
  return out;
}

/** Every interleaving of one red permutation and one blue permutation. */
function allDeals(n) {
  const half = n / 2;
  const reds = permutations([...Array(half)].map((_, i) => i + 1));
  const blues = permutations([...Array(half)].map((_, i) => half + i + 1));
  const deals = [];
  for (const red of reds) {
    for (const blue of blues) {
      const order = [];
      for (let k = 0; k < half; k++) order.push(red[k], blue[k]);
      deals.push(order);
    }
  }
  return deals;
}

/**
 * Walk every line of play from `state`. Returns how many lines won, how many
 * got stuck, and whether the two invariant differences and the alternating
 * colours held at every reachable position.
 */
function explore(C, state, baseInvariant) {
  let wins = 0, losses = 0, invariantHeld = true, alternating = true;
  function rec(s) {
    const inv = C.invariant(s);
    if (inv.oddDifference !== baseInvariant.oddDifference ||
        inv.evenDifference !== baseInvariant.evenDifference) invariantHeld = false;
    if (s.order.length > 0 && !C.alternatesColors(s)) alternating = false;
    const end = C.result(s);
    if (end === "win") { wins++; return; }
    if (end === "lose") { losses++; return; }
    for (const p of C.removable(s)) rec(C.removePair(s, p.index));
  }
  rec(state);
  return { wins, losses, invariantHeld, alternating };
}

{
  let dealsChecked = 0;
  let statesChecked = 0;
  for (const n of [4, 6, 8, 10]) {
    const deals = allDeals(n);
    let withLoss = 0;
    for (const order of deals) {
      dealsChecked++;
      const state = C.start({ n, order });
      check(`n ${n}: every deal alternates red and blue`, C.alternatesColors(state));
      const base = C.invariant(state);
      const expected = n % 4 === 0 ? 0 : 1;
      check(`n ${n}: the differences start at 0, or at +1 and -1`,
        Math.abs(base.oddDifference) === expected && Math.abs(base.evenDifference) === expected,
        JSON.stringify(base));
      const r = explore(C, state, base);
      statesChecked += r.wins + r.losses;
      check(`n ${n}: the differences never change`, r.invariantHeld);
      check(`n ${n}: red and blue keep alternating`, r.alternating);
      if (n % 4 === 0) {
        check(`n ${n}: every line wins`, r.losses === 0 && r.wins > 0, JSON.stringify(r));
      } else {
        if (r.losses > 0) withLoss++;
      }
    }
    if (n % 4 !== 0) {
      check(`n ${n}: every shuffle has a losing line`, withLoss === deals.length, `${withLoss} of ${deals.length}`);
    }
  }
  check("every deal of side 4, 6, 8 and 10 was explored", dealsChecked === 4 + 36 + 576 + 14400, String(dealsChecked));
  check("many terminal positions were reached", statesChecked > 10000, String(statesChecked));
}

/* ------------------- 3b. a sample of larger sides, plus the wrong side */

{
  // A deterministic shuffle, so the test is reproducible.
  let seed = 2024;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  function shuffledDeal(n) {
    const half = n / 2;
    const red = [...Array(half)].map((_, i) => i + 1);
    const blue = [...Array(half)].map((_, i) => half + i + 1);
    for (let i = red.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [red[i], red[j]] = [red[j], red[i]];
      [blue[i], blue[j]] = [blue[j], blue[i]];
    }
    const order = [];
    for (let k = 0; k < half; k++) order.push(red[k], blue[k]);
    return order;
  }

  for (const n of [12, 16, 20, 40]) {
    for (let trial = 0; trial < 40; trial++) {
      let state = C.start({ n, order: shuffledDeal(n) });
      const base = C.invariant(state);
      let held = true, alternating = true;
      while (C.result(state) === null) {
        const inv = C.invariant(state);
        if (inv.oddDifference !== base.oddDifference || inv.evenDifference !== base.evenDifference) held = false;
        if (!C.alternatesColors(state)) alternating = false;
        const pairs = C.removable(state);
        const pick = pairs[Math.floor(rand() * pairs.length)];
        state = C.removePair(state, pick.index);
      }
      check(`n ${n}: a sampled deal never loses`, C.result(state) === "win", String(C.result(state)));
      check(`n ${n}: a sampled deal keeps the differences at 0`, base.oddDifference === 0 && base.evenDifference === 0);
      check(`n ${n}: the invariant held along the sampled line`, held && alternating);
    }
  }
}

/* --------------------------------- four play-outs with known outcomes */

{
  // Canonical n=6: [1,4,2,5,3,6]. The applet's deal, played greedily.
  let state = C.start({ n: 6 });
  equal("the canonical n=6 deal is [1,4,2,5,3,6]", state.order, [1, 4, 2, 5, 3, 6]);
  equal("the canonical n=6 deal starts with two legal gaps", C.removable(state).length, 2);
  let moves = 0;
  while (C.result(state) === null) {
    const p = C.removable(state)[0];
    state = C.removePair(state, p.index);
    moves++;
  }
  equal("the n=6 deal gets stuck after two removals", moves, 2);
  equal("the stuck n=6 deal is a loss", C.result(state), "lose");
  check("the stuck n=6 deal has cards left", state.order.length === 2);
  check("a stuck deal has no legal moves", C.legalMoves(state).length === 0);
  equal("the stuck circle is still red and blue", C.alternatesColors(state), true);
}

{
  // Canonical n=8: the invariant says every line wins. Take gap 0 each time.
  let state = C.start({ n: 8 });
  let moves = 0;
  while (C.result(state) === null) {
    state = C.removePair(state, 0);
    moves++;
  }
  equal("the n=8 deal wins in four removals", [moves, C.result(state)], [4, "win"]);
  equal("a won deal is empty", state.order.length, 0);
  check("an empty deal has no legal moves", C.legalMoves(state).length === 0);
}

/* ------------------------------------------------- 4. rules and edge cases */

{
  const s = C.start({ n: 8 });
  equal("a fresh deal", [s.n, s.order.length], [8, 8]);
  check("the default side is 16", C.start({}).n === 16);
  equal("the side range is 4..40 and even", [C.clampN(0), C.clampN(3), C.clampN(41), C.clampN(99), C.clampN(17), C.clampN(18)], [4, 4, 40, 40, 18, 18]);
  check("a bad order falls back to the canonical deal", JSON.stringify(C.start({ n: 6, order: [1, 1, 2, 3, 4, 5] }).order) === JSON.stringify(C.canonicalOrder(6)));

  const gapLast = C.pairAt(s, 7);
  equal("the last gap wraps to the first card", [gapLast.a, gapLast.b], [s.order[7], s.order[0]]);
  equal("a gap off the circle is refused", C.pairAt(s, 8), null);
  equal("the wrong parity is refused", C.removePair(C.start({ n: 4, order: [1, 4, 2, 3] }), 0), null);
  equal("an index off the circle is refused", C.removePair(s, 9), null);
  equal("a negative index is refused", C.removePair(s, -1), null);
  equal("no move is allowed from an empty circle", C.legalMoves({ n: 4, order: [] }), []);
  equal("an empty circle is a win", C.result({ n: 4, order: [] }), "win");

  const one = C.removePair(s, 0);
  equal("a removal shortens the circle by two", one.order.length, 6);
  equal("a removal keeps the rest in order", one.order, s.order.slice(2));
  check("the colours still alternate after a removal", C.alternatesColors(one));
  equal("move() removes a pair", C.move(s, { type: "remove", index: 0 }).order, one.order);
  equal("move() refuses an unknown move", C.move(s, { type: "jump", index: 0 }), null);
  equal("move() refuses a wrong-parity gap", C.move(C.start({ n: 4, order: [1, 4, 2, 3] }), { type: "remove", index: 0 }), null);

  // The four counts and the two differences.
  equal("the n=8 invariant", C.invariant(C.start({ n: 8 })), {
    oddRed: 2, oddBlue: 2, evenRed: 2, evenBlue: 2, oddDifference: 0, evenDifference: 0,
  });
  equal("the n=6 invariant", C.invariant(C.start({ n: 6 })), {
    oddRed: 2, oddBlue: 1, evenRed: 1, evenBlue: 2, oddDifference: 1, evenDifference: -1,
  });
}

done("two-color-solitaire");
