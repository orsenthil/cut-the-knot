/*
 * run_game_logic actions and saved-position reader for Malfatti.
 *
 * The real core is malfatti/malfatti-core.js, copied into src/generated/cores/
 * at build time. It carries out Steiner's construction for the triangle whose
 * corners the player drags: the incenter I, the incircles of IAB, IBC and ICA,
 * their second common internal tangents meeting at L, and the incircles of the
 * three quadrilaterals APLT, BMLP and CTLM. Those last three circles are the
 * Malfatti circles. Every number reported here comes from that core. See
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type Line = [Pt, Pt];
type Corner = "A" | "B" | "C";
type Options = {
  names: boolean;
  bisectors: boolean;
  incircles: boolean;
  secondTangents: boolean;
};
type State = { A: Pt; B: Pt; C: Pt; options: Options; explored: boolean };

type Geometry = {
  A: Pt; B: Pt; C: Pt;
  I: Circle; IAB: Circle; IBC: Circle; ICA: Circle;
  lineAB: Line | null; lineBC: Line | null; lineCA: Line | null;
  M: Pt; P: Pt; T: Pt; Ia: Pt; Ib: Pt; Ic: Pt; L: Pt;
  circleA: Circle; circleB: Circle; circleC: Circle;
  D: Pt; E: Pt; F: Pt;
};
type Claims = {
  valid: boolean;
  touchesSides?: boolean[];
  touchesEachOther?: boolean[];
  pitot?: boolean[];
  quadIncircle?: boolean[];
  concurrent?: boolean;
  maltattiArea: number;
  triangleArea: number;
};
/** Exactly the plain data Core.position(state) writes for Track.state. */
type SavedPosition = {
  A: Pt; B: Pt; C: Pt; options: Options;
  I: Circle; IAB: Circle; IBC: Circle; ICA: Circle;
  M: Pt; P: Pt; T: Pt; L: Pt;
  circles: Circle[];
  D: Pt; E: Pt; F: Pt;
};

type Core = {
  OPTION_KEYS: string[];
  start(options?: Json): State;
  move(s: State, name: string, p: Pt): State;
  setOption(s: State, name: string, on: boolean): State;
  geometry(s: State): Geometry;
  claims(s: State): Claims;
  describe(s: State): string;
  position(s: State): SavedPosition;
  util: { dist(p: Pt, q: Pt): number; finite(p: unknown): boolean };
};

const core = (): Core => cores["malfatti"].MalfattiCore as unknown as Core;

const CORNERS: Corner[] = ["A", "B", "C"];
const OPTION_NAMES: (keyof Options)[] = [
  "names", "bisectors", "incircles", "secondTangents",
];

const r6 = (v: number): number => Number(v.toFixed(6));
const pt = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const circ = (c: Circle): Circle => ({ x: r6(c.x), y: r6(c.y), r: r6(c.r) });
/** Saved and recomputed floats agree up to rounding. */
const same = (a: number, b: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept the tutor's [x, y] and the page's saved { x, y } points alike. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function maybePoint(raw: unknown): Pt | null {
  try { return pt(readPoint(raw, "point")); } catch { return null; }
}
function maybeCircle(raw: unknown): Circle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = maybePoint(raw);
  if (!p) return null;
  const r = Number((raw as Json).r);
  if (!Number.isFinite(r)) return null;
  return { ...p, r: r6(r) };
}

