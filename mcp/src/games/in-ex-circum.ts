/*
 * run_game_logic actions and saved-position reader for In Ex Circum,
 * Bogomolny's InExCircum applet.
 *
 * The real core is in-ex-circum/in-ex-circum-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the page's 400 x 300 SVG, with y down.
 *
 * Drag the corners of ABC. The incenter I and the three excenters Ia, Ib, Ic
 * form the excentral triangle IaIbIc, whose orthic triangle is ABC and whose
 * orthocentre is I. Its nine-point circle is therefore the circumcircle of
 * ABC: it passes through the altitude feet A, B, C, the midpoints of the sides
 * of IaIbIc, and the Euler points Ma = (I + Ia)/2, Mb = (I + Ib)/2 and
 * Mc = (I + Ic)/2 -- exactly the halfway dots the applet draws. Each dot is
 * also the midpoint of the arc of the circumcircle that its segment crosses.
 *
 * This is an illustration, so there is no win or loss; the tracker records
 * exploration. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = { A: Pt; B: Pt; C: Pt };
type Sides = { a: number; b: number; c: number };
type Circle = { center: Pt; radius: number };
type Measurements = {
  A: Pt; B: Pt; C: Pt;
  sides: Sides;
  doubleArea: number;
  degenerate: boolean;
  I?: Pt;
  ex?: { Ia: Pt; Ib: Pt; Ic: Pt };
  mid?: { Ma: Pt; Mb: Pt; Mc: Pt };
  incircle?: Circle;
  excircles?: { Ia: Circle; Ib: Circle; Ic: Circle };
  circumcircle?: Circle;
  O?: Pt;
  R?: number;
  arc?: { Ma: Pt; Mb: Pt; Mc: Pt } | null;
};
type Claims = {
  onCircle: boolean;
  arcMidpoint: boolean;
  orthic: boolean;
  orthocenter: boolean;
  ninePoint: boolean;
};
type Core = {
  start(options?: Json): State;
  withPoint(s: State, name: string, p: Pt): State;
  distance(p: Pt, q: Pt): number;
  cross(p: Pt, q: Pt, r: Pt): number;
  midpoint(p: Pt, q: Pt): Pt;
  measurements(s: State): Measurements;
  claims(s: State): Claims;
  tolerance(s: State, m: Measurements): number;
  result(s: State): null;
};

const core = (): Core => cores["in-ex-circum"].InExCircumCore as unknown as Core;

const NO_GAME = "This is an illustration, so there is no win or loss; the tracker records exploration.";
const ORTHIC_NOTE =
  "ABC is the orthic triangle of the excentral triangle IaIbIc and I is that outer triangle's " +
  "orthocentre, so its nine-point circle is the circumcircle of ABC: the altitude feet A, B, C; " +
  "the midpoints of IaIbIc, IbIc, IcIa; and the Euler points Ma = (I + Ia)/2, Mb = (I + Ib)/2 and " +
  "Mc = (I + Ic)/2 all lie on one circle.";

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const sig = (v: number | null | undefined): number =>
  v === null || v === undefined || !Number.isFinite(v) ? NaN : Number(v.toExponential(3));
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const circ = (c: Circle | null | undefined): { center: Pt; radius: number } | null => {
  if (!c) return null;
  const center = pt(c.center);
  return center ? { center, radius: round(c.radius) } : null;
};

/** One coordinate: a finite number (or numeric string), never null/boolean. */
function coord(raw: unknown, label: string): number {
  if (raw === null || raw === undefined || typeof raw === "boolean" || typeof raw === "object") {
    throw new Error(`${label} needs finite numeric coordinates, got ${JSON.stringify(raw)}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} needs finite numeric coordinates, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** A point as the page saves it ({x, y}) or as a short [x, y] argument. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${label}": give [x, y] or { x, y }`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = coord(raw[0], label); y = coord(raw[1], label);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = coord(o.x, label); y = coord(o.y, label);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** Start at the applet's opening triangle and move any corners that are given. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with A, B, C corners as [x, y] or { x, y }");
  }
  let s = C.start({});
  for (const name of ["A", "B", "C"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) {
      s = C.withPoint(s, name, readPoint(raw, `argument "${name}"`, s[name]));
    }
  }
  return s;
}

type DistanceRow = { point: Pt | null; distanceFromO: number; residual: number; onCircle: boolean };
type Row = DistanceRow & { name: string };

/** One measurements() and one claims() call, shaped for the model. */
function reading(C: Core, s: State) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  const base = {
    m, cl,
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: { BC_a: round(m.sides.a), CA_b: round(m.sides.b), AB_c: round(m.sides.c) },
    doubleArea: round(m.doubleArea),
    degenerate: m.degenerate,
    result: C.result(s),
  };
  if (m.degenerate || !m.I || !m.ex || !m.mid || !m.O || m.R === undefined ||
      !m.circumcircle || !m.arc) {
    return { ...base, live: false as const };
  }

  const I = m.I, ex = m.ex, mid = m.mid, O = m.O, R = m.R, arc = m.arc;
  const tol = C.tolerance(s, m);
  const distanceReport = (point: Pt): DistanceRow => {
    const d = C.distance(O, point);
    return {
      point: pt(point),
      distanceFromO: round(d),
      residual: sig(d - R),
      onCircle: Math.abs(d - R) <= tol,
    };
  };

  const halfway = {
    Ma: { ...distanceReport(mid.Ma), arcMidpoint: pt(arc.Ma), arcResidual: sig(C.distance(mid.Ma, arc.Ma)) },
    Mb: { ...distanceReport(mid.Mb), arcMidpoint: pt(arc.Mb), arcResidual: sig(C.distance(mid.Mb, arc.Mb)) },
    Mc: { ...distanceReport(mid.Mc), arcMidpoint: pt(arc.Mc), arcResidual: sig(C.distance(mid.Mc, arc.Mc)) },
  };
  const arcMatches = ["Ma", "Mb", "Mc"] as const;
  const allArcsMatch = arcMatches.every((k) => C.distance(mid[k], arc[k]) <= tol);

  /* The nine points of the outer triangle that share this circle. */
  const nine: Row[] = [
    { name: "A (altitude foot from Ia)", ...distanceReport(s.A) },
    { name: "B (altitude foot from Ib)", ...distanceReport(s.B) },
    { name: "C (altitude foot from Ic)", ...distanceReport(s.C) },
    { name: "midpoint of IaIb", ...distanceReport(C.midpoint(ex.Ia, ex.Ib)) },
    { name: "midpoint of IbIc", ...distanceReport(C.midpoint(ex.Ib, ex.Ic)) },
    { name: "midpoint of IcIa", ...distanceReport(C.midpoint(ex.Ic, ex.Ia)) },
    { name: "Ma (Euler point from Ia)", ...distanceReport(mid.Ma) },
    { name: "Mb (Euler point from Ib)", ...distanceReport(mid.Mb) },
    { name: "Mc (Euler point from Ic)", ...distanceReport(mid.Mc) },
  ];

  return {
    ...base,
    live: true as const,
    tolerance: sig(tol),
    centers: {
      I: pt(I),
      excenters: { Ia: pt(ex.Ia), Ib: pt(ex.Ib), Ic: pt(ex.Ic) },
      circumcenterO: pt(O),
    },
    circumcircle: circ(m.circumcircle)!,
    incircle: circ(m.incircle),
    excircles: {
      Ia: circ(m.excircles?.Ia), Ib: circ(m.excircles?.Ib), Ic: circ(m.excircles?.Ic),
    },
    halfwayPoints: { Ma: pt(mid.Ma), Mb: pt(mid.Mb), Mc: pt(mid.Mc) },
    arcMidpoints: { Ma: pt(arc.Ma), Mb: pt(arc.Mb), Mc: pt(arc.Mc) },
    onCircumcircle: {
      Ma: halfway.Ma, Mb: halfway.Mb, Mc: halfway.Mc,
      all: halfway.Ma.onCircle && halfway.Mb.onCircle && halfway.Mc.onCircle,
    },
    arcMidpointMatch: { ...halfway, all: allArcsMatch },
    ninePointCircle: nine,
    claims: cl,
  };
}

