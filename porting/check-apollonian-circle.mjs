#!/usr/bin/env node
"use strict";

/*
 * Logic test for apollonian-circle/apollonian-circle-core.js.
 *
 *   node porting/check-apollonian-circle.mjs
 *
 * Checks (1) the core against a second, independent transcription of the
 * applet's CutI / CutE / projection / inversion bytecode over a grid of A, B
 * and ratio values; (2) the article's claims — the locus equation, the centre
 * and radius formulas, the r = 1 perpendicular bisector, the inverted image
 * circle and the non-intersecting family — over many generated positions;
 * (3) the illustration's own edge cases: clamped handles, the ratio slider,
 * and P staying on the locus after every move.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("apollonian-circle/apollonian-circle-core.js", "ApollonianCircleCore");
const EPS = 1e-7;

const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = EPS) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPoint = (p, q, tol = EPS) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);

/* ----------------------------------- 1. the applet's computation, transcribed
 * a second time straight from the bytecode of Reset, CutI, CutE, Compute and
 * Inversion.Invert.  No core helper is used here. */

function applet(A, B, R, P, r) {
  // CutI(A, B, r, 1): D = (1*A + r*B) / (r + 1)
  const denI = r + 1;
  const D = { x: (A.x + r * B.x) / denI, y: (A.y + r * B.y) / denI };
  // CutE(A, B, r, 1): E = (r*B - 1*A) / (r - 1)
  const denE = r - 1;
  const E = Math.abs(denE) < 1e-9
    ? { x: 1e6, y: A.y }
    : { x: (r * B.x - A.x) / denE, y: (r * B.y - A.y) / denE };
  const mid = { x: (D.x + E.x) / 2, y: (D.y + E.y) / 2 };
  const circle = { c: mid, r: Math.hypot(D.x - E.x, D.y - E.y) / 2 };
  // Reset's radial projection of P onto the circle (GeoSDoub.Dist is the
  // distance from a point to a DoubCircle's centre, since a circle is a point).
  const from = Math.hypot(P.x - circle.c.x, P.y - circle.c.y);
  const pOn = {
    x: circle.c.x + (P.x - circle.c.x) * circle.r / from,
    y: circle.c.y + (P.y - circle.c.y) * circle.r / from,
  };
  // Compute(): invert B and P in the circle centred at A through R;
  // Inversion.Invert uses factor R²/dist².
  const inv = { c: A, r: Math.hypot(A.x - R.x, A.y - R.y) };
  const invert = (p) => {
    const dd = Math.hypot(p.x - inv.c.x, p.y - inv.c.y);
    const k = inv.r * inv.r / dd / dd;
    return { x: inv.c.x + (p.x - inv.c.x) * k, y: inv.c.y + (p.y - inv.c.y) * k };
  };
  const Bp = invert(B), Pp = invert(pOn);
  // Reset's ImageCircle is centred at Bp through the inverse of D.
  const imageCircle = { c: Bp, r: Math.hypot(Bp.x - invert(D).x, Bp.y - invert(D).y) };
  return { D, E, circle, P: pOn, inv, Bp, Pp, imageCircle };
}

{
  const aPoints = [
    C.point(60, 60), C.point(150, 150), C.point(240, 90),
    C.point(80, 230), C.point(300, 240), C.point(200, 60),
  ];
  const bPoints = [
    C.point(130, 105), C.point(212.5, 150), C.point(320, 130),
    C.point(170, 260), C.point(60, 250), C.point(250, 40),
  ];
  const ratios = [0.35, 0.5, 0.8, C.K_APPLET, 2, 3.5];
  let cases = 0, worst = 0;
  for (const A of aPoints) {
    for (const B of bPoints) {
      if (d(A, B) < 20) continue;
      for (const ratio of ratios) {
        const R = C.point(A.x - 70, A.y);
        const P0 = C.point((A.x + B.x) / 2 + 30, (A.y + B.y) / 2 - 25);
        const s = C.start({ ratio: ratio });
        const state = Object.assign({}, s, { A: A, B: B, R: R });
        state.P = C.restrict(state, P0);
        const g = C.geometry(state);
        const ref = applet(A, B, R, P0, ratio);
        cases++;
        check("core matches applet D/E over grid", nearPoint(g.D, ref.D) && nearPoint(g.E, ref.E));
        check("core matches applet circle over grid",
          nearPoint(g.circle.c, ref.circle.c) && near(g.circle.r, ref.circle.r));
        check("core matches applet projection over grid", nearPoint(C.project(g, P0), ref.P));
        check("core matches applet inverted points over grid",
          nearPoint(g.Bp, ref.Bp) && nearPoint(g.Pp, ref.Pp));
        check("core matches applet image circle over grid",
          nearPoint(g.imageCircle.c, ref.imageCircle.c) && near(g.imageCircle.r, ref.imageCircle.r));
        worst = Math.max(worst, Math.abs(g.circle.r - ref.circle.r));
      }
    }
  }
  check("the grid covered the whole parameter space", cases >= 200, `${cases} cases`);
  check("no drift between the two transcriptions", worst < EPS, `worst radius drift ${worst}`);
}

