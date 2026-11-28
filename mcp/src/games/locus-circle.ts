/*
 * run_game_logic actions and saved-position reader for Locus Circle.
 *
 * The real core is locus-circle/locus-circle-core.js, copied verbatim into
 * src/generated/cores/ at build time; every number below comes from it. A and
 * B are fixed, r = NB/NC, and the locus of P with AP/BP = r is the circle of
 * Apollonius: M divides AB internally and N externally in the ratio r, and the
 * circle on MN as diameter is exactly that locus (Thales' theorem, since the
 * inner and outer angle bisectors at P are perpendicular). Its centre is
 * A + r²/(r²−1)·(B−A) and its radius is r·AB/|r²−1|. When the two spinner
 * numbers agree, r = 1 and the locus is the perpendicular bisector of AB: the
 * old applet faked it with a point a million pixels away, which only works for
 * a level AB, while this port draws the exact line.
 *
 * One sentence on the old cut-the-knot page says a smaller r brings the circle
 * nearer to B. The centre formula shows the opposite: small r hugs A and large
 * r hugs B. These actions expose that corrected direction with the core's own
 * independent closed form. Coordinates are the page's 400 x 300 SVG viewBox
 * units, y downward. This is a picture, so there is no win or loss. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = { nb: number; nc: number; names: boolean; hint: boolean; extra: boolean };
type State = { A: Pt; B: Pt; P: Pt; options: Options; explored: boolean };
type Circle = { c: Pt; r: number };
type Line = { m: Pt; n: Pt };
type Geometry = {
  A: Pt; B: Pt; nb: number; nc: number; r: number; d: number;
  M: Pt; N: Pt | null; circle: Circle | null; line: Line | null;
};
type Closed = { c: Pt; r: number } | { line: Line } | null;
type DirectionRow = {
  r: number; centre: Pt; radius: number; positionAlongAB: number; nearestToB: number;
};

interface Core {
  VIEW: { x: number; y: number; width: number; height: number };
  N_MIN: number; N_MAX: number; NB_DEFAULT: number; NC_DEFAULT: number;
  SENTINEL_X: number; EPS: number;
  point(x: number, y: number): Pt;
  add(a: Pt, b: Pt): Pt;
  sub(a: Pt, b: Pt): Pt;
  dist(a: Pt, b: Pt): number;
  midpoint(a: Pt, b: Pt): Pt;
  clampCount(v: unknown, fallback: number): number;
  start(options?: Partial<Options>): State;
  cutI(a: Pt, b: Pt, nb: number, nc: number): Pt;
  cutE(a: Pt, b: Pt, nb: number, nc: number): Pt;
  circleFromDiameter(d: Pt, e: Pt): Circle;
  appletCircle(a: Pt, b: Pt, nb: number, nc: number): Circle;
  compute(a: Pt, b: Pt, nb: number, nc: number): Geometry | null;
  project(g: Geometry | null, p: Pt): Pt;
  restrict(state: State, p: Pt): Pt;
  geometry(state: State): Geometry | null;
  locus(a: Pt, b: Pt, r: number): Closed;
  describe(state: State): string;
  result(): null;
}

const core = (): Core => cores["locus-circle"].LocusCircleCore as unknown as Core;

/* Coordinates are rounded for the tutor; non-finite values stay non-finite. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : v);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const circleShape = (c: Circle | null): Json | null =>
  c ? { centre: pt(c.c), radius: r6(c.r) } : null;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

const DIRECTION_NOTE =
  "The old page says a smaller ratio r moves the circle nearer to B. That is false: the centre " +
  "A + r²/(r²−1)·(B−A) lies on A's side of AB when r < 1 (small r hugs A) and beyond B when r > 1. " +
  "The family rows locate each centre along AB and measure its nearest distance to B.";
const SENTINEL_NOTE =
  "When NB = NC the true locus is the perpendicular bisector of AB. The old applet put N a " +
  "million pixels away, which only stands in for that line when AB is level; this port draws " +
  "the exact bisector, so P stays equidistant from A and B for a slanted AB too.";

/** Accept the page's { x, y } dots and a tutor's [x, y] dots, both validated. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (isObj(raw)) {
    [x, y] = [Number(raw.x), Number(raw.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** The spinners allow whole numbers from 1 to 15, as in the page. */
