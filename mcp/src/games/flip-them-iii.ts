/*
 * run_game_logic actions and saved-position reader for Flipping Items Simultaneously III.
 *
 * N circles in a ring, all red; a click changes M successive circles from the one clicked. Fewest clicks
 * to make all blue: with g = gcd(M, N), M1 = M/g, N1 = N/g, possible exactly when M1 is odd, then N1
 * clicks (every g-th circle). Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["flip-them-iii"].FlipThemIIICore;

export function actions(): GameActions {
  return {
    fewest_clicks: {
      describe: "The fewest clicks that turn all n circles blue when a click changes m of them (n 5 to 60, m 2 to n - 1): gcd, M1 = m/gcd, N1 = n/gcd, whether it can be done (M1 odd), the fewest clicks (N1) and which circles to click (every gcd-th, counted from 1), with the parity reason when it cannot.",
      args: '{ "n": 12, "m": 5 }',
      run: (args) => {
        const C = core();
        const n = Math.trunc(num(args, "n", 12)), m = Math.trunc(num(args, "m", 3));
        if (n < 5 || n > 60) throw new Error("n runs from 5 to 60");
        if (m < 2 || m > n - 1) throw new Error(`m runs from 2 to ${n - 1}`);
        const a = C.answer(n, m);
        const alg = C.pageAlgorithm(n, m);
        return {
          n, m, gcd: a.g, M1: a.m1, N1: a.n1,
          solvable: a.solvable, fewest: a.fewest,
          clickCircles: alg === null ? null : alg.map((i: number) => i + 1),
          why: a.solvable ? `click every ${a.g === 1 ? "" : a.g + "th "}circle: each circle is then covered by exactly ${a.m1} blocks, an odd number` : `each click changes ${a.m1} circles of every class modulo ${a.g}, an even number, but each class has ${a.n1} circles, an odd number, which must each change an odd number of times`,
        };
      },
    },
    verify: {
      describe: "Check a list of clicks (circles counted from 1) for n circles and m at a time: how many circles are blue afterwards, and whether that is a solution.",
      args: '{ "n": 12, "m": 3, "clicks": [1, 4, 7, 10] }',
      run: (args) => {
        const C = core();
        const n = Math.trunc(num(args, "n", 12)), m = Math.trunc(num(args, "m", 3));
        if (n < 5 || n > 24 || m < 2 || m > Math.min(12, n - 1)) throw new Error("n runs from 5 to 24 and m from 2 to min(12, n - 1)");
        const raw = Array.isArray(args.clicks) ? (args.clicks as unknown[]).map(Number) : [];
        let s = C.start({ n, m });
        for (const c of raw) {
          if (!Number.isInteger(c) || c < 1 || c > n) throw new Error(`clicks are circle numbers from 1 to ${n}`);
          s = C.move(s, { type: "click", i: c - 1 });
        }
        const blue = s.blue.filter(Boolean).length;
        return { clicks: raw.length, blueCircles: blue, of: n, allBlue: C.allBlue(s), fewestPossible: C.answer(n, m).fewest, isFewest: C.allBlue(s) && raw.length === C.answer(n, m).fewest };
      },
    },
  };
}

/** What the core says about the ring as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 12), m: num(state, "m", 3) });
  const blue = Array.isArray(state.blue) && state.blue.length === s.n ? (state.blue as unknown[]).map(Boolean) : s.blue;
  const clicks = Array.isArray(state.clicks) && state.clicks.length === s.n ? (state.clicks as unknown[]).map(Number) : s.clicks;
  const a = C.answer(s.n, s.m);
  const total = clicks.reduce((x: number, y: number) => x + y, 0);
  return {
    circles: s.n, m: s.m,
    blueCircles: blue.filter(Boolean).length,
    allBlue: blue.every(Boolean),
    clicksSoFar: total,
    solvable: a.solvable,
    fewestPossible: a.fewest,
    gcd: a.g, M1: a.m1, N1: a.n1,
    atTheFewest: blue.every(Boolean) && total === a.fewest,
    moves: num(state, "moves", 0),
  };
}
