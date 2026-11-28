/*
 * run_game_logic actions and saved-position reader for Incircle In Segment.
 *
 * The real core is incircle-in-segment/incircle-in-segment-core.js, copied
 * verbatim into src/generated/cores/ at build time; every number below is
 * measured by it. Coordinates are the board's 420 x 300 SVG units, y downward.
 *
 * A horizontal chord ST cuts the big circle (centre O, radius R). A small
 * circle touches the chord at A and the big circle at B; M is the midpoint of
 * the arc cut off by ST on the side away from B. With M pinned at the bottom,
 * the core writes h = M.y - A.y and q = |MA|², puts B at M + (2Rh/q)(A - M)
 * and gives the small circle radius rho = R(1 - q/(2Rh)) and centre Op one rho
 * above A. So A, B, M are collinear by construction, Op is tangent to the
 * chord at A and internally tangent to the big circle at B, and the homothety
 * with centre B and factor R/rho carries A (the small circle's lowest point)
 * to M (the big one's). Extending AB past A meets OM at N = M, the isosceles
 * triangle half of the proof.
 *
 * This is the ONE-circle theorem. Its sibling Incircle In Segment 1 puts two
 * circles in one segment and proves that their common chord (radical axis)
 * passes through M from MA*MB = MT²; that is a different claim, and this core
 * does not construct a second circle. This is a demonstration: no win or loss.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = { A: Pt; hint: boolean; explored: boolean };
type Circle = { c: Pt; r: number };
type Geometry = {
  A: Pt; B: Pt; M: Pt; O: Pt; Op: Pt; N: Pt; S: Pt; T: Pt;
  R: number; rho: number; scale: number; arcMid: Pt; mappedA: Pt;
  circles: { big: Circle; incircle: Circle };
};
interface Core {
  VIEW: { width: number; height: number };
  O: Pt;
  R: number;
  M: Pt;
  START: Pt;
  start(): State;
  move(state: State, p: Pt): State;
  setOption(state: State, name: string, value: boolean): State;
  construct(a: Pt): Geometry | null;
  geometry(state: State): Geometry | null;
  describe(state: State): string;
  result(state: State): null;
  distance(p: Pt, q: Pt): number;
}

const core = (): Core =>
  cores["incircle-in-segment"].IncircleInSegmentCore as unknown as Core;

const TOL = 1e-6; // board units; the core works in double precision
const SIBLING_NOTE =
  "This is the single-circle claim: one inscribed circle touches the chord at A and the big circle at B, and A, B and M line up. " +
  "The sibling applet Incircle In Segment 1 instead puts two circles in the same segment and shows their common chord (the radical axis) passes through M from MA × MB = MT²; that is a different theorem and this core draws only one circle.";
const DEMO_NOTE = "This is a demonstration with no win, loss or finish.";

/* The core stays exact; only what we print is rounded. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const r9 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e9) / 1e9 : NaN);
const sig = (v: number): number => (Number.isFinite(v) ? Number(v.toExponential(3)) : NaN);
const rp = (p: Pt | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a: Pt, b: Pt): number => a.x * b.y - a.y * b.x;
const near = (a: number, b: number, tol = TOL): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

function asArgs(raw: unknown): Json {
  if (raw === undefined || raw === null) return {};
  if (!isPlain(raw)) throw new Error("arguments must be a JSON object");
  return raw;
}

/** A board point as [x, y] or { x, y }, with finite numeric coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else if (isPlain(raw)) {
    x = Number(raw.x);
    y = Number(raw.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readBool(raw: unknown, key: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return raw;
}

function readInt(raw: unknown, key: string, fallback: number, lo: number, hi: number): number {
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`argument "${key}" must be an integer from ${lo} to ${hi}`);
  }
  return n;
}

/**
 * Every measurement of one constructed picture comes from the core's points;
 * the closed form rho = R(1 - q/(2Rh)) and the homothety are checked against
 * it independently. Residuals are kept as signed exponentials, checks as bools.
 */
