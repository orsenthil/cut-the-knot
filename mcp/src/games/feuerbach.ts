/*
 * run_game_logic actions and saved-position reader for Feuerbach.
 *
 * The real core is feuerbach/feuerbach-core.js, copied into
 * src/generated/cores/ at build time; every number reported here is measured
 * by it. Coordinates are board units of the applet's 400 x 250 view, y down.
 * See _shared.ts for the shape of a game module.
 *
 * The page's claim is Feuerbach's theorem: the nine-point circle of a triangle
 * (radius R/2, centre N halfway between the circumcentre O and orthocenter H)
 * touches the incircle internally because IN = R/2 - r, and each excircle
 * externally because IN_a = R/2 + r_a. The core constructs all four circles
 * algebraically, puts a dot on each circle along its line of centres, and the
 * helpers centreGapErrors/touchErrors/touchCollinearity measure the claim.
 * One exception the page's text does not mention: for an equilateral triangle
 * r = R/2 and N = I, so the incircle and nine-point circle coincide and there
 * is no single Feuerbach point (coincidentIncircle).
 *
 * This is the original Feuerbach applet. FeuerbachIncidence, FeuerbachProof
 * and FeuerbachTreasure are separate pages with extra constructions and are
 * not drawn here. It is an illustration: no win, no loss.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = { medians: boolean; altitudes: boolean; circles: boolean; names: boolean };
type State = { A: Pt; B: Pt; C: Pt; options: Options; touches: number };
type Circle = { center: Pt; radius: number };
type Geometry = {
  valid: boolean;
  A: Pt; B: Pt; C: Pt;
  I: Pt; incircle: Circle; inradius: number;
  excenters: Pt[]; excircles: Circle[]; exradii: number[];
  N: Pt; nine: Circle; nineRadius: number;
  touches: Pt[]; O: Pt; H: Pt; circumradius: number;
};
type Core = {
  VIEW: { width: number; height: number };
  MARGIN: number;
  start(options?: Json): State;
  defaultOptions(): Options;
  setOption(s: State, name: string, on: boolean): State;
  moveVertex(s: State, name: string, p: Pt): State;
  geometry(s: State): Geometry;
  dist(a: Pt, b: Pt): number;
  centreGapErrors(g: Geometry): number[];
  touchErrors(g: Geometry): number[];
  touchCollinearity(g: Geometry): number[];
  nineRadiusError(g: Geometry): number;
  eulerError(g: Geometry): number;
  coincidentIncircle(g: Geometry): boolean;
  rotate(centre: Pt, point: Pt, angle: number, direction: number): Pt;
  result(): unknown;
};

const core = (): Core => cores["feuerbach"].FeuerbachCore as unknown as Core;

const THEOREM =
  "Feuerbach's theorem: the nine-point circle has centre N and radius R/2, so it touches the incircle internally (IN = R/2 - r) and each excircle externally (IN_a = R/2 + r_a). For an equilateral triangle r = R/2 and N = I: the two circles coincide and there is no single Feuerbach point F, though the three excircles still touch.";
const SIBLINGS =
  "This is the original Feuerbach applet: it draws only the triangle, the four circles and their four touch dots. The sibling pages are different applets and are not drawn here: FeuerbachIncidence joins each corner to the opposite excircle's touch point and asks about their concurrence; FeuerbachProof proves the tangency by inversion in a circle; FeuerbachTreasure (Four Triangles, One Circle) puts the orthocenter to work, with four triangles sharing one nine-point circle tangent to sixteen circles.";

/* The core is exact up to floating point; only what we print is rounded. */
const round = (v: number | null | undefined, digits = 6): number | null =>
  (typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(digits)) : null);
const sig = (v: number | null | undefined): number | null =>
  (typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x)!, y: round(p.y)! } : null;

/** A board point as the page saves it ({x, y}) or as a short [x, y]. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`argument "${label}" needs finite numeric x and y`);
    }
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readBool(raw: unknown, label: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`argument "${label}" must be true or false`);
  return raw;
}

/** A real core state: supplied corners are applied as page drags, so the core
 *  clamps them to the board and counts them; missing ones stay at the opening
 *  triangle. The four checkbox flags are the applet's panel. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C points and display options");
  }
  let s = C.start({
    medians: readBool(args.medians, "medians", false),
    altitudes: readBool(args.altitudes, "altitudes", false),
    circles: readBool(args.circles, "circles", false),
    names: readBool(args.names, "names", false),
  });
  for (const name of ["A", "B", "C"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.moveVertex(s, name, readPoint(args[name], name, s[name]));
    }
  }
  return s;
}

/** Reject a flat or ill-conditioned triangle before reading its circles. */
function live(C: Core, args: Json): { s: State; g: Geometry; scale: number } {
  const s = buildState(C, args);
  const g = C.geometry(s);
  const scale = Math.max(1, C.dist(s.A, s.B), C.dist(s.B, s.C), C.dist(s.C, s.A));
  if (!g.valid) {
    throw new Error(
      "A, B and C must form a proper, non-degenerate triangle on the page's " +
      `${C.VIEW.width} x ${C.VIEW.height} board; the core cannot draw the four circles from a straight line`,
    );
  }
  return { s, g, scale };
}

