/*
 * Tutor actions and saved-position reader for Contrast 2 (White's illusion).
 *
 * Both use the game's real core (contrast-2/contrast-2-core.js in the site),
 * copied into src/generated/cores/ at build time. See _shared.ts for the shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["contrast-2"].Contrast2Core;

/** The seven saved scrollbar/canvas values, validated through the core. */
function settingsFrom(args: Json) {
  const C = core();
  return C.start({
    width: num(args, "width", C.DEFAULT_WIDTH),
    height: num(args, "height", C.DEFAULT_HEIGHT),
    W: num(args, "W", C.DEFAULTS.W),
    H: num(args, "H", C.DEFAULTS.H),
    gray: num(args, "gray", C.DEFAULTS.gray),
    min: num(args, "min", C.DEFAULTS.min),
    max: num(args, "max", C.DEFAULTS.max),
  });
}

/** The row a saved sample dot points at: left patches on 0,2,4, right on 1,3,5. */
function sampleRow(value: unknown, column: "left" | "right") {
  const N = core().N;
  const n = Number(value);
  const row = Number.isFinite(n) ? Math.round(n) : column === "left" ? 0 : 1;
  const even = Math.max(0, Math.min(N - 2, Math.round(row / 2) * 2));
  return column === "left" ? even : Math.max(1, Math.min(N - 1, even + 1));
}

export function actions(): GameActions {
  const C = core();
  return {
    picture: {
      describe:
        "Read White's illusion in its horizontal form for a set of scrollbar values: six alternating dark/light bands across the canvas and six small gray patches, three in a left column on dark bands and three in a right column on light bands. Reports every band and patch with its painted shade byte, and checks that all six patches really share the one gray value (the apparent difference is in the eye, not the pixels).",
      args: '{ "width": 400, "height": 300, "W": 50, "H": 50, "gray": 50, "min": 0, "max": 100 }',
      run: (args) => {
        const view = C.analyze(settingsFrom(args));
        const patchShades = view.patches.map((p: { shadeByte: number }) => p.shadeByte);
        return {
          settings: view.settings,
          geometry: {
            bandHeight: view.bandHeight,
            top: view.top,
            span: view.span,
            patchWidth: 2 * view.halfPatch,
            columnLeft: view.columnLeft,
            columnRight: view.columnRight,
          },
          bands: view.bands.map((b: { index: number; band: string; shadeByte: number; y: number }) => ({
            row: b.index + 1, kind: b.band, shadeByte: b.shadeByte, y: b.y,
          })),
          patches: view.patches.map((p: { index: number; column: string; band: number; shadeByte: number; x: number; y: number }) => ({
            patch: p.index + 1, column: p.column, bandRow: p.band + 1, shadeByte: p.shadeByte, x: p.x, y: p.y,
          })),
          shades: view.shades,
          everyPatchSameShade: patchShades.every((b: number) => b === patchShades[0]),
          outOfRange: view.outOfRange,
          note: "The six patches are all filled with one gray value; the bands behind them are what makes two shades seem to appear. Scrollbars above 100% are capped at white here, with outOfRange reporting the overflow.",
        };
      },
    },
    shade: {
      describe:
        "The gray byte (0–255) that java.awt.Color(float) paints for a scrollbar percent, including its rounded 32-bit float arithmetic. Above 100% the original applet threw and stopped repainting; here the value is capped at white (255), and the cap is reported.",
      args: '{ "percent": 70 }',
      run: (args) => {
        const percent = num(args, "percent", 50);
        const byte = C.shadeByte(percent);
        const examples: Record<string, number> = {};
        for (const p of [0, 25, 50, 70, 90, 100, 105]) examples[String(p)] = C.shadeByte(p);
        return {
          percent,
          shadeByte: byte,
          cappedAtWhite: percent > 100,
          cappedByte: C.shadeByte(Math.min(100, percent)),
          examples,
          note: "The conversion is floor(fround(fround(p/100) * 255) + 0.5): 70% gives 179 and 90% gives 230. Nothing above 100% is a valid java.awt.Color, so this port paints white and flags the overflow instead.",
        };
      },
    },
  };
}

/**
 * What the core says about a picture the page saved with Track.state: the
 * saved scrollbars and sample dots, the six bands and patches they produce,
 * and the shade under each of the two sample dots.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Contrast 2 state version ${stateVersion}`);
  const C = core();
  const view = C.analyze(settingsFrom(state));
  const leftRow = sampleRow(state.sampleLeft, "left");
  const rightRow = sampleRow(state.sampleRight, "right");
  const patchShades = view.patches.map((p: { shadeByte: number }) => p.shadeByte);
  const sample = (row: number) => {
    const patch = view.patches[row];
    const band = view.bands[row];
    return {
      patch: patch.index + 1,
      column: patch.column,
      bandRow: patch.band + 1,
      behindBand: band.band,
      behindShadeByte: band.shadeByte,
      patchShadeByte: patch.shadeByte,
      onA: band.band === "min" ? "dark" : "light",
    };
  };
  return {
    stateVersion,
    saved: {
      width: view.settings.width,
      height: view.settings.height,
      W: view.settings.W,
      H: view.settings.H,
      gray: view.settings.gray,
      min: view.settings.min,
      max: view.settings.max,
      sampleLeft: state.sampleLeft ?? null,
      sampleRight: state.sampleRight ?? null,
    },
    reading: {
      bandHeight: view.bandHeight,
      top: view.top,
      span: view.span,
      patchWidth: 2 * view.halfPatch,
      bands: view.bands.map((b: { index: number; band: string; shadeByte: number }) => ({
        row: b.index + 1, kind: b.band, shadeByte: b.shadeByte,
      })),
      patches: view.patches.map((p: { index: number; column: string; band: number; shadeByte: number }) => ({
        patch: p.index + 1, column: p.column, bandRow: p.band + 1, shadeByte: p.shadeByte,
      })),
      shades: view.shades,
      everyPatchSameShade: patchShades.every((b: number) => b === patchShades[0]),
      outOfRange: view.outOfRange,
      samples: { left: sample(leftRow), right: sample(rightRow) },
    },
    note: "All six gray patches are painted with the one gray value; three lie on dark bands and three on light bands, which is why they look different. This is a demo: there is no win, loss or finishing move.",
  };
}
