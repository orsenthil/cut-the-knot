/*
 * run_game_logic actions and saved-position reader for General Napoleon.
 *
 * The real core is general-napoleon/general-napoleon-core.js, copied into
 * src/generated/cores/ at build time. It reproduces Bogomolny's GeneralNapoleon
 * Compute() exactly: on each side of ABC an isotomic pair of points is taken
 * (K,L on AB; P,Q on BC; M,N on CA), similar, similarly oriented isosceles
 * triangles are erected on the three short bases, and AA', BB', CC' are drawn.
 * When the two sliders add to 1 the pairs are isotomic and the three cevians
 * concur; the core measures the spread between their pairwise crossings.
 * All coordinates below are in the illustration's 420 x 300 viewBox, y down.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["general-napoleon"].GeneralNapoleonCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Options = { up: number; down: number; angle: number; names: boolean };
type State = { A: Point; B: Point; C: Point; options: Options; explored: boolean };
type Measures = {
  isotomicError: number; barySpread: number; baseAngleError: number;
  sideAngleError: number; similarityError: number; concurrencyError: number; tol: number;
};
type Claims = Record<string, boolean>;
type Geometry = {
  A: Point; B: Point; C: Point;
  K: Point; L: Point; P: Point; Q: Point; M: Point; N: Point;
  apexes: (Point | null)[];
  Aprime: Point | null; Bprime: Point | null; Cprime: Point | null;
  torricelli: Point | null;
  valid: boolean; degenerateBase: boolean; showCevians: boolean;
  sum: number; baryFractions: number[];
  measures: Measures; claims: Claims;
};

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Non-finite measurements (an apex at infinity) are reported as null. */
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : r6(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const pts = (v: (Point | null | undefined)[]): (Point | null)[] => v.map(pt);
const close = (a: number, b: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept both the page's saved {x, y} and short [x, y] JSON. */
function asPoint(raw: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or {x, y}`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [num(o, "x"), num(o, "y")];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or {x, y}, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${label}" is not a finite point`);
  return { x, y };
}

/** The three applet scrollbars, validated against the core's own limits. */
function readOptions(C: Core, args: Json): Options {
  const raw = (args.options !== undefined && args.options !== null && typeof args.options === "object"
    ? args.options : args) as Json;
  const lim = C.LIMITS;
  const slider = (key: "up" | "down"): number => {
    const value = raw[key];
    if (value === undefined || value === null) return lim[key].initial as number;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`"${key}" must be a number of units on the side`);
    if (n < lim[key].min || n > lim[key].max) {
      throw new Error(`"${key}" must be between ${lim[key].min} and ${lim[key].max}`);
    }
    return C.normalize(key, n) as number;
  };
  let angle = lim.angle.initial as number;
  if (raw.angle !== undefined && raw.angle !== null) {
    const n = Number(raw.angle);
    if (!Number.isInteger(n)) throw new Error('"angle" must be an integer number of degrees');
    if (n < lim.angle.min || n > lim.angle.max) {
      throw new Error(`"angle" must be between ${lim.angle.min} and ${lim.angle.max} degrees`);
    }
    angle = C.normalize("angle", n) as number;
  }
  let names = true;
  if (raw.names !== undefined && raw.names !== null) {
    if (typeof raw.names !== "boolean") throw new Error('"names" must be true or false');
    names = raw.names;
  }
  return { up: slider("up"), down: slider("down"), angle, names };
}

/** The opening triangle unless a corner is overridden, then set the sliders. */
function readState(C: Core, args: Json, options: Options): State {
  let s = C.start(options) as State;
  for (const name of ["A", "B", "C"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.move(s, name, asPoint(raw, name)) as State;
  }
  return s;
}

function measured(g: Geometry, C: Core, s: State) {
  const m = g.measures;
  return {
    usable: true,
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    options: s.options,
    sidePairs: {
      AB: { K: pt(g.K), L: pt(g.L) },
      BC: { P: pt(g.P), Q: pt(g.Q) },
      CA: { M: pt(g.M), N: pt(g.N) },
    },
    apexes: { Aprime: pt(g.Aprime), Bprime: pt(g.Bprime), Cprime: pt(g.Cprime) },
    cevians: [
      { line: "AA'", from: pt(g.A), to: pt(g.Aprime) },
      { line: "BB'", from: pt(g.B), to: pt(g.Bprime) },
      { line: "CC'", from: pt(g.C), to: pt(g.Cprime) },
    ],
    meeting: pt(g.torricelli),
    concurrent: g.claims.concurrent === true,
    showCevians: g.showCevians === true,
    valid: g.valid === true,
    degenerateBase: g.degenerateBase === true,
    sliderSum: r6(g.sum),
    baryFractions: g.baryFractions.map(r6),
    claims: { ...g.claims },
    measures: {
      isotomicError: maybe(m.isotomicError), barySpread: maybe(m.barySpread),
      baseAngleError: maybe(m.baseAngleError), sideAngleError: maybe(m.sideAngleError),
      similarityError: maybe(m.similarityError), concurrencyError: maybe(m.concurrencyError),
      tol: maybe(m.tol),
    },
    sentence: C.describe(s),
    note:
      "K,P,M use the down slider and L,Q,N the up slider: up + down = 1 makes each pair isotomic (symmetric about its side's midpoint) and gives all three pairs the same equal barycentric coordinates. The three isosceles triangles are then similar and similarly oriented, and the core finds AA', BB' and CC' crossing at one point within its drawing tolerance; outside the isotomic case the three crossings generally spread apart.",
  };
}

/** Everything the core can say about one diagram. */
function reading(C: Core, s: State) {
  const g = C.geometry(s) as Geometry | null;
  if (!g) {
    return {
      usable: false, triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) }, options: s.options,
      sentence: C.describe(s), note: "A corner is not a finite point, so there is no diagram to measure.",
    };
  }
  if (g.degenerateBase || !g.valid) {
    return {
      ...measured(g, C, s),
      usable: false,
      note: C.describe(s) as string,
    };
  }
  return measured(g, C, s);
}

