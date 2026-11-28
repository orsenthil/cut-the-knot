/*
 * run_game_logic actions and saved-position reader for Many Circles.
 *
 * The geometry lives in many-circles-core.js (copied into src/generated/cores/
 * at build time): it builds the circles through O, finds their crossings and
 * propagates the polygon's corners. Every number returned below is measured
 * with that core, including the closure gap and the side lengths. The page
 * saves Core.position(state) with Track.state; position() reads that payload.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type Pick = (pts: Point[], ref: Point) => Point | null;

const core = () => cores["many-circles"].ManyCirclesCore;

/** Keep plain JSON readable without inventing digits the core did not have. */
const sig = (n: number): number => (Number.isFinite(n) ? Number(n.toPrecision(4)) : n);
const pt = (p: Point): Point => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) });
const pts = (ps: Point[]): Point[] => ps.map(pt);

function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || typeof p !== "object") throw new Error(`${label} must be a point with numeric x and y`);
  return { x: num(p, "x"), y: num(p, "y") };
}

function optionalPoint(args: Json, key: string, fallback: Point): Point {
  return args[key] === undefined ? fallback : readPoint(args[key], key);
}

function readPoints(value: unknown, label: string, n: number): Point[] {
  if (!Array.isArray(value) || value.length !== n) {
    throw new Error(`${label} must be an array of ${n} points`);
  }
  return value.map((p, i) => readPoint(p, `${label}[${i}]`));
}

/** The spinner's range, validated rather than silently clamped. */
function circleCount(args: Json): number {
  const C = core();
  const n = num(args, "n");
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N) {
    throw new Error(`n must be a whole number from ${C.MIN_N} to ${C.MAX_N}`);
  }
  return n;
}

/**
 * The exact arrangement behind the regularity claim: n congruent circles,
 * centres evenly spaced on a circle about O. Unlike the applet's Reset, the
 * centres are not rounded to whole pixels, so all radii are exactly equal.
 * The intersections, lines, corners and distances still come from the core.
 */
function exactCircles(n: number, common: Point) {
  const C = core();
  const radius: number = C.RADIUS;
  const step = (2 * Math.PI) / n;
  const centers: Point[] = [];
  for (let i = 0; i < n; i++) {
    centers.push({
      x: common.x + radius * Math.cos(step * i),
      y: common.y + radius * Math.sin(step * i),
    });
  }
  return { centers, circles: centers.map((c) => ({ c, r: radius })) };
}

/** Walk from one first corner through every crossing, with a given pick rule. */
function walk(circles: Circle[], crossings: Point[], first: Point, pick: Pick) {
  const C = core();
  const n = circles.length;
  const vertices = C.propagate([first], crossings, circles, 0, pick) as unknown as Point[];
  const complete = vertices.length === n &&
    vertices.every((p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y));
  const sides = complete ? (C.sides({ n, vertices }) as number[]) : [];
  const spread = complete && sides.length ? Math.max(...sides) - Math.min(...sides) : null;
  const gap = complete ? (C.dist(vertices[0], first) as number) : null;
  return {
    complete, vertices, sides, spread, gap,
    closes: gap !== null && gap < 1e-6,
    regular: spread !== null && spread < 1e-6,
  };
}

