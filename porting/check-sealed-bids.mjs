#!/usr/bin/env node
"use strict";

/*
 * Logic test for sealed-bids/sealed-bids-core.js.
 *
 *   node porting/check-sealed-bids.mjs
 *
 * 1. HighestBidder, the five result lines and CTKFormat.CutDigits are written
 *    a second time from javap and compared with the core. Tie-breaking uses
 *    the same seeded generator on both sides.
 * 2. Every bid table with 2 or 3 players, 1 to 3 items and bids 0..3 (about
 *    266,000 tables), plus seeded random tables at the option limits, is
 *    checked: items go to highest bidders, the surplus is never negative,
 *    the final cash payments add up to zero, and each player's received
 *    value is exactly the sum of the items they won.
 * 3. The four options' ranges, the tie-break probabilities, messages, plain
 *    JSON and the applet's formatting quirk.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("sealed-bids/sealed-bids-core.js", "SealedBidsCore");

/* ------------ a second transcription of the applet's methods, from javap */

function jCut(value, digits = 2) {
  let scaled = value;
  for (let i = 0; i < digits; i++) scaled *= 10;
  scaled = Math.round(scaled);
  if (scaled === 0) return "0";
  let text = String(scaled) + ".0";
  let point = text.indexOf(".");
  let prefix = "";
  if (scaled < 0) {
    if (point - digits - 1 < 0) {
      prefix = "-";
      for (let i = 0; i < digits - point + 1; i++) { prefix += "0"; point++; }
    }
  } else if (point - digits < 0) {
    for (let i = 0; i < digits - point + 1; i++) { prefix += "0"; point++; }
  }
  text = prefix + text;
  const whole = point > digits ? text.slice(0, point - digits) : "";
  const frac = point > digits ? text.slice(point - digits, point) : text.slice(0, point);
  return whole + "." + frac;
}

/** SealedBidsCanvas.HighestBidder, including its random tie-break. */
function jHighest(bids, item, random) {
  let winner = -1;
  let best = -1;
  for (let p = 0; p < bids.length; p++) {
    const bid = bids[p][item];
    if (bid > best || (bid === best && random() < 0.5)) {
      best = bid;
      winner = p;
    }
  }
  return winner;
}

/** The lines computed inside SealedBidsCanvas.DrawBids. */
function jCompute(state, random) {
  const n = state.players;
  const totals = new Array(n).fill(0);
  for (let p = 0; p < n; p++) {
    for (let i = 0; i < state.items; i++) totals[p] += state.bids[p][i];
  }
  const fair = totals.map((t) => t / n);
  const winners = [];
  const won = new Array(n).fill(0);
  const received = new Array(n).fill(0);
  for (let i = 0; i < state.items; i++) {
    const p = jHighest(state.bids, i, random);
    winners.push(p);
    won[p]++;
    received[p] += state.bids[p][i];
  }
  const owed = received.map((v, p) => v - fair[p]);
  const surplus = owed.reduce((a, b) => a + b, 0);
  const share = surplus / n;
  const cash = owed.map((v) => -(v - share));
  return { totals, fair, winners, won, received, owed, surplus, share, cash };
}

function* tables(players, items, alphabet) {
  const cells = players * items;
  const total = alphabet ** cells;
  for (let n = 0; n < total; n++) {
    let x = n;
    const bids = Array.from({ length: players }, () => new Array(items));
    for (let i = 0; i < items; i++) {
      for (let p = 0; p < players; p++) {
        bids[p][i] = x % alphabet;
        x = Math.floor(x / alphabet);
      }
    }
    yield bids;
  }
}

