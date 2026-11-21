/*
 * run_game_logic actions and saved-position reader for Cartesian Coordinates.
 *
 * A board with an origin and a unit length reads any pixel as the nearest
 * lattice point, as an ordered pair or in the applet's complex form. Every
 * answer below comes from the game's real core (coordinates/ in the site). See
 * _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["coordinates"].CoordinatesCore;

function readState(args: Json) {
  const C = core();
  return C.start({
    ox: num(args, "ox", C.START_ORIGIN.x), oy: num(args, "oy", C.START_ORIGIN.y), unit: num(args, "unit", C.START_UNIT),
    format: args.format === "complex" ? "complex" : "pair",
  });
}

export function actions(): GameActions {
  return {
    read_point: {
      describe:
        "Read a pixel of the 360x360 board: the nearest lattice point, as an ordered pair and in the applet's complex form (a zero real part and a unit coefficient are left out), plus its distance from the origin.",
      args: '{ "px": 230, "py": 100, "ox": 180, "oy": 180, "unit": 40 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const px = num(args, "px"), py = num(args, "py");
        const p = C.modelCoordinates(s, px, py);
        return {
          pixel: { x: px, y: py }, origin: { x: s.ox, y: s.oy }, unit: s.unit,
          lattice: p,
          pair: C.pairText(p),
          complex: C.complexText(p),
          distanceFromOrigin: C.distance(p, { x: 0, y: 0 }),
          pixelOfThatPoint: C.pixelOf(s, p.x, p.y),
          note: "The reading is round((px - ox)/unit), round((oy - py)/unit), halves rounding up as in Java. The complex form is the applet's own string, which has a space before the sign but none after it.",
        };
      },
    },
    distance: {
      describe: "Distance between two lattice points by the page's formula (2), the same as the modulus |z1 - z2| in complex form, and the length in pixels at the given unit.",
      args: '{ "x1": 1, "y1": 2, "x2": -2, "y2": 6, "unit": 40 }',
      run: (args) => {
        const C = core();
        const s = readState(args);
        const p = { x: num(args, "x1"), y: num(args, "y1") }, q = { x: num(args, "x2"), y: num(args, "y2") };
        const d = C.distance(p, q);
        return {
          from: p, to: q,
          distance: d,
          differenceComplex: C.complexText({ x: p.x - q.x, y: p.y - q.y }),
          squaredParts: { dx2: (p.x - q.x) ** 2, dy2: (p.y - q.y) ** 2 },
          pixels: d * s.unit,
        };
      },
    },
  };
}

/** What the core says about the board as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = readState(state);
  const r = C.latticeRange(s);
  return {
    origin: { x: s.ox, y: s.oy },
    unit: s.unit,
    format: s.format,
    grid: state.grid === true,
    trace: state.trace === true,
    latticeRange: r,
    latticePointsOnBoard: (r.xmax - r.xmin + 1) * (r.ymax - r.ymin + 1),
    unitHandle: C.pixelOf(s, 1, 0),
    moves: num(state, "moves", 0),
    explored: state.explored === true,
    note: `The origin is at pixel (${s.ox}, ${s.oy}) and one unit is ${s.unit} pixels, so the board shows x from ${r.xmin} to ${r.xmax} and y from ${r.ymin} to ${r.ymax}.`,
  };
}
