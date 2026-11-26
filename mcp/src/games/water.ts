/*
 * run_game_logic actions and saved-position reader for Water.
 *
 * The core (water/water-core.js, copied into src/generated/cores/ at build
 * time) owns the pour rule and the breadth-first search. This module only
 * reads arguments, calls the core and writes down the maths. See _shared.ts
 * for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores.water.WaterCore;
type WaterCore = ReturnType<typeof core>;

/** Capacities must be three whole numbers in the applet's 0..20 range. */
function readCaps(args: Json, key: string): number[] {
  const caps = numArray(args, key);
  if (caps.length !== 3) throw new Error(`${key} must be three numbers: capacities of A, B and C`);
  if (!caps.every((c) => Number.isInteger(c) && c >= 0 && c <= core().CAP_MAX)) {
    throw new Error(`${key} must be three whole numbers from 0 to ${core().CAP_MAX}`);
  }
  return caps;
}

/** The page calls them `caps`; the core's API calls them `capacities`. */
const capsFrom = (args: Json): number[] =>
  readCaps({ capacities: args.capacities ?? args.caps }, "capacities");

function readTarget(args: Json, caps: number[]): number {
  const target = num(args, "target");
  if (!Number.isInteger(target) || target < 0 || target > caps[2]) {
    throw new Error(`target must be a whole number from 0 to ${caps[2]}`);
  }
  return target;
}

/**
 * Fewest pours from the saved amounts, using only the core's own `pour` and
 * `legalMoves`. A fresh start is the core's `solve`; a player who edited the
 * levels may be somewhere `solve` never considers, so this search starts here.
 */
