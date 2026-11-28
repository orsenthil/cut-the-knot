/*
 * run_game_logic actions and saved-position reader for Hatzipolakis Triangle
 * (Bogomolny's HatzipolakisTriangle applet).
 *
 * In triangle ABC the midpoints of BC, CA, AB are D, E, F; X, Y, Z are the
 * points where the incircle touches those sides; M and N are the feet of the
 * perpendiculars from A onto the bisectors BI and CI. The page's two claims
 * are that M, N, E, F lie on one line and that X-Y-M and X-Z-N are straight.
 *
 * The core's idea: in right triangle ABM the midpoint F of the hypotenuse AB
 * is the circumcentre, so FM = AF = BF = AB/2 and FM is parallel to BC; hence
 * M lies on the midline EF. Tangent lengths then give EM = |AB - BC|/2 = EY,
 * which makes X, Y, M straight, and reflecting at C gives N and Z. Two caveats
 * matter when checking the page: the signed chain EM = AB/2 - BC/2 flips when
 * AB < BC (lengths only agree in absolute value), and the angle comparison
 * angle XCE = angle CEM is between two lines, so as ordinary smaller angles
 * the pair can be supplementary. The core accepts both.
 *
 * Every number below comes from the real core in
 * hatzipolakis-triangle/hatzipolakis-triangle-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * applet's 400 x 300 view, y downward. This is an illustration, so there is no
 * win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Line = { a: number; b: number; c: number };
type Sides = { a: number; b: number; c: number };
type State = { A: Pt; B: Pt; C: Pt; width: number; height: number };
type Construction = {
  ok: boolean; sides: Sides;
  I: Pt | null; D: Pt | null; E: Pt | null; F: Pt | null;
  X: Pt | null; Y: Pt | null; Z: Pt | null; M: Pt | null; N: Pt | null;
  radius: number | null;
  Ab: Pt | null; Ac: Pt | null;
  Ba: Pt | null; Bc: Pt | null; Ca: Pt | null; Cb: Pt | null;
  AB: Line | null; BC: Line | null; CA: Line | null;
  AI: Line | null; BI: Line | null; CI: Line | null;
  XY: Line | null; YZ: Line | null; ZX: Line | null; EF: Line | null;
  cabart: Pt | null;
};
type Measurements = {
  ok: boolean; scale: number; sides: Sides; radius: number;
  FM: number; AF: number; BF: number;
  EN: number; AE: number; CE: number;
  EM: number; EY: number; FN: number; FZ: number;
  angleXCE: number; angleCEM: number; angleXYC: number; angleEYM: number;
};
type Claims = {
  mnEfCollinear: boolean; xyMCollinear: boolean; xzNCollinear: boolean;
  rightAtM: boolean; rightAtN: boolean;
  fmHalfAB: boolean; fmEqualsAF: boolean; fmEqualsBF: boolean;
  enHalfAC: boolean; emEqualsEy: boolean; fnEqualsFz: boolean;
  lengthChain: boolean; tangentLengths: boolean;
  cabartMidpoint: boolean; angleXceEqualsCem: boolean;
  angleXycEqualsEym: boolean; claimLinesParallel: boolean;
};
type Core = {
  WIDTH: number; HEIGHT: number; MIN_SIDE: number;
  cross(a: Pt, b: Pt, c: Pt): number;
  dist(p: Pt, q: Pt): number;
  distToLine(p: Pt, l: Line): number;
  line(p: Pt, q: Pt): Line;
  start(options?: { width?: number; height?: number }): State;
  withPoint(s: State, name: string, p: Pt): State;
  construction(s: State): Construction;
  measurements(s: State): Measurements;
  claims(s: State): Claims;
  result(): null;
};

const core = (): Core =>
  cores["hatzipolakis-triangle"].HatzipolakisTriangleCore as unknown as Core;

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Keep the size of tiny residuals; rounding them to six places would say 0. */
const fine = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toPrecision(6));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const deg = (radians: number): number | null => fine(radians * 180 / Math.PI);
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? fine(v) : null;

/** Accept both the tutor's [x, y] and the page's saved { x, y } points. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Optional board size; the applet opens on 400 x 300. */
function readBoard(args: Json): { width?: number; height?: number } {
  const out: { width?: number; height?: number } = {};
  for (const key of ["width", "height"] as const) {
    const v = args[key];
    if (v === undefined || v === null) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`argument "${key}" must be a positive number, got ${JSON.stringify(v)}`);
    }
    out[key] = n;
  }
  return out;
}

