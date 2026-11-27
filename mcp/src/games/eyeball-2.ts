/*
 * run_game_logic actions and saved-position reader for Eyeball 2 (the Squinting
 * Eyes Theorem, from the 1842 Aichi sangaku).
 *
 * Two circles have centres A, B and radii RA, RB. P and Q are the points of
 * the circles farthest from the *other* centre. The tangents from P to circle
 * B and from Q to circle A cut out two curved "isosceles triangles", and the
 * circles inscribed in them have the same radius
 *
 *     r = 2*RA*RB/(RA + RB + AB),
 *
 * symmetric in A and B. Those tangents exist exactly when AB >= |RA - RB|;
 * if one circle sits too far inside the other (AB < |RA - RB|) the farthest
 * point is inside the other circle and no tangent can be drawn.
 *
 * This is NOT the original Eyeball: there the tangents drawn from the centres
 * cut equal *chords* PQ = RS = 2*RA*RB/AB out of the circles. All the Eyeball
 * 2 numbers below come from its real core (eyeball-2/eyeball-2-core.js), copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["eyeball-2"].Eyeball2Core;

type Point = { x: number; y: number };

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const close = (a: number, b: number, tol = 1e-6): boolean =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

/** Tool arguments may use [x, y]; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, name: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = Number(value[0]), y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const p = value as Json;
    return { x: num(p, "x"), y: num(p, "y") };
  }
  throw new Error(`"${name}" must be a point [x, y] or {x, y}`);
}

function maybePoint(value: unknown): Point | null {
  try {
    return readPoint(value, "point");
  } catch {
    return null;
  }
}

const pointMatches = (value: unknown, expected: Point): boolean => {
  const p = maybePoint(value);
  return p !== null && close(p.x, expected.x) && close(p.y, expected.y);
};

/**
 * A real core state for two circles with radii RA, RB whose centres are AB = d
 * apart: the boundary points fix the radii through distance(centre, boundary).
 * `measure` then reads the geometry back from that state, so nothing is faked.
 */
function stateFromArgs(args: Json) {
  const C = core();
  const ra = num(args, "ra");
  const rb = num(args, "rb");
  const d = num(args, "d");
  if (!(ra > 0)) throw new Error('"ra" must be positive');
  if (!(rb > 0)) throw new Error('"rb" must be positive');
  if (!(d > 0)) throw new Error('"d" must be positive');
  const A: Point = { x: 0, y: 0 };
  const B: Point = { x: d, y: 0 };
  const state = {
    width: Math.max(C.WIDTH, d + ra + rb + 20),
    height: C.HEIGHT,
    A, B,
    boundaryA: { x: A.x - ra, y: A.y },
    boundaryB: { x: B.x + rb, y: B.y },
  };
  return { C, state, ra, rb, d };
}

/** The curved-triangle incircles at one position, with the tangent test. */
function incircleReading(C: ReturnType<typeof core>, state: ReturnType<typeof stateFromArgs>["state"]) {
  const g = C.measure(state);
  const formula = C.incircleRadius(g.ra, g.rb, g.d);
  const gap = Math.abs(g.ra - g.rb);
  const noTangent = g.d < gap; // AB < |RA - RB|
  return {
    g, formula, gap, noTangent,
    reading: {
      ra: round(g.ra), rb: round(g.rb), d: round(g.d),
      incircles: g.incircles.map((c: { owner: string; centre: Point; radius: number }) => ({
        owner: c.owner,
        centre: pt(c.centre),
        radius: round(c.radius),
      })),
      radius: round(g.r),
      formulaRadius: round(formula),
      matchesFormula: close(g.r, formula),
      equalRadii: close(g.incircles[0].radius, g.incircles[1].radius),
      tangents: {
        fromP: g.tangents.fromP.length,
        fromQ: g.tangents.fromQ.length,
        drawn: g.possible,
        noTangentWhenABbelowGap: noTangent,
        radiusGap: round(gap),
        // Degenerate concentric cases are the only place this can disagree.
        agrees: g.d <= C.EPS ? null : g.possible === !noTangent,
      },
    },
  };
}

