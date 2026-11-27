/*
 * run_game_logic actions and saved-position reader for Gergonne Medial.
 *
 * The real core is gergonne-medial/gergonne-medial-core.js, copied into
 * src/generated/cores/ at build time. It transcribes the applet's Compute():
 * midpoints Ma, Mb, Mc of the sides, the incircle's contact points Ga, Gb, Gc,
 * the perpendicular feet D, E, F from the midpoints onto the opposite sides of
 * the contact (Gergonne) triangle, and T, where the first two perpendiculars
 * meet. The page's concurrence claim is true: those three lines are the angle
 * bisectors of the medial triangle, so T is its incenter, (A+B+C-I)/2.
 * Maxwell's reverse statement also holds: the perpendiculars from Ga, Gb, Gc
 * to the medial triangle's opposite sides meet at the original incenter I.
 *
 * Every number below is measured by the real core. Coordinates are board units
 * in the page's 420 x 360 SVG view, y down. This is a demonstration, so there
 * is no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  width: number; height: number;
  A: Point; B: Point; C: Point;
  showNames: boolean; showHint: boolean;
};
type Geometry = {
  A: Point; B: Point; C: Point;
  Ma: Point; Mb: Point; Mc: Point;
  I: Point; Ga: Point; Gb: Point; Gc: Point;
  D: Point; E: Point; F: Point; T: Point;
  radius: number; area: number; valid: boolean;
};
type Claims = {
  valid: boolean;
  perpendicularMa: boolean; perpendicularMb: boolean; perpendicularMc: boolean;
  radiusToSideBC: boolean; radiusToSideCA: boolean; radiusToSideAB: boolean;
  bisectorAtA: boolean; bisectorAtB: boolean; bisectorAtC: boolean;
  tangentAtA: boolean; tangentAtB: boolean; tangentAtC: boolean;
  firstTwo: boolean; thirdPasses: boolean; triple: boolean;
  atMedialIncenter: boolean;
  reverseA: boolean; reverseB: boolean; reverseC: boolean;
  reverseConcurrence: boolean; all: boolean;
};
interface Core {
  WIDTH: number; HEIGHT: number;
  start(options?: Json): State;
  reset(state: State, options?: Json): State;
  withPoint(state: State, name: string, p: Point): State;
  withOption(state: State, name: string, value: boolean): State;
  compute(state: State): Geometry;
  claims(state: State, tol?: number): Claims | null;
  medialIncenter(g: Geometry): Point;
  distanceToLine(p: Point, q: Point, r: Point): number;
  dist(p: Point, q: Point): number;
  add(p: Point, q: Point): Point;
  sub(p: Point, q: Point): Point;
  normal(p: Point): Point;
  intersect(p: Point, q: Point, r: Point, s: Point): Point;
}

const core = (): Core => cores["gergonne-medial"].GergonneMedialCore as unknown as Core;

/* The core is exact up to floating point; tidy only the numbers we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x), y: r6(p.y) }
    : null;

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Point): Point {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function dimension(args: Json, key: string, fallback: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) {
    throw new Error(`argument "${key}" must be a positive board size, got ${JSON.stringify(raw)}`);
  }
  return n;
}

function flag(args: Json, key: string, fallback: boolean): boolean {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") {
    throw new Error(`argument "${key}" must be true or false, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/**
 * A real core state: the board size and two switches come from the applet's
 * Reset defaults, and supplied corners are applied as drags of A, B or C.
 * Omitted corners keep the opening triangle.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with A, B and C points");
  }
  const seed = C.start({});
  let s = C.start({
    width: dimension(args, "width", C.WIDTH),
    height: dimension(args, "height", C.HEIGHT),
    showNames: flag(args, "showNames", seed.showNames),
    showHint: flag(args, "showHint", seed.showHint),
  });
  for (const name of ["A", "B", "C"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.withPoint(s, name, readPoint(raw, name));
  }
  return s;
}

/** The applet draws nothing for a flat triangle, so neither do we. */
function requireDrawing(C: Core, s: State): { g: Geometry; cl: Claims } {
  const g = C.compute(s);
  const cl = C.claims(s);
  if (!g.valid || !cl) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners ([x, y] or { x, y }) with a " +
      "usable incircle: the applet hides its construction for a flat triangle",
    );
  }
  return { g, cl };
}

