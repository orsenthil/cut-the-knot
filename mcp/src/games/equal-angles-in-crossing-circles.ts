/*
 * run_game_logic actions and saved-position reader for Equal Chords in
 * Crossing Circles (Bogomolny's EqualAnglesInCrossingCircles applet).
 *
 * Two circles cross at P and Q. A straight line through P leaves the first
 * circle at A and the second at B; a second line, leaning the same way from
 * the common chord PQ, leaves them at C and D. Hall and Stevens's exercise
 * says AB = CD. The core builds C and D by reflecting A and B in PQ (the
 * applet's AMoved/DMoved), and draws through Q a parallel of CD for the hint.
 * Shutrick's identity explains the equality: both chords are twice the
 * projection of the line of centres EF onto the chord direction.
 *
 * Coordinates are the illustration's 420 x 280 board, y down. The sibling
 * "Equal Angles in Crossed Circles" proves angles at two different vertices;
 * here the equal angles are the two undirected lines' leans at P and the
 * equal quantities are lengths. Every number below comes from the real core
 * in src/generated/cores/. See _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () =>
  cores["equal-angles-in-crossing-circles"].EqualAnglesInCrossingCirclesCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };
/** The two shapes the JS core returns from geometry(); the valid one is narrowed below. */
type Geometry = {
  valid: boolean;
  reason: string | null;
  E: Circle | null;
  F: Circle | null;
  A: Point; B: Point; C: Point; D: Point;
  ab: number; cd: number; chordDiff: number;
  translation: { near: Point; Cprime: Point; Dprime: Point } | null;
  cpDp: number | null;
  angles: { a: number; b: number; c: number; d: number };
  projectionAB: number;
  linePQ: { a: Point; b: Point };
  lineEF: { a: Point; b: Point };
};
const geometry = (C: Core, s: State): Geometry => C.geometry(s) as Geometry;

const TOL = 1e-5;       // residuals are distances in board units (float noise is ~1e-12)
const ANGLE_TOL = 1e-4; // degrees, after forgetting a straight line's direction
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const deg = (radians: number): number => r6((radians * 180) / Math.PI);
/** A straight line has no arrow: leaning by 180° − θ is the same lean as θ. */
const leanRad = (radians: number): number => Math.min(radians, Math.PI - radians);
const lean = (radians: number): number => r6((leanRad(radians) * 180) / Math.PI);
const circleOf = (c: Circle | null) =>
  c ? { center: pt(c.center), radius: r6(c.radius) } : null;

