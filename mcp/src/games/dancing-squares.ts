/*
 * run_game_logic actions and saved-position reader for Dancing Squares.
 *
 * Paul Brown's applet hangs a rigid square off each side of a hinged rhombus
 * ABCD (D = A + C - B) and reflects them into a tessellation. Dragging the
 * hinges changes the pattern but never a square's side s. With theta the angle
 * at hinge B, the real core measures a repeating cell of area
 *
 *     cell = 2 s^2 (1 + sin theta),   covered fraction = 1 / (1 + sin theta),
 *
 * so the grid at theta ~ 0 fills its cell completely, the checkerboard at
 * theta = 90 degrees fills half of a cell twice as big, and the grid at
 * theta ~ 180 degrees is whole again with every square turned a quarter turn.
 * Every number below comes from the game's real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["dancing-squares"].DancingSquaresCore;

type Pt = { x: number; y: number };
type DsState = {
  A: Pt; B: Pt; C: Pt;
  layers: number;
  colorLayers: boolean;
  showNames: boolean;
  loose: boolean;
  width: number;
  height: number;
};

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const deg = (radians: number) => (radians * 180) / Math.PI;
const pt = (p: Pt) => ({ x: round(p.x), y: round(p.y) });
const val = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) ? null : round(v);
const near = (a: number, b: number, eps = 1e-7) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
const frac = (x: number) => {
  const f = x - Math.floor(x + 1e-9);
  return f > 0.999 || Math.abs(f) < 1e-9 ? 0 : f;
};

/** Accept [x, y] or { x, y } for a hinge point, as the other geometry readers do. */
function readPoint(v: unknown, key: string): Pt {
  if (Array.isArray(v)) {
    const a = numArray({ [key]: v }, key);
    if (a.length !== 2) throw new Error(`"${key}" must have exactly two numbers, [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`"${key}" must be [x, y] or { x, y }`);
}

/**
 * Read a position from the page's fields. With a `base` (the core's opening
 * position) missing fields fall back to it; without one, A, B and C are
 * required because they are the essential fields Track.state saved.
 */
function readState(args: Json, base?: DsState): DsState {
  const C = core();
  const seed = base ?? (C.start({}) as DsState);
  const s: DsState = {
    A: { ...seed.A }, B: { ...seed.B }, C: { ...seed.C },
    layers: seed.layers,
    colorLayers: seed.colorLayers,
    showNames: seed.showNames,
    loose: seed.loose,
    width: seed.width,
    height: seed.height,
  };
  for (const key of ["A", "B", "C"] as const) {
    if (args[key] === undefined || args[key] === null) {
      if (!base) throw new Error(`missing saved hinge point "${key}"`);
      continue;
    }
    s[key] = readPoint(args[key], key);
  }
  if (args.layers !== undefined && args.layers !== null) {
    const layers = num(args, "layers");
    const { min, max } = C.LIMITS.layers;
    if (!Number.isInteger(layers) || layers < min || layers > max) {
      throw new Error(`"layers" must be an integer from ${min} to ${max}`);
    }
    s.layers = layers;
  }
  for (const key of ["colorLayers", "showNames", "loose"] as const) {
    if (args[key] === undefined || args[key] === null) continue;
    if (typeof args[key] !== "boolean") throw new Error(`"${key}" must be true or false`);
    s[key] = args[key];
  }
  for (const key of ["width", "height"] as const) {
    if (args[key] === undefined || args[key] === null) continue;
    const v = num(args, key);
    if (!(v > 0)) throw new Error(`"${key}" must be a positive number`);
    s[key] = v;
  }
  return s;
}

/** A symmetric hinge whose angle at B is exactly `hingeDegrees`. */
function atAngle(hingeDegrees: number, side: number, base: DsState): DsState {
  const C = core();
  // hinge() takes half the angle at B (the check's C.hinge(theta / 2, side)).
  const h = C.hinge((hingeDegrees * Math.PI) / 360, side);
  const patch: Json = { A: h.A, B: h.B, C: h.C };
  for (const key of ["layers", "colorLayers", "showNames", "loose", "width", "height"]) {
    if (base[key as keyof DsState] !== undefined) patch[key] = base[key as keyof DsState];
  }
  return readState(patch, base);
}

function checkHingeDegrees(args: Json, fallback: number): number {
  const d = num(args, "hingeDegrees", fallback);
  if (!(d > 0) || !(d < 180)) {
    throw new Error('"hingeDegrees" must be strictly between 0 and 180 (the ends collapse a diagonal)');
  }
  return d;
}

function stageName(degrees: number): string {
  if (degrees <= 5) return "plain grid";
  if (Math.abs(degrees - 90) <= 2) return "checkerboard";
  if (degrees >= 175) return "turned grid";
  return "open hinge";
}

/** The core's lattice, cell and density, phrased for a tutor. */
function latticeReading(s: DsState) {
  const C = core();
  const m = C.lattice(s);
  const theta = m.hingeAngle;
  const formulaCell = 2 * m.area * (1 + Math.sin(theta));
  const formulaDensity = 1 / (1 + Math.sin(theta));

  // Where the two squares per cell sit, in fractions of a lattice step. The
  // logic test uses the same residues to pin down the 90-degree checkerboard.
  const det = C.cross(m.v1, m.v2);
  const offsets = m.base.slice(0, 2).map((sq: { V: Pt[] }) => {
    const centre = C.mul(sq.V.reduce((a: Pt, p: Pt) => C.add(a, p), C.P(0, 0)), 0.25);
    return {
      u: round(frac(C.cross(centre, m.v2) / det)),
      v: round(frac(C.cross(m.v1, centre) / det)),
    };
  });
  const checkerboard = Math.abs(theta - C.QUARTER) < 0.02;
  const halfCellOffsets =
    checkerboard &&
    offsets.length === 2 &&
    ((near(offsets[0].u, 0) && near(offsets[0].v, 0.5) &&
      near(offsets[1].u, 0.5) && near(offsets[1].v, 0)) ||
      (near(offsets[1].u, 0) && near(offsets[1].v, 0.5) &&
        near(offsets[0].u, 0.5) && near(offsets[0].v, 0)));

  const mesh = C.tessellate(s);
  const shown = Math.min(s.layers, mesh.layers.length);
  const tilesShown = mesh.layers.slice(0, shown).reduce(
    (n: number, layer: { V: Pt[] }[]) => n + layer.length, 0,
  );

  return {
    hinge: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(m.D) },
    side: round(m.side),
    squareArea: round(m.area),
    hingeAngleDeg: round(deg(theta)),
    squareTurnDeg: round(deg(m.squareAngle)),
    cell: {
      core: round(m.cell),
      formula: round(formulaCell),
      matchesFormula: near(m.cell, formulaCell, 1e-8),
    },
    coveredFraction: {
      core: val(m.density),
      formula: round(formulaDensity),
      matchesFormula: m.density != null && near(m.density, formulaDensity, 1e-8),
    },
    latticeSteps: {
      v1: pt(m.v1), v2: pt(m.v2),
      spacing1: round(m.spacing1), spacing2: round(m.spacing2),
      rightAngled: near(C.dot(m.v1, m.v2), 0),
      equalSpacing: near(m.spacing1, m.spacing2),
    },
    checkerboard,
    offsetsInCell: offsets,
    halfCellOffsets,
    layers: { shown: s.layers, computed: mesh.layers.length, tilesShown },
    note:
      "Two rigid squares lie in each repeating cell, whose steps are equal and at right angles. " +
      "The core measures cell = 2*s^2*(1 + sin(theta)) and covered fraction " +
      "1/(1 + sin(theta)): a full grid near 0 degrees, a half-full checkerboard at " +
      "90 degrees with the two squares at opposite half-cell offsets, and a full grid " +
      "turned a quarter turn near 180 degrees. Each square turns by half the hinge angle; " +
      "the side s is the invariant throughout.",
  };
}

export function actions(): GameActions {
  return {
    repeat_cell: {
      describe:
        "Set the angle at hinge B to `hingeDegrees` (default 90, strictly between 0 and 180) on a symmetric rhombus whose squares have side `side` (default 137), and report what the real core measures: the repeat cell's area and covered fraction against 2s²(1+sin θ) and 1/(1+sin θ), the quarter-turn of each rigid square, and the two squares' offsets inside one cell (opposite half-cell offsets near 90° mean a checkerboard). Optional `layers` (0-15) and `width`, `height` mirror the page's controls, and A, B, C can be overridden with [x, y] points.",
      args: '{ "hingeDegrees": 90, "side": 137 }',
      run: (args) => {
        const C = core();
        const d = checkHingeDegrees(args, 90);
        const side = num(args, "side", 137);
        if (!(side > 0)) throw new Error('"side" must be a positive number');
        const base = readState(args, C.start({}) as DsState);
        const s = atAngle(d, side, base);
        return { hingeDegrees: d, side, stage: stageName(d), reading: latticeReading(s) };
      },
    },
    expand_reform: {
      describe:
        "Follow the page's claim from a closed grid through the 90° checkerboard to the grid that reforms turned a quarter turn. On a rhombus of side `side` (default 137) the real core measures the repeat cell near 0°, at 90° and near 180°: cell 2s² and full coverage at both ends, cell 4s² and half coverage in between, with each square turning half the hinge angle. It also checks the two area formulas and that the cell grows up to 90° and shrinks afterwards at every whole degree from 1 to 179.",
      args: '{ "side": 137 }',
      run: (args) => {
        const C = core();
        const side = num(args, "side", 137);
        if (!(side > 0)) throw new Error('"side" must be a positive number');
        const base = C.start({}) as DsState;
        const stageAt = (d: number) => latticeReading(atAngle(d, side, base));
        const closed = stageAt(0.0001);
        const chess = stageAt(90);
        const turned = stageAt(179.9999);

        let badCell = 0, badDensity = 0, badGrowth = 0;
        let prevCell = -Infinity, prevDensity = Infinity;
        for (let d = 1; d <= 179; d++) {
          const m = C.lattice(C.hinge((d * Math.PI) / 360, side));
          if (!near(m.cell, 2 * m.area * (1 + Math.sin(m.hingeAngle)), 1e-8)) badCell++;
          if (m.density == null || !near(m.density, 1 / (1 + Math.sin(m.hingeAngle)), 1e-8)) {
            badDensity++;
          }
          if (m.density != null) {
            if (d <= 90) {
              if (m.cell <= prevCell || m.density >= prevDensity) badGrowth++;
            } else if (m.cell >= prevCell) {
              badGrowth++;
            }
            prevDensity = m.density;
          }
          prevCell = m.cell;
        }

        return {
          side,
          formulas: "cell = 2*s^2*(1 + sin(theta)); covered fraction = 1/(1 + sin(theta))",
          stages: { closedGrid: closed, checkerboard: chess, turnedGrid: turned },
          allAngles: { anglesChecked: 179, badCell, badDensity, badGrowth },
          claims: {
            closedGridFillsCell:
              near(closed.cell.core / closed.squareArea, 2, 1e-3) &&
              near(closed.coveredFraction.core ?? 0, 1, 1e-3),
            checkerboardFillsHalf:
              chess.checkerboard && chess.halfCellOffsets &&
              near(chess.cell.core / chess.squareArea, 4, 1e-6) &&
              near(chess.coveredFraction.core ?? 0, 0.5, 1e-6),
            reformedQuarterTurn:
              near(turned.squareTurnDeg, 90, 1e-3) &&
              near(turned.cell.core / turned.squareArea, 2, 1e-3) &&
              near(turned.coveredFraction.core ?? 0, 1, 1e-3),
            expandsThenContracts: badGrowth === 0,
            formulasHold: badCell === 0 && badDensity === 0,
          },
          note:
            "The cell doubles from 2*s^2 to 4*s^2 as the hinge opens to 90 degrees, then " +
            "comes back to 2*s^2; the covered fraction falls to 1/2 and rises again. " +
            "A square's edge turns theta/2, so the last grid is the first one turned " +
            "90 degrees, and the rigid side s never changes.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Dancing Squares state version ${stateVersion}`);
  }
  const C = core();
  try {
    const s = readState(state);
    const reading = latticeReading(s);
    return {
      ...state,
      stateVersion,
      valid: true,
      layers: s.layers,
      colorLayers: s.colorLayers,
      showNames: s.showNames,
      loose: s.loose,
      width: s.width,
      height: s.height,
      hingeAngleDeg: reading.hingeAngleDeg,
      coveredFraction: reading.coveredFraction.core,
      checkerboard: reading.checkerboard,
      reading,
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "A saved Dancing Squares position needs three hinge points A, B and C as { x, y } pairs.",
    };
  }
}
