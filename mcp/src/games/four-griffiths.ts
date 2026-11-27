/*
 * run_game_logic actions and saved-position reader for Four Griffiths.
 *
 * The real core is four-griffiths/four-griffiths-core.js, copied into
 * src/generated/cores/ at build time; every measurement below comes from it.
 *
 * ABCD is a quadrilateral inscribed in one circle and l is the line through
 * its centre O and a point L. Each of the four triangles made from three of
 * A, B, C, D has a Griffiths point on l: the point its nine-point circle and
 * the pedal circle of any point of l share. The four Griffiths points are
 * collinear, the four pedal circles pass through one common point on that
 * line, and the four nine-point circles pass through one common point.
 *
 * On the unit circle, with l turned into the real axis and a1..a4 the four
 * vertices, the Griffiths point of the triangle that omits am is
 *
 *   w_m = (a_i + a_j + a_k - a_i a_j a_k) / 2,
 *
 * and (w1 - w2)/(w1' - w2') = a1 a2 a3 a4 for every pair, a fixed ratio of
 * differences, which is why the four points lie on one line. Coordinates here
 * are board units of the illustration's 600 x 550 view, y downward.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["four-griffiths"].FourGriffithsCore;
type Core = ReturnType<typeof core>;
type Pt = { x: number; y: number };
type Circ = { c: Pt; r: number };

const EPS = 1e-9;
const TOL = 1e-4;      // board units: residuals of the drawn constructions
const FORMULA_TOL = 1e-6; // unit-circle complex residuals

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Pt | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const circleOut = (c: Circ | null | undefined) =>
  c ? { center: pt(c.c), radius: r6(c.r) } : null;
const finite = (values: Array<number | null>): number[] =>
  values.filter((v): v is number => v !== null && Number.isFinite(v));
const maxAbs = (values: Array<number | null>): number | null => {
  const f = finite(values);
  return f.length ? Math.max(...f.map(Math.abs)) : null;
};

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

/**
 * Build a core state from JSON args the way the page's drags do: moving A, B
 * or C projects D back onto the new circumcircle, and moving D leaves it where
 * it is dropped. Omitted points keep the core's opening illustration.
 */
function buildFromArgs(C: Core, args: Json) {
  let s = C.start({});
  for (const name of ["A", "B", "C", "D", "L"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.move(s, name, readPoint(args[name], name));
    }
  }
  if (args.options && typeof args.options === "object") {
    const o = args.options as Json;
    for (const name of ["names", "circles", "lines"] as const) {
      if (o[name] !== undefined) s = C.setOption(s, name, o[name]);
    }
  }
  return s;
}

/** A state reconstructed from a Track.state payload, without re-projecting D. */
function stateFromSaved(C: Core, state: Json) {
  const seed = C.start({});
  const s: Json = { ...(seed as unknown as Json) };
  for (const name of ["A", "B", "C", "D", "L"] as const) {
    s[name] = readPoint(state[name], `saved ${name}`, seed[name] as Pt);
  }
  const o = state.options && typeof state.options === "object" ? state.options as Json : {};
  s.options = { names: o.names === true, circles: o.circles === true, lines: o.lines === true };
  s.explored = true;
  return s as ReturnType<Core["start"]>;
}

/* Complex numbers for the unit-circle formula, kept separate from board points. */
type Complex = { re: number; im: number };
const cadd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a: Complex, b: Complex): Complex =>
  ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  if (d < EPS) throw new Error("two Griffiths points coincide, so their difference ratio is undefined");
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};
const cconj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
const cscale = (a: Complex, k: number): Complex => ({ re: a.re * k, im: a.im * k });
const cabs = (a: Complex): number => Math.hypot(a.re, a.im);
const cpt = (z: Complex) => ({ real: r6(z.re), imaginary: r6(z.im) });

const TRIPLES = [["B", "C", "D"], ["A", "C", "D"], ["A", "B", "D"], ["A", "B", "C"]] as const;
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]] as const;

/**
 * The common point of the four nine-point circles: try their pairwise meets
 * and keep the candidate closest to all four circumferences.
 */
function ninePointMeet(C: Core, circles: Array<Circ | null>) {
  let best: Pt | null = null;
  let bestResiduals: number[] = [];
  let bestMax = Infinity;
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      if (!circles[i] || !circles[j]) continue;
      for (const p of C.circleIntersections(circles[i]!.c, circles[i]!.r, circles[j]!.c, circles[j]!.r)) {
        const residuals = circles.map((c) => c ? Math.abs(C.distance(c.c, p) - c.r) : Infinity);
        const m = Math.max(...residuals);
        if (m < bestMax) { bestMax = m; bestResiduals = residuals; best = p; }
      }
    }
  }
  return best ? { point: pt(best), residuals: bestResiduals.map(sig), maxResidual: sig(bestMax) } : null;
}