/** Start at the applet's opening picture, then move the corners that are given. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with A, B, C points and optional width/height");
  }
  let s = C.start(readBoard(args));
  for (const name of ["A", "B", "C"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.withPoint(s, name, readPoint(v, name));
  }
  return s;
}

/** Rebuild the three saved corners without applying any board clamp. */
function savedState(C: Core, state: Json): State {
  let s = C.start({
    width: Number.isFinite(Number(state.width)) && Number(state.width) > 0 ? Number(state.width) : undefined,
    height: Number.isFinite(Number(state.height)) && Number(state.height) > 0 ? Number(state.height) : undefined,
  });
  for (const name of ["A", "B", "C"] as const) {
    if (state[name] !== undefined && state[name] !== null) {
      s = C.withPoint(s, name, readPoint(state[name], `saved ${name}`));
    }
  }
  return s;
}

type Reading = ReturnType<typeof reading>;

/** One call each to construction(), measurements() and claims() of the real core. */
function reading(C: Core, s: State, c: Construction, m: Measurements, cl: Claims) {
  const tol = 1e-6 * m.scale;
  const residual = (p: Pt | null, l: Line | null): number | null =>
    p && l ? fine(C.distToLine(p, l)) : null;
  const near = (v: number | null): boolean | null => v === null ? null : v <= tol;

  const collinear = {
    mnEf: {
      statement: "M, N, E and F lie on the midline EF.",
      holds: cl.mnEfCollinear,
      MToEF: residual(c.M, c.EF), NToEF: residual(c.N, c.EF),
      tolerance: fine(tol),
      MWithinTolerance: near(residual(c.M, c.EF)),
      NWithinTolerance: near(residual(c.N, c.EF)),
    },
    xyM: {
      statement: "X, Y and M are collinear.",
      holds: cl.xyMCollinear,
      XToXY: residual(c.X, c.XY), MToXY: residual(c.M, c.XY),
      tolerance: fine(tol),
    },
    xzN: {
      statement: "X, Z and N are collinear.",
      holds: cl.xzNCollinear,
      XToZX: residual(c.Z, c.ZX), NToZX: residual(c.N, c.ZX),
      tolerance: fine(tol),
    },
  };

  const sides = { BC_a: fine(c.sides.a), CA_b: fine(c.sides.b), AB_c: fine(c.sides.c) };
  const lengths = {
    sides,
    inradius: fine(c.radius),
    FM: fine(m.FM), AF: fine(m.AF), BF: fine(m.BF), halfAB: fine(c.sides.c / 2),
    EN: fine(m.EN), AE: fine(m.AE), CE: fine(m.CE), halfAC: fine(c.sides.b / 2),
    EM: fine(m.EM), EY: fine(m.EY),
    FN: fine(m.FN), FZ: fine(m.FZ),
    signedABminusBC_over_2: fine((c.sides.c - c.sides.a) / 2),
    absABminusBC_over_2: fine(Math.abs(c.sides.c - c.sides.a) / 2),
  };

  const anglesDegrees = {
    XCE: deg(m.angleXCE), CEM: deg(m.angleCEM),
    XCE_plus_CEM: deg(m.angleXCE + m.angleCEM),
    XYC: deg(m.angleXYC), EYM: deg(m.angleEYM),
  };

  return {
    board: { width: s.width, height: s.height },
    drawingPossible: c.ok,
    degenerate: Math.abs(C.cross(s.A, s.B, s.C)) <= tol,
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    points: {
      I: pt(c.I), D: pt(c.D), E: pt(c.E), F: pt(c.F),
      X: pt(c.X), Y: pt(c.Y), Z: pt(c.Z), M: pt(c.M), N: pt(c.N),
      Ab_is_M: pt(c.Ab), Ac_is_N: pt(c.Ac), cabart: pt(c.cabart),
    },
    lines: {
      EF: c.EF ? { through: [pt(c.E), pt(c.F)] } : null,
      XY: c.XY ? { through: [pt(c.X), pt(c.Y)] } : null,
      ZX: c.ZX ? { through: [pt(c.Z), pt(c.X)] } : null,
      BI: c.BI ? { through: [pt(s.B), pt(c.I)] } : null,
      CI: c.CI ? { through: [pt(s.C), pt(c.I)] } : null,
      BC: c.BC ? { through: [pt(s.B), pt(s.C)] } : null,
    },
    collinear,
    lengths,
    anglesDegrees,
    claims: cl,
    failedClaims: ([
      "mnEfCollinear", "xyMCollinear", "xzNCollinear", "rightAtM", "rightAtN",
      "fmHalfAB", "fmEqualsAF", "fmEqualsBF", "enHalfAC", "emEqualsEy",
      "fnEqualsFz", "lengthChain", "tangentLengths", "cabartMidpoint",
      "angleXceEqualsCem", "angleXycEqualsEym", "claimLinesParallel",
    ] as const).filter((k) => cl[k] !== true),
    result: C.result(),
  };
}