const START_POINTS =
  '{ "A": [229.51, 248.08], "B": [115.31, 117.86], "C": [285.18, 84.07], "up": 0.3, "down": 0.7, "angle": 60 }';
const COUNTEREXAMPLE = '{ "up": 0.2, "down": 0.6, "angle": 60 }';

export function actions(): GameActions {
  return {
    concurrence: {
      describe:
        "For triangle corners A, B, C (each [x, y] or {x, y} in the illustration's 420 x 300 board, y down; omit any to keep the opening triangle), take K,L on AB, P,Q on BC and M,N on CA with the up and down sliders (0 to 1.05) and erect similar isosceles triangles of the given integer apex angle (-90 to 95 degrees). Reports the six side points, the three apexes A',B',C', the cevians AA',BB',CC', their meeting point, whether they concur, every claim and measured error (crossing spread against the drawing tolerance), the equal barycentric fractions and the sentence shown under the picture. Defaults up=0.3, down=0.7, angle=60: the isotomic case, where all three cevians meet at one point.",
      args: START_POINTS,
      run: (args) => {
        const C = core();
        const options = readOptions(C, args);
        return reading(C, readState(C, args, options));
      },
    },
    counterexample: {
      describe:
        "Shows why isotomic pairs matter: on the same triangle and at the same apex angle, compare the isotomic setting (down = 1 - up, so up + down = 1) with the non-isotomic up and down supplied (which must not add to 1). For each case report the slider sum, the equal barycentric fractions, whether AA', BB', CC' concur, the spread of their three crossings against the core's tolerance and the page's sentence. Defaults to up=0.2 with down=0.6 on the opening triangle: the isotomic companion is up=0.2, down=0.8 and concurs, while the non-isotomic case does not.",
      args: COUNTEREXAMPLE,
      run: (args) => {
        const C = core();
        const opts = readOptions(C, args);
        if (close(opts.up + opts.down, 1)) {
          throw new Error('"up" + "down" must not be 1 for the counterexample: choose non-isotomic sliders');
        }
        const corners = { A: args.A, B: args.B, C: args.C } as Json;
        const optionsFor = (down: number): Options => ({ ...opts, down: C.normalize("down", down) as number });
        const isotomic = reading(C, readState(C, corners, optionsFor(1 - opts.up)));
        const notIsotomic = reading(C, readState(C, corners, opts));
        return {
          triangle: isotomic.triangle,
          angle: opts.angle,
          isotomic: { up: opts.up, down: optionsFor(1 - opts.up).down, ...isotomic },
          nonIsotomic: { up: opts.up, down: opts.down, ...notIsotomic },
          note:
            "Same triangle, same apex angle: only the second slider moves. In the isotomic case the three crossings agree within the core's tolerance; in the non-isotomic case they spread apart, so AA', BB' and CC' need not meet. This is the counterexample to extending the page's claim to arbitrary side pairs.",
        };
      },
    },
  };
}

/** Saved fields echoed back, with a fresh core reading of the same picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported General Napoleon state version ${stateVersion}`);
  const C = core();
  const saved = {
    stateVersion,
    A: pt(state.A as Point | undefined), B: pt(state.B as Point | undefined), C: pt(state.C as Point | undefined),
    K: pt(state.K as Point | undefined), L: pt(state.L as Point | undefined),
    P: pt(state.P as Point | undefined), Q: pt(state.Q as Point | undefined),
    M: pt(state.M as Point | undefined), N: pt(state.N as Point | undefined),
    apexes: Array.isArray(state.apexes) ? pts(state.apexes as (Point | null)[]) : null,
    meeting: pt(state.meeting as Point | undefined),
    options: state.options && typeof state.options === "object" ? state.options as Json : null,
    claims: state.claims && typeof state.claims === "object" ? state.claims as Json : null,
    measures: state.measures && typeof state.measures === "object" ? state.measures as Json : null,
  };
  try {
    const options = readOptions(C, state);
    const rebuilt = readState(C, state, options);
    const r = reading(C, rebuilt);
    const g = C.geometry(rebuilt) as Geometry | null;
    const savedClaims = (saved.claims ?? {}) as Json;
    const savedMeasures = (saved.measures ?? {}) as Json;
    const claimAgreement = g
      ? Object.fromEntries(Object.entries(g.claims).map(([key, value]) => [
          key, savedClaims[key] === undefined ? null : savedClaims[key] === value,
        ]))
      : null;
    const measureAgreement = g && savedMeasures
      ? Object.fromEntries(Object.keys(g.measures).map((key) => {
          const raw = savedMeasures[key];
          return [key, typeof raw === "number" ? close(raw, g.measures[key as keyof Measures]) : null];
        }))
      : null;
    return {
      stateVersion,
      saved,
      reading: r,
      claimAgreement,
      measureAgreement,
      stateIsIllustration: C.result(rebuilt) === null,
      note:
        "Track.state saves the three corners A,B,C, the six side points K,L,P,Q,M,N, the three apexes, the cevian meeting point, the slider options and the core's own claims and measures. The reading rebuilds the same diagram with the page's real core from the corners and sliders alone, so the saved numbers can be checked against a fresh computation. This is an illustration: there is no win or loss.",
    };
  } catch (e) {
    return {
      stateVersion, saved, reading: null, claimAgreement: null, measureAgreement: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
