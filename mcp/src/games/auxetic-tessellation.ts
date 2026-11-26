/*
 * run_game_logic actions and saved-position reader for Auxetic Tessellation.
 *
 * The page is an illustration: four stiff rectangles hang on the parallelogram
 * A-B-C-D, translating the ring tiles the plane, and stretching the hinge
 * leaves the tiles' own area unchanged while the repeat grows. Every number
 * below comes from the game's real core, copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["auxetic-tessellation"].AuxeticTessellationCore;

type Point = { x: number; y: number };

/** What lattice() returns, with density null only for a collapsed cell. */
interface CellMetrics {
  D: Point;
  v01: Point;
  v02: Point;
  v03: Point;
  v13: Point;
  cross: number;
  cellArea: number;
  covered: number;
  density: number | null;
  spacing01: number;
  spacing03: number;
  sideAB: number;
  sideBC: number;
}

interface Change {
  coveredUnchanged: boolean;
  cellGrew: boolean;
  densityFell: boolean;
  sidesKept: boolean;
  spacing01Grew: boolean;
  spacing03Grew: boolean;
  bothSpacingsGrew: boolean;
}

const CELL_FORMULA =
  "u = B - A, w = C - B; covered = 2(alpha|u|^2 + gamma|w|^2); " +
  "cell = covered + 2|u x w|(1 + alpha*gamma); density = covered / cell; " +
  "the lattice spacings are cell / |v01| and cell / |v03|.";

const near = (a: number, b: number, eps = 1e-8): boolean =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const r = (v: number): number => Number(v.toFixed(6));
const pt = (p: Point) => ({ x: r(p.x), y: r(p.y) });

function readPoint(v: unknown, key: string): Point {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`argument "${key}" must be a point { "x": number, "y": number }`);
  }
  const p = v as Json;
  const x = Number(p.x), y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${key}" must have finite numeric x and y`);
  }
  return { x, y };
}

/** The page's sliders run 0..21, divided by ten, i.e. 0..2.1. */
function ratio(args: Json, key: "alpha" | "gamma", fallback?: number): number {
  const lim = core().LIMITS[key] as { min: number; max: number };
  const v = num(args, key, fallback);
  if (v < lim.min || v > lim.max) {
    throw new Error(`argument "${key}" must be between ${lim.min} and ${lim.max}, got ${v}`);
  }
  return v;
}

function ratios(args: Json, withFallback = false): { alpha: number; gamma: number } | null {
  const d = core().DEFAULTS;
  const alpha = ratio(args, "alpha", withFallback ? d.alpha : undefined);
  const gamma = ratio(args, "gamma", withFallback ? d.gamma : undefined);
  if (alpha === 0 && gamma === 0) {
    throw new Error("alpha and gamma cannot both be 0: all four rectangles would collapse");
  }
  return { alpha, gamma };
}

/** The stretch stops at the square; beyond 45 degrees the rhombus closes again. */
function angle(args: Json, key: string, fallback?: number): number {
  const v = num(args, key, fallback);
  if (v < 1 || v > 45) {
    throw new Error(`argument "${key}" must be between 1 and 45 degrees, got ${v}`);
  }
  return v;
}

/**
 * A hinge with |AB| = |BC| = 2 and interior angle `degrees` at B, matching the
 * logic test's hingeFromAngle. The core's openHinge keeps the half-diagonals
 * (2 sin and 2 cos of this angle), so adding delta degrees advances the angle
 * by delta while the two hinge sides stay exactly 2.
 */
function hingeState(alpha: number, gamma: number, degrees: number): Json {
  const C = core();
  const rad = (degrees * Math.PI) / 180;
  return {
    A: C.P(0, -2 * Math.sin(rad)),
    B: C.P(2 * Math.cos(rad), 0),
    C: C.P(0, 2 * Math.sin(rad)),
    alpha, gamma, layers: 1, loose: true,
  };
}

