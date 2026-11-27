/*
 * run_game_logic actions and saved-position reader for Half Area Of Quadrilateral 2.
 *
 * The real core is half-area-of-quadrilateral-2/
 * half-area-of-quadrilateral-2-core.js, copied into src/generated/cores/ at
 * build time. It transcribes the applet's Compute(): draw AC, then through
 * either D or B draw the parallel to AC; it meets the opposite side (AB or AD)
 * at E, and M is the midpoint of BE (first case) or DE (second). CM is the cut.
 * Because M is the midpoint of the side of triangle CBE/CDE, CM is a median of
 * that triangle; because the parallel gives that triangle the same base AC and
 * apex line as the quadrilateral, it has the quadrilateral's area. So CM halves
 * ABCD whenever M really lies on a side. One of the two cases always does:
 * the parallel to AC through K, the midpoint of BD, reaches M (the midline of
 * triangle BDE/DBE), so it crosses AB or AD.
 *
 * One applet quirk is kept and reported: AreParallel uses a tolerance of 0.005,
 * so when DA and DB are almost the same direction Compute sets E = B or E = D
 * without intersecting, and the drawn cut is slightly uneven.
 *
 * Coordinates are board units of the page's 500 x 500 view, y down. This is an
 * illustration with no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Corner = "A" | "B" | "C" | "D";
const CORNERS: Corner[] = ["A", "B", "C", "D"];

type Candidate = {
  E: Pt; M: Pt; vertex: Pt; corner: Pt;
  side: string; parallel: boolean; onSide: boolean;
};
type Measures = {
  areaQuad: number; areaTri: number; areaRelevant: number;
  quadBisectError: number; triangleBisectError: number;
};
type Claims = {
  triangleBisected: boolean; quadrilateralBisected: boolean;
  oneCase: boolean; kLineCrossesSide: boolean; triangleIsQuadrilateral: boolean;
};
type Geometry = {
  A: Pt; B: Pt; C: Pt; D: Pt; E: Pt; M: Pt; K: Pt; BorD: Pt; vertex: Pt;
  side: string; parallel: boolean; shortcut: boolean;
  Quadri: Pt[]; Tri: Pt[];
  fromD: Candidate; fromB: Candidate;
  measures: Measures; claims: Claims; tol: number;
};
type State = {
  A: Pt; B: Pt; C: Pt; D: Pt;
  options: { showNames: boolean; hint: boolean };
  explored: boolean;
};
interface Core {
  VIEW: { x: number; y: number; width: number; height: number };
  EPS_VEC: number;
  MIN_DIST: number;
  PAD: number;
  start(options?: Json): State;
  move(s: State, name: string, p: Pt): State;
  geometry(s: State): Geometry | null;
  compute(a: Pt, b: Pt, c: Pt, d: Pt): Geometry | null;
  describe(s: State): string;
}

const core = (): Core =>
  cores["half-area-of-quadrilateral-2"].HalfAreaOfQuadrilateral2Core as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. Keep tiny
 * residuals visible: a 1e-11 gap is the interesting result here. */
const r6 = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toFixed(6));
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2))
      : r6(v);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x)!, y: r6(p.y)! }
    : null;

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string): Pt {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw && typeof raw === "object") {
    const o = raw as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
    }
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** A point from saved state that may be missing or degenerate. */
function maybePoint(raw: unknown): Pt | null {
  try {
    return readPoint(raw, "point");
  } catch {
    return null;
  }
}

