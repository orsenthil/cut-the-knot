/*
 * run_game_logic actions and saved-position reader for Harmonic Mean Sangaku.
 *
 * Two upright walls AE and BD stand on the same level ground AB. The ladders
 * AD and BE cross at P, and C is the foot of P on the ground. The page's claim
 * is that CP = AE·BD/(AE+BD), so 1/CP = 1/AE + 1/BD, and that CP does not
 * depend on how far apart the two walls stand. Every number returned below is
 * measured with the game's real core
 * (harmonic-mean-sangaku/harmonic-mean-sangaku-core.js, copied into
 * src/generated/cores/ at build time), which also reproduces the applet's
 * UpgradePoints fix-ups and GeoSDoub.Intersect determinant test. Coordinates
 * are the page's board units with y growing downwards. This is an
 * illustration: there is no win or loss, only a claim to check.
 *
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  width: number; height: number;
  A: Pt; B: Pt; D: Pt; E: Pt; P: Pt; C: Pt;
  showNames: boolean; showHint: boolean; checked: boolean; drags: number;
};
type Measure = {
  ae: number; bd: number; cp: number; ac: number; bc: number;
  harmonic: number; wall: number; left: number; right: number; residual: number;
  finite: boolean; holds: boolean; parallel: boolean; tooClose: boolean;
};
type Core = {
  start(options?: Json): State;
  withPoint(s: State, name: string, p: Pt): State;
  recompute(s: State): State;
  measure(s: State): Measure;
  checkClaim(s: State): State;
  result(s: State): string | null;
};

const core = (): Core =>
  cores["harmonic-mean-sangaku"].HarmonicMeanSangakuCore as unknown as Core;

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Keep the sign and size of a near-zero residual rather than printing 0. */
const sig = (v: number): number =>
  !Number.isFinite(v) ? NaN
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2))
      : round(v, 9);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const close = (a: number, b: number, scale = 1): boolean =>
  Math.abs(a - b) <= 1e-7 * Math.max(1, scale);
const samePt = (a: Pt | null, b: Pt): boolean =>
  !!a && close(a.x, b.x, Math.max(1, Math.abs(b.x))) &&
    close(a.y, b.y, Math.max(1, Math.abs(b.y)));

/** A point from the tutor's [x, y] or from the page's { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(v)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/**
 * Put two upright walls of heights ae and bd on level ground, their feet
 * `wall` units apart. Each placement goes through the core's withPoint, so the
 * applet's fix-ups and the recomputation of P and C are exactly the page's.
 */
function buildWalls(C: Core, args: Json): { s: State; ae: number; bd: number; wall: number } {
  const base = C.start();
  const width = num(args, "width", base.width);
  const height = num(args, "height", base.height);
  if (!(width > 0) || !(height > 0)) {
    throw new Error("width and height must be positive board sizes");
  }
  const ae = num(args, "ae");
  const bd = num(args, "bd");
  if (ae === 0 || bd === 0) {
    throw new Error("ae and bd must be non-zero wall heights: a zero wall makes CP vanish");
  }
  if (Math.abs(ae + bd) < 1e-12) {
    throw new Error("ae + bd must not be zero: the two ladder lines are then parallel and never cross");
  }
  const seed = C.start({ width, height });
  const wall = num(args, "wall", seed.B.x - seed.A.x);
  if (Math.abs(wall) < 1) {
    throw new Error("wall must be at least 1 board unit so the core can intersect the ladders");
  }
  let s = seed;
  s = C.withPoint(s, "B", { x: s.A.x + wall, y: s.A.y });
  s = C.withPoint(s, "E", { x: s.A.x, y: s.A.y - ae });
  s = C.withPoint(s, "D", { x: s.B.x, y: s.B.y - bd });
  return { s, ae, bd, wall };
}

/** Reject the degenerate drawings where the applet has no measurable crossing. */
function crossing(C: Core, s: State): Measure {
  const m = C.measure(s);
  if (!m.finite || m.parallel || m.tooClose || m.cp === 0) {
    throw new Error("the ladders do not cross at a measurable point here; choose non-degenerate wall heights");
  }
  return m;
}