/** Options may be given directly or under an "options" object. */
function readOptions(raw: Json): Options {
  const src = raw.options && typeof raw.options === "object" && !Array.isArray(raw.options)
    ? raw.options as Json : raw;
  const out: Options = {
    names: false, bisectors: false, incircles: false, secondTangents: false,
  };
  for (const key of OPTION_NAMES) {
    const v = src[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") throw new Error(`option "${key}" must be true or false`);
    out[key] = v;
  }
  return out;
}

/** A real core state: the applet's opening picture with the given drags applied. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with optional corners A, B, C and option flags");
  }
  let s = C.start();
  const opts = readOptions(args);
  for (const key of OPTION_NAMES) s = C.setOption(s, key, opts[key]);
  for (const key of CORNERS) {
    if (args[key] !== undefined && args[key] !== null) {
      // move() clamps a corner to the board, just as the page's drag does.
      s = C.move(s, key, readPoint(args[key], key));
    }
  }
  return s;
}

type Reading = {
  corners: Record<Corner, Pt>;
  options: Options;
  incenter: Circle;
  auxIncircles: { IAB: Circle; IBC: Circle; ICA: Circle };
  points: { M: Pt; P: Pt; T: Pt; L: Pt; D: Pt; E: Pt; F: Pt };
  circles: Circle[];
  checks: {
    touchesSides: boolean[];
    touchesEachOther: boolean[];
    pitot: boolean[];
    quadIncircle: boolean[];
    concurrent: boolean;
    allHold: boolean;
  };
  areas: { malfatti: number; triangle: number; fraction: number };
  description: string;
};

/** One call to the core's geometry() and claims(), with numbers tidied for print. */
function reading(C: Core, s: State): Reading | null {
  const g = C.geometry(s);
  const cl = C.claims(s);
  const drawn = [g.circleA, g.circleB, g.circleC];
  if (!cl.valid || !C.util.finite(g.L)
    || !drawn.every((c) => C.util.finite(c) && Number.isFinite(c.r) && c.r > 0)) {
    return null;
  }
  const touchesSides = cl.touchesSides ?? [];
  const touchesEachOther = cl.touchesEachOther ?? [];
  const pitot = cl.pitot ?? [];
  const quadIncircle = cl.quadIncircle ?? [];
  const concurrent = cl.concurrent === true;
  return {
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    options: { ...s.options },
    incenter: circ(g.I),
    auxIncircles: {
      IAB: circ(g.IAB), IBC: circ(g.IBC), ICA: circ(g.ICA),
    },
    points: {
      M: pt(g.M), P: pt(g.P), T: pt(g.T), L: pt(g.L),
      D: pt(g.D), E: pt(g.E), F: pt(g.F),
    },
    circles: drawn.map(circ),
    checks: {
      touchesSides, touchesEachOther, pitot, quadIncircle, concurrent,
      allHold: [touchesSides, touchesEachOther, pitot, quadIncircle]
        .every((group) => group.length === 3 && group.every(Boolean)) && concurrent,
    },
    areas: {
      malfatti: r6(cl.maltattiArea),
      triangle: r6(cl.triangleArea),
      fraction: r6(cl.maltattiArea / cl.triangleArea),
    },
    description: C.describe(s),
  };
}

function note(r: Reading): string {
  const c = r.checks;
  return (
    "Steiner's construction gives Malfatti circle radii " +
    `${r.circles.map((x) => x.r).join(", ")}. ` +
    `Each circle touches its two triangle sides (${c.touchesSides.join(", ")}) and the other two ` +
    `circles (${c.touchesEachOther.join(", ")}), the three second tangents ` +
    `${c.concurrent ? "meet at one point L" : "do not meet at one point"}, and the three ` +
    `quadrilaterals ${c.pitot.every(Boolean) ? "satisfy" : "do not all satisfy"} Pitot's ` +
    `opposite-side sums (${c.pitot.join(", ")}); their incircles touch all four sides ` +
    `(${c.quadIncircle.join(", ")}). The circles cover ${r.areas.fraction} of the triangle's area. ` +
    "This is an illustration, so there is no win or loss."
  );
}

/** The live fixture's triangle on the applet's 400 x 360 board, y down. */
const FIXTURE_ARGS =
  '{ "A": [71.66666666666666, 300], "B": [333.33333333333337, 300], "C": [266.6666666666667, 4.52994616207485] }';

export function actions(): GameActions {
  return {
    steiner_circles: {
      describe:
        "Run Steiner's construction through the real core for a triangle with corners A, B, C (each [x, y] or { x, y } on the applet's 400 x 360 board, y down; dragged corners are clamped to the board, omitted ones stay at the opening picture). It reports the incenter, the three incircles of IAB, IBC and ICA, the second tangents' meeting point L, the three Malfatti circles and their radii, and checks that each circle touches its two sides and the other two circles, that the three tangents concur, and that the three quadrilaterals satisfy Pitot's opposite-side sums and have four-sided incircles. Optional flags names, bisectors, incircles and secondTangents (directly or under options) switch on the same layers the page draws. Refuses a flat triangle whose construction the core cannot draw.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        if (!r) {
          throw new Error(
            "A, B and C must form a proper, non-flat triangle whose construction the core can draw " +
            "(L and the three Malfatti circles must exist); move a corner and try again",
          );
        }
        return { ...r, note: note(r) };
      },
    },

    equilateral_packings: {
      describe:
        "Place an equilateral triangle of side s (default 300, from 60 to 360 so it fits the board) and compare the real core's three Malfatti circles with the incircle-plus-two-corner-circles packing from Lob and Richmond. The core gives the three equal radii and their total area; the comparison packing puts a circle of radius s*sqrt(3)/6 in the middle and two of a third of that in two corners. The report gives both totals and the percentage increase, showing that Malfatti's circles do not solve the original marble problem: the alternative is about 1.36% larger. It also checks that the equilateral radii equal s*(sqrt(3) - 1)/4 and that all the construction's tangency and Pitot checks hold.",
      args: '{ "side": 300 }',
      run: (args) => {
        const C = core();
        if (!args || typeof args !== "object" || Array.isArray(args)) {
          throw new Error('arguments must be an object with an optional "side"');
        }
        const side = num(args, "side", 300);
        if (!(side >= 60 && side <= 360)) {
          throw new Error('"side" must be a number from 60 to 360 to fit the 400 x 360 board');
        }
        const cx = 200, top = 24, height = side * Math.sqrt(3) / 2;
        let s = C.start();
        s = C.move(s, "A", { x: cx - side / 2, y: top + height });
        s = C.move(s, "B", { x: cx + side / 2, y: top + height });
        s = C.move(s, "C", { x: cx, y: top });
        const a = C.util.dist(s.A, s.B);
        const b = C.util.dist(s.B, s.C);
        const c = C.util.dist(s.C, s.A);
        if (Math.max(a, b, c) - Math.min(a, b, c) > 1e-6) {
          throw new Error("the core could not place an equilateral triangle of that side on the board");
        }
        const r = reading(C, s);
        if (!r) throw new Error("the core cannot draw this equilateral triangle; try another side");
        const malt = r.areas.malfatti;

        const exactRadius = a * (Math.sqrt(3) - 1) / 4;
        const bigR = a * Math.sqrt(3) / 6;
        const cornerR = bigR / 3;
        const bigArea = Math.PI * bigR * bigR;
        const cornerArea = Math.PI * cornerR * cornerR;
        const altArea = bigArea + 2 * cornerArea;
        const extra = altArea - malt;
        const percent = 100 * extra / malt;
        const formulaMalt = 3 * Math.PI * a * a * (2 - Math.sqrt(3)) / 8;
        return {
          side: r6(a),
          corners: r.corners,
          malfatti: {
            radii: r.circles.map((x) => x.r),
            exactRadius: r6(exactRadius),
            matchesExact: r.circles.every((x) => Math.abs(x.r - exactRadius) < 1e-6),
            totalArea: malt,
            formulaArea: r6(formulaMalt),
            matchesFormula: Math.abs(malt - formulaMalt) < 1e-6,
          },
          lobRichmond: {
            incircleRadius: r6(bigR),
            cornerRadius: r6(cornerR),
            incircleArea: r6(bigArea),
            cornerAreas: r6(2 * cornerArea),
            totalArea: r6(altArea),
            formulaArea: r6(11 * Math.PI * a * a / 108),
          },
          comparison: {
            extraArea: r6(extra),
            percentMore: r6(percent),
            malfattiIsOptimal: false,
          },
          checks: r.checks,
          note:
            `The core's three radii match s*(sqrt(3) - 1)/4 = ${r6(exactRadius)}, and their total ` +
            `area ${malt} matches 3*pi*s^2*(2 - sqrt(3))/8. The incircle of radius ` +
            `${r6(bigR)} plus two corner circles of radius ${r6(cornerR)} cover ` +
            `${r6(altArea)} instead, ${r6(percent)}% more (11*pi*s^2/108). So the Malfatti circles ` +
            "are not the best packing of the marble: Malfatti's assumption was wrong. This is a " +
            "demonstration with no win or loss.",
        };
      },
    },
  };
}

