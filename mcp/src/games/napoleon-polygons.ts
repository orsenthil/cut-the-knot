/*
 * run_game_logic actions and saved-position reader for Napoleon's Theorem and the Petr-Douglas-Neumann Theorem.
 * The core lives in napoleon-polygons/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["napoleon-polygons"].NapoleonCore;

export function actions(): GameActions {
  return {
    last_polygon: {
      describe: "Apply the steps k = 1..n-1 except m to an n-gon (given as points [x, y]) and return the last polygon: a regular n-gon (a star unless m is 1 or n-1), however irregular the start. With m = 0 it shrinks to the centroid.",
      args: '{ "m": 1, "points": [[0, 0], [100, 10], [120, 90], [60, 130], [-10, 70]] }',
      run: (args) => {
        const pts = args.points;
        if (!Array.isArray(pts) || pts.length < 3 || pts.length > 15) throw new Error('"points" must be 3..15 pairs [x, y]');
        const points = pts.map((p) => ({ x: Number((p as number[])[0]), y: Number((p as number[])[1]) }));
        const n = points.length, m = core().clampM(num(args, "m", 1), n);
        const chain = core().polygons({ n, m, points, showTriangles: false });
        const last = chain[chain.length - 1], f = m === 0 ? 0 : n - m, g = core().regularity(last, f);
        return { n, excluded: m, steps: core().stepsFor(n, m), lastPolygon: last.map((p: { x: number; y: number }) => [p.x, p.y]), centroid: core().centroid(points), deviationFromRegular: g.dev };
      },
    },
  };
}

export function position(state: Json): unknown {
  const pts = state.points as { x: number; y: number }[], n = Number(state.n), m = core().clampM(state.m, n);
  const chain = core().polygons({ n, m, points: pts, showTriangles: false });
  const last = chain[chain.length - 1], f = m === 0 ? 0 : n - m;
  return { n, excluded: m, steps: core().stepsFor(n, m), lastPolygonIsRegular: m !== 0 && core().regularity(last, f).dev < 1e-6, note: "Whatever the first polygon, the last is regular (a star unless m is 1 or n-1): the Petr-Douglas-Neumann theorem. For n = 3 it is Napoleon's theorem." };
}
