/*
 * run_game_logic actions and saved-position reader for Harmonic Ratio.
 *
 * The real core is harmonic-ratio/harmonic-ratio-core.js, copied verbatim into
 * src/generated/cores/ at build time; every number below is measured from it.
 * In the coordinate on AB with A = 0, B = 1 and C = u, the applet's
 * straightedge chain
 *   G = CE ∩ IB,  F = AG ∩ EB,  D = AB ∩ IF,  H = CE ∩ ID
 * pins down D = u / (2u - 1), whatever E and I are chosen; the signed
 * cross-ratio (ABCD) = -1, so C and D are harmonic conjugates in A and B. In
 * lengths AB is the harmonic mean of AC and AD: 2/AB = 1/AC + 1/AD. The
 * archived page claims six extra lines beyond AB are needed to obtain C; the
 * applet's own chain is five lines (CE, IB, AG, EB, IF) and ends at D, not C.
 * Coordinates are board units of the 600 x 450 applet view, y downward. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Points = { A: Pt; B: Pt; C: Pt; E: Pt; I: Pt };
type State = { width: number; height: number; showNames: boolean; points: Points };
type Construction = { G: Pt; F: Pt; D: Pt; H: Pt; finite: boolean };
type Claims = {
  finite: boolean;
  dMatchesFormula: boolean;
  dOnBaseLine: boolean;
  conjugates: boolean;
  hIsConjugate: boolean;
  cHConjugate: boolean;
  hOnEC: boolean;
  iOnAE: boolean;
  cOnAB: boolean;
};
interface Core {
  NAMES: string[];
  WIDTH: number;
  HEIGHT: number;
  start(o?: Partial<{ width: number; height: number; showNames: boolean; points: Points }>): State;
  withPoint(s: State, name: string, p: Pt): State;
  withOptions(s: State, o: { showNames?: boolean }): State;
  compute(s: State): Construction;
  fraction(a: Pt, b: Pt, p: Pt): number;
  analyticD(s: State): Pt;
  crossRatio(a: Pt, b: Pt, c: Pt, d: Pt): number;
  distanceToLine(p: Pt, a: Pt, b: Pt): number;
  distance(p: Pt, q: Pt): number;
  isFinitePoint(p: Pt): boolean;
  claims(s: State): Claims;
  result(s: State): null;
}

const core = (): Core => cores["harmonic-ratio"].HarmonicRatioCore as unknown as Core;

/** Coordinates are rounded for the tutor; non-finite values print as null. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const cnt = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < tol;

/* The page miscounts its own construction; keep the honest version visible. */
const LINE_NOTE =
  "The archived page says six more lines beyond AB are needed to obtain C; the applet actually uses five — CE, IB, AG, EB and IF — and the fixed point they end at is D, not C.";

/** Accept the page's { x, y } dots and a tutor's [x, y] dots; both validated. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
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

/** Read five dots from a saved payload, falling back to the opening picture. */
function readPoints(C: Core, raw: unknown, label: string): Points {
  const home = C.start().points;
  const j = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Json : {};
  const out = {} as Points;
  for (const name of C.NAMES) {
    const key = name as keyof Points;
    out[key] = readPoint(j[name], `${label}.${name}`, home[key]);
  }
  return out;
}

