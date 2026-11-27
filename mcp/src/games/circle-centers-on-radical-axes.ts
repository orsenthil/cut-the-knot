/*
 * run_game_logic actions and saved-position reader for Circle Centers On
 * Radical Axes.
 *
 * Three circles have three pairwise radical axes. The core
 * (circle-centers-on-radical-axes/circle-centers-on-radical-axes-core.js,
 * copied into src/generated/cores/ at build time) draws an axis as the common
 * chord when two circles meet, and otherwise as the perpendicular to the
 * centreline through the point where the two powers agree. It marks a centre
 * when it lies within one pixel of the radical axis of the *other* two circles,
 * and marks their common point O. Every number below comes from that core.
 * See _shared.ts for the shape of a game module.
 *
 * The page's claim is the orthocenter claim: if two of P, Q, R are marked,
 * the third is marked too, and then O is the orthocenter of triangle PQR.
 * Algebraically, writing f_P = (dist(P,Q)^2 - r_Q^2) - (dist(P,R)^2 - r_R^2)
 * and cyclically, a centre is marked exactly when its f is 0, and
 * f_P + f_Q + f_R = 0 identically, so two zeros force the third. Geometrically
 * each radical axis is perpendicular to the side joining the other two
 * centres, so a marked centre turns its axis into an altitude and O is where
 * the three altitudes meet. The reader reports both the power gaps and the
 * perpendicularity residuals.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-centers-on-radical-axes"].CircleCentersOnRadicalAxesCore;

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };
type CoreCircle = { center: Point; rim: Point };
type Line = { p: Point; r: Point };
type Board = { width: number; height: number; center: Point; circles: CoreCircle[] };
type Info = {
  skipped: boolean;
  center: Point;
  axes: Record<string, Line | null>;
  on: Record<string, boolean>;
  all: boolean;
};

const NAMES = ["P", "Q", "R"] as const;
const OPPOSITE: Record<string, string> = { P: "QR", Q: "RP", R: "PQ" };
/** Far from every board point: compute()'s one-pixel guard then cannot skip. */
const FAR: Point = { x: 1e9, y: 1e9 };

const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
/** Handle NaN/Infinity (parallel axes, coincident centres) as JSON null. */
const r6n = (v: number): number | null => Number.isFinite(v) ? r6(v) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;
const lineView = (l: Line | null | undefined): { p: Point | null; r: Point | null } | null =>
  l && Number.isFinite(l.p.x) && Number.isFinite(l.r.x) ? { p: pt(l.p), r: pt(l.r) } : null;

