/*
 * run_game_logic actions and saved-position reader for Circle Through Incenter 2.
 *
 * The real core is circle-through-incenter-2/circle-through-incenter-2-core.js,
 * copied into src/generated/cores/ at build time. It is the fifth solution of
 * problem 7 of the 2009 Australian Mathematical Olympiad: I is the incenter of
 * triangle ABC, and the circle through A, I and B cuts AC again at X and BC
 * again at Y. The claim is AX = BY. The chord XY is antiparallel to AB, so the
 * inscribed angles BAX and BYX match; with J, the circle's second crossing of
 * the bisector CI, the arcs XA and YB are equal, hence their chords are equal.
 * This is a different theorem from the sibling "Circle Through Incenter" page
 * (that one only puts the circle's centre on CI). The applet's Other() accepts
 * a cut only at least 1px from the corner, a quirk the port keeps. See
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-through-incenter-2"].CircleThroughIncenter2Core;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };
type Geometry = NonNullable<ReturnType<Core["compute"]>>;

const DEG = 180 / Math.PI;
const TOL = 1e-6; // core calculations are exact to about floating-point noise

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const deg = (radians: number): number => round(radians * DEG);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;

/** Accept the page's saved {x, y} as well as [x, y] argument arrays. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  if (fallback) return fallback;
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/** Missing corners fall back to the diagram's opening triangle. */
function readTriangle(C: Core, args: Json): Triangle {
  const fresh = C.start();
  return {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
  };
}

const properX = (C: Core, s: Triangle, g: Geometry): boolean => C.dist(g.X, s.A) >= 1;
const properY = (C: Core, s: Triangle, g: Geometry): boolean => C.dist(g.Y, s.B) >= 1;

const NOTE =
  "AX = BY is the theorem: XY is antiparallel to AB (it meets AC at the angle AB makes with BC), so the inscribed angles BAX and BYX match, the arcs XA and YB are equal, and equal arcs give equal chords. J is the circle's second crossing of the bisector CI and is used to compare those arcs. The sibling 'Circle Through Incenter' page proves only that the circle's centre lies on CI; that symmetry alone does not give AX = BY. The applet's Other() keeps a cut only if it is at least one pixel from the corner, so at a nearly tangent cut it keeps the corner and the equality appears to fail; the port keeps that behaviour and says so in its status line.";

/** All the core measures for one triangle, in tutor-friendly units. */
function geometryReading(C: Core, s: Triangle, g: Geometry) {
  return {
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    incenter: pt(g.I),
    circle: { center: pt(g.circle.c), radius: round(g.circle.r) },
    cuts: { X: pt(g.X), Y: pt(g.Y), J: pt(g.J) },
    onLine: {
      // parameter(p, a, b): 0 at a, 1 at b, outside [0, 1] on the extension.
      X_on_AC: round(g.tX),
      Y_on_BC: round(g.tY),
      J_on_CI: round(g.tJ),
      meaning:
        "0 at the first named point, 1 at the second; a value outside [0, 1] means the cut falls on the extension of the line.",
    },
    lengths: {
      AX: round(g.ax),
      BY: round(g.by),
      equal: Math.abs(g.ax - g.by) <= TOL,
    },
    antiparallel: {
      angleXY_to_AC_degrees: deg(g.angles.toSide),
      angleAB_to_BC_degrees: deg(g.angles.fromBase),
      equal: Math.abs(g.angles.toSide - g.angles.fromBase) <= TOL,
      meaning:
        "XY meets AC at the angle that AB meets BC, in reversed order; that is what 'antiparallel' means here.",
    },
    inscribedAngles: {
      BAX_degrees: deg(g.angles.atA),
      BYX_degrees: deg(g.angles.atY),
      equal: Math.abs(g.angles.atA - g.angles.atY) <= TOL,
    },
    secondCuts: { X_away_from_A: properX(C, s, g), Y_away_from_B: properY(C, s, g) },
    status: C.describe({
      A: s.A,
      B: s.B,
      C: s.C,
      options: { names: true, statement: true, premises: false, hint: false },
      explored: true,
    }),
    note: NOTE,
  };
}

