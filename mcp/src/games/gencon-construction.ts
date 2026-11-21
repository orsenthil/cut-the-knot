/*
 * run_game_logic actions and saved-position reader for General Polygon
 * Construction. The core lives in gencon-construction/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["gencon-construction"].GenConConstructionCore;

type Point = { x: number; y: number };
function readPoint(v: unknown, label: string): Point {
  const p = v as Json;
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) throw new Error(`${label} needs x and y`);
  return { x: Number(p.x), y: Number(p.y) };
}
function readInput(args: Json) {
  const rawPoints = args.points;
  if (!Array.isArray(rawPoints) || rawPoints.length < 3) throw new Error("points must be an array of at least 3");
  const points = rawPoints.map((p, i) => readPoint(p, `point ${i}`));
  const rawAngles = Array.isArray(args.angles) ? args.angles : [90, 90, 90];
  const angles = rawAngles.map((a) => num({ a }, "a"));
  if (angles.length !== points.length) throw new Error("angles must match points");
  return { points, angles };
}

export function actions(): GameActions {
  return {
    construct: {
      describe: "Reconstruct the polygon from centres and turning angles, reporting its vertices and whether the construction works.",
      args: '{ "points": [{"x":100,"y":300},{"x":320,"y":300},{"x":200,"y":110}], "angles": [90,90,90] }',
      run: (args) => {
        const C = core();
        const { points, angles } = readInput(args);
        const poly = C.polygon(points, angles);
        return {
          totalAngle: C.totalAngle(angles),
          works: poly !== null,
          vertices: poly ? poly.slice(0, -1) : [],
          fixedPoint: C.fixedPoint(points, angles),
          note: poly ? "The composed rotation has a fixed point: the hidden polygon exists." : "The angles add to a multiple of 360 degrees, so there is no unique construction.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const { points, angles } = readInput(state);
  const total = C.totalAngle(angles);
  const fp = C.fixedPoint(points, angles);
  return { points, angles, totalAngle: total, works: fp !== null, note: fp ? "A polygon closes for these centres." : "The construction breaks down." };
}
