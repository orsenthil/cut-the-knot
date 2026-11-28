/*
 * run_game_logic actions and saved-position reader for In And Circumcenter D.
 *
 * Both use the game's real core (in-and-circumcenter-d/in-and-circumcenter-d-core.js),
 * copied into src/generated/cores/ at build time; every number below is measured
 * by it. Coordinates are board units in the page's 450 x 450 SVG, y downward.
 *
 * Side AB (length c) is the special side: it is laid off from B along BC to D
 * (BD = c) and from A along AC to E (AE = c), so CD = |a - c| and CE = |b - c|,
 * where a = BC and b = CA. With I and O the incenter and circumcenter of ABC,
 * the circle I(O) meets the chord through O parallel to CA at N and the chord
 * through O parallel to CB at M. A chord through a point of a circle has length
 * twice the projection of the radius on its direction; using the feet of I and
 * O on AC, ((a + b - c)/2 and b/2 from C) gives ON = |a - c| = CD and
 * OM = |b - c| = CE. Since the chord directions are parallel to CA and CB, the
 * angle at O equals the angle at C, so triangle ONM is congruent to CDE. The
 * perpendicular from the centre I to a chord bisects it, and L (where ON meets
 * I's perpendicular to AC) is that midpoint: OL = LN = ON/2. The page's signed
 * lengths a - c and b - c assume AB is the shortest side, and its line-circle
 * intersection cannot tell two points less than one pixel apart. See _shared.ts
 * for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  A: Pt; B: Pt; C: Pt;
  showNames: boolean; showStatement: boolean; showPremise: boolean; showHint: boolean;
};
type Circle = { c: Pt; r: number };
type Geometry = {
  valid: boolean;
  A: Pt; B: Pt; C: Pt;
  a: number; b: number; c: number;
  I: Pt; O: Pt; D: Pt; E: Pt; Op: Pt; Ip: Pt;
  N: Pt | null; M: Pt | null; L: Pt | null;
  incircle: Circle; circumcircle: Circle; circle: Circle;
  rIn: number; rCirc: number; io: number;
};
type Claims = {
  valid: boolean;
  a: number; b: number; c: number;
  cd: number; ce: number; on: number; om: number;
  angleC: number; angleO: number; ol: number; oip: number;
  angleDiff: number; onError: number; omError: number; olError: number; ipError: number;
  congruent: boolean; onSides: boolean; chordShort: boolean;
};
type Core = {
  WIDTH: number; HEIGHT: number; MARGIN: number; MIN_SIDE: number; OTHER_TOL: number;
  start(): State;
  withPoint(s: State, name: string, p: Pt): State;
  setOption(s: State, name: string, value: boolean): State;
  geometry(s: State): Geometry;
  claims(f: Geometry): Claims;
  describe(f: Geometry): string;
  dist(p: Pt, q: Pt): number;
};

const core = (): Core =>
  cores["in-and-circumcenter-d"].InAndCircumcenterDCore as unknown as Core;

const VERTICES = ["A", "B", "C"] as const;
const FLAGS = ["showNames", "showStatement", "showPremise", "showHint"] as const;
const ROLES = {
  A: "one end of the special side AB (length c); E is laid off from A towards C with AE = c",
  B: "the other end of AB; D is laid off from B towards C with BD = c",
  C: "the apex where triangle CDE is built; E is on AC and D is on BC",
};

/* Only what we print is rounded; the core keeps full precision. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const cn = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const pt = (p: Pt | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const deg = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v * 180 / Math.PI) : null;
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** A point as the page saves it ({x, y}) or as a short [x, y] argument. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (isPlain(raw)) {
    x = Number(raw.x); y = Number(raw.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readBool(raw: unknown, label: string): boolean {
  if (typeof raw !== "boolean") throw new Error(`${label} must be true or false, got ${JSON.stringify(raw)}`);
  return raw;
}

/** A strict core position from action arguments, moving through the real core. */
function actionState(C: Core, args: Json): State {
  if (!isPlain(args)) throw new Error("arguments must be an object");
  let s = C.start();
  for (const name of VERTICES) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.withPoint(s, name, readPoint(raw, `argument "${name}"`));
  }
  for (const key of FLAGS) {
    const raw = args[key];
    if (raw !== undefined && raw !== null) s = C.setOption(s, key, readBool(raw, `argument "${key}"`));
  }
  return s;
}