/** Accept the page's { x, y } dots and the tutor's [x, y] arguments alike. */
function readPoint(value: unknown, label: string, fallback: Point): Point {
  if (value === undefined || value === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readOptions(value: Json | undefined) {
  const mode = value?.mode === undefined || value?.mode === null ? "chord" : value.mode;
  if (mode !== "chord" && mode !== "circles") {
    throw new Error('"mode" must be "chord" (slide A/D on their circles) or "circles" (let them redefine the circles)');
  }
  return {
    mode: mode as "chord" | "circles",
    names: value?.names === true,
    hint: value?.hint === true,
    statement: value?.statement === true,
  };
}

/** Start from the core's opening picture and apply any supplied handle moves. */
function buildState(args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and options");
  }
  const C = core();
  let s = C.start(readOptions(args));
  for (const name of ["P", "Q", "A", "D"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.movePoint(s, name, readPoint(args[name], name, s[name] as Point));
    }
  }
  return s;
}

/** The saved state is the core's own plain data; keep its mode, last handle and moves. */
function savedState(state: Json): State {
  const C = core();
  const seed = C.start();
  const get = (key: "P" | "Q" | "A" | "D"): Point =>
    readPoint(state[key], `saved ${key}`, seed[key] as Point);
  return {
    ...seed,
    P: get("P"), Q: get("Q"), A: get("A"), D: get("D"),
    options: readOptions(state.options as Json | undefined),
    last: state.last === "D" ? "D" : "A",
    moves: Number.isFinite(Number(state.moves)) ? Number(state.moves) : 0,
  } as State;
}

/** Twice the projection of EF on the direction of the chord CD, in board units. */
function projectionOn(E: Circle, F: Circle, C: Point, D: Point, cd: number): number {
  const ef = { x: F.center.x - E.center.x, y: F.center.y - E.center.y };
  return 2 * (ef.x * (D.x - C.x) + ef.y * (D.y - C.y)) / cd;
}

/** Everything the core can say about one picture, in tutor-friendly units. */
function reading(C: Core, s: State) {
  const g = geometry(C, s);
  if (!g.valid || !g.E || !g.F) {
    return {
      valid: false,
      reason: g.reason ?? "guard",
      note: "The core cannot draw this picture: one of the five defining distances (AP, AQ, DP, DQ, PQ) is under 2 units, the circles are undefined, or a reflected line misses its circle. Move P, Q, A or D apart, or reset the picture.",
    };
  }
  const projCD = projectionOn(g.E, g.F, g.C, g.D, g.cd);
  const projAB = g.projectionAB;
  const a = g.angles.a, b = g.angles.b, c = g.angles.c, d = g.angles.d;
  const equalLeans = Math.abs(leanRad(a) - leanRad(c)) < ANGLE_TOL * Math.PI / 180;
  const equalChords = Math.abs(g.chordDiff) < TOL;
  const shutrickHolds =
    Math.abs(projAB - g.ab) < TOL && Math.abs(projCD - g.cd) < TOL;
  const hintEqual = g.cpDp === null ? null : Math.abs(g.cpDp - g.cd) < TOL;
  return {
    valid: true,
    reason: null,
    options: { ...s.options },
    moves: s.moves,
    last: s.last,
    points: {
      P: pt(s.P), Q: pt(s.Q),
      A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D),
    },
    circles: { E: circleOf(g.E), F: circleOf(g.F) },
    chords: {
      AB: r6(g.ab), CD: r6(g.cd), difference: r6(g.chordDiff),
      equal: equalChords,
      twiceProjectionEF: { onAB: r6(projAB), onCD: r6(projCD) },
      shutrickError: { AB: r6(projAB - g.ab), CD: r6(projCD - g.cd) },
      shutrickHolds,
    },
    anglesAtP: {
      APQ: deg(a), BPQ: deg(b), CPQ: deg(c), DPQ: deg(d),
      undirectedLeans: { AB: lean(a), CD: lean(c) },
      equalLeans,
      note: "The rays to A and D pair up, as do those to B and C; if a ray's angle with PQ is 180° − θ, the straight line still leans by θ.",
    },
    hint: g.translation
      ? {
          Cprime: pt(g.translation.Cprime), Dprime: pt(g.translation.Dprime),
          lengthCprimeDprime: r6(g.cpDp as number), equalToCD: hintEqual,
        }
      : null,
    result: C.result(s),
    note:
      `The two lines through P make the same lean from PQ and cut chords of length ${r6(g.ab)} and ` +
      `${r6(g.cd)} board units, equal to ${r6(projAB)} = twice the projection of EF on either chord ` +
      `(Shutrick's identity). The hint's parallel through Q cuts C'D' of the same length. ` +
      "Unlike the crossed-circles sibling's equal angles at different vertices, the equal things here are these two lengths at a common crossing point P.",
  };
}

/** Validate and read the optional sweep used by shutrick_identity. */
function sweepArgs(args: Json) {
  const name = args.sweepPoint === undefined || args.sweepPoint === null ? "A" : args.sweepPoint;
  if (name !== "A" && name !== "D") throw new Error('"sweepPoint" must be "A" or "D"');
  const raw = args.samples === undefined || args.samples === null ? 8 : Number(args.samples);
  if (!Number.isInteger(raw) || raw < 1 || raw > 24) {
    throw new Error('"samples" must be a whole number from 1 to 24');
  }
  return { name: name as "A" | "D", samples: raw };
}

