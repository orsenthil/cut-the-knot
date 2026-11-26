/*
 * run_game_logic actions and saved-position reader for the Pythagorean Triples Calculator. The
 * core lives in pyth-triple-calculator/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["pyth-triple-calculator"].PythTripleCalculatorCore;

function read(C: ReturnType<typeof core>, s: { n: number; m: number; k: number }) {
  const t = C.triple(s);
  if (!t) return { n: s.n, m: s.m, k: s.k, triangle: null, note: "N = M gives a = 0: no triangle." };
  return { n: s.n, m: s.m, k: s.k, a: t.a, b: t.b, c: t.c, primitive: t.primitive, commonFactor: t.gcd };
}

export function actions(): GameActions {
  return {
    triple: {
      describe: "The triple a = (N^2 - M^2)k, b = 2NMk, c = (N^2 + M^2)k for N > M >= 1, k >= 1 (up to 1000), and whether it is primitive (k = 1, gcd(N, M) = 1, N - M odd).",
      args: '{ "n": 2, "m": 1, "k": 1 }',
      run: (args) => {
        const C = core();
        return read(C, C.start({ n: num(args, "n", 2), m: num(args, "m", 1), k: num(args, "k", 1) }));
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 2), m: num(state, "m", 1), k: num(state, "k", 1) });
  return { ...read(C, s), note: "(N^2 - M^2)^2 + (2NM)^2 = (N^2 + M^2)^2, and every Pythagorean triple comes from these formulas." };
}
