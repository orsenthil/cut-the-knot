/*
 * run_game_logic actions and saved-position reader for Fixed Point.
 *
 * The real core is fixed-point/fixed-point-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the applet's 500 x 400 canvas, y down.
 *
 * A line initially along AB is rotated about A, then C, then B. Those three
 * rotations add to a half-turn. Measured from A along AB, one trip sends a
 * point at coordinate x to 2*tA - x (the page's "b - x" with b = 2*tA), so the
 * fixed point solves x = b - x, x = tA: exactly where the incircle touches
 * AB. Two trips send x back to itself. The midpoint of AB is that point only
 * when CA = CB (true of the equilateral starting triangle), a quirk the page
 * calls out. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Tangents = {
  a: number; b: number; c: number;
  tA: number; tB: number; tC: number;
  touchAB: Pt;
};
type State = {
  A: Pt; B: Pt; C: Pt;
  pts: Pt[] | null;
  firstTime: boolean; addedC: boolean;
  phase: number; step: number; total: number;
  angle: number; orientation: number; trips: number;
};
type StageCfg = { pivot: string; angle: number; orientation: number; total: number };
type Core = {
  WIDTH: number; HEIGHT: number; IDLE: number; STAGES: string[];
  dist(a: Pt, b: Pt): number;
  midpoint(a: Pt, b: Pt): Pt;
  start(): State;
  eligible(p: Pt): boolean;
  valid(s: State): boolean;
  withVertex(s: State, name: string, p: Pt): State;
  foot(p: Pt, a: Pt, b: Pt): Pt;
  tangentLengths(A: Pt, B: Pt, Cc: Pt): Tangents;
  incenter(A: Pt, B: Pt, Cc: Pt): Pt;
  mapPoint(p: Pt, A: Pt, B: Pt, Cc: Pt): Pt;
  midpointIsFixed(A: Pt, B: Pt, Cc: Pt): boolean;
  stageConfig(s: State, phase: number): StageCfg;
  trip(s: State): State;
};

const core = (): Core => cores["fixed-point"].FixedPointCore as unknown as Core;

/* The core is exact up to floating point; only what we print is rounded. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x)!, y: r6(p.y)! } : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const numberOr = (raw: unknown, fallback: number): number =>
  raw !== undefined && raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : fallback;
const boolOr = (raw: unknown, fallback: boolean): boolean =>
  typeof raw === "boolean" ? raw : fallback;

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
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
    }
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** A fraction along AB; the page's own tests use 0 .. 1.5, so allow a little slack. */
function readFraction(args: Json, key: string, fallback: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < -1 || n > 2) {
    throw new Error(`argument "${key}" must be a number in [-1, 2], got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** Move the core's opening triangle onto the caller's corners, as the page's handles do. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C points and an optional fraction");
  }
  let s = C.start();
  for (const name of ["A", "B", "C"] as const) {
    const p = readPoint(args[name], name, s[name]);
    if (!C.eligible(p)) {
      throw new Error(
        `"${name}" is outside the ${C.WIDTH} x ${C.HEIGHT} board (x in (2, ${C.WIDTH}), y in (0, ${C.HEIGHT - 2}))`,
      );
    }
    s = C.withVertex(s, name, p);
  }
  if (!C.valid(s)) {
    throw new Error("A, B and C must form a proper, non-flat triangle with three different corners");
  }
  return s;
}

const pointOnLine = (a: Pt, b: Pt, f: number): Pt =>
  ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

/** Coordinate of q along AB in board units, with 0 at A and c at B. */
const along = (C: Core, q: Pt, a: Pt, b: Pt): number => {
  const ux = b.x - a.x, uy = b.y - a.y;
  return ((q.x - a.x) * ux + (q.y - a.y) * uy) / C.dist(a, b);
};

/** Everything the same core measures for a triangle, from tangent lengths to the half-turn. */
function reading(C: Core, s: State, f: number) {
  const { A, B, C: Cc } = s;
  const t = C.tangentLengths(A, B, Cc);
  const touch = t.touchAB;
  const centre = C.incenter(A, B, Cc);
  const inradius = C.dist(centre, C.foot(centre, A, B));
  const mid = C.midpoint(A, B);
  const P = pointOnLine(A, B, f);
  const image = C.mapPoint(P, A, B, Cc);
  const halfTurn = { x: 2 * touch.x - P.x, y: 2 * touch.y - P.y };
  const touchFixed = C.mapPoint(touch, A, B, Cc);
  // The direction of the line after one trip: mapPoint(A) -> mapPoint(B).
  const mA = C.mapPoint(A, A, B, Cc), mB = C.mapPoint(B, A, B, Cc);
  const u0 = { x: B.x - A.x, y: B.y - A.y };
  const u1 = { x: mB.x - mA.x, y: mB.y - mA.y };
  const dot = u0.x * u1.x + u0.y * u1.y;
  const cross = u0.x * u1.y - u0.y * u1.x;
  const tol = 1e-6 * Math.max(1, t.c);
  const x = along(C, P, A, B);
  const bConst = 2 * t.tA;
  const xAfter = along(C, image, A, B);
  const isoscelesAtC = near(t.b, t.a, tol);
  return {
    sides: { a_BC: r6(t.a), b_CA: r6(t.b), c_AB: r6(t.c) },
    tangentLengths: {
      tA: r6(t.tA), tB: r6(t.tB), tC: r6(t.tC),
      sumIsSemiperimeter: near(t.tA + t.tB + t.tC, (t.a + t.b + t.c) / 2, tol),
      touchOnAB: pt(touch),
      distanceFromA: r6(t.tA),
      distanceFromB: r6(t.tB),
    },
    incircle: { center: pt(centre), radius: r6(inradius) },
    fixedPoint: pt(touch),
    coordinate: {
      measuredFrom: "A along AB, in board units",
      x: r6(x),
      b: r6(bConst),
      bMinusX: r6(bConst - x),
      xAfterOneTrip: r6(xAfter),
      oneTripIsBMinusX: near(xAfter, bConst - x, tol),
      fixedPointCoordinate: r6(t.tA),
      fixedPointSolvesXEqualsBX: near(t.tA, bConst - t.tA, tol),
      note: 'The page\'s "b" is a coordinate constant, 2*tA when x is measured from A; it is not the side b = CA.',
    },
    halfTurn: {
      sample: pt(P),
      mapPoint: pt(image),
      halfTurnAboutTouch: pt(halfTurn),
      mapPointIsHalfTurn: C.dist(image, halfTurn) <= tol,
      touchStaysFixed: C.dist(touchFixed, touch) <= tol,
      degrees: 180,
    },
    direction: {
      before: pt(u0),
      after: pt(u1),
      dotProduct: r6(dot),
      crossProduct: sig(cross),
      reversed: dot < 0 && Math.abs(cross) <= tol * Math.max(1, t.c),
    },
    midpoint: {
      at: pt(mid),
      afterOneTrip: pt(C.mapPoint(mid, A, B, Cc)),
      isFixed: C.midpointIsFixed(A, B, Cc),
      fixedExactlyWhenCACB: C.midpointIsFixed(A, B, Cc) === isoscelesAtC,
    },
  };
}

export function actions(): GameActions {
  return {
    fixed_point: {
      describe:
        "For triangle corners A, B, C (each [x, y] or { x, y } on the applet's 500 x 400 board, y down; omit any to keep the opening triangle), find the fixed point of the rolling line and test the page's x -> b - x claim on a sample point. Report the incircle's touch point on AB, the tangent lengths and side lengths, the coordinate constant b = 2*tA, the sample's coordinate before and after one trip, whether the line's direction is reversed, and whether the midpoint of AB is fixed (only when CA = CB). Pass fraction in [-1, 2] to choose the sample along AB; default 0.25. A flat triangle or an off-board corner is refused.",
      args: '{"A":[355,200],"B":[200,286.6],"C":[200,113.4],"fraction":0.25}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const f = readFraction(args, "fraction", 0.25);
        const r = reading(C, s, f);
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          ...r,
          note:
            "One trip about A, then C, then B is a half-turn about the incircle's touch point on AB: a point at coordinate x along AB (from A) lands at b - x with b = 2*tA, so x = tA stays put and is that touch point. Two trips undo it exactly. The midpoint of AB is only that point when CA = CB, which the opening equilateral triangle satisfies but a dragged one need not. This is an illustration with no win or loss.",
        };
      },
    },

    two_trips: {
      describe:
        "Run the page's actual step-by-step rotation twice on the real core for the triangle A, B, C (defaults as in fixed_point), and report the tracked dots after each trip. After one trip the first three dots are the half-turn images of A, B and the midpoint of AB; after two trips they return to their starting places to within rounding, showing x -> b - x -> x. Also reports the stage step counts, the trip counter, and the applet's quirk that the marker for corner C joins only after the second rotation and so is not one of the dots being followed. Pass fraction in [-1, 2] to sample another point on AB; default 0.25.",
      args: '{"A":[355,200],"B":[200,286.6],"C":[200,113.4]}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const f = readFraction(args, "fraction", 0.25);
        const one = C.trip(s);
        const two = C.trip(one);
        const t = C.tangentLengths(s.A, s.B, s.C);
        const touch = t.touchAB;
        const mid = C.midpoint(s.A, s.B);
        const original = [s.A, s.B, mid];
        const halfTurnOf = (q: Pt): Pt => ({ x: 2 * touch.x - q.x, y: 2 * touch.y - q.y });
        const mapped = (q: Pt): Pt => C.mapPoint(q, s.A, s.B, s.C);
        const tol = 1e-6 * Math.max(1, t.c);
        const P = pointOnLine(s.A, s.B, f);
        const sampleOne = mapped(P), sampleTwo = mapped(sampleOne);
        const P1 = one.pts ?? [], P2 = two.pts ?? [];
        const originalDots = original.map((q, i) => ({
          index: i + 1,
          start: pt(q),
          afterOneTrip: pt(P1[i] ?? null),
          halfTurnExpected: pt(halfTurnOf(q)),
          oneTripIsHalfTurn: !!P1[i] && C.dist(P1[i], halfTurnOf(q)) <= tol,
          afterTwoTrips: pt(P2[i] ?? null),
          twoTripsRestore: !!P2[i] && C.dist(P2[i], q) <= tol,
        }));
        return {
          board: { width: C.WIDTH, height: C.HEIGHT },
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          fixedPoint: pt(touch),
          stages: [0, 1, 2].map((phase) => {
            const cfg = C.stageConfig(s, phase);
            return { pivot: cfg.pivot, stepCount: cfg.total, angleRadians: r6(cfg.angle) };
          }),
          trips: { afterFirst: one.trips, afterSecond: two.trips, idle: two.phase === C.IDLE },
          originalDots,
          lateCMarker: {
            afterOneTrip: pt(P1[3] ?? null),
            afterTwoTrips: pt(P2[3] ?? null),
          },
          samplePoint: {
            fraction: f,
            at: pt(P),
            afterOneTrip: pt(sampleOne),
            backAfterTwoTrips: pt(sampleTwo),
            oneTripIsHalfTurn: C.dist(sampleOne, halfTurnOf(P)) <= tol,
            twoTripsRestore: C.dist(sampleTwo, P) <= tol,
          },
          note:
            "The first three dots are A, B and the midpoint of AB: one trip carries each to the half-turn about the incircle's touch point (x -> b - x), and the second carries it back (b - (b - x) = x). The core adds its marker for C only after the rotation about C, so that fourth dot does not take part in the A and C turns and is not one of the dots the claim is about. This is an illustration: there is no win or loss.",
        };
      },
    },
  };
}

/** A state rebuilt from the fields Track.state saved, with safe fallbacks. */
function savedState(C: Core, state: Json): State {
  const seed = C.start();
  const A = readPoint(state.A, "A", seed.A);
  const B = readPoint(state.B, "B", seed.B);
  const Cc = readPoint(state.C, "C", seed.C);
  const ptsRaw = state.pts;
  return {
    A, B, C: Cc,
    pts: Array.isArray(ptsRaw)
      ? ptsRaw.map((p, i) => readPoint(p, `pts[${i}]`, seed.A))
      : null,
    firstTime: boolOr(state.firstTime, seed.firstTime),
    addedC: boolOr(state.addedC, seed.addedC),
    phase: numberOr(state.phase, seed.phase),
    step: numberOr(state.step, seed.step),
    total: numberOr(state.total, seed.total),
    angle: numberOr(state.angle, seed.angle),
    orientation: numberOr(state.orientation, seed.orientation),
    trips: numberOr(state.trips, seed.trips),
  };
}

function statusText(C: Core, s: State): string {
  if (!C.valid(s)) return "The three corners are in a straight line; move one so the triangle is not flat.";
  if (s.phase === 0) return "Turning the line around A.";
  if (s.phase === 1) return "Turning the line around C.";
  if (s.phase === 2) return "Turning the line around B.";
  if (s.trips <= 0) return "The line starts along AB; press Go to turn it around the triangle.";
  if (s.trips % 2 === 1) {
    const mid = C.midpoint(s.A, s.B);
    const moved = !!s.pts && !!s.pts[2] && C.dist(s.pts[2], mid) > 0.5;
    return "One trip: the line is back on AB but faces the other way, " +
      (moved ? "and the midpoint of AB moved." : "and the midpoint of AB stayed exactly where it was.");
  }
  return "Two trips: every point of the line is back where it started, even the midpoint of AB.";
}

/** Echo the fields Track.state saved and re-measure that triangle with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Fixed Point state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Fixed Point position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const valid = C.valid(s) && C.eligible(s.A) && C.eligible(s.B) && C.eligible(s.C);
  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid,
    reading: reading(C, s, 0.25),
    phase: s.phase,
    trips: s.trips,
    pointCount: s.pts ? s.pts.length : 0,
    status: statusText(C, s),
    note:
      "Track.state saved the three corners A, B, C, the tracked line dots, and the animation bookkeeping (phase, trips, step and the first-time and added-C flags). The core rebuilds the incircle's touch point on AB, which is the fixed point of the rolling line: one trip is the half-turn x -> b - x about it and two trips restore every point. The midpoint of AB is fixed only when CA = CB. This is an illustration with no win or loss; the tracker records exploration.",
  };
}
