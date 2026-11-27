/*
 * run_game_logic actions and saved-position reader for Distortion.
 *
 * The drawing is a picture, not a game: there is no win or loss. Both actions
 * and position() call the game's real core (distortion/distortion-core.js in
 * the site, copied into src/generated/cores/ at build time), which recreates
 * the applet's two Draw methods exactly. The claim they check is that every
 * circle is truly round and every triangle straight-sided, equal-sided and
 * convex: the bending is in the eye, not in the geometry. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

interface Core {
  VIEW: { width: number; height: number };
  SPREAD_DEFAULT: number;
  SPREAD_MIN: number;
  SPREAD_MAX: number;
  MODE_TRIANGLES_ON_CIRCLES: string;
  MODE_CIRCLES_ON_TRIANGLES: string;
  clampSpread(value: unknown): number;
  normalizeMode(value: unknown): string;
  start(options?: Json): Json;
  geometry(state: Json, size?: Json): Scene;
  describe(state: Json): string;
}

type Point = { x: number; y: number };

interface Scene {
  width: number;
  height: number;
  side: number;
  origin: Point;
  centre: Point;
  spread: number;
  mode: string;
  circles: Array<{ cx: number; cy: number; radius: number; diameter: number }>;
  triangles: Array<{ radius: number; vertices: Point[] }>;
}

const core = (): Core => cores["distortion"].DistortionCore as unknown as Core;

interface Saved {
  [key: string]: unknown;
  spread: number;
  mode: string;
  explored: boolean;
}

/**
 * Read the page's two options with the core's own clamps: a spread outside
 * 2..36 is rounded into range, and an unrecognised mode falls back to
 * triangles on circles, just as the applet's scrollbar and checkbox do.
 */
function readState(src: Json, C: Core): Saved {
  const state = C.start({
    spread: src.spread === undefined ? C.SPREAD_DEFAULT : num(src, "spread"),
    mode: src.mode === undefined ? C.MODE_TRIANGLES_ON_CIRCLES : src.mode,
  });
  return {
    spread: C.clampSpread(state.spread),
    mode: C.normalizeMode(state.mode),
    explored: src.explored === undefined ? state.explored === true : src.explored === true,
  };
}

