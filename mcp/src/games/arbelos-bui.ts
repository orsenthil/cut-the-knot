/*
 * run_game_logic actions and saved-position reader for Arbelos Bui.
 *
 * In an arbelos on the baseline points A, C, B, write r1 = AC/2 and
 * r2 = CB/2, so the big semicircle has radius R = r1 + r2. The perpendicular
 * bisectors of AC and CB meet it at D1 and D2; the lines through A, C and C, B
 * cut the small semicircles again at E1, F1 and E2, F2. The circles on the
 * diameters E1F1 and E2F2 are siblings of Archimedes' twins: both have radius
 * r = r1*r2/(r1+r2), and their centres K1, K2 are the same distance from O.
 * Extending E1D1, F1D1 (and the right-hand pair) gives two extra chords of
 * lengths 2r^2/r1 and 2r^2/r2, whose sum is one twin diameter, 2r.
 *
 * All numbers below come from the game's real core (arbelos-bui/), copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["arbelos-bui"].ArbelosBuiCore;

type Point = { x: number; y: number };
type Geometry = NonNullable<ReturnType<ReturnType<typeof core>["geometry"]>>;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
const close = (a: number, b: number, tolerance = 1e-6): boolean =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

/** Tool args may use [x, y]; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, name: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = Number(value[0]), y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const p = value as Json;
    const x = num(p, "x"), y = num(p, "y");
    return { x, y };
  }
  throw new Error(`"${name}" must be a point [x, y] or {x, y}`);
}

/** Put A, C, B on the baseline so the two small semicircles have radii r1, r2. */
function fromRadii(args: Json): { state: Json; g: Geometry } {
  const C = core();
  const seed = C.start({});
  const r1 = num(args, "r1", (seed.C.x - seed.A.x) / 2);
  const r2 = num(args, "r2", (seed.B.x - seed.C.x) / 2);
  if (!(r1 > 1e-6) || !(r2 > 1e-6)) {
    throw new Error('"r1" and "r2" must be positive radii');
  }
  const maxSum = (C.VIEW.width - 2 * (C.GAP + 1)) / 2;
  if (r1 + r2 > maxSum) {
    throw new Error(`"r1" + "r2" must be at most ${maxSum} to fit the ${C.VIEW.width}-unit board`);
  }
  const A = { x: (C.VIEW.width - 2 * (r1 + r2)) / 2, y: C.BASE_Y };
  const B = { x: A.x + 2 * (r1 + r2), y: C.BASE_Y };
  const Cc = { x: A.x + 2 * r1, y: C.BASE_Y };
  const state = Object.assign({}, seed, { A, B, C: Cc, explored: true });
  const g = C.geometry(state);
  if (!g) throw new Error("the core could not draw an arbelos for these radii");
  return { state, g };
}

/** The page's claims, measured on the core's construction. */
function reading(g: Geometry) {
  const C = core();
  const r1: number = g.r1, r2: number = g.r2, R: number = g.R;
  const rho: number = g.rho;
  const formulaRadius = r1 * r2 / (r1 + r2);
  // The page's Pythagorean expression: K1O^2 = R^2 - r1*r2*(2r1+r2)(r1+2r2)/R^2.
  const midpointSquared = R * R - r1 * r2 * (2 * r1 + r2) * (r1 + 2 * r2) / (R * R);
  const midpointDistance = Math.sqrt(Math.max(0, midpointSquared));
  const chord1 = 2 * rho * rho / r1;
  const chord2 = 2 * rho * rho / r2;
  return {
    radii: { r1: round(r1), r2: round(r2), bigRadiusR: round(R) },
    twins: {
      radius: round(g.k1.r),
      formulaRadius: round(formulaRadius),
      matchesFormula: close(g.k1.r, formulaRadius),
      otherRadius: round(g.k2.r),
      centres: [pt(g.K1), pt(g.K2)],
      centreDistancesFromO: [round(g.k1o), round(g.k2o)],
      equalDistances: close(g.k1o, g.k2o),
    },
    midpoint: {
      expression: "K1O² = R² − r1·r2·(2r1+r2)(r1+2r2)/R²",
      squared: round(midpointSquared),
      distanceFromExpression: round(midpointDistance),
      distanceFromCore: round(g.k1o),
      agreesWithCore: close(midpointDistance, g.k1o),
    },
    chords: {
      G1H1: round(g.span1),
      G2H2: round(g.span2),
      formulaG1H1: round(chord1),
      formulaG2H2: round(chord2),
      sum: round(g.span1 + g.span2),
      twinDiameter: round(2 * rho),
      sumIsTwinDiameter: close(g.span1 + g.span2, 2 * rho),
    },
    areas: { arbelos: round(g.arbelosArea), twinCircle: round(g.twinArea) },
    note: C.describe(Object.assign({}, C.start({}), {
      A: g.A, B: g.B, C: g.C, explored: true,
    })),
  };
}