export function actions(): GameActions {
  return {
    antiparallel: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] in page coordinates, y downward): report the incenter I, the circle through A, I and B, the second cuts X on line AC and Y on line BC, the auxiliary point J on the bisector CI, the lengths AX and BY, the antiparallel chord XY with its reversed angle match, the inscribed angles BAX = BYX, and where X, Y and J fall on their lines. Explain how this differs from the sibling symmetry proof and mention the applet's one-pixel quirk.",
      args: '{ "A": [197.81, 75.03], "B": [150.98, 206.76], "C": [273.50, 135.10] }',
      run: (args) => {
        const C = core();
        const s = readTriangle(C, args);
        const g = C.compute(s.A, s.B, s.C);
        if (!g) {
          return {
            valid: false,
            note: "A, B and C must form a triangle with corners at least 2 units apart and not in a line; drag them apart and try again.",
          };
        }
        return { valid: true, ...geometryReading(C, s, g) };
      },
    },
    check_claims: {
      describe:
        "Test every claim on this illustration's page for a triangle A, B, C: AX = BY; XY antiparallel to AB (the reversed angle match); the inscribed angles BAX = BYX; X is the second cut on AC and Y on BC at least one pixel from the corners; J is a distinct second crossing of the bisector CI. Also flag the red-herring isosceles case AC = BC, where X and Y land on A and B and both lengths are zero. Returns a boolean for each check and their names when any fail.",
      args: '{ "A": [197.81, 75.03], "B": [150.98, 206.76], "C": [273.50, 135.10] }',
      run: (args) => {
        const C = core();
        const s = readTriangle(C, args);
        const g = C.compute(s.A, s.B, s.C);
        if (!g) {
          return {
            valid: false,
            note: "These corners do not make a usable triangle; give three points at least 2 units apart that are not in a line.",
          };
        }
        const goodX = properX(C, s, g);
        const goodY = properY(C, s, g);
        const isosceles = Math.abs(C.dist(s.A, s.C) - C.dist(s.B, s.C)) <= TOL;
        const claims = {
          axEqualsBy: Math.abs(g.ax - g.by) <= TOL,
          antiparallel: Math.abs(g.angles.toSide - g.angles.fromBase) <= TOL,
          // At X = A or Y = B the inscribed angles are not comparable.
          inscribedAngles:
            goodX && goodY ? Math.abs(g.angles.atA - g.angles.atY) <= TOL : null,
          xIsSecondCut: goodX,
          yIsSecondCut: goodY,
          jIsSecondCrossing: C.dist(g.J, g.I) >= 1,
          isoscelesRedHerring: isosceles,
        };
        const named = [
          "axEqualsBy",
          "antiparallel",
          "inscribedAngles",
          "xIsSecondCut",
          "yIsSecondCut",
          "jIsSecondCrossing",
        ] as const;
        const failed = named.filter((k) => claims[k] === false);
        return {
          valid: true,
          ...claims,
          allHold: failed.length === 0,
          failed,
          note: isosceles
            ? "AC = BC is the page's red herring: X and Y coincide with A and B, so AX = BY = 0 and the inscribed-angle comparison degenerates (reported as null)."
            : failed.includes("xIsSecondCut") || failed.includes("yIsSecondCut")
              ? "One cut is under a pixel from its corner: the applet's Other() keeps the corner instead of the second crossing, so the equal lengths appear to fail here."
              : failed.length
                ? "At least one claim fails at this triangle; move the corners apart and try again."
                : "All the page's claims hold at this triangle: AX = BY, XY is antiparallel to AB, and the inscribed angles match.",
        };
      },
    },
  };
}

/** The saved picture, re-measured through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readTriangle(C, state);
  const g = C.compute(s.A, s.B, s.C);

  const savedPoint = (key: string): { x: number; y: number } | null => {
    const v = state[key];
    return v !== null && typeof v === "object" ? pt(readPoint(state, key)) : null;
  };
  const rawCircle = state.circle;
  const savedCircle =
    rawCircle !== null && typeof rawCircle === "object"
      ? (() => {
          const o = rawCircle as Json;
          return {
            center: pt(readPoint(o, "c")),
            radius: num(o, "r"),
          };
        })()
      : null;
  const savedOptions =
    state.options !== null && typeof state.options === "object" ? (state.options as Json) : null;

  const reading = g ? geometryReading(C, s, g) : null;
  const agrees = (saved: { x: number; y: number } | null, live: Point | null): boolean | null =>
    saved && live
      ? Math.hypot(saved.x - live.x, saved.y - live.y) <= 1e-3
      : null;

  return {
    stateVersion,
    saved: {
      A: pt(s.A),
      B: pt(s.B),
      C: pt(s.C),
      I: savedPoint("I"),
      J: savedPoint("J"),
      X: savedPoint("X"),
      Y: savedPoint("Y"),
      circle: savedCircle,
      options: savedOptions,
    },
    reading: g
      ? {
          ...reading,
          savedMatchesCore: {
            I: agrees(savedPoint("I"), g.I),
            X: agrees(savedPoint("X"), g.X),
            Y: agrees(savedPoint("Y"), g.Y),
            J: agrees(savedPoint("J"), g.J),
          },
        }
      : null,
    note: reading
      ? `The saved triangle gives AX = ${reading.lengths.AX} and BY = ${reading.lengths.BY}; ${reading.lengths.equal ? "they are equal" : "they differ, which is the applet's one-pixel corner quirk"}. XY meets AC at ${reading.antiparallel.angleXY_to_AC_degrees}° while AB meets BC at ${reading.antiparallel.angleAB_to_BC_degrees}°, the reversed angle match of an antiparallel chord, and BAX = BYX = ${reading.inscribedAngles.BAX_degrees}°. J is the circle's second crossing of CI, used to compare arcs XA and YB.`
      : "The saved corners do not form a usable triangle; spread A, B and C apart to see the circle and its two cuts.",
  };
}
