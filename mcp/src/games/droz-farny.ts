/*
 * run_game_logic actions and saved-position reader for the Droz-Farny line
 * theorem (the applet DrozFarny, not its sibling DrozFarnyCircles).
 *
 * The real core is droz-farny/droz-farny-core.js, copied into
 * src/generated/cores/ at build time. Every number below is measured by it.
 * See _shared.ts for the shape of a game module.
 *
 * Two perpendicular lines through the orthocenter H of ABC cut the three
 * sidelines in three pairs X,X'; Y,Y'; Z,Z'. The three midpoints of those pairs
 * are collinear. More generally the points tX + (1-t)X', tY + (1-t)Y',
 * tZ + (1-t)Z' are collinear for the same t: in coordinates at H with the two
 * lines as axes the six cuts are (a,0),(0,b),..., and the collinearity
 * determinant picks up the factor t(1-t) times the determinant at t = 0.
 * Each pair also sees H under a right angle, so its midpoint is the centre of
 * the circle through H and that pair. The core's `errors()` measures all of
 * these claims; this module reports them in tutor-friendly units.
 *
 * DrozFarnyCircles is a DIFFERENT theorem (two congruent circles for a pair of
 * isogonal conjugates) and makes no midpoint claim; none of its code is used
 * here.
 *
 * Coordinates are board units of the illustration's 400 x 300 viewBox, y down.
 * This is a demo: there is no win or loss, only an explored picture.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["droz-farny"].DrozFarnyCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Circle = { centre: Point; r: number };
type State = {
  A: Point; B: Point; C: Point; P: Point;
  ShowNames: boolean; ShowHint: boolean; ShowAltitudes: boolean; ShowLine: boolean;
  ZZpH: boolean; YYpH: boolean; XXpH: boolean; ABC: boolean;
  AReflP: boolean; BReflP: boolean; CReflP: boolean;
  AReflL: boolean; BReflL: boolean; CReflL: boolean;
};
type Figure = {
  H: Point | null; Ha: Point | null; Hb: Point | null; Hc: Point | null;
  Ka: Point | null; Kb: Point | null; Kc: Point | null;
  line: { p: Point | null; q: Point | null };
  second: { p: Point | null; q: Point | null };
  X: Point | null; Xp: Point | null; Y: Point | null; Yp: Point | null;
  Z: Point | null; Zp: Point | null;
  Ma: Point | null; Mb: Point | null; Mc: Point | null;
  Circle: Circle | null; Ca: Circle | null; Cb: Circle | null; Cc: Circle | null;
  M: Point | null; Q: Point | null;
};
type Errors = Record<string, number>;

/** Each residual is a tiny gap; keep its size and sign instead of rounding to zero. */
const TOL = 1e-5;
const OPTION_KEYS = [
  "ShowNames", "ShowHint", "ShowAltitudes", "ShowLine",
  "ZZpH", "YYpH", "XXpH", "ABC",
  "AReflP", "BReflP", "CReflP", "AReflL", "BReflL", "CReflL",
] as const;
const SIDE_T = [-0.5, 0, 0.1, 0.25, 0.5, 0.75, 1, 1.5];

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const circleView = (c: Circle | null) => {
  const centre = pt(c && c.centre);
  return centre && c && Number.isFinite(c.r) ? { centre, radius: round(c.r) } : null;
};
const small = (v: number | null | undefined): boolean =>
  typeof v === "number" && Number.isFinite(v) && v <= TOL;

/** Accept both the page's saved {x, y} and a short [x, y] argument. */
function pointArg(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`argument "${key}" must hold finite numeric coordinates, got ${JSON.stringify(raw)}`);
    }
  } else {
    throw new Error(`argument "${key}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${key}" must hold finite numeric coordinates, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function boolArg(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be a boolean, got ${JSON.stringify(v)}`);
  return v;
}

/** A real core state: four draggable points plus the applet's fourteen switches. */
function readState(C: Core, args: Json): State {
  const seed = C.start({}) as unknown as State;
  const opts: Json = {
    A: pointArg(args, "A", seed.A),
    B: pointArg(args, "B", seed.B),
    C: pointArg(args, "C", seed.C),
    P: pointArg(args, "P", seed.P),
  };
  for (const key of OPTION_KEYS) opts[key] = boolArg(args, key, seed[key]);
  // The core's start() only takes P and the switches from its options; the
  // three corners are installed with move(), exactly as the page's UI does.
  let s = C.start(opts) as unknown as State;
  s = C.move(s, "A", opts.A) as unknown as State;
  s = C.move(s, "B", opts.B) as unknown as State;
  s = C.move(s, "C", opts.C) as unknown as State;
  return s;
}

