/*
 * run_game_logic actions and saved-position reader for Concurrency in the
 * Intouch Triangle, Bogomolny's IntouchMedians applet.
 *
 * The real core is intouch-medians/intouch-medians-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the page's 360 x 260 SVG, with y down.
 *
 * The incircle of ABC touches BC at A', CA at B' and AB at C'. Am, Bm, Cm are
 * the midpoints of the intouch triangle's sides, and from each we drop a
 * perpendicular to the opposite side of ABC. The page claims those three lines
 * meet at S and that S, G' (the centroid of A'B'C') and I are collinear with
 * 2|SG'| = |G'I|. The core checks this by intersecting the lines pairwise and
 * by comparing S with the homothety prediction S = (3G' - I)/2: the homothety
 * with centre G' and ratio -2 carries Am, Bm, Cm to A', B', C', so it carries
 * the perpendiculars through the midpoints to the radii through the touch
 * points, which meet at I. Equal tangents from each corner place the touch
 * points. This is an illustration: there is no win or loss. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = { names: boolean; hint: boolean };
type State = { A: Pt; B: Pt; C: Pt; options: Options; touches: number };
type Segment = [Pt, Pt];
type Geometry = {
  valid: true;
  A: Pt; B: Pt; C: Pt;
  I: Pt; Ap: Pt; Bp: Pt; Cp: Pt;
  Am: Pt; Bm: Pt; Cm: Pt;
  Ah: Pt; Bh: Pt; Ch: Pt;
  S: Pt; S2: Pt; S3: Pt; G: Pt;
  radius: number; center: Pt;
  lines: {
    ABC: Segment[]; touch: Segment[]; perp: Segment[]; medians: Segment[];
    radii: Segment[]; SI: Segment; marks: Array<[Pt, Pt, number]>;
  };
  labels: Record<string, Pt>;
};
type ClaimErrors = {
  concurrency: number; predicted: number; collinear: number; ratio: number;
  homothety: number;
  touchBC: number; touchCA: number; touchAB: number;
  perpBC: number; perpCA: number; perpAB: number;
  tangentsA: number; tangentsB: number; tangentsC: number;
  SIthroughG: number; radii: number; radius: number;
};
type Core = {
  VIEW: { width: number; height: number };
  START: { A: Pt; B: Pt; C: Pt };
  start(options?: Json): State;
  moveVertex(s: State, name: string, p: Pt): State;
  setOption(s: State, name: string, on: boolean): State;
  geometry(s: State): Geometry | { valid: false };
  claimErrors(g: Geometry): ClaimErrors | null;
  result(): null;
  dist(p: Pt, q: Pt): number;
};

const core = (): Core =>
  cores["intouch-medians"].IntouchMediansCore as unknown as Core;

const NO_GAME =
  "This is an illustration, so there is no win or loss; the tracker records exploration.";

/* The core keeps full precision; only what we print is rounded. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(3));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** A point as the page saves it ({ x, y }) or as a short [x, y] argument. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (isPlain(raw)) {
    x = Number(raw.x); y = Number(raw.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readBool(raw: unknown, label: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw === "boolean") return raw;
  if (raw === 0 || raw === "1" || raw === 1 || raw === "0") {
    return raw === 1 || raw === "1";
  }
  throw new Error(`argument "${label}" must be a boolean, got ${JSON.stringify(raw)}`);
}

/**
 * Start from the applet's opening triangle and drag the corners that were
 * given, exactly as the page does. "show" turns both applets options on; an
 * explicit names or hint overrides it (the applet's ShowNames parameter).
 */
function buildState(C: Core, args: Json): State {
  if (!isPlain(args)) {
    throw new Error("arguments must be an object of A, B, C points with optional show, names and hint");
  }
  const show = readBool(args.show, "show", false);
  const opts: Json = {
    show: show ? 1 : 0,
    names: readBool(args.names, "names", show),
    hint: readBool(args.hint, "hint", show),
  };
  let s = C.start(opts);
  for (const name of ["A", "B", "C"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.moveVertex(s, name, readPoint(v, name, s[name]));
  }
  return s;
}

/** Only a proper triangle has an incircle and a touch triangle to measure. */
function requireGeometry(C: Core, s: State): Geometry {
  const g = C.geometry(s);
  if (!g.valid) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners of the page's 360 x 260 board: " +
      "the core cannot draw the incircle or the perpendiculars from a straight line.",
    );
  }
  return g;
}

