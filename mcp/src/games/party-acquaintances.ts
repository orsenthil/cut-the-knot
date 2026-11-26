/*
 * run_game_logic actions and saved-position reader for Party Acquaintances. The core lives in
 * party-acquaintances/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["party-acquaintances"].PartyAcquaintancesCore;
type Edge = [number, number, boolean];

function read(s: ReturnType<ReturnType<typeof core>["start"]>) {
  const C = core();
  const ck = C.check(s);
  const one = (sets: number[][]) => sets.map((x) => x.map((i) => i + 1));
  return {
    people: s.n, lookingFor: { red: s.nRed, blue: s.nBlue },
    linesDrawn: s.edges.length, linesInAll: (s.n * (s.n - 1)) / 2,
    redGroups: one(ck.red), blueGroups: one(ck.blue), finished: ck.finished,
    nextColour: s.autoColor ? (s.nextRed ? "red" : "blue") : s.useRed ? "red" : "blue",
  };
}

export function actions(): GameActions {
  return {
    check: {
      describe: "For N people (3..20) and red/blue lines given as [a, b, \"red\"|\"blue\"] (people numbered from 1), the groups of #Red people all joined in red and of #Blue people all joined in blue.",
      args: '{ "n": 6, "nRed": 3, "nBlue": 3, "lines": [[1, 2, "red"], [2, 3, "red"], [1, 3, "red"]] }',
      run: (args) => {
        const C = core();
        const lines = Array.isArray(args.lines) ? (args.lines as unknown[][]) : [];
        let s = C.start({ n: num(args, "n", 6), nRed: num(args, "nRed", 3), nBlue: num(args, "nBlue", 3), autoColor: false });
        for (const l of lines) {
          const t = C.draw({ ...s, useRed: String(l[2]) === "red" }, Number(l[0]) - 1, Number(l[1]) - 1);
          if (!t) throw new Error(`line ${JSON.stringify(l)} cannot be drawn (repeated, out of range, or the drawing is already finished)`);
          s = t;
        }
        return read(s);
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 6), nRed: num(state, "nRed", 3), nBlue: num(state, "nBlue", 3), autoColor: state.autoColor !== false, useRed: state.useRed !== false, edges: (state.edges as Edge[]) ?? [] });
  return { ...read({ ...s, nextRed: state.nextRed !== false }), note: "R(3,3) = 6: every colouring of the 15 lines of K6 has a one-colour triangle." };
}
