#!/usr/bin/env node
"use strict";

/*
 * Logic test for coins/coin-game.js, the port of CoinGame.java.
 *
 * The maths the applet is about: on a row with an even number of coins, the
 * player who moves first can always take at least half the money. Colour the
 * positions alternately; the two colour classes are both reachable as a whole,
 * because after you take an end coin the opponent can only expose coins of the
 * other colour. So the first player picks the heavier colour class and keeps
 * taking from it, and the opponent never gets a choice that breaks it.
 *
 * That is exactly what CoinGame.selectStrategy / computerPlay implement, so the
 * strongest check available is exhaustive: when the computer moves first on an
 * even row, play every possible sequence of human replies and confirm the
 * computer never ends up behind. The state space is small enough to enumerate
 * for rows up to 12 coins.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const src = "coins/coin-game.js";
const Coin = loadCore(src, "Coin");
const CoinGame = loadCore(src, "CoinGame");

const makeGame = (values) => new CoinGame(values.map((v, i) => new Coin(v, i)));

/* ------------------------------------------------------ 1. basic bookkeeping */

{
  const g = makeGame([1, 2, 3, 4]);
  equal("fresh game: no score", [g.scores.x, g.scores.y], [0, 0]);
  check("end coins are takeable", g.isTakeable(g.coins[0]) && g.isTakeable(g.coins[3]));
  check("middle coins are not takeable", !g.isTakeable(g.coins[1]) && !g.isTakeable(g.coins[2]));
  equal("taking a middle coin is illegal", g.humanTake(g.coins[2]), "illegal");
  equal("taking an end coin works", g.humanTake(g.coins[0]), "taken");
  equal("the human is credited", g.scores.x, 1);
  check("the newly exposed end is takeable", g.isTakeable(g.coins[1]));
}

/* ------------------------- 2. every game ends, and all the money is accounted */

{
  const rand = rng(12345);
  for (let trial = 0; trial < 400; trial++) {
    const n = 2 + Math.floor(rand() * 11);
    const values = Array.from({ length: n }, () => 1 + Math.floor(rand() * 25));
    const g = makeGame(values);
    const total = values.reduce((a, b) => a + b, 0);
    let guard = 0;
    while (!g.isFinished()) {
      if (guard++ > 100) break;
      // human takes a random legal end
      const ends = [g.coins[g.first], g.coins[g.last]].filter((c) => c.enabled);
      if (ends.length) g.humanTake(ends[Math.floor(rand() * ends.length)]);
      if (!g.isFinished()) g.computerPlay();
    }
    check(`game of ${n} coins terminates`, g.isFinished(), `stopped after ${guard} rounds`);
    equal(`all ${total} of the money is taken`, g.scores.x + g.scores.y, total);
  }
}

/* ---------- 3. exhaustive: moving first on an even row, the computer never loses */

/**
 * Plays out every possible sequence of human replies against the real
 * CoinGame, with the computer moving first. Returns the worst margin
 * (computer minus human) the human can force.
 *
 * Each node replays the whole move sequence into a fresh CoinGame rather than
 * reimplementing the strategy. That matters: the parity is chosen once in the
 * constructor and held for the rest of the game, so a reimplementation that
 * re-derives it from the remaining sub-row is a different, weaker player.
 *
 * selectOne() breaks a tie between two equal end coins with Math.random, so the
 * whole search is run twice with it pinned each way.
 */
function worstMarginForComputer(values, tieTakesFirst) {
  const realRandom = Math.random;
  Math.random = () => (tieTakesFirst ? 0.1 : 0.9); // <0.5 means "take first"
  let worst = Infinity;

  /** Replays `path` (a list of "first"/"last" human choices) into a fresh game. */
  const replay = (path) => {
    const g = makeGame(values);
    g.computerPlay();
    for (const choice of path) {
      if (g.isFinished()) break;
      const coin = choice === "first" ? g.coins[g.first] : g.coins[g.last];
      g.humanTake(coin);
      if (!g.isFinished()) g.computerPlay();
    }
    return g;
  };

  const walk = (path) => {
    const g = replay(path);
    if (g.isFinished()) {
      worst = Math.min(worst, g.scores.y - g.scores.x);
      return;
    }
    walk([...path, "first"]);
    walk([...path, "last"]);
  };

  try {
    walk([]);
  } finally {
    Math.random = realRandom;
  }
  return worst;
}

{
  const rand = rng(777);
  let rows = 0;
  for (const n of [2, 4, 6, 8, 10, 12]) {
    for (let trial = 0; trial < 12; trial++) {
      const values = Array.from({ length: n }, () => 1 + Math.floor(rand() * 20));
      for (const tieTakesFirst of [true, false]) {
        const worst = worstMarginForComputer(values, tieTakesFirst);
        rows++;
        check(
          `even row of ${n}: computer moving first never loses (ties take ${tieTakesFirst ? "first" : "last"})`,
          worst >= 0,
          `values [${values}] worst margin ${worst}`,
        );
      }
    }
  }
  check("exhaustive search actually ran", rows === 144, `ran ${rows} rows`);
}

/* ------------------- 4. the parity strategy picks the heavier colour class */

{
  // Odd positions are worth far more, so the strategy must settle on them.
  const values = [1, 100, 1, 100, 1, 100];
  const g = makeGame(values);
  const odd = values.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
  const even = values.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
  check("the odd positions are the heavy class here", odd > even);
  // With the computer moving first it cannot reach an odd coin immediately, but
  // playing the whole game out it must still clear the heavy class.
  let guard = 0;
  while (!g.isFinished() && guard++ < 50) {
    g.computerPlay();
    if (!g.isFinished()) {
      const ends = [g.coins[g.first], g.coins[g.last]].filter((c) => c.enabled);
      g.humanTake(ends[0]);
    }
  }
  check("computer takes the larger share on [1,100,1,100,1,100]", g.scores.y >= g.scores.x, `${g.scores.y} vs ${g.scores.x}`);
}

/* ------------------------- 5. a snapshot restores to the very same game */

{
  // Play random games, rows and loops; at every position the restored copy
  // must snapshot identically and, where no coin-flip is involved, reply with
  // the same coin.
  const rand = rng(7);
  let compared = 0;
  for (let trial = 0; trial < 300; trial++) {
    const n = 2 + Math.floor(rand() * 9);
    const values = Array.from({ length: n }, () => 1 + Math.floor(rand() * 25));
    const g = new CoinGame(values.map((v, i) => new Coin(v, i)), trial % 3 === 0);
    if (trial % 2) g.computerPlay();
    let guard = 0;
    while (!g.isFinished() && guard++ < 50) {
      const snap = JSON.parse(JSON.stringify(g.snapshot()));
      const copy = CoinGame.restore(snap);
      equal(`trial ${trial}: restore(snapshot) snapshots the same`, copy.snapshot(), snap);

      const takeable = g.coins.filter((c) => g.isTakeable(c));
      const pick = takeable[Math.floor(rand() * takeable.length)];
      equal(`trial ${trial}: same reply to the human`, copy.humanTake(copy.coins[pick.index]), g.humanTake(pick));
      if (g.isFinished()) break;
      const tie = g.coins[g.first].value === g.coins[g.last].value;
      if (tie) {
        g.computerPlay(); // a coin-flip: nothing to compare
      } else {
        equal(`trial ${trial}: same computer move`, copy.computerPlay().index, g.computerPlay().index);
        equal(`trial ${trial}: same position after it`, copy.snapshot(), g.snapshot());
        compared++;
      }
    }
  }
  check("snapshots were compared on real positions", compared > 300, `only ${compared}`);
}

done("check-coins");
