/*
 * run_game_logic actions and saved-position reader for Buffon's Needle.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["buffon"].BuffonCore;

function seeded(seed: number) {
  let s = (Math.trunc(seed) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function actions(): GameActions {
  return {
    throws: {
      describe:
        "Throw a needle a given number of times at cracks one needle-length apart, count crossings and report the pi estimate 2*throws/crossings.",
      args: '{ "trials": 5000, "seed": 7 }',
      run: (args) => {
        const C = core();
        let state = C.start({ trials: num(args, "trials", 5000), showPi: true });
        state = C.run(C.startRun(state), seeded(num(args, "seed", 7)));
        const pi = Number(C.estimatePi(state));
        return {
          trials: state.trials,
          throws: state.throws,
          crossings: state.crossings,
          ratio: state.throws / Math.max(1, state.crossings),
          piEstimate: pi,
          error: Math.abs(pi - Math.PI),
          reading: C.countText(state),
          note: "When the needle is as long as the gap between cracks, the crossing probability is 2/pi, so 2T/C estimates pi.",
        };
      },
    },
    noodle: {
      describe:
        "Compare a straight needle with a bent noodle of the same total length: the expected number of crossings is the same.",
      args: '{ "trials": 5000, "seed": 7 }',
      run: (args) => {
        const C = core();
        const trials = num(args, "trials", 5000);
        const rng = seeded(num(args, "seed", 7));
        let straight = C.run(C.startRun(C.start({ trials })), rng);
        const shape = [[0, 0], [0.5, 0], [0.5, 0.5], [1, 0.5]];
        let bent = C.run(C.startRun(C.start({ trials, shape })), rng);
        return {
          trials,
          straight: { throws: straight.throws, crossings: straight.crossings, pi: C.estimatePi(straight) },
          noodle: { throws: bent.throws, crossings: bent.crossings, pi: C.estimatePi(bent) },
          note: "Barbier's theorem: a plane curve of length L crosses the cracks the same number of times on average, however it is bent.",
        };
      },
    },
  };
}

/** What the core says about the experiment currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = C.start({
    trials: num(state, "trials", 500),
    skip: num(state, "skip", 0),
    showPi: state.showPi === true,
  });
  const withCounts = {
    ...here,
    throws: num(state, "throws", 0),
    crossings: num(state, "crossings", 0),
  };
  return {
    trials: withCounts.trials,
    skip: withCounts.skip,
    throws: withCounts.throws,
    crossings: withCounts.crossings,
    reading: C.countText(withCounts),
    piEstimate: C.estimatePi(withCounts),
    running: state.running === true,
    completed: state.completed === true,
    note: `${withCounts.crossings} crossings in ${withCounts.throws} throws; the estimate is ${C.estimatePi(withCounts)}.`,
  };
}
