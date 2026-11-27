/*
 * run_game_logic actions and saved-position reader for Euclid I.43 Extended.
 *
 * The page extends Euclid I.43 to a point X off diagonal BD: with Y = B + D - X,
 * R = DY ∩ NQ and RS parallel to BC, Area(ASRQ) = Area(XNCP) on either side of
 * BD, while MSRX makes up the gap against Area(AMXQ). Ticking "areas on the
 * same side of BD" draws two orange pieces whose common area is that gap and
 * whose intersection T lies on AX. Every number below comes from the game's
 * own core, copied into src/generated/cores/ at build time; see _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

/** The small slice of the core this reader uses. */
type Core = {
  start(options?: Json): Json;
  movePoint(state: Json, name: string, p: Point): Json;
  setRegion(state: Json, region: string): Json;
  compute(state: Json): Geometry;
  describe(state: Json): string;
  cross(p: Point, q: Point, r: Point): number;
};

/** compute() returns only the corners when X is outside the 0.95 inset. */
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; X: Point;
  region: string; outOfBounds: boolean; sameBranch: boolean;
  finite?: boolean;
  M?: Point; N?: Point; P?: Point; Q?: Point; R?: Point; S?: Point;
  T?: Point; Y?: Point;
  amxq?: number; xncp?: number; asrq?: number; msrx?: number;
  refk?: number; orange1?: number; orange2?: number; gap?: number;
};

type LiveGeometry = Geometry & {
  finite: true;
  M: Point; N: Point; P: Point; Q: Point; R: Point; S: Point;
  T: Point; Y: Point;
  amxq: number; xncp: number; asrq: number; msrx: number;
  refk: number; orange1: number; orange2: number; gap: number;
};

const core = (): Core =>
  cores["euclid-i43-extended"].EuclidI43ExtendedCore as unknown as Core;

type Point = { x: number; y: number };
const REGIONS = ["ABD", "BD", "BCD"];

/** A point argument must be plain finite numbers, not a label or a string. */
function readPoint(value: unknown, label: string): Point {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`argument "${label}" must be an object with numeric x and y`);
  }
  const p = value as Json;
  if (typeof p.x !== "number" || typeof p.y !== "number" ||
      !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    throw new Error(`argument "${label}" must have numeric x and y`);
  }
  return { x: p.x, y: p.y };
}

/** The page's three tick boxes are booleans; reject anything else. */
function flag(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b));
}

const round = (v: number): number => Number(Number(v).toFixed(4));

function pt(value: unknown): Point | null {
  const p = value as Point | null | undefined;
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: round(p.x), y: round(p.y) };
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

/**
 * Rebuild a core state from arguments (or from a position saved by the page).
 * Corners go through movePoint so its centre symmetry and board limits decide
 * what is legal; a refused move is reported rather than silently ignored.
 */
function build(args: Json, forceSameSide?: boolean) {
  const C = core();
  const askedSameSide = flag(args, "sameSide", false);
  let s = C.start({
    showNames: flag(args, "showNames", true),
    sameSide: forceSameSide === true ? true : askedSameSide,
    showProof: flag(args, "showProof", false),
  });
  for (const name of ["A", "B", "C", "D"]) {
    if (args[name] !== undefined) {
      const target = readPoint(args[name], name);
      const next = C.movePoint(s, name, target);
      if (!samePoint(next[name] as Point, target)) {
        throw new Error(
          `${name} cannot sit at (${target.x}, ${target.y}): opposite corners reflect through the centre, the sides stay horizontal and all corners stay on the board`,
        );
      }
      s = next;
    }
  }
  if (args.X !== undefined) {
    const target = readPoint(args.X, "X");
    s = C.movePoint(s, "X", target);
    if (!samePoint(s.X as Point, target)) {
      throw new Error(`X must be inside the board (12..388 across, 12..308 down)`);
    }
  } else if (args.region !== undefined) {
    const region = args.region;
    if (typeof region !== "string" || !REGIONS.includes(region)) {
      throw new Error(`argument "region" must be one of ${REGIONS.join(", ")}`);
    }
    s = C.setRegion(s, region);
  }
  return s;
}

/** The construction only exists when X is inside the inset and nothing is parallel. */
function live(g: Geometry): LiveGeometry {
  if (g.outOfBounds) {
    throw new Error("X is outside the parallelogram (the applet's 0.95 inset); drag it inside");
  }
  if (!g.finite || g.amxq === undefined || g.T === undefined) {
    throw new Error("a construction line is parallel to another; move X a little");
  }
  return g as LiveGeometry;
}

function onLine(C: Core, p: Point, q: Point, r: Point): boolean {
  const scale = Math.hypot(q.x - p.x, q.y - p.y) * Math.hypot(r.x - p.x, r.y - p.y);
  return Math.abs(C.cross(p, q, r)) <= 1e-8 * Math.max(1, scale);
}

