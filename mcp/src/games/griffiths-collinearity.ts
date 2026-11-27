/*
 * run_game_logic actions and saved-position reader for Griffiths Collinearity.
 *
 * The real core is griffiths-collinearity/griffiths-collinearity-core.js,
 * copied into src/generated/cores/ at build time; every measurement below
 * comes from it. Coordinates are board units of the applet's 500 x 400 view,
 * y downward.
 *
 * A line cuts the sides of triangle ABC at P (on BC), Q (on CA) and R (on
 * AB). From each crossing point we drop perpendiculars to all three sides
 * (the point itself is the foot on its own side); the three feet lie on that
 * point's pedal circle. The core's Compute() chain builds those three circles,
 * the line through their centres (FindAxis) and the real intersections of the
 * first two circles. The centres are always collinear and, whenever two
 * circles really meet, both meetings lie on the third as well: the circles are
 * coaxal. The page's literal sentence says the three circles always have two
 * common points; that is false -- one circle can lie wholly inside another,
 * leaving no real intersection, while the centres still line up. Griffiths'
 * theorem is the special case where the line crosses the circumcentre: then a
 * common point lies on the nine-point circle. Away from it that need not
 * happen. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circ = { c: Pt; r: number };
type Options = { names: boolean; circles: boolean; perps: boolean };
type State = { A: Pt; B: Pt; C: Pt; line: [Pt, Pt]; options: Options; explored: boolean };
type Geometry = {
  A: Pt; B: Pt; C: Pt; line: [Pt, Pt];
  feet: Array<Pt | null>;
  intersection: Array<Array<Pt | null>>;
  circles: Array<Circ | null>;
  axis: [Pt, Pt] | null;
  common: Pt[];
  nine: Circ | null;
  options: Options;
};
interface Core {
  VIEW: { width: number; height: number };
  start(options?: Partial<Options>): State;
  move(state: State, name: string, point: Pt): State;
  setOption(state: State, name: string, value: boolean): State;
  geometry(state: State): Geometry;
  describe(state: State): string;
  result(state: State): string | null;
  distance(p: Pt, q: Pt): number;
  distanceToLine(p: Pt, a: Pt, b: Pt): number;
  circleOf(a: Pt, b: Pt, c: Pt): Circ | null;
  midpoint(p: Pt, q: Pt): Pt;
}

const core = (): Core =>
  cores["griffiths-collinearity"].GriffithsCollinearityCore as unknown as Core;

const TOL = 1e-6; // board units; the core computes in double precision
const OPTION_NAMES = ["names", "circles", "perps"] as const;

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const circleOut = (c: Circ | null | undefined) =>
  c ? { centre: pt(c.c), radius: r6(c.r) } : null;
const finite = (values: Array<number | null>): number[] =>
  values.filter((v): v is number => v !== null && Number.isFinite(v));
const maxAbs = (values: Array<number | null>): number | null => {
  const f = finite(values);
  return f.length ? Math.max(...f.map(Math.abs)) : null;
};

/** Accept the page's saved { x, y } dots and the tutor's [x, y] arguments. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/** The crossing line as two endpoints; the saved fixture stores it this way. */
function readLine(raw: unknown, label: string, fallback?: [Pt, Pt]): [Pt, Pt] {
  if (raw === undefined || raw === null) {
    if (fallback) return [readPoint(fallback[0], label), readPoint(fallback[1], label)];
    throw new Error(`missing required argument "${label}"`);
  }
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw new Error(`argument "${label}" must be [point, point]`);
  }
  return [readPoint(raw[0], `${label}[0]`), readPoint(raw[1], `${label}[1]`)];
}

/** Strict for the tutor's args; lenient for a saved position from Track.state. */
function readOptions(raw: unknown, strict: boolean): Options {
  const out: Options = { names: false, circles: false, perps: false };
  if (raw === undefined || raw === null) return out;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    if (strict) throw new Error('argument "options" must be an object with boolean names/circles/perps');
    return out;
  }
  const j = raw as Json;
  for (const key of OPTION_NAMES) {
    const v = j[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") {
      if (strict) throw new Error(`argument "options.${key}" must be true or false`);
      continue;
    }
    out[key] = v;
  }
  return out;
}

/**
 * Build a core state from JSON args the way the page's drags do: moving A, B
 * or C projects the point onto the board, and line1/line2/lineMid rotate or
 * slide the crossing line through Core.move. "line" sets both ends at once.
 * Omitted handles keep the core's opening picture.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C points, an optional line and optional options");
  }
  let s = C.start({});
  for (const name of ["A", "B", "C"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.move(s, name, readPoint(args[name], name));
    }
  }
  if (args.line !== undefined && args.line !== null) {
    s = { ...s, line: readLine(args.line, "line") };
  }
  for (const name of ["line1", "line2", "lineMid"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.move(s, name, readPoint(args[name], name));
    }
  }
  if (args.options !== undefined && args.options !== null) {
    const o = readOptions(args.options, true);
    for (const name of OPTION_NAMES) s = C.setOption(s, name, o[name]);
  }
  return s;
}

/** A state reconstructed from a Track.state payload, without re-clipping. */
function stateFromSaved(C: Core, state: Json): State {
  const seed = C.start({});
  return {
    A: readPoint(state.A, "saved A", seed.A),
    B: readPoint(state.B, "saved B", seed.B),
    C: readPoint(state.C, "saved C", seed.C),
    line: readLine(state.line, "saved line", seed.line),
    options: readOptions(state.options, false),
    explored: true,
  };
}

