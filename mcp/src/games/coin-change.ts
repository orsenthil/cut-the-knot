/*
 * run_game_logic actions and saved-position reader for Coin Change.
 *
 * The core (coin-change/ in the site, copied into src/generated/cores/ at build
 * time) is a demo: it counts the ways to change an amount with a chosen set of
 * coins. `ways` returns an array of BigInts and `countWays` a decimal string;
 * every answer below is converted to a plain string before it is returned, so
 * no raw BigInt can ever reach JSON. See _shared.ts for the shape of a module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["coin-change"].CoinChangeCore;

const CLASSIC_DENOMS = [1, 5, 10, 25, 50];
const CLASSIC_AMOUNT = 100;
const CLASSIC_COUNT = "292";

/** Build a clamped, normalised state from loose action arguments. */
function readOptions(args: Json) {
  const C = core();
  return C.start({ amount: num(args, "amount", C.AMOUNT.initial), denoms: args.denoms });
}

/** The generating-function product: one factor 1/(1 - x^d) per chosen coin. */
function factorText(denoms: number[]): string {
  return denoms.map((d) => `1/(1 - x^${d})`).join(" * ");
}

/** Amounts 1..amount that no combination of the chosen coins can make. */
function unmakeable(C: any, amount: number, denoms: number[]): number[] {
  const w = C.ways(amount, denoms); // BigInt coefficients; compared, never returned
  const bad: number[] = [];
  for (let n = 1; n <= amount; n++) if (w[n] === 0n) bad.push(n);
  return bad;
}

export function actions(): GameActions {
  return {
    count_ways: {
      describe:
        "Count the exact number of ways to change an amount with a chosen set of coin denominations, and compare it with the classic 292 ways to change 100 using coins 1, 5, 10, 25, 50.",
      args: '{ "amount": 100, "denoms": [1, 5, 10, 25, 50] }',
      run: (args) => {
        const C = core();
        const here = readOptions(args);
        const denoms: number[] = here.denoms;
        const amount: number = here.amount;
        const ways = C.countWays(amount, denoms); // already a decimal string
        const classic = C.countWays(CLASSIC_AMOUNT, C.DEFAULT_DENOMS);
        const sameSetup = amount === CLASSIC_AMOUNT && denoms.join(",") === C.DEFAULT_DENOMS.join(",");
        return {
          amount,
          denoms,
          ways,
          generatingFunction: factorText(denoms),
          classic292: {
            amount: CLASSIC_AMOUNT,
            denoms: C.DEFAULT_DENOMS.slice(),
            ways: classic,
            sameSetup,
            sameCount: ways === CLASSIC_COUNT,
          },
          note: `Order does not count: with coins ${denoms.length ? denoms.join(", ") : "none"} the coefficient of x^${amount} in ${factorText(denoms)} is ${ways}. The applet's 64-bit long could overflow on a large count; this exact integer cannot.`,
        };
      },
    },

    ways_table: {
      describe:
        "Show the running-sum coefficients — the number of ways to change each amount from 1 up to a limit — the same numbers the generating-function product gives.",
      args: '{ "amount": 12, "denoms": [1, 5, 10, 25, 50], "limit": 12 }',
      run: (args) => {
        const C = core();
        const here = readOptions(args);
        const denoms: number[] = here.denoms;
        const amount: number = here.amount;
        const limit = Math.min(amount, Math.max(1, num(args, "limit", Math.min(amount, 30))));
        const w = C.ways(amount, denoms); // BigInt coefficients
        const rows = [];
        for (let n = 1; n <= limit; n++) rows.push({ amount: n, ways: w[n].toString() });
        return {
          amount,
          denoms,
          limit,
          waysToMakeNothing: w[0].toString(),
          rows,
          note: `Start with w(0) = 1 and, for each coin d in turn, add w(n - d) into w(n). The table is the product ${factorText(denoms)} expanded: coefficient of x^n is the number of ways to change n.`,
        };
      },
    },

    coin_quirk: {
      describe:
        "See how adding the 2 coin or removing the 1 coin changes the count, and which amounts become impossible to make when the 1 coin is gone.",
      args: '{ "amount": 100 }',
      run: (args) => {
        const C = core();
        const amount = readOptions(args).amount;
        const defaults: number[] = C.DEFAULT_DENOMS.slice();
        const plus2: number[] = C.normalizeDenoms(defaults.concat([2]));
        const no1: number[] = defaults.filter((d: number) => d !== 1);
        const impossible = unmakeable(C, amount, no1);
        return {
          amount,
          original: { denoms: defaults, ways: C.countWays(amount, defaults) },
          withTwoAdded: { denoms: plus2, ways: C.countWays(amount, plus2) },
          withoutOne: { denoms: no1, ways: C.countWays(amount, no1) },
          impossibleWithoutOneCount: impossible.length,
          firstImpossibleWithoutOne: impossible.slice(0, 20),
          note: `Adding a coin can only add ways; taking away the 1 coin leaves ${impossible.length} amounts from 1 to ${amount} that cannot be made at all. That is why the chart has gaps after you untick 1.`,
        };
      },
    },
  };
}

/** What the core says about the coins and amount currently saved by the page. */
export function position(state: Json): unknown {
  const C = core();
  const here = C.start({ amount: num(state, "amount", C.AMOUNT.initial), denoms: state.denoms });
  const denoms: number[] = here.denoms;
  const amount: number = here.amount;
  const explored = state.explored === true;
  const ways = C.countWays(amount, denoms); // the count at the chosen amount
  const classic = C.countWays(CLASSIC_AMOUNT, C.DEFAULT_DENOMS);
  const sameSetup = amount === CLASSIC_AMOUNT && denoms.join(",") === C.DEFAULT_DENOMS.join(",");
  const impossible = denoms.indexOf(1) === -1 ? unmakeable(C, amount, denoms) : [];
  return {
    denoms,
    amount,
    explored,
    ways,
    generatingFunction: factorText(denoms),
    classic292: {
      amount: CLASSIC_AMOUNT,
      denoms: C.DEFAULT_DENOMS.slice(),
      ways: classic,
      sameSetup,
      sameCount: ways === CLASSIC_COUNT,
    },
    impossibleCount: impossible.length,
    firstImpossible: impossible.slice(0, 20),
    note: explored
      ? `The chart is computed: ${ways} way(s) to change ${amount} with coins ${denoms.length ? denoms.join(", ") : "none"}. ${sameSetup ? `This is the classic setup, with ${classic} ways.` : `With the classic coins 1, 5, 10, 25, 50 the same amount would have ${classic} ways.`} Order of the coins never matters.`
      : `Coins ${denoms.length ? denoms.join(", ") : "none"} and amount ${amount} are chosen, but Compute has not been pressed; it will show ${ways} way(s). ${impossible.length ? `Without a 1 coin, ${impossible.length} amounts cannot be made.` : ""}`,
  };
}
