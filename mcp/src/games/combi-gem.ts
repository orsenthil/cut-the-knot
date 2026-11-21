/*
 * run_game_logic actions and saved-position reader for Combi Gem.
 *
 * Every number below comes from the game's real core (combi-gem/), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 * The core exposes computeSums/sums/describe, pairCount and isPowerOfTwo; the
 * reader only assembles them into answers a tutor can show.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type GemState = { nums: number[]; n: number; s: number; economize: boolean };

interface CombiGemCoreType {
  MAX_SIZE: number;
  MIN_SUMMONDS: number;
  MAX_SUMMONDS: number;
  DEFAULT_POOL: number[];
  clampInt(value: unknown, lo: number, hi: number, fallback: number): number;
  isPowerOfTwo(n: number): boolean;
  pairCount(k: number): number;
  sums(state: GemState): number[];
  describe(state: GemState): { sums: number[]; count: number; distinct: number; text: string };
}

const core = (): CombiGemCoreType =>
  (cores["combi-gem"] as unknown as { CombiGemCore: CombiGemCoreType }).CombiGemCore;

function sameList(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** A state shaped exactly like the plain position the page saves. */
function makeState(nums: number[], s: number, economize: boolean): GemState {
  const C = core();
  const values = nums.slice();
  return {
    nums: values,
    n: values.length,
    s: C.clampInt(s, C.MIN_SUMMONDS, C.MAX_SUMMONDS, 2),
    economize: !!economize,
  };
}

function readNums(args: Json, key: string): number[] {
  if (!Array.isArray(args[key])) throw new Error(`argument "${key}" must be an array of numbers`);
  return numArray(args, key);
}

/**
 * The size condition behind the theorem. For s = 2 the Erdős–Selfridge proof
 * gives n = 2^(k-1); for s summonds it gives n^(s-1) = s^(k-1), which is only
 * necessary. Kept here (rather than in the core) so the core stays a verbatim
 * copy of the page's logic.
 */
function sizeRule(n: number, s: number) {
  if (s === 2) {
    const power = core().isPowerOfTwo(n);
    return {
      equation: "n = 2^(k-1)",
      necessary: power,
      nPower: power,
      kMinusOne: power ? Math.round(Math.log(n) / Math.log(2)) : null,
      note: "Equal A2 lists force the same size n, and a second collection is possible only when n is a power of two.",
    };
  }
  const lhs = Math.pow(n, s - 1);
  const raw = n > 0 && s > 1 ? Math.log(lhs) / Math.log(s) : NaN;
  const rounded = Number.isFinite(raw) ? Math.round(raw) : -1;
  const necessary = Number.isFinite(raw) && Math.abs(raw - rounded) < 1e-9 && Math.pow(s, rounded) === lhs;
  return {
    equation: `n^${s - 1} = s^(k-1)`,
    necessary,
    nPowerOfS: necessary,
    kMinusOne: necessary ? rounded : null,
    note: "This size equation is necessary, not sufficient: equal lists still need not come from the same collection.",
  };
}

