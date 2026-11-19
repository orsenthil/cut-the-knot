/*
 * run_game_logic actions and saved-position reader for Bachet's card trick.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bachet"].BachetCore;

function readGame(args: Json) {
  const C = core();
  return C.start({
    n: num(args, "n", 4),
    straight: args.straight !== false,
    randomized: args.randomized === true,
    seed: num(args, "seed", 1),
  });
}

export function actions(): GameActions {
  return {
    reveal: {
      describe:
        "Play the trick from a chosen pair: find its two cards in the grid, report their rows, and show the pair the computer announces.",
      args: '{ "n": 4, "pair": 0, "straight": true, "randomized": false, "seed": 1 }',
      run: (args) => {
        const C = core();
        let state = readGame(args);
        const pair = Math.trunc(num(args, "pair", 0));
        if (!Number.isInteger(pair) || pair < 0 || pair >= state.pairs.length) {
          throw new Error(`pair must be 0 to ${state.pairs.length - 1}`);
        }
        state = C.choosePair(state, pair);
        const labels = state.pairs[pair].labels;
        const places = labels.map((label: number) => C.locate(state, label));
        if (!places[0] || !places[1]) throw new Error("a chosen card was not found in the grid");
        const rows = [places[0][0], places[1][0]];
        const told = C.reportSelection(state, rows[0], rows[1]);
        return {
          n: state.n,
          pair: labels,
          stage1Rows: C.stage1Rows(state).map((row: { index: number; labels: number[] }[]) => row.map((c) => c.labels)),
          grid: state.rows.map((row: number[]) => row.slice()),
          places,
          reportedRows: rows,
          answer: told.answer,
          message: C.announcement(told),
          note: told.answer
            ? `The two rows ${rows.join(" and ")} identify the pair ${told.answer.join(" and ")}.`
            : "Those rows did not identify a pair.",
        };
      },
    },
    grid: {
      describe:
        "Show the N by (N+1) grid of cards for a given N and options, with every pair's two cards in different rows.",
      args: '{ "n": 4, "straight": true, "randomized": false, "seed": 1 }',
      run: (args) => {
        const C = core();
        const state = readGame(args);
        return {
          n: state.n,
          cards: state.n * (state.n + 1),
          pairs: state.pairs.length,
          straight: state.straight,
          randomized: state.randomized,
          grid: state.rows.map((row: number[]) => row.slice()),
          note: `${state.pairs.length} pairs, ${state.n * (state.n + 1)} cards, ${state.n} rows of ${state.n + 1}.`,
        };
      },
    },
  };
}

/** What the core says about the cards currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readGame(state);
  const chosen = Number.isInteger(state.chosen) ? state.chosen as number : -1;
  const pair = chosen >= 0 && chosen < here.pairs.length ? here.pairs[chosen].labels : null;
  return {
    n: here.n,
    straight: here.straight,
    randomized: here.randomized,
    seed: here.seed,
    stage: typeof state.stage === "number" ? state.stage : here.stage,
    chosen: pair,
    reportedRows: Array.isArray(state.reportedRows) ? state.reportedRows : [],
    answer: state.answer === null || state.answer === undefined ? null : state.answer,
    message: C.announcement(here),
    note: pair
      ? `The spectator chose ${pair.join(" and ")}; naming the two rows reveals them.`
      : "The trick is waiting for a pair to be chosen.",
  };
}
