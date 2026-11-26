"use strict";

/*
 * The Method of Sealed Bids, from Alexander Bogomolny's cut-the-knot applet.
 *
 * Each player bids for each item. An item goes to the highest bidder (a tie
 * is broken at random, as in the applet), and every player's fair share is
 * the average of their own bids. A player who received more than their share
 * pays the difference; one who received less is paid. Whatever is left over
 * is split evenly, so the final cash payments add up to zero.
 *
 * The arithmetic follows DrawBids and HighestBidder in the bytecode: the
 * surplus is the sum of (received - fair share) and the final cash is
 * -(that difference minus the equal share of the surplus). This file is pure
 * logic: no DOM, no storage, one global, plain JSON positions.
 */
const SealedBidsCore = (() => {
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 26;
  const MIN_ITEMS = 1;
  const MAX_ITEMS = 15;
  const MAX_BID = 1000; // CTKNumberLim's upper limit in the applet
  const START_BID = 20; // MaxStartBid: random starting bids are 0..19
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  function clamp(n, lo, hi) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  }

  /* CTKFormat.CutDigits(value, digits), from javap: multiply, Math.round,
   * then split the Java double string around the decimal point. It has a
   * quirk for negative numbers smaller than one tenth (-0.05 prints -.0-);
   * that is kept, because the applet prints the same thing. */
  function cutDigits(value, digits = 2) {
    let scaled = value;
    for (let i = 0; i < digits; i++) scaled *= 10;
    scaled = Math.round(scaled);
    if (scaled === 0) return "0";
    let text = String(scaled) + ".0"; // how Java prints an integral double
    let point = text.indexOf(".");
    let prefix = "";
    if (scaled < 0) {
      if (point - digits - 1 < 0) {
        prefix = "-";
        for (let i = 0; i < digits - point + 1; i++) {
          prefix += "0";
          point++;
        }
      }
    } else if (point - digits < 0) {
      for (let i = 0; i < digits - point + 1; i++) {
        prefix += "0";
        point++;
      }
    }
    text = prefix + text;
    const whole = point > digits ? text.slice(0, point - digits) : "";
    const frac = point > digits ? text.slice(point - digits, point) : text.slice(0, point);
    return whole + "." + frac;
  }

  /** The random starting bids: floor(random() * 20) for every cell. */
  function randomBids(players, items, random = Math.random) {
    return Array.from({ length: players }, () =>
      Array.from({ length: items }, () => Math.floor(random() * START_BID)));
  }

  /** The position a new demo starts from. */
  function start(options = {}) {
    const players = clamp(options.players ?? 3, MIN_PLAYERS, MAX_PLAYERS);
    const items = clamp(options.items ?? 3, MIN_ITEMS, MAX_ITEMS);
    const bids = Array.isArray(options.bids)
      ? options.bids.slice(0, players).map((row) =>
          row.slice(0, items).map((v) => clamp(v, 0, MAX_BID)))
      : randomBids(players, items, options.random ?? Math.random);
    while (bids.length < players) bids.push(randomBids(1, items, options.random ?? Math.random)[0]);
    bids.forEach((row) => { while (row.length < items) row.push(0); });
    return {
      players,
      items,
      bids,
      explored: false,
      message: "Each item goes to its highest bidder. Change a bid to see the payments change.",
    };
  }

  /** HighestBidder: a later tied bidder takes over with probability 1/2. */
  function highestBidder(bids, item, random = Math.random) {
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

  /** The five lines the applet draws under the bid table. */
  function compute(state, random = Math.random) {
    const { players, items, bids } = state;
    const totals = new Array(players).fill(0);
    for (let p = 0; p < players; p++) {
      for (let i = 0; i < items; i++) totals[p] += bids[p][i];
    }
    const fair = totals.map((t) => t / players);
    const winners = Array.from({ length: items }, (_, i) => highestBidder(bids, i, random));
    const won = new Array(players).fill(0);
    const received = new Array(players).fill(0);
    winners.forEach((p, i) => {
      won[p]++;
      received[p] += bids[p][i];
    });
    const owed = received.map((v, p) => v - fair[p]);
    const surplus = owed.reduce((a, b) => a + b, 0);
    const share = surplus / players;
    const cash = owed.map((v) => -(v - share));
    return {
      totals, fair, winners, won, received, owed, surplus, share, cash,
      fairText: fair.map((v) => cutDigits(v, 2)),
      owedText: owed.map((v) => cutDigits(v, 2)),
      cashText: cash.map((v) => cutDigits(v, 2)),
    };
  }

  function explored(state, message) {
    return { ...state, explored: true, message };
  }

  function setBid(state, player, item, value) {
    if (player < 0 || player >= state.players || item < 0 || item >= state.items) return state;
    const bids = state.bids.map((row) => row.slice());
    bids[player][item] = clamp(value, 0, MAX_BID);
    return explored({ ...state, bids }, `Bid ${LETTERS[player]} ${item + 1} is now ${bids[player][item]}.`);
  }

  function setPlayers(state, players, random = Math.random) {
    const next = clamp(players, MIN_PLAYERS, MAX_PLAYERS);
    const bids = state.bids.slice(0, next).map((row) => row.slice());
    while (bids.length < next) bids.push(randomBids(1, state.items, random)[0]);
    return explored({ ...state, players: next, bids },
      `${next} ${next === 1 ? "player" : "players"} bidding for ${state.items} ${state.items === 1 ? "item" : "items"}.`);
  }

  function setItems(state, items, random = Math.random) {
    const next = clamp(items, MIN_ITEMS, MAX_ITEMS);
    const bids = state.bids.map((row) => {
      const out = row.slice(0, next);
      while (out.length < next) out.push(Math.floor(random() * START_BID));
      return out;
    });
    return explored({ ...state, items: next, bids },
      `${state.players} players bidding for ${next} ${next === 1 ? "item" : "items"}.`);
  }

  function reset(state, random = Math.random) {
    return explored({ ...state, bids: randomBids(state.players, state.items, random) },
      "Fresh sealed bids for everyone.");
  }

  /** "done" once the player has explored the table. */
  function result(state) {
    return state.explored ? "done" : null;
  }

  return {
    MIN_PLAYERS, MAX_PLAYERS, MIN_ITEMS, MAX_ITEMS, MAX_BID, START_BID, LETTERS,
    start, compute, cutDigits, highestBidder, setBid, setPlayers, setItems,
    reset, result, randomBids,
  };
})();
