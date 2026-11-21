/*
 * run_game_logic actions and saved-position reader for Counting Squares in a
 * Square.
 *
 * An M x M square has (N - M + 1)^2 places inside an N x N square, and all sizes
 * together make N(N+1)(2N+1)/6. Every answer below comes from the game's real
 * core (counting-squares-in-square/ in the site). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["counting-squares-in-square"].CountingSquaresInSquareCore;

const size = (args: Json, key: string, fallback: number) => Math.max(1, Math.min(40, Math.trunc(num(args, key, fallback))));

export function actions(): GameActions {
  return {
    count_places: {
      describe:
        "How many M x M squares fit in an N x N grid: (N - M + 1)^2 places, with a brute-force check, and the total of all sizes N(N+1)(2N+1)/6. If M is bigger than N there are none, though the formula would still give a positive number.",
      args: '{ "n": 5, "m": 2 }',
      run: (args) => {
        const C = core();
        const n = size(args, "n", 4), m = size(args, "m", 2);
        let brute = 0;
        for (let x = 0; x + m <= n; x++) for (let y = 0; y + m <= n; y++) brute++;
        return {
          n, m,
          places: C.places(n, m),
          formula: (n - m + 1) * (n - m + 1),
          bruteForce: brute,
          formulaValid: m <= n,
          totalOfAllSizes: C.total(n),
          closedForm: (n * (n + 1) * (2 * n + 1)) / 6,
          note: m <= n
            ? `The upper left cell of an ${m} x ${m} square can be in any of ${n - m + 1} x ${n - m + 1} cells, so there are ${C.places(n, m)} such squares; all sizes together make ${C.total(n)}.`
            : `A ${m} x ${m} square is bigger than the ${n} x ${n} grid: there are no places (the formula (N-M+1)^2 only holds for M <= N).`,
        };
      },
    },
    all_sizes: {
      describe: "The number of squares of each size M = 1..N in an N x N grid, and their sum (the square pyramidal number).",
      args: '{ "n": 6 }',
      run: (args) => {
        const C = core();
        const n = size(args, "n", 4);
        const bySize = [];
        for (let m = 1; m <= n; m++) bySize.push({ m, squares: C.places(n, m) });
        return { n, bySize, total: C.total(n), closedForm: (n * (n + 1) * (2 * n + 1)) / 6, sumOfFirstNSquares: bySize.reduce((a, b) => a + b.squares, 0) };
      },
    },
  };
}

/** What the core says about the grid as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const n = size(state, "n", 4), m = Math.max(1, Math.min(40, Math.trunc(num(state, "m", 2))));
  const painted = Array.isArray(state.painted) ? (state.painted as unknown[]).filter((x) => x === true).length : 0;
  const places = C.places(n, m);
  return {
    n, m,
    places,
    painted,
    unpainted: Math.max(0, places - painted),
    allPainted: places > 0 && painted === places,
    totalOfAllSizes: C.total(n),
    squareFits: m <= n,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
    note: m <= n
      ? `${painted} of the ${places} = (${n}-${m}+1)^2 places of the ${m} x ${m} square are painted; all sizes together make ${C.total(n)} squares.`
      : `M = ${m} is bigger than N = ${n}, so no place exists.`,
  };
}
