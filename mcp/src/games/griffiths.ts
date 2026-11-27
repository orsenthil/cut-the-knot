/*
 * run_game_logic actions and saved-position reader for Griffiths.
 *
 * The real core is griffiths/griffiths-core.js, copied into
 * src/generated/cores/ at build time; every measurement below comes from it.
 * Coordinates are board units of the applet's 500 x 300 view, y downward.
 *
 * This is ONE triangle A1A2A3, its circumcentre O, and a line through O
 * carrying two points P and Q. Griffiths' claim is that as a point slides on
 * that line its pedal circle always passes through the same point of the
 * nine-point circle. With O at the origin, the circumcircle the unit circle
 * and the line the real axis, and a1, a2, a3 the vertices, that fixed point is
 *
 *   w = (a1 + a2 + a3 - a1 a2 a3) / 2.
 *
 * There is no p in the formula. This is NOT Four Griffiths (four vertices on
 * one circle, four triangles, four collinear Griffiths points with
 * w_m = (a_i+a_j+a_k-a_i a_j a_k)/2) nor Griffiths Collinearity (a line cuts
 * the three sides, the three pedal circles are coaxal and their centres are
 * collinear). See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["griffiths"].GriffithsCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Geometry = NonNullable<ReturnType<Core["geometry"]>>;
type Pt = { x: number; y: number };
type Circ = { c: Pt; r: number };
type Complex = { re: number; im: number };

const EPS = 1e-9;
const TOL = 1e-4;       // board units: residuals of the drawn constructions
const UNIT_TOL = 1e-6;  // unit-circle complex residuals

const DISTINCTION =
  "One triangle, one line through its circumcentre and one fixed Griffiths point on that triangle's nine-point circle: " +
  "w = (a1 + a2 + a3 - a1 a2 a3)/2. This is not Four Griffiths (four points on one circle give four triangles whose Griffiths points are collinear and whose pedal circles share a dot) " +
  "nor Griffiths Collinearity (a line cuts the three sides; the three pedal circles are coaxal and their centres are collinear).";

const r6 = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(6)) : null;
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x)!, y: r6(p.y)! } : null;
const circleOut = (c: Circ | null | undefined) =>
  c ? { center: pt(c.c), radius: r6(c.r) } : null;
const dist = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y);
const circleResidualAt = (c: Circ, p: Pt): number => Math.abs(dist(c.c, p) - c.r);

/** Accept the page's saved { x, y } and the short [x, y] form of JSON args. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${label}" needs finite x and y`);
  return { x, y };
}

/** A saved circle from Track.state, or null when the field is absent. */
function readCircle(raw: unknown, label: string): Circ | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error(`saved ${label} must be { c, r }`);
  const o = raw as Json;
  const c = readPoint(o.c, `${label}.c`);
  const r = Number(o.r);
  if (!Number.isFinite(r)) throw new Error(`saved ${label}.r must be a number`);
  return { c, r };
}
const safeCircle = (v: unknown, label: string) => {
  try { return circleOut(readCircle(v, label)); } catch { return null; }
};

/**
 * Build a core state from JSON args the way the page's drags do: moving A, B
 * or C re-centres O and carries Q with the line parameter, moving P carries Q
 * with the same parameter, and moving Q projects it to the line OP. Omitted
 * points keep the core's opening illustration.
 */
function buildFromArgs(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C, P, Q points and optional options");
  }
  let s = C.start({});
  for (const name of ["A", "B", "C", "P", "Q"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.move(s, name, readPoint(args[name], name));
    }
  }
  if (args.options && typeof args.options === "object") {
    const o = args.options as Json;
    for (const name of ["perps", "circles"] as const) {
      if (o[name] !== undefined) s = C.setOption(s, name, o[name]);
    }
  }
  return s;
}

/** A state rebuilt from a Track.state payload, without re-projecting Q. */
function stateFromSaved(C: Core, state: Json): State {
  const seed = C.start({});
  const o = state.options && typeof state.options === "object" ? state.options as Json : {};
  return {
    ...seed,
    A: readPoint(state.A, "saved A", seed.A),
    B: readPoint(state.B, "saved B", seed.B),
    C: readPoint(state.C, "saved C", seed.C),
    P: readPoint(state.P, "saved P", seed.P),
    Q: readPoint(state.Q, "saved Q", seed.Q),
    options: { perps: o.perps === true, circles: o.circles === true },
    explored: true,
  };
}

/* Complex arithmetic on the unit circle, kept separate from board points. */
const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a: Complex, b: Complex): Complex =>
  ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cscale = (a: Complex, k: number): Complex => ({ re: a.re * k, im: a.im * k });
const cabs = (a: Complex): number => Math.hypot(a.re, a.im);
const cpt = (z: Complex) => ({ real: r6(z.re), imaginary: r6(z.im) });