export function actions(): GameActions {
  return {
    closed_walk: {
      describe:
        "Build the page's diagram with n circles through O and a first corner at angle radians on the rightmost circle, then follow the sides through the crossings for a full lap. Reports the crossings, corners, side lengths and the gap between the closing point and the first corner; a gap near zero means the walk comes home.",
      args: '{ "n": 5, "angle": 0.7 }',
      run: (args) => {
        const C = core();
        const n = circleCount(args);
        const angle = num(args, "angle", 0.7);
        const common = optionalPoint(args, "common", C.O as Point);
        const state = C.start({ n, angle, common });
        const vertices = state.vertices as Point[];
        const complete = vertices.length === n &&
          vertices.every((p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y));
        if (!complete) {
          return {
            n, angle: sig(angle), common, complete: false,
            note: "The first corner sits beside a crossing, where the applet's one-unit choice cannot finish the chain. Pick another angle or try the crossing_choice action.",
          };
        }
        const circles = state.circles as Circle[];
        const radii = circles.map((c) => C.dist(c.c, common) as number);
        const sides = C.sides(state) as number[];
        const gap = C.closureError(state) as number;
        const rewalk = C.propagate(vertices, state.intersections, circles, 0, C.other) as unknown as Point[];
        const drift = rewalk.length === n && rewalk.every((p) => !!p && Number.isFinite(p.x))
          ? Math.max(...rewalk.map((p, i) => C.dist(p, vertices[i]) as number))
          : null;
        const spread = Math.max(...sides) - Math.min(...sides);
        const equalRadii = radii.every((r) => Math.abs(r - radii[0]) < 1e-9);
        return {
          n, angle: sig(angle), common, complete: true,
          centers: pts(state.centers as Point[]),
          radii: radii.map(sig),
          crossings: pts(state.intersections as Point[]),
          vertices: pts(vertices),
          sides: sides.map(sig),
          closureGap: sig(gap),
          closes: gap < 1e-6,
          equalRadii,
          sideSpread: sig(spread),
          rewalkDrift: drift === null ? null : sig(drift),
          note: `Drawing each side through the crossing of the next pair of circles, the walk returns to within ${sig(gap)} units of its first corner. ${equalRadii ? "The radii here are exactly equal." : "The applet rounds its centres to whole pixels, so the radii are only nearly equal and the sides differ by up to " + sig(spread) + " units."} Another lap moves the corners by at most ${drift === null ? "an unmeasurable amount" : sig(drift)} units.`,
        };
      },
    },
    crossing_choice: {
      describe:
        "With n equal-radius circles whose centres are evenly spaced about O, walk the polygon twice from the same first corner: once with the applet's one-unit 'other crossing' shortcut and once with the mathematically correct farther-crossing rule. Reports both closure gaps and whether the correct polygon has all sides equal; angle is in radians, and 4.185 with 3 circles shows the shortcut jumping by about a quarter of a unit.",
      args: '{ "n": 3, "angle": 4.185 }',
      run: (args) => {
        const C = core();
        const n = circleCount(args);
        const angle = num(args, "angle", 4.185);
        const common = optionalPoint(args, "common", C.O as Point);
        const { centers, circles } = exactCircles(n, common);
        const crossings = C.formIntersects(circles, common, C.other) as unknown as Point[];
        const first: Point = {
          x: centers[0].x + circles[0].r * Math.cos(angle),
          y: centers[0].y + circles[0].r * Math.sin(angle),
        };
        const applet = walk(circles, crossings, first, C.other);
        const correct = walk(circles, crossings, first, C.farther);
        const jumped = applet.gap !== null && applet.gap > 0.1;
        return {
          n, angle: sig(angle), common,
          radius: circles[0].r,
          centersEvenlySpaced: true,
          radiiEqual: true,
          centers: pts(centers),
          crossings: pts(crossings),
          firstCorner: pt(first),
          applet: {
            complete: applet.complete,
            closureGap: applet.gap === null ? null : sig(applet.gap),
            closes: applet.closes,
            vertices: applet.complete ? pts(applet.vertices) : [],
          },
          fartherCrossing: {
            complete: correct.complete,
            closureGap: correct.gap === null ? null : sig(correct.gap),
            closes: correct.closes,
            sides: correct.complete ? correct.sides.map(sig) : [],
            sideSpread: correct.spread === null ? null : sig(correct.spread),
            regular: correct.regular,
            vertices: correct.complete ? pts(correct.vertices) : [],
          },
          note: !applet.complete || !correct.complete
            ? "This first corner lands on a crossing, so a side of the chain cannot be drawn; choose another angle."
            : jumped
              ? `The applet's one-unit shortcut picks the nearer crossing and misses the start by ${sig(applet.gap!)} units, while the farther-crossing rule closes to ${sig(correct.gap!)} units. These exact congruent, evenly spaced circles give ${correct.regular ? "a regular" : "an almost regular"} polygon: all sides agree to ${sig(correct.spread!)} units.`
              : `Both picks close the walk here (gaps ${sig(applet.gap!)} and ${sig(correct.gap!)} units). The exact congruent, evenly spaced circles give ${correct.regular ? "a regular" : "an almost regular"} polygon: all sides agree to ${sig(correct.spread!)} units.`,
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, _stateVersion?: number): unknown {
  const C = core();
  if (!state || typeof state !== "object") throw new Error("saved position must be an object");
  const n = circleCount(state);
  const common = readPoint(state.common, "common");
  const centers = readPoints(state.centers, "centers", n);
  const vertices = readPoints(state.vertices, "vertices", n);
  const intersections = readPoints(state.intersections, "intersections", n);
  const angles = numArray(state, "angles");
  if (angles.length !== n) throw new Error(`angles must have ${n} entries`);

  // Core.position saves no `circles` or `angle`, but every circle through the
  // common point is fixed by its centre: radius = distance to that point.
  const circles: Circle[] = centers.map((c) => ({ c, r: C.dist(c, common) as number }));
  const here = { n, common, centers, circles, vertices, intersections, angles };
  const complete = vertices.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const sides = C.sides(here) as number[];
  const gap = C.closureError(here) as number;
  const appletRewalk = C.propagate(vertices, intersections, circles, 0, C.other) as unknown as Point[];
  const correctRewalk = C.propagate(vertices, intersections, circles, 0, C.farther) as unknown as Point[];
  const drift = complete && appletRewalk.length === n &&
    appletRewalk.every((p) => !!p && Number.isFinite(p.x))
      ? Math.max(...appletRewalk.map((p, i) => C.dist(p, vertices[i]) as number))
      : null;
  const correctGap = complete && correctRewalk.length === n && Number.isFinite(correctRewalk[0]?.x)
    ? (C.dist(correctRewalk[0], vertices[0]) as number)
    : null;
  const radii = circles.map((c) => c.r);
  const spread = Math.max(...sides) - Math.min(...sides);

  return {
    stateVersion: _stateVersion ?? null,
    n,
    common,
    explored: state.explored === true,
    centers: pts(centers),
    vertices: pts(vertices),
    intersections: pts(intersections),
    angles: angles.map(sig),
    savedSides: Array.isArray(state.sides) ? numArray(state, "sides") : null,
    sides: sides.map(sig),
    savedClosureGap: typeof state.closureGap === "number" && Number.isFinite(state.closureGap)
      ? state.closureGap
      : null,
    closureGap: sig(gap),
    closes: gap < 1e-6,
    radii: radii.map(sig),
    equalRadii: radii.every((r) => Math.abs(r - radii[0]) < 1e-9),
    sideSpread: sig(spread),
    rewalkDrift: drift === null ? null : sig(drift),
    correctChoiceGap: correctGap === null ? null : sig(correctGap),
    note: `${C.describe(here)} The walk ${gap < 1e-6 ? "does" : "does not"} come home: its gap is ${sig(gap)} units, and another lap moves the corners by at most ${drift === null ? "an unmeasurable amount" : sig(drift)} units.`,
  };
}
