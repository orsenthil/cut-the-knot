/*
 * run_game_logic actions and saved-position reader for Right Replacement. The core lives in
 * right-replacement/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["right-replacement"].RightReplacementCore;
type Core = ReturnType<typeof core>;

interface Analysis {
  steps: number;
  reason: string;
  finalRow: number[];
  fixedPoint: boolean;
  isStaircase: boolean;
  allZero: boolean;
  firstRows: number[][];
  lastRows: number[][];
  cycle?: number[][];
}

/** Validate the row and rule, then build the core's starting state. */
function start(C: Core, values: number[], type: string) {
  if (values.length < C.MIN_LENGTH || values.length > C.MAX_LENGTH)
    throw new Error(`values must have ${C.MIN_LENGTH}..${C.MAX_LENGTH} entries`);
  if (values.some((v) => !Number.isInteger(v) || v < C.MIN_VALUE || v > C.MAX_VALUE))
    throw new Error(`values must be whole numbers in ${C.MIN_VALUE}..${C.MAX_VALUE}`);
  if (!C.TYPES.includes(type)) throw new Error(`type must be one of ${C.TYPES.join(", ")}`);
  return C.start({ values, type });
}

function rowAndType(C: Core, args: Json) {
  return { values: numArray(args, "values").map(Math.round), type: String(args.type ?? "LT").toUpperCase() };
}

/** Follow the replacements until the applet's stopping test fires. */
function analyse(C: Core, values: number[], type: string): Analysis {
  const current = start(C, values, type);
  const { rows, reason } = C.iterate(current.values, current.type) as { rows: number[][]; reason: string };
  const final = rows[rows.length - 1];
  const n = current.values.length;
  const staircase = Array.from({ length: n }, (_, i) => n - 1 - i);
  const analysis: Analysis = {
    steps: rows.length,
    reason,
    finalRow: final,
    fixedPoint: (C.step(final, current.type) as number[]).every((v, i) => v === final[i]),
    isStaircase: final.every((v, i) => v === staircase[i]),
    allZero: final.every((v) => v === 0),
    firstRows: rows.slice(0, 3),
    lastRows: rows.slice(-3),
  };
  if (reason === "period-2") analysis.cycle = [rows[rows.length - 2], final];
  return analysis;
}

export function actions(): GameActions {
  return {
    replace: {
      describe: "One pass of Right Replacement: under each number write how many numbers to its right are smaller (LT), smaller or equal (LE), greater (GT) or greater or equal (GE). The last number always becomes zero, since nothing lies to its right; the rule never looks left, so the tail settles first.",
      args: '{ "values": [1, 2, 3, 4], "type": "LE" }',
      run: (args) => {
        const C = core();
        const { values, type } = rowAndType(C, args);
        const current = start(C, values, type);
        return { type: current.type, values: current.values, nextRow: C.step(current.values, current.type) };
      },
    },
    follow: {
      describe: "Apply the replacement again and again until the row stops changing, and report the ending: a fixed point (LE's staircase n-1,...,0, GT's all zeroes, or an LT row that depends on the start) or GE's two-row cycle. The number of steps, first and last rows, and whether the final row is unchanged by another pass show the invariant the puzzle demonstrates.",
      args: '{ "values": [1, 2, 3, 4], "type": "GE" }',
      run: (args) => {
        const C = core();
        const { values, type } = rowAndType(C, args);
        return analyse(C, values, type);
      },
    },
  };
}

/** Describe a position saved by the page with window.Track.state({...}). */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Right Replacement state version ${stateVersion}`);
  const C = core();
  const { values, type } = rowAndType(C, state);
  const current = start(C, values, type);
  const ending = analyse(C, values, type);
  return {
    // The fields the page saves, with the same names.
    length: current.length,
    type: current.type,
    values: current.values,
    computed: state.computed === true,
    reason: state.reason ?? null,
    rows: num(state, "rows", 0),
    lastRow: Array.isArray(state.lastRow) ? (state.lastRow as number[]).map(Math.round) : null,
    // What the core says about that row.
    stepsToFinish: ending.steps,
    finalRow: ending.finalRow,
    fixedPoint: ending.fixedPoint,
    isStaircase: ending.isStaircase,
    allZero: ending.allZero,
    cycle: ending.cycle ?? null,
    firstRows: ending.firstRows,
    lastRows: ending.lastRows,
    note: "Each pass counts entries to the right that match the rule; LE reaches the staircase n-1,...,0, GT all zeroes, LT a fixed row, and GE usually alternates between two rows.",
  };
}
