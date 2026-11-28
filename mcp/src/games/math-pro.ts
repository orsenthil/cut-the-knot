/*
 * run_game_logic actions and saved-position reader for Math Pro.
 *
 * Math Pro is Bogomolny's MathPro applet. Its triangle ABC has an incircle
 * touching BC, CA and AB at D, E, F. For a point P the cevians AP, BP, CP cut
 * the incircle twice; taking the crossing nearest each vertex gives X, Y, Z
 * and the cevians DX, EY, FZ meet at one point (Rabinowitz's point). Swapping
 * an even number of those crossings for the far ones keeps the concurrence,
 * while swapping all three does not in general — unless a cevian is tangent
 * to the circle (a touch point), where near = far and even the all-far
 * triplet meets.
 *
 * Every number below is measured with the game's real core,
 * math-pro/math-pro-core.js (global MathProCore), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["math-pro"].MathProCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Far = [boolean, boolean, boolean];

const r = (v: number, places = 3) => {
  const k = 10 ** places;
  return Math.round(v * k) / k;
};
const xy = (p: Point) => ({ x: r(p.x), y: r(p.y) });
/** Concurrence residuals are tiny; keep their size instead of rounding to zero. */
const sig = (v: number) => (Number.isFinite(v) ? Number(v.toExponential(3)) : null);

/** Accept [x, y] (tutor args) or { x, y } (the page's saved position). */
function pointArg(v: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(v) && v.length === 2) {
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite x and y`);
  }
  return { x, y };
}

/** A saved corner may be missing or half-written; never fail the reader on it. */
function savedPoint(v: unknown, fallback: Point): Point {
  try { return pointArg(v, "point"); } catch { return { x: fallback.x, y: fallback.y }; }
}

/** The triangle and point the actions work on; missing points use the applet's opening position. */
function stateFromArgs(C: Core, args: Json) {
  const home = C.start({});
  return {
    A: args.A === undefined ? home.A : pointArg(args.A, "A"),
    B: args.B === undefined ? home.B : pointArg(args.B, "B"),
    C: args.C === undefined ? home.C : pointArg(args.C, "C"),
    P: args.P === undefined ? home.P : pointArg(args.P, "P"),
  };
}

/** The near/far choices behind the page's four concurrence statements. */
const TRIPLETS: Array<{ name: string; far: Far }> = [
  { name: "DX, EY, FZ (all near)", far: [false, false, false] },
  { name: "DX, EY′, FZ′ (swap Y, Z)", far: [false, true, true] },
  { name: "DX′, EY, FZ′ (swap X, Z)", far: [true, false, true] },
  { name: "DX′, EY′, FZ (swap X, Y)", far: [true, true, false] },
  { name: "DX′, EY′, FZ′ (all far)", far: [true, true, true] },
];

/** Which cevians are tangent, i.e. whose near and far crossings coincide. */
function tangentCevians(C: Core, d: any): string[] {
  const tol = 1e-6 * Math.max(1, Number(d.scale) || 1);
  const names: string[] = [];
  if (d.X && d.Xp && C.distance(d.X, d.Xp) <= tol) names.push("AP (X = X′)");
  if (d.Y && d.Yp && C.distance(d.Y, d.Yp) <= tol) names.push("BP (Y = Y′)");
  if (d.Z && d.Zp && C.distance(d.Z, d.Zp) <= tol) names.push("CP (Z = Z′)");
  return names;
}

/** The five triplets as a compact, comparable reading. */
function tripletReading(C: Core, s: any) {
  return TRIPLETS.map((t) => {
    const c = C.concurrency(s, t.far);
    return {
      name: t.name,
      far: t.far.map((f) => (f ? "far" : "near")),
      concurrent: c.concurrent,
      missDistance: sig(c.error),
      Q: c.Q ? xy(c.Q) : null,
    };
  });
}

export function actions(): GameActions {
  const C = core();

  return {
    concurrence: {
      describe:
        "For triangle ABC and point P, the near incircle crossings give cevians DX, EY, FZ that meet at Rabinowitz's point Q; swapping any two near crossings for far ones keeps the concurrence, while swapping all three fails in general (unless a cevian is tangent — a touch point where near = far). Reports each triplet's meeting point Q and the third line's miss distance; give A, B, C, P as [x, y] or { x, y }, or omit them for the applet's opening position.",
      args: '{ "A": [136, 30], "B": [100, 240], "C": [320, 240], "P": [179.75, 135] }',
      run: (args) => {
        const s = stateFromArgs(C, args);
        if (C.isDegenerate(s)) {
          return { valid: false, note: "The corners are collapsed or collinear, so there is no incircle. Move A, B and C apart." };
        }
        const d: any = C.diagram(s);
        if (!d.valid) {
          return { valid: false, note: "One of AP, BP, CP misses the incircle. Drag P towards the triangle." };
        }
        const triplets = tripletReading(C, s);
        const claims = C.claims(s);
        const touch = tangentCevians(C, d);
        const allFar = triplets[4];
        const note = claims.main && claims.mixed
          ? `The near cevians meet at Q = (${xy(d.Q).x}, ${xy(d.Q).y}), and swapping any two near crossings for far ones still meets (at a different point). ` +
            (claims.allFarNot
              ? `All three far cevians miss the third line by ${allFar.missDistance}.`
              : `Here ${touch.join(" and ")} is tangent, so near = far there and even the all-far triplet meets — the exception on the page.`)
          : "The concurrence claims do not hold for this configuration.";
        return {
          valid: true,
          triangle: { A: xy(s.A), B: xy(s.B), C: xy(s.C), P: xy(s.P) },
          sides: { BC: r(C.distance(s.B, s.C)), CA: r(C.distance(s.C, s.A)), AB: r(C.distance(s.A, s.B)) },
          incircle: { center: xy(d.I), radius: r(d.circle.radius) },
          touchPoints: { D: xy(d.D), E: xy(d.E), F: xy(d.F) },
          rabinowitzPoint: xy(d.Q),
          triplets,
          claims: { nearConcur: claims.main, mixedConcur: claims.mixed, allFarFails: claims.allFarNot },
          tangentCevians: touch,
          note,
        };
      },
    },

    touch_point: {
      describe:
        "A touch point: put P on side BC, CA or AB (fraction t from the first named vertex, default 0.5) so the cevians to that side are tangent to the incircle, making their near and far crossings coincide. Then even the all-far triplet concurs, unlike a generic P; give A, B, C to choose the triangle, or omit them for the applet's opening triangle (a different t may be needed if a cevian misses the circle).",
      args: '{ "A": [136, 30], "B": [100, 240], "C": [320, 240], "side": "BC", "t": 0.5 }',
      run: (args) => {
        const s0 = stateFromArgs(C, args);
        const side = String(args.side ?? "BC").toUpperCase();
        const ends: Record<string, [Point, Point]> = {
          BC: [s0.B, s0.C], CA: [s0.C, s0.A], AB: [s0.A, s0.B],
        };
        if (!Object.prototype.hasOwnProperty.call(ends, side)) {
          throw new Error(`argument "side" must be "BC", "CA" or "AB", got ${JSON.stringify(args.side)}`);
        }
        const t = num(args, "t", 0.5);
        if (!(t > 0 && t < 1)) throw new Error(`argument "t" must be a fraction strictly between 0 and 1, got ${JSON.stringify(args.t)}`);
        const [u, v] = ends[side];
        const P = { x: u.x + t * (v.x - u.x), y: u.y + t * (v.y - u.y) };
        const s = C.withPoint(s0, "P", P);
        if (C.isDegenerate(s)) {
          return { valid: false, note: "The corners are collapsed or collinear, so there is no incircle." };
        }
        const d: any = C.diagram(s);
        if (!d.valid) {
          return { valid: false, note: "With P on that side a different cevian misses the incircle; move A, B or C." };
        }
        const triplets = tripletReading(C, s);
        const claims = C.claims(s);
        const near = triplets[0], allFar = triplets[4];
        return {
          valid: true,
          side, t,
          P: xy(P),
          triangle: { A: xy(s.A), B: xy(s.B), C: xy(s.C) },
          touch: { D: xy(d.D), E: xy(d.E), F: xy(d.F) },
          tangentCevians: tangentCevians(C, d),
          nearConcur: { concurrent: near.concurrent, Q: near.Q },
          allFarConcur: { concurrent: allFar.concurrent, Q: allFar.Q, missDistance: allFar.missDistance },
          allFarFails: claims.allFarNot,
          note: `P lies on ${side}, so the cevians from its two endpoints run along that side and touch the incircle at its touch point (near = far). The near cevians still meet at (${near.Q && near.Q.x}, ${near.Q && near.Q.y}), and here the all-far triplet meets too (miss distance ${allFar.missDistance}) — the exception to the page's generic "all far fails" claim.`,
        };
      },
    },
  };
}

