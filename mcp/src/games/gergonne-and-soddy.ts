/*
 * run_game_logic actions and saved-position reader for Gergonne and Soddy.
 *
 * The page saves only the three draggable corners and the four display buttons
 * with Track.state; the core rebuilds every other point from them. In the
 * incircle, A1/B1/C1 are the touch points on BC/CA/AB, and the cevians
 * AA1, BB1, CC1 meet at the Gergonne point Ge. The lines B1C1, C1A1, A1B1 cut
 * BC, CA, AB again in the three Nobbs points A2, B2, C2, which are collinear:
 * that line is the Gergonne line GL. The Soddy line SL is IGe, where I is the
 * incenter. In every non-degenerate triangle where I and Ge differ by at least
 * two board pixels (the applet's old guard), the core measures 90° between GL
 * and SL. I and Ge coincide exactly for an equilateral triangle; an isosceles
 * but non-equilateral triangle still has a Soddy line.
 *
 * Inverting in the incircle sends AB, BC, CA to circles with diameters IC1,
 * IA1, IB1, sends A1B1, B1C1, C1A1 to circles with diameters CI, AI, BI, fixes
 * SL (it goes through I) and sends GL to the circle with diameter IGe. Hence
 * GL is the polar of Ge in the incircle: its foot from I is S, and IS · IGe =
 * r². Angles are preserved, so the circle through I and the line through its
 * centre IGe meet at right angles, which inverts back to GL ⟂ SL.
 *
 * Every number below is measured by the real core in
 * gergonne-and-soddy/gergonne-and-soddy-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are the page's 500 x 500
 * board units, y downward. This is an illustration, so there is no win or
 * loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Line = { p: Pt; q: Pt };
type OptionKey = "names" | "premises" | "statement" | "inversion";
type State = {
  width: number; height: number; A: Pt; B: Pt; C: Pt;
} & Record<OptionKey, boolean>;
type Inversion = { key: string; kind: "circle" | "line"; c?: Pt; r?: number; line?: Line };
type Geometry = {
  valid: boolean; I: Pt; r: number;
  A1: Pt; B1: Pt; C1: Pt; A2: Pt; B2: Pt; C2: Pt; Ge: Pt; S: Pt | null;
  lines: Record<string, Line>;
  nobbsOrder: Pt[];
  angle: number | null;
  soddyDefined: boolean;
  marks: Pt[];
  inversions: Inversion[];
};
type Core = {
  WIDTH: number; HEIGHT: number; MARGIN: number;
  start(options?: Json): State;
  reset(state: State): State;
  setPoint(state: State, name: "A" | "B" | "C", p: Pt): State;
  setOption(state: State, key: string, on: boolean): State;
  position(state: State): Json;
  geometry(state: State): Geometry;
  nearest(p: Pt, a: Pt, b: Pt): Pt;
  intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt;
  incenter(a: Pt, b: Pt, c: Pt): Pt;
  line(a: Pt, b: Pt): Line;
  lineDistance(z: Pt, l: Line): number;
  invertLine(l: Line, i: Pt, r: number): Inversion;
};

const core = (): Core =>
  cores["gergonne-and-soddy"].GergonneAndSoddyCore as unknown as Core;

const OPTIONS = ["names", "premises", "statement", "inversion"] as const;
const TOL = 1e-6;          // board units for collinearity/concurrence
const ANGLE_TOL = 0.01;    // degrees; the page quotes 0.001° on a clean grid

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const fine = (p: Pt | null | undefined): p is Pt =>
  Boolean(p) && Number.isFinite(p!.x) && Number.isFinite(p!.y);
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const seg = (l: Line): [Pt | null, Pt | null] => [pt(l.p), pt(l.q)];

/** A corner as [x, y] or { x, y }, with finite board coordinates. */
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