/** A usable construction, or a helpful error for the tutor's model. */
function live(C: Core, args: Json) {
  const s = readState(C, args);
  const f = C.compute(s as never);
  const g = f as unknown as Figure;
  if (!C.finite(g.H) || !C.finite(g.Ma) || !C.finite(g.Mb) || !C.finite(g.Mc)) {
    throw new Error(
      "those points do not give six finite cuts: the triangle must be non-degenerate and the line through P and the orthocenter must not be parallel to a side or pass through the orthocenter. Move P and try again.",
    );
  }
  return { s, f, g };
}

/** The whole picture at one position, with each applet claim's residual. */
function reading(C: Core, s: State, f: ReturnType<Core["compute"]>, g: Figure) {
  const e = C.errors(f) as unknown as Errors;
  const cuts = [
    { name: "X", mate: "X'", side: "BC", onLine: "first (H–P)", point: pt(g.X) },
    { name: "X'", mate: "X", side: "BC", onLine: "second (perpendicular)", point: pt(g.Xp) },
    { name: "Y", mate: "Y'", side: "CA", onLine: "first (H–P)", point: pt(g.Y) },
    { name: "Y'", mate: "Y", side: "CA", onLine: "second (perpendicular)", point: pt(g.Yp) },
    { name: "Z", mate: "Z'", side: "AB", onLine: "first (H–P)", point: pt(g.Z) },
    { name: "Z'", mate: "Z", side: "AB", onLine: "second (perpendicular)", point: pt(g.Zp) },
  ];
  const mids = [
    { name: "Ma", side: "BC", pair: ["X", "X'"], midpoint: pt(g.Ma), circle: circleView(g.Ca),
      rightAngleError: sig(e.rightX), diameterError: sig(e.xDiameter), hOnCircleError: sig(e.hOnX),
      reflectionOnCircleError: sig(e.kaOnX), reflectionOnCircumcircleError: sig(e.kaOnABC) },
    { name: "Mb", side: "CA", pair: ["Y", "Y'"], midpoint: pt(g.Mb), circle: circleView(g.Cb),
      rightAngleError: sig(e.rightY), diameterError: sig(e.yDiameter), hOnCircleError: sig(e.hOnY),
      reflectionOnCircleError: sig(e.kbOnY), reflectionOnCircumcircleError: sig(e.kbOnABC) },
    { name: "Mc", side: "AB", pair: ["Z", "Z'"], midpoint: pt(g.Mc), circle: circleView(g.Cc),
      rightAngleError: sig(e.rightZ), diameterError: sig(e.zDiameter), hOnCircleError: sig(e.hOnZ),
      reflectionOnCircleError: sig(e.kcOnZ), reflectionOnCircumcircleError: sig(e.kcOnABC) },
  ];
  const samples = SIDE_T.map((t) => ({ t, signedArea: sig(C.collinearity(f, t)) }));
  const allHold = Object.values(e).every(small) && samples.every((v) => small(v.signedArea));
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    pointChoosingTheLine: pt(s.P),
    orthocenter: pt(g.H),
    altitudeFeet: { Ha: pt(g.Ha), Hb: pt(g.Hb), Hc: pt(g.Hc) },
    perpendicularLines: {
      first: { from: pt(g.line.p), to: pt(g.line.q) },
      second: { from: pt(g.second.p), to: pt(g.second.q) },
    },
    cuts,
    midpoints: mids,
    collinearity: {
      signedAreaAtHalf: sig(e.midpoints),
      largestAcrossT: sig(e.anyT),
      // det(t) = t(1-t) * det(0): the same line for every t, including outside [0,1].
      samples,
      holds: small(e.midpoints) && small(e.anyT) && samples.every((v) => small(v.signedArea)),
    },
    circumcircle: circleView(g.Circle),
    reflectionsOfH: { Ka: pt(g.Ka), Kb: pt(g.Kb), Kc: pt(g.Kc) },
    secondCommonPointM: pt(g.M),
    MOnAllThreeCircles: { X: sig(e.mOnX), Y: sig(e.mOnY), Z: sig(e.mOnZ) },
    Q: pt(g.Q),
    QOnCircumcircle: sig(e.qOnABC),
    residuals: Object.fromEntries(Object.entries(e).map(([k, v]) => [k, sig(v)])),
    allHold,
    tolerance: TOL,
    status: C.describe(f),
    theorem: "Droz-Farny line theorem: the midpoints of the three pairs of cuts on the sidelines are collinear for any two perpendicular lines through the orthocenter; the points cut with the same t stay collinear because det(t) = t(1-t) det(0).",
    notTheSibling: "This is the DrozFarny line applet, not DrozFarnyCircles: the sibling's two congruent circles for isogonal conjugates make no midpoint claim and are not used here.",
  };
}

