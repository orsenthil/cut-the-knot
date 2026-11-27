/*
 * run_game_logic actions and saved-position reader for Cross Points in a Polygon.
 *
 * The real core is ceva-in-ngon/ceva-in-ngon-core.js, copied into
 * src/generated/cores/ at build time. Number the vertices of an odd n-gon
 * A_0 ... A_(n-1); the side opposite A_m runs from A_k to A_(k+1) with
 * k = m + floor(n/2) (mod n). The cross point of A_m is where the line PA_m
 * meets that side's line, and it counts as "on the side" when it lies between
 * the two ends. The core's Compute() supplies the cross points and flags;
 * its ratio() gives the signed fraction A_k B / B A_(k+1) along the side.
 * The two claims of the article — the number of on-side cross points is odd,
 * and the product of all n signed fractions is 1 — come from C.claims(),
 * which returns null in the exceptional positions (parallel lines or
 * coincident points) that the article excludes.
 *
 * Qualification to the article: "P outside the polygon gives one cross point"
 * is true for convex polygons, but a concave polygon can have 3, 5, ... for
 * an outside P. The count is still odd and the product is still 1.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["ceva-in-ngon"].CevaInNgonCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Picture = { n: number; vertices: Point[]; p: Point };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round(v);
const pt = (p: Point | null | undefined): Point | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** A corner or P arrives as {x, y} or as a short [x, y]. */
function pointArg(raw: unknown, label: string): Point {
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or {x, y}`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${label}" is not a finite point`);
    return { x, y };
  }
  if (!raw || typeof raw !== "object") throw new Error(`argument "${label}" must be [x, y] or {x, y}`);
  const p = raw as Json;
  return { x: num(p, "x"), y: num(p, "y") };
}

/**
 * Build a picture the way the page does: start with n vertices spread round a
 * circle (a fixed jitter keeps examples reproducible), then move any named
 * corner and P. n must be an odd value the spinner actually offers.
 */
function readPicture(C: Core, args: Json): Picture {
  const rawN = num(args, "n", C.DEFAULT_N);
  const n = Math.round(rawN);
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N || n % 2 !== 1) {
    throw new Error(`n must be an odd integer from ${C.MIN_N} to ${C.MAX_N}, got ${JSON.stringify(rawN)}`);
  }
  let s = C.start({ n, random: () => 0.5 }) as Picture;
  const vs = args.vertices;
  if (vs !== undefined && vs !== null) {
    if (!Array.isArray(vs) || vs.length !== n) {
      throw new Error(`vertices must be an array of ${n} points, one per vertex`);
    }
    for (let i = 0; i < n; i++) {
      s = C.withPoint(s, `V${i}`, pointArg(vs[i], `vertices[${i}]`)) as Picture;
    }
  }
  const rawP = args.p !== undefined && args.p !== null ? args.p : args.P;
  if (rawP !== undefined && rawP !== null) s = C.withPoint(s, "P", pointArg(rawP, "p")) as Picture;
  return s;
}

/** Ray casting, the same test the logic test uses to tell inside from outside. */
function pInsidePolygon(p: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Every turn the same way round means no dent in the polygon. */
function polygonConvex(vertices: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length], c = vertices[(i + 2) % vertices.length];
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(z) < 1e-9) continue;
    const turn = Math.sign(z);
    if (sign !== 0 && turn !== sign) return false;
    sign = turn;
  }
  return true;
}

