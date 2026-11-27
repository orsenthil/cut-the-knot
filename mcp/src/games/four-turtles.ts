/*
 * run_game_logic actions and saved-position reader for Four Turtles.
 *
 * The core lives in four-turtles/four-turtles-core.js and is copied into
 * src/generated/cores/ at build time; every number below comes from it. N
 * turtles start at the corners of a regular N-gon and chase one another at
 * equal speed. With a = pi/N, a turtle's inward speed is V sin(a), so the
 * meeting time is T = R/(V sin a) = S/(V(1 - cos 2a)) and the distance crawled
 * is D = VT = S/(1 - cos 2a): one side exactly when N = 4. The applet's own
 * animation turns by sin(g)(1 - cos(g)) log(s/S) with g = pi(N-2)/N instead of
 * the true pursuit angle -cot(a) log(r/R); the two coefficients agree only at
 * N = 4. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["four-turtles"].FourTurtlesCore;

const round = (v: number, dp = 6): number => {
  if (!Number.isFinite(v)) return v;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};
const degrees = (rad: number): number => rad * 180 / Math.PI;
const close = (x: number, y: number, tol = 1e-9): boolean =>
  Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));

/** N must be a whole turtle count in the applet's own 3..20 range. */
function count(raw: unknown, label = "n"): number {
  const C = core();
  if (raw === undefined || raw === null) throw new Error(`missing required argument "${label}"`);
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new Error(`argument "${label}" must be a whole number, got ${JSON.stringify(raw)}`);
  }
  if (n < C.N_LIMIT.min || n > C.N_LIMIT.max) {
    throw new Error(`argument "${label}" must be between ${C.N_LIMIT.min} and ${C.N_LIMIT.max}, got ${n}`);
  }
  return n;
}

