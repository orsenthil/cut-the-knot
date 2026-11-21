/*
 * run_game_logic actions and saved-position reader for Shapes of Constant Width.
 *
 * A Reuleaux triangle of side s has width s in every direction, so it turns in a
 * square of side s touching all four sides. Every answer below comes from the
 * game's real core (cwidth/ in the site). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cwidth"].CwidthCore;

const round = (v: number) => Math.round(v * 1e9) / 1e9;

function facts(C: ReturnType<typeof core>, s: number) {
  return {
    side: s,
    area: round(C.area(s)),
    circleAreaSameWidth: round((Math.PI / 4) * s * s),
    areaRatioToCircle: round(C.area(1) / (Math.PI / 4)),
    perimeter: round(C.perimeter(s)),
    perimeterIsPiTimesWidth: Math.abs(C.perimeter(s) - Math.PI * s) < 1e-9,
    internalAnglesDegrees: 120,
    sweptAreaInSquare: round(C.sweptArea(s)),
    sweptFractionOfSquare: round(C.sweptArea(1)),
  };
}

export function actions(): GameActions {
  return {
    width: {
      describe:
        "Measure the width of the Reuleaux triangle of a given side (default 1) when turned by an angle, in a chosen direction, and the enclosing square the applet finds. The width is the side in every direction; the square has the same side at every angle.",
      args: '{ "angle": 35, "direction": 70, "side": 1 }',
      run: (args) => {
        const C = core();
        const side = Math.max(0.0001, num(args, "side", 1));
        const angle = Math.trunc(num(args, "angle", 0));
        const theta = num(args, "direction", 0);
        const b = C.boundsApplet(angle, side);
        const t = C.boundsTrue(angle, side);
        return {
          angle, direction: theta,
          widthInDirection: round(C.width(angle, side, theta)),
          widthEqualsSide: Math.abs(C.width(angle, side, theta) - side) < 1e-9,
          enclosingSquare: { left: round(b.left), top: round(b.top), right: round(b.right), bottom: round(b.bottom), side: round(b.right - b.left) },
          squareMatchesTrueBoundingBox: ["left", "right", "top", "bottom"].every((k) => Math.abs((b as Record<string, number>)[k] - (t as Record<string, number>)[k]) < 1e-9),
          vertices: C.vertices(angle, side).map(([x, y]: number[]) => [round(x), round(y)]),
        };
      },
    },
    measures: {
      describe:
        "The page's formulas for a Reuleaux triangle of a given side: area (pi - sqrt 3)/2 s^2 (less than the circle's pi/4 s^2), perimeter pi s (Barbier), the 120 degree corners, and the area swept inside the square, 2 sqrt 3 + pi/6 - 3 for s = 1.",
      args: '{ "side": 1 }',
      run: (args) => {
        const C = core();
        const side = Math.max(0.0001, num(args, "side", 1));
        return { ...facts(C, side), note: "Barbier's theorem: every shape of constant width w has perimeter pi*w. The Reuleaux triangle has the least area of all shapes of constant width; the circle has the most." };
      },
    },
  };
}

/** What the core says about the picture as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ angle: num(state, "angle", 0), mode: state.mode, step: num(state, "step", 5) });
  const q = C.boundsApplet(s.angle, 1);
  const names: Record<string, string> = { rotate: "the triangle turning in its square", square: "the square turning round the triangle", trace: "the ground the triangle covers" };
  const seen = Array.isArray(state.seen) ? (state.seen as unknown[]).map(String) : [s.mode];
  return {
    angle: s.angle,
    view: s.mode,
    viewMeaning: names[s.mode],
    degreesPerStep: s.step,
    angleModulo120: ((s.angle % 120) + 120) % 120,
    touchedByArcs: [s.angle % 120 <= 30 || s.angle % 120 > 90 ? "top" : null, s.angle % 120 > 60 ? "left" : null].filter(Boolean),
    squareSide: round(q.right - q.left),
    widthInEveryDirection: round(C.width(s.angle, 1, 0)),
    viewsSeen: seen,
    allViewsSeen: C.MODES.every((m: string) => seen.includes(m)),
    moves: num(state, "moves", 0),
    note: `At ${s.angle} degrees the triangle is showing ${names[s.mode]}. Its width is the same in every direction (the side), so it always touches the four sides of the square.`,
  };
}
