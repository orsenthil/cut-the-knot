/*
 * run_game_logic actions and saved-position reader for Langford and Skolem
 * sequences. The core lives in langford-skolem/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["langford-skolem"].LangfordSkolemCore;
function read(args: Json) {
  return {
    N: Number.isFinite(args.N) ? num(args, "N") : 4,
    D: Number.isFinite(args.D) ? num(args, "D") : 1,
    M: Number.isFinite(args.M) ? num(args, "M") : 2,
    H: Number.isFinite(args.H) ? num(args, "H") : 0,
    kind: args.kind === "skolem" ? "skolem" : "langford",
  };
}

export function actions(): GameActions {
  return {
    solve: {
      describe: "Find an arrangement of pairs or triples with the required gaps, or report that none exists.",
      args: '{ "N": 4, "D": 1, "M": 2, "H": 0, "kind": "langford" }',
      run: (args) => {
        const C = core();
        const r = C.solve(read(args));
        return {
          params: r.params, sequence: r.sequence,
          text: r.sequence ? C.encode(r.sequence) : null,
          valid: C.validate(r.sequence, r.params).valid,
          visited: r.visited,
          note: "Copies of k are k+1 apart for Langford, k apart for Skolem.",
        };
      },
    },
    exists: {
      describe: "Check the modulo-4 existence rule for a perfect defect-1 sequence.",
      args: '{ "n": 4, "kind": "langford" }',
      run: (args) => {
        const n = Number.isFinite(args.n) ? num(args, "n") : 4;
        const kind = args.kind === "skolem" ? "skolem" : "langford";
        return {
          n, kind, exists: core().exists(n, kind),
          note: "Langford needs n = 0 or 3 mod 4; Skolem needs n = 0 or 1 mod 4.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  const r = C.analyze(input);
  return {
    N: r.params.N, D: r.params.D, M: r.params.M, H: r.params.H, kind: r.params.kind,
    sequence: r.solution, text: r.text, valid: r.validation.valid,
    note: r.solution ? `Found ${r.text}.` : "No arrangement exists.",
  };
}
