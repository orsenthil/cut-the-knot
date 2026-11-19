/*
 * run_game_logic actions and saved-position reader for Area of a Circle.
 *
 * Each answer comes from the game's real core (area-of-circle/ in the site),
 * copied into src/generated/cores/ at build time. See _shared.ts for the shape.
 * This is a demonstration, not a game: the actions report the geometry behind
 * the picture, and the reader describes the row a player is looking at.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["area-of-circle"].AreaOfCircleCore;

function readSectors(args: Json, key = "sectors") {
  const C = core();
  const sectors = num(args, key);
  if (!Number.isInteger(sectors) || sectors < C.MIN_SECTORS || sectors > C.MAX_SECTORS) {
    throw new Error(`sectors must be ${C.MIN_SECTORS} to ${C.MAX_SECTORS}`);
  }
  return sectors;
}

export function actions(): GameActions {
  return {
    cut_and_rearrange: {
      describe:
        "For a number of equal slices and a radius, describe the cut circle and the rearranged row: the two curved bases, the height, the width and how close they are to pi*r and r.",
      args: '{ "sectors": 6, "radius": 10 }',
      run: (args) => {
        const C = core();
        const sectors = readSectors(args);
        const radius = num(args, "radius", 10);
        if (!(radius > 0)) throw new Error("radius must be positive");
        const g = C.geometry({ sectors }, radius);
        const even = sectors % 2 === 0;
        return {
          sectors,
          radius,
          sectorAngleDegrees: g.sectorAngle * 180 / Math.PI,
          arcPerSlice: g.arcLength,
          topSlices: g.topCount,
          bottomSlices: g.bottomCount,
          topBase: g.topBase,
          bottomBase: g.bottomBase,
          basesTotal: g.topBase + g.bottomBase,
          circumference: g.circumference,
          height: g.height,
          width: g.width,
          circleArea: Math.PI * radius * radius,
          rowBoundingArea: g.width * g.height,
          note: even
            ? `With ${sectors} slices the two curved bases are equal (each pi*r) and the row is a curvilinear parallelogram.`
            : `With ${sectors} slices the top has one more arc than the bottom, so the row is a curvilinear trapezoid.`,
        };
      },
    },
    approach_rectangle: {
      describe:
        "Show how the rearranged row approaches a pi*r by r rectangle as the slices get thinner, for a list of slice counts.",
      args: '{ "radius": 10, "sectors": [3, 6, 12, 100] }',
      run: (args) => {
        const C = core();
        const radius = num(args, "radius", 10);
        if (!(radius > 0)) throw new Error("radius must be positive");
        const counts = Array.isArray(args.sectors) ? args.sectors : [3, 6, 12, 100];
        const steps = counts.map((value) => {
          const sectors = readSectors({ sectors: value });
          const g = C.geometry({ sectors }, radius);
          return {
            sectors,
            width: g.width,
            height: g.height,
            widthErrorPercent: (g.width / (Math.PI * radius) - 1) * 100,
            heightErrorPercent: (g.height / radius - 1) * 100,
            boundingArea: g.width * g.height,
          };
        });
        return { radius, target: { width: Math.PI * radius, height: radius, area: Math.PI * radius * radius }, steps };
      },
    },
  };
}

/** What the core says about the row currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const sectors = readSectors(state);
  const g = C.geometry({ sectors }, 1);
  return {
    sectors,
    topSlices: g.topCount,
    bottomSlices: g.bottomCount,
    arcPerSliceInRadii: g.arcLength,
    basesTotalInRadii: g.topBase + g.bottomBase,
    circumferenceInRadii: g.circumference,
    widthInRadii: g.width,
    heightInRadii: g.height,
    note: `The two wavy edges are one full circumference (2*pi) long. The row is ${g.width.toFixed(2)}r by ${g.height.toFixed(2)}r, heading for pi*r by r and an area of pi*r^2.`,
  };
}
