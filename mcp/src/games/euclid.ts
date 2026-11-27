/*
 * run_game_logic actions and saved-position reader for Euclid's proof of the
 * Pythagorean theorem (Bogomolny's "euclid" applet).
 *
 * The real core is euclid/euclid-core.js, copied into src/generated/cores/ at
 * build time. A fixed right triangle has legs a = 90 (short, tr0-tr1) and
 * b = 180 (long, tr0-tr2), hypotenuse c = sqrt(a² + b²) at tr1-tr2. The moving
 * corner m makes a triangle on the hypotenuse; two affine maps built about the
 * far ends of the legs (a reflection scaled by cos θ and a rotation scaled by
 * sin θ, θ = pi/6 - 0.06) build triangles on the legs. All three are similar
 * copies of the same shape, so their areas are l·a², l·b² and l·c² for one
 * common factor l, giving l·a² + l·b² = l·c² — Euclid's proof. The applet
 * rounds each constructed vertex to whole pixels, rounds each Heron area with
 * (int)(area + 0.5) and, as a leftover quirk, adds 45 when the displayed short
 * area ends in 5. The two suggestive views (corner and fold) happen to add up;
 * most other positions do not. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type EuclidState = { mouse: Pt };
type Areas = { long: number; short: number; hyp: number };
type Figure = {
  mouse: Pt;
  long: Pt;
  short: Pt;
  areas: Areas;
  shown: Areas;
  full: boolean;
};
type Ideal = { mouse: Pt; long: Pt; short: Pt; areas: Areas };

interface EuclidCore {
  APPLET: { width: number; height: number; mouseStep: number };
  CORNER: Pt;
  TRIANGLE: Pt[];
  PRESETS: { corner: Pt; fold: Pt };
  THETA: number;
  S: number;
  C: number;
  javaInt(v: number): number;
  distance(a: Pt, b: Pt): number;
  start(): EuclidState;
  withMouse(state: EuclidState, x: number, y: number): EuclidState;
  preset(name: string): EuclidState;
  fullEyes(state: EuclidState): boolean;
  figure(state: EuclidState): Figure;
  ideal(state: EuclidState): Ideal;
}

const core = (): EuclidCore => cores["euclid"].EuclidCore as unknown as EuclidCore;

const round = (v: number, digits = 4): number =>
  Number.isFinite(v) ? Math.round(v * 10 ** digits) / 10 ** digits : NaN;
const pt = (p: Pt): Pt => ({ x: round(p.x, 2), y: round(p.y, 2) });
/** Relative comparison for the core's float noise (θ is only approximate). */
const near = (a: number, b: number, rel = 1e-3): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept the page's { x, y } and the tutor's [x, y] alike. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v !== null && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** The page clamps the handle to its 400 x 400 board; do the same to arguments. */
function onBoard(C: EuclidCore, p: Pt, label: string): Pt {
  if (p.x < 0 || p.x > C.APPLET.width || p.y < 0 || p.y > C.APPLET.height) {
    throw new Error(
      `${label} must lie on the ${C.APPLET.width} x ${C.APPLET.height} board ` +
      `(0 <= x <= ${C.APPLET.width}, 0 <= y <= ${C.APPLET.height})`
    );
  }
  return p;
}

/**
 * The page's state is just the moving corner, saved after the applet's own
 * snapping. Accept a preset name, explicit x/y, or a whole saved state.
 */
function buildState(C: EuclidCore, args: Json): EuclidState {
  if (args === null || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with a preset, x/y, or state");
  }
  if (args.preset !== undefined && args.preset !== null) {
    const name = String(args.preset);
    if (name !== "corner" && name !== "fold") {
      throw new Error('"preset" must be "corner" or "fold"');
    }
    return C.preset(name);
  }
  if (args.x !== undefined || args.y !== undefined) {
    const p = onBoard(C, readPoint([args.x, args.y], "x/y"), "x/y");
    return C.withMouse(C.start(), p.x, p.y);
  }
  if (args.state !== undefined && args.state !== null) {
    const s = args.state as Json;
    if (s.mouse === undefined || s.mouse === null) {
      throw new Error('"state" must contain a "mouse" point');
    }
    const p = onBoard(C, readPoint(s.mouse, "state.mouse"), "state.mouse");
    return C.withMouse(C.start(), p.x, p.y);
  }
  return C.preset("corner");
}

function viewName(C: EuclidCore, state: EuclidState): string {
  if (C.fullEyes(state)) return "corner";
  const fold = C.PRESETS.fold;
  if (state.mouse.x === fold.x && state.mouse.y === fold.y) return "fold";
  return "other";
}