/** Require a triangle the applet can draw (every side at least 2 units). */
function live(C: Core, args: Json): { s: State; c: Construction; m: Measurements; cl: Claims } {
  const s = buildState(C, args);
  const c = C.construction(s);
  if (!c.ok) {
    throw new Error(
      "A, B and C must form a proper triangle with every side at least 2 board units " +
      "(the applet's Compute() refuses shorter sides); move a corner and try again",
    );
  }
  return { s, c, m: C.measurements(s), cl: C.claims(s) };
}

function constructionNote(r: Reading): string {
  return (
    `D, E, F are the midpoints of BC, CA, AB; X, Y, Z are the incircle's touch points on those sides; ` +
    `M and N are the feet of the perpendiculars from A onto BI and CI. ` +
    `The core puts I at (${r.points.I!.x}, ${r.points.I!.y}) with inradius ${r.lengths.inradius} and sides ` +
    `BC=${r.lengths.sides.BC_a}, CA=${r.lengths.sides.CA_b}, AB=${r.lengths.sides.AB_c}. ` +
    `The midline EF runs through E=(${r.points.E!.x}, ${r.points.E!.y}) and F=(${r.points.F!.x}, ${r.points.F!.y}); ` +
    `M is ${r.collinear.mnEf.MToEF} and N is ${r.collinear.mnEf.NToEF} board units from it ` +
    `(tolerance ${r.collinear.mnEf.tolerance}). ` +
    `X-Y-M and X-Z-N are the two other claimed lines, with residuals ` +
    `${r.collinear.xyM.MToXY}/${r.collinear.xzN.NToZX}. ` +
    (r.degenerate ? "The three corners are nearly collinear, so the construction is degenerate. " : "") +
    "This is an illustration, so there is no win or loss."
  );
}

function claimsNote(r: Reading): string {
  const l = r.lengths, a = r.anglesDegrees, cl = r.claims;
  const main = cl.mnEfCollinear && cl.xyMCollinear && cl.xzNCollinear;
  return (
    (main
      ? `All three collinearities hold here: M and N are within ${r.collinear.mnEf.tolerance} board units of EF, and X, Y, M and X, Z, N line up. `
      : `At least one page collinearity fails here (M,N,E,F=${cl.mnEfCollinear}, X-Y-M=${cl.xyMCollinear}, X-Z-N=${cl.xzNCollinear}). `) +
    `In right triangle ABM, F is the midpoint of the hypotenuse, so FM=${l.FM}=AF=${l.AF}=BF=${l.BF}=AB/2=${l.halfAB}; ` +
    `similarly EN=${l.EN}=AE=${l.AE}=CE=${l.CE}=AC/2=${l.halfAC}. ` +
    `The signed chain EM = AB/2 - BC/2 = ${l.signedABminusBC_over_2} may be negative: EM and EY agree only as lengths, ` +
    `both |AB-BC|/2 = ${l.absABminusBC_over_2} (EM=${l.EM}, EY=${l.EY}), and M swaps sides of E when AB < BC. ` +
    `FN=${l.FN} and FZ=${l.FZ} match the same way at C. ` +
    `The page compares angle XCE = ${a.XCE}° with angle CEM = ${a.CEM}°: as an angle between the two lines it matches=${cl.angleXceEqualsCem}, ` +
    `but as ordinary smaller angles they are ` +
    `${a.XCE !== null && a.CEM !== null && Math.abs(a.XCE - a.CEM) < 1e-4 ? "equal" : `supplementary (sum ${a.XCE_plus_CEM}°)`}, ` +
    `and the core accepts either. ` +
    `angle XYC=${a.XYC}° and angle EYM=${a.EYM}° agree as ordinary angles=${cl.angleXycEqualsEym}. ` +
    `Tangent lengths ${cl.tangentLengths ? "agree" : "do not agree"}, and Cabart's midpoint claim is ${cl.cabartMidpoint ? "true" : "false"}.`
  );
}

