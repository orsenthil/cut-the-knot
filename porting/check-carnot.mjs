#!/usr/bin/env node
"use strict";

/*
 * Logic test for carnot/carnot-core.js.
 *
 *   node porting/check-carnot.mjs
 *
 * Checked: CarnotCanvas.init's four starting points and circle; the slider and
 * option ranges; CTKMoveableDoub's circle glider; and, over 900 configurations
 * (random triangles on a circle, random P, angles 5°…160° including both
 * ends), the applet's own page claim — the feet of equally inclined lines from
 * a point on the circumcircle are collinear. The last group is a second,
 * literal transcription of the applet's FindFoot (GeoSDoub.Rotate,
 * GetParallelTo, Intersect) and of GetCircle, compared with the core's feet on
 * every configuration. Also checked: the Menelaus product −1, the squared
 * Carnot identity at 90° only (a different theorem, from the article the
 * applet's name points to), and that moving P off the circle breaks the line.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("carnot/carnot-core.js", "CarnotCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);

/* ------------------- a second transcription, straight from the bytecode ---- */

/* GeoSDoub.Intersect(P1,P2,P3,P4) — ax+by+c=0 for each line. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindCircumcenter plus CarnotCanvas.GetCircle's average radius. */
function appletCircle(A, B, C) {
  const m1 = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const m2 = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
  const p = { x: m1.x + B.y - A.y, y: m1.y - B.x + A.x };
  const q = { x: m2.x + C.y - B.y, y: m2.y - C.x + B.x };
  const center = appletIntersect(m1, p, m2, q);
  return {
    x: center.x, y: center.y,
    r: (dist(center, A) + dist(center, B) + dist(center, C)) / 3,
  };
}

/* GeoSDoub.Rotate(P,Q,angle,+1) with the angle already in radians. */
function appletRotate(P, Q, radians) {
  const cs = Math.cos(radians), sn = Math.sin(radians);
  const dx = Q.x - P.x, dy = Q.y - P.y;
  return { x: P.x + cs * dx - sn * dy, y: P.y + sn * dx + cs * dy };
}

/* CarnotCanvas.FindFoot: Rotate → GetParallelTo → Intersect. */
function appletFoot(P, X, Y, angleDeg) {
  const turned = appletRotate(X, Y, (angleDeg * Math.PI) / 180);
  const parallel = { x: P.x + 100 * (X.x - turned.x), y: P.y + 100 * (X.y - turned.y) };
  return appletIntersect(X, Y, P, parallel);
}

function appletFeet(state) {
  return {
    Ap: appletFoot(state.P, state.B, state.C, state.angle),
    Bp: appletFoot(state.P, state.C, state.A, state.angle),
    Cp: appletFoot(state.P, state.A, state.B, state.angle),
  };
}

const cross = (a, b, c) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/* A configuration: three vertices and P on one circle, at a legal angle. */
function configuration(rand, angle) {
  const O = { x: 30 + rand() * 440, y: 30 + rand() * 440 };
  const R = 40 + rand() * 160;
  const circlePoint = (a) => ({ x: O.x + R * Math.cos(a), y: O.y + R * Math.sin(a) });
  const a = [rand() * 2 * Math.PI, rand() * 2 * Math.PI, rand() * 2 * Math.PI];
  const A = circlePoint(a[0]), B = circlePoint(a[1]), C = circlePoint(a[2]);
  const P = circlePoint(rand() * 2 * Math.PI);
  const area = Math.abs(cross(A, B, C));
  if (area < R * R * 0.3) return null; // a needle triangle makes feet unstable
  return {
    A, B, C, P,
    circle: { x: O.x, y: O.y, r: R },
    angle: angle === undefined ? 5 + Math.floor(rand() * 156) : angle,
    showSimilar: false, showCirclePairs: false, showNames: true, pair: 0,
  };
}

/* ----------------------------------------------- 1. the applet's starting state */

