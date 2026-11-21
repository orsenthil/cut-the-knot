/*
 * run_game_logic actions and saved-position reader for Curry's Paradox.
 *
 * A thin right triangle with Fibonacci legs F(n+1) and F(n-1) is cut into two
 * triangles and a rectangle; swapping the triangles changes the leftover
 * rectangle's area by exactly one, because the three slanted edges are not on one
 * line. Every answer below comes from the game's real core (curry-paradox/ in the
 * site). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["curry-paradox"].CurryParadoxCore;

/** The page's n runs from 4 to 11; the applet's own index is n - 1. */
const readFn = (args: Json, key: string, fallback: number) => Math.max(3, Math.min(10, Math.trunc(num(args, key, fallback)) - 1));

function describe(C: ReturnType<typeof core>, fn: number) {
  const f = C.facts(fn);
  const { S3, S4, S5, S6, S7 } = C.lengths(fn);
  const bigTwice = f.bigTriangleTwiceArea;
  return {
    n: f.n,
    triangleLegs: f.legs,
    smallTriangleLegs: [S4, S6],
    largeTriangleLegs: [S3, S5],
    rectangleBefore: f.rectangles[0],
    rectangleAfter: f.rectangles[1],
    areaDifference: f.areaDifference,
    identity: `F(${f.n})F(${f.n - 3}) - F(${f.n - 1})F(${f.n - 2}) = ${C.fib(f.n) * C.fib(f.n - 3) - C.fib(f.n - 1) * C.fib(f.n - 2)} = (-1)^${f.n}`,
    bigTriangleArea: bigTwice / 2,
    piecesAreaFirstArrangement: f.firstArrangementTwiceArea / 2,
    piecesAreaSecondArrangement: f.secondArrangementTwiceArea / 2,
    slopes: { bigTriangle: f.slopes.big, smallTriangle: f.slopes.small, largeTriangle: f.slopes.large },
    slopeSpread: Math.max(f.slopes.big, f.slopes.small, f.slopes.large) - Math.min(f.slopes.big, f.slopes.small, f.slopes.large),
    hypotenuseLength: Math.hypot(S7, S4),
  };
}

export function actions(): GameActions {
  return {
    explain: {
      describe:
        "For the page's n (4 to 11), the Fibonacci lengths of the pieces, the two rectangle areas (always one apart, the sign being (-1)^n), the areas of the big triangle and of the pieces in each arrangement (half a square off either way), and the three hypotenuse slopes that differ.",
      args: '{ "n": 6 }',
      run: (args) => {
        const C = core();
        const fn = readFn(args, "n", 6);
        return {
          ...describe(C, fn),
          note: "The big triangle's slanted edge and the two small triangles' edges have different slopes, so the pieces never fit exactly: the sliver is half a square short in one arrangement and half over in the other. The smaller n is, the more visible the gap.",
        };
      },
    },
    table: {
      describe: "The paradox for every n the applet offers: the two rectangle areas, their difference, and how far apart the three slopes are (smaller means harder to see).",
      args: "{}",
      run: () => {
        const C = core();
        const rows = [];
        for (let fn = C.MIN_FN; fn <= C.MAX_FN; fn++) {
          const d = describe(C, fn);
          rows.push({ n: d.n, legs: d.triangleLegs, rectangleAreas: [d.rectangleBefore.area, d.rectangleAfter.area], difference: d.areaDifference, slopeSpread: Number(d.slopeSpread.toFixed(5)) });
        }
        return { rows, note: "The difference is always +1 or -1, alternating with n; the slope spread falls from about 0.17 (n = 4) to almost nothing." };
      },
    },
  };
}

/** What the core says about the figure as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const fn = Math.max(3, Math.min(10, Math.trunc(num(state, "fn", 5))));
  const four = state.four === true && fn === 5;
  const offsets = Array.isArray(state.offsets) ? (state.offsets as Json[]) : [];
  const s = C.start({ fn, four, inner: state.inner !== false });
  s.offsets = s.offsets.map((o: { dx: number; dy: number }, i: number) => ({ dx: num(offsets[i] ?? {}, "dx", 0), dy: num(offsets[i] ?? {}, "dy", 0) }));
  const home = s.offsets.map((_: unknown, i: number) => C.inPlace(s, i));
  return {
    ...describe(C, fn),
    pieces: s.offsets.length,
    piecesInPlace: home.filter(Boolean).length,
    allInPlace: home.every(Boolean),
    holeInside: four ? state.inner !== false : null,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
    note: home.every(Boolean)
      ? `All pieces are in the lower triangle: the leftover rectangle is now ${describe(C, fn).rectangleAfter.w} x ${describe(C, fn).rectangleAfter.h}, one square ${describe(C, fn).areaDifference > 0 ? "bigger" : "smaller"} than before.`
      : `${home.filter(Boolean).length} of ${home.length} pieces are in place in the lower triangle.`,
  };
}
