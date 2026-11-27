/*
 * run_game_logic actions and saved-position reader for Expanded Incircle.
 *
 * Starting at P on side BC, five rotations round the corners give Q, R, P',
 * Q', R'. The chain closes (CP = CR'), the touch points D, E, F of the
 * incircle bisect PP', RR', QQ', and all six points lie on one circle whose
 * centre is the incenter I. Conway's construction extends each side by the
 * opposite side length plus a common x: then DP = s + x and the three chords
 * are 2(s + x) = a + b + c + 2x. The page's "(a+b+c)/2 + x" is that half-chord
 * DP, not the chord.
 *
 * Every number below comes from the game's real core
 * expanded-incircle/expanded-incircle-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units in the
 * page's 400 x 300 viewBox, y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = {
  names: boolean; rotations: boolean; circle: boolean;
  incircle: boolean; gergonne: boolean;
};
type State = { A: Pt; B: Pt; C: Pt; coefP: number; options: Options; touches?: number };
type Geometry = {
  valid: boolean;
  A: Pt; B: Pt; C: Pt; I: Pt; D: Pt; E: Pt; F: Pt;
  P: Pt; Q: Pt; R: Pt; Pp: Pt; Qp: Pt; Rp: Pt;
  incircle: { center: Pt; radius: number };
  circle: { center: Pt; radius: number };
  sixPoints: Pt[];
};
type Core = {
  VIEW: { width: number; height: number };
  start(options?: Json): Json;
  moveVertex(state: Json, name: string, p: Pt): Json;
  moveP(state: Json, p: Pt): Json;
  geometry(state: Json): Geometry;
  radii(g: Geometry): number[];
  radiusSpread(g: Geometry): number;
  tangentLengths(g: Geometry): number[];
  tangentSpread(g: Geometry): number;
  midpointErrors(g: Geometry): number[];
  closingError(g: Geometry): number;
  chordLengths(g: Geometry): number[];
  conwayPoint(state: Json, vertex: string, x: number): Pt | null;
  conwaySix(state: Json, x: number): Pt[];
  dist(p: Pt, q: Pt): number;
};

const core = () => cores["expanded-incircle"].ExpandedIncircleCore as unknown as Core;

/** The logic test uses a 1-pixel tolerance; print tiny errors readably. */
const TOL = 1e-6;
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const err = (v: number): number => (Number.isFinite(v) ? Number(v.toExponential(2)) : NaN);
const pt = (p: Pt): Pt => ({ x: round(p.x), y: round(p.y) });
const close = (a: number, b: number, tol = TOL): boolean =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Tool args may use [x, y]; a saved position from the page uses { x, y }. */
function readPoint(value: unknown, name: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${name}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${name}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${name}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readOptions(value: unknown): Options {
  const options: Options = {
    names: false, rotations: false, circle: false, incircle: true, gergonne: false,
  };
  if (value === undefined || value === null) return options;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error('argument "options" must be an object of booleans');
  }
  const o = value as Json;
  for (const key of Object.keys(options) as Array<keyof Options>) {
    const v = o[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") throw new Error(`argument "options.${key}" must be true or false`);
    options[key] = v;
  }
  return options;
}

function readCoef(value: unknown, name: string): number {
  if (typeof value !== "number" && value !== undefined && value !== null &&
      typeof value !== "string") {
    throw new Error(`argument "${name}" must be a number`);
  }
  const t = value === undefined || value === null ? NaN : Number(value);
  if (!Number.isFinite(t)) throw new Error(`argument "${name}" must be a finite number`);
  if (t < -10 || t > 10) throw new Error(`argument "${name}" must lie between -10 and 10`);
  return t;
}

/**
 * A real core state. Corners are applied as page drags (which clamp them to
 * the board); P is either a point projected onto BC with the core's moveP or
 * a coefficient along C -> B, with 0 at C, 1 at B and values outside that
 * range putting P beyond a corner.
 */
function stateFrom(args: Json, C: Core): State {
  let s = C.start(readOptions(args.options)) as State;
  for (const name of ["A", "B", "C"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) {
      s = C.moveVertex(s as Json, name, readPoint(v, name)) as State;
    }
  }
  if (args.coefP !== undefined && args.coefP !== null &&
      args.at !== undefined && args.at !== null) {
    throw new Error('give either "coefP" or "at", not both');
  }
  if (args.at !== undefined && args.at !== null) {
    s = C.moveP(s as Json, readPoint(args.at, "at")) as State;
  } else if (args.coefP !== undefined && args.coefP !== null) {
    const t = readCoef(args.coefP, "coefP");
    const p = { x: t * s.B.x + (1 - t) * s.C.x, y: t * s.B.y + (1 - t) * s.C.y };
    s = C.moveP(s as Json, p) as State;
  }
  return s;
}

function geometryFor(s: State, C: Core): Geometry {
  const g = C.geometry(s as Json);
  if (!g.valid) {
    throw new Error("A, B and C are collinear or too close: the core cannot draw the construction");
  }
  return g;
}

/** The closed chain and the measurements behind the page's circle claims. */
function chainReading(C: Core, s: State, g: Geometry) {
  const radii = C.radii(g);
  const tangents = C.tangentLengths(g);
  const midErrors = C.midpointErrors(g);
  const chords = C.chordLengths(g);
  const radiusSpread = C.radiusSpread(g);
  const tangentSpread = C.tangentSpread(g);
  const closingError = C.closingError(g);
  const chordSpread = Math.max(...chords) - Math.min(...chords);
  const centreOffset = C.dist(g.circle.center, g.I);
  return {
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    coefP: round(s.coefP),
    sixPoints: {
      P: pt(g.P), Q: pt(g.Q), R: pt(g.R),
      "P'": pt(g.Pp), "Q'": pt(g.Qp), "R'": pt(g.Rp),
    },
    incenter: pt(g.I),
    incircle: { centre: pt(g.incircle.center), radius: round(g.incircle.radius) },
    touchPoints: { D: pt(g.D), E: pt(g.E), F: pt(g.F) },
    circle: { centre: pt(g.circle.center), radius: round(g.circle.radius) },
    claims: {
      sixConcyclic: radiusSpread <= TOL,
      centreIsIncenter: centreOffset <= TOL,
      chainCloses: Math.abs(closingError) <= TOL,
      equalTangents: tangentSpread <= TOL,
      touchPointsAreMidpoints: Math.max(...midErrors) <= TOL,
      equalChords: chordSpread <= TOL,
    },
    measures: {
      distancesFromI: radii.map((v) => round(v)),
      radiusSpread: err(radiusSpread),
      centreOffset: err(centreOffset),
      tangentLengths: tangents.map((v) => round(v)),
      tangentSpread: err(tangentSpread),
      midpointErrorsPPpRRpQQp: midErrors.map(err),
      closingErrorCPminusCRp: err(closingError),
      chordLengths: chords.map((v) => round(v)),
      chordSpread: err(chordSpread),
    },
  };
}

export function actions(): GameActions {
  return {
    six_point_chain: {
      describe:
        "For triangle ABC (each corner [x, y] or { x, y }; omitted corners stay at the applet's opening triangle), put P on BC with coefP (0 at C, 1 at B; outside that range is beyond a corner) or drag it with `at`, then report the closed chain P, Q, R, P', Q', R' from the core's five rotations, the incenter I and touch points D, E, F, the six-point circle centred at I, and the measured closing, tangent, midpoint and chord claims. The walk closes because CP = CR', and D, E, F bisect PP', RR', QQ', so all six dots are the same distance from I and FQ = ER = DP' = FQ' = ER' = DP.",
      args: '{"A":[80,60],"B":[240,240],"C":[320,60],"coefP":0.7}',
      run: (args) => {
        const C = core();
        const s = stateFrom(args, C);
        const g = geometryFor(s, C);
        const r = chainReading(C, s, g);
        return {
          ...r,
          note: `The five rotations close the chain: CP - CR' = ${r.measures.closingErrorCPminusCRp}. All six dots are ${r.circle.radius} units from I (spread ${r.measures.radiusSpread}); D, E, F bisect the three chords and the six tangent lengths are all ${r.measures.tangentLengths[0]}. This is an illustration, so there is no win or loss.`,
        };
      },
    },

    conway_chords: {
      describe:
        "For triangle ABC and a common side extension x (default 40, may be negative), the core places Conway's six points and slides P to the one beyond B, then measures DP, the chords PP', QQ', RR' and the radius of the circle through Conway's six points. With a = BC, b = CA, c = AB and s = (a+b+c)/2, the chord is 2(s+x) = a+b+c+2x while s+x = (a+b+c)/2+x is only the half-chord DP: the page's last paragraph calls that half-chord the full chord.",
      args: '{"A":[80,60],"B":[240,240],"C":[320,60],"x":40}',
      run: (args) => {
        const C = core();
        const x = num(args, "x", 40);
        if (x < -100 || x > 100) throw new Error('argument "x" must lie between -100 and 100');
        const s = stateFrom(args, C);
        const base = geometryFor(s, C);
        const beyondB = C.conwayPoint(s as Json, "B", x);
        if (!beyondB) throw new Error("the core cannot extend side BC at corner B");
        const moved = C.moveP(s as Json, beyondB) as State;
        const g = geometryFor(moved, C);
        const points = C.conwaySix(s as Json, x);
        const radii = points.map((p) => C.dist(base.I, p));
        const a = C.dist(g.B, g.C), b = C.dist(g.C, g.A), c = C.dist(g.A, g.B);
        const semi = (a + b + c) / 2;
        const dp = C.dist(g.D, g.P);
        const chords = C.chordLengths(g);
        const spread = Math.max(...radii) - Math.min(...radii);
        return {
          triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
          extensionX: x,
          sides: { a: round(a), b: round(b), c: round(c) },
          semiperimeter: round(semi),
          conwayPoints: points.map(pt),
          P: pt(g.P), coefP: round(moved.coefP),
          halfChord: {
            measuredDP: round(dp), formulaSPlusX: round(semi + x),
            agrees: close(dp, semi + x),
          },
          chords: {
            measured: chords.map((v) => round(v)),
            trueFormulaTwoSPlusX: round(2 * (semi + x)),
            pageFormulaSPlusX: round(semi + x),
            allMatchTrueFormula: chords.every((v) => close(v, 2 * (semi + x))),
            pageUnderstatesBy: round(semi + x),
          },
          conwayCircle: {
            centre: pt(base.I),
            distancesFromI: radii.map((v) => round(v)),
            spread: err(spread),
            allOnOneCircle: spread <= TOL,
            matchesSixPointCircle: close(Math.max(...radii), g.circle.radius),
          },
          note: `With x = ${x}, DP = ${round(dp)} = s + x = ${round(semi + x)}, and each chord is ${round(chords[0])} = 2(s + x) = a + b + c + 2x. The page's (a+b+c)/2 + x = ${round(semi + x)} is the half-chord DP, half the true length; Conway's six points all lie ${round(radii[0])} units from the incenter.`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus the core's reading of that same position. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Expanded Incircle state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  const s: State = {
    A: readPoint(src.A, "A"),
    B: readPoint(src.B, "B"),
    C: readPoint(src.C, "C"),
    coefP: readCoef(src.coefP, "coefP"),
    options: readOptions(src.options),
  };
  const g = C.geometry(s as Json);
  if (!g.valid) {
    return {
      ...src, stateVersion, valid: false,
      note: "The saved corners are collinear or too close, so the core cannot draw the six-point circle.",
    };
  }
  const reading = chainReading(C, s, g);
  return {
    // The fields the page saved, with the same names and values.
    ...src,
    stateVersion,
    valid: true,
    saved: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C),
      coefP: round(s.coefP), options: s.options,
    },
    // What the core adds about that same drawing.
    core: reading,
    incenter: reading.incenter,
    circle: reading.circle,
    claims: reading.claims,
    note: `P is ${round(s.coefP)} of the way from C to B. The core rebuilds the five rotations: CP - CR' = ${reading.measures.closingErrorCPminusCRp} and the six dots are all ${reading.circle.radius} units from the incenter I (${reading.incenter.x}, ${reading.incenter.y}), spread ${reading.measures.radiusSpread}. D, E, F bisect PP', RR', QQ', so the six tangent lengths agree and the circle stays centred at I. This illustration has no win or loss.`,
  };
}