/** The three areas and displayed integers for one position, from the core. */
function figureReading(C: EuclidCore, state: EuclidState) {
  const f = C.figure(state);
  // The quirk fires on the value *before* 45 is added; afterwards it ends in 0.
  const shortBeforeQuirk = C.javaInt(f.areas.short + 0.5);
  const quirkApplied = shortBeforeQuirk % 10 === 5;
  return {
    mouse: pt(f.mouse),
    view: viewName(C, state),
    eyesFull: f.full,
    constructed: { long: pt(f.long), short: pt(f.short) },
    areas: {
      long: round(f.areas.long),
      short: round(f.areas.short),
      hyp: round(f.areas.hyp),
    },
    roundedBeforeDisplay: {
      long: C.javaInt(f.areas.long + 0.5),
      short: shortBeforeQuirk,
      hyp: C.javaInt(f.areas.hyp + 0.5),
    },
    displayQuirk: {
      firesWhenShortEndsIn5: true,
      shortBeforeQuirk,
      added: quirkApplied ? 45 : 0,
      applied: quirkApplied,
    },
    shown: { long: f.shown.long, short: f.shown.short, hyp: f.shown.hyp },
    displayedSum: f.shown.long + f.shown.short,
    displayedSumMatchesHyp: f.shown.long + f.shown.short === f.shown.hyp,
  };
}

/** The similar-shape area law measured on the core's untruncated geometry. */
function lawReading(C: EuclidCore, state: EuclidState) {
  const g = C.ideal(state);
  const [t0, t1, t2] = C.TRIANGLE;
  const a = C.distance(t0, t1); // short leg
  const b = C.distance(t0, t2); // long leg
  const c = C.distance(t1, t2); // hypotenuse
  const l = g.areas.hyp / (c * c);
  const la2 = l * a * a;
  const lb2 = l * b * b;
  const lc2 = l * c * c;
  const legSumVsHyp = (g.areas.long + g.areas.short) - g.areas.hyp;
  return {
    sides: { a: round(a), b: round(b), c: round(c) },
    shapeFactorL: round(l, 6),
    lTimesA2: round(la2),
    lTimesB2: round(lb2),
    lTimesC2: round(lc2),
    idealAreas: {
      short: round(g.areas.short),
      long: round(g.areas.long),
      hyp: round(g.areas.hyp),
      legSum: round(g.areas.long + g.areas.short),
    },
    residuals: {
      shortMinusLA2: round(g.areas.short - la2),
      longMinusLB2: round(g.areas.long - lb2),
      legSumMinusHyp: round(legSumVsHyp),
    },
    // θ is the applet's near-miss of atan(a/b), so allow a small residual
    // measured against the hypotenuse triangle's area, not against zero.
    lawCheckToleranceRelative: 1e-3,
    lawHoldsWithinTolerance: Math.abs(legSumVsHyp) <= 1e-3 * Math.max(1, Math.abs(g.areas.hyp)),
    angle: {
      appletThetaDeg: round((C.THETA * 180) / Math.PI),
      trueAngleDeg: round((Math.atan2(a, b) * 180) / Math.PI),
      cosTheta: round(C.C, 6),
      sinTheta: round(C.S, 6),
      aOverC: round(a / c, 6),
      bOverC: round(b / c, 6),
    },
    constructedIdeal: { long: pt(g.long), short: pt(g.short) },
  };
}

