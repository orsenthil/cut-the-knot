/*
 * run_game_logic actions and saved-position reader for Ratchet Effect. The core lives in
 * ratchet/ and is copied into src/generated/cores/ at build time. See _shared.ts for the module
 * shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["ratchet"].RatchetCore;
const MODES = ["regular", "flashing", "both"];

/** Net rise of the ball in steps over `frames` frames, ignoring the whole-step jumps when a staircase wraps round. */
function run(mode: string, frames: number) {
  const C = core();
  const D = C.stepVector();
  let s = C.start({ mode });
  let y = C.ball(s).y, climbed = 0, handovers = 0, who = C.holder(s);
  for (let i = 0; i < frames; i++) {
    s = C.tick(s);
    const ny = C.ball(s).y;
    let dy = ny - y;
    if (Math.abs(dy) >= 120) dy -= Math.round(dy / D.y) * D.y;
    climbed -= dy / D.y;
    y = ny;
    if (C.holder(s) !== who) { handovers++; who = C.holder(s); }
  }
  return { mode, frames, ballRoseSteps: Math.round(climbed * 1000) / 1000, handovers };
}

export function actions(): GameActions {
  return {
    simulate: {
      describe: "Runs the staircases for a number of frames (mode regular, flashing or both) and reports how many steps the ball rose (negative: fell) and how often it changed hands. Each 24 frames: alone -0.8 step, together +0.2.",
      args: '{ "mode": "both", "frames": 240 }',
      run: (args) => {
        const mode = String(args.mode ?? "both");
        if (!MODES.includes(mode)) throw new Error('mode must be "regular", "flashing" or "both"');
        const frames = Math.floor(num(args, "frames", 240));
        if (frames < 0 || frames > 20000) throw new Error("frames must be 0..20000");
        return run(mode, frames);
      },
    },
  };
}

export function position(state: Json): unknown {
  const mode = MODES.includes(String(state.mode)) ? String(state.mode) : "both";
  const frame = num(state, "frame", 0);
  return {
    mode, frame, ballRoseSteps: num(state, "climbedSteps", 0),
    showing: mode === "both" ? "both staircases, passing the ball" : mode === "regular" ? "the plain staircase alone" : "the flashing staircase alone",
    note: "Per 24 frames each staircase alone lowers the ball 0.8 of a step; together they raise it 0.2 of a step (the ratchet behind Parrondo's paradox).",
  };
}