/** Every number the core measures about the four tangencies, in plain JSON. */
function reading(C: Core, g: Geometry, scale: number) {
  const R = g.circumradius;
  const gaps = C.centreGapErrors(g);
  const touchErr = C.touchErrors(g);
  const collinear = C.touchCollinearity(g);
  const tol = 1e-7 * scale;
  const incircleGap = C.dist(g.N, g.I);
  return {
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    circumradius: round(R),
    ninePointCircle: {
      centre: pt(g.N), radius: round(g.nineRadius),
      radiusErrorFromROver2: sig(C.nineRadiusError(g)),
    },
    incircle: {
      centre: pt(g.I), radius: round(g.inradius),
      centreGapIN: round(incircleGap),
      expectedGap: round(g.nineRadius - g.inradius),
      ROver2MinusR: round(R / 2 - g.inradius),
      gapError: sig(gaps[0]),
      touchF: pt(g.touches[3]),
      touchError: sig(touchErr[3]),
      collinearityError: sig(collinear[3]),
    },
    excircles: g.excircles.map((c, i) => ({
      index: i + 1,
      centre: pt(g.excenters[i]), radius: round(c.radius),
      centreGapINa: round(C.dist(g.N, g.excenters[i])),
      expectedGap: round(g.nineRadius + g.exradii[i]),
      ROver2PlusRa: round(R / 2 + g.exradii[i]),
      gapError: sig(gaps[i]),
      touch: pt(g.touches[i]),
      touchError: sig(touchErr[i]),
      collinearityError: sig(collinear[i]),
    })),
    checks: {
      gapsMatchFeuerbach: gaps.every((e) => e <= tol),
      dotsLieOnBothCircles: touchErr.every((e) => e <= tol),
      dotsOnCentreLines: collinear.every((e) => e <= tol),
      nineRadiusIsROver2: C.nineRadiusError(g) <= tol,
      eulerOI2: sig(C.eulerError(g)),
      eulerHolds: C.eulerError(g) <= tol * Math.max(1, R),
    },
    coincidentIncircle: C.coincidentIncircle(g),
    touches: g.touches.map(pt),
  };
}

