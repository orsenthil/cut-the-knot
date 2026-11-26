/*
 * run_game_logic actions and saved-position reader for Build an Arithmetic Circuit (VP vs VNP
 * path). The core lives in arithmetic-circuits/ and is copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["arithmetic-circuits"].ArithmeticCircuitsCore;
type Gate = [string, number, number];
type Puzzle = { id: string; name: string; vars: string[]; ref: Gate[] };

function describe(vars: string[], gates: Gate[]) {
  const C = core();
  const w = C.wires(vars, gates) as Map<string, number>[];
  const names = ["1", ...vars, ...gates.map((_, i) => `g${i + 1}`)];
  const k0 = 1 + vars.length;
  return gates.map(([op, a, b], i) => `${names[k0 + i]} = ${names[a]} ${op === "*" ? "×" : op} ${names[b]} = ${C.format(w[k0 + i], vars)}`);
}

export function actions(): GameActions {
  return {
    puzzles: {
      describe: "The page's puzzles: each target polynomial, its par (the proved minimum number of +, -, x gates) and a circuit that reaches it.",
      args: "{}",
      run: () => {
        const C = core();
        return (C.PUZZLES as Puzzle[]).map((P) => ({ id: P.id, target: C.format(C.target(P.id), P.vars), par: P.ref.length, circuit: describe(P.vars, P.ref) }));
      },
    },
    run: {
      describe: 'Run a circuit: variables (names), and gates [op, a, b] with op "+", "-" or "*", where a and b index the wires: 0 is the constant 1, then the variables, then earlier gates. Returns what every gate computes.',
      args: '{ "vars": ["x", "y"], "gates": [["+", 1, 2], ["*", 3, 3]] }',
      run: (args) => {
        const vars = Array.isArray(args.vars) ? args.vars.map(String).slice(0, 6) : ["x"];
        const gates = (Array.isArray(args.gates) ? args.gates : []) as Gate[];
        if (gates.length > 20) throw new Error("at most 20 gates");
        gates.forEach((g, i) => {
          if (!Array.isArray(g) || !["+", "-", "*"].includes(g[0]) || ![g[1], g[2]].every((k) => Number.isInteger(k) && k >= 0 && k < 1 + vars.length + i)) throw new Error(`gate ${i + 1} must be [op, a, b] using earlier wires`);
        });
        return { gates: describe(vars, gates) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ puzzle: state.puzzle, gates: state.gates });
  const P = C.puzzle(s.puzzle) as Puzzle;
  const r = C.reached(s) as number;
  return {
    puzzle: P.name, target: C.format(C.target(P.id), P.vars), par: P.ref.length,
    gates: describe(P.vars, s.gates), targetReachedAt: r >= 0 ? `g${r + 1}` : null, atPar: C.result(s) === "win",
  };
}
