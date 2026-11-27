/*
 * run_game_logic actions and saved-position reader for Delboeuf.
 *
 * Both the actions and position() call the game's real core
 * (delboeuf/delboeuf-core.js in the site), copied into src/generated/cores/
 * at build time. The core recreates DelboeufCanvas.Draw/DrawOval: two coloured
 * rings of identical radius and width, one inside a bigger black ring and one
 * around a smaller black circle. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Slider = "MR" | "DR" | "WR" | "CI" | "Ci";
type Point = { x: number; y: number };
type State = Record<Slider, number> & { probe?: Point };
type Oval = { id: string; cx: number; cy: number; r: number; thickness: number; palette: string };

interface Geometry {
  unit: number;
  s4: number;
  s5: number;
  s6: number;
  mid: number;
  leftX: number;
  rightX: number;
  ovals: Oval[];
  band: { y1: number; y2: number };
}

interface Frame extends Omit<Geometry, "band"> {
  band: { y1: number; y2: number; color?: string } | null;
  colors: { background: string; foreground: string; target: string; band: string | null };
  targetRGB: number[];
  bandRGB: number[] | null;
}

/** The plain JS core's defaults are literal types; widen them for callers. */
interface Delboeuf {
  BOARD: { width: number; height: number };
  DEFAULTS: State;
  LIMITS: Record<Slider, [number, number]>;
  OPTIONS: readonly Slider[];
  start(): State;
  option(state: State, key: Slider, value: number | string): State;
  clampOption(key: Slider, value: number | string): number;
  geometry(state: State, canvasW?: number, canvasH?: number): Geometry;
  compute(
    state: State,
    canvasW?: number,
    canvasH?: number,
    background?: number[] | null,
    foreground?: number[] | null,
  ): Frame;
  describe(state: State, frame: Frame, probe?: Point | null): string;
}

const core = (): Delboeuf => cores["delboeuf"].DelboeufCore as unknown as Delboeuf;
const round = (v: number): number => Math.round(v * 1e6) / 1e6;

const NAMES: Record<string, string> = {
  leftOuter: "the ring around the left circle",
  leftTarget: "the left coloured circle",
  rightTarget: "the right coloured circle",
  rightInner: "the small circle inside the right one",
};

/** A scrollbar must be an integer inside the applet's own AWT range. */
function slider(C: Delboeuf, args: Json, key: Slider, fallback: number): number {
  const value = num(args, key, fallback);
  const [min, max] = C.LIMITS[key];
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`argument "${key}" must be an integer in ${min}..${max}, got ${value}`);
  }
  return value;
}

function options(C: Delboeuf, args: Json): State {
  const s = C.start();
  for (const key of C.OPTIONS) s[key] = slider(C, args, key, s[key]);
  return s;
}

function boardSize(C: Delboeuf, args: Json): { w: number; h: number } {
  return {
    w: Math.max(5, Math.min(2000, Math.trunc(num(args, "boardWidth", C.BOARD.width)))),
    h: Math.max(1, Math.min(2000, Math.trunc(num(args, "boardHeight", C.BOARD.height)))),
  };
}

function probePoint(value: unknown, w: number, h: number): Point {
  if (value === undefined || value === null) return { x: Math.trunc(w / 2), y: h - 32 };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error('argument "probe" must be an object with x and y');
  }
  const p = value as Json;
  const x = num(p, "x", Math.trunc(w / 2));
  const y = num(p, "y", h - 32);
  return {
    x: Math.max(0, Math.min(w, x)),
    y: Math.max(0, Math.min(h, y)),
  };
}

function oval(o: Oval) {
  const half = Math.trunc(o.thickness / 2);
  return {
    id: o.id,
    name: NAMES[o.id] ?? o.id,
    cx: o.cx,
    cy: o.cy,
    radius: o.r,
    edgeWidth: o.thickness,
    paintedOuterRadius: o.r + half,
    paintedInnerRadius: o.r - half,
    palette: o.palette,
  };
}

