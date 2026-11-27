/*
 * run_game_logic actions and saved-position reader for Contrast 4.
 *
 * Each answer comes from the game's real core (contrast-4/ in the site),
 * copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape. This is an optical illusion, not a game with a win or loss:
 * the core reports the geometry, the greys and the averaging arithmetic.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["contrast-4"].Contrast4Core;

type Band = { x: number; y: number; w: number; h: number; dark: boolean };
type Patch = { band: number; x: number; y: number; w: number; h: number; row: string };

export function actions(): GameActions {
  return {
    picture: {
      describe:
        "The six alternating vertical bands and the six identical grey patches the applet draws from the five slider values: where each band and patch sits, and the exact fill of every patch. All six patches are painted the very same grey, three high on dark bands and three low on light bands.",
      args: '{ "w": 50, "h": 50, "gray": 50, "min": 0, "max": 100 }',
      run: (args) => {
        const C = core();
        const s = C.start({
          w: num(args, "w", 50),
          h: num(args, "h", 50),
          gray: num(args, "gray", 50),
          min: num(args, "min", 0),
          max: num(args, "max", 100),
        });
        const g = C.geometry(s);
        const fills = C.colors(s);
        const bands = g.bands as Band[];
        const patches = g.patches as Patch[];
        return {
          options: { w: s.w, h: s.h, gray: s.gray, min: s.min, max: s.max },
          canvas: { width: s.width, height: s.height },
          bands: bands.map((b, i) => ({
            index: i + 1, shade: b.dark ? "dark" : "light",
            x: b.x, y: b.y, w: b.w, h: b.h,
          })),
          patches: patches.map((p, i) => ({
            index: i + 1, band: p.band + 1, row: p.row,
            x: p.x, y: p.y, w: p.w, h: p.h, fill: fills.patch,
          })),
          bandWidth: g.bandWidth,
          patchHeight: g.patchHeight,
          fills,
          allPatchesSameGrey: true,
          status: C.describe(s),
          why:
            "The six full-height bands alternate dark and light, but the six patches on top are all one shade. " +
            "The apparent difference in lightness is made by the eye comparing each patch with its band, not by the pixels.",
        };
      },
    },
    average: {
      describe:
        "The averaging arithmetic behind the illusion: the mean of the dark and light band slider values, the one patch slider value, and their difference. The eye reads each patch as a blend of its surroundings even though the core paints all six patches one shade.",
      args: '{ "min": 0, "max": 100, "gray": 50 }',
      run: (args) => {
        const C = core();
        const min = num(args, "min", 0);
        const max = num(args, "max", 100);
        const gray = num(args, "gray", 50);
        const s = C.start({ min, max, gray });
        const average = C.averageShade(s);
        const fills = C.colors(s);
        return {
          min, max, average,
          patchSlider: gray,
          patchGrey: fills.patch,
          darkBandGrey: fills.dark,
          lightBandGrey: fills.light,
          patchMinusAverage: gray - average,
          why:
            `The mean of the two band shades is (${min} + ${max}) / 2 = ${average}, ` +
            `while the patch is set to ${gray}. The patch is ${gray === average ? "exactly at" : `${gray - average} away from`} that mean, ` +
            "yet it looks lighter on a dark band and darker on a light band.",
        };
      },
    },
  };
}

/** What the core says about the five sliders and the selected patch the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Contrast 4 state version ${stateVersion}`);
  const C = core();
  const saved = {
    w: num(state, "w", 50),
    h: num(state, "h", 50),
    gray: num(state, "gray", 50),
    min: num(state, "min", 0),
    max: num(state, "max", 100),
    width: num(state, "width", 400),
    height: num(state, "height", 400),
    selected: num(state, "selected", 0),
  };
  const s = C.start({ w: saved.w, h: saved.h, gray: saved.gray, min: saved.min, max: saved.max });
  const g = C.geometry(s);
  const fills = C.colors(s);
  const average = C.averageShade(s);
  const patches = g.patches as Patch[];
  const bands = g.bands as Band[];
  const idx = Math.max(0, Math.min(patches.length - 1, Math.round(saved.selected)));
  const sel = patches[idx];
  const selBand = bands[sel.band];
  return {
    stateVersion,
    state: saved,
    fills,
    averageShade: average,
    patchMinusAverage: saved.gray - average,
    bandCount: g.count,
    patchCount: patches.length,
    selectedPatch: {
      index: idx + 1,
      row: sel.row,
      onBand: selBand.dark ? "dark" : "light",
      fill: fills.patch,
    },
    status: C.describe(s),
    note:
      "Track.state saved the five slider values and which of the six patches is selected. " +
      "The core rebuilds the six alternating bands and the six patches, all painted the same grey; " +
      "the eye reads each patch against its band, but the pixels never change.",
  };
}