export function actions(): GameActions {
  return {
    four_tangencies: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } in the applet's 400 x 250 board, y down; omit any to keep the opening picture), and optional display flags medians, altitudes, circles, names, run the real Feuerbach core. Report the nine-point circle's centre N and radius (R/2), the incircle's centre I and radius r with the measured centre gap IN against R/2 - r, and each excircle's centre and radius with IN_a against R/2 + r_a. Also report the four touch dots with their distance to both circles and their collinearity with the two centres, the Euler OI^2 = R(R - 2r) check, and whether the incircle and nine-point circle coincide. A flat triangle is refused.",
      args: '{"A":[203.175,62.527],"B":[159.147,172.300],"C":[261.254,112.583]}',
      run: (args) => {
        const C = core();
        const { s, g, scale } = live(C, args);
        const r = reading(C, g, scale);
        return {
          ...r,
          options: s.options,
          note:
            `The core measures IN = ${r.incircle.centreGapIN} against R/2 - r = ${r.incircle.ROver2MinusR} ` +
            `and the three IN_a against R/2 + r_a; all four gap errors are at floating-point noise, ` +
            `and each touch dot lies on both circles along their line of centres. ` +
            (r.coincidentIncircle
              ? "Here the incircle and nine-point circle coincide, so there is no single Feuerbach point F. "
              : "This is not equilateral, so the incircle has a single Feuerbach point F. ") +
            THEOREM + " " + SIBLINGS + " This is an illustration: there is no win or loss.",
        };
      },
    },

    equilateral_coincidence: {
      describe:
        "With A and B (each [x, y] or { x, y }; omitted corners use the applet's opening points) build the third vertex of an equilateral triangle by rotating B about A through 60 degrees with the core's own rotate, taking direction 1 or -1 (default 1), then run the real core. Show that the nine-point circle and incircle then share centre N = I and radius r = R/2, so the core's coincidentIncircle flag is set and there is no single Feuerbach point F, while the three excircles still touch. Reports all four centre gaps, their expected values and the touch-dot errors.",
      args: '{"A":[200,40],"B":[120,180]}',
      run: (args) => {
        const C = core();
        if (!args || typeof args !== "object" || Array.isArray(args)) {
          throw new Error("arguments must be an object with A, B points and an optional direction");
        }
        const seed = C.start();
        const A = readPoint(args.A, "A", seed.A);
        const B = readPoint(args.B, "B", seed.B);
        const rawDir = args.direction;
        const direction = rawDir === undefined || rawDir === null ? 1 : Number(rawDir);
        if (direction !== 1 && direction !== -1) {
          throw new Error('argument "direction" must be 1 or -1');
        }
        const Cc = C.rotate(A, B, Math.PI / 3, direction);
        if (!pt(Cc)) throw new Error("the rotated third vertex is not finite; choose different A and B");
        const s: State = { ...seed, A, B, C: Cc, touches: 0 };
        const g = C.geometry(s);
        if (!g.valid) {
          throw new Error("the rotated A, B, C did not form a valid triangle; choose different A and B");
        }
        const r = reading(C, g, Math.max(1, C.dist(A, B), C.dist(B, Cc), C.dist(Cc, A)));
        return {
          ...r,
          thirdVertex: pt(Cc),
          direction,
          note:
            "The three side lengths are equal, and the core puts N on top of I with the nine-point " +
            `radius ${r.ninePointCircle.radius} equal to the inradius ${r.incircle.radius} (both R/2), ` +
            `so IN = ${r.incircle.centreGapIN} and the incircle's expected gap is zero. ` +
            "The three excircles still touch from outside. " + THEOREM + " " + SIBLINGS +
            " This is an illustration: there is no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Feuerbach state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Feuerbach position must be an object");
  }
  const C = core();
  let savedReadable = true;
  let s: State;
  try {
    const seed = C.start();
    const opts = seed.options;
    const savedOpts = state.options && typeof state.options === "object" && !Array.isArray(state.options)
      ? state.options as Json : {};
    const savedTouches = Number(state.touches);
    s = {
      A: readPoint(state.A, "A", seed.A),
      B: readPoint(state.B, "B", seed.B),
      C: readPoint(state.C, "C", seed.C),
      options: {
        medians: readBool(savedOpts.medians, "medians", opts.medians),
        altitudes: readBool(savedOpts.altitudes, "altitudes", opts.altitudes),
        circles: readBool(savedOpts.circles, "circles", opts.circles),
        names: readBool(savedOpts.names, "names", opts.names),
      },
      touches: state.touches !== undefined && state.touches !== null && Number.isFinite(savedTouches)
        ? savedTouches : 0,
    };
  } catch {
    savedReadable = false;
    s = C.start();
  }
  const saved = {
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    options: s.options, touches: s.touches,
  };
  const g = C.geometry(s);
  if (!g.valid) {
    return {
      ...state, stateVersion, savedReadable, saved, valid: false,
      note:
        "The saved corners are collinear or coincident, so the core cannot draw the four circles. " +
        "Drag A, B and C apart on the page and look again. " + SIBLINGS +
        " This is an illustration: there is no win or loss.",
    };
  }
  const scale = Math.max(1, C.dist(s.A, s.B), C.dist(s.B, s.C), C.dist(s.C, s.A));
  const r = reading(C, g, scale);
  return {
    ...state, stateVersion, savedReadable, saved,
    valid: true,
    ...r,
    isIllustration: true,
    note: !savedReadable
      ? "The saved fields could not be read as three corners and four display flags, so the core's opening picture was reconstructed; the reading below is of that picture. " + SIBLINGS
      : "Track.state saved the three corners (board units), the four checkboxes and the drag count; the page does not save the circles. The real core rebuilds the nine-point circle, the incircle, the three excircles and their four touch dots from those corners, measuring IN = R/2 - r and IN_a = R/2 + r_a. " +
        (r.coincidentIncircle
          ? "These corners make an equilateral triangle, so the incircle and nine-point circle coincide and there is no single Feuerbach point F. "
          : "The incircle has a single Feuerbach point F here. ") +
        SIBLINGS + " This is an illustration: there is no win or loss.",
  };
}
