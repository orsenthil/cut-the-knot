/*
 * run_game_logic actions and saved-position reader for Four AB.
 *
 * P = (a, b) is the circle's centre in the first quadrant; S1..S4 are the
 * pieces of the disk in the four quadrants. The puzzle's alternating sum
 * S1 - S2 + S3 - S4 equals 4ab whenever the circle covers the rectangle with
 * corners (0, 0) and (a, b), i.e. when r >= sqrt(a*a + b*b). Every number
 * below comes from the game's real core (four-ab/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["four-ab"].FourAbCore;

/** Treat two measurements as equal when they agree to about six significant figures. */
function close(x: number, y: number): boolean {
  return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
}

function readGeometry(args: Json): { a: number; b: number; radius: number } {
  const a = num(args, "a");
  const b = num(args, "b");
  const radius = num(args, "radius");
  if (!(a >= 0) || !(b >= 0)) {
    throw new Error("a and b must be non-negative: P sits in the first quadrant");
  }
  if (!(radius > 0)) throw new Error("radius must be positive");
  return { a, b, radius };
}

export function actions(): GameActions {
  return {
    quadrant_areas: {
      describe:
        "For a circle of radius `radius` about P = (`a`, `b`), report the four quadrant areas S1..S4 and the alternating sum S1-S2+S3-S4, both from the pieces and from the closed form. It also reports 4ab and whether the circle covers the rectangle, the condition under which the sum is exactly 4ab.",
      args: '{ "a": 112, "b": 51, "radius": 130 }',
      run: (args) => {
        const C = core();
        const { a, b, radius } = readGeometry(args);
        const s = C.quadrantAreas(a, b, radius);
        const alternating = s[0] - s[1] + s[2] - s[3];
        const closedForm = C.signedArea(a, b, radius);
        const threshold = Math.hypot(a, b);
        const covered = radius >= threshold;
        const fourAb = 4 * a * b;
        return {
          a,
          b,
          radius,
          S1: s[0],
          S2: s[1],
          S3: s[2],
          S4: s[3],
          alternatingSum: alternating,
          closedFormSignedArea: closedForm,
          fourAb,
          threshold,
          coversRectangle: covered,
          formulasAgree: close(alternating, closedForm),
          identityHolds: covered && close(alternating, fourAb),
          note: covered
            ? `r = ${radius.toFixed(2)} is at least sqrt(a^2+b^2) = ${threshold.toFixed(2)}, so the disk covers the whole rectangle and S1-S2+S3-S4 = 4ab = ${fourAb.toFixed(2)}.`
            : `r = ${radius.toFixed(2)} is below sqrt(a^2+b^2) = ${threshold.toFixed(2)}, so the puzzle's condition fails and the sum need not be 4ab = ${fourAb.toFixed(2)}.`,
        };
      },
    },
    from_slider: {
      describe:
        "Set up the applet's picture for a canvas of `width` by `height` and a radius slider value, then report the centre P, radius, threshold and alternating sum the core computes. The slider runs from 0 to 100 and scales the full radius 2*(sqrt(a^2+b^2) + min(a,b)/10).",
      args: '{ "width": 640, "height": 412, "slider": 100 }',
      run: (args) => {
        const C = core();
        const width = num(args, "width", 640);
        const height = num(args, "height", 412);
        if (!(width > 0) || !(height > 0)) throw new Error("width and height must be positive");
        const slider = num(args, "slider", C.SLIDER_START);
        if (!Number.isInteger(slider) || slider < 0 || slider > C.SLIDER_MAX) {
          throw new Error(`slider must be a whole number from 0 to ${C.SLIDER_MAX}`);
        }
        const start = C.initial(width, height);
        const state = C.withSlider(start, slider);
        const p = C.position(state);
        const threshold = C.threshold(state);
        const quadrants = C.quadrantAreas(p.a, p.b, p.radius);
        const alternating = quadrants[0] - quadrants[1] + quadrants[2] - quadrants[3];
        const fourAb = 4 * p.a * p.b;
        const covered = p.radius >= threshold;
        return {
          width,
          height,
          canvas: { a: start.a, b: start.b, step: start.step, full: start.full },
          slider: p.slider,
          center: { a: p.a, b: p.b },
          radius: p.radius,
          threshold,
          coversRectangle: covered,
          fourAb,
          alternatingSum: alternating,
          closedFormSignedArea: p.signedArea,
          showExtra: p.showExtra,
          note: covered
            ? `At slider ${p.slider} the radius ${p.radius.toFixed(2)} reaches sqrt(a^2+b^2) = ${threshold.toFixed(2)}, so the alternating sum is 4ab = ${fourAb.toFixed(2)}.`
            : `At slider ${p.slider} the radius ${p.radius.toFixed(2)} is short of sqrt(a^2+b^2) = ${threshold.toFixed(2)}; slide higher to reach the identity.`,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved and re-measure the picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Four AB state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four AB position must be an object");
  }
  const C = core();
  const a = num(state, "a");
  const b = num(state, "b");
  const radius = num(state, "radius");
  const slider = num(state, "slider");
  const showExtra = state.showExtra === true;
  const savedSignedArea = num(state, "signedArea");
  if (!(a >= 0) || !(b >= 0)) {
    throw new Error("saved a and b must be non-negative (P is in the first quadrant)");
  }
  if (!(radius > 0)) throw new Error("saved radius must be positive");

  const s = { a, b, radius, slider, showExtra };
  const s1 = C.quadrantAreas(a, b, radius);
  const alternating = s1[0] - s1[1] + s1[2] - s1[3];
  const closedForm = C.signedArea(a, b, radius);
  const threshold = C.threshold(s);
  const covered = radius >= threshold;
  const fourAb = 4 * a * b;
  const extra = C.extraLines(s);
  return {
    ...state,
    stateVersion,
    saved: { a, b, radius, slider, showExtra, signedArea: savedSignedArea },
    center: { a, b },
    threshold,
    coversRectangle: covered,
    quadrantAreas: { S1: s1[0], S2: s1[1], S3: s1[2], S4: s1[3] },
    alternatingSum: alternating,
    closedFormSignedArea: closedForm,
    fourAb,
    identityHolds: covered && close(alternating, fourAb),
    savedMatchesCore: close(savedSignedArea, closedForm),
    extraLines: extra,
    note: covered
      ? `The saved circle covers the rectangle (r >= sqrt(a^2+b^2)), so S1-S2+S3-S4 = 4ab = ${fourAb.toFixed(2)}.`
      : `The saved circle is too small to cover the rectangle, so the alternating sum need not be 4ab; the core measures it as ${alternating.toFixed(2)} against 4ab = ${fourAb.toFixed(2)}.`,
  };
}