/** Every measurement, derived from the core's geometry on one core state. */
function reading(C: Core, s: State, g: Geometry) {
  const O = g.O as Pt;
  const circle = g.circle as Circ | null;
  const R = circle ? circle.r : 0;
  const direction = { x: s.P.x - O.x, y: s.P.y - O.y };
  if (!(Math.hypot(direction.x, direction.y) > EPS)) {
    throw new Error("P sits on O, so the line OP has no direction; move P away from O");
  }

  // Turn OP into the real axis, scale by R about O, and use the page's w.
  const theta = Math.atan2(direction.y, direction.x);
  const ux = Math.cos(theta), uy = Math.sin(theta);
  const toUnit = (p: Pt): Complex => {
    const x = (p.x - O.x) / R, y = (p.y - O.y) / R;
    return { re: x * ux + y * uy, im: y * ux - x * uy }; // multiply by e^{-i theta}
  };
  const fromUnit = (z: Complex): Pt => ({
    x: O.x + R * (z.re * ux - z.im * uy),
    y: O.y + R * (z.re * uy + z.im * ux),          // multiply by e^{i theta}
  });
  const a = [toUnit(s.A), toUnit(s.B), toUnit(s.C)];
  const sum = cadd(cadd(a[0], a[1]), a[2]);
  const product = cmul(cmul(a[0], a[1]), a[2]);
  const w = cscale(csub(sum, product), 0.5);
  const predicted = fromUnit(w);

  const pedalPResidual = g.Pcircle ? circleResidualAt(g.Pcircle as Circ, predicted) : null;
  const pedalQResidual = g.Qcircle ? circleResidualAt(g.Qcircle as Circ, predicted) : null;
  const nineResidual = g.nine ? circleResidualAt(g.nine as Circ, predicted) : null;
  const unitNineResidual = Math.abs(cabs(csub(w, cscale(sum, 0.5))) - 0.5);
  const coreDotResidual = g.common ? dist(predicted, g.common as Pt) : null;
  const holds = [pedalPResidual, pedalQResidual, nineResidual, unitNineResidual]
    .every((v) => v !== null && v < TOL);

  // Slide a second point along the same line: w must not depend on it.
  const slides = [0.25, 0.5, 0.8, 1.2, 1.8, 2.2].map((k) => {
    const at: Pt = { x: O.x + direction.x * k, y: O.y + direction.y * k };
    const y = C.geometry({ ...s, Q: at });
    const residual = y && y.Qcircle ? circleResidualAt(y.Qcircle as Circ, predicted) : null;
    return {
      k,
      at: pt(at),
      pedalCircle: y && y.Qcircle ? circleOut(y.Qcircle as Circ) : null,
      residualToW: sig(residual),
      corePickedDot: y && y.common ? pt(y.common as Pt) : null,
      holds: residual !== null && residual < TOL,
    };
  });

  // The explanation also says the nine-point circle is the pedal circle of O.
  const atO = C.circleOf(
    C.nearestPoint(O, s.A, s.B), C.nearestPoint(O, s.B, s.C), C.nearestPoint(O, s.C, s.A),
  );
  const pedalAtO = atO && g.nine ? {
    pedalCircleOfO: circleOut(atO),
    centerDifference: sig(dist(atO.c, (g.nine as Circ).c)),
    radiusDifference: sig(Math.abs(atO.r - (g.nine as Circ).r)),
    holds: dist(atO.c, (g.nine as Circ).c) < TOL && Math.abs(atO.r - (g.nine as Circ).r) < TOL,
  } : null;

  return {
    board: { width: C.VIEW.width, height: C.VIEW.height },
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    O: pt(O),
    circumcircle: circleOut(circle),
    line: { through: [pt(O), pt(s.P)], direction: pt(direction), angleRadians: r6(theta) },
    P: pt(s.P), Q: pt(s.Q),
    pedalCircleOfP: circleOut(g.Pcircle as Circ | null),
    pedalCircleOfQ: circleOut(g.Qcircle as Circ | null),
    ninePointCircle: circleOut(g.nine as Circ | null),
    corePickedDot: g.common ? pt(g.common as Pt) : null,
    unitCircle: {
      formula: "w = (a1 + a2 + a3 - a1*a2*a3)/2",
      vertices: a.map((z, i) => ({ [`a${i + 1}`]: cpt(z), modulus: r6(cabs(z)) })),
      a1_plus_a2_plus_a3: cpt(sum),
      a1_times_a2_times_a3: cpt(product),
      w: cpt(w),
      ninePointCentre: cpt(cscale(sum, 0.5)),
      ninePointRadius: r6(0.5),
      predictedBoardPoint: pt(predicted),
      residuals: {
        onPedalCircleOfP: sig(pedalPResidual),
        onPedalCircleOfQ: sig(pedalQResidual),
        onNinePointCircle: sig(nineResidual),
        onNinePointCircleInUnitCoordinates: sig(unitNineResidual),
        matchesCorePickedDot: sig(coreDotResidual),
      },
      holds,
      note: "Residuals are distances in board units (the unit-circle one is in radius-1 units); matchesCorePickedDot can be large because the applet keeps the first circle pair within sqrt(2) pixels, which can be a near miss when P and Q are close.",
    },
    slides,
    ninePointIsPedalCircleOfO: pedalAtO,
    claimHolds: holds && slides.every((v) => v.holds) && Boolean(pedalAtO && pedalAtO.holds),
    distinction: DISTINCTION,
  };
}