/** Tolerant reading of a saved Track.state record, with opening fallbacks. */
function savedState(C: Core, src: Json): { s: State; readable: boolean } {
  const base = C.start();
  let s = base;
  let readable = true;
  for (const name of VERTICES) {
    const raw: unknown = src[name];
    if (isPlain(raw) && Number.isFinite(Number(raw.x)) && Number.isFinite(Number(raw.y))) {
      s = C.withPoint(s, name, { x: Number(raw.x), y: Number(raw.y) });
    } else if (raw !== undefined && raw !== null) {
      readable = false;
    }
  }
  for (const key of FLAGS) {
    const raw: unknown = src[key];
    if (typeof raw === "boolean") s = C.setOption(s, key, raw);
    else if (raw !== undefined && raw !== null) readable = false;
  }
  return { s, readable };
}

/** The full measured construction, shared by the actions and position(). */
function reading(C: Core, s: State) {
  const f = C.geometry(s);
  const cl = C.claims(f);
  const geometry = {
    valid: f.valid,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    sides: { BC: cn(cl.a), CA: cn(cl.b), AB: cn(cl.c) },
    D: pt(f.D), E: pt(f.E), I: pt(f.I), O: pt(f.O),
    N: pt(f.N), M: pt(f.M), L: pt(f.L), Ip: pt(f.Ip), Op: pt(f.Op),
    incircle: { center: pt(f.incircle?.c), radius: cn(f.incircle?.r) },
    circumcircle: { center: pt(f.circumcircle?.c), radius: cn(f.circumcircle?.r) },
    circleIO: { center: pt(f.circle?.c), radius: cn(f.circle?.r) },
  };
  if (!f.valid || !cl.valid) {
    return {
      valid: false as const,
      geometry,
      status: C.describe(f),
      note: C.describe(f),
    };
  }

  const ln = f.L && f.N ? C.dist(f.L, f.N) : NaN;
  const ipFromC = C.dist(f.C, f.Ip);
  const opFromC = C.dist(f.C, f.Op);
  const expectedIpFromC = (cl.a + cl.b - cl.c) / 2;
  const expectedOpFromC = cl.b / 2;
  const signedA = cl.a - cl.c;
  const signedB = cl.b - cl.c;

  return {
    valid: true as const,
    geometry,
    cde: { CD: cn(cl.cd), CE: cn(cl.ce), angleAtC: deg(cl.angleC) },
    onm: { ON: cn(cl.on), OM: cn(cl.om), angleAtO: deg(cl.angleO) },
    chord: {
      OL: cn(cl.ol), LN: cn(ln), halfON: cn(cl.on / 2),
      midpointError: cn(Math.abs(ln - cl.on / 2)),
    },
    feet: {
      IpFromC: cn(ipFromC), expectedIpFromC: cn(expectedIpFromC),
      OpFromC: cn(opFromC), expectedOpFromC: cn(expectedOpFromC),
      separation: cn(cl.oip), expectedSeparation: cn(Math.abs(signedA) / 2),
    },
    signed: {
      aMinusC: cn(signedA), bMinusC: cn(signedB),
      cd: cn(cl.cd), ce: cn(cl.ce),
      DAndELieOnSides: cl.onSides,
    },
    checks: {
      onMinusCD: cn(cl.onError), omMinusCE: cn(cl.omError),
      olMinusHalfON: cn(cl.olError), ipMinusHalfON: cn(cl.ipError),
      angleDiffDeg: deg(cl.angleDiff),
      congruent: cl.congruent,
      chordShorterThanOnePixel: cl.chordShort,
      otherTolerance: C.OTHER_TOL,
    },
    status: C.describe(f),
    note:
      `With a = BC = ${cn(cl.a)}, b = CA = ${cn(cl.b)} and c = AB = ${cn(cl.c)}, D lies on BC with BD = c and E on AC with AE = c, so CD = |a - c| = ${cn(cl.cd)} and CE = |b - c| = ${cn(cl.ce)}. ` +
      `The real core measures ON = ${cn(cl.on)} and OM = ${cn(cl.om)} with the angle at O = ${deg(cl.angleO)}° against the angle at C = ${deg(cl.angleC)}° (their sides are parallel), so triangle ONM is ${cl.congruent ? "congruent" : "not congruent within tolerance"} to triangle CDE. ` +
      (cl.onSides
        ? "AB is the shortest side, so the page's signed lengths a - c and b - c are positive and D and E lie on the sides. "
        : "AB is longer than another side, so the page's signed lengths a - c and b - c are negative: D or E lies beyond C and only the absolute lengths match. ") +
      (cl.chordShort
        ? "A chord is under one pixel, where the applet's Other() routine cannot reliably pick its far end."
        : "Neither chord is under one pixel, so the applet's one-pixel Other() choice is unambiguous here."),
  };
}