function poursToTarget(C: WaterCore, caps: number[], values: number[], target: number): number | null {
  const make = (vals: number[]) => ({ caps, values: vals, target, moves: 0, history: [] as number[][] });
  const seen = new Set([values.join(",")]);
  let frontier = [{ values: values.slice(), pours: 0 }];
  for (;;) {
    const found = frontier.find((f) => C.result(make(f.values)) === "done");
    if (found) return found.pours;
    const next: { values: number[]; pours: number }[] = [];
    for (const f of frontier) {
      const here = make(f.values);
      for (const move of C.legalMoves(here)) {
        const after = C.pour(here, move.from, move.to);
        if (!after) continue;
        const k = after.values.join(",");
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ values: after.values, pours: f.pours + 1 });
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
}

export function actions(): GameActions {
  const C = core();

  return {
    fewest_pours: {
      describe:
        "The fewest pours that measure `target` in one of the three jugs, starting with A and B empty and C full, with capacities `[A, B, C]`. Each pour empties the source or fills the destination. Returns a step-by-step recipe, or `solvable: false` with the gcd reason when the target cannot be measured.",
      args: '{ "capacities": [3, 5, 8], "target": 4 }',
      run: (args) => {
        const caps = capsFrom(args);
        const target = readTarget(args, caps);
        const solution = C.solve(caps, target);
        if (!solution) {
          const g = C.gcd(C.gcd(caps[0], caps[1]), caps[2]);
          const divisible = g === 0 ? target === 0 : target % g === 0;
          return {
            solvable: false,
            capacities: caps,
            target,
            gcd: g,
            why: divisible
              ? `${target} is a multiple of gcd(${caps.join(", ")}) = ${g}, yet no sequence of pours measures it: the jug sizes limit what can be held (with jugs 1, 1, 5 the gcd is 1 but 2 cannot be measured).`
              : `Every amount in any jug is a multiple of gcd(${caps.join(", ")}) = ${g}, and ${target} is not, so it can never be measured.`,
          };
        }
        const steps: Array<{ from: number; to: number; amount: number; before: number[]; after: number[] }> =
          solution.steps;
        return {
          solvable: true,
          capacities: caps,
          target,
          pours: solution.length,
          steps: steps.map((s) => ({
            say: C.describe(s),
            from: C.NAMES[s.from],
            to: C.NAMES[s.to],
            amount: s.amount,
            before: { A: s.before[0], B: s.before[1], C: s.before[2] },
            after: { A: s.after[0], B: s.after[1], C: s.after[2] },
          })),
          note: "Each step moves min(amount in source, space left in destination), so the source ends empty or the destination ends full.",
        };
      },
    },
    reachable_amounts: {
      describe:
        "Which amounts from 0 to C can actually be measured with capacities `[A, B, C]`, found by running the solver on every target. Compares them with the multiples of gcd(A, B, C): being a multiple is necessary but not always enough. For jugs 1, 1, 5 the gcd is 1, yet 2 cannot be measured because the two small jugs hold at most 1 each, so the big jug can never drop below 3.",
      args: '{ "capacities": [1, 1, 5] }',
      run: (args) => {
        const caps = capsFrom(args);
        const g = C.gcd(C.gcd(caps[0], caps[1]), caps[2]);
        const candidates = Array.from({ length: caps[2] + 1 }, (_, t) => t);
        const reachable = candidates.filter((t) => C.solve(caps, t) !== null);
        const multiplesOfGcd = candidates.filter((t) => (g === 0 ? t === 0 : t % g === 0));
        const gcdButNotReachable = multiplesOfGcd.filter((t) => !reachable.includes(t));
        return {
          capacities: caps,
          gcd: g,
          reachableAmounts: reachable,
          multiplesOfGcd,
          gcdAllowedButUnreachable: gcdButNotReachable,
          note: gcdButNotReachable.length
            ? `Every amount is a multiple of ${g}, but that is only necessary, not sufficient: ${gcdButNotReachable.join(", ")} cannot be measured with sizes ${caps.join(", ")}. ` +
              (caps[0] === 1 && caps[1] === 1 && caps[2] === 5
                ? "The two small jugs hold at most 1 each, so C never drops below 3; 2 is out of reach even though the gcd is 1."
                : "For comparison, jugs 1, 1, 5 have gcd 1 yet cannot measure 2: the small jugs hold at most 1 each, so C stays at 3 or more.")
            : `With these jug sizes the measurable amounts are exactly the multiples of gcd(${caps.join(", ")}) = ${g}.`,
        };
      },
    },
  };
}

/**
 * What the core says about a position the page saved with Track.state(state):
 * the saved jugs and target, what is already measured, the legal next pours,
 * and how many pours are left from these levels and from a fresh start.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Water state version ${stateVersion}`);
  const C = core();
  const caps = readCaps({ capacities: state.caps ?? state.capacities }, "capacities");
  const values = numArray(state, "values");
  if (values.length !== 3) throw new Error("values must be three amounts, one per jug");
  if (!values.every((v, i) => Number.isInteger(v) && v >= 0 && v <= caps[i])) {
    throw new Error("each amount must be a whole number no larger than its jug's capacity");
  }
  const target = readTarget(state, caps);
  const here = C.start({ capacities: caps, values, target });
  const g = C.gcd(C.gcd(caps[0], caps[1]), caps[2]);
  const measured = C.result(here) === "done";
  const jugWithTarget = measured ? C.NAMES[here.values.indexOf(target)] : null;
  const best = C.solve(here.caps, here.target);
  const fromHere = measured ? 0 : poursToTarget(C, here.caps, here.values, here.target);
  const moves = num(state, "moves", 0);
  const lastPourAmount = num(state, "amount", 0);
  const history = (Array.isArray(state.history) ? state.history : []).map((h, i) => {
    const row = numArray({ row: h }, "row");
    if (row.length !== 3) throw new Error(`history[${i}] must have three amounts`);
    return row;
  });

  const legalPours = C.legalMoves(here).map((m: { from: number; to: number; amount: number }) => ({
    from: C.NAMES[m.from],
    to: C.NAMES[m.to],
    amount: m.amount,
    say: C.describe({ from: m.from, to: m.to, amount: m.amount }),
  }));

  const note = measured
    ? `Jug ${jugWithTarget} already holds exactly ${target}, so the target is measured.`
    : fromHere === null
      ? `No sequence of pours from these levels can put ${target} in a jug. Every amount is a multiple of ${g}, and even a multiple need not be reachable (jugs 1, 1, 5 cannot measure 2).`
      : `${fromHere} more pour${fromHere === 1 ? "" : "s"} from these levels will measure ${target}; from a fresh (0, 0, ${caps[2]}) start the fewest is ${best ? best.length : "not reachable"}.`;

  return {
    // The fields the page saved with Track.state.
    caps: caps.slice(),
    values: values.slice(),
    target,
    moves,
    history,
    amount: lastPourAmount,
    // The core's reading of that position.
    jugs: Object.fromEntries(C.NAMES.map((name: string, i: number) => [name, { amount: here.values[i], capacity: here.caps[i] }])),
    totalWater: here.values.reduce((a: number, b: number) => a + b, 0),
    gcd: g,
    targetAlreadyMeasured: measured,
    jugWithTarget,
    impossibleByGcd: C.impossible(here),
    legalPours,
    poursToTargetFromHere: fromHere,
    fewestPoursFromFreshStart: best ? best.length : null,
    solvableFromFreshStart: Boolean(best),
    note,
  };
}