/** A strictly positive finite number, with an optional default. */
function positive(raw: unknown, label: string, fallback?: number): number {
  if (raw === undefined || raw === null) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing required argument "${label}"`);
  }
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) {
    throw new Error(`argument "${label}" must be a positive number, got ${JSON.stringify(raw)}`);
  }
  return v;
}

/** A non-negative whole frame index. */
function frameIndex(raw: unknown, label = "frame"): number {
  if (raw === undefined || raw === null) return 0;
  const i = Number(raw);
  if (!Number.isFinite(i) || !Number.isInteger(i) || i < 0) {
    throw new Error(`argument "${label}" must be a non-negative whole number, got ${JSON.stringify(raw)}`);
  }
  return i;
}

/** A core state on the applet's board (600 x 550 by default). */
function build(args: Json) {
  const C = core();
  const n = count(args.n);
  const width = positive(args.width, "width", C.CANVAS.width);
  const height = positive(args.height, "height", C.CANVAS.height);
  return C.start({ n, width, height });
}

/** The applet's turn coefficient against the true equal-speed pursuit angle. */
function coefficientReading(n: number, C = core()) {
  const applet = C.factors(n).turnPerLog;
  const physical = C.physicalTurnPerLog(n);
  return {
    appletTurnPerLog: round(applet),
    physicalPursuitTurnPerLog: round(physical),
    agree: close(applet, physical),
    note:
      "The page derives theta - theta0 = -cot(a) log(r/R), a = pi/N, for equal-speed pursuit. " +
      "The old applet turns by sin(g)(1 - cos(g)) log(s/S) with g = pi(N-2)/N. " +
      "The coefficients are both 1 for N = 4; elsewhere the animation is still a logarithmic " +
      "spiral, but of a different pitch. The page's cot(a) is the physical value; the applet's " +
      "constant is a display choice, and this port keeps the applet's animation numbers.",
  };
}

export function actions(): GameActions {
  return {
    meeting: {
      describe:
        "Where and when N equal-speed turtles meet on a regular N-gon of side `side` moving at speed `speed`. Reports T = R/(V sin a) = S/(V(1 - cos 2a)) and D = VT = S/(1 - cos 2a), a = pi/N, from the game's real core, plus the applet's frame rate. For N = 4, D is exactly one side; also compares the applet's turn coefficient with the true pursuit coefficient.",
      args: '{ "n": 4, "side": 300, "speed": 1 }',
      run: (args) => {
        const C = core();
        const n = count(args.n);
        const s = build(args);
        const g = C.geometry(s);
        const side = args.side === undefined || args.side === null ? g.side : positive(args.side, "side");
        const v = positive(args.speed, "speed", 1);
        const alpha = Math.PI / n;
        const radius = side / (2 * Math.sin(alpha));
        const distance = C.pageDistance(side, n);
        const time = C.pageTime(side, n, v);
        const f = C.factors(n);
        const framesToMeet = side / f.shrinkPerFrame;
        return {
          n,
          alphaRadians: round(alpha),
          startingSide: round(side),
          coreStartingSideOnBoard: round(g.side),
          circumradiusFromSide: round(radius),
          coreCircumradius: round(g.radius),
          speed: v,
          meetTime: round(time),
          meetTimeFromR: round(radius / (v * Math.sin(alpha))),
          distanceCrawled: round(distance),
          distanceOverSide: round(distance / side),
          distanceEqualsVT: close(distance, v * time),
          forFourTurtles:
            n === 4
              ? {
                  distanceEqualsOneSide: close(distance, side),
                  note: "cos(2a) = cos(pi/2) = 0, so D = S and T = S/V: each turtle walks exactly one side.",
                }
              : null,
          applet: {
            speedForN: C.speedForN(n),
            gammaRadians: round(f.gamma),
            shrinkPerFrame: round(f.shrinkPerFrame),
            framePeriodMs: C.PERIOD,
            framesToMeet: round(framesToMeet, 3),
            realSecondsAtFrameRate: round((framesToMeet * C.PERIOD) / 1000, 3),
            note: "Frames counted for the side given above; on the applet's default 600 x 550 board the starting side is coreStartingSideOnBoard.",
          },
          turnCoefficient: coefficientReading(n, C),
        };
      },
    },
    frame: {
      describe:
        "The picture after `frame` 50 ms ticks of the applet: current side, its share of the starting side, the turn in degrees, and the turtle corners. With `movingFrame` true the original polygon appears to turn the other way while the shrinking one stays on fixed rays; the log-spiral check confirms the core's turn equals its shrink coefficient times log(side ratio).",
      args: '{ "n": 4, "frame": 10, "movingFrame": false }',
      run: (args) => {
        const C = core();
        const s = C.setOptions(build(args), { movingFrame: Boolean(args.movingFrame) });
        const i = frameIndex(args.frame);
        const f = C.frameAt(s, i);
        const g = C.geometry(s);
        const coeff = C.factors(s.n).turnPerLog;
        const expectedAngle = Math.log(f.ratio) * (s.movingFrame ? -coeff : coeff);
        return {
          n: s.n,
          frame: i,
          movingFrame: s.movingFrame,
          side: round(f.side),
          ratio: round(f.ratio),
          turnDegrees: round(degrees(f.angle)),
          over: f.over,
          center: f.center,
          radius: round(f.radius),
          corners: f.corners.map((p: { x: number; y: number }) => ({ x: round(p.x), y: round(p.y) })),
          framesToMeet: round(g.side / C.factors(s.n).shrinkPerFrame, 3),
          logSpiralCheck:
            f.over || !Number.isFinite(f.angle)
              ? { applicable: false, note: "The turtles have met; there is no turning polygon left to measure." }
              : {
                  applicable: true,
                  angleFromRatio: round(expectedAngle),
                  matches: close(f.angle, expectedAngle),
                },
          note: s.movingFrame
            ? "Rotating frame: the shrinking polygon stays on fixed rays and the original is drawn turned by -angle, so it seems to turn the other way."
            : "Stationary frame: the turtles trace logarithmic spirals into the centre, turning more on each later tick.",
        };
      },
    },
  };
}

/**
 * Echo every field Track.state saved (the page calls Track.state(C.position(state)))
 * and re-read that picture with the real core: the side, ratio and turn at the
 * saved tick, the frames left until the turtles meet, and the pursuit distance
 * the page's formula predicts for the starting side.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Turtles state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Turtles position must be an object");
  }
  const C = core();
  const n = state.n === undefined || state.n === null ? C.N_LIMIT.initial : count(state.n);
  const frame = frameIndex(state.frame);
  const style = typeof state.style === "string" ? state.style : "whirl";
  let s = C.setOptions(C.start({ n }), {
    movingFrame: Boolean(state.movingFrame),
    traceIt: Boolean(state.traceIt),
    running: Boolean(state.running),
  });
  s = C.setStyle(s, ["spirals", "whirl", "both", "none"].includes(style) ? style : "none");
  const here = Object.assign({}, s, { frame });
  const g = C.geometry(here);
  const f = C.frameAt(here);
  const coeff = C.factors(n).turnPerLog;
  const expectedAngle = Math.log(f.ratio) * (s.movingFrame ? -coeff : coeff);
  const checks = {
    side: state.side === undefined ? null : close(Number(state.side), f.side),
    ratio: state.ratio === undefined ? null : close(Number(state.ratio), f.ratio),
    angle: state.angle === undefined ? null : close(Number(state.angle), f.angle),
    sideAtStart: state.sideAtStart === undefined ? null : close(Number(state.sideAtStart), g.side),
    radius: state.radius === undefined ? null : close(Number(state.radius), g.radius),
  };
  return {
    ...state,
    stateVersion,
    saved: {
      n,
      frame,
      running: s.running,
      movingFrame: s.movingFrame,
      traceIt: s.traceIt,
      style,
      side: state.side === undefined ? null : Number(state.side),
      ratio: state.ratio === undefined ? null : Number(state.ratio),
      angle: state.angle === undefined ? null : Number(state.angle),
      center: state.center === undefined ? null : state.center,
      radius: state.radius === undefined ? null : Number(state.radius),
      sideAtStart: state.sideAtStart === undefined ? null : Number(state.sideAtStart),
      traceLength: state.traceLength === undefined ? null : Number(state.traceLength),
      done: Boolean(state.done),
    },
    valid: Object.values(checks).every((v) => v !== false),
    core: {
      n,
      frame,
      center: g.center,
      radius: round(g.radius),
      sideAtStart: round(g.side),
      side: round(f.side),
      ratio: round(f.ratio),
      turnDegrees: round(degrees(f.angle)),
      over: f.over,
      done: C.finished(here),
      framesToMeet: round(g.side / C.factors(n).shrinkPerFrame, 3),
      logSpiralMatches: !f.over && Number.isFinite(f.angle) ? close(f.angle, expectedAngle) : null,
      savedMatchesCore: checks,
      pursuit: {
        distance: round(C.pageDistance(g.side, n)),
        distanceOverSide: round(C.pageDistance(g.side, n) / g.side),
        timeAtUnitSpeed: round(C.pageTime(g.side, n, 1)),
        forFourTurtles: n === 4 ? "D = S exactly, because cos(2*pi/4) = 0" : null,
      },
      turnCoefficient: coefficientReading(n, C),
    },
    note:
      "Track.state saved the turtle count, tick number, frame/trace/style switches and the core's own side, ratio, turn, centre, radius and trace length. " +
      "The real core rebuilds the starting polygon on the applet's 600 x 550 board, recomputes the side and turn at that tick, and applies the page's pursuit formulas to the starting side; " +
      "the saved trace length cannot be replayed because only its count, not the points, is stored.",
  };
}