/** The page's claims, as residuals in drawing units from the real core. */
const CLAIMS: Array<[keyof ClaimErrors, string]> = [
  ["concurrency", "the three perpendiculars meet at one point: S = S2 = S3"],
  ["predicted", "S = (3G' - I)/2, the inverse image of I under the homothety"],
  ["collinear", "S, G' and I are collinear"],
  ["ratio", "2 |SG'| = |G'I|"],
  ["homothety", "ratio -2 about G' sends Am, Bm, Cm to A', B', C'"],
  ["touchBC", "IA' is perpendicular to BC"],
  ["touchCA", "IB' is perpendicular to CA"],
  ["touchAB", "IC' is perpendicular to AB"],
  ["perpBC", "AmAh is perpendicular to BC"],
  ["perpCA", "BmBh is perpendicular to CA"],
  ["perpAB", "CmCh is perpendicular to AB"],
  ["tangentsA", "AB' = AC' (equal tangents from A)"],
  ["tangentsB", "BC' = BA' (equal tangents from B)"],
  ["tangentsC", "CA' = CB' (equal tangents from C)"],
  ["SIthroughG", "the line SI passes through G'"],
  ["radii", "IA' = IB' = IC' (the touch points are on the incircle)"],
  ["radius", "IA' equals the core's averaged inradius"],
];

type Reading = ReturnType<typeof reading>;

/** One geometry() call and one claimErrors() call, shaped for the model. */
function reading(C: Core, s: State, g: Geometry = requireGeometry(C, s)) {
  const e = C.claimErrors(g)!;
  const d = (p: Pt, q: Pt): number => C.dist(p, q);
  const tol = 1e-6 * Math.max(1, g.radius, d(s.A, s.B), d(s.B, s.C), d(s.C, s.A));

  const predicted = { x: (3 * g.G.x - g.I.x) / 2, y: (3 * g.G.y - g.I.y) / 2 };
  const image = (m: Pt): Pt => ({ x: 3 * g.G.x - 2 * m.x, y: 3 * g.G.y - 2 * m.y });

  const a = d(s.B, s.C), b = d(s.C, s.A), c = d(s.A, s.B);
  const semi = (a + b + c) / 2;
  const tangent = {
    A: { measuredToBprime: round(d(g.A, g.Bp)), measuredToCprime: round(d(g.A, g.Cp)),
          formula_s_minus_a: round(semi - a), residual: sig(d(g.A, g.Bp) - (semi - a)) },
    B: { measuredToCprime: round(d(g.B, g.Cp)), measuredToAprime: round(d(g.B, g.Ap)),
          formula_s_minus_b: round(semi - b), residual: sig(d(g.B, g.Cp) - (semi - b)) },
    C: { measuredToAprime: round(d(g.C, g.Ap)), measuredToBprime: round(d(g.C, g.Bp)),
          formula_s_minus_c: round(semi - c), residual: sig(d(g.C, g.Ap) - (semi - c)) },
  };
  const equalTangents = {
    A: { gap: round(e.tangentsA), equal: near(e.tangentsA, 0, tol) },
    B: { gap: round(e.tangentsB), equal: near(e.tangentsB, 0, tol) },
    C: { gap: round(e.tangentsC), equal: near(e.tangentsC, 0, tol) },
  };
  const claims = CLAIMS.map(([key, text]) => ({
    name: key, claim: text, residual: sig(e[key]), holds: near(e[key], 0, tol),
  }));

  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    options: { ...s.options },
    incenter: pt(g.I),
    inradius: round(g.radius),
    centroidOfABC: pt(g.center),
    touchPoints: { Ap: pt(g.Ap), Bp: pt(g.Bp), Cp: pt(g.Cp) },
    midpoints: { Am: pt(g.Am), Bm: pt(g.Bm), Cm: pt(g.Cm) },
    feet: { Ah: pt(g.Ah), Bh: pt(g.Bh), Ch: pt(g.Ch) },
    concurrence: {
      S: pt(g.S), S2: pt(g.S2), S3: pt(g.S3),
      pairwiseDistances: { SS2: round(d(g.S, g.S2)), SS3: round(d(g.S, g.S3)), S2S3: round(d(g.S2, g.S3)) },
      concurrent: near(e.concurrency, 0, tol),
      Gprime: pt(g.G), I: pt(g.I),
      predictedS: pt(predicted), residual: sig(e.predicted),
      SGprime: round(d(g.S, g.G)), GprimeI: round(d(g.G, g.I)),
      twiceSGprime: round(2 * d(g.S, g.G)), ratioResidual: sig(e.ratio),
      collinear: near(e.collinear, 0, tol),
    },
    homothety: {
      center: pt(g.G), coefficient: -2,
      images: { ofAm: pt(image(g.Am)), ofBm: pt(image(g.Bm)), ofCm: pt(image(g.Cm)) },
      targets: { Ap: pt(g.Ap), Bp: pt(g.Bp), Cp: pt(g.Cp) },
      residual: sig(e.homothety), holds: near(e.homothety, 0, tol),
    },
    tangents: {
      sideLengths: { a_BC: round(a), b_CA: round(b), c_AB: round(c) },
      semiperimeter: round(semi),
      lengths: tangent,
      equal: equalTangents,
      allEqual: equalTangents.A.equal && equalTangents.B.equal && equalTangents.C.equal,
    },
    radii: {
      IAp: round(d(g.I, g.Ap)), IBp: round(d(g.I, g.Bp)), ICp: round(d(g.I, g.Cp)),
      spread: round(e.radii), equal: near(e.radii, 0, tol),
      inradiusResidual: sig(e.radius),
    },
    errors: Object.fromEntries(CLAIMS.map(([key]) => [key, sig(e[key])])),
    claims,
    allClaimsHold: claims.every((c) => c.holds),
  };
}

