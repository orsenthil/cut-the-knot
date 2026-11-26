/*
 * run_game_logic actions and saved-position reader for Angles in a Triangle.
 *
 * The real core is angles-in-triangle/angles-in-triangle-core.js, copied into
 * src/generated/cores/ at build time. It reproduces two claims made on the
 * page: folding the corners onto D, the foot of the altitude from the
 * largest-angle vertex, copies the three angles of the triangle to that foot
 * (they fill the straight angle there, so they add to 180 degrees); and the
 * exercise preset with AB = AC, angle BAC = 120, BC = sqrt(5), BD = 1,
 * CD = sqrt(2), whose angle ADC is 60 degrees. See _shared.ts for the module
 * shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angles-in-triangle"].AnglesInTriangleCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type State = {
  A: Point; B: Point; C: Point; P: Point;
  exercisePoint: Point | null;
  scale: number;
  preset: string;
  showNames: boolean;
};

const r = (v: number, places = 3): number | null =>
  Number.isFinite(v) ? Math.round(v * 10 ** places) / 10 ** places : null;
const r1 = (v: number): number | null => r(v, 1);
const pt = (p: Point | null | undefined): { x: number | null; y: number | null } | null =>
  p ? { x: r(p.x), y: r(p.y) } : null;
const deg = (v: number): number | null => r1(core().degrees(v));

/** Accept the page's saved {x, y} as well as [x, y] argument arrays. */
function readPoint(args: Json, key: string, fallback?: Point | null): Point {
  const v = args[key];
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
}

/** Optional points in saved positions must not throw on a null or odd value. */
function savedPoint(state: Json, key: string): Point | null {
  const v = state[key];
  if (v === undefined || v === null) return null;
  try {
    return readPoint({ [key]: v }, key);
  } catch {
    return null;
  }
}

function readShowNames(args: Json, fallback: boolean): boolean {
  const v = args.showNames;
  if (v === undefined) return fallback;
  if (typeof v !== "boolean") throw new Error('argument "showNames" must be true or false');
  return v;
}

/** Start from the applet's own position and apply the caller's drags. */
function triangleFrom(C: Core, args: Json): State {
  let s = C.start({ showNames: readShowNames(args, false) }) as State;
  for (const name of ["A", "B", "C"] as const) {
    s = C.movePoint(s, name, readPoint(args, name, s[name])) as State;
  }
  // The applet's angle() divides by the side lengths, so a collapsed triangle
  // has no folding construction to report.
  const cross = (s.B.x - s.A.x) * (s.C.y - s.A.y) - (s.B.y - s.A.y) * (s.C.x - s.A.x);
  if (Math.abs(cross) < 1e-6) {
    throw new Error("A, B and C lie on one line (or two coincide), so the triangle has no altitude foot");
  }
  return s;
}

const FOLD_NOTE =
  "The applet picks the vertex with the largest angle. E and F are the midpoints of KL and MK, D is the foot of the altitude from K to LM, and G and H are the midpoints of DL and DM. Folding over EF, EG and FH sends K, L and M to D: the three angles at D are copies of the triangle's own angles, so their sum is the straight angle, 180 degrees.";

const EXERCISE_NOTE =
  "In units where BC = sqrt(5) the preset puts B = (-2/sqrt(5), 0), D = (0, 1/sqrt(5)), C = (3/sqrt(5), 0), so BD = 1 and CD = sqrt(2) exactly, and chooses A with AB = AC and angle BAC = 120 degrees. The cosine rule at D then gives angle ADC = 60 degrees (and angle BDC = 135 degrees). Drag D and the core recomputes both the lengths and the angle from the new picture.";

