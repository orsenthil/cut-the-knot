/*
 * run_game_logic actions and saved-position reader for Judd Illusion.
 *
 * The core (judd-illusion/ in the site, copied into src/generated/cores/ at
 * build time) draws one horizontal bar with four end-arrow strokes and a
 * middle mark. Its numbers come straight from the applet's Draw, Arrow and
 * Bob methods: c = round(w(100 - 2L)/200), the bar runs from c - 20 to
 * w - c - 20, and the mark sits at trunc(w/2) - 20. On an even canvas width
 * that is exactly the middle, so the two halves are equal in pixels; on an
 * odd width Java's truncation makes the right half one unit longer. Whether
 * the halves look equal is perception, not a pixel fact. This is a demo with
 * no win or loss; its saved state is five slider values, a mark toggle and a
 * draggable probe point. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Key = "L" | "W" | "H" | "A" | "B";
type Setting = { L: number; W: number; H: number; A: number; B: number; bob: boolean; probe: Pt };
type Canvas = { width: number; height: number };
type Line = { x1: number; y1: number; x2: number; y2: number };
type Arrow = { base: Pt; tip: Pt; sign: number; lines: Line[] };
type Frame = {
  mid: number;
  c: number;
  bar: { x: number; y: number; width: number; height: number };
  leftX: number;
  rightX: number;
  centerX: number;
  arrows: { leftUp: Arrow; leftDown: Arrow; rightUp: Arrow; rightDown: Arrow };
  marker: { kind: string; x: number; lines: Line[] };
  lines: Line[];
  halves: { left: number; right: number };
};
type Core = {
  BOARD: { width: number; height: number };
  DEFAULTS: Setting;
  SCROLLBAR_START: { L: number; W: number; H: number; A: number; B: number };
  LIMITS: Record<Key, readonly [number, number]>;
  OPTIONS: readonly Key[];
  javaRound(x: number): number;
  clampOption(key: Key, value: number): number;
  start(): Setting;
  option(state: Setting, key: Key | "bob", value: number | boolean): Setting;
  geometry(state: Setting, canvasW?: number, canvasH?: number): Frame;
  describe(state: Setting, frame: Frame, probe?: Pt | null): string;
};

const core = (): Core => cores["judd-illusion"].JuddIllusionCore as unknown as Core;
const KEYS = ["L", "W", "H", "A", "B"] as const;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** Positive integer canvas size, defaulting to the page's 500 x 300 viewBox. */
function readCanvas(args: Json, C: Core): Canvas {
  const width = num(args, "canvasWidth", C.BOARD.width);
  const height = num(args, "canvasHeight", C.BOARD.height);
  if (!Number.isInteger(width) || width < 2 || width > 4000 ||
      !Number.isInteger(height) || height < 1 || height > 4000) {
    throw new Error("canvasWidth must be a whole number from 2 to 4000 and canvasHeight from 1 to 4000");
  }
  return { width, height };
}

/** A probe point as the page saved it ({x, y}) or as [x, y]. */
function readProbe(raw: unknown, fallback: Pt): Pt {
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error('"probe" must be [x, y]');
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else if (isObj(raw)) {
    x = Number(raw.x);
    y = Number(raw.y);
  } else {
    throw new Error('"probe" must be [x, y] or { "x": ..., "y": ... }');
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('"probe" needs finite numeric x and y');
  }
  return { x, y };
}

/**
 * The five scrollbar values plus the mark toggle, each checked against the
 * core's own applet ranges before the real core applies it.
 */
function readSetting(args: Json, C: Core): Setting {
  let state = C.start();
  for (const key of KEYS) {
    const range = C.LIMITS[key];
    const value = num(args, key, C.DEFAULTS[key]);
    if (!Number.isInteger(value) || value < range[0] || value > range[1]) {
      throw new Error(`"${key}" must be a whole number between ${range[0]} and ${range[1]}, got ${value}`);
    }
    state = C.option(state, key, value);
  }
  const bob = args.bob === undefined ? state.bob : args.bob;
  if (typeof bob !== "boolean") throw new Error('"bob" must be true or false');
  state = C.option(state, "bob", bob);
  state = { ...state, probe: readProbe(args.probe, state.probe) };
  return state;
}

/** The pixel facts of one frame, all measured by the core. */
function summary(C: Core, setting: Setting, canvas: Canvas, f: Frame) {
  const lean = f.arrows.leftUp.tip.x - f.arrows.leftUp.base.x;
  return {
    setting: { L: setting.L, W: setting.W, H: setting.H, A: setting.A, B: setting.B, bob: setting.bob },
    canvas: { width: canvas.width, height: canvas.height, mid: f.mid },
    bar: {
      x: f.bar.x, y: f.bar.y, width: f.bar.width, height: f.bar.height,
      leftEnd: f.leftX, rightEnd: f.rightX,
    },
    mark: { x: f.centerX, kind: f.marker.kind, strokeCount: f.marker.lines.length },
    halves: {
      left: f.halves.left,
      right: f.halves.right,
      equal: f.halves.left === f.halves.right,
      difference: f.halves.right - f.halves.left,
    },
    arrows: {
      tipLeanX: lean,
      direction: lean > 0 ? "right" : lean < 0 ? "left" : "straight up and down",
      strokesPerArrow: setting.B,
      arrowHeight: setting.H,
    },
  };
}

