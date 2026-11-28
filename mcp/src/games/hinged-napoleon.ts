/*
 * run_game_logic actions and saved-position reader for Hinged Napoleon.
 *
 * The real core is hinged-napoleon/hinged-napoleon-core.js, copied into
 * src/generated/cores/ at build time. Every number reported here is measured
 * by it. Coordinates are board units of the applet's 640 x 460 viewBox, y down.
 *
 * Erect equilateral triangles on the sides BC, CA, AB and take their centroids
 * Ac, Bc, Cc: Napoleon's theorem says Ac, Bc, Cc themselves form an equilateral
 * triangle. Two of the three corner pieces can swivel about their centre dots;
 * at 120 degrees the two chosen corners land on the third corner and the pieces
 * close into the dissection of AcBcCc. At each corner of ABC the rays to the two
 * nearby centres enclose an angle, and the three such angles sum to 360 degrees
 * whenever every angle of ABC is at most 120 degrees.
 *
 * This page is an illustration: there is no win and no loss. See _shared.ts
 * for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["hinged-napoleon"].HingedNapoleonCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Options = { angle: number; swivel: number; names: boolean };
type Orientation = -1 | 1;
type State = { A: Point; B: Point; C: Point; options: Options; explored: boolean };
type Geometry = {
  A: Point; B: Point; C: Point;
  Ap: Point; Bp: Point; Cp: Point;
  Ac: Point; Bc: Point; Cc: Point;
  Aq: Point; Bq: Point; Cq: Point;
  hinges: Point[]; polys: Point[][];
  centres: Record<string, Point>;
  star: Point; starKey: string;
  centreKeys: string[]; landingIndices: number[]; starIndices: number[];
  hingedCorners: Point[]; landingCorner: Point; landingNames: string[];
  sides: number[]; sideSpread: number;
  baseAngles: number[]; hingeAngles: number[]; angleGaps: number[];
  reflectionSpread: number; fermatAngleSpread: number; dissectionError: number;
  allAnglesAtMost120: boolean;
  measures: { tol: number; scale: number };
  claims: Record<string, boolean>;
};

/* The geometry is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : r6(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const close = (a: number, b: number, scale = 1): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-6 * Math.max(1, scale);
const closePoint = (p: Point | null, q: Point, scale: number): boolean =>
  p !== null && close(p.x, q.x, scale) && close(p.y, q.y, scale);

/** Accept both the page's saved { x, y } and short [x, y] JSON. */
function asPoint(raw: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or {x, y}`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [num(o, "x"), num(o, "y")];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or {x, y}, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${label}" is not a finite point`);
  return { x, y };
}

/** The applet's two scrollbars and its checkbox, validated against the core. */
function readOptions(C: Core, args: Json): Options {
  const raw = (args.options !== undefined && args.options !== null && typeof args.options === "object"
    ? args.options : args) as Json;
  const lim = C.LIMITS;
  const integer = (key: "angle" | "swivel"): number => {
    const value = raw[key];
    if (value === undefined || value === null) return lim[key].initial as number;
    const n = Number(value);
    if (!Number.isInteger(n)) throw new Error(`"${key}" must be an integer`);
    if (n < lim[key].min || n > lim[key].max) {
      throw new Error(`"${key}" must be between ${lim[key].min} and ${lim[key].max}`);
    }
    return C.normalize(key, n) as number;
  };
  let names = false;
  if (raw.names !== undefined && raw.names !== null) {
    if (typeof raw.names !== "boolean") throw new Error('"names" must be true or false');
    names = raw.names;
  }
  return { angle: integer("angle"), swivel: integer("swivel"), names };
}

