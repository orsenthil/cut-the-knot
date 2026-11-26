/*
 * run_game_logic actions and saved-position reader for Apollonian Circle.
 *
 * Two fixed points A and B and a positive number r = AP/BP determine a locus:
 * a circle of Apollonius for r != 1, and the perpendicular bisector of AB for
 * r = 1. The core (apollonian-circle/apollonian-circle-core.js) builds the
 * circle from D and E, the internal and external division points of AB in the
 * ratio r, which are the ends of a diameter, and inverts the picture in the
 * circle centred at A through R. Every number below comes from that core,
 * copied into src/generated/cores/ at build time. See _shared.ts for the shape
 * of a game module.
 *
 * One sentence on the old cut-the-knot page says a smaller r brings the circle
 * nearer to B. The closed form centre = A + r²/(r²−1)·(B−A) shows the opposite:
 * small r hugs A and large r hugs B.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["apollonian-circle"].ApollonianCircleCore as any;

type Point = { x: number; y: number };

/** Board coordinates to four decimals, computed numbers to six. */
const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const xy = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;

const FALSE_CLAIM_NOTE =
  "The old cut-the-knot sentence saying smaller r brings the circle nearer B is false: " +
  "the centre A + r²/(r²−1)·(B−A) shows that small r hugs A and large r hugs B.";