/** The page's saved points, plus the core's incircle, crossings and concurrences. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Math Pro state version ${stateVersion}`);
  const home = C.start({});
  const A = savedPoint(state.A, home.A);
  const B = savedPoint(state.B, home.B);
  const Cc = savedPoint(state.C, home.C);
  const P = savedPoint(state.P, home.P);
  const s = { A, B, C: Cc, P };
  const d: any = C.diagram(s);
  const claims = C.claims(s);

  const reading: Record<string, unknown> = {
    valid: d.valid,
    claims: {
      nearConcur: claims.main,
      mixedConcur: claims.mixed,
      allFarFails: claims.allFarNot,
      Q: claims.Q ? xy(claims.Q) : null,
    },
  };
  if (d.valid) {
    Object.assign(reading, {
      sides: { BC: r(C.distance(B, Cc)), CA: r(C.distance(Cc, A)), AB: r(C.distance(A, B)) },
      incircle: { center: xy(d.I), radius: r(d.circle.radius) },
      touchPoints: { D: xy(d.D), E: xy(d.E), F: xy(d.F) },
      nearCrossings: { X: xy(d.X), Y: xy(d.Y), Z: xy(d.Z) },
      farCrossings: { Xp: xy(d.Xp), Yp: xy(d.Yp), Zp: xy(d.Zp) },
      rabinowitzPoint: d.Q ? xy(d.Q) : null,
      tangentCevians: tangentCevians(C, d),
      triplets: tripletReading(C, s),
    });
  } else {
    reading.note = C.isDegenerate(s)
      ? "The saved corners are collapsed or collinear, so there is no incircle."
      : "A cevian from a saved corner misses the incircle; there are no crossings to read.";
  }

  return {
    stateVersion,
    A: xy(A), B: xy(B), C: xy(Cc), P: xy(P),
    ...reading,
  };
}