/** Everything the core measures about the two orthologic triangles. */
function reading(C: Core, s: State, g: Geometry, cl: Claims) {
  const size = Math.max(C.dist(g.A, g.B), C.dist(g.B, g.C), C.dist(g.C, g.A));
  const tol = 1e-7 * size;
  const medial = C.medialIncenter(g);
  const formula = {
    x: (g.A.x + g.B.x + g.C.x - g.I.x) / 2,
    y: (g.A.y + g.B.y + g.C.y - g.I.y) / 2,
  };

  const lines = [
    { name: "Ma ⟂ GbGc", from: g.Ma, foot: g.D, on: [g.Gb, g.Gc] as const, perp: cl.perpendicularMa },
    { name: "Mb ⟂ GaGc", from: g.Mb, foot: g.E, on: [g.Ga, g.Gc] as const, perp: cl.perpendicularMb },
    { name: "Mc ⟂ GaGb", from: g.Mc, foot: g.F, on: [g.Ga, g.Gb] as const, perp: cl.perpendicularMc },
  ];
  const misses = lines.map((l) => C.distanceToLine(g.T, l.from, l.foot));
  const maxMiss = Math.max(...misses);

  /* Maxwell's symmetric lines: through each contact point, normal to the
   * opposite side of the medial triangle (the same construction, swapped). */
  const reverseP = C.intersect(
    g.Ga, C.add(g.Ga, C.normal(C.sub(g.Mc, g.Mb))),
    g.Gb, C.add(g.Gb, C.normal(C.sub(g.Ma, g.Mc))),
  );
  const reverseGap = C.dist(g.I, reverseP);

  return {
    board: { width: s.width, height: s.height },
    options: { showNames: s.showNames, showHint: s.showHint },
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    incenter: pt(g.I),
    incircleRadius: r6(g.radius),
    area: r6(g.area),
    midpoints: { Ma: pt(g.Ma), Mb: pt(g.Mb), Mc: pt(g.Mc) },
    contactPoints: { Ga: pt(g.Ga), Gb: pt(g.Gb), Gc: pt(g.Gc) },
    perpendicularFeet: { D: pt(g.D), E: pt(g.E), F: pt(g.F) },
    commonPoint: pt(g.T),
    medialIncenter: pt(medial),
    formulaPoint: pt(formula),
    concurrence: {
      lines: lines.map((l, i) => ({
        name: l.name,
        from: pt(l.from), foot: pt(l.foot),
        through: [pt(l.on[0]), pt(l.on[1])],
        perpendicular: l.perp,
        missFromT: sig(misses[i]),
        missPctOfLongestSide: sig(size > 0 ? misses[i] / size * 100 : NaN),
        throughT: misses[i] <= tol,
      })),
      firstTwoMeetAtT: cl.firstTwo,
      thirdPassesThroughT: cl.thirdPasses,
      tripleIntersectAtT: cl.triple,
      allThroughT: cl.firstTwo && cl.thirdPasses && cl.triple,
      maxMiss: sig(maxMiss),
      tolerance: sig(tol),
      atMedialIncenter: cl.atMedialIncenter,
      formulaMatchesT: C.dist(g.T, formula) <= tol,
    },
    reverse: {
      lines: [
        { name: "Ga ⟂ MbMc", from: pt(g.Ga), towards: [pt(g.Mb), pt(g.Mc)], perpendicularAtI: cl.reverseA },
        { name: "Gb ⟂ McMa", from: pt(g.Gb), towards: [pt(g.Mc), pt(g.Ma)], perpendicularAtI: cl.reverseB },
        { name: "Gc ⟂ MaMb", from: pt(g.Gc), towards: [pt(g.Ma), pt(g.Mb)], perpendicularAtI: cl.reverseC },
      ],
      intersection: pt(reverseP),
      missFromI: sig(reverseGap),
      atIncenter: cl.reverseConcurrence && reverseGap <= tol,
    },
    proof: {
      equalTangents: { atA: cl.tangentAtA, atB: cl.tangentAtB, atC: cl.tangentAtC },
      radiiPerpendicularToSides: {
        IGaToBC: cl.radiusToSideBC, IGbToCA: cl.radiusToSideCA, IGcToAB: cl.radiusToSideAB,
      },
      bisectorsPerpendicularToContactSides: {
        AIToGbGc: cl.bisectorAtA, BIToGcGa: cl.bisectorAtB, CIToGaGb: cl.bisectorAtC,
      },
    },
    claims: cl,
    allClaimsHold: cl.all,
  };
}

/** Shared example arguments: the live saved triangle from the fixture. */
const EXAMPLE_ARGS = '{"A":[93,250],"B":[354,280],"C":[270,76.07695154586737]}';