/** Everything the core measures at one picture, in tutor-friendly units. */
function reading(C: Core, s: Picture) {
  const m = C.compute(s);
  const cl = C.claims(s);
  const generic = C.isGeneric(s);
  const convex = polygonConvex(s.vertices);
  const pInside = pInsidePolygon(s.p, s.vertices);
  const fractions = s.vertices.map((_, i) => ({
    vertex: `A${i}`,
    oppositeSide: (C.oppositeSide(s, i) as number[]).map((k) => `A${k}`),
    cross: pt(m.cross[i]),
    onSide: Boolean(m.isInside[i]),
    fraction: maybe(C.ratio(s, i)),
  }));

  let note: string;
  if (!cl) {
    note =
      "Two lines are parallel or two points coincide, so a cross point is missing. The applet gets a NaN there and the article excludes such positions; move P or a corner and check again.";
  } else if (pInside) {
    note =
      `P is inside the polygon: ${cl.count} cross points lie on their opposite sides, which is odd, and the signed fractions multiply to 1.`;
  } else if (convex) {
    note =
      `P is outside a convex polygon, so exactly one cross point lies on a side (here ${cl.count}). The article's "one dot outside" claim holds for this shape; the signed fractions multiply to 1.`;
  } else {
    note =
      `P is outside, but this polygon has a dent: ${cl.count} cross points lie on sides, not always one. The article's "outside gives one" statement holds only for convex polygons. Even here the count is odd and the signed fractions multiply to 1.`;
  }

  return {
    n: s.n,
    vertices: s.vertices.map(pt),
    p: pt(s.p),
    count: m.count,
    fractions,
    generic,
    polygonConvex: convex,
    pInside,
    claims: cl ? {
      oddCrossings: cl.oddCrossings,
      productIsOne: cl.productIsOne,
      product: round(cl.product),
      count: cl.count,
    } : null,
    note,
  };
}

export function actions(): GameActions {
  return {
    crossings: {
      describe:
        "For an odd-sided polygon (n from 3 to 21) and a point P, report the side opposite each vertex, the cross point there, whether it lands on that side, the signed fraction A_k B / B A_(k+1), the number of cross points on sides and the product of all the fractions. The count is always odd and the product is 1 unless the picture is degenerate (parallel lines or coincident points), which is reported as claims: null. P defaults to the centre of a regular n-gon; pass p (or P) and optionally vertices to move them. The article also says an outside P gives one cross point: that is true for convex polygons; with a dent the count can be 3, 5, ... while staying odd. Try { n: 5, p: { x: 184, y: 189.47 } } for five crossings and a product of 1.",
      args: '{ "n": 5, "p": { "x": 184, "y": 189.47 } }',
      run: (args) => {
        const C = core();
        return reading(C, readPicture(C, args));
      },
    },
    outside_point: {
      describe:
        "Check the article's statement about a point outside the polygon. Pass the corners as an odd number of {x, y} (or [x, y]) points and a point p outside them. The report says whether the polygon is convex, how many cross points lie on sides and whether the product of signed fractions is 1. Outside a convex polygon the answer is one; outside a concave one it can be 3, 5, ... — always odd. The example is a pentagon with a dent and P in the dent, which gives three crossings rather than one.",
      args:
        '{ "vertices": [{"x":180,"y":40},{"x":320,"y":150},{"x":220,"y":300},{"x":140,"y":300},{"x":180,"y":180}], "p": {"x":160,"y":180} }',
      run: (args) => {
        const C = core();
        const vs = args.vertices;
        if (!Array.isArray(vs) || vs.length < C.MIN_N || vs.length > C.MAX_N || vs.length % 2 !== 1) {
          throw new Error(`vertices must be an odd number of points from ${C.MIN_N} to ${C.MAX_N}`);
        }
        if (args.n !== undefined && Math.round(num(args, "n")) !== vs.length) {
          throw new Error("n must match the number of vertices given");
        }
        const r = reading(C, readPicture(C, { ...args, n: vs.length }));
        if (r.pInside) throw new Error("that P is inside the polygon; this action is about points outside it");
        if (!r.generic) throw new Error("two lines are parallel or two points coincide, so there is no cross point to count");
        return r;
      },
    },
  };
}

/** The picture Track.state saved on the page, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const saved = state && typeof state === "object" ? state : {};
  const s = readPicture(C, saved);
  return {
    stateVersion,
    saved: { n: s.n, vertices: s.vertices.map(pt), p: pt(s.p) },
    reading: reading(C, s),
    note:
      "Track.state saves the polygon's vertex list, the side count and the dragged point P exactly as the page uses them. The reading recomputes every cross point and signed fraction with the same construction, so the odd count and the product of 1 can be checked for this very picture.",
  };
}
