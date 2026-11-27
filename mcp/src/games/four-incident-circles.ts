/*
 * run_game_logic actions and saved-position reader for Four Incident Circles.
 *
 * Four circles of one radius R all pass through a common point O (the red
 * dot). Dragging one centre rescales the other three along their rays from O,
 * so every centre stays R from O: the centres are concyclic and each circle
 * passes through O. The external tangent between two neighbouring circles is
 * equidistant from their centres, hence parallel to the chord joining them,
 * so the quadrilateral cut out by the four tangents has the same angles as the
 * centre quadrilateral. The page's claim that its four corners are concyclic
 * is checked by drawing the circle through B2, B3, B4 and measuring how far
 * B1 falls from it. One caution: the tangent corners are labelled B1..B4 near
 * centres A1..A4, so after a big drag the labels need not go around the circle
 * in name order; the name-order "opposite" angles then need not be the
 * quadrilateral's interior angles, while reading the corners around the circle
 * still gives opposite sums of 180 degrees.
 *
 * Every number below is measured by the game's real core,
 * four-incident-circles/four-incident-circles-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * page's 560 x 500 viewBox, y down; angles reported here are degrees. This is
 * a picture with no win or loss. See _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Tangent = [Pt, Pt];
type State = {
  center: Pt;
  radius: number;
  A: Pt[];
  options: { hint: boolean; names: boolean };
  explored: boolean;
};
type Geometry = {
  circles: { c: Pt; r: number }[];
  tangents: (Tangent | null)[];
  vertices: Pt[];
  outer: { center: Pt; radius: number } | null;
  angles: number[];
  cyclicError: number;
  parallelError: number;
  degenerate: boolean;
  centerDistances: number[];
};
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  CENTER: Pt;
  RADIUS: number;
  START_ANGLES: number[];
  PAD: number;
  start(options?: Json): State;
  reset(s: State): State;
  move(s: State, index: number, p: Pt): State;
  setOption(s: State, name: string, on: boolean): State;
  dist(p: Pt, q: Pt): number;
  angle(v: Pt, p: Pt, q: Pt): number;
  geometry(s: State): Geometry;
  result(s: State): null;
  describe(s: State): string;
};

const core = (): Core =>
  cores["four-incident-circles"].FourIncidentCirclesCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print, while
 * keeping the size of a near-zero residual visible. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const sig = (v: number): number =>
  !Number.isFinite(v) ? NaN
    : v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2)) : r6(v);
const deg = (rad: number): number => r6((rad * 180) / Math.PI);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const finitePt = (p: Pt | null | undefined): p is Pt =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

const CYCLIC_TOL = 1e-4;   // board units; the port's logic test found < 1e-5
const PARALLEL_TOL = 1e-6; // normalised cross product of tangent and chord
const ANGLE_TOL_DEG = 1e-4;
const DIST_TOL = 1e-6;     // relative

/** Accept [x, y] and the page's { x, y } dots, with finite coordinates. */
function readPoint(raw: unknown, label: string): Pt {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw && typeof raw === "object") {
    const o = raw as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
    }
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** Optional centre overrides as an "A" array and/or individual A1..A4. */
function readCenters(args: Json): Pt[] {
  const out: Pt[] = [];
  if (args.A !== undefined && args.A !== null) {
    if (!Array.isArray(args.A)) throw new Error('argument "A" must be an array of up to four [x, y] centres');
    if (args.A.length > 4) throw new Error('argument "A" has more than four centres');
    for (let i = 0; i < args.A.length; i++) {
      if (args.A[i] !== undefined && args.A[i] !== null) out[i] = readPoint(args.A[i], `A[${i}]`);
    }
  }
  for (let i = 0; i < 4; i++) {
    const key = `A${i + 1}`;
    if (args[key] !== undefined && args[key] !== null) out[i] = readPoint(args[key], key);
  }
  return out;
}

