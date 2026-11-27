/*
 * run_game_logic actions and saved-position reader for Fermat's point.
 *
 * The real core is fermat-point/fermat-point-core.js, copied into
 * src/generated/cores/ at build time; every number reported here is measured
 * by it. Coordinates are board units of the applet's 400 x 300 viewBox, y down.
 *
 * Fermat's question: where should F be so that FA + FB + FC is least? Turn each
 * side of ABC outward by 60 degrees to make the three Napoleon triangles with
 * new corners A', B', C'. The lines AA', BB', CC' then meet at F, the three
 * angles at F are 120 degrees, and AA' = BB' = CC' = FA + FB + FC. If a corner
 * of ABC is already 120 degrees or more, that corner itself is the answer: F
 * moves onto it and the three lines no longer give the minimum. D is a handle
 * the player may drag off the centroid; rotating D by 60 degrees about each
 * corner makes Da, Db, Dc, and when D sits on F (nearD) the Hint marks group the
 * broken lines that prove the equal-length identity.
 *
 * This page is an illustration: there is no win and no loss. See _shared.ts
 * for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = { names: boolean; hint: boolean; fermat: boolean };
type State = { A: Pt; B: Pt; C: Pt; D: Pt; options: Options; explored: boolean };
type Geometry = {
  A: Pt; B: Pt; C: Pt; D: Pt;
  Ap: Pt; Bp: Pt; Cp: Pt; Da: Pt; Db: Pt; Dc: Pt; F: Pt;
  orientation: number;
  moreThan120: boolean;
  outer: "A" | "B" | "C" | null;
  nearD: boolean;
  angles: { A: number; B: number; C: number };
  total: number;
  lines: Array<{ from: Pt; to: Pt }>;
};
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  TWO_THIRDS: number;
  DEG: number;
  start(options?: Json): State;
  move(s: State, name: "A" | "B" | "C" | "D", p: Pt): State;
  setOption(s: State, name: keyof Options, on: boolean): State;
  geometry(s: State): Geometry;
  compute(a: Pt, b: Pt, c: Pt, d: Pt): Geometry;
  computeAngle(v: Pt, p: Pt, q: Pt): number;
  distanceToLine(p: Pt, a: Pt, b: Pt): number;
  dist(p: Pt, q: Pt): number;
  cross(p: Pt, q: Pt): number;
  sub(p: Pt, q: Pt): Pt;
  sumDistances(p: Pt, a: Pt, b: Pt, c: Pt): number;
  describe(s: State): string;
  result(s: State): unknown;
};

const core = (): Core => cores["fermat-point"].FermatPointCore as unknown as Core;

/* The geometry is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const deg = (rad: number): number => r6((rad * 180) / Math.PI);
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const close = (a: number, b: number, scale = 1, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol * Math.max(1, scale);

/** Accept the page's { x, y } and the tutor's [x, y] alike. */
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

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** A real core state: supplied handles are page drags; omitted ones stay put. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and options");
  }
  if (args.options !== undefined && args.options !== null) {
    if (typeof args.options !== "object" || Array.isArray(args.options)) {
      throw new Error('argument "options" must be an object with names, hint and fermat booleans');
    }
  }
  const nested = args.options ? (args.options as Json) : ({} as Json);
  const flag = (key: keyof Options): boolean =>
    args[key] !== undefined && args[key] !== null
      ? readBool(args, key, false)
      : readBool(nested, key, false);
  let s = C.start({ names: flag("names"), hint: flag("hint"), fermat: flag("fermat") });
  for (const name of ["A", "B", "C", "D"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.move(s, name, readPoint(v, name));
  }
  return s;
}

/** A bounded grid search of the board, confirming no nearby point beats F. */
function gridMinimum(C: Core, g: Geometry) {
  const { x, y, width, height } = C.VIEW;
  let minSum = Infinity;
  let at: Pt | null = null;
  for (let gx = x; gx <= x + width; gx += 5) {
    for (let gy = y; gy <= y + height; gy += 5) {
      const p = { x: gx, y: gy };
      const sum = C.sumDistances(p, g.A, g.B, g.C);
      if (Number.isFinite(sum) && sum < minSum) { minSum = sum; at = p; }
    }
  }
  return { minSum: r6(minSum), at: at ? pt(at) : null };
}