export function actions(): GameActions {
  return {
    equal_chords: {
      describe:
        "For two circles crossing at P and Q, take the line through P and A (ending at B on the other circle) and its reflection in PQ through C and D. Report AB and CD, their difference, the two leans at P and Shutrick's twice-projection identity AB = CD = 2·|projection of EF onto the chord|, plus the hint's C'D'. P, Q, A and D are optional [x, y] or { x, y } points on the 420 x 280 board (defaults to the applet's opening picture); 'mode' is 'chord' (A/D stay on their circles) or 'circles' (A/D redefine them).",
      args: '{ "P": [213, 112], "Q": [210, 168], "A": [126, 140], "D": [265.9070717503137, 135.52607207395502], "hint": true }',
      run: (args) => {
        const C = core();
        return reading(C, buildState(args));
      },
    },
    shutrick_identity: {
      describe:
        "Check Hall and Stevens's equal-chord claim and Shutrick's projection identity on the picture given by P, Q, A, D (same formats as equal_chords), optionally sweeping A or D around its circle through 'samples' equally spaced positions (1 to 24, default 8; 'sweepPoint' defaults to A). Report AB − CD, the projection errors on both chords, the largest difference between the two undirected leans at P and the hint's C'D' − CD, with the largest gaps over the sweep. The equal angles here are the lines' leans at the single crossing P and the result is about lengths, not the crossed-circles sibling's angles at two different vertices.",
      args: '{ "samples": 8, "sweepPoint": "A" }',
      run: (args) => {
        const C = core();
        const s = buildState(args);
        const { name, samples } = sweepArgs(args);
        const base = reading(C, s);
        if (!base.valid) return { base, sweep: null, note: "The starting picture is not drawable, so there is nothing to sweep." };

        const g = geometry(C, s);
        if (!g.valid || !g.E || !g.F) {
          return { base, sweep: null, note: "The starting picture has no drawable circle to sweep." };
        }
        const centre = name === "A" ? g.E.center : g.F.center;
        const radius = name === "A" ? g.E.radius : g.F.radius;
        const here = s[name] as Point;
        const phase = Math.atan2(here.y - centre.y, here.x - centre.x);
        const rows: Json[] = [];
        for (let k = 0; k < samples; k++) {
          const t = phase + (2 * Math.PI * k) / samples;
          const point = { x: centre.x + radius * Math.cos(t), y: centre.y + radius * Math.sin(t) };
          const pic = geometry(C, C.movePoint(s, name, point));
          if (!pic.valid || !pic.E || !pic.F) {
            rows.push({ k, point: pt(point), valid: false, reason: pic.reason });
            continue;
          }
          const cdProj = projectionOn(pic.E, pic.F, pic.C, pic.D, pic.cd);
          rows.push({
            k,
            point: pt(point),
            valid: true,
            moved: name,
            AB: r6(pic.ab), CD: r6(pic.cd), chordDifference: r6(pic.chordDiff),
            projectionErrorOnAB: r6(pic.projectionAB - pic.ab),
            projectionErrorOnCD: r6(cdProj - pic.cd),
            leanAB: lean(pic.angles.a), leanCD: lean(pic.angles.c),
            leanDifference: r6((leanRad(pic.angles.a) - leanRad(pic.angles.c)) * 180 / Math.PI),
            hintError: pic.cpDp === null ? null : r6(pic.cpDp - pic.cd),
          });
        }
        const valid = rows.filter((row) => row.valid);
        const worst = (key: string): number | null => {
          const vals = valid.map((row) => Math.abs(Number(row[key]))).filter(Number.isFinite);
          return vals.length ? Math.max(...vals) : null;
        };
        const worstChord = worst("chordDifference");
        const worstAB = worst("projectionErrorOnAB");
        const worstCD = worst("projectionErrorOnCD");
        const worstLean = worst("leanDifference");
        const allHold = valid.length === samples &&
          [worstChord, worstAB, worstCD].every((v) => v !== null && v < TOL) &&
          worstLean !== null && worstLean < ANGLE_TOL;
        return {
          base,
          sweep: {
            point: name,
            samples,
            drawn: valid.length,
            worst: {
              chordDifference: worstChord === null ? null : r6(worstChord),
              projectionErrorOnAB: worstAB === null ? null : r6(worstAB),
              projectionErrorOnCD: worstCD === null ? null : r6(worstCD),
              leanDifferenceDegrees: worstLean === null ? null : r6(worstLean),
            },
            allHold,
            rows,
          },
          note:
            `Moving ${name} to ${samples} positions on its circle keeps AB = CD = 2·projection of EF on the chord ` +
            `to within ${worstChord === null ? "n/a" : Math.max(worstChord ?? 0, worstAB ?? 0, worstCD ?? 0).toExponential(2)} board units, ` +
            "and the two lines keep the same (undirected) lean from PQ. Positions where the applet's guards stop drawing are listed with their reason and are not counted.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equal Angles in Crossing Circles state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equal Angles in Crossing Circles position must be an object");
  }
  const C = core();
  const s = savedState(state);
  let analysis: ReturnType<typeof reading>;
  try {
    analysis = reading(C, s);
  } catch (err) {
    analysis = {
      valid: false,
      reason: (err as Error).message,
      note: "The saved points cannot be measured by the core.",
    } as ReturnType<typeof reading>;
  }
  return {
    stateVersion,
    saved: { ...state },
    ...analysis,
    note:
      "Track.state saved P, Q, A, D (plus any derived B and C), the display options, which handle moved last and the move count, in board units. " +
      "The core rebuilds both circles, the reflected line through C and D, the equal chords and Shutrick's projection identity from that position; " +
      "the hint only adds the parallel through Q and its C', D' points.",
  };
}
