/*
 * run_game_logic actions and saved-position reader for Common Multiples.
 *
 * The number line has a top row of multiples of P and a bottom row of
 * multiples of Q; the blue dots on the line are the numbers in both rows, and
 * the first blue dot is lcm(P, Q) = P*Q/gcd(P, Q). Every answer below comes
 * from the game's real core (common-multiples/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["common-multiples"].CommonMultiplesCore;

/** The page only allows whole dots from 1 to 50, so go through start(). */
function readState(args: Json) {
  const C = core();
  return C.start({
    p: num(args, "p", C.DEFAULT_P),
    q: num(args, "q", C.DEFAULT_Q),
  });
}

/** A sane upper bound for actions that scan a range of numbers. */
function readLimit(args: Json, fallback: number) {
  return Math.max(1, Math.min(100000, Math.trunc(num(args, "limit", fallback))));
}

export function actions(): GameActions {
  return {
    blue_dots: {
      describe:
        "For dots at P and Q, give gcd(P,Q), the lcm from the applet's P*Q/gcd formula, each row of multiples, and the blue dots (common multiples) up to a limit. Confirms the first blue dot is the least number in both rows.",
      args: '{ "p": 4, "q": 6, "limit": 60 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const limit = readLimit(args, 60);
        const g = C.gcd(s.p, s.q);
        const L = C.lcm(s.p, s.q);
        const pRow = C.multiples(s.p, limit);
        const qRow = C.multiples(s.q, limit);
        const blues = C.commonMultiples(s.p, s.q, limit);
        const inBothRows = pRow.filter((n) => qRow.includes(n));
        const first = blues.length ? blues[0] : null;
        return {
          p: s.p,
          q: s.q,
          limit,
          gcd: g,
          lcm: L,
          productOverGcd: (s.p * s.q) / g,
          topRow: pRow,
          bottomRow: qRow,
          blueDots: blues,
          firstBlueDot: first,
          leastNumberInBothRows: inBothRows.length ? inBothRows[0] : null,
          firstIsLcm: first === L,
          note: `gcd(${s.p}, ${s.q}) = ${g}, so the applet's one-line formula gives lcm = ${s.p}x${s.q}/${g} = ${L}. The first blue dot really is the smallest number in both rows; later blue dots come in steps of ${L}.`,
        };
      },
    },
    theorem_one: {
      describe:
        "Check Theorem 1 on the page: lcm(P,Q) equals Q exactly when P divides Q (and symmetrically equals P when Q divides P), including the equal and P=1 cases.",
      args: '{ "p": 4, "q": 12 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const L = C.lcm(s.p, s.q);
        const pDividesQ = C.divides(s.p, s.q);
        const qDividesP = C.divides(s.q, s.p);
        const lcmEqualsQ = L === s.q;
        const lcmEqualsP = L === s.p;
        return {
          p: s.p,
          q: s.q,
          lcm: L,
          pDividesQ,
          qDividesP,
          lcmEqualsQ,
          lcmEqualsP,
          theoremHolds: pDividesQ === lcmEqualsQ && qDividesP === lcmEqualsP,
          inWords: C.describe("move", s),
          note: pDividesQ
            ? `P divides Q, so Q = ${s.q} is already in both rows and the first blue dot is Q itself: lcm = ${L}.`
            : qDividesP
              ? `Q divides P, so P = ${s.p} is already in both rows and lcm = ${L}.`
              : `Neither dot divides the other: the first blue dot is ${L}, strictly bigger than both ${s.p} and ${s.q}.`,
        };
      },
    },
    theorem_two: {
      describe:
        "Check Theorem 2 on the page up to a limit: every number in both rows is a multiple of the lcm, and every multiple of the lcm lies in both rows.",
      args: '{ "p": 4, "q": 6, "limit": 400 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const limit = readLimit(args, 400);
        const L = C.lcm(s.p, s.q);
        const inBothRows: number[] = [];
        for (let n = 1; n <= limit; n++) {
          if (C.isMultiple(n, s.p) && C.isMultiple(n, s.q)) inBothRows.push(n);
        }
        const lcmSteps = C.multiples(L, limit);
        const notLcmSteps = inBothRows.filter((n) => !C.isMultiple(n, L));
        const missingFromRows = lcmSteps.filter((n) => !C.isMultiple(n, s.p) || !C.isMultiple(n, s.q));
        return {
          p: s.p,
          q: s.q,
          lcm: L,
          limit,
          commonMultiplesFound: inBothRows.length,
          firstFewCommonMultiples: inBothRows.slice(0, 12),
          firstFewLcmMultiples: lcmSteps.slice(0, 12),
          exceptions: notLcmSteps,
          everyCommonMultipleIsAnLcmStep: notLcmSteps.length === 0,
          everyLcmStepIsACommonMultiple: missingFromRows.length === 0,
          note: `Between 1 and ${limit} there are ${inBothRows.length} numbers in both rows, and every one is a multiple of lcm = ${L}. Conversely all ${lcmSteps.length} multiples of ${L} in that range are in both rows. The blue dots are exactly the multiples of the lcm.`,
        };
      },
    },
  };
}

/** What the core says about the two dots currently on the number line. */
export function position(state: Json): unknown {
  const C = core();
  const s = readState(state);
  const g = C.gcd(s.p, s.q);
  const L = C.lcm(s.p, s.q);
  const blues = C.commonMultiples(s.p, s.q, C.axisMax(s));
  const pDividesQ = C.divides(s.p, s.q);
  const qDividesP = C.divides(s.q, s.p);
  let relation: string;
  if (pDividesQ) relation = `P divides Q, so the first blue dot is Q itself (${s.q}).`;
  else if (qDividesP) relation = `Q divides P, so the first blue dot is P itself (${s.p}).`;
  else relation = `Neither divides the other, so the first blue dot is ${L}.`;
  return {
    p: s.p,
    q: s.q,
    gcd: g,
    lcm: L,
    productOverGcd: (s.p * s.q) / g,
    pDividesQ,
    qDividesP,
    oneDividesTheOther: pDividesQ || qDividesP,
    lcmIsQ: L === s.q,
    lcmIsP: L === s.p,
    firstBlueDot: blues.length ? blues[0] : null,
    blueDotsOnScreen: blues.slice(0, 20),
    moves: num(state, "moves", 0),
    explored: state.explored === true,
    inWords: C.describe("move", s),
    note: `P = ${s.p}, Q = ${s.q}: gcd = ${g}, so lcm = ${s.p}x${s.q}/${g} = ${L}. ${relation} The original applet opened with 3 above and 2 below, but lcm(2,3) = lcm(3,2), so the blue dots are the same either way.`,
  };
}