/** Everything the real core says about one drawing, in plain JSON. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  const scale = Math.max(
    C.VIEW.width, C.VIEW.height,
    C.dist(s.A, s.B), C.dist(s.B, s.C), C.dist(s.C, s.A),
  );
  const twiceArea = Math.abs(C.cross(C.sub(s.B, s.A), C.sub(s.C, s.A)));
  const usable = twiceArea > 1e-9 * scale * scale
    && [g.F.x, g.F.y, g.total].every(Number.isFinite);

  const lines = g.lines.map((l, i) => {
    const dist = C.distanceToLine(g.F, l.from, l.to);
    return {
      name: ["AA'", "BB'", "CC'"][i],
      from: pt(l.from), to: pt(l.to),
      length: r6(C.dist(l.from, l.to)),
      distanceFromF: r6(dist),
      throughF: close(dist, 0, scale),
    };
  });
  const anglesAtF = {
    AFB: deg(C.computeAngle(g.F, s.A, s.B)),
    BFC: deg(C.computeAngle(g.F, s.B, s.C)),
    CFA: deg(C.computeAngle(g.F, s.C, s.A)),
  };
  const all120 = ["AFB", "BFC", "CFA"].every((k) => close(anglesAtF[k as "AFB"], 120, 120, 1e-6));
  const lengths = lines.map((l) => l.length);
  const brokenLinesEqual = lengths.every((v) => close(v, lengths[0], scale));
  const brokenLinesEqualTotal = lengths.every((v) => close(v, g.total, scale));

  /* The Hint marks: rotating D by 60 degrees keeps these three groups equal.
   * When D = F their common lengths are FA, FB and FC. */
  const hintGroups = {
    atA: [C.dist(s.A, g.D), C.dist(s.A, g.Db), C.dist(g.Cp, g.Dc)].map(r6),
    atB: [C.dist(s.B, g.D), C.dist(s.B, g.Dc), C.dist(g.Ap, g.Da)].map(r6),
    atC: [C.dist(s.C, g.D), C.dist(s.C, g.Da), C.dist(g.Bp, g.Db)].map(r6),
  };
  const hintGroupsEqual = [
    hintGroups.atA.every((v) => close(v, hintGroups.atA[0], scale)),
    hintGroups.atB.every((v) => close(v, hintGroups.atB[0], scale)),
    hintGroups.atC.every((v) => close(v, hintGroups.atC[0], scale)),
  ];

  return {
    usable, scale, g,
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    cornerAngles: { A: deg(g.angles.A), B: deg(g.angles.B), C: deg(g.angles.C) },
    D: pt(g.D), nearD: g.nearD,
    napoleon: { Ap: pt(g.Ap), Bp: pt(g.Bp), Cp: pt(g.Cp) },
    rotatedD: { Da: pt(g.Da), Db: pt(g.Db), Dc: pt(g.Dc) },
    F: pt(g.F),
    distances: { FA: r6(C.dist(g.F, g.A)), FB: r6(C.dist(g.F, g.B)), FC: r6(C.dist(g.F, g.C)) },
    total: r6(g.total),
    lines, anglesAtF, all120,
    throughAllLines: lines.every((l) => l.throughF),
    brokenLinesEqual, brokenLinesEqualTotal,
    hintGroups, hintGroupsEqual,
    moreThan120: g.moreThan120, outer: g.outer, orientation: g.orientation,
    grid: gridMinimum(C, g),
  };
}

const NOT_USABLE =
  "A, B and C must be three distinct, non-collinear points on the board; the core cannot locate a Fermat point for a collapsed triangle.";

