/*
 * run_game_logic actions and saved-position reader for Circle Triplet.
 *
 * Bogomolny's illustration starts with an arbelos: A, C, B on a line, with
 * r1 = AC/2, r2 = CB/2 and R = r1 + r2.  Archimedes' twins W1, W2 have radius
 * p = r1*r2/R.  The circle (O3) touching all three semicircles has radius
 * R3 = R*r1*r2/(r1² + r1*r2 + r2²).  If K and L are the points where (O3)
 * touches the two small arcs, the circumcircle of K, L, C is Bankoff's brother
 * W3: its centre lies on the perpendicular through C and its radius is exactly
 * p, the same as the twins.  Inverting in the circle about A with power AC·AB
 * swaps B and C and makes that equality visible.
 *
 * In the core's own names, `brother` is (O3) and `W3` is the Bankoff brother;
 * the report below spells both out so they cannot be confused.  Every number
 * comes from the real core (circle-triplet/), copied into
 * src/generated/cores/ at build time.  See _shared.ts for the module shape.
 * This is an illustration: it has no win and no loss.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-triplet"].CircleTripletCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Ring = { c: Point; r: number };
type Geometry = NonNullable<ReturnType<Core["geometry"]>>;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
/** Residuals can be tiny; keep their size and sign rather than zeroing them. */
const sig = (v: number): number => Number(v.toExponential(2));
const close = (a: number, b: number, tol = 1e-6): boolean =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
const ring = (c: Ring | null): { center: Point; radius: number } | null =>
  c && Number.isFinite(c.r) ? { center: pt(c.c), radius: round(c.r) } : null;
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);

/** Tool arguments may use [x, y]; the page saves points as {x, y}. */
function readPoint(value: unknown, label: string): Point {
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or {x, y}`);
    const x = Number(value[0]), y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" needs finite x and y`);
    return { x, y };
  }
  if (!value || typeof value !== "object") throw new Error(`"${label}" must be [x, y] or {x, y}`);
  const p = value as Json;
  return { x: num(p, "x"), y: num(p, "y") };
}

/**
 * Either give the two small radii r1, r2 (placed symmetrically on the board),
 * or give all three points A, C, B to reproduce a saved drawing exactly.  The
 * core projects points onto the baseline and keeps a six-unit gap at each
 * handle, so a requested point that cannot be dragged there is rejected.
 */
function fromArgs(args: Json) {
  const C = core();
  const seed = C.start({});
  let state;
  if (args.A !== undefined || args.C !== undefined || args.B !== undefined) {
    if (args.A === undefined || args.C === undefined || args.B === undefined) {
      throw new Error('give all of "A", "C" and "B", or give "r1" and "r2"');
    }
    const want = {
      A: readPoint(args.A, "A"),
      C: readPoint(args.C, "C"),
      B: readPoint(args.B, "B"),
    };
    state = C.move(C.move(C.move(seed, "A", want.A), "B", want.B), "C", want.C);
    for (const key of ["A", "C", "B"] as const) {
      if (!close(state[key].x, want[key].x, 1e-9)) {
        throw new Error(`"${key}" x = ${want[key].x} is not a legal point: A, C, B must stay between ${C.GAP} and ${C.VIEW.width - C.GAP}, six units apart, on the baseline`);
      }
    }
  } else {
    const r1 = num(args, "r1", (seed.C.x - seed.A.x) / 2);
    const r2 = num(args, "r2", (seed.B.x - seed.C.x) / 2);
    if (!(r1 >= 3) || !(r2 >= 3)) {
      throw new Error('"r1" and "r2" must be at least 3 board units (the handles keep a six-unit gap)');
    }
    const maxSum = (C.VIEW.width - 2 * (C.GAP + 1)) / 2;
    if (r1 + r2 > maxSum) {
      throw new Error(`"r1" + "r2" must be at most ${maxSum} to fit the ${C.VIEW.width}-unit board`);
    }
    const A = { x: (C.VIEW.width - 2 * (r1 + r2)) / 2, y: C.BASE_Y };
    const B = { x: A.x + 2 * (r1 + r2), y: C.BASE_Y };
    const Cc = { x: A.x + 2 * r1, y: C.BASE_Y };
    state = Object.assign({}, seed, { A, B, C: Cc, explored: true });
  }
  const g = C.geometry(state);
  if (!g) throw new Error("the core could not draw an arbelos for these points");
  return { C, state, g };
}

