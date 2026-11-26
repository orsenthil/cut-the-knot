#!/usr/bin/env node
"use strict";

/*
 * Logic test for quadratic-polynomial/quadratic-polynomial-core.js.
 *
 *   node porting/check-quadratic-polynomial.mjs
 *
 * 1. The options: the start, the slider range and step, a = 0, the formula.
 * 2. The roots, for every a, b, c on a grid of 41^3 slider values over the
 *    whole range: the applet's cases (DrawRoots), P(root) = 0, Vieta's
 *    formulas, the factorisation, symmetry about the axis.
 * 3. The page's claims: with a and c fixed and ac > 0, complex roots stay on
 *    the circle of radius sqrt(c/a); raising c makes the roots meet when
 *    ax^2 + bx + c is a perfect square; the parabola opens up exactly when a > 0.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("quadratic-polynomial/quadratic-polynomial-core.js", "QuadraticPolynomialCore");

/* ------------------------------------------------------------ 1. the options */

{
  const s = C.start({ random: () => 0.5 });
  equal("the start is a = 1 and b, c = 11 random - 5", s.c, [0.5, 0.5, 1]);
  check("sliders keep -10..10 in hundredths", C.move(s, { type: "coef", index: 2, value: 12 }).c[2] === 10 && C.move(s, { type: "coef", index: 0, value: -3.456 }).c[0] === -3.45);
  check("a bad move is refused", C.move(s, { type: "coef", index: 3, value: 1 }) === null);
  const lin = C.roots(C.start({ c: [3, 2, 0] }));
  check("with a = 0 the applet shows the one root -c/b", lin.kind === "linear" && lin.points[0].x === -1.5);
  check("with a = b = 0 no root is shown", C.roots(C.start({ c: [3, 0, 0] })).kind === "none");
  check("the formula", C.formula(C.start({ c: [-6, 1, 1] })) === "P(x) = x² + x − 6" && C.formula(C.start({ c: [2.5, 0, -1] })) === "P(x) = −x² + 2.5");
  check("x² − 2x + 1 has the double root 1", C.roots(C.start({ c: [1, -2, 1] })).kind === "double" && C.roots(C.start({ c: [1, -2, 1] })).points[0].x === 1);
}

/* ------------------------------------------------------- 2. every slider grid */

{
  const vals = Array.from({ length: 41 }, (_, i) => -10 + i * 0.5);
  let n = 0, kinds = 0, zero = 0, vieta = 0, factor = 0, symmetric = 0;
  for (const a of vals) for (const b of vals) for (const c of vals) {
    if (a === 0) continue;
    n++;
    const s = C.start({ c: [c, b, a] });
    const r = C.roots(s), D = b * b - 4 * a * c;
    if (r.kind === (D > 0 ? "real" : D === 0 ? "double" : "complex")) kinds++;
    // Roots as complex numbers x = re + i im.
    const [p, q] = r.kind === "complex" ? [{ re: r.points[0].x, im: r.points[0].y }, { re: r.points[1].x, im: r.points[1].y }] : r.points.map((pt) => ({ re: pt.x, im: 0 }));
    const P = (z) => { // a z^2 + b z + c for complex z
      const re2 = z.re * z.re - z.im * z.im, im2 = 2 * z.re * z.im;
      return { re: a * re2 + b * z.re + c, im: a * im2 + b * z.im };
    };
    const scale = 1 + Math.abs(a) + Math.abs(b) + Math.abs(c);
    if ([p, q].every((z) => Math.hypot(P(z).re, P(z).im) < 1e-9 * scale * scale)) zero++;
    const sum = { re: p.re + q.re, im: p.im + q.im }, prod = { re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re };
    if (Math.abs(sum.re + b / a) < 1e-9 * scale && Math.abs(sum.im) < 1e-12 && Math.abs(prod.re - c / a) < 1e-9 * scale * scale && Math.abs(prod.im) < 1e-9 * scale) vieta++;
    // P(x) = a (x - x1)(x - x2) at a few real x.
    // (x - x1)(x - x2) = x^2 - (x1 + x2) x + x1 x2, with the sum and product just computed.
    if ([-3, 0.5, 2].every((x) => Math.abs(a * x * x + b * x + c - a * (x * x - sum.re * x + prod.re)) < 1e-8 * scale)) factor++;
    if (Math.abs((p.re + q.re) / 2 - r.axis) < 1e-9 * scale && Math.abs(C.vertex(s).x - r.axis) < 1e-12) symmetric++;
  }
  check(`the kind of roots follows the sign of D in all ${n} grid cases`, kinds === n);
  check("each root makes P zero", zero === n);
  check("Vieta: x1 + x2 = -b/a and x1 x2 = c/a", vieta === n);
  check("P(x) = a(x - x1)(x - x2)", factor === n);
  check("the roots are symmetric about the axis x = -b/2a, through the vertex", symmetric === n);
}

/* ------------------------------------------------------------- 3. the claims */

{
  let circle = true, tangent = true, opens = true;
  for (const [a, c] of [[1, 4], [2, 3], [-1, -2.5], [0.5, 8]]) {
    for (let b = -10; b <= 10; b += 0.25) {
      const r = C.roots(C.start({ c: [c, b, a] }));
      if (r.kind === "complex" && Math.abs(Math.hypot(r.points[0].x, r.points[0].y) - Math.sqrt(c / a)) > 1e-9) circle = false;
    }
  }
  for (const [a, b] of [[1, 4], [2, -6], [0.5, 3]]) {
    const c0 = (b * b) / (4 * a);
    const before = C.roots(C.start({ c: [c0 - 0.5, b, a] })), at = C.roots(C.start({ c: [c0, b, a] })), after = C.roots(C.start({ c: [c0 + 0.5, b, a] }));
    if (!(before.kind === "real" && at.kind === "double" && after.kind === "complex")) tangent = false;
  }
  for (const a of [-2, -0.5, 0.5, 2]) {
    const s = C.start({ c: [1, 1, a] }), v = C.vertex(s);
    const up = C.value(s.c, v.x + 3) > v.y && C.value(s.c, v.x - 3) > v.y;
    if (up !== (a > 0)) opens = false;
  }
  check("with ac > 0 fixed, complex roots stay on the circle of radius sqrt(c/a) as b changes", circle);
  check("raising c, the roots meet at c = b²/4a (a perfect square) and then turn complex", tangent);
  check("the parabola opens upwards exactly when a > 0", opens);
}

done("quadratic-polynomial");
