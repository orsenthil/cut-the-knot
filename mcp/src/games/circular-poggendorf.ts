/*
 * run_game_logic actions and saved-position reader for Circular Poggendorf.
 *
 * The core lives in circular-poggendorf/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 *
 * This is an illustration, not a game: there is no win or loss. What can be
 * measured is the drawing the applet makes — one circle (drawOval) and one
 * background-coloured strip (fillRect, outlined with drawRect) whose two edges
 * are parallel vertical lines. All visible arc ends land on that same circle,
 * at x = x0 and x = x0 + barWidth, in symmetric pairs about y = 150. The page's
 * claim that the pieces "do not appear to fit" is a claim about what the eye
 * reports; the core cannot compute perception, and every reading says so.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circular-poggendorf"].CircularPoggendorfCore;

type Settings = { radius: number; barWidth: number; x0: number; reveal: boolean };
type Geometry = {
  center: { x: number; y: number };
  radius: number;
  oval: { x: number; y: number; width: number; height: number };
  bar: { x: number; y: number; width: number; height: number };
  edges: { name: string; x: number; y1: number; y2: number }[];
  leftX: number;
  rightX: number;
  hidesWholeCircle: boolean;
  missesCircle: boolean;
  fits: boolean;
};
type Cut = { edge: string; x: number; y: number };
type Claims = {
  edgesParallel: boolean;
  cutsOnCircle: boolean;
  cutsOnEdges: boolean;
  cutsSymmetric: boolean;
  piecesFit: boolean;
  seemMisaligned: null;
  pageClaim: string;
};

const PERCEPTION_NOTE =
  "The program draws exactly one circle, centred at (210, 150) with radius r, then paints a strip from x = x0 to x = x0 + barWidth over it and outlines the strip. The two edges are parallel vertical lines at those x values, and the arc ends where they cross the circle are symmetric about y = 150. Put the strip back and the circle is whole: the pieces fit by construction. That they 'do not appear to fit' is the Circular Poggendorff illusion — a statement about perception, not about coordinates. No claim here proves or disproves what a person sees; revealing the hidden circle only draws the same circle again.";

/** A whole-number option in the applet's scrollbar range; missing takes its start value. */
function whole(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const v = num(args, key, fallback);
  if (!Number.isInteger(v) || v < lo || v > hi) {
    throw new Error(`${key} must be a whole number from ${lo} to ${hi}, got ${JSON.stringify(args[key])}`);
  }
  return v;
}

function readReveal(args: Json): boolean {
  const v = args.reveal;
  if (v === undefined || v === null) return false;
  if (typeof v !== "boolean") throw new Error(`reveal must be a boolean, got ${JSON.stringify(v)}`);
  return v;
}

function readSettings(args: Json): Settings {
  const C = core();
  return {
    radius: whole(args, "radius", C.START.radius, C.LIMITS.radius[0], C.LIMITS.radius[1]),
    barWidth: whole(args, "barWidth", C.START.barWidth, C.LIMITS.barWidth[0], C.LIMITS.barWidth[1]),
    x0: whole(args, "x0", C.START.x0, C.LIMITS.x0[0], C.LIMITS.x0[1]),
    reveal: readReveal(args),
  };
}

/** The exact picture the core draws for one setting, with no opinion about what is seen. */
function reading(s: Settings) {
  const C = core();
  const state = C.start(s);
  const g = C.geometry(state) as unknown as Geometry;
  return {
    view: C.VIEW,
    center: g.center,
    radius: state.radius,
    oval: g.oval,
    bar: g.bar,
    edges: g.edges,
    leftX: g.leftX,
    rightX: g.rightX,
    cuts: C.cuts(state) as unknown as Cut[],
    handles: {
      radius: C.radiusHandle(state),
      edges: C.edgeHandles(state),
    },
    hidesWholeCircle: g.hidesWholeCircle,
    missesCircle: g.missesCircle,
    fits: g.fits,
    claims: C.claims(state) as unknown as Claims,
  };
}

export function actions(): GameActions {
  return {
    geometry: {
      describe:
        "The exact drawing the page makes for a circle radius (1..500, default 125), bar width (1..200, default 50), bar start x0 (1..400, default 100) and the optional reveal flag (default false). Reports the drawOval rectangle of the circle, the fillRect/drawRect strip and its two parallel edges, the cut points where those edges cross the circle, the three drag handles, and the core's geometry checks. The pieces fit by construction; any apparent misalignment is perception, not a difference in the drawing.",
      args: '{ "radius": 125, "barWidth": 50, "x0": 100, "reveal": false }',
      run: (args) => {
        const s = readSettings(args);
        return { settings: s, ...reading(s), outcome: core().result(), note: PERCEPTION_NOTE };
      },
    },
    illusion: {
      describe:
        "Sweeps the real core through four cases using the same options as geometry: the default bar cutting the circle, a bar covering the whole circle (radius 40, x0 150, barWidth 200), a bar missing it entirely (radius 40, x0 350, barWidth 50), and the caller's own setting. Also toggles reveal to show that showing the hidden circle changes no coordinates. Reports for each case that the edges stay parallel, the cut ends stay on the circle and on the edges in symmetric pairs, and the pieces fit; the changing appearance is illusion, not geometry.",
      args: '{ "radius": 125, "barWidth": 50, "x0": 100 }',
      run: (args) => {
        const s = readSettings(args);
        const C = core();
        const cases = [
          { name: "default", settings: s },
          { name: "bar covers the whole circle", settings: { ...s, radius: 40, x0: 150, barWidth: 200 } },
          { name: "bar misses the circle", settings: { ...s, radius: 40, x0: 350, barWidth: 50 } },
          { name: "caller's setting", settings: s },
        ].map(({ name, settings }) => {
          const st = C.start(settings);
          const g = C.geometry(st) as unknown as Geometry;
          const cl = C.claims(st) as unknown as Claims;
          return {
            name,
            settings,
            oval: g.oval,
            bar: g.bar,
            edges: g.edges,
            cuts: C.cuts(st) as unknown as Cut[],
            hidesWholeCircle: g.hidesWholeCircle,
            missesCircle: g.missesCircle,
            geometry: {
              edgesParallel: cl.edgesParallel,
              cutsOnCircle: cl.cutsOnCircle,
              cutsOnEdges: cl.cutsOnEdges,
              cutsSymmetric: cl.cutsSymmetric,
              piecesFit: cl.piecesFit,
            },
          };
        });
        const base = C.start(s);
        const revealed = C.setReveal(base, true);
        return {
          settings: s,
          cases,
          allPiecesFit: cases.every((c) =>
            c.geometry.piecesFit && c.geometry.edgesParallel && c.geometry.cutsOnCircle &&
            c.geometry.cutsOnEdges && c.geometry.cutsSymmetric),
          revealToggle: {
            geometryUnchanged: JSON.stringify(C.geometry(base)) === JSON.stringify(C.geometry(revealed)),
            cutsUnchanged: JSON.stringify(C.cuts(base)) === JSON.stringify(C.cuts(revealed)),
            note: "Revealing only draws the whole circle over the strip; it moves no edge and no arc end.",
          },
          note: PERCEPTION_NOTE,
        };
      },
    },
  };
}

/** What the core says about the picture the page saved with Track.state. */
export function position(st: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Circular Poggendorf state version ${stateVersion}`);
  const s = readSettings(st);
  const touches = whole(st, "touches", 0, 0, 1000000);
  return {
    ...s,
    touches,
    saved: { ...s, touches },
    stateVersion,
    ...reading(s),
    illustration: true,
    outcome: core().result(),
    note: PERCEPTION_NOTE,
  };
}
