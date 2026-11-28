/*
 * run_game_logic actions and saved-position reader for Isosceles On Sides.
 *
 * On the sides of triangle ABC stand three isosceles triangles AFB on AB, BDC
 * on BC and CEA on CA: D, E, F are held on the perpendicular bisectors of the
 * sides, so DB = DC, EC = EA and FA = FB. The page claims that the perpendicular
 * through A to EF, through B to FD and through C to DE pass through one point.
 * Grow the three circles centred at D, E, F through their equal vertex pairs;
 * each perpendicular is the radical axis of a pair of circles, and the three
 * axes meet at their radical centre, where the powers to all three agree. When
 * D, E, F happen to be collinear the three lines become parallel and there is
 * no such point.
 *
 * Every number below comes from the real core, copied at build time from
 * isosceles-on-sides/isosceles-on-sides-core.js into src/generated/cores/.
 * Coordinates are SVG viewBox units, y downward; see _shared.ts for the shape
 * of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = (): any => (cores as any)["isosceles-on-sides"].IsoscelesOnSidesCore;

type Point = { x: number; y: number };
type Triple = "D" | "E" | "F";

const TRIPLE: Triple[] = ["D", "E", "F"];
const isNum = (v: unknown): boolean =>
  (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v));

/* The core stays in double precision; only what we print is rounded. */
const f6 = (v: number): number | null =>
  Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
const sig = (v: number): number | null =>
  Number.isFinite(v) ? Number(v.toExponential(4)) : null;
const pt = (p: any): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: Math.round(p.x * 1e6) / 1e6, y: Math.round(p.y * 1e6) / 1e6 }
    : null;
const cross = (p: Point, q: Point, r: Point): number =>
  (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

/** Accept [x, y] or { x, y } with finite coordinates. */
function readPoint(v: unknown, label: string): Point {
  if (v === undefined || v === null) {
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    if (!isNum(o.x) || !isNum(o.y)) {
      throw new Error(`argument "${label}" needs finite numeric x and y`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/** An optional { D, E, F } of finite numbers, defaulting to the saved ones. */
function readNums(raw: unknown, label: string, fallback: Record<string, number>): Record<string, number> {
  if (raw === undefined || raw === null) return { ...fallback };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`argument "${label}" must be an object with D, E, F numbers`);
  }
  const out = { ...fallback };
  const o = raw as Json;
  for (const k of TRIPLE) {
    if (o[k] === undefined || o[k] === null) continue;
    if (!isNum(o[k])) throw new Error(`argument "${label}.${k}" must be a finite number`);
    out[k] = Number(o[k]);
  }
  return out;
}

/** Build the core picture from optional corners, offsets, signs and attached points. */
function buildState(C: any, args: Json): any {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of optional A, B, C, D, E, F points and offset/sign");
  }
  const seed = C.start({});
  let s = C.start({
    A: args.A === undefined || args.A === null ? seed.A : readPoint(args.A, "A"),
    B: args.B === undefined || args.B === null ? seed.B : readPoint(args.B, "B"),
    C: args.C === undefined || args.C === null ? seed.C : readPoint(args.C, "C"),
    offset: readNums(args.offset, "offset", seed.offset),
    sign: readNums(args.sign, "sign", seed.sign),
  });
  for (const name of TRIPLE) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.withPoint(s, name, readPoint(args[name], name));
    }
  }
  return s;
}

/** Everything the core measures at one configuration. */
function reading(C: any, s: any) {
  const m = C.measure(s);
  const cl = C.claims(s);
  const cs = m.circles;
  return {
    A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D), E: pt(s.E), F: pt(s.F),
    sides: { AB: f6(m.sides.AB), BC: f6(m.sides.BC), CA: f6(m.sides.CA) },
    circles: {
      D: { center: pt(cs.D.c), radius: f6(cs.D.r) },
      E: { center: pt(cs.E.c), radius: f6(cs.E.r) },
      F: { center: pt(cs.F.c), radius: f6(cs.F.r) },
    },
    radii: { D: f6(m.radii.D), E: f6(m.radii.E), F: f6(m.radii.F) },
    perpendiculars: {
      A: { from: pt(s.A), ray: pt(m.rays.A) },
      B: { from: pt(s.B), ray: pt(m.rays.B) },
      C: { from: pt(s.C), ray: pt(m.rays.C) },
    },
    commonPoint: pt(m.P),
    feet: { A: pt(m.feet.A), B: pt(m.feet.B), C: pt(m.feet.C) },
    powers: { D: f6(m.powers.D), E: f6(m.powers.E), F: f6(m.powers.F) },
    secondIntersections: { A: pt(m.second.A), B: pt(m.second.B), C: pt(m.second.C) },
    claims: cl,
  };
}

type Reading = ReturnType<typeof reading>;

function concurrencyNote(r: Reading): string {
  if (!r.claims.concurrent) {
    return "D, E and F are collinear, so EF, FD and DE are one line and the perpendiculars through A, B, C are parallel: there is no common point P and the radical-centre claim fails.";
  }
  const p = r.commonPoint ? `(${r.commonPoint.x}, ${r.commonPoint.y})` : "no finite point";
  return `The perpendicular through A to EF, through B to FD and through C to DE meet at P = ${p}. The circles centred at D, E, F through their equal vertex pairs leave P with the same power to each (${r.powers.D}), so P is their radical centre, and the other circle intersections lie on those perpendiculars too.`;
}

