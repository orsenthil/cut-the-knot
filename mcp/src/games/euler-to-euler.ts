/*
 * run_game_logic actions and saved-position reader for Iterations on Euler Lines.
 *
 * Drag the corners of ABC and its Euler line (through the centroid G, the
 * circumcentre O and the orthocentre H) meets the lines AB and AC at M and N.
 * The illustration claims that the Euler line of the new triangle AMN is
 * parallel to BC. The core repeats the applet's own arithmetic: perpendicular
 * bisectors for O, altitudes for H, and a line intersection in ax + by + c form
 * whose determinant must exceed one unit. It draws no Euler line at all when O
 * and H are less than half a unit apart, which is how a near-equilateral
 * triangle's missing Euler line is handled.
 *
 * Every number below is measured by the game's real core,
 * euler-to-euler/euler-to-euler-core.js, copied into src/generated/cores/ at
 * build time. Coordinates are board units in the page's SVG, y down; this is a
 * demonstration, so there is no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Triangle = { A: Pt; B: Pt; C: Pt };
type Line = { p1: Pt; p2: Pt };
type Centres = { G: Pt; O: Pt; H: Pt; line: Line | null; defined: boolean };
type Diagram = {
  A: Pt; B: Pt; C: Pt; M: Pt; N: Pt;
  first: Centres; second: Centres; mnFinite: boolean;
};
type Claims = {
  euler1: boolean; mnFinite: boolean; distinct: boolean;
  euler2: boolean; parallel: boolean; ready: boolean;
};
type Core = {
  INTERSECT_MIN?: number;
  EULER_MIN?: number;
  start(options?: Json): Triangle;
  withPoint(s: Triangle, name: string, p: Pt): Triangle;
  diagram(s: Triangle): Diagram;
  claims(s: Triangle): Claims;
  distance(p: Pt, q: Pt): number;
  cross(a: Pt, b: Pt, c: Pt): number;
  finite(p: Pt): boolean;
  result(s: Triangle): null;
};

const core = (): Core =>
  cores["euler-to-euler"].EulerToEulerCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Accept [x, y] or { x, y }: JSON example args use arrays, the page saves objects. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v) && v.length === 2) {
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`${label} must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} needs finite numeric x and y`);
  return { x, y };
}

/** A real core triangle; omitted corners keep the applet's opening picture. */
function readTriangle(C: Core, args: Json): Triangle {
  const home = C.start({});
  const t: Triangle = {
    A: args.A === undefined || args.A === null ? home.A : readPoint(args.A, "A"),
    B: args.B === undefined || args.B === null ? home.B : readPoint(args.B, "B"),
    C: args.C === undefined || args.C === null ? home.C : readPoint(args.C, "C"),
  };
  if (C.distance(t.A, t.B) < 1e-9 || C.distance(t.B, t.C) < 1e-9 || C.distance(t.C, t.A) < 1e-9) {
    throw new Error("A, B and C must be three different points");
  }
  if (Math.abs(C.cross(t.A, t.B, t.C)) < 1e-9) {
    throw new Error("A, B and C must not lie on one line");
  }
  return t;
}

/** Where a point sits along a side, as a fraction from the first endpoint. */
function fraction(p: Pt, from: Pt, to: Pt): number | null {
  const vx = to.x - from.x, vy = to.y - from.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return null;
  return ((p.x - from.x) * vx + (p.y - from.y) * vy) / len2;
}

/** The three centres and the Euler line of one of the two triangles. */
function centres(set: Centres) {
  return {
    G: pt(set.G), O: pt(set.O), H: pt(set.H),
    eulerLine: set.line ? { p1: pt(set.line.p1), p2: pt(set.line.p2) } : null,
    defined: set.defined === true,
  };
}

