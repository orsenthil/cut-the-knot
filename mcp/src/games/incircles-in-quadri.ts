/*
 * run_game_logic actions and saved-position reader for Incircles In Quadri.
 *
 * A quadrilateral ABCD has its diagonals AC and BD. Each diagonal splits it
 * into two triangles: ABC with ADC on AC, and BCD with BAD on BD. Draw the
 * incircle of each of the four triangles. The page claims that the two circles
 * of one pair touch exactly when the other pair does, and that this happens
 * exactly when AB + CD = BC + AD (Pitot's condition for a quadrilateral with
 * an incircle).
 *
 * The reason is equal tangent lengths from a vertex. In triangle ABC the
 * incircle touches AC a distance (AB + AC - BC)/2 from A; in ADC it touches AC
 * a distance (AD + AC - CD)/2 from A. The feet are therefore
 * |AB + CD - BC - AD|/2 apart, and the same computation on BD gives the same
 * separation. Both pairs touch together, and the feet genuinely coincide
 * (distance 0) exactly at Pitot's equality. The applet itself only *reports* a
 * touch when the two feet are less than 3 pixels apart, so a tiny, nonzero
 * Pitot gap can still light up its touch indicator: that quirk is reported
 * separately from the exact claim.
 *
 * Every number below comes from the game's real core,
 * incircles-in-quadri/incircles-in-quadri-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units in the
 * applet's 460 x 400 view, y down. This is an illustration with no win or
 * loss, so the core's result() is always null. See _shared.ts for the module
 * shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Name = "A" | "B" | "C" | "D";
type Diagonal = "ac" | "bd";
const NAMES: Name[] = ["A", "B", "C", "D"];

type Incircle = { center: Pt; radius: number; feet: Pt[]; touch: Pt };
type Pair = { first: Incircle; second: Incircle; distance: number; touch: boolean };
type Sides = { AB: number; BC: number; CD: number; DA: number; AC: number; BD: number };
type Measures = { acDistance: number; bdDistance: number; acError: number; bdError: number };
type Claims = {
  acTouch: boolean; bdTouch: boolean; equivalent: boolean; pitot: boolean;
  acCoincide: boolean; bdCoincide: boolean; coincideEquivalent: boolean;
  touchMatchesGap: boolean; feetHalfGap: boolean;
};
type Geometry = {
  A: Pt; B: Pt; C: Pt; D: Pt;
  ac: Pair; bd: Pair; sides: Sides;
  pitotGap: number; pitot: boolean; measures: Measures; claims: Claims; tol: number;
};
type State = {
  A: Pt; B: Pt; C: Pt; D: Pt;
  options: { diagonal: Diagonal };
  explored: boolean;
};
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  PAD: number; TOUCH: number; EPS: number;
  start(options?: Json): State;
  reset(s: State): State;
  move(s: State, name: string, p: Pt): State;
  setDiagonal(s: State, diagonal: string): State;
  makeTangential(s: State, options?: Json): State;
  compute(a: Pt, b: Pt, c: Pt, d: Pt): Geometry | null;
  geometry(s: State): Geometry | null;
  result(s: State): null;
  describe(s: State): string;
  position(s: State): Json;
};

const core = (): Core =>
  cores["incircles-in-quadri"].IncirclesInQuadriCore as unknown as Core;

const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const r9 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(9)) : NaN);
/** Keep a tiny but meaningful near-zero residual readable. */
const sig = (v: number): number =>
  !Number.isFinite(v) ? NaN
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2))
      : r9(v);
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const maybePt = (raw: unknown): Pt | null => {
  try { return pt(readPoint(raw, "corner")); } catch { return null; }
};
/** Saved and recomputed floats agree up to rounding. */
const same = (a: number, b: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept the tutor's [x, y] and the page's saved { x, y } corners alike. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readDiagonal(raw: unknown, fallback: Diagonal): Diagonal {
  if (raw === undefined || raw === null) return fallback;
  if (raw !== "ac" && raw !== "bd") {
    throw new Error(`argument "diagonal" must be "ac" or "bd", got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/** A real core state: the applet's opening picture with the given drags applied. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with corners A, B, C, D and optional diagonal");
  }
  let s = C.start({ diagonal: readDiagonal(args.diagonal, "ac") });
  for (const name of NAMES) {
    if (args[name] !== undefined && args[name] !== null) {
      // move() clamps the handle to the board, just as the page's drag does.
      s = C.move(s, name, readPoint(args[name], name));
    }
  }
  return s;
}

type Reading = {
  corners: Record<Name, Pt>;
  diagonal: Diagonal;
  sides: Record<keyof Sides, number>;
  pitot: { ABplusCD: number; BCplusAD: number; gap: number; absGap: number; halfGap: number; equal: boolean; tol: number };
  feet: { acDistance: number; bdDistance: number; halfGap: number; acError: number; bdError: number };
  touch: { ac: boolean; bd: boolean; both: boolean; equivalent: boolean; appletTolerance: number };
  claims: Claims;
  failedClaims: string[];
  allPageClaimsHold: boolean;
  result: null;
  status: string;
};

const CLAIM_KEYS = [
  "acTouch", "bdTouch", "equivalent", "pitot", "acCoincide", "bdCoincide",
  "coincideEquivalent", "touchMatchesGap", "feetHalfGap",
] as const;

/** One call to the core's geometry(), with every number tidied only for print. */
function reading(C: Core, s: State): Reading | null {
  const g = C.geometry(s);
  if (!g) return null;
  const halfGap = Math.abs(g.pitotGap) / 2;
  const failedClaims = CLAIM_KEYS.filter((k) => g.claims[k] !== true);
  return {
    corners: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D),
    },
    diagonal: s.options.diagonal,
    sides: {
      AB: r6(g.sides.AB), BC: r6(g.sides.BC), CD: r6(g.sides.CD),
      DA: r6(g.sides.DA), AC: r6(g.sides.AC), BD: r6(g.sides.BD),
    },
    pitot: {
      ABplusCD: r6(g.sides.AB + g.sides.CD),
      BCplusAD: r6(g.sides.BC + g.sides.DA),
      gap: sig(g.pitotGap), absGap: sig(Math.abs(g.pitotGap)),
      halfGap: sig(halfGap), equal: g.pitot, tol: sig(g.tol),
    },
    feet: {
      acDistance: sig(g.ac.distance), bdDistance: sig(g.bd.distance),
      halfGap: sig(halfGap),
      acError: sig(g.measures.acError), bdError: sig(g.measures.bdError),
    },
    touch: {
      ac: g.ac.touch, bd: g.bd.touch, both: g.ac.touch && g.bd.touch,
      equivalent: g.claims.equivalent, appletTolerance: C.TOUCH,
    },
    claims: g.claims,
    failedClaims,
    allPageClaimsHold: failedClaims.length === 0,
    result: C.result(s),
    status: C.describe(s),
  };
}

function note(r: Reading): string {
  return (
    `AB + CD = ${r.pitot.ABplusCD} and BC + AD = ${r.pitot.BCplusAD}, so Pitot's gap ` +
    `AB + CD - BC - AD = ${r.pitot.gap} (half = ${r.pitot.halfGap}). ` +
    `By equal tangent lengths the two incircle feet on AC are ${r.feet.acDistance} apart and ` +
    `the two on BD are ${r.feet.bdDistance} apart, both equal to |gap|/2; hence the two pairs share ` +
    `one verdict (applet touch: AC ${r.touch.ac}, BD ${r.touch.bd}) and the feet coincide exactly ` +
    `only at Pitot's equality (equal: ${r.pitot.equal}). ` +
    `The applet calls a pair touching when its feet are less than ${r.touch.appletTolerance} units ` +
    `apart, so a small nonzero gap can still light its indicator ` +
    `(touch matches gap: ${r.claims.touchMatchesGap}). ` +
    `This is an illustration, so there is no win or loss.`
  );
}

/** The live fixture's four corners on the 460 x 400 board. */
const FIXTURE_ARGS =
  '{ "A": [75, 260], "B": [310, 340], "C": [230, 180], "D": [110, 200] }';

export function actions(): GameActions {
  return {
    pitot_and_touch: {
      describe:
        "For a quadrilateral with corners A, B, C, D in order (each [x, y] or { x, y } on the applet's 460 x 400 board, y down; a drag is clamped to the board, and omitted corners stay at the opening picture), run the real core and report the side lengths AB, BC, CD, DA, AC, BD, Pitot's gap AB + CD - BC - AD, and the measured separation of the two incircle feet on each diagonal. Equal tangent lengths make both separations equal to |gap|/2, so the two pairs touch together and coincide exactly at Pitot's equality; the applet's separate 'touch' flags use its 3-pixel tolerance. Optional diagonal 'ac' (default) or 'bd' selects the pair the page draws. Refuses a quadrilateral whose triangles are too flat or degenerate for the core to draw.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        if (!r) {
          throw new Error(
            "A, B, C and D must form a proper, non-flat quadrilateral whose four triangles " +
            "the applet can draw (the core's Compute() returns null otherwise); move a corner and try again",
          );
        }
        return { ...r, note: note(r) };
      },
    },

    make_tangential: {
      describe:
        "Place the four corners on four tangents to one circle so that AB + CD = BC + AD and both pairs of incircles touch, using the real core's 'Make tangential' convenience. Accepts optional cx, cy (circle centre, default the board centre 230,200), r (radius, default 92) and angles (four tangent angles in radians, default [0.22, 1.66, 3.06, 4.72]); consecutive tangents meet at a corner, so the four corners must land inside the board. Any A, B, C, D, diagonal arguments set the starting picture first. Reports the same Pitot gap, foot separations, touch flags and claim verdicts as pitot_and_touch for the resulting quadrilateral.",
      args: "{}",
      run: (args) => {
        const C = core();
        let s = buildState(C, args);
        const opts: Json = {};
        for (const key of ["cx", "cy", "r"] as const) {
          const v = args[key];
          if (v === undefined || v === null) continue;
          const n = Number(v);
          if (!Number.isFinite(n)) throw new Error(`argument "${key}" must be a finite number`);
          if (key === "r" && !(n > 0)) throw new Error('argument "r" must be positive');
          opts[key] = n;
        }
        if (args.angles !== undefined && args.angles !== null) {
          if (!Array.isArray(args.angles) || args.angles.length !== 4) {
            throw new Error('argument "angles" must be an array of four tangent angles in radians');
          }
          const angles = args.angles.map((v: unknown, i: number) => {
            const n = Number(v);
            if (!Number.isFinite(n)) throw new Error(`angles[${i}] must be a finite number`);
            return n;
          });
          for (let i = 1; i < angles.length; i++) {
            if (!(angles[i] > angles[i - 1])) {
              throw new Error("angles must be strictly increasing so consecutive tangents meet in order");
            }
          }
          opts.angles = angles;
        }
        const made = C.makeTangential(s, opts);
        if (NAMES.every((name) => same(pt(made[name]).x, pt(s[name]).x)
          && same(pt(made[name]).y, pt(s[name]).y))) {
          throw new Error(
            "those tangents put a corner outside the board (or are parallel), so the core kept the old corners; " +
            "try a smaller r or different angles",
          );
        }
        s = made;
        const r = reading(C, s);
        if (!r) {
          throw new Error("the core cannot draw the resulting tangential quadrilateral; try different angles");
        }
        return {
          ...r,
          circle: {
            cx: opts.cx === undefined ? C.VIEW.width / 2 : Number(opts.cx),
            cy: opts.cy === undefined ? C.VIEW.height / 2 : Number(opts.cy),
            r: opts.r === undefined ? 92 : Number(opts.r),
            angles: opts.angles === undefined ? [0.22, 1.66, 3.06, 4.72] : opts.angles,
          },
          note: note(r),
        };
      },
    },
  };
}

