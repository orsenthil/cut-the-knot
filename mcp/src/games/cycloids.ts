/*
 * run_game_logic actions and saved-position reader for Cycloids.
 *
 * A wheel rolls on a line or round a circle (R/r a whole number) and marks fixed
 * to it draw cycloids, hypocycloids and epicycloids. Every answer below comes
 * from the game's real core (cycloids/ in the site). See _shared.ts for the
 * shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cycloids"].CycloidsCore;

const round = (v: number) => Math.round(v * 1e6) / 1e6;

export function actions(): GameActions {
  return {
    curve: {
      describe:
        "Trace a mark on a wheel rolling without slipping: kind 'regular' (on a line), 'hypo' (inside a circle) or 'epi' (outside), the ratio R/r for the last two, the mark's distance from the wheel's centre as a multiple of the wheel's radius, and how many steps (each moves the wheel 2 pixels or 2 degrees). Returns sampled points and what the curve is (cusps, closing).",
      args: '{ "kind": "hypo", "ratio": 4, "distance": 1, "steps": 180 }',
      run: (args) => {
        const C = core();
        const kind = ["regular", "hypo", "epi"].includes(String(args.kind)) ? String(args.kind) : "regular";
        const ratio = Math.trunc(num(args, "ratio", kind === "hypo" ? 4 : 2));
        const s = C.start({ kind, ratio, speed: 1 });
        const r = C.discRadius(s);
        const distance = num(args, "distance", 1) * r;
        const steps = Math.max(1, Math.min(2000, Math.trunc(num(args, "steps", 180))));
        const mark = { dist: distance, angle: -Math.PI / 2, t0: 0, id: 0 };
        const m = { ...s, marks: [mark] };
        const pts = C.trail(m, mark, steps);
        const stride = Math.max(1, Math.floor(pts.length / 24));
        const sample = pts.filter((_: unknown, i: number) => i % stride === 0).map((p: { x: number; y: number }) => [round(p.x), round(p.y)]);
        const named = kind === "regular"
          ? (distance === r ? "cycloid (cusps on the line)" : distance < r ? "curtate cycloid (no cusps)" : "prolate cycloid (loops)")
          : distance === r ? `${kind === "hypo" ? "hypocycloid" : "epicycloid"} with ${ratio} cusps${kind === "hypo" && ratio === 2 ? " (a straight line: the Tusi couple)" : kind === "hypo" && ratio === 3 ? " (the deltoid)" : kind === "hypo" && ratio === 4 ? " (the astroid)" : kind === "epi" && ratio === 1 ? " (the cardioid)" : ""}` : "a trochoid (mark not on the rim)";
        return { kind, ratio, wheelRadius: round(r), markDistance: round(distance), steps, curve: named, samplePoints: sample, closesAfterSteps: kind === "regular" ? null : 360 / C.DELTA };
      },
    },
    check_methods: {
      describe: "Compare the applet's two ways of placing a mark, the closed form (Formula) and rotating step by step, for a given wheel, spin and time: they agree to rounding.",
      args: '{ "kind": "epi", "ratio": 3, "speed": 1, "time": 90 }',
      run: (args) => {
        const C = core();
        const kind = ["regular", "hypo", "epi"].includes(String(args.kind)) ? String(args.kind) : "regular";
        const s = C.start({ kind, ratio: Math.trunc(num(args, "ratio", 3)), speed: Math.trunc(num(args, "speed", 1)) });
        const mark = { dist: C.discRadius(s), angle: 0.5, t0: 0, id: 0 };
        const t = Math.max(0, Math.min(2000, Math.trunc(num(args, "time", 90))));
        const a = C.markAt(s, mark, t), b = C.markIncremental(s, mark, t);
        return { byFormula: [round(a.x), round(a.y)], stepByStep: [round(b.x), round(b.y)], gapInPixels: Math.hypot(a.x - b.x, a.y - b.y), agree: Math.hypot(a.x - b.x, a.y - b.y) < 1e-6 };
      },
    },
  };
}

/** What the core says about the wheel as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const kind = ["regular", "hypo", "epi"].includes(String(state.kind)) ? String(state.kind) : "regular";
  const s = C.start({ kind, ratio: Math.trunc(num(state, "ratio", 2)), speed: Math.trunc(num(state, "speed", 1)), r: Math.trunc(num(state, "r", 30)) });
  const marks = Array.isArray(state.marks) ? (state.marks as Json[]) : [];
  const r = C.discRadius(s);
  const rim = marks.filter((m) => Math.abs(num(m, "dist", 0) - r) < 0.5).length;
  return {
    wheel: kind,
    ratio: kind === "regular" ? null : s.ratio,
    wheelRadius: round(r),
    spin: C.speedText(s.speed),
    spinFactor: C.spinFactor(s.speed),
    rollsWithoutSlipping: s.speed === 1,
    marks: marks.length,
    marksOnTheRim: rim,
    marksInside: marks.filter((m) => num(m, "dist", 0) < r - 0.5).length,
    marksOutside: marks.filter((m) => num(m, "dist", 0) > r + 0.5).length,
    steps: num(state, "time", 0),
    method: state.formula === true ? "closed form" : "step by step",
    curvesOnly: state.curvesOnly === true,
    cuspsOfRimMark: kind === "regular" ? "one per turn of the wheel" : s.ratio,
    moves: num(state, "moves", 0),
    note: kind === "regular"
      ? `A wheel of radius ${round(r)} rolls on a line: a rim mark draws arches ${round(8 * r)} long enclosing ${round(3 * Math.PI * r * r)}.`
      : `The wheel rolls ${kind === "hypo" ? "inside" : "outside"} a circle with R/r = ${s.ratio}: a rim mark has ${s.ratio} cusps.`,
  };
}