/** How near AMN's Euler line is to BC, straight from the core's own points. */
function parallelMeasure(d: Diagram) {
  const line = d.second.line;
  if (!d.second.defined || !line || !d.mnFinite) return null;
  const u = { x: line.p2.x - line.p1.x, y: line.p2.y - line.p1.y };
  const v = { x: d.C.x - d.B.x, y: d.C.y - d.B.y };
  const ul = Math.hypot(u.x, u.y), vl = Math.hypot(v.x, v.y);
  const cross = u.x * v.y - u.y * v.x;
  const sine = ul > 0 && vl > 0 ? cross / (ul * vl) : NaN;
  const cosine = ul > 0 && vl > 0 ? (u.x * v.x + u.y * v.y) / (ul * vl) : NaN;
  const angle = Number.isFinite(sine)
    ? (Math.asin(Math.min(1, Math.abs(sine))) * 180) / Math.PI
    : NaN;
  return {
    cross: sig(cross), sine: sig(sine), cosine: sig(cosine),
    angleDegrees: Number.isFinite(angle) ? round(angle, 4) : null,
  };
}

/** The whole construction, measured rather than assumed, in tutor-friendly units. */
function reading(C: Core, s: Triangle) {
  const d = C.diagram(s);
  const cl = C.claims(s);
  return {
    corners: { A: pt(d.A), B: pt(d.B), C: pt(d.C) },
    first: centres(d.first),
    crossings: {
      M: pt(d.M), N: pt(d.N),
      finite: d.mnFinite === true,
      distinct: cl.distinct === true,
      AM_over_AB: d.mnFinite ? sig(fraction(d.M, d.A, d.B)) : null,
      AN_over_AC: d.mnFinite ? sig(fraction(d.N, d.A, d.C)) : null,
    },
    second: {
      ...centres(d.second),
      parallelToBC: cl.parallel === true,
      parallel: parallelMeasure(d),
    },
    claims: {
      euler1: cl.euler1 === true,
      mnFinite: cl.mnFinite === true,
      distinct: cl.distinct === true,
      euler2: cl.euler2 === true,
      parallel: cl.parallel === true,
      ready: cl.ready === true,
    },
    ready: cl.ready === true,
    tolerance: { intersectMin: C.INTERSECT_MIN ?? 1, eulerMin: C.EULER_MIN ?? 0.5 },
  };
}

/** Explain the first failure that stops the applet from drawing the claim. */
function statusNote(r: ReturnType<typeof reading>): string {
  if (!r.first.defined) {
    return "ABC is too close to equilateral: its circumcentre and orthocentre are less than half a unit apart, so the applet draws no first Euler line. Drag a corner away from equilateral.";
  }
  if (!r.crossings.finite) {
    return "The first Euler line almost follows AB or AC, so the core's intersection determinant is too small: M or N is undefined. Move a corner to separate the lines.";
  }
  if (!r.crossings.distinct) {
    return "M or N falls on A in this symmetric triangle, so there is no new triangle AMN to measure.";
  }
  if (!r.second.defined) {
    return "Triangle AMN is too close to equilateral, so the applet draws no second Euler line. Move a corner of ABC to change M and N.";
  }
  if (!r.second.parallelToBC) {
    return `Both Euler lines are drawn, but the second is not parallel to BC here: the angle between them is ${r.second.parallel?.angleDegrees ?? "unknown"} degrees. Check the crossing points M and N above.`;
  }
  const M = r.crossings.M, N = r.crossings.N;
  return `The Euler line of ABC cuts AB at M = (${M!.x}, ${M!.y}) and AC at N = (${N!.x}, ${N!.y}). The Euler line of AMN has the same direction as BC: the sine of the angle between them is ${r.second.parallel?.sine ?? "unknown"}, so the illustration's claim holds here.`;
}