function concurrenceNote(r: Reading): string {
  const q = r.concurrence;
  return (
    `The core puts I at ${JSON.stringify(r.incenter)} with inradius ${r.inradius}; the touch triangle is ` +
    `${JSON.stringify(r.touchPoints)}. The three perpendiculars through ` +
    `${JSON.stringify(r.midpoints)} meet pairwise at S = ${JSON.stringify(q.S)}, S2 = ` +
    `${JSON.stringify(q.S2)} and S3 = ${JSON.stringify(q.S3)} (spread ${JSON.stringify(q.pairwiseDistances)}). ` +
    `With G' = ${JSON.stringify(q.Gprime)}, the predicted point (3G' - I)/2 is ` +
    `${JSON.stringify(q.predictedS)}, ${q.residual} from S. Since |SG'| = ${q.SGprime} and |G'I| = ` +
    `${q.GprimeI}, the ratio residual 2|SG'| - |G'I| is ${q.ratioResidual}. ` +
    `All ${r.claims.length} core checks hold: ${r.allClaimsHold}. ` + NO_GAME
  );
}

function tangentsNote(r: Reading): string {
  const t = r.tangents;
  return (
    `With a = BC = ${t.sideLengths.a_BC}, b = CA = ${t.sideLengths.b_CA}, c = AB = ${t.sideLengths.c_AB} ` +
    `and semiperimeter s = ${t.semiperimeter}, the tangents from A are ${t.lengths.A.measuredToBprime} and ` +
    `${t.lengths.A.measuredToCprime} against s - a = ${t.lengths.A.formula_s_minus_a}; from B they are ` +
    `${t.lengths.B.measuredToCprime} and ${t.lengths.B.measuredToAprime} against s - b = ` +
    `${t.lengths.B.formula_s_minus_b}; from C they are ${t.lengths.C.measuredToAprime} and ` +
    `${t.lengths.C.measuredToBprime} against s - c = ${t.lengths.C.formula_s_minus_c}. ` +
    `The touch points are the perpendicular feet of I (radii ${JSON.stringify(r.radii)}), and the ratio -2 ` +
    `homothety about G' = ${JSON.stringify(r.homothety.center)} sends the midpoints to those touch points ` +
    `with residual ${r.homothety.residual}. Equal tangents hold: ${t.allEqual}. ` + NO_GAME
  );
}