{
  const s = C.start();
  const width = 500, height = 500;
  const cx = width / 2, cy = height / 2;
  const radius = Math.floor(Math.min(width, height) / 5);
  const initPoint = (ang) => ({ x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) });
  equal("start A matches init's cos/sin(−1.6)", s.A, initPoint(-1.6));
  equal("start B matches init's cos/sin(−4)", s.B, initPoint(-4));
  equal("start C matches init's cos/sin(−0.2)", s.C, initPoint(-0.2));
  const circle = appletCircle(s.A, s.B, s.C);
  check("start circle matches applet GetCircle",
    closePoint(s.circle, circle, 1e-9), JSON.stringify([s.circle, circle]));
  const P = {
    x: circle.x + circle.r * Math.cos(2.5132741228718345),
    y: circle.y - circle.r * Math.sin(2.5132741228718345),
  };
  check("start P matches init's circumcircle point", closePoint(s.P, P, 1e-9),
    JSON.stringify([s.P, P]));
  check("the scrollbar starts at 90°", s.angle === C.ANGLE.initial && s.angle === 90);
  check("the scrollbar runs 5…160 (maximum 170 minus visible 10)",
    C.ANGLE.min === 5 && C.ANGLE.max === 160 &&
    C.ANGLE.scrollbarMaximum - C.ANGLE.visible === C.ANGLE.max);
  check("both checkboxes start off and Names starts on",
    !s.showSimilar && !s.showCirclePairs && s.showNames);
  check("ShowNumber starts at 0", s.pair === 0);
  check("the illustration has no result", C.result(s) === null);
  check("all four start points lie on the circle",
    ["A", "B", "C", "P"].every((n) => close(dist(s[n], s.circle), s.circle.r, 1e-9)));
}

/* ------------------------------------- 2. the options and the circle glider */

