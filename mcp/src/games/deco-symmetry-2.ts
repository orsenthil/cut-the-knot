/*
 * run_game_logic actions and saved-position reader for Deco Symmetry 2
 * (Bogomolny's DecoSymmetry2 applet).
 *
 * The page states Which Way Did the Bicycle Go? #9: cut any triangle into
 * pieces that, using only rotations and translations (never flips), make its
 * mirror image. The applet's Compute() names A the vertex at the largest angle,
 * drops the perpendicular AD to BC, and cuts from D to the midpoints E of AB
 * and F of AC. That gives three pieces in two cuts: triangle EBD, quadrilateral
 * FAED and triangle FDC. The sibling Deco Symmetry instead uses four pieces
 * for a general triangle and, for an acute triangle with "Acute special"
 * ticked, joins the circumcenter to the three corners for three pieces; this
 * applet has neither option and always uses the altitude foot D.
 *
 * Every number below comes from the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["deco-symmetry-2"].DecoSymmetry2Core;

type Pt = { x: number; y: number };
type Board = { width: number; height: number; K: Pt; L: Pt; M: Pt };

const TOL = 1e-6;
const round = (v: number, digits = 4): number | null =>
  Number.isFinite(v) ? Math.round(v * 10 ** digits) / 10 ** digits : null;
const deg = (radians: number): number | null => round((radians * 180) / Math.PI, 2);
const xy = (p: Pt | null | undefined): [number, number] | null =>
  p ? [round(p.x)!, round(p.y)!] : null;
const poly = (points: Pt[]): [number, number][] => points.map((p) => xy(p)!);

/** Tool arguments use [x, y]; the page saves points as { x, y }. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite x and y coordinates`);
  }
  return { x, y };
}

/** K, L, M are the draggable corners of the page's board. */
function readBoard(args: Json): Board {
  const home = core().start() as Board;
  const width = num(args, "width", home.width);
  const height = num(args, "height", home.height);
  if (!(width > 0) || !(height > 0)) {
    throw new Error('"width" and "height" must be positive');
  }
  const K = args.K === undefined ? home.K : readPoint(args.K, "K");
  const L = args.L === undefined ? home.L : readPoint(args.L, "L");
  const M = args.M === undefined ? home.M : readPoint(args.M, "M");
  const cross = (L.x - K.x) * (M.y - K.y) - (L.y - K.y) * (M.x - K.x);
  if (Math.abs(cross) < TOL) {
    throw new Error("K, L and M must form a non-degenerate triangle");
  }
  return { width, height, K, L, M };
}

/** The core's construction and measurements for one board. */
function reading(board: Board) {
  const C = core();
  const c = C.compute(board) as {
    A: Pt; B: Pt; C: Pt; P: Pt;
    Ap: Pt; Bp: Pt; Cp: Pt;
    D: Pt; E: Pt; F: Pt;
    Dp: Pt; Ep: Pt; Fp: Pt;
    pieces: Pt[][]; targets: Pt[][]; cuts: Pt[][];
    angles: number[];
  };
  const m = C.measurements(board) as {
    triangleArea: number; mirrorArea: number;
    sourceAreas: number[]; targetAreas: number[];
    footT: number; footOnSide: boolean; rightAngle: boolean;
    pieces: number; cuts: number; partition: boolean; rotations: boolean[];
  };
  // The core's FindLargestAngle uses three >= tests in the order K, L, M.
  const [aK, aL, aM] = c.angles;
  let vertexAtLargestAngle = "K";
  if (aL >= aK && aL >= aM) vertexAtLargestAngle = "L";
  if (aM >= aK && aM >= aL) vertexAtLargestAngle = "M";
  const turns = c.pieces.map((piece, i) =>
    (C.motion(piece, c.targets[i]) as { angle: number }).angle);

  return {
    board: { width: board.width, height: board.height },
    corners: { K: xy(board.K), L: xy(board.L), M: xy(board.M) },
    vertexAtLargestAngle,
    anglesDeg: { K: deg(aK), L: deg(aL), M: deg(aM) },
    orderedTriangle: { A: xy(c.A), B: xy(c.B), C: xy(c.C) },
    construction: {
      // A is the largest-angle vertex, D the foot on BC, E/F the two midpoints.
      footD: xy(c.D),
      midpointE_of_AB: xy(c.E),
      midpointF_of_AC: xy(c.F),
      cuts: c.cuts.map((segment) => poly(segment)),
    },
    pieces: c.pieces.map((piece, i) => ({
      source: poly(piece),
      target: poly(c.targets[i]),
      rotationDeg: deg(turns[i]),
      reachesByRotation: m.rotations[i],
    })),
    mirror: {
      A: xy(c.Ap), B: xy(c.Bp), C: xy(c.Cp),
      footD: xy(c.Dp), midpointE: xy(c.Ep), midpointF: xy(c.Fp),
    },
    areas: {
      triangle: round(m.triangleArea, 2),
      mirror: round(m.mirrorArea, 2),
      sourcePieces: m.sourceAreas.map((a) => round(a, 2)),
      targetPieces: m.targetAreas.map((a) => round(a, 2)),
    },
    checks: {
      cuts: m.cuts,
      pieces: m.pieces,
      footOnSideBC: m.footOnSide,
      footParameterT: round(m.footT, 6),
      altitudePerpendicularToBC: m.rightAngle,
      piecesTileBothTriangles: m.partition,
      everyPieceRotatesIntoPlace: m.rotations.every(Boolean),
    },
    note: `A is ${vertexAtLargestAngle}; both cuts start at the altitude foot D and end at a midpoint, so two cuts give three pieces that rotate (never flip) into the mirror image.`,
  };
}