type Measurement = ReturnType<typeof measure>;

/** Every number below is measured from one call to the real core. */
function measure(C: Core, s: State) {
  const g = C.geometry(s);
  const collinear = g.circles.map((c) =>
    c && g.axis ? sig(C.distanceToLine(c.c, g.axis[0], g.axis[1])) : null);
  const maxCollinear = maxAbs(collinear);

  const perPoint = g.common.map((p) =>
    g.circles.map((c) => (c ? sig(C.distance(c.c, p) - c.r) : null)));
  const maxCommon = maxAbs(perPoint.flat());
  const eachPointOnAll = g.common.map((p) =>
    g.circles.every((c) => c !== null && Math.abs(C.distance(c.c, p) - c.r) < TOL));

  const circum = C.circleOf(s.A, s.B, s.C);
  const throughCentre = Boolean(circum && C.distanceToLine(circum.c, g.line[0], g.line[1]) < TOL);
  const nineResiduals = g.common.map((p) =>
    g.nine ? sig(C.distance(g.nine.c, p) - g.nine.r) : null);
  const ninePointCommon = nineResiduals.some((v) => v !== null && Math.abs(v) < TOL);

  const c0 = g.circles[0], c1 = g.circles[1];
  let pair = "not enough real circles to compare";
  let nested = false;
  if (c0 && c1) {
    const d = C.distance(c0.c, c1.c);
    const sum = c0.r + c1.r, diff = Math.abs(c0.r - c1.r);
    if (d < diff - TOL) {
      pair = "nested: the second circle lies wholly inside the first";
      nested = true;
    } else if (d > sum + TOL) {
      pair = "disjoint: the two circles are apart";
    } else if (Math.abs(d - sum) <= TOL || Math.abs(d - diff) <= TOL) {
      pair = "tangent";
    } else {
      pair = "crossing: two real intersections";
    }
  }

  return {
    board: C.VIEW,
    handles: { A: pt(s.A), B: pt(s.B), C: pt(s.C), line: [pt(g.line[0]), pt(g.line[1])] },
    feet: g.feet.map(pt), // P on BC, Q on CA, R on AB
    circles: g.circles.map(circleOut),
    axis: g.axis ? { through: [pt(g.axis[0]), pt(g.axis[1])] } : null,
    common: g.common.map(pt),
    ninePointCircle: circleOut(g.nine),
    circumcircle: circleOut(circum),
    checks: {
      centresCollinear: maxCollinear !== null && maxCollinear < TOL,
      collinearResiduals: collinear,
      maxCollinearResidual: sig(maxCollinear),
      commonCount: g.common.length,
      eachCommonPointOnAllCircles: eachPointOnAll,
      commonResiduals: perPoint,
      maxCommonResidual: sig(maxCommon),
      coaxal: g.common.length === 2 && maxCommon !== null && maxCommon < TOL,
      pageTwoCommonPointsClaim: g.common.length === 2,
      circles0and1: pair,
      nestedWithoutCommon: nested && g.common.length === 0,
    },
    griffiths: {
      lineThroughCircumcentre: throughCentre,
      commonPointOnNinePointCircle: ninePointCommon,
      ninePointResiduals: nineResiduals,
    },
    options: s.options,
    description: C.describe(s),
    result: C.result(s),
  };
}

function readingNote(m: Measurement): string {
  const c = m.checks;
  return (
    "P is on BC, Q on CA and R on AB; each pedal circle uses its own crossing point " +
    "on its own side and the perpendicular feet on the other two. " +
    `The three centres lie on one line (worst residual ${sig(c.maxCollinearResidual)} board units). ` +
    (c.commonCount === 2
      ? `Both real common points lie on all three circles (worst residual ${sig(c.maxCommonResidual)}), so the circles are coaxal. `
      : `There are ${c.commonCount} real common points (${c.circles0and1}); the page's literal claim of two common points fails here, but the centres are still collinear. `) +
    `Griffiths' nine-point-circle point appears only when the line crosses the circumcentre ` +
    `(it does${m.griffiths.lineThroughCircumcentre ? "" : " not"} here). ` +
    "This is an illustration, so there is no win or loss."
  );
}

/* The saved live fixture: a full diagram with two real common points. */
const FIXTURE_ARGS =
  '{"A":[252.66403821589688,120.0341117566796],"B":[197.70851033091105,260.54419962463425],' +
  '"C":[327.2272654463528,242.18944739716986],' +
  '"line":[[0,323.36668249622596],[500,76.63331750377407]]}';

