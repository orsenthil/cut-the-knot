/*
 * run_game_logic actions and saved-position reader for Lenses In Triangle.
 *
 * The real core is lenses-in-triangle/lenses-in-triangle-core.js, copied into
 * src/generated/cores/ at build time. A circle whose radius is the altitude of
 * an equilateral triangle rolls along its base; the lens is the circle's short
 * arc DE reflected across its chord. The core shows that arc DE always
 * subtends 60 degrees at the centre, while the reflected lens stays inside the
 * triangle only up to the rolling limit (the last scrollbar step that keeps
 * every sampled lens point in the triangle). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["lenses-in-triangle"].LensesInTriangleCore;

type Point = { x: number; y: number };

/** A plain, rounded JSON point from the core's board coordinates. */
const pt = (p: Point): Point => ({ x: Number(p.x.toFixed(4)), y: Number(p.y.toFixed(4)) });

/** Read a scrollbar step and keep it inside the core's integer range. */
function readStep(args: Json, key = "dist", fallback?: number): number {
  const C = core();
  const n = num(args, key, fallback);
  if (!Number.isInteger(n)) throw new Error(`argument "${key}" must be an integer scrollbar step, got ${n}`);
  if (n < C.RANGE.min || n > C.RANGE.max) {
    throw new Error(`argument "${key}" must be between ${C.RANGE.min} and ${C.RANGE.max}, got ${n}`);
  }
  return n;
}

/** The largest scrollbar step for which the core says the lens is inside. */
function rollingLimit(): number {
  const C = core();
  const inside = C.legalMoves().filter((d: number) => C.lensInside(C.start({ dist: d })));
  return Math.max(...inside);
}

export function actions(): GameActions {
  return {
    roll_lens: {
      describe:
        "Put the rolling circle at one integer scrollbar step and read the construction: the angle arc DE subtends at the centre, the whole-degree sweep the applet draws for the reflected arc, the chord's tilt from the base, and whether the lens is still inside the triangle. The angle is 60 degrees at every step; containment ends at the rolling limit and the last five steps (+51 to +55) push the lens across side AC.",
      args: '{ "dist": 20 }',
      run: (args) => {
        const C = core();
        const dist = readStep(args);
        const s = C.start({ dist });
        const g = C.geometry(s);
        return {
          dist: g.dist,
          side: g.side,
          radius: g.r,
          points: {
            A: pt(g.A), B: pt(g.B), C: pt(g.C),
            O: pt(g.O), D: pt(g.D), E: pt(g.E), O2: pt(g.O2),
          },
          arcDegrees: Number(g.arcDegrees.toFixed(6)),
          drawnSweepDegrees: Math.abs(g.sweep),
          chordTiltDegrees: Number(g.tilt.toFixed(2)),
          lensInside: C.lensInside(s),
          withinRollingLimit: g.dist <= rollingLimit(),
          note: C.describe(g),
        };
      },
    },
    scan_range: {
      describe:
        "Scan a range of scrollbar steps and report where the two page claims hold: arc DE measures 60 degrees at every step, but the reflected lens stays inside the equilateral triangle only up to the rolling limit. Steps past that limit (through +55) are the scrollbar escape where the lens crosses side AC.",
      args: '{ "from": -50, "to": 55 }',
      run: (args) => {
        const C = core();
        const from = readStep(args, "from", C.RANGE.min);
        const to = readStep(args, "to", C.RANGE.max);
        if (from > to) throw new Error('"from" must not be greater than "to"');
        const limit = rollingLimit();

        const steps: Array<{ dist: number; arcDegrees: number; lensInside: boolean }> = [];
        for (let d = from; d <= to; d += C.RANGE.step) {
          const s = C.start({ dist: d });
          steps.push({
            dist: d,
            arcDegrees: Number(C.geometry(s).arcDegrees.toFixed(6)),
            lensInside: C.lensInside(s),
          });
        }
        const arcs = steps.map((x) => x.arcDegrees);
        const escapeSteps = steps.filter((x) => !x.lensInside).map((x) => x.dist);
        const insideSteps = steps.filter((x) => x.lensInside).map((x) => x.dist);

        // A short reading at the interesting steps rather than the whole scan.
        const keyDists = Array.from(new Set([from, 0, limit, limit + 1, to]))
          .filter((d) => d >= C.RANGE.min && d <= C.RANGE.max && d >= from && d <= to)
          .sort((a, b) => a - b);
        const checks = keyDists.map((d) => {
          const s = C.start({ dist: d });
          const g = C.geometry(s);
          return {
            dist: d,
            arcDegrees: Number(g.arcDegrees.toFixed(6)),
            lensInside: C.lensInside(s),
            tiltDegrees: Number(g.tilt.toFixed(2)),
            note: C.describe(g),
          };
        });

        return {
          from,
          to,
          stepsChecked: steps.length,
          arcAlways60Degrees: arcs.every((a) => Math.abs(a - 60) < 1e-6),
          arcDegreesMin: Math.min(...arcs),
          arcDegreesMax: Math.max(...arcs),
          rollingLimit: limit,
          lastInsideStep: insideSteps.length ? Math.max(...insideSteps) : null,
          escapeSteps,
          checks,
          note: `Arc DE measures 60 degrees at all ${steps.length} steps checked. The lens is inside the triangle through step ${limit}; the scrollbar's extra steps${escapeSteps.length ? ` ${escapeSteps[0]} to ${escapeSteps[escapeSteps.length - 1]}` : ""} let it cross side AC.`,
        };
      },
    },
  };
}

/** What the core says about the illustration saved on the page. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Lenses In Triangle state version ${stateVersion}`);
  }
  const C = core();
  const dist = state.dist === undefined ? C.start({}).dist : readStep(state, "dist");
  const hint = state.hint === true;
  const names = state.names === true;
  const here = C.start({ dist, hint, names });
  const g = C.geometry(here);
  const limit = rollingLimit();
  return {
    stateVersion,
    dist: here.dist,
    hint: here.hint,
    names: here.names,
    radius: g.r,
    centre: pt(g.O),
    D: pt(g.D),
    E: pt(g.E),
    arcDegrees: Number(g.arcDegrees.toFixed(6)),
    drawnSweepDegrees: Math.abs(g.sweep),
    chordTiltDegrees: Number(g.tilt.toFixed(2)),
    lensInside: C.lensInside(here),
    withinRollingLimit: here.dist <= limit,
    rollingLimit: limit,
    note: C.describe(g),
  };
}
