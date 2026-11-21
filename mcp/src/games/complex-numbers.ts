/*
 * run_game_logic actions and saved-position reader for Complex Numbers.
 *
 * Two numbers A and B sit on the complex plane. Every answer below comes from
 * the game's real core (complex-numbers/ in the site): the applet's sum, common
 * product, real product (the dot product) and complex product (the cross
 * product, with the applet's sign). See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["complex-numbers"].ComplexNumbersCore;

type Z = { x: number; y: number };
const round = (v: number) => Math.round(v * 1e9) / 1e9;
const view = (C: ReturnType<typeof core>, z: Z) => ({
  x: round(z.x), y: round(z.y), text: C.fmt(z), modulus: round(C.modulus(z)), argumentDegrees: round((C.argument(z) * 180) / Math.PI),
});

function readPoint(args: Json, key: string, dx: number, dy: number): Z {
  const p = (args[key] ?? {}) as Json;
  return { x: num(p, "x", dx), y: num(p, "y", dy) };
}

export function actions(): GameActions {
  return {
    products: {
      describe:
        "For numbers A and B on the plane (real part x, imaginary part y), give the conjugates, sum, common product, real product and complex product the applet draws, with moduli and arguments, and check |AB| = |A||B| and that the real product is real and the complex product imaginary.",
      args: '{ "a": { "x": 1, "y": 1.732 }, "b": { "x": -1.148, "y": 2.772 } }',
      run: (args) => {
        const C = core();
        const s = C.start({ a: readPoint(args, "a", 1, 1.732), b: readPoint(args, "b", -1.148, 2.772) });
        const prod = C.commonProduct(s.a, s.b);
        return {
          a: view(C, s.a),
          b: view(C, s.b),
          conjugateOfA: view(C, C.conjugate(s.a)),
          conjugateOfB: view(C, C.conjugate(s.b)),
          sum: view(C, C.add(s.a, s.b)),
          commonProduct: view(C, prod),
          realProduct: view(C, C.realProduct(s.a, s.b)),
          complexProduct: view(C, C.complexProduct(s.a, s.b)),
          modulusOfProductIsProductOfModuli: Math.abs(C.modulus(prod) - C.modulus(s.a) * C.modulus(s.b)) < 1e-9,
          realProductIsZero: C.realProduct(s.a, s.b).x === 0,
          complexProductIsZero: C.complexProduct(s.a, s.b).y === 0,
          note: "Real product is zero when A and B are perpendicular; complex product is zero when A, B and the origin are in a line. The applet's complex product is (x1*y2 - x2*y1)i, the opposite sign to the page's (z1 Conj(z2) - Conj(z1) z2)/2.",
        };
      },
    },
    drag: {
      describe:
        "Drag A or B to a point under a fixing rule ('free', 'angle' keeps the number on its line through the origin, 'radius' keeps its absolute value) and say where it ends up and what the product's modulus is.",
      args: '{ "constraint": "radius", "which": "a", "to": { "x": -2, "y": 0.5 } }',
      run: (args) => {
        const C = core();
        const constraint = String(args.constraint ?? "free");
        const which = String(args.which ?? "a");
        const s0 = C.start({ constraint });
        const to = readPoint(args, "to", 0, 0);
        const s1 = C.move(s0, { type: "move", which, x: to.x, y: to.y });
        if (!s1) throw new Error("which must be 'a' or 'b' and the target a number");
        return {
          constraint,
          which,
          from: view(C, s0[which as "a" | "b"]),
          to: view(C, s1[which as "a" | "b"]),
          productModulus: round(C.modulus(C.commonProduct(s1.a, s1.b))),
          note: constraint === "radius" ? "The number turned on its circle, so its modulus is unchanged." : constraint === "angle" ? "The number slid along its line through the origin, so its argument is unchanged (or turned by 180 degrees)." : "Free hand: the number goes where it is dragged, kept on the board (|x| at most 10, |y| at most 7.5).",
        };
      },
    },
  };
}

/** What the core says about the two numbers currently on the plane. */
export function position(state: Json): unknown {
  const C = core();
  const a = (state.a ?? {}) as Json, b = (state.b ?? {}) as Json;
  const s = C.start({ a: { x: num(a, "x", 1), y: num(a, "y", 1.732) }, b: { x: num(b, "x", -1.148), y: num(b, "y", 2.772) }, mode: state.mode, constraint: state.constraint });
  return {
    a: view(C, s.a),
    b: view(C, s.b),
    sum: view(C, C.add(s.a, s.b)),
    commonProduct: view(C, C.commonProduct(s.a, s.b)),
    realProduct: view(C, C.realProduct(s.a, s.b)),
    complexProduct: view(C, C.complexProduct(s.a, s.b)),
    perpendicular: C.realProduct(s.a, s.b).x === 0,
    collinearWithOrigin: C.complexProduct(s.a, s.b).y === 0,
    showing: s.mode,
    constraint: s.constraint,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
    note: `A = ${C.fmt(s.a)}, B = ${C.fmt(s.b)}; their product is ${C.fmt(C.commonProduct(s.a, s.b))}, with modulus ${round(C.modulus(s.a) * C.modulus(s.b))} (the moduli multiply) and the arguments added.`,
  };
}
