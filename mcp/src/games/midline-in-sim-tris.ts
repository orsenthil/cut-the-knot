/*
 * run_game_logic actions and saved-position reader for Midline in Similar Triangles.
 * The core lives in midline-in-sim-tris/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["midline-in-sim-tris"].MidlineCore;

const pt = (v: unknown, name: string) => {
  const p = v as Json;
  const x = Number(p?.x), y = Number(p?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${name}" needs numeric x and y`);
  return { x, y };
};

export function actions(): GameActions {
  return {
    midline: {
      describe: "Given A, B, C and L, build the similar triangles AKB, BLC, CNA (z = (L-B)/(C-B)) and report the claim: D - E = (N - C)/2, so DE is parallel to CN and half as long.",
      args: '{ "A": {"x":266,"y":262}, "B": {"x":320,"y":75}, "C": {"x":80,"y":75}, "L": {"x":200,"y":37} }',
      run: (args) => {
        const s = { A: pt(args.A, "A"), B: pt(args.B, "B"), C: pt(args.C, "C"), L: pt(args.L, "L") };
        const c = core().compute(s);
        if (!c) throw new Error("B and C must be different points");
        const cl = core().claim(c);
        return { K: c.K, N: c.N, D: c.D, E: c.E, F: c.F, ratioDEtoCN: cl.ratio, parallel: cl.parallel, trianglesOutward: core().outward(s) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = { A: pt(state.A, "A"), B: pt(state.B, "B"), C: pt(state.C, "C"), L: pt(state.L, "L") };
  const c = core().compute(s);
  if (!c) return { note: "B and C coincide, so there is nothing to construct." };
  const cl = core().claim(c);
  return {
    ratioDEtoCN: cl.ratio, parallel: cl.parallel, trianglesOutward: core().outward(s),
    note: "With one spiral similarity z for all three triangles, D - E = (N - C)/2 for any triangle and any z, outward or inward.",
  };
}
