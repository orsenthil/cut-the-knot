/*
 * run_game_logic actions and saved-position reader for Coupled Impossible Fork.
 * The core lives in coupled-impossible-fork/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Segment = { a: Point; b: Point; kind: string };

interface Geometry {
  w: number;
  lessReal: boolean;
  width: number;
  height: number;
  L: number;
  gap: number;
  cx: number;
  cy: number;
  front: Record<string, Point>;
  back: Record<string, Point>;
  join: Record<string, Point>;
  lines: Segment[];
  faces: Point[][];
}

interface Core {
  W_MIN: number;
  W_MAX: number;
  W_DEFAULT: number;
  WIDTH: number;
  HEIGHT: number;
  start(options: Json): Json;
  setW(state: Json, w: number): Json;
  geometry(state: Json): Geometry;
  describe(state: Json): { closed: boolean; text: string };
  reflect(point: Point, cx: number, cy: number): Point;
  dist(a: Point, b: Point): number;
}

const core = (): Core =>
  (cores["coupled-impossible-fork"] as unknown as { CoupledImpossibleForkCore: Core })
    .CoupledImpossibleForkCore;

/** Validated constructor options, matching the core's own ranges. */
function options(args: Json) {
  const C = core();
  const w = Math.round(num(args, "w", C.W_DEFAULT));
  if (w < C.W_MIN || w > C.W_MAX) {
    throw new Error(`"w" must be a whole number from ${C.W_MIN} to ${C.W_MAX}`);
  }
  let lessReal = false;
  if (args.lessReal !== undefined) {
    if (typeof args.lessReal !== "boolean") throw new Error('"lessReal" must be true or false');
    lessReal = args.lessReal;
  }
  const width = Math.round(num(args, "width", C.WIDTH));
  const height = Math.round(num(args, "height", C.HEIGHT));
  if (width < 1) throw new Error('"width" must be at least 1');
  if (height < 7) throw new Error('"height" must be at least 7');
  return { w, lessReal, width, height };
}

/**
 * What the core says about one drawing: the two skeletons and their half-turn
 * agreement, the four equal bar beams, and the gap at the joined ends.
 */
function read(state: Json) {
  const C = core();
  const g = C.geometry(state);
  const status = C.describe(state);

  // Each q_i must be the exact 180-degree rotation of p_i about the centre.
  const congruence: Record<string, boolean> = {};
  let maxReflectionError = 0;
  for (let i = 2; i <= 8; i++) {
    const p = g.front["p" + i];
    const q = g.back["q" + i];
    const r = C.reflect(p, g.cx, g.cy);
    const err = Math.max(Math.abs(r.x - q.x), Math.abs(r.y - q.y));
    congruence[`p${i}/q${i}`] = err < 1e-9;
    maxReflectionError = Math.max(maxReflectionError, err);
  }

  // The two long beams of each Pi (not the short slanted steps) have length L.
  const barBeams: Record<string, number> = {
    "p2-j30": C.dist(g.front.p2, g.join.j30),
    "p8-j23": C.dist(g.front.p8, g.join.j23),
    "q2-j31": C.dist(g.back.q2, g.join.j31),
    "q8-j38": C.dist(g.back.q8, g.join.j38),
  };
  const equalBars = Object.values(barBeams).every((L) => Math.abs(L - g.L) < 1e-9);

  const lineCounts: Record<string, number> = {};
  for (const line of g.lines) lineCounts[line.kind] = (lineCounts[line.kind] ?? 0) + 1;

  return { g, status, congruence, maxReflectionError, barBeams, equalBars, lineCounts };
}

