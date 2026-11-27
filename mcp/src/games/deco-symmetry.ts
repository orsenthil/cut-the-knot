/*
 * Tutor actions and saved-position reader for Deco Symmetry.
 *
 * The page saves its three draggable corners and three checkboxes with
 * Track.state; the core turns those into the cut pieces and their motion to
 * the mirror triangle (see src/generated/cores/deco-symmetry.js at build time).
 * Every number reported here comes from that core, not from a second copy of
 * the construction. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["deco-symmetry"].DecoSymmetryCore as any;

type Point = { x: number; y: number };

/** Floating-point slack for the core's exact constructions. */
const TOL = 1e-7;
/** The animation rebuilds points from polar coordinates; allow sub-pixel drift. */
const ANIMATION_TOL = 1e-4;

/** Core points can be NaN (e.g. a circumcentre of a flat triangle); JSON cannot. */
function safeNumber(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function safePoint(p: unknown): Point | null {
  if (!p || typeof p !== "object") return null;
  const q = p as Point;
  return safeNumber(q.x) === null || safeNumber(q.y) === null ? null : { x: q.x, y: q.y };
}

function readPoint(value: unknown, label: string): Point {
  if (!value || typeof value !== "object") throw new Error(`${label} must be a point with x and y`);
  const q = value as Json;
  const x = Number(q.x), y = Number(q.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} must have numeric x and y`);
  }
  const C = core();
  if (x < 0 || x > C.WIDTH || y < 0 || y > C.HEIGHT) {
    throw new Error(`${label} must lie on the ${C.WIDTH} by ${C.HEIGHT} board`);
  }
  return { x, y };
}

function readBoolean(args: Json, key: string): boolean {
  const value = args[key];
  if (value !== undefined && typeof value !== "boolean") {
    throw new Error(`${key} must be true or false`);
  }
  return value === true;
}

/** The core state a set of arguments (or a saved position) describes. */
function readState(args: Json) {
  const C = core();
  const base = C.start();
  const state = C.start({
    K: args.K === undefined ? base.K : readPoint(args.K, "K"),
    L: args.L === undefined ? base.L : readPoint(args.L, "L"),
    M: args.M === undefined ? base.M : readPoint(args.M, "M"),
    specialAcute: readBoolean(args, "specialAcute"),
  });
  const f = C.compute(state);
  if (!f.angles.every((a: number) => Number.isFinite(a))) {
    throw new Error("K, L and M must be three distinct corners with defined angles");
  }
  return { state, f };
}

/** The core's cut points, with NaN points replaced by null. */
function cutPoints(f: any) {
  if (f.specialAcute) {
    return {
      mode: "circumcentre",
      O: safePoint(f.O), Op: safePoint(f.Op),
      radii: [f.A, f.B, f.C].map((p: Point) =>
        f.O ? safeNumber(core().dist(f.O, p)) : null),
    };
  }
  return {
    mode: "altitude and side midpoints",
    D: safePoint(f.D), E: safePoint(f.E), F: safePoint(f.F),
    Dp: safePoint(f.Dp), Ep: safePoint(f.Ep), Fp: safePoint(f.Fp),
  };
}

/** Each piece's direct (rotation + translation) landing on its mirror target. */
function pieceLandings(C: any, f: any) {
  return f.pieces.map((piece: any, i: number) => {
    const m = C.rigidMap(piece.from, piece.to);
    return {
      index: i,
      from: piece.from.map(safePoint),
      to: piece.to.map(safePoint),
      turnDegrees: m ? safeNumber(m.angle * 180 / Math.PI) : null,
      landingError: m ? safeNumber(m.error) : null,
      landsExactly: !!m && m.error <= TOL,
      directlyCongruent: C.directlyCongruent(piece.from, piece.to) === true,
    };
  });
}

/*
 * A-E-D-F: E and F are midpoints of the hypotenuses AB and AC of the right
 * triangles ADB and ADC, so AE = ED and AF = FD. Both E and F therefore lie
 * on the perpendicular bisector of AD, which is the kite's axis of symmetry.
 * The two core pieces EDA and FAD can move as that one joined piece.
 */
function kite(C: any, f: any) {
  if (f.specialAcute || !f.D || !f.E || !f.F) return null;
  const A = f.A, D = f.D, E = f.E, F = f.F;
  const AE = C.dist(A, E), ED = C.dist(E, D);
  const DF = C.dist(D, F), FA = C.dist(F, A);
  const ef = C.sub(F, E), ad = C.sub(D, A);
  const fromEToMid = C.sub(C.mid(A, D), E);
  const efLength = Math.max(1, C.dist(E, F));
  const cross = fromEToMid.x * ef.y - fromEToMid.y * ef.x;
  return {
    vertices: { A, E, D, F },
    sides: { AE, ED, DF, FA },
    equalPairs: {
      AE_ED: Math.abs(AE - ED) <= TOL,
      DF_FA: Math.abs(DF - FA) <= TOL,
    },
    efPerpendicularToAD: Math.abs(C.dot(ef, ad)) <= 1e-6 * efLength * Math.max(1, C.dist(A, D)),
    midpointOfADOnEF: Math.abs(cross) <= 1e-6 * efLength * efLength,
    axis: "EF",
    cuts: ["DE", "DF"],
    joinedPieceMovesDirectly: C.directlyCongruent(
      [A, E, D, F], [f.Dp, f.Ep, f.Ap, f.Fp]) === true,
  };
}

function mirror(f: any) {
  return {
    axisX: core().WIDTH / 2,
    centroid: safePoint(f.G),
    imageCentroid: safePoint(f.P),
    Ap: safePoint(f.Ap), Bp: safePoint(f.Bp), Cp: safePoint(f.Cp),
  };
}

export function actions(): GameActions {
  return {
    dissection: {
      describe:
        "Cut the triangle K,L,M (the opening triangle if omitted) as the applet does: the altitude from the largest-angle corner and the midpoints of the two sides, or, for an acute triangle with specialAcute true, the circumcentre. Report the cut points, the mirror triangle, each piece's exact rotation-and-slide landing, and the A-E-D-F kite that reduces the four pieces to the page's two cuts.",
      args: '{ "K": {"x":152,"y":156.25}, "L": {"x":58.33,"y":52.83}, "M": {"x":58.33,"y":197.17} }',
      run: (args) => {
        const C = core();
        const { state, f } = readState(args);
        const pieces = pieceLandings(C, f);
        return {
          K: state.K, L: state.L, M: state.M,
          largestAngleFirst: { A: f.A, B: f.B, C: f.C },
          anglesDegrees: f.angles.map((a: number) => a * 180 / Math.PI),
          acute: f.acute === true,
          specialAcuteApplied: f.specialAcute === true,
          mirror: mirror(f),
          cuts: cutPoints(f),
          pieceCount: f.pieces.length,
          pieces,
          allLandExactly: pieces.every((p: any) => p.landsExactly),
          twoCutKite: kite(C, f),
          note: f.specialAcute
            ? "For an acute triangle the circumcentre gives three pieces; each reaches the mirror triangle by a turn and a slide, with no flip."
            : "The altitude and the two midpoints give four pieces. The two that share AD form the kite A-E-D-F (AE = ED, AF = FD), so the only cuts needed are DE and DF, leaving three pieces.",
          status: C.describe(f, state),
        };
      },
    },
    move_them: {
      describe:
        "Run the page's Move them motion on K,L,M (opening triangle if omitted; specialAcute true selects the acute three-piece cut). Report each piece's pivot, destination, directed turn in degrees, and its frames at the start, halfway and end of the 50-step animation, with the distance from the final frame to its target on the mirror triangle (sub-pixel drift from the core's polar reconstruction is expected).",
      args: '{ "K": {"x":152,"y":156.25}, "L": {"x":58.33,"y":52.83}, "M": {"x":58.33,"y":197.17}, "specialAcute": true }',
      run: (args) => {
        const C = core();
        const { state, f } = readState(args);
        const frames = f.pieces.map((piece: any, i: number) => {
          const g = C.goal(piece);
          const end = C.frame(piece, 1);
          const error = Math.max(...end.map((p: Point, j: number) => C.dist(p, piece.to[j])));
          return {
            index: i,
            pivot: safePoint(g.focus),
            destination: safePoint(g.goal),
            turnDegrees: safeNumber(g.fullAngle * 180 / Math.PI),
            start: C.frame(piece, 0).map(safePoint),
            halfway: C.frame(piece, 0.5).map(safePoint),
            end: end.map(safePoint),
            endError: safeNumber(error),
          };
        });
        return {
          K: state.K, L: state.L, M: state.M,
          steps: C.NSTEPS,
          specialAcuteApplied: f.specialAcute === true,
          pieceCount: f.pieces.length,
          landingTolerance: ANIMATION_TOL,
          frames,
          allReachMirror: frames.every(
            (frame: any) => frame.endError !== null && frame.endError <= ANIMATION_TOL),
          note: "The pieces slide their centres in a straight line and turn as they go; every end frame coincides with its target on the mirror triangle up to a tiny rounding error, and no piece is flipped.",
        };
      },
    },
  };
}

/** What the core says about the triangle and options the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const { state: here, f } = readState(state);
  const pieces = pieceLandings(C, f);
  const twoCutKite = kite(C, f);
  return {
    stateVersion,
    K: here.K, L: here.L, M: here.M,
    showNames: here.showNames === true,
    showHint: here.showHint === true,
    specialAcute: here.specialAcute === true,
    moving: here.moving === true,
    done: here.done === true,
    largestAngleFirst: { A: f.A, B: f.B, C: f.C },
    anglesDegrees: f.angles.map((a: number) => a * 180 / Math.PI),
    acute: f.acute === true,
    specialAcuteApplied: f.specialAcute === true,
    mirror: mirror(f),
    cuts: cutPoints(f),
    pieceCount: f.pieces.length,
    allPiecesLandExactly: pieces.every((p: any) => p.landsExactly),
    twoCutKite,
    status: C.describe(f, here),
    note: f.specialAcute
      ? "The acute special cut uses the circumcentre and three pieces; the pieces reach the mirror triangle without a flip."
      : twoCutKite
        ? "The two pieces sharing AD form the kite A-E-D-F, so two cuts DE and DF leave three pieces to move."
        : "The altitude from the largest-angle corner and the two side midpoints give four pieces.",
  };
}
