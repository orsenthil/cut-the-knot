/*
 * run_game_logic actions and saved-position reader for BOL2, Proposition 2 of
 * Archimedes' Book of Lemmas.
 *
 * The core lives in bol-2/ and is copied into src/generated/cores/ at build
 * time. AB is a diameter of a semicircle, D is a point on the arc, the tangents
 * at B and D meet at T, DE is perpendicular to AB, and AT cuts DE at F. The
 * proposition says F is the midpoint of DE (DF = FE). The page's proof also
 * uses H = AD intersect the tangent at B, the equal tangent lengths TB = TD,
 * and the fact that T is the centre of the circle through B, D and H.
 * Every number below comes from the real core. See _shared.ts for the module
 * shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bol-2"].Bol2Core;

type Point = { x: number; y: number };
type MaybePoint = Point | null | undefined;

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
const pt = (p: MaybePoint): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;

/** Accept both the page's saved {x, y} objects and [x, y] argument arrays. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  if (fallback) return fallback;
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/** Build the core's own state from either a point D or an arc angle theta. */
function readState(args: Json) {
  const C = core();
  const fresh = C.start();
  const A = readPoint(args, "A", fresh.A);
  const B = readPoint(args, "B", fresh.B);
  if (Math.hypot(B.x - A.x, B.y - A.y) < 1e-6) {
    throw new Error("A and B must be different points: AB is the diameter");
  }
  const options: Json = {
    A, B,
    showNames: args.showNames === undefined ? true : args.showNames === true,
    showHint: args.showHint === true,
    showStatement: args.showStatement === true,
  };
  if (args.D !== undefined && args.D !== null) options.D = readPoint(args, "D");
  else options.theta = num(args, "theta", fresh.theta);
  return C.start(options);
}

/** All the lengths and labelled points the core measures for one diagram. */
function reading(s: ReturnType<ReturnType<typeof core>["start"]>) {
  const C = core();
  const m = C.measurements(s);
  return {
    theta: round(m.theta),
    centreO: pt(m.O),
    radius: round(m.radius),
    A: pt(m.A), B: pt(m.B), D: pt(m.D),
    T: pt(m.T), E: pt(m.E), F: pt(m.F), H: pt(m.H),
    DE: round(m.DE),
    DF: maybe(m.DF), FE: maybe(m.FE),
    DF_over_FE: maybe(m.ratio),
    TB: maybe(m.TB), TD: maybe(m.TD), TH: maybe(m.TH),
    D_on_arc: m.onArc === true,
  };
}

const CLAIM_NAMES = [
  "onArc", "DEperpendicular", "tangentsMeet", "tangentLengths", "FOnLines",
  "bisected", "rightAngleADB", "hintSemicircle", "parallelDE_BH",
] as const;

/** The page's claims, using the core's own tolerances. */
function claimReading(s: ReturnType<ReturnType<typeof core>["start"]>) {
  const C = core();
  const c = C.claims(s);
  if (!c) {
    return {
      evaluable: false,
      allHold: false,
      failed: [...CLAIM_NAMES],
      note: "The tangents, crossing or hint point cannot be constructed here; put D on the visible arc between A and B.",
    };
  }
  const out: Record<string, boolean> = { evaluable: true };
  const failed: string[] = [];
  for (const name of CLAIM_NAMES) {
    const holds = c[name] === true;
    out[name] = holds;
    if (!holds) failed.push(name);
  }
  out.allHold = failed.length === 0;
  return {
    ...out,
    failed,
    note: failed.length === 0
      ? "Every claim holds: D is on the arc, DE is perpendicular to AB, the tangents meet at T with TB = TD, F lies between D and E on both DE and AT with DF = FE, angle ADB is right (Thales), TH = TB = TD, and DE is parallel to BH."
      : `These claims fail at this configuration: ${failed.join(", ")}. Move D back onto the visible arc and keep A and B apart.`,
  };
}

export function actions(): GameActions {
  return {
    figure: {
      describe:
        "For a diameter AB (each [x, y] in board coordinates, y downward) and a point D on the upper semicircle, give D as {x, y} or give theta in radians (0 at B, pi at A). Report the centre O, radius, the tangent intersection T, the perpendicular foot E, the crossing F where AT meets DE, the hint point H where AD meets the tangent at B, and the lengths DE, DF, FE, TB, TD, TH with the ratio DF/FE. D is clamped to the visible arc, as on the page.",
      args: '{ "A": [60, 270], "B": [360, 270], "theta": 1.05 }',
      run: (args) => {
        const s = readState(args);
        const r = reading(s);
        return {
          ...r,
          note: r.T && r.E && r.F
            ? `At theta = ${r.theta} the tangents meet at T = (${r.T.x}, ${r.T.y}), DE drops to E = (${r.E.x}, ${r.E.y}), and AT crosses it at F = (${r.F.x}, ${r.F.y}). F is halfway along DE: DF = ${r.DF}, FE = ${r.FE}, DE = ${r.DE}. From T the two tangents are equal: TB = ${r.TB} = TD = ${r.TD}.`
            : "The tangents or the crossing cannot be constructed here; keep A and B apart and put D on the visible arc.",
        };
      },
    },
    check_claims: {
      describe:
        "Check every claim made on the BOL2 illustration for a diameter AB and a point D on the arc (give D as {x, y} or theta in radians): D on the arc, DE perpendicular to AB, the two tangents meeting at T, TB = TD, F lying between D and E on both DE and AT, DF = FE, the right angle ADB (Thales' theorem), TH = TB = TD for the hint circle centred at T, and DE parallel to BH. Returns a boolean for each claim, the failed names, and the dimensions used.",
      args: '{ "A": [60, 270], "B": [360, 270], "theta": 1.05 }',
      run: (args) => {
        const s = readState(args);
        return {
          theta: round(s.theta),
          dimensions: {
            DE: round(core().measurements(s).DE),
            DF: maybe(core().measurements(s).DF),
            FE: maybe(core().measurements(s).FE),
            TB: maybe(core().measurements(s).TB),
            TD: maybe(core().measurements(s).TD),
            TH: maybe(core().measurements(s).TH),
          },
          ...claimReading(s),
        };
      },
    },
  };
}

/** The page's saved diagram, with the core's reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported BOL2 state version ${stateVersion}`);
  const s = readState(state);
  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), D: pt(s.D), theta: round(s.theta),
    savedTheta: state.theta === undefined ? null : num(state, "theta"),
    showNames: s.showNames === true,
    showHint: s.showHint === true,
    showStatement: s.showStatement === true,
    reading: {
      ...reading(s),
      claims: claimReading(s),
      note: `The saved diameter AB has length ${round(C.distance(s.A, s.B))} and centre (${round((s.A.x + s.B.x) / 2)}, ${round((s.A.y + s.B.y) / 2)}). At theta = ${round(s.theta)} the core puts F on DE with DF = ${maybe(C.measurements(s).DF)} and FE = ${maybe(C.measurements(s).FE)}; the claim DF = FE holds for every position of D on the open arc, since T is the midpoint of BH and shrinking triangle AHB towards A sends BH to DE.`,
    },
  };
}