/** Slide one attached point onto the line through the other two. */
function degenerate(C: any, s: any, which: Triple): any {
  const others = TRIPLE.filter((n) => n !== which);
  const o1 = s[others[0]], o2 = s[others[1]];
  const [u, v] = C.SIDES[which].map((n: string) => s[n]);
  const mid = C.midpoint(u, v);
  const b1 = C.perpPoint(mid, u, v, -1000);
  const b2 = C.perpPoint(mid, u, v, 1000);
  const x = C.intersect(o1, o2, b1, b2);
  if (!Number.isFinite(x.x) || !Number.isFinite(x.y)) {
    throw new Error(
      `the line through ${others[0]} and ${others[1]} is parallel to the perpendicular bisector of side ${C.SIDES[which].join("")}, so no ${which} can make them collinear`
    );
  }
  return C.withPoint(s, which, x);
}

function readWhich(args: Json): Triple {
  const v = args.slide;
  if (v === undefined || v === null) return "F";
  if (v !== "D" && v !== "E" && v !== "F") {
    throw new Error('argument "slide" must be "D", "E" or "F"');
  }
  return v;
}

export function actions(): GameActions {
  return {
    radical_center: {
      describe:
        "Measure the page's main claim at the opening picture (or at corners A, B, C and attached points D, E, F you supply as [x, y] or { x, y }, with optional offset/sign). Reports the perpendicular through A to EF, through B to FD and through C to DE, their common point P, the three circles centred at D, E, F through their equal vertex pairs and P's power to each, plus the core's verdicts (isosceles, perpendicular, concurrent, radicalCenter, secondIntersections, all): the perpendiculars are radical axes meeting at the radical centre.",
      args: '{"A":[143,253.92304845413264],"B":[303.92304845413264,210],"C":[200,30]}',
      run: (args) => {
        const C = core();
        const r = reading(C, buildState(C, args));
        return { ...r, note: concurrencyNote(r) };
      },
    },

    collinear_degeneracy: {
      describe:
        "Construct the degenerate case where D, E, F lie on one line: from the opening triangle (or the A, B, C you supply) slide the chosen attached point (slide = 'D', 'E' or 'F', default 'F') along its side's perpendicular bisector until it lands on the line through the other two. Then EF, FD and DE are the same line, the three perpendiculars through A, B, C are parallel and P is not finite; reports the collinearity cross product, the missing common point and the core's failed concurrent/radicalCentre verdicts. Other point arguments are applied before the slide.",
      args: '{"slide":"F"}',
      run: (args) => {
        const C = core();
        const which = readWhich(args);
        const s = degenerate(C, buildState(C, args), which);
        const r = reading(C, s);
        const collinearity = cross(s.D, s.E, s.F);
        return {
          slide: which,
          side: C.SIDES[which].join(""),
          collinearityCross: sig(collinearity),
          D: pt(s.D), E: pt(s.E), F: pt(s.F),
          perpendiculars: r.perpendiculars,
          commonPoint: r.commonPoint,
          claims: r.claims,
          note: `Sliding ${which} onto the line through the other two attached points makes D, E, F collinear (cross product ${sig(collinearity)}). Their three lines coincide, so the perpendiculars through A, B, C are parallel and have no common point P; concurrent = ${r.claims.concurrent} and radicalCenter = ${r.claims.radicalCenter}.`,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure them with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Isosceles On Sides state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Isosceles On Sides position must be an object");
  }

  const isPoint = (v: unknown): boolean =>
    !!v && typeof v === "object" && !Array.isArray(v)
      && isNum((v as Json).x) && isNum((v as Json).y);
  const savedPoint = (v: unknown, fallback: Point): Point =>
    isPoint(v) ? { x: Number((v as Json).x), y: Number((v as Json).y) } : { ...fallback };
  const savedNums = (v: unknown, fallback: Record<string, number>): Record<string, number> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return { ...fallback };
    const out = { ...fallback };
    const o = v as Json;
    for (const k of TRIPLE) if (isNum(o[k])) out[k] = Number(o[k]);
    return out;
  };
  const C = core();
  const gap = (p: Point, q: Point): number | null => sig(C.distance(p, q));
  const seed = C.start({});
  const A = savedPoint(state.A, seed.A);
  const B = savedPoint(state.B, seed.B);
  const Cc = savedPoint(state.C, seed.C);
  const offset = savedNums(state.offset, seed.offset);
  const sign = savedNums(state.sign, seed.sign);
  const s = C.refresh({ A, B, C: Cc, offset, sign });
  const r = reading(C, s);

  const savedD = savedPoint(state.D, s.D);
  const savedE = savedPoint(state.E, s.E);
  const savedF = savedPoint(state.F, s.F);
  const gaps = { D: gap(savedD, s.D), E: gap(savedE, s.E), F: gap(savedF, s.F) };
  const allMatch = TRIPLE.every((k) => gaps[k] !== null && (gaps[k] as number) < 1e-6);
  const savedReadable = isPoint(state.A) && isPoint(state.B) && isPoint(state.C)
    && isPoint(state.D) && isPoint(state.E) && isPoint(state.F)
    && state.offset !== undefined && state.sign !== undefined;

  return {
    ...state,
    stateVersion,
    savedReadable,
    savedVsCore: { ...gaps, allMatch },
    coreReading: r,
    note: savedReadable
      ? "Track.state saved the six points A..F together with the offsets and signs that hold D, E, F on their sides' perpendicular bisectors. The core rebuilds D, E, F from A, B, C and offset/sign; savedVsCore shows they match. " + concurrencyNote(r)
      : "Some saved fields were missing or unreadable, so the core filled them from the opening picture; the measurement below comes from that reconstruction.",
  };
}
