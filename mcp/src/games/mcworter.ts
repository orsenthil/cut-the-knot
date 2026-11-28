/*
 * run_game_logic actions and saved-position reader for McWorter.
 *
 * The real core is mcworter/mcworter-core.js, copied into src/generated/cores/
 * at build time; every geometric number below comes from it. Two squares are
 * erected on the sides CA and CB of a triangle, sharing the corner C. If A_b
 * is the far corner of the square on CB and B_a that of the square on CA, then
 * M = midpoint(A_b B_a) is the fixed centre of the square on AB (Bottema's
 * theorem). McWorter's own addition is that D = A + B - C, the fourth corner
 * of parallelogram ADBC, makes B_a D A_b an isosceles right triangle: the two
 * legs are equal and their dot product is zero.
 *
 * The first action runs the whole core drawing at a supplied triangle. The
 * second uses this core's own rotate()/dot()/distance() to write out the two
 * slider formulas of the *sibling* applet McWorter2 (K = (coef + 20)/20 and
 * angle = (angle + 90)°), so a tutor can show why the right angle at D is not
 * McWorter2's claim: at K = 0 its flanks collapse, and at a slanted angle the
 * midpoint still stays fixed but the corner at D is generally not 90°. That
 * sibling has its own core and reader (cores["mcworter-2"]); this module never
 * calls it. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type OutPt = { x: number; y: number };
type Diagram = {
  A: Pt; B: Pt; C: Pt;
  showNames: boolean; showLines: boolean; showHint: boolean;
};
type StartOptions = Partial<Diagram> & { points?: { A: Pt; B: Pt; C: Pt } };
type Figure = {
  A: Pt; B: Pt; C: Pt; Ab: Pt; Ac: Pt; Bc: Pt; Ba: Pt; M: Pt; D: Pt;
};
type ClaimKey =
  | "midpointIndependent" | "isoscelesAtD" | "rightAtD" | "parallelogram"
  | "squares" | "hintMarks" | "congruentTriangles";
type Claims = Record<ClaimKey, boolean>;

interface Core {
  HALF_PI: number;
  rotate(pivot: Pt, point: Pt, angle: number, orientation: number): Pt;
  distance(p: Pt, q: Pt): number;
  dot(u: Pt, v: Pt): number;
  close(a: number, b: number, tol: number): boolean;
  closePoint(p: Pt, q: Pt, tol: number): boolean;
  start(options?: StartOptions): Diagram;
  figure(s: Diagram): Figure;
  squareCentre(s: Diagram): Pt;
  hintLengths(s: Diagram): { two: number[]; three: number[] };
  claims(s: Diagram): Claims;
  angleAtD(s: Diagram): number;
  withPoint(s: Diagram, name: string, p: Pt): Diagram;
  withOption(s: Diagram, name: string, value: unknown): Diagram;
  result(): null;
}

type Sibling = {
  coef: number; angle: number; K: number; degrees: number;
  Ab: Pt; Ac: Pt; Ba: Pt; Bc: Pt; M: Pt; closedFormM: Pt; D: Pt;
  legToBa: number; legToAb: number; dotAtD: number; angleAtD: number;
  equalLegs: boolean; rightAngleAtD: boolean; equalFlankAngles: boolean;
  BaAtA: boolean; AbAtB: boolean; MmatchesClosedForm: boolean;
  midpointIndependentOfC: boolean;
};

const core = (): Core => cores["mcworter"].McworterCore as unknown as Core;

/* The core keeps full precision; only what the tutor reads is rounded. */
const n6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const angleOut = (v: number): number | null => (Number.isFinite(v) ? n6(v) : null);
const pt = (p: Pt | null | undefined): OutPt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: n6(p.x), y: n6(p.y) }
    : null;
const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const CLAIM_KEYS: ClaimKey[] = [
  "midpointIndependent", "isoscelesAtD", "rightAtD", "parallelogram",
  "squares", "hintMarks", "congruentTriangles",
];
const NOTE =
  "M is the midpoint of A_b B_a, the far corners of the squares on CB and CA. " +
  "It equals (A + B)/2 + R(A - B)/2, so every term in C cancels: Bottema's theorem. " +
  "D = A + B - C completes parallelogram ADBC, so AD = CB = B A_b and BD = CA = A B_a; " +
  "triangles AB_aD and BDA_b are congruent, giving equal legs at D. Because a " +
  "quarter turn is skew, the dot product of those legs is also zero, so angle B_aDA_b = 90°. " +
  "If both far corners land on D the triangle collapses and no angle is claimed.";

