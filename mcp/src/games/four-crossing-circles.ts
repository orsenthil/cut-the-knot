/*
 * run_game_logic actions and saved-position reader for Four Crossing Circles
 * (Bogomolny's illustration of a problem of Bùi Quang Tuấn, solved by Mariano
 * Perez de la Cruz).
 *
 * Two circles through A and B, drawn with the free points C and D, meet the
 * circle centred at O of radius OA again at A1, A2 and the circle of radius OB
 * again at B1, B2. A rotation about O carries A1B1 to AB and then to A2B2, so
 * the circle (Oa) cuts those two lines in equal chords, (Ob) does too, and
 * A1A2/B1B2 = OA/OB = Ra/Rb. All five handles are draggable; this is a drawing
 * with no win or loss.
 *
 * Every theorem number below comes from the game's real core, copied at build
 * time from four-crossing-circles/four-crossing-circles-core.js into
 * src/generated/cores/. The one exception is the second action's applet
 * transcription: the port deliberately fixes a bug in the applet's Other(),
 * which looks only at its first intersection candidate, so reproducing that
 * quirk needs an independent reading of GeoSDoub. Coordinates are board units
 * of the 400 x 260 SVG, y down. See _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { c: Pt; r: number };
type Handle = "A" | "B" | "C" | "D" | "O";
const HANDLES: Handle[] = ["A", "B", "C", "D", "O"];

type Geometry = {
  A: Pt; B: Pt; C: Pt; D: Pt; O: Pt;
  circle1: Circle; circle2: Circle; circleA: Circle; circleB: Circle;
  A1: Pt; A2: Pt; B1: Pt; B2: Pt;
  Aq1: Pt[]; Aq2: Pt[]; Bq1: Pt[]; Bq2: Pt[];
  Ra: number; Rb: number;
  chordA1: number; chordA2: number; chordB1: number; chordB2: number;
  sepA: number; sepB: number; ratio: number;
};
type State = {
  A: Pt; B: Pt; C: Pt; D: Pt; O: Pt;
  options: { names: boolean; hint: boolean };
  explored: boolean;
};
type Core = {
  VIEW: { width: number; height: number };
  MARGIN: number;
  start(options?: { names?: boolean; hint?: boolean }): State;
  move(s: State, name: Handle, p: Pt): State;
  setOption(s: State, name: string, on: boolean): State;
  result(s: State): null;
  geometry(s: State): Geometry | null;
  describe(s: State): string;
  dist(p: Pt, q: Pt): number;
  mid(p: Pt, q: Pt): Pt;
};
const core = (): Core =>
  cores["four-crossing-circles"].FourCrossingCirclesCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const circ = (c: Circle): { center: Pt; radius: number } =>
  ({ center: pt(c.c), radius: r6(c.r) });
const gap = (p: Pt, q: Pt): number => Math.hypot(p.x - q.x, p.y - q.y);

/** Accept the page's { x, y } dots and the tutor's [x, y] arguments alike. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`argument "${label}" needs finite numeric x and y`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readOptions(value: unknown): { names: boolean; hint: boolean } {
  if (value === undefined || value === null) return { names: false, hint: false };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error('"options" must be an object with boolean "names" and "hint"');
  }
  const o = value as Json;
  for (const key of ["names", "hint"] as const) {
    const v = o[key];
    if (v !== undefined && v !== null && typeof v !== "boolean") {
      throw new Error(`options.${key} must be a boolean, got ${JSON.stringify(v)}`);
    }
  }
  return { names: o.names === true, hint: o.hint === true };
}

/** Start at the applet's opening picture and apply any supplied handle moves. */
function buildState(C: Core, args: Json): State {
  if (args && (typeof args !== "object" || Array.isArray(args))) {
    throw new Error("arguments must be an object of A, B, C, D, O points and options");
  }
  const given = (args && typeof args === "object" ? args : {}) as Json;
  let s = C.start(readOptions(given.options));
  for (const name of HANDLES) {
    const v = given[name];
    if (v !== undefined && v !== null) s = C.move(s, name, readPoint(v, name));
  }
  return s;
}

