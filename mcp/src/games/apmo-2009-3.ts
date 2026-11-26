/*
 * run_game_logic actions and saved-position reader for APMO 2009 Problem 3.
 * The core lives in apmo-2009-3/ and is copied into src/generated/cores/ at
 * build time; every number below comes from that real core. See _shared.ts.
 *
 * A keeps a fixed altitude h above the fixed base BC (half-base a). With
 * u = A.x - midpoint(BC),
 *
 *     AB^2 * AC^2 = (u^2 + a^2 + h^2)^2 - 4 a^2 u^2,
 *     product of the three altitudes = 4 a^2 h^3 / (AB * AC).
 *
 * So the product is largest exactly when AB * AC is smallest. The original
 * page claims the isosceles apex T (u = 0) is always best. That is true only
 * while base <= 2*height (a <= h). For a longer base the real maximum is at
 * u^2 = a^2 - h^2, where angle A is a right angle, and u = 0 is a local
 * minimum instead. S, the topmost point of the circumcircle, is always at or
 * above T, but the page's step from that picture to "R is smallest at T"
 * fails in exactly the same long-base range.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["apmo-2009-3"].Apmo20093Core;
type Point = { x: number; y: number };

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r2 = (v: number) => Math.round(v * 100) / 100;
const deg = (radians: number) => r3(radians * 180 / Math.PI);
const pt = (p: Point) => ({ x: r3(p.x), y: r3(p.y) });

/** Saved points are {x,y}; short [x,y] pairs are convenient for tool calls. */
function pointArg(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${key}" is not a finite point`);
    return { x, y };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or {x, y}`);
  const o = raw as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

function positive(args: Json, key: string): number {
  const v = num(args, key);
  if (!(v > 0)) throw new Error(`argument "${key}" must be positive`);
  return v;
}

/** Where to sample the apex. Default: nine positions from -a to a. */
function offsets(args: Json, a: number): number[] {
  const raw = args.offsets;
  if (raw === undefined || raw === null) {
    return [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((f) => f * a);
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('argument "offsets" must be a non-empty array of numbers');
  }
  return raw.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`offsets[${i}] is not a number`);
    return n;
  });
}

/** Put A, B and C on the board with the requested base, height and offset. */
function figure(C: any, base: number, height: number, u: number) {
  const mid = C.WIDTH / 2;
  const state = {
    A: { x: mid + u, y: C.BASE_Y - height },
    B: { x: mid - base / 2, y: C.BASE_Y },
    C: { x: mid + base / 2, y: C.BASE_Y },
    showNames: true, showHint1: true, showHint2: true,
    moves: 0, explored: false,
  };
  const g = C.compute(state);
  if (g.degenerate) {
    throw new Error("base and height must give a non-degenerate triangle: both must be at least 2");
  }
  return { state, g };
}

function peak(best: any) {
  return {
    kind: best.best.kind,
    offset: r3(best.best.u),
    product: r3(best.best.product),
    circumradius: r3(best.best.radius),
  };
}

function verdict(best: any) {
  return best.holds
    ? `The page's claim holds: base ${r3(best.base)} <= 2*height ${r3(best.threshold)}, so the product peaks at the isosceles apex u=0.`
    : `The page's claim is false here: base ${r3(best.base)} > 2*height ${r3(best.threshold)}. The product peaks at u=${r3(best.best.u)}, where angle A is a right angle, and the isosceles apex is a local minimum.`;
}