/** Tool arguments may use [x, y]; the page's Track.state uses { x, y }. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (isObj(raw)) {
    [x, y] = [Number(raw.x), Number(raw.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** The core's start() with the supplied points and strictly checked switches. */
function buildState(C: Core, args: Json, defaults?: Diagram): Diagram {
  if (!isObj(args)) throw new Error("arguments must be an object with A, B and C points");
  const flags = (key: "showNames" | "showLines" | "showHint"): boolean | undefined => {
    const v = args[key];
    if (v === undefined || v === null) return defaults ? defaults[key] : undefined;
    if (typeof v !== "boolean") throw new Error(`argument "${key}" must be a boolean`);
    return v;
  };
  return C.start({
    points: {
      A: readPoint(args.A, "A", defaults?.A),
      B: readPoint(args.B, "B", defaults?.B),
      C: readPoint(args.C, "C", defaults?.C),
    },
    showNames: flags("showNames"),
    showLines: flags("showLines"),
    showHint: flags("showHint"),
  });
}

/** Every claim and measurement the core makes at one diagram. */
function reading(C: Core, s: Diagram) {
  const f = C.figure(s);
  const cl = C.claims(s);
  const centre = C.squareCentre(s);
  const hints = C.hintLengths(s);
  const toBa = { x: f.Ba.x - f.D.x, y: f.Ba.y - f.D.y };
  const toAb = { x: f.Ab.x - f.D.x, y: f.Ab.y - f.D.y };
  const lenBa = Math.hypot(toBa.x, toBa.y);
  const lenAb = Math.hypot(toAb.x, toAb.y);
  const failed = CLAIM_KEYS.filter((k) => cl[k] !== true);
  return {
    vertices: { A: pt(f.A), B: pt(f.B), C: pt(f.C), D: pt(f.D) },
    squareOnCB: {
      corners: { B: pt(f.B), A_b: pt(f.Ab), A_c: pt(f.Ac), C: pt(f.C) },
      centre: pt(mid(f.B, f.Ac)),
    },
    squareOnCA: {
      corners: { C: pt(f.C), B_c: pt(f.Bc), B_a: pt(f.Ba), A: pt(f.A) },
      centre: pt(mid(f.C, f.Ba)),
    },
    farCorners: { A_b: pt(f.Ab), B_a: pt(f.Ba), segmentMidpoint: pt(f.M) },
    midpointClosedForm: pt(centre),
    distanceMtoClosedForm: n6(C.distance(f.M, centre)),
    legsAtD: {
      DtoB_a: pt(toBa), lengthB_a: n6(lenBa),
      DtoA_b: pt(toAb), lengthA_b: n6(lenAb),
      dotProduct: n6(C.dot(toBa, toAb)),
      equalLengths: cl.isoscelesAtD, perpendicular: cl.rightAtD,
    },
    angleB_aDA_bDegrees: angleOut(C.angleAtD(s)),
    hintLengths: { two: hints.two.map(n6), three: hints.three.map(n6) },
    claims: {
      midpointIndependent: cl.midpointIndependent,
      isoscelesAtD: cl.isoscelesAtD,
      rightAtD: cl.rightAtD,
      parallelogram: cl.parallelogram,
      squares: cl.squares,
      hintMarks: cl.hintMarks,
      congruentTriangles: cl.congruentTriangles,
      allHold: failed.length === 0,
      failed,
    },
    result: C.result(),
    note: NOTE,
  };
}

/**
 * McWorter2's ComputePoint/CompleteParallelogram written with this core's
 * rotate(), for one pair of scrollbar values. Angle 0 means a 90° quarter
 * turn; coef -20 means K = 0. The closed-form midpoint is (A + B)/2 +
 * K/2 · R(B - A), which still has no C in it.
 */
