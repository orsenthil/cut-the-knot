/*
 * run_game_logic actions and saved-position reader for light-bulbs.
 *
 * The core lives in light-bulbs/ and is copied into src/generated/cores/ at
 * build time. It holds both the ring machine (OneStep in the original applet)
 * and pure functions for the actuarial claims on the linked article. See
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["light-bulbs"].LightBulbsCore;

/**
 * A spin control value: a whole number inside the applet's range. The core
 * itself clamps out-of-range input, but the tutor rejects it so a mistyped
 * argument cannot silently simulate a different applet setting.
 */
function whole(args: Json, key: string, lo: number, hi: number, fallback: number): number {
  const raw = num(args, key, fallback);
  const v = Math.round(raw);
  if (v !== raw || v < lo || v > hi) {
    throw new Error(`argument "${key}" must be a whole number in ${lo}..${hi}`);
  }
  return v;
}

export function actions(): GameActions {
  const C = core();

  return {
    step: {
      describe:
        "One step of the bulb ring: the visitor at the green pointer flips the bulb `lookAhead` places ahead (the blue pointer) if and only if his own bulb is lit, then the pointer jumps `skip + 1` places; all indices wrap around `bulbs`. The step rule is deterministic, so a whole batch is just the same step repeated, and the machine's future is fixed by (on[], position).",
      args: '{ "bulbs": 15, "lookAhead": 1, "skip": 0, "steps": 5, "position": 0, "count": 1 }',
      run: (args) => {
        const L = C.LIMITS;
        const bulbs = whole(args, "bulbs", L.bulbs[0], L.bulbs[1], L.bulbs[2]);
        const lookAhead = whole(args, "lookAhead", L.lookAhead[0], L.lookAhead[1], L.lookAhead[2]);
        const skip = whole(args, "skip", L.skip[0], L.skip[1], L.skip[2]);
        const steps = whole(args, "steps", L.steps[0], L.steps[1], L.steps[2]);
        const position = whole(args, "position", 0, bulbs - 1, 0);
        const count = whole(args, "count", 1, L.steps[1], 1);

        const s = C.setPosition(C.start({ bulbs, lookAhead, skip, steps }), position);
        const flips = C.nextIndex(s);
        const jump = C.nCheck(s);
        const visitorLit = s.on[s.position];
        const afterOne = C.oneStep(s);
        const final = C.run(s, count);
        const litFinal = final.on.filter(Boolean).length;

        return {
          options: { bulbs, lookAhead, skip, steps },
          oneStep: {
            visitorAt: s.position,
            visitorBulbLit: visitorLit,
            flipsBulb: flips,
            bulbWasFlipped: visitorLit,
            pointerJump: jump,
            nextVisitor: afterOne.position,
            litAfter: afterOne.on.filter(Boolean).length,
          },
          batchSteps: count,
          final: {
            position: final.position,
            lit: litFinal,
            dark: bulbs - litFinal,
            stepsDone: final.stepsDone,
            remaining: final.remaining,
            done: C.result(final) === "done",
            on: final.on,
          },
        };
      },
    },

    article_claims: {
      describe:
        "The article's '100 prisoners and a light bulb' figures, computed by the core. `expectedTimeFormula` evaluates the printed formula n^2 - n/(n-1) - sum_{c=2}^n 1/c^2 (about 9998.35 days for n=100), while `expectedTimeWithNTimesSum` multiplies that sum by n, which is what the article's printed 9935.5 days actually requires; `landmarks` gives the chance the counter has reached all n by each of the four published days. For n=100 the formula and the printed number disagree by about 63 days.",
      args: '{ "n": 100, "days": 1146 }',
      run: (args) => {
        const n = whole(args, "n", 2, 100, 100);
        const days = args.days === undefined || args.days === null
          ? null
          : whole(args, "days", 0, 20000, 1146);

        const thresholds: [number, number][] = [
          [1146, 0.999],
          [1375, 0.9999],
          [1604, 0.99999],
          [1833, 0.999999],
        ];
        const landmarks = thresholds.map(([day, level]) => {
          const probability = C.completionProbability(n, day);
          return { day, level, probability, reached: probability >= level };
        });

        const printed = C.expectedTime(n);
        const scaled = C.expectedTimeScaled(n);
        return {
          n,
          expectedTimeFormula: printed,
          expectedTimeWithNTimesSum: scaled,
          difference: scaled - printed,
          printedFigureFor100: n === 100 ? 9935.5 : null,
          formulaMatchesPrintedFigure: n === 100 ? Math.abs(printed - 9935.5) < 1 : null,
          note:
            "The printed sum is a(n) = sum 1/c^2 from c=2 to n. Substituting a(n) as written gives about 9998.35 days for n=100; the article's 9935.5 days needs n*a(n) instead. 9935.5 days is about 27.2 years, not the 26.2 years also printed. The landmark days 1146/1375/1604/1833 (about 3.14, 3.77, 4.39 and 5.02 years) are the first days the recursion reaches 0.999, 0.9999, 0.99999 and 0.999999 for n=100.",
          landmarks,
          customProbability: days === null
            ? null
            : { days, probability: C.completionProbability(n, days) },
        };
      },
    },
  };
}

/**
 * What the core says about a position saved by the page (Track.state stores
 * the whole core state): the lit-dark picture, which bulb the green visitor
 * will flip next, the pointer jump, and the exact state after one more step.
 */
export function position(state: Json, _stateVersion: number): unknown {
  const C = core();
  const L = C.LIMITS;
  const bulbs = whole(state, "bulbs", L.bulbs[0], L.bulbs[1], L.bulbs[2]);
  const lookAhead = whole(state, "lookAhead", L.lookAhead[0], L.lookAhead[1], L.lookAhead[2]);
  const skip = whole(state, "skip", L.skip[0], L.skip[1], L.skip[2]);
  const steps = whole(state, "steps", L.steps[0], L.steps[1], L.steps[2]);
  const position = whole(state, "position", 0, bulbs - 1, 0);
  const stepsDone = num(state, "stepsDone", 0);
  const remaining = num(state, "remaining", steps - stepsDone);

  const rawOn = Array.isArray(state.on) ? state.on.map((v) => Boolean(v)) : new Array(bulbs).fill(true);
  if (rawOn.length !== bulbs) {
    throw new Error(`saved "on" array has ${rawOn.length} entries but "bulbs" is ${bulbs}`);
  }

  const s = { bulbs, lookAhead, skip, steps, position, on: rawOn, stepsDone, remaining };
  const flips = C.nextIndex(s);
  const jump = C.nCheck(s);
  const visitorLit = rawOn[position];
  const afterOne = C.oneStep(s);
  const lit = rawOn.filter(Boolean).length;

  return {
    // echo the saved fields so the tutor can show exactly what the page kept
    bulbs,
    lookAhead,
    skip,
    steps,
    position,
    on: rawOn,
    stepsDone,
    remaining,
    // core-derived reading
    lit,
    dark: bulbs - lit,
    visitorBulbLit: visitorLit,
    nextFlippedBulb: flips,
    pointerJump: jump,
    nextVisitor: afterOne.position,
    done: C.result(s) === "done",
    afterOneMoreStep: {
      position: afterOne.position,
      lit: afterOne.on.filter(Boolean).length,
      stepsDone: afterOne.stepsDone,
      remaining: afterOne.remaining,
    },
  };
}
