#!/usr/bin/env node
"use strict";

/*
 * Logic test for torque/torque-core.js.
 *
 * The beam balances when the torques cancel: sum(value_i * position_i) = 0,
 * with positions running -6..-1 and 1..6. The generator works backwards from a
 * balanced arrangement, so every round it produces must actually be solvable -
 * a round that cannot be balanced is the one bug that would make the game
 * unplayable, and it would only show up on some random seeds.
 *
 * So the test generates a few thousand rounds and, for each, searches for a
 * placement that balances. The search is exhaustive over assignments of items
 * to pegs, which is feasible because a round has at most 6 items.
 *
 * It also checks the game's promise that every round contains an item worth
 * exactly 1 (the "joker"), which is what the page's hint is about.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const T = loadCore("torque/torque-core.js", "TorqueCore");

/* ------------------------------------------------------------ 1. the pegs */

{
  const pegs = T.allPegs();
  equal("there are 12 pegs", pegs.length, 2 * T.HALF_LENGTH);
  check("no peg sits at zero", !pegs.includes(0));
  for (const p of pegs) {
    check(`peg ${p} is within the beam`, Math.abs(p) >= 1 && Math.abs(p) <= T.HALF_LENGTH);
  }
  equal("the pegs are symmetric", pegs.map((p) => -p).sort((a, b) => a - b), pegs.slice().sort((a, b) => a - b));
}

/* ------------------------------------------------------- 2. evaluate() */

{
  const items = [
    { id: "a", value: 2, isJoker: false },
    { id: "b", value: -1, isJoker: false },
  ];
  equal("nothing placed: not balanced", T.evaluate(items, {}), { sum: 0, allPlaced: false, balanced: false });
  equal("half placed: not balanced", T.evaluate(items, { a: 3 }), { sum: 6, allPlaced: false, balanced: false });
  equal("2 at 3 and -1 at 6 balances", T.evaluate(items, { a: 3, b: 6 }), {
    sum: 0,
    allPlaced: true,
    balanced: true,
  });
  equal("2 at 3 and -1 at 5 does not", T.evaluate(items, { a: 3, b: 5 }), {
    sum: 1,
    allPlaced: true,
    balanced: false,
  });
}

/* ------------------------------------------------------- 3. pegIsFree() */

{
  check("an empty peg is free", T.pegIsFree({ a: 3 }, 4));
  check("an occupied peg is not", !T.pegIsFree({ a: 3 }, 3));
}

/* ------------------------- 4. every generated round can actually be balanced */

/** Exhaustive search for a balancing placement, one item per peg. */
function isSolvable(round) {
  const { pegs, items } = round;
  const used = new Set();
  const place = (i, sum) => {
    if (i === items.length) return sum === 0;
    for (const peg of pegs) {
      if (used.has(peg)) continue;
      used.add(peg);
      if (place(i + 1, sum + items[i].value * peg)) {
        used.delete(peg);
        return true;
      }
      used.delete(peg);
    }
    return false;
  };
  return place(0, 0);
}

{
  // generate() uses Math.random; pin it so a failure is reproducible.
  const realRandom = Math.random;
  const rand = rng(20240607);
  Math.random = rand;
  try {
    const ROUNDS = 2000;
    let unsolvable = 0;
    let noJoker = 0;
    let badValue = 0;
    const sizes = new Set();

    for (let i = 0; i < ROUNDS; i++) {
      const round = T.generate();
      sizes.add(round.items.length);

      if (!isSolvable(round)) unsolvable++;
      if (!round.items.some((it) => it.value === 1)) noJoker++;
      for (const it of round.items) {
        if (it.value === 0 || Math.abs(it.value) > T.MAX_ITEM_WEIGHT) badValue++;
      }
    }

    equal(`all ${ROUNDS} generated rounds are solvable`, unsolvable, 0);
    equal(`all ${ROUNDS} rounds contain an item worth exactly 1`, noJoker, 0);
    equal("no item is zero or over the weight limit", badValue, 0);
    check(
      `round sizes stay within ${T.MIN_ITEMS}..${T.MAX_ITEMS}`,
      [...sizes].every((n) => n >= T.MIN_ITEMS && n <= T.MAX_ITEMS),
      `saw ${[...sizes].sort().join(",")}`,
    );
    check("the generator varies the number of items", sizes.size > 1, `only saw ${[...sizes]}`);
  } finally {
    Math.random = realRandom;
  }
}

done("check-torque");