/**
 * Build a core state from JSON args the way the page's drags do: A, B and E
 * are placed first (which re-projects the gliders C and I), then C and I are
 * placed onto their segments. Omitted handles keep the opening picture.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C, E, I points and optional showNames");
  }
  let s = C.start();
  for (const name of C.NAMES) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.withPoint(s, name, readPoint(args[name], name));
    }
  }
  if (args.showNames !== undefined && args.showNames !== null) {
    if (typeof args.showNames !== "boolean") {
      throw new Error('argument "showNames" must be true or false');
    }
    s = C.withOptions(s, { showNames: args.showNames });
  }
  return s;
}

/** One call to the real core, shaped for a tutor: construction, ratio, lengths. */
function reading(C: Core, s: State) {
  const m = C.compute(s);
  const p = s.points;
  const u = C.fraction(p.A, p.B, p.C);
  const dFormula = u / (2 * u - 1);
  const analytic = C.analyticD(s);
  const cr = m.finite ? C.crossRatio(p.A, p.B, p.C, m.D) : NaN;
  const crSwap = m.finite ? C.crossRatio(p.B, p.A, p.C, m.D) : NaN;

  const AB = C.distance(p.A, p.B);
  const AC = C.distance(p.A, p.C);
  const usedD = m.finite ? m.D : analytic;
  const AD = C.isFinitePoint(usedD) ? C.distance(p.A, usedD) : NaN;
  const hm = Number.isFinite(AC) && Number.isFinite(AD) && AC + AD > 0
    ? 2 * AC * AD / (AC + AD) : NaN;
  const absTol = 1e-6 * Math.max(AB, 1);

  return {
    board: { width: s.width, height: s.height },
    showNames: s.showNames,
    handles: { A: pt(p.A), B: pt(p.B), C: pt(p.C), E: pt(p.E), I: pt(p.I) },
    construction: {
      lines: ["CE", "IB", "AG", "EB", "IF"],
      points: { G: pt(m.G), F: pt(m.F), D: pt(m.D), H: pt(m.H) },
      finite: m.finite,
    },
    positionOfD: {
      u: cnt(u),
      formula: "D = u / (2u - 1)",
      dFormula: cnt(dFormula),
      analyticD: pt(analytic),
      constructedD: pt(m.D),
      constructedDCoordinate: m.finite ? cnt(C.fraction(p.A, p.B, m.D)) : null,
      formulaVsConstructedGap:
        m.finite && C.isFinitePoint(analytic) ? cnt(C.distance(analytic, m.D)) : null,
    },
    crossRatio: {
      ABCD: sig(cr),
      BACD: sig(crSwap),
      IFHD: m.finite ? sig(C.crossRatio(p.I, m.F, m.H, m.D)) : null,
      EGCH: m.finite ? sig(C.crossRatio(p.E, m.G, p.C, m.H)) : null,
      isMinusOne: near(cr, -1),
      swapIsReciprocal: near(cr * crSwap, 1),
    },
    harmonicMeanLengths: {
      AB: cnt(AB), AC: cnt(AC), AD: cnt(AD),
      formula: "AB = 2·AC·AD / (AC + AD), equivalently 2/AB = 1/AC + 1/AD",
      harmonicMean: cnt(hm),
      twoOverAB: sig(AB > 0 ? 2 / AB : NaN),
      oneOverACPlusOneOverAD: sig(AC > 0 && AD > 0 ? 1 / AC + 1 / AD : NaN),
      relativeError: sig(AB > 0 && Number.isFinite(hm) ? Math.abs(hm - AB) / AB : NaN),
      holds: near(hm, AB, absTol),
    },
    claims: C.claims(s),
  };
}

/** Rebuild with E and I moved and see whether the constructed D shifts. */
function invariance(C: Core, s: State, rawE: unknown, rawI: unknown) {
  const base = C.compute(s);
  if (!base.finite) {
    return { available: false, note: "The base diagram is degenerate, so D is not defined here." };
  }
  const fallbackE = { x: s.points.E.x - 80, y: s.points.E.y - 60 };
  const fallbackI = { x: s.points.I.x + 50, y: s.points.I.y - 30 };
  let alt = C.withPoint(s, "E", readPoint(rawE, "E2", fallbackE));
  alt = C.withPoint(alt, "I", readPoint(rawI, "I2", fallbackI));
  const m2 = C.compute(alt);
  const gap = m2.finite ? C.distance(base.D, m2.D) : NaN;
  return {
    available: true,
    alternativeE: pt(alt.points.E),
    alternativeI: pt(alt.points.I),
    alternativeD: pt(m2.D),
    finite: m2.finite,
    gap: cnt(gap),
    staysPut: m2.finite && gap < 1e-4 * Math.max(C.distance(s.points.A, s.points.B), 1),
  };
}

