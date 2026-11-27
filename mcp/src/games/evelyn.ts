/*
 * run_game_logic actions and saved-position reader for Evelyn.
 *
 * Evelyn is the triangle-only applet for the six circles theorem. A triangle
 * has three draggable corners V[0..2]; the starting circle is centred at
 * P = A*Ta + (1 - Ta)*foot(A), on the bisector of corner A, and has radius equal
 * to its distance to side A->B. Each following centre lies on the bisector of
 * the next corner, at B + t*(foot(B) - B), with radius d*t, where t is the root
 * in [0, 1] of the applet's tangency quadratic. The corners are visited A, B,
 * C, A, B, C, and after six steps the chain returns to the first circle (its
 * parameter t = 1 - Ta), so a chain touching neighbours and successive pairs
 * of sides never has more than six circles.
 *
 * Quirk kept from the bytecode: when the first circle is very large the
 * quadratic can have two roots in [0, 1] and Solve2 keeps the farther one,
 * which makes the seventh circle tangent to a side's extension past the corner
 * rather than to the side segment. The drawing loop still stops at six.
 * The sibling applet EvelynN grows an n-sided polygon and reports chains of up
 * to 2n circles; this reader is the triangle-only six-circle applet.
 *
 * All numbers below come from the real core evelyn/evelyn-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the page's
 * 500 x 450 viewBox, y down. See _shared.ts for the game-module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number; k: number; t: number; d: number };
type Line = { a: Point; b: Point };
type Claims = {
  finite: boolean; touchesBothSides: boolean; neighboursTouch: boolean;
  feetOnSides: boolean; atMostSix: boolean; closesAfterSix: boolean;
  repeatsOrStops: boolean; circles: number;
};
type State = { w: number; h: number; V: Point[]; Ta: number; which: number };
type Geometry = { V: Point[]; L: Point[]; P: Point; sides: Line[] };
interface Evelyn {
  WIDTH: number; HEIGHT: number; MARGIN: number; DEFAULT_TA: number;
  DEFAULT_WHICH: number; PAIRS: number; EPS: number;
  clamp(v: number, lo: number, hi: number): number;
  start(options?: Partial<State>): State;
  withOptions(state: State, changes: Partial<State>): State;
  geometry(state: State): Geometry;
  nextCircle(A: Point, c: Circle, B: Point, C: Point): Circle | null;
  extend(state: State, limit?: number): Circle[];
  chain(state: State): Circle[];
  isRed(which: number, k: number): boolean;
  footParameter(p: Point, a: Point, b: Point): number;
  distToLine(p: Point, line: Line): number;
  dist(a: Point, b: Point): number;
  claims(state: State): Claims;
}

const core = (): Evelyn => cores["evelyn"].EvelynCore as unknown as Evelyn;

/* The core is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const num6 = (v: number): number | null => (Number.isFinite(v) ? r6(v) : null);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(3)) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

const CORNERS = ["A", "B", "C"] as const;

/** A board point, either [x, y] or { x, y }, with finite coordinates. */
function readPoint(value: unknown, label: string): Point {
  let x = NaN, y = NaN;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readDims(C: Evelyn, args: Json): { w: number; h: number } {
  const w = num(args, "w", C.WIDTH);
  const h = num(args, "h", C.HEIGHT);
  if (w < 40 || w > 4000 || h < 40 || h > 4000) {
    throw new Error('arguments "w" and "h" must each be between 40 and 4000');
  }
  return { w, h };
}

function readTa(C: Evelyn, args: Json): number {
  const Ta = num(args, "Ta", C.DEFAULT_TA);
  if (Ta < 0 || Ta > 1) throw new Error('argument "Ta" must be a number between 0 and 1');
  return Ta;
}

function readWhich(C: Evelyn, args: Json): number {
  const which = num(args, "which", C.DEFAULT_WHICH);
  if (!Number.isInteger(which) || which < 0 || which > C.PAIRS) {
    throw new Error(`argument "which" must be a whole number from 0 to ${C.PAIRS}`);
  }
  return which;
}

/** Three finite triangle corners, or undefined for the applet's opening triangle. */
function readV(args: Json): Point[] | undefined {
  const raw = args.V;
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error('argument "V" must be an array of exactly three points for the triangle');
  }
  return raw.map((p, i) => readPoint(p, `V[${i}]`));
}

