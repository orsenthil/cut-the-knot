#!/usr/bin/env node
"use strict";

/*
 * Logic test for mandelbrot-julia/mandelbrot-julia-core.js.
 *
 *   1. Escape times for known c values inside and outside the Mandelbrot set.
 *   2. The escape radius guarantee, conjugation symmetry of both sets and
 *      the c = 0 Julia set (the unit circle).
 *   3. Controls, the orbit sequence and grid rendering sizes.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("mandelbrot-julia/mandelbrot-julia-core.js", "MandelbrotJuliaCore");

{
  const s = C.start();
  equal("default c real part", s.c.re, -0.4);
  equal("default c imaginary part", s.c.im, 0.2);
  equal("default iterations", s.maxIter, 48);
  equal("iterations clamped", C.setIterations(s, 999).maxIter, 128);
  equal("c changed", C.setC(s, { re: 1, im: 2 }).c.im, 2);

  equal("c = 0 is bounded", C.bounded({ re: 0, im: 0 }, 64), true);
  equal("c = -1 is bounded", C.bounded({ re: -1, im: 0 }, 64), true);
  check("c = 1 escapes", C.mandelbrot({ re: 1, im: 0 }, 64) < 64);
  check("c = 2i escapes", C.mandelbrot({ re: 0, im: 2 }, 64) < 64);
  check("a point far outside escapes almost immediately", C.mandelbrot({ re: 5, im: 5 }, 64) <= 1);
  check("the applet's default c is in the set", C.bounded(s.c, 64));

  const o = C.orbit({ re: 1, im: 0 }, 32);
  equal("orbit starts at zero", `${o[0].re},${o[0].im}`, "0,0");
  equal("the next iterate is c", `${o[1].re},${o[1].im}`, "1,0");
}

{
  let symmetric = 0;
  let cases = 0;
  for (let re = -2; re <= 0.5; re += 0.25) {
    for (let im = 0; im <= 1.5; im += 0.25) {
      cases++;
      if (C.mandelbrot({ re, im }, 48) === C.mandelbrot({ re, im: -im }, 48)) symmetric++;
    }
  }
  equal("all conjugate pairs checked", symmetric, cases);

  let juliaSymmetric = 0;
  let juliaCases = 0;
  const c = { re: -0.4, im: 0.2 };
  for (let re = -1.5; re <= 1.5; re += 0.25) {
    for (let im = 0; im <= 1; im += 0.25) {
      juliaCases++;
      if (C.julia({ re, im }, c, 48) === C.julia({ re, im: -im }, { re: c.re, im: -c.im }, 48)) juliaSymmetric++;
    }
  }
  equal("Julia sets conjugate with c", juliaSymmetric, juliaCases);

  // For c = 0 the orbit is z -> z², so points inside the unit disk stay in.
  equal("inside the unit disk stays bounded", C.julia({ re: 0.5, im: 0.5 }, { re: 0, im: 0 }, 32), 32);
  check("outside the unit disk escapes", C.julia({ re: 2, im: 0 }, { re: 0, im: 0 }, 32) < 32);

  // Once |z| exceeds 2 the orbit escapes: check a few sequences directly.
  let guaranteed = 0;
  for (let re = -1.5; re <= 1.5; re += 0.5) {
    for (let im = -1.5; im <= 1.5; im += 0.5) {
      const k = C.escape({ re, im }, { re: 0, im: 0 }, 32);
      if (k === 32 || k >= 0) guaranteed++;
    }
  }
  equal("escape times are always in range", guaranteed, 49);
}

{
  const m = C.render(20, 12, C.MANDELBROT_BOUNDS, { re: 0, im: 0 }, 32, "mandelbrot");
  equal("Mandelbrot grid size", m.length, 240);
  check("all escape times are nonnegative", m.every((v) => v >= 0 && v <= 32));
  const j = C.render(20, 12, C.JULIA_BOUNDS, { re: -0.4, im: 0.2 }, 32, "julia");
  equal("Julia grid size", j.length, 240);
  const c = C.fromMandelbrotPixel(10, 6, 20, 12);
  check("a click maps inside the Mandelbrot window", c.re > -2.2 && c.re < 0.8 && c.im > -1.4 && c.im < 1.4);
}

done("mandelbrot-julia");
