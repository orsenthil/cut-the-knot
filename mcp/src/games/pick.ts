/*
 * run_game_logic actions and saved-position reader for Pick's Theorem. The core lives in
 * pick/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["pick"].PickCore;

function polygon(args: Json): { x: number; y: number }[] {
  const raw = args.poly;
  if (!Array.isArray(raw)) throw new Error('"poly" must be a list of {x, y} nodes');
  return raw.map((p, i) => {
    const q = p as Json;
    const x = Number(q.x), y = Number(q.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`poly[${i}] needs whole-number x and y`);
    return { x, y };
  });
}

export function actions(): GameActions {
  return {
    measure: {
      describe: "For a lattice polygon (corners in order, each a {x, y} node on the board 0..13 by 0..9): B (nodes on the border), I (nodes inside) and the area by Pick's formula I + B/2 - 1, or null when the sides cross.",
      args: '{ "poly": [{ "x": 1, "y": 1 }, { "x": 4, "y": 1 }, { "x": 4, "y": 4 }, { "x": 1, "y": 4 }] }',
      run: (args) => {
        const poly = polygon(args);
        const m = core().measure(poly);
        if (!m) return { simple: false, note: "Fewer than three corners, or sides that cross, touch or fold back." };
        return { simple: true, B: m.B, I: m.I, area: core().areaText(m.twiceArea), formula: `${m.I} + ${m.B}/2 - 1`, shoelaceArea: m.shoelace2 / 2 };
      },
    },
  };
}

export function position(state: Json): unknown {
  const poly = ((state.poly as Json[]) || []).map((p) => ({ x: Number(p.x), y: Number(p.y) }));
  const m = core().measure(poly);
  return { corners: poly.length, mode: state.mode, ...(m ? { simple: true, B: m.B, I: m.I, area: core().areaText(m.twiceArea) } : { simple: false }), note: "Pick's formula: area = I + B/2 - 1, where B counts the nodes on the boundary and I those inside." };
}