function reading(C: Core, s: State, g: Geometry) {
  const q = C.distance(g.M, g.A) ** 2;
  const h = g.M.y - g.A.y;
  const tFromQ = (2 * g.R * h) / q;
  const rhoFromFormula = g.R * (1 - q / (2 * g.R * h));
  const k = g.R / g.rho;

  const u = sub(g.B, g.A);
  const v = sub(g.M, g.A);
  const rawCross = cross(u, v);
  const crossScale = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  const collinearCross = crossScale > 0 ? rawCross / crossScale : 0;

  // The centre is rho ABOVE A, so the chord through A is tangent at distance rho.
  const chordGap = Math.abs(C.distance(g.Op, g.A) - g.rho);
  const chordXGap = Math.abs(g.Op.x - g.A.x);
  const tangentGap = Math.abs(C.distance(g.Op, g.O) - (g.R - g.rho));
  const bGap = Math.abs(C.distance(g.B, g.O) - g.R);
  const sGap = Math.abs(C.distance(g.S, g.O) - g.R);
  const tGap = Math.abs(C.distance(g.T, g.O) - g.R);
  const nGap = C.distance(g.N, g.M);
  const arcGap = C.distance(g.arcMid, g.M);
  const mapGap = C.distance(g.mappedA, g.M);
  const rhoGap = Math.abs(g.rho - rhoFromFormula);
  const scaleGap = Math.abs(g.scale - tFromQ);

  const residuals = {
    collinearCross: sig(collinearCross),
    rhoFormulaGap: sig(rhoGap),
    scaleFormulaGap: sig(scaleGap),
    tangentChordGap: sig(Math.max(chordGap, chordXGap)),
    tangentBigCircleGap: sig(tangentGap),
    bigCircleGapAtB: sig(bGap),
    bigCircleGapAtST: sig(Math.max(sGap, tGap)),
    NToMGap: sig(nGap),
    arcMidToMGap: sig(arcGap),
    homothetyGap: sig(mapGap),
  };
  const checks = {
    A_B_M_collinear: near(collinearCross, 0, 1e-9),
    rho_matches_formula: near(rhoGap, 0),
    scale_matches_formula: near(scaleGap, 0),
    tangent_to_chord_at_A: chordGap <= TOL && chordXGap <= TOL,
    tangent_to_big_circle_at_B: tangentGap <= TOL && bGap <= TOL,
    S_and_T_on_big_circle: sGap <= TOL && tGap <= TOL,
    chord_horizontal_through_A:
      Math.abs(g.S.y - g.A.y) <= TOL && Math.abs(g.T.y - g.A.y) <= TOL,
    N_equals_M: nGap <= TOL,
    arcMid_equals_M: arcGap <= TOL,
    homothety_maps_A_to_M: mapGap <= TOL,
  };
  return {
    points: {
      A: rp(g.A), B: rp(g.B), M: rp(g.M), O: rp(g.O), Op: rp(g.Op),
      N: rp(g.N), S: rp(g.S), T: rp(g.T),
      arcMid: rp(g.arcMid), mappedA: rp(g.mappedA),
    },
    measurements: {
      R: r6(g.R), rho: r6(g.rho), scale: r6(g.scale),
      h: r6(h), q: r6(q),
      rhoFromFormula: r6(rhoFromFormula), scaleFromFormula: r6(tFromQ),
      homothetyFactor: r6(k), chordHalfLength: r6(Math.sqrt(Math.max(0, g.R ** 2 - (g.A.y - g.O.y) ** 2))),
    },
    residuals,
    checks,
    status: C.describe(s),
    result: C.result(s),
  };
}

type Reading = ReturnType<typeof reading>;

function noteFor(r: Reading): string {
  const m = r.measurements;
  const c = r.checks;
  return (
    `With A at (${r.points.A!.x}, ${r.points.A!.y}) we get h = ${m.h}, q = |MA|² = ${m.q}, ` +
    `so the ray MA meets the big circle again at scale 2Rh/q = ${m.scale} and rho = R(1 - q/(2Rh)) = ${m.rho} (R = ${m.R}). ` +
    `The homothety with centre B and factor R/rho = ${m.homothetyFactor} carries A to M: ${c.homothety_maps_A_to_M ? "confirmed" : "NOT confirmed"}. ` +
    `${c.A_B_M_collinear ? "A, B and M are collinear" : "A, B and M are NOT collinear"}, ` +
    `${c.arcMid_equals_M ? "M is the arc midpoint away from B" : "the arc midpoint is not M"}, ` +
    `and the small circle is ${c.tangent_to_chord_at_A ? "tangent to the chord at A" : "not tangent to the chord at A"} ` +
    `and ${c.tangent_to_big_circle_at_B ? "tangent to the big circle at B" : "not tangent to the big circle at B"}. ` +
    `Extending AB past A meets OM at N, which ${c.N_equals_M ? "is M" : "is not M"}. ` +
    SIBLING_NOTE + " " + DEMO_NOTE
  );
}

