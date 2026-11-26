/*
 * run_game_logic actions and saved-position reader for Brianchon in Ellipse.
 *
 * An ellipse is a circle stretched by (A, B) and shifted to its centre. Six
 * touching points A..F on it have tangents that meet in six vertices of a
 * circumscribed hexagon, and the three lines joining opposite vertices,
 * AB-DE, BC-EF and CD-FA, always meet at one point S: Brianchon's theorem.
 * Every number below comes from the real core (brianchon-in-ellipse/), copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["brianchon-in-ellipse"].BrianchonCore;

type Pt = { x: number; y: number };
type State = { V: Pt[]; P: Pt[]; explored: boolean; names: boolean; view: { width: number; height: number } };
type Geometry = {
  ellipse: { center: Pt; A: number; B: number };
  vertices: Pt[];
  diagonals: { p: Pt; q: Pt }[];
  S: Pt | null;
};
type Claims = {
  geometry: Geometry;
  S: Pt | null;
  concurrent: boolean;
  tangentsTouch: boolean;
  verticesOnTangents: boolean;
  verticesFinite: boolean;
  tangentsFinite: boolean;
};

const POINT_NAMES = ["A", "B", "C", "D", "E", "F"];
const VERTEX_NAMES = ["AB", "BC", "CD", "DE", "EF", "FA"];
const DIAGONAL_NAMES = ["AB-DE", "BC-EF", "CD-FA"];

/** A core point, rounded for JSON; non-finite points (the Cramer NaN guard) become null. */
function pt(p: Pt | null | undefined): { x: number; y: number } | null {
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return { x: Number(p.x.toFixed(4)), y: Number(p.y.toFixed(4)) };
}

/** A saved {x, y} from Track.state, checked rather than trusted. */
function savedPt(v: unknown): Pt | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Pt;
  return Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
}

