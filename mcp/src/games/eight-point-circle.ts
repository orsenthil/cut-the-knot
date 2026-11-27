/*
 * run_game_logic actions and saved-position reader for Eight Point Circle.
 *
 * The quadrilateral's diagonals AC and BD are kept perpendicular (dragging a
 * corner moves its opposite corner to keep AC vertical and BD horizontal).
 * Then PQRS, the midpoints of the four sides, is a rectangle: PR and QS are
 * equal diameters meeting at their common midpoint K, which is also the
 * centroid (A+B+C+D)/4. The feet E,F,G,H of the perpendiculars from those
 * midpoints to the opposite sides lie on the same circle as P,Q,R,S, and each
 * foot sees both diameters at a right angle. Skewing a diagonal destroys all
 * of that except K's being the centroid, which holds for any quadrilateral.
 *
 * Every number here is measured by the real core
 * eight-point-circle/eight-point-circle-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units in the page's
 * 400 x 250 viewBox, y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = { diagonals: boolean; labels: boolean; hint: boolean };
type State = { A: Pt; B: Pt; C: Pt; D: Pt; options: Options; explored: boolean };
type Claims = {
  orthogonal: boolean; rectangle: boolean; centroid: boolean; diameters: boolean;
  midpointsOnCircle: boolean; feetOnCircle: boolean; rightAngles: boolean;
  allEight: boolean;
};
type Measures = {
  centreError: number; diameterError: number; midError: number;
  footError: number; angleError: number;
};
type Geometry = {
  A: Pt; B: Pt; C: Pt; D: Pt;
  P: Pt; Q: Pt; R: Pt; S: Pt; E: Pt; F: Pt; G: Pt; H: Pt; K: Pt;
  radius: number; tol: number; claims: Claims; measures: Measures;
};
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  PAD: number;
  start(options?: Json): Json;
  move(state: Json, name: string, p: Pt): Json;
  compute(a: Pt, b: Pt, c: Pt, d: Pt): Geometry | null;
  geometry(state: Json): Geometry | null;
  describe(state: Json): string;
  dist(a: Pt, b: Pt): number;
  midpoint(a: Pt, b: Pt): Pt;
  result(state: Json): unknown;
};

const core = () => cores["eight-point-circle"].EightPointCircleCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const err = (v: number): number | null => (Number.isFinite(v) ? round(v, 9) : null);
const pt = (p: unknown): Pt | null => {
  if (!p || typeof p !== "object") return null;
  const q = p as Json;
  const x = Number(q.x), y = Number(q.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x: round(x), y: round(y) } : null;
};
const maybe = (p: unknown): Pt | null => pt(p);

/** A corner as the page saves it ({x, y}) or as a short [x, y]. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, dflt: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return dflt;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

function readOptions(value: unknown): Options {
  if (value === undefined || value === null) return { diagonals: false, labels: false, hint: false };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error('argument "options" must be an object');
  }
  const o = value as Json;
  return {
    diagonals: readBool(o, "diagonals", false),
    labels: readBool(o, "labels", false),
    hint: readBool(o, "hint", false),
  };
}

/**
 * A real core state. Supplied corners are applied as page drags, so the
 * opposite corner follows to keep AC vertical and BD horizontal; omitted
 * corners stay at the applet's opening positions.
 */
