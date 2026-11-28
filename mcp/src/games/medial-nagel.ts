/*
 * run_game_logic actions and saved-position reader for Medial Nagel.
 *
 * The real core is medial-nagel/medial-nagel-core.js, copied into
 * src/generated/cores/ at build time. It transcribes the applet's GeoSDoub
 * routines: D, E, F are the midpoints of BC, CA, AB; the incircles of AEF, BDF
 * and CDE touch EF, DF, DE at P, Q, R; and DP, EQ, FR meet at M. The page's
 * claims, all checked here with the real core, are that M is the Nagel point
 * of DEF (barycentrics s-d : s-e : s-f) and the incenter of the
 * anticomplementary triangle ABC, that P, Q, R are the excircle touch points
 * of DEF, that the incircle contacts P', Q', R' are their isotomic reflections,
 * that G (M's isotomic conjugate) is the Gergonne point, and that the three
 * equal-tangent pairs have a common length.
 *
 * Every number below is measured by the real core. Coordinates are board units
 * in the page's 500 x 450 view, y down. This is a demonstration, so there is
 * no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  width: number; height: number;
  A: Point; B: Point; C: Point;
  showNames: boolean; showIncircle: boolean; showHint: boolean; showExtra: boolean;
};
type Circle = { center: Point; radius: number; feet: Point[] };
type Excircle = { center: Point; foot: Point; radius: number };
type Bary = { u: number; v: number; w: number };
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; E: Point; F: Point;
  P: Point; Q: Point; R: Point; M: Point; G: Point;
  Pp: Point; Qp: Point; Rp: Point; Iabc: Point;
  circleA: Circle; circleB: Circle; circleC: Circle; circleI: Circle;
  excircles: Excircle[];
  sides: { d: number; e: number; f: number; s: number };
  area: number; valid: boolean;
};
type Claims = {
  valid: boolean; ERFQ: boolean; DRFP: boolean; DQEP: boolean;
  splitP: boolean; splitQ: boolean; splitR: boolean; concurrence: boolean;
  nagel: boolean; anticomplementary: boolean; exTouch: boolean; touchLengths: boolean;
  isotomic: boolean; gergonne: boolean; conjugates: boolean; tangency: boolean; all: boolean;
};
interface Core {
  WIDTH: number; HEIGHT: number;
  start(options?: Json): State;
  reset(state: State, options?: Json): State;
  withPoint(state: State, name: string, p: Point): State;
  withOption(state: State, name: string, value: boolean): State;
  compute(state: State): Geometry;
  claims(state: State, tol?: number): Claims | null;
  add(p: Point, q: Point): Point;
  sub(p: Point, q: Point): Point;
  cross(p: Point, q: Point): number;
  dist(p: Point, q: Point): number;
  bary(D: Point, E: Point, F: Point, u: number, v: number, w: number): Point;
  baryCoords(p: Point, D: Point, E: Point, F: Point): Bary | null;
}

const core = (): Core => cores["medial-nagel"].MedialNagelCore as unknown as Core;

/* The core is exact up to floating point; tidy only the numbers we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const cb = (b: Bary | null): Bary | null =>
  b && Number.isFinite(b.u) && Number.isFinite(b.v) && Number.isFinite(b.w)
    ? { u: r6(b.u), v: r6(b.v), w: r6(b.w) }
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
 * A real core state: the board size and four switches come from the applet's
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
    showIncircle: flag(args, "showIncircle", seed.showIncircle),
    showHint: flag(args, "showHint", seed.showHint),
    showExtra: flag(args, "showExtra", seed.showExtra),
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

/** Perpendicular distance from p to the infinite line qr (board units). */
function lineMiss(C: Core, p: Point, q: Point, r: Point): number {
  const len = C.dist(q, r);
  return len > 0 ? Math.abs(C.cross(C.sub(p, q), C.sub(r, q))) / len : NaN;
}