/** Every measurement, derived from C.geometry on one core state. */
function measure(C: Core, s: ReturnType<Core["start"]>) {
  const g = C.geometry(s);
  if (!g) {
    return {
      circle: null, griffithsPoints: [null, null, null, null], griffithsLine: null,
      collinear: null, pedalConcurrence: null, ninePointConcurrence: null, unitCircle: null,
      description: C.describe(s),
      note: "A, B and C lie on one line, so there is no circumcircle and no Griffiths points to measure.",
    };
  }

  const O = g.circle.c as Pt, R = g.circle.r as number;
  const G = g.G as Array<Pt | null>;
  const lineG = g.lineG as [Pt, Pt] | null;

  const toLine = G.map((p) => p && lineG ? C.distanceToLine(p, lineG[0], lineG[1]) : null);
  const collinearMax = maxAbs(toLine);

  const pedalResiduals = (g.pedalCircles as Array<Circ | null>).map((c) =>
    c && g.P ? C.distance(c.c, g.P as Pt) - c.r : null);
  const pedalThroughG = G.map((p, i) => {
    const c = (g.pedalCircles as Array<Circ | null>)[i];
    return p && c ? C.distance(c.c, p) - c.r : null;
  });

  const nine = ninePointMeet(C, g.nineCircles as Array<Circ | null>);
  const nineThroughG = G.map((p, i) => {
    const c = (g.nineCircles as Array<Circ | null>)[i];
    return p && c ? C.distance(c.c, p) - c.r : null;
  });

  // Turn the picture so l (O -> L) is the real axis, then scale by R about O.
  let unitCircle: unknown = null;
  const d = C.distance(O, g.L as Pt);
  if (d > EPS && R > EPS) {
    const u: Complex = { re: ((g.L as Pt).x - O.x) / d, im: ((g.L as Pt).y - O.y) / d };
    const ubar = cconj(u);
    const toUnit = (p: Pt): Complex => cscale(cmul({ re: p.x - O.x, im: p.y - O.y }, ubar), 1 / R);
    const names = ["A", "B", "C", "D"] as const;
    const a: Record<string, Complex> = {
      A: toUnit(g.A as Pt), B: toUnit(g.B as Pt), C: toUnit(g.C as Pt), D: toUnit(g.D as Pt),
    };
    const ws = TRIPLES.map((t) => {
      const sum = cadd(cadd(a[t[0]], a[t[1]]), a[t[2]]);
      const product = cmul(cmul(a[t[0]], a[t[1]]), a[t[2]]);
      return cscale(csub(sum, product), 0.5);
    });
    const predicted = ws.map((w) => ({
      x: O.x + R * (w.re * u.re - w.im * u.im),
      y: O.y + R * (w.re * u.im + w.im * u.re),
    }));
    const formulaResiduals = predicted.map((p, i) => G[i] ? C.distance(p, G[i]!) : null);
    const product4 = cmul(cmul(cmul(a.A, a.B), a.C), a.D);
    const ratios = PAIRS.map(([i, j]) => {
      const ratio = cdiv(csub(ws[i], ws[j]), csub(cconj(ws[i]), cconj(ws[j])));
      return {
        pair: `w${i + 1}-w${j + 1}`,
        ratio: cpt(ratio),
        residual: sig(cabs(csub(ratio, product4))),
      };
    });
    unitCircle = {
      verticesOnUnitCircle: names.map((n) => ({ [n]: cpt(a[n]), modulus: r6(cabs(a[n])) })),
      w: ws.map((w, i) => ({ triangle: `omits ${names[i]}`, value: cpt(w) })),
      predictedGriffithsPoints: predicted.map(pt),
      formulaResiduals: formulaResiduals.map(sig),
      commonRatio: cpt(product4),
      differenceRatios: ratios,
      maxFormulaResidual: sig(maxAbs(formulaResiduals)),
      maxRatioResidual: sig(maxAbs(ratios.map((r) => r.residual))),
      holds: (maxAbs(formulaResiduals) ?? Infinity) < TOL
        && ratios.every((r) => r.residual !== null && r.residual < FORMULA_TOL),
    };
  }

  return {
    circle: circleOut(g.circle as Circ),
    line_l: { through: [pt((g.line as [Pt, Pt])[0]), pt((g.line as [Pt, Pt])[1])] },
    griffithsPoints: G.map(pt),
    griffithsLine: lineG ? { through: [pt(lineG[0]), pt(lineG[1])] } : null,
    collinear: {
      distancesToLine: toLine.map(sig),
      maxResidual: sig(collinearMax),
      holds: collinearMax !== null && collinearMax < TOL,
    },
    pedalConcurrence: g.P ? {
      point: pt(g.P as Pt),
      circleResiduals: pedalResiduals.map(sig),
      eachCircleThroughItsGriffithsPoint: pedalThroughG.map(sig),
      maxResidual: sig(maxAbs(pedalResiduals)),
      holds: maxAbs(pedalResiduals) !== null && maxAbs(pedalResiduals)! < TOL,
    } : null,
    ninePointConcurrence: nine ? {
      ...nine,
      eachCircleThroughItsGriffithsPoint: nineThroughG.map(sig),
      holds: nine.maxResidual !== null && nine.maxResidual < TOL,
    } : null,
    unitCircle,
    description: C.describe(s),
    note: "The four Griffiths points are measured from the nine-point and pedal circles by the core; w_m is the same point written on the unit circle with l as the real axis.",
  };
}