/* ------------------------------------------------- 2. the article's claims */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the start state is the applet's starting picture",
    nearPoint(s.A, C.point(100, 150)) && nearPoint(s.B, C.point(212.5, 150))
      && nearPoint(s.R, C.point(20, 150)));
  check("the start ratio is the applet's K", s.options.ratio === C.K_APPLET);
  check("P starts on the Apollonian circle", near(d(s.P, s.A) / d(s.P, s.B), C.K_APPLET, 1e-6));
  check("the page's construction gives D and E on line AB",
    near((g.D.x - s.A.x) * (s.B.y - s.A.y) - (g.D.y - s.A.y) * (s.B.x - s.A.x), 0, 1e-6)
    && near((g.E.x - s.A.x) * (s.B.y - s.A.y) - (g.E.y - s.A.y) * (s.B.x - s.A.x), 0, 1e-6));
  check("AD/BD = AE/BE = r at the start",
    near(d(g.D, s.A) / d(g.D, s.B), C.K_APPLET) && near(d(g.E, s.A) / d(g.E, s.B), C.K_APPLET));
  check("DE is a diameter: D and E lie on the circle",
    near(d(g.D, g.circle.c), g.circle.r) && near(d(g.E, g.circle.c), g.circle.r));
}

{
  const rand = rng(20261126);
  let worstRatio = 0, worstCentre = 0, worstRadius = 0, worstImage = 0;
  let sampled = 0;
  for (let i = 0; i < 240; i++) {
    const A = C.point(30 + rand() * 340, 30 + rand() * 240);
    const B = C.point(30 + rand() * 340, 30 + rand() * 240);
    if (d(A, B) < 25) continue;
    // Keep away from r = 1 here: its locus is a line, tested separately.
    const ratio = i % 2 ? 0.25 + rand() * 0.7 : 1.35 + rand() * 2.6;
    const R = C.point(Math.max(20, A.x - 60 - rand() * 40), A.y);
    const state = Object.assign({}, C.start({ ratio: ratio }), { A: A, B: B, R: R });
    state.P = C.restrict(state, C.point(A.x + 20, A.y - 30));
    const g = C.geometry(state);
    const l = C.locus(A, B, ratio);
    worstCentre = Math.max(worstCentre, d(g.circle.c, l.c) / Math.max(1, d(A, B)));
    worstRadius = Math.max(worstRadius, Math.abs(g.circle.r - l.r) / Math.max(1, d(A, B)));
    // The inverted image circle has radius R_inv²/(r·AB), centre t(B).
    const expectedImage = g.inv.r * g.inv.r / (ratio * d(A, B));
    worstImage = Math.max(worstImage, Math.abs(g.imageCircle.r - expectedImage) / Math.max(1, expectedImage));
    // Check the locus equation at 12 points around the constructed circle.
    for (let k = 0; k < 12; k++) {
      const ang = 2 * Math.PI * k / 12;
      const p = C.point(g.circle.c.x + g.circle.r * Math.cos(ang),
                        g.circle.c.y + g.circle.r * Math.sin(ang));
      const measured = d(p, A) / d(p, B);
      worstRatio = Math.max(worstRatio, Math.abs(measured - ratio));
      sampled++;
    }
  }
  check("sampled enough locus points", sampled > 2000, `${sampled} points`);
  check("every sampled point has AP/BP = r", worstRatio < 1e-6, `worst ${worstRatio}`);
  check("centre matches r²/(r²-1) · AB", worstCentre < 1e-9, `worst ${worstCentre}`);
  check("radius matches r·AB/|r²-1|", worstRadius < 1e-9, `worst ${worstRadius}`);
  check("inverted image is a circle of radius R²/(r·AB) centred at t(B)",
    worstImage < 1e-6, `worst ${worstImage}`);
}