{
  const s = C.start();
  equal("the angle clamps below the minimum", C.withAngle(s, -40).angle, 5);
  equal("the angle clamps above the maximum", C.withAngle(s, 400).angle, 160);
  equal("the angle rounds to a whole degree", C.withAngle(s, 90.6).angle, 91);
  check("a non-numeric angle is refused", C.withAngle(s, NaN) === s);
  check("checkbox changes are reflected in a new position",
    C.withOption(s, "showSimilar", true).showSimilar &&
    !C.withOption(s, "showSimilar", true).showCirclePairs &&
    !C.withOption(s, "showNames", false).showNames);
  check("an unknown option is ignored", C.withOption(s, "bogus", 7) === s);
  equal("one click advances ShowNumber", C.nextPair(s).pair, 1);
  equal("three clicks return ShowNumber to 0",
    C.nextPair(C.nextPair(C.nextPair(s))).pair, 0);

  const m = C.withPoint(s, "P", { x: 480, y: 480 });
  check("a dragged point is projected back onto the circle",
    close(dist(m.P, s.circle), s.circle.r, 1e-9));
  check("dragging P leaves the triangle alone",
    dist(m.A, s.A) === 0 && dist(m.B, s.B) === 0 && dist(m.C, s.C) === 0);
  check("an unknown handle is ignored", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  check("projection keeps the direction from the centre", (() => {
    const raw = { x: 400, y: 100 };
    const q = C.projectOnCircle(raw, s.circle);
    return close((q.x - s.circle.x) / (raw.x - s.circle.x),
      (q.y - s.circle.y) / (raw.y - s.circle.y), 1e-12);
  })());
}

/* ------------------------------- 3. the fixed configurations from the article */

const fixed = [];
for (const angle of [5, 30, 90, 150, 160]) {
  const s = C.start({ angle });
  fixed.push([`start at ${angle}°`, s]);
  fixed.push([`P near a vertex at ${angle}°`, C.withPoint(s, "P", { x: s.A.x + 1, y: s.A.y + 1 })]);
}
fixed.push(["a flat triangle", {
  ...C.start(), A: { x: 100, y: 250 }, B: { x: 250, y: 250 }, C: { x: 400, y: 250 },
  circle: { x: 250, y: 250, r: 150 }, angle: 90,
}]);

for (const [name, s] of fixed) {
  const f = C.feet(s), af = appletFeet(s);
  const tol = 2e-8 * s.circle.r;
  for (const key of ["Ap", "Bp", "Cp"]) {
    check(`${name}: ${key} matches the applet's FindFoot`,
      closePoint(f[key], af[key], tol),
      `core ${JSON.stringify(f[key])}, applet ${JSON.stringify(af[key])}`);
  }
  const err = Math.abs(C.lineError(s));
  check(`${name}: the three feet are collinear`, err < 1e-8,
    `|cross|/R = ${err}`);
  check(`${name}: the page's Menelaus product is −1`, close(C.menelaus(s), -1, 1e-6));
}

/* ------------------------- 4. 900 random configurations, every angle in range */

{
  const rand = rng(2962);
  let tested = 0, feetCompared = 0;
  for (let trial = 0; trial < 2000 && tested < 900; trial++) {
    const s = configuration(rand);
    if (!s) continue;
    tested++;
    const f = C.feet(s), af = appletFeet(s);
    const tol = 2e-8 * s.circle.r;
    for (const key of ["Ap", "Bp", "Cp"]) {
      if (!closePoint(f[key], af[key], tol)) {
        check(`random ${trial}: ${key} matches applet FindFoot`, false,
          `core ${JSON.stringify(f[key])}, applet ${JSON.stringify(af[key])}`);
      }
    }
    feetCompared++;
    if (!C.isCollinear(s)) {
      check(`random ${trial}: feet are collinear`, false, `angle ${s.angle}, error ${C.lineError(s)}`);
    }
    if (!close(C.menelaus(s), -1, 1e-5)) {
      check(`random ${trial}: Menelaus product is −1`, false, `${C.menelaus(s)}`);
    }
  }
  check(`all ${tested} random configurations were tested`, tested === 900);
  check(`the core's feet match the applet's ${feetCompared} times`, feetCompared === tested);
}

/* ------------------- 5. both ends of the slider, and P at many circle points */

{
  const rand = rng(42);
  for (const angle of [C.ANGLE.min, C.ANGLE.max]) {
    let tested = 0;
    for (let trial = 0; trial < 400 && tested < 100; trial++) {
      const s = configuration(rand, angle);
      if (!s) continue;
      tested++;
      if (!C.isCollinear(s)) {
        check(`${angle}° case ${trial}: feet are collinear`, false, `error ${C.lineError(s)}`);
      }
    }
    check(`${tested} configurations at ${angle}° are collinear`, tested === 100);
  }
  const base = C.start();
  let off = 0;
  for (let i = 0; i < 24; i++) {
    const theta = (2 * Math.PI * i) / 24;
    const P = {
      x: base.circle.x + base.circle.r * Math.cos(theta),
      y: base.circle.y + base.circle.r * Math.sin(theta),
    };
    const s = C.withPoint(base, "P", P);
    if (!C.isCollinear(s)) off++;
    if (!closePoint(appletFeet(s).Ap, C.feet(s).Ap, 2e-8 * base.circle.r)) {
      check(`P at ${i}/24: A' matches the applet`, false);
    }
  }
  check("the claim holds for P at 24 places around the circle", off === 0, `${off} failures`);
}

/* ------------------------------- 6. the condition, and the other theorem */

{
  const s = C.start();
  const offCircle = {
    ...s,
    P: {
      x: s.circle.x + (s.P.x - s.circle.x) * 0.7,
      y: s.circle.y + (s.P.y - s.circle.y) * 0.7,
    },
  };
  check("moving P inside the circle breaks the collinearity",
    !C.isCollinear(offCircle), `error ${C.lineError(offCircle)}`);
  check("moving P outside the circle breaks it too", !C.isCollinear({
    ...s,
    P: {
      x: s.circle.x + (s.P.x - s.circle.x) * 1.4,
      y: s.circle.y + (s.P.y - s.circle.y) * 1.4,
    },
  }));

  const rand = rng(73);
  let right = 0, notAlways = 0, valid = 0;
  for (let trial = 0; trial < 1000 && valid < 250; trial++) {
    const at90 = configuration(rand, 90), at60 = configuration(rand, 60);
    if (!at90 || !at60) continue;
    valid++;
    if (Math.abs(C.squaredIdentity(at90)) < 1e-6 * at90.circle.r ** 2) right++;
    if (Math.abs(C.squaredIdentity(at60)) > 1e-3 * at60.circle.r ** 2) notAlways++;
  }
  check(`the squared Carnot identity holds at 90° on ${right} triangles`, right === 250);
  check(`it is not the general-angle claim (fails on ${notAlways} triangles)`, notAlways === 250);
  const s0 = C.start();
  const f0 = C.feet(s0);
  check("the triangle pairs cycle as in the bytecode", (() => {
    const p0 = C.pair(s0), p1 = C.pair(C.nextPair(s0)), p2 = C.pair(C.nextPair(C.nextPair(s0)));
    return p0.length === 2 && p1.length === 2 && p2.length === 2 &&
      closePoint(p0[0][2], s0.C, 1e-9) && closePoint(p0[1][1], f0.Cp, 1e-9) &&
      closePoint(p1[0][2], s0.B, 1e-9) && closePoint(p1[1][1], f0.Bp, 1e-9) &&
      closePoint(p2[0][2], s0.C, 1e-9) && closePoint(p2[1][0], s0.B, 1e-9);
  })());
}

/* ------------------------------------- 7. a parallel pair is handled safely */

{
  const s = C.start();
  const flat = { ...s, A: { x: 100, y: 100 }, B: { x: 100, y: 100 } };
  const f = C.feet(flat);
  check("a repeated vertex yields no finite foot", !Number.isFinite(f.Cp.x));
  check("a degenerate position is not reported as collinear", !C.isCollinear(flat));
  check("checking it did not change the original position",
    closePoint(s.A, C.start().A, 0) && closePoint(s.P, C.start().P, 0));
}

done("carnot");