export function actions(): GameActions {
  const example = '{"A":[252.08,50.04],"B":[184.64,225.68],"C":[348.01,130.13],"P":[229.19,195.46],"Q":[222.25,210.61]}';
  return {
    griffiths_point: {
      describe:
        "For one triangle A, B, C and two points P, Q on a line through its circumcentre O (each [x, y] or { x, y } in the 500 x 300 board, y downward; omit any to keep the opening drawing), report the circumcircle, the nine-point circle, the two pedal circles and the fixed Griffiths point where they meet. It also gives that point on the unit circle with O at the origin and OP the real axis, w = (a1 + a2 + a3 - a1 a2 a3) / 2, mapped back to board coordinates, with residuals against the core circles. This is one triangle on one line, not Four Griffiths or Griffiths Collinearity.",
      args: example,
      run: (args) => {
        const C = core();
        const s = buildFromArgs(C, args);
        const g = C.geometry(s);
        if (!g) throw new Error("A, B and C are too close to one line to have a circumcircle; move a triangle corner");
        const r = reading(C, s, g);
        return {
          ...r,
          note: "The core measures the two pedal circles and the nine-point circle; w is the same Griffiths point written in unit-circle coordinates. It has no p in it, so sliding Q along OP does not move it. This is a drawing with no win or loss.",
        };
      },
    },
    check_theorem: {
      describe:
        "Check Griffiths' claim for the same triangle and line: w from the unit-circle formula lies on both pedal circles and the nine-point circle, sliding Q to several other points of OP leaves w on each new pedal circle, and the nine-point circle is the pedal circle of O. Returns measured residuals and a claimHolds boolean; the distinction from Four Griffiths (four triangles and four collinear points) and Griffiths Collinearity (three coaxal pedal circles) is stated in the result. Requires a non-flat triangle and P away from O; omitted points keep the opening drawing.",
      args: example,
      run: (args) => {
        const C = core();
        const s = buildFromArgs(C, args);
        const g = C.geometry(s);
        if (!g) throw new Error("A, B and C are too close to one line to have a circumcircle; move a triangle corner");
        const r = reading(C, s, g);
        return {
          triangle: r.triangle,
          O: r.O,
          line: r.line,
          griffithsPoint: r.unitCircle.predictedBoardPoint,
          unitCircle: r.unitCircle,
          slides: r.slides,
          ninePointIsPedalCircleOfO: r.ninePointIsPedalCircleOfO,
          claimHolds: r.claimHolds,
          distinction: r.distinction,
          note: "The check uses the formula's point, not the applet's pixel-picked dot: FindCommon takes the first circle pair within sqrt(2) pixels, which can be a near miss when P and Q are close. This is an illustration with no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure them with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const o = state.options && typeof state.options === "object" ? state.options as Json : {};
  const saved = {
    A: pt(state.A === undefined || state.A === null ? null : readPoint(state.A, "saved A")),
    B: pt(state.B === undefined || state.B === null ? null : readPoint(state.B, "saved B")),
    C: pt(state.C === undefined || state.C === null ? null : readPoint(state.C, "saved C")),
    P: pt(state.P === undefined || state.P === null ? null : readPoint(state.P, "saved P")),
    Q: pt(state.Q === undefined || state.Q === null ? null : readPoint(state.Q, "saved Q")),
    O: pt(state.O === undefined || state.O === null ? null : readPoint(state.O, "saved O")),
    common: pt(state.common === undefined || state.common === null ? null : readPoint(state.common, "saved common")),
    Pcircle: safeCircle(state.Pcircle, "Pcircle"),
    Qcircle: safeCircle(state.Qcircle, "Qcircle"),
    nine: safeCircle(state.nine, "nine"),
    options: { perps: o.perps === true, circles: o.circles === true },
  };
  try {
    const here = stateFromSaved(C, state);
    const g = C.geometry(here);
    if (!g) {
      return {
        stateVersion, saved, reading: null,
        note: "The saved triangle corners are too close to one line for a circumcircle, so there is no Griffiths point to measure.",
      };
    }
    const r = reading(C, here, g);
    return {
      stateVersion,
      saved,
      reading: r,
      check_theorem: {
        griffithsPoint: r.unitCircle.predictedBoardPoint,
        unitCircle: r.unitCircle,
        slides: r.slides,
        ninePointIsPedalCircleOfO: r.ninePointIsPedalCircleOfO,
        claimHolds: r.claimHolds,
      },
      note: "Track.state saved the five draggable points, the derived O, the core's picked dot, the three circles and the two show options. The core rebuilds the pedal and nine-point circles and checks the fixed Griffiths point w = (a1 + a2 + a3 - a1 a2 a3)/2 from A, B, C, P and Q. This is a drawing with no win or loss; moving something only marks the exploration done. " + DISTINCTION,
    };
  } catch (e) {
    return { stateVersion, saved, reading: null, note: `The saved position cannot be measured: ${(e as Error).message}` };
  }
}
