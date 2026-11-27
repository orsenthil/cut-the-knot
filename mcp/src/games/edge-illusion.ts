/*
 * run_game_logic actions and saved-position reader for Edge Illusion
 * (Bogomolny's Kanizsa triangle/square applet).
 *
 * Both the actions and position() call the game's real core
 * (edge-illusion/ in the site), copied into src/generated/cores/ at build time.
 * The core's claims() reduces the two pixel-level facts behind the illusion —
 * no side of the centre shape is drawn, and "Show edges" only lays detached
 * dashes along the missing sides — while the claim that the shape looks
 * brighter is left to perception. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["edge-illusion"].EdgeIllusionCore;

interface IllusionState {
  which: number;
  n: number;
  part: number;
  mode: string;
  swapped: boolean;
  extra: boolean;
  width: number;
  height: number;
}

interface Claim {
  noDrawnSides: boolean;
  allEdgesOnSides: boolean;
  maskIsBackground: boolean;
  edgeStrokes: number;
  extraPieces: number;
}

const round = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Read the page's options, validating types and the applet's scrollbar ranges. */
function readState(args: Json, base?: IllusionState): IllusionState {
  const C = core();
  let s: IllusionState = base ? { ...base } : (C.start({}) as IllusionState);
  const apply = (key: string, value: unknown) => {
    s = C.withOption(s, key, value) as IllusionState;
  };

  if (args.which !== undefined && args.which !== null) {
    const w = args.which;
    if (w === "triangle" || w === C.TRIANGLE) apply("which", C.TRIANGLE);
    else if (w === "square" || w === C.SQUARE) apply("which", C.SQUARE);
    else throw new Error('"which" must be "triangle", "square", 0 or 1');
  }

  if (args.n !== undefined && args.n !== null) {
    const v = num(args, "n");
    if (!Number.isInteger(v) || v < C.MIN_N || v > C.MAX_N) {
      throw new Error(`"n" must be an integer from ${C.MIN_N} to ${C.MAX_N}`);
    }
    apply("n", v);
  }

  if (args.part !== undefined && args.part !== null) {
    const v = num(args, "part");
    if (!Number.isInteger(v) || v < C.MIN_PART || v > C.MAX_PART) {
      throw new Error(`"part" must be an integer from ${C.MIN_PART} to ${C.MAX_PART}`);
    }
    apply("part", v);
  }

  if (args.mode !== undefined && args.mode !== null) {
    const m = args.mode;
    if (typeof m !== "string" || C.MODES.indexOf(m) < 0) {
      throw new Error(`"mode" must be one of ${C.MODES.join(", ")}`);
    }
    apply("mode", m);
  }

  for (const key of ["swapped", "extra"] as const) {
    if (args[key] !== undefined && args[key] !== null) {
      if (typeof args[key] !== "boolean") throw new Error(`"${key}" must be true or false`);
      apply(key, args[key]);
    }
  }

  for (const key of ["width", "height"] as const) {
    if (args[key] !== undefined && args[key] !== null) {
      const v = num(args, key);
      if (!Number.isInteger(v) || v < 30 || v > 10000) {
        throw new Error(`"${key}" must be an integer from 30 to 10000`);
      }
      apply(key, v);
    }
  }
  return s;
}