export function actions(): GameActions {
  return {
    euler_iteration: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or { x, y } in the page's board units, y down), run the real EulerToEuler core and report the centroid G, circumcentre O and orthocentre H of ABC, the Euler line through O and H, its crossings M with line AB and N with line AC, and the same centres and Euler line for the new triangle AMN. It reports M and N (with their fractions along AB and AC) and whether AMN's Euler line is parallel to BC, with the cross product, sine and angle between the two directions. Omit any corner to keep the applet's opening triangle; a near-equilateral triangle or an Euler line almost parallel to a side is reported, not thrown.",
      args: '{ "A": [97.69, 75.03], "B": [68.36, 221.91], "C": [331.64, 221.91] }',
      run: (args) => {
        const C = core();
        const s = readTriangle(C, args);
        const r = reading(C, s);
        return { ...r, outcome: C.result(s), note: statusNote(r) };
      },
    },

    check_parallel: {
      describe:
        "Check the illustration's claim that AMN's Euler line is parallel to BC for one triangle (A, B, C as [x, y] or { x, y }) or for several labelled triangles in a `triangles` array (1 to 8, each with an optional `label`). For every case the real core reports the Euler-line crossings M and N, whether both lines can be drawn, the sine, cosine and angle between AMN's Euler line and BC, and a boolean `claimHolds`. Cases where the applet draws no line or no distinct M, N are listed as `degenerate` rather than counted as failures; `allHold` is true when every non-degenerate case is parallel.",
      args: '{ "triangles": [ { "label": "fixture", "A": [97.69, 75.03], "B": [68.36, 221.91], "C": [331.64, 221.91] }, { "label": "slanted", "A": [110, 60], "B": [70, 220], "C": [330, 220] }, { "label": "near equilateral", "A": [200, 100], "B": [100, 273], "C": [300, 273] } ] }',
      run: (args) => {
        const C = core();
        let cases: Array<{ label: string; triangle: Triangle }>;
        if (Array.isArray(args.triangles)) {
          const list = args.triangles;
          if (list.length === 0 || list.length > 8) {
            throw new Error('argument "triangles" must contain between 1 and 8 triangles');
          }
          cases = list.map((v, i) => {
            if (!v || typeof v !== "object" || Array.isArray(v)) {
              throw new Error(`triangles[${i}] must be an object with A, B and C`);
            }
            const o = v as Json;
            const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : `triangle ${i + 1}`;
            return { label, triangle: readTriangle(C, o) };
          });
        } else {
          cases = [{ label: "triangle", triangle: readTriangle(C, args) }];
        }

        const results = cases.map(({ label, triangle }) => {
          const r = reading(C, triangle);
          return {
            label,
            vertices: r.corners,
            degenerate: !r.ready,
            crossings: { M: r.crossings.M, N: r.crossings.N, finite: r.crossings.finite },
            firstDefined: r.first.defined,
            secondDefined: r.second.defined,
            parallel: r.second.parallel,
            claimHolds: r.second.parallelToBC,
            note: statusNote(r),
          };
        });
        const allHold = results.every((r) => r.degenerate || r.claimHolds);
        return {
          allHold,
          cases: results,
          note: allHold
            ? "Every case where both Euler lines can be drawn and M, N are distinct has AMN's Euler line parallel to BC: the core's cross product of the two direction vectors vanishes to its tolerance. Triangles too close to equilateral, or whose Euler line runs almost along a side, are marked degenerate and skipped."
            : "At least one valid triangle fails the parallel check; inspect the sine and angle above and move the corners apart.",
        };
      },
    },
  };
}

/** The fields Track.state saved (A, B, C), plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Iterations on Euler Lines state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);
  let savedReadable = true;
  let s: Triangle;
  try {
    s = readTriangle(C, src);
  } catch {
    savedReadable = false;
    s = C.start({});
  }

  const r = reading(C, s);
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    valid: savedReadable && r.first.defined,
    ready: r.ready,
    reading: r,
    core: {
      M: r.crossings.M, N: r.crossings.N,
      firstEulerLine: r.first.eulerLine,
      secondEulerLine: r.second.eulerLine,
      parallelToBC: r.second.parallelToBC,
      parallel: r.second.parallel,
    },
    outcome: C.result(s),
    note: !savedReadable
      ? "The saved corners could not be read, so the applet's opening triangle is shown instead; the core reading below comes from those corners."
      : statusNote(r),
  };
}