/** The four checkboxes; omitted flags keep the proof view the page opens with. */
function readOption(args: Json, key: OptionKey, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** Real core state: supplied corners are page drags, omitted ones stay at the opening picture. */
function buildState(C: Core, raw: Json): State {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("arguments must be an object with A, B, C points and optional display flags");
  }
  let s = C.start({});
  for (const name of ["A", "B", "C"] as const) {
    const v = raw[name];
    if (v !== undefined && v !== null) s = C.setPoint(s, name, readPoint(v, name));
  }
  return {
    ...s,
    names: readOption(raw, "names", s.names),
    premises: readOption(raw, "premises", s.premises),
    statement: readOption(raw, "statement", s.statement),
    inversion: readOption(raw, "inversion", s.inversion),
  };
}

const collapsed = (C: Core, s: State) => ({
  valid: false,
  vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
  note:
    `The core cannot draw the figure for these corners on its ${C.WIDTH} x ${C.HEIGHT} board: ` +
    "the triangle is degenerate, or a chord through two touch points is parallel to a side so a Nobbs point runs off to infinity. " +
    "Drag a corner away from that position and try again.",
});

/** The measured picture: points, lines, angle and the core's own comparisons. */
function reading(C: Core, s: State, g: Geometry) {
  const sides = [dist(s.B, s.C), dist(s.C, s.A), dist(s.A, s.B)];
  const scale = Math.max(...sides, 1);
  const iGe = dist(g.I, g.Ge);
  const nobbsMiss = Math.max(
    C.lineDistance(g.A2, C.line(g.B2, g.C2)),
    C.lineDistance(g.B2, C.line(g.C2, g.A2)),
    C.lineDistance(g.C2, C.line(g.A2, g.B2)),
  );
  const cevianMiss = Math.max(
    C.lineDistance(g.Ge, g.lines.AA),
    C.lineDistance(g.Ge, g.lines.BB),
    C.lineDistance(g.Ge, g.lines.CC),
  );
  return {
    board: { width: C.WIDTH, height: C.HEIGHT },
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    options: {
      names: s.names, premises: s.premises,
      statement: s.statement, inversion: s.inversion,
    },
    incircle: { center: pt(g.I), radius: round(g.r) },
    contactPoints: { A1: pt(g.A1), B1: pt(g.B1), C1: pt(g.C1) },
    gergonnePoint: pt(g.Ge),
    nobbsPoints: { A2: pt(g.A2), B2: pt(g.B2), C2: pt(g.C2) },
    gergonneLine: seg(g.lines.GL),
    soddyLine: g.soddyDefined ? [pt(g.I), pt(g.Ge)] : null,
    crossingS: pt(g.S),
    angleBetweenLines: g.angle === null ? null : round(g.angle),
    checks: {
      perpendicular: g.angle !== null && Math.abs(g.angle - 90) <= ANGLE_TOL,
      angleErrorDegrees: sig(g.angle === null ? null : Math.abs(g.angle - 90)),
      nobbsCollinear: nobbsMiss <= TOL,
      nobbsCollinearityError: sig(nobbsMiss),
      ceviansPassThroughGe: cevianMiss <= TOL,
      cevianConcurrencyError: sig(cevianMiss),
      soddyDefined: g.soddyDefined,
      iEqualsGe: iGe <= TOL,
      iGeDistance: sig(iGe),
      equilateral: sides.every((len) => Math.abs(len - sides[0]) <= 1e-9 * scale),
      sideLengths: sides.map((len) => round(len)),
    },
    // A very small incircle means a thin triangle; the old construction then
    // loses digits, so the residuals above matter more than the rounded angle.
    conditioning: { incircleRadius: round(g.r) },
  };
}

