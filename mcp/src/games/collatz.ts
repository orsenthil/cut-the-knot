/*
 * run_game_logic actions and saved-position reader for Collatz.
 *
 * Every answer comes from the game's real core (collatz/ in the site), copied
 * into src/generated/cores/ at build time. The actions follow hailstone trails,
 * correct the applet page's wrong list of the first starts needing more than
 * 100 steps, and check the two loops and the cheaper (3n+1)/2 rule. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["collatz"].CollatzCore;

/** Validate a starting number the way the page's input constrains it. */
function readStart(args: Json) {
  const C = core();
  const number = num(args, "number", 27);
  if (!Number.isSafeInteger(number) || number < 1 || number > C.MAX_NUMBER) {
    throw new Error(`"number" must be a whole number from 1 to ${C.MAX_NUMBER}, got ${JSON.stringify(number)}`);
  }
  return {
    number,
    mode: args.mode === "strip" ? "strip" : "divide",
    shorten: args.shorten === true,
    maxIter: num(args, "maxIter", 500),
  };
}

/** Rebuild the full trail a fresh page would show from the saved position. */
function readPosition(state: Json) {
  const C = core();
  const number = num(state, "number", 27);
  const start = C.start({
    number,
    digits: num(state, "digits", C.DEFAULT_DIGITS),
    mode: state.mode === "strip" ? "strip" : "divide",
    shorten: state.shorten === true,
    maxIter: C.MAX_ITER, // the page's own 150-step cap
  });
  const wanted = num(state, "index", num(state, "step", 0));
  const index = Number.isFinite(wanted)
    ? Math.max(0, Math.min(Math.floor(wanted), start.sequence.length - 1))
    : 0;
  return { start: Object.assign({}, start, { index }), index };
}

