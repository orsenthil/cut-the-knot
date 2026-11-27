/*
 * run_game_logic actions and saved-position reader for Cut Cube.
 *
 * The real core is cut-cube/cut-cube-core.js (global CutCubeCore), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 * The page is an illustration with no win or loss.
 *
 * In the cube's own coordinates the cube is [-3,3]^3 (ColorCube(6)) and a
 * plane is a x + b y + c z = d. The core cuts the cube's twelve edges by that
 * plane and orders the intersection points around their centre. A plane can
 * meet each of the three pairs of parallel faces at most once, so a section
 * has at most six sides: the page's five named cuts run from a corner triangle
 * to the regular hexagon through the cube's centre. The plane's world scene
 * graph keeps two transforms, cube and plane, and "combined" reparents the
 * plane under the cube; the reader below re-reads exactly those saved fields.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cut-cube"].CutCubeCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Vec = number[];
type Mat = number[][];

const STYLES = ["transparent", "opaque"] as const;

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const roundVec = (p: Vec): Vec => p.map(round);
const roundMat = (m: Mat): Mat => m.map((row) => row.map(round));
const dot = (a: Vec, b: Vec): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

/** A vector must be three finite numbers, written [x, y, z]. */
function readVec(raw: unknown, label: string): Vec {
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error(`argument "${label}" must be [x, y, z]`);
  }
  const v = raw.map((x) => Number(x));
  if (!v.every(Number.isFinite)) throw new Error(`argument "${label}" has a non-finite coordinate`);
  return v;
}

/** A transform is a 4x4 affine matrix of finite numbers. */
function readMatrix(raw: unknown, label: string): Mat | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every((r) => Array.isArray(r) && r.length === 4)) {
    throw new Error(`argument "${label}" must be a 4x4 matrix of numbers`);
  }
  const m = raw.map((r) => (r as unknown[]).map((x) => Number(x)));
  if (!m.every((r) => r.every(Number.isFinite))) {
    throw new Error(`argument "${label}" has a non-finite matrix entry`);
  }
  return m;
}

function readStyle(raw: unknown, fallback: string): string {
  if (raw === undefined || raw === null) return fallback;
  const style = String(raw);
  if (!(STYLES as readonly string[]).includes(style)) {
    throw new Error(`argument "style" must be one of ${STYLES.join(", ")}, got ${JSON.stringify(raw)}`);
  }
  return style;
}

function readCombined(raw: unknown, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`argument "combined" must be true or false`);
  return raw;
}

/** Which plane transform the arguments ask for, as a start state for the core. */
function stateFromArgs(C: Core, args: Json): State {
  const seed = C.start();
  const preset = args.preset === undefined || args.preset === null ? null : String(args.preset);
  const hasNormal = args.normal !== undefined && args.normal !== null;
  const hasOffset = args.offset !== undefined && args.offset !== null;
  const presets = C.CONST.PRESETS as Record<string, { n: number[]; d: number }>;
  const names = Object.keys(presets);

  let s: State;
  if (preset !== null) {
    if (hasNormal || hasOffset) throw new Error('give "preset" or "normal" with "offset", not both');
    if (!Object.prototype.hasOwnProperty.call(presets, preset)) {
      throw new Error(`argument "preset" must be one of ${names.join(", ")}, got ${JSON.stringify(args.preset)}`);
    }
    s = C.preset(seed, preset);
  } else if (hasNormal && hasOffset) {
    const normal = readVec(args.normal, "normal");
    if (Math.hypot(normal[0], normal[1], normal[2]) < 1e-9) {
      throw new Error('argument "normal" must not be the zero vector');
    }
    s = {
      cube: C.identity(),
      plane: C.planeFromNormal(normal, num(args, "offset")),
      combined: false,
      style: seed.style,
    };
  } else {
    throw new Error('supply either "preset" or both "normal" and "offset"');
  }

  s = C.setStyle(s, readStyle(args.style, s.style));
  if (readCombined(args.combined, s.combined)) s = C.setMode(s, "combined");
  return s;
}

/** The core's own reading of one picture, with numbers rounded for a tutor. */
function sectionReading(C: Core, s: State) {
  const snap = C.snapshot(s);
  const sides = snap.section.length;
  return {
    sides,
    shape: C.classify(snap.section),
    vertices: snap.section.map(roundVec),
    normal: roundVec(snap.normal),
    planeOffset: round(dot(snap.normal, C.applyPoint(snap.plane, [0, 0, 0]))),
    cubeSide: C.CONST.CUBE_SIDE,
    combined: snap.combined,
    style: snap.style,
    scale: snap.scale,
  };
}