function cell(m: CellMetrics) {
  return {
    coveredArea: r(m.covered),
    cellArea: r(m.cellArea),
    density: m.density === null ? null : r(m.density),
    latticeSpacings: { alongV01: r(m.spacing01), alongV03: r(m.spacing03) },
    hingeSides: { AB: r(m.sideAB), BC: r(m.sideBC) },
  };
}

function change(before: CellMetrics, after: CellMetrics): Change {
  const spacing01Grew = after.spacing01 > before.spacing01 + 1e-9;
  const spacing03Grew = after.spacing03 > before.spacing03 + 1e-9;
  return {
    coveredUnchanged: near(before.covered, after.covered),
    cellGrew: after.cellArea > before.cellArea + 1e-9,
    densityFell: before.density !== null && after.density !== null &&
      after.density < before.density - 1e-11,
    sidesKept: near(before.sideAB, after.sideAB) && near(before.sideBC, after.sideBC),
    spacing01Grew,
    spacing03Grew,
    bothSpacingsGrew: spacing01Grew && spacing03Grew,
  };
}

const noteFor = (ch: Change): string => ch.bothSpacingsGrew
  ? "Both lattice spacings grow here, so the page's auxetic claim holds at these sliders. " +
    "It is not universal: at extreme unequal ratios, e.g. alpha 2.1 with gamma 0, " +
    "one spacing turns back while the cell still grows and the density still falls."
  : "One lattice spacing shrinks here, so the page's blanket 'grows thicker in every direction' " +
    "is too strong at extreme ratios. The fixed covered area, growing cell and falling density " +
    "are what the construction always guarantees.";

export function actions(): GameActions {
  return {
    stretch_and_density: {
      describe:
        "For rectangle side ratios alpha and gamma (each 0..2.1) and a hinge angle in degrees, report the covered area, cell area, filled fraction and both lattice spacings before and after opening the hinge like the page's Stretch button. States whether the cell grew, the density fell and both spacings grew; at extreme unequal ratios one spacing can shrink even though density falls.",
      args: '{ "alpha": 0.5, "gamma": 0.4, "angle": 15, "open": 6 }',
      run: (args) => {
        const C = core();
        const { alpha, gamma } = ratios(args)!;
        const from = angle(args, "angle");
        const by = angle(args, "open", 6);
        if (from + by > 45) {
          throw new Error("angle + open must be at most 45 degrees: past the square the rhombus closes again");
        }
        const s = hingeState(alpha, gamma, from);
        const before: CellMetrics = C.lattice(s);
        const after: CellMetrics = C.lattice(C.openHinge(s, by));
        const checks = change(before, after);
        return {
          ratios: { alpha, gamma },
          opening: { fromDegrees: from, byDegrees: by, toDegrees: from + by },
          formula: CELL_FORMULA,
          before: cell(before),
          after: cell(after),
          checks,
          note: noteFor(checks),
        };
      },
    },
    density_sweep: {
      describe:
        "Sweep the hinge angle from `from` to `to` degrees in steps of `step` for the given alpha and gamma. Reports each angle's cell area, density and two lattice spacings, whether area/density change monotonically, and the first angle where a spacing turns back. Use an extreme unequal pair such as alpha 2.1, gamma 0 to find the counterexample to the page's blanket claim.",
      args: '{ "alpha": 2.1, "gamma": 0, "from": 5, "to": 45, "step": 5 }',
      run: (args) => {
        const { alpha, gamma } = ratios(args)!;
        const from = angle(args, "from", 5);
        const to = angle(args, "to", 45);
        const step = num(args, "step", 5);
        if (to < from) throw new Error('argument "to" must be at least "from"');
        if (!Number.isInteger(step) || step < 1 || step > 20) {
          throw new Error('argument "step" must be a whole number of degrees from 1 to 20');
        }
        const rows: Json[] = [];
        let prev: CellMetrics | null = null;
        let firstTurnBack: Json | null = null;
        let cellAlwaysGrew = true, densityAlwaysFell = true;
        for (let deg = from; deg <= to; deg += step) {
          const m: CellMetrics = core().lattice(hingeState(alpha, gamma, deg));
          rows.push({
            degrees: deg,
            cellArea: r(m.cellArea),
            density: m.density === null ? null : r(m.density),
            spacing01: r(m.spacing01),
            spacing03: r(m.spacing03),
          });
          if (prev) {
            if (m.cellArea <= prev.cellArea + 1e-9) cellAlwaysGrew = false;
            if (m.density === null || prev.density === null || m.density >= prev.density - 1e-11) {
              densityAlwaysFell = false;
            }
            if (firstTurnBack === null && m.spacing01 < prev.spacing01 - 1e-6) {
              firstTurnBack = {
                degrees: deg,
                direction: "along v01",
                from: r(prev.spacing01),
                to: r(m.spacing01),
              };
            } else if (firstTurnBack === null && m.spacing03 < prev.spacing03 - 1e-6) {
              firstTurnBack = {
                degrees: deg,
                direction: "along v03",
                from: r(prev.spacing03),
                to: r(m.spacing03),
              };
            }
          }
          prev = m;
        }
        return {
          ratios: { alpha, gamma },
          sweep: { fromDegrees: from, toDegrees: to, stepDegrees: step },
          formula: CELL_FORMULA,
          rows,
          checks: { cellAlwaysGrew, densityAlwaysFell },
          firstTurnBack,
          note: firstTurnBack
            ? `The spacing ${(firstTurnBack as Json).direction} first turns back at ${(firstTurnBack as Json).degrees} degrees, ` +
              "even though the cell keeps growing and the covered fraction keeps falling. " +
              "That is the counterexample to the page's blanket 'thicker in every direction' claim."
            : "Neither spacing turns back over this sweep: both directions grow, as the page claims for these ratios.",
        };
      },
    },
  };
}