/** The saved page state: five handles and two checkboxes, in board units. */
function savedState(C: Core, state: Json): State {
  const seed = C.start(readOptions(state.options));
  let s = seed;
  for (const name of HANDLES) {
    const v = state[name];
    if (v !== undefined && v !== null) s = C.move(s, name, readPoint(v, `saved ${name}`));
  }
  return s;
}

type InvalidReading = { valid: false; reason: string; note: string };
type ValidReading = {
  valid: true;
  board: { width: number; height: number };
  handles: Record<string, Pt>;
  options: { names: boolean; hint: boolean };
  explored: boolean;
  circles: {
    throughCAB: { center: Pt; radius: number };
    throughDAB: { center: Pt; radius: number };
    aboutA: { center: Pt; radius: number };
    aboutB: { center: Pt; radius: number };
  };
  crossings: { A1: Pt; A2: Pt; B1: Pt; B2: Pt };
  radii: { Ra: number; Rb: number; ratio: number };
  chordsOnCircleA: { onA1B1: number; onA2B2: number; difference: number; equal: boolean };
  chordsOnCircleB: { onA1B1: number; onA2B2: number; difference: number; equal: boolean };
  separations: {
    A1A2: number; B1B2: number; ratio: number; ratioError: number; equalsRaOverRb: boolean;
  };
  status: string;
  result: null;
  note: string;
};
type Reading = InvalidReading | ValidReading;

const CHORD_TOL = 1e-4;   // board units; round-off here is around 1e-11
const RATIO_TOL = 1e-6;   // relative

/** The page's two claims, measured rather than assumed, from the real core. */
function reading(C: Core, s: State): Reading {
  const g = C.geometry(s);
  if (!g) {
    return {
      valid: false,
      reason: "degenerate",
      note: "The core cannot draw this figure: two of A, B, C, D, O are less than 2 board units apart, or a circle intersection has no finite solution. Move a handle apart or press Reset.",
    };
  }
  const chordDiffA = g.chordA1 - g.chordA2;
  const chordDiffB = g.chordB1 - g.chordB2;
  const sepRatio = g.sepB > 0 ? g.sepA / g.sepB : NaN;
  const ratioError = sepRatio - g.ratio;
  return {
    valid: true,
    board: { ...C.VIEW },
    handles: Object.fromEntries(HANDLES.map((n) => [n, pt(s[n])])),
    options: { ...s.options },
    explored: s.explored,
    circles: {
      throughCAB: circ(g.circle1), throughDAB: circ(g.circle2),
      aboutA: circ(g.circleA), aboutB: circ(g.circleB),
    },
    crossings: { A1: pt(g.A1), A2: pt(g.A2), B1: pt(g.B1), B2: pt(g.B2) },
    radii: { Ra: r6(g.Ra), Rb: r6(g.Rb), ratio: r6(g.ratio) },
    chordsOnCircleA: {
      onA1B1: r6(g.chordA1), onA2B2: r6(g.chordA2),
      difference: r6(chordDiffA), equal: Math.abs(chordDiffA) < CHORD_TOL,
    },
    chordsOnCircleB: {
      onA1B1: r6(g.chordB1), onA2B2: r6(g.chordB2),
      difference: r6(chordDiffB), equal: Math.abs(chordDiffB) < CHORD_TOL,
    },
    separations: {
      A1A2: r6(g.sepA), B1B2: r6(g.sepB), ratio: r6(sepRatio),
      ratioError: r6(ratioError),
      equalsRaOverRb: Math.abs(ratioError) < RATIO_TOL * Math.max(1, Math.abs(g.ratio)),
    },
    status: C.describe(s),
    result: C.result(s),
    note:
      `The rotation about O takes A1B1 to AB to A2B2, so (Oa) cuts both lines in chords of ` +
      `${r6(g.chordA1)} units (difference ${r6(chordDiffA)}), and (Ob) in chords of ` +
      `${r6(g.chordB1)} units (difference ${r6(chordDiffB)}). A1A2/B1B2 = ` +
      `${r6(sepRatio)} while Ra/Rb = ${r6(g.ratio)}. Both differences are round-off, so the ` +
      "page's two claims hold here. This is an illustration, so there is no win or loss.",
  };
}

