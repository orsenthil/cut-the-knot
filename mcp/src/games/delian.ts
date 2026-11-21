/*
 * run_game_logic actions and saved-position reader for the Delian construction.
 *
 * A reader's construction claims to give 2^(k/N) on a line, so the cube root of 2
 * for N = 3. It actually gives a projective function of k/N: exact at the ends
 * and the middle, within 0.13% elsewhere. Every answer below comes from the
 * game's real core (delian/ in the site). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["delian"].DelianCore;

const readN = (args: Json, key: string, fallback: number) => Math.max(2, Math.min(20, Math.trunc(num(args, key, fallback))));
const round = (v: number) => Math.round(v * 1e8) / 1e8;

export function actions(): GameActions {
  return {
    points: {
      describe:
        "Run the construction for N divisions of BC (2 to 20) and give the points it puts on AB (distance from A) against the claimed 2^(k/N), with the gap for each k, and the point the construction gives for the cube root of 2 when N = 3.",
      args: '{ "n": 3 }',
      run: (args) => {
        const C = core();
        const n = readN(args, "n", 3);
        const rows = C.positions(n);
        const w = C.worst(n);
        return {
          n,
          rows: rows.map((r: { k: number; got: number; claimed: number; error: number; relativeError: number }) => ({ k: r.k, construction: round(r.got), claimed: round(r.claimed), gap: round(r.error), exact: Math.abs(r.error) < 1e-12 })),
          worst: { k: w.k, gap: round(w.error), percent: round(Math.abs(w.relativeError) * 100) },
          exactAtEnds: true,
          note: n === 3 ? `For N = 3 the point meant to be the cube root of 2 is ${round(rows[1].got)}, not ${round(rows[1].claimed)}; its cube is ${round(rows[1].got ** 3)}.` : `Only the ends${n % 2 === 0 ? " and the middle (sqrt 2)" : ""} are exactly right.`,
        };
      },
    },
    why_it_fails: {
      describe:
        "Explain what the construction actually computes (a projective function of t = k/N, exact at 0, 1/2, 1) against 2^t, the largest gap anywhere, and why the cube cannot be doubled with ruler and compass (x^3 - 2 is irreducible over the rationals, degree 3, not a power of 2).",
      args: "{}",
      run: () => {
        const C = core();
        const w = C.worstAnywhere(20000);
        const g = C.cubeRootOfTwoIsNotConstructible();
        return {
          construction: "f(t) = (1 + (sqrt2 - 1) t) / (1 - (1 - sqrt2/2) t), t = k/N",
          agreesWithPowerOfTwoAt: [0, 0.5, 1],
          f: { atThird: round(C.projective(1 / 3)), cubeRootOfTwo: round(Math.cbrt(2)) },
          largestGapAnywhere: { value: round(w.max), at: round(w.at), percentOfLength: round((w.max / Math.pow(2, w.at)) * 100) },
          rationalRootCandidates: g.candidates,
          rationalRoots: g.roots,
          irreducible: g.irreducibleCubic,
          degree: g.degree,
          note: "A constructible number has degree a power of 2 over the rationals; cube root of 2 has degree 3, so no ruler-and-compass construction can double the cube. The reader's drawing is an approximation good to 0.13%.",
        };
      },
    },
  };
}

/** What the core says about the drawing as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 2) });
  const rows = C.positions(s.n);
  const w = C.worst(s.n);
  const exact = rows.filter((r: { error: number }) => Math.abs(r.error) < 1e-12).length;
  return {
    n: s.n,
    radials: s.n,
    pointsOnAB: rows.length,
    pointsExactlyRight: exact,
    worstDivision: w.k,
    worstGap: round(w.error),
    worstPercent: round(Math.abs(w.relativeError) * 100),
    cubeRootPoint: s.n === 3 ? round(rows[1].got) : null,
    cubeRootOfTwo: round(Math.cbrt(2)),
    moves: num(state, "moves", 0),
    explored: state.explored === true,
    note: s.n === 2 ? "N = 2: the single mean proportional is sqrt 2, and the construction gets it exactly." : `With N = ${s.n}, ${exact} of the ${rows.length} points are exactly where the claim puts them; the rest are off by up to ${round(Math.abs(w.relativeError) * 100)}%.`,
  };
}
