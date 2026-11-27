/*
 * run_game_logic actions and saved-position reader for Eyeball.
 *
 * Two circles C(A, rA) and C(B, rB) look at each other. The tangents from B to
 * circle A cut a chord PQ on A, and the tangents from A to circle B cut a chord
 * RS on B. A tangent and the radius at its touch point make a right triangle
 * with hypotenuse AB, so sin(angle at A) = rB/AB and half of PQ is rA·sin;
 * hence PQ = RS = 2·rA·rB/AB. The chords are perpendicular to AB and their
 * midpoints lie on it, which is why PQSR draws as a rectangle. This is not
 * Eyeball 2's Squinting Eyes Theorem, where the equal objects are the radii
 * 2·rA·rB/(rA+rB+AB) of the two curved-triangle incircles.
 *
 * Every number below comes from the game's real core
 * (eyeball/eyeball-core.js), copied into src/generated/cores/ at build time.
 * Coordinates are board units on the page's 780 x 400 view, y down. See
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["eyeball"].EyeballCore as any;

type Point = { x: number; y: number };
type HandleName = "A" | "RA" | "B" | "RB";
type OptionName = "showExtra" | "showRectangle";
const HANDLES: HandleName[] = ["A", "RA", "B", "RB"];
const OPTIONS: OptionName[] = ["showExtra", "showRectangle"];

const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
/** Residuals are the point of this illustration: keep tiny ones visible. */
const sig = (v: number): number | null => Number.isFinite(v) ? Number(v.toExponential(2)) : null;
const pt = (p: any): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Accept the page's {x,y} dots and the tutor's [x,y] arguments alike. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Optional checkbox value; anything but a boolean is an error. */
function readBool(args: Json, key: string, dflt: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return dflt;
  if (typeof v !== "boolean") throw new Error(`"${key}" must be true or false`);
  return v;
}

/**
 * Start from the applet's opening picture and apply the supplied drags and
 * checkbox clicks as real core moves, so board and minimum-radius clamping
 * match what a player can actually do on the page.
 */
function buildState(args: Json): any {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of handles and checkboxes");
  }
  const C = core();
  let s = C.start({});
  for (const name of HANDLES) {
    if (args[name] === undefined || args[name] === null) continue;
    const next = C.move(s, { type: "point", name, point: readPoint(args[name], name) });
    if (!next) throw new Error(`"${name}" is not a usable handle position`);
    s = next;
  }
  for (const key of OPTIONS) {
    if (args[key] === undefined || args[key] === null) continue;
    const next = C.move(s, { type: "option", key, value: readBool(args, key, false) });
    if (!next) throw new Error(`"${key}" is not a usable checkbox value`);
    s = next;
  }
  return s;
}

/** A tutor scenario is a calculation, not a play: do not mark it explored. */
function scenario(args: Json): any {
  const s = buildState(args);
  s.moves = 0;
  s.explored = false;
  return s;
}

/** Everything the core can say about one arrangement of the four handles. */
function reading(s: any): Json {
  const C = core();
  const g = C.compute(s);
  const { rA, rB, d } = g;
  const formula = finite(d) && finite(rA) && finite(rB) && d > 0
    ? r6((2 * rA * rB) / d) : null;
  const res = C.residuals(g);
  return {
    handles: { A: pt(s.A), RA: pt(s.RA), B: pt(s.B), RB: pt(s.RB) },
    toggles: { showExtra: s.showExtra === true, showRectangle: s.showRectangle === true },
    radii: {
      rA: finite(rA) ? r6(rA) : null,
      rB: finite(rB) ? r6(rB) : null,
      AB: finite(d) ? r6(d) : null,
      chordFormula: formula,
    },
    valid: g.valid === true,
    reason: g.reason ?? null,
    chords: g.valid
      ? {
          PQ: [pt(g.PQ[0]), pt(g.PQ[1])],
          RS: [pt(g.RS[0]), pt(g.RS[1])],
          pq: r6(g.pq), rs: r6(g.rs),
          equal: Math.abs(g.pq - g.rs) < 1e-6,
          matchesFormula: Math.max(Math.abs(g.pq - g.formula), Math.abs(g.rs - g.formula)) < 1e-6,
        }
      : { PQ: null, RS: null, pq: null, rs: null, equal: null, matchesFormula: null },
    residuals: res
      ? Object.fromEntries(Object.entries(res).map(([key, value]) => [key, sig(value as number)]))
      : null,
    tangents: g.valid
      ? {
          // fromB touches circle A (its rays carry PQ); fromA touches circle B (RS).
          fromB: {
            touch: [pt(g.fromB.touch[0]), pt(g.fromB.touch[1])],
            foot: pt(g.fromB.foot), sqrtDiscriminant: r6(g.fromB.h),
          },
          fromA: {
            touch: [pt(g.fromA.touch[0]), pt(g.fromA.touch[1])],
            foot: pt(g.fromA.foot), sqrtDiscriminant: r6(g.fromA.h),
          },
        }
      : null,
    helperCircles: g.valid
      ? {
          diameter: { centre: pt(g.diameter.centre), radius: r6(g.diameter.radius) },
          throughTouchPoints: g.extra.map((c: any) =>
            c ? { centre: pt(c.centre), radius: r6(c.radius) } : null),
        }
      : null,
    moves: s.moves,
    explored: s.explored === true,
    result: C.result(s),
  };
}