/** A real core state from the tutor's optional corners and options. */
function buildState(C: Evelyn, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of triangle and option fields");
  }
  const { w, h } = readDims(C, args);
  return C.start({ w, h, V: readV(args), Ta: readTa(C, args), which: readWhich(C, args) });
}

/**
 * The whole construction measured by the core: the bisector feet, the up-to-six
 * circle chain, the tangency claims and what the seventh circle would do.
 */
function reading(C: Evelyn, s: State) {
  const g = C.geometry(s);
  const drawn = C.chain(s);
  const claims = C.claims(s);
  const extended = C.extend(s, C.PAIRS + 1);
  const seventh = extended.length > C.PAIRS ? extended[C.PAIRS] : null;

  const circles = drawn.map((c) => ({
    number: c.k + 1,
    corner: CORNERS[c.k % 3],
    center: pt(c),
    radius: num6(c.r),
    t: r6(c.t),
    d: r6(c.d),
    color: C.isRed(s.which, c.k) ? "red" : "pink",
  }));

  let seventhInfo: Record<string, unknown>;
  if (seventh) {
    const i = seventh.k % 3;
    const j = (i + 2) % 3;
    const u = C.footParameter(seventh, g.V[i], g.V[(i + 1) % 3]);
    const v = C.footParameter(seventh, g.V[i], g.V[j]);
    const closes = drawn.length > 0 && near(seventh.x, drawn[0].x) &&
      near(seventh.y, drawn[0].y) && near(seventh.r, drawn[0].r);
    const onSegments = u >= -1e-7 && u <= 1 + 1e-7 && v >= -1e-7 && v <= 1 + 1e-7;
    const past = Math.max(Math.max(0, -u), Math.max(0, u - 1), Math.max(0, -v), Math.max(0, v - 1));
    seventhInfo = {
      exists: true,
      center: pt(seventh),
      radius: num6(seventh.r),
      t: r6(seventh.t),
      corner: CORNERS[i],
      feet: { u: r6(u), v: r6(v), onSegments },
      closestFootOverflow: sig(past),
      closesOnFirst: closes,
      verdict: closes ? "closes on the first circle"
        : onSegments ? "a distinct circle touching both sides as segments"
          : "tangent to a side extension past the corner, not the side itself",
    };
  } else {
    seventhInfo = {
      exists: false,
      verdict: "no seventh circle fits (the quadratic has no root in [0, 1])",
    };
  }

  const allTangenciesHold = claims.finite && claims.touchesBothSides &&
    claims.neighboursTouch && claims.feetOnSides && claims.repeatsOrStops;

  return {
    board: { width: C.WIDTH, height: C.HEIGHT, maximumCircles: C.PAIRS },
    options: {
      w: s.w, h: s.h, Ta: s.Ta, which: s.which,
      colourMode: s.which === C.PAIRS ? "all red" : `pair ${s.which + 1}`,
    },
    triangle: { A: pt(g.V[0]), B: pt(g.V[1]), C: pt(g.V[2]) },
    bisectorFeet: g.L.map(pt),
    startCenter: pt(g.P),
    circles,
    circleCount: drawn.length,
    claims: {
      finite: claims.finite,
      touchesBothSides: claims.touchesBothSides,
      neighboursTouch: claims.neighboursTouch,
      feetOnSides: claims.feetOnSides,
      atMostSix: claims.atMostSix,
      closesAfterSix: claims.closesAfterSix,
      repeatsOrStops: claims.repeatsOrStops,
    },
    allTangenciesHold,
    seventh: seventhInfo,
  };
}

