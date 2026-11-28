/*
 * run_game_logic actions and saved-position reader for One Sheet Hyperboloid.
 *
 * The applet joins N points of a bottom circle to the same N points of a top
 * circle, but turns the top base by M steps of 2*pi/N. The straight generators
 * then sweep out a hyperboloid of one sheet: with t = 2y/L along a generator,
 * r^2 = R^2 (cos^2(phi/2) + t^2 sin^2(phi/2)), i.e.
 * r^2/a^2 - y^2/c^2 = 1 for a = R|cos(phi/2)| and c = (L/2)|cot(phi/2)|.
 * M = 0 is the cylinder (c = infinity) and M = N/2 the cone (a = c = 0).
 *
 * The drawing is an illustration, not a game with a win or loss. Every number
 * below comes from the real core (hyperboloid/hyperboloid-core.js in the site,
 * copied into src/generated/cores/ at build time). The page saves exactly the
 * core's state { lines, shift, frame, solid } with Track.state(state).
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

interface Surface {
  steps: number;
  phi: number;
  waist: number;
  throat: number;
  kind: string;
}
interface Geo {
  points: number[][];
  quads: number[][];
  step: number;
}
interface Core {
  R: number;
  L: number;
  DEFAULT_LINES: number;
  DEFAULT_SHIFT: number;
  MIN_LINES: number;
  MAX_LINES: number;
  LINE_STEP: number;
  MIN_SHIFT: number;
  MAX_SHIFT: number;
  SHIFT_STEP: number;
  clamp(v: number, lo: number, hi: number): number;
  start(options?: Json): Json;
  withOption(state: Json, key: string, value: number): Json;
  geometry(state: Json): Geo;
  surface(state: Json): Surface;
  radiusAt(state: Json, y: number): number;
  generatorPoint(geo: Geo, i: number, t: number): number[];
  describe(state: Json): { title: string; text: string };
}

const core = (): Core => cores["hyperboloid"].HyperboloidCore as unknown as Core;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const degrees = (phi: number): number => (phi * 180) / Math.PI;

/** Optional checkbox: absent means let the core choose, present must be boolean. */
function optBool(args: Json, key: string): boolean | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") throw new Error(`"${key}" must be true or false`);
  return v;
}

/** The page's two spinners and two checkboxes, validated against the core's ranges. */
function readState(args: Json, C: Core): Json {
  const lines = num(args, "lines", C.DEFAULT_LINES);
  if (!Number.isInteger(lines) || lines < C.MIN_LINES || lines > C.MAX_LINES || lines % C.LINE_STEP !== 0) {
    throw new Error(`"lines" must be a multiple of ${C.LINE_STEP} from ${C.MIN_LINES} to ${C.MAX_LINES}`);
  }
  const shift = num(args, "shift", C.DEFAULT_SHIFT);
  if (!Number.isInteger(shift) || shift < C.MIN_SHIFT || shift > C.MAX_SHIFT) {
    throw new Error(`"shift" must be a whole number from ${C.MIN_SHIFT} to ${C.MAX_SHIFT}`);
  }
  return C.start({ lines, shift, solid: optBool(args, "solid"), frame: optBool(args, "frame") });
}

/** Index of one of the picture's straight generators. */
function readGenerator(args: Json, lines: number): number {
  const i = num(args, "generator", 0);
  if (!Number.isInteger(i) || i < 0 || i >= lines) {
    throw new Error(`"generator" must be a whole number from 0 to ${lines - 1}`);
  }
  return i;
}

/** Position along that generator: 0 at the bottom base, 1 at the top. */
function readT(args: Json): number {
  const t = num(args, "t", 0.5);
  if (t < 0 || t > 1) throw new Error(`"t" must be between 0 and 1, got ${JSON.stringify(args.t)}`);
  return t;
}

/**
 * Sample a generator with the core, checking each point against both the
 * core's radius formula and the hyperboloid equation it is meant to lie on.
 * The cone has a = c = 0, where that equation degenerates, so it is skipped.
 */
