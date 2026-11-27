/*
 * run_game_logic actions and saved-position reader for From 500.
 *
 * For a semicircle with centre O, radius r and diameter AB, the tangents at
 * A, X and B are drawn; AX and BX extended past X meet the tangents at B and A
 * in Z and Y. The page claims that the tangent at X, the line YZ and the line
 * AB are either all parallel (X at the top of the arc) or all meet in one point
 * P. The proof uses the equal tangents from U (where the tangent at X meets the
 * tangent at A) to make U the midpoint of AY, and likewise V the midpoint of
 * BZ. Every number below comes from the real core,
 * from-500/from-500-core.js, copied into src/generated/cores/ at build time.
 * Coordinates are the applet's 500 x 400 board units with y down.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Line = { p: Pt; q: Pt };
type State = {
  O: Pt; X: Pt; showNames: boolean; showHint: boolean;
  moves: number; explored: boolean;
};
type Geometry = {
  valid: boolean; reason: string | null;
  O: Pt; X: Pt; r: number; A: Pt; B: Pt;
  TA: Line; TB: Line; TX: Line; XB: Line; XA: Line; YZ: Line; AB: Line;
  Y: Pt; Z: Pt; P: Pt; U: Pt; V: Pt;
  parallel: boolean;
};
type Residuals = Record<string, number>;
type SweepRow = {
  angleRad: number | null; degrees: number | null; valid: boolean;
  reason?: string | null; configuration: string | null; meetingPoint: Pt | null;
  maxClaimResidual?: number | null; claimsHold?: boolean;
  tangentAtXVsAB_sine?: number | null; yzVsAB_sine?: number | null;
};
type Core = {
  WIDTH: number; HEIGHT: number; MIN_RADIUS: number;
  dist(a: Pt, b: Pt): number;
  midpoint(a: Pt, b: Pt): Pt;
  finite(p: Pt | null | undefined): boolean;
  clampToBoard(p: Pt): Pt;
  start(options?: {
    O?: Pt; X?: Pt; angle?: number; showNames?: boolean; showHint?: boolean;
  }): State;
  move(s: State, m: {
    type: string; name?: string; point?: Pt; key?: string; value?: boolean;
  }): State | null;
  compute(s: State): Geometry;
  residuals(g: Geometry): Residuals | null;
};

const core = (): Core => cores["from-500"].From500Core as unknown as Core;

/* The core is exact up to floating point; only what we print is rounded. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const sig = (v: number | undefined): number | null =>
  v !== undefined && Number.isFinite(v) ? Number(v.toExponential(2)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x)!, y: r6(p.y)! } : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/* Every residual that should vanish when the drawing is valid. The two
 * "parallel*" entries are not errors: they are the sine of the angle a line
 * makes with AB, and only vanish in the parallel case, so they are reported
 * separately. */
const CLAIM_KEYS = [
  "tangentAtA", "tangentAtB", "tangentAtX",
  "UOnTA", "VOnTB", "UOnTX", "VOnTX",
  "YOnTA", "YOnXB", "ZOnTB", "ZOnXA",
  "UIsMidpointAY", "VIsMidpointBZ",
  "UATangents", "VBTangents",
  "POnTX", "POnYZ", "POnAB",
] as const;

/** A board point, accepted as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
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

/** The core's opening picture, moved onto the caller's O and X. */
function readState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with O and X points");
  }
  const seed = C.start({});
  const s = C.start({
    O: readPoint(args.O, "O", seed.O),
    X: readPoint(args.X, "X", seed.X),
    ...(typeof args.showNames === "boolean" ? { showNames: args.showNames } : {}),
    ...(typeof args.showHint === "boolean" ? { showHint: args.showHint } : {}),
  });
  return {
    ...s,
    moves: args.moves === undefined ? s.moves : Math.max(0, Math.round(num(args, "moves"))),
    explored: typeof args.explored === "boolean" ? args.explored : s.explored,
  };
}

/** Refuse the case the page cannot draw: X on the diameter leaves no Y or Z. */
function requireDrawable(C: Core, s: State): Geometry {
  const g = C.compute(s);
  if (!g.valid) {
    throw new Error(
      g.reason === "diameter"
        ? "X lies on the diameter AB, so the secants XA and XB are degenerate: move X off AB (for example to the top of the arc)."
        : `this O and X do not give a drawable construction (${g.reason}): move X off the diameter and away from O.`,
    );
  }
  return g;
}