/** Rebuild a real core state from the fields Track.state saved (Core.position). */
function savedState(C: Core, state: Json): { s: State; savedReadable: boolean } {
  const home = C.start();
  const diagonal = state.diagonal === "bd" ? "bd" : "ac";
  let s = C.start({ diagonal });
  let savedReadable = true;
  for (const name of NAMES) {
    try {
      s = C.move(s, name, readPoint(state[name], `saved ${name}`));
    } catch {
      savedReadable = false; // keep the applet's opening corner for this handle
    }
  }
  if (state.diagonal !== "ac" && state.diagonal !== "bd") savedReadable = false;
  return { s, savedReadable };
}

/** Echo the saved fields, then re-measure that quadrilateral with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Incircles In Quadri state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Incircles In Quadri position must be an object");
  }
  const C = core();
  const { s, savedReadable } = savedState(C, state);
  const saved = {
    A: maybePt(state.A), B: maybePt(state.B), C: maybePt(state.C), D: maybePt(state.D),
    diagonal: state.diagonal === "ac" || state.diagonal === "bd" ? state.diagonal : null,
    touched: state.touched && typeof state.touched === "object" && !Array.isArray(state.touched)
      ? state.touched : null,
    pitotGap: state.pitotGap === undefined || state.pitotGap === null
      ? null : Number(state.pitotGap),
  };
  const r = reading(C, s);
  if (!r) {
    return {
      ...state,
      stateVersion,
      saved,
      savedReadable,
      valid: false,
      reading: null,
      note:
        "Track.state saved the four draggable corners, the chosen diagonal, the applet's touch flags and " +
        "Pitot's gap. Here the saved corners are flat or degenerate, so the core's Compute() draws no incircles " +
        "and there is nothing to measure. This illustration has no win or loss.",
    };
  }
  const t = saved.touched as Json | null;
  const gap = saved.pitotGap;
  const savedMatchesCore =
    savedReadable
    && (gap === null || Number.isFinite(gap) && same(gap, Number(r.pitot.gap)))
    && (!t || typeof t.ac !== "boolean" || t.ac === r.touch.ac)
    && (!t || typeof t.bd !== "boolean" || t.bd === r.touch.bd)
    && (!t || typeof t.both !== "boolean" || t.both === r.touch.both);
  return {
    ...state,
    stateVersion,
    saved,
    savedReadable,
    savedMatchesCore,
    valid: true,
    reading: r,
    note:
      "Track.state saved only the four corners the player drags, the chosen diagonal, the applet's " +
      "touch flags and Pitot's gap; the core rebuilds the four triangle incircles from those corners. " +
      note(r) +
      (savedMatchesCore
        ? " The saved touch flags and gap agree with the core's recomputation."
        : " Some saved touch flags or the saved gap differ from the core's recomputation; check whether they came from these corners."),
  };
}