export function actions(): GameActions {
  return {
    two_cut_dissection: {
      describe:
        "For a triangle with draggable corners K, L, M on the page's board (500 by 400 by default; pass width and height to change it), report the two-cut dissection: the vertex A at the largest angle, the foot D of the perpendicular to BC, the midpoints E of AB and F of AC, the three pieces (triangle EBD, quadrilateral FAED, triangle FDC), where each lands on the mirrored triangle and each piece's rotation angle in degrees. It checks that the foot lies on BC, AD is perpendicular to BC, the pieces tile both triangles and every piece reaches its target by a rotation plus translation without a flip.",
      args: '{ "K": [220.6667, 250], "L": [100, 84.5299], "M": [58.3333, 315.4701] }',
      run: (args) => reading(readBoard(args)),
    },
    circumcenter_sibling: {
      describe:
        "Compare this applet's dissection with its circumcenter sibling Deco Symmetry: this core always cuts from the altitude foot D of the largest-angle vertex to the two midpoints, giving three pieces in two cuts, while the sibling uses four pieces for a general triangle and, for an acute triangle with 'Acute special' ticked, joins the circumcenter to the three corners for three pieces. Runs the real core on the given triangle and reports whether it is acute, what this applet actually draws, and the sibling's two options.",
      args: '{ "K": [220.6667, 250], "L": [100, 84.5299], "M": [58.3333, 315.4701] }',
      run: (args) => {
        const board = readBoard(args);
        const report = reading(board);
        const angles = (core().compute(board) as { angles: number[] }).angles;
        const acute = angles.every((a) => a < Math.PI / 2);
        return {
          ...report,
          acute,
          thisApplet: {
            construction: "altitude foot D of the largest-angle vertex joined to the midpoints of AB and AC",
            pieces: 3,
            cuts: 2,
            usesCircumcenter: false,
            hasAcuteSwitch: false,
          },
          sibling: {
            general: { construction: "altitude foot joined to the midpoints of the two sides", pieces: 4 },
            acuteSpecial: {
              condition: "acute triangle and 'Acute special' ticked",
              construction: "circumcenter joined to the three corners",
              pieces: 3,
            },
          },
          note: acute
            ? `This triangle is acute, so the sibling's circumcenter switch would be available, but Deco Symmetry 2 has no such switch: it still uses D and the two midpoints, three pieces in two cuts.`
            : `This triangle is not acute, so the sibling's circumcenter switch would not be available; in any case Deco Symmetry 2 has no switch and always uses D and the two midpoints, three pieces in two cuts.`,
        };
      },
    },
  };
}

/** The page saves only the board and its three corners; add the core's reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Deco Symmetry 2 state version ${stateVersion}`);
  }
  const board = readBoard(state);
  return {
    stateVersion,
    width: board.width,
    height: board.height,
    K: { x: board.K.x, y: board.K.y },
    L: { x: board.L.x, y: board.L.y },
    M: { x: board.M.x, y: board.M.y },
    reading: reading(board),
  };
}