/* r = 1: the locus is a line, which the applet only approximates with a
 * far-away sentinel point.  The verified article gives the exact line. */
{
  const A = C.point(110, 220), B = C.point(290, 100);
  const s = C.setOption(C.start({}), "ratio", 1);
  const state = Object.assign({}, s, { A: A, B: B });
  state.P = C.restrict(state, C.point(300, 210));
  const g = C.geometry(state);
  const M = C.midpoint(A, B);
  const n = C.sub(B, A);
  check("r = 1 uses a line, not a huge circle", g.circle === null && g.line !== null);
  check("P is projected onto the perpendicular bisector",
    near((state.P.x - M.x) * n.x + (state.P.y - M.y) * n.y, 0, 1e-6));
  let worst = 0;
  for (let k = 0; k < 40; k++) {
    const t = -2 + 4 * k / 39;
    const p = C.point(M.x - n.y * t, M.y + n.x * t);
    worst = Math.max(worst, Math.abs(d(p, A) - d(p, B)));
  }
  check("the whole line has AP = BP", worst < 1e-6, `worst ${worst}`);
  check("the article's r = 1 claim is confirmed", C.describe(state).includes("perpendicular bisector"));
}

/* The family claim: distinct r give non-intersecting circles, and small r
 * hugs A while large r hugs B (the old page's last sentence says otherwise). */
{
  const A = C.point(100, 150), B = C.point(300, 150);
  const ratios = [0.25, 0.4, 0.75, 1.5, 2.4, 4];
  let intersections = 0, orderedSmall = true, orderedLarge = true;
  for (let i = 0; i < ratios.length; i++) {
    for (let j = i + 1; j < ratios.length; j++) {
      const a = C.locus(A, B, ratios[i]), b = C.locus(A, B, ratios[j]);
      const sep = d(a.c, b.c);
      if (sep < a.r + b.r - 1e-9 && sep > Math.abs(a.r - b.r) + 1e-9) intersections++;
    }
  }
  const tiny = C.locus(A, B, 0.25), half = C.locus(A, B, 0.5);
  const large = C.locus(A, B, 4), larger = C.locus(A, B, 2);
  orderedSmall = tiny.r < half.r && d(tiny.c, A) < d(half.c, A);
  orderedLarge = large.r < larger.r && d(large.c, B) < d(larger.c, B);
  check("no two Apollonian circles of the family intersect", intersections === 0);
  check("small r hugs A", orderedSmall);
  check("large r hugs B", orderedLarge);
  check("different r really give different circles", near(C.locus(A, B, 2).c.x, 1100 / 3)
    && !near(C.locus(A, B, 2).c.x, C.locus(A, B, 3).c.x));
}

/* ------------------------------------------- 3. moves, options and edges */

{
  const s0 = C.start({});
  const drawn = C.move(s0, "P", C.point(s0.P.x + 40, s0.P.y + 40));
  check("dragging P keeps it on the locus",
    near(d(drawn.P, drawn.A) / d(drawn.P, drawn.B), drawn.options.ratio, 1e-6));
  check("moving A, B or R reprojects P onto the new locus",
    near(d(C.move(s0, "A", C.point(90, 110)).P, C.point(90, 110))
         / d(C.move(s0, "A", C.point(90, 110)).P, s0.B), s0.options.ratio, 1e-6));
  check("a handle stays inside the board",
    C.clamp(C.point(-100, 999)).x === C.PAD && C.clamp(C.point(-100, 999)).y === C.VIEW.height - C.PAD);
  check("an unknown handle is refused", C.move(s0, "X", C.point(1, 1)) === s0);
  check("the ratio slider reaches r = 1 and both ends",
    C.clampRatio(1) === 1 && C.clampRatio(0) === C.RATIO_MIN
      && C.clampRatio(99) === C.RATIO_MAX && C.clampRatio(NaN) === C.K_APPLET);
  check("N is an integer from 1 to 15",
    C.clampN(3.7) === 3 && C.clampN(-4) === 1 && C.clampN(100) === 15);
  const changed = C.setOption(s0, "ratio", 0.5);
  check("changing the ratio moves P onto the new circle",
    near(d(changed.P, changed.A) / d(changed.P, changed.B), 0.5, 1e-6));
  check("the picture is not a game and never ends", C.result(changed) === null);
  check("Reset returns to the applet's starting points",
    nearPoint(C.reset(changed).A, s0.A) && nearPoint(C.reset(changed).R, s0.R));
  check("the standard head data is a plain, saveable position",
    JSON.stringify(s0).includes("ratio") && JSON.stringify(s0).includes("A"));
  check("degenerate A = B is refused", C.compute(C.point(10, 10), C.point(10, 10), 2) === null);
}

done("apollonian-circle");
