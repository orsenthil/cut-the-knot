/*
 * Tutor actions and position reader for Sticky Problem.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const S = cores["sticky-problem"].StickyProblemCore;
  return {
    is_p: {
      describe: "Say whether a stick list is a P-position under (k+m) mod 2 = (l+n) mod 3.",
      args: '{ "sticks": [1, 4, 4, 4, 4] }',
      run: (args) => {
        const sticks = (args.sticks as number[]) || S.STANDARD;
        const counts = S.countsOf(sticks);
        return {
          sticks,
          counts: { k: counts[0], l: counts[1], m: counts[2], n: counts[3] },
          r: S.rOf(counts),
          s: S.sOf(counts),
          isP: S.isP(sticks),
        };
      },
    },
    computer_reply: {
      describe: "Apply the applet's Play() computer move (optional seed in [0,1)).",
      args: '{ "sticks": [1, 4, 4, 4, 4], "seed": 0 }',
      run: (args) => {
        let state = S.start({ sticks: (args.sticks as number[]) || S.STANDARD });
        state = { ...state, turn: "computer" };
        const seed = Number(args.seed);
        const rnd = Number.isFinite(seed) ? () => seed : Math.random;
        const before = state.sticks.slice();
        state = S.playComputer(state, rnd);
        return {
          before,
          sticks: state.sticks,
          over: state.over,
          winner: state.winner,
          isP: S.isP(state.sticks),
        };
      },
    },
    legal_moves: {
      describe: "List break and remove moves from a position.",
      args: '{ "sticks": [4, 4] }',
      run: (args) => {
        const state = S.start({ sticks: (args.sticks as number[]) || [4] });
        return {
          sticks: state.sticks,
          breaks: S.legalBreaks(state),
          removes: S.legalRemoves(state),
          isP: S.isP(state.sticks),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const S = cores["sticky-problem"].StickyProblemCore;
  const game = S.restore(state);
  const sticks = Array.isArray(state.sticks) ? (state.sticks as number[]) : game.sticks;
  const counts = S.countsOf(sticks);
  const over = Boolean(state.over);
  const turn = typeof state.turn === "string" ? state.turn : game.turn;
  const moves = S.legalMoves(S.start({ sticks }));
  return {
    finished: over,
    turn,
    sticks: sticks.slice(),
    counts: { k: counts[0], l: counts[1], m: counts[2], n: counts[3] },
    isP: S.isP(sticks),
    legalMoves: moves.length,
    winner: state.winner ?? null,
    note: over
      ? state.winner === "you"
        ? "You won — last stick."
        : "Computer won — last stick."
      : turn === "you"
        ? `${moves.length} legal move${moves.length === 1 ? "" : "s"}; ${S.isP(sticks) ? "P" : "N"}-position.`
        : "Computer to move.",
  };
}
