/*
 * run_game_logic actions and saved-position reader for Weighted Voting and Power Indices. The
 * core lives in power-index/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["power-index"].PowerIndexCore;

function read(C: ReturnType<typeof core>, s: { quota: number; votes: number[] }) {
  const r = C.indices(s);
  if (!r) return { system: `[${s.quota}: ${s.votes.join(", ")}]`, totalVotes: C.total(s), noWinningCoalition: true };
  return {
    system: `[${s.quota}: ${s.votes.join(", ")}]`, totalVotes: C.total(s),
    banzhaf: { counts: r.banzhaf.counts, total: r.banzhaf.total },
    shapleyShubik: { counts: r.shapley.counts, orders: r.shapley.total },
    dummies: r.dummies.map((i: number) => i + 1), dictators: r.dictators.map((i: number) => i + 1),
  };
}

export function actions(): GameActions {
  return {
    indices: {
      describe: "Banzhaf counts (times each player is critical to a winning coalition) and Shapley-Shubik counts (orders in which each is pivotal, out of n!) for a weighted voting system [quota: votes...], up to 15 players.",
      args: '{ "quota": 6, "votes": [4, 3, 2, 1] }',
      run: (args) => {
        const C = core();
        return read(C, C.start({ quota: num(args, "quota"), votes: numArray(args, "votes") }));
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ quota: num(state, "quota", 6), votes: Array.isArray(state.votes) ? (state.votes as number[]) : [4, 3, 2, 1], compute: state.compute === true });
  return { ...read(C, s), indicesShownOnPage: s.compute, note: "Votes are not power: a player can have votes and be a dummy." };
}
