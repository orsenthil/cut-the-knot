/*
 * run_game_logic actions and saved-position reader for Elkies (Six Circles
 * Theorem).
 *
 * A triangle is cut from a corner A3 to a point P on the opposite side A1A2.
 * The two pieces are triangles with "companion" incircles. Cutting again from
 * the next corner, along a tangent to the circle just drawn, gives a chain:
 * circle seven returns to circle one (centre and radius), so there are never
 * more than six distinct circles. Demir's relation for consecutive radii,
 * 1/r_n + 1/r_n+1 - r/(r_n r_n+1) = 2/h_n+2, combines into
 * (r/r_n - 1)(r/r_n+3 - 1) = tan^2(a_n/2), and since r_n+3 < r the common
 * factor cancels under n -> n+3 to give r_n+6 = r_n.
 *
 * Every number below comes from the real core
 * elkies/elkies-core.js, copied into src/generated/cores/ at build time.
 * Coordinates are board units in the page's 360 x 240 viewBox, y down; a
 * state is the three vertices V, the cut parameter ta (measured from A2)
 * and the highlighted pair which (0..5, or 6 for all). See _shared.ts for
 * the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["elkies"].ElkiesCore as any;
type Core = ReturnType<typeof core>;

type Pt = { x: number; y: number };

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Core residuals can be NaN for a flat triangle; JSON cannot carry NaN. */
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
/** Keep the size and sign of a tiny residual instead of rounding it to zero. */
const sig = (v: unknown): string | null =>
  typeof v === "number" && Number.isFinite(v) ? v.toExponential(2) : null;
const xy = (p: unknown): Pt | null => {
  if (!p || typeof p !== "object") return null;
  const o = p as Json;
  const x = cnt(o.x), y = cnt(o.y);
  return x === null || y === null ? null : { x, y };
};
const near = (a: number, b: number, tol = 1e-7): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept the page's saved { x, y } points and the tutor's [x, y] arguments. */
function readPoint(v: unknown, label: string): Pt {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    const x = Number(v[0]), y = Number(v[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`"${label}" needs two finite numbers, got ${JSON.stringify(v)}`);
    }
    return { x, y };
  }
  if (v && typeof v === "object") return { x: num(v as Json, "x"), y: num(v as Json, "y") };
  throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
}

/** C.start() then the same core moves the page's handles make; no state is mutated. */
function buildState(C: Core, args: Json): any {
  let s = C.start({});
  if (args.V !== undefined && args.V !== null) {
    if (!Array.isArray(args.V) || args.V.length !== 3) {
      throw new Error('"V" must be three points [x, y] or { "x": ..., "y": ... }');
    }
    for (let i = 0; i < 3; i++) s = C.setVertex(s, i, readPoint(args.V[i], `V[${i}]`));
  }
  if (args.ta !== undefined && args.ta !== null) {
    // The page stops P a hair inside the side; the raw core's 0 and 1 kill a circle.
    s = { ...s, ta: C.clamp(num(args, "ta"), C.TA_MIN, C.TA_MAX) };
  }
  if (args.which !== undefined && args.which !== null) {
    s = C.setWhich(s, num(args, "which"));
  }
  return s;
}

/**
 * The page's two equations at each of the six steps, measured by the core.
 * Page index n = k+1: its A_n is V[(n)%3] = V[(k+1)%3] and its A_(n+2) is
 * V[(k+3)%3] = V[k%3]. Circle k has radius rs[k], with rs[6] = rs[0].
 */
function claims(C: Core, s: any, ch: any) {
  const rs: number[] = ch.circles.map((c: any) => c.radius);
  const inc = C.incircle(s.V[0], s.V[1], s.V[2]);
  const R: number = inc ? inc.radius : NaN;
  const tol = 1e-7;
  const steps: any[] = [];
  for (let k = 0; k < C.PAIRS; k++) {
    const vertexIdx = (k + 1) % 3;
    const otherV = [0, 1, 2].filter((i) => i !== vertexIdx);
    const a = C.angleAt(s.V[vertexIdx], s.V[otherV[0]], s.V[otherV[1]]);
    const tan2 = Math.pow(Math.tan(a / 2), 2);
    const tanLhs = (R / rs[k] - 1) * (R / rs[(k + 3) % C.PAIRS] - 1);

    const hIdx = k % 3;
    const otherH = [0, 1, 2].filter((i) => i !== hIdx);
    const h = C.distance(s.V[hIdx], C.foot(s.V[hIdx], s.V[otherH[0]], s.V[otherH[1]]));
    const demirLhs = 1 / rs[k] + 1 / rs[(k + 1) % C.PAIRS] - R / (rs[k] * rs[(k + 1) % C.PAIRS]);
    const demirRhs = 2 / h;

    steps.push({
      n: k + 1,
      radius: cnt(rs[k]),
      altitudeFromA_nPlus2: cnt(h),
      demir: {
        lhs: cnt(demirLhs), rhs: cnt(demirRhs),
        residual: sig(demirLhs - demirRhs), holds: near(demirLhs, demirRhs, tol),
      },
      tanSquared: {
        lhs: cnt(tanLhs), rhs: cnt(tan2),
        residual: sig(tanLhs - tan2), holds: near(tanLhs, tan2, tol),
      },
      belowBigIncircle: rs[k] < R,
    });
  }
  return {
    bigInradius: cnt(R),
    chainClosed: ch.closed === true,
    steps,
    demirHolds: steps.every((p) => p.demir.holds),
    tanRelationHolds: steps.every((p) => p.tanSquared.holds),
    allBelowBigIncircle: steps.every((p) => p.belowBigIncircle),
    tolerance: tol,
  };
}

