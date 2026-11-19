/*
 * run_game_logic actions and saved-position reader for the Chess Truel.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["chess-tournament"].ChessTournamentCore;

function readOptions(args: Json) {
  const C = core();
  return C.clampOptions({
    p: num(args, "p", C.DEFAULTS.p),
    q: num(args, "q", C.DEFAULTS.q),
    r: num(args, "r", C.DEFAULTS.r),
  });
}

export function actions(): GameActions {
  return {
    chances: {
      describe:
        "For three pairwise win probabilities, give every player's chance of taking the series from each of the three possible opening pairs.",
      args: '{ "p": 0.55, "q": 0.6, "r": 0.75 }',
      run: (args) => {
        const C = core();
        const { p, q, r } = readOptions(args);
        const table = C.computeTable(p, q, r);
        return {
          p, q, r,
          table,
          pAB: C.pAB(p, q, r),
          pBC: C.pBC(p, q, r),
          difference: C.difference(p, q, r),
          note: `B does better opening against C than against A by ${C.difference(p, q, r).toFixed(4)}.`,
        };
      },
    },
    formula_check: {
      describe:
        "Check the printed formulas for B's chances and the claim that P_AB is always below P_BC, including its tie cases.",
      args: '{ "p": 0.55, "q": 0.6, "r": 0.75 }',
      run: (args) => {
        const C = core();
        const { p, q, r } = readOptions(args);
        const computed = { pAB: C.pAB(p, q, r), pBC: C.pBC(p, q, r) };
        const printed = { pAB: C.pagePAB(p, q, r), pBC: C.pagePBC(p, q, r) };
        return {
          p, q, r,
          computed,
          printed,
          agree: Math.abs(computed.pAB - printed.pAB) < 1e-12 && Math.abs(computed.pBC - printed.pBC) < 1e-12,
          strictlyLess: C.difference(p, q, r) > 0,
          note: "The claim 'always strictly less' has tie cases at q = r = 1; the inequality is really <=.",
        };
      },
    },
  };
}

/** What the core says about the tournament currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const { p, q, r } = readOptions(state);
  const table = C.computeTable(p, q, r);
  return {
    p, q, r,
    pair: typeof state.pair === "string" ? state.pair : "BC",
    explored: state.explored === true,
    table,
    pAB: C.pAB(p, q, r),
    pBC: C.pBC(p, q, r),
    note: `With p = ${p}, q = ${q}, r = ${r}, B's chances are ${table.AB.B.toFixed(3)} versus A, ${table.BC.B.toFixed(3)} versus C and ${table.AC.B.toFixed(3)} in the A-C opening.`,
  };
}