const opening = { A: [50, 216], B: [315, 216], C: [288, 52] };

export function actions(): GameActions {
  return {
    concurrency_s: {
      describe:
        "For triangle ABC (corners as [x, y] or { x, y } in the page's 360 x 260 board, y down; omit a corner for the opening picture), run the real Intouch Medians core. Report the incenter I, inradius, the touch points A', B', C', the midpoints Am, Bm, Cm, the perpendicular feet and the three pairwise intersections S, S2, S3 of the perpendiculars, then check that they coincide and that S equals the homothety prediction (3G' - I)/2, where G' is the centroid of the touch triangle. Also report |SG'| and |G'I| against 2|SG'| = |G'I| and all 17 core claim residuals. Optional show, names and hint mirror the applet's two checkboxes. A degenerate triangle is refused; this is a demonstration with no win or loss.",
      args: JSON.stringify(opening),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        return { ...r, note: concurrenceNote(r) };
      },
    },

    equal_tangents: {
      describe:
        "For the same triangle (arguments as in concurrency_s), run the real core and report the equal-tangent construction behind the touch triangle: the side lengths and semiperimeter, the two tangent lengths from each corner checked against s - a, s - b and s - c, the touch points as perpendicular feet of the incenter with the three inradii, and the ratio -2 homothety centred at G' that carries Am, Bm, Cm to A', B', C'. Returns the equal-tangent, perpendicular, radii and homothety residuals. This is a demonstration with no win or loss.",
      args: JSON.stringify(opening),
      run: (args) => {
        const C = core();
        const r = reading(C, buildState(C, args));
        return {
          triangle: r.triangle,
          options: r.options,
          incenter: r.incenter,
          inradius: r.inradius,
          touchPoints: r.touchPoints,
          radii: r.radii,
          tangents: r.tangents,
          homothety: r.homothety,
          note: tangentsNote(r),
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Intouch Medians state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  let saved: Json;
  try {
    const A = readPoint(src.A, "A");
    const B = readPoint(src.B, "B");
    const Cc = readPoint(src.C, "C");
    if (!isPlain(src.options)) throw new Error("saved options must be an object");
    const names = readBool(src.options.names, "options.names", false);
    const hint = readBool(src.options.hint, "options.hint", false);
    s = C.start({ names, hint });
    s = C.moveVertex(C.moveVertex(C.moveVertex(s, "A", A), "B", B), "C", Cc);
    saved = { A: pt(A), B: pt(B), C: pt(Cc), options: { names, hint } };
  } catch {
    savedReadable = false;
    s = C.start();
    saved = { A: pt(s.A), B: pt(s.B), C: pt(s.C), options: { ...s.options } };
  }

  const common = { ...src, stateVersion, savedReadable, saved };
  const g = C.geometry(s);
  if (!g.valid) {
    return {
      ...common, valid: false,
      note:
        (!savedReadable
          ? "Some saved fields could not be read, so the applet's opening triangle is shown. "
          : "Track.state saved the three draggable corners A, B, C and the names/hint checkboxes in board units; no derived points are saved. ") +
        "Here the corners are collinear or too close, so the core cannot draw the incircle or the perpendiculars. " +
        NO_GAME,
    };
  }

  const r = reading(C, s, g);
  return {
    ...common,
    valid: true,
    reading: r,
    note:
      (!savedReadable
        ? "Some saved fields could not be read, so the reading below is from the applet's opening triangle. "
        : "Track.state saved the corners A, B, C and the names/hint checkboxes in the page's 360 x 260 board; the core rebuilds I, the touch triangle, the midpoints and S from those corners. ") +
      `The perpendiculars meet at S = ${JSON.stringify(r.concurrence.S)} against the predicted ` +
      `${JSON.stringify(r.concurrence.predictedS)}, with 2|SG'| - |G'I| = ${r.concurrence.ratioResidual}; ` +
      `equal tangents hold ${r.tangents.allEqual} and all ${r.claims.length} checks hold ${r.allClaimsHold}. ` +
      NO_GAME,
  };
}
