/*
 * run_game_logic actions and saved-position reader for Dupont Garden.
 *
 * Each jet is a projectile: sideways at constant speed V, vertically under
 * gravity g = 9.8. Eliminating time from x(t) = X0 + Vt and y(t) = Wt - g t²/2
 * gives the parabola y = a·x² + b·x + c. Two facts make the graph readable:
 * equal time steps give equal horizontal steps (constant first difference)
 * and equal *second* differences vertically (-g·dt²). Every number below is
 * computed by the game's real core, dupont-garden/dupont-garden-core.js,
 * copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape; positions are the whole core state the page saves with
 * Track.state (stateVersion 1), including its list of jet streams.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["dupont-garden"].DupontGardenCore as any;

type Jet = { x0: number; v: number; w: number; y0: number };
type Stream = Jet & {
  start: number; n: number; dt: number; dx: number; dy: number;
  bottom: number; currentTime: number;
};

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);

/** Validate a launch: V must be nonzero (the parabola divides by V) and W positive. */
function launch(args: Json, C: any): Jet & { p: any } {
  const x0 = num(args, "x0", 10);
  const v = num(args, "v", 8);
  const w = num(args, "w", 140);
  const y0 = num(args, "y0", 0);
  if (!Number.isFinite(v) || v === 0) {
    throw new Error('"v" must be a nonzero horizontal speed: the parabola equation divides by v');
  }
  if (!(w > 0) || !Number.isFinite(w)) {
    throw new Error('"w" must be a positive upward speed');
  }
  return { x0, v, w, y0, p: C.projectile(x0, v, w, y0) };
}

export function actions(): GameActions {
  return {
    trajectory: {
      describe:
        "For one fountain jet with horizontal speed v, upward speed w, start x0 and height y0 (defaults 8, 140, 10, 0), report its parabolic path as y = a·x² + b·x + c and check it against the core's x(t), y(t). Also give the flight time 2w/9.8, the apex height w²/19.6 at half that time, the horizontal range 2vw/9.8, the landing x, and the water height at two optional reading dots A and B (canvas-x probeA, probeB).",
      args: '{ "x0": 10, "v": 8, "w": 140, "probeA": 45, "probeB": 110 }',
      run: (args) => {
        const C = core();
        const { x0, v, w, y0, p } = launch(args, C);
        const g = C.G;

        // y = y0 + (w/v)(x-x0) - (g/(2v²))(x-x0)², expanded in x.
        const a = -g / (2 * v * v);
        const b = w / v + (g * x0) / (v * v);
        const c = y0 - (w * x0) / v - (g * x0 * x0) / (2 * v * v);

        const tCheck = (2 * w / g) / 3;
        const xCheck = C.xPosition(p, tCheck);
        const yCheck = C.yPosition(p, tCheck);
        const formulaY = a * xCheck * xCheck + b * xCheck + c;

        // The reading dots snap to the active flight curve in canvas pixels.
        const s = C.stream(p, 0, num(args, "drops", 10));
        const [lo, hi] = C.flightRange(s);
        const aX = num(args, "probeA", lo + (hi - lo) * 0.25);
        const bX = num(args, "probeB", lo + (hi - lo) * 0.75);
        const upAt = (canvasX: number): number => r6(C.HEIGHT - C.pointOnFlight(s, canvasX).y);

        return {
          launch: { x0: r6(x0), v: r6(v), w: r6(w), y0: r6(y0), g },
          parabola: { a: r6(a), b: r6(b), c: r6(c) },
          parabolaCheck: {
            atTime: r6(tCheck), coreX: r6(xCheck), coreY: r6(yCheck),
            formulaY: r6(formulaY),
            agrees: Math.abs(yCheck - formulaY) < 1e-6 * Math.max(1, Math.abs(yCheck)),
          },
          returnTime: r6(C.returnTime(p)),
          apexHeight: r6(C.maxHeight(p)),
          range: r6(C.distance(p)),
          landingX: r6(C.finalX(p)),
          probes: { A: { canvasX: r6(aX), up: upAt(aX) }, B: { canvasX: r6(bX), up: upAt(bX) } },
          note:
            `With v=${r6(v)} and w=${r6(w)}, the jet follows y = ${r6(a)}x² + ${r6(b)}x + ${r6(c)} ` +
            `(up from the ground, in the applet's units). It is back at ground level after ` +
            `${r6(C.returnTime(p))} time units, peaks at ${r6(C.maxHeight(p))} halfway through, ` +
            `and lands ${r6(C.distance(p))} units away at x=${r6(C.finalX(p))}. Changing v reshapes ` +
            `the parabola and moves the landing spot but leaves y(t) — and so the apex height — alone.`,
        };
      },
    },

    equal_steps: {
      describe:
        "Sample one jet (v, w, x0, y0 as in trajectory) at n+1 equally spaced times dt apart (defaults v=8, w=140, dt=0.5, n=6). Show through the core's x(t), y(t) that the horizontal steps are all v·dt, a constant, while the vertical first differences change by the constant second difference -9.8·dt². That constant downward second difference is exactly gravity, and is why a parabola's sampled heights have constant second differences.",
      args: '{ "v": 8, "w": 140, "dt": 0.5, "n": 6 }',
      run: (args) => {
        const C = core();
        const { v, w, p } = launch(args, C);
        const dt = num(args, "dt", C.DT);
        if (!(dt > 0) || !Number.isFinite(dt)) throw new Error('"dt" must be a positive time step');
        const n = num(args, "n", 6);
        if (!Number.isInteger(n) || n < 2 || n > 50) {
          throw new Error('"n" must be a whole number between 2 and 50');
        }

        const samples: { t: number; x: number; y: number }[] = [];
        for (let i = 0; i <= n; i++) {
          const t = i * dt;
          samples.push({ t: r6(t), x: r6(C.xPosition(p, t)), y: r6(C.yPosition(p, t)) });
        }
        const dx = samples.slice(1).map((s, i) => r6(s.x - samples[i].x));
        const dy = samples.slice(1).map((s, i) => r6(s.y - samples[i].y));
        const d2y = dy.slice(1).map((d, i) => r6(d - dy[i]));
        const d2x = dx.slice(1).map((d, i) => r6(d - dx[i]));
        const constantD2y = -C.G * dt * dt;

        return {
          step: r6(dt),
          samples,
          horizontalSteps: dx,
          verticalSteps: dy,
          verticalSecondDifferences: d2y,
          expectedHorizontalStep: r6(v * dt),
          expectedVerticalSecondDifference: r6(constantD2y),
          horizontalStepsConstant: dx.every((d) => Math.abs(d - v * dt) < 1e-6 * Math.max(1, Math.abs(v * dt))),
          horizontalSecondDifferences: d2x,
          verticalSecondDifferencesConstant: d2y.every(
            (d) => Math.abs(d - constantD2y) < 1e-6 * Math.max(1, Math.abs(constantD2y)),
          ),
          note:
            `Sideways motion is steady, so every ${r6(dt)}-unit step moves x by the same ${r6(v * dt)}; ` +
            `the horizontal second differences are zero. The upward steps ${dy.join(", ")} shrink by ` +
            `the same ${r6(constantD2y)} each time (-9.8·dt²), which is gravity acting alone. ` +
            `A constant vertical second difference is the fingerprint of a quadratic — a parabola.`,
        };
      },
    },
  };
}