/** Accept both the page's saved {x, y} and the tutor's [x, y] arguments. */
function readPoint(v: unknown, label: string, fallback?: Point): Point {
  if (v === undefined || v === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
      throw new Error(`"${label}" needs both x and y`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" needs finite x and y`);
  return { x, y };
}

/** A valid locus for the given A, B and ratio, from the core's own compute(). */
function scene(args: Json) {
  const C = core();
  const home = C.start({});
  const A = readPoint(args.A, "A", home.A);
  const B = readPoint(args.B, "B", home.B);
  const r = num(args, "r", home.options.ratio);
  if (!(r > 0)) throw new Error('"r" must be a positive number');
  if (C.dist(A, B) < C.EPS) throw new Error("A and B must be different points");
  const g = C.compute(A, B, r);
  if (!g) throw new Error("the core cannot build a locus for these A, B and r");
  return { A, B, r, g };
}

function sampleCount(args: Json): number {
  const n = num(args, "samples", 8);
  if (!Number.isInteger(n) || n < 1 || n > 24) {
    throw new Error('"samples" must be a whole number from 1 to 24');
  }
  return n;
}

/** AP/BP measured by the core at a point, with the deviation from r. */
function measure(P: Point, A: Point, B: Point, r: number) {
  const C = core();
  const ap = C.dist(P, A), bp = C.dist(P, B);
  const ratio = ap / Math.max(bp, C.EPS);
  return {
    P: xy(P), AP: r6(ap), BP: r6(bp), ratio: r6(ratio),
    error: r6(Math.abs(ratio - r)), agrees: Math.abs(ratio - r) < 1e-6,
  };
}

export function actions(): GameActions {
  return {
    locus: {
      describe:
        "Given A and B ([x, y] or {x, y} in the page's 400 x 300 board) and a positive ratio r = AP/BP, report the locus built by the core: for r != 1 the centre and radius of the Apollonian circle, the diameter endpoints D and E, and the independent closed form; for r = 1 the perpendicular bisector of AB. Sample points on the locus and check AP/BP at each. Optional 'samples' (1-24, default 8) sets how many. The page's slider covers r from 0.25 to 4, but the maths works for any r > 0. Note that the old page's claim that smaller r moves the circle toward B is false.",
      args: '{ "A": [100, 150], "B": [220, 150], "r": 1.536, "samples": 8 }',
      run: (args) => {
        const C = core();
        const { A, B, r, g } = scene(args);
        const count = sampleCount(args);
        const ab = C.dist(A, B);
        const closed = C.locus(A, B, r);

        if (g.line) {
          // r = 1: no finite circle. The core's line.n is B - A (the normal
          // its project() removes), so the line runs at right angles to it.
          const len = C.dist(g.line.n, C.point(0, 0));
          const ux = -g.line.n.y / len, uy = g.line.n.x / len;
          const samples = [];
          for (let i = 0; i < count; i++) {
            const t = (i - (count - 1) / 2) * ab / count;
            const P = C.project(g, C.point(g.line.m.x + ux * t, g.line.m.y + uy * t));
            samples.push(measure(P, A, B, 1));
          }
          const worst = Math.max(...samples.map((s: { error: number }) => s.error));
          return {
            A: xy(A), B: xy(B), r: 1, kind: "perpendicular bisector", AB: r6(ab),
            midpoint: xy(g.line.m), unitDirection: xy(C.point(ux, uy)),
            dotProductWithAB: r6(((B.x - A.x) * ux + (B.y - A.y) * uy) / ab),
            D: null, E: null, circle: null,
            closedForm: closed && closed.line
              ? { midpoint: xy(closed.line.m), normalAlongAB: xy(closed.line.n) }
              : null,
            samples,
            maxError: worst,
            agreesAtEverySample: samples.every((s: { agrees: boolean }) => s.agrees),
            note:
              "At r = 1 the circle formula divides by zero, so there is no finite circle: " +
              "the locus is the line through the midpoint of AB at right angles to AB, where AP = BP. " +
              "The old applet faked it with a centre a million pixels away; this core draws the exact line. " +
              FALSE_CLAIM_NOTE,
          };
        }

        const circle = g.circle;
        const samples = [];
        for (let i = 0; i < count; i++) {
          const theta = 2 * Math.PI * i / count;
          const guess = C.point(
            circle.c.x + 2 * circle.r * Math.cos(theta),
            circle.c.y + 2 * circle.r * Math.sin(theta),
          );
          samples.push(measure(C.project(g, guess), A, B, r));
        }
        const worst = Math.max(...samples.map((s: { error: number }) => s.error));
        return {
          A: xy(A), B: xy(B), r, kind: "circle", AB: r6(ab),
          D: xy(g.D), E: xy(g.E),
          centre: xy(circle.c), radius: r6(circle.r),
          closedForm: { centre: xy(closed.c), radius: r6(closed.r) },
          diameterMatchesClosedForm:
            C.dist(circle.c, closed.c) < 1e-9 && Math.abs(circle.r - closed.r) < 1e-9,
          centreDistanceFromA: r6(C.dist(circle.c, A)),
          centreDistanceFromB: r6(C.dist(circle.c, B)),
          samples,
          maxError: worst,
          agreesAtEverySample: samples.every((s: { agrees: boolean }) => s.agrees),
          note:
            `D and E divide AB internally and externally in the ratio ${r}, so the circle on DE as diameter is the locus. ` +
            `Every sample has AP/BP = ${r} to within ${worst}. ` + FALSE_CLAIM_NOTE,
        };
      },
    },

    inversion: {
      describe:
        "Invert the locus in the circle centred at A through R (radius AR): for r != 1 its image is a circle centred at B', the inverse of B, with radius AR²/(r·AB). Report B', the image of a point P on the locus, the image circle found by the core and the closed-form radius, and check they agree. At r = 1 the core draws the bisector directly and has no finite image circle. Optional P ([x, y] or {x, y}); by default a point projected onto the locus is used.",
      args: '{ "A": [100, 150], "B": [220, 150], "R": [20, 150], "r": 1.536 }',
      run: (args) => {
        const C = core();
        const { A, B, r, g } = scene(args);
        const home = C.start({});
        const R = readPoint(args.R, "R", home.R);
        const ar = C.dist(A, R);
        if (ar < C.EPS) throw new Error("R must be away from A to define the circle of inversion");
        const ab = C.dist(A, B);
        const inv = { c: A, r: ar };
        const Bp = C.invert(inv, B);
        const fallbackP = g.line
          ? g.line.m
          : C.point(g.circle.c.x + g.circle.r, g.circle.c.y);
        const P = C.project(g, readPoint(args.P, "P", fallbackP));
        const Pp = C.invert(inv, P);

        if (g.circle) {
          const imageRadius = ar * ar / (r * ab);
          const coreRadius = C.dist(Bp, C.invert(inv, g.D));
          return {
            A: xy(A), B: xy(B), R: xy(R), r, AR: r6(ar), AB: r6(ab),
            inversionCircle: { centre: xy(A), radius: r6(ar) },
            Bp: xy(Bp), P: xy(P), Pp: xy(Pp),
            imageCircle: { centre: xy(Bp), radius: r6(coreRadius) },
            closedFormRadius: r6(imageRadius),
            radiusAgreement: r6(Math.abs(coreRadius - imageRadius)),
            agrees: Math.abs(coreRadius - imageRadius) < 1e-9 * Math.max(1, imageRadius),
            note:
              `Inversion sends the locus circle to a circle centred at B' with radius AR²/(r·AB) = ${r6(imageRadius)}. ` +
              "Changing r only changes that radius, so the images are rings around one centre and never cross. " +
              FALSE_CLAIM_NOTE,
          };
        }
        return {
          A: xy(A), B: xy(B), R: xy(R), r: 1, AR: r6(ar), AB: r6(ab),
          Bp: xy(Bp), P: xy(P), Pp: xy(Pp), imageCircle: null,
          note:
            "At r = 1 the locus is a line, not a circle. Inversion in a circle centred at A " +
            "would send a line that misses A to a circle through A, but the core draws the exact line; " +
            "use the locus action for that case. " + FALSE_CLAIM_NOTE,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Apollonian Circle state version ${stateVersion}`);
  const C = core();
  const home = C.start({});
  const options = (state.options && typeof state.options === "object" ? state.options : {}) as Json;
  const built = C.start({
    ratio: num(options, "ratio", home.options.ratio),
    n: num(options, "n", home.options.n),
    names: options.names !== false,
    hint: options.hint !== false,
    extra: options.extra === true,
  });
  // start() fixes A, B, R and ignores incoming ones, so restore the saved handles
  // and put the saved P back on the locus with the core's own projection.
  const s = Object.assign({}, built, {
    A: readPoint(state.A, "A", built.A),
    B: readPoint(state.B, "B", built.B),
    R: readPoint(state.R, "R", built.R),
    explored: state.explored === true,
  });
  s.P = C.restrict(s, readPoint(state.P, "P", built.P));

  const g = C.geometry(s);
  const closed = C.locus(s.A, s.B, s.options.ratio);
  const reading = measure(s.P, s.A, s.B, s.options.ratio);
  const ar = C.dist(s.A, s.R);
  const ab = C.dist(s.A, s.B);
  const base = {
    stateVersion,
    saved: {
      A: xy(s.A), B: xy(s.B), R: xy(s.R), P: xy(readPoint(state.P, "P", s.P)),
      options: {
        ratio: s.options.ratio, n: s.options.n,
        names: s.options.names, hint: s.options.hint, extra: s.options.extra,
      },
      explored: s.explored,
    },
    ratio: s.options.ratio,
    AB: r6(ab),
    AR: r6(ar),
    locusKind: g && g.line ? "perpendicular bisector" : "circle",
    measuredAtP: reading,
    centre: g && g.circle ? xy(g.circle.c) : null,
    radius: g && g.circle ? r6(g.circle.r) : null,
    midpoint: g ? xy(g.line ? g.line.m : g.M) : null,
    D: g ? xy(g.D) : null,
    E: g ? xy(g.E) : null,
    closedForm:
      closed && closed.c
        ? { centre: xy(closed.c), radius: r6(closed.r) }
        : closed && closed.line
          ? { midpoint: xy(closed.line.m), normalAlongAB: xy(closed.line.n) }
          : null,
    status: C.describe(s),
    note: FALSE_CLAIM_NOTE,
  };
  if (!g) return { ...base, imageCircle: null, note: "Move A and B apart to see the locus. " + FALSE_CLAIM_NOTE };

  const image =
    ar > C.EPS && g.D && s.options.extra
      ? {
          centre: xy(g.Bp),
          radius: r6(C.dist(g.Bp, C.invert(g.inv, g.D))),
          closedFormRadius: r6(ar * ar / (s.options.ratio * ab)),
        }
      : null;
  return { ...base, imageCircle: image };
}
