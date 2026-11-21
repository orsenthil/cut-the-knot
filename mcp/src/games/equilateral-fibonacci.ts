/*
 * run_game_logic actions and saved-position reader for Fibonacci Numbers in an
 * Equilateral Triangle.
 *
 * Trapezoids with 60 degree angles have base = top + leg; stacked left and right
 * down a triangular lattice, their (top, leg, base) are consecutive Fibonacci
 * numbers. Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["equilateral-fibonacci"].EquilateralFibonacciCore;

export function actions(): GameActions {
  return {
    shapes: {
      describe: "The coloured shapes for a lattice of side n (5 to 145, multiples of 5): each shape's kind, which edge it hangs on, the rows it covers, and top, leg and base. For a trapezoid they are three consecutive Fibonacci numbers.",
      args: '{ "n": 55 }',
      run: (args) => {
        const C = core();
        const n = Math.max(5, Math.min(145, Math.round(num(args, "n", 20) / 5) * 5));
        const shapes = C.shapes(n);
        return {
          n,
          shapes: shapes.map((s: { kind: string; side: string; rows: number[]; top: number; leg: number; base: number }) => ({ kind: s.kind, edge: s.side, rows: s.rows, top: s.top, leg: s.leg, base: s.base, unitTriangles: s.base * s.base - s.top * s.top })),
          lastRow: shapes[shapes.length - 1].rows[1],
          rule: "base = top + leg, which is F(k+2) = F(k) + F(k+1)",
        };
      },
    },
    trapezoid: {
      describe: "The k-th Fibonacci trapezoid (k = 1, 2, ...): its (top, leg, base), how many unit triangles it holds (base^2 - top^2 = leg(base + top)), and the first row of the lattice it needs.",
      args: '{ "k": 3 }',
      run: (args) => {
        const k = Math.trunc(num(args, "k", 1));
        if (k < 1 || k > 9) throw new Error("k runs from 1 to 9 (the lattice of side 145 holds nine trapezoids)");
        const C = core();
        const t = C.shapes(145).filter((s: { kind: string }) => s.kind === "trapezoid")[k - 1];
        return { k, edge: t.side, top: t.top, leg: t.leg, base: t.base, unitTriangles: t.base * t.base - t.top * t.top, rows: t.rows, lowestRowNeeded: t.rows[1] };
      },
    },
  };
}

/** What the core says about the lattice as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 20) });
  const shapes = C.shapes(s.n);
  const traps = shapes.filter((x: { kind: string }) => x.kind === "trapezoid");
  const last = traps[traps.length - 1];
  return {
    n: s.n,
    shapes: shapes.length,
    trapezoids: traps.length,
    lastTrapezoid: { top: last.top, leg: last.leg, base: last.base, endsOnRow: last.rows[1] },
    nextRowThatWouldNotFit: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233].find((v) => v > last.rows[1]),
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