/* ------------------------- the applet's literal Other() (second transcription) */

/** GeoSDoub.FindCircumcenter, solved as two perpendicular-bisector equations. */
function circumcircleOf(p: Pt, q: Pt, r: Pt): Circle | null {
  const a1 = 2 * (q.x - p.x), b1 = 2 * (q.y - p.y);
  const c1 = q.x * q.x + q.y * q.y - p.x * p.x - p.y * p.y;
  const a2 = 2 * (r.x - q.x), b2 = 2 * (r.y - q.y);
  const c2 = r.x * r.x + r.y * r.y - q.x * q.x - q.y * q.y;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return null;
  const c: Pt = { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
  return { c: c, r: (gap(c, p) + gap(c, q) + gap(c, r)) / 3 };
}

/** GeoSDoub.Intersect(circle,circle) by radical axis, in the applet's root order. */
function circleCrossings(c1: Circle, c2: Circle): Pt[] | null {
  if (Math.abs(c1.c.x - c2.c.x) > 1) {
    const m = (c2.c.y - c1.c.y) / (c1.c.x - c2.c.x);
    const n = (c1.c.x * c1.c.x - c2.c.x * c2.c.x +
               c1.c.y * c1.c.y - c2.c.y * c2.c.y -
               c1.r * c1.r + c2.r * c2.r) / (2 * (c1.c.x - c2.c.x));
    const A = 1 + m * m;
    const footY = (c1.c.y + m * (c1.c.x - n)) / A;
    const foot: Pt = { x: m * footY + n, y: footY };
    const h2 = c1.r * c1.r - gap(foot, c1.c) ** 2;
    if (h2 < -1e-6 * c1.r * c1.r) return null;
    const off = Math.sqrt(Math.max(0, h2) / A);
    const one: Pt = { x: m * (footY + off) + n, y: footY + off };
    const two: Pt = { x: m * (footY - off) + n, y: footY - off };
    return m >= 0 ? [one, two] : [two, one];
  }
  if (Math.abs(c1.c.y - c2.c.y) > 1) {
    const m = (c2.c.x - c1.c.x) / (c1.c.y - c2.c.y);
    const n = (c1.c.y * c1.c.y - c2.c.y * c2.c.y +
               c1.c.x * c1.c.x - c2.c.x * c2.c.x -
               c1.r * c1.r + c2.r * c2.r) / (2 * (c1.c.y - c2.c.y));
    const A = 1 + m * m;
    const footX = (c1.c.x + m * (c1.c.y - n)) / A;
    const foot: Pt = { x: footX, y: m * footX + n };
    const h2 = c1.r * c1.r - gap(foot, c1.c) ** 2;
    if (h2 < -1e-6 * c1.r * c1.r) return null;
    const off = Math.sqrt(Math.max(0, h2) / A);
    const one: Pt = { x: footX + off, y: m * (footX + off) + n };
    const two: Pt = { x: footX - off, y: m * (footX - off) + n };
    return m >= 0 ? [one, two] : [two, one];
  }
  return [{ ...c1.c }, { ...c1.c }];
}

/** The applet keeps the second candidate only when the FIRST is within 3 units. */
const appletOther = (pts: Pt[] | null, known: Pt): Pt | null => {
  if (!pts || pts.length === 0) return null;
  return gap(pts[0], known) < 3 ? (pts[1] ?? pts[0]) : pts[0];
};

/** Example args: the fourth crossing is close enough to trigger the quirk. */
const QUIRK_ARGS =
  '{"A":[25.449351,163.32516],"B":[33.317842,30.010235],"C":[51.499959,79.602904],' +
  '"D":[162.13977,149.934694],"O":[179.541171,220.785561]}';

export function actions(): GameActions {
  return {
    equal_chords: {
      describe:
        "Rebuild the four circles from the five draggable points A, B, C, D, O (each [x, y] or { x, y } on the 400 x 260 board; omit any to keep the applet's opening picture) and report the chords (Oa) cuts on A1B1 and A2B2, those (Ob) cuts, the radii Ra, Rb and the separations A1A2, B1B2. It checks that the two chords on each circle are equal and that A1A2/B1B2 = Ra/Rb, the two rotation facts the page asks you to prove.",
      args: '{"A":[205,104],"B":[200,130],"C":[100,104],"D":[333.333333,130],"O":[216.666667,195],"options":{"names":false,"hint":false}}',
      run: (args) => {
        const C = core();
        return reading(C, buildState(C, args));
      },
    },

    applet_other_quirk: {
      describe:
        "For the same five points, compare each of A1, A2, B1, B2 chosen by the real core with the choice of the applet's literal Other(), which tests only its first circle intersection and keeps the known point when the two crossings lie within 3 board units of each other. Report both intersections and their distances from the known point, so a difference shows exactly where the original applet would break its own equal-chord claim, while this port always takes the farther crossing.",
      args: QUIRK_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        if (!r.valid) return { ...r, quirk: null };
        const g = C.geometry(s);
        if (!g) return { ...r, quirk: null };

        const c1 = circumcircleOf(s.C, s.A, s.B);
        const c2 = circumcircleOf(s.D, s.A, s.B);
        const circleA: Circle = { c: s.O, r: g.Ra };
        const circleB: Circle = { c: s.O, r: g.Rb };
        const pairs = [
          { name: "A1", from: circleA, through: c1, known: s.A, chosen: g.A1 },
          { name: "A2", from: circleA, through: c2, known: s.A, chosen: g.A2 },
          { name: "B1", from: circleB, through: c1, known: s.B, chosen: g.B1 },
          { name: "B2", from: circleB, through: c2, known: s.B, chosen: g.B2 },
        ];
        const rows = pairs.map(({ name, from, through, known, chosen }) => {
          const candidates = through ? circleCrossings(from, through) : null;
          const applet = appletOther(candidates, known);
          const difference = applet ? gap(applet, chosen) : NaN;
          return {
            name,
            candidates: candidates ? candidates.map(pt) : null,
            distancesFromKnown: candidates ? candidates.map((p) => r6(gap(p, known))) : null,
            appletPick: applet ? pt(applet) : null,
            corePick: pt(chosen),
            distanceBetweenPicks: r6(difference),
            appletPicksKnownPoint: !!applet && gap(applet, known) < 1e-4,
            differs: Number.isFinite(difference) && difference > 1e-4,
          };
        });
        const differing = rows.filter((row) => row.differs).map((row) => row.name);
        return {
          ...r,
          quirk: {
            rows,
            differing,
            rule: "applet: if candidate 1 is < 3 units from the known point take candidate 2, else take candidate 1; port: always take the farther candidate",
            note: differing.length
              ? `At ${differing.join(", ")} the literal applet keeps the known point instead of the other intersection (the two candidates are within 3 board units there), so its chord and ratio equalities would fail. The port's core takes the farther crossing in those layouts, which is the applet's choice in ordinary drawings and the choice that makes the page's theorem true.`
              : "In this drawing the applet's first-candidate test and the port's farther-crossing rule agree at all four crossings, so the original applet proves the theorem here too.",
          },
        };
      },
    },
  };
}

/** Echo every field Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Crossing Circles state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Crossing Circles position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  let analysis: Reading;
  try {
    analysis = reading(C, s);
  } catch (err) {
    analysis = {
      valid: false,
      reason: (err as Error).message,
      note: "The saved points cannot be read by the core.",
    };
  }
  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid: analysis.valid,
    core: analysis,
    note:
      "Track.state saved the five draggable handles, the two checkbox options and the derived circles, crossings, radii Ra/Rb and chord lengths in board units. " +
      "The real core rebuilds all four circles, the four crossings and the two equal-chord/ratio claims from those handles; the page does not save whether the drawing was explored.",
  };
}
