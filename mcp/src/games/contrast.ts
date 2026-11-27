/*
 * run_game_logic actions and saved-position reader for Contrast.
 *
 * Both the actions and position() call the game's real core (contrast/ in the
 * site), copied into src/generated/cores/ at build time. The core recreates
 * ContrastCanvas.Draw: one grey per painted column and one flat grey shared
 * by both bars. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const KEYS = ["width", "height", "minColor", "maxColor", "gap"] as const;
type OptionKey = (typeof KEYS)[number];
type Scrollbars = Record<OptionKey, number>;

interface Grey {
  index: number;
  level: number;
  css: string;
}

interface Frame {
  lo: number;
  hi: number;
  barIndex: number;
  step: number;
  columns: Array<{ x: number; index: number }>;
  pieces: Array<{ x: number; y: number; w: number; h: number; index: number }>;
}

/**
 * The core is plain JS whose defaults are inferred as literal types (500,
 * 80, ...). Widen them here so callers may pass any board size or slider
 * value; the methods themselves are exactly the ones in contrast-core.js.
 */
interface Contrast {
  BOARD: { width: number; height: number };
  DEFAULTS: Scrollbars;
  start(): Scrollbars;
  clampOption(key: string, value: number | string): number;
  gray(index: number): Grey;
  compute(state: Scrollbars, canvasW?: number, canvasH?: number): Frame;
  grayAt(state: Scrollbars, x: number, canvasW?: number): Grey;
  describe(state: Scrollbars, frame: Frame, probe: { x: number; y: number }): string;
}

const core = (): Contrast => cores.contrast.ContrastCore as unknown as Contrast;

const round = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Read the five scrollbars of the applet, each clamped to its own range. */
function scrollbars(C: Contrast, src: Json): Scrollbars {
  const s: Scrollbars = { ...C.start() };
  for (const key of KEYS) s[key] = C.clampOption(key, num(src, key, C.DEFAULTS[key]));
  return s;
}

/** Board size in the core's SVG user units, kept small enough to be safe. */
function boardSize(C: Contrast, src: Json): { w: number; h: number } {
  return {
    w: Math.max(5, Math.min(2000, Math.trunc(num(src, "boardWidth", C.BOARD.width)))),
    h: Math.max(1, Math.min(2000, Math.trunc(num(src, "boardHeight", C.BOARD.height)))),
  };
}

function grey(C: Contrast, index: number): Grey {
  const g = C.gray(index);
  return { index: g.index, level: round(g.level), css: g.css };
}

