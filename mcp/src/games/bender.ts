/*
 * run_game_logic actions and saved-position reader for Bender (Gerbino's
 * illusion). The core lives in bender/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 *
 * Bender is a demo: there is no winner. What the core can state is geometric —
 * regular polygons, equal turns, symmetry — while the "bent sides" and the
 * "round hexagon" are effects in the viewer's eye. Every reading below says
 * which is which.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bender"].BenderCore;

interface BenderOptions {
  width: number; height: number; fixed: number; rot: number;
  side: number; speed: number; tint: number; offCenter: boolean; frame: number;
  center?: { x: number; y: number };
  phase?: number;
}

const round = (v: number, dp = 1): number => Math.round(v * 10 ** dp) / 10 ** dp;
const pair = (p: { x: number; y: number }): number[] => [round(p.x), round(p.y)];

/** The applet's four radio choices for both the outer and the small polygon. */
function shape(args: Json, key: string): number {
  const v = num(args, key);
  if (!core().SIDES.includes(v)) {
    throw new Error(`"${key}" must be one of ${core().SIDES.join(", ")} (the applet's four choices), got ${JSON.stringify(v)}`);
  }
  return v;
}

function point(v: unknown): { x: number; y: number } | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) throw new Error('"center" must be an object { x, y }');
  const o = v as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

/** Normalise arguments to the core's own option object, with its defaults. */
function settings(args: Json): BenderOptions {
  const d = core().DEFAULT;
  return {
    width: num(args, "width", d.width),
    height: num(args, "height", d.height),
    fixed: num(args, "fixed", d.fixed),
    rot: num(args, "rot", d.rot),
    side: num(args, "side", d.side),
    speed: num(args, "speed", d.speed),
    tint: num(args, "tint", d.tint),
    offCenter: args.offCenter === true,
    frame: Math.trunc(num(args, "frame", d.frame)),
    center: point(args.center),
    phase: args.phase === undefined || args.phase === null ? undefined : num(args, "phase"),
  };
}

/**
 * The core's exact reading of one rebuilt state: the drawn polygons plus what
 * is mathematically true of them, including an independently measured worst
 * error for the 360/n turn that should carry the picture onto itself.
 */
function reading(s: BenderOptions) {
  const B = core();
  const pic = B.picture(s);
  const properties = B.claims(s);
  const n = s.fixed, m = s.rot, step = (Math.PI * 2) / n, C = pic.center;
  let maxSymmetryError = 0;
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < m; j++) {
      const turned = B.rotate(C, pic.polygons[k][j], step);
      const q = pic.polygons[(k + 1) % n][j];
      maxSymmetryError = Math.max(maxSymmetryError, Math.hypot(turned.x - q.x, turned.y - q.y));
    }
  }
  return {
    outerCorners: n,
    smallCorners: m,
    frame: s.frame,
    frames: B.FRAMES,
    turnDegrees: round((360 * s.frame) / B.FRAMES, 2),
    rotationSymmetryDegrees: round(360 / n, 2),
    center: pair(C),
    radius: pic.radius,
    fixedVertices: pic.drawnFixed.map(pair),
    rotatingPolygons: pic.drawn.map((poly: { x: number; y: number }[]) => poly.map(pair)),
    properties,
    maxSymmetryError: round(maxSymmetryError, 3),
    tolerance: s.offCenter ? 4 : 1e-7,
    delayMs: B.delay(s),
  };
}

const ILLUSION_NOTE =
  "Mathematically: every small shape is a regular m-gon, all n of them turn through the same angle, and a turn of 360/n about the centre carries the whole picture onto itself at every frame. " +
  "The sides looking bent and a hexagon looking round are optical illusions — effects in the eye, not changes in the points; the core does not measure how convincing they look.";

export function actions(): GameActions {
  return {
    rotating_polygons: {
      describe: "The exact picture Bender draws at one step: n small regular polygons at the corners of an n-gon, all turning together. Requires fixed (outer corners) and rot (small corners), each 3, 4, 5 or 6; frame is 0..99 and optional side (0..80), speed, tint and offCenter may be given. Reports the drawn polygons, the turn angle and which geometric properties actually hold. The 'bent sides' are visual, not a mathematical claim.",
      args: '{ "fixed": 6, "rot": 3, "frame": 25, "side": 40 }',
      run: (args) => {
        const fixed = shape(args, "fixed"), rot = shape(args, "rot");
        const s = core().start({ ...settings(args), fixed, rot });
        return {
          ...reading(s),
          mode: s.offCenter ? "displaced" : "centered",
          note: ILLUSION_NOTE,
        };
      },
    },
    symmetry_check: {
      describe: "Check Bender's rotational symmetry across all 100 frames for a pair of shapes: fixed (outer corners) and rot (small corners), each 3, 4, 5 or 6, with optional offCenter and side. Turning the whole picture by 360/fixed about the centre should map each small polygon onto the next at every step. Reports the frames that agree and the largest error; any miss in the displaced mode is whole-pixel rounding, not a broken theorem.",
      args: '{ "fixed": 4, "rot": 4, "offCenter": false }',
      run: (args) => {
        const fixed = shape(args, "fixed"), rot = shape(args, "rot");
        const base = { ...settings(args), fixed, rot };
        let fullyConsistent = 0, largestError = 0;
        const firstFailingFrames: number[] = [];
        for (let frame = 0; frame < core().FRAMES; frame++) {
          const s = core().start({ ...base, frame });
          const r = reading(s), p = r.properties;
          largestError = Math.max(largestError, r.maxSymmetryError);
          if (p.regular && p.congruent && p.atVertices && p.synchronous && p.symmetry) {
            fullyConsistent++;
          } else if (firstFailingFrames.length < 5) {
            firstFailingFrames.push(frame);
          }
        }
        return {
          outerCorners: fixed,
          smallCorners: rot,
          mode: base.offCenter ? "displaced" : "centered",
          framesChecked: core().FRAMES,
          framesFullyConsistent: fullyConsistent,
          rotationSymmetryDegrees: round(360 / fixed, 2),
          smallPolygons: fixed,
          largestSymmetryError: round(largestError, 3),
          tolerance: base.offCenter ? 4 : 1e-7,
          firstFailingFrames,
          note: "This is a statement about points, not about looks: the n small polygons are congruent and turn in step, so the figure has n-fold rotational symmetry. That the red sides seem tilted, or a hexagon seems round, is an optical illusion; no geometry is broken.",
        };
      },
    },
  };
}

export function position(state: Json, _stateVersion: number): unknown {
  const s = core().start(settings(state));
  const r = reading(s);
  return {
    ...r,
    saved: {
      width: s.width,
      height: s.height,
      fixed: s.fixed,
      rot: s.rot,
      side: s.side,
      speed: s.speed,
      tint: s.tint,
      offCenter: s.offCenter,
      frame: s.frame,
      center: r.center,
      phaseRadians: round(s.phase, 4),
    },
    symmetryHolds: r.properties.symmetry,
    mode: s.offCenter ? "displaced" : "centered",
    note: "Rebuilt from the page's saved position by BenderCore: the outer and small polygons are regular and turn through the same angle, and the picture has " + s.fixed + "-fold rotational symmetry. Any apparent bending is an optical illusion, not a mathematical claim.",
  };
}