/** GL as the polar of Ge: foot S, IS · IGe = r², and SL fixed by inversion. */
function polar(C: Core, g: Geometry) {
  const GL = g.lines.GL;
  const SL = g.soddyDefined ? g.lines.SL : null;
  const d = C.lineDistance(g.I, GL);
  const foot = C.nearest(g.I, GL.p, GL.q);
  const iGe = dist(g.I, g.Ge);
  const iS = g.S ? dist(g.I, g.S) : NaN;
  const r2 = g.r * g.r;
  const poleDistance = d > 1e-9 ? r2 / d : NaN;
  const poleErr = poleDistance - iGe;
  const productErr = iS * iGe - r2;
  const tol = 1e-4 * Math.max(1, r2, iGe * d, d * iGe);
  return {
    gergonneLine: seg(GL),
    distanceFromI: round(d),
    footOfPerpendicular: pt(foot),
    crossingS: pt(g.S),
    footMatchesS: sig(g.S ? dist(foot, g.S) : null),
    footOnSoddyLine: sig(SL ? C.lineDistance(foot, SL) : null),
    incircleRadiusSquared: round(r2),
    poleDistanceFromI: round(poleDistance),
    distanceIToGe: round(iGe),
    productIStimesIGe: round(iS * iGe),
    residuals: { poleDistanceMinusIGe: sig(poleErr), productMinusRadiusSquared: sig(productErr) },
    isPolarOfGe:
      Number.isFinite(poleErr) && Number.isFinite(productErr) &&
      Math.abs(poleErr) <= tol && Math.abs(productErr) <= tol &&
      Boolean(g.S && dist(foot, g.S) <= TOL),
    soddyLineFixedByInversion: SL ? C.lineDistance(g.I, SL) <= 0.1 : false,
  };
}

/** The seven image circles of the applet's inversion checkbox. */
function inversions(C: Core, s: State, g: Geometry) {
  const named: Record<string, Pt> = {
    I: g.I, A: s.A, B: s.B, C: s.C, A1: g.A1, B1: g.B1, C1: g.C1, Ge: g.Ge,
  };
  const diameters: Record<string, [string, string]> = {
    AB: ["I", "C1"], BC: ["I", "A1"], CA: ["I", "B1"],
    A1B1: ["C", "I"], B1C1: ["A", "I"], C1A1: ["B", "I"],
    GL: ["I", "Ge"],
  };
  return g.inversions.map((image) => {
    const pair = diameters[image.key];
    const ends = pair ? [named[pair[0]], named[pair[1]]] : null;
    if (image.kind === "circle" && ends && fine(image.c) && Number.isFinite(image.r!)) {
      const len = dist(ends[0], ends[1]);
      const centerErr = dist(image.c, midpoint(ends[0], ends[1]));
      const radiusErr = Math.abs(image.r! - len / 2);
      const tol = 1e-6 * Math.max(1, len);
      return {
        line: image.key, kind: "circle",
        center: pt(image.c), radius: round(image.r!),
        diameterEnds: [pt(ends[0]), pt(ends[1])],
        centerError: sig(centerErr), radiusError: sig(radiusErr),
        matchesDiameter: centerErr <= tol && radiusErr <= tol,
      };
    }
    return {
      line: image.key, kind: image.kind,
      fixedLine: image.line ? seg(image.line) : null,
      note: "This line passes within 0.1 of I, so the core keeps it as a line.",
    };
  });
}

const EXAMPLE_ARGS =
  '{"A":[378,333.3333333333333],"B":[277.77777777777777,166.66666666666666],' +
  '"C":[227.27272727272728,250],"premises":true,"inversion":true}';