export function actions(): GameActions {
  return {
    fold_corners: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] in page coordinates, y downward; omitted corners keep the applet's starting triangle), fold the two smaller corners onto D, the foot of the altitude from the largest-angle vertex. Reports the three original angles, the three folded angles at D in degrees, their sum (180), the fold points D, E, F, G, H and the status line. The fold lines are the midlines of the triangle, so the three angles at D are copies of the triangle's angles and fill the straight angle there.",
      args: '{ "A": [159, 160], "B": [80, 50.7], "C": [80, 189.3] }',
      run: (args) => {
        const C = core();
        const s = triangleFrom(C, args);
        const g = C.compute(s);
        return {
          vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          largestAngleAt: g.largest,
          triangleAnglesDegrees: {
            A: deg(g.angles.A), B: deg(g.angles.B), C: deg(g.angles.C),
          },
          triangleSumDegrees: r1(C.degrees(g.angles.A + g.angles.B + g.angles.C)),
          altitudeFootD: pt(g.fold ? g.fold.D : null),
          foldMidpoints: g.fold
            ? { E: pt(g.fold.E), F: pt(g.fold.F), G: pt(g.fold.G), H: pt(g.fold.H) }
            : null,
          foldedAnglesAtD: g.foldedAngles
            ? { K: deg(g.foldedAngles.K), L: deg(g.foldedAngles.L), M: deg(g.foldedAngles.M) }
            : null,
          foldedSumDegrees: g.sum === null ? null : deg(g.sum),
          statusLine: C.describe(s),
          note: FOLD_NOTE,
        };
      },
    },
    exercise_preset: {
      describe:
        "Load the 120-degree exercise preset and read it through the real geometry: AB = AC, angle BAC = 120, BC = sqrt(5), with an interior point D with BD = 1 and CD = sqrt(2). Reports the lengths (with exact forms where they apply), angles BAC, ADC and BDC in degrees, cos(BDC), a check that the preset still has its promised values, and the status line. Pass D as [x, y] or {x, y} to see how the angle changes when the point is dragged.",
      args: '{}',
      run: (args) => {
        const C = core();
        let s = C.exercisePreset({ showNames: readShowNames(args, true) }) as State;
        if (args.D !== undefined) s = C.movePoint(s, "D", readPoint(args, "D")) as State;
        const e = C.compute(s).exercise;
        if (!e) throw new Error("the exercise preset has no interior point D");
        const near = (a: number, b: number) => Math.abs(a - b) < 1e-5;
        const matchesExercise =
          near(e.lengths.BD, 1) && near(e.lengths.CD, C.ROOT2) &&
          near(e.lengths.BC, C.ROOT5) && near(C.degrees(e.BAC), 120) &&
          near(C.degrees(e.ADC), 60);
        return {
          preset: s.preset,
          vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          pointD: pt(e.point),
          lengths: {
            AB: r(e.lengths.AB), AC: r(e.lengths.AC), BC: r(e.lengths.BC),
            BD: r(e.lengths.BD), CD: r(e.lengths.CD), AD: r(e.lengths.AD),
          },
          exactLengths: {
            AB: C.lengthText(e.lengths.AB), AC: C.lengthText(e.lengths.AC),
            BC: C.lengthText(e.lengths.BC), BD: C.lengthText(e.lengths.BD),
            CD: C.lengthText(e.lengths.CD),
          },
          anglesDegrees: {
            BAC: deg(e.BAC), ADC: deg(e.ADC), BDC: deg(e.BDC),
          },
          cosBDC: r(e.cosBDC),
          matchesExercise,
          statusLine: C.describe(s),
          note: EXERCISE_NOTE,
        };
      },
    },
  };
}

/** The page's saved illustration, rebuilt and read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const showNames = state.showNames === true;
  const hasExercisePoint = savedPoint(state, "exercisePoint") !== null;
  let s = (state.preset === "exercise" || hasExercisePoint
    ? C.exercisePreset({ showNames })
    : C.start({ showNames })) as State;
  for (const name of ["A", "B", "C", "P"] as const) {
    const p = savedPoint(state, name);
    if (p) s = C.movePoint(s, name, p) as State;
  }
  if (hasExercisePoint) {
    s = C.movePoint(s, "D", savedPoint(state, "exercisePoint")!) as State;
  } else {
    s = { ...s, exercisePoint: null };
  }
  const scale = num(state, "scale", s.scale);
  if (scale > 0) s = { ...s, scale };

  const g = C.compute(s);
  return {
    stateVersion,
    preset: s.preset,
    A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P),
    exercisePoint: pt(s.exercisePoint),
    scale: s.scale,
    showNames: s.showNames,
    reading: {
      largestAngleAt: g.largest,
      triangleAnglesDegrees: {
        A: deg(g.angles.A), B: deg(g.angles.B), C: deg(g.angles.C),
      },
      foldedAnglesAtD: g.foldedAngles
        ? { K: deg(g.foldedAngles.K), L: deg(g.foldedAngles.L), M: deg(g.foldedAngles.M) }
        : null,
      foldedSumDegrees: g.sum === null ? null : deg(g.sum),
      exercise: g.exercise
        ? {
            point: pt(g.exercise.point),
            lengths: {
              AB: r(g.exercise.lengths.AB), AC: r(g.exercise.lengths.AC),
              BC: r(g.exercise.lengths.BC), BD: r(g.exercise.lengths.BD),
              CD: r(g.exercise.lengths.CD),
            },
            anglesDegrees: {
              BAC: deg(g.exercise.BAC), ADC: deg(g.exercise.ADC),
              BDC: deg(g.exercise.BDC),
            },
          }
        : null,
      statusLine: C.describe(s),
      note:
        "The saved points are the draggable corners A, B, C, the centre P of the translated copy, and (in the exercise preset) the interior point D. The folded angles at the altitude foot are copies of the triangle's angles, so they add to 180 degrees; the exercise answer is angle ADC = 60 degrees.",
    },
  };
}
