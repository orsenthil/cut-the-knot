/*
 * run_game_logic actions and saved-position reader for Compare Fractions.
 *
 * Two fractions N1/D1 and N2/D2 are compared by cross multiplication
 * (N1*D2 against N2*D1), put over their least common denominator, or reduced to
 * lowest terms. Every answer comes from the game's real core
 * (compare-fractions/ in the site). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["compare-fractions"].CompareFractionsCore;

/** The page keeps every number between 1 and 99, so go through start(). */
function readState(args: Json) {
  return core().start({
    n1: num(args, "n1", 3), d1: num(args, "d1", 4), n2: num(args, "n2", 2), d2: num(args, "d2", 3),
  });
}

function describe(C: ReturnType<typeof core>, s: Json) {
  const c = C.compare(s);
  const rel = c > 0 ? "greater than" : c < 0 ? "less than" : "equal to";
  const left = (s.n1 as number) * (s.d2 as number);
  const right = (s.n2 as number) * (s.d1 as number);
  return {
    comparison: c,
    cross: { n1TimesD2: left, n2TimesD1: right },
    inWords: `${s.n1}/${s.d1} is ${rel} ${s.n2}/${s.d2}, because ${s.n1}x${s.d2} = ${left} and ${s.n2}x${s.d1} = ${right}.`,
  };
}

export function actions(): GameActions {
  return {
    compare: {
      describe:
        "Compare N1/D1 with N2/D2 by the page's cross-multiplication rule, and say how many rows of boxes each needs.",
      args: '{ "n1": 3, "d1": 4, "n2": 5, "d2": 7 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        return {
          n1: s.n1, d1: s.d1, n2: s.n2, d2: s.d2,
          ...describe(C, s),
          rows: [C.rows(s.n1, s.d1).length, C.rows(s.n2, s.d2).length],
          tooBigToDraw: C.areBig(s),
        };
      },
    },
    common_denominator: {
      describe:
        "Press the applet's Common denominator button: both fractions get the least common multiple of D1 and D2 as denominator. Says whether the result is too big to draw (a number above 99).",
      args: '{ "n1": 1, "d1": 6, "n2": 1, "d2": 4 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const t = C.commonDenominator(s);
        return {
          before: { n1: s.n1, d1: s.d1, n2: s.n2, d2: s.d2 },
          after: { n1: t.n1, d1: t.d1, n2: t.n2, d2: t.d2 },
          gcdOfDenominators: C.gcd(s.d1, s.d2),
          commonDenominatorIsLcm: t.d1 === t.d2,
          tooBigToDraw: C.areBig(t),
          sameComparison: C.compare(s) === C.compare(t),
        };
      },
    },
    simplify: {
      describe: "Press the applet's Simplify fractions button: each fraction is divided through by the gcd of its top and bottom.",
      args: '{ "n1": 6, "d1": 8, "n2": 10, "d2": 15 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const t = C.simplify(s);
        return {
          before: { n1: s.n1, d1: s.d1, n2: s.n2, d2: s.d2 },
          after: { n1: t.n1, d1: t.d1, n2: t.n2, d2: t.d2 },
          gcds: [C.gcd(s.n1, s.d1), C.gcd(s.n2, s.d2)],
          sameComparison: C.compare(s) === C.compare(t),
        };
      },
    },
  };
}

/** What the core says about the two fractions currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const s = readState(state);
  const big = ["n1", "d1", "n2", "d2"].some((k) => num(state, k, 1) > 99);
  // A saved position after "Common denominator" can hold numbers above 99, which start() would clamp.
  const raw = { n1: num(state, "n1", s.n1), d1: num(state, "d1", s.d1), n2: num(state, "n2", s.n2), d2: num(state, "d2", s.d2) };
  const t = big ? raw : s;
  return {
    n1: t.n1, d1: t.d1, n2: t.n2, d2: t.d2,
    ...describe(C, t),
    tooBigToDraw: big,
    commonDenominator: C.gcd(t.d1, t.d2) ? (t.d1 * t.d2) / C.gcd(t.d1, t.d2) : null,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
    note: big
      ? "A number is above 99, so the applet writes 'Please Simplify!' instead of drawing boxes."
      : "The boxes are drawn: each fraction is rows of D boxes with N filled.",
  };
}