type LiveReading = Extract<ReturnType<typeof reading>, { live: true }>;

/** Require a triangle the applet can actually draw and check. */
function live(C: Core, args: Json) {
  const s = buildState(C, args);
  const r = reading(C, s);
  if (!r.live) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners ([x, y] or { x, y }) on the " +
      "page's 400 x 300 board: the core draws nothing and cannot meet the bisectors for a flat " +
      "or collapsed triangle. Move a corner apart.",
    );
  }
  return { s, r };
}

const show = (p: Pt | null): string => (p ? `(${p.x}, ${p.y})` : "—");

function constructionNote(r: LiveReading): string {
  const c = r.circumcircle;
  const h = r.onCircumcircle;
  return (
    `The core puts the incenter at I = ${show(r.centers.I)} and the excenters at ` +
    `Ia = ${show(r.centers.excenters.Ia)}, Ib = ${show(r.centers.excenters.Ib)} and ` +
    `Ic = ${show(r.centers.excenters.Ic)}. The circumcircle has centre ` +
    `${show(c.center)} and radius R = ${c.radius}. The halfway dots are ` +
    `Ma = ${show(h.Ma.point)}, Mb = ${show(h.Mb.point)} and Mc = ${show(h.Mc.point)}; ` +
    `their distances from O are ${h.Ma.distanceFromO}, ${h.Mb.distanceFromO} and ` +
    `${h.Mc.distanceFromO}, all equal to R (residuals ` +
    `${h.Ma.residual}, ${h.Mb.residual}, ${h.Mc.residual}). ${ORTHIC_NOTE} ` +
    "Each dot is also the midpoint of the arc its segment crosses, constructed here a second way " +
    `from the circle and the angle bisector. ${NO_GAME}`
  );
}

