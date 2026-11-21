/*
 * run_game_logic actions and saved-position reader for Fraction Comparison Sped Up.
 *
 * Compare two fractions by finding a simple fraction between them (7/12 > 1/2 > 4/9),
 * or by cross-multiplication. Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["fc-exercise"].FcExerciseCore;
const SIGN: Record<number, string> = { [-1]: "<", 0: "=", 1: ">" };

function frac(args: Json, nKey: string, dKey: string, nFallback: number, dFallback: number): [number, number] {
  const n = Math.trunc(num(args, nKey, nFallback)), d = Math.trunc(num(args, dKey, dFallback));
  if (n < 0 || d < 1 || n > 9999 || d > 9999) throw new Error(`${nKey}/${dKey} must be a fraction with numerator 0 to 9999 and denominator 1 to 9999`);
  return [n, d];
}

export function actions(): GameActions {
  return {
    compare: {
      describe: "Compare a/c with b/d: the relation (<, =, >), the cross products a*d and b*c, and the simplest fraction strictly between them (found by mediants) when they differ, which is the page's trick.",
      args: '{ "a": 7, "c": 12, "b": 4, "d": 9 }',
      run: (args) => {
        const C = core();
        const [a, c] = frac(args, "a", "c", 7, 12), [b, d] = frac(args, "b", "d", 4, 9);
        const rel = C.cmp(a, c, b, d);
        let between: string | null = null;
        if (rel !== 0) {
          // Stern-Brocot search for the simplest fraction strictly between the smaller and the larger
          let [ln, ld, rn, rd] = rel < 0 ? [a, c, b, d] : [b, d, a, c];
          for (let k = 0; k < 100000; k++) {
            const mn = ln + rn, md = ld + rd;
            const lo = C.cmp(mn, md, ln, ld), hi = C.cmp(mn, md, rn, rd);
            if (lo > 0 && hi < 0) { between = `${mn}/${md}`; break; }
            if (lo <= 0) { ln = mn; ld = md; } else { rn = mn; rd = md; }
          }
        }
        return { comparison: `${a}/${c} ${SIGN[rel]} ${b}/${d}`, crossProducts: { "a*d": a * d, "b*c": b * c }, simplestFractionBetween: between, check: between ? "that fraction is bigger than the smaller one and smaller than the larger one, which settles the comparison" : "the fractions are equal" };
      },
    },
    is_between: {
      describe: "Whether the middle fraction n/m lies between a/c and b/d (the ends included), which is what the applet's Check accepts, and the two signs it would show.",
      args: '{ "a": 7, "c": 12, "b": 4, "d": 9, "n": 1, "m": 2 }',
      run: (args) => {
        const C = core();
        const [a, c] = frac(args, "a", "c", 7, 12), [b, d] = frac(args, "b", "d", 4, 9), [n, m] = frac(args, "n", "m", 1, 2);
        const s = { n1: a, d1: c, n2: b, d2: d, n0: n, d0: m };
        const sg = C.signs(s);
        return { correct: C.correct(s), shows: `${a}/${c} ${SIGN[sg.first]} ${n}/${m} ${SIGN[sg.second]} ${b}/${d}` };
      },
    },
  };
}

/** What the core says about the exercise as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const n1 = num(state, "n1", 1), d1 = Math.max(1, num(state, "d1", 1)), n2 = num(state, "n2", 1), d2 = Math.max(1, num(state, "d2", 1)), n0 = num(state, "n0", 0), d0 = Math.max(1, num(state, "d0", 1));
  const s = { n1, d1, n2, d2, n0, d0 };
  const sg = C.signs(s);
  return {
    pair: [`${n1}/${d1}`, `${n2}/${d2}`],
    larger: C.cmp(n1, d1, n2, d2) > 0 ? `${n1}/${d1}` : C.cmp(n1, d1, n2, d2) < 0 ? `${n2}/${d2}` : "they are equal",
    middle: `${n0}/${d0}`,
    middleIsBetween: C.correct(s),
    signsIfChecked: `${SIGN[sg.first]} ${SIGN[sg.second]}`,
    checked: state.checked === true,
    response: typeof state.response === "string" ? state.response : "",
    problems: num(state, "problems", 1),
    correctAnswers: num(state, "solved", 0),
  };
}
