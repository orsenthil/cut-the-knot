/*
 * run_game_logic actions and saved-position reader for Determinant and Permanent (VP vs VNP
 * path). The core lives in det-and-perm/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["det-and-perm"].DetAndPermCore;
type Term = { cols: number[]; sign: number; product: number };

function matrix(v: unknown): number[][] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 6) throw new Error("matrix must be a square list of 1 to 6 rows of numbers");
  const m = v.map((r) => (Array.isArray(r) ? r.map(Number) : []));
  if (m.some((r) => r.length !== m.length || r.some((x) => !Number.isFinite(x)))) throw new Error("matrix must be square, with numbers only");
  return m;
}

export function actions(): GameActions {
  return {
    evaluate: {
      describe: "For a square matrix (1x1 to 6x6, rows of numbers): its determinant, its permanent, and the n! products they are made of (columns chosen in each row, sign in the determinant). Products are listed only up to 4x4.",
      args: '{ "matrix": [[1, 2, 3], [4, 5, 6], [7, 8, 9]] }',
      run: (args) => {
        const C = core();
        const m = matrix(args.matrix);
        const t = C.terms(m) as Term[];
        return {
          n: m.length, determinant: C.det(m), permanent: C.perm(m), products: t.length,
          terms: m.length <= 4 ? t.map((x) => ({ columns: x.cols.map((j) => j + 1), sign: x.sign > 0 ? "+" : "-", product: x.product })) : undefined,
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ cells: state.cells, goal: state.goal });
  const g = C.grid(s.cells);
  return {
    square: g, goal: s.goal === "det" ? "largest determinant" : "largest permanent",
    permanent: C.perm(g), determinant: C.det(g), target: C.GOALS[s.goal as "det" | "perm"], reached: C.result(s) === "win",
    swaps: Number(state.swaps) || 0,
  };
}
