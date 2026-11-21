/*
 * run_game_logic actions and saved-position reader for Compare Fractions: Interactive Practice.
 *
 * Compare a/c with b/d by cross-multiplication or over a common denominator. Every answer comes from the
 * game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["fraction-comparison-exercise"].FractionComparisonExerciseCore;
const pos = (args: Json, k: string, f: number) => { const v = Math.trunc(num(args, k, f)); if (v < 1 || v > 9999) throw new Error(`${k} must be 1 to 9999`); return v; };

export function actions(): GameActions {
  return {
    compare: {
      describe: "Compare a/c with b/d: the relation, the cross products, the least common denominator and both fractions over it.",
      args: '{ "a": 5, "c": 8, "b": 3, "d": 5 }',
      run: (args) => {
        const C = core();
        const a = pos(args, "a", 5), c = pos(args, "c", 8), b = pos(args, "b", 3), d = pos(args, "d", 5);
        const p = { n1: a, d1: c, n2: b, d2: d };
        const l = C.lcm(c, d);
        return { relation: `${a}/${c} ${C.SIGNS[C.relation(p)]} ${b}/${d}`, crossProducts: { "a*d": a * d, "b*c": b * c }, leastCommonDenominator: l, overIt: [`${a * (l / c)}/${l}`, `${b * (l / d)}/${l}`] };
      },
    },
  };
}

/** What the core says about the exercise as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const p = { n1: Math.max(1, num(state, "n1", 1)), d1: Math.max(1, num(state, "d1", 1)), n2: Math.max(1, num(state, "n2", 1)), d2: Math.max(1, num(state, "d2", 1)) };
  const ans = num(state, "answered", -1);
  return {
    pair: [`${p.n1}/${p.d1}`, `${p.n2}/${p.d2}`],
    correctSign: C.SIGNS[C.relation(p)],
    answered: ans >= 0 ? C.SIGNS[ans] : null,
    wasRight: ans >= 0 ? ans === C.relation(p) : null,
    problems: num(state, "problems", 1),
    correctAnswers: num(state, "solved", 0),
    graphics: state.graphics === true,
    commonDenominator: state.common === true,
  };
}
