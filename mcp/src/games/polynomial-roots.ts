/*
 * run_game_logic actions and saved-position reader for Graph of a Polynomial Defined by Its
 * Roots. The core lives in polynomial-roots/ and is copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["polynomial-roots"].PolynomialRootsCore;

function read(C: ReturnType<typeof core>, s: { a: number; roots: number[] }) {
  const e = C.ends(s);
  const word = (v: number) => (v > 0 ? "+infinity" : v < 0 ? "-infinity" : "0");
  return { formula: C.formula(s), degree: s.roots.length, leftEnd: word(e.left), rightEnd: word(e.right), roots: C.multiplicities(s) };
}

export function actions(): GameActions {
  return {
    shape: {
      describe: "For P(x) = A(x - r1)...(x - rn): where the graph goes at each end (sign of A, parity of n), and at each root whether it crosses (odd multiplicity) or only touches (even), and P at a point if x is given.",
      args: '{ "a": 2, "roots": [-3, 1, 1], "x": 0 }',
      run: (args) => {
        const C = core();
        const s = C.start({ a: Math.round(num(args, "a", 1)), roots: numArray(args, "roots").map(Math.round) });
        const out: Record<string, unknown> = read(C, s);
        if (args.x !== undefined) out.valueAtX = C.value(s, num(args, "x"));
        return out;
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ a: Math.round(num(state, "a", 1)), roots: Array.isArray(state.roots) ? (state.roots as number[]) : [] });
  return { ...read(C, s), note: "Far out P has the sign of A x^n; at a root of even multiplicity the graph touches the axis, at an odd one it crosses." };
}
