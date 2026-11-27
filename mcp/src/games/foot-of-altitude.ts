/*
 * run_game_logic actions and saved-position reader for Foot Of Altitude.
 * The core lives in foot-of-altitude/ and is copied into src/generated/cores/
 * at build time. Every number below is measured by that core.
 *
 * The theorem: E and F are the feet of the perpendiculars from D to AC and AB,
 * so ∠AED = ∠AFD = 90° and A, E, D, F lie on the circle with diameter AD.
 * Then EF = AD·sin(∠EDF). As D slides along the line BC that angle is constant,
 * or (when the foot lies outside the side near an obtuse base angle) its
 * supplement — the sine is the same either way, so EF is least exactly when AD
 * is least, at the foot of the altitude from A. The page expressly rejects an
 * exception for obtuse base angles; the reader reports that case too.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["foot-of-altitude"].FootOfAltitudeCore;
type C = ReturnType<typeof core>;
type Point = { x: number; y: number };

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const deg = (rad: number) => r3(rad * 180 / Math.PI);
const sig = (v: number) => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const xy = (p: Point) => ({ x: r3(p.x), y: r3(p.y) });
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

/** Accept [x, y] or { x, y }: the page saves objects, JSON args use pairs. */
function pointArg(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${key}" is not a finite point`);
    return { x, y };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
  const o = raw as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

/** The real core's start(), with validated corners and the page's three switches. */
function readState(Core: C, args: Json) {
  const seed = Core.start({});
  const s = Core.start({
    A: pointArg(args, "A", seed.A),
    B: pointArg(args, "B", seed.B),
    C: pointArg(args, "C", seed.C),
    D: pointArg(args, "D", seed.D),
    showNames: args.showNames !== false,
    showPremise: args.showPremise === true,
    showHint: args.showHint === true,
  });
  return {
    ...s,
    moves: Math.round(num(args, "moves", 0)),
    explored: args.explored === true,
  };
}

/** A genuine triangle, with D on the line BC as the applet's Fix(2) requires. */
function baseState(Core: C, args: Json) {
  const s = readState(Core, args);
  if (Math.abs(Core.twiceArea(s.A, s.B, s.C)) < 1e-9) {
    throw new Error("A, B and C must be distinct, non-collinear points on the 400 x 250 board");
  }
  const d = Core.nearestPoint(s.D, s.B, s.C);
  if (!Core.finite(d)) throw new Error("B and C must be distinct points");
  return { ...s, D: Core.clampPoint(d) };
}

/** Angle at v only when both rays have a length, as angleAt itself assumes. */
function safeAngle(Core: C, v: Point, p: Point, q: Point): number | null {
  return Core.dist(v, p) > 1e-9 && Core.dist(v, q) > 1e-9 ? Core.angleAt(v, p, q) : null;
}

/** The core's geometry, turned into the claims the page's math section makes. */
function reading(Core: C, s: any) {
  const g = Core.compute(s) as any;
  if (g.degenerate) {
    return { degenerate: true, note: "The saved corners are collinear, so there is no triangle to measure." };
  }
  const ad0 = Core.dist(s.A, g.D0);
  const sine = Math.sin(g.angle), sine0 = Math.sin(g.angle0);
  const circle = g.circle as { center: Point; radius: number } | null;
  const midAD = { x: (s.A.x + s.D.x) / 2, y: (s.A.y + s.D.y) / 2 };
  const circleIsDiameterAD = !!circle
    && near(Core.dist(circle.center, midAD), 0, 1e-6)
    && near(circle.radius, g.ad / 2, 1e-6);
  const angleAED = safeAngle(Core, g.E, s.A, s.D);
  const angleAFD = safeAngle(Core, g.F, s.A, s.D);
  const angleAtFoot = safeAngle(Core, g.D0, s.A, s.B);
  const degenerateFeet = Core.dist(g.E, s.D) < 1e-7 || Core.dist(g.F, s.D) < 1e-7
    || Core.dist(g.E, g.F) < 1e-7;
  const bc = Core.sub(s.C, s.B);
  const bc2 = Core.dot(bc, bc);
  const t = bc2 > 0 ? Core.dot(Core.sub(g.D0, s.B), bc) / bc2 : NaN;
  const supplementary = near(g.angle + g.angle0, Math.PI, 1e-6);
  const sinesEqual = near(sine, sine0, 1e-9);
  return {
    degenerate: false,
    points: {
      E: xy(g.E), F: xy(g.F), footOfAltitude: xy(g.D0),
      EAtFoot: xy(g.E0), FAtFoot: xy(g.F0),
    },
    lengths: {
      EF: r3(g.ef), shortestEF: r3(g.minLength), AD: r3(g.ad), ADAtFoot: r3(ad0),
      EFAboveMinimum: sig(g.ef - g.minLength), ADAboveMinimum: sig(g.ad - ad0),
    },
    angleEDF: {
      degrees: deg(g.angle), atFootDegrees: deg(g.angle0),
      sine: r3(sine), sineAtFoot: r3(sine0),
      constant: near(g.angle, g.angle0), supplementaryToFootAngle: supplementary,
      sinesAgree: sinesEqual,
    },
    identity: {
      ADtimesSinAngle: r3(g.ad * sine), EF: r3(g.ef),
      residual: degenerateFeet ? null : sig(g.ef - g.ad * sine),
      holds: degenerateFeet ? null : near(g.ef, g.ad * sine),
    },
    circleWithDiameterAD: circle
      ? { center: xy(circle.center), radius: r3(circle.radius), isCircleOnADAsDiameter: circleIsDiameterAD }
      : null,
    rightAngles: {
      AEDDegrees: angleAED === null ? null : deg(angleAED),
      AFDDegrees: angleAFD === null ? null : deg(angleAFD),
      altitudeFootWithABDegrees: angleAtFoot === null ? null : deg(angleAtFoot),
      bothPerpendicularsRight: angleAED !== null && angleAFD !== null
        && near(angleAED, Math.PI / 2) && near(angleAFD, Math.PI / 2),
    },
    footOnSideBC: { parameterT: r3(t), insideSegment: t >= -1e-9 && t <= 1 + 1e-9 },
    shortestEFAtFoot: g.finished,
    atMinimumLength: near(g.ef, g.minLength),
    finished: g.finished,
    result: Core.result(s),
    note:
      "Both perpendiculars give right angles, so A, E, D, F lie on a circle with diameter AD and EF = AD·sin(∠EDF). The angle at D is either unchanged as D slides along BC or becomes its supplement, whose sine is the same; hence EF is shortest when AD is shortest, at the altitude foot — even when that foot lies past B or C, the obtuse case the page refuses to except.",
  };
}

export function actions(): GameActions {
  return {
    measure: {
      describe:
        "For triangle A, B, C and a point D on the base line BC (each [x, y] or {x, y} on the page's 400 x 250 board), measure E and F, the current EF and the shortest EF at the altitude foot, AD and AD at the foot, ∠EDF, and check EF = AD·sin(∠EDF). Also reports the circle on AD as diameter, the right angles at E, F and the foot, whether the foot lies inside side BC, and the page's finish test. Points are clamped to the board and D is projected onto line BC as the applet does; no exception is made when a base angle is obtuse.",
      args: '{ "A": [224.22, 50], "B": [66.67, 208.33], "C": [333.33, 208.33], "D": [200, 208.33] }',
      run: (args) => {
        const Core = core();
        const s = baseState(Core, args);
        const read = reading(Core, s);
        if (read.degenerate) throw new Error("A, B and C must be distinct, non-collinear points on the 400 x 250 board");
        return {
          triangle: { A: xy(s.A), B: xy(s.B), C: xy(s.C) },
          D: xy(s.D),
          options: {
            showNames: s.showNames, showPremise: s.showPremise, showHint: s.showHint,
          },
          ...read,
        };
      },
    },
    slide: {
      describe:
        "Slide D along the line BC for a list of fractions t (t = 0 at B, 1 at C, values outside that range go past the side) and report EF, AD, ∠EDF, AD·sin(∠EDF) and the gap to the minimum at each stop; with no fractions, sample the opening side, the altitude foot and a point past C; the foot is always added as a stop. Checks that the identity holds at every usable stop and that no stop beats the altitude foot, including when the foot lies outside BC and the angle turns into its supplement — the page's no-obtuse-exception case.",
      args: '{ "A": [300, 50], "B": [60, 208], "C": [200, 208], "fractions": [0.25, 0.5, 1.25, 1.5] }',
      run: (args) => {
        const Core = core();
        const s = baseState(Core, args);
        const g0 = Core.compute(s) as any;
        if (g0.degenerate) throw new Error("A, B and C must be distinct, non-collinear points on the 400 x 250 board");
        const bc = Core.sub(s.C, s.B);
        const t0 = Core.dot(Core.sub(g0.D0, s.B), bc) / Core.dot(bc, bc);
        const key = args.fractions !== undefined && args.fractions !== null ? "fractions" : "ts";
        const supplied = args[key];
        const fractions = supplied === undefined || supplied === null
          ? [0.25, 0.5, 1.25, r3(t0), 1.5]
          : numArray(args, key);
        if (!fractions.length) throw new Error('argument "fractions" must contain at least one number');
        if (fractions.length > 24) throw new Error('argument "fractions" may contain at most 24 numbers');
        // Always include the foot itself, so the minimum can be seen at a stop.
        const stops = fractions.some((t) => near(t, t0, 1e-3)) ? fractions.slice() : [...fractions, t0];
        const samples = stops.map((t) => {
          const raw = { x: s.B.x + t * bc.x, y: s.B.y + t * bc.y };
          const D = Core.clampPoint(raw);
          const legal = Core.move(s, { type: "point", name: "D", point: D });
          const g = Core.compute(legal || { ...s, D }) as any;
          const degenerateFeet = Core.dist(g.E, D) < 1e-7 || Core.dist(g.F, D) < 1e-7
            || Core.dist(g.E, g.F) < 1e-7;
          return {
            t: r3(t), D: xy(D), EF: r3(g.ef), AD: r3(g.ad),
            angleDegrees: deg(g.angle), ADtimesSinAngle: r3(g.ad * Math.sin(g.angle)),
            identityResidual: degenerateFeet ? null : sig(g.ef - g.ad * Math.sin(g.angle)),
            aboveShortestEF: sig(g.ef - g0.minLength),
            atFoot: g.finished, placeableByPage: !!legal,
          };
        });
        const checked = samples.filter((row) => row.identityResidual !== null);
        const bestEF = Math.min(...samples.map((row) => row.EF));
        return {
          triangle: { A: xy(s.A), B: xy(s.B), C: xy(s.C) },
          altitudeFoot: xy(g0.D0),
          footParameterT: r3(t0),
          footInsideSideBC: t0 >= -1e-9 && t0 <= 1 + 1e-9,
          shortestEF: r3(g0.minLength),
          angleAtFootDegrees: deg(g0.angle0),
          samples,
          checks: {
            identityHoldsWhereDefined: checked.length > 0
              && checked.every((row) => Math.abs(row.identityResidual as number) < 1e-6),
            rowsChecked: checked.length,
            noSampleBeatsFoot: samples.every((row) => row.EF >= g0.minLength - 1e-3),
            leastSampleIsAtFoot: near(bestEF, g0.minLength, 1e-3),
          },
          note:
            "D may be slid past B and C (the applet's Fix(2) keeps its y). When the foot is outside the side, ∠EDF can become the supplement of its value at the foot, but the sine is unchanged, so EF = AD·sin(∠EDF) is still least at the altitude foot. The page rejects Honsberger's obtuse-angle exception.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, read through the same core. */
export function position(state: Json, stateVersion: number): unknown {
  const Core = core();
  const savedState = readState(Core, state);
  const s = baseState(Core, state);
  const saved = {
    stateVersion,
    A: xy(savedState.A), B: xy(savedState.B), C: xy(savedState.C), D: xy(savedState.D),
    showNames: savedState.showNames,
    showPremise: savedState.showPremise,
    showHint: savedState.showHint,
    moves: savedState.moves,
    explored: savedState.explored,
  };
  const read = reading(Core, s);
  if (read.degenerate) return { ...saved, degenerate: true, note: read.note };
  return {
    ...saved,
    DOnBaseLine: xy(s.D),
    ...read,
    note:
      "The saved triangle and sliding point are measured with the same projections, circle and finish test the page draws from. The identity and the shortest length come from the core, not from the saved text: EF = AD·sin(∠EDF) is least at the altitude foot, with no obtuse-angle exception.",
  };
}
