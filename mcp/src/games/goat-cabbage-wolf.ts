/*
 * run_game_logic actions and saved-position reader for Goat, Cabbage and Wolf.
 *
 * The core (goat-cabbage-wolf/ in the site, copied into src/generated/cores/ at
 * build time) knows the loss rule and the breadth-first hint. See _shared.ts
 * for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["goat-cabbage-wolf"].GoatCabbageWolfCore;

function readState(args: Json): { right: boolean[]; boat: string; moves: number; outcome: string | null } {
  const raw = args.right;
  if (!Array.isArray(raw) || raw.length !== 3 || !raw.every((v) => typeof v === "boolean")) {
    throw new Error("right must be three booleans, one per item");
  }
  const boat = args.boat === "right" ? "right" : args.boat === "left" ? "left" : null;
  if (!boat) throw new Error('boat must be "left" or "right"');
  return { right: raw as boolean[], boat, moves: Number(args.moves) || 0, outcome: (args.outcome as string) ?? null };
}

const describeMove = (m: { item: number | null }) =>
  m.item === null ? "cross alone" : `take ${core().NAMES[m.item]} across`;

export function actions(): GameActions {
  return {
    check_position: {
      describe:
        "For a shore layout and the farmer's shore, say what is in danger, which crossings are legal and how many crossings remain in a shortest safe route.",
      args: '{ "right": [false, false, false], "boat": "left" }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const danger = C.danger(state);
        const plan = C.hint(state);
        return {
          right: state.right,
          boat: state.boat,
          farmerShore: state.boat,
          left: state.right.map((v, i) => (v ? null : C.NAMES[i])).filter(Boolean),
          rightShore: state.right.map((v, i) => (v ? C.NAMES[i] : null)).filter(Boolean),
          danger: danger === null ? null : C.LOSS[danger],
          legalCrossings: C.legalMoves(state).map(describeMove),
          shortestRoute: plan && plan.length,
          note: danger !== null
            ? "The unattended pair on the far shore is in danger."
            : plan
              ? "A safe route to the far shore exists."
              : "No safe route from here.",
        };
      },
    },
    all_states: {
      describe:
        "Enumerate all 16 positions (three item locations and the farmer's shore), count the safe ones and confirm the two seven-crossing solutions from the start.",
      args: '{}',
      run: () => {
        const C = core();
        let safe = 0;
        let withHint = 0;
        for (let mask = 0; mask < 8; mask++) {
          for (const boat of ["left", "right"]) {
            const state = { right: [0, 1, 2].map((i) => Boolean(mask & (1 << i))), boat, moves: 0, outcome: null };
            if (C.danger(state) === null) {
              safe++;
              if (C.hint(state)) withHint++;
            }
          }
        }
        const startRoute = C.hint(C.start());
        return {
          totalStates: 16,
          safeStates: safe,
          safeStatesWithARoute: withHint,
          startRoute: startRoute && startRoute.map(describeMove),
          startRouteLength: startRoute && startRoute.length,
          note: "Every safe position has a route; the shortest from the start takes seven crossings.",
        };
      },
    },
  };
}

/** What the core says about a saved board: the shores, danger and next crossing. */
export function position(state: Json): unknown {
  const C = core();
  const board = readState(state);
  const danger = C.danger(board);
  const plan = board.outcome ? null : C.hint(board);
  return {
    left: board.right.map((v, i) => (v ? null : C.NAMES[i])).filter(Boolean),
    right: board.right.map((v, i) => (v ? C.NAMES[i] : null)).filter(Boolean),
    farmerShore: board.boat,
    crossingsSoFar: board.moves,
    result: board.outcome,
    danger: danger === null ? null : C.LOSS[danger],
    nextCrossing: plan && plan.length ? describeMove(plan[0]) : null,
    crossingsLeftInShortestRoute: plan && plan.length,
    note: board.outcome === "win"
      ? "All three reached the far shore."
      : board.outcome === "lose"
        ? "An unattended pair was left behind."
        : danger !== null
          ? "The farmer is on the wrong shore for this layout."
          : "The farmer can still win from here.",
  };
}
