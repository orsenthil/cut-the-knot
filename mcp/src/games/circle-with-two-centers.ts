/*
 * run_game_logic actions and saved-position reader for A Circle With Two
 * Centers. The core (circle-with-two-centers/ in the site, copied into
 * src/generated/cores/ at build time) does the whole construction. Every
 * number below is derived from that core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-with-two-centers"].CircleWithTwoCentersCore;

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };

function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must have numeric x and y`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

/** The three points and the cheat switch the core starts a drawing from. */
function readConfig(args: Json) {
  const C = core();
  return C.start({
    A: args.A ? readPoint(args.A, "A") : undefined,
    B: args.B ? readPoint(args.B, "B") : undefined,
    C: args.C ? readPoint(args.C, "C") : undefined,
    cheat: args.cheat === undefined ? true : !!args.cheat,
  });
}

/* The core uses NaN for points that cannot be drawn; JSON cannot carry it. */
function safeNum(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function safePoint(p: unknown): Point | null {
  if (!p || typeof p !== "object") return null;
  const q = p as Json;
  const x = safeNum(q.x);
  const y = safeNum(q.y);
  return x === null || y === null ? null : { x, y };
}

function safeCircle(c: unknown): Circle | null {
  const p = safePoint(c);
  if (!p || typeof c !== "object") return null;
  const r = safeNum((c as Json).r);
  return r === null || r <= 0 ? null : { x: p.x, y: p.y, r };
}

function dist(p: Point, q: Point): number {
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** The angle at q between the directions to p and r, in degrees. */
function angleDeg(p: Point | null, q: Point | null, r: Point | null): number | null {
  if (!p || !q || !r) return null;
  const ux = p.x - q.x;
  const uy = p.y - q.y;
  const vx = r.x - q.x;
  const vy = r.y - q.y;
  if (!ux && !uy && !vx && !vy) return null;
  const a = Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy) * 180 / Math.PI;
  return safeNum(a);
}

/** Summarise one of the two drawings the core can produce. */
function drawing(g: ReturnType<ReturnType<typeof core>["geometry"]>, A: Point, cheat: boolean) {
  const c1 = safePoint(g.centerB);
  const c2 = safePoint(g.centerC);
  const E = safePoint(g.E);
  const F = safePoint(g.F);
  const separation = c1 && c2 ? dist(c1, c2) : null;
  const eFromA = E ? dist(E, A) : null;
  const fFromA = F ? dist(F, A) : null;
  return {
    cheat,
    degenerate: !!g.degenerate,
    D: safePoint(g.D),
    circle: safeCircle(g.circle),
    E,
    F,
    center1: c1,
    center2: c2,
    eFromA,
    fFromA,
    centersCoincide: separation === null ? null : separation < 1e-6,
    centerSeparation: separation,
    rightAngleAtB: angleDeg(A, safePoint(g.B), safePoint(g.D)),
    rightAngleAtC: angleDeg(A, safePoint(g.C), safePoint(g.D)),
  };
}

export function actions(): GameActions {
  return {
    compare_drawings: {
      describe:
        "Build the same angle twice, once with the applet's cheat on and once with true perpendiculars, and compare the circle's two apparent centres, the points E and F, and the right angles the drawing claims.",
      args: '{ "A": {"x":90,"y":300}, "B": {"x":330,"y":340}, "C": {"x":310,"y":80} }',
      run: (args) => {
        const C = core();
        const base = readConfig(args);
        const faked = C.geometry(C.setOptions(base, { cheat: true }));
        const honest = C.geometry(C.setOptions(base, { cheat: false }));
        const angle = safeNum(faked.angle);
        const shift = safeNum(faked.shift);
        const cheatView = drawing(faked, base.A, true);
        const honestView = drawing(honest, base.A, false);
        return {
          A: base.A, B: base.B, C: base.C,
          angleDegrees: angle === null ? null : angle * 180 / Math.PI,
          eps: C.EPS,
          cheatShift: shift,
          cheatTiltPercent: shift === null ? null : (shift - 1) * 100,
          cheat: cheatView,
          honest: honestView,
          note: honestView.degenerate
            ? "The three points are almost collinear, so D cannot be drawn; open up the angle to compare the two pictures."
            : `With cheat on the lines are tilted by ${((shift ?? 1) - 1) * 100 > 0 ? "a nonzero" : "no"} factor (shift = ${shift}), so the apparent centres are ${cheatView.centerSeparation === null ? "undefined" : cheatView.centerSeparation.toFixed(2)} units apart. With the cheat off Thales' theorem gives E = F = A and both midpoints are the midpoint of AD: one centre.`,
        };
      },
    },
    right_angle_check: {
      describe:
        "Measure the angles the drawn lines BD and CD make with BA and CA in both modes. The honest lines are exactly 90 degrees; the cheating lines miss 90 degrees, which is why the marked right angles are false.",
      args: '{ "A": {"x":90,"y":300}, "B": {"x":330,"y":340}, "C": {"x":310,"y":80} }',
      run: (args) => {
        const C = core();
        const base = readConfig(args);
        const faked = C.geometry(C.setOptions(base, { cheat: true }));
        const honest = C.geometry(C.setOptions(base, { cheat: false }));
        const bCheat = angleDeg(base.A, base.B, safePoint(faked.D));
        const cCheat = angleDeg(base.A, base.C, safePoint(faked.D));
        const bHonest = angleDeg(base.A, base.B, safePoint(honest.D));
        const cHonest = angleDeg(base.A, base.C, safePoint(honest.D));
        return {
          cheat: {
            atB: bCheat,
            atC: cCheat,
            offByAtB: bCheat === null ? null : Math.abs(bCheat - 90),
            offByAtC: cCheat === null ? null : Math.abs(cCheat - 90),
            shift: safeNum(faked.shift),
          },
          honest: { atB: bHonest, atC: cHonest, shift: safeNum(honest.shift) },
          degenerate: !!faked.degenerate,
          note: faked.degenerate
            ? "D does not exist for a 0 or 180 degree angle, so neither right angle can be measured."
            : "The honest perpendiculars read 90 degrees at both B and C, so AD is a diameter and E = F = A. The cheating lines are tilted, so the right-angle marks lie.",
        };
      },
    },
  };
}

/** What the core says about the drawing currently on the page. */
export function position(state: Json): unknown {
  const C = core();
  const here = readConfig(state);
  here.moves = num(state, "moves", 0);
  here.toggles = num(state, "toggles", 0);
  here.showNames = state.showNames !== false;
  here.showHint = state.showHint === true;
  const g = C.geometry(here);
  const view = drawing(g, here.A, here.cheat);
  const angle = safeNum(g.angle);
  const illusion = !here.cheat ? false : view.centersCoincide === false;

  let note: string;
  if (view.degenerate) {
    note = "The rays lie on one line, so the perpendiculars are parallel and D does not exist. Move a point to open up the angle.";
  } else if (here.cheat) {
    note = `Cheat is on: the lines at B and C are tilted (shift ${view.rightAngleAtB === null ? "" : `≈ ${view.rightAngleAtB.toFixed(1)}° at B`}), so E and F are off A and the two apparent centres are ${view.centerSeparation === null ? "undefined" : `${view.centerSeparation.toFixed(1)} units apart`}. One circle cannot have two centres: the right-angle marks are a lie. Turn cheat off to see E = F = A and a single centre.`;
  } else {
    note = "Cheat is off: the lines really are perpendicular, so Thales' theorem makes AD a diameter, E and F both land on A, and both midpoints name the same centre. The two centres only appear when the drawing is faked.";
  }

  return {
    cheat: here.cheat,
    A: here.A, B: here.B, C: here.C,
    angleDegrees: angle === null ? null : angle * 180 / Math.PI,
    shift: safeNum(g.shift),
    degenerate: view.degenerate,
    D: view.D,
    circle: view.circle,
    E: view.E,
    F: view.F,
    center1: view.center1,
    center2: view.center2,
    centersCoincide: view.centersCoincide,
    centerSeparation: view.centerSeparation,
    isIllusion: illusion,
    moves: here.moves,
    toggles: here.toggles,
    explored: C.result(here) === "done",
    note,
  };
}
