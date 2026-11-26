/*
 * run_game_logic actions and saved-position reader for Determinant by Elimination (VP vs VNP
 * path). The core lives in determinant-elimination/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["determinant-elimination"].DeterminantEliminationCore;
type Stage = { m: string[][]; sign: number; ops: number; what: string; det?: string; done?: boolean; zero?: boolean };

export function actions(): GameActions {
  return {
    eliminate: {
      describe: "Gaussian elimination on a square matrix of whole numbers or fractions like \"3/4\" (2x2 to 7x7), exactly: every step, the operations used, and the determinant; with the determinant and permanent by the n! terms for comparison.",
      args: '{ "matrix": [[2, 1, 3], [4, 1, 1], [1, 5, 2]] }',
      run: (args) => {
        const C = core();
        const m = Array.isArray(args.matrix) ? (args.matrix as unknown[][]).map((r) => (Array.isArray(r) ? r.map(String) : [])) : [];
        if (m.length < 2 || m.length > 7 || m.some((r) => r.length !== m.length || r.some((v) => !/^-?\d+(\/\d+)?$/.test(v)))) throw new Error("matrix must be square, 2x2 to 7x7, of whole numbers or fractions");
        const st = C.steps(m) as Stage[];
        const last = st[st.length - 1];
        return { steps: st.slice(1).map((s) => s.what), operations: last.ops, determinant: last.det ?? "0", byTerms: C.expand(m), expansionMultiplications: String(C.expansionOps(m.length)) };
      },
    },
    counts: {
      describe: "Multiplications and divisions used by elimination (about n^3/3) against multiplying out all n! products, for n from 1 to 30.",
      args: '{ "n": 20 }',
      run: (args) => {
        const C = core();
        const n = Math.round(num(args, "n", 10));
        if (n < 1 || n > 30) throw new Error("n must be 1..30");
        return { n, elimination: C.eliminationOps(n), expansion: String(C.expansionOps(n)) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 4), seed: num(state, "seed", 1), step: num(state, "step", 0) });
  const st = C.stages(s) as Stage[], cur = st[s.step];
  const now = C.expand(cur.m), then = C.expand(st[0].m);
  return {
    size: s.n, step: `${s.step} of ${st.length - 1}`, lastOperation: cur.what, matrix: cur.m,
    determinantNow: now.det, permanentNow: now.perm, permanentAtStart: then.perm, operationsSoFar: cur.ops,
    note: "Row operations keep the determinant (a swap flips its sign) but change the permanent.",
  };
}