export function actions(): GameActions {
  return {
    crossing_and_spacing: {
      describe:
        "Set wall AE to height `ae`, wall BD to height `bd`, their feet `wall` board units apart (optional `width`, `height` set the board), then run the real core. Reports the crossing P, its foot C and CP, checks CP = AE·BD/(AE+BD), and moves the wall feet to twice the spacing: CP stays the same because the formula has no term for the gap between the walls.",
      args: '{ "ae": 84, "bd": 42, "wall": 316 }',
      run: (args) => {
        const C = core();
        const { s, wall } = buildWalls(C, args);
        const m = crossing(C, s);
        const formula = (m.ae * m.bd) / (m.ae + m.bd);
        // Dragging only a wall foot keeps both wall heights; it changes the gap.
        const sFar = C.withPoint(s, "B", { x: s.A.x + 2 * wall, y: s.A.y });
        const mFar = C.measure(sFar);
        const scale = Math.max(1, Math.abs(m.cp));
        return {
          input: { ae: round(m.ae), bd: round(m.bd), wall: round(wall) },
          crossing: {
            P: pt(s.P), C: pt(s.C),
            CP: round(m.cp), AC: round(m.ac), CB: round(m.bc),
          },
          formula: {
            statement: "CP = AE·BD / (AE + BD)",
            value: round(formula), cp: round(m.cp),
            residual: sig(m.cp - formula),
            holds: close(m.cp, formula, scale),
          },
          harmonicMean: {
            statement: "2·CP = 2·AE·BD/(AE+BD), the harmonic mean of AE and BD",
            twiceCP: round(m.harmonic),
            ae: round(m.ae), bd: round(m.bd),
          },
          spacingCheck: {
            gapAt: round(m.wall), cpAt: round(m.cp),
            gapAfter: round(mFar.wall), cpAfter: round(mFar.cp),
            cpUnchanged: mFar.finite && close(m.cp, mFar.cp, scale),
          },
          note: `With AE = ${round(m.ae)} and BD = ${round(m.bd)} the core puts the crossing ${round(m.cp)} above the ground, exactly AE·BD/(AE+BD) = ${round(formula)}. Doubling the gap between the feet from ${round(m.wall)} to ${round(mFar.wall)} leaves CP at ${round(mFar.cp)}: the point P moves sideways, but its height does not change.`,
        };
      },
    },
    reciprocal_identity: {
      describe:
        "For the same two walls (arguments as in crossing_and_spacing), report 1/CP and 1/AE + 1/BD and their residual, and check the related division AC/CB = AE/BD. The core's Check button uses this same residual to mark the illustration explored; small residuals are floating-point noise.",
      args: '{ "ae": 84, "bd": 42 }',
      run: (args) => {
        const C = core();
        const { s } = buildWalls(C, args);
        const m = crossing(C, s);
        const ratio = m.bc !== 0 ? m.ac / m.bc : NaN;
        const wallRatio = m.bd !== 0 ? m.ae / m.bd : NaN;
        return {
          walls: { AE: round(m.ae), BD: round(m.bd), gap: round(m.wall) },
          crossing: { CP: round(m.cp), AC: round(m.ac), CB: round(m.bc) },
          reciprocal: {
            statement: "1/CP = 1/AE + 1/BD",
            oneOverCP: round(m.left, 9),
            sumOfReciprocals: round(m.right, 9),
            residual: sig(m.residual),
            holds: m.holds,
          },
          division: {
            statement: "AC/CB = AE/BD",
            acOverCB: round(ratio),
            aeOverBD: round(wallRatio),
            residual: sig(ratio - wallRatio),
            holds: close(ratio, wallRatio, Math.max(1, Math.abs(ratio))),
          },
          checkedByCore: C.checkClaim(s).checked,
          note: `The core gives 1/CP = ${round(m.left, 9)} and 1/AE + 1/BD = ${round(m.right, 9)}, a residual of ${sig(m.residual)}. Inverting CP = AE·BD/(AE+BD) gives the identity exactly, and the crossing divides AB in the ratio AC/CB = AE/BD = ${round(wallRatio)}.`,
        };
      },
    },
  };
}

