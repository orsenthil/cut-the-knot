/*
 * run_game_logic actions and saved-position reader for Rouse Ball's fallacy.
 * The core lives in rouse-ball-fallacy/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["rouse-ball-fallacy"].RouseBallFallacyCore;
type Point = { x: number; y: number };
function point(v: unknown, label: string): Point {
  const p = v as Json;
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) throw new Error(`${label} needs x and y`);
  return { x: Number(p.x), y: Number(p.y) };
}
function readState(args: Json) {
  const s = core().start();
  return {
    A: args.A ? point(args.A, "A") : s.A,
    D: args.D ? point(args.D, "D") : s.D,
    C: args.C ? point(args.C, "C") : s.C,
    E: args.E ? point(args.E, "E") : s.E,
    shorten: typeof args.shorten === "number" ? args.shorten as number : 0.96,
  };
}

export function actions(): GameActions {
  return {
    check_figure: {
      describe: "Compute the perpendicular-bisector point O and check the congruences and angles in the fallacy.",
      args: '{}',
      run: (args) => {
        const g = core().geometry(readState(args));
        return {
          O: g.O,
          congruent: { CO_EO: Math.abs(g.co - g.eo) < 1e-6, DO_AO: Math.abs(g.do_ - g.ao) < 1e-6, DC_AE: Math.abs(g.dc - g.ae) < 0.5 },
          angleADC: g.angleADC,
          angleDAE: g.angleDAE,
          proofAngles: g.proofAngles,
          note: "The congruences hold, but the angle subtraction in the proof is invalid.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const g = core().geometry(readState(state));
  return { O: g.O, angleADC: g.angleADC, angleDAE: g.angleDAE, congruent: Math.abs(g.co - g.eo) < 1e-6 && Math.abs(g.do_ - g.ao) < 1e-6, note: `The obtuse angle stays ${g.angleDAE.toFixed(1)} degrees.` };
}