export function actions(): GameActions {
  return {
    pair_sums: {
      describe:
        "Compute the sorted list A_s for a collection (default s = 2), optionally compare it with a second collection, and say whether the theorem's size condition allows the two lists to match. Also shows what turning Economize off does.",
      args: '{ "nums": [2, 3, 6, 9], "other": [1, 4, 7, 8], "s": 2, "economize": true }',
      run: (args) => {
        const C = core();
        const s = num(args, "s", 2);
        const economize = args.economize === undefined ? true : !!args.economize;
        const a = makeState(readNums(args, "nums"), s, economize);
        const da = C.describe(a);
        const result: Record<string, unknown> = {
          s: a.s,
          economize: a.economize,
          collection: a.nums,
          n: a.n,
          pairCount: C.pairCount(a.n),
          sums: da.sums,
          count: da.count,
          distinct: da.distinct,
          withoutEconomizeCount: C.sums({ ...a, economize: false }).length,
          sizeRule: sizeRule(a.n, a.s),
          text: da.text,
        };
        if (args.other !== undefined && args.other !== null) {
          const b = makeState(readNums(args, "other"), a.s, a.economize);
          const db = C.describe(b);
          const sameSums = sameList(da.sums, db.sums);
          result.otherCollection = b.nums;
          result.otherN = b.n;
          result.otherPairCount = C.pairCount(b.n);
          result.otherSums = db.sums;
          result.sameSums = sameSums;
          result.sameSize = a.n === b.n;
          result.theoremAllowsAMatch =
            a.n === b.n && C.isPowerOfTwo(a.n) && (a.s !== 2 || sizeRule(a.n, a.s).necessary);
          result.note = sameSums
            ? `These two collections give the same ${da.count}-entry list. Equal lists force equal sizes, and a genuinely different partner is possible only at a size allowed by the theorem.`
            : `The two lists differ (${da.count} entries versus ${db.count}), so these collections are not an equal-sums pair.`;
        } else {
          result.note = `A = {${a.nums.join(", ")}} gives ${da.count} sums, with ${da.distinct} distinct values. With Economize off there would be ${result.withoutEconomizeCount} entries.`;
        }
        return result;
      },
    },

    size_rule: {
      describe:
        "Check why equal pair-sum lists must come from collections of the same size: tabulate C(k,2) for the applet's sizes, confirm it strictly increases, and list the sizes at which the Erdős–Selfridge theorem permits a second collection.",
      args: '{ "n": 4 }',
      run: (args) => {
        const C = core();
        const n = num(args, "n", 4);
        const sizes: Array<{ size: number; pairCount: number; powerOfTwo: boolean }> = [];
        for (let k = 1; k <= C.MAX_SIZE; k++) {
          sizes.push({ size: k, pairCount: C.pairCount(k), powerOfTwo: C.isPowerOfTwo(k) });
        }
        const strictlyIncreasing = sizes.every(
          (entry, i) => i === 0 || entry.pairCount > sizes[i - 1].pairCount,
        );
        return {
          sizes,
          strictlyIncreasing,
          theoremSizes: sizes.filter((entry) => entry.powerOfTwo).map((entry) => entry.size),
          askedSize: n,
          pairCountAtAskedSize: C.pairCount(n),
          powerOfTwoAtAskedSize: C.isPowerOfTwo(n),
          note: strictlyIncreasing
            ? "C(k,2) grows strictly, so two identical A2 lists must have the same number of entries and hence the same size n. The theorem then restricts a real second collection to the power-of-two sizes."
            : "The pair count is not strictly increasing in this range, so the size argument would fail.",
        };
      },
    },

    three_sums: {
      describe:
        "Check the page's guess that equal A_s lists force equal collections when n is a power of s. For s = 3, n = 3 the core verifies that two different collections have the same A_3 list, disproving the guess.",
      args: '{ "s": 3, "first": [0, 3, 3], "second": [1, 1, 4] }',
      run: (args) => {
        const s = num(args, "s", 3);
        const firstNums = args.first === undefined ? [0, 3, 3] : readNums(args, "first");
        const secondNums = args.second === undefined ? [1, 1, 4] : readNums(args, "second");
        const a = makeState(firstNums, s, true);
        const b = makeState(secondNums, s, true);
        const da = core().describe(a);
        const db = core().describe(b);
        const sameSums = sameList(da.sums, db.sums);
        const differentCollections = !sameList(a.nums, b.nums);
        const rule = sizeRule(a.n, a.s);
        const rough = makeState(firstNums, a.s, false);
        const roughB = makeState(secondNums, a.s, false);
        return {
          s: a.s,
          n: a.n,
          first: a.nums,
          firstSums: da.sums,
          second: b.nums,
          secondSums: db.sums,
          sameSums,
          differentCollections,
          sameSize: a.n === b.n,
          sizeRule: rule,
          sameSumsWithoutEconomize: sameList(core().sums(rough), core().sums(roughB)),
          pageGuessDisproved: sameSums && differentCollections && a.n === b.n && rule.necessary,
          note: sameSums && differentCollections
            ? `For s = ${a.s} and n = ${a.n} the necessary condition ${rule.equation} holds (k-1 = ${rule.kMinusOne}), yet {${a.nums.join(", ")}} and {${b.nums.join(", ")}} give the same list. The page's guess that equal A_s forces A = B when n is a power of s is false; the size equation is only necessary.`
            : "These collections do not give a counterexample: either their sum lists match and the collections match, or the lists differ.",
        };
      },
    },
  };
}

/** What the core says about the collection and sums currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const nums = Array.isArray(state.nums) ? readNums(state, "nums") : C.DEFAULT_POOL.slice();
  const n = C.clampInt(
    state.n === undefined ? nums.length : state.n,
    1,
    Math.max(1, nums.length),
    nums.length,
  );
  const here: GemState = {
    nums: nums.slice(),
    n,
    s: C.clampInt(state.s === undefined ? 2 : state.s, C.MIN_SUMMONDS, C.MAX_SUMMONDS, 2),
    economize: state.economize === undefined ? true : !!state.economize,
  };
  const d = C.describe(here);
  const rule = sizeRule(here.n, here.s);
  const savedSums = Array.isArray(state.sums) ? readNums(state, "sums") : null;
  const theorem =
    here.s === 2
      ? rule.necessary
        ? `n = ${here.n} is a power of two, the only kind of size at which a different collection can share this A2 list.`
        : `n = ${here.n} is not a power of two, so by the Erdős–Selfridge theorem no different collection can share this A2 list.`
      : `For ${here.s} summonds the necessary size condition is ${rule.equation}; n = ${here.n} ${rule.necessary ? `meets it (k-1 = ${rule.kMinusOne}), but that still does not force equal collections` : "does not meet it, so equal lists are impossible"}. The page's guess that equal A_s forces A = B when n is a power of s is false (s = 3, n = 3 has a counterexample).`;
  return {
    collection: here.nums.slice(0, here.n),
    n: here.n,
    s: here.s,
    economize: here.economize,
    pairCount: C.pairCount(here.n),
    sums: d.sums,
    count: d.count,
    distinct: d.distinct,
    savedSumsMatchCore: savedSums === null ? null : sameList(savedSums, d.sums),
    sizeRule: rule,
    theorem,
    note: `A = {${here.nums.slice(0, here.n).join(", ")}} gives ${d.count} ${d.count === 1 ? "sum" : "sums"}. ${d.text} ${theorem}`,
  };
}