export function actions(): GameActions {
  return {
    sweep_apex: {
      describe:
        "Keep a triangle's base length and altitude fixed, slide A along its horizontal line, and report the product of the three altitudes at offsets u from the midpoint of BC (with the circumradius and angle at A at each), plus the true maximum. The maximum is at the isosceles point u=0 only when base <= 2*altitude; for a longer base it is where angle A is a right angle. Supply an optional 'offsets' array to choose the sampled positions; otherwise nine evenly spaced positions from -base/2 to base/2 are used; the true optimum is always added if it falls between them.",
      args: '{ "base": 300, "height": 60 }',
      run: (args) => {
        const C = core();
        const base = positive(args, "base");
        const height = positive(args, "height");
        const a = base / 2;
        const best = C.bestFor(base, height);
        const us = offsets(args, a);
        // Always show the true maximum in the sweep, even when it falls
        // between the evenly spaced default positions.
        if (best.right) {
          for (const u of [best.best.u, -best.best.u]) {
            if (!us.some((v) => Math.abs(v - u) < 1e-6)) us.push(u);
          }
        }
        const samples = us.map((u) => {
          const { g } = figure(C, base, height, u);
          return {
            offset: r3(u),
            product: r3(g.product),
            circumradius: r3(g.r),
            angleADegrees: deg(g.angleA),
            atIsosceles: Math.abs(u) < 1e-9,
          };
        });
        return {
          base: r3(base), height: r3(height), halfBase: r3(a),
          threshold: r3(best.threshold),
          claimHolds: best.holds,
          samples,
          maximum: peak(best),
          isosceles: { offset: 0, product: r3(best.isosceles.product), circumradius: r3(best.isosceles.radius) },
          rightAngle: best.right
            ? { offset: r3(best.right.u), product: r3(best.right.product), circumradius: r3(best.right.radius) }
            : null,
          verdict: verdict(best),
          note:
            "Since 2*area = AA'*BC = BB'*AC = CC'*AB and the area and BC are fixed, the altitude product is biggest exactly when AB*AC is smallest. That happens at u=0 only while base <= 2*height; beyond that it happens at u^2 = a^2 - h^2, a right angle at A.",
        };
      },
    },
    s_above_t: {
      describe:
        "For a fixed base, altitude and apex offset u, report T (the isosceles apex above the midpoint M of BC), S (the topmost point of the circumcircle), how far S is above T in board coordinates, the circumradius, the angle at A, and the altitude product as a percentage of its true maximum. S is at or above T with equality only at u=0, but when the base exceeds twice the altitude the smallest circumradius and the biggest product occur at a right angle at A, not at T.",
      args: '{ "base": 300, "height": 60, "offset": 137.5 }',
      run: (args) => {
        const C = core();
        const base = positive(args, "base");
        const height = positive(args, "height");
        const u = num(args, "offset", 0);
        const { state, g } = figure(C, base, height, u);
        const best = g.best;
        return {
          triangle: { A: pt(state.A), B: pt(state.B), C: pt(state.C) },
          base: r3(g.base), height: r3(g.height), offset: r3(g.offset),
          midpoint: pt(g.Am), T: pt(g.T), S: pt(g.S),
          gap: r3(g.gap),
          sVersusT: g.gap < 0.5 ? "S meets T at the isosceles point." : `S is ${r3(g.gap)} board units above T.`,
          circumcircle: { center: pt(g.O), radius: r3(g.r) },
          angleADegrees: deg(g.angleA),
          product: r3(g.product),
          percentOfMaximum: r2(100 * g.product / best.best.product),
          maximum: peak(best),
          claimHolds: best.holds,
          verdict: verdict(best),
          note:
            "S above T proves SM >= TM, with equality exactly at AB = AC. But it does not prove the circumradius is smallest there: when the base is longer than twice the height, the circle of the right triangle at A has centre M and radius a, smaller than the radius at T.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported APMO 2009 Problem 3 state version ${stateVersion}`);
  }
  const C = core();
  const seed = C.start({});
  const s = {
    A: pointArg(state, "A", seed.A),
    B: pointArg(state, "B", seed.B),
    C: pointArg(state, "C", seed.C),
    showNames: state.showNames !== false,
    showHint1: state.showHint1 === true,
    showHint2: state.showHint2 === true,
    moves: Math.round(num(state, "moves", seed.moves)),
    explored: state.explored === true,
  };
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showNames: s.showNames, showHint1: s.showHint1, showHint2: s.showHint2,
    moves: s.moves, explored: s.explored,
  };
  const g = C.compute(s) as any;
  if (g.degenerate) {
    return {
      ...saved, degenerate: true,
      note: "The saved corners are too close together to make a triangle, so there is nothing to measure.",
    };
  }
  const best = g.best;
  return {
    ...saved,
    degenerate: false,
    reading: {
      base: r3(g.base), height: r3(g.height), offset: r3(g.offset),
      area: r3(g.area),
      altitudes: { fromA: r3(g.height), toAC: r3(g.altitudeB), toAB: r3(g.altitudeC) },
      product: r3(g.product),
      percentOfMaximum: r2(100 * g.product / best.best.product),
      angleADegrees: deg(g.angleA),
      circumcircle: { center: pt(g.O), radius: r3(g.r) },
      midpoint: pt(g.Am), T: pt(g.T), S: pt(g.S), gap: r3(g.gap),
      maximum: peak(best),
      claimHolds: best.holds,
    },
    verdict: verdict(best),
    note:
      "This is the same picture the page draws: altitude feet, circumcircle, T and S. The altitude product and circumradius show whether the page's isosceles claim holds at this saved position.",
  };
}
