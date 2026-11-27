/*
 * run_game_logic actions and saved-position reader for The Cleaver.
 *
 * The real core is cleaver/cleaver-core.js, copied into src/generated/cores/
 * at build time. It follows CleaverCanvas.Compute: L is the foot of the
 * bisector from C, M the midpoint of AB, D the point where the line through
 * M parallel to CL meets the longer of AC and BC (S is the end of AB on that
 * side, T the other), and F the point on SC past C with CF = CT. The page's
 * claim is that M and D halve the perimeter; the proof runs through CL ∥ TF
 * and D the midpoint of SF, and the three cleavers meet at the Spieker
 * centre. Every number below is measured by the core. See _shared.ts.
 *
 * Coordinates are the applet's 600 x 450 board units, with y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cleaver"].CleaverCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };
type Computed = {
  L: Point; M: Point; D: Point; F: Point;
  S: "A" | "B"; T: "A" | "B";
  degenerate: boolean;
};
type Claims = {
  bisector?: boolean; dOnLongerSide?: boolean; cfEqualsCT?: boolean; clParallelTF?: boolean;
  dMidpointOfSF?: boolean; halvesEqual?: boolean; cleaversMeetAtSpieker?: boolean;
  all: boolean; degenerate?: boolean;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const finite = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  if (Array.isArray(raw)) {
    const x = Number(raw[0]), y = Number(raw[1]);
    if (raw.length !== 2 || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
    }
    return { x, y };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  return { x: num(raw as Json, "x"), y: num(raw as Json, "y") };
}

/** Omit a corner to use the applet's opening triangle. */
function readTriangle(C: Core, args: Json): Triangle {
  const seed = C.start({}) as Triangle;
  return { A: readPoint(args, "A", seed.A), B: readPoint(args, "B", seed.B), C: readPoint(args, "C", seed.C) };
}

function reading(C: Core, s: Triangle) {
  const m = C.compute(s) as unknown as Computed;
  if (m.degenerate) {
    return { degenerate: true, note: "A, B and C are collinear or too close together, so there is no triangle to cleave." };
  }
  const h = C.halves(s) as { one: number; two: number; perimeter: number };
  const cl = C.claims(s) as unknown as Claims;
  const S = m.S, T = m.T;
  return {
    degenerate: false,
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: {
      AB: finite(C.distance(s.A, s.B)), BC: finite(C.distance(s.B, s.C)), CA: finite(C.distance(s.C, s.A)),
    },
    longerSide: `${S}C`,
    bisectorFoot_L: pt(m.L),
    midpoint_M: pt(m.M),
    cleaverEnd_D: pt(m.D),
    extension_F: pt(m.F),
    spiekerCentre: pt(C.spieker(s) as Point),
    halves: {
      [`${S}M + ${S}D`]: finite(h.one),
      [`${T}M + ${T}C + CD`]: finite(h.two),
      halfPerimeter: finite(h.perimeter / 2),
    },
    checks: {
      clBisectsAngleC: cl.bisector === true,
      dOnLongerSide: cl.dOnLongerSide === true,
      cfEqualsCT: cl.cfEqualsCT === true,
      clParallelToTF: cl.clParallelTF === true,
      dIsMidpointOfSF: cl.dMidpointOfSF === true,
      perimeterHalved: cl.halvesEqual === true,
      threeCleaversMeetAtSpieker: cl.cleaversMeetAtSpieker === true,
      allHold: cl.all === true,
    },
    note: `Extend ${S}C past C to F with CF = C${T}. Triangle ${T}CF is isosceles, so CL (perpendicular to its bisector at C) is parallel to ${T}F; MD is parallel too, so D is the midpoint of ${S}F and ${S}M + ${S}D = ${T}M + ${T}C + CD.`,
  };
}

export function actions(): GameActions {
  const args = '{ "A": [200, 338], "B": [400, 338], "C": [360, 224] }';
  return {
    cleave: {
      describe:
        "For triangle A, B, C (each [x, y] or {x, y} on the applet's 600 x 450 board, y down), report the bisector foot L, the midpoint M of AB, the cleaver's end D on the longer of AC and BC, the point F with CF equal to the shorter side, the Spieker centre, the two halves of the perimeter, and checks of each step of the page's proof plus the three cleavers meeting at the Spieker centre. Omit a corner to use the opening triangle.",
      args,
      run: (a) => {
        const C = core();
        return reading(C, readTriangle(C, a));
      },
    },
  };
}

/** Track.state saves the three corners; the core rebuilds the rest. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported The Cleaver state version ${stateVersion}`);
  }
  const C = core();
  const s = readTriangle(C, state);
  const result: (state: Json) => unknown = C.result;
  return {
    stateVersion,
    result: result(state),
    reading: reading(C, s),
    note: "Track.state saved the three corners. The core rebuilds L, M, D and F from them and measures both halves of the perimeter.",
  };
}