function readCount(C: Core, args: Json, key: string, fallback: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "number" && typeof raw !== "string") {
    throw new Error(`argument "${key}" must be a whole number from ${C.N_MIN} to ${C.N_MAX}`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`argument "${key}" must be a whole number from ${C.N_MIN} to ${C.N_MAX}`);
  }
  return n;
}

function sampleCount(args: Json): number {
  const n = num(args, "samples", 8);
  if (!Number.isInteger(n) || n < 3 || n > 24) {
    throw new Error('argument "samples" must be a whole number from 3 to 24');
  }
  return n;
}

/** The opening picture with the requested counts, then the three handles set. */
function buildState(C: Core, args: Json): State {
  if (!isObj(args)) throw new Error("arguments must be an object of A, B, nb, nc and samples");
  const home = C.start({});
  const A = readPoint(args.A, "A", home.A);
  const B = readPoint(args.B, "B", home.B);
  if (C.dist(A, B) <= C.EPS) throw new Error("A and B must be different points");
  const nb = readCount(C, args, "nb", home.options.nb);
  const nc = readCount(C, args, "nc", home.options.nc);
  const built = C.start({ nb, nc });
  const s: State = { ...built, A, B, explored: true };
  s.P = C.restrict(s, readPoint(args.P, "P", built.P));
  return s;
}

/** AP/BP at a point, measured with the core, beside the target ratio. */
function measure(C: Core, P: Pt, A: Pt, B: Pt, r: number) {
  const ap = C.dist(P, A), bp = C.dist(P, B);
  const ratio = ap / Math.max(bp, C.EPS);
  return {
    P: pt(P), AP: r6(ap), BP: r6(bp), ratio: r6(ratio),
    error: r6(Math.abs(ratio - r)), agrees: Math.abs(ratio - r) < 1e-6,
  };
}

/** Where the small-r circles sit, from the core's independent closed form. */
function directionCheck(C: Core, A: Pt, B: Pt) {
  const ab2 = C.dist(A, B) ** 2;
  const rows: DirectionRow[] = [1 / 15, 1 / 10, 1 / 5, 1 / 2].map((rr) => {
    const l = C.locus(A, B, rr);
    if (!l || !("c" in l)) return null;
    return {
      r: r6(rr), centre: pt(l.c), radius: r6(l.r),
      positionAlongAB: r6(((l.c.x - A.x) * (B.x - A.x) + (l.c.y - A.y) * (B.y - A.y)) / ab2),
      nearestToB: r6(C.dist(l.c, B) - l.r),
    };
  }).filter((row): row is DirectionRow => row !== null);
  return {
    rows,
    smallRHugsA: rows.length === 4 && rows.every((row) => row.positionAlongAB < 0),
    // Rows run from small r to larger r, and for r < 1 the nearest distance to
    // B is AB/(1+r), which falls as r rises: a smaller r is farther from B.
    smallRFartherFromB: rows.every((row, i) => i === 0 || row.nearestToB < rows[i - 1].nearestToB),
    note: DIRECTION_NOTE,
  };
}

/** The literal applet's far-away-point circle, measured off the exact bisector. */
function sentinelDeviation(C: Core, A: Pt, B: Pt, nb: number, nc: number, t: number): number {
  const s = C.appletCircle(A, B, nb, nc);
  const m = C.midpoint(A, B);
  const len = C.dist(A, B);
  const ux = -(B.y - A.y) / len, uy = (B.x - A.x) / len;
  const target = C.point(m.x + ux * t, m.y + uy * t);
  const dx = target.x - s.c.x, dy = target.y - s.c.y;
  const k = s.r / Math.hypot(dx, dy);
  return C.dist(C.point(s.c.x + dx * k, s.c.y + dy * k), target);
}

const closedShape = (closed: Closed): Json | null =>
  !closed ? null
    : "c" in closed
      ? { centre: pt(closed.c), radius: r6(closed.r) }
      : { midpoint: pt(closed.line.m), normalAlongAB: pt(closed.line.n) };

const CIRCLE_ARGS =
  '{ "A": [37.33333333333334, 230], "B": [113.33333333333334, 230], "nb": 4, "nc": 3, "samples": 8 }';
const BISECTOR_ARGS = '{ "A": [80, 220], "B": [300, 110], "nb": 4, "nc": 4 }';

