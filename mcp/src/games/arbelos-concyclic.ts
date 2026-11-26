/*
 * run_game_logic actions and saved-position reader for Arbelos Concyclic.
 *
 * The core lives in arbelos-concyclic/ and is copied into
 * src/generated/cores/ at build time. Its whole state is t, the fraction of
 * AB where the join C of the two small semicircles sits. From t the core
 * builds the incircle of the arbelos and the three tangency points E (left
 * arc), F (right arc) and D (big arc) using Woo's construction: the two ends
 * of the incircle's horizontal diameter, joined to A, B and C, meet the arcs
 * at exactly those points.
 *
 * The page's claims, all checked here with the real core:
 *   - the incircle has radius r = a*b*(a+b) / (2*(a*a + a*b + b*b)), a = AC,
 *     b = CB, and E, F, D are at distance r from its centre;
 *   - A, C, F, D lie on the circle centred at M, the top of the arc on AC,
 *     with radius MC = a/sqrt(2);
 *   - B, C, E, D lie on the circle centred at N, the top of the arc on CB,
 *     with radius NC = b/sqrt(2);
 *   - A, B, E, F lie on the third circle centred at L1, the reflection of
 *     the big semicircle's top L in AB.
 *
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["arbelos-concyclic"].ArbelosConcyclicCore;

type Point = { x: number; y: number };

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const close = (a: number, b: number, tolerance = 1e-6): boolean =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

/** A split fraction must be a number between 0 and 1; the core clamps near the ends. */
function splitFraction(args: Json, key: string, fallback?: number): number {
  const t = num(args, key, fallback);
  if (!(t >= 0 && t <= 1)) throw new Error(`"${key}" must be a fraction of AB between 0 and 1`);
  return t;
}

/** The core says where C is after clamping to the draggable range. */
function stateAt(args: Json, key = "t", fallback?: number) {
  const C = core();
  const requested = splitFraction(args, key, fallback);
  const s = C.start({ t: requested });
  return { C, s, requested, applied: C.geometry(s).t };
}

