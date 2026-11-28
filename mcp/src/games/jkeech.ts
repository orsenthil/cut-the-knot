/*
 * run_game_logic actions and saved-position reader for Joseph Keech in Bride's Chair.
 *
 * The right triangle ABC has its right angle at C; the squares on the legs AC
 * and BC give the lines BE and AL, which cut off CF = CH. Drawing FZ parallel
 * to AC makes HCFZ a square of side AC*BC/(AC+BC), and the circle through its
 * four corners meets AB again at the altitude foot G, where four angles are 45°.
 *
 * Every number below is measured with the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["jkeech"].JkeechCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };

const GEOM_TOL = 1e-6;       // drawing units, for the equal-length and on-line checks
const ANGLE_TOL = 1e-9;      // radians, for the four 45° angles
const RIGHT_ANGLE_TOL = 2e-3; // radians allowed when the caller supplies C

const r = (v: number, places = 4) => {
  const k = 10 ** places;
  return Math.round(v * k) / k;
};
const xy = (p: Point) => ({ x: r(p.x, 3), y: r(p.y, 3) });
const deg = (radians: number) => r(radians * 180 / Math.PI, 4);
/** Residuals are tiny; keep their size instead of rounding them to zero. */
const sig = (v: number) => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/** Accept [x, y] (JSON args) or { x, y } (the page's saved position). */
function pointArg(v: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(v) && v.length === 2) {
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite x and y`);
  }
  return { x, y };
}

/** A saved corner may be missing or half-written; never fail the reader on it. */
function savedPoint(v: unknown): Point | null {
  try { return xy(pointArg(v, "point")); } catch { return null; }
}

/** Keep full precision for geometry; only the echoed fields are rounded. */
function positionPoint(v: unknown, fallback: Point): Point {
  try { return pointArg(v, "point"); } catch { return fallback; }
}

const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;

/** Perpendicular distance from p to the infinite line through a and b. */
function distanceToLine(C: Core, p: Point, a: Point, b: Point): number {
  const len = C.dist(a, b);
  return len > 0 ? Math.abs(cross(C.sub(b, a), C.sub(p, a))) / len : Infinity;
}

/**
 * The triangle the actions work on. A and B may be given as points; when C is
 * absent the core rebuilds it from the angle at A with a right angle at C, the
 * same construction the page uses when A or B is dragged. A supplied C is
 * checked to really carry the right angle.
 */
function readState(C: Core, args: Json) {
  const home = C.start({});
  const A = args.A === undefined ? home.A : pointArg(args.A, "A");
  const B = args.B === undefined ? home.B : pointArg(args.B, "B");
  const angleA = num(args, "angleA", home.angleA);
  if (!(angleA > 0 && angleA < Math.PI / 2)) {
    throw new Error('argument "angleA" must be in radians strictly between 0 and π/2 (0 and 90 degrees)');
  }
  if (C.dist(A, B) < 1e-6) throw new Error("A and B must be two different points");

  let Cpt: Point;
  if (args.C === undefined || args.C === null) {
    const built = C.computeC(A, B, angleA);
    if (!C.finite(built)) throw new Error("these A and B do not make a right triangle at C for this angleA");
    Cpt = built;
  } else {
    Cpt = pointArg(args.C, "C");
  }
  if (Math.abs(cross(C.sub(B, A), C.sub(Cpt, A))) < 1e-6) {
    throw new Error("A, B and C must not lie on one line");
  }
  const angleC = C.computeAngle(Cpt, A, B);
  if (!near(angleC, Math.PI / 2, RIGHT_ANGLE_TOL)) {
    throw new Error(`the right angle must be at C; here it is ${deg(angleC)} degrees. Supply C or change the points.`);
  }

  return {
    ...home, A, B, C: Cpt, angleA,
    showNames: args.showNames === true,
    showStatement: args.showStatement === true,
    showExtra: args.showExtra === true,
    explored: args.explored === true,
  };
}

function readGeometry(C: Core, args: Json) {
  const s = readState(C, args);
  const g = C.geometry(s) as any;
  if (!g.active || !C.finite(g.F) || !C.finite(g.H) || !C.finite(g.Z)) {
    throw new Error("this triangle is too flat for Keech's construction; move the corners apart");
  }
  return { s, g };
}

/** The four sides of the inner square HCFZ and the formula they satisfy. */
function squareReading(C: Core, g: any) {
  const a = C.dist(g.A, g.C), b = C.dist(g.B, g.C);
  const side = (a * b) / (a + b); // AC*BC/(AC+BC), the inscribed square's side
  const sides = { CF: g.CF, CH: g.CH, FZ: g.FZ, HZ: g.HZ };
  const u = C.sub(g.B, g.A);
  const len2 = C.sqDist(g.B, g.A);
  const t = ((g.Z.x - g.A.x) * u.x + (g.Z.y - g.A.y) * u.y) / len2;
  const zResidual = distanceToLine(C, g.Z, g.A, g.B);

  return {
    legs: { AC: r(a), BC: r(b) },
    points: { F: xy(g.F), H: xy(g.H), Z: xy(g.Z) },
    sideLengths: {
      CF: r(sides.CF), CH: r(sides.CH), FZ: r(sides.FZ), HZ: r(sides.HZ),
      fromFormulaACtimesBCoverSum: r(side),
    },
    checks: {
      CF_minus_CH: sig(sides.CF - sides.CH),
      allFourSidesEqual: Object.values(sides).every((v) => near(v, side, GEOM_TOL)),
      formulaHolds: near(sides.CF, side, GEOM_TOL),
      Z_distanceFromAB: sig(zResidual),
      Z_onSegmentAB: zResidual < GEOM_TOL && t >= 0 && t <= 1,
      Z_parameterAlongAB: r(t, 6),
    },
  };
}

/** The circle through H, C, F and Z, its second hit G on AB, and the four angles. */
function circleReading(C: Core, g: any) {
  const centre: Point = g.circle.c;
  const corners: Record<string, Point> = { H: g.H, C: g.C, F: g.F, Z: g.Z };
  const cornerResiduals = Object.fromEntries(
    Object.entries(corners).map(([name, p]) => [name, sig(C.dist(centre, p) - g.radius)]),
  );
  const angles = g.angles as Record<string, number> | null;
  const anglesDegrees = angles
    ? { FGB: deg(angles.FGB), FGC: deg(angles.FGC), HGC: deg(angles.HGC), HGA: deg(angles.HGA) }
    : null;

  return {
    circle: { center: xy(centre), radius: r(g.radius) },
    corners: Object.fromEntries(Object.entries(corners).map(([name, p]) => [name, xy(p)])),
    cornersOnCircleResiduals: cornerResiduals,
    G: C.finite(g.G) ? xy(g.G) : null,
    altitudeFoot: C.finite(g.foot) ? xy(g.foot) : null,
    G_minus_altitudeFoot: C.finite(g.G) && C.finite(g.foot) ? sig(C.dist(g.G, g.foot)) : null,
    G_distanceFromAB: C.finite(g.G) ? sig(distanceToLine(C, g.G, g.A, g.B)) : null,
    anglesDegrees,
    allFourAnglesAre45: !!angles && Object.values(angles).every((v) => near(v, Math.PI / 4, ANGLE_TOL)),
  };
}

export function actions(): GameActions {
  return {
    inscribed_square: {
      describe:
        "For a right triangle with its right angle at C, give A and B as [x, y] or { x, y } points, plus C or the angle at A in radians. Reports F = AL ∩ BC, H = BE ∩ AC and Z on the hypotenuse where FZ runs parallel to AC, then measures CF, CH, FZ and HZ: Keech's claim is that all four equal AC·BC/(AC+BC). Also checks that Z really lies on AB.",
      args: '{ "A": [153, 275], "B": [300, 275], "angleA": 0.5235987755982988 }',
      run: (args) => {
        const C = core();
        const { s, g } = readGeometry(C, args);
        return {
          triangle: {
            A: xy(s.A), B: xy(s.B), C: xy(s.C),
            angleA: r(s.angleA, 6), angleAtC: deg(C.computeAngle(s.C, s.A, s.B)),
          },
          ...squareReading(C, g),
          note:
            "The quarter turns that build the squares make triangle AKL similar to ACF and BDE to BCH, so CF = CH; the same similarity gives FZ = CF. With legs a = AC and b = BC the common side is a·b/(a+b), and Z is on the hypotenuse AB.",
        };
      },
    },
    keech_circle: {
      describe:
        "For the same right triangle (give A, B and either C or angleA), draw the circle through H, C, F and Z and find its second meeting G with AB. Checks that G is the foot of the altitude from C and measures ∠FGB, ∠FGC, ∠HGC and ∠HGA: Keech's added note says all four are 45 degrees.",
      args: '{ "A": [153, 275], "B": [300, 275], "C": [263.25, 211.34713282184376] }',
      run: (args) => {
        const C = core();
        const { s, g } = readGeometry(C, args);
        return {
          triangle: {
            A: xy(s.A), B: xy(s.B), C: xy(s.C),
            angleA: r(s.angleA, 6), angleAtC: deg(C.computeAngle(s.C, s.A, s.B)),
          },
          ...circleReading(C, g),
          note:
            "HCFZ is a square, so the midpoint of its diagonal FH is the centre of its circle. That circle cuts AB once at Z and once at the altitude foot G, and the four angles at G subtending the square's sides are each half a right angle.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const home = C.start({});
  const A = positionPoint(state.A, home.A);
  const B = positionPoint(state.B, home.B);
  const Cc = positionPoint(state.C, home.C);
  const angleA = num(state, "angleA", home.angleA);
  const glide = state.glideCircle && typeof state.glideCircle === "object"
    ? state.glideCircle as Json : null;

  const saved = {
    stateVersion,
    A: xy(A), B: xy(B), C: xy(Cc),
    angleA: r(angleA, 6),
    selected: typeof state.selected === "string" ? state.selected : null,
    glideCircle: glide
      ? { c: savedPoint(glide.c), r: num(glide, "r", 0) } : null,
    showNames: state.showNames === true,
    showStatement: state.showStatement === true,
    showExtra: state.showExtra === true,
    explored: state.explored === true,
  };

  const here = {
    ...home, A, B, C: Cc, angleA,
    selected: saved.selected,
    glideCircle: glide ? { c: savedPoint(glide.c) ?? home.A, r: num(glide, "r", 0) } : null,
    showNames: saved.showNames,
    showStatement: saved.showStatement,
    showExtra: saved.showExtra,
    explored: saved.explored,
  };
  const g = C.geometry(here) as any;
  if (!g.active || !C.finite(g.F) || !C.finite(g.H) || !C.finite(g.Z)) {
    return {
      ...saved,
      active: false,
      result: C.result(here),
      note: "The saved triangle is too flat for Keech's construction; the page asks for a corner to be dragged open.",
    };
  }

  return {
    ...saved,
    active: true,
    angleAtC: deg(C.computeAngle(Cc, A, B)),
    ...squareReading(C, g),
    ...circleReading(C, g),
    result: C.result(here),
    note:
      "The saved triangle is measured with the same quarter-turn construction the page draws: the four sides of HCFZ, the formula AC·BC/(AC+BC), the circle through its corners, the point G on AB and the four angles there.",
  };
}
