/*
 * run_game_logic actions and saved-position reader for Fast Power Indices. The core lives in
 * power-indices/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["power-indices"].PowerIndicesCore;

function read(C: ReturnType<typeof core>, s: { set: string; quota: number; players: [string, number][] }) {
  const r = C.compute(s);
  const base = { set: s.set, quota: s.quota, totalVotes: C.total(s), players: s.players.length };
  if (!r) return { ...base, noWinningCoalition: true };
  const rows = s.players.map(([name, w], i) => ({ name, weight: w, banzhaf: r.banzhafShare[i], shapleyShubik: r.shapley[i] }));
  return { ...base, banzhafSwingsInAll: String(r.banzhafTotal), table: rows };
}

export function actions(): GameActions {
  return {
    indices: {
      describe: 'Banzhaf and Shapley-Shubik shares by generating polynomials, for one of the data sets ("Electoral College (1990)", "Electoral College (2000)", "European Union", "Security Council") or your own quota and players.',
      args: '{ "set": "Security Council" }',
      run: (args) => {
        const C = core();
        if (Array.isArray(args.players)) return read(C, C.start({ quota: num(args, "quota"), players: args.players as [string, number][] }));
        const name = typeof args.set === "string" ? args.set : "Security Council";
        if (!C.DATA.some((d: { name: string }) => d.name === name)) throw new Error(`unknown data set ${JSON.stringify(name)}`);
        return read(C, C.start({ set: name }));
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = Array.isArray(state.players) ? C.start({ set: state.set, quota: num(state, "quota", 1), players: state.players }) : C.start({});
  const out = read(C, s) as Record<string, unknown>;
  if (Array.isArray(out.table) && out.table.length > 12) out.table = (out.table as unknown[]).slice(0, 12);
  return { ...out, note: "Shares of power, not of votes; the table is cut to the first 12 players." };
}