export function actions(): GameActions {
  return {
    section_for_plane: {
      describe:
        "Report the polygon in which a plane cuts the applet's cube (side 6, centred at the origin in cube coordinates). Give either preset (pyramid, square, quadrilateral, pentagon or hexagon) or both normal [a, b, c] and offset d for the plane a·x = d; the core cuts the cube's twelve edges and returns the vertices in order around the section, its side count and its shape name. Optional style (transparent|opaque) and combined (boolean) mirror the page's two radio pairs.",
      args: '{ "preset": "pentagon" }',
      run: (args) => {
        const C = core();
        const s = stateFromArgs(C, args);
        const presets = C.CONST.PRESETS as Record<string, { n: number[]; d: number }>;
        const preset = args.preset === undefined || args.preset === null ? null : String(args.preset);
        const requestedNormal = preset !== null ? presets[preset].n : readVec(args.normal, "normal");
        const requestedOffset = preset !== null ? presets[preset].d : num(args, "offset");
        const r = sectionReading(C, s);
        return {
          preset,
          requestedPlane: { normal: roundVec(requestedNormal), offset: round(requestedOffset) },
          section: r,
          isIllustration: C.result() === null,
          note:
            `The core cuts the cube's edges by the plane and finds ${r.sides} points, so the section is ${r.shape}. ` +
            "A plane meets each pair of the cube's parallel faces at most once, so no cut can have more than six sides; the central hexagon is the largest.",
        };
      },
    },

    five_cuts: {
      describe:
        "Run the real core on the page's five named cuts and report each plane, its section shape and the number of sides, from the corner triangle (pyramid) through two quadrilaterals and a pentagon to the regular hexagon. The action then cuts the cube by a grid of other planes to confirm that no plane section has more than six sides, reporting the largest count found and any exceptions.",
      args: '{}',
      run: (args) => {
        if (args === null || typeof args !== "object") throw new Error('arguments must be an object, e.g. "{}"');
        const C = core();
        const presets = C.CONST.PRESETS as Record<string, { n: number[]; d: number }>;
        const cuts = Object.keys(presets).map((name) => {
          const cfg = presets[name];
          const r = sectionReading(C, C.preset(C.start(), name));
          return {
            name,
            plane: { normal: cfg.n.slice(), offset: cfg.d },
            sides: r.sides,
            shape: r.shape,
            vertices: r.vertices,
          };
        });

        // Deterministic grid of directions and offsets; no randomness is used.
        const directions = [
          [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1],
          [1, 1, 1], [1, 2, 1], [1, 0.8, 0.35], [2, 1, 0.5], [3, 2, 1],
          [1, -1, 1], [0.3, 1, 2], [1, 1, 0.2],
        ];
        const cube = C.identity();
        let maxSides = 0;
        let samplesChecked = 0;
        const overSix: Array<{ normal: Vec; offset: number; sides: number }> = [];
        for (const n of directions) {
          for (let k = -16; k <= 16; k++) {
            const d = k / 4;
            const sides = C.section(cube, C.planeFromNormal(n, d)).length;
            samplesChecked++;
            if (sides > maxSides) maxSides = sides;
            if (sides > 6) overSix.push({ normal: n.slice(), offset: d, sides });
          }
        }
        return {
          cuts,
          maxSides,
          samplesChecked,
          overSix,
          note:
            "The pyramid plane isolates one corner (a triangle); the square and quadrilateral presets give four sides; the pentagon gives five; and the plane through the cube's centre perpendicular to a body diagonal gives the regular hexagon. " +
            `Across ${samplesChecked} sampled planes the largest section had ${maxSides} sides, matching the bound: a plane meets each of the three pairs of parallel faces at most once, so it crosses at most six of the twelve edges.`,
        };
      },
    },
  };
}

/** The position saved by Track.state, echoed and re-read with the same core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Cut Cube state version ${stateVersion}`);
  }
  if (state === null || typeof state !== "object") throw new Error("state must be an object");
  const C = core();
  const seed = C.start();
  const cube = readMatrix(state.cube, "cube") ?? seed.cube;
  const plane = readMatrix(state.plane, "plane") ?? seed.plane;
  const s: State = {
    cube,
    plane,
    combined: readCombined(state.combined, seed.combined),
    style: readStyle(state.style, seed.style),
  };
  const savedSection = (Array.isArray(state.section) ? state.section : []).map((p, i) => readVec(p, `section[${i}]`));
  const r = sectionReading(C, s);
  const matches =
    savedSection.length === r.vertices.length &&
    savedSection.every((p, i) => p.every((v, j) => Math.abs(v - r.vertices[i][j]) < 1e-4));

  return {
    stateVersion,
    saved: {
      cube: roundMat(cube),
      plane: roundMat(plane),
      combined: s.combined,
      style: s.style,
      section: savedSection.map(roundVec),
    },
    reading: {
      section: { sides: r.sides, shape: r.shape, vertices: r.vertices },
      normal: r.normal,
      planeOffset: r.planeOffset,
      cubeSide: r.cubeSide,
      scale: r.scale,
      savedSectionMatches: matches,
      isIllustration: C.result() === null,
    },
    note:
      "Track.state saves the cube and plane world transforms, the separate/combined mode, the transparent/opaque style and the section polygon the page drew. The reading rebuilds the same transforms with the core, recomputes the section and checks it against the saved vertices. This is an illustration: there is no win or loss.",
  };
}
