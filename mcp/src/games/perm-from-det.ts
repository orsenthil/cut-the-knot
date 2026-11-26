/*
 * run_game_logic actions and saved-position reader for Permanent from a Determinant (VP vs VNP
 * path). The core lives in perm-from-det/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["perm-from-det"].PermFromDetCore;
type Term = { letters: string; sign: number };

export function actions(): GameActions {
  return {
    signs: {
      describe: 'Put minus signs on entries of a 2x2 or 3x3 matrix of letters (a, b, c, ... row by row): the sign each product gets in the determinant, and how many are positive (all for 2x2 is possible; at most 5 of 6 for 3x3).',
      args: '{ "n": 3, "minus": ["c", "d"] }',
      run: (args) => {
        const C = core();
        const n = num(args, "n", 3) === 2 ? 2 : 3;
        const minus = new Set((Array.isArray(args.minus) ? args.minus : []).map(String));
        const s = C.start({ n, signs: Array.from({ length: n * n }, (_, k) => (minus.has(C.LETTERS[k]) ? -1 : 1)) });
        return { products: (C.terms(s) as Term[]).map((t) => `${t.sign > 0 ? "+" : "-"}${t.letters}`), positive: C.positives(s), best: (C.BEST as Record<number, number>)[n] };
      },
    },
    grenet: {
      describe: "Grenet's matrix of size 2^n - 1 (n = 2, 3, 4) whose determinant is the n x n permanent: its entries (letters a, b, ... row by row of the small matrix, 1s and blanks), and, for a given whole-number matrix, the permanent and that determinant side by side.",
      args: '{ "matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }',
      run: (args) => {
        const C = core();
        const x = Array.isArray(args.matrix) ? (args.matrix as unknown[][]).map((r) => (Array.isArray(r) ? r.map(Number) : [])) : [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
        const n = x.length;
        if (n < 2 || n > 4 || x.some((r) => r.length !== n || r.some((v) => !Number.isInteger(v)))) throw new Error("matrix must be square, 2x2 to 4x4, of whole numbers");
        const G = C.grenet(n);
        return {
          size: G.size,
          rows: (G.M as unknown[][]).map((row) => row.map((v) => C.label(v, n) || ".").join(" ")),
          permanent: String(C.perm(x)), determinant: String(C.det(C.fill(G, x))),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 3) === 2 ? 2 : 3, signs: state.signs });
  return {
    size: s.n, minusOn: s.signs.map((v: number, k: number) => (v < 0 ? C.LETTERS[k] : null)).filter(Boolean),
    products: (C.terms(s) as Term[]).map((t) => `${t.sign > 0 ? "+" : "-"}${t.letters}`), positive: C.positives(s), best: (C.BEST as Record<number, number>)[s.n], reachedBest: C.result(s) === "win",
    note: "Each entry is in exactly two products of the 3x3 determinant, so the number of minus products stays odd: 5 of 6 is the best.",
  };
}
