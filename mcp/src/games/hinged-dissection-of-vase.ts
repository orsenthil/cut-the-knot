/*
 * run_game_logic actions and saved-position reader for Hinged Dissection of a Vase.
 *
 * The real core is hinged-dissection-of-vase/hinged-dissection-of-vase-core.js,
 * copied verbatim into src/generated/cores/ at build time; every number below
 * is measured from it. The vase is a 270-degree bowl of radius R with a neck
 * of three quarter-circle arcs. Three coloured quarter-disks fill the bowl;
 * their hinges carry them into three corners of a diamond whose diagonals are
 * 2√2·R, so the diamond is a square of side 2R and area 4R². The neck supplies
 * the fourth corner, and the core's areas() confirms the vase has that same
 * area 4R². Coordinates are the applet's 460 x 460 board units, y downward.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Sector = { name: string; c: Pt; start: number; extent: number };
type Arc = { c: Pt; r: number; start: number; extent: number; name?: string };
type Areas = {
  segment: number; bottom: number; triangle: number; neck: number;
  top: number; vase: number; square: number;
};
type State = {
  width: number; height: number; cx: number; cy: number; R: number;
  angle: number; nSectors: number; explored: boolean;
};
type Geometry = {
  cx: number; cy: number; R: number;
  sectors: Sector[];
  bowl: Arc;
  neck: Arc[];
  diamond: Pt[];
  guides: boolean;
  bowlVisible: boolean;
  neckVisible: boolean;
  squareVisible: boolean;
  area: Areas;
};
interface Core {
  WIDTH: number;
  HEIGHT: number;
  ANGLE_MIN: number;
  ANGLE_MAX: number;
  ANGLE_DEFAULT: number;
  ANGLE_STEP: number;
  init(width: number, height: number): { cx: number; cy: number; R: number };
  start(o?: Partial<{ width: number; height: number; angle: number; nSectors: number }>): State;
  move(state: State, action: { type: string; value?: number } | number): State;
  sectors(state: State): Sector[];
  outline(state: State): { bowl: Arc; neck: Arc[]; diamond: Pt[] };
  areas(R: number): Areas;
  geometry(state: State): Geometry;
  result(state: State): "done" | null;
  snapshot(state: State): {
    width: number; height: number; cx: number; cy: number;
    R: number; angle: number; explored: boolean;
  };
}

const core = (): Core =>
  cores["hinged-dissection-of-vase"].HingedDissectionOfVaseCore as unknown as Core;

/* Round only for display; the core keeps full precision. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });

/* An argument must really be present and in range; a saved field may fall back. */
function intArg(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const n = num(args, key, fallback);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`argument "${key}" must be an integer from ${lo} to ${hi}`);
  }
  return n;
}

function savedInt(v: unknown, fallback: number, lo: number, hi: number): number {
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
}

/** Build a core state from validated width, height and angle arguments. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with optional width, height and angle");
  }
  return C.start({
    width: intArg(args, "width", C.WIDTH, 1, 4096),
    height: intArg(args, "height", C.HEIGHT, 1, 4096),
    angle: intArg(args, "angle", C.ANGLE_DEFAULT, C.ANGLE_MIN, C.ANGLE_MAX),
  });
}

/** One reading of a position, every number straight from the core. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  const a = g.area;
  const side = Math.sqrt(a.square); // the core's square area is (2R)^2
  return {
    board: { width: s.width, height: s.height },
    centre: pt({ x: g.cx, y: g.cy }),
    radius: g.R,
    angle: s.angle,
    quarterDisks: g.sectors.map((sec) => ({
      name: sec.name,
      hingeCentre: pt(sec.c),
      javaStartDeg: sec.start,
      extentDeg: sec.extent,
    })),
    outline: {
      bowl: { centre: pt(g.bowl.c), radius: g.bowl.r, startDeg: g.bowl.start, extentDeg: g.bowl.extent },
      neck: g.neck.map((arc) => ({
        name: arc.name, centre: pt(arc.c), radius: arc.r, startDeg: arc.start, extentDeg: arc.extent,
      })),
      squareCorners: g.diamond.map(pt),
    },
    square: {
      side: r6(side),
      sideFormula: "2R",
      diagonal: r6(Math.SQRT2 * side),
      diagonalFormula: "2√2·R",
      area: r6(a.square),
      areaFormula: "4R²",
    },
    areas: {
      circularSegment: r6(a.segment),
      bowl: r6(a.bottom),
      triangle: r6(a.triangle),
      neck: r6(a.neck),
      top: r6(a.top),
      vase: r6(a.vase),
      square: r6(a.square),
      vaseEqualsSquare: Math.abs(a.vase - a.square) < 1e-6,
    },
    visibility: {
      guides: g.guides,
      bowl: g.bowlVisible,
      neck: g.neckVisible,
      square: g.squareVisible,
    },
  };
}

/* The live fixture's board, at the far end of the hinge: the finished square. */
const SQUARE_ARGS = '{"width":460,"height":460,"angle":180}';
const SWEEP_ARGS = '{"width":460,"height":460,"angles":[0,45,90,135,180]}';

