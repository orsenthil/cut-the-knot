/*
 * run_game_logic actions and saved-position reader for the Farey Series.
 *
 * F(N): the fractions in lowest terms in [0, 1] with denominator up to N, in order.
 * Successive terms satisfy m2 n1 - m1 n2 = 1, and the middle of three successive terms
 * is the mediant of the other two. Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["farey"].FareyCore;
const readN = (args: Json, fallback: number) => Math.max(2, Math.min(70, Math.trunc(num(args, "n", fallback))));

export function actions(): GameActions {
  return {
    series: {
      describe: "The Farey series F(N) for N from 2 to 70: its fractions in order (all of them up to N = 12, else the first and last few), the number of terms (1 + phi(1) + ... + phi(N)), and a check that every successive pair has determinant 1.",
      args: '{ "n": 5 }',
      run: (args) => {
        const C = core();
        const n = readN(args, 5);
        const f: number[][] = C.farey(n);
        let allOne = true;
        for (let i = 0; i + 1 < f.length; i++) if (f[i + 1][0] * f[i][1] - f[i][0] * f[i + 1][1] !== 1) allOne = false;
        const text = (x: number[]) => `${x[0]}/${x[1]}`;
        return { n, terms: f.length, fractions: n <= 12 ? f.map(text) : { first: f.slice(0, 8).map(text), last: f.slice(-8).map(text) }, everySuccessivePairHasDeterminant1: allOne };
      },
    },
    neighbours: {
      describe: "The neighbours of a fraction m/q in F(N) (it must be in lowest terms with q <= N): the left and right neighbours, the determinants m2 n1 - m1 n2 (always 1) and the mediant of the neighbours (which reduces to the fraction).",
      args: '{ "n": 7, "m": 1, "q": 2 }',
      run: (args) => {
        const C = core();
        const n = readN(args, 7), m = Math.trunc(num(args, "m", 1)), q = Math.trunc(num(args, "q", 2));
        const f: number[][] = C.farey(n);
        const i = f.findIndex((x) => x[0] === m && x[1] === q);
        if (i < 0) throw new Error(`${m}/${q} is not in F(${n}): it must be in lowest terms, between 0 and 1, with denominator at most ${n}`);
        const a = C.around(n, i);
        if (!a) throw new Error("fraction not found");
        return {
          term: `${m}/${q}`, position: `${i + 1} of ${f.length}`,
          left: a.prev && `${a.prev[0]}/${a.prev[1]}`, right: a.next && `${a.next[0]}/${a.next[1]}`,
          determinantWithLeft: a.detPrev, determinantWithRight: a.detNext,
          mediantOfNeighbours: a.mediantOfNeighbours && `${a.mediantOfNeighbours[0]}/${a.mediantOfNeighbours[1]}`,
          mediantEqualsTerm: a.isMediant,
        };
      },
    },
  };
}

/** What the core says about the board as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 5), lines: state.lines !== false, oneHalf: state.oneHalf !== false });
  const f: number[][] = C.farey(s.n);
  const sel = typeof state.selected === "number" && state.selected >= 0 && state.selected < f.length ? C.around(s.n, state.selected) : null;
  return {
    n: s.n,
    terms: f.length,
    selected: sel ? `${sel.term[0]}/${sel.term[1]}` : null,
    neighbours: sel ? [sel.prev && `${sel.prev[0]}/${sel.prev[1]}`, sel.next && `${sel.next[0]}/${sel.next[1]}`] : null,
    selectedIsMediantOfNeighbours: sel ? sel.isMediant : null,
    lines: s.lines,
    oneHalf: s.oneHalf,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