function sampleGenerator(C: Core, s: Json, geo: Geo, surf: Surface, i: number, ts: number[]) {
  return ts.map((t) => {
    const point = C.generatorPoint(geo, i, t);
    const radius = Math.hypot(point[0], point[2]);
    const formulaRadius = C.radiusAt(s, point[1]);
    const canUseEquation = surf.kind !== "cone" && surf.waist > 0 && Number.isFinite(surf.throat);
    const residual = canUseEquation
      ? (radius / surf.waist) ** 2 - (point[1] / surf.throat) ** 2 - 1
      : null;
    return {
      t: round(t, 4),
      point: point.map((v) => round(v)),
      radius: round(radius),
      radiusFromSurfaceFormula: round(formulaRadius),
      radiusMatches: Math.abs(radius - formulaRadius) < 1e-4,
      surfaceResidual: residual === null ? null : round(residual, 8),
    };
  });
}

/** A compact, core-derived reading of one picture. */
function reading(C: Core, s: Json, i = 0, ts: number[] = [0, 0.25, 0.5, 0.75, 1]) {
  const surf = C.surface(s);
  const geo = C.geometry(s);
  const mid = C.generatorPoint(geo, i, 0.5);
  const midRadius = Math.hypot(mid[0], mid[2]);
  return {
    lines: s.lines,
    shift: s.shift,
    frame: s.frame,
    solid: s.solid,
    steps: surf.steps,
    turn: { radians: round(surf.phi), degrees: round(degrees(surf.phi), 4) },
    waist: round(surf.waist),
    throat: Number.isFinite(surf.throat) ? round(surf.throat) : null,
    kind: surf.kind,
    radiusAtBase: round(C.radiusAt(s, -C.L / 2)),
    radiusAtWaist: round(C.radiusAt(s, 0)),
    radiusAtTop: round(C.radiusAt(s, C.L / 2)),
    generatorIndex: i,
    generator: {
      bottom: geo.points[geo.quads[i][0]].map((v) => round(v)),
      top: geo.points[geo.quads[i][3]].map((v) => round(v)),
      midpoint: mid.map((v) => round(v)),
      midpointRadius: round(midRadius),
    },
    waistMatchesGenerator: Math.abs(midRadius - surf.waist) < 1e-4,
    samples: sampleGenerator(C, s, geo, surf, i, ts),
    status: C.describe(s),
  };
}

/** One or two sentences tying the core's numbers to the surface equation. */
function surfaceNote(r: ReturnType<typeof reading>): string {
  const shape = r.kind === "cylinder"
    ? `a = R = ${r.waist} and c = infinity, the cylinder case of the same formula`
    : r.kind === "cone"
      ? "a = c = 0: the generators meet on the axis, the degenerate cone"
      : `a = ${r.waist}, c = ${r.throat}, so its points obey r²/a² − y²/c² = 1`;
  return `Turning the top base ${r.steps} of ${r.lines} steps (${r.turn.degrees}°) makes ${r.kind === "cylinder" ? "a cylinder" : r.kind === "cone" ? "a cone" : "a one-sheet hyperboloid"} with ${shape}. ` +
    `The core's generator ${r.generatorIndex} passes ${r.generator.midpointRadius} from the axis at the waist, matching a = ${r.waist}.`;
}