/** Rebuild a real core state from the fields Track.state saved (Core.position). */
function savedState(C: Core, state: Json): { s: State; opts: Options; savedReadable: boolean } {
  let s = C.start();
  let savedReadable = true;
  let opts: Options;
  try { opts = readOptions(state); } catch { opts = {
    names: false, bisectors: false, incircles: false, secondTangents: false,
  }; savedReadable = false; }
  for (const key of OPTION_NAMES) s = C.setOption(s, key, opts[key]);
  for (const key of CORNERS) {
    try {
      s = C.move(s, key, readPoint(state[key], `saved ${key}`));
    } catch {
      savedReadable = false; // keep the applet's opening corner for this handle
    }
  }
  return { s, opts, savedReadable };
}

/** What the core says about the illustration saved on the page. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Malfatti state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Malfatti position must be an object");
  }
  const C = core();
  const { s, opts, savedReadable } = savedState(C, state);
  const saved = {
    corners: {
      A: maybePoint(state.A), B: maybePoint(state.B), C: maybePoint(state.C),
    },
    options: opts,
    incenter: maybeCircle(state.I),
    auxIncircles: {
      IAB: maybeCircle(state.IAB), IBC: maybeCircle(state.IBC), ICA: maybeCircle(state.ICA),
    },
    points: {
      M: maybePoint(state.M), P: maybePoint(state.P), T: maybePoint(state.T),
      L: maybePoint(state.L), D: maybePoint(state.D), E: maybePoint(state.E), F: maybePoint(state.F),
    },
    circles: Array.isArray(state.circles) ? state.circles.map(maybeCircle) : null,
  };
  const r = reading(C, s);
  if (!r) {
    return {
      ...state,
      stateVersion,
      saved,
      savedReadable,
      savedMatchesCore: null,
      valid: false,
      reading: null,
      note:
        "Track.state saved the three dragged corners, the four option flags and the whole Steiner " +
        "construction the core drew. Here the saved corners are flat or too thin, so the core draws " +
        "no Malfatti circles and there is nothing to measure. This illustration has no win or loss.",
    };
  }

  // The page saves more than the corners: check the derived construction too.
  const cp = C.position(s);
  const compared: boolean[] = [];
  const comparePoint = (raw: unknown, made: Pt): void => {
    const p = maybePoint(raw);
    if (p) compared.push(same(p.x, made.x) && same(p.y, made.y));
  };
  const compareCircle = (raw: unknown, made: Circle): void => {
    const c = maybeCircle(raw);
    if (c) compared.push(same(c.x, made.x) && same(c.y, made.y) && same(c.r, made.r));
  };
  compareCircle(state.I, cp.I);
  compareCircle(state.IAB, cp.IAB);
  compareCircle(state.IBC, cp.IBC);
  compareCircle(state.ICA, cp.ICA);
  comparePoint(state.M, cp.M);
  comparePoint(state.P, cp.P);
  comparePoint(state.T, cp.T);
  comparePoint(state.L, cp.L);
  comparePoint(state.D, cp.D);
  comparePoint(state.E, cp.E);
  comparePoint(state.F, cp.F);
  if (Array.isArray(state.circles)) {
    for (let i = 0; i < Math.min(state.circles.length, cp.circles.length); i++) {
      compareCircle(state.circles[i], cp.circles[i]);
    }
  }
  const savedMatchesCore = !savedReadable ? false
    : compared.length === 0 ? null : compared.every(Boolean);
  return {
    ...state,
    stateVersion,
    saved,
    savedReadable,
    savedMatchesCore,
    fieldsCompared: compared.length,
    valid: true,
    reading: r,
    note:
      "Track.state saved the three draggable corners, the option flags and every point and circle of " +
      "Steiner's construction. The core rebuilds the whole picture from the corners alone; " +
      (savedMatchesCore === null
        ? "the saved picture holds no derived geometry to compare. "
        : savedMatchesCore
          ? "the saved incenter, auxiliary incircles, tangent meets and Malfatti circles agree with " +
            "that recomputation. "
          : "some saved geometry differs from that recomputation; check whether it came from these corners. ") +
      note(r),
  };
}
