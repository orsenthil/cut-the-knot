/*
 * run_game_logic actions and saved-position reader for Graph and Roots of a Cubic. The core
 * lives in polynomial-degree-3/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["polynomial-degree-3"].PolynomialDegree3Core;

function read(C: ReturnType<typeof core>, s: { c: number[]; tangent: boolean }) {
  const r = C.roots(s), f = C.inflection(s);
  return {
    formula: C.formula(s),
    roots: r ? { real: r.real, others: r.others, complexPair: r.complex } : null,
    inflection: f ? { x: f.x, y: f.y, tangentSlope: f.slope, differenceIsACube: f.difference } : null,
  };
}

export function actions(): GameActions {
  return {
    roots: {
      describe: "The applet's real root of ax^3 + bx^2 + cx + d (stepping from 0 to a sign change, then halving to |P| < 0.001), the other two from Horner's division (real or a complex pair), and the inflection point x0 = -b/3a with its tangent.",
      args: '{ "a": 1, "b": -6, "c": 11, "d": -6 }',
      run: (args) => {
        const C = core();
        const s = C.start({ c: [num(args, "d", 0), num(args, "c", 0), num(args, "b", 0), num(args, "a", 1)] });
        return read(C, s);
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const c = Array.isArray(state.c) ? (state.c as number[]) : [0, 0, 0, 1];
  const s = C.start({ c, tangent: state.tangent === true });
  return { ...read(C, s), tangentShown: s.tangent, note: "A cubic always has a real root (its ends have opposite signs), and it is symmetric about its inflection point." };
}