export function actions(): GameActions {
  return {
    fermat_point: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } in the applet's 400 x 300 board, y down; omit any to keep the opening triangle), report F where the three Napoleon lines AA', BB', CC' meet, the new corners A', B', C' of the outward 60-degree triangles, and the angles AFB, BFC, CFA (in degrees) to check they are 120. It checks AA' = BB' = CC' = FA + FB + FC, lists FA, FB, FC and their total, and samples the board to confirm no point beats F. An optional D (default the centroid) reports nearD and the Hint's equal broken-line groups; names, hint and fermat may be set as booleans. If a corner is 120 degrees or more, the note explains the exception, and a degenerate triangle is refused.",
      args: '{"A":[155,170],"B":[250,170],"C":[225,96.69872981077808],"hint":true,"fermat":true}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        if (!r.usable) throw new Error(NOT_USABLE);
        return {
          board: C.VIEW,
          triangle: { ...r.corners, anglesDegrees: r.cornerAngles, orientation: r.orientation },
          D: r.D, nearD: r.nearD,
          napoleon: r.napoleon,
          rotatedD: r.rotatedD,
          hint: { groups: r.hintGroups, groupsEqual: r.hintGroupsEqual },
          fermat: { F: r.F, ...r.distances, total: r.total },
          concurrence: { lines: r.lines, allThroughF: r.throughAllLines },
          anglesAtF: { ...r.anglesAtF, all120: r.all120 },
          brokenLines: {
            lengths: { "AA'": r.lines[0].length, "BB'": r.lines[1].length, "CC'": r.lines[2].length },
            allEqual: r.brokenLinesEqual, equalToTotal: r.brokenLinesEqualTotal,
          },
          minimality: {
            sampledMinOfFAPlusFBPlusFC: r.grid.minSum, sampledAt: r.grid.at,
            fIsNoWorse: close(r.total, r.grid.minSum, r.scale) || r.total <= r.grid.minSum + 1e-6,
          },
          options: { names: s.options.names, hint: s.options.hint, fermat: s.options.fermat },
          moreThan120: r.moreThan120, outerCorner: r.outer,
          status: C.describe(s),
          note:
            `The three outward 60-degree triangles give A' = (${r.napoleon.Ap.x}, ${r.napoleon.Ap.y}), ` +
            `B' = (${r.napoleon.Bp.x}, ${r.napoleon.Bp.y}) and C' = (${r.napoleon.Cp.x}, ${r.napoleon.Cp.y}); ` +
            `AA', BB' and CC' all pass through F = (${r.F.x}, ${r.F.y}) and the angles at F are ` +
            `${r.anglesAtF.AFB}°, ${r.anglesAtF.BFC}°, ${r.anglesAtF.CFA}°. ` +
            `AA' = BB' = CC' = ${r.lines[0].length} = FA + FB + FC = ${r.total} ` +
            `(FA ${r.distances.FA}, FB ${r.distances.FB}, FC ${r.distances.FC}). ` +
            "The Hint's three equal-length groups are the rotations of D about the corners; " +
            (r.nearD
              ? "here D sits on F (nearD), so those groups are exactly FA, FB and FC and the broken lines straighten into AA', BB' and CC'. "
              : `D is not on F, but the groups are still equal by the 60-degree rotations; drag D onto F to see the proof. `) +
            (r.moreThan120
              ? `Beware: the angle at ${r.outer} is at least 120 degrees, so that corner is the true Fermat point and the equal-line identity above does not give the minimum.`
              : "This is an illustration, so there is no win or loss; the tracker records exploration."),
        };
      },
    },

    angle_120_exception: {
      describe:
        "For a triangle A, B, C (same point format and defaults as fermat_point), report the three corner angles in degrees and test whether any is 120 degrees or more. In that case the core puts F on that corner itself (one of FA, FB, FC is then zero), and although AA', BB', CC' are still equal to one another they no longer equal FA + FB + FC; a board-wide grid check confirms that corner beats the three-line construction. Supply a flat triangle such as the example, or any other corners, to see when the usual 120-degree concurrence rule stops applying.",
      args: '{"A":[100,150],"B":[300,150],"C":[200,160]}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        if (!r.usable) throw new Error(NOT_USABLE);
        return {
          triangle: { ...r.corners, anglesDegrees: r.cornerAngles },
          angleAtLeast120: r.moreThan120,
          outerCorner: r.outer,
          fermat: { F: r.F, ...r.distances, total: r.total },
          brokenLines: {
            lengths: { "AA'": r.lines[0].length, "BB'": r.lines[1].length, "CC'": r.lines[2].length },
            allEqual: r.brokenLinesEqual, equalToTotal: r.brokenLinesEqualTotal,
          },
          anglesAtF: { ...r.anglesAtF, all120: r.all120 },
          minimality: {
            sampledMinOfFAPlusFBPlusFC: r.grid.minSum, sampledAt: r.grid.at,
            fIsNoWorse: close(r.total, r.grid.minSum, r.scale) || r.total <= r.grid.minSum + 1e-6,
          },
          status: C.describe(s),
          note:
            `The corner angles are ${r.cornerAngles.A}° at A, ${r.cornerAngles.B}° at B and ${r.cornerAngles.C}° at C. ` +
            (r.moreThan120
              ? `Because the angle at ${r.outer} is at least 120 degrees, the core returns that corner as F = (${r.F.x}, ${r.F.y}): one of FA, FB, FC is zero and FA + FB + FC = ${r.total}. AA' = BB' = CC' = ${r.lines[0].length}, which no longer equals that total, and the angles at F are not all 120 degrees. `
              : "No corner reaches 120 degrees here, so the usual construction applies: F is where AA', BB' and CC' meet, the angles at F are all 120 degrees, and AA' = BB' = CC' = FA + FB + FC. Try a flatter triangle to see the exception. ")
            + "The grid search confirms F is the least-sum point on the board. This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

const savedNum = (v: unknown): number | null => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? r6(n) : null;
};

function savedPoint(v: unknown): Pt | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Json;
  const x = savedNum(o.x), y = savedNum(o.y);
  return x === null || y === null ? null : { x, y };
}