const PROOF_NOTE =
  "At a touch point the tangent is at right angles to the radius, so the right triangle with hypotenuse AB gives sin(angle at A) = rB/AB; half of PQ is rA·sin, hence PQ = 2·rA·rB/AB, and the same calculation at B gives RS = 2·rA·rB/AB. The chords are perpendicular to AB with midpoints on AB, so PQSR is a rectangle when its sides are drawn.";
const SIBLING_NOTE =
  "This is not Eyeball 2's Squinting Eyes Theorem: there the equal objects are the radii 2·rA·rB/(rA+rB+AB) of two curved-triangle incircles, a different claim about different circles.";

export function actions(): GameActions {
  return {
    equal_chords: {
      describe:
        "Place the four draggable points A, RA, B and RB (each [x, y] or {x, y} on the page's 780 by 400 board; omitted points stay at the opening picture) and optionally set showExtra / showRectangle, then run the real core on that arrangement. It reports both radii, AB, the endpoints and lengths of chords PQ and RS, the claim PQ = RS = 2·rA·rB/AB with residuals checking the tangent construction, and a note distinguishing this theorem from Eyeball 2's equal incircle radii.",
      args: '{ "A": [150, 200], "RA": [150, 133.333], "B": [650, 200], "RB": [650, 300], "showExtra": true, "showRectangle": true }',
      run: (args) => {
        const s = scenario(args);
        const r = reading(s) as any;
        const c = r.chords;
        return {
          ...r,
          note: r.valid
            ? `The core measures rA = ${r.radii.rA}, rB = ${r.radii.rB}, AB = ${r.radii.AB}: PQ = ${c.pq} and RS = ${c.rs}, both equal to 2·rA·rB/AB = ${r.radii.chordFormula}, with the largest residual at ${Math.max(...Object.values(r.residuals as Record<string, number>)).toExponential(2)}. ${PROOF_NOTE} ${SIBLING_NOTE}`
            : `With AB = ${r.radii.AB} and radii ${r.radii.rA} and ${r.radii.rB} the core reports "${r.reason}": one fan of tangents does not exist, so neither chord is drawn. Both fans need AB larger than both radii. ${SIBLING_NOTE}`,
        };
      },
    },

    separation_sweep: {
      describe:
        "Keeping the opening handles (or any supplied A, RA, B, RB), slide B along AB through each positive `distances` entry (default [500, 300, 200, 150, 100, 90]; at most 40) and run the real core at every one. It reports the measured separation, both chord lengths and 2·rA·rB/AB at each sample, showing the equal chords grow together as the circles approach and vanish once AB is no longer greater than max(rA, rB).",
      args: '{ "distances": [500, 300, 200, 150, 100, 90] }',
      run: (args) => {
        const C = core();
        const base = scenario(args);
        const raw = args.distances;
        const distances: unknown[] = raw === undefined || raw === null
          ? [500, 300, 200, 150, 100, 90] : raw as unknown[];
        if (!Array.isArray(distances) || distances.length === 0) {
          throw new Error('"distances" must be a non-empty array of positive numbers');
        }
        if (distances.length > 40) throw new Error('"distances" is too long (at most 40)');
        const baseReading = reading(base) as any;
        const threshold = Math.max(baseReading.radii.rA ?? 0, baseReading.radii.rB ?? 0);
        // Keep circle B's radius vector fixed while its centre slides along AB.
        const rbOffset = { x: base.RB.x - base.B.x, y: base.RB.y - base.B.y };
        const samples = distances.map((value, i) => {
          const want = num({ distance: value }, "distance");
          if (!(want > 0)) throw new Error(`distances[${i}] must be a positive length`);
          const movedB = C.move(base, {
            type: "point", name: "B", point: { x: base.A.x + want, y: base.A.y },
          });
          if (!movedB) throw new Error(`distances[${i}] cannot be placed on the board`);
          const s = C.move(movedB, {
            type: "point", name: "RB",
            point: { x: movedB.B.x + rbOffset.x, y: movedB.B.y + rbOffset.y },
          });
          if (!s) throw new Error(`distances[${i}] gives an unusable radius for circle B`);
          const r = reading(s) as any;
          return {
            requestedDistance: r6(want),
            measuredAB: r.radii.AB,
            rA: r.radii.rA, rB: r.radii.rB,
            valid: r.valid, reason: r.reason,
            pq: r.chords.pq, rs: r.chords.rs,
            formula: r.radii.chordFormula,
            chordFormulaResidual: r.residuals ? r.residuals.chordFormula : null,
            claimHolds: r.valid && r.chords.equal === true && r.chords.matchesFormula === true,
          };
        });
        const drawn = samples.filter((s) => s.valid);
        const biggest = drawn.reduce((best, s) =>
          best === null || (s.pq ?? 0) > (best.pq ?? 0) ? s : best, null as typeof drawn[number] | null);
        return {
          threshold: r6(threshold),
          condition: "both chords exist only when AB > max(rA, rB)",
          samples,
          allValidClaimsHold: drawn.length > 0 && drawn.every((s) => s.claimHolds),
          note:
            `With rA = ${baseReading.radii.rA} and rB = ${baseReading.radii.rB}, tangents from both centres need AB > ${r6(threshold)}. ` +
            (biggest
              ? `At the closest drawn sample (AB = ${biggest.measuredAB}) the chords both measure ${biggest.pq}; `
              : "None of these samples draws both chords; ") +
            `at larger separations they shrink together as 2·rA·rB/AB. ${PROOF_NOTE} ${SIBLING_NOTE}`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that diagram. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Eyeball state version ${stateVersion}`);
  }
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  let s: any;
  let moves = 0;
  let explored = false;
  try {
    const C = core();
    s = buildState(src);
    const raw = src.moves;
    moves = raw === undefined || raw === null ? 0 : num({ moves: raw }, "moves");
    if (!Number.isInteger(moves) || moves < 0) {
      throw new Error('saved "moves" must be a non-negative integer');
    }
    explored = src.explored === true;
    // The saved counters are the page's record; the geometry comes from the handles.
    s = { ...s, moves, explored };
  } catch (err) {
    return {
      ...src,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "Track.state should hold four {x, y} handles (A, RA, B, RB), the two checkboxes showExtra / showRectangle, and non-negative moves and explored flags.",
    };
  }
  const r = reading(s) as any;
  const c = r.chords;
  return {
    ...src,
    stateVersion,
    saved: {
      handles: r.handles,
      showExtra: s.showExtra === true,
      showRectangle: s.showRectangle === true,
      moves, explored,
    },
    core: r,
    claimHolds: r.valid && c.equal === true && c.matchesFormula === true,
    note: r.valid
      ? `Track.state saved the four handles and two checkboxes; the core rebuilds rA = ${r.radii.rA}, rB = ${r.radii.rB}, AB = ${r.radii.AB} and finds PQ = ${c.pq} and RS = ${c.rs}, both 2·rA·rB/AB = ${r.radii.chordFormula}. This is an illustration with no win or loss, so it is marked explored once a handle moves. ${PROOF_NOTE} ${SIBLING_NOTE}`
      : `Track.state saved the four handles and two checkboxes, but with AB = ${r.radii.AB} and radii ${r.radii.rA} and ${r.radii.rB} the core reports "${r.reason}", so no chords are drawn here; the page still has no win or loss. ${SIBLING_NOTE}`,
  };
}