function buildState(args: Json, C: Core): State {
  let s = C.start({
    diagonals: readBool(args, "diagonals", false),
    labels: readBool(args, "labels", false),
    hint: readBool(args, "hint", false),
  }) as State;
  for (const name of ["A", "B", "C", "D"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.move(s, name, readPoint(v, name)) as State;
  }
  return s;
}

/** The whole construction, measured rather than assumed, in tutor-friendly units. */
function reading(C: Core, g: Geometry) {
  const midPR = C.midpoint(g.P, g.R), midQS = C.midpoint(g.Q, g.S);
  const centroid = {
    x: (g.A.x + g.B.x + g.C.x + g.D.x) / 4,
    y: (g.A.y + g.B.y + g.C.y + g.D.y) / 4,
  };
  const eight = {
    P: g.P, Q: g.Q, R: g.R, S: g.S, E: g.E, F: g.F, G: g.G, H: g.H,
  } as const;
  const radiusErrors = Object.fromEntries(
    Object.entries(eight).map(([name, p]) => [name, round(Math.abs(C.dist(g.K, p) - g.radius), 9)]),
  );
  return {
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    midpoints: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S) },
    feet: { E: pt(g.E), F: pt(g.F), G: pt(g.G), H: pt(g.H) },
    centre: {
      K: pt(g.K), centroid: pt(centroid),
      centroidError: err(g.measures.centreError),
    },
    circle: { centre: pt(g.K), radius: round(g.radius), radiusErrors },
    diameters: {
      PR: { midpoint: pt(midPR), length: round(C.dist(g.P, g.R)) },
      QS: { midpoint: pt(midQS), length: round(C.dist(g.Q, g.S)) },
      lengthError: err(g.measures.diameterError),
      bothThroughK: g.claims.diameters === true,
    },
    claims: {
      orthogonal: g.claims.orthogonal === true,
      rectangle: g.claims.rectangle === true,
      centroid: g.claims.centroid === true,
      diameters: g.claims.diameters === true,
      midpointsOnCircle: g.claims.midpointsOnCircle === true,
      feetOnCircle: g.claims.feetOnCircle === true,
      rightAngles: g.claims.rightAngles === true,
      allEight: g.claims.allEight === true,
    },
    measures: {
      centreError: err(g.measures.centreError),
      diameterError: err(g.measures.diameterError),
      midError: err(g.measures.midError),
      footError: err(g.measures.footError),
      angleError: err(g.measures.angleError),
    },
    tolerance: round(g.tol, 9),
  };
}