export function actions(): GameActions {
  return {
    compare_triangles: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } in the page's 450 x 450 board, y down; omit any for the opening triangle), run the real core and report where D and E fall, the lengths CD, CE, ON, OM and the angles at C and O, with the congruence verdict for triangle CDE against triangle ONM. A and B are the ends of the special side AB that is laid off (c = AB); C is the apex where CDE is built, with D on BC and E on AC. The note explains the signed-length caveat (a - c, b - c assume AB is shortest) and the one-pixel chord caveat; the four optional checkboxes default to off and do not change the geometry.",
      args: '{"A":[152,360],"B":[330,300],"C":[112,112]}',
      run: (args) => {
        const C = core();
        const s = actionState(C, args);
        return {
          roles: ROLES,
          options: {
            showNames: s.showNames, showStatement: s.showStatement,
            showPremise: s.showPremise, showHint: s.showHint,
          },
          ...reading(C, s),
        };
      },
    },

    chords_and_feet: {
      describe:
        "For the same triangle A, B, C, report the circle centred at the incenter I through the circumcenter O, the chords ON (parallel to CA) and OM (parallel to CB), the crossing L of ON with I's perpendicular to AC, and the feet Ip, Op of I and O on AC. It checks OL = LN = ON/2 (the centre's perpendicular bisects a chord) and that Ip and Op lie (a + b - c)/2 and b/2 from C, so their separation is |a - c|/2, which is why ON has length |a - c|. A and B are the ends of the laid-off side AB and C is the apex, so changing which point is called A, B or C changes which side plays the role of c; the default is the opening triangle.",
      args: '{"A":[152,360],"B":[330,300],"C":[112,112]}',
      run: (args) => {
        const C = core();
        const s = actionState(C, args);
        const r = reading(C, s);
        return {
          roles: ROLES,
          valid: r.valid,
          geometry: r.geometry,
          ...(r.valid
            ? { chord: r.chord, feet: r.feet, checks: r.checks, status: r.status }
            : { status: r.status }),
          note: r.valid
            ? `I is the centre of the circle through O, and ON is one of its chords. The line I-Ip is perpendicular to AC and ON is parallel to AC, so their crossing L is the foot of the perpendicular from the centre to the chord: it bisects ON, giving OL = LN = ON/2 = ${cn(r.chord.halfON)}. The feet of I and O on AC sit ${cn(r.feet.IpFromC)} and ${cn(r.feet.OpFromC)} from C, i.e. (a + b - c)/2 and b/2, so their separation ${cn(r.feet.separation)} is |a - c|/2 and the chord projection gives ON = |a - c| = CD. ${r.checks.chordShorterThanOnePixel ? "A chord under one pixel meets the applet's Other() tolerance." : "No chord here is under the applet's one-pixel Other() tolerance."}`
            : r.note,
        };
      },
    },
  };
}

/** Echo Track.state's fields, then re-measure the picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported In And Circumcenter D state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved In And Circumcenter D position must be an object");
  }
  const C = core();
  const src = state;
  const { s, readable } = savedState(C, src);
  const r = reading(C, s);
  const saved = {
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showNames: s.showNames, showStatement: s.showStatement,
    showPremise: s.showPremise, showHint: s.showHint,
  };
  return {
    ...src,
    stateVersion,
    savedReadable: readable,
    saved,
    valid: r.valid,
    ...(r.valid
      ? {
          sides: r.geometry.sides,
          cde: r.cde,
          onm: r.onm,
          congruent: r.checks.congruent,
          chord: r.chord,
          feet: r.feet,
          circleIO: r.geometry.circleIO,
        }
      : {}),
    status: r.status,
    note:
      (!readable
        ? "Some saved fields could not be read, so the opening triangle was reconstructed and the core reading below comes from it. "
        : "Track.state saved the three draggable corners and the four applet checkboxes; the page does not save derived points such as D, E, I, O, N, M or L. ") +
      (!r.valid
        ? r.note
        : `The real core rebuilds the construction from those corners: CD = ${cn(r.cde.CD)} = ON = ${cn(r.onm.ON)}, CE = ${cn(r.cde.CE)} = OM = ${cn(r.onm.OM)}, the angles at C and O are ${r.cde.angleAtC}° and ${r.onm.angleAtO}°, and triangle ONM is ${r.checks.congruent ? "congruent" : "not congruent within tolerance"} to CDE. ${r.signed.DAndELieOnSides ? "AB is the shortest side, so the signed lengths are positive." : "AB is not the shortest side, so a signed length is negative and D or E lies beyond C."} ${r.checks.chordShorterThanOnePixel ? "A chord is under one pixel, where the applet's Other() cannot pick its far end reliably." : "Neither chord is under the applet's one-pixel Other() tolerance."} This is an illustration with no win or loss; the tracker records exploration.`),
  };
}
