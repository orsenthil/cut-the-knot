"use strict";

/*
 * Iterated Function Systems, from Bogomolny's applet ifs.
 *
 * An IFS is a finite set of contraction maps. The chaos game picks maps at
 * random and plots the orbit; it converges to the attractor, the unique fixed
 * set of the system. The applet offers several predefined systems, including
 * the Sierpinski gasket and Barnsley's fern.
 *
 * The key idea is that each map (x,y) -> (ax + by + e, cx + dy + f) contracts
 * when its scaling factor is below 1. The logic test checks the transforms on
 * the classic examples, the attractor bounds and that the chaos game orbit
 * stays in a bounded region.
 *
 * No document, no window, no storage: one global, IteratedFunctionSystemsCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const IteratedFunctionSystemsCore = (() => {
  /** Affine map: (x,y) -> (a x + b y + e, c x + d y + f). */
  function apply(t, p) {
    return { x: t.a * p.x + t.b * p.y + t.e, y: t.c * p.x + t.d * p.y + t.f };
  }

  /** Rough contraction factor: largest singular value estimated by column norms. */
  function scale(t) {
    return Math.max(Math.hypot(t.a, t.c), Math.hypot(t.b, t.d));
  }

  const SYSTEMS = {
    "Sierpinski gasket": [
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.5, f: 0 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.25, f: 0.433 },
    ],
    "Square": [
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.5, f: 0 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0.5 },
      { a: 0.5, b: 0, c: 0, d: 0.5, e: 0.5, f: 0.5 },
    ],
    "Fern": [
      { a: 0, b: 0, c: 0, d: 0.16, e: 0, f: 0 },
      { a: 0.85, b: 0.04, c: -0.04, d: 0.85, e: 0, f: 1.6 },
      { a: 0.2, b: -0.26, c: 0.23, d: 0.22, e: 0, f: 1.6 },
      { a: -0.15, b: 0.28, c: 0.26, d: 0.24, e: 0, f: 0.44 },
    ],
  };

  function start() {
    return { system: "Sierpinski gasket", point: { x: 0, y: 0 }, iterations: 0 };
  }

  /** One step of the chaos game: pick a map by index from a random stream. */
  function step(state, index) {
    const transforms = SYSTEMS[state.system];
    if (!transforms || index < 0 || index >= transforms.length) return state;
    return {
      ...state,
      point: apply(transforms[index], state.point),
      iterations: state.iterations + 1,
    };
  }

  function run(state, indices) {
    let at = state;
    for (const i of indices) at = step(at, i);
    return at;
  }

  function attractorBounds(system) {
    const transforms = SYSTEMS[system];
    if (!transforms) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const t of transforms) {
      for (const p of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]) {
        const q = apply(t, p);
        minX = Math.min(minX, q.x);
        maxX = Math.max(maxX, q.x);
        minY = Math.min(minY, q.y);
        maxY = Math.max(maxY, q.y);
      }
    }
    return { minX, minY, maxX, maxY };
  }

  return { SYSTEMS, apply, scale, start, step, run, attractorBounds };
})();
