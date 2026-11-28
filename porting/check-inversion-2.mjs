#!/usr/bin/env node
"use strict";

/*
 * Logic test for inversion-2/inversion-2-core.js.
 *
 *   node porting/check-inversion-2.mjs
 *
 * 1. The core against a second transcription of the applet's Draw / GetCircle
 *    bytecode, over a 15,552-case grid of centres, radii, angles and distances
 *    to A (skipping only the collinear cases where no circle exists).
 * 2. The article's claims, over thousands of generated pictures: A' is on
 *    every circumcircle through C, its antipode and A; OA · OA' = -OR²; O
 *    separates A and A'; CD is perpendicular to the diameter through O; the
 *    power of O is -OR²; negative inversion is ordinary inversion plus a
 *    reflection in O.
 * 3. The picture's own edges: the restriction of C to t after every drag,
 *    degenerate positions, the Names switch, Reset and plain, saveable data.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("inversion-2/inversion-2-core.js", "Inversion2Core");

const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPoint = (p, q, tol = 1e-7) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const rel = (p, o) => ({ x: p.x - o.x, y: p.y - o.y });

/* ------------------------------------ 1. a second, independent transcription
 * GetCircle(C, C2, A) uses GeoSDoub.FindCircumcenter and then averages the
 * three centre-to-point distances.  Here the centre is found from the two
 * perpendicular-bisector conditions in coordinates centred on O, and A' comes
 * from the bytecode's exact sequence (-d4 * d4) / d6 / d6.  No core helper is
 * called. */
function appletDraw(O, R, Cpt, A) {
  const rr = d(O, R);
  const cx = Cpt.x - O.x, cy = Cpt.y - O.y;
  const ax = A.x - O.x, ay = A.y - O.y;
  const denom = 2 * (cx * ay - cy * ax);
  if (Math.abs(denom) < 1e-10 * Math.max(1, rr * rr)) return null;
  const t = (ax * ax + ay * ay - cx * cx - cy * cy) / denom;
  const centre = { x: O.x - t * cy, y: O.y + t * cx };
  const C2 = { x: 2 * O.x - Cpt.x, y: 2 * O.y - Cpt.y };
  const radius = (d(centre, Cpt) + d(centre, C2) + d(centre, A)) / 3;

  const d4 = d(O, Cpt);
  const d6 = d(O, A);
  let k = -d4;
  k = k * d4;
  k = k / d6;
  k = k / d6;
  const Aprime = { x: O.x + (A.x - O.x) * k, y: O.y + (A.y - O.y) * k };
  return { t: { c: O, r: rr }, w: { c: centre, r: radius }, Aprime: Aprime, k: k };
}

{
  const centres = [C.point(200, 150), C.point(120, 90), C.point(310, 220)];
  const radii = [30, 55, 75, 95];
  const angles = [];
  for (let i = 0; i < 18; i++) angles.push(-Math.PI / 4 + i * Math.PI / 17);
  const distances = [22, 50, 88, 130];
  let cases = 0, skipped = 0, worstCentre = 0, worstRadius = 0, worstAprime = 0;
  for (const O of centres) {
    for (const radius of radii) {
      const R = C.point(O.x - radius, O.y);
      for (const ac of angles) {
        const Cpt = C.point(O.x + radius * Math.cos(ac), O.y + radius * Math.sin(ac));
        for (const aa of angles) {
          for (const da of distances) {
            const A = C.point(O.x + da * Math.cos(aa), O.y + da * Math.sin(aa));
            // A on the diameter CC2 makes the three points collinear: there
            // is no circumcircle in either transcription.
            if (Math.abs(Math.sin(aa - ac)) < 1e-4) { skipped++; continue; }
            const ref = appletDraw(O, R, Cpt, A);
            const g = C.geometry({ O: O, R: R, C: Cpt, A: A });
            cases++;
            if (!ref || !g.w) { skipped++; continue; }
            worstCentre = Math.max(worstCentre, d(g.w.c, ref.w.c) / Math.max(1, radius));
            worstRadius = Math.max(worstRadius, Math.abs(g.w.r - ref.w.r) / Math.max(1, radius));
            worstAprime = Math.max(worstAprime, d(g.Aprime, ref.Aprime) / Math.max(1, radius));
          }
        }
      }
    }
  }
  check("grid covers every centre, radius, angle and distance", cases >= 14000, `${cases} cases`);
  check("circumcentre matches the bytecode transcription", worstCentre < 1e-9, `worst ${worstCentre}`);
  check("averaged circumradius matches the bytecode transcription", worstRadius < 1e-9, `worst ${worstRadius}`);
  check("A' matches the bytecode's factor exactly", worstAprime < 1e-9, `worst ${worstAprime}`);
  check("only near-collinear pictures were skipped", skipped < cases * 0.1, `${skipped} skipped`);
}

