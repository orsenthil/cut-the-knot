/*
 * run_game_logic actions and saved-position reader for Shuttle Puzzle Practice. The core lives in
 * shuttle-practice/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["shuttle-practice"].ShuttlePracticeCore;

type Bar = { a: number; b: number; h: number };

function checkGoal(goal: number[]) {
  const n = goal.length;
  if (n < 2 || n > 20 || [...goal].sort((x, y) => x - y).some((v, i) => v !== i + 1)) throw new Error("goal must be a permutation of 1..N, N = 2..20");
}

/** Shuttles that put the right top on pole 1, then pole 2, ...: N - (cycles) of them. */
function solve(goal: number[]) {
  const cur = goal.map((_, i) => i);
  const out: string[] = [];
  for (let p = 0; p < goal.length; p++) {
    const q = cur.indexOf(goal.indexOf(p + 1));
    if (q !== p) { out.push(`(${Math.min(p, q) + 1},${Math.max(p, q) + 1})`); [cur[p], cur[q]] = [cur[q], cur[p]]; }
  }
  return out;
}

export function actions(): GameActions {
  return {
    solve: {
      describe: "For a target (goal[i] = the pole top i+1 must reach), its cycles, the fewest shuttles (N minus the number of cycles) and one shortest list of shuttles, top to bottom, as transpositions.",
      args: '{ "goal": [3, 4, 2, 5, 1] }',
      run: (args) => {
        const goal = numArray(args, "goal").map(Math.round);
        checkGoal(goal);
        const C = core();
        return { cycles: C.cycles(goal), fewestShuttles: C.fewest(goal), shuttles: solve(goal), parity: C.fewest(goal) % 2 ? "odd" : "even" };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const goal = numArray(state, "goal").map(Math.round);
  checkGoal(goal);
  const bars: Bar[] = Array.isArray(state.bars) ? (state.bars as Bar[]).filter((b) => Number.isInteger(b.a) && Number.isInteger(b.b) && Number.isFinite(b.h)) : [];
  const s = { ...C.start({ n: goal.length, goal }), bars };
  const result = C.result(s);
  return {
    poles: goal.length, targetCycles: C.cycles(goal), fewestShuttles: C.fewest(goal),
    shuttlesSoFar: C.product(s) || "none", shuttleCount: bars.length,
    topsReachNow: result, topsShouldReach: goal,
    topsInPlace: result.filter((v: number, i: number) => v === goal[i]).length,
    solved: result.every((v: number, i: number) => v === goal[i]),
    verified: state.verdict === "yes" ? "Great! You did it!" : state.verdict === "no" ? "Nope, not yet." : null,
  };
}
