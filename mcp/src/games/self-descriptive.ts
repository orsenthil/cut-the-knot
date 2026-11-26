/*
 * run_game_logic actions and saved-position reader for Self-Descriptive
 * Sentences. The core lives in self-descriptive/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["self-descriptive"].SelfDescriptiveCore;

type C = ReturnType<typeof core>;

/** Validate the two things the page's controls set: a base and one count per digit. */
function readSentence(args: Json): { base: number; counts: number[] } {
  const N = core();
  const base = Math.round(num(args, "base", 10));
  if (!Number.isInteger(base) || base < N.MIN_BASE || base > N.MAX_BASE) {
    throw new Error(`base must be a whole number from ${N.MIN_BASE} to ${N.MAX_BASE}`);
  }
  const counts = numArray(args, "counts").map((v) => Math.round(v));
  if (counts.length !== base) {
    throw new Error(`counts must have exactly ${base} entries, one for each digit 0..${base - 1}`);
  }
  if (counts.some((v) => v < 0 || v > N.MAX_COUNT)) {
    throw new Error(`each count must be a whole number from 0 to ${N.MAX_COUNT}`);
  }
  return { base, counts };
}

/** What the sentence says about itself, next to what it claims. */
function analyse(N: C, base: number, counts: number[]) {
  const written = counts.map((v) => N.write(v, base));
  const labels = counts.map((_, i) => N.write(i, base));
  const digitCounts: number[] = N.countDigits(counts, base); // labels contribute one each
  const isTrue = N.trueCounts(counts, base);
  const mismatches = counts.flatMap((claimed, i) =>
    claimed === digitCounts[i] ? [] : [{ digit: labels[i], claimed, shouldBe: digitCounts[i] }],
  );
  return {
    base,
    counts,
    written,
    labels,
    digitCounts,
    true: isTrue,
    mismatches,
    note: isTrue
      ? `True: the written counts ${written.join(" ")} contain exactly ${digitCounts.join(" ")} of each digit, one occurrence coming from each digit's own label.`
      : `Not yet: the sentence claims ${counts.join(" ")} but its written digits occur ${digitCounts.join(" ")} times (counting each label once).`,
  };
}

export function actions(): GameActions {
  return {
    check: {
      describe:
        "Check whether a row of counts makes a self-descriptive sentence in a given base, and explain the count. Write each count in that base, count every digit in what you wrote, and add one free occurrence from each digit's own label; the sentence is true when each count equals that total.",
      args: '{ "base": 3, "counts": [1, 4, 2] }',
      run: (args) => {
        const { base, counts } = readSentence(args);
        return analyse(core(), base, counts);
      },
    },
    iterate: {
      describe:
        "Repeat the page's Iterate step from a row of counts: replace each count by the number of times its digit appears among the written counts and labels. It lists every row, the step where a true sentence appears, and any cycle the orbit falls into instead.",
      args: '{ "base": 3, "counts": [1, 1, 1], "steps": 8 }',
      run: (args) => {
        const { base, counts } = readSentence(args);
        const N = core();
        const steps = Math.round(num(args, "steps", 12));
        if (!Number.isInteger(steps) || steps < 1 || steps > 60) {
          throw new Error("steps must be a whole number from 1 to 60");
        }
        const start = counts.map((v) => N.write(v, base)).join(" ");
        if (N.trueCounts(counts, base)) {
          return { base, start, rows: [], stepsTaken: 0, trueAtStep: 0, cycle: null, note: "The starting row is already true." };
        }
        let state = N.start({ base, counts });
        const rows: string[] = [];
        const seen = new Map<string, number>([[start, 0]]);
        let trueAtStep: number | null = null;
        let cycle: { from: number; to: number } | null = null;
        for (let i = 1; i <= steps; i++) {
          state = N.iterate(state);
          const line = state.history[state.history.length - 1];
          rows.push(line);
          if (N.trueCounts(state.counts, base)) {
            trueAtStep = i;
            break;
          }
          if (seen.has(line)) {
            cycle = { from: seen.get(line)!, to: i };
            break;
          }
          seen.set(line, i);
        }
        return {
          base,
          start,
          rows,
          stepsTaken: rows.length,
          trueAtStep,
          cycle,
          note: trueAtStep !== null
            ? `Reached a true sentence after ${trueAtStep} ${trueAtStep === 1 ? "step" : "steps"}: ${state.message}`
            : cycle
              ? `No true sentence in ${rows.length} steps: row ${cycle.to} repeats row ${cycle.from}, so the orbit is cycling.`
              : `No true sentence in ${rows.length} steps; keep iterating to see whether it settles or cycles.`,
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const N = core();
  const s = N.start({
    base: Math.round(num(state, "base", 10)),
    counts: Array.isArray(state.counts) ? numArray(state, "counts") : undefined,
  });
  const read = analyse(N, s.base, s.counts);
  return {
    ...read,
    iterations: Math.round(num(state, "iterations", 0)),
    note: `${read.note} ${read.true ? "The sentence is finished." : "Press Iterate to replace the counts by the digits they produce."}`,
  };
}
