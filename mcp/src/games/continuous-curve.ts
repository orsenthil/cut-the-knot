/*
 * run_game_logic actions and saved-position reader for Continuous Curve.
 *
 * The real core is continuous-curve/continuous-curve-core.js, copied into
 * src/generated/cores/ at build time. Its geometry() is the applet's draw
 * loop: one pen that never lifts, directions repeating down, right, up, left,
 * with the side shrinking by `spread` on the second and fourth leg of each lap.
 * What looks like squares inside squares is therefore a single polyline, and
 * every number below is measured by that core. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["continuous-curve"].ContinuousCurveCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Geometry = ReturnType<Core["geometry"]>;
type Point = { x: number; y: number };

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

/** The three applet sliders (plus canvas size), checked as finite numbers; the core clamps to its ranges. */
function settings(args: Json) {
  return {
    margin: Math.trunc(num(args, "margin", 20)),
    spread: Math.trunc(num(args, "spread", 5)),
    legs: Math.trunc(num(args, "legs", 26)),
    width: Math.trunc(num(args, "width", 400)),
    height: Math.trunc(num(args, "height", 400)),
  };
}

function asFinite(v: unknown, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number`);
  return n;
}

function readPoint(value: unknown, name: string): Point | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value) && value.length === 2) {
    return { x: asFinite(value[0], `${name}[0]`), y: asFinite(value[1], `${name}[1]`) };
  }
  if (typeof value === "object") {
    const o = value as Json;
    if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
      throw new Error(`${name} must have finite x and y`);
    }
    return { x: asFinite(o.x, `${name}.x`), y: asFinite(o.y, `${name}.y`) };
  }
  throw new Error(`${name} must be { "x": ..., "y": ... } or [x, y]`);
}

/**
 * Re-derive every corner from the applet's own leg lengths and its fixed
 * direction cycle, and compare with the core's vertices. A single pen position
 * that walks from one corner to the next is what makes the drawing one line.
 */
function continuity(s: State, g: Geometry) {
  let x = g.center.x, y = g.center.y;
  let stepsAgree = true, shrinkAgrees = true;
  for (let i = 0; i < g.drawn; i++) {
    const d = g.sides[i];
    let nx = x, ny = y;
    switch (i % 4) {
      case 0: ny = y + d; break;
      case 1: nx = x + d; break;
      case 2: ny = y - d; break;
      default: nx = x - d; break;
    }
    const v = g.vertices[i + 1];
    if (!v || v.x !== nx || v.y !== ny) stepsAgree = false;
    // The first right leg (i = 1) keeps the full side; after that d shortens by
    // `spread` on every other leg, i.e. on legs 3, 5, 7, ... (0-indexed).
    const expected = i === 0 ? g.side0 : g.side0 - s.spread * Math.floor((i - 1) / 2);
    if (d !== expected) shrinkAgrees = false;
    x = nx;
    y = ny;
  }
  return {
    drawnLegs: g.drawn,
    corners: g.vertices.length,
    oneUnbrokenPolyline: g.vertices.length === g.drawn + 1 && stepsAgree,
    everyCornerFollowsTheLast: stepsAgree,
    sideLengthsFollowAppletRule: shrinkAgrees,
    shrinkPerFullLap: 2 * s.spread,
    lastLegLength: g.drawn ? g.sides[g.drawn - 1] : null,
  };
}

export function actions(): GameActions {
  return {
    trace: {
      describe:
        "Draw the continuous spiral from the applet's three sliders: edge gap `margin`, turn step `spread` and `legs` straight legs (with optional `width` and `height` for the canvas). Returns the starting corner, a sample of corners, the leg lengths and a check that every leg begins where the previous one ended, so the picture is one unbroken polyline and not separate squares.",
      args: '{ "margin": 20, "spread": 5, "legs": 26 }',
      run: (args) => {
        const C = core();
        const s = C.start(settings(args));
        const g = C.geometry(s);
        const stride = Math.max(1, Math.ceil(g.vertices.length / 16));
        const sample = g.vertices
          .filter((_: Point, i: number) => i % stride === 0 || i === g.vertices.length - 1)
          .map(pt);
        return {
          settings: { margin: s.margin, spread: s.spread, legs: s.legs, width: s.width, height: s.height },
          side0: g.side0,
          start: pt(g.center),
          drawn: g.drawn,
          stoppedEarly: g.stoppedEarly,
          sampleCorners: sample,
          lastCorner: g.drawn ? pt(g.vertices[g.drawn]) : null,
          firstLegLengths: g.sides.slice(0, 8),
          continuity: continuity(s, g),
          status: C.status(s, g, g.drawn),
          note: "The pen goes down, right, up, left and never lifts; after the first lap each pair of legs is `spread` shorter, so the eye reads nearly-closed squares but the line never closes.",
        };
      },
    },
    follow: {
      describe:
        "Place the page's tracing dot on corner `index` of the spiral built from the sliders (or pass `advance`: true to step one leg on, as an arrow key does). Reports the corner coordinates, which leg is being followed and the game's own status line.",
      args: '{ "margin": 20, "spread": 5, "legs": 26, "index": 1 }',
      run: (args) => {
        const C = core();
        const s = C.start(settings(args));
        const index = num(args, "index", 0);
        let t = C.setTrace(s, index);
        if (args.advance === true) t = C.nextTrace(t);
        const g = C.geometry(t);
        const i = Math.max(0, Math.min(g.drawn, t.trace));
        const here = g.vertices[i];
        const there = i < g.drawn ? g.vertices[i + 1] : null;
        return {
          settings: { margin: t.margin, spread: t.spread, legs: t.legs },
          drawn: g.drawn,
          corner: i,
          point: pt(here),
          followingLeg: there ? i + 1 : null,
          from: pt(here),
          to: there ? pt(there) : null,
          status: C.status(t, g, i),
          note: "The dot sits on a corner of the one continuous line; the next leg starts exactly where this one ended.",
        };
      },
    },
  };
}

/** Track.state saves the three sliders, the canvas, the dot's corner and the drawn count; the core rebuilds the spiral. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Continuous Curve state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Continuous Curve position must be an object");
  }

  const C = core();
  const chosen = settings(state);
  const savedTrace = Math.trunc(num(state, "trace", 0));
  const savedDrawn = Math.trunc(num(state, "drawn", 0));
  const savedPoint = readPoint(state.point, "point");

  const s = C.setTrace(C.start(chosen), savedTrace);
  const g = C.geometry(s);
  const i = Math.max(0, Math.min(g.drawn, s.trace));
  const corePoint = g.vertices[i];
  const check = continuity(s, g);

  return {
    stateVersion,
    saved: {
      margin: chosen.margin,
      spread: chosen.spread,
      legs: chosen.legs,
      width: chosen.width,
      height: chosen.height,
      trace: savedTrace,
      drawn: savedDrawn,
      point: savedPoint,
    },
    effective: { margin: s.margin, spread: s.spread, legs: s.legs, width: s.width, height: s.height },
    side0: g.side0,
    start: pt(g.center),
    drawnByCore: g.drawn,
    stoppedEarly: g.stoppedEarly,
    corner: i,
    corePoint: pt(corePoint),
    savedPointMatchesCore: savedPoint
      ? Math.abs(savedPoint.x - corePoint.x) < 1e-9 && Math.abs(savedPoint.y - corePoint.y) < 1e-9
      : null,
    savedDrawnMatchesCore: savedDrawn === g.drawn,
    followingLeg: i < g.drawn ? i + 1 : null,
    status: C.status(s, g, i),
    continuity: check,
    note: "Track.state saved the sliders and the dot's corner in board units. The core redraws the same spiral, so the saved dot can be checked against the corner it actually reaches.",
  };
}
