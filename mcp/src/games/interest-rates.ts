/*
 * run_game_logic actions and saved-position reader for Interest Rate
 * Calculations. The core lives in interest-rates/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["interest-rates"].InterestRatesCore;
type Result = {
  error?: string; payment?: number; periods?: number; totalPaid?: number; effectiveRate?: number;
  accumulated?: number; contributed?: number; interestEarned?: number;
};

function read(args: Json) {
  const mode = args.mode === "investment" ? "investment" : "loan";
  if (mode === "loan") {
    return {
      mode,
      loan: num(args, "loan", 1000),
      years: num(args, "years", 10),
      interest: num(args, "interest", 12),
      paymentsPerYear: num(args, "paymentsPerYear", 1),
      compoundFreq: num(args, "compoundFreq", 12),
    };
  }
  return {
    mode,
    principal: num(args, "principal", 1000),
    deposit: num(args, "deposit", 100),
    depositsPerYear: num(args, "depositsPerYear", 1),
    interest: num(args, "interest", 5),
    years: num(args, "years", 10),
  };
}

export function actions(): GameActions {
  return {
    calculate: {
      describe: "Compute a loan payment or an investment accumulation, including the effective rate and the interest share.",
      args: '{ "mode": "investment", "principal": 1000, "deposit": 100, "depositsPerYear": 1, "interest": 5, "years": 10 }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const r = C.compute(state) as Result;
        if (r.error) return { error: r.error, note: "See the calculator's validation messages." };
        return {
          mode: state.mode,
          ...(state.mode === "loan"
            ? { payment: r.payment, periods: r.periods, totalPaid: r.totalPaid, effectiveRate: r.effectiveRate }
            : { accumulated: r.accumulated, periods: r.periods, contributed: r.contributed, interestEarned: r.interestEarned }),
          note: "Both formulas come from summing a geometric series.",
        };
      },
    },
    effective_rate: {
      describe: "Report the effective yearly rate produced by compounding a nominal rate a given number of times a year.",
      args: '{ "interest": 12, "compoundFreq": 2 }',
      run: (args) => {
        const interest = num(args, "interest", 12);
        const compoundFreq = num(args, "compoundFreq", 2);
        const rate = core().effectiveRate(interest, compoundFreq);
        return { interest, compoundFreq, effectiveRate: rate, effectivePercent: rate * 100, note: "(1 + q/m)^m - 1" };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  const r = C.compute(input) as Result;
  if (r.error) return { mode: input.mode, error: r.error, note: r.error };
  return {
    mode: input.mode,
    ...(input.mode === "loan"
      ? { payment: r.payment, totalPaid: r.totalPaid, effectiveRate: r.effectiveRate }
      : { accumulated: r.accumulated, contributed: r.contributed, interestEarned: r.interestEarned }),
    note: `${input.mode} calculation complete.`,
  };
}