/** The page's claims, measured on the core's exact construction. */
function reading(g: Geometry) {
  const C = core();
  const { r1, r2, R, p, R3 } = g;
  const formulaP = r1 * r2 / R;
  const formulaR3 = R * r1 * r2 / (r1 * r1 + r1 * r2 + r2 * r2);

  // (O3), the circle touching all three semicircles, is g.brother in the core.
  // It is tangent internally to the big arc and externally to the two small ones.
  const tangency = {
    touchesBigArc: {
      distanceFromO: round(dist(g.brother.c, g.O)),
      expectedRMinusR3: round(R - R3),
      residual: sig(dist(g.brother.c, g.O) - (R - R3)),
      holds: close(dist(g.brother.c, g.O), R - R3),
    },
    touchesLeftArc: {
      distanceFromO1: round(dist(g.brother.c, g.O1)),
      expectedR1PlusR3: round(r1 + R3),
      residual: sig(dist(g.brother.c, g.O1) - (r1 + R3)),
      holds: close(dist(g.brother.c, g.O1), r1 + R3),
    },
    touchesRightArc: {
      distanceFromO2: round(dist(g.brother.c, g.O2)),
      expectedR2PlusR3: round(r2 + R3),
      residual: sig(dist(g.brother.c, g.O2) - (r2 + R3)),
      holds: close(dist(g.brother.c, g.O2), r2 + R3),
    },
    KOnLeftArc: close(dist(g.K, g.O1), r1),
    LOnRightArc: close(dist(g.L, g.O2), r2),
    KAndLOnTangentCircle: close(dist(g.K, g.brother.c), R3) && close(dist(g.L, g.brother.c), R3),
  };

  // g.W3 is Bankoff's brother: the circumcircle of K, L, C above the baseline.
  const brotherDistances = [dist(g.W3.c, g.K), dist(g.W3.c, g.L), dist(g.W3.c, g.C)];
  const invert = (c: Ring | null) => (c ? C.invertCircle(c, g.inversion) : null);
  const images = {
    leftTwin: invert(g.twin1), rightTwin: invert(g.twin2),
    bankoffBrother: invert(g.W3), tangentCircle: invert(g.brother),
    rightSemicircle: invert(g.right),
  };
  const unchanged = (a: Ring | null, b: Ring | null): boolean =>
    !!a && !!b && close(a.c.x, b.c.x) && close(a.c.y, b.c.y) && close(a.r, b.r);

  return {
    r1: round(r1), r2: round(r2), R: round(R),
    twinRadius: {
      measured: round(p), formula: "p = r1*r2/R", expected: round(formulaP),
      residual: sig(p - formulaP), holds: close(p, formulaP),
    },
    tangentCircleRadius: {
      measured: round(R3), formula: "R3 = R*r1*r2/(r1² + r1*r2 + r2²)", expected: round(formulaR3),
      residual: sig(R3 - formulaR3), holds: close(R3, formulaR3),
      centre: pt(g.brother.c),
    },
    twins: [ring(g.twin1), ring(g.twin2)],
    bankoffBrother: {
      centre: pt(g.W3.c), radius: round(g.W3.r),
      mirroredCentre: pt(g.W3ref.c), mirroredRadius: round(g.W3ref.r),
      centreAboveC: close(g.W3.c.x, g.C.x) && g.W3.c.y < C.BASE_Y,
      mirrorBelowC: close(g.W3ref.c.x, g.C.x) && g.W3ref.c.y > C.BASE_Y,
      passesThroughKLC: brotherDistances.every((d) => close(d, p)),
      distancesToKLC: brotherDistances.map((d) => round(d)),
      sameRadiusAsTwins: close(g.W3.r, p) && close(g.W3.r, g.twin1.r) && close(g.W3.r, g.twin2.r),
    },
    tangencyPoints: { K: pt(g.K), L: pt(g.L) },
    perpendicularFoot: pt(g.D),
    evenSplitRadius: round(R / 4),
    isEvenSplit: close(r1, r2),
    tangency,
    inversion: {
      centre: pt(g.inversion.c), power: round(g.inversion.r * g.inversion.r),
      powerFormula: "AC·AB = 4*r1*(r1+r2)",
      images: {
        leftTwin: ring(images.leftTwin), rightTwin: ring(images.rightTwin),
        bankoffBrother: ring(images.bankoffBrother), tangentCircle: ring(images.tangentCircle),
        rightSemicircle: ring(images.rightSemicircle),
      },
      rightSemicircleUnchanged: unchanged(images.rightSemicircle, g.right),
      rightTwinUnchanged: unchanged(images.rightTwin, g.twin2),
      imagesHaveRadiusR2: [images.leftTwin, images.bankoffBrother, images.tangentCircle]
        .every((c) => !!c && close(c.r, r2)),
    },
  };
}