/** The picture, for someone who wants the objects rather than the tests. */
function picture(C: Core, s: ReturnType<Core["start"]>) {
  const m = measure(C, s);
  return {
    circle: m.circle,
    line_l: m.line_l,
    griffithsPoints: m.griffithsPoints,
    griffithsLine: m.griffithsLine,
    pedalMeet: m.pedalConcurrence && {
      point: m.pedalConcurrence.point, maxResidual: m.pedalConcurrence.maxResidual,
    },
    ninePointMeet: m.ninePointConcurrence && {
      point: m.ninePointConcurrence.point, maxResidual: m.ninePointConcurrence.maxResidual,
    },
    note: m.note,
    description: m.description,
  };
}

export function actions(): GameActions {
  return {
    griffiths_points: {
      describe:
        "For a cyclic quadrilateral A, B, C, D and a point L (each [x, y] or { x, y } in the 600 x 550 board, y downward), report the circumcircle, the line l through the centre O and L, the four Griffiths points (one for each triangle of three vertices), the line they lie on, and the common points of the four pedal circles and of the four nine-point circles, each with a residual in board units. Moving A, B or C keeps D on the new circle, as on the page; omit any point for the opening diagram.",
      args: '{ "A": [185, 165], "B": [420, 385], "C": [420, 165], "L": [327.273, 412.5] }',
      run: (args) => picture(core(), buildFromArgs(core(), args)),
    },
    check_theorems: {
      describe:
        "Check the page's claims for the same quadrilateral: the four Griffiths points are collinear, the four pedal circles pass through one point on that line, the four nine-point circles pass through one point, and on the unit circle w_m = (a_i+a_j+a_k-a_i a_j a_k)/2 with (w1-w2)/(w1'-w2') = a1a2a3a4 for every pair. Returns a boolean and measured residuals for each, plus the unit-circle values with l turned into the real axis. Requires A, B, C and L to be non-degenerate; omitted points keep the opening diagram.",
      args: '{ "A": [185, 165], "B": [420, 385], "C": [420, 165], "L": [327.273, 412.5] }',
      run: (args) => {
        const C = core();
        const m = measure(C, buildFromArgs(C, args));
        return {
          collinear: m.collinear,
          pedalConcurrence: m.pedalConcurrence,
          ninePointConcurrence: m.ninePointConcurrence,
          unitCircle: m.unitCircle,
          allHold: Boolean(m.collinear?.holds && m.pedalConcurrence?.holds
            && m.ninePointConcurrence?.holds && (m.unitCircle as { holds?: boolean } | null)?.holds),
          note: m.note,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure them with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const saved = {
    A: pt(readPoint(state.A, "saved A", C.start().A as Pt)),
    B: pt(readPoint(state.B, "saved B", C.start().B as Pt)),
    C: pt(readPoint(state.C, "saved C", C.start().C as Pt)),
    D: pt(readPoint(state.D, "saved D", C.start().D as Pt)),
    L: pt(readPoint(state.L, "saved L", C.start().L as Pt)),
    O: pt(state.O === undefined || state.O === null ? null : readPoint(state.O, "saved O")),
    P: pt(state.P === undefined || state.P === null ? null : readPoint(state.P, "saved P")),
    G: Array.isArray(state.G) ? state.G.map((p) => pt(readPoint(p, "saved G"))) : [],
    circle: circleOut(state.circle && typeof state.circle === "object"
      ? { c: readPoint((state.circle as Json).c, "saved circle.c"), r: Number((state.circle as Json).r) }
      : null),
    options: (() => {
      const o = state.options && typeof state.options === "object" ? state.options as Json : {};
      return { names: o.names === true, circles: o.circles === true, lines: o.lines === true };
    })(),
  };
  try {
    const here = stateFromSaved(C, state);
    return {
      stateVersion,
      saved,
      reading: picture(C, here),
      check_theorems: (() => {
        const m = measure(C, here);
        return {
          collinear: m.collinear,
          pedalConcurrence: m.pedalConcurrence,
          ninePointConcurrence: m.ninePointConcurrence,
          unitCircle: m.unitCircle,
        };
      })(),
      note: "Track.state saved the four vertices, L, the derived O, P and G, the circumcircle and the three show options. The core rebuilds the four Griffiths points, their line and the two concurrence points from A, B, C, D and L; this is a demonstration, with no win or loss.",
    };
  } catch (e) {
    return { stateVersion, saved, reading: null, note: `The saved position cannot be measured: ${(e as Error).message}` };
  }
}
