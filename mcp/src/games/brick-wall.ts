/*
 * run_game_logic actions and saved-position reader for Brick Wall.
 *
 * The core lives in brick-wall/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 *
 * Brick Wall is an illustration, not a game: there is no winner. What can be
 * measured is geometry — the brick sizes from Java integer division, the
 * stagger of alternate rows, the horizontal mortar bands of 2*separation+1
 * lines, and whether a row's upright joints fall inside the bricks of the next
 * row. The claim that the level lines look tilted is a claim about perception
 * (the café wall illusion), not a geometric fact; every reading below says so.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["brick-wall"].BrickWallCore;

/** The board in brick-wall/index.html: its SVG viewBox is 400 x 280. */
const PAGE_CANVAS = { width: 400, height: 280 };
const SETTING_NAMES = ["widthPct", "heightPct", "shiftPct", "shadeDiff", "separation"] as const;
type SettingName = (typeof SETTING_NAMES)[number];
type Settings = Record<SettingName, number>;
type Canvas = { width: number; height: number };

const PERCEPTION_NOTE =
  "Every mortar line is painted from the left edge to the right edge at one fixed height, one row apart, so the lines are exactly parallel at every setting. The apparent slope is a perception effect (the café wall illusion): staggered upright joints and strong shade contrast mislead the eye. Adding mortar or bringing the two greys closer weakens the impression without moving any line; no claim here proves or disproves what a person sees.";

/** Read one slider with its applet range; a missing slider takes the applet's default. */
function setting(args: Json, name: SettingName, fallback: number): number {
  const v = num(args, name, fallback);
  const [lo, hi] = core().LIMITS[name];
  if (!Number.isInteger(v) || v < lo || v > hi) {
    throw new Error(`${name} must be a whole number from ${lo} to ${hi}, got ${JSON.stringify(args[name])}`);
  }
  return v;
}

function readSettings(args: Json): Settings {
  const C = core();
  const s = {} as Settings;
  for (const name of SETTING_NAMES) s[name] = setting(args, name, C.DEFAULTS[name]);
  return s;
}

function readCanvas(args: Json): Canvas {
  const width = num(args, "width", PAGE_CANVAS.width);
  const height = num(args, "height", PAGE_CANVAS.height);
  for (const [name, v] of [["width", width], ["height", height]] as const) {
    if (!Number.isInteger(v) || v < 1 || v > 2000) {
      throw new Error(`${name} must be a whole number of pixels from 1 to 2000, got ${JSON.stringify(args[name])}`);
    }
  }
  return { width, height };
}

/** The geometric facts the core can state about one wall. */
function reading(s: Settings, canvas: Canvas) {
  const C = core();
  const L = C.layout(s, canvas);
  const claims = C.claims(s, canvas);
  return {
    brickWidth: L.width,
    brickHeight: L.height,
    shiftPixels: L.shift,
    firstXOfShiftedRow: C.startX(L.shift, L.width),
    rows: L.rows,
    brickCount: L.bricks.length,
    greyLevels: { dark: L.dark, light: L.light },
    mortar: {
      bands: L.mortar.length,
      linesPerBand: L.thickness,
      formula: "2 * separation + 1",
      bandCenters: L.mortar.map((band: { center: number }) => band.center),
    },
    joints: claims.joinsCrossRows
      ? "a joint of one row lands inside a brick of the next row"
      : "the upright joints line up from row to row",
    joinsCrossRows: claims.joinsCrossRows,
    geometry: claims,
  };
}

export function actions(): GameActions {
  return {
    wall: {
      describe:
        "The exact wall the applet draws for the five sliders widthPct (5..100), heightPct (5..100), shiftPct (0..99), shadeDiff (0..255) and separation (0..10); omitted sliders take the applet's defaults. Optional width and height (default 400 by 280, the page's board) set the board in pixels. Reports the brick size and stagger from Java integer division, every brick's position and shade, the horizontal mortar bands (2*separation+1 lines each), and whether the joints cross or line up. The lines are level; their apparent tilt is only perception.",
      args: '{ "widthPct": 10, "heightPct": 10, "shiftPct": 50, "shadeDiff": 255, "separation": 1 }',
      run: (args) => {
        const s = readSettings(args);
        const canvas = readCanvas(args);
        const C = core();
        const L = C.layout(s, canvas);
        return {
          settings: s,
          canvas,
          ...reading(s, canvas),
          bricks: L.bricks.map((b: { x: number; y: number; w: number; h: number; light: boolean }) => ({
            x: b.x, y: b.y, w: b.w, h: b.h, shade: b.light ? "light" : "dark",
          })),
          mortarBands: L.mortar.map((band: { center: number; top: number; bottom: number; ys: number[] }) => ({
            center: band.center, top: band.top, bottom: band.bottom, lines: band.ys,
          })),
          note: PERCEPTION_NOTE,
        };
      },
    },
    illusion: {
      describe:
        "Sweep Shift, Mortar and Shade on the real core to separate geometry from what the eye reports. Takes the same five sliders and optional width/height as wall. Shows at shiftPct 0, 25, 50, 75 and 99 whether the upright joints cross the row boundaries while the mortar stays level; shows for separation 0..10 that the mortar band grows by two lines each step (2*separation+1) without moving a brick; and shows that shade changes only the two grey levels. The changing 'tilt' is an illusion, not a change in the lines.",
      args: '{ "widthPct": 10, "heightPct": 10, "shadeDiff": 255, "width": 400, "height": 280 }',
      run: (args) => {
        const s = readSettings(args);
        const canvas = readCanvas(args);
        const C = core();
        const baseBricks = JSON.stringify(C.layout(s, canvas).bricks);
        const byShift = [0, 25, 50, 75, 99].map((pct) => {
          const st = C.withSetting(s, "shiftPct", pct);
          const L = C.layout(st, canvas);
          const cl = C.claims(st, canvas);
          return {
            shiftPct: pct,
            shiftPixels: L.shift,
            firstXOfShiftedRow: C.startX(L.shift, L.width),
            jointsCrossRows: cl.joinsCrossRows,
            joints: cl.joinsCrossRows ? "cross the row boundaries" : "line up from row to row",
            mortarLinesLevel: cl.linesParallel,
          };
        });
        const byMortar = Array.from({ length: 11 }, (_, sep) => {
          const st = C.withSetting(s, "separation", sep);
          const L = C.layout(st, canvas);
          return {
            separation: sep,
            linesPerBand: L.thickness,
            expectedLines: 2 * sep + 1,
            matchesFormula: L.thickness === 2 * sep + 1 && L.mortar.every((b: { ys: number[] }) => b.ys.length === 2 * sep + 1),
            bricksUnchanged: JSON.stringify(L.bricks) === baseBricks,
          };
        });
        const flat = C.shades(C.withSetting(s, "shadeDiff", 0));
        const contrast = C.shades(C.withSetting(s, "shadeDiff", 255));
        return {
          settings: s,
          canvas,
          byShift,
          byMortar,
          shade: {
            shadeDiff0: flat,
            shadeDiff255: contrast,
            bricksUnchanged: JSON.stringify(C.layout(C.withSetting(s, "shadeDiff", 0), canvas).bricks) === baseBricks,
          },
          note: PERCEPTION_NOTE,
        };
      },
    },
  };
}

/** What the core says about the wall the page saved with Track.state. */
export function position(st: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Brick Wall state version ${stateVersion}`);
  const s = readSettings(st);
  return {
    ...s,
    saved: s,
    stateVersion,
    ...reading(s, PAGE_CANVAS),
    illustration: true,
    note: PERCEPTION_NOTE,
  };
}
