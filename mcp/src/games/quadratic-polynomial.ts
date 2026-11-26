/*
 * run_game_logic actions and saved-position reader for Graph and Roots of a Quadratic
 * Polynomial. The core lives in quadratic-polynomial/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["quadratic-polynomial"].QuadraticPolynomialCore;

function read(C: ReturnType<typeof core>, s: { c: number[] }) {
  const r = C.roots(s), [c, b, a] = s.c;
  const roots = r.kind === "complex" ? [{ re: r.points[0].x, im: r.points[0].y }, { re: r.points[1].x, im: r.points[1].y }] : r.points.map((p: { x: number }) => ({ re: p.x, im: 0 }));
  return {
    formula: C.formula(s), discriminant: a === 0 ? null : C.discriminant(s), kind: r.kind, roots, axis: r.axis,
    vieta: a === 0 ? null : { sum: -b / a, product: c / a },
    complexRootsOnCircleOfRadius: r.kind === "complex" && c / a > 0 ? Math.sqrt(c / a) : null,
  };
}

export function actions(): GameActions {
  return {
    roots: {
      describe: "The roots of ax^2 + bx + c by the quadratic formula: two real, one double or a complex pair as the discriminant b^2 - 4ac is positive, zero or negative; Vieta's sum and product, and the circle sqrt(c/a) complex roots stay on as b changes.",
      args: '{ "a": 1, "b": 2, "c": 4 }',
      run: (args) => {
        const C = core();
        return read(C, C.start({ c: [num(args, "c", 0), num(args, "b", 0), num(args, "a", 1)] }));
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const c = Array.isArray(state.c) ? (state.c as number[]) : [0, 0, 1];
  return { ...read(C, C.start({ c })), note: "D = b^2 - 4ac decides the kind of roots; they are symmetric about x = -b/2a." };
}