/** The whole construction, measured by the same core the page draws with. */
function reading(C: Core, s: State, g: Geometry, cl: Claims) {
  const { D, E, F, P, Q, R, M, G, Pp, Qp, Rp, Iabc } = g;
  const { d, e, f, s: semi } = g.sides;
  const size = Math.max(d, e, f);
  const tol = 1e-7 * size;

  /* The Nagel point of DEF has barycentrics (s-d : s-e : s-f); the Gergonne
   * point has (1/(s-d) : 1/(s-e) : 1/(s-f)). Both are measured against M/G. */
  const nagelPoint = C.bary(D, E, F, semi - d, semi - e, semi - f);
  const gergonnePoint = C.bary(D, E, F, 1 / (semi - d), 1 / (semi - e), 1 / (semi - f));
  const mCoords = C.baryCoords(M, D, E, F);
  const isotomicOfM = mCoords
    ? C.bary(D, E, F, 1 / mCoords.u, 1 / mCoords.v, 1 / mCoords.w)
    : null;

  /* The three equal-tangent pairs, with the common length the core expects. */
  const tangentPairs = [
    { strokes: 1, sides: ["ER", "FQ"], a: C.dist(E, R), b: C.dist(F, Q), expected: semi - d, holds: cl.ERFQ },
    { strokes: 2, sides: ["FP", "DR"], a: C.dist(F, P), b: C.dist(D, R), expected: semi - e, holds: cl.DRFP },
    { strokes: 3, sides: ["EP", "DQ"], a: C.dist(E, P), b: C.dist(D, Q), expected: semi - f, holds: cl.DQEP },
  ].map((t) => ({
    ...t,
    lengths: [r6(t.a), r6(t.b)],
    expected: r6(t.expected),
    difference: sig(Math.abs(t.a - t.b)),
    equal: Math.abs(t.a - t.b) <= tol,
    atExpectedLength: Math.abs(t.a - t.expected) <= tol && Math.abs(t.b - t.expected) <= tol,
  }));

  /* P, Q, R against the three excircle touch points of DEF. */
  const exTouch = [
    { vertex: "D", side: "EF", touch: P, circle: g.excircles[0], holds: cl.exTouch && C.dist(P, g.excircles[0].foot) <= tol },
    { vertex: "E", side: "DF", touch: Q, circle: g.excircles[1], holds: cl.exTouch && C.dist(Q, g.excircles[1].foot) <= tol },
    { vertex: "F", side: "DE", touch: R, circle: g.excircles[2], holds: cl.exTouch && C.dist(R, g.excircles[2].foot) <= tol },
  ].map((t) => ({
    vertex: t.vertex, side: t.side,
    contactPoint: pt(t.touch), excenter: pt(t.circle.center), exfoot: pt(t.circle.foot),
    radius: r6(t.circle.radius), isExcircleTouch: t.holds,
  }));

  /* The cevians DP, EQ, FR through M, with their misses from M. */
  const cevians = [
    { name: "DP", from: D, to: P },
    { name: "EQ", from: E, to: Q },
    { name: "FR", from: F, to: R },
  ].map((l) => {
    const miss = lineMiss(C, M, l.from, l.to);
    return { name: l.name, from: pt(l.from), to: pt(l.to), missFromM: sig(miss), throughM: miss <= tol };
  });

  /* The incircle contacts are the isotomic reflections of P, Q, R. */
  const incircleContacts = [
    { side: "EF", excircle: P, incircle: Pp, reflected: C.add(P, Pp), mirror: C.add(E, F) },
    { side: "DF", excircle: Q, incircle: Qp, reflected: C.add(Q, Qp), mirror: C.add(D, F) },
    { side: "DE", excircle: R, incircle: Rp, reflected: C.add(R, Rp), mirror: C.add(D, E) },
  ].map((r) => ({
    side: r.side, excircleTouch: pt(r.excircle), incircleTouch: pt(r.incircle),
    sum: pt(r.reflected), sideSum: pt(r.mirror),
    error: sig(C.dist(r.reflected, r.mirror)), isotomic: C.dist(r.reflected, r.mirror) <= tol,
  }));

  const claimRows: Array<{ claim: string; holds: boolean }> = [
    { claim: "ER = FQ", holds: cl.ERFQ },
    { claim: "FP = DR", holds: cl.DRFP },
    { claim: "EP = DQ", holds: cl.DQEP },
    { claim: "EF + ER = DF + DR", holds: cl.splitP },
    { claim: "DF + FP = DE + EP", holds: cl.splitQ },
    { claim: "DE + DQ = EF + FQ", holds: cl.splitR },
    { claim: "DP, EQ, FR concur at M", holds: cl.concurrence },
    { claim: "M is the Nagel point of DEF", holds: cl.nagel },
    { claim: "M is the incenter of ABC", holds: cl.anticomplementary },
    { claim: "P, Q, R are excircle touches", holds: cl.exTouch },
    { claim: "tangent lengths = s-d, s-e, s-f", holds: cl.touchLengths },
    { claim: "P', Q', R' are isotomic to P, Q, R", holds: cl.isotomic },
    { claim: "G is the Gergonne point", holds: cl.gergonne },
    { claim: "M and G are isotomic conjugates", holds: cl.conjugates },
    { claim: "little incircles touch at P, Q, R", holds: cl.tangency },
  ];

  return {
    board: { width: s.width, height: s.height },
    options: {
      showNames: s.showNames, showIncircle: s.showIncircle,
      showHint: s.showHint, showExtra: s.showExtra,
    },
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    medialTriangle: { D: pt(D), E: pt(E), F: pt(F) },
    sides: { d: r6(d), e: r6(e), f: r6(f), semiperimeter: r6(semi) },
    area: r6(g.area),
    nagel: {
      point: pt(M),
      cevians,
      commonPoint: pt(M),
      barycentrics: cb(mCoords),
      expectedBarycentrics: { D: r6(semi - d), E: r6(semi - e), F: r6(semi - f) },
      formulaPoint: pt(nagelPoint),
      formulaMiss: sig(C.dist(M, nagelPoint)),
      anticomplementaryIncenter: pt(Iabc),
      anticomplementaryMiss: sig(C.dist(M, Iabc)),
      allThroughM: cl.concurrence && cevians.every((l) => l.throughM),
    },
    excircleTouches: exTouch,
    equalTangents: tangentPairs,
    isotomic: {
      nagel: pt(M),
      gergonne: pt(G),
      nagelBarycentrics: cb(mCoords),
      conjugateOfM: pt(isotomicOfM),
      conjugateMiss: sig(isotomicOfM ? C.dist(isotomicOfM, G) : NaN),
      gergonneFormula: pt(gergonnePoint),
      gergonneMiss: sig(C.dist(G, gergonnePoint)),
      incircleContacts,
      incircleAreIsotomic: cl.isotomic,
      conjugates: cl.conjugates,
      gergonneIsPoint: cl.gergonne,
    },
    claims: claimRows,
    claimsPassed: claimRows.filter((r) => r.holds).length,
    claimCount: claimRows.length,
    tolerance: sig(tol),
    allClaimsHold: cl.all,
  };
}

