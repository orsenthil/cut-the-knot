/*
 * run_game_logic actions and saved-position reader for Conjugality.
 *
 * The real core is conjugality/conjugality-core.js, copied into
 * src/generated/cores/ at build time. Three points P[p], one on each side line
 * of triangle A0A1A2, each have a partner on that same line: the isotomic
 * partner is the mirror in the side's midpoint (t -> 1-t, so its signed ratio
 * r = t/(1-t) becomes 1/r), and the isogonal partner is the cevian reflected in
 * the angle bisector at the opposite corner (r is multiplied by the square of
 * the ratio of the two adjacent sides). Those three squared side factors
 * multiply to 1 around the triangle, so either involution preserves Menelaus'
 * product r0*r1*r2 = -1: partners of collinear points stay collinear. Every
 * number below is measured by the core, including the applet's own screen-space
 * line/concurrency test. See _shared.ts for the module shape.
 *
 * Coordinates are the illustration's 400 x 400 board units, with y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["conjugality"].ConjugalityCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Mode = "isotomic" | "isogonal";
type SideState = {
  width: number; height: number;
  A: Point[]; t: number[]; P: Point[];
  mode: Mode; showNames: boolean; showHint: boolean;
};
type Computed = {
  A: Point[]; P: Point[]; Rf: (Point | null)[]; M: (Point | null)[];
  angles: number[]; mode: Mode; kind: number;
  areaP: number; areaRf: number; ratio: number;
  collinear: boolean; reflectedCollinear: boolean; concurrent: boolean;
};
type Claims = { collinear: boolean; verified: boolean; ratio: number; areaRf: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const finite = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const deg = (rad: number): number | null => finite((rad * 180) / Math.PI);
const signedRatio = (t: number): number => t / (1 - t);

/** Accept [x, y] or { x, y }; reject anything that is not a finite point. */
function pointFrom(raw: unknown, label: string): Point {
  if (Array.isArray(raw)) {
    const x = Number(raw[0]), y = Number(raw[1]);
    if (raw.length !== 2 || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`${label} must be [x, y] or { "x": ..., "y": ... }`);
    }
    return { x, y };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`${label} must be [x, y] or { "x": ..., "y": ... }`);
}

function readPoints(raw: unknown, label: string, count: number): Point[] {
  if (!Array.isArray(raw) || raw.length !== count) {
    throw new Error(`${label} must be an array of ${count} points`);
  }
  return raw.map((p, i) => pointFrom(p, `${label}[${i}]`));
}

/** A side parameter t = 1 makes the signed ratio t/(1-t) undefined. */
function checkT(n: number, label: string, index: number): number {
  if (!Number.isFinite(n)) throw new Error(`${label}[${index}] is not a number`);
  if (n === 1) throw new Error(`${label}[${index}] is 1, where the signed side ratio t/(1-t) is undefined`);
  return n;
}

function readParams(raw: unknown, label: string, count: number): number[] {
  if (!Array.isArray(raw) || raw.length !== count) {
    throw new Error(`${label} must be an array of ${count} numbers`);
  }
  return raw.map((v, i) => checkT(Number(v), label, i));
}