function claimsNote(r: LiveReading): string {
  const cl = r.claims;
  const verdicts = Object.entries(cl).map(([k, v]) => `${k} = ${v}`).join(", ");
  const worstNine = Math.max(...r.ninePointCircle.map((row) => Math.abs(Number(row.residual))));
  return (
    `The core's five claim verdicts are: ${verdicts}, at relative tolerance ${r.tolerance}. ` +
    `The three halfway dots are ${r.onCircumcircle.all ? "all" : "not all"} on the circumcircle ` +
    `and ${r.arcMidpointMatch.all ? "match" : "do not match"} the independently constructed arc ` +
    `midpoints. All nine points (the altitude feet A, B, C, the three excentral side midpoints and ` +
    `the three Euler points) lie on one circle; the largest distance residual from O is ` +
    `${sig(worstNine)} drawing units. ${ORTHIC_NOTE} ${NO_GAME}`
  );
}

/** A scalene triangle on the page's 400 x 300 board, used as the example args. */
const EXAMPLE_ARGS = '{"A":[120,235],"B":[320,215],"C":[175,75]}';

export function actions(): GameActions {
  return {
    midpoints_on_circumcircle: {
      describe:
        "For a triangle ABC (corners as [x, y] or { x, y } in the page's 400 x 300 board, y down; omit a corner for the opening picture), run the real core and report the incenter I, the three excenters Ia, Ib, Ic, the circumcircle (centre O and radius R), and the halfway dots Ma = (I+Ia)/2, Mb = (I+Ib)/2, Mc = (I+Ic)/2. Each dot's distance from O is checked against R, and compared with the arc midpoint found independently from the circle and the angle bisector; the incircle and three excircles are also given. Explains why ABC is the orthic triangle of the excentral triangle, so their common nine-point circle is the circumcircle of ABC. A flat or collapsed triangle is refused. This is an illustration with no win or loss.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const { r } = live(C, args);
        return { ...r, note: constructionNote(r) };
      },
    },

    check_claims: {
      describe:
        "For the same triangle (arguments as in midpoints_on_circumcircle), tabulate the five claims the core verifies: the halfway dots on the circumcircle, each dot at the midpoint of the arc its segment crosses, ABC the orthic triangle of the excentral triangle, I the orthocentre of that outer triangle, and the nine points on one circle. Also lists all nine points (A, B, C, the midpoints of IaIbIc and Ma, Mb, Mc) with their distance from O and residual, at the core's relative tolerance. Explains that ABC is the outer triangle's orthic triangle, so its nine-point circle is the circumcircle of ABC. A flat or collapsed triangle is refused.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const { r } = live(C, args);
        return {
          triangle: r.triangle,
          sides: r.sides,
          circumcircle: r.circumcircle,
          halfwayPoints: r.onCircumcircle,
          arcMidpointMatch: r.arcMidpointMatch,
          ninePointCircle: r.ninePointCircle,
          claims: r.claims,
          tolerance: r.tolerance,
          allClaimsHold: Object.values(r.claims).every(Boolean),
          note: claimsNote(r),
        };
      },
    },
  };
}