/** The opening triangle unless a corner is overridden, then the options. */
function readState(C: Core, args: Json, options: Options): State {
  let s = C.start(options) as State;
  for (const name of ["A", "B", "C"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.move(s, name, asPoint(raw, name)) as State;
  }
  return s;
}

function readOrientation(args: Json): Orientation {
  const raw = (args.options !== undefined && args.options !== null && typeof args.options === "object"
    ? args.options : args) as Json;
  const v = raw.orientation;
  if (v === undefined || v === null) return -1;
  const n = Number(v);
  if (n !== -1 && n !== 1) throw new Error('"orientation" must be -1 (outward) or 1 (inward)');
  return n as Orientation;
}

/** Everything the real core says about one drawing. */
function reading(C: Core, s: State, orientation: Orientation): Geometry | null {
  return C.compute(s.A, s.B, s.C, s.options.angle, s.options.swivel, orientation) as Geometry | null;
}

const OPENING =
  '{"A":[325,115],"B":[426.6666666666667,230],"C":[295.38461538461536,245.33333333333334]}';
const CLOSED = '{"angle":120,"swivel":0}';

export function actions(): GameActions {
  return {
    napoleon_centres: {
      describe:
        "For triangle corners A, B, C (each [x, y] or {x, y} in the applet's 640 x 460 board, y down; omit any to keep the opening triangle), erect equilateral triangles on BC, CA, AB and report their outer tips Ap, Bp, Cp and the three centroids Ac, Bc, Cc. Reports the sides of triangle AcBcCc and their spread against the core's tolerance, so you can check Napoleon's theorem that it is equilateral, plus the three corner angles of ABC and the Fermat clue that all angles are at most 120 degrees. Integer angle (0-120), swivel (0 = B,C; 1 = A,C; 2 = A,B), names and orientation (-1 outward, 1 inward) may be set; defaults are the opening triangle with angle 0, swivel 0, names off and outward triangles.",
      args: OPENING,
      run: (args) => {
        const C = core();
        const options = readOptions(C, args);
        const s = readState(C, args, options);
        const orientation = readOrientation(args);
        const g = reading(C, s, orientation);
        if (!g) throw new Error("A, B and C must be finite points on the board");
        return {
          board: C.VIEW,
          triangle: {
            A: pt(g.A), B: pt(g.B), C: pt(g.C),
            anglesDegrees: g.baseAngles.map(r6), allAnglesAtMost120: g.allAnglesAtMost120 === true,
          },
          equilateralTips: { Ap: pt(g.Ap), Bp: pt(g.Bp), Cp: pt(g.Cp) },
          centres: { Ac: pt(g.Ac), Bc: pt(g.Bc), Cc: pt(g.Cc) },
          centreTriangle: {
            sides: { AcBc: r6(g.sides[0]), BcCc: r6(g.sides[1]), CcAc: r6(g.sides[2]) },
            sideSpread: r6(g.sideSpread), tol: maybe(g.measures.tol),
            equilateral: g.claims.napoleonEquilateral === true,
          },
          fermatClue: {
            reflectionSpread: r6(g.reflectionSpread), fermatAngleSpread: r6(g.fermatAngleSpread),
            reflectionsMeet: g.claims.reflectionsMeet === true, fermatPoint: g.claims.fermatPoint === true,
          },
          claims: { ...g.claims },
          status: C.describe(s),
          note:
            "Ac, Bc and Cc are the centroids of the equilateral triangles built on BC, CA and AB: each is the average of its side's two corners and its outer tip. Napoleon's theorem says the three centroids form an equilateral triangle, checked here by comparing the three sides AcBc, BcCc and CcAc against the core's drawing tolerance. The core also reflects each corner in the line through the other two centres: when every angle of ABC is at most 120 degrees those reflected rays meet 120 degrees apart (the Fermat clue). This is an illustration with no win or loss; the tracker records exploration.",
        };
      },
    },

    hinge_dissection: {
      describe:
        "On the same triangle, swivel two of the equilateral pieces about their centre dots. swivel picks the pair (0 = B,C about Cc and Bc; 1 = A,C; 2 = A,B) and angle is an integer number of degrees from 0 to 120; at 120 the two chosen corners land exactly on the third corner and the pieces close into the dissection of AcBcCc. Reports the pivot centres, the four hinge points, the five pieces, the hinged corners with the corner they land on, the star point where the free centres meet, the three hinge angles at A, B, C and their sum (360 degrees), the dissection error and all seven claims. names and orientation (-1 outward, 1 inward) may be set; defaults are angle 120, swivel 0 on the opening triangle.",
      args: CLOSED,
      run: (args) => {
        const C = core();
        const options = readOptions(C, args);
        const s = readState(C, args, options);
        const orientation = readOrientation(args);
        const g = reading(C, s, orientation);
        if (!g) throw new Error("A, B and C must be finite points on the board");
        const [firstName, secondName, thirdName] = g.landingNames;
        const pivots = Object.fromEntries(g.centreKeys.map((key) => [key, pt(g.centres[key])]));
        const hingeSum = g.hingeAngles.reduce((a, b) => a + b, 0);
        return {
          board: C.VIEW,
          triangle: {
            A: pt(g.A), B: pt(g.B), C: pt(g.C),
            anglesDegrees: g.baseAngles.map(r6), allAnglesAtMost120: g.allAnglesAtMost120 === true,
          },
          options: {
            angle: s.options.angle, swivel: s.options.swivel,
            swivelName: C.SWIVEL_NAMES[s.options.swivel], names: s.options.names, orientation,
          },
          pivots,
          hinges: g.hinges.map(pt),
          pieces: g.polys.map((poly) => poly.map(pt)),
          hinged: {
            corners: g.hingedCorners.map(pt), names: [firstName, secondName],
            landingCorner: pt(g.landingCorner), landingName: thirdName,
            atFullTurn: s.options.angle === C.LIMITS.angle.max,
            cornersLand: g.claims.hingedCornersLand === true,
          },
          star: { point: pt(g.star), key: g.starKey, centresMeet: g.claims.starCentresMeet === true },
          hingeAngles: {
            atA: r6(g.hingeAngles[0]), atB: r6(g.hingeAngles[1]), atC: r6(g.hingeAngles[2]),
            sum: r6(hingeSum), sums360: g.claims.angleSums360 === true,
          },
          angleGaps: g.angleGaps.map(r6),
          dissection: {
            error: r6(g.dissectionError), scale: maybe(g.measures.scale),
            closed: g.claims.dissection === true,
          },
          claims: { ...g.claims },
          status: C.describe(s),
          note:
            `Turning about the centres of the equilateral triangles on the ${C.SWIVEL_NAMES[s.options.swivel]} sides moves two corners of ABC. ` +
            (s.options.angle === C.LIMITS.angle.max
              ? `At the full 120 degrees, ${firstName} and ${secondName} land on ${thirdName} and the two hinged pieces close onto the dissection of AcBcCc. `
              : `At ${s.options.angle} degrees the pieces are part-way through the turn; slide the angle to 120 to close the hinges. `) +
            "At each corner of ABC the rays to the two nearby centres enclose an angle, and the three such angles add to 360 degrees whenever all angles of ABC are at most 120 degrees; that is why the pieces fit without overlap. " +
            "The area identity behind the dissection holds for every triangle, and the star point is where the two free corners of the turning pieces meet at the full turn. " +
            "This is an illustration with no win or loss.",
        };
      },
    },
  };
}

const savedNum = (v: unknown): number | null => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function savedPoint(v: unknown): Point | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Json;
  const x = savedNum(o.x), y = savedNum(o.y);
  return x === null || y === null ? null : { x, y };
}