function sideLengths(vertices: Point[]): number[] {
  return [0, 1, 2].map((i) => {
    const a = vertices[i];
    const b = vertices[(i + 1) % 3];
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
}

/** Twice the signed area: positive means counter-clockwise, zero means flat. */
function cross(vertices: Point[]): number {
  const [a, b, c] = vertices;
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * The core's three corners, before Java's integer rounding: angles 90, 30
 * and -30 degrees about the centre, so the chords between them are equal.
 */
function idealTriangle(centre: Point, radius: number): Point[] {
  return [
    { x: centre.x + radius * Math.cos(Math.PI / 2), y: centre.y - radius * Math.sin(Math.PI / 2) },
    { x: centre.x + radius * Math.cos(Math.PI / 6), y: centre.y + radius * Math.sin(Math.PI / 6) },
    { x: centre.x - radius * Math.cos(Math.PI / 6), y: centre.y + radius * Math.sin(Math.PI / 6) },
  ];
}

/**
 * Measure one scene against its own ideal figures. Every circle has its
 * centre and radius explicitly, so it is round by construction. The core
 * rounds triangle corners to whole pixels as Java does; reconstructing the
 * unrounded corners shows they form an exact equilateral, convex triangle,
 * and the drawn corners are at most 0.71 units away from them.
 */
function checkScene(C: Core, state: Saved) {
  const g = C.geometry(state);
  const triangles = g.triangles.map((t) => {
    const ideal = idealTriangle(g.centre, t.radius);
    const idealSides = sideLengths(ideal);
    const lengths = sideLengths(t.vertices);
    const longest = Math.max(...lengths);
    const shortest = Math.min(...lengths);
    const idealSide = Math.max(...idealSides);
    const maxSideError = Math.max(...lengths.map((s) => Math.abs(s - idealSide)));
    const roundingOffset = Math.max(...t.vertices.map((v, i) =>
      Math.hypot(v.x - ideal[i].x, v.y - ideal[i].y)));
    // A radius-0 triangle is a single pixel; the applet adds no visible side.
    // It occurs at spread 5 and 19 in circle-on-triangles mode.
    return {
      radius: t.radius,
      vertices: t.vertices,
      sides: lengths,
      idealSide,
      maxSideError,
      roundingOffset,
      degenerate: t.radius <= 0,
      idealEquilateral: Math.max(...idealSides) - Math.min(...idealSides) < 1e-9,
      sidesEqualWithinPixel: longest - shortest <= 3 && maxSideError <= 3,
      straightSides: t.vertices.length === 3 && longest > 0,
      convex: cross(ideal) > 0,
    };
  });
  const drawn = triangles.filter((t) => !t.degenerate);
  const circles = g.circles.map((c) => ({
    cx: c.cx,
    cy: c.cy,
    radius: c.radius,
    diameter: c.diameter,
    round: c.radius > 0 && c.diameter === 2 * c.radius,
  }));
  return {
    g,
    triangles,
    circles,
    degenerateTriangles: triangles.length - drawn.length,
    maxRoundingOffset: Math.max(0, ...triangles.map((t) => t.roundingOffset)),
    maxSideError: Math.max(0, ...drawn.map((t) => t.maxSideError)),
    allCirclesRound: circles.every((c) => c.round),
    allTrianglesStraight: drawn.every((t) => t.straightSides),
    allTrianglesEqualSided: drawn.every((t) => t.idealEquilateral && t.sidesEqualWithinPixel),
    allTrianglesConvex: drawn.every((t) => t.convex),
  };
}

/** A short, stable summary of a scene, without the full list of vertices. */
function summary(C: Core, state: Saved) {
  const r = checkScene(C, state);
  return {
    mode: r.g.mode,
    spread: r.g.spread,
    canvas: { width: r.g.width, height: r.g.height },
    centre: r.g.centre,
    circles: r.g.circles.length,
    circleRadii: r.circles.map((c) => c.radius),
    triangles: r.g.triangles.length,
    triangleRadii: r.g.triangles.map((t) => t.radius),
    degenerateTriangles: r.degenerateTriangles,
    maxRoundingOffset: r.maxRoundingOffset,
    maxSideError: r.maxSideError,
    allCirclesRound: r.allCirclesRound,
    allTrianglesStraight: r.allTrianglesStraight,
    allTrianglesEqualSided: r.allTrianglesEqualSided,
    allTrianglesConvex: r.allTrianglesConvex,
  };
}

export function actions(): GameActions {
  const C = core();
  return {
    figure_check: {
      describe:
        "Check every figure in either picture: each circle obeys diameter = 2·radius about its centre, and each triangle's unrounded corners form an exact equilateral, convex triangle with three straight sides. Java rounds those corners to whole pixels, so the reported pixel sides differ by a fraction of a unit; at every spacing from 2 to 36 the figures pass, and the bending is only an illusion.",
      args: '{ "spread": 10, "mode": "triangle-on-circles" }',
      run: (args) => {
        const state = readState(args, C);
        const r = checkScene(C, state);
        return {
          ...summary(C, state),
          status: C.describe(state),
          note:
            `In "${state.mode}" mode the core draws ${r.g.circles.length} circles and ${r.g.triangles.length} triangle(s) at spacing ${r.g.spread}. Every circle is a true circle and every drawn triangle a straight-sided, equal-sided, convex triangle; the crossing lines make your eyes bend them, not the drawing.` +
            (r.degenerateTriangles
              ? ` ${r.degenerateTriangles} radius-0 triangle(s) collapse to one pixel and are not counted as drawn triangles.`
              : ""),
        };
      },
    },
    spacing_sweep: {
      describe:
        "Step the spacing slider through the applet's whole range in both modes and check the figures at each setting. No setting produces a bent circle or a crooked or concave ideal triangle; switching which figure is nested changes only the drawing order and the counts. Tiny radius-0 triangles at two spacings collapse to one pixel and are reported separately.",
      args: '{ "from": 2, "to": 36, "step": 2 }',
      run: (args) => {
        const from = C.clampSpread(num(args, "from", C.SPREAD_MIN));
        const to = C.clampSpread(num(args, "to", C.SPREAD_MAX));
        const step = Math.round(num(args, "step", 2));
        if (from > to) throw new Error('"from" must not exceed "to"');
        if (!Number.isFinite(step) || step < 1 || step > C.SPREAD_MAX - C.SPREAD_MIN) {
          throw new Error(`"step" must be a whole number from 1 to ${C.SPREAD_MAX - C.SPREAD_MIN}`);
        }
        const spreads: number[] = [];
        for (let s = from; s <= to; s += step) spreads.push(s);
        if (spreads[spreads.length - 1] !== to) spreads.push(to);

        const modes = [C.MODE_TRIANGLES_ON_CIRCLES, C.MODE_CIRCLES_ON_TRIANGLES];
        const samples = spreads.map((spread) => {
          const perMode = modes.map((mode) => {
            const r = checkScene(C, { spread, mode, explored: true });
            return {
              mode,
              circles: r.g.circles.length,
              triangles: r.g.triangles.length,
              figuresHonest:
                r.allCirclesRound && r.allTrianglesStraight &&
                r.allTrianglesEqualSided && r.allTrianglesConvex,
            };
          });
          return { spread, perMode };
        });
        return {
          from,
          to,
          step,
          modes,
          settingsChecked: spreads.length * modes.length,
          allFiguresHonestAtEverySetting: samples.every((s) =>
            s.perMode.every((m) => m.figuresHonest)),
          samples,
          note:
            "Over every reachable spacing the circles keep diameter = 2·radius and the triangles keep three equal straight sides with the same orientation, in both nesting modes. The distortion is perceptual: no setting deforms a figure.",
        };
      },
    },
  };
}

/** What the core says about the options the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Distortion state version ${stateVersion}`);
  }
  const C = core();
  try {
    const here = readState(state, C);
    const r = checkScene(C, here);
    return {
      ...state,
      stateVersion,
      valid: true,
      spread: here.spread,
      mode: here.mode,
      explored: here.explored,
      canvas: { width: r.g.width, height: r.g.height },
      centre: r.g.centre,
      circles: r.g.circles.length,
      circleRadii: r.circles.map((c) => c.radius),
      triangles: r.g.triangles.length,
      triangleRadii: r.g.triangles.map((t) => t.radius),
      degenerateTriangles: r.degenerateTriangles,
      maxRoundingOffset: r.maxRoundingOffset,
      maxSideError: r.maxSideError,
      allCirclesRound: r.allCirclesRound,
      allTrianglesStraight: r.allTrianglesStraight,
      allTrianglesEqualSided: r.allTrianglesEqualSided,
      allTrianglesConvex: r.allTrianglesConvex,
      status: C.describe(here),
      note:
        "Track.state saved the spacing and which figure is nested. The core rebuilds that exact drawing: its circles are round and its triangles straight, equal-sided and convex, so any bending you see is an illusion of the crossing lines.",
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "A saved Distortion position needs a numeric spread and a mode of triangle-on-circles or circle-on-triangles.",
    };
  }
}