/* A core-verified case where circle 2 lies wholly inside circle 1. */
const NESTED_ARGS =
  '{"A":[343.895,79.161],"B":[353.613,107.967],"C":[204.015,275.895],' +
  '"line":[[345.245,0],[225.410,400]]}';

export function actions(): GameActions {
  return {
    pedal_circles: {
      describe:
        "For triangle A, B, C and a crossing line (each point [x, y] or { x, y } on the 500 x 400 board, y downward; give the line as [end1, end2], or use line1/line2/lineMid to rotate or slide it from the opening line), run the real core and report the three crossing points P (on BC), Q (on CA), R (on AB), their pedal circles, the line through the three centres and the circles' real common points. Each centre's distance to that line and each common point's distance to all three circles are measured; omitted arguments keep the applet's opening picture, and optional names/circles/perps set the checkboxes.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const m = measure(C, buildState(C, args));
        return { ...m, note: readingNote(m) };
      },
    },

    check_coaxality: {
      describe:
        "Check the page's geometric claims for the same triangle and line (arguments as in pedal_circles): the three pedal-circle centres are collinear, both common points lie on all three circles when the circles really meet, one circle can be nested inside another with no real common point despite the page's literal 'two common points' sentence, and a common point lands on the nine-point circle only when the line crosses the circumcentre. Returns each verdict with its residual in board units, the number of real common points and how the first two circles sit relative to each other. The example is a nested case where the literal two-points claim is false but collinearity still holds.",
      args: NESTED_ARGS,
      run: (args) => {
        const C = core();
        const m = measure(C, buildState(C, args));
        const c = m.checks;
        return {
          board: m.board,
          handles: m.handles,
          circles: m.circles,
          common: m.common,
          verdicts: {
            centresCollinear: c.centresCollinear,
            maxCollinearResidual: c.maxCollinearResidual,
            commonCount: c.commonCount,
            pageTwoCommonPointsClaim: c.pageTwoCommonPointsClaim,
            coaxal: c.coaxal,
            maxCommonResidual: c.maxCommonResidual,
            circles0and1: c.circles0and1,
            nestedWithoutCommon: c.nestedWithoutCommon,
            lineThroughCircumcentre: m.griffiths.lineThroughCircumcentre,
            commonPointOnNinePointCircle: m.griffiths.commonPointOnNinePointCircle,
            allLiteralPageClaimsHold:
              c.centresCollinear && c.pageTwoCommonPointsClaim && c.coaxal,
          },
          note: readingNote(m),
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure the diagram with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Griffiths Collinearity state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Griffiths Collinearity position must be an object");
  }
  const safePoint = (raw: unknown): Pt | null => {
    try { return pt(readPoint(raw, "saved point")); } catch { return null; }
  };
  const safeLine = (raw: unknown): [Pt | null, Pt | null] =>
    Array.isArray(raw) && raw.length === 2 ? [safePoint(raw[0]), safePoint(raw[1])] : [null, null];

  const saved = {
    A: safePoint(state.A), B: safePoint(state.B), C: safePoint(state.C),
    line: safeLine(state.line),
    feet: Array.isArray(state.feet) ? state.feet.map(safePoint) : [],
    centres: Array.isArray(state.centres) ? state.centres.map(safePoint) : [],
    common: Array.isArray(state.common) ? state.common.map(safePoint) : [],
    axis: safeLine(state.axis),
    options: readOptions(state.options, false),
  };

  try {
    const C = core();
    const m = measure(C, stateFromSaved(C, state));
    const gap = (a: Pt | null, b: Pt | null): number | null =>
      a && b ? sig(C.distance(a, b)) : null;
    const axisGap = (a: Pt | null, b: Pt | null, c: Pt | null, d: Pt | null): number | null =>
      a && b && c && d
        ? sig(Math.min(C.distance(a, c) + C.distance(b, d), C.distance(a, d) + C.distance(b, c)))
        : null;

    return {
      stateVersion,
      saved,
      reading: m,
      savedVsCore: {
        centreGaps: [0, 1, 2].map((i) => gap(saved.centres[i] ?? null, m.circles[i]?.centre ?? null)),
        commonGaps: [0, 1].map((i) => gap(saved.common[i] ?? null, m.common[i] ?? null)),
        axisGap: m.axis
          ? axisGap(saved.axis[0], saved.axis[1], m.axis.through[0], m.axis.through[1])
          : null,
      },
      note:
        "Track.state saved the three vertices and the crossing line, plus the derived feet, three circle centres, common points, axis and the three checkbox options. " +
        "The core rebuilds the same picture from A, B, C and the line; savedVsCore shows how close its centres, common points and axis are to the saved ones. " +
        readingNote(m),
    };
  } catch (err) {
    return {
      stateVersion,
      saved,
      reading: null,
      note: `The saved position cannot be measured by the core: ${(err as Error).message}`,
    };
  }
}
