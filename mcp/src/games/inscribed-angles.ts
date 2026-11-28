/*
 * run_game_logic actions and saved-position reader for Inscribed Angles.
 *
 * Four handles A, B, C, D sit near the circle the picture always draws through
 * A, C and D. CD is a chord and ∠CAD, ∠CBD are inscribed angles on it. Euclid
 * III.21 says they are equal when A and B are on the same arc of CD; on the
 * other arc they are supplementary, which is the same statement in directed
 * angles modulo 180° — (AC, AD) = (BC, BD) exactly when the four points are
 * concyclic and the angles are similarly oriented. Directed angles also add:
 * (AC, AD) = (AC, AB) + (AB, AD) modulo 180°.
 *
 * The old Java applet did not reduce modulo 180°: it compared the signed
 * representatives and called the picture Equal only when B was within 2 board
 * units of the circle through A, C and D *and* those representatives differed
 * by less than 0.1 radian. It also left the Equal flag untouched when B left
 * the circle. Every number below comes from the game's real core,
 * inscribed-angles/inscribed-angles-core.js, copied into src/generated/cores/
 * at build time, so these two cutoffs and the stale flag are exact. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = (): any => (cores as any)["inscribed-angles"].InscribedAnglesCore;

type Point = { x: number; y: number };

const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const r4 = (v: number): number => Math.round(v * 10000) / 10000;
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const xy = (p: any): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;

/** [x, y] or { x, y }, with finite coordinates; the page saves objects. */
function readPoint(v: unknown, label: string, fallback?: Point): Point {
  if (v === undefined || v === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
      throw new Error(`"${label}" needs both x and y`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** The core's opening picture, with any supplied handles dragged into place. */
function scene(C: any, args: Json): any {
  let s = C.start({
    showNames: readBool(args, "showNames", false),
    hint: readBool(args, "hint", false),
  });
  for (const name of ["A", "C", "D", "B"]) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.move(s, name, readPoint(args[name], name));
    }
  }
  return s;
}

/** Put B on the circle through A, C and D on a chosen arc of the chord CD. */
function placeB(C: any, s: any, arc: "same" | "other"): any {
  const circle = C.circleThrough(s.A, s.C, s.D);
  if (!Number.isFinite(circle.r) || !Number.isFinite(circle.c.x) || !Number.isFinite(circle.c.y)) {
    throw new Error("A, C and D are nearly collinear, so they define no usable circle");
  }
  const sideA = C.orientation(s.C, s.D, s.A);
  const base = Math.atan2(s.A.y - circle.c.y, s.A.x - circle.c.x);
  let best: Point | null = null;
  let bestGap = Infinity;
  for (let i = 0; i < 96; i++) {
    const t = base + (i / 96) * 2 * Math.PI;
    const p = C.pointOnCircle(circle.c, circle.r, t);
    if ((C.orientation(s.C, s.D, p) === sideA) !== (arc === "same")) continue;
    if (C.dist(p, s.A) < 12 || C.dist(p, s.C) < 12 || C.dist(p, s.D) < 12) continue;
    const gap = Math.abs(Math.atan2(Math.sin(t - base), Math.cos(t - base)));
    if (gap < bestGap) { bestGap = gap; best = p; }
  }
  if (!best) throw new Error(`could not place B on the ${arc} arc of chord CD`);
  return C.move(s, "B", best);
}

/** The applet's own reading of one picture, in degrees and radians. */
function reading(C: any, s: any, label?: string) {
  const m = s.measured || C.measure(s);
  const valid = Number.isFinite(m.circle.r) && Number.isFinite(m.circle.c.x) &&
    Number.isFinite(m.difference);
  const sameSide = C.orientation(s.C, s.D, s.A) === C.orientation(s.C, s.D, s.B);
  const sumDeg = C.deg(m.angleCAD + m.angleCBD);
  return {
    ...(label ? { case: label } : {}),
    A: xy(s.A), B: xy(s.B), C: xy(s.C), D: xy(s.D),
    circle: valid ? { center: xy(m.circle.c), radius: r4(m.circle.r) } : null,
    onCircle: !!m.onCircle,
    distanceToCircle: r4(m.distanceToCircle),
    signedCADRadians: r6(m.signedCAD),
    signedCBDRadians: r6(m.signedCBD),
    differenceRadians: r6(m.difference),
    angleCADDegrees: r3(C.deg(m.angleCAD)),
    angleCBDDegrees: r3(C.deg(m.angleCBD)),
    sumDegrees: r3(sumDeg),
    sameSideOfChordCD: sameSide,
    equalFlag: !!s.equal, // applet's flag: deliberately stale while B is off the circle
    equalTest: !!m.equal, // the fresh test the applet runs while B is on it
    staleEqual: !m.onCircle && !!s.equal !== !!m.equal,
    tolerances: { onCircleUnits: C.ON_CIRCLE_TOL, equalRadians: C.EQUAL_TOL },
    euclid: !valid || !m.onCircle ? null : sameSide
      ? { arc: "same", anglesEqual: Math.abs(m.angleCAD - m.angleCBD) < 1e-9 }
      : { arc: "other", anglesSupplementary: Math.abs(sumDeg - 180) < 1e-6 },
    status: C.describe(s),
  };
}

/** Directed angles are modulo 180°; report the distance to the nearest multiple. */
const modPi = (x: number): number => ((x % Math.PI) + Math.PI) % Math.PI;
const modPiResidual = (x: number): number => {
  const d = modPi(x);
  return Math.min(d, Math.PI - d);
};

export function actions(): GameActions {
  return {
    arc_angles: {
      describe:
        "Starting from the applet's opening picture (or the A, C and D you supply as [x, y] or {x, y}), put B on the circle through A, C and D first on A's arc of chord CD and then on the other arc, and compare the inscribed angles ∠CAD and ∠CBD. Euclid III.21 makes them equal on A's arc and supplementary on the other; a third case pulls B 2.1 units off the circle to show that the applet's Equal flag (2-unit circle test, 0.1-radian angle test) goes stale. Give B explicitly to measure one point instead, and showNames or hint to set the two boxes.",
      args: '{}',
      run: (args) => {
        const C = core();
        const s0 = scene(C, args);
        if (args.B !== undefined && args.B !== null) {
          return {
            note: "One picture measured with the core: Equal is the applet's stale-preserving flag, equalTest is its fresh on-circle test.",
            tolerances: { onCircleUnits: C.ON_CIRCLE_TOL, equalRadians: C.EQUAL_TOL },
            point: reading(C, s0, "given B"),
          };
        }
        const same = placeB(C, s0, "same");
        const other = placeB(C, same, "other");
        const circle = same.measured.circle;
        const atB = Math.atan2(same.B.y - circle.c.y, same.B.x - circle.c.x);
        const off = C.move(same, "B",
          C.pointOnCircle(circle.c, circle.r + C.ON_CIRCLE_TOL + 0.1, atB));
        return {
          note: "Same arc: ∠CAD = ∠CBD (Euclid III.21). Other arc: they add to 180°, but the applet compares signed representatives, not angles modulo 180°, so Equal is false. Off circle: B is 2.1 units away, beyond the 2-unit cutoff, and the old Equal value is kept.",
          sameArc: reading(C, same),
          otherArc: reading(C, other),
          offCircle: reading(C, off),
          comparison: {
            sameArcEqual: same.measured.equal,
            otherArcEqual: other.measured.equal,
            otherArcSumDegrees: r3(C.deg(other.measured.angleCAD + other.measured.angleCBD)),
            offCircleBeyondTwoUnits: off.measured.distanceToCircle > C.ON_CIRCLE_TOL,
            offCircleKeepsOldEqual: off.equal === true && off.measured.equal === false && !off.onCircle,
          },
        };
      },
    },
    directed_check: {
      describe:
        "Test the directed-angle converse and addition law at one point B. Give B as [x, y] or {x, y}, or give radiusFactor (1 puts B on the circle through A, C and D; 0.8 puts it inside) and an optional angleDegrees for its direction from the centre; A, C and D may also be supplied. The core's signed angles should satisfy (AC, AD) = (BC, BD) modulo 180° exactly on the circle and (AC, AD) = (AC, AB) + (AB, AD) modulo 180° at A; the applet's Equal test is reported separately with its 0.1-radian and 2-unit tolerances.",
      args: '{ "radiusFactor": 0.8, "angleDegrees": 30 }',
      run: (args) => {
        const C = core();
        let s = scene(C, args);
        const explicitB = args.B !== undefined && args.B !== null;
        if (explicitB && (args.radiusFactor !== undefined || args.angleDegrees !== undefined)) {
          throw new Error('give "B" or "radiusFactor"/"angleDegrees", not both');
        }
        if (!explicitB) {
          const factor = args.radiusFactor === undefined ? 1 : num(args, "radiusFactor");
          if (!(factor > 0 && factor <= 3)) {
            throw new Error('argument "radiusFactor" must be greater than 0 and at most 3');
          }
          let degrees = 0;
          if (args.angleDegrees !== undefined && args.angleDegrees !== null) {
            degrees = num(args, "angleDegrees");
            if (Math.abs(degrees) > 3600) {
              throw new Error('argument "angleDegrees" must lie between -3600 and 3600');
            }
          }
          s = placeB(C, s, "same");
          const circle = C.circleThrough(s.A, s.C, s.D);
          if ((args.angleDegrees !== undefined && args.angleDegrees !== null) || factor !== 1) {
            const t = (args.angleDegrees !== undefined && args.angleDegrees !== null)
              ? (degrees * Math.PI) / 180
              : Math.atan2(s.B.y - circle.c.y, s.B.x - circle.c.x);
            s = C.move(s, "B", C.pointOnCircle(circle.c, circle.r * factor, t));
          }
        }
        const m = s.measured || C.measure(s);
        const difference = m.signedCAD - m.signedCBD;
        const residual = modPiResidual(difference);
        const sameSide = C.orientation(s.C, s.D, s.A) === C.orientation(s.C, s.D, s.B);
        const degenerate = C.dist(s.B, s.A) < 12 || C.dist(s.B, s.C) < 12 ||
          C.dist(s.B, s.D) < 12;
        const alpha = C.signedAngle(s.A, s.C, s.B); // (AC, AB)
        const beta = C.signedAngle(s.A, s.B, s.D);  // (AB, AD)
        const gamma = C.signedAngle(s.A, s.C, s.D); // (AC, AD)
        const addResidual = modPiResidual(gamma - alpha - beta);
        const equalModPi = residual < 1e-7;
        const onCircleExactly = Math.abs(m.distanceToCircle) < 1e-7;
        return {
          B: xy(s.B), A: xy(s.A), C: xy(s.C), D: xy(s.D),
          circle: Number.isFinite(m.circle.r)
            ? { center: xy(m.circle.c), radius: r4(m.circle.r) } : null,
          distanceToCircle: r4(m.distanceToCircle),
          onCircleApplet: !!m.onCircle,
          onCircleExactly,
          signedCADRadians: r6(m.signedCAD),
          signedCBDRadians: r6(m.signedCBD),
          differenceModPiRadians: r6(residual),
          differenceModPiDegrees: r3(C.deg(residual)),
          similarlyOriented: sameSide,
          directedAnglesEqualModPi: equalModPi,
          converseAgrees: degenerate ? null : equalModPi === onCircleExactly,
          equalFlag: !!s.equal,
          equalTest: !!m.equal,
          staleEqual: !m.onCircle && !!s.equal !== !!m.equal,
          tolerances: { onCircleUnits: C.ON_CIRCLE_TOL, equalRadians: C.EQUAL_TOL },
          additivity: {
            AC_AD: r6(modPi(gamma)),
            AC_AB: r6(modPi(alpha)),
            AB_AD: r6(modPi(beta)),
            residualRadians: r6(addResidual),
            holds: degenerate ? null : addResidual < 1e-7,
            note: "The core's signed angles are representatives of directed angles modulo 180°, so (AC, AD) = (AC, AB) + (AB, AD) at vertex A.",
          },
          status: C.describe(s),
          note: equalModPi
            ? sameSide
              ? "A and B are similarly oriented on the circle through A, C and D: (AC, AD) = (BC, BD) modulo 180°."
              : "A and B are on opposite arcs: the directed angles are still equal modulo 180°, but their representatives differ by 180°, which is why the applet's Equal test says no."
            : `B is ${r4(m.distanceToCircle)} units from the circle through A, C and D, so (AC, AD) and (BC, BD) differ by ${r3(C.deg(residual))}°: the converse holds.`,
        };
      },
    },
  };
}

/** Echo the fields the page saved, then re-measure them with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const home = C.start({});
  const A = readPoint(state.A, "A", home.A);
  const B = readPoint(state.B, "B", home.B);
  const Cc = readPoint(state.C, "C", home.C);
  const D = readPoint(state.D, "D", home.D);
  const options = state.options && typeof state.options === "object"
    ? state.options as Json : {};
  const s = C.refresh({
    A, B, C: Cc, D,
    showNames: options.showNames === true,
    hint: options.hint === true,
    explored: true,
    equal: state.equal === true,
  });
  const m = s.measured;
  const r = reading(C, s);

  const circleSaved = state.circle && typeof state.circle === "object"
    ? state.circle as Json : null;
  let savedCenter: Point | null = null;
  try { if (circleSaved) savedCenter = readPoint(circleSaved.c, "circle.c"); } catch { /* absent */ }
  const savedRadius = circleSaved ? Number(circleSaved.r) : NaN;
  const angles = state.angles && typeof state.angles === "object"
    ? state.angles as Json : null;
  const savedCAD = angles ? Number(angles.CAD) : NaN;
  const savedCBD = angles ? Number(angles.CBD) : NaN;

  return {
    stateVersion,
    saved: {
      A: xy(A), B: xy(B), C: xy(Cc), D: xy(D),
      circle: savedCenter
        ? { center: xy(savedCenter), radius: Number.isFinite(savedRadius) ? r4(savedRadius) : null }
        : null,
      onCircle: typeof state.onCircle === "boolean" ? state.onCircle : null,
      equal: typeof state.equal === "boolean" ? state.equal : null,
      angles: {
        CAD: Number.isFinite(savedCAD) ? r6(savedCAD) : null,
        CBD: Number.isFinite(savedCBD) ? r6(savedCBD) : null,
      },
      options: { showNames: options.showNames === true, hint: options.hint === true },
    },
    coreReading: {
      circle: r.circle,
      onCircle: r.onCircle,
      distanceToCircle: r.distanceToCircle,
      signedCADRadians: r.signedCADRadians,
      signedCBDRadians: r.signedCBDRadians,
      differenceRadians: r.differenceRadians,
      angleCADDegrees: r.angleCADDegrees,
      angleCBDDegrees: r.angleCBDDegrees,
      sumDegrees: r.sumDegrees,
      sameSideOfChordCD: r.sameSideOfChordCD,
      equalFlag: r.equalFlag,
      equalTest: r.equalTest,
      staleEqual: r.staleEqual,
      tolerances: r.tolerances,
      euclid: r.euclid,
      status: r.status,
    },
    savedVsCore: {
      circleCenterDistance: savedCenter && Number.isFinite(m.circle.c.x)
        ? r4(C.dist(savedCenter, m.circle.c)) : null,
      circleRadiusDifference: Number.isFinite(savedRadius) && Number.isFinite(m.circle.r)
        ? r6(savedRadius - m.circle.r) : null,
      angleCADDifference: Number.isFinite(savedCAD) ? r6(savedCAD - m.angleCAD) : null,
      angleCBDDifference: Number.isFinite(savedCBD) ? r6(savedCBD - m.angleCBD) : null,
      onCircleMatches: typeof state.onCircle === "boolean" ? state.onCircle === m.onCircle : null,
      equalMatchesTest: m.onCircle && typeof state.equal === "boolean"
        ? state.equal === m.equal : null,
    },
    note: r.circle === null
      ? "A, C and D are nearly collinear, so the core has no usable circle through them."
      : m.onCircle && r.sameSideOfChordCD
        ? "B is on the circle on A's arc of CD: ∠CAD = ∠CBD (Euclid III.21), which is what the applet's Equal test reports."
        : m.onCircle
          ? "B is on the circle but on the other arc of CD: the two angles are supplementary, so the applet's Equal test says no."
          : `B is ${r.distanceToCircle} units off the circle through A, C and D, beyond the applet's ${C.ON_CIRCLE_TOL}-unit cutoff; the saved Equal flag is kept as the applet left it.`,
  };
}
