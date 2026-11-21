/*
 * run_game_logic actions and saved-position reader for A Faulty Dissection.
 *
 * The 8 x 8 square cut into two triangles (legs 8, 3) and two trapezoids (parallel sides 5, 3)
 * seems to make a 5 x 13 rectangle: 64 = 65. The pieces leave a sliver of area exactly 1
 * (13 x 5 - 8^2 = 1, Cassini's identity). Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["fibonacci-cheat"].FibonacciCheatCore;
const round = (v: number) => Math.round(v * 1e6) / 1e6;

export function actions(): GameActions {
  return {
    areas: {
      describe: "The areas in the paradox: each true piece, their total (64), the rectangle (65), the adjusted pieces the applet draws (total 65), the missing sliver (exactly 1), its approximate width, and the cut slopes 3/8 and 2/5 that do not match.",
      args: "{}",
      run: () => {
        const C = core();
        const trueAreas = C.PIECES.map((p: { name: string; exact: number[][] }) => ({ piece: p.name, area: round(C.area(p.exact)) }));
        const adjusted = C.PIECES.map((p: { name: string; adjusted: number[][] }) => ({ piece: p.name, area: round(C.area(p.adjusted)) }));
        return {
          truePieces: trueAreas,
          totalOfTruePieces: round(C.PIECES.reduce((s: number, p: { exact: number[][] }) => s + C.area(p.exact), 0)),
          square: 8 * 8,
          rectangle: 5 * 13,
          gapArea: 5 * 13 - 8 * 8,
          adjustedPieces: adjusted,
          totalOfAdjustedPieces: round(C.PIECES.reduce((s: number, p: { adjusted: number[][] }) => s + C.area(p.adjusted), 0)),
          squeeze: "the side 3 becomes 40/13 = 3.0769",
          slopes: { trianglesHypotenuse: 3 / 8, trapezoidSlant: 2 / 5 },
          gapWidthAboutCells: round(1 / Math.hypot(5, 13)),
        };
      },
    },
    cassini: {
      describe: "Cassini's identity behind the paradox for consecutive Fibonacci numbers F(k-1), F(k), F(k+1): F(k+1)F(k-1) - F(k)^2 = (-1)^k, and the square-to-rectangle dissection it suggests (k even: the rectangle is one cell bigger; k odd: one cell smaller).",
      args: '{ "k": 6 }',
      run: (args) => {
        const k = Math.trunc(num(args, "k", 6));
        if (k < 2 || k > 30) throw new Error("k runs from 2 to 30");
        const F = [0, 1];
        for (let i = 2; i <= k + 1; i++) F.push(F[i - 1] + F[i - 2]);
        const a = F[k - 1], b = F[k], c = F[k + 1];
        return { k, fibonacci: [a, b, c], square: `${b} x ${b} = ${b * b}`, rectangle: `${a} x ${c} = ${a * c}`, difference: a * c - b * b, signOfTheDifference: (-1) ** k, example: k === 6 ? "the page's 8 x 8 (64) against 5 x 13 (65)" : undefined };
      },
    },
  };
}

/** What the core says about the dissection as the page saved it. */
export function position(state: Json): unknown {
  const pieces = Array.isArray(state.pieces) ? (state.pieces as { id: number; f?: number; placed?: boolean }[]) : [];
  const placed = pieces.filter((p) => p.placed === true).map((p) => p.id);
  return {
    piecesInTheRectangle: placed.length,
    which: placed,
    allPlaced: placed.length === 4,
    showingHonestPieces: state.honest === true,
    visibleAreaIfAllPlaced: state.honest === true ? "64 of the 65 cells are covered; a thin gap of 1 cell shows" : "65 cells appear covered because the pieces are squeezed (the true pieces cover 64)",
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