/** The nearest ring to a probe, as the core's describe() chooses one. */
function nearest(f: Frame, p: Point) {
  const away = (o: Oval) => Math.abs(Math.hypot(p.x - o.cx, p.y - o.cy) - o.r);
  const o = f.ovals.slice().sort((a, b) => away(a) - away(b))[0];
  return { id: o.id, name: NAMES[o.id] ?? o.id, radius: o.r, distanceToEdge: round(away(o)) };
}

/** The coloured pair and its two neighbours, all read from the core's frame. */
function reading(f: Frame) {
  const left = f.ovals[1];
  const right = f.ovals[2];
  const outer = f.ovals[0];
  const inner = f.ovals[3];
  return {
    steps: { unit: f.unit, s4: f.s4, s5: f.s5, s6: f.s6, mid: f.mid, leftX: f.leftX, rightX: f.rightX },
    colouredRings: [oval(left), oval(right)],
    colouredRingsIdentical:
      left.r === right.r && left.thickness === right.thickness && left.cx !== right.cx,
    targetColour: f.colors.target,
    neighbours: {
      leftOuter: {
        ...oval(outer),
        biggerThanColoured: outer.r > left.r,
        extraRadiusFromS6: outer.r - left.r,
        coincidesWithColoured: outer.r === left.r,
      },
      rightInner: {
        ...oval(inner),
        smallerThanColoured: inner.r < right.r,
        hasPositiveRadius: inner.r > 0,
      },
    },
  };
}

export function actions(): GameActions {
  return {
    equal_rings: {
      describe:
        "Draw the four rings for the five slider settings and report the applet's own numbers. The two coloured circles are always drawn with the same radius s4 + s5, the same edge width s5 and the same colour; only the black ring outside the left one (radius s4 + s5 + s6) and the small circle inside the right one (radius s4 - s6 - s5) change. An optional probe reads the nearest ring.",
      args: '{ "MR": 50, "DR": 10, "WR": 10, "CI": 255, "Ci": 0, "probe": { "x": 155, "y": 268 } }',
      run: (args) => {
        const C = core();
        const s = options(C, args);
        const { w, h } = boardSize(C, args);
        const f = C.compute(s, w, h);
        const p = probePoint(args.probe, w, h);
        const r = reading(f);
        return {
          settings: { MR: s.MR, DR: s.DR, WR: s.WR, CI: s.CI, Ci: s.Ci },
          board: { width: w, height: h },
          ...r,
          guideLines: f.band,
          guideShade: f.colors.band,
          probe: { ...p, nearest: nearest(f, p) },
          status: C.describe(s, f, p),
          note:
            "The coloured pair is one recipe painted twice, so no pixel test can tell them apart: that is the point of the illusion. The eye reads their sizes against different neighbours. Edge cases of Java rounding: when s6 = 0 the left outer ring has exactly the coloured radius, and when the inner radius is not positive the applet paints no small circle.",
        };
      },
    },
    assimilation_sweep: {
      describe:
        "Check the page's two claims over every setting of the three size sliders (MR 10-100, DR 1-50, WR 10-50), using the core's geometry for each one. Reports whether the coloured pair is identical in all settings, how often rounding to s6 = 0 makes the outer oval share the coloured radius instead of surrounding it, how often the inner circle has no positive radius, and sample settings for both edge cases. `limit` caps the number of examples (default 8).",
      args: '{ "limit": 8 }',
      run: (args) => {
        const C = core();
        const limit = num(args, "limit", 8);
        if (!Number.isInteger(limit) || limit < 0 || limit > 50) {
          throw new Error(`argument "limit" must be an integer in 0..50, got ${limit}`);
        }
        const base = C.start();
        const [mrMin, mrMax] = C.LIMITS.MR;
        const [drMin, drMax] = C.LIMITS.DR;
        const [wrMin, wrMax] = C.LIMITS.WR;
        let total = 0;
        let identical = 0;
        let outerCoincides = 0;
        let innerNonPositive = 0;
        let innerNotSmaller = 0;
        const outerExamples: Json[] = [];
        const innerExamples: Json[] = [];
        for (let MR = mrMin; MR <= mrMax; MR++) {
          for (let DR = drMin; DR <= drMax; DR++) {
            for (let WR = wrMin; WR <= wrMax; WR++) {
              const f = C.geometry({ ...base, MR, DR, WR });
              const target = f.ovals[1];
              const outer = f.ovals[0];
              const inner = f.ovals[3];
              total++;
              if (target.r === f.ovals[2].r && target.thickness === f.ovals[2].thickness) identical++;
              if (outer.r === target.r) {
                outerCoincides++;
                if (outerExamples.length < limit) {
                  outerExamples.push({ MR, DR, WR, s4: f.s4, s5: f.s5, s6: f.s6, colouredRadius: target.r, outerRadius: outer.r });
                }
              }
              if (inner.r <= 0) {
                innerNonPositive++;
                if (innerExamples.length < limit) {
                  innerExamples.push({ MR, DR, WR, s4: f.s4, s5: f.s5, s6: f.s6, colouredRadius: target.r, innerRadius: inner.r });
                }
              }
              if (inner.r >= target.r) innerNotSmaller++;
            }
          }
        }
        const extreme = C.geometry({ ...base, MR: mrMin, DR: drMax, WR: wrMax });
        return {
          board: C.BOARD,
          scanned: { MR: [mrMin, mrMax], DR: [drMin, drMax], WR: [wrMin, wrMax], settings: total },
          colouredPair: { identicalInEverySetting: identical === total, identical, total },
          neighbours: {
            outerBigger: total - outerCoincides,
            outerCoincidesWithColoured: outerCoincides,
            innerPositive: total - innerNonPositive,
            innerNotPositive: innerNonPositive,
            innerNeverSmallerFailures: innerNotSmaller,
          },
          outerCoincideExamples: outerExamples,
          innerNotPositiveExamples: innerExamples,
          mostExtreme: {
            MR: mrMin, DR: drMax, WR: wrMax,
            s4: extreme.s4, s5: extreme.s5, s6: extreme.s6,
            colouredRadius: extreme.ovals[1].r,
            innerRadius: extreme.ovals[3].r,
            note: "Java asks for an oval with a negative size and paints nothing, so the page hides that ring.",
          },
          note:
            "The page calls this an assimilation illusion: copies of a shape seem to take on properties of their surroundings. The pixels never change across the pair; only their neighbours do. The outer-bigger claim fails exactly when round(s4 * DR / 100) = 0, so s6 = 0 and the black ring lies on top of the coloured one; the smaller-inside claim fails only when the inner radius is zero or negative.",
        };
      },
    },
  };
}

