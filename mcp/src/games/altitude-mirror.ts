/*
 * run_game_logic actions and saved-position reader for Altitude Mirror.
 * The core lives in altitude-mirror/ and is copied into src/generated/cores/
 * at build time. Every number below comes from the real AltitudeMirrorCore;
 * see _shared.ts for the module shape.
 *
 * The core works in the page's 360 x 240 SVG board coordinates. A position is
 * four points (A, B, C and P) plus three checkbox flags. AH is the altitude
 * from A to BC; P is glided onto the altitude line with the core's own
 * clampPoint, just as dragging P does on the page.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["altitude-mirror"].AltitudeMirrorCore;

type Pt = { x: number; y: number };
/** Angle errors are in radians; lengths are scaled to the drawing by the core. */
const TOL = 1e-6;
const round = (v: number, digits = 6): number | null =>
  Number.isFinite(v) ? Math.round(v * 10 ** digits) / 10 ** digits : null;
const deg = (r: number): number | null => round((r * 180) / Math.PI, 4);
const xy = (p: Pt | null): [number, number] | null => (p ? [round(p.x)!, round(p.y)!] : null);

/** Accept either [x, y] or { x, y }, as used by examples and saved states. */
function point(value: unknown, key: string, fallback?: Pt): Pt {
  if (value === undefined || value === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${key}"`);
  }
  let p: { x: unknown; y: unknown };
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${key}" must be [x, y] or { x, y }`);
    p = { x: value[0], y: value[1] };
  } else if (typeof value === "object") {
    p = value as { x: unknown; y: unknown };
  } else {
    throw new Error(`"${key}" must be [x, y] or { x, y }`);
  }
  const x = Number(p.x), y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${key}" needs finite x and y coordinates`);
  return { x, y };
}

/** Reject coincident or collinear vertices: then the intersections degenerate. */
function triangle(args: Json, defaults: { A: Pt; B: Pt; C: Pt }): { A: Pt; B: Pt; C: Pt } {
  const A = point(args.A, "A", defaults.A), B = point(args.B, "B", defaults.B), Cc = point(args.C, "C", defaults.C);
  const cross = (B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x);
  if (Math.abs(cross) < TOL) throw new Error("A, B and C must form a non-degenerate triangle");
  return { A, B, C: Cc };
}

/** Everything the construction says about one chosen triangle and point P. */
function analyse(C: ReturnType<typeof core>, A: Pt, B: Pt, Cc: Pt, P: Pt) {
  const s = { ...C.start(), A, B, C: Cc, P: C.clampPoint({ ...C.start(), A, B, C: Cc }, "P", P) as Pt };
  const f = C.compute(s) as Record<string, Pt | null>;
  const a = C.angles(f) as { bhe: number; chd: number; dha: number; ahe: number; hbhe: number; hchd: number; dhah: number; ehah: number } | null;
  const e = C.errors(f) as { ray: number; bisector: number; lines: number; afag: number; afFormula: number; agFormula: number } | null;
  const O = C.orthocenter(s) as Pt;
  const orthic = C.orthic(s) as { H: Pt; D: Pt; E: Pt };
  const hBetween = Boolean(C.hBetween(f));
  const AF = f.F ? C.dist(A, f.F) as number : NaN;
  const AG = f.G ? C.dist(A, f.G) as number : NaN;
  const near = (u: Pt | null, v: Pt | null) => (u && v ? C.dist(u, v) as number < TOL : false);

  return {
    triangle: { A: xy(A), B: xy(B), C: xy(Cc) },
    P: xy(s.P),
    altitudeFootH: xy(f.H),
    // D is on AC (line BP); E is on AB (line CP): the two mirror rays from H.
    construction: {
      D_on_AC_from_BP: xy(f.D),
      E_on_AB_from_CP: xy(f.E),
      F_on_parallel_from_HE: xy(f.F),
      G_on_parallel_from_HD: xy(f.G),
    },
    anglesDeg: a ? {
      BHE: deg(a.bhe), CHD: deg(a.chd), DHA: deg(a.dha), AHE: deg(a.ahe),
      lineBHE: deg(a.hbhe), lineCHD: deg(a.hchd),
      lineDHA: deg(a.dhah), lineEHA: deg(a.ehah),
    } : null,
    mirror: {
      HBetweenBAndC: hBetween,
      rayAnglesEqual: e ? e.ray < TOL : null,
      ahBisectsDHE: e ? e.bisector < TOL : null,
      reflectedLinesEqual: e ? e.lines < TOL : null,
      AF: round(AF, 4), AG: round(AG, 4),
      AFequalsAG: e ? e.afag < TOL : null,
      // Haruki's formulas AF = AE·BH/BE and AG = AD·CH/CD.
      afFormulaError: round(e ? e.afFormula : NaN),
      agFormulaError: round(e ? e.agFormula : NaN),
    },
    orthocenter: xy(O),
    PAtOrthocenter: near(s.P, O),
    // The feet of the three altitudes; with P = O, D and E land on these.
    orthicTriangle: {
      footFromA_H: xy(orthic.H),
      footFromB: xy(orthic.D),
      footFromC: xy(orthic.E),
    },
    status: C.describe(f) as string,
    note: hBetween
      ? "H lies between B and C: the page's angle claim applies, ∠BHE = ∠CHD, AH bisects ∠DHE, and AF = AG."
      : "H is outside BC (obtuse at B or C): the ray angles are supplementary rather than equal, so the page's angle claim does not apply. The mirror of the *lines* through H and AF = AG still hold.",
  };
}

