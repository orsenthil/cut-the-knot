/*
 * run_game_logic actions and saved-position reader for Broken Chord Mr Homm.
 *
 * The illustration is Archimedes' broken chord theorem, drawn as in Mr
 * Homm's applet. A, B and C are corners of a triangle on its circumcircle; P
 * is the midpoint of the arc through C, and M is the foot of the perpendicular
 * from P onto the longer of AC and BC. The broken line A-C-B is then cut in
 * half at M: with AC longer, AM = MC + BC; with BC longer, BM = MC + AC.
 * The core (copied into src/generated/cores/ at build time) also builds the
 * hint's Q and F, as in the applet's Compute, FindP, FindQ and FindF.
 *
 * This module reports those lengths from the real core, runs both long-side
 * branches by exchanging A and B, and shows the applet's intersection quirk:
 * its GeoSDoub.Intersect refuses horizontal and vertical construction lines,
 * so P (or Q) is missing and nothing is drawn. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["broken-chord-mr-homm"].BrokenChordMrHommCore;

type Point = { x: number; y: number };
type Geometry = {
  circle: { c: Point; r: number };
  A: Point; B: Point; C: Point; P: Point; M: Point;
  K: Point; L: Point; Q: Point; F: Point | null;
  longSide: string;
  lengths: { AM: number; BM: number; MC: number; AC: number; BC: number; AB: number };
};

const r6 = (v: number): number => Number(v.toFixed(6));
const pt = (p: Point) => ({ x: r6(p.x), y: r6(p.y) });

/** Tool arguments may be [x, y] or {x, y}; Track.state saves {x, y}. */
function readPoint(value: unknown, name: string): Point {
  const bad = `"${name}" must be a point [x, y] or {x, y} with finite numbers`;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(bad);
    const x = Number(value[0]), y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(bad);
    return { x, y };
  }
  if (value && typeof value === "object") {
    const o = value as Json;
    const x = Number(o.x), y = Number(o.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(bad);
    return { x, y };
  }
  throw new Error(bad);
}

/** All three corners are required; a base shorter than 1 draws nothing. */
function readTriangle(source: Json) {
  const A = readPoint(source.A, "A");
  const B = readPoint(source.B, "B");
  const C = readPoint(source.C, "C");
  if (Math.hypot(B.x - A.x, B.y - A.y) < 1) {
    throw new Error("A and B must be at least 1 board unit apart: the applet draws nothing for a collapsed base");
  }
  return { A, B, C };
}

/** Why the core could not draw this triangle, using its own helpers. */
function whyNoDrawing(A: Point, B: Point, C: Point): string {
  const K = core();
  const circle = K.circumcircle(A, B, C);
  if (!circle) return "A, B and C are nearly collinear, so there is no circumcircle to draw";
  const p = K.arcMidpoint(A, B, C, circle) as Point | null;
  if (!p) {
    return "the perpendicular bisector of AB is horizontal, vertical or too short, so GeoSDoub.Intersect cannot place P";
  }
  const k = K.dist(A, C) > K.dist(B, C) ? A : B;
  const m = K.foot(p, k, C);
  if (!K.farOnCircle(p, m, circle)) {
    return "PM is horizontal, vertical or too short, so GeoSDoub.Intersect cannot place Q: the applet hides the drawing";
  }
  return "the core declined to draw this triangle";
}

/** One long-side branch of the theorem, measured by the core. */
function reading(g: Geometry) {
  const len = g.lengths;
  const acLong = g.longSide === "AC";
  const half = acLong ? len.AM : len.BM;
  const sum = len.MC + (acLong ? len.BC : len.AC);
  return {
    circle: { centre: pt(g.circle.c), radius: r6(g.circle.r) },
    points: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C),
      P: pt(g.P), M: pt(g.M), K: pt(g.K), L: pt(g.L),
      Q: pt(g.Q), F: g.F ? pt(g.F) : null,
    },
    longSide: g.longSide,
    lengths: {
      AM: r6(len.AM), BM: r6(len.BM), MC: r6(len.MC),
      AC: r6(len.AC), BC: r6(len.BC), AB: r6(len.AB),
    },
    halves: {
      statement: acLong ? "AM = MC + BC" : "BM = MC + AC",
      firstHalf: r6(half),
      otherHalf: r6(sum),
      residual: r6(half - sum),
      holds: Math.abs(half - sum) < 1e-6,
    },
  };
}

