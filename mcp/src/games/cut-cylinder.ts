/*
 * run_game_logic actions and saved-position reader for Cut the Cylinder
 * (Bogomolny's CutCylinder applet), an illustration with no win and no loss.
 *
 * The applet fixes a cylinder of radius R = 6 and height H = 18 (axis x, round
 * side y² + z² = R², |x| <= H/2) and a plane whose normal makes a tilt beta
 * with the axis and sits a signed distance d from the centre. In the plane's
 * own (u, v) coordinates the cut satisfies
 *
 *     (cos(beta) u + d sin(beta))² + v² = R².
 *
 * So beta = 0 gives a circle of radius 6, 0 < beta < 90 an ellipse with
 * semi-axes R/cos(beta) by R, and beta = 90 the two parallel lines
 * v = ±sqrt(R² − d²) that coalesce when |d| = R. Because the cylinder is only
 * H = 18 long, a plane that crosses the axis at x = d/cos(beta) and spreads
 * R tan(beta) either side of it can miss the finite cylinder entirely.
 *
 * Every number below comes from the real core
 * (cut-cylinder/cut-cylinder-core.js), copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape. Angles are degrees.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cut-cylinder"].CutCylinderCore as any;

const PRESETS = ["circle", "ellipse", "lines", "touch", "reset"] as const;

const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : v);

/** Validate the sheet's tilt against the core's slider range. */
function readTilt(args: Json, key = "tilt"): number {
  const C = core();
  const tilt = num(args, key);
  if (tilt < C.MIN_TILT || tilt > C.MAX_TILT) {
    throw new Error(`"${key}" must be between ${C.MIN_TILT} and ${C.MAX_TILT} degrees`);
  }
  return tilt;
}

/** Validate the sheet's signed distance from the centre against the core's range. */
function readOffset(args: Json, key = "offset"): number {
  const C = core();
  const offset = num(args, key);
  if (offset < C.MIN_OFFSET || offset > C.MAX_OFFSET) {
    throw new Error(`"${key}" must be between ${C.MIN_OFFSET} and ${C.MAX_OFFSET}`);
  }
  return offset;
}

/** Build a core state from an optional preset name plus optional tilt/offset overrides. */
function stateFromArgs(args: Json): any {
  const C = core();
  let s = C.start({});
  if (args.preset !== undefined) {
    const name = String(args.preset);
    if (!PRESETS.includes(name as (typeof PRESETS)[number])) {
      throw new Error(`"preset" must be one of ${PRESETS.join(", ")}`);
    }
    s = C.preset(s, name);
  }
  if (args.tilt !== undefined) s = C.setTilt(s, readTilt(args));
  if (args.offset !== undefined) s = C.setOffset(s, readOffset(args));
  if (args.transparent !== undefined) s = { ...s, transparent: args.transparent === true };
  if (args.linked !== undefined) s = { ...s, linked: args.linked === true };
  return s;
}

/** The core's own analysis of one picture, rounded and named for a tutor. */
function reading(state: any) {
  const a = core().analyse(state);
  const status = core().describe(state) as { title: string; text: string };
  return {
    tilt: round(a.tilt, 4),
    offset: round(a.offset, 4),
    family: a.family,
    visible: a.visible,
    alongAxis: a.alongAxis,
    radius: a.radius,
    halfHeight: a.halfHeight,
    cos: round(a.cos, 6),
    sin: round(a.sin, 6),
    semiAxes: {
      u: Number.isFinite(a.semiU) ? round(a.semiU, 6) : null,
      v: round(a.semiV, 6),
    },
    centerU: round(a.centerU, 6),
    centerX: round(a.centerX, 6),
    xSpread: round(a.xSpread, 6),
    gap: round(a.gap, 6),
    foot: { x: round(a.foot.x, 6), y: round(a.foot.y, 6), z: a.foot.z },
    status,
  };
}

