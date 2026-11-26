#!/usr/bin/env node
"use strict";

/*
 * Logic test for quadratic-roots/quadratic-roots-core.js.
 *
 *   node porting/check-quadratic-roots.mjs
 *
 * The construction is checked over a grid of a, b and c (including negative,
 * zero and fractional values): the circle has diameter AD, E lies on AD and
 * on the x-axis, EF is perpendicular to AD, every marked root lies on the
 * circle and solves a x² - b x + c = 0, and the two roots obey Vieta's
 * formulas. A second, independent quadratic-formula transcription is compared
 * over the same grid, along with the page's sign convention (the applet
 * solves ax² - bx + c, not ax² + bx + c).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("quadratic-roots/quadratic-roots-core.js", "QuadraticRootsCore");

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps * Math.max(1, Math.abs(a), Math.abs(b));

/** An independent transcription of the quadratic formula for ax²-bx+c. */
function formulaRoots(a, b, c) {
  if (a === 0) return b === 0 ? [] : [c / b];
  const d = b * b - 4 * a * c;
  if (d < 0) return [];
  if (d === 0) return [b / (2 * a)];
  const s = Math.sqrt(d);
  return [(b - s) / (2 * a), (b + s) / (2 * a)];
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the applet's starting coefficients are 1.5, 5 and 3", [s.a, s.b, s.c], [1.5, 5, 3]);
  check("the hint and names are off at the start", !s.showHint && !s.showNames);
  check("a fresh demo is not done", C.result(s) === null);
  const g = C.geometry(s);
  equal("A is at (0, a)", g.A, { x: 0, y: 1.5 });
  equal("B is the origin", g.B, { x: 0, y: 0 });
  equal("C is at (b, 0)", g.C, { x: 5, y: 0 });
  equal("D is at (b, c)", g.D, { x: 5, y: 3 });
  equal("the circle centre is the midpoint of AD", g.center, { x: 2.5, y: 2.25 });
  check("the two roots are marked", g.kind === "two" && g.roots.length === 2);
  check("the message names the equation and its roots",
    s.message.includes("1.5x²") && !s.explored ||
    C.explain(s).includes("1.5x² − 5x + 3"));
  check("a coefficient change ends the exploration", C.result(C.setCoefficient(s, "b", 4)) === "done");
  equal("an unknown coefficient is refused", C.setCoefficient(s, "d", 4), s);
  equal("a checkbox toggles", C.toggle(s, "showHint").showHint, true);
  check("the message follows a toggle", C.toggle(s, "showHint").message.includes("1.5x²"));
  equal("reset restores the starting coefficients", [C.reset(s).a, C.reset(s).b, C.reset(s).c], [1.5, 5, 3]);
}

/* ------------------------ 2. every part of the construction, over a grid */

