/*
 * Tutor actions and position reader for Pigeon Checkers.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const P = cores["pigeon-checkers"].PigeonCheckersCore;
  return {
    invariant: {
      describe:
        "For board size N, report the colouring counts that prove the right half is unreachable.",
      args: '{ "n": 5 }',
      run: (args) => {
        const n = num(args, "n", 5);
        const inv = P.invariantBlocks(n);
        return {
          n: P.clampN(n),
          kind: inv.kind,
          left: inv.left,
          right: inv.right,
          impossible: inv.impossible,
          note: inv.impossible
            ? `Left has ${inv.left} counters of the invariant colour and the right has ${inv.right}, so the goal is impossible.`
            : "Colouring does not separate the halves for this N.",
        };
      },
    },
    legal_jumps: {
      describe: "List legal jumps from a fresh N×(N+1) starting position.",
      args: '{ "n": 3 }',
      run: (args) => {
        const state = P.start({ n: num(args, "n", 5) });
        return {
          n: state.n,
          pegs: P.pegCount(state),
          jumps: P.legalMoves(state),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const P = cores["pigeon-checkers"].PigeonCheckersCore;
  const n = num(state, "n", 5);
  const inv = P.invariantBlocks(n);
  return {
    n,
    pegs: num(state, "pegs", 0),
    movesSoFar: num(state, "historyLength", 0),
    showHint: Boolean(state.showHint),
    allOnRight: Boolean(state.allOnRight),
    invariant: inv,
    note: inv.impossible
      ? `With N=${n}, the ${inv.kind} colouring has ${inv.left} on the left and ${inv.right} on the right — the goal is impossible.`
      : `N=${n}.`,
  };
}