export function actions(): GameActions {
  return {
    bars: {
      describe:
        "The flat grey painted on both bars and their exact rectangles for the five slider settings. Both pieces always carry floor((lowerGray + upperGray) / 2) on the 0-255 scale; width, height and gap change only their size and position, never their colour.",
      args: '{ "width": 80, "height": 20, "minColor": 20, "maxColor": 235, "gap": 0 }',
      run: (args) => {
        const C = core();
        const s = scrollbars(C, args);
        const { w, h } = boardSize(C, args);
        const f = C.compute(s, w, h);
        const bar = grey(C, f.barIndex);
        const sameGrey = f.pieces.every((p: { index: number }) => p.index === f.barIndex);
        return {
          settings: s,
          board: { width: w, height: h },
          background: {
            lo: f.lo,
            hi: f.hi,
            columnsPainted: f.columns.length,
            greyStep: round(f.step),
            firstColumnGrey: f.columns.length ? f.columns[0].index : null,
            lastColumnGrey: f.columns.length ? f.columns[f.columns.length - 1].index : null,
          },
          bar: {
            ...bar,
            sharedByBothPieces: sameGrey,
            expectedIndex: Math.trunc((f.lo + f.hi) / 2),
            pieces: f.pieces.map((p: { x: number; y: number; w: number; h: number; index: number }) => ({
              x: p.x, y: p.y, width: p.w, height: p.h, index: p.index,
            })),
          },
          note:
            "The rectangles are one flat grey on the pixels. They can look different from one another only because the grey strip behind them changes: that is the simultaneous contrast illusion, not a colour difference in the drawing.",
        };
      },
    },
    gradient: {
      describe:
        "The grey ramp painted behind the bars: one column per board unit, running from the lower slider value at the first column to the upper one at the last, and the grey under a probe point. Even a range one step wide still paints both of its greys; the bar's flat grey and any brief afterimage are separate claims.",
      args: '{ "minColor": 120, "maxColor": 121, "probeX": 250 }',
      run: (args) => {
        const C = core();
        const s = scrollbars(C, args);
        const { w, h } = boardSize(C, args);
        const f = C.compute(s, w, h);
        const px = Math.max(0, Math.min(w, Math.trunc(num(args, "probeX", Math.trunc(w / 2)))));
        const at = (x: number) => grey(C, C.grayAt(s, x, w).index);
        const distinct = [...new Set(f.columns.map((c: { index: number }) => c.index))].sort((a, b) => a - b);
        const samples = [1, Math.trunc(w / 2), w - 3].map((x) => ({ x, ...at(x) }));
        return {
          settings: { minColor: s.minColor, maxColor: s.maxColor, boardWidth: w },
          board: { width: w, height: h },
          ramp: {
            lo: f.lo,
            hi: f.hi,
            range: f.hi - f.lo,
            columnsPainted: f.columns.length,
            greyStep: round(f.step),
            firstColumn: f.columns.length ? { x: f.columns[0].x, ...grey(C, f.columns[0].index) } : null,
            lastColumn: f.columns.length ? { x: f.columns[f.columns.length - 1].x, ...grey(C, f.columns[f.columns.length - 1].index) } : null,
            distinctGreys: distinct.length,
            samples,
          },
          probe: { x: px, ...at(px) },
          oneStepRangePaintsBothEnds: f.hi - f.lo === 1 ? distinct.length === 2 : null,
          note:
            "Column x uses round(lo + (x - 1) * (hi - lo) / (w - 4)), so the ends hit the two slider values exactly. The bar itself stays one grey: a full-board bar that seems to shade for a few seconds is an afterimage in the eye, which this drawing code neither paints nor times.",
        };
      },
    },
  };
}

/** What the core says about the five sliders and probe dot Track.state saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Contrast state version ${stateVersion}`);
  }
  const C = core();
  const saved: Json = { ...state, stateVersion };
  let s: Scrollbars;
  let probe: { x: number; y: number };
  try {
    s = scrollbars(C, state);
    const p = state.probe;
    if (p === undefined || p === null || typeof p !== "object" || Array.isArray(p)) {
      throw new Error('saved "probe" must be an object with x and y');
    }
    probe = {
      x: num(p as Json, "x", Math.trunc(C.BOARD.width / 2)),
      y: num(p as Json, "y", C.BOARD.height - 10),
    };
  } catch (err) {
    return {
      ...saved,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "The saved position needs five integer scrollbars (width, height, minColor, maxColor, gap) and a probe point.",
    };
  }

  const f = C.compute(s);
  const bar = grey(C, f.barIndex);
  const under = grey(C, C.grayAt(s, probe.x).index);
  const sameGrey = f.pieces.every((piece: { index: number }) => piece.index === f.barIndex);
  return {
    ...saved,
    stateVersion,
    valid: true,
    barGray: bar.index,
    barColour: bar.css,
    bothBarsShareOneGrey: sameGrey,
    background: {
      lo: f.lo,
      hi: f.hi,
      columnsPainted: f.columns.length,
      greyStep: round(f.step),
      firstColumnGrey: f.columns.length ? f.columns[0].index : null,
      lastColumnGrey: f.columns.length ? f.columns[f.columns.length - 1].index : null,
    },
    probeGrey: under.index,
    probeColour: under.css,
    status: C.describe(s, f, probe),
    note:
      "Track.state saved the five scrollbars and the probe dot. The core rebuilds the ramp and reads the grey under the probe; both bars remain the single flat grey floor((lo + hi) / 2), so any difference in how they look is the simultaneous contrast illusion, not a difference in pixels.",
  };
}
