/*
 * run_game_logic actions and saved-position reader for Area Of Triangle.
 * The core lives in area-of-triangle/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 *
 * The geometry is the applet's: drop the altitude from C to the foot H on the
 * line AB. AH and HB are signed lengths along the base, so AH + HB = AB even
 * when H lies outside the segment; multiplying by the same altitude gives
 * Area(ABQP) = Area(AHCP) + Area(HBQC) with one rectangle counted negatively.
 * Halving the enclosing rectangle, or half-turning the triangle about a side
 * to make a parallelogram, both give Area(ABC) = base * height / 2.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["area-of-triangle"].AreaOfTriangleCore;
type Point = { x: number; y: number };
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pt = (p: Point) => ({ x: r3(p.x), y: r3(p.y) });

/** Accept [x, y] or {x, y}, matching the way other geometry readers take points. */
function readPoint(args: Json, key: string): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`"${key}" must have exactly two numbers, [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`"${key}" must be [x, y] or {x, y}`);
}

function readCorners(args: Json): { A: Point; B: Point; C: Point } {
  return { A: readPoint(args, "A"), B: readPoint(args, "B"), C: readPoint(args, "C") };
}

/** The core's signed-rectangle calculation for one triangle. */
function rectangleReading(A: Point, B: Point, Cc: Point) {
  const C = core();
  const g = C.compute({ A, B, C: Cc, width: C.WIDTH, height: C.HEIGHT, showTriangle: false, showNames: false, showColors: false });
  const cl = C.claims(g);
  const location = g.degenerate
    ? "no altitude: the three corners are in a line or coincide"
    : g.insideBase ? "H lies on segment AB"
    : g.t < 0 ? "H lies beyond A, so AHCP has a negative sign"
    : "H lies beyond B, so HBQC has a negative sign";
  return {
    A: pt(A), B: pt(B), C: pt(Cc), H: pt(g.H), P: pt(g.P), Q: pt(g.Q),
    footParameterT: r3(g.t),
    footLocation: location,
    signedRectangles: {
      ABQP: r3(g.rect.ABQP), AHCP: r3(g.rect.AHCP), HBQC: r3(g.rect.HBQC),
      AHCPplusHBQC: r3(g.rect.AHCP + g.rect.HBQC),
    },
    shoelaceAreas: { ABQP: r3(g.shoelace.ABQP), AHCP: r3(g.shoelace.AHCP), HBQC: r3(g.shoelace.HBQC) },
    identity: `Area(ABQP) = Area(AHCP) + Area(HBQC): ${r3(g.rect.ABQP)} = ${r3(g.rect.AHCP)} + ${r3(g.rect.HBQC)}`,
    holds: cl,
    base: r3(g.base), altitude: r3(g.height),
    enclosingRectangleArea: r3(g.rectangleArea),
    triangleArea: r3(g.triangleArea),
    halfOfBaseTimesHeight: `${r3(g.base)} * ${r3(g.height)} / 2 = ${r3(g.base * g.height / 2)}`,
    degenerate: g.degenerate,
    note: "AH and HB are signed distances along AB, so their sum is AB and multiplying by the common altitude CH preserves the sum. When H falls outside AB one rectangle is counted with a minus sign; the triangle is still half of the rectangle on base AB.",
  };
}

/** The core's half-turn construction for one side. */
function doublingReading(A: Point, B: Point, Cc: Point, side: string) {
  if (side !== "AB" && side !== "BC" && side !== "CA") {
    throw new Error(`unknown side "${side}": use AB, BC or CA`);
  }
  const C = core();
  const d = C.doubling(A, B, Cc, side);
  if (!d) throw new Error(`could not half-turn triangle about side ${side}`);
  const triangleArea = C.compute({ A, B, C: Cc, width: C.WIDTH, height: C.HEIGHT, showTriangle: false, showNames: false, showColors: false }).triangleArea;
  return {
    side,
    sideEnds: [pt(d.U), pt(d.V)],
    oppositeCorner: pt(d.opposite),
    halfTurnImage: pt(d.copy),
    parallelogramCorners: [pt(d.U), pt(d.opposite), pt(d.V), pt(d.copy)],
    base: r3(d.base), altitude: r3(d.altitude),
    parallelogramArea: r3(d.area),
    triangleArea: r3(triangleArea),
    areaIdentity: `${r3(d.area)} = ${r3(d.base)} * ${r3(d.altitude)} = 2 * ${r3(triangleArea)}`,
    note: `A half-turn about the midpoint of side ${side} sends the opposite corner to a copy; the old and new triangles form a parallelogram with the same base and altitude, so the triangle takes half its area.`,
  };
}

export function actions(): GameActions {
  return {
    rectangle_identity: {
      describe:
        "For three corners A, B, C (each [x, y] or {x, y} in the page's 400 x 300 board, y down), drop the altitude from C to the foot H on line AB and report the core's signed-rectangle identity Area(ABQP) = Area(AHCP) + Area(HBQC): signed areas, shoelace check, where H falls (on the base or beyond an end, where one rectangle is negative), and the resulting triangle area base * height / 2.",
      args: '{ "A": [104, 250], "B": [300, 250], "C": [250, 50] }',
      run: (args) => {
        const { A, B, C: Cc } = readCorners(args);
        return rectangleReading(A, B, Cc);
      },
    },
    half_turn_doubling: {
      describe:
        "Half-turn triangle ABC about the midpoint of side AB, BC or CA (default AB) to make a parallelogram from the triangle and its copy. Give A, B, C as [x, y] or {x, y}; report the copy's corner, the parallelogram's base, altitude and area, and the check that it is base * altitude = 2 * Area(ABC).",
      args: '{ "A": [104, 250], "B": [300, 250], "C": [250, 50], "side": "AB" }',
      run: (args) => {
        const { A, B, C: Cc } = readCorners(args);
        const side = args.side === undefined || args.side === null ? "AB" : String(args.side);
        return doublingReading(A, B, Cc, side);
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of that same position. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Area Of Triangle state version ${stateVersion}`);
  const { A, B, C: Cc } = readCorners(state);
  const width = num(state, "width", core().WIDTH);
  const height = num(state, "height", core().HEIGHT);
  const saved = {
    A: pt(A), B: pt(B), C: pt(Cc),
    width, height,
    showTriangle: !!state.showTriangle,
    showNames: !!state.showNames,
    showColors: !!state.showColors,
  };
  return {
    stateVersion,
    ...saved,
    reading: rectangleReading(A, B, Cc),
    halfTurn: doublingReading(A, B, Cc, "AB"),
  };
}