/** Accept the page's {x,y} points and the tutor's [x,y] arguments alike. */
function readPoint(v: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** Accept {center:{x,y},radius} (the saved form), flat {x,y,radius} or a rim point. */
function readCircle(v: unknown, label: string): CoreCircle {
  const o = v as Json | null;
  if (!o || typeof o !== "object") throw new Error(`${label} must be a circle object`);
  const center = readPoint(o.center !== undefined ? o.center : o, `${label} centre`);
  let radius: number;
  if (o.radius !== undefined || o.r !== undefined) {
    radius = Number(o.radius !== undefined ? o.radius : o.r);
  } else if (o.rim !== undefined) {
    const rim = readPoint(o.rim, `${label}.rim`);
    radius = Math.hypot(rim.x - center.x, rim.y - center.y);
  } else {
    throw new Error(`${label} needs a positive "radius" (or "rim")`);
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error(`${label}.radius must be a positive number, got ${JSON.stringify(radius)}`);
  }
  return { center, rim: { x: center.x + radius, y: center.y } };
}

/** Build the core's board from three circles, or from its own Reset diagram. */
function readBoard(args: Json): Board {
  const C = core();
  const width = num(args, "width", C.DEFAULT_WIDTH);
  const height = num(args, "height", C.DEFAULT_HEIGHT);
  if (width <= 0 || height <= 0) throw new Error('"width" and "height" must be positive');
  let circles: CoreCircle[];
  if (args.circles !== undefined && args.circles !== null) {
    if (!Array.isArray(args.circles) || args.circles.length !== 3) {
      throw new Error('"circles" must be an array of exactly three circles, each {center:{x,y},radius}');
    }
    circles = args.circles.map((c, i) => readCircle(c, `circles[${i}]`));
  } else {
    circles = (C.start({ width, height }) as unknown as Board).circles;
  }
  return { width, height, center: { x: width / 2, y: height / 2 }, circles };
}

/** The full core computation, bypassing the applet's "O near a centre" guard. */
function computeBoard(board: Board): Info {
  return core().compute(board, FAR) as unknown as Info;
}

/** Circles as plain centre/radius pairs, the form the core's power() takes. */
function plainCircles(board: Board): Circle[] {
  return board.circles.map((c) => core().asCircle(c) as unknown as Circle);
}

/** Name an axis by the two circles whose radical axis it is. */
function axisKind(line: Line | null, a: Circle, b: Circle, C: ReturnType<typeof core>): string {
  if (!line) return "degenerate: the two centres coincide";
  const crossings = C.circleIntersections(a, b) as Point[] | null;
  if (crossings && crossings[0] && crossings[1] &&
      C.dist(crossings[0], crossings[1]) >= C.ON_EPS) return "common chord of the two circles";
  return "perpendicular to the centreline at the equal-power point";
}

/** Build an axis-centred reading of one board; every geometric value is from the core. */
function analyse(board: Board) {
  const C = core();
  const info = computeBoard(board);
  const cs = plainCircles(board);
  const axes = info.axes || {};
  const pairs: Array<[number, number]> = [[0, 1], [1, 2], [2, 0]];

  const axisRows = pairs.map(([i, j]) => {
    const key = NAMES[i] + NAMES[j];
    const line = axes[key] || null;
    return {
      axis: key,
      circles: [NAMES[i], NAMES[j]],
      line: lineView(line),
      kind: axisKind(line, cs[i], cs[j], C),
    };
  });

  // f_P = power of P wrt Q − power of P wrt R, and cyclically.
  // C.power takes the core's {center, rim} circle, not the plain centre/radius.
  const powerGap = (v: number, a: number, b: number): number =>
    C.power(board.circles[a], cs[v].center) - C.power(board.circles[b], cs[v].center);
  const gaps = [powerGap(0, 1, 2), powerGap(1, 2, 0), powerGap(2, 0, 1)];

  const centres = NAMES.map((name, i) => {
    const [a, b] = i === 0 ? [1, 2] : i === 1 ? [2, 0] : [0, 1];
    const line = axes[OPPOSITE[name]] || null;
    return {
      name,
      center: pt(cs[i].center),
      oppositeAxis: OPPOSITE[name],
      distanceToAxis: line ? r6n(C.distPointLine(cs[i].center, line)) : null,
      marked: !!info.on[name],
      powerGap: r6(gaps[i]),
    };
  });

  // If all three are marked, O is the orthocenter: the vector vertex -> O is
  // perpendicular to the opposite side. Report the signed dot product per
  // unit of side length (0 means a true altitude).
  const O = info.center;
  const altitudeResidual = (v: number, a: number, b: number): number | null => {
    const sx = cs[a].center.x - cs[b].center.x;
    const sy = cs[a].center.y - cs[b].center.y;
    const len = Math.hypot(sx, sy);
    if (len < 1e-9 || !Number.isFinite(O.x) || !Number.isFinite(O.y)) return null;
    return r6n((sx * (O.x - cs[v].center.x) + sy * (O.y - cs[v].center.y)) / len);
  };
  const residuals = {
    fromP: altitudeResidual(0, 1, 2),
    fromQ: altitudeResidual(1, 2, 0),
    fromR: altitudeResidual(2, 0, 1),
  };
  const orthocenter = residuals.fromP !== null && residuals.fromQ !== null && residuals.fromR !== null &&
    Math.abs(residuals.fromP) < 0.01 && Math.abs(residuals.fromQ) < 0.01 && Math.abs(residuals.fromR) < 0.01;

  return {
    board: { width: board.width, height: board.height },
    circles: cs.map((c, i) => ({ name: NAMES[i], center: pt(c.center), radius: r4(c.radius) })),
    skipped: info.skipped,
    axes: axisRows,
    radicalCentre: pt(O),
    centres,
    on: info.on,
    allThreeMarked: !!info.all,
    powerGaps: {
      atP: r6(gaps[0]), atQ: r6(gaps[1]), atR: r6(gaps[2]),
      sum: r6(gaps[0] + gaps[1] + gaps[2]),
    },
    orthocenter: {
      // One pixel is the core's own tolerance for "on" a line.
      residualsPerUnitSide: residuals,
      holdsWithinOnePixel: orthocenter,
    },
  };
}

/** Radii that force two marks, from three centres and a chosen radius for P. */
function forcedRadii(centres: Point[], rP: number): Circle[] {
  if (!Array.isArray(centres) || centres.length !== 3) {
    throw new Error('"centers" must be an array of exactly three [x,y] points');
  }
  const [P, Q, R] = centres.map((c, i) => readPoint(c, `centers[${i}]`));
  if (!Number.isFinite(rP) || rP <= 0) throw new Error('"rP" must be a positive radius');
  const dPQ = Math.hypot(P.x - Q.x, P.y - Q.y);
  const dPR = Math.hypot(P.x - R.x, P.y - R.y);
  const dQR = Math.hypot(Q.x - R.x, Q.y - R.y);
  // f_Q = 0 gives r_R^2; f_P = 0 then gives r_Q^2. The identity forces f_R = 0.
  const rRsq = rP * rP + dQR * dQR - dPQ * dPQ;
  const rQsq = rP * rP + dQR * dQR - dPR * dPR;
  if (rRsq <= 0 || rQsq <= 0) {
    throw new Error(`"rP" = ${rP} is too small: it gives non-positive radii (${rQsq.toFixed(1)}, ${rRsq.toFixed(1)}); choose a larger rP`);
  }
  return [
    { center: P, radius: rP },
    { center: Q, radius: Math.sqrt(rQsq) },
    { center: R, radius: Math.sqrt(rRsq) },
  ];
}

export function actions(): GameActions {
  return {
    radical_axes: {
      describe:
        "For three circles (each {center:{x,y},radius}, or omit 'circles' to use the applet's Reset diagram), report the three pairwise radical axes as two points each, their common point O (the radical centre), and for each centre P/Q/R whether it lies on the radical axis of the other two, with its distance to that line and the power equality that decides it. An axis is the common chord when two circles meet, otherwise the perpendicular to the centreline at the point where the powers agree. The core's one-pixel tolerance decides 'lies on'.",
      args:
        '{ "circles": [ {"center":{"x":141.32,"y":105.92},"radius":100}, {"center":{"x":253.03,"y":96.97},"radius":120}, {"center":{"x":200,"y":225},"radius":80} ] }',
      run: (args) => {
        const board = readBoard(args);
        const reading = analyse(board);
        return {
          ...reading,
          note:
            "The radical axis of two circles is the line of points with equal power to both: their common chord if they meet, otherwise the perpendicular to the centreline through the equal-power point. The three axes share O. A centre is marked when it is within one pixel of the axis of the other two circles, which is exactly its power gap being 0. Here f_P + f_Q + f_R is 0, so the three gaps cannot be independent.",
        };
      },
    },

    orthocenter_claim: {
      describe:
        "Check the page's claim: if two of the three centres lie on their opposite radical axes, then so does the third, and O is the orthocenter of triangle PQR. Pass 'centers' (three [x,y] points) and an optional 'rP' to build radii that force the P and Q marks, or pass three full 'circles' to test any diagram. Reports the constructed radii, the core's three marks, the power gaps (which sum to 0 identically), O and the perpendicularity residuals of the three lines vertex->O against the opposite sides.",
      args: '{ "centers": [[141.32, 105.92], [253.03, 96.97], [200, 225]], "rP": 120 }',
      run: (args) => {
        let circles: Circle[] | null = null;
        if (args.centers !== undefined && args.centers !== null) {
          circles = forcedRadii(args.centers as Point[], num(args, "rP", 120));
        } else if (args.circles === undefined || args.circles === null) {
          circles = plainCircles(readBoard({}));
        }
        const board: Board = circles
          ? {
              width: num(args, "width", core().DEFAULT_WIDTH),
              height: num(args, "height", core().DEFAULT_HEIGHT),
              center: { x: 0, y: 0 },
              circles: circles.map((c) => ({ center: c.center, rim: { x: c.center.x + c.radius, y: c.center.y } })),
            }
          : readBoard(args);
        const reading = analyse(board);
        const marked = NAMES.filter((n) => reading.on[n]);
        return {
          ...reading,
          constructedRadii: circles ? circles.map((c, i) => ({ name: NAMES[i], radius: r4(c.radius) })) : null,
          marked,
          implication: marked.length >= 2 ? reading.allThreeMarked : null,
          note:
            "Write f_P = power(P,Q) − power(P,R) and cyclically; a centre is marked exactly when its f is 0, and f_P + f_Q + f_R = 0 for every three circles. So two marks force the third, as the core's flags confirm above. Each radical axis is perpendicular to the side joining the other two centres; when all three centres are marked, each axis is an altitude of triangle PQR and their common point O is its orthocenter (the residuals are 0). Constructed radii come from r_R^2 = r_P^2 + QR^2 − PQ^2 and r_Q^2 = r_P^2 + QR^2 − PR^2.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  const saved = state && typeof state === "object" ? state : ({} as Json);
  const rawCircles = Array.isArray(saved.circles) ? saved.circles : null;
  const savedOn = saved.on && typeof saved.on === "object" ? saved.on as Json : null;
  const summary = {
    stateVersion,
    width: saved.width ?? null,
    height: saved.height ?? null,
    savedCircles: rawCircles,
    savedRadicalCentre: pt(saved.center !== undefined && saved.center !== null
      ? readPointOrNull(saved.center) : null),
    savedOn: savedOn ? { P: Boolean(savedOn.P), Q: Boolean(savedOn.Q), R: Boolean(savedOn.R) } : null,
    savedAll: typeof saved.all === "boolean" ? saved.all : null,
  };
  try {
    const board = readBoard(saved);
    const reading = analyse(board);
    const savedCentre = summary.savedRadicalCentre;
    const onAgrees = savedOn
      ? NAMES.every((n) => Boolean(savedOn[n]) === !!reading.on[n])
      : null;
    const allAgrees = typeof saved.all === "boolean" ? saved.all === reading.allThreeMarked : null;
    const centreGap = savedCentre && reading.radicalCentre
      ? r4(Math.hypot(savedCentre.x - reading.radicalCentre.x, savedCentre.y - reading.radicalCentre.y))
      : null;
    const agrees = onAgrees !== false && allAgrees !== false && (centreGap === null || centreGap < 0.01);
    return {
      ...summary,
      reading,
      agreesWithSaved: agrees,
      savedCentreGap: centreGap,
      note: agrees
        ? "The saved marks and radical centre match the core's recomputation from the three circles. When two centres are marked the third is too, and O is the orthocenter of the triangle of centres."
        : "The saved marks or centre disagree with a fresh core computation from the saved circles; compare saved.on and saved.center with the reading above. The identity f_P + f_Q + f_R = 0 still constrains which marks can occur.",
    };
  } catch (err) {
    return {
      ...summary,
      reading: null,
      error: err instanceof Error ? err.message : String(err),
      note:
        "This saved position is not a diagram the core can read: it needs exactly three circles with finite centres and positive radii, and optional width/height.",
    };
  }
}

/** Like readPoint but tolerant: a missing or malformed saved centre is just null. */
function readPointOrNull(v: unknown): Point | null {
  try { return readPoint(v, "center"); } catch { return null; }
}
