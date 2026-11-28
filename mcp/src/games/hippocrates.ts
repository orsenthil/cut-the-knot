/*
 * run_game_logic actions and saved-position reader for Hippocrates (angle
 * trisection by Hippocrates, Bogomolny's applet).
 *
 * The real core is hippocrates/hippocrates-core.js, copied verbatim into
 * src/generated/cores/ at build time; every number below is measured from it.
 * A, B, E lie on two horizontal lines, C is above A, D is the foot of the
 * perpendicular from C to AB, H is where AE crosses CD, and K is the point on
 * EA at distance 2*AC from E. G is the midpoint of E and K. The applet's finish
 * test is the strict dist(H, K) < 1.
 *
 * When K meets H, EH = 2*AC and (for C to the right of A, so angle BAC is
 * acute) angle BAE is exactly a third of angle BAC. With C to the left of A
 * the same EH = 2*AC gives an obtuse BAC and a ratio near 1.18, so the page's
 * unqualified claim is false. The page also says "place G on H", but the code
 * compares K with H; at the match G is still half of EH away. This is an
 * illustration, so there is no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };

type CoreState = {
  width: number; height: number; A: Pt; B: Pt; C: Pt; E: Pt;
  circle: Pt; radius: number;
  showNames: boolean; hint: boolean; hintEnabled: boolean;
  showHint: boolean; finished: boolean; moves: number;
};

type Shape = {
  D: Pt; F: Pt; H: Pt; K: Pt | null; G: Pt | null; radius: number;
  ac: number; ae: number; finished: boolean; solved: boolean;
  BAC: number; BAE: number; CAE: number;
};

interface Core {
  dist(p: Pt, q: Pt): number;
  angleAt(o: Pt, p: Pt, q: Pt): number;
  start(options?: { width?: number; height?: number; showNames?: boolean }): CoreState;
  compute(state: CoreState): Shape;
  result(state: CoreState): "done" | null;
  describe(state: CoreState, shape?: Shape): string;
  solveE(state: CoreState, options?: { lo?: number; hi?: number; span?: number }): number | null;
}

const core = (): Core => cores["hippocrates"].HippocratesCore as unknown as Core;

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
/** Non-finite values (the applet's |det| < 1 intersection guard) become null. */
const cnt = (v: number | null | undefined): number | null =>
  v !== null && v !== undefined && Number.isFinite(v) ? round(v) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const deg = (radians: number): number | null => cnt((radians * 180) / Math.PI);
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/** Accept both the tutor's [x, y] and the page's saved { x, y } points. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/* Two prepared pictures: the acute one trisects, its obtuse mirror does not. */
const TEMPLATES = {
  acute: { A: { x: 0, y: 80 }, B: { x: 1000, y: 80 }, C: { x: 40, y: 0 } },
  obtuse: { A: { x: 0, y: 80 }, B: { x: 1000, y: 80 }, C: { x: -40, y: 0 } },
} as const;

type Params = {
  A: Pt; B: Pt; C: Pt;
  ex?: number; lo?: number; hi?: number;
  caseName: string | null;
};

/** Validate the action arguments: prepared case or explicit A, B, C and E. */
function readParams(args: Json): Params {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error('arguments must be an object with A, B, C points and optional case, E, lo, hi');
  }
  const caseName = args.case === undefined || args.case === null ? null : String(args.case);
  if (caseName !== null && caseName !== "acute" && caseName !== "obtuse") {
    throw new Error('argument "case" must be "acute" or "obtuse"');
  }
  const t = caseName ? TEMPLATES[caseName] : TEMPLATES.acute;
  const A = args.A === undefined || args.A === null ? { ...t.A } : readPoint(args.A, "A");
  const B = args.B === undefined || args.B === null ? { ...t.B } : readPoint(args.B, "B");
  const C = args.C === undefined || args.C === null ? { ...t.C } : readPoint(args.C, "C");

  let ex: number | undefined;
  if (args.E !== undefined && args.E !== null) {
    ex = typeof args.E === "number" && Number.isFinite(args.E)
      ? args.E : readPoint(args.E, "E").x;
  }
  const lo = args.lo === undefined || args.lo === null ? undefined : num(args, "lo");
  const hi = args.hi === undefined || args.hi === null ? undefined : num(args, "hi");
  if (lo !== undefined && hi !== undefined && hi <= lo) {
    throw new Error('argument "hi" must be greater than "lo"');
  }
  return { A, B, C, ex, lo, hi, caseName };
}