function readMode(args: Json): Mode {
  const raw = args.mode;
  if (raw === undefined || raw === null) return "isotomic";
  if (raw !== "isotomic" && raw !== "isogonal") {
    throw new Error(`argument "mode" must be "isotomic" or "isogonal", got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/** Build a core position; omitted fields fall back to the opening picture. */
function buildState(C: Core, args: Json): SideState {
  const seed = C.start({}) as SideState;
  const A = args.A === undefined || args.A === null
    ? seed.A.map((p) => ({ x: p.x, y: p.y }))
    : readPoints(args.A, 'argument "A"', 3);
  const t = args.t === undefined || args.t === null
    ? seed.t.slice()
    : readParams(args.t, 'argument "t"', 3);
  const width = args.width === undefined ? seed.width : num(args, "width");
  const height = args.height === undefined ? seed.height : num(args, "height");
  return C.withSides({ width, height, A, t, mode: readMode(args), showNames: false, showHint: false }) as SideState;
}

function noteFor(s: SideState, d: Computed, cl: Claims): string {
  const menelaus = Math.abs(d.ratio + 1) < 1e-9;
  const opening = menelaus
    ? "The P points are collinear: Menelaus' product r0*r1*r2 is -1."
    : "The P points are not collinear (Menelaus' product r0*r1*r2 is not -1).";
  const map = s.mode === "isotomic"
    ? "The isotomic partner mirrors a point in its side's midpoint, t -> 1-t, inverting each ratio r -> 1/r."
    : "The isogonal partner reflects the cevian in the angle bisector at the opposite corner; the isogonal cevian theorem multiplies each ratio by the square of the adjacent-side ratio.";
  const preserve = "Isotomic reciprocates the product and isogonal leaves it unchanged (its three squared side factors multiply to 1), so the partner triple is collinear exactly when the P triple is";
  const closing = menelaus
    ? `, and here it is (theorem check: ${cl.verified}).`
    : ", and here neither triple is collinear.";
  const picture = ["neither a line nor a meeting (kind 0)", "a line (kind 1)", "concurrent cevians (kind 2)"][d.kind] ?? "neither a line nor a meeting";
  return `${opening} ${map} ${preserve}${closing} The applet's own test reports ${picture}.`;
}

function reading(C: Core, s: SideState) {
  const d = C.compute(s) as unknown as Computed;
  const cl = C.claims(s) as unknown as Claims;
  return {
    mode: d.mode,
    triangle: { A0: pt(d.A[0]), A1: pt(d.A[1]), A2: pt(d.A[2]) },
    sidePoints: { P0: pt(d.P[0]), P1: pt(d.P[1]), P2: pt(d.P[2]) },
    partners: { Q0: pt(d.Rf[0]), Q1: pt(d.Rf[1]), Q2: pt(d.Rf[2]) },
    marks: { M0: pt(d.M[0]), M1: pt(d.M[1]), M2: pt(d.M[2]) },
    parameters: { t0: finite(s.t[0]), t1: finite(s.t[1]), t2: finite(s.t[2]) },
    signedRatios: {
      r0: finite(signedRatio(s.t[0])),
      r1: finite(signedRatio(s.t[1])),
      r2: finite(signedRatio(s.t[2])),
    },
    ratioProduct: finite(d.ratio),
    twiceSignedArea: { P: finite(d.areaP), partners: finite(d.areaRf) },
    reflectionAngles_deg: d.angles.map(deg),
    checks: {
      PpointsCollinear: d.collinear,
      partnersCollinear: d.reflectedCollinear,
      ceviansConcurrent: d.concurrent,
      appletPicture: d.kind,
      theoremWhenPCollinear: cl.collinear ? cl.verified : null,
    },
    note: noteFor(s, d, cl),
  };
}

export function actions(): GameActions {
  return {
    conjugates: {
      describe:
        "For a triangle A = [A0, A1, A2] and three side-line parameters t = [t0, t1, t2] (t[p] runs from A[(p+1)%3] to A[(p+2)%3]) with mode isotomic or isogonal, report the three side points, their partner points, the midpoint or bisector marks, and whether each triple is collinear. Also reports the Menelaus ratio product and the applet's own line-or-concurrency test; omit a field to use the opening picture. Coordinates are the 400 x 400 board, y down.",
      args: '{ "A": [[261.78, 280.90], [240.67, 108.65], [100.55, 210.45]], "t": [0.3, 0.25, 1.1666666666666667], "mode": "isotomic" }',
      run: (a) => {
        const C = core();
        return reading(C, buildState(C, a));
      },
    },
    lineup: {
      describe:
        "Given a triangle A and two parameters t = [t0, t1], solve the third with Menelaus' condition r0*r1*r2 = -1 so the three side points are collinear, then report the isotomic and isogonal partners and confirm both triples stay collinear. The solved point may lie on an extended side line; coordinates are the 400 x 400 board, y down.",
      args: '{ "A": [[261.78, 280.90], [240.67, 108.65], [100.55, 210.45]], "t": [0.3, 0.25] }',
      run: (a) => {
        const C = core();
        const seed = C.start({}) as SideState;
        const A = a.A === undefined || a.A === null
          ? seed.A.map((p) => ({ x: p.x, y: p.y }))
          : readPoints(a.A, 'argument "A"', 3);
        const [t0, t1] = readParams(a.t, 'argument "t"', 2).map((t, i) => {
          if (t === 0) throw new Error(`argument "t"[${i}] is 0, which cannot satisfy Menelaus' condition`);
          return t;
        });
        const q = -1 / (signedRatio(t0) * signedRatio(t1));
        if (Math.abs(1 + q) < 1e-12) {
          throw new Error("the two given parameters make the third side line parallel, so no finite point completes a Menelaus line");
        }
        const t2 = q / (1 + q);
        const both = (["isotomic", "isogonal"] as Mode[]).map((mode) => {
          const s = C.withSides({
            width: seed.width, height: seed.height, A,
            t: [t0, t1, t2], mode, showNames: false, showHint: false,
          }) as SideState;
          const r = reading(C, s);
          return {
            mode,
            partners: r.partners,
            ratioProduct: r.ratioProduct,
            PpointsCollinear: r.checks.PpointsCollinear,
            partnersCollinear: r.checks.partnersCollinear,
            theoremWhenPCollinear: r.checks.theoremWhenPCollinear,
          };
        });
        return {
          A: A.map(pt),
          given: { t0: finite(t0), t1: finite(t1) },
          solvedThirdParameter: finite(t2),
          menelausProduct: finite(signedRatio(t0) * signedRatio(t1) * signedRatio(t2)),
          both,
          note: "With r = t/(1-t), Menelaus' collinearity condition r0*r1*r2 = -1 fixes the third parameter. Both involutions preserve that product, so the two partner triples are collinear as well.",
        };
      },
    },
  };
}

/** Track.state saves the triangle, the side parameters and the display flags. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Conjugality state version ${stateVersion}`);
  }
  const C = core();
  const s = buildState(C, state);
  const result: (state: Json) => unknown = C.result;
  const saved = {
    width: num(state, "width"),
    height: num(state, "height"),
    A: readPoints(state.A, 'saved state "A"', 3),
    t: readParams(state.t, 'saved state "t"', 3),
    P: readPoints(state.P, 'saved state "P"', 3),
    mode: readMode(state),
    showNames: Boolean(state.showNames),
    showHint: Boolean(state.showHint),
  };
  return {
    stateVersion,
    saved: {
      ...saved,
      A: saved.A.map(pt),
      t: saved.t.map(finite),
      P: saved.P.map(pt),
    },
    result: result(state),
    reading: reading(C, s),
    note: "Track.state saved the corners A, the side parameters t, the drawn side points P and the display flags. The core rebuilds P from A and t, then measures both partner triples, the Menelaus product and the applet's line-or-concurrency test.",
  };
}
