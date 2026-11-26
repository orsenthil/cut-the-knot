/*
 * run_game_logic actions and saved-position reader for Angle Bisector Ratio 2.
 *
 * The real core is angle-bisector-ratio-2/angle-bisector-ratio-2-core.js,
 * copied into src/generated/cores/ at build time. It reproduces Bogomolny's
 * second angle-bisector illustration: the bisector from A meets BC at D with
 * DB/DC = AB/AC, and McWorter's point E on line AD makes triangles ACD and ABE
 * similar (AB/AC = BE/DC); an isosceles BDE then gives BE = BD. Applying the
 * ratio at all three corners gives Ceva's product 1. See _shared.ts for the
 * module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle-bisector-ratio-2"].AngleBisectorRatio2Core;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;
const degrees = (radians: number | null | undefined): number | null =>
  radians === null || radians === undefined ? null : round((radians * 180) / Math.PI);

/** Accept the page's saved {x, y} as well as [x, y] argument arrays. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

/** Missing corners fall back to the applet's starting triangle. */
function readTriangle(C: Core, args: Json): Triangle {
  const fresh = C.start();
  return {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
  };
}

/** Everything the illustration draws and claims, in tutor-friendly units. */
function reading(C: Core, s: Triangle) {
  const m = C.measurements(s);
  const external = C.externalFoot(s);
  const externalDistance = external ? C.distance(external, s.C) : 0;
  return {
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: { AB: maybe(m.sides.AB), AC: maybe(m.sides.AC), BC: maybe(m.sides.BC) },
    degenerate: m.degenerate === true,
    doubleArea: maybe(m.doubleArea),
    D: pt(m.D),
    E: pt(m.E),
    ratios: {
      AB_over_AC: maybe(m.ratios.AB_AC),
      DB_over_DC: maybe(m.ratios.DB_DC),
      BE_over_DC: maybe(m.ratios.BE_DC),
      BE_over_BD: maybe(m.ratios.BE_BD),
      BD_over_BE: m.ratios.BE_BD ? maybe(1 / m.ratios.BE_BD) : null,
    },
    anglesDegrees: {
      ACB: degrees(m.angles.ACB),
      ABE: degrees(m.angles.ABE),
      BAD: degrees(m.angles.BAD),
      DAC: degrees(m.angles.DAC),
      halvedDifference:
        m.angles.BAD === null || m.angles.DAC === null
          ? null
          : degrees(Math.abs(m.angles.BAD - m.angles.DAC)),
    },
    externalFoot: pt(external),
    externalRatio: external && externalDistance > 0
      ? maybe(C.distance(s.B, external) / externalDistance)
      : null,
    cevaProduct: maybe(C.ceva(s)),
    note:
      "D divides BC so that DB/DC = AB/AC, the page's claim. McWorter's E on line AD gives similar triangles ACD and ABE, hence AB/AC = BE/DC; triangle BDE is isosceles, so BE = BD and the claim follows. The external foot divides BC in the same ratio externally (parallel to BC, hence no foot, when AB = AC). Multiplying the ratio at all three corners cancels every side length to give Ceva's product 1, so the three bisectors meet at one point.",
  };
}

/** The page's claims, checked numerically for one triangle. */
function claimCheck(C: Core, s: Triangle) {
  const claims = C.claims(s);
  const names = [
    "anglesHalved", "footOnBC", "EOnAD", "pageRatio", "similarity",
    "isosceles", "equalAngles", "ceva", "externalRatio",
  ] as const;
  const failed = names.filter((k) => claims[k] !== true);
  const booleans = {} as Record<(typeof names)[number], boolean>;
  for (const k of names) booleans[k] = claims[k] === true;
  return {
    ...booleans,
    allHold: failed.length === 0,
    failed,
    note: failed.length
      ? "These claims fail on a degenerate triangle (corners in a line or two corners together), or when AB = AC makes the external bisector parallel to BC and the circle tangent to AD; move a corner to make a proper scalene triangle."
      : "All the page's claims hold: AD halves the angle, the ratios agree, McWorter's similar and isosceles triangles close the proof, and Ceva's product is 1.",
  };
}

export function actions(): GameActions {
  return {
    bisector_and_proof: {
      describe:
        "For a triangle with corners A, B, C in the page's 600 x 550 board coordinates (y downward; each given as [x, y] or {x, y}), report the bisector foot D on BC, McWorter's point E on line AD, the three side lengths, the page's ratio AB/AC = DB/DC, the similarity ratio BE/DC, the isosceles equality BE = BD, the angles ACB, ABE, BAD and DAC in degrees, the external-bisector foot and ratio, and the Ceva product of all three bisector ratios. Missing corners default to the starting triangle; a degenerate triangle reports nulls.",
      args: '{ "A": [253, 430], "B": [550, 430], "C": [345, 115.05] }',
      run: (args) => {
        const C = core();
        return reading(C, readTriangle(C, args));
      },
    },
    check_claims: {
      describe:
        "Check every claim in the illustration's page and McWorter's proof for a triangle A, B, C: AD halves angle A, D lies on BC, E lies on AD, AB/AC = DB/DC, AB/AC = BE/DC from similar triangles ACD and ABE, BE = BD, angle ACB = angle ABE, the Ceva product is 1, and the external bisector ratio. Returns a boolean for each claim, allHold, and the names of any that fail.",
      args: '{ "A": [253, 430], "B": [550, 430], "C": [345, 115.05] }',
      run: (args) => {
        const C = core();
        return claimCheck(C, readTriangle(C, args));
      },
    },
  };
}

/** The page saves only the three dragged corners; read the geometry from them. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readTriangle(C, state);
  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    reading: {
      ...reading(C, s),
      claims: claimCheck(C, s),
    },
  };
}