const example = '{ "V": [[180, 20], [45, 220], [315, 192]], "ta": 0.7, "which": 6 }';

export function actions(): GameActions {
  return {
    six_circles: {
      describe:
        "Draw the Elkies chain of companion incircles for a triangle with vertices V = [A3, A1, A2] and a point P on side A1A2 set by ta (0..1, measured from A2). Each point is [x, y] or { x, y } in the page's 360 x 240 board, y down; omit an argument to use the applet's opening diagram (ta = 0.7), and which selects the highlighted pair (0..5, 6 = all). Reports the six cuts and seven circles from the real core, whether circle seven returns to circle one in both centre and radius, and how many distinct circles appear. This is the Six Circles Theorem: the chain never grows past six; there is no win or loss, only the picture to explore.",
      args: example,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const ch = C.chain(s);
        const rs: number[] = ch.circles.map((c: any) => c.radius);
        const inc = C.incircle(s.V[0], s.V[1], s.V[2]);

        let firstVsSeventh: Json | null = null;
        if (ch.circles.length === C.PAIRS + 1) {
          const a = ch.circles[0], b = ch.circles[C.PAIRS];
          firstVsSeventh = {
            radiusDifference: sig(rs[C.PAIRS] - rs[0]),
            centreDistance: sig(C.distance(a.center, b.center)),
            sameCircle: ch.closed === true,
          };
        }
        const distinct = new Set(
          ch.circles.slice(0, C.PAIRS).map((c: any) =>
            [c.center.x, c.center.y, c.radius].map((v: number) => v.toFixed(4)).join(",")),
        ).size;

        return {
          V: s.V.map(xy),
          P: xy(C.sidePoint(s)),
          ta: round(s.ta), which: s.which,
          bigInradius: cnt(inc ? inc.radius : NaN),
          circleCount: ch.circles.length,
          circles: ch.circles.map((c: any) => ({ centre: xy(c.center), radius: cnt(c.radius) })),
          cuts: ch.cuts.map((cut: any) => ({ from: xy(cut.from), to: xy(cut.to), at: xy(cut.at) })),
          closed: ch.closed === true,
          firstVsSeventh,
          distinctCircles: distinct,
          note:
            "Cutting from a corner to P makes two triangles with companion incircles; cutting from the next corner along a tangent to the circle just drawn repeats the construction. The seventh circle lands back on the first one's centre and radius, so at most six different circles can appear — the Six Circles Theorem posed by Elkies and proved by Fukuta. " +
            (ch.closed === true
              ? "This chain closes."
              : "This triangle or cut is too close to degenerate for the core to finish the chain; move the corners apart and try again."),
        };
      },
    },

    demir_relation: {
      describe:
        "Check the page's two radius equations at all six steps of an Elkies chain, with arguments as in six_circles (triangle V, cut ta, pair which; omitted arguments use the opening diagram). Evaluates Demir's relation 1/r_n + 1/r_n+1 - r/(r_n r_n+1) = 2/h_n+2, with r the big triangle's inradius and h_n+2 an altitude, and the combined identity (r/r_n - 1)(r/r_n+3 - 1) = tan^2(a_n/2). Returns each step's two sides and their residual, plus whether every step holds, every chain radius is smaller than r, and the chain closes. Replacing n by n+3 leaves tan^2(a_n/2) unchanged, and r_n+3 < r cancels the common factor to give r_n+6 = r_n.",
      args: example,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const ch = C.chain(s);
        if (ch.circles.length < C.PAIRS + 1) {
          return {
            applicable: false,
            note: "The core could not draw all seven circles here: the triangle is too flat or a tangent cut fell outside a side, so there are no six radii to test. Move the corners apart and try again.",
          };
        }
        return {
          applicable: true,
          V: s.V.map(xy),
          ta: round(s.ta),
          ...claims(C, s, ch),
          note:
            "Demir's relation links two consecutive companion radii to the altitude from the next corner. Writing the same equation at n, n+1 and n+2 and eliminating the common middle factor gives (r/r_n - 1)(r/r_n+3 - 1) = tan^2(a_n/2). Since the angle repeats after three corners, shifting n by 3 leaves the right side alone and r_n+3 < r lets the factor cancel: r_n+6 = r_n. Each 'residual' is lhs minus rhs; the core's incircle radius is an average of three distances, so residuals are tiny rather than exactly zero.",
        };
      },
    },
  };
}