const near = (a, b) => Math.abs(a - b) < 1e-9;

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ bids: [[9, 4, 2], [3, 8, 1], [0, 6, 7]] });
  equal("the default number of players is three", C.start({}).players, 3);
  equal("the default number of items is three", C.start({}).items, 3);
  equal("the panel's player range is 2..26", [C.MIN_PLAYERS, C.MAX_PLAYERS], [2, 26]);
  equal("the panel's item range is 1..15", [C.MIN_ITEMS, C.MAX_ITEMS], [1, 15]);
  equal("bids are capped at 1000", C.MAX_BID, 1000);
  equal("random starting bids are 0..19", C.START_BID, 20);
  equal("column letters start at A", C.LETTERS.slice(0, 3), "ABC");
  check("a fresh demo is not done", C.result(s) === null);
  const seeded = C.start({ players: 5, items: 4, random: rng(7) });
  equal("a seeded table has the chosen shape", [seeded.bids.length, seeded.bids[0].length], [5, 4]);
  check("seeded starting bids stay in 0..19", seeded.bids.flat().every((v) => v >= 0 && v < 20));

  const out = C.compute(s, rng(1));
  equal("player A's total is 15", out.totals[0], 15);
  equal("player A's fair share is 5", out.fair[0], 5);
  equal("the three items go to their highest bidders", out.winners, [0, 1, 2]);
  equal("each player won the right number of items", out.won, [1, 1, 1]);
  equal("player C received 7", out.received[2], 7);
  check("the surplus is positive here", out.surplus > 0);
  check("the message explains the method", s.message.includes("highest bidder"));
}

/* ------------------- 2. the applet's arithmetic, written a second time */