/** The applet's Intersect quirk, phrased for the tutor. */
const QUIRK =
  "GeoSDoub.IntersectX is used when |dx| > 1 and IntersectY when |dy| > 1; " +
  "it gives up when both are at most 1, and the chosen branch divides by a " +
  "zero difference when the line is exactly horizontal or vertical. The port's " +
  "canIntersectCircle keeps this: AB may not be horizontal or vertical for P " +
  "to be found, and PM may not be horizontal or vertical for Q to be found. " +
  "When either fails, compute() returns null and the page draws nothing; the " +
  "theorem itself is unaffected.";

export function actions(): GameActions {
  return {
    broken_chord: {
      describe:
        "For a triangle with corners A, B, C on the page's 400 by 300 board (y downward; each point [x, y] or {x, y}), run the applet's construction. Reports the circumcircle, P the midpoint of the arc through C, M the perpendicular foot on the longer of AC and BC, Q and F from the Hint, all six lengths, and the equality AM = MC + BC or BM = MC + AC with its residual. It also runs the same circle with A and B exchanged, which puts M on the other chord and gives the other branch of the theorem; P and M are the same in both. Notes the applet's horizontal/vertical intersection quirk.",
      args: '{ "A": [115, 150], "B": [288.2059920057118, 132.11976022844448], "C": [256.114082167286, 79.63516657787731] }',
      run: (args) => {
        const K = core();
        const { A, B, C } = readTriangle(args);
        const g = K.compute(A, B, C) as Geometry | null;
        const swapped = K.compute(B, A, C) as Geometry | null;
        const branch = g ? reading(g) : null;
        const other = swapped ? reading(swapped) : null;
        const sameP = g && swapped ? K.dist(g.P, swapped.P) : null;
        const sameM = g && swapped ? K.dist(g.M, swapped.M) : null;
        return {
          triangle: { A: pt(A), B: pt(B), C: pt(C) },
          valid: !!g,
          branch,
          swappedBranch: other,
          sameArcMidpoint: sameP === null ? null : sameP < 1e-9,
          sameFoot: sameM === null ? null : sameM < 1e-9,
          reason: g ? null : whyNoDrawing(A, B, C),
          intersectionQuirk: QUIRK,
          note: g && swapped && branch && other
            ? `P is the midpoint of the arc through C; M is its foot on the longer side ${g.longSide}. `
              + `With the names exchanged the longer side is ${swapped.longSide}, so the same point M cuts the broken line the other way: `
              + `${branch.halves.statement} and ${other.halves.statement} both hold. `
              + "Q and F are the Hint's proof points; F changes with the branch, P and M do not."
            : "This triangle cannot be drawn by the applet; move the corners off the horizontal or vertical.",
        };
      },
    },
    intersection_quirk: {
      describe:
        "Probe the applet's circle-intersection quirk with the real core. By default tests a horizontal base AB, a vertical base AB, a triangle whose PM is vertical, and a valid sloping control, reporting for each whether compute() draws anything and why. An optional 'cases' array of named triangles ({ name, A, B, C }, points [x, y] or {x, y}) replaces the defaults.",
      args: '{}',
      run: (args) => {
        const K = core();
        const raw = args.cases;
        let tests: { name: string; A: Point; B: Point; C: Point }[];
        if (raw === undefined || raw === null) {
          tests = [
            { name: "horizontal base AB", A: { x: 120, y: 150 }, B: { x: 260, y: 150 }, C: { x: 200, y: 60 } },
            { name: "vertical base AB", A: { x: 200, y: 80 }, B: { x: 200, y: 220 }, C: { x: 280, y: 150 } },
            { name: "vertical PM, C level with A", A: { x: 115, y: 150 }, B: { x: 288.2059920057118, y: 132.11976022844448 }, C: { x: 240, y: 150 } },
            { name: "sloping control", A: { x: 115, y: 150 }, B: { x: 288.2059920057118, y: 132.11976022844448 }, C: { x: 256.114082167286, y: 79.63516657787731 } },
          ];
        } else {
          if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) {
            throw new Error('"cases" must be an array of 1 to 20 named triangles');
          }
          tests = raw.map((item, i) => {
            if (!item || typeof item !== "object") throw new Error(`cases[${i}] must be an object`);
            const o = item as Json;
            const tri = readTriangle(o);
            return { name: String(o.name ?? `case ${i + 1}`), ...tri };
          });
        }
        const probes = tests.map((t) => {
          const g = K.compute(t.A, t.B, t.C) as Geometry | null;
          return {
            name: t.name,
            A: pt(t.A), B: pt(t.B), C: pt(t.C),
            drawn: !!g,
            P: g ? pt(g.P) : null,
            M: g ? pt(g.M) : null,
            Q: g ? pt(g.Q) : null,
            reason: g ? null : whyNoDrawing(t.A, t.B, t.C),
          };
        });
        return {
          probes,
          drawnCount: probes.filter((p) => p.drawn).length,
          explanation: QUIRK,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus the core's reading of that triangle. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported BrokenChordMrHomm state version ${stateVersion}`);
  }
  const K = core();
  const { A, B, C } = readTriangle(state);
  const g = K.compute(A, B, C) as Geometry | null;
  const saved = (key: string): Point | null =>
    state[key] === undefined || state[key] === null ? null : pt(readPoint(state[key], key));
  const options = state.options && typeof state.options === "object" ? state.options as Json : {};
  const savedLengths = state.lengths && typeof state.lengths === "object" ? state.lengths as Json : {};
  const length = (key: string): number | null =>
    savedLengths[key] === undefined ? null : r6(Number(savedLengths[key]));
  const savedCircle = state.circle && typeof state.circle === "object" ? state.circle as Json : null;
  const branch = g ? reading(g) : null;
  const agrees = g
    ? ["P", "M", "K", "L", "Q"].every((key) => {
        const p = saved(key);
        return p && K.dist(p, g[key as "P" | "M" | "K" | "L" | "Q"]) < 1e-6;
      }) && (!g.F || !saved("F") || K.dist(saved("F") as Point, g.F) < 1e-6)
    : null;
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged apart from rounding.
    A: pt(A), B: pt(B), C: pt(C),
    saved: {
      P: saved("P"), M: saved("M"), K: saved("K"), L: saved("L"),
      Q: saved("Q"), F: saved("F"),
      circle: savedCircle && savedCircle.c !== undefined
        ? { centre: pt(readPoint(savedCircle.c, "circle.c")), radius: r6(Number(savedCircle.r)) }
        : null,
      lengths: {
        AM: length("AM"), BM: length("BM"), MC: length("MC"),
        AC: length("AC"), BC: length("BC"), AB: length("AB"),
      },
    },
    options: { names: options.names === true, hint: options.hint === true },
    // What the core adds.
    valid: !!g,
    branch,
    savedMatchesCore: agrees,
    reason: g ? null : whyNoDrawing(A, B, C),
    note: branch
      ? `The saved corners give ${branch.longSide} as the longer side. P = ${JSON.stringify(branch.points.P)} and M = ${JSON.stringify(branch.points.M)}; ${branch.halves.statement} (${branch.halves.firstHalf} = ${branch.halves.otherHalf}, residual ${branch.halves.residual}). This is an illustration: exploring it is recorded as done, with no win or loss.`
      : "The saved triangle cannot be drawn by the applet, so no P, M or lengths are shown.",
  };
}
