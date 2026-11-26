/*
 * run_game_logic actions and saved-position reader for Signs in a Matrix. The core lives in
 * switching-signs/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["switching-signs"].SwitchingSignsCore;

function grid(v: unknown) {
  if (!Array.isArray(v) || !v.length || v.length > 15) throw new Error("nums: 1..15 rows of numbers");
  const rows = v as unknown[];
  const n = Array.isArray(rows[0]) ? (rows[0] as unknown[]).length : 0;
  if (!n || n > 15 || rows.some((r) => !Array.isArray(r) || r.length !== n || r.some((x) => !Number.isFinite(Number(x))))) throw new Error("nums: rows of equal length (1..15) of numbers");
  return core().start({ nums: rows.map((r) => (r as unknown[]).map((x) => Math.round(Number(x)))) });
}

function read(s: ReturnType<ReturnType<typeof core>["start"]>) {
  const C = core();
  return {
    rowSums: C.rowSums(s), columnSums: C.colSums(s), total: C.total(s),
    negativeLines: C.negativeLines(s).map((l: { row?: number; col?: number; sum: number }) => (l.row !== undefined ? `row ${l.row + 1} (${l.sum})` : `column ${(l.col as number) + 1} (${l.sum})`)),
    solved: C.solved(s),
  };
}

export function actions(): GameActions {
  return {
    solve: {
      describe: "For a grid of whole numbers, the row and column sums, and a sequence of flips of negative lines that makes every sum non-negative, with the total of all numbers after each flip (it always rises).",
      args: '{ "nums": [[1, -2, 3], [-4, 5, -6]] }',
      run: (args) => {
        const C = core();
        let s = grid(args.nums);
        const start = read(s), steps: { flip: string; total: number }[] = [];
        for (const m of C.solve(s).moves) {
          s = C.flip(s, m)!;
          steps.push({ flip: m.row !== undefined ? `row ${m.row + 1}` : `column ${m.col + 1}`, total: C.total(s) });
        }
        return { start, steps, end: read(s) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = grid(state.nums);
  return { ...read(s), flipsSoFar: Number(state.flips) || 0, note: "Flipping a line with sum -s raises the total by 2s, so flipping negative lines must stop." };
}