export function actions(): GameActions {
  return {
    surface_at_shift: {
      describe:
        "Read the twisted-cylinder generators at `lines` generators and a top-base rotation of `shift` steps: the core reports the turn angle phi = 2*PI*shift/lines (modulo lines), the waist a = R|cos(phi/2)| and throat c = (L/2)|cot(phi/2)| of r²/a² − y²/c² = 1, the radii at the bases and waist, and points along one straight generator. R = 0.5 and L = 1.5; shift 0 is a cylinder and shift lines/2 a cone. `lines` must be a multiple of 5 from 5 to 200, `shift` a whole number from 0 to 100, `generator` from 0 to lines-1 and `t` from 0 to 1.",
      args: '{ "lines": 25, "shift": 1, "generator": 0, "t": 0.5 }',
      run: (args) => {
        const C = core();
        const s = readState(args, C);
        const i = readGenerator(args, Number(s.lines));
        const t = readT(args);
        const r = reading(C, s, i, [0, t / 2, t, 1]);
        const here = r.samples[2];
        return {
          ...r,
          askedFor: { generator: i, t },
          pointAtT: {
            point: here.point,
            radius: here.radius,
            onSurfaceResidual: here.surfaceResidual,
          },
          note: surfaceNote(r),
        };
      },
    },

    preset_sweep: {
      describe:
        "Drive the real core's Base Shift through the picture's memorable placements (no turn, one step, a quarter turn, the waist, a half turn and a full turn) for `lines` generators and report the kind, turn angle, waist, throat and whether the midpoint of generator 0 sits at the waist each time. A turn of `lines` steps is the cylinder again, since the core takes shift modulo lines; an exact cone needs an even number of generators. `lines` must be a multiple of 5 from 5 to 200, and shifts above 100 are clamped to the applet's maximum.",
      args: '{ "lines": 20 }',
      run: (args) => {
        const C = core();
        const base = readState(args, C);
        const lines = Number(base.lines);
        const half = Math.round(lines / 2);
        const wanted = [
          { name: "cylinder", shift: 0 },
          { name: "one step", shift: 1 },
          { name: "quarter turn", shift: Math.round(lines / 4) },
          { name: "near the waist", shift: Math.max(0, half - 1) },
          { name: "waist", shift: half },
          { name: "full turn, cylinder again", shift: lines },
        ];
        const cases = wanted.map(({ name, shift }) => {
          const s = C.withOption(base, "shift", C.clamp(shift, C.MIN_SHIFT, C.MAX_SHIFT));
          const r = reading(C, s);
          return {
            name,
            requestedShift: shift,
            shift: r.shift,
            steps: r.steps,
            turnDegrees: r.turn.degrees,
            kind: r.kind,
            waist: r.waist,
            throat: r.throat,
            radiusAtBase: r.radiusAtBase,
            radiusAtWaist: r.radiusAtWaist,
            waistMatchesGenerator: r.waistMatchesGenerator,
            allSamplePointsMatchSurface: r.samples.every((p) =>
              p.radiusMatches && (p.surfaceResidual === null || Math.abs(p.surfaceResidual) < 1e-4)),
            status: r.status,
          };
        });
        return {
          lines,
          cases,
          cylinderAtNoTurn: cases[0].kind === "cylinder" && cases[0].radiusAtBase === round(C.R),
          fullTurnReturnsToCylinder: cases.at(-1)!.kind === "cylinder",
          coneAtHalfTurn: lines % 2 === 0 && half <= C.MAX_SHIFT ? cases[4].kind === "cone" : false,
          note:
            "At no turn the generators are vertical and the two bases are not twisted: r = R at every height. " +
            "Each step of Base Shift twists them further, so the waist a = R|cos(phi/2)| shrinks until the generators meet on the axis at a half turn; past that the surface opens out again. " +
            "Because the core reads shift modulo the generator count, a full turn is the cylinder once more.",
        };
      },
    },
  };
}

/** The saved { lines, shift, frame, solid } position, plus the core's reading of it. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported One Sheet Hyperboloid state version ${stateVersion}`);
  }
  const C = core();
  try {
    const s = readState(state, C);
    const r = reading(C, s);
    return {
      ...state,
      stateVersion,
      valid: true,
      lines: r.lines,
      shift: r.shift,
      frame: r.frame,
      solid: r.solid,
      steps: r.steps,
      turnDegrees: r.turn.degrees,
      waist: r.waist,
      throat: r.throat,
      kind: r.kind,
      radiusAtBase: r.radiusAtBase,
      radiusAtWaist: r.radiusAtWaist,
      radiusAtTop: r.radiusAtTop,
      generator: r.generator,
      waistMatchesGenerator: r.waistMatchesGenerator,
      allSamplePointsMatchSurface: r.samples.every((p) =>
        p.radiusMatches && (p.surfaceResidual === null || Math.abs(p.surfaceResidual) < 1e-4)),
      status: r.status,
      note:
        `Track.state saved ${r.lines} generators turned ${r.shift} ${r.shift === 1 ? "step" : "steps"}; ${r.status.text} ` +
        (r.kind === "cylinder"
          ? "Every generator stays at radius R = 0.5: this is the cylinder case c = infinity."
          : r.kind === "cone"
            ? "The generators meet on the axis at the middle: a = c = 0, the cone."
            : `The core puts the waist at a = ${r.waist} and the throat at c = ${r.throat}, so the generators lie on r²/a² − y²/c² = 1.`),
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "A saved One Sheet Hyperboloid position needs a generator count (a multiple of 5 from 5 to 200) and a whole-number shift from 0 to 100.",
    };
  }
}