function makeState(A: Pt, B: Pt, C: Pt, E: Pt, radius: number): CoreState {
  return {
    width: 400, height: 300, A, B, C, E,
    circle: { x: E.x, y: E.y }, radius,
    showNames: false, hint: false, hintEnabled: false,
    showHint: false, finished: false, moves: 0,
  };
}

/**
 * Put E on the horizontal line through C so that EH = 2*AC, using the real
 * core's solver (or the supplied E.x), then let the core measure the picture.
 * The obtuse mirror needs the solver's upper end at A.x; the acute one is
 * bracketed to the right of C.
 */
function solveAt(Core: Core, p: Params): { state: CoreState; shape: Shape } {
  const radius = 2 * Core.dist(p.A, p.C);
  const state = makeState(p.A, p.B, p.C,
    { x: p.ex === undefined ? p.C.x + 1 : p.ex, y: p.C.y }, radius);
  if (p.ex === undefined) {
    const lo = p.lo === undefined ? p.C.x + 1e-7 : p.lo;
    const hi = p.hi === undefined ? (p.C.x >= p.A.x ? p.C.x + 1e6 : p.A.x) : p.hi;
    if (!(hi > lo)) throw new Error('the E solver needs "hi" greater than "lo"');
    const root = Core.solveE(state, { lo, hi });
    if (root === null) {
      throw new Error(`no E with EH = 2*AC exists between x = ${lo} and x = ${hi}`);
    }
    state.E = { x: root, y: p.C.y };
    state.circle = { x: root, y: p.C.y };
  }
  /* The page's CheckSolved is strict: dist(H, K) < 1. */
  state.finished = Core.compute(state).solved;
  return { state, shape: Core.compute(state) };
}

/** One reading, every number from the core's compute/dist/describe/result. */
function reading(Core: Core, state: CoreState, shape: Shape) {
  const EH = Core.dist(state.E, shape.H);
  const ratio = shape.BAE ? shape.BAC / shape.BAE : NaN;
  const tol = 1e-6 * Math.max(shape.ac, 1);
  return {
    points: {
      A: pt(state.A), B: pt(state.B), C: pt(state.C), E: pt(state.E),
      D: pt(shape.D), F: pt(shape.F), H: pt(shape.H),
      K: pt(shape.K), G: pt(shape.G),
    },
    lengths: {
      AC: cnt(shape.ac), AE: cnt(shape.ae), radius: cnt(shape.radius),
      twiceAC: cnt(2 * shape.ac), EH: cnt(EH),
      HK: shape.K ? cnt(Core.dist(shape.H, shape.K)) : null,
      GK: shape.G && shape.K ? cnt(Core.dist(shape.G, shape.K)) : null,
      GH: shape.G ? cnt(Core.dist(shape.G, shape.H)) : null,
    },
    anglesDegrees: {
      BAC: deg(shape.BAC), BAE: deg(shape.BAE), CAE: deg(shape.CAE),
      ratio: cnt(ratio),
    },
    acute: shape.BAC < Math.PI / 2,
    trisects: near(ratio, 3, 1e-6),
    EH_equals_2AC: near(EH, 2 * shape.ac, tol),
    K_on_H: shape.solved,
    G_on_H: shape.G ? Core.dist(shape.G, shape.H) < 1 : false,
    result: Core.result(state),
    status: Core.describe(state, shape),
  };
}

type Reading = ReturnType<typeof reading>;