function siblingBasics(C: Core, s: Diagram, coef: number, angleSlider: number) {
  const K = (coef + 20) / 20;
  const degrees = angleSlider + 90;
  const theta = degrees * Math.PI / 180;
  const rC = C.rotate(s.C, s.B, theta, -1);
  const Ac = { x: s.C.x + K * (rC.x - s.C.x), y: s.C.y + K * (rC.y - s.C.y) };
  const Ab = { x: Ac.x + s.B.x - s.C.x, y: Ac.y + s.B.y - s.C.y };
  const rA = C.rotate(s.A, s.C, theta, -1);
  const Ba = { x: s.A.x + K * (rA.x - s.A.x), y: s.A.y + K * (rA.y - s.A.y) };
  const Bc = { x: Ba.x + s.C.x - s.A.x, y: Ba.y + s.C.y - s.A.y };
  const M = mid(Ba, Ab);
  const rotBA = C.rotate(s.A, s.B, theta, -1);
  const closedFormM = {
    x: (s.A.x + s.B.x + K * (rotBA.x - s.A.x)) / 2,
    y: (s.A.y + s.B.y + K * (rotBA.y - s.A.y)) / 2,
  };
  const D = { x: s.A.x + s.B.x - s.C.x, y: s.A.y + s.B.y - s.C.y };
  const u = { x: Ba.x - D.x, y: Ba.y - D.y };
  const v = { x: Ab.x - D.x, y: Ab.y - D.y };
  const scale = Math.max(1, C.distance(s.A, s.B));
  const tol = 1e-8 * scale;
  const legToBa = Math.hypot(u.x, u.y);
  const legToAb = Math.hypot(v.x, v.y);
  const dotAtD = C.dot(u, v);
  const live = legToBa > 1e-9 * scale && legToAb > 1e-9 * scale;
  return {
    coef, angle: angleSlider, K, degrees: n6(degrees),
    Ab, Ac, Ba, Bc, M, closedFormM, D,
    legToBa, legToAb, dotAtD,
    angleAtD: live
      ? Math.acos(Math.max(-1, Math.min(1, dotAtD / (legToBa * legToAb)))) * 180 / Math.PI
      : NaN,
    equalLegs: C.close(legToBa, legToAb, tol),
    rightAngleAtD: live && C.close(dotAtD, 0, tol),
    // The two flanks are similar parallelograms with one shared angle; at
    // K = 0 their rotated edges have zero length and that angle is undefined.
    equalFlankAngles: K > 0,
    BaAtA: C.closePoint(Ba, s.A, tol),
    AbAtB: C.closePoint(Ab, s.B, tol),
    MmatchesClosedForm: C.closePoint(M, closedFormM, 1e-7 * scale),
  };
}

/** The sibling's M at several positions of C, to show it is still fixed. */
function siblingIndependence(C: Core, s: Diagram, coef: number, angleSlider: number) {
  const home = siblingBasics(C, s, coef, angleSlider);
  const others = [
    { x: 60, y: 60 }, { x: 190, y: 30 }, { x: 360, y: 230 }, { x: 100, y: 240 },
  ].map((c) => siblingBasics(C, C.withPoint(s, "C", c), coef, angleSlider));
  const worst = Math.max(...others.map((r) => C.distance(r.M, home.M)));
  return {
    Ms: [home.M, ...others.map((r) => r.M)].map(pt),
    maxDrift: n6(worst),
    independent: worst < 1e-8 * Math.max(1, C.distance(s.A, s.B)),
  };
}

/** Shape a sibling row for the tutor, with no raw internal points leaked. */
function siblingRow(C: Core, s: Diagram, coef: number, angleSlider: number) {
  const b = siblingBasics(C, s, coef, angleSlider);
  return {
    coef, angleSlider, K: n6(b.K), angleDegrees: b.degrees,
    farCorners: { A_b: pt(b.Ab), B_a: pt(b.Ba) },
    otherCorners: { A_c: pt(b.Ac), B_c: pt(b.Bc) },
    D: pt(b.D),
    M: pt(b.M), closedFormM: pt(b.closedFormM),
    legs: {
      toB_a: n6(b.legToBa), toA_b: n6(b.legToAb), dotAtD: n6(b.dotAtD),
      angleAtD: angleOut(b.angleAtD),
    },
    equalLegs: b.equalLegs,
    rightAngleAtD: b.rightAngleAtD,
    equalFlankAngles: b.equalFlankAngles,
    B_aAtA: b.BaAtA,
    A_bAtB: b.AbAtB,
    MmatchesClosedForm: b.MmatchesClosedForm,
    independenceOverC: siblingIndependence(C, s, coef, angleSlider),
  };
}

/** The two McWorter2 scrollbars as the applet's panel converts them. */
function slider(args: Json, key: "coef" | "angle", fallback: number, min: number, max: number): number {
  const v = num(args, key, fallback);
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new Error(`argument "${key}" must be a whole number from ${min} to ${max}`);
  }
  return v;
}

const POINTS_ARGS =
  '{"A":[154,208.33333333333331],"B":[250,208.33333333333331],' +
  '"C":[225,123.36539647744473]}';