/* ------------------------------------------------------ 2. the page's claims */
{
  const rand = rng(20261127);
  let onCircle = 0, product = 0, opposite = 0, perpendicular = 0, power = 0;
  let chord = 0, onLine = 0, sampled = 0, ordinaryMismatch = 0;
  for (let i = 0; i < 1200; i++) {
    const O = C.point(40 + rand() * 320, 40 + rand() * 220);
    const r = 20 + rand() * 75;
    const R = C.point(O.x - r, O.y);
    const ac = rand() * 2 * Math.PI;
    const A = C.point(O.x + (10 + rand() * 130) * Math.cos(ac + 0.2 + rand() * (2 * Math.PI - 0.4)),
                      O.y + (10 + rand() * 130) * Math.sin(ac + 0.2 + rand() * (2 * Math.PI - 0.4)));
    const Cpt = C.point(O.x + r * Math.cos(ac), O.y + r * Math.sin(ac));
    const state = { O: O, R: R, C: Cpt, A: A, options: { names: false }, explored: false };
    const g = C.geometry(state);
    if (!g.w || !g.Aprime) continue;
    sampled++;
    // The central "all circles ... also pass through A'" claim.
    onCircle = Math.max(onCircle, Math.abs(d(g.w.c, g.Aprime) - g.w.r) / Math.max(1, g.w.r));
    onCircle = Math.max(onCircle, Math.abs(d(g.w.c, Cpt) - g.w.r) / Math.max(1, g.w.r));
    onCircle = Math.max(onCircle, Math.abs(d(g.w.c, g.C2) - g.w.r) / Math.max(1, g.w.r));
    onCircle = Math.max(onCircle, Math.abs(d(g.w.c, A) - g.w.r) / Math.max(1, g.w.r));
    // Signed product along OA: OA × OA' = -OR².
    const signedOAprime = d(O, A) * g.k;
    product = Math.max(product, Math.abs(d(O, A) * signedOAprime + r * r) / (r * r));
    // O separates A and A'; they are on one straight line.
    opposite = Math.max(opposite, Math.abs(cross(rel(A, O), rel(g.Aprime, O)))
      / Math.max(1, d(O, A) * d(O, g.Aprime)));
    if (C.dot(rel(A, O), rel(g.Aprime, O)) >= 0) onLine = Infinity;
    // CD is perpendicular to the diameter of w through O.
    perpendicular = Math.max(perpendicular, Math.abs(C.dot(rel(g.w.c, O), rel(Cpt, O)))
      / Math.max(1, d(g.w.c, O) * r));
    // The power of O with respect to w is -OR², so a chord through O has
    // signed lengths multiplying to -OR² (Intersecting Chords Theorem).
    power = Math.max(power, Math.abs(g.power + r * r) / (r * r));
    chord = Math.max(chord, Math.abs(g.w.r * g.w.r - d(g.w.c, O) * d(g.w.c, O) - r * r) / (r * r));
    // Negative inversion is ordinary inversion followed by a reflection in O.
    const ordinary = C.negativeInverse(O, R, A);
    if (!ordinary || !nearPoint(ordinary, g.Aprime, 1e-9)) ordinaryMismatch++;
  }
  check("enough non-degenerate pictures were sampled", sampled > 1000, `${sampled}`);
  check("A, C, C2 and A' all lie on the same circle w", onCircle < 1e-9, `worst ${onCircle}`);
  check("OA × OA' = -OR² at every sampled picture", product < 1e-9, `worst ${product}`);
  check("O always separates A from A'", opposite < 1e-9 && onLine === 0, `worst ${opposite}`);
  check("CD is perpendicular to the diameter of w through O", perpendicular < 1e-9, `worst ${perpendicular}`);
  check("the power of O with respect to w is -OR²", power < 1e-6 && chord < 1e-6,
    `worst ${power}, chord ${chord}`);
  check("negative inversion is ordinary inversion plus reflection in O", ordinaryMismatch === 0,
    `${ordinaryMismatch} mismatches`);
}

