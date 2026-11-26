/*
 * run_game_logic actions and saved-position reader for the Method of Sealed Bids.
 * The core lives in sealed-bids/ and is copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["sealed-bids"].SealedBidsCore;
type Core = ReturnType<typeof core>;
type BidState = { players: number; items: number; bids: number[][] };

/** Validate a bid table: one row per bidder, one number per item, 0..MAX_BID. */
function bidTable(value: unknown, key: string, C: Core): number[][] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error(`argument "${key}" must be a non-empty array of bid rows`);
  }
  const rows = value.map((row, r) => {
    if (!Array.isArray(row)) throw new Error(`${key}[${r}] must be an array of numbers`);
    return row.map((x, i) => {
      const n = Number(x);
      if (!Number.isFinite(n)) throw new Error(`${key}[${r}][${i}] is not a number`);
      return n;
    });
  });
  const players = rows.length;
  const items = rows[0].length;
  if (players < C.MIN_PLAYERS || players > C.MAX_PLAYERS) {
    throw new Error(`${key} must have ${C.MIN_PLAYERS}..${C.MAX_PLAYERS} rows (bidders)`);
  }
  if (items < C.MIN_ITEMS || items > C.MAX_ITEMS) {
    throw new Error(`each row of ${key} must have ${C.MIN_ITEMS}..${C.MAX_ITEMS} entries (items)`);
  }
  if (rows.some((row) => row.length !== items)) {
    throw new Error(`every row of ${key} must have the same number of items`);
  }
  if (rows.some((row) => row.some((n) => n < 0 || n > C.MAX_BID))) {
    throw new Error(`bids in ${key} must be 0..${C.MAX_BID}`);
  }
  return rows.map((row) => row.map(Math.round));
}

function stateOf(value: unknown, key: string, C: Core): BidState {
  const bids = bidTable(value, key, C);
  return { players: bids.length, items: bids[0].length, bids };
}

/** A deterministic tie-break keeps the tutor's answers reproducible; the applet flips a coin. */
const steadyRandom = () => 0.5;

/** Explain one calculated table, using the same names the page prints. */
function describe(C: Core, s: BidState, winners: number[]) {
  const r = C.compute(s, steadyRandom);
  const name = (p: number) => C.LETTERS[p] ?? `?${p}`;
  return {
    players: s.players,
    items: s.items,
    bids: s.bids,
    winners: winners.slice(),
    perItem: Array.from({ length: s.items }, (_, i) => {
      const bids = s.bids.map((row) => row[i]);
      const p = winners[i];
      return {
        item: i + 1,
        winner: p >= 0 && p < s.players ? name(p) : null,
        winningBid: p >= 0 && p < s.players ? s.bids[p][i] : null,
        averageBid: bids.reduce((a, b) => a + b, 0) / s.players,
        excessOverAverage: p >= 0 && p < s.players ? s.bids[p][i] - bids.reduce((a, b) => a + b, 0) / s.players : null,
      };
    }),
    perBidder: Array.from({ length: s.players }, (_, p) => ({
      bidder: name(p),
      total: r.totals[p],
      fairShare: r.fairText[p],
      itemsWon: r.won[p],
      received: r.received[p],
      owes: r.owedText[p],
      finalCash: r.cashText[p],
    })),
    surplus: C.cutDigits(r.surplus),
    equalShareOfSurplus: C.cutDigits(r.share),
    finalCashSumsToZero: Math.abs(r.cash.reduce((a, b) => a + b, 0)) < 1e-9,
  };
}

export function actions(): GameActions {
  return {
    allocate: {
      describe:
        "Allocate a sealed-bid table: each item goes to its highest bidder (a tie is broken by a coin flip in the applet), while every bidder's fair share is the average of their own bids. Reports each item's winner, what each person received, owes and finally pays or is paid, and the surplus split equally so the cash payments add up to zero.",
      args: '{ "bids": [[9, 4, 2], [6, 7, 1], [3, 5, 8]] }',
      run: (args) => {
        const C = core();
        const s = stateOf(args.bids, "bids", C);
        return { ...describe(C, s, C.compute(s, steadyRandom).winners),
          note: "Owes = received − fair share; final cash = −(owes) + an equal slice of the surplus, so the cash column balances." };
      },
    },
  };
}

/** Explain a position the page saved with Track.state({ players, items, bids, winners, surplus, cash, explored }). */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Sealed Bids state version ${stateVersion}`);
  const C = core();
  const s = stateOf(state.bids, "bids", C);
  const r = C.compute(s, steadyRandom);
  const winners = (Array.isArray(state.winners) ? state.winners : r.winners)
    .slice(0, s.items).map((p) => Math.round(Number(p)));
  const savedCash = Array.isArray(state.cash) ? state.cash.map((v) => Number(v)) : r.cash;
  const savedSurplus = Number(state.surplus);
  return {
    players: s.players,
    items: s.items,
    bids: s.bids,
    winners,
    surplus: Number.isFinite(savedSurplus) ? savedSurplus : r.surplus,
    cash: savedCash,
    explored: state.explored === true,
    analysis: describe(C, s, winners),
    note: "The highest bid on each item wins it; a fair share is the average of that bidder's own bids, and the leftover surplus is shared equally so final cash sums to zero.",
  };
}