function savedPoly(v: unknown): (Point | null)[][] | null {
  if (!Array.isArray(v)) return null;
  return v.map((poly) => Array.isArray(poly) ? poly.map(savedPoint) : []);
}

/** Echo the fields Track.state saved plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Hinged Napoleon state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hinged Napoleon position must be an object");
  }
  const C = core();
  const saved = {
    A: savedPoint(state.A), B: savedPoint(state.B), C: savedPoint(state.C),
    Ac: savedPoint(state.Ac), Bc: savedPoint(state.Bc), Cc: savedPoint(state.Cc),
    movingPieces: savedPoly(state.movingPieces), star: savedPoint(state.star),
    options: state.options && typeof state.options === "object" ? state.options as Json : null,
    claims: state.claims && typeof state.claims === "object" ? state.claims as Json : null,
    measures: state.measures && typeof state.measures === "object" ? state.measures as Json : null,
  };

  let s: State;
  let savedReadable = true;
  try {
    s = readState(C, state, readOptions(C, state));
  } catch {
    s = C.start({}) as State;
    savedReadable = false;
  }
  const g = savedReadable ? (C.geometry(s) as Geometry | null) : null;
  const savedClaims = (saved.claims ?? {}) as Json;
  const savedMeasures = (saved.measures ?? {}) as Json;
  const claimAgreement = g
    ? Object.fromEntries(Object.entries(g.claims).map(([key, value]) => [
        key, savedClaims[key] === undefined ? null : savedClaims[key] === value,
      ]))
    : null;
  const measureAgreement = g
    ? Object.fromEntries(Object.keys(g.measures).map((key) => {
        const raw = savedMeasures[key];
        return [key, typeof raw === "number" ? close(raw, g.measures[key as keyof typeof g.measures]) : null];
      }))
    : null;
  const scale = g ? g.measures.scale : 1;
  const savedPointsMatchCore = g ? {
    Ac: closePoint(saved.Ac, g.Ac, scale),
    Bc: closePoint(saved.Bc, g.Bc, scale),
    Cc: closePoint(saved.Cc, g.Cc, scale),
    star: closePoint(saved.star, g.star, scale),
    movingPieces: [0, 1].map((i) => {
      const piece = saved.movingPieces ? saved.movingPieces[i] : undefined;
      const expected = g.polys[3 + i];
      return !!piece && !!expected && piece.length === expected.length &&
        piece.every((p, j) => closePoint(p, expected[j], scale));
    }),
  } : null;

  return {
    ...state,
    stateVersion,
    savedReadable,
    saved,
    triangle: g ? { A: pt(g.A), B: pt(g.B), C: pt(g.C), anglesDegrees: g.baseAngles.map(r6) } : null,
    centres: g ? { Ac: pt(g.Ac), Bc: pt(g.Bc), Cc: pt(g.Cc) } : null,
    centreTriangle: g ? {
      sides: g.sides.map(r6), sideSpread: r6(g.sideSpread),
      equilateral: g.claims.napoleonEquilateral === true,
    } : null,
    hingeAngles: g ? {
      atA: r6(g.hingeAngles[0]), atB: r6(g.hingeAngles[1]), atC: r6(g.hingeAngles[2]),
      sum: r6(g.hingeAngles.reduce((a, b) => a + b, 0)), sums360: g.claims.angleSums360 === true,
    } : null,
    claims: g ? { ...g.claims } : null,
    claimAgreement,
    measureAgreement,
    savedPointsMatchCore,
    status: g ? C.describe(s) : null,
    isIllustration: C.result(s) === null,
    note:
      "Track.state saves the three corners A,B,C, the three centres Ac,Bc,Cc, the two moving pieces, the star point, the angle/swivel/names options and the core's own claims and measures. The real core rebuilds the same diagram from the saved corners and options alone (outward orientation, as the page draws it), so every saved number can be checked against a fresh computation. " +
      (savedReadable
        ? "The equilateral centre triangle, the 120-degree hinge closure and the angle-sum-360 condition are all measured again above. "
        : "The saved corners or options could not be read, so the core reading is null. ") +
      "This is an illustration: there is no win or loss, only exploration.",
  };
}
