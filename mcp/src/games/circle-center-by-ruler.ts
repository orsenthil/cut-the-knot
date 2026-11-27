/*
 * run_game_logic actions and saved-position reader for Circle Center By Ruler.
 *
 * Two circles cross at M and N. A ruler-only construction drawn through those
 * crossings produces B, C, A' and C', then the intersections P and Q; the line
 * PQ is a diameter of the first circle, so a second such diameter finds its
 * centre O. Every number here comes from the game's real core
 * (circle-center-by-ruler/), copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-center-by-ruler"].CircleCenterByRulerCore;

type Point = { x: number; y: number };

/** The core's compute()/measurements() returns a union because a dead diagram is
 * reported with nulls; these are the fields present once the diagram is valid. */
type Figure = {
  valid: boolean;
  circles: { A: { center: Point; radius: number }; B: { center: Point; radius: number } };
  points: Record<"M" | "N" | "A" | "Bp" | "B" | "C" | "Ap" | "Cp" | "P" | "Q" | "O", Point>;
  coincident: boolean;
};
type Measures = {
  chordAAp: number; chordCCp: number; chordAC: number; chordApCp: number;
  diameterOffset: number; tangentDiameterOffset: number;
};

const r2 = (n: number) => Number(n.toFixed(2));
const r4 = (n: number) => Number(n.toFixed(4));
const r6 = (n: number) => Number(n.toFixed(6));
const degrees = (radians: number) => Number(((radians * 180) / Math.PI).toFixed(2));

/** Round a point for the tutor, or report null when the construction died. */
function pt(p: Point | null | undefined): Point | null {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: r2(p.x), y: r2(p.y) };
}

/** Read one draggable point from [x, y] or {x, y}; absent means the core's start(). */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  let x: number, y: number;
  if (Array.isArray(raw)) {
    const v = numArray(args, key);
    if (v.length !== 2) throw new Error(`"${key}" must be [x, y], got ${JSON.stringify(raw)}`);
    [x, y] = v;
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`"${key}" must have finite numeric x and y, got ${JSON.stringify(raw)}`);
    }
  } else {
    throw new Error(`"${key}" must be [x, y] or {x, y}, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** Rebuild the exact state the UI passes to Core.compute/measurements/claims. */
function readState(args: Json) {
  const C = core();
  const d = C.start({});
  return C.start({
    points: {
      M: readPoint(args, "M", d.M as Point),
      N: readPoint(args, "N", d.N as Point),
      A: readPoint(args, "A", d.A as Point),
      Bp: readPoint(args, "Bp", d.Bp as Point),
    },
    showNames: args.showNames !== false,
    showStatement: args.showStatement === true,
    showHint: args.showHint === true,
  });
}

/** Full measured reading of one diagram, from the core. */
function analyse(state: ReturnType<ReturnType<typeof core>["start"]>) {
  const C = core();
  const g = C.compute(state) as Figure;
  if (!g.valid) {
    return {
      valid: false,
      note: "The construction is degenerate: M and N must be at least 2 px apart, the four points must be distinct and finite, and the second crossings must exist. Move the points apart and try again.",
    };
  }
  const m = C.measurements(state) as Measures;
  const cl = C.claims(state);
  const p = g.points;
  return {
    valid: true,
    circles: {
      A: { center: pt(g.circles.A.center), radius: r2(g.circles.A.radius) },
      B: { center: pt(g.circles.B.center), radius: r2(g.circles.B.radius) },
    },
    points: {
      M: pt(p.M), N: pt(p.N), A: pt(p.A), Bp: pt(p.Bp),
      B: pt(p.B), C: pt(p.C), Ap: pt(p.Ap), Cp: pt(p.Cp),
      P: pt(p.P), Q: pt(p.Q), O: pt(p.O),
    },
    chords: {
      AAp: r4(m.chordAAp), CCp: r4(m.chordCCp),
      AC: r4(m.chordAC), ApCp: r4(m.chordApCp),
    },
    claims: cl,
    diameterOffset: r6(m.diameterOffset),
    tangentDiameterOffset: r6(m.tangentDiameterOffset),
    coincident: g.coincident,
    note: g.coincident
      ? "A' has fallen onto A, so AA' and CC' are the tangents at A and C: Q still lies on the diameter of the first circle perpendicular to chord AC, while P is the crossing of two nearly identical lines and cannot be located reliably."
      : "AA' = CC' and AC = A'C', and the intersections P, Q and the centre O of the first circle lie on one straight line.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For four draggable points in the 400 x 250 picture — M and N where the two circles cross, A on the first circle, B' on the second — run the ruler-only construction. Reports both circles, every labelled point (B, C, A', C', P, Q and the centre O), the four chords AA', CC', AC, A'C', and whether the equal-chord and diameter claims hold. When A' lands on A the tangents at A and C are used instead of AA' and CC'.",
      args: '{ "M": [203, 115], "N": [220, 135], "A": [120, 120], "Bp": [350, 125] }',
      run: (args) => analyse(readState(args)),
    },

    angle_sines: {
      describe:
        "For the same four points, report the four inscribed angles drawn by the applet's hint — ∠AMA', ∠CNC', ∠BMB', ∠BNB' — in degrees and their sines, together with the two short chords. Angles standing on opposite arcs are supplementary (they add to 180°), not always equal in the 0–180° sense, but their sines are identical, and a chord cut by an inscribed angle θ has length 2·R·sin(θ): that is why AA' = CC'.",
      args: '{ "M": [203, 115], "N": [220, 135], "A": [120, 120], "Bp": [350, 125], "showHint": true }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const g = C.compute(state);
        if (!g.valid) {
          return {
            valid: false,
            note: "No diagram to measure: M and N must be at least 2 px apart and the four points must give real second crossings.",
          };
        }
        const h = C.hintAngles(state);
        if (!h) return { valid: false, note: "No diagram to measure." };
        const angles: Record<string, number> = {};
        const sines: Record<string, number> = {};
        for (const [key, radians] of Object.entries(h.angles)) {
          angles[key] = degrees(radians as number);
          sines[key] = r6((h.sines as Record<string, number>)[key]);
        }
        const m = C.measurements(state) as Measures;
        const cl = C.claims(state);
        return {
          valid: true,
          anglesDegrees: angles,
          sines,
          chords: { AAp: r4(m.chordAAp), CCp: r4(m.chordCCp) },
          equalShortChords: cl.equalShortChords,
          equalAngleSines: cl.equalAngleSines,
          note:
            "The four angles can be equal or supplementary (opposite arcs give angles that add to 180°), so the applet's 'equal angles' claim is really a claim about equal sines. Since a chord of radius R cut by an inscribed angle θ has length 2·R·sin(θ), equal sines force AA' = CC'.",
        };
      },
    },
  };
}

/** What the core says about the position the page saved with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const here = readState(state);
  return {
    stateVersion,
    M: pt(here.M),
    N: pt(here.N),
    A: pt(here.A),
    Bp: pt(here.Bp),
    showNames: here.showNames,
    showStatement: here.showStatement,
    showHint: here.showHint,
    reading: analyse(here),
  };
}
