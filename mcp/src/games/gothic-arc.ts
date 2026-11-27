/*
 * run_game_logic actions and saved-position reader for Gothic Arc.
 *
 * The real core is gothic-arc/gothic-arc-core.js, copied into
 * src/generated/cores/ at build time. A state is the two draggable endpoints
 * A and B plus the board size, the two display flags and the chain length; the
 * core rebuilds the Gothic arcs, the point D, the Apollonius chain and the
 * ideal Pappus chain from them. The page saves the whole result of Core.position
 * with Track.state, in board pixels (y downward).
 *
 * With the small semicircle radius taken as r = 1, the ideal chain radii are
 * R_n = R·r/(r² + r + n²) = R/(2 + n²), where R is the radius of the large
 * semicircle (half of AB) and OD = R/2. Hence R_1 = R/3, R_2 = R/6 and
 * R_1 + R_2 = OD. The triangle with vertices D, P_n and O_n has sides
 * (n²−4, 4n, n²+4) times R/[2(2+n²)], an exact Pythagorean triple; at n = 1
 * it is a 3-4-5 triangle. The circles the applet actually draws are different:
 * each step inflates its neighbour by one pixel (BUFFER), so their radii drift
 * from the ideal ones even though each is tangent to its inflated targets.
 * Every number below is measured by the real core. See _shared.ts for the
 * module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type State = {
  width: number; height: number; showNames: boolean; showGothic: boolean;
  a: Pt; b: Pt; c: Pt; top: Pt | null; d: Pt; angleC: number;
  rightBig: Circle; leftBig: Circle; leftCircle: Circle; rightCircle: Circle;
  count: number;
};
type Ideal = {
  index: number; radius: number; height: number; dx: number;
  dDistance: number; oDistance: number; ooDistance: number; fractionOfOD: number;
};
type Pythagoras = {
  dLeg: number; heightLeg: number; dHyp: number;
  oLeg: number; oHeightLeg: number; oHyp: number;
};
type Core = {
  NUM: number; BUFFER: number; OFFSET: number;
  start(options?: Json): State;
  withEndpoints(state: State, a: Pt, b: Pt): State;
  chain(state: State): Circle[];
  ideal(R: number, n: number): Ideal;
  pythagoras(n: number): Pythagoras;
  tangencyErrors(state: State, circles: Circle[]): number[][];
  position(state: State): Json;
};

const core = (): Core =>
  cores["gothic-arc"].GothicArcCore as unknown as Core;

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const close = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** A point as [x, y] or { x, y }, with finite board coordinates. */
function readPoint(raw: unknown, label: string): Pt {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
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

function readBool(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** An integer in [lo, hi], or the fallback when the argument is omitted. */
function readInt(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const v = num(args, key, fallback);
  if (!Number.isInteger(v) || v < lo || v > hi) {
    throw new Error(`argument "${key}" must be an integer between ${lo} and ${hi}, got ${JSON.stringify(args[key])}`);
  }
  return v;
}

/** A real core state: endpoints are drags; omitted fields use the opening picture. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with optional a, b, count and display flags");
  }
  const rawA = args.a, rawB = args.b;
  if ((rawA === undefined) !== (rawB === undefined)) {
    throw new Error('arguments "a" and "b" must be given together to set the base');
  }
  const width = num(args, "width", C.start({}).width);
  const height = num(args, "height", C.start({}).height);
  if (width <= 0 || height <= 0) throw new Error('arguments "width" and "height" must be positive');
  let s = C.start({
    width, height,
    showNames: readBool(args, "showNames", true),
    showGothic: readBool(args, "showGothic", true),
    count: readInt(args, "count", C.NUM, 1, 60),
  });
  if (rawA !== undefined) {
    const a = readPoint(rawA, "a"), b = readPoint(rawB, "b");
    if (!(b.x > a.x)) throw new Error('"b" must lie to the right of "a" on the base (b.x > a.x)');
    s = C.withEndpoints(s, a, { x: b.x, y: a.y });
  }
  return s;
}

/** The base, its radius R and OD = R/2, measured from the core's endpoints. */
function scale(C: Core, s: State) {
  const R = (s.b.x - s.a.x) / 2;
  return { R, od: R / 2, base: round(s.b.x - s.a.x), a: pt(s.a), b: pt(s.b), c: pt(s.c), d: pt(s.d) };
}

const EXAMPLE_ENDPOINTS = '{"a":[34,340],"b":[470,340]';

export function actions(): GameActions {
  return {
    pappus_chain: {
      describe:
        "Run the real core from optional base endpoints a and b ([x, y] or { x, y }, y down; omit both for the opening picture) and optional count (1–60), reporting how each ideal Pappus-chain radius R_n = R/(2+n²) compares with the circle the applet draws. Here R is the large semicircle's radius (half of AB) and OD = R/2, so R_1 = R/3, R_2 = R/6 and R_1 + R_2 = OD; the drawn radii differ because each Apollonius step inflates its neighbour by one pixel.",
      args: EXAMPLE_ENDPOINTS + ',"count":6}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const sc = scale(C, s);
        const drawn = C.chain(s);
        const errors = C.tangencyErrors(s, drawn);
        const maxTangencyError = errors.length ? Math.max(...errors.map((row) => Math.max(...row))) : null;
        const radii = C.ideal(sc.R, 1).radius;
        const radii2 = C.ideal(sc.R, 2).radius;
        const rows = Array.from({ length: s.count }, (_, i) => {
          const n = i + 1;
          const ideal = C.ideal(sc.R, n);
          const d = drawn[i];
          return {
            n,
            idealRadius: round(ideal.radius),
            radiusOverOD: round(ideal.fractionOfOD),
            drawnRadius: d ? round(d.radius) : null,
            drawnMinusIdeal: d ? round(d.radius - ideal.radius) : null,
            center: d ? pt(d.center) : null,
          };
        });
        return {
          state: { width: s.width, height: s.height, showNames: s.showNames, showGothic: s.showGothic, count: s.count },
          scale: sc,
          firstTwo: {
            R1: round(radii), R2: round(radii2), sum: round(radii + radii2),
            od: round(sc.od), sumEqualsOD: close(radii + radii2, sc.od),
            expected: { R1: "R/3", R2: "R/6", sum: "R/2 = OD" },
          },
          circles: rows,
          drawnCount: drawn.length,
          maxTangencyError: maxTangencyError === null ? null : round(maxTangencyError, 9),
          note:
            `With r = 1, R_n = R·r/(r² + r + n²) = R/(2+n²) with R = ${round(sc.R)} ` +
            `(half the ${round(sc.base)}-unit base) and OD = R/2 = ${round(sc.od)}. ` +
            `The core gives R_1 = ${round(radii)} = R/3 and R_2 = ${round(radii2)} = R/6, whose sum ${round(radii + radii2)} equals OD; ` +
            "each R_n/OD = 2/(2+n²) is rational. The circles actually drawn are Apollonius solutions to circles inflated by one pixel at every step, so their radii sit slightly below the ideal ones, while their measured error against those inflated tangency targets is at the last digit. " +
            "This is an illustration, so there is no win or loss.",
        };
      },
    },

    pythagorean_triangle: {
      describe:
        "Run the real core at the optional base endpoints a and b (as in pappus_chain) and report the ideal Pappus point and the integer triple behind the right triangle D P_n O_n for n (1–200, default 1). Its sides are (n²−4, 4n, n²+4) times R/[2(2+n²)], so they form a Pythagorean triple; n = 1 gives 3-4-5, n = 3 gives 6-8-10 for O P_3 O_3 and n = 6 gives 24-32-40.",
      args: EXAMPLE_ENDPOINTS + ',"n":1}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const n = readInt(args, "n", 1, 1, 200);
        const sc = scale(C, s);
        const ideal = C.ideal(sc.R, n);
        const t = C.pythagoras(n);
        const unit = sc.R / (2 * (2 + n * n));
        const legs = { d: Math.abs(t.dLeg), height: t.heightLeg, hyp: t.dHyp };
        const identity = t.dLeg * t.dLeg + t.heightLeg * t.heightLeg === t.dHyp * t.dHyp;
        const otherIdentity = t.oLeg * t.oLeg + t.oHeightLeg * t.oHeightLeg === t.oHyp * t.oHyp;
        return {
          n,
          scale: sc,
          ideal: {
            radius: round(ideal.radius),
            height: round(ideal.height),
            signedDP: round(ideal.dx),
            DP: round(Math.abs(ideal.dx)),
            DO: round(ideal.dDistance),
            OP: round(ideal.oDistance),
            OO: round(ideal.ooDistance),
          },
          triple: {
            dLeg: t.dLeg, heightLeg: t.heightLeg, dHyp: t.dHyp,
            oLeg: t.oLeg, oHeightLeg: t.oHeightLeg, oHyp: t.oHyp,
            dTriple: [Math.abs(t.dLeg), t.heightLeg, t.dHyp],
            oTriple: [t.oHeightLeg, t.oLeg, t.oHyp],
            dIdentityHolds: identity, oIdentityHolds: otherIdentity,
          },
          scaledSides: {
            dLeg: round(legs.d * unit), heightLeg: round(legs.height * unit),
            hyp: round(legs.hyp * unit), factor: round(unit),
          },
          coreLengthsMatch: close(Math.abs(ideal.dx), legs.d * unit) &&
            close(ideal.height, legs.height * unit) && close(ideal.dDistance, legs.hyp * unit),
          namedCases: [1, 3, 6].map((k) => {
            const q = C.pythagoras(k);
            return { n: k, dTriple: [Math.abs(q.dLeg), q.heightLeg, q.dHyp], oTriple: [q.oHeightLeg, q.oLeg, q.oHyp] };
          }),
          note:
            `At n = ${n} the core puts P at height ${round(ideal.height)} and signed offset ${round(ideal.dx)} from D, ` +
            `so DP : height : DO = ${round(Math.abs(ideal.dx))} : ${round(ideal.height)} : ${round(ideal.dDistance)}, ` +
            `the triple ${Math.abs(t.dLeg)}, ${t.heightLeg}, ${t.dHyp} times ${round(unit)}. ` +
            "Multiplying by 2(2+n²)/R destroys that scale and leaves the integer identity (n²−4)² + (4n)² = (n²+4)²; at n = 1 it is the 3-4-5 triangle. " +
            "These are the ideal Pappus lengths; the applet's drawn circles use one-pixel-inflated neighbours, so measuring their pixels gives slightly different numbers. " +
            "This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

const maybeNum = (v: unknown): number | null => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const maybePt = (v: unknown): Pt | null => {
  if (v === undefined || v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Json;
  const x = maybeNum(o.x), y = maybeNum(o.y);
  return x === null || y === null ? null : { x, y };
};
function savedCircles(v: unknown): Circle[] | null {
  if (!Array.isArray(v)) return null;
  return v.map((item) => {
    const p = maybePt((item as Json | null)?.center);
    const r = maybeNum((item as Json | null)?.radius);
    if (!p || r === null) throw new Error("each saved circle needs a finite centre and radius");
    return { center: p, radius: r };
  });
}

/** Echo the Track.state payload and compare it with a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Gothic Arc state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Gothic Arc position must be an object");
  }
  try {
    const C = core();
    const a = maybePt(state.a), b = maybePt(state.b);
    if (!a || !b || !(b.x > a.x)) {
      throw new Error("saved position needs base points a and b with b.x > a.x");
    }
    let s = C.start({
      width: maybeNum(state.width) ?? undefined,
      height: maybeNum(state.height) ?? undefined,
      showNames: readBool(state, "showNames", true),
      showGothic: readBool(state, "showGothic", true),
    });
    s = C.withEndpoints(s, a, { x: b.x, y: a.y });
    const fromCore = C.position(s);
    const sc = scale(C, s);
    const drawn = C.chain(s);
    const errors = C.tangencyErrors(s, drawn);
    const maxTangencyError = errors.length ? Math.max(...errors.map((row) => Math.max(...row))) : null;
    const saved = {
      width: maybeNum(state.width), height: maybeNum(state.height),
      showNames: readBool(state, "showNames", true),
      showGothic: readBool(state, "showGothic", true),
      a: pt(a), b: pt(b), c: maybePt(state.c), top: maybePt(state.top), d: maybePt(state.d),
      angleC: maybeNum(state.angleC), radius: maybeNum(state.radius), od: maybeNum(state.od),
      drawn: savedCircles(state.drawn),
      ideal: Array.isArray(state.ideal)
        ? state.ideal.map((v) => ({ n: maybeNum((v as Json | null)?.n), radius: maybeNum((v as Json | null)?.radius) }))
        : null,
    };
    const coreDrawn = fromCore.drawn as Circle[] | undefined;
    const comparePt = (p: Pt | null, q: Pt | null): boolean =>
      !!p && !!q && close(p.x, q.x) && close(p.y, q.y);
    const matches = {
      a: comparePt(saved.a, pt(fromCore.a as Pt)),
      b: comparePt(saved.b, pt(fromCore.b as Pt)),
      c: comparePt(saved.c, pt(fromCore.c as Pt)),
      d: comparePt(saved.d, pt(fromCore.d as Pt)),
      top: comparePt(saved.top, pt(fromCore.top as Pt)),
      radius: close(saved.radius ?? NaN, sc.R),
      od: close(saved.od ?? NaN, sc.od),
      angleC: saved.angleC === (fromCore.angleC as number),
      drawn: saved.drawn !== null && saved.drawn.length === coreDrawn?.length &&
        saved.drawn.every((c, i) => comparePt(c.center, pt(coreDrawn![i].center)) &&
          close(c.radius, coreDrawn![i].radius)),
      ideal: saved.ideal !== null && saved.ideal.every((v) =>
        v.n !== null && v.radius !== null && close(v.radius, C.ideal(sc.R, v.n).radius)),
    };
    const first = C.ideal(sc.R, 1), second = C.ideal(sc.R, 2);
    return {
      ...state,
      stateVersion,
      valid: true,
      saved,
      corePosition: fromCore,
      derived: {
        base: sc.base, R: round(sc.R), od: round(sc.od),
        R1: round(first.radius), R2: round(second.radius),
        R1PlusR2: round(first.radius + second.radius),
        sumEqualsOD: close(first.radius + second.radius, sc.od),
        radiusOverOD: [1, 2, 3, 6].map((n) => ({ n, value: round(C.ideal(sc.R, n).fractionOfOD) })),
        drawnMinusIdeal: drawn.slice(0, 4).map((c, i) => ({
          n: i + 1, drawn: round(c.radius), ideal: round(C.ideal(sc.R, i + 1).radius),
          difference: round(c.radius - C.ideal(sc.R, i + 1).radius),
        })),
        dTripleAt1: [Math.abs(C.pythagoras(1).dLeg), C.pythagoras(1).heightLeg, C.pythagoras(1).dHyp],
        maxTangencyError: maxTangencyError === null ? null : round(maxTangencyError, 9),
      },
      savedMatchesCore: { ...matches, all: Object.values(matches).every(Boolean) },
      note:
        "Track.state saved the endpoints, display flags, the rebuilt points, the ideal radii and the circles the applet drew, all in board pixels with y down; the core recomputes them from a and b. " +
        `Here R = ${round(sc.R)} and OD = ${round(sc.od)}, with R_1 = R/3 = ${round(first.radius)} and R_2 = R/6 = ${round(second.radius)} summing to OD, while the drawn radii fall slightly below their ideal values because each Apollonius step inflates a neighbour by one pixel. ` +
        (Object.values(matches).every(Boolean)
          ? "The saved picture agrees with the core's recomputation."
          : "Some saved fields differ from the core's recomputation; see the flags above.") +
        " This is an illustration, so there is no win or loss.",
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note:
        "The saved position needs base points a and b with b.x > a.x, optional positive width and height, boolean showNames and showGothic, and if present finite points, radii and ideal radii.",
    };
  }
}
