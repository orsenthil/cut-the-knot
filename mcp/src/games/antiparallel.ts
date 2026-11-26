/*
 * run_game_logic actions and saved-position reader for Antiparallel.
 *
 * The real core is antiparallel/antiparallel-core.js (global AntiparallelCore),
 * copied into src/generated/cores/ at build time. Every number below comes
 * from it; coordinates are board units of the page's 400 x 300 viewBox, y down.
 * See _shared.ts for the module shape.
 *
 * The construction: P sits on the perpendicular bisector of AB, so its circle
 * passes through A and B. It cuts BC again at D and AC again at E. Because
 * A, B, D, E are concyclic, the line DE makes the same angle with AC that AB
 * makes with BC (the reversed pair DEC = ABC), and the same angle with BC that
 * AB makes with AC (EDC = BAC). That reversed order is "antiparallel" in the
 * angle at C. Reflecting D and E in the bisector at C — i.e. swapping their
 * distances from C — gives a chord parallel to AB: the symmetric parallel
 * case. If CA = CB the reflection just swaps D and E, so DE itself is parallel.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["antiparallel"].AntiparallelCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };

/** The subset of the core's compute() result the tutor reports. */
type Geometry = {
  A: Point; B: Point; C: Point; P: Point;
  circle: { c: Point; r: number };
  D: Point; E: Point; M: Point; foot: Point;
  height: number; tD: number; tE: number;
  angles: { atA: number; atB: number; atC: number; toSide: number; fromBase: number };
};

const TOL = 1e-6; // the equalities are exact; this is just floating-point noise
const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
const deg = (radians: number): number => round(radians * 180 / Math.PI, 3);
const sig = (v: number): number => Number(v.toExponential(2));
const pt = (p: Point): Point => ({ x: round(p.x, 2), y: round(p.y, 2) });

/** Tool arguments may be [x, y] or the page's { x, y }; both need finite numbers. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be a point [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" needs finite x and y`);
  return { x, y };
}

/** Options are read from an "options" object when present, else from the top level. */
function readOptions(C: Core, source: Json) {
  const defaults = C.start({}).options as Json;
  const o = source.options && typeof source.options === "object" && !Array.isArray(source.options)
    ? source.options as Json
    : source;
  const pick = (key: string): boolean => {
    const v = o[key];
    if (v === undefined || v === null) return defaults[key] === true;
    if (typeof v !== "boolean") throw new Error(`"${key}" must be true or false`);
    return v;
  };
  return { names: pick("names"), hint: pick("hint") };
}

/**
 * The page keeps all four handles inside the board and slides P onto the
 * perpendicular bisector of AB. A numeric radius instead places P at the
 * height h with h^2 + (AB/2)^2 = radius^2, so PA = PB = radius.
 */
function makeState(C: Core, source: Json) {
  const fresh = C.start({}) as Json;
  const A = C.clamp(readPoint(source.A ?? fresh.A, "A"));
  const B = C.clamp(readPoint(source.B ?? fresh.B, "B"));
  const Cc = C.clamp(readPoint(source.C ?? fresh.C, "C"));
  const rawP = readPoint(source.P ?? fresh.P, "P");
  let wanted: Point = rawP;
  if (source.radius !== undefined && source.radius !== null) {
    const radius = num(source, "radius");
    const half = C.dist(A, B) / 2;
    if (radius < half - TOL) {
      throw new Error(`"radius" must be at least AB/2 = ${round(half, 2)} for a circle through A and B`);
    }
    wanted = C.placeOnAxis(A, B, rawP, Math.sqrt(Math.max(0, radius * radius - half * half)));
  }
  const P = C.clamp(C.projectOnAxis(wanted, A, B));
  return { ...fresh, A, B, C: Cc, P, options: readOptions(C, source) };
}

/** Refuse the cases the page cannot draw (the core returns null there). */
function build(source: Json) {
  const C = core();
  const s = makeState(C, source);
  const g = C.geometry(s) as Geometry | null;
  if (!g) throw new Error("A, B and C must be three distinct points at least 2 board units apart for the circle to cut the sides");
  return { C, s, g };
}

/** The circle and its two extra cuts, with the cut parameters along the sides. */
function cuts(C: Core, g: Geometry) {
  return {
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    centre: pt(g.circle.c),
    radius: round(g.circle.r, 2),
    centreToA: round(C.dist(g.circle.c, g.A), 2),
    centreToB: round(C.dist(g.circle.c, g.B), 2),
    cutOnBC_D: pt(g.D),
    cutOnAC_E: pt(g.E),
    chordDE: { from: pt(g.D), to: pt(g.E) },
    cutParameters: {
      D_fromBtoC: round(g.tD, 4),
      E_fromAtoC: round(g.tE, 4),
      bothOnTheSides: g.tD > 0 && g.tD < 1 && g.tE > 0 && g.tE < 1,
    },
    centreDistanceAboveAB: round(g.height, 2),
    note:
      "The circle is centred on the perpendicular bisector of AB and has radius PA = PB. D is its second meeting with BC and E its second meeting with AC; a cut parameter outside 0..1 means that cut lies beyond a corner, on the extended side.",
  };
}

