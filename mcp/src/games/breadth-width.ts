/*
 * run_game_logic actions and saved-position reader for the Breadth vs Width
 * Illusion (Bogomolny's "Height/Width Interplay Illusion").
 *
 * All numbers come from the game's real core, breadth-width/ in the site,
 * copied into src/generated/cores/ at build time. The outer square is S by S
 * whatever N is; the layer marks inside it are only decoration. The apparent
 * difference in breadth and height is a trick of perception, not of geometry.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["breadth-width"].BreadthWidthCore;

type BWState = {
  layers: number;
  width: number;
  height: number;
  probe: { x: number; y: number };
};

type Point = { x: number; y: number };

/** Validate the model's arguments and make the state the core draws from. */
function fromArgs(args: Json): BWState {
  const C = core();
  const layers = num(args, "layers", C.START_LAYERS);
  if (!Number.isInteger(layers) || layers < C.MIN_LAYERS || layers > C.MAX_LAYERS) {
    throw new Error(`layers must be an integer from ${C.MIN_LAYERS} to ${C.MAX_LAYERS}`);
  }
  const width = num(args, "width", C.DEFAULT_WIDTH);
  const height = num(args, "height", C.DEFAULT_HEIGHT);
  if (C.layout({ width, height }).S < 1) {
    throw new Error(`canvas ${width} x ${height} is too small to draw a barrel body`);
  }
  return C.start({ layers, width, height }) as BWState;
}

/** A saved probe is optional and only used when it holds two numbers. */
function readProbe(value: unknown, fallback: Point): Point {
  const p = value as Json | undefined;
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) return fallback;
  return { x: Number(p.x), y: Number(p.y) };
}

/** The geometric substrate: one S by S square body for every barrel. */
function facts(s: BWState) {
  const C = core();
  const geo = C.layout(s);
  const barrels = Object.fromEntries(
    (["left", "middle", "right"] as const).map((which) => {
      const m = C.measure(s, which);
      if (!m) throw new Error(`no barrel named "${which}"`);
      return [which, {
        x: m.x, y: m.y,
        width: m.width, height: m.height,
        square: m.width === m.height,
        apparentLayers: m.layers,
        capOverhang: m.overhang,
      }];
    }),
  );
  return {
    layers: s.layers,
    canvas: { width: s.width, height: s.height },
    substrate: {
      S: geo.S, X0: geo.X0, Y0: geo.Y0,
      barrelXs: geo.xs, margin: geo.margin, cap: geo.cap,
      formula: "S = trunc(min((width - 4*margin)/3, height/1.2000000476837158 - 2*margin)), margin = 40",
    },
    barrels,
    claims: C.claims(s),
  };
}

export function actions(): GameActions {
  return {
    measure: {
      describe:
        "For N layers (1 to 20) on a width by height canvas, report the true size of all three barrels: each body is the same S by S square, whatever N is, and the rounded caps overhang equally on all three. The page's claims and the number of layer marks are checked too: the apparent difference in breadth and height comes from how the eye reads the layers, not from the geometry.",
      args: '{ "layers": 5, "width": 400, "height": 300 }',
      run: (args) => {
        const C = core();
        const s = fromArgs(args);
        return {
          ...facts(s),
          layerMarks: {
            leftUprightLines: C.verticalLines(s).length,
            middleArcs: C.horizontalArcs(s, 1).length,
            rightArcs: C.horizontalArcs(s, 2).length,
          },
          note: `The left and right bodies are both ${C.layout(s).S} units wide and ${C.layout(s).S} units tall. Changing N only adds layer marks inside that same square; the stacks look broader or taller because the eye reads the upright and curved layers as different sizes. That is perception, not a change in length, area or the drawn square.`,
        };
      },
    },
    marks: {
      describe:
        "For N layers, the exact layer marks the applet draws and the arithmetic behind them: N+1 upright lines on the left at round(S/2*cos(-PI + PI*i/N)) from the barrel's centre, one lower-half oval arc on the middle barrel, and N lower-half oval arcs on the right whose tops are at floor(S*i/N) - 30. These marks are decoration: all three bodies stay the same S by S square, so the difference the eye sees is an illusion.",
      args: '{ "layers": 3, "width": 400, "height": 300 }',
      run: (args) => {
        const C = core();
        const s = fromArgs(args);
        return {
          layers: s.layers,
          squareSide: C.layout(s).S,
          leftUprightLines: C.verticalLines(s),
          middleArcs: C.horizontalArcs(s, 1),
          rightArcs: C.horizontalArcs(s, 2),
          layerCountsMatchClaim: C.claims(s).layerCounts,
          bodiesSquareAndEqual: C.claims(s).leftSquare && C.claims(s).rightSquare && C.claims(s).sameSize,
          note: "The layers are only lines drawn inside an unchanged square. Counting upright lines on one stack and curved lines on the other nudges the eye into seeing different widths and heights, though the measure brackets agree.",
        };
      },
    },
  };
}

/** What the core says about the illustration as the page saved it. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported BreadthWidth state version ${stateVersion}`);
  const C = core();
  const width = num(state, "width", C.DEFAULT_WIDTH);
  const height = num(state, "height", C.DEFAULT_HEIGHT);
  const geo = C.layout({ width, height });
  const fallback = {
    x: geo.S > 0 ? geo.X0 + geo.S / 2 : width / 2,
    y: geo.S > 0 ? geo.Y0 + geo.S / 2 : height / 2,
  };
  const s = C.start({
    layers: C.clampLayers(num(state, "layers", C.START_LAYERS)),
    width, height,
    probe: readProbe(state.probe, fallback),
  }) as BWState;
  const stack = C.stackAt(s, s.probe);
  const measured = stack ? C.measure(s, stack) : null;
  const r = C.ruler(s);
  return {
    ...facts(s),
    stateVersion,
    probe: { x: s.probe.x, y: s.probe.y, over: stack, measured },
    ruler: { x0: r.x0, x1: r.x1, y: r.y, step: r.step, handleX: C.layerPoint(s).x },
    note: stack && measured
      ? `The probe is on the ${stack} stack: the brackets read ${measured.width} wide and ${measured.height} tall. Every barrel is the same S by S square; the apparent difference is perception, not geometry.`
      : "The probe is not on a barrel. Drag it onto one to read its true width and height; all three bodies are the same S by S square whatever the layer count.",
  };
}