/** Track.state saved V, P, ta, which, the seven circles and closed; rebuild the rest. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Elkies state version ${stateVersion}`);
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);

  let savedReadable = true;
  let s: any;
  try {
    s = buildState(C, { V: src.V, ta: src.ta, which: src.which });
  } catch {
    s = C.start({});
    savedReadable = false;
  }
  const corePos = C.position(s);

  const savedCircles = Array.isArray(src.circles) ? (src.circles as Json[]) : null;
  const saved = {
    V: Array.isArray(src.V) ? (src.V as unknown[]).map(xy) : null,
    P: xy(src.P),
    ta: cnt(src.ta),
    which: cnt(src.which),
    circleCount: savedCircles ? savedCircles.length : null,
    radii: savedCircles ? savedCircles.map((c) => cnt(c?.radius)) : null,
    closed: typeof src.closed === "boolean" ? src.closed : null,
  };
  const reading = {
    V: (corePos.V as unknown[]).map(xy),
    P: xy(corePos.P),
    ta: round(corePos.ta), which: corePos.which,
    circleCount: (corePos.circles as unknown[]).length,
    circles: (corePos.circles as any[]).map((c) => ({ centre: xy(c.center), radius: cnt(c.radius) })),
    closed: corePos.closed === true,
  };

  // How closely the saved numbers match a fresh run of the core at this state.
  const scale = Math.max(1, ...(corePos.circles as any[]).map((c) => c.radius));
  const tol = 1e-6 * scale;
  const vertexDistances = (Array.isArray(src.V) ? (src.V as unknown[]).map(xy) : [])
    .map((p, i) => (p && corePos.V[i] ? C.distance(p, corePos.V[i]) : null))
    .filter((d): d is number => d !== null);
  const centreDistances = (savedCircles ?? [])
    .map((c, i) => {
      const p = xy(c?.center);
      return p && corePos.circles[i] ? C.distance(p, corePos.circles[i].center) : null;
    })
    .filter((d): d is number => d !== null);
  const radiusDifferences = (savedCircles ?? [])
    .map((c, i) => {
      const r = cnt(c?.radius);
      return r !== null && corePos.circles[i] ? Math.abs(r - corePos.circles[i].radius) : null;
    })
    .filter((d): d is number => d !== null);
  const pSaved = xy(src.P);
  const pDistance = pSaved && corePos.P ? C.distance(pSaved, corePos.P) : null;
  const maxOf = (v: number[]): number | null => (v.length ? Math.max(...v) : null);

  const agreement = {
    verticesMaxDistance: cnt(maxOf(vertexDistances)),
    PDistance: cnt(pDistance),
    centresMaxDistance: cnt(maxOf(centreDistances)),
    radiiMaxDifference: cnt(maxOf(radiusDifferences)),
    circleCountMatches: saved.circleCount === null ? null : saved.circleCount === reading.circleCount,
    closedMatches: saved.closed === null ? null : saved.closed === reading.closed,
    withinTolerance: savedReadable && saved.circleCount === reading.circleCount &&
      saved.closed === reading.closed &&
      [maxOf(vertexDistances), maxOf(centreDistances), maxOf(radiusDifferences), pDistance]
        .every((d) => d === null || d < tol),
    tolerance: round(tol, 9),
  };

  return {
    stateVersion,
    savedReadable,
    saved,
    reading,
    agreement,
    note:
      "Track.state saved the three corners, the point P, the cut parameter ta, the highlighted pair, the seven incircles and the closed flag. The core rebuilds P from ta and the chain from the same corners: the seventh circle is the first again, so at most six circles are distinct. " +
      (!savedReadable
        ? "The saved position could not be read, so the opening diagram was used for the reading."
        : agreement.withinTolerance
          ? "The saved circles and closed flag agree with a fresh run of the core at this position; the small residuals are rounding from saving board-unit numbers."
          : "The saved circles differ from a fresh run of the core, so compare the two readings above. "),
    maths: "This is a demonstration with no win or loss: the Six Circles Theorem keeps the chain to six circles, and Demir's relation explains why the chain repeats after six steps.",
  };
}