function flag(args: Json, key: string, fallback: boolean): boolean {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") {
    throw new Error(`argument "${key}" must be true or false, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/**
 * The applet's opening state, with any supplied corners applied as drags (so
 * they are clamped exactly as the page clamps them). Omitted corners keep the
 * opening quadrilateral; the two checkboxes are optional too.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with A, B, C and/or D points");
  }
  const home = C.start();
  let s = C.start({
    showNames: flag(args, "showNames", home.options.showNames),
    hint: flag(args, "hint", home.options.hint),
  });
  for (const name of CORNERS) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.move(s, name, readPoint(raw, name));
  }
  return s;
}

type Reading = {
  valid: boolean;
  reason: string | null;
  board: { width: number; height: number };
  options: { showNames: boolean; hint: boolean };
  tolerance: number;
  quadrilateral: Record<Corner, Pt | null>;
  auxiliary: { E: Pt | null; M: Pt | null; K: Pt | null; BorD: Pt | null };
  chosen: {
    side: string | null;
    from: string | null;
    through: string | null;
    meets: string | null;
    midpointOf: string | null;
    triangle: string | null;
    parallelShortcut: boolean;
    cut: { from: Pt | null; to: Pt | null };
  };
  cases: {
    fromD: { side: string; E: Pt | null; M: Pt | null; onSide: boolean; parallel: boolean };
    fromB: { side: string; E: Pt | null; M: Pt | null; onSide: boolean; parallel: boolean };
    oneCase: boolean;
    kLineCrossesSide: boolean;
  };
  areas: {
    quadrilateral: number | null;
    triangle: number | null;
    triangleTwice: number | null;
    quadBisectError: number | null;
    triangleBisectError: number | null;
    tolerance: number | null;
  };
  claims: Claims | null;
  status: string;
};

/** Everything the real core measures for one quadrilateral, in tutor units. */
function reading(C: Core, s: State): Reading {
  const g = C.geometry(s);
  const board = { width: C.VIEW.width, height: C.VIEW.height };
  const blank: Reading = {
    valid: false,
    reason: "The core cannot draw this figure: four distinct corners at least 1 unit apart are needed.",
    board,
    options: { ...s.options },
    tolerance: C.EPS_VEC,
    quadrilateral: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D),
    },
    auxiliary: { E: null, M: null, K: null, BorD: null },
    chosen: {
      side: null, from: null, through: null, meets: null, midpointOf: null,
      triangle: null, parallelShortcut: false, cut: { from: null, to: null },
    },
    cases: {
      fromD: { side: "AB", E: null, M: null, onSide: false, parallel: false },
      fromB: { side: "AD", E: null, M: null, onSide: false, parallel: false },
      oneCase: false, kLineCrossesSide: false,
    },
    areas: {
      quadrilateral: null, triangle: null, triangleTwice: null,
      quadBisectError: null, triangleBisectError: null, tolerance: null,
    },
    claims: null,
    status: C.describe(s),
  };
  if (!g) return blank;

  const fromD = g.fromD, fromB = g.fromB;
  const m = g.measures;
  return {
    valid: true,
    reason: null,
    board,
    options: { ...s.options },
    tolerance: C.EPS_VEC,
    quadrilateral: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D),
    },
    auxiliary: {
      E: pt(g.E), M: pt(g.M), K: pt(g.K), BorD: pt(g.BorD),
    },
    chosen: {
      side: g.side,
      from: g.BorD === g.fromB.corner ? "B" : "D",
      through: g.side === "AD" ? "B (parallel to AC)" : "D (parallel to AC)",
      meets: g.side === "AD" ? "AD at E" : "AB at E",
      midpointOf: g.side === "AD" ? "DE" : "BE",
      triangle: g.side === "AD" ? "CDE" : "CBE",
      parallelShortcut: g.parallel,
      cut: { from: pt(g.C), to: pt(g.M) },
    },
    cases: {
      fromD: {
        side: fromD.side, E: pt(fromD.E), M: pt(fromD.M),
        onSide: fromD.onSide, parallel: fromD.parallel,
      },
      fromB: {
        side: fromB.side, E: pt(fromB.E), M: pt(fromB.M),
        onSide: fromB.onSide, parallel: fromB.parallel,
      },
      oneCase: g.claims.oneCase,
      kLineCrossesSide: g.claims.kLineCrossesSide,
    },
    areas: {
      quadrilateral: r6(m.areaQuad),
      triangle: r6(m.areaTri),
      triangleTwice: r6(2 * m.areaTri),
      quadBisectError: sig(m.quadBisectError),
      triangleBisectError: sig(m.triangleBisectError),
      tolerance: sig(g.tol),
    },
    claims: g.claims,
    status: C.describe(s),
  };
}

const PROOF_NOTE =
  "CM is a median of triangle CBE or CDE (M is the midpoint of its side), so it halves that triangle. " +
  "The parallel to AC makes that triangle share base AC with the quadrilateral and have its apex on a line parallel to AC, " +
  "so the triangle has the quadrilateral's area and CM halves the quadrilateral. " +
  "The parallel to AC through K, the midpoint of BD, is the midline of triangle BDE or DBE: it ends at M, " +
  "which is why exactly one of the two cases puts M on a side. The logic test finds no failure on more than 30,000 convex shapes.";
const CAVEAT_NOTE =
  "The applet's AreParallel test uses a tolerance of 0.005: when DA and DB are almost the same direction it sets E = B " +
  "or E = D without intersecting, so the drawn triangle is no longer the quadrilateral and the cut is slightly uneven. " +
  "The core keeps that quirk and reports it rather than hiding it.";

/** A near-collinear shape from the port's logic test, for the shortcut action. */
const NEAR_ARGS =
  '{"A":[217.7857494354248,58.35036039352417],"B":[337.9988491535187,27.796398401260376],' +
  '"C":[126.08970284461975,58.82655620574951],"D":[43.820258378982544,102.27817237377167]}';
/** The live page's saved corners (half-area-of-quadrilateral-2.json). */
const EXAMPLE_ARGS = '{"A":[130,250],"B":[200,437],"C":[416,400],"D":[250,62]}';

export function actions(): GameActions {
  return {
    median_cut: {
      describe:
        "For a quadrilateral with corners A, B, C, D ([x, y] or { x, y } in the page's 500 x 500 board; omit any to keep the opening picture), run the real core's Compute and report which of the two cases it picks, where the parallel to AC through B or D meets the opposite side at E, the midpoint M of BE or DE, the midpoint K of BD, and the areas. It checks that CM is a median of triangle CBE/CDE, that this triangle has the quadrilateral's area, that one of the two cases always puts M on a side, and that CM halves the quadrilateral; showNames and hint are optional switches.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        if (!r.valid) throw new Error(`${r.reason} Move a corner and try again.`);
        const a = r.areas, c = r.chosen;
        return {
          ...r,
          note:
            `The core draws the parallel to AC through ${c.from}; it meets ${c.meets}, and M = (${c.cut.to!.x}, ${c.cut.to!.y}) ` +
            `is the midpoint of ${c.midpointOf}. K, the midpoint of BD, is (${r.auxiliary.K!.x}, ${r.auxiliary.K!.y}). ` +
            `Triangle ${c.triangle} has area ${a.triangle} against the quadrilateral's ${a.quadrilateral}; ` +
            `CM cuts off ${a.triangleTwice} twice, an error of ${a.quadBisectError} against a tolerance of ${a.tolerance}. ` +
            `${PROOF_NOTE} ` +
            (c.parallelShortcut ? `${CAVEAT_NOTE} ` : "") +
            "This is an illustration, so there is no win or loss.",
        };
      },
    },

    parallel_shortcut: {
      describe:
        "Compare a normal quadrilateral with one whose sides DA and DB are almost the same direction, using the real core for both. Pass A, B, C, D as [x, y] or { x, y } to test your own nearly flat shape (the default is the port's near-collinear example); the report shows how the applet's 0.005 AreParallel tolerance sets E = B or E = D without intersecting, so the drawn triangle loses the quadrilateral's area and CM no longer bisects it, while the normal opening shape still does. It also confirms that one case still puts M on a side in both pictures.",
      args: NEAR_ARGS,
      run: (args) => {
        const C = core();
        const supplied = CORNERS.some((n) => args[n] !== undefined && args[n] !== null);
        const s = buildState(C, supplied ? args : JSON.parse(NEAR_ARGS));
        const odd = reading(C, s);
        const normal = reading(C, C.start());
        if (!odd.valid) throw new Error(`${odd.reason} Move a corner and try again.`);
        return {
          source: supplied
            ? "the supplied corners and the applet's opening picture"
            : "the port's near-collinear example and the applet's opening picture",
          nearParallel: odd,
          opening: normal,
          comparison: {
            nearParallelShortcut: odd.chosen.parallelShortcut,
            nearParallelEequalsVertex:
              !!odd.auxiliary.E && !!odd.auxiliary.BorD &&
              Math.abs(odd.auxiliary.E.x - odd.auxiliary.BorD.x) < 1e-9 &&
              Math.abs(odd.auxiliary.E.y - odd.auxiliary.BorD.y) < 1e-9,
            nearParallelTriangleIsQuadrilateral: odd.claims?.triangleIsQuadrilateral ?? false,
            nearParallelQuadrilateralBisected: odd.claims?.quadrilateralBisected ?? false,
            nearParallelBisectError: odd.areas.quadBisectError,
            openingQuadrilateralBisected: normal.claims?.quadrilateralBisected ?? false,
            nearParallelCaseExists: odd.claims?.oneCase ?? false,
            openingCaseExists: normal.claims?.oneCase ?? false,
            tolerance: C.EPS_VEC,
          },
          note:
            `In the near-parallel picture the core takes the shortcut (E = ${odd.chosen.from}, E equals the endpoint of the parallel line), ` +
            `so triangle ${odd.chosen.triangle} has area ${odd.areas.triangle} while the quadrilateral has ${odd.areas.quadrilateral}; ` +
            `CM misses a true half by ${odd.areas.quadBisectError} board units of area. ` +
            `At the opening the same construction gives areas ${normal.areas.triangle} and ${normal.areas.quadrilateral}, ` +
            `an error of ${normal.areas.quadBisectError}. In both pictures one case still puts M on a side. ` +
            `${CAVEAT_NOTE} ${PROOF_NOTE} This is an illustration with no win or loss.`,
        };
      },
    },
  };
}

