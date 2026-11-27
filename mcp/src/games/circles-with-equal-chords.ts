/*
 * run_game_logic actions and saved-position reader for Circles With Equal
 * Chords, an illustration rather than a game.
 *
 * Two circles C(O, r1) and C(O', r2) and a line L are given. We want a line
 * parallel to L that cuts equal chords from both circles. The applet's trick
 * is a translation along L: draw through O a line parallel to L, draw through
 * O' a perpendicular to L, and call their intersection T. Then T is the image
 * of O under a translation along L, so C(T, r1) is C(O, r1) slid along L. The
 * common chord CD of C(T, r1) and C(O', r2) is perpendicular to the line of
 * centres TO', which is perpendicular to L, hence CD is parallel to L.
 * Sliding CD back by O - T puts AB on the first circle, on the very same
 * line, and a translation preserves length: AB = CD.
 *
 * There is normally exactly one such line. If O and O' are the same distance
 * from L (their centres lie on a line parallel to L) the two circles become
 * concentric after the translation: equal radii then give infinitely many
 * parallel solution lines, unequal radii give none. The applet's own guards
 * (tiny radii, O' almost on L, L1 = L2, circles that miss or only touch)
 * also end the construction without a chord; their `reason` is reported.
 *
 * Every number below comes from the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-with-equal-chords"].CirclesWithEqualChordsCore as any;

type Point = { x: number; y: number };
type Diagram = {
  L1: Point; L2: Point; O: Point; R: Point; O2: Point; R2: Point;
  options: { names: boolean; hint: boolean };
  moves: number;
};

const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const xy = (p: any): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;

/** Accept the page's saved {x,y} dots and the tutor's [x,y] arguments alike. */
function readPoint(value: unknown, label: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing argument "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
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

/** Rebuild the six draggable dots; missing ones fall back to the core's start. */
function readDiagram(value: Json): Diagram {
  const home = core().start({});
  if (value === null || typeof value !== "object") {
    throw new Error("the diagram must be an object of six points (L1, L2, O, R, O2, R2)");
  }
  const options = value.options && typeof value.options === "object"
    ? value.options as Json
    : {};
  return {
    L1: readPoint(value.L1, "L1", home.L1),
    L2: readPoint(value.L2, "L2", home.L2),
    O: readPoint(value.O, "O", home.O),
    R: readPoint(value.R, "R", home.R),
    O2: readPoint(value.O2, "O2", home.O2),
    R2: readPoint(value.R2, "R2", home.R2),
    options: { names: options.names === true, hint: options.hint === true },
    moves: Number.isFinite(Number(value.moves)) ? Number(value.moves) : 0,
  };
}

const REASON: Record<string, string> = {
  radius: "a radius is under the applet's 2-unit minimum, so no circle is drawn",
  points: "one of the six defining points is not a finite coordinate",
  "near-line": "O' lies within one unit of L, so the perpendicular through O' cannot be drawn",
  parallel: "L1 and L2 coincide, so L has no direction",
  "no-crossing": "the circle centred at T with the first radius does not cut the second circle in a chord",
  "short-chord": "the common chord is at most a unit long, too short for the applet's line helper",
  "no-chord": "the translated chord line misses the first circle",
};

/** Everything the core can say about one diagram, in tutor-friendly form. */
function reading(s: Diagram) {
  const C = core();
  const g = C.geometry(s);
  const r1 = C.dist(s.O, s.R);
  const r2 = C.dist(s.O2, s.R2);
  // The core refuses centres closer than one unit in both coordinates: that
  // is exactly the case where O and O' sit at the same distance from L.
  const centresLevel = Boolean(g.T) &&
    Math.abs(g.T.x - s.O2.x) <= 1 && Math.abs(g.T.y - s.O2.y) <= 1;
  const equalRadii = Math.abs(r1 - r2) < 1e-6;

  let solutions: { kind: string; count: number | null; why: string };
  let note: string;
  if (g.valid) {
    const tx = g.T.x - s.O.x, ty = g.T.y - s.O.y;
    const gapAC = Math.hypot(g.C.x - g.A.x - tx, g.C.y - g.A.y - ty);
    const gapBD = Math.hypot(g.D.x - g.B.x - tx, g.D.y - g.B.y - ty);
    solutions = {
      kind: "one",
      count: 1,
      why: "the two circles are not level with L, so the equal-chord equation has one line",
    };
    note =
      `Through O the core draws a parallel to L and through O' a perpendicular; they meet at T = ` +
      `(${r4(g.T.x)}, ${r4(g.T.y)}), the image of O shifted (${r4(tx)}, ${r4(ty)}) along L. ` +
      `Circle C(T, ${r4(r1)}) cuts the second circle in the common chord CD, and sliding it back ` +
      `by (${r4(-tx)}, ${r4(-ty)}) puts AB on the first circle, on the same line. ` +
      `Translation preserves length, so AB = CD = ${r4(g.chord1)}; the two translation gaps are ` +
      `${r6(gapAC)} and ${r6(gapBD)}.`;
  } else if (centresLevel && equalRadii) {
    solutions = {
      kind: "infinitely many",
      count: null,
      why: "equal radii and centres the same distance from L: the circles are translates along L",
    };
    note =
      `O and O' are the same distance from L and both radii are ${r4(r1)}, so the second circle ` +
      `is a translate of the first along L. Every parallel line that cuts them cuts equal chords, ` +
      `so there are infinitely many answers. The core cannot select one: its translated centre T ` +
      `falls on O', the two translated circles coincide, and it reports "${g.reason}".`;
  } else if (centresLevel) {
    solutions = {
      kind: "none",
      count: 0,
      why: "centres the same distance from L would force equal radii, but the radii differ",
    };
    note =
      `O and O' are the same distance from L, so after translating the first circle along L its ` +
      `centre lands on O'. Any parallel line is then the same distance from the two centres, and ` +
      `equal chords would force the radii to match; they are ${r4(r1)} and ${r4(r2)}. ` +
      `No line cuts equal chords, and the core reports "${g.reason}".`;
  } else {
    solutions = {
      kind: "none",
      count: 0,
      why: REASON[g.reason] ?? "the construction has no chord",
    };
    note = `No solution line is drawn: ${REASON[g.reason] ?? "the construction has no chord"}. ` +
      "Move L or a circle (keep both radii at least 2 units and O' off L) to get a chord.";
  }

  return {
    radii: { first: r4(r1), second: r4(r2) },
    construction: {
      footOnL: xy(g.foot2),
      translatedCentreT: xy(g.T),
      translatedCircle: g.circle2
        ? { center: xy(g.circle2.center), radius: r4(g.circle2.radius) }
        : null,
      parallelThroughO: g.o1 ? [xy(g.o1.a), xy(g.o1.b)] : null,
      perpendicularThroughO2: g.o2 ? [xy(g.o2.a), xy(g.o2.b)] : null,
    },
    chords: g.valid ? {
      A: xy(g.A), B: xy(g.B), C: xy(g.C), D: xy(g.D),
      commonChordLine: [xy(g.lineS.a), xy(g.lineS.b)],
      lengthAB: r4(g.chord1),
      lengthCD: r4(g.chord2),
      difference: r6(Math.abs(g.chord1 - g.chord2)),
      equal: Math.abs(g.chord1 - g.chord2) < 1e-6,
      translation: g.T ? { x: r4(g.T.x - s.O.x), y: r4(g.T.y - s.O.y) } : null,
    } : null,
    valid: Boolean(g.valid),
    reason: g.reason ?? null,
    solutions,
    note,
  };
}

export function actions(): GameActions {
  return {
    equal_chords: {
      describe:
        "For two circles given by a centre dot and a radius point (O,R and O2,R2) and a line L through L1 and L2 on the 420 by 280 board, run the applet's construction: the parallel to L through O, the perpendicular through O', their meeting point T (the translated centre), the common chord CD of C(T,r1) with the second circle, and the translated chord AB on the first circle. Report T and the foot on L, all four chord ends, AB and CD with their difference, and whether there is one, no or infinitely many solution lines. Points may be [x,y] or {x,y}; omitted points default to the core's opening picture (L horizontal at y=35, O=(126,140) with radius 100, O2=(294,210) with radius 60).",
      args:
        '{ "L1": [210, 35], "L2": [360, 35], "O": [126, 140], "R": [226, 140], "O2": [294, 210], "R2": [354, 210] }',
      run: (args) => {
        const s = readDiagram(args);
        return {
          diagram: {
            L1: xy(s.L1), L2: xy(s.L2),
            O: xy(s.O), R: xy(s.R), O2: xy(s.O2), R2: xy(s.R2),
            options: s.options, moves: s.moves,
          },
          ...reading(s),
        };
      },
    },

    solution_cases: {
      describe:
        "Build three canonical diagrams with the real core's movePoint and report the construction in each. 'one' is the opening picture, with a single line parallel to L cutting equal chords. 'none' moves O' to the level of O while keeping radii 100 and 60, so after translation the circles are concentric with different radii. 'infinite' also sets the second radius to 100, making the circles translates along L, so every parallel line works. Pass case: 'one', 'none' or 'infinite' to see just one (default: all three).",
      args: '{ "case": "infinite" }',
      run: (args) => {
        const C = core();
        const open = C.start({});
        const level = C.movePoint(open, "O2", { x: 294, y: 140 });
        const translated = C.movePoint(level, "R2", { x: 394, y: 140 });
        const cases: Record<string, { built: string; diagram: Diagram }> = {
          one: { built: "the core's opening picture", diagram: open },
          none: { built: "O' moved from (294,210) to (294,140), level with O; radii 100 and 60", diagram: level },
          infinite: { built: "then R' moved to (394,140), so both radii are 100 and O2 - O lies along L", diagram: translated },
        };
        const which = args.case === undefined ? Object.keys(cases) : [args.case];
        for (const name of which) {
          if (!Object.prototype.hasOwnProperty.call(cases, String(name))) {
            throw new Error('"case" must be "one", "none" or "infinite"');
          }
        }
        return {
          cases: which.map((name) => {
            const entry = cases[String(name)];
            return { case: name, built: entry.built, ...reading(entry.diagram) };
          }),
          note:
            "Only the placement of the six draggable dots changes: the same core geometry runs on each picture. " +
            "The count changes because equal chords require r1² - d1² = r2² - d2², where d1 and d2 are the " +
            "distances of the centres from the chosen parallel line.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles With Equal Chords state version ${stateVersion}`);
  }
  const s = readDiagram(state ?? ({} as Json));
  return {
    stateVersion,
    saved: {
      L1: xy(s.L1), L2: xy(s.L2),
      O: xy(s.O), R: xy(s.R), O2: xy(s.O2), R2: xy(s.R2),
      options: s.options, moves: s.moves,
    },
    ...reading(s),
  };
}