export function actions(): GameActions {
  return {
    equal_radii: {
      describe:
        "Place an arbelos from its two small radii r1 = AC/2 and r2 = CB/2 (or give exact board points A, C, B) and run the real construction. Report the twins' radius p = r1*r2/R, Bankoff's brother W3 with its centre on the perpendicular through C and radius p, its mirror below the baseline, and the circle (O3) touching all three semicircles with its own radius R3 = R*r1*r2/(r1² + r1*r2 + r2²). Checks that W3 passes through the tangency points K, L and C, that (O3) really touches every arc, and that an even split makes all three equal circles radius R/4. Radii must be at least 3 and sum to at most 194 board units; points must be legal draggable positions.",
      args: '{ "r1": 64, "r2": 28.5 }',
      run: (args) => {
        const m = reading(fromArgs(args).g);
        return {
          ...m,
          note: `AC = ${round(2 * m.r1)}, CB = ${round(2 * m.r2)}, so R = ${m.R}. The twins and Bankoff's brother all have radius p = r1*r2/R = ${m.twinRadius.measured}; the brother's centre is ${JSON.stringify(m.bankoffBrother.centre)}, directly above C, and its mirror is below. The circle touching all three arcs has its own, larger radius R3 = ${m.tangentCircleRadius.measured} (it is not one of the triplet). ${m.isEvenSplit ? "This is the even split, where the three equal radii are as large as possible: R/4 = " + m.evenSplitRadius + "." : "At an even split all three would have radius R/4 = " + m.evenSplitRadius + "."}`,
        };
      },
    },
    inversion_proof: {
      describe:
        "For the same arbelos (give r1 and r2, or the points A, C, B) invert the exact construction in the circle centred at A with power AC·AB = 4*r1*(r1+r2). Reports the tangency residuals of (O3) against the big, left and right arcs, the points K and L, and the image of each circle: the right semicircle and the right twin are unchanged, while the left twin, Bankoff's brother and (O3) all invert to circles of radius r2 = CB/2. This is the page's hint for why the three radii are equal. Same argument checks as equal_radii.",
      args: '{ "A": [110, 125], "C": [238, 125], "B": [295, 125] }',
      run: (args) => {
        const { g } = fromArgs(args);
        const m = reading(g);
        return {
          r1: m.r1, r2: m.r2, R: m.R,
          tangency: m.tangency,
          tangencyPoints: m.tangencyPoints,
          inversion: m.inversion,
          note: `Inverting about A with power ${m.inversion.power} = AC·AB leaves the right semicircle and the right twin where they are, and sends the left twin, Bankoff's brother and (O3) to circles of radius r2 = ${m.r2}. Reading their equal widths in that picture is the proof of p = r1*r2/R = ${m.twinRadius.measured}; (O3)'s own radius stays R3 = ${m.tangentCircleRadius.measured}, with the tangency residuals listed above.`,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Circle Triplet state version ${stateVersion}`);
  try {
    const A = readPoint(state.A, "A");
    const Cc = readPoint(state.C, "C");
    const B = readPoint(state.B, "B");
    const options = (state.options && typeof state.options === "object" ? state.options : {}) as Json;
    const here = Object.assign(C.start({}), {
      A, B, C: Cc,
      options: { names: options.names === true, hint: options.hint === true },
      explored: true,
    });
    const g = C.geometry(here);
    if (!g) {
      return {
        ...state, stateVersion, valid: false,
        note: "The saved A, C, B do not make an arbelos: C must be strictly between A and B (r1 = AC/2 and r2 = CB/2 positive).",
      };
    }
    const measured = reading(g);
    const savedNumber = (key: string): number | null => {
      const v = state[key];
      if (v === undefined || v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const savedPoint = (key: string): Point | null => {
      if (state[key] === undefined || state[key] === null) return null;
      try { return readPoint(state[key], key); } catch { return null; }
    };
    const savedRing = (v: unknown, label: string): Ring | null => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return null;
      const o = v as Json;
      try {
        return { c: readPoint(o.c, `${label}.c`), r: num(o, "r") };
      } catch { return null; }
    };
    const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
    const compare = (field: string, page: number | null, actual: number) => {
      if (page !== null) differences.push({ field, page, core: round(actual), diff: round(Math.abs(page - actual), 9) });
    };
    for (const [field, actual] of [
      ["r1", g.r1], ["r2", g.r2], ["R", g.R], ["radius", g.p], ["R3", g.R3],
    ] as Array<[string, number]>) {
      compare(field, savedNumber(field), actual);
    }
    for (const [field, actual] of [
      ["A", g.A], ["B", g.B], ["C", g.C], ["O", g.O], ["O1", g.O1], ["O2", g.O2],
      ["D", g.D], ["K", g.K], ["L", g.L],
    ] as Array<[string, Point]>) {
      const page = savedPoint(field);
      if (page) {
        compare(`${field}.x`, page.x, actual.x);
        compare(`${field}.y`, page.y, actual.y);
      }
    }
    const circles = state.circles && typeof state.circles === "object" && !Array.isArray(state.circles)
      ? state.circles as Json : {};
    const circleChecks: Record<string, boolean | null> = {};
    const circleKeys = ["big", "left", "right", "twin1", "twin2", "brother", "reflected",
      "W3", "W3ref", "inversion"] as const;
    for (const key of circleKeys) {
      const page = savedRing(circles[key], `circles.${key}`);
      const actual: Ring | null = key === "inversion" ? g.inversion : g[key];
      circleChecks[key] = page && actual
        ? close(page.c.x, actual.c.x, 1e-4) && close(page.c.y, actual.c.y, 1e-4) && close(page.r, actual.r, 1e-4)
        : null;
    }
    const savedMatchesCore = differences.every((d) => close(d.page, d.core, 1e-4)) &&
      Object.values(circleChecks).every((v) => v !== false);

    return {
      ...state, stateVersion,
      valid: true,
      core: {
        r1: measured.r1, r2: measured.r2, R: measured.R,
        twinRadius: measured.twinRadius.measured,
        tangentRadiusR3: measured.tangentCircleRadius.measured,
        twins: measured.twins,
        bankoffBrother: measured.bankoffBrother,
        tangentCircle: { centre: measured.tangentCircleRadius.centre, radius: measured.tangentCircleRadius.measured },
        tangency: measured.tangency,
        status: C.describe(here),
      },
      savedMatchesCore,
      differences,
      savedCirclesMatchCore: circleChecks,
      note: `With A, B, C as saved, AC = ${round(g.C.x - g.A.x)} and CB = ${round(g.B.x - g.C.x)}, so r1 = ${measured.r1}, r2 = ${measured.r2}, R = ${measured.R}. The twins and Bankoff's brother (centre ${JSON.stringify(measured.bankoffBrother.centre)}, above C) have radius ${measured.twinRadius.measured} = r1*r2/R; the circle touching all three arcs has radius ${measured.tangentCircleRadius.measured}. ${savedMatchesCore ? "The saved numbers and circles agree with this construction." : "Some saved numbers differ from the core's geometry; see `differences` and `savedCirclesMatchCore`."}`,
    };
  } catch (err) {
    return {
      ...state, stateVersion, valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "The saved position needs draggable points A, C, B on the baseline of the 400x250 board.",
    };
  }
}