/* The applet uses Math.random for the two angles; the start picture has C on
 * t, A at two thirds of a unit, and A' at three halves of a unit on the far
 * side of O. */
{
  const s = C.start({});
  const g = C.geometry(s);
  check("O and R are one unit apart as in the applet's init",
    near(d(s.O, s.R), C.UNIT, 1e-12) && nearPoint(s.O, C.point(C.CENTER.x + C.UNIT, C.CENTER.y)));
  check("C starts on t and A at two thirds of a unit",
    near(d(s.O, s.C), C.UNIT, 1e-12) && near(d(s.O, s.A), C.UNIT * 2 / 3, 1e-12));
  check("the starting A' is on the far side of O at 3/2 units",
    near(d(s.O, g.Aprime), C.UNIT * 3 / 2, 1e-9)
      && C.dot(C.sub(s.A, s.O), C.sub(g.Aprime, s.O)) < 0);
  check("the starting A' lies on the circumcircle", near(d(g.w.c, g.Aprime), g.w.r, 1e-9));
  check("custom angles reproduce the applet's polar placement",
    near(d(C.start({ angleC: 0.3, angleA: -0.2 }).O,
           C.start({ angleC: 0.3, angleA: -0.2 }).C), C.UNIT));
}

/* --------------------------------------------- 3. the picture's own edges */
{
  const s = C.start({});
  let worst = 0;
  const targets = [
    C.point(-200, 500), C.point(0, 150), C.point(399, 299),
    C.point(s.O.x + 31, s.O.y - 17), C.point(200, 150),
  ];
  for (const name of ["O", "R", "C", "A"]) {
    for (const p of targets) {
      const next = C.move(s, name, p);
      worst = Math.max(worst, Math.abs(d(next.O, next.C) - d(next.O, next.R)));
      // C can leave the viewBox when O or R is dragged far: the restriction to
      // t wins, and the SVG clips it, just as the applet's canvas did.
      check(`dragging ${name} obeys its constraint`,
        name === "C" ? near(d(next.O, next.C), d(next.O, next.R), 1e-9)
                     : nearPoint(next[name], C.clamp(p), 1e-12));
    }
  }
  check("C is re-restricted to t after every kind of drag", worst < 1e-9, `worst ${worst}`);
  check("an unknown handle is refused", C.move(s, "X", C.point(5, 5)) === s);
  check("C cannot sit at O when t collapses to a point",
    near(d(C.projectOnCircle(s.O, s.O, s.C), s.O), 0));
  check("the default picture has no labels, as ShowNames defaults to false", s.options.names === false);
  const named = C.setOption(s, "names", true);
  check("the Names switch is a plain option that records exploration",
    named.options.names === true && s.options.names === false && named.explored === true);
  check("Reset returns to the starting picture but keeps the Names option",
    nearPoint(C.reset(named).O, s.O) && nearPoint(C.reset(named).C, s.C)
      && C.reset(named).options.names === true);
  check("a picture never ends: no win, no loss and no done move",
    C.result(named) === null && C.result(C.move(named, "A", C.point(50, 50))) === null);

  const atO = Object.assign({}, s, { A: C.point(s.O.x, s.O.y) });
  const gAtO = C.geometry(atO);
  check("A at O has no A' and the status explains it",
    gAtO.Aprime === null && C.describe(atO).includes("Move A away from O"));
  const onDiameter = Object.assign({}, s, {
    A: C.point(s.O.x + 60 * Math.cos(-Math.PI / 5), s.O.y + 60 * Math.sin(-Math.PI / 5)),
  });
  const gFlat = C.geometry(onDiameter);
  check("a collinear A has no circumcircle and the status explains it",
    gFlat.w === null && C.describe(onDiameter).includes("off the line"));
  check("the ordinary status reports the signed identity",
    C.describe(s).includes("OA × OA'") && C.describe(s).includes("-OR²"));
  check("the whole position is plain, saveable data",
    JSON.parse(JSON.stringify(s)).A.x === s.A.x && JSON.stringify(s).includes("options"));
}

done("inversion-2");