/** The page's statements, all measured from the core's computed geometry. */
function reading(C: Core, s: State, g: Geometry) {
  const { O, X, r, A, B, Y, Z, P, U, V } = g;
  const res = C.residuals(g) || {};
  const tol = 1e-6 * Math.max(1, r);
  const len = (p: Pt, q: Pt) => C.dist(p, q);
  const midAY = C.midpoint(A, Y), midBZ = C.midpoint(B, Z);
  const UA = len(U, A), UX = len(U, X), UY = len(U, Y);
  const VB = len(V, B), VX = len(V, X), VZ = len(V, Z);
  const equalThree = (a: number, b: number, c: number) =>
    near(a, b, tol) && near(b, c, tol);
  const checks: Record<string, { residual: number | null; holds: boolean }> = {};
  for (const key of CLAIM_KEYS) {
    const v = res[key];
    checks[key] = {
      residual: sig(v),
      holds: v !== undefined && Number.isFinite(v) && Math.abs(v) <= 1e-6,
    };
  }
  return {
    circle: { center: pt(O), radius: r6(r), A: pt(A), B: pt(B) },
    X: pt(X),
    intersections: { Y: pt(Y), Z: pt(Z), U: pt(U), V: pt(V), P: pt(P) },
    lines: {
      tangentAtA: { p: pt(g.TA.p), q: pt(g.TA.q) },
      tangentAtX: { p: pt(g.TX.p), q: pt(g.TX.q) },
      tangentAtB: { p: pt(g.TB.p), q: pt(g.TB.q) },
      yz: { p: pt(g.YZ.p), q: pt(g.YZ.q) },
      ab: { p: pt(g.AB.p), q: pt(g.AB.q) },
    },
    threeLines: {
      configuration: g.parallel ? "parallel" : "concurrent",
      meetingPoint: g.parallel ? null : pt(P),
      tangentAtXVsAB_sine: r6(res.parallelTX),
      yzVsAB_sine: r6(res.parallelYZ),
      note: g.parallel
        ? "X is at the top of the arc: the tangent at X, YZ and AB are all horizontal, so they are parallel and never meet."
        : "The tangent at X, YZ and AB all pass through the same point P on AB.",
    },
    midpoints: {
      midpointOfAY: pt(midAY), U: pt(U),
      UIsMidpointAY: C.dist(U, midAY) <= tol,
      midpointOfBZ: pt(midBZ), V: pt(V),
      VIsMidpointBZ: C.dist(V, midBZ) <= tol,
    },
    equalTangents: {
      U: {
        UA: r6(UA), UX: r6(UX), UY: r6(UY), equal: equalThree(UA, UX, UY),
        why: "U lies on both tangents from it to the circle, at A and at X, and also on the tangent at X through Y, so UA = UX = UY; with U on AY this makes U the midpoint of AY.",
      },
      V: {
        VB: r6(VB), VX: r6(VX), VZ: r6(VZ), equal: equalThree(VB, VX, VZ),
        why: "V has equal tangents VB and VX, and VX = VZ, so VB = VX = VZ; with V on BZ this makes V the midpoint of BZ.",
      },
    },
    checks,
    allClaimsHold: Object.values(checks).every((c) => c.holds),
  };
}

