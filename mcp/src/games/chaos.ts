/*
 * run_game_logic actions and saved-position reader for the logistic-map chaos
 * demo. Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["chaos"].ChaosCore;

function readLambda(args: Json) {
  const C = core();
  return C.start({ lambda: num(args, "lambda", 0.892), x0: num(args, "x0", 0.7) });
}

export function actions(): GameActions {
  return {
    orbit: {
      describe:
        "For a growth rate a and a starting value, list the first iterates of x -> 4a x(1-x), name the behaviour, and give the fixed points and stability.",
      args: '{ "lambda": 0.892, "x0": 0.7, "steps": 12 }',
      run: (args) => {
        const C = core();
        const state = readLambda(args);
        const steps = Math.max(1, Math.min(200, Math.trunc(num(args, "steps", 12))));
        const values = C.orbit(state.lambda, state.x0, steps);
        return {
          lambda: state.lambda,
          x0: state.x0,
          values,
          behavior: C.behavior(state.lambda),
          fixedPoints: C.fixedPoints(state.lambda),
          slopeAtFixedPoint: C.slopeAtFixedPoint(state.lambda),
          period2: C.period2(state.lambda),
        };
      },
    },
    milestones: {
      describe:
        "Show the named thresholds of the logistic map: the stability flip, period doubling, the onset of chaos and the small windows of order.",
      args: '{}',
      run: () => {
        const C = core();
        const points = [0.7, 0.75, 0.86237, 0.872, 0.892, 0.957, 0.96, 0.9622, 1];
        return {
          rows: points.map((a) => ({ a, behavior: C.behavior(a), slope: C.slopeAtFixedPoint(a) })),
          note: "Fixed points lose stability at a = 0.75; period 2 begins near 0.86237, chaos near 0.892, with narrow windows of order near 0.96.",
        };
      },
    },
  };
}

/** What the core says about the web currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const lambda = Number(state.lambda);
  const here = C.start({ lambda: Number.isFinite(lambda) ? lambda : 0.892, x0: Number(state.x0) || 0.7 });
  const steps = Math.max(0, Math.min(50, Number(state.steps) || 0));
  return {
    lambda: here.lambda,
    x0: here.x0,
    running: state.running === true,
    steps,
    behavior: C.behavior(here.lambda),
    fixedPoints: C.fixedPoints(here.lambda),
    recentOrbit: C.orbit(here.lambda, here.x0, Math.max(1, steps)),
    note: `At a = ${here.lambda.toFixed(3)} the orbit ${C.behavior(here.lambda)}.`,
  };
}
