/*
 * run_game_logic actions and saved-position reader for Up And Down.
 *
 * The core (up-and-down/up-and-down-core.js in the site) shuffles the cards,
 * tosses a coin for which direction to look for first, and keeps the first
 * monotone run its FindStraight scan reaches. It is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["up-and-down"].UpAndDownCore;

type Run = { positions: number[]; numbers: number[] };
type Board = {
  values: number[];
  risingRun: Run | null;
  fallingRun: Run | null;
  forced: boolean;
  hasRequiredRun: boolean;
  boundAgrees: boolean;
};
type Saved = {
  n: number;
  values: number[];
  hidden: number[];
  direction: string;
  view: string;
  revealed: number[];
};

/** A repeatable stream of [0,1) draws, for the core's shuffle and coin toss. */
function seeded(seed: number) {
  let s = (Math.trunc(seed) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** numArray with the rules the core's start() imposes on a supplied board. */
function permutation(args: Json, key: string, n?: number): number[] {
  const values = numArray(args, key);
  const size = n ?? values.length;
  if (size < 2) throw new Error(`"${key}" needs at least two numbers`);
  if (values.length !== size) throw new Error(`"${key}" must have exactly ${size} numbers`);
  if (!values.every((v) => Number.isInteger(v) && v >= 1 && v <= size)) {
    throw new Error(`"${key}" must be a permutation of 1 to ${size}`);
  }
  if (new Set(values).size !== size) throw new Error(`"${key}" repeats a number`);
  return values;
}

/** Positions are 1-based on the page; the core works with 0-based indices. */
function runOn(values: number[], indices: number[]): Run {
  return {
    positions: indices.map((i) => i + 1),
    numbers: indices.map((i) => values[i]),
  };
}

export function actions(): GameActions {
  const C = core();
  return {
    deal: {
      describe:
        "Deal an Up And Down board with a repeatable seed, or supply your own permutation in values, and report the run the applet really hides: its positions, numbers, direction and length. Training uses five cards and hides at least three; the full game uses ten and hides at least four. The run can be longer than the minimum because the applet extends it.",
      args: '{ "seed": 42 }',
      run: (args) => {
        const training = args.training === undefined ? false : args.training;
        if (typeof training !== "boolean") throw new Error('"training" must be true or false');
        const n = training ? C.TRAINING : C.FULL;
        const seed = Math.trunc(num(args, "seed", 1));
        const values = args.values === undefined ? undefined : permutation(args, "values", n);
        const state = C.start({ training, values, random: seeded(seed) }) as Saved;
        const hidden = state.hidden.slice().sort((a, b) => a - b);
        return {
          seed,
          training,
          n,
          targetRunLength: C.target(n),
          values: state.values,
          direction: state.direction,
          hiddenRun: {
            positions: hidden.map((i) => i + 1),
            numbers: hidden.map((i) => state.values[i]),
            length: hidden.length,
            monotone: C.monotone(state.values, hidden, state.direction),
          },
          visibleNumbers: state.values.filter((_: number, i: number) => !hidden.includes(i)),
          note:
            state.direction === "up"
              ? "The hidden run rises (red cards): the coin chose to look for a rising run first."
              : "The hidden run falls (blue cards): the coin chose to look for a falling run first.",
        };
      },
    },
    check_bound: {
      describe:
        "Check the Erdős–Szekeres bound (r-1)(s-1)+1: that many distinct numbers force r rising or s falling. The core checks a block-built example of length (r-1)(s-1) that avoids both runs, so the bound is sharp; with values, it also reports the first rising and falling runs the applet's own scan finds on your board. r and s default to the game's target length (4 for ten cards, 3 for five).",
      args: '{ "values": [7, 8, 4, 5, 3, 1, 10, 2, 6, 9] }',
      run: (args) => {
        const values = args.values === undefined ? undefined : permutation(args, "values");
        const n = values ? values.length : C.FULL;
        if (n > 20) throw new Error('"values" may have at most 20 numbers');
        const r = Math.round(num(args, "r", C.target(n)));
        const s = Math.round(num(args, "s", C.target(n)));
        if (r < 2 || s < 2 || r > 8 || s > 8) {
          throw new Error('"r" and "s" must be whole numbers from 2 to 8');
        }
        const bound = (r - 1) * (s - 1) + 1;

        // r-1 descending blocks of s-1 numbers: at most one per block can rise,
        // and no block is long enough to fall s times.
        const sharp: number[] = [];
        for (let block = 0; block < r - 1; block++) {
          for (let k = s - 1; k >= 1; k--) sharp.push(block * (s - 1) + k);
        }
        const sharpUp = C.processVector(sharp, r - 1, true) as number[] | null;
        const sharpDown = C.processVector(sharp, s - 1, false) as number[] | null;

        const board: Board | null = values ? (() => {
          const up = C.processVector(values, r - 1, true) as number[] | null;
          const down = C.processVector(values, s - 1, false) as number[] | null;
          const hasRequiredRun = Boolean(up || down);
          return {
            values,
            risingRun: up ? runOn(values, up) : null,
            fallingRun: down ? runOn(values, down) : null,
            forced: n >= bound,
            hasRequiredRun,
            boundAgrees: n < bound || hasRequiredRun,
          };
        })() : null;

        return {
          r,
          s,
          bound,
          sharpExample: {
            values: sharp,
            length: sharp.length,
            avoidsRisingR: sharpUp === null,
            avoidsFallingS: sharpDown === null,
          },
          board,
          note:
            `${bound} = (${r}-1)(${s}-1)+1 distinct numbers force ${r} rising or ${s} falling. ` +
            `The ${sharp.length}-number row ${sharp.join(", ")} has neither, so the bound cannot be lowered.` +
            (values
              ? ` With ${n} numbers the bound ${n >= bound ? "does" : "does not"} force a run; the core found ${board?.hasRequiredRun ? "one" : "none"}.`
              : ""),
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion?: number): unknown {
  const C = core();
  const n = Math.round(num(state, "n"));
  if (n !== C.FULL && n !== C.TRAINING) {
    throw new Error(`"n" must be ${C.TRAINING} (training) or ${C.FULL} (full game)`);
  }
  const values = permutation(state, "values", n);
  const hidden = numArray(state, "hidden");
  if (
    hidden.length === 0 ||
    !hidden.every((i) => Number.isInteger(i) && i >= 0 && i < n) ||
    new Set(hidden).size !== hidden.length
  ) {
    throw new Error('"hidden" must list distinct card indices from 0 to n-1');
  }
  const direction = String(state.direction ?? "");
  if (direction !== "up" && direction !== "down") throw new Error('"direction" must be "up" or "down"');
  const view = String(state.view ?? "visible");
  if (!C.VIEWS.includes(view)) throw new Error(`"view" must be one of ${C.VIEWS.join(", ")}`);
  const revealed = numArray(state, "revealed");
  if (
    !revealed.every((i) => Number.isInteger(i) && hidden.includes(i)) ||
    new Set(revealed).size !== revealed.length
  ) {
    throw new Error('"revealed" must list distinct hidden card indices');
  }

  const here: Saved = { n, values, hidden, direction, view, revealed };
  const saved = C.position(here) as Saved;
  const ordered = hidden.slice().sort((a, b) => a - b);
  const shown = values.filter((_, i) =>
    view === "all" || (view === "hidden" ? hidden.includes(i) : !hidden.includes(i) || revealed.includes(i)));

  return {
    // The page's saved fields, with the same names.
    stateVersion: stateVersion ?? 1,
    n: saved.n,
    values: saved.values,
    hidden: saved.hidden,
    direction: saved.direction,
    view: saved.view,
    revealed: saved.revealed,
    // What the core adds.
    hiddenRun: {
      positions: ordered.map((i) => i + 1),
      numbers: ordered.map((i) => values[i]),
      length: ordered.length,
      direction,
      rising: direction === "up",
      monotone: C.monotone(values, ordered, direction),
    },
    targetRunLength: C.target(n),
    revealedNumbers: revealed.map((i) => values[i]),
    stillHiddenPositions: hidden.filter((i) => !revealed.includes(i)).map((i) => i + 1),
    shownNumbers: shown,
    shownCount: shown.length,
    finished: C.result(here) === "done",
    note:
      `The hidden run is ${ordered.map((i) => values[i]).join(", ")}; it ${direction === "up" ? "rises" : "falls"}. ` +
      `${C.target(n)} numbers is the target length, and (${C.target(n) - 1})×(${C.target(n) - 1})+1 = ${n} forces such a run among all ${n} cards. ` +
      `The player has opened ${revealed.length} of the ${hidden.length} hidden cards.`,
  };
}
