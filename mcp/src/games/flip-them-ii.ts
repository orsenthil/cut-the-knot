/*
 * run_game_logic actions and saved-position reader for Flipping Items Simultaneously II.
 *
 * N circles in a ring, one blue (the last); a click changes the colour of M successive circles from it.
 * Can the blue colour be moved to circle 1 (the one the arrow points at)? Not when M >= 3 divides N
 * (an invariant). In general (found by solving over the two-element field for N up to 60): exactly
 * when gcd(M, N) = 1, or gcd(M, N) = 2 and M = 2 mod 4. Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["flip-them-ii"].FlipThemIICore;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function actions(): GameActions {
  return {
    solvable: {
      describe: "Can the puzzle be solved for n circles (5 to 60 here) and m at a time (2 to n - 1)? Gives the answer from the linear algebra, the gcd rule that matches it, a list of circles to click (counted from 1) when it can, and the reason (the invariant) when it cannot.",
      args: '{ "n": 12, "m": 5 }',
      run: (args) => {
        const C = core();
        const n = Math.trunc(num(args, "n", 12)), m = Math.trunc(num(args, "m", 3));
        if (n < 5 || n > 60) throw new Error("n runs from 5 to 60");
        if (m < 2 || m > n - 1) throw new Error(`m runs from 2 to ${n - 1}`);
        const sol = C.solve(n, m);
        const g = gcd(n, m);
        return {
          n, m, solvable: sol !== null, gcdOfMAndN: g, ruleSaysSolvable: C.rule(n, m),
          clicksFromTheStart: sol === null ? null : sol.map((i: number) => i + 1),
          why: sol !== null ? "the equations over the two-element field have a solution" : n % m === 0 && m >= 3 ? "M divides N: mark the circles whose place leaves remainder 0 or M - 1 on division by M; every click changes two marked circles, so the number of blue marked circles stays odd, but the target has none" : `gcd(M, N) = ${g}: the circles split into ${g} classes and the colour pattern of the classes cannot be changed into the target's`,
        };
      },
    },
    marked: {
      describe: "The circles the Solution helper marks when m divides n (counted from 1): those whose place leaves remainder 0 or m - 1 on division by m, two in every window of m circles. n runs 5 to 24, m 2 to 12.",
      args: '{ "n": 12, "m": 3 }',
      run: (args) => {
        const C = core();
        const n = Math.trunc(num(args, "n", 12)), m = Math.trunc(num(args, "m", 3));
        const s = C.start({ n, m });
        if (s.n % s.m !== 0) throw new Error("the helper is offered only when m divides n");
        const mk = C.marked(s);
        return { n: s.n, m: s.m, markedCircles: mk.map((b: boolean, i: number) => (b ? i + 1 : 0)).filter(Boolean), startBlueCircleMarked: mk[s.n - 1], targetCircleMarked: mk[0], inEveryWindow: 2 };
      },
    },
  };
}

/** What the core says about the ring as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 12), m: num(state, "m", 3) });
  const blue = Array.isArray(state.blue) && state.blue.length === s.n ? (state.blue as unknown[]).map(Boolean) : s.blue;
  const mk = C.marked(s);
  const solved = blue.every((b: boolean, i: number) => b === (i === 0));
  return {
    circles: s.n,
    m: s.m,
    blueCircles: blue.map((b: boolean, i: number) => (b ? i + 1 : 0)).filter(Boolean),
    solved,
    puzzleSolvableFromTheStart: C.solve(s.n, s.m) !== null,
    mDividesN: s.n % s.m === 0,
    blueMarkedCircles: s.n % s.m === 0 ? blue.filter((b: boolean, i: number) => b && mk[i]).length : null,
    helperShowing: state.helper === true,
    moves: num(state, "moves", 0),
  };
}
