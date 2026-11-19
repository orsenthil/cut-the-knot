/*
 * run_game_logic actions and saved-position reader for Cavalieri's principle.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cavalieri"].CavalieriCore;

function readState(args: Json) {
  const C = core();
  return C.start({ n: num(args, "n", C.DEFAULT_N), vertical: args.vertical === true });
}

export function actions(): GameActions {
  return {
    equal_areas: {
      describe:
        "For two stacks of strips between the same parallels, show each strip's two areas and confirm they stay equal after a bar is dragged.",
      args: '{ "n": 5, "level": 0, "bar": "a", "value": 0.4 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const level = Math.max(0, Math.min(state.n - 1, Math.trunc(num(args, "level", 0))));
        const bar = args.bar === "b" ? "b" : "a";
        const moved = C.dragBar(state, level, bar, num(args, "value", 0.4));
        const before = C.areas(state);
        const after = C.areas(moved);
        return {
          n: state.n,
          level,
          bar,
          before,
          after,
          equalBefore: Math.abs(before.left - before.right) < 1e-9,
          equalAfter: Math.abs(after.left - after.right) < 1e-9,
          note: "Resizing one figure resizes its partner by the same amount, so the areas remain equal.",
        };
      },
    },
    volumes: {
      describe:
        "Show the slice areas and volumes for a cylinder, cone and hemisphere of radius r, and verify the 1 : 1/3 : 2/3 ratios.",
      args: '{ "r": 1 }',
      run: (args) => {
        const C = core();
        const r = num(args, "r", 1);
        return {
          radius: r,
          cylinderSlice: C.cylinderSlice(r),
          coneSlice: C.coneSlice(r),
          hemisphereSlice: C.hemisphereSlice(r),
          volumes: {
            cylinder: C.cylinderVolume(r),
            cone: C.coneVolume(r),
            hemisphere: C.hemisphereVolume(r),
            sphere: C.sphereVolume(r),
          },
          coneToCylinder: C.coneVolume(r) / C.cylinderVolume(r),
          hemisphereToCylinder: C.hemisphereVolume(r) / C.cylinderVolume(r),
          note: "At every height the cone and hemisphere slices add to the cylinder's, so their volumes are 1/3 and 2/3 of it.",
        };
      },
    },
  };
}

/** What the core says about the two stacks currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const levels = Array.isArray(state.levels) && state.levels.length ? state.levels : readState(state).levels;
  const here = { ...readState(state), levels };
  const areas = C.areas(here);
  return {
    n: here.n,
    vertical: here.vertical,
    showLines: state.showLines === true,
    areas,
    equal: Math.abs(areas.left - areas.right) < 1e-9,
    note: `The two stacks are ${areas.left.toFixed(3)} and ${areas.right.toFixed(3)} in area; Cavalieri keeps them equal.`,
  };
}
