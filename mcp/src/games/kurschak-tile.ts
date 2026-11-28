/*
 * run_game_logic actions and saved-position reader for Kürschak's Tile.
 *
 * Every number comes from the real core, copied at build time from
 * kurschak-tile/kurschak-tile-core.js into src/generated/cores/. The dodecagon
 * is the twelve-pointed star made of 24 thin isosceles 15-15-150 triangles and
 * 12 equilateral ones; all pieces have the same two sides R/(2 cos 15 deg).
 * Sliding nine copies into three corners of the square over 30 frames leaves
 * the coloured region equal to 3/4 of the square, so a dodecagon in a circle
 * of radius R has area 3 R^2. This is a demonstration: there is no win or loss.
 * Coordinates are SVG viewBox units, y down. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  width: number; height: number; step: number;
  moving: boolean; showNames: boolean; showHint: boolean;
};
type Geom = {
  C: Pt; r: number; inner: number; V: Pt[]; W: Pt[]; U: Pt[];
  iso: Pt[][]; equi: Pt[][];
};
type Piece = { id: number; kind: string; points: Pt[]; moving: boolean; hidden?: boolean };
type Spec = { piece: number; final: Pt[]; kind: string };
type Claim = {
  r: number; thin: number; regular: number; dodecagon: number; outside: number;
  polygon: number; square: number; ratio: number; side: number; equalSide: number;
};
type Core = {
  SIDES: number; STEPS: number; HALF_ANGLE: number;
  start(options?: Partial<Pick<State, "width" | "height">>): State;
  geometry(s: State): Geom;
  outer(g: Geom): { kind: string; points: Pt[] }[][];
  movingSpecs(g: Geom): Spec[];
  movingTriangle(spec: Spec, g: Geom, step: number): { id: number; kind: string; points: Pt[]; moving: boolean };
  positions(s: State): Piece[];
  claim(radius?: number): Claim;
  result(s: State): string | null;
  move(s: State, a: Json): State | null;
};

const core = (): Core => cores["kurschak-tile"].KurschakTileCore as unknown as Core;

/* The core is exact up to floating point; only the numbers we print are rounded. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0);
const bary = (pts: Pt[]): Pt => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });

/** A positive finite argument (radius, canvas size). */
function positive(raw: unknown, label: string, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`argument "${label}" must be a positive number`);
  return n;
}

/** The rearrangement has exactly C.STEPS + 1 frames, 0 through 30. */
function frame(raw: unknown, C: Core, label: string): number {
  const n = raw === undefined || raw === null ? C.STEPS : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > C.STEPS) {
    throw new Error(`argument "${label}" must be an integer from 0 to ${C.STEPS}`);
  }
  return n;
}

/** One frame's piece census, measured from the core's own positions(). */
function census(C: Core, s: State): Json {
  const pieces = C.positions(s);
  return {
    step: s.step,
    pieces: pieces.length,
    hiddenOriginals: pieces.filter((p) => p.hidden === true).length,
    travellingCopies: pieces.filter((p) => p.moving).length,
    result: C.result(s),
  };
}

export function actions(): GameActions {
  return {
    area_and_ratio: {
      describe:
        "Check the page's area formula from the core's geometry for a circle of `radius` R (default 1): 24 thin 15-15-150 triangles plus 12 equilateral ones give the dodecagon area 6·sin(30°)·R² = 3R², the 8 thin plus 4 equilateral corner pieces give R², so the coloured part is 3/4 of the 4R² square. Also reports that every piece has two equal sides R/(2 cos 15°), which is why the same pieces tile both shapes.",
      args: '{ "radius": 3 }',
      run: (args) => {
        const C = core();
        const radius = positive(args.radius, "radius", 1);
        const cl = C.claim(radius);
        const thin = cl.thin;
        const regular = cl.regular;
        const dodecagon = 24 * thin + 12 * regular;
        const outside = 8 * thin + 4 * regular;
        const expectedSide = radius / (2 * Math.cos(C.HALF_ANGLE));
        return {
          radius,
          pieces: { thinInStar: 24, equilateralInStar: 12, thinInCorners: 8, equilateralInCorners: 4 },
          thinTriangleArea: r6(thin),
          equilateralTriangleArea: r6(regular),
          star: {
            dodecagonArea: r6(cl.dodecagon),
            fromPieces: r6(dodecagon),
            formulaThreeRSquared: r6(3 * radius * radius),
            polygonArea: r6(cl.polygon),
          },
          corners: {
            outsideArea: r6(cl.outside),
            fromPieces: r6(outside),
            formulaRSquared: r6(radius * radius),
          },
          square: { area: r6(cl.square), formulaFourRSquared: r6(4 * radius * radius) },
          ratio: r6(cl.ratio),
          threeQuarters: Math.abs(cl.ratio - 0.75) < 1e-9,
          equalSide: { measured: r6(cl.equalSide), formula: r6(expectedSide), dodecagonSide: r6(cl.side) },
          note:
            `Every thin triangle is a 15-15-150 isosceles with equal side R/(2 cos 15°) = ${r6(expectedSide)}, and the blue ones are equilateral on the same base, so the 24 + 12 pieces tile the dodecagon. ` +
            `Their total area is 24·${r6(thin)} + 12·${r6(regular)} = ${r6(cl.dodecagon)} = 3·${radius}² = 3R². ` +
            `The gaps need only 8 + 4 more of the same pieces (${r6(cl.outside)} = R²), leaving ${r6(cl.ratio)} of the ${r6(cl.square)} square coloured.`,
        };
      },
    },

    rearrange: {
      describe:
        "Run Kürschak's 30-frame rearrangement through the real core: nine of the 36 star pieces are hidden and nine copies slide into three corners of the square. Accepts `step` (integer 0-30, default 30), and optional `width` and `height` for the canvas. Reports the frame-by-frame piece census at steps 0, 15 and 30, the travelling pieces at the requested frame, where one copy starts and ends, and the confirmed 3/4 area ratio.",
      args: '{ "step": 30, "width": 500, "height": 450 }',
      run: (args) => {
        const C = core();
        const step = frame(args.step, C, "step");
        const width = positive(args.width, "width", 500);
        const height = positive(args.height, "height", 450);
        const s0 = C.start({ width, height });
        const g = C.geometry(s0);
        /* step goes through the core's move(), exactly as the scrub handle does. */
        const s = C.move(s0, { type: "step", value: step }) ?? s0;
        const mid = Math.floor(C.STEPS / 2);
        const frames = [0, mid, C.STEPS].map((f) =>
          census(C, C.move(s0, { type: "step", value: f }) ?? s0));
        const specs = C.movingSpecs(g);
        const moving = C.positions(s).filter((p) => p.moving);
        const first = specs[0];
        const specIndex = first.piece;
        const travelling = moving.find((p) => p.id === specIndex);
        const startTriangle = specIndex < 24 ? g.iso[specIndex] : g.equi[specIndex - 24];
        const cl = C.claim(g.r);
        return {
          canvas: { width: s.width, height: s.height, radius: r6(g.r) },
          requestedStep: step,
          frames,
          atRequested: {
            ...census(C, s),
            moving: s.moving,
            showNames: s.showNames,
            showHint: s.showHint,
            travellingPieces: moving.map((p) => ({ id: p.id, kind: p.kind, centre: pt(bary(p.points)) })),
            hiddenIds: C.positions(s).filter((p) => p.hidden === true).map((p) => p.id),
            cornerGapsFilled: C.outer(g).length,
          },
          firstCopy: {
            id: specIndex,
            kind: first.kind,
            startCentre: pt(bary(startTriangle)),
            endCentre: pt(bary(first.final)),
            atStepCentre: travelling ? pt(bary(travelling.points)) : null,
          },
          area: {
            dodecagon: r6(cl.dodecagon), outside: r6(cl.outside),
            square: r6(cl.square), ratio: r6(cl.ratio),
          },
          note:
            `At step 0 the 24 thin and 12 equilateral pieces tile the dodecagon. ` +
            `From step 1 to ${C.STEPS - 1} the originals of ${specs.length} pieces are hidden while copies travel; ` +
            `at step ${C.STEPS} those copies fill three corners and ${r6(cl.ratio)} of the square is coloured. ` +
            `This is a demonstration with no winner, so the tracker records only that it was explored.`,
        };
      },
    },
  };
}