/** The two reversed angle equalities that make DE antiparallel to AB. */
function reversedAngles(C: Core, g: Geometry) {
  // The core's angles.toSide is lineAngle(DE, AC) = angle DEC; fromBase is
  // lineAngle(AB, BC) = angle ABC. The second pair uses DE with BC and angle A.
  const dec = g.angles.toSide;
  const abc = g.angles.fromBase;
  const edc = C.lineAngle(C.sub(g.E, g.D), C.sub(g.B, g.C));
  const bac = g.angles.atA;
  const pair = (left: number, right: number) => {
    const residual = Math.abs(left - right);
    return { residual: sig(residual), holds: residual < TOL };
  };
  return {
    triangleAnglesDegrees: {
      A: deg(g.angles.atA), B: deg(g.angles.atB), C: deg(g.angles.atC),
    },
    DEC_equals_ABC: {
      DEC: deg(dec), ABC: deg(abc), ...pair(dec, abc),
      meaning: "the chord DE meets side AC at the same angle as AB meets side BC",
    },
    EDC_equals_BAC: {
      EDC: deg(edc), BAC: deg(bac), ...pair(edc, bac),
      meaning: "the chord DE meets side BC at the same angle as AB meets side AC",
    },
    bothPairsHold: pair(dec, abc).holds && pair(edc, bac).holds,
    note:
      "Parallel lines give equal angles in the same positions; these match in the opposite order, which is exactly DE antiparallel to AB in the angle at C. Moving P slides D and E but keeps both equalities.",
  };
}

/** Cyclic quadrilateral ABDE and the inscribed angles standing on chord AB. */
function concyclicity(C: Core, g: Geometry) {
  const distances = {
    A: C.dist(g.circle.c, g.A), B: C.dist(g.circle.c, g.B),
    D: C.dist(g.circle.c, g.D), E: C.dist(g.circle.c, g.E),
  };
  const error = Math.max(...Object.values(distances).map((d) => Math.abs(d - g.circle.r)));
  const adb = C.angle(g.D, g.A, g.B);
  const aeb = C.angle(g.E, g.A, g.B);
  const inscribed = Math.min(Math.abs(adb - aeb), Math.abs(adb + aeb - Math.PI));
  return {
    distancesFromCentre: {
      A: round(distances.A, 2), B: round(distances.B, 2),
      D: round(distances.D, 2), E: round(distances.E, 2),
    },
    radius: round(g.circle.r, 2),
    largestCircleError: sig(error),
    concyclic: error < TOL,
    inscribedAnglesOnAB: {
      ADB: deg(adb), AEB: deg(aeb),
      residual: sig(inscribed), equalOrSupplementary: inscribed < TOL,
    },
    note:
      "A, B, D and E all lie on the one circle about P, so ABDE is a cyclic quadrilateral. Inscribed angles ADB and AEB stand on the same chord AB: they are equal when D and E are on the same arc and supplementary when the cuts fall on opposite arcs.",
  };
}