export function actions(): GameActions {
  return {
    apollonius_locus: {
      describe:
        "Place A and B ([x, y] or {x, y} in the page's 400 x 300 board) and set the NB and NC spinners (whole numbers 1-15, default 4 and 3); r = NB/NC. Run the real core: M divides AB internally and N externally in the ratio r, and the circle on MN as diameter is the Apollonian locus of AP/BP = r. Report that circle beside the independent closed form, sample 'samples' points (3-24, default 8) and check AP/BP at each; at r = 1 report the exact perpendicular bisector instead. The familyDirection rows show that small r hugs A, correcting the old page's claim that it moves toward B. The example uses the A and B saved by the live fixture.",
      args: CIRCLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.geometry(s);
        if (!g) throw new Error("the core cannot build a locus here; A and B must be distinct");
        const count = sampleCount(args);
        const closed = C.locus(s.A, s.B, g.r);
        const common = {
          A: pt(s.A), B: pt(s.B), nb: g.nb, nc: g.nc, r: r6(g.r), AB: r6(g.d),
          M: pt(g.M), N: pt(g.N),
          ratioAtM: r6(C.dist(g.M, s.A) / Math.max(C.dist(g.M, s.B), C.EPS)),
          ratioAtN: g.N ? r6(C.dist(g.N, s.A) / Math.max(C.dist(g.N, s.B), C.EPS)) : null,
          closedForm: closedShape(closed),
          status: C.describe(s),
        };
        if (g.line) {
          const len = C.dist(g.line.n, C.point(0, 0));
          const ux = -g.line.n.y / len, uy = g.line.n.x / len;
          const samples = [];
          for (let i = 0; i < count; i++) {
            const t = (i - (count - 1) / 2) * g.d / count;
            const P = C.project(g, C.point(g.line.m.x + ux * t, g.line.m.y + uy * t));
            samples.push(measure(C, P, s.A, s.B, 1));
          }
          return {
            ...common,
            kind: "perpendicular bisector",
            midpoint: pt(g.line.m), unitDirection: pt(C.point(ux, uy)), circle: null,
            samples,
            maxError: r6(Math.max(...samples.map((x) => x.error))),
            agreesAtEverySample: samples.every((x) => x.agrees),
            note:
              "Equal spinner values give r = 1, so the circle formula divides by zero and the locus " +
              "is the line through the midpoint of AB at right angles to AB, where AP = BP. " + SENTINEL_NOTE,
          };
        }
        const circle = g.circle!;
        const samples = [];
        for (let i = 0; i < count; i++) {
          const theta = 2 * Math.PI * i / count;
          const seed = C.point(
            circle.c.x + 2 * circle.r * Math.cos(theta),
            circle.c.y + 2 * circle.r * Math.sin(theta),
          );
          samples.push(measure(C, C.project(g, seed), s.A, s.B, g.r));
        }
        return {
          ...common,
          kind: "Apollonian circle",
          circle: circleShape(circle),
          diameter: { from: pt(g.M), to: pt(g.N) },
          matchesClosedForm: !!closed && "c" in closed &&
            C.dist(circle.c, closed.c) < 1e-9 && Math.abs(circle.r - closed.r) < 1e-9,
          samples,
          maxError: r6(Math.max(...samples.map((x) => x.error))),
          agreesAtEverySample: samples.every((x) => x.agrees),
          familyDirection: directionCheck(C, s.A, s.B),
          note:
            `M divides AB internally and N externally in the ratio ${r6(g.r)}, so the circle on MN ` +
            `as diameter is the locus; every sample has AP/BP = ${r6(g.r)}. ` + DIRECTION_NOTE,
        };
      },
    },

    equal_ratio_bisector: {
      describe:
        "Set the two spinners equal (nb = nc, default 4) so r = 1 and take A and B ([x, y] or {x, y}; the default AB is slanted) and optional samples (3-24, default 8). Run the core to project points onto the exact perpendicular bisector of AB and check that each is equidistant from A and B. It also measures how far the old applet's million-pixel point circle misses that line for a slanted AB against a level AB, showing why the port draws the true line.",
      args: BISECTOR_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        if (s.options.nb !== s.options.nc) {
          throw new Error("equal_ratio_bisector needs nb and nc equal (r = 1)");
        }
        const g = C.geometry(s);
        if (!g || !g.line) throw new Error("the core found no perpendicular bisector for these points");
        const count = sampleCount(args);
        const len = C.dist(g.line.n, C.point(0, 0));
        const ux = -g.line.n.y / len, uy = g.line.n.x / len;
        const samples = [];
        for (let i = 0; i < count; i++) {
          const t = (i - (count - 1) / 2) * g.d / count;
          const P = C.project(g, C.point(g.line.m.x + ux * t, g.line.m.y + uy * t));
          const ap = C.dist(P, s.A), bp = C.dist(P, s.B);
          samples.push({ P: pt(P), AP: r6(ap), BP: r6(bp), gap: r6(Math.abs(ap - bp)) });
        }
        const worst = Math.max(...samples.map((x) => x.gap));
        const nb = s.options.nb, nc = s.options.nc;
        const sentinel = C.appletCircle(s.A, s.B, nb, nc);
        const flatA = C.point(100 / 3, 230), flatB = C.point(340 / 3, 230);
        return {
          A: pt(s.A), B: pt(s.B), nb, nc, r: 1, AB: r6(g.d),
          M: pt(g.M), N: null, circle: null,
          bisector: {
            midpoint: pt(g.line.m), unitDirection: pt(C.point(ux, uy)),
            perpendicularToAB: r6(((s.B.x - s.A.x) * ux + (s.B.y - s.A.y) * uy) / g.d),
          },
          samples,
          maxEquidistanceGap: worst,
          equidistantAtEverySample: worst < 1e-6,
          oldSentinel: {
            centre: pt(sentinel.c), radius: r6(sentinel.r),
            deviationSlanted: [
              r6(sentinelDeviation(C, s.A, s.B, nb, nc, -40)),
              r6(sentinelDeviation(C, s.A, s.B, nb, nc, 40)),
            ],
            deviationLevelAB: [
              r6(sentinelDeviation(C, flatA, flatB, nb, nc, -60)),
              r6(sentinelDeviation(C, flatA, flatB, nb, nc, 60)),
            ],
          },
          status: C.describe(s),
          note:
            "Every sampled point on the exact bisector has AP = BP, so its direction is perpendicular " +
            "to AB. " + SENTINEL_NOTE,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure the picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Locus Circle state version ${stateVersion}`);
  if (!isObj(state)) throw new Error("saved Locus Circle position must be an object");
  const C = core();
  const home = C.start({});
  const opts = isObj(state.options) ? state.options : {};
  const nb = C.clampCount(opts.nb, home.options.nb);
  const nc = C.clampCount(opts.nc, home.options.nc);
  const built = C.start({
    nb, nc,
    names: opts.names === true, hint: opts.hint === true, extra: opts.extra === true,
  });
  const rawA = readPoint(state.A, "saved A", built.A);
  const rawB = readPoint(state.B, "saved B", built.B);
  const rawP = readPoint(state.P, "saved P", built.P);
  const s: State = { ...built, A: rawA, B: rawB, explored: state.explored === true };
  s.P = C.restrict(s, rawP);
  const g = C.geometry(s);
  const closed = g ? C.locus(s.A, s.B, g.r) : null;
  const measured = g ? measure(C, s.P, s.A, s.B, g.r) : null;
  const base = {
    stateVersion,
    saved: {
      A: pt(rawA), B: pt(rawB), P: pt(rawP),
      options: {
        nb, nc,
        names: s.options.names, hint: s.options.hint, extra: s.options.extra,
      },
      explored: s.explored,
    },
    AB: r6(C.dist(s.A, s.B)),
    r: g ? r6(g.r) : null,
    locusKind: !g ? "degenerate" : g.line ? "perpendicular bisector" : "Apollonian circle",
    M: g ? pt(g.M) : null,
    N: g ? pt(g.N) : null,
    circle: g && g.circle ? circleShape(g.circle) : null,
    midpoint: g ? pt(g.line ? g.line.m : g.M) : null,
    closedForm: closedShape(closed),
    measuredAtP: measured,
    reprojectionDrift: r6(C.dist(rawP, s.P)),
    status: C.describe(s),
    note:
      "Track.state saved the three handles A, B, P, the two spinner numbers and the three display " +
      "switches; the core rebuilds the picture, projects P onto the saved locus and re-measures AP/BP.",
  };
  if (!g) {
    return { ...base, note: "A and B coincide, so there is no locus. " + base.note };
  }
  if (g.line) {
    return {
      ...base,
      note:
        base.note + " The saved ratio is 1, so the locus is the exact perpendicular bisector of AB. " +
        SENTINEL_NOTE,
    };
  }
  return {
    ...base,
    familyDirection: directionCheck(C, s.A, s.B),
    note: base.note + " " + DIRECTION_NOTE,
  };
}