export function actions(): GameActions {
  return {
    vase_to_square: {
      describe:
        "Report the hinged dissection for an optional width and height (default 460 x 460) and hinge angle (integer 0 to 180, default 0). It lists the three quarter-disks with their hinge centres and Java arc angles, the square's four diamond corners, and the exact areas: the diamond has diagonals 2√2·R, hence side 2R and area 4R², which equals the vase's area. The example uses the applet's board with the hinge fully turned, where the square is drawn.",
      args: SQUARE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        return {
          ...r,
          result: C.result(s),
          note:
            `The three coloured quarter-disks swing on their hinges into three corners of a diamond with side ${r.square.side} (2R) and area ${r.square.area} (4R²); the vase's neck fills the fourth corner. ` +
            `The core measures vase area ${r.areas.vase} and square area ${r.areas.square}, so they match${r.areas.vaseEqualsSquare ? "" : " (within rounding)"}. ` +
            `At ${s.angle}° the drawing shows: ${r.visibility.bowl ? "bowl, " : ""}${r.visibility.neck ? "neck, " : ""}${r.visibility.square ? "square, " : ""}${r.visibility.guides ? "guide circle and diameters" : "no guides"}. ` +
            "This is an illustration, so there is no win or loss.",
        };
      },
    },

    hinge_sweep: {
      describe:
        "Turn the hinge with the core's move() through an angles array of integers from 0 to 180 (1 to 24 stops; default 0, 45, 90, 135, 180), with optional width and height as in vase_to_square. Each stop reports the three quarter-disks' hinge centres and which parts are visible; at 0° the quarters fill the bowl and at 180° the side-2R square appears while the neck and bowl vanish.",
      args: SWEEP_ARGS,
      run: (args) => {
        const C = core();
        const raw = args.angles;
        if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) {
          throw new Error('argument "angles" must be an array of 1 to 24 hinge angles');
        }
        const angles = raw.map((v, i) => {
          const n = Number(v);
          if (!Number.isInteger(n) || n < C.ANGLE_MIN || n > C.ANGLE_MAX) {
            throw new Error(`angles[${i}] must be an integer from ${C.ANGLE_MIN} to ${C.ANGLE_MAX}`);
          }
          return n;
        });
        let s = buildState(C, args);
        const stops = angles.map((a) => {
          s = C.move(s, { type: "angle", value: a });
          const g = C.geometry(s);
          return {
            angle: s.angle,
            hingeCentres: g.sectors.map((sec) => pt(sec.c)),
            visibility: {
              guides: g.guides,
              bowl: g.bowlVisible,
              neck: g.neckVisible,
              square: g.squareVisible,
            },
            squareSide: r6(Math.sqrt(g.area.square)),
            squareArea: r6(g.area.square),
          };
        });
        return {
          board: { width: s.width, height: s.height },
          centre: pt({ x: s.cx, y: s.cy }),
          radius: s.R,
          stops,
          result: C.result(s),
          note:
            `Moved the hinge through ${angles.join("°, ")}° using the core's own move(). The quarter-disks rotate about their hinges while the fixed diamond corners stay put; ` +
            "every stop's square area is 4R², and the square is only drawn at 180° where the bowl and neck are hidden.",
        };
      },
    },
  };
}

/** Echo Track's saved fields, then re-measure that exact picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hinged Dissection of a Vase state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hinged Dissection of a Vase position must be an object");
  }
  const C = core();
  const width = savedInt(state.width, C.WIDTH, 1, 4096);
  const height = savedInt(state.height, C.HEIGHT, 1, 4096);
  const init = C.init(width, height);
  const cx = savedInt(state.cx, init.cx, 0, 4096);
  const cy = savedInt(state.cy, init.cy, 0, 4096);
  const R = savedInt(state.R, init.R, 1, 4096);
  const angle = savedInt(state.angle, C.ANGLE_DEFAULT, C.ANGLE_MIN, C.ANGLE_MAX);
  const explored = state.explored === true;
  const s: State = { width, height, cx, cy, R, angle, explored, nSectors: 4 };
  const r = reading(C, s);

  return {
    stateVersion,
    width: s.width,
    height: s.height,
    cx: s.cx,
    cy: s.cy,
    R: s.R,
    angle: s.angle,
    explored: s.explored,
    result: C.result(s),
    init: { cx: init.cx, cy: init.cy, R: init.R },
    savedVsInit: {
      cx: cx - init.cx,
      cy: cy - init.cy,
      R: R - init.R,
      agrees: cx === init.cx && cy === init.cy && R === init.R,
    },
    reading: r,
    note:
      `Track.state saved the board ${width} x ${height}, centre (${cx}, ${cy}), radius ${R}, hinge angle ${angle}° and the explored flag. ` +
      `The core rebuilds that picture: the quarter-disks' hinges are at ${r.quarterDisks.map((d) => JSON.stringify(d.hingeCentre)).join(", ")}; ` +
      `the diamond is a square of side ${r.square.side} (2R) and area ${r.square.area} (4R²), equal to the vase's ${r.areas.vase}. ` +
      "The saved centre and radius " +
      (cx === init.cx && cy === init.cy && R === init.R
        ? "agree with init(width, height)."
        : "differ from init(width, height); the saved values were used for the reading."),
  };
}
