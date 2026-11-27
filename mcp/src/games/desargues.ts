/*
 * run_game_logic actions and saved-position reader for Desargues.
 *
 * The real core is desargues/desargues-core.js, copied into
 * src/generated/cores/ at build time. Two triangles A1B1C1 and A2B2C2 are
 * perspective from a point when A1A2, B1B2 and C1C2 meet at one centre;
 * Desargues' theorem says that is equivalent to the three crossings of
 * corresponding sides (ab, bc, ca) lying on one axis. The core reproduces the
 * applet's yellow centre dot, its NaN parallel test and its extended axis
 * segments, and measures both directions of the theorem independently. Every
 * number below comes from that core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["desargues"].DesarguesCore;

type Point = { x: number; y: number };
type State = {
  A1: Point; B1: Point; C1: Point; A2: Point; B2: Point; C2: Point;
  mode: string; moves: number; explored: boolean;
};

/** The theorem holds exactly; positions dragged on the board are pixel-rounded. */
const THEOREM_TOL = 1e-6;

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
const usable = (p: unknown): Point | null => {
  if (!p || typeof p !== "object") return null;
  const q = p as Point;
  return Number.isFinite(q.x) && Number.isFinite(q.y) ? q : null;
};
const pt = (p: unknown): Point | null => {
  const q = usable(p);
  return q ? { x: round(q.x), y: round(q.y) } : null;
};

/** A corner as the page saves it ({x, y}) or as a short [x, y]. */
function pointArg(args: Json, key: string, fallback: Point): Point {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { x, y }`);
    const x = Number(v[0]), y = Number(v[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${key}" is not a finite point`);
    return { x, y };
  }
  if (typeof v !== "object") throw new Error(`argument "${key}" must be [x, y] or { x, y }`);
  const o = v as Json;
  try {
    return { x: num(o, "x"), y: num(o, "y") };
  } catch (e) {
    throw new Error(`argument "${key}": ${(e as Error).message}`);
  }
}

/** Build a real core state; missing corners keep the applet's opening ones. */
function readState(C: ReturnType<typeof core>, args: Json): State {
  const seed = C.START as Record<string, Point>;
  const mode = args.mode === undefined || args.mode === null ? "direct" : String(args.mode);
  if (!C.MODES.includes(mode)) {
    throw new Error(`argument "mode" must be one of ${C.MODES.join(", ")}, got ${JSON.stringify(args.mode)}`);
  }
  const opts: Json = { mode };
  for (const name of C.NAMES as string[]) opts[name] = pointArg(args, name, seed[name]);
  const s = C.start(opts) as State;
  s.moves = num(args, "moves", 0);
  s.explored = args.explored === true;
  return s;
}

/**
 * The page's Menelaus calculation on the crossings of the first triangle's
 * sides: with P = bc, Q = ca, R = ab, the directed ratios
 * (B1P/PC1)(C1Q/QA1)(A1R/RB1) equal -1 exactly for perspective triangles.
 * The crossings come from the core's residuals (no pixel parallel cut-off).
 */
function menelaus(C: ReturnType<typeof core>, s: State, crossings: Record<string, unknown>) {
  const directed = (a: Point, b: Point, p: unknown): number | null => {
    const q = usable(p);
    if (!q) return null;
    const d = C.sub(b, a) as Point;
    const dd = C.dot(d, d) as number;
    if (!(dd > 0)) return null;
    const t = (C.dot(C.sub(q, a), d) as number) / dd;
    if (Math.abs(1 - t) < 1e-9) return null; // a crossing at b has no finite ratio
    return t / (1 - t);
  };
  const bc = directed(s.B1, s.C1, crossings.bc);
  const ca = directed(s.C1, s.A1, crossings.ca);
  const ab = directed(s.A1, s.B1, crossings.ab);
  const product = bc !== null && ca !== null && ab !== null ? bc * ca * ab : null;
  const isMinusOne = product !== null && Math.abs(product + 1) < THEOREM_TOL;
  return {
    ratios: { B1P_PC1: maybe(bc), C1Q_QA1: maybe(ca), A1R_RB1: maybe(ab) },
    where: { P: "bc", Q: "ca", R: "ab" },
    product: maybe(product),
    isMinusOne,
    equalsMinusOne: isMinusOne,
    identity: "(B1P/PC1)(C1Q/QA1)(A1R/RB1) = -1",
  };
}