/** The live fixture: A=(303,42), B=(80,240), C=(181,257) on the 400 x 300 board. */
const FIXTURE_ARGS = '{ "A": [303, 42], "B": [80, 240], "C": [181, 257] }';

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle ABC (corners as [x, y] or { x, y } on the applet's 400 x 300 board, y down; omit a corner for the opening picture, and width/height may be overridden), run the real core and report the incenter I, the midpoints D, E, F, the incircle touch points X, Y, Z and the perpendicular feet M and N, with the side lengths and inradius. It also gives the three claimed lines EF, XY and ZX and the distance of each relevant point to its line, the BI/CI bisectors and the claim verdicts. Refuses a triangle with any side under 2 board units.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const { s, c, m, cl } = live(C, args);
        const r = reading(C, s, c, m, cl);
        return { ...r, note: constructionNote(r) };
      },
    },

    check_claims: {
      describe:
        "Check every claim on the Hatzipolakis Triangle page for the same triangle (arguments as in construction): M, N, E, F are collinear, X-Y-M and X-Z-N are straight, the right angles at M and N, FM = AF = BF = AB/2 and EN = AE = CE = AC/2, EM = EY = |AB - BC|/2, FN = FZ, the tangent lengths, Cabart's midpoint and the two angle comparisons. Each verdict comes with the core's measured lengths and angles in degrees. Note the two caveats: EM = AB/2 - BC/2 is a signed chain that flips when AB < BC (only the lengths |AB - BC|/2 agree), and angle XCE = angle CEM is between two lines, so as smaller angles the pair may be supplementary (sum 180°), which the core accepts.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const { s, c, m, cl } = live(C, args);
        const r = reading(C, s, c, m, cl);
        return {
          triangle: r.triangle,
          board: r.board,
          collinearity: r.collinear,
          lengths: r.lengths,
          anglesDegrees: r.anglesDegrees,
          claims: cl,
          failedClaims: r.failedClaims,
          allPageClaimsHold: r.failedClaims.length === 0,
          tolerance: fine(1e-6 * m.scale),
          note: claimsNote(r),
        };
      },
    },
  };
}

/** Echo the three saved vertices, then re-measure the diagram with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hatzipolakis Triangle state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hatzipolakis Triangle position must be an object");
  }

  const optPoint = (raw: unknown, label: string): Pt | null => {
    try { return pt(readPoint(raw, label)); } catch { return null; }
  };
  const saved = { A: optPoint(state.A, "saved A"), B: optPoint(state.B, "saved B"), C: optPoint(state.C, "saved C") };

  try {
    const C = core();
    const s = savedState(C, state);
    const c = C.construction(s);
    if (!c.ok) {
      return {
        ...state,
        stateVersion,
        saved,
        drawingPossible: false,
        result: C.result(),
        note:
          "Track.state saved the three corners the player drags, in board units. " +
          "Here at least one side is under 2 units, so the applet's Compute() would not draw the triangle and there is no construction to measure.",
      };
    }
    const m = C.measurements(s), cl = C.claims(s);
    const r = reading(C, s, c, m, cl);
    return {
      ...state,
      stateVersion,
      saved,
      drawingPossible: true,
      reading: r,
      result: C.result(),
      note:
        "Track.state saved only the three draggable corners A, B and C in board units (no board size or derived points); " +
        "the reading uses the applet's default 400 x 300 board. " +
        "The core rebuilds the incenter, midpoints, touch points and feet from those corners, then checks that M, N, E, F are collinear and that X-Y-M and X-Z-N are straight. " +
        constructionNote(r) + " " + claimsNote(r),
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      saved,
      reading: null,
      note: `The saved position cannot be measured by the core: ${(err as Error).message}`,
    };
  }
}
