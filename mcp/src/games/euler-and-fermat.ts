/*
 * run_game_logic actions and saved-position reader for Euler and Fermat.
 *
 * The page saves just the three draggable corners and the two checkboxes with
 * Track.state; the core rebuilds every other point from them. The ten Euler
 * lines of triples chosen from A, B, C, F, f all pass through G = (A+B+C)/3,
 * the two Napoleon triangles are equilateral about that same G, and a turn of
 * 120 degrees about G carries O (circumcenter of CfF) to P. One wording detail:
 * the applet makes F' by reflecting F in M = midpoint of AB; the page text says
 * f, a slip (the marked angles only work for F), and the core follows the applet.
 *
 * All numbers come from euler-and-fermat/euler-and-fermat-core.js, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = { A: Pt; B: Pt; C: Pt; showNames: boolean; showAngles: boolean };
type Euler = { center: Pt; circum: Pt; cross: number };
type Measure = {
  A: Pt; B: Pt; C: Pt;
  Aq: Pt; Bq: Pt; Cq: Pt; aq: Pt; bq: Pt; cq: Pt;
  Cm: Pt; F: Pt; f: Pt; fm: Pt; G: Pt; Gp: Pt; O: Pt; P: Pt; Fp: Pt;
  eulerA: Euler; eulerB: Euler; eulerC: Euler;
};
type Claims = {
  usable: boolean;
  tenCount: number; tenConcurrent: boolean; tenOk: boolean[];
  eulerA: boolean; eulerB: boolean; eulerC: boolean;
  napoleonOuter: boolean; napoleonInner: boolean;
  rotateOP: boolean; angleOGP: boolean; concyclic: boolean;
  angle1: boolean; angle2: boolean; angle3: boolean; angle4: boolean;
  fPrimeParallel: boolean; gPrimeParallel: boolean;
};
type Core = {
  TURN: number;
  start(options?: Json): State;
  withPoint(s: State, name: "A" | "B" | "C", p: Pt): State;
  withOptions(s: State, options: { showNames?: boolean; showAngles?: boolean }): State;
  measure(s: State): Measure;
  claims(s: State): Claims;
  result(s: State): unknown;
  distance(p: Pt, q: Pt): number;
  angle(p: Pt, q: Pt, r: Pt): number;
};

const core = () => cores["euler-and-fermat"].EulerAndFermatCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const err = (v: number): number => round(v, 9);
const pt = (p: Pt): Pt => ({ x: round(p.x), y: round(p.y) });

/** A corner as the client sends it: [x, y] or { x, y }. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, dflt: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return dflt;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** Real core state: supplied corners are page drags; omitted ones stay at the opening picture. */
function buildState(args: Json, C: Core): State {
  let s = C.start({});
  for (const name of ["A", "B", "C"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.withPoint(s, name, readPoint(v, name));
  }
  return C.withOptions(s, {
    showNames: readBool(args, "showNames", false),
    showAngles: readBool(args, "showAngles", false),
  });
}

/** Core's tenOk is indexed by triples of A, B, C, F, f in exactly this order. */
function tenTriples(claims: Claims): Array<{ triangle: string; eulerLineThroughG: boolean }> {
  const names = ["A", "B", "C", "F", "f"];
  const out: Array<{ triangle: string; eulerLineThroughG: boolean }> = [];
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      for (let k = j + 1; k < 5; k++) {
        out.push({
          triangle: names[i] + names[j] + names[k],
          eulerLineThroughG: claims.tenOk[out.length] === true,
        });
      }
    }
  }
  return out;
}

/** One fresh measure and claim check, laid out for a tutor. */
function analyse(C: Core, s: State) {
  const m = C.measure(s);
  const cl = C.claims(s);
  const outer = [m.Aq, m.Bq, m.Cq], inner = [m.aq, m.bq, m.cq];
  const sides = (tri: Pt[]) => [C.distance(tri[0], tri[1]), C.distance(tri[1], tri[2]), C.distance(tri[2], tri[0])].map((d) => round(d));
  return {
    m, cl,
    corners: { A: pt(m.A), B: pt(m.B), C: pt(m.C) },
    options: { showNames: s.showNames, showAngles: s.showAngles },
    usable: cl.usable,
    centroidG: pt(m.G),
    fermatPoints: { F: pt(m.F), f: pt(m.f) },
    triangleCfF: {
      centroidGprime: pt(m.Gp), circumcenterO: pt(m.O),
      eulerOffsetFromG: err(m.eulerC.cross), eulerLineThroughG: cl.eulerC,
    },
    tenEulerLines: {
      count: cl.tenCount, concurrentAtG: cl.tenConcurrent, triples: tenTriples(cl),
    },
    drawnThreeThroughG: { A: cl.eulerA, B: cl.eulerB, C: cl.eulerC },
    napoleon: {
      outer: { centres: { A: pt(outer[0]), B: pt(outer[1]), C: pt(outer[2]) }, sides: sides(outer), equilateralWithCentroidG: cl.napoleonOuter },
      inner: { centres: { a: pt(inner[0]), b: pt(inner[1]), c: pt(inner[2]) }, sides: sides(inner), equilateralWithCentroidG: cl.napoleonInner },
    },
    rotation: {
      G: pt(m.G), O: pt(m.O), P: pt(m.P),
      angleOGPdegrees: round((C.angle(m.O, m.G, m.P) * 180) / Math.PI),
      is120Degrees: cl.angleOGP, sendsOToP: cl.rotateOP,
      OGaPConcyclic: cl.concyclic,
    },
    angleChain: {
      angleOGBq_eq_angleOaqBq: cl.angle1,
      angleOaqBq_eq_anglePcqCq: cl.angle2,
      anglePcqCq_eq_anglefBA: cl.angle3,
      anglefBA_eq_anglefFpA: cl.angle4,
    },
    parallels: {
      FprimeF_parallel_GO: cl.fPrimeParallel,
      GprimeG_parallel_GO: cl.gPrimeParallel,
    },
    reflection: {
      M: pt(m.Cm), F: pt(m.F), f: pt(m.f), Fprime: pt(m.Fp), followsApplet: true,
    },
  };
}