/** A jet summary through the core, from a plain stream object. */
function jetReading(C: any, s: Stream) {
  const p = C.projectile(s.x0, s.v, s.w, s.y0);
  return {
    x0: r6(s.x0), v: r6(s.v), w: r6(s.w), y0: r6(s.y0),
    start: s.start, drops: s.n,
    returnTime: r6(C.returnTime(p)),
    apexHeight: r6(C.maxHeight(p)),
    range: r6(C.distance(p)),
    landingX: r6(C.finalX(p)),
    finished: C.isFinished(s) === true,
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Dupont Garden state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);

  // Echo the saved fields exactly as the page wrote them.
  const saved = {
    schedule: typeof src.schedule === "string" ? src.schedule : null,
    drops: Number.isFinite(Number(src.drops)) ? Number(src.drops) : null,
    delay: Number.isFinite(Number(src.delay)) ? Number(src.delay) : null,
    size: src.size && typeof src.size === "object" ? src.size : null,
    running: src.running === true,
    tick: Number.isFinite(Number(src.tick)) ? Number(src.tick) : null,
    cycle: Number.isFinite(Number(src.cycle)) ? Number(src.cycle) : null,
    complete: src.complete === true,
    probe: src.probe && typeof src.probe === "object" ? src.probe : null,
    streamCount: Array.isArray(src.streams) ? src.streams.length : 0,
  };

  const streams = Array.isArray(src.streams)
    ? (src.streams as Json[]).filter((s) => s && typeof s === "object") as unknown as Stream[]
    : [];
  if (streams.length === 0) {
    return { stateVersion, saved, reading: null, note: "The saved position has no jets to read." };
  }

  try {
    const jets = streams.map((s) => jetReading(C, s));
    // activeStream() needs only streams and a tick; reproduce that minimal state.
    const active = C.activeStream({ streams, tick: Number(src.tick) || 0 }) as Stream;
    const activeIndex = streams.indexOf(active);
    const probe = src.probe && typeof src.probe === "object" ? (src.probe as Json) : {};
    const upAt = (canvasX: number): number => r6(C.HEIGHT - C.pointOnFlight(active, canvasX).y);
    const aX = Number(probe.A);
    const bX = Number(probe.B);

    return {
      stateVersion,
      saved,
      reading: {
        jets,
        activeJetIndex: activeIndex,
        activeJet: jetReading(C, active),
        flightPoints: C.flightPoints(active, 8).map((pt: { x: number; y: number }) => ({
          x: r6(pt.x), up: r6(C.HEIGHT - pt.y),
        })),
        probes: {
          A: Number.isFinite(aX) ? { canvasX: r6(aX), up: upAt(aX) } : null,
          B: Number.isFinite(bX) ? { canvasX: r6(bX), up: upAt(bX) } : null,
        },
      },
      note:
        `${saved.streamCount} jets are saved in this ${saved.schedule === "auto" ? "randomly chosen" : String(saved.schedule)} pattern. ` +
        `The core recomputes each jet's parabola, apex, range and flight time from its saved launch: ` +
        `the active jet returns to the ground after ${jets[activeIndex].returnTime} units, peaks at ` +
        `${jets[activeIndex].apexHeight} and lands ${jets[activeIndex].range} units away. ` +
        `The reading dots A and B sit on that curve. This is a fountain, not a game, so there is no win or loss.`,
    };
  } catch (e) {
    return {
      stateVersion, saved, reading: null,
      note: `The saved position cannot be read by the core: ${(e as Error).message}`,
    };
  }
}
