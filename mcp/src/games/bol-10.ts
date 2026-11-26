/*
 * run_game_logic actions and saved-position reader for BOL10 (Archimedes'
 * Book of Lemmas, Proposition 10, as in Bogomolny's applet).
 *
 * TA and TB touch the circle at A and B. The secant TC cuts it at C and C2;
 * the chord BD is drawn through B parallel to TC, AD meets TC at E, and EH is
 * perpendicular to BD. The proposition says EH bisects BD: BH = HD. The proof
 * runs through equal tangent lengths, the power of T (ET·TF = TA²), equal
 * angles and an isosceles triangle EBD.
 *
 * Every number below comes from the game's real core
 * (bol-10/bol-10-core.js), copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module. Coordinates are board units
 * in the page's 400 x 300 viewBox, with y down.
 *
 * One caution the page makes explicit: the applet's own "other intersection"
 * routine works to about one pixel, so a secant that nearly touches the circle
 * gives an ill-conditioned chord. The core flags that case as `thin` and no
 * midpoint should be claimed from it.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bol-10"].Bol10Core as any;

type Point = { x: number; y: number };

const r2 = (v: number): number => Number(v.toFixed(2));
const r4 = (v: number): number => Number(v.toFixed(4));
const pt = (p: any): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r2(p.x), y: r2(p.y) } : null;
const deg = (radians: number): number | null =>
  Number.isFinite(radians) ? r4(radians * 180 / Math.PI) : null;
/** The core does not export its distance helper, so use the same formula here. */
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Accept the tutor's [x, y] and the page's saved { x, y } alike. */
function readPoint(value: unknown, label: string, fallback: Point): Point {
  if (value === undefined || value === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/**
 * Rebuild the core state from O (centre), Bo (radius point), T (outside the
 * circle) and C (on it). Missing points fall back to the opening picture.
 * C is projected onto the circle with withPoint(), exactly as the page does
 * when the player drags it, so a slightly off-circle argument is harmless.
 */
function makeState(source: Json): any {
  const C = core();
  const home = C.start({});
  const O = readPoint(source.O, "O", home.O);
  const T = readPoint(source.T, "T", home.T);
  let Bo: Point;
  let radius: number;
  if (source.radius !== undefined && source.radius !== null) {
    radius = num(source, "radius");
    if (radius <= 1e-9) throw new Error('"radius" must be positive');
    if (source.Bo === undefined || source.Bo === null) {
      Bo = { x: O.x - radius, y: O.y };
    } else {
      Bo = readPoint(source.Bo, "Bo", home.Bo);
      const d = dist(O, Bo);
      if (Math.abs(d - radius) > 1e-6 * Math.max(1, radius)) {
        throw new Error(
          `"radius" ${radius} disagrees with the distance from O to Bo (${Number(d.toFixed(6))}); ` +
          "the page keeps the radius point on the circle",
        );
      }
    }
  } else {
    Bo = readPoint(source.Bo, "Bo", home.Bo);
    radius = dist(O, Bo);
    if (radius <= 1e-9) throw new Error('"Bo" must be away from "O" to make a circle');
  }
  const Cpoint = readPoint(source.C, "C", home.C);
  const base = C.start({ points: { O, Bo, T, C: Cpoint, radius } });
  return C.withPoint(base, "C", Cpoint);
}

/** Explain a non-drawable figure, or the near-tangent numerical warning. */
function noteFor(reason: string | null, thin: boolean): string {
  if (reason === "radius") return "The radius is zero: move the radius point Bo away from the centre O.";
  if (reason === "tangent") return "T is on or inside the circle, so there are no two tangents to draw. Move T outside.";
  if (reason === "parallel") return "AD or AB is parallel to the secant TC, so E or F is at infinity. Move C or T.";
  if (thin) {
    return "The secant almost touches the circle: C and C2 (or B and D) are less than two units apart. " +
      "The applet's own Other() works to about one pixel, so BH, HD and the angles there are ill-conditioned; " +
      "drag C away from A and B before trusting the midpoint.";
  }
  return "The two tangents, the chord BD parallel to TC and the perpendicular EH are all well conditioned, " +
    "so the midpoint and angle identities are safe to read.";
}

function lengthsView(L: any) {
  return {
    TA: r4(L.TA), TB: r4(L.TB),
    ET: r4(L.ET), TF: r4(L.TF),
    EB: r4(L.EB), ED: r4(L.ED),
    BH: r4(L.BH), HD: r4(L.HD), BD: r4(L.BD),
  };
}

function anglesView(A: any) {
  return {
    TAB: deg(A.TAB), ABT: deg(A.ABT), ADB: deg(A.ADB), AET: deg(A.AET),
    TEB: deg(A.TEB), TBF: deg(A.TBF), EDB: deg(A.EDB), EBD: deg(A.EBD),
  };
}

/** The labelled points and the numbers the proposition is about. */
function figure(state: any) {
  const C = core();
  const m = C.measurements(state);
  const frame = {
    circle: { center: pt(m.O), radius: r2(m.radius), radiusPoint: pt(m.Bo) },
    T: pt(m.T), C: pt(m.C),
  };
  if (!m.valid) {
    return {
      valid: false,
      reason: m.reason,
      ...frame,
      note: noteFor(m.reason, false),
    };
  }
  return {
    valid: true,
    illConditioned: m.thin,
    ...frame,
    tangentPoints: { A: pt(m.A), B: pt(m.B) },
    secant: { C: pt(m.C), secondCutC2: pt(m.C2) },
    chord: { B: pt(m.B), D: pt(m.D), length: r2(m.lengths.BD) },
    E: pt(m.E), F: pt(m.F), H: pt(m.H),
    lengths: lengthsView(m.lengths),
    anglesDegrees: anglesView(m.angles),
    note: noteFor(null, m.thin),
  };
}

/** The core's checks, each paired with the numbers that produce it. */
function identities(state: any) {
  const C = core();
  const m = C.measurements(state);
  if (!m.valid) {
    return {
      valid: false,
      reason: m.reason,
      note: noteFor(m.reason, false),
    };
  }
  const cl = C.claims(state);
  const L = m.lengths, A = m.angles;
  const angles = anglesView(A);
  return {
    valid: true,
    illConditioned: m.thin,
    points: { D: pt(m.D), E: pt(m.E), H: pt(m.H) },
    midpoint: {
      BH: r4(L.BH), HD: r4(L.HD), difference: r4(Math.abs(L.BH - L.HD)),
      holds: cl.midpoint,
    },
    powerOfPoint: {
      ET_times_TF: r4(L.ET * L.TF), TA_squared: r4(L.TA * L.TA),
      TB_squared: r4(L.TB * L.TB),
      difference: r4(Math.abs(L.ET * L.TF - L.TA * L.TA)),
      holds: cl.powerOfPoint,
    },
    equalSides: { EB: r4(L.EB), ED: r4(L.ED), holds: cl.equalSides },
    baseAngles: { EDB: angles.EDB, EBD: angles.EBD, holds: cl.baseAngles },
    angleIdentities: {
      tangentChord: {
        TAB: angles.TAB, ADB: angles.ADB, ABT: angles.ABT,
        holds: cl.alternateSegment,
      },
      parallelAngle: { ADB: angles.ADB, AET: angles.AET, holds: cl.parallelAngle },
      similarTriangles: {
        TEB: angles.TEB, TBF: angles.TBF, TAB: angles.TAB,
        holds: cl.similarTriangles,
      },
      cyclicAEBT: cl.cyclic,
    },
    constructionChecks: {
      tangentLengths: cl.tangentLengths,
      pointsOnCircle: cl.pointsOnCircle,
      bdParallel: cl.bdParallel,
      perpendicular: cl.perpendicular,
    },
    note: noteFor(null, m.thin),
  };
}

export function actions(): GameActions {
  return {
    figure: {
      describe:
        "Build the BOL10 picture from a circle centre O, a radius point Bo, an outside point T and a point C on the circle; points are [x, y] or { x, y } in the page's 400 x 300 viewBox (y down) and missing ones fall back to the opening picture. C is projected onto the circle as dragging does. Report the tangency points A and B, the secant's second cut C2, the chord BD parallel to TC, E = AD ∩ TC, F = AB ∩ TC, and H = foot of the perpendicular from E to BD, with every named length and angle in degrees. A near-tangent secant is flagged as ill-conditioned; T on or inside the circle, or a parallel construction, reports valid = false with a reason.",
      args: '{ "O": [140, 150], "Bo": [70, 150], "T": [300, 120], "C": [190, 115] }',
      run: (args) => figure(makeState(args)),
    },

    lemma_checks: {
      describe:
        "For the same circle and outside point, verify Archimedes' Proposition 10 with the real core: H bisects BD (BH = HD), triangle EBD is isosceles (EB = ED and ∠EDB = ∠EBD), the power of T gives ET·TF = TA² = TB², and the angle chain ∠TAB = ∠ADB = ∠AET (with similar triangles and A, E, B, T concyclic). Every check is the core's own boolean alongside its measured lengths and angles. A secant almost tangent to the circle is flagged: the applet's one-pixel Other() cannot separate C from C2 there, so the claimed midpoint is unreliable.",
      args: '{ "O": [140, 150], "Bo": [70, 150], "T": [300, 120], "C": [190, 115] }',
      run: (args) => identities(makeState(args)),
    },
  };
}

/** The draggable points the page saved with Track.state, plus a fresh reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported BOL10 state version ${stateVersion}`);
  }
  const C = core();
  const s = makeState(state ?? ({} as Json));
  const saved = {
    O: pt(s.O), Bo: pt(s.Bo), T: pt(s.T), C: pt(s.C), radius: r4(s.radius),
  };
  const m = C.measurements(s);
  if (!m.valid) {
    return {
      stateVersion, saved, valid: false, reason: m.reason,
      note: noteFor(m.reason, false),
    };
  }
  const cl = C.claims(s);
  const L = m.lengths, A = m.angles;
  const angles = anglesView(A);
  return {
    stateVersion,
    saved,
    valid: true,
    illConditioned: m.thin,
    points: { A: pt(m.A), B: pt(m.B), C2: pt(m.C2), D: pt(m.D), E: pt(m.E), F: pt(m.F), H: pt(m.H) },
    lengths: lengthsView(L),
    midpoint: { BH: r4(L.BH), HD: r4(L.HD), difference: r4(Math.abs(L.BH - L.HD)), holds: cl.midpoint },
    powerOfPoint: {
      ET_times_TF: r4(L.ET * L.TF), TA_squared: r4(L.TA * L.TA), TB_squared: r4(L.TB * L.TB),
      holds: cl.powerOfPoint,
    },
    angleIdentities: {
      tangentChord: { TAB: angles.TAB, ADB: angles.ADB, holds: cl.alternateSegment },
      parallelAngle: { ADB: angles.ADB, AET: angles.AET, holds: cl.parallelAngle },
      baseAngles: { EDB: angles.EDB, EBD: angles.EBD, holds: cl.baseAngles },
      cyclicAEBT: cl.cyclic,
    },
    note: noteFor(null, m.thin),
  };
}
