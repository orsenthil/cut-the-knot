/*
 * run_game_logic actions and saved-position reader for Brides' Chair (Vecten).
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["brides-chair"].BridesChairCore;

function point(args: Json, key: string, fallback: { x: number; y: number }) {
  const raw = args[key];
  if (!raw || typeof raw !== "object") return fallback;
  return { x: num(raw as Json, "x", fallback.x), y: num(raw as Json, "y", fallback.y) };
}

function readState(args: Json) {
  const C = core();
  const base = C.start({});
  const A = point(args, "A", base.A);
  const B = point(args, "B", base.B);
  const Cc = point(args, "C", base.C);
  return { ...base, A, B, C: Cc, rotation: num(args, "rotation", base.rotation) };
}

export function actions(): GameActions {
  return {
    flanks: {
      describe:
        "For three corners of a triangle, give the squares on the sides, the three flank triangles, their areas and the rotated flank at a chosen angle.",
      args: '{ "rotation": 90 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const g = C.geometry(state);
        const triangleArea = Math.abs(C.signedArea2(state.A, state.B, state.C)) / 2;
        const flankAreas = Object.fromEntries(
          (["A", "B", "C"] as const).map((key) => [key, Math.abs(C.signedArea2(...(g.flanks[key] as any))) / 2]),
        );
        return {
          rotation: state.rotation,
          triangleArea,
          flankAreas,
          allEqualArea: Object.values(flankAreas).every((a) => Math.abs(a - triangleArea) < 1e-6),
          movedFlank: [g.movedBA, g.movedCA],
          centers: g.centers,
          note: "Each of the three flank triangles has the same area as the original triangle.",
        };
      },
    },
    rotate_flank: {
      describe:
        "Show where the two far corners of the A-flank land when it is rotated about A by a whole number of degrees from 0 to 95.",
      args: '{ "rotation": 45 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const rot = Math.max(C.ROTATION_MIN, Math.min(C.ROTATION_MAX, Math.trunc(num(args, "rotation", 45))));
        const g = C.geometry({ ...state, rotation: rot });
        return {
          rotation: rot,
          movedBA: g.movedBA,
          movedCA: g.movedCA,
          midpoint: g.movedMid,
          note: rot === 90
            ? "At 90 degrees the rotated far corner lands on C."
            : `At ${rot} degrees the flank has turned about A; its far corners are shown.`,
        };
      },
    },
  };
}

/** What the core says about the figure currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readState(state);
  const g = C.geometry(here);
  return {
    rotation: here.rotation,
    A: here.A, B: here.B, C: here.C,
    showNames: here.showNames === true,
    showLines: here.showLines === true,
    fillTriangles: here.fillTriangles === true,
    medians: here.medians === true,
    triangleArea: Math.abs(C.signedArea2(here.A, here.B, here.C)) / 2,
    centers: g.centers,
    note: `The flank is turned ${here.rotation} degrees about A; the squares stand on all three sides.`,
  };
}
