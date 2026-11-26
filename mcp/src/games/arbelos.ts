/*
 * run_game_logic actions and saved-position reader for Arbelos, the
 * shoemaker's knife.
 *
 * The core lives in arbelos/ and is copied into src/generated/cores/ at build
 * time. Its only free parameter is t, the fraction of the way from A to B where
 * N sits: AN = a, NB = b. Everything else follows from the one identity
 * PN = sqrt(a*b) (a point on a semicircle is the mean proportional of the two
 * parts of the diameter through it). Archimedes' Proposition 4 is that the
 * knife's area pi*a*b/4 equals the area of the circle on PN; in the full
 * three-circle picture the gap is pi*t_chord^2/8, with t_chord = 2*PN, so the
 * gap over the chord squared is the constant pi/8. All numbers below come from
 * the real core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["arbelos"].ArbelosCore;

type Point = { x: number; y: number };

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));

/**
 * Build a core state from the arguments. The core draws on a fixed board of
 * DIAMETER units, so a requested AB length (or the one implied by two radii)
 * is applied at the end by scaling lengths linearly and areas quadratically.
 * Either give the two small radii r1, r2, or give the sliding point t with an
 * optional diameter (defaulting to the board's).
 */
function fromArgs(args: Json) {
  const C = core();
  let t: number;
  let diameter: number;
  if (args.r1 !== undefined && args.r2 !== undefined) {
    const r1 = num(args, "r1");
    const r2 = num(args, "r2");
    if (!(r1 > 0) || !(r2 > 0)) throw new Error('"r1" and "r2" must be positive radii');
    t = r1 / (r1 + r2);
    diameter = 2 * (r1 + r2);
  } else {
    t = num(args, "t", C.START_T);
    if (!(t >= 0 && t <= 1)) throw new Error('"t" must be a fraction of AB between 0 and 1');
    diameter = num(args, "diameter", C.DIAMETER);
    if (!(diameter > 0)) throw new Error('"diameter" must be positive');
  }
  const state = C.start({ t });
  const g = C.geometry(state);
  return { C, t: g.t as number, diameter: diameter as number, scale: diameter / C.DIAMETER, state, g };
}

/** The core's geometry, scaled to the requested diameter and made plain JSON. */
function reading(d: ReturnType<typeof fromArgs>) {
  const { g, scale } = d;
  const len = (v: number) => round(v * scale);
  const area = (v: number) => round(v * scale * scale);
  const a = len(g.a), b = len(g.b);
  const chord = len(g.chord);
  const knife = g.arbelosArea;
  const twin = g.circleArea;
  // These ratios are scale-free, so they hold whatever AB length was asked for.
  const chordConstant = g.fullArea / (g.chord * g.chord);
  return {
    t: round(g.t),
    diameter: round(d.diameter),
    AN: a,
    NB: b,
    smallRadii: { r1: round(a / 2), r2: round(b / 2) },
    uprightPN: len(g.altitude),
    twinCircleRadius: len(g.circle.radius),
    arbelosArea: area(knife),
    circleOnPNArea: area(twin),
    archimedesProposition4: Math.abs(knife - twin) <= 1e-9 * Math.max(1, Math.abs(knife)),
    tangentChord: chord,
    threeCircleGap: area(g.fullArea),
    tangentChordConstant: round(chordConstant, 8),
    isPiOver8: Math.abs(chordConstant - Math.PI / 8) < 1e-12,
    gapIsTwiceKnife: Math.abs(g.fullArea - 2 * knife) <= 1e-9 * Math.max(1, Math.abs(knife)),
    bigArc: len(g.bigArc),
    smallArcsTogether: len(g.smallArc),
    arcsEqual: Math.abs(g.bigArc - g.smallArc) <= 1e-9 * Math.max(1, Math.abs(g.bigArc)),
  };
}