export function actions(): GameActions {
  return {
    area_law_at_point: {
      describe:
        "At the moving corner of Euclid's proof, report the two vertices the core constructs on the legs, the three triangle areas by Heron, and the similar-shape law l·a² + l·b² = l·c² for the fixed right triangle (legs a = 90, b = 180, hypotenuse c): the leg triangles are similar copies scaled by sin θ and cos θ, so their ideal areas match l·a² and l·b² and add to the hypotenuse triangle's l·c². Also reports the applet's displayed integers, the rounding before them, whether the +45 quirk fired, and whether the displayed sum equals the hypotenuse number — it does at the corner and fold-in views but usually diverges. Give preset 'corner' or 'fold', or x/y coordinates, or a saved state; coordinates must lie on the 400 x 400 board and are snapped to steps of 2.",
      args: '{"preset":"corner"}',
      run: (args) => {
        const C = core();
        const state = buildState(C, args);
        const figure = figureReading(C, state);
        const law = lawReading(C, state);
        return {
          state: { mouse: pt(state.mouse) },
          figure,
          law,
          note:
            `The three triangles are similar copies of one shape, so with l = ${law.shapeFactorL} their areas are ` +
            `l·a² = ${law.lTimesA2} (short leg), l·b² = ${law.lTimesB2} (long leg) and l·c² = ${law.lTimesC2} (hypotenuse); ` +
            `the core's ideal areas are ${law.idealAreas.short}, ${law.idealAreas.long} and ${law.idealAreas.hyp} ` +
            `(leg-sum residual ${law.residuals.legSumMinusHyp}). The app displays ${figure.shown.long}, ` +
            `${figure.shown.short} and ${figure.shown.hyp} after rounding to whole pixels; ` +
            `the short number ${figure.displayQuirk.applied ? "had 45 added (it ended in 5)" : "was not bumped by the +45 quirk"}, ` +
            `so its displayed sum ${figure.displayedSum} ${figure.displayedSumMatchesHyp ? "equals" : "does not equal"} the hypotenuse number.`,
        };
      },
    },

    displayed_area_audit: {
      describe:
        "Check the applet's displayed area sums at several moving-corner positions: for each point report the short/long/hypotenuse integers, whether short + long equals the hypotenuse number, the value of the short area before display and whether the leftover +45 quirk fired, plus the ideal geometry's leg-sum residual. The corner and fold-in views are the two highlighted places where the integers add up; most other positions diverge because of whole-pixel rounding and the quirk, though a few happen to add by coincidence. Give 1 to 12 positions as 'points' (each [x, y] or { x, y } on the 400 x 400 board), or omit them to audit the corner, fold-in and fixture positions.",
      args: '{"points":[[120,270],[140,92],[122,180],[200,150],[260,260]]}',
      run: (args) => {
        const C = core();
        let raw: unknown[];
        if (args.points !== undefined && args.points !== null) {
          if (!Array.isArray(args.points)) throw new Error('"points" must be an array of [x, y] points');
          if (args.points.length < 1 || args.points.length > 12) {
            throw new Error('"points" must contain between 1 and 12 points');
          }
          raw = args.points;
        } else {
          raw = [
            [C.PRESETS.corner.x, C.PRESETS.corner.y],
            [C.PRESETS.fold.x, C.PRESETS.fold.y],
            [122, 180],
          ];
        }
        const rows = raw.map((v, i) => {
          const p = onBoard(C, readPoint(v, `points[${i}]`), `points[${i}]`);
          const state = C.withMouse(C.start(), p.x, p.y);
          const figure = figureReading(C, state);
          const law = lawReading(C, state);
          return {
            point: figure.mouse,
            view: figure.view,
            shown: figure.shown,
            displayedSum: figure.displayedSum,
            sumsCorrectly: figure.displayedSumMatchesHyp,
            shortBeforeQuirk: figure.displayQuirk.shortBeforeQuirk,
            quirkApplied: figure.displayQuirk.applied,
            idealLegSumResidual: law.residuals.legSumMinusHyp,
          };
        });
        const matches = rows.filter((r) => r.sumsCorrectly);
        return {
          rows,
          summary: {
            positions: rows.length,
            displayedSumsThatMatch: matches.length,
            matchingViews: matches.map((r) => r.view),
            positionsWhereQuirkFired: rows.filter((r) => r.quirkApplied).map((r) => r.point),
          },
          note:
            "In the true similar-triangle geometry l·a² + l·b² = l·c² and the two leg areas add to the hypotenuse area " +
            "(the applet's approximate θ leaves a sub-unit residual). The integers on the page are each rounded from a " +
            "whole-pixel construction, with an extra +45 when the short number ends in 5; only when those roundings " +
            "line up does the displayed sum equal the hypotenuse number — as at the corner and fold-in views, and occasionally at another position by coincidence. Elsewhere it diverges.",
        };
      },
    },
  };
}

/** Track.state saves just the moving corner; rebuild and read it with the core. */
export function position(state: Json, stateVersion: number): unknown {
  const saved = {
    stateVersion,
    mouse: state && typeof state === "object" && !Array.isArray(state) && "mouse" in state
      ? (state as Json).mouse
      : undefined,
  };
  try {
    if (stateVersion !== 1) {
      throw new Error(`unsupported Euclid state version ${stateVersion}`);
    }
    if (state === null || typeof state !== "object" || Array.isArray(state)) {
      throw new Error("saved Euclid position must be an object");
    }
    if (state.mouse === undefined || state.mouse === null) {
      throw new Error('saved Euclid position must contain a "mouse" point');
    }
    const C = core();
    const p = onBoard(C, readPoint(state.mouse, "saved mouse"), "saved mouse");
    // The page saved an already-snapped point; withMouse is idempotent here.
    const current = C.withMouse(C.start(), p.x, p.y);
    const figure = figureReading(C, current);
    const law = lawReading(C, current);
    return {
      ...saved,
      saved: { ...state },
      valid: true,
      reconstruction: {
        mouse: figure.mouse,
        view: figure.view,
        snappedFromSaved: figure.mouse.x !== round(p.x, 2) || figure.mouse.y !== round(p.y, 2),
      },
      reading: figure,
      law,
      note:
        "Track.state saved the moving corner of the Euclid diagram. The core rebuilds the two triangles on the legs " +
        "and the one on the hypotenuse from that point, measures their areas, checks l·a² + l·b² = l·c² in the ideal " +
        "geometry, and reports the applet's rounded and quirk-adjusted display integers. At the corner and fold-in " +
        "views the displayed sum matches the hypotenuse number; at most other points it does not.",
    };
  } catch (err) {
    return {
      ...saved,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "A saved Euclid position needs stateVersion 1 and a mouse point { x, y } on the 400 x 400 board.",
    };
  }
}