export function actions(): GameActions {
  return {
    inscribed_circle: {
      describe:
        "Place the handle A on the 420 x 300 board ([x, y] or { x, y }; omit A for the core's opening spot) and run the real core's construction of the one circle inscribed in a circular segment. Report the chord ST, the two touch points A (on the chord) and B (on the big circle), the fixed bottom point M, the small centre O', the radius rho = R(1 - q/(2Rh)) with h = M.y - A.y and q = |MA|², the scale 2Rh/q, and checks for collinearity of A, B, M, tangency at A and B, M as arc midpoint, N = M and the homothety with centre B and factor R/rho mapping A to M. 'hint' (default false) only adds the page's status line. This is the single-circle theorem, not the radical-axis claim of the two-circle sibling.",
      args: '{"A":[177.64466094067262,109.64466094067262],"hint":true}',
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const base = C.start();
        const hint = readBool(a.hint, "hint", false);
        let s = C.move(base, readPoint(a.A, "A", base.A));
        s = C.setOption(s, "hint", hint);
        const g = C.geometry(s);
        if (!g) {
          return {
            A: rp(s.A), valid: false, result: C.result(s), status: C.describe(s),
            note: "That position of A cannot carry a small circle: move it inside the big circle, away from M. " +
              SIBLING_NOTE + " " + DEMO_NOTE,
          };
        }
        const r = reading(C, s, g);
        return { valid: true, hint: s.hint, ...r, note: noteFor(r) };
      },
    },

    invariant_sweep: {
      describe:
        "Check the page's 'always' claim by constructing many circles with the real core: sample A on 'rings' concentric circles (default 3 rings, 8 points each, plus the centre) or pass an explicit 'points' array of up to 64 board points. Each position is projected through the core's own move() before construction. Reports the largest residual for collinearity of A, B, M, the rho and scale formulas, tangency at A and B, the arc midpoint, N = M and the homothety image of A, plus the centre case where the chord is a diameter and rho = R/2. The core's invariant holds for every valid A; the radical-axis sibling is a different, two-circle theorem.",
      args: '{"rings":3,"perRing":8}',
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const rings = readInt(a.rings, "rings", 3, 1, 8);
        const perRing = readInt(a.perRing, "perRing", 8, 3, 24);
        const samples: Pt[] = [];
        if (a.points !== undefined && a.points !== null) {
          if (!Array.isArray(a.points) || a.points.length === 0 || a.points.length > 64) {
            throw new Error('argument "points" must be a non-empty array of at most 64 points');
          }
          a.points.forEach((p, i) => samples.push(readPoint(p, `points[${i}]`)));
        } else {
          for (let ring = 1; ring <= rings; ring++) {
            const f = ring / (rings + 1);
            for (let i = 0; i < perRing; i++) {
              const theta = (2 * Math.PI * i) / perRing;
              samples.push({
                x: C.O.x + f * C.R * Math.cos(theta),
                y: C.O.y - f * C.R * Math.sin(theta),
              });
            }
          }
          samples.push({ ...C.O });
        }

        const rows: Json[] = [];
        const readings: Reading[] = [];
        let invalid = 0;
        for (const p of samples) {
          const s = C.move(C.start(), p);
          const g = C.geometry(s);
          if (!g) {
            invalid++;
            rows.push({ A: rp(s.A), valid: false });
            continue;
          }
          const r = reading(C, s, g);
          readings.push(r);
          rows.push({ A: r.points.A, rho: r.measurements.rho, valid: true, checks: r.checks });
        }
        const checked = readings.length;
        const failures = readings.filter((r) => Object.values(r.checks).some((v) => !v)).length;
        const worst: Json = {};
        if (checked) {
          for (const key of Object.keys(readings[0].residuals) as (keyof Reading["residuals"])[]) {
            worst[key] = sig(Math.max(...readings.map((r) => Math.abs(r.residuals[key]))));
          }
        }

        const centreState = C.move(C.start(), C.O);
        const centreG = C.geometry(centreState);
        const centreCase = centreG
          ? {
              A: rp(centreG.A), S: rp(centreG.S), T: rp(centreG.T),
              rho: r6(centreG.rho), R: r6(centreG.R),
              isDiameter: near(Math.abs(centreG.S.x - centreG.T.x), 2 * centreG.R),
              chordYIsCentreY: near(centreG.S.y, centreG.O.y),
              halfRadius: near(centreG.rho, centreG.R / 2),
            }
          : null;

        return {
          samples: samples.length, checked, invalid, allChecksPass: checked > 0 && failures === 0,
          failures, worstResiduals: worst, rows, centreCase,
          note:
            `The real core constructed ${checked} valid inscribed circle${checked === 1 ? "" : "s"}` +
            (invalid ? `, with ${invalid} position${invalid === 1 ? "" : "s"} projecting outside the usable disc (skipped)` : "") +
            `; ${failures === 0 ? "every check passed at every valid position" : `${failures} position(s) failed a check`}. ` +
            "The largest absolute residuals (a normalised cross product for collinearity, board-unit gaps elsewhere) are in worstResiduals. " +
            (centreCase
              ? "With A at the centre the chord is a diameter from S to T and the small radius is exactly R/2. "
              : "") +
            SIBLING_NOTE + " " + DEMO_NOTE,
        };
      },
    },
  };
}