/**
 * The applet's opening picture with the supplied centre drags applied in
 * A1..A4 order; each drag rescales the other centres as the page does.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of centre points A1..A4, options hint/names and/or A");
  }
  let s = C.start({ hint: readBool(args, "hint", false), names: readBool(args, "names", false) });
  const centres = readCenters(args);
  for (let i = 0; i < 4; i++) {
    if (centres[i]) s = C.move(s, i, centres[i]);
  }
  return s;
}

/** The full state the page saved with Track.state, validated field by field. */
function savedState(C: Core, state: Json): State {
  const center = readPoint(state.center, "saved center");
  const radius = Number(state.radius);
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error('saved "radius" must be a positive finite number');
  }
  if (!Array.isArray(state.A) || state.A.length !== 4) {
    throw new Error('saved "A" must be an array of four centre points');
  }
  const A = state.A.map((p, i) => readPoint(p, `saved A[${i}]`));
  const raw = state.options;
  let hint = false, names = false;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Json;
    hint = o.hint === true;
    names = o.names === true;
  }
  return { center, radius, A, options: { hint, names }, explored: state.explored === true };
}

/** A cycle is the name order up to rotation and reversal, so B1/B3 and B2/B4
 *  are the opposite pairs only when the labels follow the circle this way. */
function sameNameCycle(order: number[]): boolean {
  const name = [1, 2, 3, 4], reverse = [1, 4, 3, 2];
  const rotations = (cyc: number[]): string[] =>
    [0, 1, 2, 3].map((k) => [0, 1, 2, 3].map((j) => cyc[(j + k) % 4]).join(""));
  const rotationsName = rotations(name);
  return rotationsName.includes(order.join("")) || rotations(reverse).some((r) => rotationsName.includes(r));
}

type Reading = ReturnType<typeof reading>;