export function actions(): GameActions {
  return {
    compensating_areas: {
      describe:
        "For a parallelogram ABCD and a point X inside it, report Quang Tuan Bui's compensating construction: with Y = B + D - X, R = DY ∩ NQ and RS parallel to BC, Area(ASRQ) = Area(XNCP) even when X is off diagonal BD. It also gives Area(AMXQ), the leftover MSRX and the gap, and the reference parallelogram REFK used in the proof; plain Euclid I.43 only equates AMXQ with XNCP when X lies on BD.",
      args: '{ "region": "ABD" }',
      run: (args) => {
        const C = core();
        const state = build(args);
        const g = live(C.compute(state));
        return {
          region: g.region,
          offDiagonal: g.region !== "BD",
          X: pt(g.X),
          points: {
            A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D),
            M: pt(g.M), N: pt(g.N), P: pt(g.P), Q: pt(g.Q),
            R: pt(g.R), S: pt(g.S), Y: pt(g.Y),
          },
          areas: {
            amxq: round(g.amxq),
            xncp: round(g.xncp),
            asrq: round(g.asrq),
            msrx: round(g.msrx),
            refk: round(g.refk),
            gap: round(g.gap),
          },
          compensates: close(g.asrq, g.xncp),
          proofAreaMatches: close(g.refk, g.xncp),
          plainEuclidI43Matches: close(g.amxq, g.xncp),
          largerPiece: close(g.amxq, g.xncp)
            ? "neither: they are equal"
            : g.xncp > g.amxq ? "XNCP (blue)" : "AMXQ (red)",
          note:
            `X is ${g.region === "BD" ? "on BD" : `in ${g.region}, off BD`}: ASRQ = XNCP = ${round(g.xncp)}, while AMXQ = ${round(g.amxq)}. ` +
            `MSRX = ${round(g.msrx)} is exactly the gap; plain Euclid I.43 would only equalise AMXQ and XNCP on BD.`,
        };
      },
    },

    same_side_pair: {
      describe:
        "With the same-side box ticked, report the two orange parallelograms QXUV and XMSR (the page draws VTRQ and SMUT instead when X is above BD), their common area |1 - t - u| times Area(ABCD), and the gap they measure. It also checks that their intersection T = RS ∩ UV lies on AX; on diagonal BD both orange areas are zero, the plain Euclid I.43 case.",
      args: '{ "region": "BCD" }',
      run: (args) => {
        const C = core();
        const state = build(args, true);
        const g = live(C.compute(state));
        const drawn = g.sameBranch ? ["QXUV", "XMSR"] : ["VTRQ", "SMUT"];
        return {
          region: g.region,
          sameSide: true,
          drawnPair: drawn,
          orangeAreas: { QXUV: round(g.orange1), XMSR: round(g.orange2) },
          equal: close(g.orange1, g.orange2),
          measuresGap: close(g.orange1, g.gap),
          gap: round(g.gap),
          offDiagonalPieces: { amxq: round(g.amxq), xncp: round(g.xncp) },
          T: pt(g.T),
          tOnAx: onLine(C, g.A, g.X, g.T),
          note:
            `The orange pair each has area ${round(g.orange1)}, the gap between XNCP and AMXQ; ` +
            `${g.region === "BD" ? "on BD that gap is zero" : `on this branch the page draws ${drawn.join(" and ")}`}, ` +
            `and T = RS ∩ UV ${onLine(C, g.A, g.X, g.T) ? "lies on AX" : "is not on AX"}.`,
        };
      },
    },
  };
}

/** What the core says about the diagram the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  let here: Json;
  try {
    here = build(state);
  } catch {
    here = C.start();
  }
  const g = C.compute(here);
  const maybe = (v: number | undefined) => (v === undefined ? null : round(v));
  const savedPoint = (key: string) => {
    const v = state[key];
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    return pt(v);
  };
  const savedNumber = (key: string) => {
    const v = state[key];
    return typeof v === "number" && Number.isFinite(v) ? round(v) : null;
  };
  return {
    stateVersion,
    A: savedPoint("A"), B: savedPoint("B"), C: savedPoint("C"), D: savedPoint("D"),
    X: savedPoint("X"),
    M: savedPoint("M"), N: savedPoint("N"), P: savedPoint("P"), Q: savedPoint("Q"),
    R: savedPoint("R"), S: savedPoint("S"), T: savedPoint("T"), U: savedPoint("U"),
    V: savedPoint("V"), Y: savedPoint("Y"),
    region: typeof state.region === "string" ? state.region : null,
    outOfBounds: typeof state.outOfBounds === "boolean" ? state.outOfBounds : null,
    amxq: savedNumber("amxq"), xncp: savedNumber("xncp"),
    asrq: savedNumber("asrq"), gap: savedNumber("gap"),
    showNames: state.showNames === true,
    sameSide: state.sameSide === true,
    showProof: state.showProof === true,
    reading: {
      region: g.region,
      outOfBounds: g.outOfBounds,
      finite: g.finite === true,
      offDiagonal: g.region !== "BD",
      X: pt(g.X),
      areas: {
        amxq: maybe(g.amxq), xncp: maybe(g.xncp), asrq: maybe(g.asrq),
        msrx: maybe(g.msrx), gap: maybe(g.gap),
      },
      compensates:
        g.asrq !== undefined && g.xncp !== undefined && close(g.asrq, g.xncp),
      plainEuclidI43Matches:
        g.amxq !== undefined && g.xncp !== undefined && close(g.amxq, g.xncp),
      orangeAreas: { QXUV: maybe(g.orange1), XMSR: maybe(g.orange2) },
      orangeEqual:
        g.orange1 !== undefined && g.orange2 !== undefined && close(g.orange1, g.orange2),
      tOnAx: g.finite === true && g.T !== undefined && onLine(C, g.A, g.X, g.T),
      T: pt(g.T),
      note: C.describe(here),
    },
  };
}