export function actions(): GameActions {
  return {
    archimedes_twin_circle: {
      describe:
        "Archimedes' Proposition 4 for the arbelos: give the two small radii r1 and r2 (or a sliding point t and an optional diameter AB) and report the knife's area and the area of the circle on the upright PN. They are equal: PN is the mean proportional sqrt(AN*NB), so the circle on it has area pi*r1*r2, the same as the knife pi*AN*NB/4. Also checks that the big arc equals the two small arcs put together.",
      args: '{ "r1": 30, "r2": 50 }',
      run: (args) => {
        const r = reading(fromArgs(args));
        return {
          ...r,
          note: `With AN = ${r.AN} and NB = ${r.NB}, the upright PN = ${r.uprightPN} is the mean proportional, so the circle on it has radius ${r.twinCircleRadius}. Its area ${r.circleOnPNArea} equals the knife's ${r.arbelosArea} (both pi*AN*NB/4) - that is Archimedes' Proposition 4. The big arc ${r.bigArc} equals the two small arcs together (${r.smallArcsTogether}).`,
        };
      },
    },
    tangent_chord_constant: {
      describe:
        "The full three-circle arbelos: give the sliding point t (or the two small radii r1, r2). Report the tangent chord at N, length 2*PN, and the area pi*t_chord^2/8 of the gap between the three tangent circles. The gap divided by the chord squared is the constant pi/8, whatever t is, and the gap is twice the knife's area.",
      args: '{ "t": 0.3125, "diameter": 320 }',
      run: (args) => {
        const r = reading(fromArgs(args));
        return {
          ...r,
          note: `The tangent chord at the contact point N is ${r.tangentChord} = 2*PN. The gap between the three tangent circles has area ${r.threeCircleGap} = pi*chord^2/8, so gap/chord^2 = ${r.tangentChordConstant} = pi/8 regardless of t, and that gap is twice the knife's area ${r.arbelosArea}.`,
        };
      },
    },
  };
}

function readPoint(value: unknown, name: string): Point {
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const x = Number(o.x), y = Number(o.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error(`"${name}" must be a point {x, y}`);
}

/** The page's saved fields, plus the core's reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Arbelos state version ${stateVersion}`);

  const t = num(state, "t");
  const s = C.start({ t });
  const g = C.geometry(s);
  const cp = C.position(s); // the core's own rounded summary: the page's saved shape
  const N = readPoint(state.N, "N");
  const saved = {
    t: t as number,
    N,
    a: num(state, "a"),
    b: num(state, "b"),
    altitude: num(state, "altitude"),
    chord: num(state, "chord"),
    arbelosArea: num(state, "arbelosArea"),
    circleArea: num(state, "circleArea"),
  };
  const fields: Array<[string, number, number]> = [
    ["t", saved.t, cp.t],
    ["a", saved.a, cp.a],
    ["b", saved.b, cp.b],
    ["altitude", saved.altitude, cp.altitude],
    ["chord", saved.chord, cp.chord],
    ["arbelosArea", saved.arbelosArea, cp.arbelosArea],
    ["circleArea", saved.circleArea, cp.circleArea],
  ];
  const differences = fields.map(([field, page, coreValue]) => ({
    field,
    page,
    core: coreValue,
    diff: round(Math.abs(page - coreValue), 9),
  }));
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const chordConstant = g.fullArea / (g.chord * g.chord);

  return {
    stateVersion,
    // The fields the page saved with Track.state, with the same names.
    t: saved.t,
    N: { x: N.x, y: N.y },
    a: saved.a,
    b: saved.b,
    altitude: saved.altitude,
    chord: saved.chord,
    arbelosArea: saved.arbelosArea,
    circleArea: saved.circleArea,
    // What the same core adds about this position.
    core: {
      r1: round(g.r1),
      r2: round(g.r2),
      R: round(g.R),
      P: { x: round(g.P.x), y: round(g.P.y) },
      uprightPN: round(g.altitude),
      twinCircle: {
        center: { x: round(g.circle.center.x), y: round(g.circle.center.y) },
        radius: round(g.circle.radius),
      },
      threeCircleGap: round(g.fullArea),
      bigArc: round(g.bigArc),
      smallArcsTogether: round(g.smallArc),
    },
    savedMatchesCore,
    differences,
    archimedesProposition4: Math.abs(g.arbelosArea - g.circleArea) <= 1e-9 * Math.max(1, Math.abs(g.arbelosArea)),
    arcsEqual: Math.abs(g.bigArc - g.smallArc) <= 1e-9 * Math.max(1, Math.abs(g.bigArc)),
    tangentChordConstant: round(chordConstant, 8),
    note: savedMatchesCore
      ? `N is ${round(g.t)} of the way from A to B, so AN = ${round(g.a)}, NB = ${round(g.b)} and the upright PN = ${round(g.altitude)}. The knife and the circle on PN both have area ${round(g.arbelosArea)} (Archimedes' Proposition 4); the tangent chord is ${round(g.chord)} and the three-circle gap is twice the knife, with gap/chord^2 = pi/8.`
      : "The saved numbers do not agree with the core's geometry for this t; the differences are listed in `differences`.",
  };
}