export function actions(): GameActions {
  return {
    euler_lines: {
      describe:
        "Build triangle ABC from the given corners (each [x, y] or { x, y }; omit any for the applet's opening triangle) and report G = (A+B+C)/3, the two Fermat points F and f, and the real core's check of all ten Euler lines of triples chosen from A, B, C, F, f. It also gives the three lines the page draws (F, f with A, B or C) and the offset of the Euler line of CfF from G; showNames and showAngles may be set as booleans.",
      args: '{"A":[164,300],"B":[320,300],"C":[172,60]}',
      run: (args) => {
        const C = core();
        const r = analyse(C, buildState(args, C));
        return {
          corners: r.corners, options: r.options, usable: r.usable,
          centroidG: r.centroidG, fermatPoints: r.fermatPoints,
          triangleCfF: r.triangleCfF,
          tenEulerLines: r.tenEulerLines, drawnThree: r.drawnThreeThroughG,
          note: !r.usable
            ? "Those corners make the construction collapse (the triangle is degenerate or a Fermat point is undefined), so the claims cannot be checked; move a corner away."
            : r.tenEulerLines.concurrentAtG
              ? `All ${r.tenEulerLines.count} Euler lines pass through G = (${r.centroidG.x}, ${r.centroidG.y}), the centroid of ABC and of the two Napoleon triangles. The three drawn lines, including the Euler line of CfF through its circumcenter O and centroid G', also pass through G (largest offset ${r.triangleCfF.eulerOffsetFromG}). This is an illustration, so there is no win or loss.`
              : "The core found a triple whose Euler line misses G; drag the corners to a non-degenerate triangle and try again.",
        };
      },
    },

    napoleon_and_rotation: {
      describe:
        "For the same triangle, report the two Napoleon triangles A′B′C′ and a′b′c′ with their side lengths and common centre G, and the 120-degree turn about G that sends O, the circumcenter of triangle CfF, exactly to P. It also checks the marked angle chain and the parallels used in the proof; F′ is the reflection of F in the midpoint M of AB, following the applet (the page's text says f, a slip: the quoted angles only work for F).",
      args: '{"A":[164,300],"B":[320,300],"C":[172,60]}',
      run: (args) => {
        const C = core();
        const r = analyse(C, buildState(args, C));
        return {
          corners: r.corners, options: r.options, usable: r.usable,
          centroidG: r.centroidG,
          napoleon: r.napoleon, rotation: r.rotation,
          angleChain: r.angleChain, parallels: r.parallels,
          reflection: r.reflection,
          note: !r.usable
            ? "Those corners make the construction collapse, so the Napoleon triangles and the rotation cannot be checked; move a corner away."
            : `Both Napoleon triangles are equilateral and centred on G = (${r.centroidG.x}, ${r.centroidG.y}). Turning O about G by ${r.rotation.angleOGPdegrees} degrees lands on P (${r.rotation.sendsOToP ? "exactly" : "not"}); O, G, a′, P and B′ are ${r.rotation.OGaPConcyclic ? "on one circle" : "not on one circle"}, and the marked angles match as directed angles. The applet's F′ reflects F, not f, in M.`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those same corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Euler and Fermat state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);
  let s: State;
  let savedReadable = true;
  try {
    s = buildState(src, C);
  } catch {
    s = C.start({});
    savedReadable = false;
  }
  const r = analyse(C, s);
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved: {
      A: r.corners.A, B: r.corners.B, C: r.corners.C,
      showNames: s.showNames, showAngles: s.showAngles,
    },
    valid: r.usable,
    centroidG: r.centroidG,
    fermatPoints: r.fermatPoints,
    triangleCfF: r.triangleCfF,
    tenLinesChecked: r.tenEulerLines.count,
    tenConcurrentAtG: r.tenEulerLines.concurrentAtG,
    drawnThreeThroughG: r.drawnThreeThroughG,
    napoleonOuter: r.napoleon.outer.equilateralWithCentroidG,
    napoleonInner: r.napoleon.inner.equilateralWithCentroidG,
    angleOGPdegrees: r.rotation.angleOGPdegrees,
    rotationSendsOToP: r.rotation.sendsOToP,
    core: r,
    result: C.result(s),
    note: !savedReadable
      ? "The saved corners could not be read, so the core reading below is from the applet's opening triangle."
      : !r.usable
        ? "The saved corners make the construction collapse; the core cannot check the concurrence here."
        : `Track.state saved the corners and the two checkboxes; the core rebuilds the two Fermat points F and f, the Napoleon triangles, O, P and G = (${r.centroidG.x}, ${r.centroidG.y}) from them. All ${r.tenEulerLines.count} Euler lines go through G, and a ${r.rotation.angleOGPdegrees}-degree turn about G sends O to P. This is an illustration, so there is no win or loss; F′ follows the applet's reflection of F in M, not the page's slip "f".`,
  };
}