export function actions(): GameActions {
  return {
    perpendicular_concurrence: {
      describe:
        "For a triangle ABC (corners as [x, y] or { x, y } in the page's 420 x 360 board units, y down; omit a corner for the opening picture), use the real core to drop perpendiculars from the side midpoints Ma, Mb, Mc onto the opposite sides of the contact triangle and report their feet D, E, F and common point T, with each line's miss from T. T should be (A+B+C-I)/2, the incenter of the medial triangle, so the report also gives I, that formula point, the incircle radius and the core's claim checks; width, height, showNames and showHint are optional and a flat triangle is refused.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const { g, cl } = requireDrawing(C, s);
        const r = reading(C, s, g, cl);
        return {
          ...r,
          note:
            `The core's T is (${r.commonPoint!.x}, ${r.commonPoint!.y}); the medial incenter is ` +
            `(${r.medialIncenter!.x}, ${r.medialIncenter!.y}) and (A+B+C-I)/2 is ` +
            `(${r.formulaPoint!.x}, ${r.formulaPoint!.y}). The worst miss of the three perpendiculars ` +
            `from T is ${r.concurrence.maxMiss} board units against a tolerance of ${r.concurrence.tolerance}. ` +
            "Because equal tangents from each vertex make AI perpendicular to GbGc, these perpendiculars are the medial triangle's angle bisectors, and all three bisectors meet at its incenter. This is a demonstration, so there is no win or loss.",
        };
      },
    },

    maxwell_reverse: {
      describe:
        "For the same triangle ABC, check Maxwell's reverse orthologic conclusion with the real core: the perpendiculars from the contact points Ga, Gb, Gc to the opposite sides of the medial triangle meet again at the original incenter I. Report the intersection of the first two such lines and its miss from I, each perpendicular residual, and the equal-tangent and angle-bisector facts that explain it; arguments and validation are as in perpendicular_concurrence.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const { g, cl } = requireDrawing(C, s);
        const r = reading(C, s, g, cl);
        return {
          board: r.board,
          triangle: r.triangle,
          incenter: r.incenter,
          incircleRadius: r.incircleRadius,
          midpoints: r.midpoints,
          contactPoints: r.contactPoints,
          reverse: r.reverse,
          proof: r.proof,
          allClaimsHold: r.allClaimsHold,
          note:
            "Swapping the contact and medial triangles, the perpendiculars from Ga, Gb and Gc " +
            (r.reverse.intersection
              ? `meet at (${r.reverse.intersection.x}, ${r.reverse.intersection.y}), ` +
                `${r.reverse.missFromI} board units from the incenter I = (${r.incenter!.x}, ${r.incenter!.y}). `
              : "have no unique intersection in this triangle. ") +
            "Equal tangent lengths from each vertex give AGb = AGc, so AI is perpendicular to GbGc and the same bisector argument runs backwards. This is an illustration with no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Gergonne Medial state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Gergonne Medial position must be an object");
  }
  const C = core();
  let s: State;
  let savedReadable = true;
  try {
    s = buildState(C, state);
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const saved = {
    width: s.width, height: s.height,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showNames: s.showNames, showHint: s.showHint,
  };
  const g = C.compute(s);
  const cl = C.claims(s);
  if (!g.valid || !cl) {
    return {
      ...state,
      stateVersion,
      savedReadable,
      saved,
      valid: false,
      drawingPossible: false,
      note:
        "Track.state saved the three draggable corners, the 420 x 360 board size and the two switches, but those corners are flat or nearly so: the core has no usable incircle or perpendicular feet here. This is a demonstration with no win or loss.",
    };
  }
  const r = reading(C, s, g, cl);
  return {
    ...state,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    drawingPossible: true,
    isIllustration: true,
    triangle: r.triangle,
    incenter: r.incenter,
    incircleRadius: r.incircleRadius,
    commonPoint: r.commonPoint,
    medialIncenter: r.medialIncenter,
    allClaimsHold: r.allClaimsHold,
    reading: r,
    note: !savedReadable
      ? "The saved fields could not be read as three board corners, so the core's opening triangle was reconstructed; the reading below is of that picture."
      : "Track.state saved the three corners the player drags, the board size and the names/hint switches. The core rebuilds the incircle and contact triangle, the three midpoints and their perpendicular feet, and checks that they concur at (A+B+C-I)/2 and that Maxwell's reverse perpendiculars concur at I. This is a demonstration: there is no win or loss.",
  };
}