export function actions(): GameActions {
  return {
    illusion_claims: {
      describe:
        "The two pixel-level facts behind the Kanizsa figure: the default picture draws no side of the centre shape and fills its middle with the field colour, and 'Show edges' only adds detached strokes that all lie on the missing sides. Whether the shape then looks brighter is a claim about perception, not about these pixels.",
      args: '{ "which": "triangle", "n": 2, "part": 51, "mode": "edges", "extra": true }',
      run: (args) => {
        const C = core();
        const here = readState(args);
        const shape = here.which === C.SQUARE ? "square" : "triangle";
        const corners = here.which === C.SQUARE ? 4 : 3;
        const chosen = C.claims(here) as Claim;
        // Keep the two headline facts independent of the caller's mode: force
        // the plain and edge pictures from the same other options.
        const plain = C.claims({ ...here, mode: "plain" }) as Claim;
        const edges = C.claims({ ...here, mode: "edges" }) as Claim;
        return {
          settings: { ...here },
          shape,
          corners,
          defaultPicture: {
            noDrawnSides: plain.noDrawnSides,
            middleIsFieldColour: plain.maskIsBackground,
            edgeStrokes: plain.edgeStrokes,
          },
          showEdges: {
            edgeStrokes: edges.edgeStrokes,
            allStrokesOnMissingSides: edges.allEdgesOnSides,
          },
          atChosenMode: chosen,
          extraPieces: chosen.extraPieces,
          brightnessIsPerceptual: true,
          note:
            "The applet never paints a side and masks the overlap with the background colour; the 'edges' are short dashes on those same missing sides. A brighter-looking shape is produced by the viewer's brain, not by any pixel the core draws.",
        };
      },
    },
    geometry: {
      describe:
        "The construction of the figure: the corner points and the ruler distance that sets the shrinking-circle step, with the number of circles at each corner. In paint mode the filled circles cycle through the seven applet colours; in fill mode they alternate ink and paper.",
      args: '{ "which": "square", "n": 3, "part": 50 }',
      run: (args) => {
        const C = core();
        const here = readState(args);
        const g = C.layout(here) as {
          radius: number; cx: number; cy: number;
          points: Array<Array<{ x: number; y: number }>>;
          dist: number[]; step: number;
        };
        const picture = C.scene(here) as {
          circles: Array<{ colour: string; filled: boolean }>;
          mask: Array<{ x: number; y: number }>;
        };
        const ring = g.points[here.which];
        const colours = [...new Set(picture.circles.map((c) => c.colour))].sort();
        const shape = here.which === C.SQUARE ? "square" : "triangle";
        return {
          settings: { ...here },
          shape,
          corners: ring.length,
          radius: g.radius,
          centre: { x: g.cx, y: g.cy },
          cornerPoints: ring,
          distanceBetweenFirstTwoCorners: g.dist[here.which],
          step: round(g.step),
          circlesPerCorner: 2 * here.n - 1,
          totalCircles: picture.circles.length,
          maskPolygon: picture.mask,
          circleColours: colours,
          note:
            "Each corner carries 2n-1 concentric circles whose radii fall by one step each time; the step is part/100 of the corner-to-corner distance divided by (2n-1)/2. The mask polygon covers the inner halves in the background colour, so no centre edge is ever drawn.",
        };
      },
    },
  };
}

/** What the core says about the illustration whose position the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Edge Illusion state version ${stateVersion}`);
  }
  const C = core();
  try {
    const here = readState(state);
    const cl = C.claims(here) as Claim;
    const g = C.layout(here) as { step: number };
    const picture = C.scene(here) as { mask: Array<{ x: number; y: number }>; circles: unknown[] };
    return {
      ...state,
      stateVersion,
      valid: true,
      shape: here.which === C.SQUARE ? "square" : "triangle",
      which: here.which,
      n: here.n,
      part: here.part,
      mode: here.mode,
      swapped: here.swapped,
      extra: here.extra,
      width: here.width,
      height: here.height,
      corners: picture.mask.length,
      circlesPerCorner: 2 * here.n - 1,
      totalCircles: picture.circles.length,
      step: round(g.step),
      noDrawnSides: cl.noDrawnSides,
      middleIsFieldColour: cl.maskIsBackground,
      edgeStrokes: cl.edgeStrokes,
      allEdgesOnMissingSides: cl.allEdgesOnSides,
      extraPieces: cl.extraPieces,
      note:
        "Track.state saved the shape, n, part, mode and the two toggles. The core rebuilds the scene from them: the centre has no drawn sides and is masked with the field colour, while edge dashes (if any) lie on the missing sides. Whether it looks brighter is perception, not pixels.",
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note:
        "A saved Edge Illusion position needs which (triangle/square or 0/1), n 1-10, part 0-100, a mode of plain/edges/fill/paint, two booleans and a positive board size.",
    };
  }
}
