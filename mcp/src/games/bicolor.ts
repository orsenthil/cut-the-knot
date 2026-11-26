/*
 * run_game_logic actions and saved-position reader for the Binary Color Device.
 *
 * The page fills a 4x4 grid with the numbers 0..15 by dragging a coloured
 * square onto another: AND, OR and XOR combine the two four-bit numbers, and
 * NOT replaces the source with 15 - a. Every answer here comes from the real
 * core (bicolor/bicolor-core.js), copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

/** The part of BicolorCore this reader uses (the JS core is untyped). */
interface BicolorCoreShape {
  N: number;
  UNASSIGNED: number;
  OPS: Array<{ id: number; label: string; symbol: string; apply: (a: number, b?: number) => number }>;
  binary: (v: number) => string;
  claims: () => {
    and: number[][];
    or: number[][];
    xor: number[][];
    workedExample: number;
    xorInvolution: boolean;
    goal: number[];
  };
  generate: (mode: number, k: number, variant: number) => number[];
  filledCount: (s: { values: number[] }) => number;
  correctCount: (s: { values: number[] }) => number;
  isSolved: (s: { values: number[] }) => boolean;
  result: (s: { values: number[] }) => string | null;
}

const core = () => cores["bicolor"].BicolorCore as unknown as BicolorCoreShape;

/** A whole number from 0 to 15, i.e. one of the device's four-bit values. */
function nibble(args: Json, key: string): number {
  const v = num(args, key);
  if (!Number.isInteger(v) || v < 0 || v >= 16) {
    throw new Error(`"${key}" must be a whole number from 0 to 15, got ${JSON.stringify(args[key])}`);
  }
  return v;
}

/** Accept the applet's Choice index or any of the names printed on the page. */
function opIndex(value: unknown): number {
  const ALIASES: Record<string, number> = {
    "&": 0, and: 0, "0": 0,
    v: 1, "|": 1, or: 1, "1": 1,
    "^": 2, xor: 2, "2": 2,
    "~": 3, not: 3, complement: 3, "3": 3,
  };
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 4) return value;
  const key = String(value ?? "").trim().toLowerCase();
  const idx = ALIASES[key];
  if (idx === undefined) {
    throw new Error('op must be "&" (AND), "V" (OR), "^" (XOR), "~" (NOT), or an index 0-3');
  }
  return idx;
}

export function actions(): GameActions {
  return {
    apply: {
      describe:
        "Apply one of the device's four bitwise operations to four-bit numbers and show the answer in binary and decimal. op is & (AND, 0), V (OR, 1), ^ (XOR, 2) or ~ (NOT, 3); a and b must be whole numbers from 0 to 15. AND/OR/XOR need both a and b; NOT uses only a and gives 15 - a. A drop on an empty square simply copies a.",
      args: '{ "a": 13, "b": 6, "op": "&" }',
      run: (args) => {
        const C = core();
        const a = nibble(args, "a");
        const idx = opIndex(args.op);
        const hasB = args.b !== undefined && args.b !== null;
        if (idx !== 3 && !hasB) throw new Error('"b" is required for AND, OR and XOR (a whole number from 0 to 15)');
        const b = hasB ? nibble(args, "b") : 0;
        const op = C.OPS[idx];
        const result = idx === 3 ? op.apply(a) : op.apply(a, b);
        const how = [
          "AND keeps a bit only where both numbers have a 1.",
          "OR keeps a bit where at least one number has a 1.",
          "XOR keeps a bit where exactly one number has a 1, so equal bits cancel.",
          "NOT flips all four bits, so ~a = 15 - a; the target square is ignored.",
        ][idx];
        const sum = idx === 3
          ? `~${a} = 15 - ${a} = ${result}.`
          : `${C.binary(a)} ${op.symbol} ${C.binary(b)} = ${C.binary(result)}, so ${a} ${op.symbol} ${b} = ${result}.`;
        return {
          op: op.label,
          a,
          aBinary: C.binary(a),
          b: idx === 3 ? null : b,
          bBinary: idx === 3 ? null : C.binary(b),
          result,
          resultBinary: C.binary(result),
          note: `${how} ${sum}`,
        };
      },
    },

    binary_facts: {
      describe:
        "The Boolean facts the page states, all from the core: the AND/OR/XOR truth tables for one bit; the worked example 13 & 6 = 4 shown bit by bit; and the identity a ^ b ^ b = a checked for all 256 pairs of numbers from 0 to 15. Optional a and b (default 9 and 5) show one pair of that identity worked out.",
      args: '{ "a": 9, "b": 5 }',
      run: (args) => {
        const C = core();
        const a = args.a === undefined ? 9 : nibble(args, "a");
        const b = args.b === undefined ? 5 : nibble(args, "b");
        const facts = C.claims();
        const xor = C.OPS[2].apply;
        const afterTwoXors = xor(xor(a, b), b);
        return {
          truthTables: { and: facts.and, or: facts.or, xor: facts.xor },
          workedExample: {
            a: 13,
            aBinary: C.binary(13),
            b: 6,
            bBinary: C.binary(6),
            result: facts.workedExample,
            resultBinary: C.binary(facts.workedExample),
            equation: "13 & 6 = 1101 & 0110 = 0100 = 4",
          },
          xorInvolution: facts.xorInvolution,
          pairsChecked: C.N * C.N,
          exampleIdentity: {
            a,
            b,
            aXorB: xor(a, b),
            aXorBXorB: afterTwoXors,
            equalsA: afterTwoXors === a,
          },
          note:
            "Each operation compares matching bits: AND needs both bits set, OR needs either, XOR needs exactly one. The page's example is exact: 1101 & 0110 = 0100 = 4. XOR twice with the same number undoes itself, since b ^ b = 0 and a ^ 0 = a; the core verified this for every pair from 0 to 15.",
        };
      },
    },
  };
}