export function actions(): GameActions {
  const C = core();
  return {
    frame: {
      describe:
        "Reports one drawing of the impossible frame: the seven-point skeleton of one Pi, its half-turn image about the canvas centre, the length of the four bar beams, and the gap between the two middle beams. The right half is exactly the half-turn of the left and each half's two beams are equal, so each piece alone is an ordinary object; the two middle beams meet (gap zero) only at W = 500, where the halves couple.",
      args: '{ "w": 500, "lessReal": false }',
      run: (args) => {
        const state = C.start(options(args));
        const r = read(state);
        return {
          w: r.g.w,
          lessReal: r.g.lessReal,
          canvas: { width: r.g.width, height: r.g.height },
          skeleton: r.g.front,
          halfTurnImage: r.g.back,
          halfTurnPairs: r.congruence,
          maxReflectionError: r.maxReflectionError,
          beamLength: r.g.L,
          barBeams: r.barBeams,
          beamsEqual: r.equalBars,
          middleBeamGap: r.g.gap,
          coupled: r.status.closed,
          status: r.status.text,
          lineCounts: r.lineCounts,
          maskedFaces: r.g.faces.length,
        };
      },
    },
    sweep: {
      describe:
        "Steps the beam-length slider W over a range and reports the gap between the two middle beams at each step. The gap falls linearly with W and reaches exactly zero at W = 500, the only setting where the two possible Pi pieces couple into the impossible frame.",
      args: '{ "from": 250, "to": 500, "step": 50 }',
      run: (args) => {
        const from = Math.round(num(args, "from", C.W_MIN));
        const to = Math.round(num(args, "to", C.W_MAX));
        const step = Math.round(num(args, "step", 50));
        if (from < C.W_MIN || from > C.W_MAX || to < C.W_MIN || to > C.W_MAX) {
          throw new Error(`"from" and "to" must be between ${C.W_MIN} and ${C.W_MAX}`);
        }
        if (from > to) throw new Error('"from" must not exceed "to"');
        if (step < 1 || step > C.W_MAX - C.W_MIN) {
          throw new Error(`"step" must be between 1 and ${C.W_MAX - C.W_MIN}`);
        }

        const wanted: number[] = [];
        for (let w = from; w <= to; w += step) wanted.push(w);
        if (wanted[wanted.length - 1] !== to) wanted.push(to);
        // Keep the answer bounded even for a step of one unit.
        const stride = Math.max(1, Math.ceil(wanted.length / 65));
        const sampled = wanted.filter((_, i) => i % stride === 0);
        if (sampled[sampled.length - 1] !== to) sampled.push(to);

        const samples = sampled.map((w) => {
          const state = C.setW(C.start({ w }), w);
          const g = C.geometry(state);
          return {
            w: g.w,
            beamLength: g.L,
            middleBeamGap: g.gap,
            coupled: C.describe(state).closed,
          };
        });
        return {
          from,
          to,
          step,
          stride,
          closingW: C.W_MAX,
          samples,
          note: "The gap shrinks linearly to zero at W = 500, where the two middle beams end at the same point.",
        };
      },
    },
  };
}

/** The page's saved fields, plus what the core reads from them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Coupled Impossible Fork state version ${stateVersion}`);
  }
  const C = core();
  const w = Math.round(num(state, "w", C.W_DEFAULT));
  if (w < C.W_MIN || w > C.W_MAX) {
    throw new Error(`saved "w" must be between ${C.W_MIN} and ${C.W_MAX}`);
  }
  const lessReal = state.lessReal === true;
  const width = Math.round(num(state, "width", C.WIDTH));
  const height = Math.round(num(state, "height", C.HEIGHT));
  if (width < 1 || height < 7) throw new Error("saved canvas size is too small");

  const r = read(C.start({ w, lessReal, width, height }));
  return {
    stateVersion,
    // The fields the page saved with Track.state, with the same names.
    w: r.g.w,
    lessReal: r.g.lessReal,
    width: r.g.width,
    height: r.g.height,
    // What the core adds.
    beamLength: r.g.L,
    barBeams: r.barBeams,
    beamsEqual: r.equalBars,
    halfTurnCongruent: Object.values(r.congruence).every(Boolean),
    maxReflectionError: r.maxReflectionError,
    middleBeamGap: r.g.gap,
    coupled: r.status.closed,
    status: r.status.text,
    note: "Two congruent Pi pieces; the frame is impossible only when the beams meet at W = 500.",
  };
}
