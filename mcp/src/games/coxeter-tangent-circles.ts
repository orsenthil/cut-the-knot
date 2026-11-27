/*
 * run_game_logic actions and saved-position reader for Coxeter Tangent Circles.
 *
 * The real core is coxeter-tangent-circles/coxeter-tangent-circles-core.js,
 * copied into src/generated/cores/ at build time. A state is three centres A,
 * B, C on a 480 x 320 board (y down) and the choice of the small inner circle
 * or the enclosing outer one. The core takes the three radii from the side
 * lengths so the three circles always touch, then solves Apollonius' problem
 * for a fourth circle in two ways and rebuilds Beecroft's second quadruplet
 * from the six touching points. Every number below is measured by that core;
 * see _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["coxeter-tangent-circles"].CoxeterTangentCirclesCore;
type Geometry = ReturnType<ReturnType<typeof core>["geometry"]>;

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };

const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
/** Numbers from the core can be NaN for a degenerate triangle; JSON cannot carry it. */
const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const pt = (p: unknown): Point | null => {
  if (!p || typeof p !== "object") return null;
  const o = p as Json;
  const x = finite(o.x), y = finite(o.y);
  return x === null || y === null ? null : { x, y };
};
const circle = (c: unknown): Circle | null => {
  const p = pt(c);
  if (!p || !c || typeof c !== "object") return null;
  const r = finite((c as Json).r);
  return r === null || r < 0 ? null : { x: p.x, y: p.y, r };
};

const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a: number, b: number, tol = 1e-5): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPt = (p: Point | null, q: Point | null, tol = 1e-5): boolean =>
  !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);

function readPoint(value: unknown, label: string): Point {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${label}" must be { "x": number, "y": number }`);
  }
  const o = value as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

/** The three centres, clamped to the board by the core, and the family choice. */
function readConfig(args: Json) {
  const C = core();
  const inner = args.innerCircle;
  if (inner !== undefined && inner !== null && typeof inner !== "boolean") {
    throw new Error('"innerCircle" must be true (small circle) or false (enclosing circle)');
  }
  return C.start({
    A: args.A === undefined || args.A === null ? undefined : readPoint(args.A, "A"),
    B: args.B === undefined || args.B === null ? undefined : readPoint(args.B, "B"),
    C: args.C === undefined || args.C === null ? undefined : readPoint(args.C, "C"),
    innerCircle: inner === undefined || inner === null ? undefined : inner,
  });
}

/** How far the fourth circle is from touching each of the three (0 means tangent). */
function tangencyResiduals(g: Geometry): number[] {
  const chosen = pt(g.circle);
  if (!chosen) return [];
  const r = finite((g.circle as Json)?.r);
  if (r === null) return [];
  return (g.circles as unknown as Circle[]).map((c) => {
    const d = dist(chosen, c);
    return Math.min(Math.abs(d - (r + c.r)), Math.abs(d - Math.abs(r - c.r)));
  });
}

/** Beecroft: the second four circles through the six points, touching in pairs. */
function beecroft(g: Geometry) {
  const second = g.second as unknown as (Circle | null)[];
  const p = g.points as unknown as Record<string, Point | null>;
  const pairs: Array<[Circle | null, Circle | null, Point | null]> = [
    [second[0], second[1], p.ABp], [second[0], second[2], p.BCp], [second[0], second[3], p.CAp],
    [second[1], second[2], p.BKp], [second[2], second[3], p.CKp], [second[3], second[1], p.AKp],
  ];
  let shared = true, tangent = true;
  for (const [u, v, at] of pairs) {
    if (!u || !v || !at) { shared = false; tangent = false; continue; }
    if (!near(dist(u, at), u.r) || !near(dist(v, at), v.r)) shared = false;
    const d = dist(u, v);
    if (!near(d, u.r + v.r) && !near(d, Math.abs(u.r - v.r))) tangent = false;
  }
  return { pairs: pairs.length, sharedTouchingPoints: shared, mutuallyTangent: tangent };
}