export function actions(): GameActions {
  return {
    cuts_and_midpoints: {
      describe:
        "For a triangle with corners A, B, C and a point P (each {x, y} or [x, y] on the page's 400 x 300 board, y down; omit any point to keep the illustration's opening one), report the orthocenter H, the two perpendicular lines through H, their six cuts with the sidelines (X,X' on BC; Y,Y' on CA; Z,Z' on AB), and the three midpoints Ma, Mb, Mc with the circles centred there through H and each pair. Also reports the collinearity of the three midpoints and of the t-points for t = -0.5, 0, 0.1, 0.25, 0.5, 0.75, 1, 1.5, showing the t(1-t) factor: the marks line up for every t, not just at the midpoints. Refuses a degenerate triangle or a line parallel to a side; an optional finite `t` in [-10, 10] adds one more sample.",
      args: '{ "A": [200.81, 75.03], "B": [150.98, 206.76], "C": [273.50, 135.10], "P": [60, 140] }',
      run: (args) => {
        const C = core();
        const { s, f, g } = live(C, args);
        const view = reading(C, s, f, g);
        const extraT = args.t === undefined || args.t === null ? null : Number(args.t);
        if (extraT !== null && (!Number.isFinite(extraT) || Math.abs(extraT) > 10)) {
          throw new Error('argument "t" must be a finite number between -10 and 10');
        }
        return {
          ...view,
          ...(extraT === null ? {} : {
            requestedT: { t: extraT, signedArea: sig(C.collinearity(f, extraT)) },
          }),
          note:
            "Drop the altitudes to find H. The line HP and its perpendicular cut BC at X, X', CA at Y, Y' and AB at Z, Z'. Each pair subtends a right angle at H, so its midpoint is the centre of a circle through H and the pair. In coordinates at H with those lines as axes, the determinant for the three t-points equals t(1-t) times its value at t = 0, and that value vanishes here: the three marks lie on one line. The residuals are tiny but not exactly zero because the core's circles use the applet's mean of three distances.",
        };
      },
    },
    check_claims: {
      describe:
        "Test every claim the Droz-Farny line page makes for triangle A, B, C and point P ({x, y} or [x, y], defaults as in cuts_and_midpoints): the two lines are perpendicular and each cut pair subtends a right angle at H; each midpoint is the centre of the circle through H and its pair, so XX', YY', ZZ' are diameters; the midpoints and all the t-points are collinear; the reflections of H in the sides lie on both the circumcircle of ABC and the matching pair circle; their line-reflections meet on the circumcircle at Q; and M is the second common point of the three circles. Returns each residual with its sign, whether all claims hold to 1e-5, and the list of failures. Arguments as in cuts_and_midpoints.",
      args: '{ "A": [200.81, 75.03], "B": [150.98, 206.76], "C": [273.50, 135.10], "P": [60, 140] }',
      run: (args) => {
        const C = core();
        const { s, f, g } = live(C, args);
        const view = reading(C, s, f, g);
        const failed = Object.entries(view.residuals)
          .filter(([, v]) => !small(v))
          .map(([k]) => k);
        return {
          triangle: view.triangle,
          orthocenter: view.orthocenter,
          residuals: view.residuals,
          collinearity: view.collinearity,
          failed,
          allHold: view.allHold && failed.length === 0,
          tolerance: TOL,
          note: failed.length === 0
            ? "Every claim holds here to 1e-5. The right angles put H on each circle with centre at a midpoint, the determinant's t(1-t) factor keeps the three marks collinear for any t, the reflections of H lie on the circumcircle and their pair circles, Q lies on the circumcircle, and M lies on all three pair circles."
            : `These measurements exceed 1e-5 here: ${failed.join(", ")}. Move P away from H and away from a direction parallel to a side, and keep A, B, C non-collinear.`,
          notTheSibling: view.notTheSibling,
        };
      },
    },
  };
}

/** The saved picture (four points and fourteen switches) with a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Droz-Farny state version ${stateVersion}`);
  const C = core();
  const s = readState(C, state);
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P),
    ...Object.fromEntries(OPTION_KEYS.map((key) => [key, s[key]])),
  };
  const f = C.compute(s as never);
  const g = f as unknown as Figure;
  if (!C.finite(g.H) || !C.finite(g.Ma) || !C.finite(g.Mb) || !C.finite(g.Mc)) {
    return {
      ...saved,
      degenerate: true,
      note: "The saved points do not give six finite cuts (the triangle is degenerate, or the line through P and the orthocenter is parallel to a side or passes through H), so there are no midpoints to check. Move a handle on the page and look again.",
    };
  }
  return {
    ...saved,
    degenerate: false,
    reading: reading(C, s, f, g),
    note:
      "Track.state saved the four draggable points and the applet's fourteen switches. The real core rebuilds the orthocenter, the two perpendicular lines, the six cuts, the three midpoint circles and the reflections from exactly those points, then checks each page claim at this position. This is an illustration with no win or loss; the sibling DrozFarnyCircles is a different theorem.",
  };
}