/** A full construction from the live fixture's five dots. */
const FIXTURE_ARGS =
  '{"A":[124,300],"B":[300,260],' +
  '"C":[240.06548788474132,273.6214800261952],' +
  '"E":[240,150],"I":[181.25152964734679,225.96784959394816]}';

export function actions(): GameActions {
  return {
    construction_ratio: {
      describe:
        "Run the applet's straightedge construction for five draggable dots A, B, C, E, I (each [x, y] or { x, y } on its 600 x 450 board, y downward; omitting any keeps the opening picture). In the coordinate A = 0, B = 1, C = u it reports the points G, F, D, H, the formula D = u/(2u - 1) beside the constructed D, the signed cross-ratio (ABCD) = -1 and its reciprocal (BACD), the two conjugate pairs (IFHD) and (EGCH), and the core's verdicts. The example uses the five dots saved by the live page.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const r = reading(C, buildState(C, args));
        return {
          ...r,
          note: `With A = 0, B = 1 and C at u = ${r.positionOfD.u}, the five-line chain fixes D = ${JSON.stringify(r.positionOfD.constructedD)} at coordinate u/(2u - 1) = ${r.positionOfD.dFormula}; (ABCD) = ${r.crossRatio.ABCD}. Moving E or I leaves D where it is. This is an illustration, so there is no win or loss.`,
          lineNote: LINE_NOTE,
        };
      },
    },

    harmonic_mean_lengths: {
      describe:
        "Check the length form of the construction for the same five dots (arguments as in construction_ratio): AB is the harmonic mean of AC and AD, so 2/AB = 1/AC + 1/AD. Also pass optional E2 and I2 points ([x, y] or { x, y }) to rebuild with those two dots moved and see that the constructed D does not shift. Returns the three lengths, the harmonic mean, both reciprocal sums, the relative error and the gap between the two D positions; the example moves E and I from the opening picture.",
      args: '{ "E2": [180, 110], "I2": [150, 210] }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        const inv = invariance(C, s, args.E2, args.I2);
        return {
          ...r,
          dInvariance: inv,
          note: `AB = ${r.harmonicMeanLengths.AB}, AC = ${r.harmonicMeanLengths.AC}, AD = ${r.harmonicMeanLengths.AD}: 2·AC·AD/(AC + AD) = ${r.harmonicMeanLengths.harmonicMean}, so the harmonic-mean relation holds${inv.available && inv.finite ? `, and moving E/I changes D by only ${inv.gap} board units` : ""}.`,
          lineNote: LINE_NOTE,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure the picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Harmonic Ratio state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Harmonic Ratio position must be an object");
  }
  const C = core();
  const home = C.start();
  const width = num(state, "width", home.width);
  const height = num(state, "height", home.height);
  const showNames = state.showNames === true;
  const points = readPoints(C, state.points, "saved points");
  const rebuilt = C.start({ width, height, showNames, points });
  const r = reading(C, rebuilt);
  return {
    stateVersion,
    width: rebuilt.width,
    height: rebuilt.height,
    showNames: rebuilt.showNames,
    points: {
      A: pt(points.A), B: pt(points.B), C: pt(points.C), E: pt(points.E), I: pt(points.I),
    },
    reading: r,
    note:
      "Track.state saved the board size, the Show names flag and the five draggable dots; the core rebuilds that exact picture and re-runs the straightedge chain. " +
      `C sits at u = ${r.positionOfD.u}, the constructed D is ${JSON.stringify(r.positionOfD.constructedD)} with (ABCD) = ${r.crossRatio.ABCD}, and AB ${r.harmonicMeanLengths.holds ? "is" : "is not"} the harmonic mean of AC and AD.`,
    lineNote: LINE_NOTE,
  };
}