export function actions(): GameActions {
  return {
    twin_circles: {
      describe:
        "Given the two small radii r1 and r2 of an arbelos, place A, C, B on the baseline and run the real construction. Report the big radius R = r1+r2, both new circles' measured radius against r1*r2/(r1+r2), their centres K1 and K2 and their equal distances from O, and the page's Pythagorean expression K1O² = R² − r1·r2·(2r1+r2)(r1+2r2)/R² checked against the measured distance. Radii must be positive and sum to at most 194 board units.",
      args: '{ "r1": 123.5, "r2": 54 }',
      run: (args) => reading(fromRadii(args).g),
    },
    chords_and_areas: {
      describe:
        "For an arbelos with small radii r1 and r2, extend E1D1, F1D1 and E2D2, F2D2 to the extra chords G1H1 and G2H2. Report their lengths against 2r²/r1 and 2r²/r2, the sum G1H1 + G2H2 against one twin diameter 2r, and the arbelos and twin-circle areas π·r1·r2 and π·r². Radii must be positive and sum to at most 194 board units.",
      args: '{ "r1": 120, "r2": 60 }',
      run: (args) => reading(fromRadii(args).g),
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Arbelos Bui state version ${stateVersion}`);
  const C = core();
  const A = readPoint(state.A, "A");
  const B = readPoint(state.B, "B");
  const Cc = readPoint(state.C, "C");
  const here = Object.assign({}, C.start({}), { A, B, C: Cc, explored: state.explored === true });
  const g = C.geometry(here);
  if (!g) {
    return {
      ...state, stateVersion, valid: false,
      note: "The saved A, C, B do not make a usable arbelos: C must stay strictly between A and B.",
    };
  }
  const measured = reading(g);
  const savedNumber = (key: string): number | null => {
    const v = state[key];
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const savedChords = Array.isArray(state.chords) ? numArray(state, "chords") : null;
  const matches = (key: string, actual: number): boolean | null => {
    const v = savedNumber(key);
    return v === null ? null : close(v, actual);
  };
  return {
    // The page's saved fields, with the same names.
    ...state,
    stateVersion,
    valid: true,
    // What the core adds.
    core: measured,
    savedMatchesCore: {
      r1: matches("r1", g.r1),
      r2: matches("r2", g.r2),
      radius: matches("radius", g.rho),
      k1o: matches("k1o", g.k1o),
      k2o: matches("k2o", g.k2o),
      chords: savedChords && savedChords.length === 2
        ? close(savedChords[0], g.span1) && close(savedChords[1], g.span2)
        : null,
    },
    note: `With the saved A, C, B the small radii are ${measured.radii.r1} and ${measured.radii.r2}; both new circles have radius ${measured.twins.radius} = r1*r2/(r1+r2), both centres are ${measured.twins.centreDistancesFromO[0]} from O, and the two extra chords add to ${measured.chords.sum} = 2r.`,
  };
}