/** Echo the fields Track.state saved (the three draggable corners), then re-measure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported In Ex Circum state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved In Ex Circum position must be an object");
  }
  const src = state as Json;
  const C = core();
  let savedReadable = true;
  let s: State;
  try {
    const seed = C.start({});
    s = {
      A: readPoint(src.A, "saved A", seed.A),
      B: readPoint(src.B, "saved B", seed.B),
      C: readPoint(src.C, "saved C", seed.C),
    };
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const saved = { A: pt(s.A), B: pt(s.B), C: pt(s.C) };
  const r = reading(C, s);
  if (!r.live) {
    return {
      ...src,
      stateVersion,
      savedReadable,
      saved,
      valid: false,
      drawingPossible: false,
      isIllustration: true,
      note:
        (!savedReadable
          ? "Some saved corners could not be read, so the applet's opening triangle is shown. "
          : "Track.state saved only the three draggable corners A, B and C in the page's 400 x 300 board; derived points are not saved. ") +
        "Here the corners are collinear, coincident or too close, so the core cannot meet the " +
        "bisectors or draw the circles. " + NO_GAME,
    };
  }
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    drawingPossible: true,
    isIllustration: true,
    triangle: r.triangle,
    sides: r.sides,
    centers: r.centers,
    circumcircle: r.circumcircle,
    halfwayPoints: r.onCircumcircle,
    arcMidpointMatch: r.arcMidpointMatch,
    ninePointCircle: r.ninePointCircle,
    claims: r.claims,
    result: r.result,
    note:
      (!savedReadable
        ? "Some saved corners could not be read, so the applet's opening triangle was reconstructed; the reading below is from those opening corners. "
        : "Track.state saved only the three draggable corners A, B and C in board units (no derived points); the page uses the default 400 x 300 board. ") +
      `The core rebuilds the incenter, the three excenters and the circumcircle from those corners: ` +
      `O = ${show(r.circumcircle.center)} and R = ${r.circumcircle.radius}. ` +
      `The halfway dots Ma, Mb, Mc are at distances ${r.onCircumcircle.Ma.distanceFromO}, ` +
      `${r.onCircumcircle.Mb.distanceFromO} and ${r.onCircumcircle.Mc.distanceFromO} from O, all equal ` +
      `to R (residuals ${r.onCircumcircle.Ma.residual}, ${r.onCircumcircle.Mb.residual}, ` +
      `${r.onCircumcircle.Mc.residual}); it also constructs the arc midpoints independently. The five ` +
      `claim verdicts are ${Object.entries(r.claims).map(([k, v]) => `${k} = ${v}`).join(", ")}. ` +
      ORTHIC_NOTE + " " + NO_GAME,
  };
}