/** Everything the real core measures at one position, in tutor-friendly units. */
function reading(C: ReturnType<typeof core>, s: State) {
  const g = C.compute(s);
  const r = C.residuals(s);
  const spread = r.concurrency as number;
  const axisError = r.collinearity as number;
  const perspectiveFromPoint = Number.isFinite(spread) && spread < THEOREM_TOL;
  const crossingsCollinear = Number.isFinite(axisError) && axisError < THEOREM_TOL;
  const corners = C.NAMES as string[];
  const linePairs = [["A1A2", "B1B2"], ["A1A2", "C1C2"], ["B1B2", "C1C2"]];
  return {
    mode: s.mode,
    moves: s.moves,
    explored: s.explored,
    result: C.result(s),
    corners: Object.fromEntries(corners.map((n) => [n, pt((s as unknown as Record<string, Point>)[n])])),
    vertexLines: (g.vertexLines as Array<{ name: string; a: Point; b: Point }>).map((l) => ({
      name: l.name, from: pt(l.a), to: pt(l.b),
    })),
    vertexCrossings: (g.direct.intersections as Point[]).map((p, i) => ({
      of: linePairs[i], point: pt(p),
    })),
    centre: {
      shown: g.direct.shown === true, // the applet's yellow dot: spread < 8 units
      point: pt(g.direct.point),
      spread: maybe(g.direct.spread as number),
    },
    sideLines: (g.sideLines as Array<{ name: string; a: Point; b: Point }>).map((l) => ({
      name: l.name, from: pt(l.a), to: pt(l.b),
    })),
    sideCrossings: Object.fromEntries((C.CROSS_NAMES as string[]).map((n) => {
      const c = (g.crosses as Record<string, { point: Point; nan: boolean }>)[n];
      return [n, { point: pt(c.point), nan: c.nan === true }];
    })),
    axisSegments: (g.axisSegments as Point[][]).map((seg) => seg.map((p) => pt(p))),
    residuals: { concurrencySpread: maybe(spread), collinearityError: maybe(axisError) },
    perspectiveFromPoint,
    crossingsCollinear,
    claims: {
      perspectiveFromPoint,
      crossingsCollinear,
      yellowDotShown: g.direct.shown === true,
    },
    menelaus: menelaus(C, s, r.crossings as Record<string, unknown>),
  };
}

const DIRECT_NOTE =
  "Desargues' theorem, direct view: if the matching-vertex lines A1A2, B1B2, C1C2 meet at one point (condition 1), the side crossings ab, bc and ca must lie on one line (condition 2). The page's condition 1 prints 'B2B2' once; that is a typo for B1B2, as its own proof and applet show.";
const CONVERSE_NOTE =
  "Desargues' converse: if the side crossings ab, bc and ca are collinear on the axis (condition 2), then A1A2, B1B2 and C1C2 must meet at one point (condition 1). The Menelaus product -1 on the first triangle's sides is the same condition written as directed ratios.";

export function actions(): GameActions {
  return {
    direct_centre: {
      describe:
        "For six corners A1, B1, C1, A2, B2, C2 (each {x, y} or [x, y], y downward, defaulting to the page's opening positions within its 400 x 300 board) and an optional mode (direct or converse), report the three lines joining matching vertices and their pairwise crossings, the yellow centre dot the applet draws when those crossings are within 8 units, the three side crossings ab, bc, ca with their axis, the exact concurrency and collinearity residuals, and the Menelaus product of directed ratios along the first triangle's sides. This checks condition 1 implying condition 2; the page's 'B2B2' in condition 1 is a typo for B1B2. Points outside the board are clamped and a bad mode or point is rejected.",
      args: '{"A1":[120,80],"B1":[280,100],"C1":[180,240],"A2":[80,45],"B2":[240,125],"C2":[186,213],"mode":"direct"}',
      run: (args) => {
        const C = core();
        return { ...reading(C, readState(C, args)), note: DIRECT_NOTE };
      },
    },
    converse_axis: {
      describe:
        "For the same six corners and mode, report ab = A1B1 ∩ A2B2, bc = B1C1 ∩ B2C2 and ca = C1A1 ∩ C2A2, the magenta axis segments joining them (extended past a parallel crossing as the applet does), how far the crossings are from one line, how far the matching-vertex crossings are from one point, and the Menelaus product (B1P/PC1)(C1Q/QA1)(A1R/RB1) = -1. This checks the converse: collinear side crossings force the vertex lines to concur. A null point means a parallel crossing; the product is then undefined.",
      args: '{"A1":[208,85],"B1":[204,135],"C1":[208,145],"A2":[205,109.375],"B2":[190,187.5],"C2":[190,156.25],"mode":"converse"}',
      run: (args) => {
        const C = core();
        return { ...reading(C, readState(C, args)), note: CONVERSE_NOTE };
      },
    },
  };
}

/** The six saved corners, mode and move count, with the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Desargues state version ${stateVersion}`);
  const C = core();
  const s = readState(C, state);
  const corners = Object.fromEntries((C.NAMES as string[]).map((n) => [
    n, pt((s as unknown as Record<string, Point>)[n]),
  ]));
  return {
    stateVersion,
    ...corners,
    mode: s.mode,
    moves: s.moves,
    explored: s.explored,
    reading: {
      ...reading(C, s),
      note:
        "Track.state saves the six dragged corners, the chosen view, the move count and whether the picture was changed. The reading recomputes the matching-vertex crossings and yellow centre, the side crossings and axis, both residuals and the Menelaus product from those same corners; switching views only changes what is drawn, never whether the two conditions hold.",
    },
  };
}