function readPoint(value: unknown, name: string): Point {
  if (value && typeof value === "object") {
    const p = value as Json;
    const x = Number(p.x), y = Number(p.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error(`"${name}" must be a point {x, y}`);
}

interface CircleReading {
  center: Point;
  radius: number;
  points: Record<string, { point: Point; distance: number; residual: number; onCircle: boolean }>;
  maxError: number;
  concyclic: boolean;
}

/** Measure named points against one circle from the core's construction. */
function circleCheck(C: ReturnType<typeof core>, center: Point, radius: number, labels: Record<string, Point>): CircleReading {
  const points: CircleReading["points"] = {};
  let maxError = 0;
  for (const [name, p] of Object.entries(labels)) {
    const distance = C.dist(center, p);
    const residual = distance - radius;
    maxError = Math.max(maxError, Math.abs(residual));
    points[name] = {
      point: pt(p),
      distance: round(distance),
      residual: round(residual, 9),
      onCircle: close(distance, radius),
    };
  }
  return {
    center: pt(center),
    radius: round(radius),
    points,
    maxError: round(maxError, 9),
    concyclic: close(maxError, 0),
  };
}

/** Everything the page draws, plus measurements of each of its four claims. */
function reading(C: ReturnType<typeof core>, s: ReturnType<ReturnType<typeof core>["start"]>) {
  const g = C.geometry(s);
  const a: number = g.a, b: number = g.b;
  const formulaRadius = (a * b * (a + b)) / (2 * (a * a + a * b + b * b));
  return {
    t: round(g.t),
    split: {
      A: pt(g.A), C: pt(g.C), B: pt(g.B),
      AC: round(a), CB: round(b),
    },
    incircle: {
      center: pt(g.P),
      radius: round(g.incircle.radius),
      formulaRadius: round(formulaRadius),
      matchesFormula: close(g.incircle.radius, formulaRadius),
      horizontalDiameter: { left: pt(g.leftEnd), right: pt(g.rightEnd) },
    },
    tangencyPoints: { E: pt(g.E), F: pt(g.F), D: pt(g.D) },
    tangencies: circleCheck(C, g.P, g.incircle.radius, { E: g.E, F: g.F, D: g.D }),
    radii: {
      MC: round(g.circleM.radius),
      formulaMC: round(a / Math.SQRT2),
      NC: round(g.circleN.radius),
      formulaNC: round(b / Math.SQRT2),
    },
    circles: {
      aboutM: circleCheck(C, g.M, g.circleM.radius, { A: g.A, C: g.C, F: g.F, D: g.D }),
      aboutN: circleCheck(C, g.N, g.circleN.radius, { B: g.B, C: g.C, E: g.E, D: g.D }),
      aboutL1: circleCheck(C, g.L1, g.circleL1.radius, { A: g.A, B: g.B, F: g.F, E: g.E }),
    },
  };
}

export function actions(): GameActions {
  return {
    concyclic_points: {
      describe:
        "For a split point C at fraction t of AB, run the real arbelos construction and report the incircle (radius checked against a*b*(a+b)/(2*(a²+ab+b²))), its tangency points E, F, D, and the three claimed circles: A,C,F,D about M with radius a/√2; B,C,E,D about N with radius b/√2; A,B,E,F about L1, the reflection of the big arc's top in AB. Each point's distance from its circle's centre is listed with its residual, so a claim is marked true only when every residual is essentially zero. t must be between 0 and 1; the core clamps it to the applet's 10-unit draggable edges.",
      args: '{ "t": 0.738235 }',
      run: (args) => {
        const { C, s, requested, applied } = stateAt(args);
        const r = reading(C, s);
        const claims = r.circles;
        return {
          requestedT: round(requested),
          ...r,
          allClaimsHold:
            r.incircle.matchesFormula &&
            r.tangencies.concyclic &&
            claims.aboutM.concyclic &&
            claims.aboutN.concyclic &&
            claims.aboutL1.concyclic,
          note:
            `C divides AB at t = ${r.t} (AC = ${r.split.AC}, CB = ${r.split.CB}), and the core used t = ${round(applied)} after clamping. ` +
            `The incircle has radius ${r.incircle.radius} = ${r.incircle.formulaRadius} from the three-radius formula; its horizontal diameter's ends join to A, B and C to give the tangency points E = (${r.tangencyPoints.E.x}, ${r.tangencyPoints.E.y}), ` +
            `F = (${r.tangencyPoints.F.x}, ${r.tangencyPoints.F.y}) and D = (${r.tangencyPoints.D.x}, ${r.tangencyPoints.D.y}). ` +
            `The circle about M has radius MC = ${r.radii.MC} = a/√2 and carries A, C, F, D; the one about N has radius NC = ${r.radii.NC} = b/√2 and carries B, C, E, D; the reflected top L1 gives a third circle through A, B, E, F. ` +
            `The largest residual is ${Math.max(claims.aboutM.maxError, claims.aboutN.maxError, claims.aboutL1.maxError)} board units.`,
        };
      },
    },
    check_splits: {
      describe:
        "Check the page's concyclicity claims at several split points at once. For each fraction t in the array, rebuild the incircle and E, F, D with the real core and report the largest distance error for A,C,F,D about M; B,C,E,D about N; A,B,E,F about L1; and E,F,D about the incircle. This shows the statements hold across the draggable range, not just at one picture. Every t must be between 0 and 1; the core clamps values within 10 board units of A or B.",
      args: '{ "ts": [0.05, 0.25, 0.5, 0.738235, 0.95] }',
      run: (args) => {
        if (!Array.isArray(args.ts)) throw new Error('"ts" must be an array of split fractions between 0 and 1');
        const ts = numArray(args, "ts");
        if (ts.length === 0) throw new Error('"ts" must contain at least one split fraction');
        if (ts.length > 200) throw new Error('"ts" may contain at most 200 split fractions');
        const C = core();
        const rows = ts.map((requested) => {
          if (!(requested >= 0 && requested <= 1)) throw new Error('every entry of "ts" must be between 0 and 1');
          const s = C.start({ t: requested });
          const r = reading(C, s);
          return {
            requestedT: round(requested),
            appliedT: r.t,
            AC: r.split.AC,
            CB: r.split.CB,
            incircleRadius: r.incircle.radius,
            matchesFormula: r.incircle.matchesFormula,
            maxErrors: {
              incircleTangencies: r.tangencies.maxError,
              aboutM: r.circles.aboutM.maxError,
              aboutN: r.circles.aboutN.maxError,
              aboutL1: r.circles.aboutL1.maxError,
            },
            claimsHold:
              r.incircle.matchesFormula &&
              r.tangencies.concyclic &&
              r.circles.aboutM.concyclic &&
              r.circles.aboutN.concyclic &&
              r.circles.aboutL1.concyclic,
          };
        });
        const worst = (key: keyof (typeof rows)[number]["maxErrors"]) =>
          round(Math.max(...rows.map((x) => x.maxErrors[key])), 9);
        return {
          checked: rows.length,
          allHoldAtEverySplit: rows.every((x) => x.claimsHold),
          worstErrors: {
            incircleTangencies: worst("incircleTangencies"),
            aboutM: worst("aboutM"),
            aboutN: worst("aboutN"),
            aboutL1: worst("aboutL1"),
          },
          rows,
          note:
            `All ${rows.length} splits were rebuilt with the real core; the worst residual for any claimed point is ${Math.max(...Object.values({
              aboutM: worst("aboutM"), aboutN: worst("aboutN"), aboutL1: worst("aboutL1"),
            }))} board units, far below drawing precision. The two four-point circles and the reflected circle persist as C slides, and E, F, D always stay on the incircle.`,
        };
      },
    },
  };
}

/** The page's saved fields (Core.position), plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Arbelos Concyclic state version ${stateVersion}`);
  const C = core();
  const t = splitFraction(state, "t");
  const s = C.start({ t });
  const cp = C.position(s);

  const saved = {
    t,
    A: readPoint(state.A, "A"),
    B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"),
    M: readPoint(state.M, "M"),
    N: readPoint(state.N, "N"),
    incircle: {
      center: readPoint((state.incircle as Json | undefined)?.center, "incircle.center"),
      radius: num((state.incircle as Json | undefined) ?? {}, "radius"),
    },
    E: readPoint(state.E, "E"),
    F: readPoint(state.F, "F"),
    D: readPoint(state.D, "D"),
    circleM: {
      center: readPoint((state.circleM as Json | undefined)?.center, "circleM.center"),
      radius: num((state.circleM as Json | undefined) ?? {}, "radius"),
    },
    circleN: {
      center: readPoint((state.circleN as Json | undefined)?.center, "circleN.center"),
      radius: num((state.circleN as Json | undefined) ?? {}, "radius"),
    },
  };

  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: round(page), core: round(value), diff: round(Math.abs(page - value), 9) });
  };
  compare("t", saved.t, cp.t);
  for (const key of ["A", "B", "C", "M", "N"] as const) {
    compare(`${key}.x`, saved[key].x, cp[key].x);
    compare(`${key}.y`, saved[key].y, cp[key].y);
  }
  compare("incircle.center.x", saved.incircle.center.x, cp.incircle.center.x);
  compare("incircle.center.y", saved.incircle.center.y, cp.incircle.center.y);
  compare("incircle.radius", saved.incircle.radius, cp.incircle.radius);
  for (const key of ["E", "F", "D"] as const) {
    compare(`${key}.x`, saved[key].x, cp[key].x);
    compare(`${key}.y`, saved[key].y, cp[key].y);
  }
  for (const key of ["circleM", "circleN"] as const) {
    compare(`${key}.center.x`, saved[key].center.x, cp[key].center.x);
    compare(`${key}.center.y`, saved[key].center.y, cp[key].center.y);
    compare(`${key}.radius`, saved[key].radius, cp[key].radius);
  }
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const measured = reading(C, s);
  return {
    ...state,
    stateVersion,
    // The fields the page saved with Track.state, with the same names.
    t: saved.t,
    A: saved.A,
    B: saved.B,
    C: saved.C,
    M: saved.M,
    N: saved.N,
    incircle: saved.incircle,
    E: saved.E,
    F: saved.F,
    D: saved.D,
    circleM: saved.circleM,
    circleN: saved.circleN,
    // What the same core adds about this position.
    core: measured,
    savedMatchesCore,
    differences,
    claimsHold: {
      incircleTangencies: measured.tangencies.concyclic,
      aboutM: measured.circles.aboutM.concyclic,
      aboutN: measured.circles.aboutN.concyclic,
      aboutL1: measured.circles.aboutL1.concyclic,
    },
    note: savedMatchesCore
      ? `The saved picture has C at t = ${measured.t} of AB (AC = ${measured.split.AC}, CB = ${measured.split.CB}). The core reproduces every saved point and radius: the incircle has radius ${measured.incircle.radius}, the circle about M (radius ${measured.radii.MC}) carries A, C, F, D, the one about N (radius ${measured.radii.NC}) carries B, C, E, D, and the reflected circle about L1 carries A, B, E, F.`
      : "Some saved numbers differ from the core's construction at this t; see `differences`. The `core` field still gives the true geometry for the saved t.",
  };
}
