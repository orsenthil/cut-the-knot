/*
 * run_game_logic actions and saved-position reader for Inflection Points of Fourth Degree Polynomials.
 *
 * For a quartic with inflection points a < b, the line through them meets the graph again at
 * xL, xR = ((a + b) -/+ (b - a) sqrt 5)/2: golden ratio, a + b = xL + xR, areas 1 : 2 : 1.
 * Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["fourth-degree"].FourthDegreeCore;
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

function coefs(args: Json): number[] {
  return [0, 1, 2, 3, 4].map((i) => {
    const v = num(args, "m" + i, [0, 1, -6, 0, 1][i]);
    if (!Number.isFinite(v) || Math.abs(v) > 1000) throw new Error(`m${i} must be a number between -1000 and 1000`);
    return v;
  });
}

export function actions(): GameActions {
  return {
    inflection_line: {
      describe: "For p(x) = m4 x^4 + m3 x^3 + m2 x^2 + m1 x + m0: the inflection points a < b, the line through them, the two further crossings xL and xR, the golden-ratio check, a + b = xL + xR, and the areas of the three regions between graph and line. Arguments m0..m4.",
      args: '{ "m4": 1, "m3": 0, "m2": -6, "m1": 1, "m0": 0 }',
      run: (args) => {
        const C = core();
        const c = coefs(args);
        const k = C.crossings(c);
        if (!k) return { hasTwoInflectionPoints: false, why: "m4 is 0, or p'' = 12 m4 x^2 + 6 m3 x + 2 m2 has no two real roots" };
        const ar = C.areas(c);
        if (!ar) throw new Error("no areas");
        return {
          hasTwoInflectionPoints: true, a: r6(k.a), b: r6(k.b),
          line: { slope: r6(k.s), intercept: r6(k.t) },
          xL: r6(k.xL), xR: r6(k.xR),
          sumsAgree: { "a+b": r6(k.a + k.b), "xL+xR": r6(k.xL + k.xR) },
          goldenRatio: { "(b-a)/(a-xL)": r6((k.b - k.a) / (k.a - k.xL)), phi: r6(k.phi) },
          areas: { left: r6(ar.left), middle: r6(ar.middle), right: r6(ar.right), ratio: `1 : ${r6(ar.middle / ar.left)} : ${r6(ar.right / ar.left)}` },
        };
      },
    },
  };
}

/** What the core says about the quartic as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const c = Array.isArray(state.c) && state.c.length === 5 ? (state.c as unknown[]).map(Number) : C.start({}).c;
  const k = C.crossings(c);
  return {
    coefficients: { m4: c[4], m3: c[3], m2: c[2], m1: c[1], m0: c[0] },
    hasTwoInflectionPoints: k !== null,
    inflectionPoints: k ? [r6(k.a), r6(k.b)] : null,
    otherCrossings: k ? [r6(k.xL), r6(k.xR)] : null,
    showing: { graph: state.showGraph !== false, inflectionLine: state.showLine !== false, difference: state.showDiff === true },
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