/** Echo Track.state's saved fields and re-measure the diagram with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Harmonic Mean Sangaku state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : {};
  const seed = C.start();

  let readable = true;
  const savedPoint = (v: unknown, fallback: Pt, label: string): Pt => {
    try { return readPoint(v, label); } catch { readable = false; return fallback; }
  };
  const numOr = (v: unknown, fallback: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const boolOr = (v: unknown, fallback: boolean): boolean =>
    typeof v === "boolean" ? v : fallback;

  const A = savedPoint(src.A, seed.A, "saved A");
  const B = savedPoint(src.B, seed.B, "saved B");
  const D = savedPoint(src.D, seed.D, "saved D");
  const E = savedPoint(src.E, seed.E, "saved E");
  const width = numOr(src.width, seed.width);
  const height = numOr(src.height, seed.height);
  const showNames = boolOr(src.showNames, seed.showNames);
  const showHint = boolOr(src.showHint, seed.showHint);
  const checked = boolOr(src.checked, false);
  const drags = numOr(src.drags, 0);
  const savedP = pt(src.P as Pt | null | undefined);
  const savedC = pt(src.C as Pt | null | undefined);

  let s: State = {
    ...C.start({ width, height, showNames, showHint }),
    A, B, D, E, checked, drags,
  };
  s = C.recompute(s);
  const m = C.measure(s);
  const denom = m.ae + m.bd;
  const formula = denom !== 0 ? (m.ae * m.bd) / denom : NaN;
  const ratio = m.bc !== 0 ? m.ac / m.bc : NaN;
  const wallRatio = m.bd !== 0 ? m.ae / m.bd : NaN;
  const scale = Math.max(1, Math.abs(m.cp));
  const measurable = m.finite && !m.parallel && !m.tooClose && m.cp !== 0;

  return {
    stateVersion,
    // The fields Track.state saved, echoed as written (rounded for display).
    width: round(width), height: round(height),
    A: pt(A), B: pt(B), D: pt(D), E: pt(E),
    P: savedP, C: savedC,
    showNames, showHint, checked, drags,
    result: C.result(s),
    savedReadable: readable,
    // What the real core measures at exactly those saved points.
    reading: {
      A: pt(s.A), B: pt(s.B), D: pt(s.D), E: pt(s.E),
      P: pt(s.P), C: pt(s.C),
      savedCrossingAgreesWithCore:
        samePt(savedP, s.P) && samePt(savedC, s.C),
      AE: round(m.ae), BD: round(m.bd), gap: round(m.wall),
      CP: round(m.cp), AC: round(m.ac), CB: round(m.bc),
      harmonic: round(m.harmonic),
      formula: {
        statement: "CP = AE·BD / (AE + BD)",
        value: round(formula), residual: sig(m.cp - formula),
        holds: measurable && close(m.cp, formula, scale),
      },
      reciprocal: {
        statement: "1/CP = 1/AE + 1/BD",
        oneOverCP: round(m.left, 9), sumOfReciprocals: round(m.right, 9),
        residual: sig(m.residual), holds: m.holds,
      },
      division: {
        statement: "AC/CB = AE/BD",
        acOverCB: round(ratio), aeOverBD: round(wallRatio),
        residual: sig(ratio - wallRatio),
        holds: measurable && close(ratio, wallRatio, Math.max(1, Math.abs(ratio))),
      },
      finite: m.finite, parallel: m.parallel, tooClose: m.tooClose,
      measurable,
    },
    note: !readable
      ? "Some saved points could not be read, so the core's opening picture was used for the reading."
      : !measurable
        ? m.tooClose
          ? "The saved wall feet are less than a pixel apart, so the core holds the previous crossing: move the feet apart to measure CP."
          : "The saved ladder lines are parallel or have no finite crossing, so CP cannot be measured at this position."
        : `Track.state saved the four corners, both display flags and the checked flag, but not the measurements. The core rebuilds P and C: CP = ${round(m.cp)} = AE·BD/(AE+BD) = ${round(formula)}, and 1/CP = ${round(m.left, 9)} = 1/AE + 1/BD (residual ${sig(m.residual)}). Dragging the feet would move P sideways but leave this height unchanged. This is an illustration, so there is no win or loss.`,
  };
}