export function actions(): GameActions {
  return {
    compare_families: {
      describe:
        "For three mutually tangent circles given by their centres A, B and C on the 480x320 board (or the opening figure if omitted), solve Apollonius' problem twice: report the small inner fourth circle and the enclosing outer fourth circle, each with its centre, radius and tangency residuals, plus Beecroft's second family of four circles through the six shared points. Also solve the page's a=x+y, b=y+z, c=z+x system for the contact lengths x, y, z and show that its answer is unique (determinant 2, x=rb, y=rc, z=ra). Omitting all arguments uses the applet's starting centres.",
      args: '{ "A": { "x": 242.13, "y": 96.03 }, "B": { "x": 198.17, "y": 208.44 }, "C": { "x": 302.72, "y": 147.29 } }',
      run: (args) => {
        const C = core();
        const base = readConfig(args);
        const inner = C.geometry(C.setFamily(base, true));
        const outer = C.geometry(C.setFamily(base, false));
        const sides = inner.sides as { a: number; b: number; c: number };
        const radii = inner.radii as { a: number; b: number; c: number };
        const a = sides.a, b = sides.b, c = sides.c;
        const x = (a + c - b) / 2;
        const y = (a + b - c) / 2;
        const z = (b + c - a) / 2;
        const familyView = (g: Geometry) => ({
          valid: g.valid === true,
          fourthCircle: circle(g.circle),
          tangencyResiduals: tangencyResiduals(g).map((v) => finite(v)),
          touchesAllThree: tangencyResiduals(g).every((v) => near(v, 0)),
          secondFamily: (g.second as unknown as Circle[]).map(circle),
          beecroft: beecroft(g),
        });
        return {
          A: pt(inner.A), B: pt(inner.B), C: pt(inner.C),
          sides: { a: finite(a), b: finite(b), c: finite(c) },
          radii: { ra: finite(radii.a), rb: finite(radii.b), rc: finite(radii.c) },
          contactLengths: {
            x: finite(x), y: finite(y), z: finite(z),
            equations: { a: finite(x + y), b: finite(y + z), c: finite(z + x) },
            matchingRadii: near(x, radii.b) && near(y, radii.c) && near(z, radii.a),
            determinant: 2,
            unique: true,
          },
          inner: familyView(inner),
          outer: familyView(outer),
          note:
            "The three radii are forced by the side lengths, so the circles touch: a=rb+rc, b=rc+ra, c=ra+rb. " +
            "The system a=x+y, b=y+z, c=z+x has coefficient determinant 2, so its solution is unique and equals (rb, rc, ra). " +
            "Apollonius' quadratic gives two fourth circles - the small one in the gap and the enclosing one - and in both families the second four circles pass through the same six touching points.",
        };
      },
    },
    radical_centre: {
      describe:
        "For the same three circles, report the radical centre and check the page's incircle claims: that it equals the incenter (a*A+b*B+c*C)/(a+b+c) of the triangle of centres, that the three powers d(O,A)^2-ra^2 etc. are equal and give the incircle radius squared, and that the incircle passes through the three touching points and meets each circle at right angles. Omit A, B and C for the opening figure.",
      args: '{ "A": { "x": 242.13, "y": 96.03 }, "B": { "x": 198.17, "y": 208.44 }, "C": { "x": 302.72, "y": 147.29 } }',
      run: (args) => {
        const C = core();
        const g = C.geometry(readConfig(args));
        const sides = g.sides as { a: number; b: number; c: number };
        const radii = g.radii as { a: number; b: number; c: number };
        const P = pt(g.radicalCenter);
        const per = sides.a + sides.b + sides.c;
        const incenter = {
          x: (sides.a * g.A.x + sides.b * g.B.x + sides.c * g.C.x) / per,
          y: (sides.a * g.A.y + sides.b * g.B.y + sides.c * g.C.y) / per,
        };
        const inc = circle(g.second[0]);
        const triples: Array<[Point, number, Point | null]> = [
          [g.A, radii.a, (g.points as Json).ABp as Point | null],
          [g.B, radii.b, (g.points as Json).BCp as Point | null],
          [g.C, radii.c, (g.points as Json).CAp as Point | null],
        ];
        const powers = triples.map(([o, r]) => dist(P as Point, o) ** 2 - r * r);
        const incircleRadius = finite(g.inradius);
        const throughTouchingPoints = inc
          ? triples.every(([, , t]) => !!t && pt(t) !== null && near(dist(inc, t as Point), inc.r))
          : false;
        const orthogonal = inc
          ? triples.every(([o, r]) => {
            const d = dist(inc, o);
            return near(d * d, inc.r * inc.r + r * r);
          })
          : false;
        return {
          valid: g.valid === true,
          radicalCenter: P,
          incenter: pt(incenter),
          isIncenter: nearPt(P, pt(incenter)),
          powers: powers.map((v) => finite(v)),
          powersEqual: powers.every((v) => near(v, powers[0])),
          incircle: inc,
          incircleRadius,
          incircleRadiusMatchesInradius: inc ? near(inc.r, g.inradius) : false,
          powersEqualIncircleRadiusSquared: inc ? powers.every((v) => near(v, inc.r * inc.r)) : false,
          throughTouchingPoints,
          orthogonalToAllThree: orthogonal,
          note:
            "The radical centre has equal power with respect to all three circles, and the core places it at the incenter of the triangle of centres. " +
            "That common power equals the incircle radius squared, so the incircle passes through the three touching points and cuts each original circle at a right angle. " +
            (g.valid !== true
              ? "These centres are collinear or otherwise degenerate, so no finite figure is drawn."
              : "The residual fields above are how far each measured equality is from holding."),
        };
      },
    },
  };
}