/** Everything the real core measures for one picture, in tutor-friendly units. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  const board = { width: C.VIEW.width, height: C.VIEW.height };
  const centres = Object.fromEntries(
    [0, 1, 2, 3].map((i) => [`A${i + 1}`, pt(s.A[i])]),
  ) as Record<string, Pt | null>;
  const centreDistances = g.centerDistances.map(r6);
  const allCentresEquidistant = centreDistances.every(
    (d) => Math.abs(d - s.radius) <= DIST_TOL * Math.max(1, s.radius),
  );
  const corners = g.vertices.map(pt);
  const outer = g.outer ? { center: pt(g.outer.center), radius: r6(g.outer.radius) } : null;
  const cyclicError = sig(g.cyclicError);
  const parallelError = sig(g.parallelError);
  const fourthCornerOnCircle = g.cyclicError <= CYCLIC_TOL;
  const tangentsParallelToChords = g.parallelError <= PARALLEL_TOL;

  const tangents = g.tangents.map((t, i) => (t && finitePt(t[0]) && finitePt(t[1])
    ? { between: `A${i + 1}-A${(i + 1) % 4 + 1}`, from: pt(t[0]), to: pt(t[1]) }
    : null));

  const base = {
    valid: !g.degenerate,
    reason: g.degenerate
      ? "Two centres are less than one board unit apart, or a tangent intersection or circumcircle is not finite, so the core draws no quadrilateral."
      : null,
    board,
    center: pt(s.center),
    radius: r6(s.radius),
    centres,
    centreDistances,
    allCentresEquidistant,
    radiusMatchesCentres: allCentresEquidistant &&
      Math.abs(centreDistances[0] - s.radius) <= DIST_TOL * Math.max(1, s.radius),
    tangents,
    tangentLabels: ["T0: A1-A2", "T1: A2-A3", "T2: A3-A4", "T3: A4-A1"],
    corners,
    cornerLabels: ["B1: T3∩T0 (near A1)", "B2: T0∩T1 (near A2)",
                   "B3: T1∩T2 (near A3)", "B4: T2∩T3 (near A4)"],
    outer,
    cyclicError,
    parallelError,
    fourthCornerOnCircle,
    tangentsParallelToChords,
    anglesNameOrder: {} as Record<string, number>,
    oppositeSumsNameOrder: { B1plusB3: NaN, B2plusB4: NaN, both180: false },
    circularOrder: [] as number[],
    anglesCircularOrder: [] as Array<{ corner: string; degrees: number }>,
    oppositeSumsCircularOrder: { first: NaN, second: NaN, both180: false },
    bLabelsFollowCircleOrder: false,
    nameOppositesAreGeometric: false,
    status: C.describe(s),
    result: C.result(s),
  };

  if (g.degenerate || !g.outer || !g.vertices.every(finitePt)) {
    return {
      ...base,
      note:
        "The core cannot draw a quadrilateral here: drag two centres apart and try again. " +
        "The picture has no win or loss.",
    };
  }

  const anglesNameOrder = Object.fromEntries(
    [0, 1, 2, 3].map((i) => [`B${i + 1}`, deg(g.angles[i])]),
  ) as Record<string, number>;
  const sum13 = deg(g.angles[0] + g.angles[2]);
  const sum24 = deg(g.angles[1] + g.angles[3]);

  /* Read the corners around the green circle, not in B-label order. */
  const o = g.outer.center;
  const order = g.vertices
    .map((v, i) => ({ i, a: Math.atan2(v.y - o.y, v.x - o.x) }))
    .sort((a, b) => a.a - b.a)
    .map((entry) => entry.i);
  const anglesCircularOrder = order.map((idx, k) => ({
    corner: `B${idx + 1}`,
    degrees: deg(C.angle(
      g.vertices[idx],
      g.vertices[order[(k + 3) % 4]],
      g.vertices[order[(k + 1) % 4]],
    )),
  }));
  const first = r6(anglesCircularOrder[0].degrees + anglesCircularOrder[2].degrees);
  const second = r6(anglesCircularOrder[1].degrees + anglesCircularOrder[3].degrees);
  const labelsFollow = sameNameCycle(order.map((i) => i + 1));

  return {
    ...base,
    anglesNameOrder,
    oppositeSumsNameOrder: {
      B1plusB3: sum13, B2plusB4: sum24,
      both180: Math.abs(sum13 - 180) <= ANGLE_TOL_DEG && Math.abs(sum24 - 180) <= ANGLE_TOL_DEG,
    },
    circularOrder: order.map((i) => i + 1),
    anglesCircularOrder,
    oppositeSumsCircularOrder: {
      first, second,
      both180: Math.abs(first - 180) <= ANGLE_TOL_DEG && Math.abs(second - 180) <= ANGLE_TOL_DEG,
    },
    bLabelsFollowCircleOrder: labelsFollow,
    nameOppositesAreGeometric: labelsFollow,
    note:
      `All four centres are ${r6(s.radius)} units from the red point, so every circle of that radius passes ` +
      `through it, and each tangent is parallel to the chord between its two centres (largest mismatch ` +
      `${parallelError}). The green circle is drawn through B2, B3 and B4 and B1 is ${cyclicError} board ` +
      `units from it, so the four corners are concyclic to floating-point precision. ` +
      (labelsFollow
        ? `The labels B1..B4 go around the circle in order, so the name-order opposites give ` +
          `B1+B3 = ${sum13}° and B2+B4 = ${sum24}°: the cyclic-quadrilateral angle sum. `
        : `Here B1..B4 do NOT go around the circle in name order (they read ` +
          `${order.map((i) => "B" + (i + 1)).join(", ")} instead), so the name-order angles ` +
          `B1+B3 = ${sum13}° and B2+B4 = ${sum24}° are not pairs of interior angles. Read the corners ` +
          `around the circle: the opposite pairs are ${first}° and ${second}°. The corners are still concyclic. `) +
      "This is a picture, so there is no win or loss.",
  };
}

const OPENING_ARGS = '{"A1":[356.880109,291.5],"A2":[204.338908,293.682952],' +
  '"A3":[209.077917,198.981776],"A4":[323.682952,174.338908],"hint":false,"names":true}';
const CAVEAT_ARGS = '{"A1":[160,250]}';