/** What the core says about the five sliders and probe dot Track.state saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Delboeuf state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Delboeuf position must be an object");
  }
  const C = core();
  const saved: Json = { ...state, stateVersion };
  try {
    const s = C.start();
    for (const key of C.OPTIONS) s[key] = C.clampOption(key, num(state, key, s[key]));
    const p = probePoint(state.probe, C.BOARD.width, C.BOARD.height);
    const f = C.compute(s);
    const r = reading(f);
    const clamped = C.OPTIONS.filter((key) => s[key] !== Number(state[key]));
    return {
      ...saved,
      stateVersion,
      valid: true,
      settings: { MR: s.MR, DR: s.DR, WR: s.WR, CI: s.CI, Ci: s.Ci },
      clampedFromSaved: clamped,
      board: C.BOARD,
      ...r,
      guideLines: f.band,
      guideShade: f.colors.band,
      colours: f.colors,
      probe: { ...p, nearest: nearest(f, p) },
      status: C.describe(s, f, p),
      note:
        "Track.state saved the five sliders and the probe dot. The core rebuilds the four rings from those values and reads the nearest ring to the probe; the two coloured circles still share one radius and edge width, so their apparent difference is the assimilation illusion, not a difference in the drawing.",
    };
  } catch (err) {
    return {
      ...saved,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "A saved Delboeuf position needs five integer slider values (MR, DR, WR, CI, Ci) and a probe point with x and y.",
    };
  }
}