/** A matched construction and its mirror across the vertical through A. */
function pair(Core: Core, args: Json) {
  const p = readParams(args);
  const given = solveAt(Core, p);
  const mirrorAt: Pt = { x: 2 * p.A.x - p.C.x, y: p.C.y };
  const mirrored = near(mirrorAt.x, p.C.x, 1e-9)
    ? null
    : solveAt(Core, { A: p.A, B: p.B, C: mirrorAt, caseName: null });
  return {
    params: p,
    given: { state: given.state, shape: given.shape, r: reading(Core, given.state, given.shape) },
    mirrored: mirrored
      ? { state: mirrored.state, shape: mirrored.shape, r: reading(Core, mirrored.state, mirrored.shape) }
      : null,
  };
}

function trisectionNote(given: Reading, mirrored: Reading | null): string {
  const acute = given.acute ? given : mirrored && mirrored.acute ? mirrored : null;
  const obtuse = !given.acute ? given : mirrored && !mirrored.acute ? mirrored : null;
  const acutePart = acute
    ? `In the acute case EH = ${acute.lengths.EH} = 2*AC = ${acute.lengths.twiceAC}, angle BAC = ${acute.anglesDegrees.BAC}° and angle BAE = ${acute.anglesDegrees.BAE}°, a ratio of ${acute.anglesDegrees.ratio}: the angle is trisected. `
    : "";
  const obtusePart = obtuse
    ? `With C on the other side of A, angle BAC = ${obtuse.anglesDegrees.BAC}° is obtuse; solving for EH = 2*AC still gives angle BAE = ${obtuse.anglesDegrees.BAE}°, a ratio of ${obtuse.anglesDegrees.ratio} rather than 3${obtuse.K_on_H ? ", and here K does meet H" : ", and here K does not even meet H"}. `
    : "";
  return (
    acutePart + obtusePart +
    "The core's status line says 'one third' whenever K meets H, so the acute restriction is mathematical, not something the applet checks. " +
    "These are drawn constructions, so there is no win or loss."
  );
}