export function actions(): GameActions {
  return {
    tangent_quadrilateral: {
      describe:
        "For up to four centre drags A1..A4 (each [x, y] or { x, y } on the 560 x 500 board, applied in order; omit any for the applet's opening picture), run the real core and report the four external common tangents, the four corners B1..B4 where neighbouring tangents meet and the circle through them, with how far the fourth corner falls from that circle. It also measures that each tangent is parallel to the chord between its two centres and gives the opposite-angle sums both in B-label order and read around the circle, flagging when the labels are out of order.",
      args: OPENING_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        return reading(C, s);
      },
    },

    label_order_caveat: {
      describe:
        "Compare the opening picture with a big drag that carries centre A1 past its neighbours (by default A1 to the left of the red point; pass A1..A4 for your own picture). Both keep the four corners concyclic, but after the drag the B labels no longer go around the circle in name order, so the name-order opposite-angle sums need not be 180° while the sums read around the circle still are; both pictures are measured by the real core.",
      args: CAVEAT_ARGS,
      run: (args) => {
        const C = core();
        const supplied = [1, 2, 3, 4].some((i) => args?.[`A${i}`] !== undefined && args?.[`A${i}`] !== null)
          || args?.A !== undefined;
        const dragged = supplied ? buildState(C, args) : C.move(C.start({}), 0, {
          x: C.CENTER.x - 120, y: C.CENTER.y,
        });
        const opening = reading(C, C.start({}));
        const after = reading(C, dragged);
        if (!opening.valid || !after.valid) {
          return {
            source: supplied ? "the opening picture and the supplied centre drags" : "the opening picture and a big drag of A1",
            opening, after,
            note: "The core cannot draw one of the two pictures (two centres too close or a tangent intersection is not finite); move a centre apart and try again.",
          };
        }
        return {
          source: supplied
            ? "the opening picture and the supplied centre drags"
            : "the opening picture and a drag of A1 to the left of the red point",
          opening,
          after,
          comparison: {
            openingOrder: opening.circularOrder,
            afterOrder: after.circularOrder,
            openingNameSums: opening.oppositeSumsNameOrder,
            afterNameSums: after.oppositeSumsNameOrder,
            openingCircularSums: opening.oppositeSumsCircularOrder,
            afterCircularSums: after.oppositeSumsCircularOrder,
            openingLabelsInOrder: opening.bLabelsFollowCircleOrder,
            afterLabelsInOrder: after.bLabelsFollowCircleOrder,
            openingCyclicError: opening.cyclicError,
            afterCyclicError: after.cyclicError,
          },
          note:
            `Opening: the corners read ${opening.circularOrder.map((i) => "B" + i).join(", ")} around the ` +
            `circle, B1+B3 = ${opening.oppositeSumsNameOrder.B1plusB3}° and B2+B4 = ` +
            `${opening.oppositeSumsNameOrder.B2plusB4}°. After the drag they read ` +
            `${after.circularOrder.map((i) => "B" + i).join(", ")}, so B1+B3 = ` +
            `${after.oppositeSumsNameOrder.B1plusB3}° and B2+B4 = ${after.oppositeSumsNameOrder.B2plusB4}° ` +
            `are not interior-angle pairs, while the pairs read around the circle are ` +
            `${after.oppositeSumsCircularOrder.first}° and ${after.oppositeSumsCircularOrder.second}°. ` +
            `The fourth corner is ${after.cyclicError} board units from the circle through the other three: ` +
            "the corners stay concyclic. Corner B_i sits near centre A_i, so dragging a centre past its " +
            "neighbours permutes the B labels; only reading them around the circle recovers the 180° sums. " +
            "This is a picture with no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Incident Circles state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Incident Circles position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const r = reading(C, s);
  return {
    ...state,
    stateVersion,
    saved: {
      center: pt(s.center),
      radius: r6(s.radius),
      A: s.A.map((p) => pt(p)),
      options: { ...s.options },
      explored: s.explored,
    },
    valid: r.valid,
    core: r,
    note:
      "Track.state saved the common point, the common radius, the four centre points, the two checkbox " +
      "options and the explored flag in board units. The real core rebuilds the four circles, the four " +
      "common tangents, the corner quadrilateral and the circle through its corners from those fields, " +
      "and re-measures the parallel, concyclic and 180° claims. This is a picture, so the tracker records " +
      "exploration rather than a win or a loss.",
  };
}