export function actions(): GameActions {
  return {
    six_circle_chain: {
      describe:
        "Build a triangle from three corners V (each [x, y] or { x, y }; omit for the applet's opening triangle), a starting parameter Ta in [0, 1] placing the first circle's centre on A's angle bisector, and a pair selection which from 0 to 6, then run the real Evelyn core. Reports the chain of up to six tangent circles (centre, radius, corner, quadratic parameter and red/pink colour), the three angle-bisector feet, and the core's checks that every circle touches its two sides and its neighbours and that the seventh is the first again or does not fit, so the chain never exceeds six. This is the triangle-only applet with a fixed bound of six; its sibling EvelynN grows an n-sided polygon and allows chains of up to 2n circles.",
      args: '{ "which": 6 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        return {
          ...r,
          note:
            "The six circles theorem says a chain of circles touching their neighbours and successive pairs of a triangle's sides has at most six members. With the first centre at P = A*Ta + (1 - Ta)*foot(A), every next centre is B + t*(foot(B) - B) with radius d*t, where t is a root in [0, 1] of the applet's tangency quadratic; after six steps the chain returns to that first circle (its parameter t = 1 - Ta). " +
            "Quirk kept from the applet: with a very large first circle the quadratic can have two roots in [0, 1] and Solve2 keeps the farther one, putting the seventh circle tangent to a side's extension beyond the corner instead of the side segment; the drawing loop still stops at six, so the bound holds where the circles touch the sides as segments. " +
            "This Evelyn applet is triangle-only; EvelynN is the separate sibling that grows an n-sided polygon and reports chains of up to 2n circles.",
        };
      },
    },

    seventh_circle: {
      describe:
        "Take the same optional triangle V, starting parameter Ta and pair which, then extend the real Evelyn core one step past its six drawn circles. Reports whether the seventh circle lands exactly on the first (the chain closes), whether it touches a side's extension past the corner rather than the side segment (the applet's Solve2 root quirk), or whether no seventh circle fits at all, together with its centre, radius, parameter and the two perpendicular feet on the corner's sides. Defaults to the narrow triangle (w = 120, h = 360, Ta = 0.1) that exhibits the side-extension root, unlike the closing chain at the opening position.",
      args: '{ "w": 120, "h": 360, "Ta": 0.1 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        return {
          options: r.options,
          triangle: r.triangle,
          drawnCircles: r.circleCount,
          firstCircle: r.circles[0] ?? null,
          seventh: r.seventh,
          closesAfterSix: r.claims.closesAfterSix,
          repeatsOrStops: r.claims.repeatsOrStops,
          note:
            "For a well-formed chain the seventh circle coincides with the first (parameter t = 1 - Ta), which is why six circles suffice. The old applet's quadratic solver keeps its first root, so when the first circle is oversized that root can put a centre past the bisector foot: the circle is tangent to the extension of a side rather than to the side segment itself, and its perpendicular foot falls outside [0, 1]. The drawing loop still paints at most six. " +
            "This triangle-only applet caps the chain at six; EvelynN is the sibling applet where an n-sided polygon can carry up to 2n circles.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved and re-measure that position with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Evelyn state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Evelyn position must be an object");
  }
  const C = core();
  let savedReadable = true;
  let saved: Json;
  let s: State;
  try {
    const w = num(state, "w", C.WIDTH);
    const h = num(state, "h", C.HEIGHT);
    if (w < 40 || w > 4000 || h < 40 || h > 4000) throw new Error('saved "w"/"h" out of range');
    const rawV = state.V;
    if (!Array.isArray(rawV) || rawV.length !== 3) throw new Error('saved "V" must be three points');
    const V = rawV.map((p, i) => readPoint(p, `saved V[${i}]`));
    const Ta = num(state, "Ta", C.DEFAULT_TA);
    if (Ta < 0 || Ta > 1) throw new Error('saved "Ta" out of range');
    const which = num(state, "which", C.DEFAULT_WHICH);
    if (!Number.isInteger(which) || which < 0 || which > C.PAIRS) throw new Error('saved "which" out of range');
    saved = { w, h, V: V.map((p) => ({ x: p.x, y: p.y })), Ta, which };
    s = C.start({ w, h, V, Ta, which });
  } catch (err) {
    savedReadable = false;
    saved = { ...state };
    s = C.start({});
  }

  const r = reading(C, s);
  const opening = C.start({ w: s.w, h: s.h });
  const movedCorners = CORNERS.filter((_, i) =>
    !near(s.V[i].x, opening.V[i].x) || !near(s.V[i].y, opening.V[i].y));

  return {
    ...state,
    stateVersion,
    savedReadable,
    saved,
    reconstruction: {
      w: s.w, h: s.h,
      V: s.V.map(pt),
      Ta: s.Ta,
      which: s.which,
      movedCorners,
      movedTa: !near(s.Ta, C.DEFAULT_TA),
      changedPair: s.which !== C.DEFAULT_WHICH,
    },
    reading: r,
    note: !savedReadable
      ? "The saved fields could not be read, so the applet's opening triangle is reconstructed; the core reading below comes from that opening position."
      : "Track.state saved the core's whole position: the board size, three triangle corners, the starting parameter Ta and the pair selection which. The core rebuilds the angle-bisector feet, the up-to-six circle chain and the tangency and seventh-circle checks from them. This is a demonstration rather than a game, so there is no win or loss and the tracker records exploration.",
  };
}