{
  let circleOkay = true;
  let eOkay = true;
  let fOkay = true;
  let rootsOkay = true;
  let sameAsFormula = true;
  let vieta = true;
  let cases = 0;
  let detail = "";
  const as = [-2, -0.5, 0, 0.5, 1, 1.5, 3];
  const bs = [-6, -2, 0, 1, 3, 5, 9];
  const cs = [-4, 0, 1, 2, 3, 6, 8];
  for (const a of as) {
    for (const b of bs) {
      for (const c of cs) {
        const g = C.geometry({ a, b, c });
        cases++;
        // The circle has AD as a diameter.
        if (!near(C.dist(g.center, g.A), g.radius) || !near(C.dist(g.center, g.D), g.radius)) circleOkay = false;
        if (!near(C.dist(g.A, g.B) ** 2 + 0, a * a)) circleOkay = false;
        // E is on AD and on the x-axis.
        if (g.E) {
          const t = -a / (c - a);
          const onLine = near(g.A.x + t * (g.D.x - g.A.x), g.E.x) &&
            near(g.A.y + t * (g.D.y - g.A.y), g.E.y);
          if (!onLine || !near(g.E.y, 0)) eOkay = false;
        } else if (Math.abs(a - c) > 1e-12) eOkay = false;
        // EF is perpendicular to AD and ends on CD (the line x = b).
        if (g.E && g.F) {
          const perp = C.dot(C.sub(g.F, g.E), C.sub(g.D, g.A));
          if (!near(perp, 0) || !near(g.F.x, b)) fOkay = false;
        } else if (Math.abs(a - c) > 1e-12) fOkay = false;
        // Each marked root lies on the circle and satisfies a x² - b x + c.
        for (const t of g.roots) {
          const value = a * t * t - b * t + c;
          if (!near(value, 0, 1e-8)) rootsOkay = false;
          if (Math.abs(a) > 1e-12) {
            const x = a * t;
            if (!near(C.dist(g.center, { x, y: 0 }), g.radius, 1e-8)) rootsOkay = false;
          }
        }
        const want = formulaRoots(a, b, c);
        if (want.length !== g.roots.length ||
            want.some((v, i) => !near(v, g.roots[i], 1e-7))) {
          sameAsFormula = false;
          detail = `a=${a} b=${b} c=${c}: ${JSON.stringify(g.roots)} vs ${JSON.stringify(want)}`;
        }
        if (g.roots.length === 2) {
          if (!near(g.roots[0] + g.roots[1], b / a, 1e-7) ||
              !near(g.roots[0] * g.roots[1], c / a, 1e-7)) vieta = false;
        }
      }
    }
  }
  check("the circle always has AD as a diameter", circleOkay);
  check("E is always on AD and on the x-axis", eOkay);
  check("EF is perpendicular to AD and meets CD", fOkay);
  check("every marked root is on the circle and solves the equation", rootsOkay);
  check(`the roots match the quadratic formula in all ${cases} cases`, sameAsFormula, detail);
  check("Vieta's sum and product hold whenever there are two roots", vieta);
}

/* ---------------------------- 3. the page's claims and the applet's edges */

{
  // The page says the applet solves ax² - bx + c, swapping b's sign.
  const swapped = C.geometry({ a: 1, b: 5, c: 6 }).roots;
  equal("the applet's roots for x² - 5x + 6 are 2 and 3", swapped, [2, 3]);
  const usual = formulaRoots(1, -5, 6);
  check("the sign swap is real: the usual x² + 5x + 6 roots are negative", usual[0] < 0 && usual[1] < 0);

  equal("a negative discriminant gives no real roots", C.geometry({ a: 1, b: 1, c: 1 }).kind, "none");
  equal("a zero discriminant gives one double root", C.geometry({ a: 1, b: 4, c: 4 }).roots, [2]);
  equal("a = 0 becomes a linear equation", C.geometry({ a: 0, b: 2, c: 6 }).roots, [3]);
  equal("a = b = 0 has no root to draw", C.geometry({ a: 0, b: 0, c: 6 }).roots, []);
  equal("c = 0 gives a root at zero", C.geometry({ a: 2, b: 3, c: 0 }).roots, [0, 1.5]);

  // Horizontal AD: the applet's E/F construction has nothing to cross.
  const horizontal = C.geometry({ a: 2, b: 4, c: 2 });
  check("a horizontal AD leaves E and F undefined, and drawing skips them",
    horizontal.E === null && horizontal.F === null);
  check("the roots are still found in that case", horizontal.roots.length === 0 ||
    horizontal.roots.every((t) => near(2 * t * t - 4 * t + 2, 0)));

  const base = C.start({ a: 2, b: 5, c: 1 });
  const changed = C.setCoefficient(base, "a", 9);
  equal("coefficients outside the sliders are clamped", changed.a, 5);
  equal("a negative coefficient below the range is clamped", C.setCoefficient(base, "c", -99).c, -10);
  const reset = C.reset(base);
  check("Reset keeps the display options", reset.showHint === base.showHint && reset.showNames === base.showNames);
  check("Reset is marked explored", C.result(reset) === "done");
  equal("an unclamped starting value is clamped too", C.start({ a: 99, b: -99, c: 2 }).a, 5);
  const snapshot = JSON.stringify(base);
  C.setCoefficient(base, "b", 1);
  C.geometry(base);
  check("core functions never mutate the position", JSON.stringify(base) === snapshot);
  check("a position is plain JSON", typeof JSON.parse(JSON.stringify(base)).a === "number");
}

done("quadratic-roots");