export function actions(): GameActions {
  return {
    right_angle: {
      describe:
        "For triangle ABC on the applet's 500 x 500 board (each corner [x, y] or { x, y }, y down; omit any for the opening triangle), run the real core and report the incircle centre I, the touch points, the Gergonne point Ge, the three Nobbs points, the blue Gergonne line through them and the red Soddy line IGe. It measures the angle at their crossing S, checks that the Nobbs points are collinear and the cevians pass through Ge, and notes when I and Ge coincide. The four display flags names, premises, statement and inversion may be given as booleans.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.geometry(s);
        if (!g.valid) return collapsed(C, s);
        const r = reading(C, s, g);
        const c = r.checks;
        return {
          ...r,
          note:
            `The core puts I at (${r.incircle.center!.x}, ${r.incircle.center!.y}) and Ge at ` +
            `(${r.gergonnePoint!.x}, ${r.gergonnePoint!.y}), ${c.iGeDistance} board units apart, and the blue and red lines cross at ` +
            `${r.angleBetweenLines}°. The three Nobbs points lie on one line (worst miss ${c.nobbsCollinearityError}) and the three cevians meet at Ge (worst miss ${c.cevianConcurrencyError}). ` +
            (c.soddyDefined
              ? `The Soddy line is defined and meets the Gergonne line at ${c.perpendicular ? "a right angle" : "an angle that needs a better-conditioned triangle"}. `
              : "I and Ge are within the applet's two-pixel guard, so it draws no Soddy line. ") +
            "I and Ge coincide exactly for an equilateral triangle; an isosceles but non-equilateral triangle still has two distinct points. " +
            "This is an illustration, so there is no win or loss.",
        };
      },
    },

    inversion_polar: {
      describe:
        "For the same triangle (arguments as in right_angle), check the applet's inversion picture with the real core: AB, BC, CA invert to circles with diameters IC1, IA1, IB1; A1B1, B1C1, C1A1 invert to circles with diameters CI, AI, BI; the Soddy line through I stays a line; and the Gergonne line inverts to the circle with diameter IGe. It also checks the polar relation IS · IGe = r², with the foot of the perpendicular from I landing at S. Returns each image circle with its expected diameter and residuals.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.geometry(s);
        if (!g.valid) return collapsed(C, s);
        const p = polar(C, g);
        const images = inversions(C, s, g);
        return {
          vertices: reading(C, s, g).vertices,
          options: {
            names: s.names, premises: s.premises,
            statement: s.statement, inversion: s.inversion,
          },
          incircle: { center: pt(g.I), radius: round(g.r) },
          gergonnePoint: pt(g.Ge),
          images,
          polar: p,
          note:
            `Inverting in the incircle (radius ${round(g.r)}, centre I) sends the Gergonne line to the circle on diameter IGe: ` +
            `the pole of that line is Ge, since IS · IGe = ${p.productIStimesIGe} against r² = ${p.incircleRadiusSquared} ` +
            `(residual ${p.residuals.productMinusRadiusSquared}) and the foot from I is S (miss ${p.footMatchesS}). ` +
            `The Soddy line passes through I, so inversion fixes it; a line through the centre of a circle is perpendicular to it, ` +
            `and inverting back gives the right angle at S. All seven image circles are listed with their expected diameters. ` +
            "This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those same corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Gergonne and Soddy state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Gergonne and Soddy position must be an object");
  }
  const C = core();
  let s: State;
  let savedReadable = true;
  try {
    s = buildState(C, state);
  } catch {
    s = C.start({});
    savedReadable = false;
  }
  const savedCore = C.position(s);
  const saved = {
    A: pt(savedCore.A as Pt), B: pt(savedCore.B as Pt), C: pt(savedCore.C as Pt),
    names: s.names, premises: s.premises, statement: s.statement, inversion: s.inversion,
  };
  const g = C.geometry(s);
  if (!g.valid) {
    return {
      ...state, stateVersion, savedReadable, saved, valid: false, reading: null,
      note:
        (!savedReadable
          ? "Some saved fields could not be read, so the core reading below uses the opening triangle. "
          : "") +
        "The saved corners do not give a drawable figure (a chord is parallel to a side, or the triangle is degenerate), so the core draws no Gergonne or Soddy line here. Drag a corner and look again.",
    };
  }
  const r = reading(C, s, g);
  const p = polar(C, g);
  return {
    ...state,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    reading: r,
    polar: p,
    inversionImages: inversions(C, s, g).length,
    note:
      (!savedReadable
        ? "Some saved fields could not be read, so the core reading below comes from the applet's opening triangle. "
        : "Track.state saved three draggable corners and the four display flags; the core rebuilds the incircle, touch points, Gergonne point, Nobbs points and both lines from them. ") +
      `Here the Gergonne line and the Soddy line cross at ${r.angleBetweenLines}° ` +
      `${r.checks.perpendicular ? "— a right angle" : "(not a clean right angle; this triangle is thin)"}, ` +
      `and the Gergonne line is the polar of Ge in the incircle (IS · IGe = ${p.productIStimesIGe}, r² = ${p.incircleRadiusSquared}). ` +
      "I and Ge coincide only when the triangle is equilateral. This is an illustration, so there is no win or loss.",
  };
}
