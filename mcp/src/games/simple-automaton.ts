/*
 * run_game_logic actions and saved-position reader for Simple Automaton.
 * The core lives in simple-automaton/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["simple-automaton"].SimpleAutomatonCore;

type Grid = number[][];
type Rule = "2n" | "3n" | "3d" | "4n" | "4d";

const encode = (grid: Grid): string => grid.map((row) => row.join("")).join("/");

function ruleArg(args: Json): Rule {
  const C = core();
  const r = typeof args.rule === "string" ? args.rule : "2n";
  if (!C.RULES.includes(r)) throw new Error(`rule must be one of ${C.RULES.join(", ")}`);
  return r as Rule;
}

function sideArg(args: Json): number {
  const C = core();
  const n = Math.round(num(args, "side", 10));
  if (n < C.MIN_SIDE || n > C.MAX_SIDE) throw new Error(`side must be ${C.MIN_SIDE}..${C.MAX_SIDE}`);
  return n;
}

/** Read a population from the page's grid field, compact encoded rows, or cell pairs. */
function gridArg(args: Json, n: number): Grid {
  if (Array.isArray(args.grid)) {
    const rows = args.grid;
    if (rows.length !== n || rows.some((row: unknown) => !Array.isArray(row) || row.length !== n ||
        row.some((v: unknown) => ![0, 1, false, true].includes(v as number | boolean)))) {
      throw new Error(`grid must be ${n} rows of ${n} zeros and ones`);
    }
    return rows.map((row: unknown[]) => row.map((v: unknown) => (v === 1 || v === true ? 1 : 0)));
  }
  if (typeof args.encoded === "string") {
    const rows = args.encoded.split("/");
    if (rows.length !== n || rows.some((row) => row.length !== n || /[^01]/.test(row))) {
      throw new Error(`encoded must be ${n} rows of ${n} characters, each 0 or 1`);
    }
    return rows.map((row) => row.split("").map((c) => Number(c)));
  }
  if (Array.isArray(args.cells)) {
    const grid: Grid = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const cell of args.cells) {
      if (!Array.isArray(cell) || cell.length !== 2) throw new Error("cells must be pairs [row, column]");
      const i = Number(cell[0]);
      const j = Number(cell[1]);
      if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || i >= n || j < 0 || j >= n) {
        throw new Error(`cell ${JSON.stringify(cell)} is outside the ${n} by ${n} grid`);
      }
      grid[i][j] = 1;
    }
    return grid;
  }
  throw new Error("give a grid, encoded rows, or cells to start from");
}

function startFrom(args: Json) {
  return core().start({ side: sideArg(args), rule: ruleArg(args), grid: gridArg(args, sideArg(args)) });
}

export function actions(): GameActions {
  return {
    evolve: {
      describe: "Step a population under one of the five rules (2n, 3n, 3d, 4n, 4d) and report the live-cell count after each generation and the final grid. A cell survives only when enough of the cells in its little pattern are alive, counting itself; all five rules include the cell itself, and no cells wrap around the edge. Every finite population dies out: the sequence of counts shows how fast, and under rule 2n it never takes more steps than there were live cells at the start.",
      args: '{ "rule": "2n", "side": 6, "encoded": "100000/010000/001000/000100/000010/000001", "steps": 4 }',
      run: (args) => {
        const C = core();
        const r = ruleArg(args);
        let s = startFrom(args);
        const initialAlive = C.population(s.grid);
        const steps = Math.max(0, Math.min(500, Math.round(num(args, "steps", 1))));
        const populations = [initialAlive];
        const grids = [encode(s.grid)];
        for (let i = 0; i < steps; i++) {
          s = C.advance(s);
          populations.push(C.population(s.grid));
          grids.push(encode(s.grid));
        }
        return {
          rule: r, side: s.side, steps, label: C.LABELS[r],
          initialAlive, alive: C.population(s.grid), populations,
          grid: s.grid, encoded: encode(s.grid), grids,
          extinguishedAt: populations.indexOf(0) - 1 >= 0 ? populations.indexOf(0) - 1 : null,
          note: "Each generation is computed from the previous one all at once, using the same rule at every square.",
        };
      },
    },
    extinguish: {
      describe: "Run a population until no cells remain (up to a guard on the number of steps) and report how many steps it took, with the final grid. This is the extinction claim on the page: every finite population vanishes under all five rules, and under rule 2n a start of m live cells dies in at most m steps, proved by induction on the smallest rectangle that holds them.",
      args: '{ "rule": "2n", "side": 6, "encoded": "100000/010000/001000/000100/000010/000001", "guard": 200 }',
      run: (args) => {
        const C = core();
        const r = ruleArg(args);
        const s = startFrom(args);
        const guard = Math.max(1, Math.min(2000, Math.round(num(args, "guard", 500))));
        const initialAlive = C.population(s.grid);
        const out = C.extinguish(s.grid, s.rule, guard);
        return {
          rule: r, side: s.side, initialAlive, steps: out.steps, alive: out.alive,
          grid: out.grid, encoded: encode(out.grid),
          withinTwoNBound: r === "2n" ? out.steps <= initialAlive : null,
          note: out.alive === 0
            ? (r === "2n"
              ? `Died after ${out.steps} steps from ${initialAlive} live cells, never more than the starting population.`
              : `Died after ${out.steps} steps from ${initialAlive} live cells.`)
            : `Still ${out.alive} cells alive after the guard of ${guard} steps.`,
        };
      },
    },
  };
}

export function position(state: Json, stateVersion?: number): unknown {
  const C = core();
  const n = Math.round(num(state, "side", 10));
  if (n < C.MIN_SIDE || n > C.MAX_SIDE) throw new Error(`side must be ${C.MIN_SIDE}..${C.MAX_SIDE}`);
  const rule = ruleArg(state);
  const s = C.start({
    side: n,
    rule,
    grid: Array.isArray(state.grid)
      ? (state.grid as Grid)
      : Array.from({ length: n }, () => new Array<number>(n).fill(0)),
  });
  const alive = C.population(s.grid);
  return {
    // The fields the page saves with Track.state, in the same shape.
    side: s.side, rule, grid: s.grid, steps: Math.max(0, Math.round(num(state, "steps", 0))), alive,
    // What the core can add for the tutor.
    ruleLabel: C.LABELS[rule],
    neighbours: C.NEIGHBOURS[rule],
    need: C.THRESHOLD[rule] + 1,
    encoded: encode(s.grid),
    extinguished: alive === 0 && Math.max(0, Math.round(num(state, "steps", 0))) > 0,
    stateVersion: stateVersion ?? 1,
    note: `Rule ${rule}: ${C.LABELS[rule]}. ${alive === 0 ? "No cells are alive." : `${alive} cells are alive now; they will all die eventually.`}`,
  };
}