export function actions(): GameActions {
  return {
    geometry_report: {
      describe:
        "For the Judd Illusion with bar inset `L`, half-thickness `W`, arrow height `H`, slant `A` and `B` strokes (toggle `bob` for a rectangle instead of an arrow-head mark), report the pixels the core actually draws: a bar from c-20 to w-c-20, a mark at trunc(w/2)-20 and arrows whose tips lean by A. On an even canvas width the mark splits the bar into equal halves; the neighbouring odd width shows Java's truncation quirk, where the right half is one unit longer. How equal the halves look is perception and cannot be measured from the drawing.",
      args: '{ "L": 20, "W": 5, "H": 50, "A": 10, "B": 10, "bob": true }',
      run: (args) => {
        const C = core();
        const setting = readSetting(args, C);
        const canvas = readCanvas(args, C);
        const f = C.geometry(setting, canvas.width, canvas.height);
        // Compare with the adjacent width: same sliders, opposite parity.
        const otherWidth = canvas.width % 2 === 0 ? canvas.width + 1 : canvas.width - 1;
        const other = C.geometry(setting, otherWidth, canvas.height);
        return {
          ...summary(C, setting, canvas, f),
          inset: f.c,
          description: C.describe(setting, f, null),
          oddWidthQuirk: {
            neighbouringWidth: otherWidth,
            inset: other.c,
            markX: other.centerX,
            halves: other.halves,
            difference: other.halves.right - other.halves.left,
            note:
              `At width ${otherWidth} (${otherWidth % 2 === 0 ? "even" : "odd"}) the mark is at ${other.centerX} and the halves are ` +
              `${other.halves.left} and ${other.halves.right}: a difference of ${other.halves.right - other.halves.left}. ` +
              "Java's trunc(w/2) shifts the mark half a unit left of the true bar midpoint on odd widths, a drawing quirk kept from the applet.",
          },
          perception:
            "The two halves really are the same length in pixels on an even width; the arrow heads change how long they look, which no coordinate can measure.",
        };
      },
    },

    move_slider: {
      describe:
        "Move one Judd Illusion slider (`L`, `W`, `H`, `A` or `B`) to `value`, or set `bob` to true/false, from a starting picture and report how the bar, mark and halves change. The key and value are checked against the applet's own scrollbar ranges (or a boolean for `bob`) before the real core applies them.",
      args: '{ "L": 20, "W": 5, "H": 50, "A": 10, "B": 10, "bob": true, "key": "A", "value": -30 }',
      run: (args) => {
        const C = core();
        const before = readSetting(args, C);
        const canvas = readCanvas(args, C);
        const key = String(args.key);
        if (key === "bob") {
          if (typeof args.value !== "boolean") throw new Error('"value" for "bob" must be true or false');
        } else {
          if (!(KEYS as readonly string[]).includes(key)) {
            throw new Error(`"key" must be one of ${KEYS.join(", ")} or bob, got ${JSON.stringify(args.key)}`);
          }
          const range = C.LIMITS[key as Key];
          const value = num(args, "value");
          if (!Number.isInteger(value) || value < range[0] || value > range[1]) {
            throw new Error(`"value" must be a whole number between ${range[0]} and ${range[1]}, got ${value}`);
          }
        }
        const after = C.option(before, key as Key | "bob", args.value as number | boolean);
        const fBefore = C.geometry(before, canvas.width, canvas.height);
        const fAfter = C.geometry(after, canvas.width, canvas.height);
        const notes: Record<string, string> = {
          L: "Only the bar's inset changes: both halves grow or shrink together and stay equal on an even width.",
          W: "Only the bar's thickness and the arrows' base line change; the ends, mark and halves stay put.",
          H: "Only the arrow height changes; the bar and its halves stay exactly where they were.",
          A: "Only the tips' lean changes; the bar and its halves stay fixed. The applet's A scrollbar starts at 30 but the opening picture uses A = 10 until a control moves.",
          B: "Only the number of parallel strokes changes; the arrows' ends and the bar stay fixed.",
          bob: "Only the middle mark changes shape, from a short rectangle to an arrow head or back; the bar and its halves are identical.",
        };
        return {
          key,
          applied: key === "bob" ? after.bob : after[key as Key],
          before: summary(C, before, canvas, fBefore),
          after: summary(C, after, canvas, fAfter),
          barUnchanged:
            fBefore.bar.x === fAfter.bar.x && fBefore.bar.width === fAfter.bar.width &&
            fBefore.bar.y === fAfter.bar.y && fBefore.bar.height === fAfter.bar.height,
          halvesUnchanged:
            fBefore.halves.left === fAfter.halves.left && fBefore.halves.right === fAfter.halves.right,
          note: notes[key],
        };
      },
    },
  };
}

/** The saved fields, plus the core's reading of the picture on screen. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Judd Illusion state version ${stateVersion}`);
  const C = core();
  const canvas = { width: C.BOARD.width, height: C.BOARD.height };
  try {
    const setting = readSetting(state, C);
    const f = C.geometry(setting, canvas.width, canvas.height);
    return {
      ...state,
      stateVersion,
      L: setting.L, W: setting.W, H: setting.H, A: setting.A, B: setting.B,
      bob: setting.bob,
      probe: setting.probe,
      valid: true,
      ...summary(C, setting, canvas, f),
      c: f.c,
      description: C.describe(setting, f, setting.probe),
      note:
        `Track.state saved L ${setting.L}, W ${setting.W}, H ${setting.H}, A ${setting.A}, B ${setting.B} ` +
        `${setting.bob ? "with a rectangular middle mark" : "with an arrow-head middle mark"}. ` +
        `The core rebuilds the ${f.bar.width}-unit bar with halves ${f.halves.left} and ${f.halves.right} units long: ` +
        `${f.halves.left === f.halves.right ? "equal in pixels on this even-width board" : "one unit apart from Java's odd-width truncation"}. ` +
        "Whether the eye agrees is perception; this illustration has no win or loss.",
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note:
        "A saved Judd Illusion position needs integer L 10-45, W 0-20, H 10-110, A -90-90 and B 1-40, plus optional bob and probe {x, y}.",
    };
  }
}