/** The page's saved illustration, rebuilt and read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Auxetic Tessellation state version ${stateVersion}`);
  }
  const C = core();
  const d = C.DEFAULTS;
  const pair = ratios(state, true)!;
  const s: Json = {
    A: readPoint(state.A, "A"),
    B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"),
    alpha: pair.alpha,
    gamma: pair.gamma,
    layers: Math.round(num(state, "layers", d.layers)),
    colorLayers: state.colorLayers === true,
    loose: state.loose === true,
    width: num(state, "width", d.width),
    height: num(state, "height", d.height),
  };
  const m: CellMetrics = C.lattice(s);
  const opened: CellMetrics = C.lattice(C.openHinge(s, 6));
  const ch = change(m, opened);
  const formulaCell = m.covered + 2 * Math.abs(m.cross) * (1 + pair.alpha * pair.gamma);
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    A: s.A, B: s.B, C: s.C,
    alpha: s.alpha, gamma: s.gamma, layers: s.layers,
    colorLayers: s.colorLayers, loose: s.loose, width: s.width, height: s.height,
    reading: {
      formula: CELL_FORMULA,
      D: pt(m.D),
      ...cell(m),
      translationVectors: {
        v01: pt(m.v01), v02: pt(m.v02), v03: pt(m.v03), v13: pt(m.v13),
      },
      halfStepIdentities: {
        v02EqualsHalfV01PlusV03: near((m.v01.x + m.v03.x) / 2, m.v02.x) &&
          near((m.v01.y + m.v03.y) / 2, m.v02.y),
        v13EqualsHalfV01MinusV03: near((m.v01.x - m.v03.x) / 2, m.v13.x) &&
          near((m.v01.y - m.v03.y) / 2, m.v13.y),
      },
      cellAreaFromFormula: {
        value: r(formulaCell),
        matches: near(formulaCell, m.cellArea),
      },
      oneStretch: {
        degrees: 6,
        cellArea: r(opened.cellArea),
        density: opened.density === null ? null : r(opened.density),
        checks: ch,
      },
      note: noteFor(ch),
    },
  };
}