/** What the core says about the grid the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Binary Color Device state version ${stateVersion}`);
  }
  const C = core();
  const values = numArray(state, "values");
  if (values.length !== C.N) {
    throw new Error(`"values" must hold ${C.N} squares, got ${values.length}`);
  }
  const clean = values.map((v, i) => {
    if (!Number.isInteger(v) || v < C.UNASSIGNED || v >= C.N) {
      throw new Error(`values[${i}] must be -1 (empty) or a whole number from 0 to 15`);
    }
    return v;
  });

  const op = Math.max(0, Math.min(C.OPS.length - 1, Math.trunc(num(state, "op", 0))));
  const selected = Math.trunc(num(state, "selected", -1));
  const arg1 = Math.trunc(num(state, "arg1", -1));
  const arg2 = Math.trunc(num(state, "arg2", -1));
  const mode = Math.trunc(num(state, "mode", 0));
  const k = Math.trunc(num(state, "k", 0));
  const variant = Math.trunc(num(state, "variant", 0));
  const s = { values: clean };

  const filled = C.filledCount(s);
  const correct = C.correctCount(s);
  const solved = C.isSolved(s);
  const present = clean.filter((v) => v !== C.UNASSIGNED);
  const missing = Array.from({ length: C.N }, (_, i) => i).filter((i) => !present.includes(i));
  const duplicates = Array.from({ length: C.N }, (_, i) => i).filter((i) => present.filter((v) => v === i).length > 1);
  const start = C.generate(mode, k, variant);
  const unchanged = clean.filter((v, i) => v === start[i]).length;

  // The last drag is only meaningful if all three saved squares hold a number.
  let lastDrop: unknown = null;
  const inGrid = (i: number) => Number.isInteger(i) && i >= 0 && i < C.N;
  if (inGrid(arg1) && inGrid(arg2) && inGrid(selected) &&
      clean[arg1] !== C.UNASSIGNED && clean[arg2] !== C.UNASSIGNED) {
    const expected = op === 3 ? C.OPS[op].apply(clean[arg1]) : C.OPS[op].apply(clean[arg1], clean[arg2]);
    lastDrop = {
      sourceSquare: arg1,
      targetSquare: selected,
      source: clean[arg1],
      target: clean[arg2],
      op: C.OPS[op].label,
      expected,
      actual: clean[selected],
      matches: expected === clean[selected],
    };
  }

  const missingText = missing.length ? ` Still missing: ${missing.join(", ")}.` : "";
  const duplicateText = duplicates.length ? ` Repeated: ${duplicates.join(", ")}.` : "";
  const dropText = lastDrop
    ? ` The saved drag would put ${(lastDrop as { expected: number }).expected} in square ${selected + 1}.`
    : "";

  return {
    stateVersion,
    values: clean,
    squares: clean.map((v, i) => ({ square: i, value: v, binary: v === C.UNASSIGNED ? "----" : C.binary(v) })),
    op,
    opLabel: C.OPS[op].label,
    selected,
    arg1,
    arg2,
    mode,
    k,
    variant,
    filled,
    correct,
    solved,
    result: C.result(s),
    missing,
    duplicates,
    unchangedFromStart: unchanged,
    startingPattern: start,
    lastDrop,
    note: `${filled}/${C.N} squares are filled and ${correct}/${C.N} hold their own number. ${solved ? "Every square holds its own number, so the device is complete." : "The grid is not complete yet."}${missingText}${duplicateText} Operation: ${C.OPS[op].label}.${dropText}`,
  };
}