export function actions(): GameActions {
  return {
    right_triangle_at_d: {
      describe:
        "At A, B, C (each [x, y] or {x, y} in the core's 400 x 250 board units, y downward), erect the two squares on CB and CA that share C and set D = A + B - C. Runs the real McWorter core and reports the square corners, D, M, the two legs D→B_a and D→A_b, their lengths and dot product, angle B_aDA_b in degrees, the hint's matching sides and all seven claim checks. A non-collapsed figure has equal legs, a zero dot product, a 90° angle and M equal to the closed form (A + B)/2 + R(A - B)/2; if both far corners fall on D the angle is null. Optional showNames, showLines and showHint must be booleans. The example uses the points saved by the live fixture.",
      args: POINTS_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        return {
          position: {
            A: pt(s.A), B: pt(s.B), C: pt(s.C),
            showNames: s.showNames, showLines: s.showLines, showHint: s.showHint,
          },
          ...reading(C, s),
        };
      },
    },

    sibling_parallelograms: {
      describe:
        "McWorter itself has no sliders: its flanks are squares (K = 1 and a quarter turn). Its sibling McWorter2 (a separate port with its own core) replaces them with similar parallelograms using integer scrollbars coef (-20..28, K = (coef + 20)/20) and angle (-90..90, angle + 90 degrees). This action transcribes those two slider formulas on top of the McWorter core's rotate(), distance() and dot() and compares three settings: the square default, K = 0 (where B_a collapses onto A and A_b onto B, so the flanks' angle claim is undefined) and a slanted 150-degree parallelogram (where M stays fixed but the right angle at D generally fails). Optional coef and angle add your own setting; it sweeps C to test the midpoint claim. It does not call the mcworter-2 core.",
      args: '{"A":[154,208.33333333333331],"B":[250,208.33333333333331],' +
        '"C":[225,123.36539647744473],"coef":-20,"angle":60}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const coef = slider(args, "coef", 0, -20, 28);
        const angleSlider = slider(args, "angle", 0, -90, 90);
        const square = siblingBasics(C, s, 0, 0);
        const f = C.figure(s);
        const tol = 1e-8 * Math.max(1, C.distance(s.A, s.B));
        const squaresAgree = C.closePoint(square.Ab, f.Ab, tol) &&
          C.closePoint(square.Ba, f.Ba, tol) &&
          C.closePoint(square.M, C.squareCentre(s), tol);
        const collapsed = siblingRow(C, s, -20, 0);
        const slanted = siblingRow(C, s, 0, 60);
        const rows: Json[] = [
          { label: "mcworter_square_default", ...siblingRow(C, s, 0, 0) },
          { label: "K_zero_collapse", ...collapsed },
          { label: "slanted_counterexample", ...slanted },
        ];
        if (args.coef !== undefined || args.angle !== undefined) {
          rows.push({ label: "your_sliders", ...siblingRow(C, s, coef, angleSlider) });
        }
        return {
          A: pt(s.A), B: pt(s.B), C: pt(s.C),
          sliderRanges: { coef: [-20, 28], angle: [-90, 90] },
          squareSettingsAgreeWithMcworterCore: squaresAgree,
          rows,
          note:
            "At coef = 0 and angle = 0, McWorter2's sliders give K = 1 and a 90° turn, so its " +
            "far corners and M coincide with this applet's squares. At coef = -20 the scale K is " +
            "0: both flanks collapse onto their sides, the midpoint formula survives, but the " +
            "angle between zero-length edges does not exist. " +
            (slanted.rightAngleAtD
              ? "The slanted row happens to keep a right angle at this particular triangle, but " +
                "that is not McWorter2's claim."
              : `The slanted row has dot product ${n6(slanted.legs.dotAtD as number)} and angle ` +
                `${angleOut(slanted.legs.angleAtD as number)}° at D, even though its M is fixed: ` +
                "the right angle belongs to squares, not to general similar parallelograms."),
        };
      },
    },
  };
}

/** Echo what Track.state saved, then re-measure the picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported McWorter state version ${stateVersion}`);
  if (!isObj(state)) throw new Error("saved McWorter position must be an object");
  const C = core();
  const defaults = C.start({});
  const s = buildState(C, state, defaults);
  const f = C.figure(s);
  return {
    // The fields the page saved with Track.state, with the same names.
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showNames: s.showNames, showLines: s.showLines, showHint: s.showHint,
    // What the core adds.
    reading: reading(C, s),
    D: pt(f.D),
    note:
      "Track.state saved the three draggable points A, B, C and the three independent display " +
      "switches in the applet's 400 x 250 board units (the page frames them in a 400 x 280 " +
      "viewBox). The core re-erects the two squares, sets D = A + B - C, and checks that M is " +
      "the fixed square centre on AB and that B_a D A_b is isosceles with a right angle at D. " +
      "This is an illustration, so there is no win or loss.",
  };
}