export function actions(): GameActions {
  return {
    trail: {
      describe:
        "Follow the Collatz hailstone trail from a starting number. Choose mode 'divide' (halve one two at a time, the default) or 'strip' (remove all twos at once), and shorten for the (3n+1)/2 rule. Returns every value, the step count, the loop it closes into, its stop state and the number of steps to first reach 1.",
      args: '{ "number": 27, "mode": "divide", "shorten": false }',
      run: (args) => {
        const C = core();
        const cfg = readStart(args);
        const state = C.start(cfg);
        const stops = C.stoppingTime(cfg.number, cfg);
        return {
          number: cfg.number,
          mode: state.mode,
          shorten: state.shorten,
          factor: state.factor,
          sequence: state.sequence,
          steps: C.steps(state),
          stop: state.stop,
          cycle: C.cycle(state),
          cycleFrom: state.cycleFrom,
          summary: C.summary(state),
          stoppingTime: stops,
          firstValueInLoop: state.cycleFrom === null ? null : state.sequence[state.cycleFrom],
          note: stops === null
            ? `From ${cfg.number} the trail did not reach 1 within ${state.maxIter} steps (${C.summary(state)}).`
            : `From ${cfg.number} the trail first reaches 1 at step ${stops}, then ${C.summary(state)}`,
        };
      },
    },

    long_starts: {
      describe:
        "Correct the applet page's claim about the first starting numbers that need more than 100 steps to reach 1. Computes the true ordered list from the real Collatz rule (divide mode), with each stopping time, and says which numbers the page's list of 27, 31, 41, 47, 55, 62 misses.",
      args: '{ "threshold": 100, "count": 10, "limit": 200 }',
      run: (args) => {
        const C = core();
        const threshold = num(args, "threshold", 100);
        const count = Math.max(1, Math.floor(num(args, "count", 10)));
        const limit = Math.max(1, Math.floor(num(args, "limit", 200)));
        const long: { number: number; steps: number }[] = [];
        for (let n = 1; n <= limit; n++) {
          const st = C.stoppingTime(n, { mode: "divide", shorten: false, maxIter: 500 });
          if (st !== null && st > threshold) long.push({ number: n, steps: st });
        }
        const first = long.slice(0, count);
        const pageList = [27, 31, 41, 47, 55, 62];
        const missing = first.filter((x) => !pageList.includes(x.number)).map((x) => x.number);
        const present = first.filter((x) => pageList.includes(x.number)).map((x) => x.number);
        const pageCorrect =
          pageList.length === first.length && pageList.every((n, i) => n === first[i].number);
        const smallest = long.length ? long[0].number : null;
        return {
          threshold,
          searchedUpTo: limit,
          trueFirstNumbers: first,
          smallestLongStart: smallest,
          noneBelowSmallest: smallest === null ? null : !long.some((x) => x.number < smallest),
          pageList,
          pageListCorrect: pageCorrect,
          pageNumbersThatQualify: present,
          missingFromPage: missing,
          note: pageCorrect
            ? `The page's list matches the true first ${count} starts needing more than ${threshold} steps.`
            : `The page lists 27, 31, 41, 47, 55, 62 as the first starts needing more than ${threshold} steps, but that is wrong: among the true first ${count} it misses ${missing.join(", ") || "none"} (and lists them out of order). The smallest such start is ${smallest}, and none below it qualifies.`,
        };
      },
    },

    loops_and_rule: {
      describe:
        "Show which loop each mode ends in, and check the cheaper (3n+1)/2 rule: for a start such as 27, find the step where the value first drops below the start and the step where it enters the small loop.",
      args: '{ "number": 27 }',
      run: (args) => {
        const C = core();
        const number = num(args, "number", 27);
        if (!Number.isSafeInteger(number) || number < 1 || number > C.MAX_NUMBER) {
          throw new Error(`"number" must be a whole number from 1 to ${C.MAX_NUMBER}, got ${JSON.stringify(number)}`);
        }
        const opts = { maxIter: 1000 };
        const divide = C.start(Object.assign({ number, mode: "divide", shorten: false }, opts));
        const strip = C.start(Object.assign({ number, mode: "strip", shorten: false }, opts));
        const cheap = C.start(Object.assign({ number, mode: "divide", shorten: true }, opts));

        let firstBelow: { step: number; value: number } | null = null;
        for (let i = 0; i < cheap.sequence.length; i++) {
          if (cheap.sequence[i] < number) {
            firstBelow = { step: i, value: cheap.sequence[i] };
            break;
          }
        }
        const firstOne = C.stoppingTime(number, { mode: "divide", shorten: false, maxIter: 1000 });
        return {
          number,
          divide: {
            cycle: C.cycle(divide),
            steps: C.steps(divide),
            stop: divide.stop,
            stepsToFirstOne: firstOne,
          },
          strip: {
            cycle: C.cycle(strip),
            steps: C.steps(strip),
            stop: strip.stop,
          },
          cheaper: {
            cycle: C.cycle(cheap),
            steps: C.steps(cheap),
            firstBelowStart: firstBelow,
            loopEntryStep: cheap.cycleFrom,
            firstValueInLoop: cheap.cycleFrom === null ? null : cheap.sequence[cheap.cycleFrom],
          },
          note:
            `In divide mode ${number} closes into the ${C.cycle(divide).join(", ")} loop; in strip mode it closes into the shorter ${C.cycle(strip).join(", ")} loop. ` +
            (firstBelow === null
              ? `With the (3n+1)/2 rule the trail never fell below ${number}.`
              : `With the (3n+1)/2 rule it first drops below ${number} at step ${firstBelow.step} (value ${firstBelow.value}) and enters the ${C.cycle(cheap).join(", ")} loop at step ${cheap.cycleFrom}.`),
        };
      },
    },
  };
}

/** What the core says about the hailstone trail currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const { start, index } = readPosition(state);
  const stops = C.stoppingTime(start.number, {
    mode: start.mode,
    shorten: start.shorten,
    maxIter: start.maxIter,
  });
  const current = start.sequence[index];
  return {
    number: start.number,
    digits: start.digits,
    mode: start.mode,
    shorten: start.shorten,
    factor: start.factor,
    step: index,
    currentValue: current,
    nextValue: index + 1 < start.sequence.length ? start.sequence[index + 1] : null,
    totalSteps: C.steps(start),
    atEnd: C.result(start) === "done",
    stop: start.stop,
    cycle: C.cycle(start),
    summary: C.summary(start),
    stoppingTime: stops,
    needsOver100Steps: stops === null ? null : stops > 100,
    note:
      `At step ${index} the trail from ${start.number} is at ${current}` +
      (stops === null
        ? `; within the page's ${start.maxIter}-step cap it has not reached 1 (${C.summary(start)}).`
        : `; it first reaches 1 at step ${stops} and ${C.summary(start)}`) +
      ` (${start.mode === "strip" ? "strip of 2" : "divide by 2"}${start.shorten ? " with the (3n+1)/2 rule" : ""}).`,
  };
}