export function actions(): GameActions {
  const C = core();
  const defaults = C.start() as { A: Pt; B: Pt; C: Pt; P: Pt };
  return {
    mirror_property: {
      describe:
        "For a triangle A, B, C with a point P on its altitude from A to BC (coordinates [x, y] in the page's 360 x 240 board; P is glided onto the altitude as dragging does on the page): the foot H, the intersections D on AC from BP and E on AB from CP, the hint points F and G on the parallel through A, the angles BHE, CHD, DHA and AHE in degrees, and the equal-length check AF = AG. The equal ray angles and the bisector claim hold only when H lies between B and C; for an obtuse triangle the rays are supplementary while the reflected lines and AF = AG still match.",
      args: '{ "A": [150, 80], "B": [90, 200], "C": [270, 200], "P": [150, 160] }',
      run: (args) => {
        const { A, B, C: Cc } = triangle(args, defaults);
        const P = point(args.P, "P", defaults.P);
        return analyse(C, A, B, Cc, P);
      },
    },
    orthic_from_orthocenter: {
      describe:
        "For a triangle A, B, C: the orthocenter O, the three feet of the altitudes (the orthic triangle), and the mirror construction with P placed exactly at O. At P = O the points D and E are those altitude feet from B and C, so DEH is the orthic triangle; report its side lengths and whether the construction really lands on the orthic feet.",
      args: '{ "A": [150, 80], "B": [90, 200], "C": [270, 200] }',
      run: (args) => {
        const { A, B, C: Cc } = triangle(args, defaults);
        const s = { ...C.start(), A, B, C: Cc, P: defaults.P };
        const O = C.orthocenter(s) as Pt;
        const reading = analyse(C, A, B, Cc, O);
        const feet = reading.orthicTriangle;
        const d = (p: [number, number] | null, q: [number, number] | null) =>
          p && q ? round(Math.hypot(p[0] - q[0], p[1] - q[1]), 4) : null;
        return {
          ...reading,
          orthicSides: {
            H_to_footFromB: d(feet.footFromA_H, feet.footFromB),
            H_to_footFromC: d(feet.footFromA_H, feet.footFromC),
            footFromB_to_footFromC: d(feet.footFromB, feet.footFromC),
          },
          constructionMatchesOrthicFeet:
            JSON.stringify(reading.construction.D_on_AC_from_BP) === JSON.stringify(feet.footFromB) &&
            JSON.stringify(reading.construction.E_on_AB_from_CP) === JSON.stringify(feet.footFromC),
          note: "When P is at the orthocenter the cevian intersections D and E are the feet of the altitudes from B and C, so H, D, E form the orthic triangle behind Fagnano's problem.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const defaults = C.start() as { A: Pt; B: Pt; C: Pt; P: Pt; showNames: boolean; showStatement: boolean; showHint: boolean };
  const { A, B, C: Cc } = triangle(state, defaults);
  const P = point(state.P, "P", defaults.P);
  return {
    ...analyse(C, A, B, Cc, P),
    stateVersion,
    showNames: state.showNames === true,
    showStatement: state.showStatement === true,
    showHint: state.showHint === true,
  };
}