function statusText(g: Geometry): string {
  if (!g.valid) {
    return g.reason === "diameter"
      ? "X lies on the diameter AB, so the two crossing lines cannot be drawn; move X off AB."
      : "This position is degenerate; move X away from O and off the diameter AB.";
  }
  if (g.parallel) {
    return "X is at the top of the arc: the tangent at X, YZ and AB are parallel, so they never meet.";
  }
  return `The tangent at X, YZ and AB all meet at P (${Math.round(g.P.x)}, ${Math.round(g.P.y)}).`;
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For centre O and a point X on the circle (board units 500 x 400 with y down; accept [x, y] or {x, y}, omit either to keep the opening picture), measure the whole From-500 drawing: A and B, the tangents at A, X and B, the intersections Y, Z, U, V and the meeting point P. Reports whether the tangent at X, YZ and AB are parallel or concurrent at P, that U and V are the midpoints of AY and BZ, and that UA = UX = UY and VB = VX = VZ, with a residual for every claim. X must be off the diameter AB.",
      args: '{"O":[166.666667,300],"X":[196.666667,248.038476]}',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const g = requireDrawable(C, s);
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          options: { showNames: s.showNames, showHint: s.showHint },
          ...reading(C, s, g),
          note:
            "The equal tangents from U give UA = UX = UY, so U is the midpoint of AY; likewise V is the midpoint of BZ. Those midpoints are what force YZ, the tangent at X and AB to be either all parallel (X at the apex) or all through one point P. This is an illustration: there is no win or loss; the tracker records exploration.",
        };
      },
    },

    sweep_x: {
      describe:
        "Slide X around the circle at the given angles in radians (measured from the +x direction of AB; the default 45, 60, 90 and 75 degrees sample both cases) and, for each stop, report whether the tangent at X, YZ and AB are parallel or meet at P, together with the meeting point and the largest residual of the midpoint and equal-tangent claims. The 90-degree stop is the parallel case; the others are concurrent.",
      args: '{"angles":[0.785398,1.047198,1.570796,1.309]}',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const r = C.dist(s.O, s.X);
        const raw = args.angles;
        let angles: number[];
        if (raw === undefined || raw === null) {
          angles = [Math.PI / 4, Math.PI / 3, Math.PI / 2, (5 * Math.PI) / 12];
        } else {
          if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) {
            throw new Error('argument "angles" must be an array of 1 to 24 numbers');
          }
          angles = raw.map((a, i) => {
            const n = Number(a);
            if (!Number.isFinite(n)) throw new Error(`angles[${i}] must be a finite number`);
            return n;
          });
        }
        const tol = 1e-6 * Math.max(1, r);
        const samples: SweepRow[] = angles.map((a): SweepRow => {
          const wanted = { x: s.O.x + r * Math.cos(a), y: s.O.y - r * Math.sin(a) };
          const placed = C.move(s, { type: "point", name: "X", point: C.clampToBoard(wanted) });
          const g = C.compute(placed || { ...s, X: wanted });
          const angleRad = r6(a), degrees = r6((a * 180) / Math.PI);
          if (!g.valid) {
            return {
              angleRad, degrees, valid: false,
              reason: g.reason, configuration: null, meetingPoint: null,
            };
          }
          const res = C.residuals(g)!;
          const worst = Math.max(...CLAIM_KEYS.map((k) => Math.abs(res[k] || 0)));
          return {
            angleRad, degrees, valid: true,
            configuration: g.parallel ? "parallel" : "concurrent",
            meetingPoint: g.parallel ? null : pt(g.P),
            maxClaimResidual: sig(worst),
            claimsHold: worst <= tol,
            tangentAtXVsAB_sine: r6(res.parallelTX),
            yzVsAB_sine: r6(res.parallelYZ),
          };
        });
        const usable = samples.filter((row) => row.valid === true);
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          circle: { center: pt(s.O), radius: r6(r) },
          samples,
          parallelDegrees: usable
            .filter((row) => row.configuration === "parallel")
            .map((row) => row.degrees),
          concurrentCount: usable.filter((row) => row.configuration === "concurrent").length,
          allClaimsHold: usable.length > 0 && usable.every((row) => row.claimsHold === true),
          note:
            "X at the apex of the arc puts the tangent at X, YZ and AB all horizontal, so they are parallel; anywhere else off the diameter they meet in one point on AB. At every usable stop U and V are the midpoints of AY and BZ and the equal-tangent lengths agree, so the page's claims hold throughout the sweep.",
        };
      },
    },
  };
}

/** Echo the fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported From 500 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved From 500 position must be an object");
  }
  const C = core();
  const s = readState(C, state);
  const g = C.compute(s);
  const common = {
    ...state,
    stateVersion,
    radius: r6(g.r),
    valid: g.valid,
    parallel: g.valid ? g.parallel : null,
    status: statusText(g),
  };
  if (!g.valid) {
    return {
      ...common,
      reason: g.reason,
      reading: null,
      note:
        "Track.state saved the two draggable points O and X, the two display switches and the move/exploration counters. The core recomputes the drawing from O and X alone; here X is on the diameter AB (or the construction is otherwise degenerate), so there is no Y or Z to measure and no midpoint or concurrency claim to check. Move X off AB to see the construction.",
    };
  }
  return {
    ...common,
    reason: null,
    reading: reading(C, s, g),
    note:
      "Track.state saved O, X, showNames, showHint, moves and explored. The core rebuilds A, B, the three tangents, Y, Z, P, U and V from O and X: the tangent at X, YZ and AB are parallel at the apex or concurrent at P elsewhere, U and V are the midpoints of AY and BZ, and UA = UX = UY and VB = VX = VZ. Every claim carries the core's residual. This is an illustration with no win or loss; the tracker records exploration.",
  };
}