function readPoint(v: unknown, label: string): Pt {
  /* Actions describe points as [x, y]; Track.state saves them as {x, y}. */
  const x = Array.isArray(v) ? Number(v[0]) : Number((v as Pt | null)?.x);
  const y = Array.isArray(v) ? Number(v[1]) : Number((v as Pt | null)?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" needs a pair [x, y] or an object {x, y} of finite numbers`);
  return { x, y };
}

function readPoints(v: unknown, count: number, label: string): Pt[] {
  if (!Array.isArray(v) || v.length !== count) {
    throw new Error(`"${label}" must be exactly ${count} pairs [x, y]`);
  }
  return v.map((p, i) => readPoint(p, `${label}[${i}]`));
}

/**
 * Build the diagram the caller describes. V0..V3 are the rectangle corners in
 * the applet's order (V0/V1 bottom, V1/V2 right); P are the six touching
 * points, or angles in radians on the ellipse, or the applet's six start angles.
 */
function readState(args: Json): State {
  const C = core();
  const V = args.V === undefined
    ? (C.start({}).V as Pt[])
    : readPoints(args.V, 4, "V");
  if (args.P !== undefined) {
    return C.start({ V, P: readPoints(args.P, 6, "P"), explored: args.explored === true, names: args.names === true });
  }
  if (args.angles !== undefined) {
    const angles = numArray(args, "angles");
    if (angles.length !== 6) throw new Error('"angles" must be exactly 6 numbers (radians)');
    const e = C.ellipseFrom(V);
    const P = angles.map((t) => C.pointAt(e, t) as Pt);
    return C.start({ V, P, explored: args.explored === true, names: args.names === true });
  }
  return C.start({ V, explored: args.explored === true, names: args.names === true });
}

/** The diagram as the core measures it, safe to JSON-stringify. */
function reading(C: ReturnType<typeof core>, state: State) {
  const c = C.claims(state) as Claims;
  const g = c.geometry;
  return {
    ellipse: { center: pt(g.ellipse.center), A: Number(g.ellipse.A.toFixed(4)), B: Number(g.ellipse.B.toFixed(4)) },
    rectangle: state.V.map((p) => pt(p)),
    touchingPoints: state.P.map((p, i) => ({ name: POINT_NAMES[i], at: pt(p) })),
    vertices: g.vertices.map((p, i) => ({ name: VERTEX_NAMES[i], at: pt(p) })),
    diagonals: g.diagonals.map((d, i) => ({ name: DIAGONAL_NAMES[i], from: pt(d.p), to: pt(d.q) })),
    S: pt(c.S),
    concurrent: c.concurrent === true,
    tangentsTouch: c.tangentsTouch === true,
    verticesOnTangents: c.verticesOnTangents === true,
    verticesFinite: c.verticesFinite === true,
    tangentsFinite: c.tangentsFinite === true,
    nearParallel: c.S === null,
    status: C.describe(state) as string,
  };
}

export function actions(): GameActions {
  return {
    concurrent_diagonals: {
      describe:
        "Six touching points A..F on the ellipse fixed by rectangle corners V0..V3 (canvas coordinates, V0/V1 the lower edge) give six tangents and their six intersections AB..FA. Report the three main diagonals AB-DE, BC-EF and CD-FA, the point S where the first two meet, and whether S lies on the third: Brianchon's theorem. Pass V plus either P (six [x, y] pairs) or angles (six radians); omitting both uses the applet's six starting angles. Nearly parallel lines hit the Cramer |det| < 1 guard, which returns NaN, so S is null and the page asks you to move the points apart.",
      args:
        '{ "V": [[123, 210], [277, 210], [277, 90], [123, 90]], "P": [[144.522512, 108.391884], [211.376039, 90.658433], [267.305993, 120.855650], [239.608620, 201.453106], [188.623961, 209.341567], [144.522512, 191.608116]] }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const r = reading(C, state);
        /* The guard in GeoSDoub.Intersect, exercised through the real core. */
        const nearly = pt(C.intersect({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 1e-7 }, { x: 100, y: 2e-7 }) as Pt);
        const tilted = pt(C.intersect({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 100 }) as Pt);
        return {
          ...r,
          guard: {
            firesHere: r.nearParallel,
            rule: "GeoSDoub.Intersect returns NaN when |det| < 1; the first two diagonals then have no finite crossing S and the third cannot be tested.",
            nearlyParallelGivesNaN: nearly === null,
            tiltedLinesGiveFinitePoint: tilted !== null && tilted.x === 0 && tilted.y === 0,
          },
          note: r.concurrent
            ? `Brianchon's theorem holds here: the three diagonals of the hexagon circumscribed about this ellipse all pass through S at ${JSON.stringify(r.S)}.`
            : "This diagram is degenerate: some tangents do not meet or the first two diagonals are nearly parallel, so there is no finite S to test the third diagonal against.",
        };
      },
    },
    affine_invariance: {
      describe:
        "Start from six points on a circle (a rectangle with equal half-width and half-height), then apply the axis-aligned affine map (sx*x + tx, sy*y + ty) to every rectangle corner and touching point. The points land on a stretched circle — the ellipse — the three diagonals still concur, and the new Brianchon point S' is exactly the old S carried by the same map. An ellipse is a stretched circle, and Brianchon's theorem is affine-invariant. The core models ellipses in axis-aligned form, so this demo uses scaling and translation rather than a shear or rotation. Coincident touching points are degenerate and report a null S instead.",
      args: '{ "cx": 200, "cy": 150, "r": 80, "sx": 1.5, "sy": 0.7, "tx": 30, "ty": -20 }',
      run: (args) => {
        const C = core();
        const cx = num(args, "cx", 200), cy = num(args, "cy", 150);
        const r = num(args, "r", 80);
        const sx = num(args, "sx", 1.5), sy = num(args, "sy", 0.7);
        const tx = num(args, "tx", 30), ty = num(args, "ty", -20);
        if (!(r > 0)) throw new Error('"r" must be positive');
        if (!(sx > 0 && sy > 0)) throw new Error('"sx" and "sy" must be positive stretches');
        const circle: State = C.start({ V: [
          { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r },
          { x: cx + r, y: cy - r }, { x: cx - r, y: cy - r },
        ] });
        const map = (p: Pt): Pt => ({ x: tx + sx * p.x, y: ty + sy * p.y });
        const ellipse: State = C.start({ V: circle.V.map(map), P: circle.P.map(map) });
        const before = reading(C, circle), after = reading(C, ellipse);
        /* Compare the unrounded core points: the reading above rounds for display. */
        const S0 = (C.claims(circle) as Claims).S;
        const S1 = (C.claims(ellipse) as Claims).S;
        const expected = S0 ? map(S0) : null;
        const difference = S1 && expected
          ? Math.hypot(S1.x - expected.x, S1.y - expected.y)
          : null;
        const sMaps = difference !== null && difference < 1e-6;
        return {
          affine: { sx, sy, tx, ty },
          circle: { center: before.ellipse.center, radius: r, S: before.S, concurrent: before.concurrent },
          ellipse: { center: after.ellipse.center, A: after.ellipse.A, B: after.ellipse.B, S: after.S, concurrent: after.concurrent },
          mappedS: pt(expected),
          differenceFromMappedS: difference === null ? null : Number(difference.toExponential(3)),
          sMapsToMappedPosition: sMaps,
          note: before.concurrent && sMaps
            ? `The circle's six tangents give diagonals through S = ${JSON.stringify(before.S)}. After the affine map the ellipse's diagonals meet at S' = ${JSON.stringify(after.S)}, the same map applied to S. Incidence is preserved by affine maps, so Brianchon's theorem holds for every ellipse.`
            : "The circle or its image is degenerate here: the Cramer guard gives a null S, so there is no Brianchon point to compare. Choose distinct touching points.",
        };
      },
    },
  };
}

/** What the core says about the position saved by Track.state on the page. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Brianchon in Ellipse state version ${stateVersion}`);
  const C = core();
  let here: State = C.start({});
  try {
    here = C.start({
      V: readPoints(state.V, 4, "V"),
      P: readPoints(state.P, 6, "P"),
      explored: state.explored === true,
      names: state.names === true,
    });
  } catch { /* no usable saved diagram: fall back to the applet's start */ }
  const r = reading(C, here);
  const savedS = savedPt(state.S);
  const distance = savedS && r.S ? Math.hypot(savedS.x - r.S.x, savedS.y - r.S.y) : null;
  return {
    stateVersion,
    V: r.rectangle,
    P: r.touchingPoints,
    ellipse: r.ellipse,
    S: r.S,
    savedS: pt(savedS),
    SAgreesWithSaved: distance !== null && distance < 0.01,
    explored: here.explored,
    names: here.names,
    reading: {
      vertices: r.vertices,
      diagonals: r.diagonals,
      concurrent: r.concurrent,
      tangentsTouch: r.tangentsTouch,
      verticesOnTangents: r.verticesOnTangents,
      nearParallel: r.nearParallel,
      status: r.status,
    },
    note: r.concurrent
      ? "The saved six touching points lie on the saved ellipse; its circumscribed hexagon has all three main diagonals through S (Brianchon's theorem)."
      : "The saved diagram is degenerate or its points do not lie on the ellipse, so the tangent intersections cannot all be read; move the touching points apart.",
  };
}