export function actions(): GameActions {
  return {
    equal_incircles: {
      describe:
        "For two circles with radii ra, rb and centre distance d = AB, report the two curved-triangle incircles from the Eyeball 2 core: their centres and radii, that the radii are equal to r = 2*ra*rb/(ra+rb+d), and that the two tangents from P and from Q exist. The tangents fail (both incircles vanish) exactly in the no-tangent case AB < |ra-rb|, when one circle lies too far inside the other; report that gap too. Give ra, rb and d as positive numbers.",
      args: '{ "ra": 60, "rb": 90, "d": 200 }',
      run: (args) => {
        const { C, state } = stateFromArgs(args);
        const { reading } = incircleReading(C, state);
        const { tangents } = reading;
        const tangentNote = tangents.drawn
          ? `The tangents from the farthest points P and Q are drawn because AB = ${reading.d} reaches the radius gap ${tangents.radiusGap}.`
          : `No tangent can be drawn here: AB = ${reading.d} is below the radius gap |RA-RB| = ${tangents.radiusGap}, so the farthest point lies inside the other circle and the curved triangles do not form.`;
        return {
          ...reading,
          note: `With RA = ${reading.ra}, RB = ${reading.rb} and AB = ${reading.d}, both green incircles have radius ${reading.radius} = 2*RA*RB/(RA+RB+AB), even though the circles have different radii. ${tangentNote}`,
        };
      },
    },
    equal_chords_vs_incircles: {
      describe:
        "Eyeball 2 is not the original Eyeball. In Eyeball, tangents drawn from the two centres cut equal chords PQ = RS = 2*ra*rb/d out of the circles; in Eyeball 2, tangents drawn from the farthest points P and Q carve out curved triangles whose incircles both have radius 2*ra*rb/(ra+rb+d). For the same ra, rb and d, report both classical values (the Eyeball 2 radius from its real core) and their difference, plus whether Eyeball's centre-drawn tangents can exist. Give ra, rb and d as positive numbers.",
      args: '{ "ra": 60, "rb": 90, "d": 200 }',
      run: (args) => {
        const { C, state } = stateFromArgs(args);
        const { g, formula, reading } = incircleReading(C, state);
        // Eyeball's chord, halved by the right triangle with legs d and rb:
        // half-chord = ra*rb/d, so PQ = RS = 2*ra*rb/d.
        const chord = 2 * g.ra * g.rb / g.d;
        // Eyeball needs AB strictly greater than both radii for its two fans
        // of centre-drawn tangents; Eyeball 2 only needs AB >= |RA - RB|.
        const eyeballTangents = g.d > Math.max(g.ra, g.rb);
        return {
          ra: reading.ra, rb: reading.rb, d: reading.d,
          eyeball2: {
            incircleRadius: round(formula),
            fromCore: round(g.r),
            formula: "2*RA*RB/(RA+RB+AB)",
            tangentsDrawn: g.possible,
          },
          eyeball: {
            equalChordLength: round(chord),
            formula: "2*RA*RB/AB",
            centreTangentsExist: eyeballTangents,
          },
          chordMinusIncircle: round(chord - formula),
          same: close(chord, formula),
          note: `Eyeball's equal chords are ${round(chord)} long (2*RA*RB/AB); Eyeball 2's equal incircles have radius ${round(formula)} (2*RA*RB/(RA+RB+AB)), a difference of ${round(chord - formula)}. The first theorem draws tangents from the centres and measures a straight chord; the second draws them from the farthest points and measures a circle inscribed in each curved triangle.`,
        };
      },
    },
  };
}

/** The saved fields from Track.state, plus the core's reading of that drawing. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Eyeball 2 state version ${stateVersion}`);

  const A = readPoint(state.A, "A");
  const B = readPoint(state.B, "B");
  const boundaryA = readPoint(state.boundaryA, "boundaryA");
  const boundaryB = readPoint(state.boundaryB, "boundaryB");
  const coreState = { A, B, boundaryA, boundaryB };
  const { g, formula, gap, noTangent } = (() => {
    const C0 = core();
    const measured = C0.measure(coreState);
    return {
      g: measured,
      formula: C0.incircleRadius(measured.ra, measured.rb, measured.d),
      gap: Math.abs(measured.ra - measured.rb),
      noTangent: measured.d < Math.abs(measured.ra - measured.rb),
    };
  })();

  const savedNumber = (key: string): number | null => {
    const v = state[key];
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const matches = (key: string, expected: number): boolean | null => {
    const v = savedNumber(key);
    return v === null ? null : close(v, expected);
  };

  return {
    // The fields the page saved with Track.state, with the same names.
    ...state,
    stateVersion,
    // What the core adds about this same drawing.
    core: {
      A: pt(g.A), B: pt(g.B),
      boundaryA: pt(boundaryA), boundaryB: pt(boundaryB),
      ra: round(g.ra), rb: round(g.rb), d: round(g.d),
      radius: round(g.r),
      formulaRadius: round(formula),
      matchesFormula: close(g.r, formula),
      equalRadii: close(g.incircles[0].radius, g.incircles[1].radius),
      incircles: g.incircles.map((c: { owner: string; centre: Point; radius: number }) => ({
        owner: c.owner, centre: pt(c.centre), radius: round(c.radius),
      })),
      P: pt(g.P), Q: pt(g.Q),
      tangents: { fromP: g.tangents.fromP.length, fromQ: g.tangents.fromQ.length, drawn: g.possible },
      possible: g.possible,
      noTangentWhenABbelowGap: noTangent,
      radiusGap: round(gap),
      gapAgreement: g.d <= C.EPS ? null : g.possible === !noTangent,
    },
    savedMatchesCore: {
      ra: matches("ra", g.ra),
      rb: matches("rb", g.rb),
      d: matches("d", g.d),
      radius: matches("radius", g.r),
      possible: typeof state.possible === "boolean" ? state.possible === g.possible : null,
      A: pointMatches(state.A, g.A),
      B: pointMatches(state.B, g.B),
    },
    note: `With RA = ${round(g.ra)}, RB = ${round(g.rb)} and AB = ${round(g.d)}, the two curved-triangle incircles both have radius ${round(g.r)} = 2*RA*RB/(RA+RB+AB), whether or not the circles cross. The tangents ${g.possible ? "are drawn" : "cannot be drawn"}: the radius gap is ${round(gap)} and AB ${noTangent ? "falls below" : "reaches"} it.`,
  };
}