/** Track.state saved three centre points and the inner/outer choice; rebuild the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Coxeter Tangent Circles state version ${stateVersion}`);
  }
  const C = core();
  const saved = C.position(C.start({
    A: state.A === undefined || state.A === null ? undefined : readPoint(state.A, "state.A"),
    B: state.B === undefined || state.B === null ? undefined : readPoint(state.B, "state.B"),
    C: state.C === undefined || state.C === null ? undefined : readPoint(state.C, "state.C"),
    innerCircle: state.innerCircle === false ? false : true,
  })) as unknown as { A: Point; B: Point; C: Point; innerCircle: boolean };
  const g = C.geometry(C.start(saved));
  const sides = g.sides as { a: number; b: number; c: number };
  const radii = g.radii as { a: number; b: number; c: number };
  return {
    stateVersion,
    A: saved.A, B: saved.B, C: saved.C, innerCircle: saved.innerCircle,
    valid: g.valid === true,
    sides: { a: finite(sides.a), b: finite(sides.b), c: finite(sides.c) },
    radii: { ra: finite(radii.a), rb: finite(radii.b), rc: finite(radii.c) },
    fourthCircle: circle(g.circle),
    radicalCenter: pt(g.radicalCenter),
    inradius: finite(g.inradius),
    tangencyResiduals: tangencyResiduals(g).map((v) => finite(v)),
    secondFamily: (g.second as unknown as Circle[]).map(circle),
    beecroft: beecroft(g),
    note:
      `Track.state saved the three centres and the ${saved.innerCircle ? "inner" : "outer"} family on the 480x320 board. ` +
      "The core rebuilds the radii from the side lengths, solves Apollonius' problem for the fourth circle and draws Beecroft's second family through the six touching points. " +
      (g.valid === true
        ? "The picture can be drawn for these centres."
        : "These centres make a degenerate figure, so no circles are drawn."),
  };
}