/* Reading a saved position must never throw on a damaged or older record. */

const savedPositive = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const savedFrame = (v: unknown, C: Core, fallback: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= C.STEPS ? n : fallback;
};
const savedBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Kürschak's Tile state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Kürschak's Tile position must be an object");
  }
  const C = core();
  const base = C.start({});
  const width = savedPositive(state.width, base.width);
  const height = savedPositive(state.height, base.height);
  const step = savedFrame(state.step, C, base.step);
  const moving = savedBool(state.moving, base.moving);
  const showNames = savedBool(state.showNames, base.showNames);
  const showHint = savedBool(state.showHint, base.showHint);
  /* Rebuild through the core's own move() so step and the two switches stay
   * in the same form the page uses. */
  let s = C.start({ width, height });
  s = C.move(s, { type: "step", value: step }) ?? s;
  s = C.move(s, { type: "option", key: "moving", value: moving }) ?? s;
  s = C.move(s, { type: "option", key: "showNames", value: showNames }) ?? s;
  s = C.move(s, { type: "option", key: "showHint", value: showHint }) ?? s;

  const g = C.geometry(s);
  const cl = C.claim(g.r);
  const pieces = C.positions(s);
  const readable =
    width === Number(state.width) && height === Number(state.height)
    && step === Number(state.step) && typeof state.moving === "boolean";
  const result = C.result(s);

  return {
    ...state,
    stateVersion,
    width: s.width,
    height: s.height,
    step: s.step,
    moving: s.moving,
    showNames: s.showNames,
    showHint: s.showHint,
    savedReadable: readable,
    frameCount: C.STEPS + 1,
    pieces: {
      total: pieces.length,
      thin: 24,
      equilateral: 12,
      hiddenOriginals: pieces.filter((p) => p.hidden === true).length,
      travellingCopies: pieces.filter((p) => p.moving).length,
      cornerGaps: C.outer(g).length,
    },
    geometry: {
      radius: r6(g.r),
      innerSide: r6(g.inner),
      dodecagonArea: r6(cl.dodecagon),
      squareArea: r6(cl.square),
      outsideArea: r6(cl.outside),
      areaRatio: r6(cl.ratio),
      threeQuarters: Math.abs(cl.ratio - 0.75) < 1e-9,
      areaScaleThreeRSquared: r6(cl.dodecagon / (g.r * g.r)),
    },
    result,
    done: result === "done",
    note: !readable
      ? "Some saved fields could not be read, so the core rebuilt the opening picture; the reading below comes from that reconstruction."
      : `Track.state saved the canvas size, the step (0..${C.STEPS}), the moving flag and the names/hint switches. ` +
        `At step ${s.step} the core draws ${pieces.length} pieces (${pieces.filter((p) => p.moving).length} travelling, ` +
        `${pieces.filter((p) => p.hidden === true).length} originals hidden); ` +
        `the coloured region is ${r6(cl.ratio)} of the ${r6(cl.square)} square, and the dodecagon area is ${r6(cl.dodecagon)} = 3·${r6(g.r)}². ` +
        `This is a demonstration with no win or loss, so the tracker just records exploration.`,
  };
}
