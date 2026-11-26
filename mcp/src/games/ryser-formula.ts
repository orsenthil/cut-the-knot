/*
 * run_game_logic actions and saved-position reader for Ryser's Formula (VP vs VNP path). The core
 * lives in ryser-formula/ and is copied into src/generated/cores/ at build time. See _shared.ts
 * for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["ryser-formula"].RyserFormulaCore;
type Term = { cols: number[]; sums: number[]; product: number; sign: number };
const letters = (cols: number[]) => cols.map((j) => String.fromCharCode(65 + j)).join("");

export function actions(): GameActions {
  return {
    ryser: {
      describe: "Ryser's formula for the permanent of a square integer matrix (1x1 to 8x8): each column set's row sums, signed product and running total (listed up to 4x4), the result, and the permanent by the n! products for comparison, with multiplication counts.",
      args: '{ "matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }',
      run: (args) => {
        const C = core();
        const m = Array.isArray(args.matrix) ? (args.matrix as unknown[][]).map((r) => (Array.isArray(r) ? r.map(Number) : [])) : [];
        if (m.length < 1 || m.length > 8 || m.some((r) => r.length !== m.length || r.some((v) => !Number.isInteger(v)))) throw new Error("matrix must be square, 1x1 to 8x8, of whole numbers");
        const T = C.terms(m) as Term[];
        let run = 0;
        const lines = T.map((t) => { run += t.sign * t.product; return { columns: letters(t.cols), rowSums: t.sums, term: t.sign * t.product, runningTotal: run }; });
        return { ryser: C.ryser(m), permanent: C.perm(m), terms: m.length <= 4 ? lines : `${T.length} terms`, ryserMultiplications: String(C.ryserMults(m.length)), plainMultiplications: String(C.plainMults(m.length)) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 3), seed: num(state, "seed", 1), shown: num(state, "shown", 0) });
  const m = C.matrixOf(s) as number[][], T = C.terms(m) as Term[];
  const total = T.slice(0, s.shown).reduce((a, t) => a + t.sign * t.product, 0);
  return { matrix: m, termsShown: `${s.shown} of ${T.length}`, runningTotal: total, permanent: C.perm(m), lastSet: s.shown ? letters(T[s.shown - 1].cols) : null };
}