/** Isogonal reflection of DE in angle C: the symmetric, parallel case. */
function parallelCase(C: Core, g: Geometry) {
  const cd = C.dist(g.C, g.D);
  const ce = C.dist(g.C, g.E);
  const uCA = C.unit(C.sub(g.A, g.C));
  const uCB = C.unit(C.sub(g.B, g.C));
  // Reflect in the bisector at C: CA and CB swap, distances from C stay put.
  const reflectedD = C.add(g.C, C.mul(uCA, cd)); // on CA, at distance CD
  const reflectedE = C.add(g.C, C.mul(uCB, ce)); // on CB, at distance CE
  const parallelResidual = C.lineAngle(C.sub(reflectedE, reflectedD), C.sub(g.B, g.A));
  const sameOrderA = C.angle(reflectedD, g.C, reflectedE);
  const sameOrderB = C.angle(reflectedE, g.C, reflectedD);
  const refA = C.angle(g.A, g.C, g.B);
  const refB = C.angle(g.B, g.C, g.A);
  const isosceles = Math.abs(C.dist(g.C, g.A) - C.dist(g.C, g.B)) < TOL;
  const deResidual = C.lineAngle(C.sub(g.E, g.D), C.sub(g.B, g.A));
  return {
    reflectionOfD_onCA: pt(reflectedD),
    reflectionOfE_onCB: pt(reflectedE),
    angleOfReflectedChordWithAB: deg(parallelResidual),
    reflectedChordParallelToAB: parallelResidual < TOL,
    sameOrderEqualities: {
      reflectedAngleAtD: deg(sameOrderA), angleCAB: deg(refA),
      reflectedAngleAtE: deg(sameOrderB), angleCBA: deg(refB),
      residual: sig(Math.max(Math.abs(sameOrderA - refA), Math.abs(sameOrderB - refB))),
      holds: Math.abs(sameOrderA - refA) < TOL && Math.abs(sameOrderB - refB) < TOL,
    },
    triangleIsoscelesAtC: isosceles,
    angleOfDEWithAB: deg(deResidual),
    note:
      "Swapping D and E's distances from C reflects the antiparallel across the bisector of angle C and gives a chord parallel to AB, with its angles now in the same order (reflected angle at D equals angle CAB, at E equals angle CBA). When CA = CB the reflection merely swaps D and E, so the antiparallel itself becomes the ordinary parallel.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle A, B, C on the page's 400 x 300 board (y down) and the circle through A and B, report the circle's centre and radius, the second cuts D on BC and E on AC, where on the sides they fall, and the page's status line. Give P as [x, y] or {x, y}, or give a numeric radius instead and P is placed on the perpendicular bisector of AB at the height that makes PA = radius. Omit a point for the opening picture; P is slid onto the perpendicular bisector as the page does when dragged.",
      args: '{ "A": [95, 220], "B": [310, 220], "C": [200, 40], "radius": 111.60757 }',
      run: (args) => {
        const { C, s, g } = build(args);
        return {
          ...cuts(C, g),
          namesShown: s.options.names,
          equalAngleMarksShown: s.options.hint,
          status: C.describe(s),
        };
      },
    },
    antiparallel_checks: {
      describe:
        "For the same triangle and circle, check the theorem with the real core: the two reversed angle equalities proving DE antiparallel to AB (angle DEC = ABC and angle EDC = BAC, in degrees with residuals), that A, B, D, E lie on one circle with equal or supplementary inscribed angles on chord AB, and the symmetric parallel case — reflecting D and E in the bisector at C gives a chord parallel to AB (when CA = CB, DE itself is parallel). Accepts A, B, C, P (or radius) as in construction.",
      args: '{ "A": [95, 220], "B": [310, 220], "C": [200, 40], "P": [202.5, 190], "hint": true }',
      run: (args) => {
        const { C, g } = build(args);
        const reversed = reversedAngles(C, g);
        const cyclic = concyclicity(C, g);
        const parallel = parallelCase(C, g);
        return {
          ...reversed,
          concyclicity: cyclic,
          symmetricParallelCase: parallel,
          allClaimsHold: reversed.bothPairsHold && cyclic.concyclic &&
            cyclic.inscribedAnglesOnAB.equalOrSupplementary && parallel.reflectedChordParallelToAB,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Antiparallel state version ${stateVersion}`);
  }
  const C = core();
  const s = makeState(C, state);
  const g = C.geometry(s) as Geometry | null;
  const rawPoint = (value: unknown): Point | null => {
    try { return readPoint(value, "point"); } catch { return null; }
  };
  const ptOrNull = (value: unknown): Point | null => {
    const p = rawPoint(value);
    return p ? pt(p) : null;
  };
  const savedCircle = state.circle && typeof state.circle === "object" && !Array.isArray(state.circle)
    ? state.circle as Json
    : null;
  const saved = {
    A: ptOrNull(state.A) ?? pt(s.A), B: ptOrNull(state.B) ?? pt(s.B),
    C: ptOrNull(state.C) ?? pt(s.C), P: ptOrNull(state.P) ?? pt(s.P),
    D: ptOrNull(state.D), E: ptOrNull(state.E),
    circle: savedCircle
      ? { centre: ptOrNull(savedCircle.c),
          radius: Number.isFinite(Number(savedCircle.r)) ? Number(savedCircle.r) : null }
      : null,
    options: s.options,
  };
  let savedCutDeviation: { D: number; E: number } | null = null;
  const rawD = rawPoint(state.D), rawE = rawPoint(state.E);
  if (g && rawD && rawE) {
    savedCutDeviation = { D: round(C.dist(g.D, rawD), 3), E: round(C.dist(g.E, rawE), 3) };
  }
  return {
    stateVersion,
    ...saved,
    status: C.describe(s),
    valid: !!g,
    savedCutDeviation,
    reading: g
      ? {
          ...cuts(C, g),
          reversedAngleEqualities: reversedAngles(C, g),
          concyclicity: concyclicity(C, g),
          symmetricParallelCase: parallelCase(C, g),
        }
      : { note: "The saved points do not make a drawable triangle, so the circle and its cuts cannot be drawn." },
    note:
      "The saved triangle and centre are rebuilt with the same core the page draws with. D, E and the circle are the page's saved values; savedCutDeviation compares them with the cuts the core computes now.",
  };
}