export function actions(): GameActions {
  return {
    classify_section: {
      describe:
        "Classify the cut made by a sheet tilted tilt degrees from straight across (0 to 90) and sitting offset units from the cylinder's centre (−12 to 12), using an optional preset (circle, ellipse, lines, touch, reset) or explicit tilt/offset. Reports the family (circle, ellipse, two parallel lines, one coalesced line, or no section), the semi-axes or line separation, where the plane meets the axis, whether the finite cylinder is reached, and the core's own description. The cylinder has radius 6 and height 18.",
      args: '{ "tilt": 30, "offset": 2 }',
      run: (args) => {
        const state = stateFromArgs(args);
        const r = reading(state);
        const visibleNote = r.visible
          ? "The plane meets the finite cylinder (height 18), so the curve is drawn."
          : "The plane passes beyond the cylinder's ends, so no visible section remains.";
        return {
          ...r,
          note:
            `${r.status.text} The cut obeys (cosβ·u + d·sinβ)² + v² = 36 with R = 6: β = 0 is a circle of radius 6, ` +
            "a tilt stretches it into an ellipse with semi-axes R/cosβ by R, and β = 90° gives the parallel lines v = ±√(R² − d²), " +
            `which join when |d| = R = 6. ${visibleNote}`,
        };
      },
    },

    section_cases: {
      describe:
        "Run the real core on the page's memorable placements and report each cut: tilt 0 (circle), a middle tilt (ellipse), along the axis (two parallel lines) and slid out to |offset| = 6 (the lines coalesce), plus a plane that misses the cylinder. An optional offset sets the circle/ellipse cases (default 2); the along-axis cases ignore it where they must.",
      args: '{ "offset": 2 }',
      run: (args) => {
        const C = core();
        const offset = num(args, "offset", C.DEFAULT_OFFSET);
        if (offset < C.MIN_OFFSET || offset > C.MAX_OFFSET) {
          throw new Error(`"offset" must be between ${C.MIN_OFFSET} and ${C.MAX_OFFSET}`);
        }
        const cases = [
          { name: "circle", ...reading(C.start({ tilt: 0, offset })) },
          { name: "ellipse", ...reading(C.start({ tilt: 30, offset })) },
          { name: "parallel lines", ...reading(C.preset(C.start({}), "lines")) },
          { name: "coalesced line", ...reading(C.preset(C.start({}), "touch")) },
          { name: "misses cylinder", ...reading(C.start({ tilt: 90, offset: 8 })) },
        ];
        return {
          radius: C.RADIUS,
          height: C.HEIGHT,
          offsetUsed: offset,
          cases,
          note:
            `With R = ${C.RADIUS} and H = ${C.HEIGHT}: β = 0 is a circle of radius 6; a tilt stretches it into an ellipse ` +
            "with semi-axes R/cosβ by R; β = 90° opens the oval into two lines v = ±√(R² − d²), which meet into one line at |d| = 6 " +
            "and disappear past it. A tilted oval can also fall off the cylinder's finite length and vanish from view.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Cut the Cylinder state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Cut the Cylinder position must be an object");
  }

  const s = state;
  const saved = {
    tilt: s.tilt,
    offset: s.offset,
    transparent: s.transparent,
    linked: s.linked,
    stateVersion,
  };
  let here: any;
  let savedReadable = true;
  try {
    const tilt = readTilt(s);
    const offset = readOffset(s);
    here = core().start({
      tilt,
      offset,
      transparent: s.transparent === undefined ? true : s.transparent === true,
      linked: s.linked === true,
    });
  } catch {
    savedReadable = false;
    here = core().start({});
  }
  const r = reading(here);
  return {
    stateVersion,
    savedReadable,
    saved,
    ...r,
    note: !savedReadable
      ? "The saved numbers could not be read, so the opening picture is shown instead."
      : `The saved sheet is tilted ${r.tilt}° from straight across and sits ${r.offset} units from the centre: ${r.status.title}${r.visible ? "" : " (off the cylinder)"}.`,
  };
}