export function actions(): GameActions {
  return {
    trisection: {
      describe:
        "Solve E on the line through C so that EH = 2*AC, then measure angle BAC, angle BAE and their ratio; also report the mirror image of C across the vertical through A. Pass case = 'acute' (C to the right of A) or 'obtuse' (C to the left of A), or give A, B and C as [x, y] or { x, y } plus optional E (a point or an x value) and solver bounds lo and hi. For an acute BAC the ratio is 3 (trisection); for the obtuse mirror the same EH = 2*AC gives about 1.18, so the page's unqualified claim is false.",
      args: '{ "case": "acute" }',
      run: (args) => {
        const Core = core();
        const { params, given, mirrored } = pair(Core, args);
        const gr = given.r;
        return {
          case: params.caseName,
          given: {
            points: gr.points, lengths: gr.lengths, anglesDegrees: gr.anglesDegrees,
            acute: gr.acute, trisects: gr.trisects,
            EH_equals_2AC: gr.EH_equals_2AC, K_on_H: gr.K_on_H,
            result: gr.result, status: gr.status,
          },
          mirroredC: mirrored ? pt(mirrored.state.C) : null,
          mirrored: mirrored
            ? {
                points: mirrored.r.points, lengths: mirrored.r.lengths,
                anglesDegrees: mirrored.r.anglesDegrees, acute: mirrored.r.acute,
                trisects: mirrored.r.trisects,
                EH_equals_2AC: mirrored.r.EH_equals_2AC, K_on_H: mirrored.r.K_on_H,
                result: mirrored.r.result, status: mirrored.r.status,
              }
            : null,
          note: trisectionNote(gr, mirrored ? mirrored.r : null),
        };
      },
    },

    g_vs_k: {
      describe:
        "At the matched construction (EH = 2*AC) compare K, G and H: the applet's finish test puts K on H, but G is the midpoint of E and K and is still half of EH from H. The page's later instruction to put G on H is a wording slip; the code and the 2006 page use K. Arguments are as in trisection (case or explicit A, B, C, E, lo and hi).",
      args: '{ "case": "acute" }',
      run: (args) => {
        const Core = core();
        const { given } = pair(Core, args);
        const r = given.r;
        return {
          points: r.points,
          lengths: r.lengths,
          anglesDegrees: r.anglesDegrees,
          finishTest: "dist(H, K) < 1",
          K_on_H: r.K_on_H,
          G_on_H: r.G_on_H,
          G_is_midpoint_of_EK:
            given.shape.G && given.shape.K
              ? near(Core.dist(given.state.E, given.shape.G),
                     Core.dist(given.shape.G, given.shape.K), 1e-6)
              : null,
          result: r.result,
          status: r.status,
          note:
            `At the match EH = ${r.lengths.EH} = 2*AC = ${r.lengths.twiceAC} and K is ${r.lengths.HK} from H, so the applet's strict dist(H, K) < 1 test passes (angle BAE = ${r.anglesDegrees.BAE}°, angle BAC = ${r.anglesDegrees.BAC}°). ` +
            `G is the midpoint of E and K, still ${r.lengths.GH} from H (half of EH): the page's 'place G on H' is a wording slip, since the code compares K with H. ` +
            "In right triangle CEH, G is the midpoint of the hypotenuse EH and so is AC from C, E and H, which is why the isosceles-triangle proof works. This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

/** Echo the saved fields, falling back to the opening picture if one is damaged. */
function savedState(Core: Core, state: Json): CoreState {
  const base = Core.start();
  const positive = (raw: unknown, fallback: number): number => {
    const v = Number(raw);
    return raw !== undefined && raw !== null && Number.isFinite(v) && v > 0 ? v : fallback;
  };
  const flag = (raw: unknown, fallback: boolean): boolean =>
    typeof raw === "boolean" ? raw : fallback;
  return {
    width: positive(state.width, base.width),
    height: positive(state.height, base.height),
    A: readPoint(state.A, "saved A"),
    B: readPoint(state.B, "saved B"),
    C: readPoint(state.C, "saved C"),
    E: readPoint(state.E, "saved E"),
    circle: readPoint(state.circle, "saved circle"),
    radius: positive(state.radius, 2 * Core.dist(readPoint(state.A, "saved A"), readPoint(state.C, "saved C"))),
    showNames: flag(state.showNames, base.showNames),
    hint: flag(state.hint, base.hint),
    hintEnabled: flag(state.hintEnabled, base.hintEnabled),
    showHint: flag(state.showHint, base.showHint),
    finished: flag(state.finished, base.finished),
    moves: positive(state.moves, base.moves),
  };
}

/** Echo what Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hippocrates state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hippocrates position must be an object");
  }
  const Core = core();
  try {
    const s = savedState(Core, state);
    const shape = Core.compute(s);
    const r = reading(Core, s, shape);
    return {
      ...state,
      stateVersion,
      reading: {
        board: { width: s.width, height: s.height },
        points: r.points,
        lengths: r.lengths,
        anglesDegrees: r.anglesDegrees,
        acute: r.acute,
        trisects: r.trisects,
        match: {
          EH_equals_2AC: r.EH_equals_2AC,
          finishTest: "dist(H, K) < 1",
          K_on_H: r.K_on_H,
          G_on_H: r.G_on_H,
          result: r.result,
        },
        status: r.status,
      },
      result: r.result,
      note:
        "Track.state saved the board size, the four points A, B, C, E and the circle's centre and radius, the name and hint flags, the finished flag and the move count. " +
        "The core rebuilds D, F, H, K and G and the two angles from those saved values (using the saved radius, not a recomputed one). " +
        `Here EH = ${r.lengths.EH} against 2*AC = ${r.lengths.twiceAC}, so K is ${r.lengths.HK} from H ` +
        `(${r.K_on_H ? "inside" : "outside"} the applet's one-unit test); angle BAC = ${r.anglesDegrees.BAC}° and angle BAE = ${r.anglesDegrees.BAE}°, ratio ${r.anglesDegrees.ratio}` +
        (r.acute
          ? ", an acute BAC, the case where a match would trisect the angle (this saved picture is not at a match)."
          : ", an obtuse BAC, where even a match does not trisect the angle."),
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note:
        "A saved Hippocrates position needs finite numeric x and y for A, B, C, E and the circle centre, a positive radius, width and height, and boolean flags.",
    };
  }
}
