/*
 * run_game_logic actions and saved-position reader for Two Perpendiculars From a Point to a Line.
 * The core lives in two-perpendiculars/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["two-perpendiculars"].TwoPerpendicularsCore;
type P = [number, number];
const r1 = (v: number) => Math.round(v * 10) / 10;
const pt = (p: P | null) => (p ? [r1(p[0]), r1(p[1])] : null);

function analyse(A: P, B: P, Cc: P, cheat: boolean, fallacy: number) {
  const C = core();
  const s = C.start({ A, B, C: Cc, cheat, fallacy });
  const f = C.figure(s);
  const F = C.foot(s) as P;
  return {
    drawing: cheat ? "cheating, as the original applet: circle centres moved 5 px along the perpendicular bisectors" : "honest",
    puzzle: s.fallacy === 1 ? "two perpendiculars AD and AE" : "K with angles AKB and AKC",
    A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(f.D), E: pt(f.E), K: pt(f.K), footFromA: pt(F),
    distanceDE: f.D && f.E ? r1(C.dist(f.D, f.E)) : null,
    angleADB: f.D ? r1(C.angle(s.A, f.D, s.B)) : null,
    angleAEC: f.E ? r1(C.angle(s.A, f.E, s.C)) : null,
    angleBKC: f.K ? r1(C.angle(s.B, f.K, s.C)) : null,
    note: "Drawn correctly, D, E and K are the same point: the foot of the perpendicular from A to BC.",
  };
}

export function actions(): GameActions {
  return {
    figure: {
      describe: "For a triangle A, B, C (pixel coordinates in a 400 x 300 picture, y down) drawn honestly or with the applet's cheat: the points D, E, K, the foot of the perpendicular from A, and the angles at D, E and K.",
      args: '{ "A": [120, 120], "B": [180, 260], "C": [230, 40], "cheat": false }',
      run: (args) => {
        const get = (k: string, d: P) => { const v = numArray(args, k); return (v && v.length === 2 ? v : d) as P; };
        return analyse(get("A", [120, 120]), get("B", [180, 260]), get("C", [230, 40]), args.cheat !== false, args.fallacy === 2 ? 2 : 1);
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = core().start({});
  const get = (k: string, d: P) => { const v = numArray(state, k); return (v && v.length === 2 ? v : d) as P; };
  return analyse(get("A", s.A), get("B", s.B), get("C", s.C), state.cheat !== false, state.fallacy === 2 ? 2 : 1);
}