/** Track.state saved the four corners and the computed points, not a core state. */
function savedState(C: Core, state: Json): { s: State; savedReadable: boolean } {
  let s = C.start();
  let savedReadable = true;
  for (const name of CORNERS) {
    try {
      s = C.move(s, name, readPoint(state[name], name));
    } catch {
      savedReadable = false; // keep the applet's opening corner for this one
    }
  }
  const raw = state.options;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Json;
    s = {
      ...s,
      options: {
        showNames: typeof o.showNames === "boolean" ? o.showNames : s.options.showNames,
        hint: typeof o.hint === "boolean" ? o.hint : s.options.hint,
      },
    };
  } else if (typeof state.showNames === "boolean" || typeof state.hint === "boolean") {
    s = {
      ...s,
      options: {
        showNames: typeof state.showNames === "boolean" ? state.showNames : s.options.showNames,
        hint: typeof state.hint === "boolean" ? state.hint : s.options.hint,
      },
    };
  }
  return { s, savedReadable };
}

/** Echo the saved fields, plus a fresh core reading of that same figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Half Area Of Quadrilateral 2 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Half Area Of Quadrilateral 2 position must be an object");
  }
  const C = core();
  const { s, savedReadable } = savedState(C, state);
  const r = reading(C, s);
  const savedClaims = state.claims && typeof state.claims === "object" && !Array.isArray(state.claims)
    ? state.claims as Json
    : null;
  const claimsAgree = !r.claims || !savedClaims
    ? null
    : (Object.keys(r.claims) as (keyof Claims)[]).every(
      (k) => r.claims![k] === savedClaims[k],
    );
  return {
    ...state,
    stateVersion,
    saved: {
      A: pt(maybePoint(state.A)), B: pt(maybePoint(state.B)),
      C: pt(maybePoint(state.C)), D: pt(maybePoint(state.D)),
      E: pt(maybePoint(state.E)), M: pt(maybePoint(state.M)),
      K: pt(maybePoint(state.K)), BorD: pt(maybePoint(state.BorD)),
      side: state.side ?? null,
      showNames: state.showNames ?? (state.options as Json | undefined)?.showNames ?? null,
      hint: state.hint ?? (state.options as Json | undefined)?.hint ?? null,
      claims: savedClaims,
      measures: state.measures ?? null,
    },
    savedReadable,
    claimsAgreeWithSaved: claimsAgree,
    derived: r,
    isIllustration: true,
    status: r.status,
    note: !savedReadable
      ? "Some saved corners could not be read, so the applet's opening positions were substituted for them; the core reading below comes from those corners. This is an illustration with no win or loss."
      : !r.valid
        ? `Track.state saved the four corners and the computed points, but the core cannot draw this saved figure (${r.reason}). ${PROOF_NOTE}`
        : [
          "Track.state saved the four draggable corners, the computed E, M, K and BorD, the chosen side and the measured claims, not a core state.",
          `The core rebuilds the parallel and midpoint from A, B, C, D: it picks the ${r.chosen.from} case on side ${r.chosen.side}, with M the midpoint of ${r.chosen.midpointOf}, and ${r.claims?.quadrilateralBisected ? "CM halves the shape" : `CM misses a half by ${r.areas.quadBisectError} area units after the 0.005 parallel shortcut`}.`,
          PROOF_NOTE,
          ...(r.chosen.parallelShortcut ? [CAVEAT_NOTE] : []),
          "This is an illustration with no win or loss.",
        ].join(" "),
  };
}