/** Echo the fields Track.state saved plus a fresh core reading of those corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Fermat point state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Fermat point position must be an object");
  }
  const C = core();
  const saved = {
    A: savedPoint(state.A), B: savedPoint(state.B), C: savedPoint(state.C), D: savedPoint(state.D),
    F: savedPoint(state.F),
    Ap: savedPoint(state.Ap), Bp: savedPoint(state.Bp), Cp: savedPoint(state.Cp),
    moreThan120: state.moreThan120 === true, nearD: state.nearD === true,
    options: {
      names: state.options ? (state.options as Json).names === true : false,
      hint: state.options ? (state.options as Json).hint === true : false,
      fermat: state.options ? (state.options as Json).fermat === true : false,
    },
  };

  let s: State;
  let savedReadable = true;
  try {
    s = buildState(C, state);
  } catch {
    s = C.start({});
    savedReadable = false;
  }
  const r = reading(C, s);
  if (!savedReadable || !r.usable) {
    return {
      ...state,
      stateVersion,
      savedReadable,
      saved,
      valid: false,
      note: !savedReadable
        ? "The saved corners could not be read, so the core reading below is from the applet's opening picture."
        : NOT_USABLE,
    };
  }

  return {
    ...state,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    triangle: { ...r.corners, anglesDegrees: r.cornerAngles },
    D: r.D, nearD: r.nearD,
    napoleon: r.napoleon,
    fermat: { F: r.F, ...r.distances, total: r.total },
    concurrence: { lines: r.lines, allThroughF: r.throughAllLines },
    anglesAtF: { ...r.anglesAtF, all120: r.all120 },
    brokenLines: {
      lengths: { "AA'": r.lines[0].length, "BB'": r.lines[1].length, "CC'": r.lines[2].length },
      allEqual: r.brokenLinesEqual, equalToTotal: r.brokenLinesEqualTotal,
    },
    hint: { groups: r.hintGroups, groupsEqual: r.hintGroupsEqual },
    minimality: {
      sampledMinOfFAPlusFBPlusFC: r.grid.minSum, sampledAt: r.grid.at,
      fIsNoWorse: close(r.total, r.grid.minSum, r.scale) || r.total <= r.grid.minSum + 1e-6,
    },
    moreThan120: r.moreThan120, outerCorner: r.outer,
    comparison: {
      savedFMatchesCore: saved.F !== null && close(saved.F.x, r.F.x, r.scale) && close(saved.F.y, r.F.y, r.scale),
      savedMoreThan120MatchesCore: saved.moreThan120 === r.moreThan120,
      savedNearDMatchesCore: saved.nearD === r.nearD,
    },
    status: C.describe(s),
    result: C.result(s),
    note:
      "Track.state saved the four draggable points, the derived F, A', B', C', the moreThan120 and nearD flags and the three checkboxes; the page does not save the 60-degree rotations of D. The real core rebuilds F, the Napoleon corners, the three lines, the 120-degree angles and FA + FB + FC from the saved corners: " +
      `F = (${r.F.x}, ${r.F.y}), AA' = BB' = CC' = ${r.lines[0].length} and FA + FB + FC = ${r.total}. ` +
      (r.moreThan120
        ? `The angle at ${r.outer} is at least 120 degrees, so that corner is the Fermat point and the equal-line identity does not give the minimum. `
        : "The three lines meet at F at 120 degrees and equal FA + FB + FC. ") +
      "This is an illustration with no win or loss; the tracker records exploration.",
  };
}