export function actions(): GameActions {
  return {
    eight_points: {
      describe:
        "Given four corners A, B, C, D (each [x, y] or { x, y }; omit any for the applet's opening picture), apply them as page drags so AC stays perpendicular to BD, then report the side midpoints P,Q,R,S, the perpendicular feet E,F,G,H, the centre K and radius of the one circle through all eight points, and every measured claim. PR and QS are equal diameters of the rectangle PQRS meeting at K = (A+B+C+D)/4, and each foot sees both diameters at a right angle; the three checkboxes diagonals, labels and hint may be set as booleans.",
      args: '{"A":[200,20],"B":[60,125],"C":[200,230],"D":[340,125]}',
      run: (args) => {
        const C = core();
        const s = buildState(args, C);
        const g = C.geometry(s);
        if (!g) {
          throw new Error("those four corners are degenerate: the core cannot draw the circle; move them apart");
        }
        const r = reading(C, g);
        return {
          ...r,
          options: s.options,
          explored: s.explored === true,
          note: r.claims.allEight
            ? `AC is perpendicular to BD, so PQRS is a rectangle: its diagonals PR and QS are both ${r.diameters.PR.length} units long and meet at their midpoint K = (${r.centre.K!.x}, ${r.centre.K!.y}), which is also the centroid (A+B+C+D)/4. The four midpoints and four feet are all ${r.circle.radius} units from K; every point of the circle sees PR and QS at a right angle.`
            : `The core could not confirm the eight-point circle here (midpoint error ${r.measures.midError}, foot error ${r.measures.footError}); move the corners apart so the four feet can be drawn.`,
        };
      },
    },

    skew_diagonals: {
      describe:
        "Take the same four corners and move D vertically by the given nonzero `skew` (default 40 board units), breaking the perpendicularity of AC and BD, and compare the real core's reading before and after. With skew diagonals PQRS is no longer a rectangle, PR and QS are not equal diameters, and the midpoints and feet leave the circle; K nevertheless remains the centroid of the four corners.",
      args: '{"A":[200,20],"B":[60,125],"C":[200,230],"D":[340,125],"skew":40}',
      run: (args) => {
        const C = core();
        const base = buildState(args, C);
        const skew = num(args, "skew", 40);
        if (skew === 0 || Math.abs(skew) > 100) {
          throw new Error('argument "skew" must be nonzero and at most 100 in absolute value');
        }
        const skewedD = { x: base.D.x, y: base.D.y + skew };
        const view = C.VIEW, pad = C.PAD;
        if (skewedD.y < view.y + pad || skewedD.y > view.y + view.height - pad) {
          throw new Error('argument "skew" moves D off the board; choose a smaller offset');
        }
        const honest = C.geometry(base);
        const broken = C.compute(base.A, base.B, base.C, skewedD);
        if (!honest || !broken) {
          throw new Error("those four corners are degenerate: the core cannot draw both pictures; move them apart");
        }
        const before = reading(C, honest), after = reading(C, broken);
        return {
          skew,
          D: pt(base.D), skewedD: pt(skewedD),
          honest: {
            claims: before.claims, centre: before.centre, circle: before.circle,
            diameters: before.diameters, measures: before.measures,
          },
          skewed: {
            claims: after.claims, centre: after.centre, circle: after.circle,
            diameters: after.diameters, measures: after.measures,
          },
          breaksTheTheorem: before.claims.allEight === true && after.claims.allEight !== true,
          note:
            "Moving D off the horizontal through B leaves K at the centroid (the bimedians PR and QS always bisect each other), but AC is no longer perpendicular to BD. PQRS stops being a rectangle, PR and QS differ in length, and the four feet no longer sit with the four midpoints on one circle: the eight-point circle needs perpendicular diagonals.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Eight Point Circle state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  try {
    s = {
      A: readPoint(src.A, "A"), B: readPoint(src.B, "B"),
      C: readPoint(src.C, "C"), D: readPoint(src.D, "D"),
      options: readOptions(src.options), explored: src.explored === true,
    };
  } catch {
    s = C.start({}) as State;
    savedReadable = false;
  }

  const g = C.compute(s.A, s.B, s.C, s.D);
  if (!g) {
    return {
      ...src, stateVersion, savedReadable, valid: false,
      note: "The saved four corners are degenerate; the core cannot draw the eight-point circle here.",
    };
  }
  const coreReading = reading(C, g);
  const savedPoints = {
    P: maybe(src.P), Q: maybe(src.Q), R: maybe(src.R), S: maybe(src.S),
    E: maybe(src.E), F: maybe(src.F), G: maybe(src.G), H: maybe(src.H),
    K: maybe(src.K),
  };
  const corePoints = {
    P: g.P, Q: g.Q, R: g.R, S: g.S, E: g.E, F: g.F, G: g.G, H: g.H, K: g.K,
  };
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: round(page), core: round(value), diff: round(Math.abs(page - value), 9) });
  };
  for (const key of Object.keys(corePoints) as Array<keyof typeof corePoints>) {
    const saved = savedPoints[key];
    if (saved) {
      compare(`${key}.x`, saved.x, corePoints[key].x);
      compare(`${key}.y`, saved.y, corePoints[key].y);
    }
  }
  const savedRadius = Number(src.radius);
  if (Number.isFinite(savedRadius)) compare("radius", savedRadius, g.radius);
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const savedClaims = src.claims && typeof src.claims === "object" && !Array.isArray(src.claims)
    ? src.claims as Json : {};
  const claimsAgree = Object.keys(savedClaims).every(
    (key) => savedClaims[key] === (coreReading.claims as unknown as Json)[key],
  );

  return {
    ...src,
    stateVersion,
    savedReadable,
    saved: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D),
      P: savedPoints.P, Q: savedPoints.Q, R: savedPoints.R, S: savedPoints.S,
      E: savedPoints.E, F: savedPoints.F, G: savedPoints.G, H: savedPoints.H,
      K: savedPoints.K,
      radius: Number.isFinite(savedRadius) ? round(savedRadius) : null,
      options: s.options, claims: savedClaims,
    },
    valid: true,
    centre: pt(g.K),
    radius: round(g.radius),
    allEight: coreReading.claims.allEight,
    orthogonal: coreReading.claims.orthogonal,
    diameters: coreReading.claims.diameters,
    midpointsOnCircle: coreReading.claims.midpointsOnCircle,
    feetOnCircle: coreReading.claims.feetOnCircle,
    core: coreReading,
    coreDescription: C.describe(s),
    savedMatchesCore,
    claimsAgree,
    differences,
    note: !savedReadable
      ? "The saved corners could not be read, so the applet's opening picture is shown instead; the core reading below comes from those opening corners."
      : coreReading.claims.allEight
        ? `Track.state saved the four corners, the eight constructed points, K, the radius, the options and the claims. The core rebuilds them from A,B,C,D: K = (${coreReading.centre.K!.x}, ${coreReading.centre.K!.y}) is both the centroid and the midpoint of PR and QS, which are equal diameters, and all four midpoints and four feet lie ${round(g.radius, 4)} units from it. This is an illustration rather than a game, so there is no win or loss.`
        : `The saved corners no longer make a perpendicular quadrilateral, so the midpoints and feet are not all on one circle; the core reading below measures how far PR and QS differ and how far the eight points are from the circle.`,
  };
}
