/*
 * run_game_logic actions and saved-position reader for Leibniz and Pascal
 * triangles. The core lives in leibniz-triangle/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["leibniz-triangle"].LeibnizTriangleCore;
function read(args: Json) {
  return {
    rows: Number.isFinite(args.rows) ? num(args, "rows") : 8,
    mod: Number.isFinite(args.mod) ? num(args, "mod") : 5,
    kind: args.kind === "leibniz" ? "leibniz" : "pascal",
  };
}

export function actions(): GameActions {
  return {
    triangle: {
      describe: "Build a Pascal or Leibniz triangle and reduce every entry modulo n.",
      args: '{ "rows": 8, "mod": 5, "kind": "pascal" }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          kind: r.kind, rows: r.rows, mod: r.mod, shown: r.shown,
          symmetric: r.symmetric, rowSums: r.rowSums,
          note: r.kind === "pascal" ? "Row n sums to 2^n." : "Entries are reciprocals of (n+1)C(n,m).",
        };
      },
    },
    telescoping: {
      describe: "Show partial sums of 1/(n(n+1)), which approach one.",
      args: '{ "terms": 20 }',
      run: (args) => {
        const terms = Number.isFinite(args.terms) ? num(args, "terms") : 20;
        const r = core().telescoping(terms);
        return { partial: r.partial, last: r.last, limit: 1, note: "Each term is 1/n - 1/(n+1)." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state));
  return {
    rows: r.rows, mod: r.mod, kind: r.kind,
    shown: r.shown, symmetric: r.symmetric, rowSums: r.rowSums,
    note: `A ${r.kind} triangle with ${r.rows} rows modulo ${r.mod}.`,
  };
}