{
  let same = true;
  let detail = "";
  let cases = 0;
  for (const players of [2, 3]) {
    for (const items of [1, 2, 3]) {
      for (const bids of tables(players, items, 4)) {
        const state = { players, items, bids };
        const seed = cases + 1;
        const mine = C.compute(state, rng(seed));
        const theirs = jCompute(state, rng(seed));
        const keys = ["totals", "fair", "winners", "won", "received", "owed", "surplus", "share", "cash"];
        cases++;
        for (const key of keys) {
          const a = mine[key];
          const b = theirs[key];
          const ok = Array.isArray(a)
            ? a.length === b.length && a.every((v, i) => near(v, b[i]))
            : near(a, b);
          if (!ok) {
            same = false;
            detail = `${players}x${items} ${JSON.stringify(bids)} ${key}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
            break;
          }
        }
        if (!same) break;
      }
      if (!same) break;
    }
    if (!same) break;
  }
  check(`DrawBids matches a second transcription in all ${cases} tables`, same, detail);

  let big = true;
  for (let seed = 1; seed <= 40; seed++) {
    const state = C.start({ players: 26, items: 15, random: rng(seed) });
    const mine = C.compute(state, rng(seed));
    const theirs = jCompute(state, rng(seed));
    if (JSON.stringify(mine.winners) !== JSON.stringify(theirs.winners) ||
        !mine.totals.every((v, i) => near(v, theirs.totals[i])) ||
        !near(mine.surplus, theirs.surplus)) big = false;
  }
  check("DrawBids matches at the option limits (26 players, 15 items)", big);
}

/* -------------------------------------- 3. the page's claims, exhaustively */

{
  let winnerMax = true;
  let surplusOkay = true;
  let cashBalances = true;
  let countsOkay = true;
  let receivedOkay = true;
  let checked = 0;
  for (const players of [2, 3]) {
    for (const items of [1, 2, 3]) {
      for (const bids of tables(players, items, 4)) {
        const out = C.compute({ players, items, bids }, rng(997));
        checked++;
        out.winners.forEach((p, i) => {
          const best = Math.max(...bids.map((row) => row[i]));
          if (bids[p][i] !== best) winnerMax = false;
        });
        if (out.surplus < -1e-9) surplusOkay = false;
        if (!near(out.cash.reduce((a, b) => a + b, 0), 0)) cashBalances = false;
        if (out.won.reduce((a, b) => a + b, 0) !== items) countsOkay = false;
        for (let p = 0; p < players; p++) {
          let sum = 0;
          out.winners.forEach((w, i) => { if (w === p) sum += bids[p][i]; });
          if (sum !== out.received[p]) receivedOkay = false;
        }
      }
    }
  }
  check(`every item goes to a highest bidder (${checked} tables)`, winnerMax);
  check("the cash left over is never negative", surplusOkay);
  check("the final payments always add up to zero", cashBalances);
  check("every item is assigned exactly once", countsOkay);
  check("what a player receives is the sum of the items they won", receivedOkay);

  // Ties: three equal bidders, from javap's sequential coin flips.
  const counts = [0, 0, 0];
  const flips = rng(12345); // one stream; reseeding each trial is correlated
  for (let n = 0; n < 20000; n++) {
    counts[C.highestBidder([[5], [5], [5]], 0, flips)]++;
  }
  check("a three-way tie gives the first bidder about a quarter of items",
    Math.abs(counts[0] / 20000 - 0.25) < 0.02, JSON.stringify(counts));
  check("a three-way tie gives the middle bidder about a quarter",
    Math.abs(counts[1] / 20000 - 0.25) < 0.02, JSON.stringify(counts));
  check("a three-way tie favours the last bidder with about half",
    Math.abs(counts[2] / 20000 - 0.5) < 0.02, JSON.stringify(counts));

  equal("the page's rounding quirk: -0.05 prints -.0-", C.cutDigits(-0.05), "-.0-");
  equal("a positive half prints .50, as the applet does", C.cutDigits(0.5), ".50");
  equal("an ordinary share is rounded to two places", C.cutDigits(1.235), "1.24");
  equal("a negative share is rounded like Java Math.round", C.cutDigits(-12.345), "-12.34");
  equal("zero prints as 0", C.cutDigits(0), "0");
  let formats = true;
  for (const v of [0, 0.038, 0.05, 0.5, 1.235, 12.345, -0.038, -0.05, -0.5, -1.235, -12.345, 99.999]) {
    if (C.cutDigits(v) !== jCut(v)) formats = false;
  }
  check("CutDigits matches a second transcription on a corpus of values", formats);
}

/* ------------------------------------- 4. options, messages and plain JSON */

{
  const base = C.start({ bids: [[9, 4, 2], [3, 8, 1], [0, 6, 7]] });
  const bid = C.setBid(base, 0, 0, 25);
  equal("a bid changes just one cell", bid.bids[0][0], 25);
  equal("the other bids stay put", bid.bids[1][0], 3);
  check("the edit message says what changed", bid.message.includes("Bid A 1 is now 25"));
  equal("a negative bid is clamped to zero", C.setBid(base, 0, 0, -4).bids[0][0], 0);
  equal("a huge bid is clamped to 1000", C.setBid(base, 0, 0, 9999).bids[0][0], 1000);
  equal("an edit outside the table does nothing", C.setBid(base, 9, 0, 5), base);
  check("editing ends the exploration", C.result(bid) === "done");

  const more = C.setPlayers(base, 5, rng(2));
  equal("adding players gives more columns", [more.players, more.bids.length], [5, 5]);
  equal("the new columns keep the item count", more.bids[4].length, 3);
  const fewer = C.setPlayers(base, 1, rng(2));
  equal("fewer than two players is clamped", fewer.players, 2);
  equal("more than 26 players is clamped", C.setPlayers(base, 99, rng(2)).players, 26);
  const moreItems = C.setItems(base, 5, rng(3));
  equal("adding items widens every row", moreItems.bids.every((row) => row.length === 5), true);
  equal("fewer than one item is clamped", C.setItems(base, 0, rng(3)).items, 1);
  equal("more than 15 items is clamped", C.setItems(base, 99, rng(3)).items, 15);
  const fresh = C.reset(base, rng(4));
  equal("Reset keeps the table size", [fresh.players, fresh.items], [3, 3]);
  check("Reset makes new bids", fresh.bids.flat().some((v, i) => v !== base.bids.flat()[i]));
  check("Reset is reported in words", fresh.message.includes("Fresh sealed bids"));

  const snapshot = JSON.stringify(base);
  C.compute(base, rng(5));
  C.setBid(base, 0, 0, 1);
  check("core functions never mutate the position", JSON.stringify(base) === snapshot);
  const saved = JSON.parse(JSON.stringify(C.compute(bid, rng(1))));
  equal("a saved result has the five lines", [saved.totals.length, saved.winners.length, saved.cashText.length], [3, 3, 3]);
}

done("sealed-bids");