/* Reading a saved Track.state position must not throw on a damaged record. */

const savedPoint = (v: unknown, fallback: Pt | null = null): Pt | null => {
  try { return readPoint(v, "saved point"); } catch { return fallback; }
};
const savedNumber = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const pointMatches = (raw: unknown, built: Pt): boolean | null => {
  const p = savedPoint(raw);
  return p ? near(p.x, built.x) && near(p.y, built.y) : null;
};
const numberMatches = (raw: unknown, built: number): boolean | null => {
  const n = savedNumber(raw);
  return n === null ? null : near(n, built);
};

/** Echo Track.state's fields, then re-measure the saved A with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Incircle In Segment state version ${stateVersion}`);
  }
  if (!isPlain(state)) throw new Error("saved Incircle In Segment position must be an object");
  const C = core();
  const A = savedPoint(state.A, C.START) as Pt;
  const savedReadable = pointMatches(state.A, A) === true;
  let s = C.move(C.start(), A);
  const hint = isPlain(state.options) && state.options.hint === true;
  s = C.setOption(s, "hint", hint);
  const g = C.geometry(s);
  const r = g ? reading(C, s, g) : null;

  const agree = r
    ? {
        A: pointMatches(state.A, g!.A),
        B: pointMatches(state.B, g!.B),
        M: pointMatches(state.M, g!.M),
        O: pointMatches(state.O, g!.O),
        Op: pointMatches(state.Op, g!.Op),
        N: pointMatches(state.N, g!.N),
        S: pointMatches(state.S, g!.S),
        T: pointMatches(state.T, g!.T),
        arcMid: pointMatches(state.arcMid, g!.arcMid),
        radius: numberMatches(state.radius, g!.rho),
        scale: numberMatches(state.scale, g!.scale),
        R: numberMatches(state.R, g!.R),
      }
    : null;
  const disagreements = agree
    ? Object.entries(agree).filter(([, v]) => v === false).map(([key]) => key)
    : [];

  return {
    ...state,
    stateVersion,
    savedReadable,
    saved: {
      A: rp(A), B: rp(savedPoint(state.B)), M: rp(savedPoint(state.M)),
      O: rp(savedPoint(state.O)), Op: rp(savedPoint(state.Op)),
      N: rp(savedPoint(state.N)), S: rp(savedPoint(state.S)),
      T: rp(savedPoint(state.T)), arcMid: rp(savedPoint(state.arcMid)),
      R: savedNumber(state.R), radius: savedNumber(state.radius), scale: savedNumber(state.scale),
      options: { hint },
    },
    reading: r,
    agreementWithSaved: agree,
    result: C.result(s),
    note:
      (!savedReadable
        ? "The saved A could not be read as a finite point, so the core's opening A was used for the reading below. "
        : "Track.state saved A, the touch and chord points B, M, O, O', N, S and T, the arc midpoint, the big radius R, the small radius, the scale and the hint flag; the core rebuilds the whole picture from the saved A. ") +
      (r && disagreements.length === 0
        ? `The saved points and numbers agree with the core to ${TOL} board units: rho = ${r.measurements.rho}, scale = ${r.measurements.scale}, and A, B and M are ${r.checks.A_B_M_collinear ? "collinear" : "not collinear"}. `
        : r
          ? `These saved fields differ from the core's construction: ${disagreements.join(", ")}. The reading below is the core's for the saved A. `
          : "That A cannot carry a small circle, so there is no reading. ") +
      SIBLING_NOTE + " " + DEMO_NOTE,
  };
}
