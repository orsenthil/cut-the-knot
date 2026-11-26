/*
 * run_game_logic actions and saved-position reader for Quadratic Roots. The
 * core lives in quadratic-roots/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["quadratic-roots"].QuadraticRootsCore;
type Core = ReturnType<typeof core>;

/** The whole construction and what it says about the equation. */
function analyse(C: Core, p: { a: number; b: number; c: number; showHint?: boolean; showNames?: boolean; explored?: boolean }) {
  const g = C.geometry(p);
  const quadratic = Math.abs(p.a) > 1e-12;
  return {
    equation: `${p.a}x² − ${p.b}x + ${p.c} = 0`,
    a: p.a, b: p.b, c: p.c,
    kind: g.kind,
    discriminant: g.discriminant,
    roots: g.roots,
    xRoots: g.xRoots,
    circle: { center: g.center, radius: g.radius },
    points: { A: g.A, B: g.B, C: g.C, D: g.D, E: g.E, F: g.F },
    vieta: quadratic ? { sum: p.b / p.a, product: p.c / p.a } : null,
    explanation: C.explain(p),
  };
}

export function actions(): GameActions {
  return {
    roots: {
      describe: "For ax² − bx + c = 0 (the applet's minus sign, with a in −5..5 and b, c in −10..10), build the broken line A(0,a)–B(0,0)–C(b,0)–D(b,c) and the circle with diameter AD; by Thales' theorem its crossings of the x-axis are a times the roots. Returns the discriminant, how many real roots there are, the crossings and the roots, plus the circle and Vieta's sum b/a and product c/a.",
      args: '{ "a": 1, "b": 5, "c": 6 }',
      run: (args) => {
        const C = core();
        return analyse(C, C.start({
          a: num(args, "a", C.DEFAULTS.a),
          b: num(args, "b", C.DEFAULTS.b),
          c: num(args, "c", C.DEFAULTS.c),
        }));
      },
    },
  };
}

/** What the core says about a position the page saved with Track.state. */
export function position(state: Json, _stateVersion: number): unknown {
  const C = core();
  const p = C.start({
    a: num(state, "a", C.DEFAULTS.a),
    b: num(state, "b", C.DEFAULTS.b),
    c: num(state, "c", C.DEFAULTS.c),
    showHint: state.showHint === true,
    showNames: state.showNames === true,
  });
  p.explored = state.explored === true;
  const a = analyse(C, p);
  return {
    a: p.a, b: p.b, c: p.c,
    showHint: p.showHint, showNames: p.showNames, explored: p.explored,
    kind: a.kind, roots: a.roots,
    discriminant: a.discriminant,
    xRoots: a.xRoots,
    circle: a.circle,
    points: a.points,
    vieta: a.vieta,
    equation: a.equation,
    explanation: a.explanation,
  };
}