/* The exact triangle saved by the live page in porting/live-fixtures/. */
const EXAMPLE_ARGS =
  '{"A":[154,340],"B":[450,340],"C":[250,43.39745962155615]}';

export function actions(): GameActions {
  return {
    nagel_point: {
      describe:
        "For a triangle ABC (corners as [x, y] or { x, y } in the page's 500 x 450 board units, y down; omit a corner for the opening picture), use the real core to build the medial triangle DEF, the incircles of AEF/BDF/CDE touching EF/DF/DE at P/Q/R, and the cevians DP/EQ/FR. Reports their common point M, its barycentrics (s-d : s-e : s-f) and identity as the incenter of the anticomplementary triangle ABC, P/Q/R as the excircle touch points of DEF, and the three equal-tangent pairs ER = FQ, FP = DR, EP = DQ with their common lengths. width, height and the showNames/showIncircle/showHint/showExtra switches are optional; a flat triangle is refused.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const { g, cl } = requireDrawing(C, s);
        const r = reading(C, s, g, cl);
        const m = r.nagel.point!;
        const i = r.nagel.anticomplementaryIncenter!;
        return {
          board: r.board,
          triangle: r.triangle,
          medialTriangle: r.medialTriangle,
          sides: r.sides,
          area: r.area,
          nagel: r.nagel,
          excircleTouches: r.excircleTouches,
          equalTangents: r.equalTangents,
          claimsPassed: r.claimsPassed,
          claimCount: r.claimCount,
          allClaimsHold: r.allClaimsHold,
          note:
            `DP, EQ and FR meet at M = (${m.x}, ${m.y}), which the core places ` +
            `${r.nagel.formulaMiss} board units from the Nagel point (s-d : s-e : s-f) of DEF and ` +
            `${r.nagel.anticomplementaryMiss} units from the incenter I = (${i.x}, ${i.y}) of ABC. ` +
            "Equal tangents from each medial vertex give ER = FQ, FP = DR and EP = DQ, so P, Q, R " +
            "are the excircle touch points and DP, EQ, FR are cevians that concur at the Nagel point. " +
            "This is an illustration, so there is no win or loss.",
        };
      },
    },

    isotomic_conjugacy: {
      describe:
        "For the same triangle ABC, check the page's isotomic claims with the real core: the medial incircle contacts P', Q', R' are the isotomic reflections of the excircle touches P, Q, R on EF, DF, DE, and the Gergonne point G is the isotomic conjugate of the Nagel point M of DEF (invert M's barycentric coordinates and you get G, and vice versa). Reports M and G, their barycentrics, the conjugate point, each incircle/excircle contact pair, and a boolean for every claim on the page. Arguments and validation are as in nagel_point.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const { g, cl } = requireDrawing(C, s);
        const r = reading(C, s, g, cl);
        const iso = r.isotomic;
        return {
          board: r.board,
          triangle: r.triangle,
          medialTriangle: r.medialTriangle,
          sides: r.sides,
          isotomic: iso,
          claims: r.claims,
          claimsPassed: r.claimsPassed,
          claimCount: r.claimCount,
          allClaimsHold: r.allClaimsHold,
          note:
            `M = (${iso.nagel!.x}, ${iso.nagel!.y}) and G = (${iso.gergonne!.x}, ${iso.gergonne!.y}); ` +
            `inverting M's barycentrics gives (${iso.conjugateOfM!.x}, ${iso.conjugateOfM!.y}), ` +
            `${iso.conjugateMiss} units from G. ` +
            "Reflecting P, Q, R in the midpoints of EF, DF, DE gives the incircle contacts P', Q', R', " +
            "so the Nagel and Gergonne points are isotomic conjugates. " +
            `${r.claimsPassed} of ${r.claimCount} core claims hold for this triangle. ` +
            "This is a demonstration with no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Medial Nagel state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Medial Nagel position must be an object");
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
    showNames: s.showNames, showIncircle: s.showIncircle,
    showHint: s.showHint, showExtra: s.showExtra,
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
      isIllustration: true,
      note:
        "Track.state saved the three draggable corners, the 500 x 450 board size and the four " +
        "switches, but those corners are flat or nearly so: the core has no usable incircles or " +
        "perpendicular feet here. This is a demonstration with no win or loss.",
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
    medialTriangle: r.medialTriangle,
    nagelPoint: r.nagel.point,
    gergonnePoint: r.isotomic.gergonne,
    allClaimsHold: r.allClaimsHold,
    reading: r,
    note: !savedReadable
      ? "The saved fields could not be read as three board corners, so the core's opening triangle was reconstructed; the reading below is of that picture."
      : "Track.state saved the three corners the player drags, the board size and the names/incircle/hint/extra switches. The core rebuilds the medial triangle, the four incircles, the points P/Q/R and the cevians, and checks that they concur at the Nagel point, which is also the incenter of ABC. This is an illustration: there is no win or loss.",
  };
}
