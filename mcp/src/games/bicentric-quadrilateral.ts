/*
 * run_game_logic actions and saved-position reader for Bicentric Quadrilateral.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bicentric-quadrilateral"].BicentricQuadrilateralCore;

function readState(args: Json) {
  const C = core();
  const center = args.center && typeof args.center === "object"
    ? { x: num(args.center as Json, "x", 0), y: num(args.center as Json, "y", 0) }
    : undefined;
  return C.start({
    center,
    radius: num(args, "radius", C.DEFAULT_RADIUS),
    angles: Array.isArray(args.angles) && args.angles.length === 4
      ? args.angles.map((a) => Number(a))
      : undefined,
    showNames: args.showNames === true,
  });
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For four points on the circle, report the outer tangential quadrilateral, whether it is also cyclic, whether the feet are cyclic, and whether the incenter, diagonal crossing and circumcenter line up.",
      args: '{ "angles": [0, 1.2, 2.6, 4.4], "radius": 100 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const g = C.geometry(state);
        if (!g.drawable) throw new Error("those points make a degenerate picture");
        return {
          anglesDegrees: state.angles.map((a: number) => Math.round(a * 180 / Math.PI)),
          tangential: g.tangential,
          cyclic: g.cyclic,
          feetInscriptible: g.feetInscriptible,
          feetCyclic: g.feetCyclic,
          orthodiagonal: g.orthodiagonal,
          collinear: g.collinear,
          incircleRadius: g.incircleRadius,
          circumradius: g.circumradius,
          note: C.describe(state),
        };
      },
    },
    make_bicentric: {
      describe:
        "Choose four angles whose opposite sums satisfy a + c - b - d = pi, and show that the diagonals become perpendicular and the outer quadrilateral cyclic.",
      args: '{ "radius": 100 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const moved = C.move(state, { type: "bicentric" });
        const g = C.geometry(moved);
        return {
          anglesDegrees: moved.angles.map((a: number) => Math.round(a * 180 / Math.PI)),
          angleIdentity: (moved.angles[0] + moved.angles[2] - moved.angles[1] - moved.angles[3]) * 180 / Math.PI,
          orthodiagonal: g.orthodiagonal,
          cyclic: g.cyclic,
          collinear: g.collinear,
          note: C.describe(moved),
        };
      },
    },
  };
}

/** What the core says about the picture currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readState(state);
  const g = C.geometry(here);
  return {
    center: here.center,
    radius: here.radius,
    anglesDegrees: here.angles.map((a: number) => Math.round(a * 180 / Math.PI)),
    showNames: here.showNames,
    selected: Number(state.selected) || 0,
    drawable: g.drawable,
    tangential: g.tangential === true,
    feetInscriptible: g.feetInscriptible === true,
    orthodiagonal: g.orthodiagonal === true,
    cyclic: g.cyclic === true,
    collinear: g.collinear === true,
    note: C.describe(here),
  };
}
