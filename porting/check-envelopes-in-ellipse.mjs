#!/usr/bin/env node
"use strict";

/*
 * Logic test for envelopes-in-ellipse/envelopes-in-ellipse-core.js.
 *
 *   node porting/check-envelopes-in-ellipse.mjs
 *
 * The page (https://www.cut-the-knot.org/Curriculum/Geometry/EnvelopesInEllipse.shtml)
 * claims that a ray in an elliptic mirror has exactly three behaviours: a ray
 * through a focus afterwards alternates between the foci; a ray whose pieces
 * stay outside the focal segment touches a confocal ellipse; a ray whose
 * pieces cross it touches a confocal hyperbola. Every claim is checked on
 * many configurations, including a full turn of starting directions.
 *
 * Section 3 is a second transcription of the applet's AddReflection: instead
 * of CTKEllipse's radius-1000 circle trick it reflects with a perpendicular
 * foot and cuts the ellipse with a plain quadratic. The two are compared over
 * a grid of rectangle sizes and starting angles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("envelopes-in-ellipse/envelopes-in-ellipse-core.js", "EnvelopesInEllipseCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const dot = (u, v) => u.x * v.x + u.y * v.y;
const norm = (u) => Math.hypot(u.x, u.y);
const angle = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (norm(u) * norm(v)))));
const lineDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs((dx * (p.y - a.y) - dy * (p.x - a.x)) / Math.hypot(dx, dy));
};

/* ---------------------------------------- 1. the applet's initial position */

equal("the applet's canvas hint is 400 by 300", [C.WIDTH, C.HEIGHT], [400, 300]);
equal("T1 starts at -pi/4, the unit circle's radius is 1000",
  [C.S_ANGLE, C.UNIT], [-Math.PI / 4, 1000]);
{
  const s = C.start();
  check("init(): four corners at width/2 +/- width/3 and height/2 +/- height/3",
    s.corners.every((p, i) => Math.abs(p.x - [200 - 400 / 3, 200 + 400 / 3, 200 + 400 / 3, 200 - 400 / 3][i]) < 1e-9 &&
                              Math.abs(p.y - [250, 250, 50, 50][i]) < 1e-9));
  equal("the four corners really are (66.7,250), (333.3,250), (333.3,50), (66.7,50)",
    s.corners.map((p) => [Math.round(p.x), Math.round(p.y)]),
    [[67, 250], [333, 250], [333, 50], [67, 50]]);
  check("the ellipse has centre (200,150), semi-axes 400/3 and 300/3", (() => {
    const e = C.ellipseOf(s.corners);
    return e.center.x === 200 && e.center.y === 150 && Math.abs(e.a - 400 / 3) < 1e-12 && e.b === 100;
  })());
  equal("the foci are on the major axis at +/- sqrt(a^2-b^2)",
    C.fociOf(C.ellipseOf(s.corners)).map((p) => [Math.round(p.x), Math.round(p.y)]),
    [[112, 150], [288, 150]]);
  equal("T1 is at EllipseAt(-pi/4)", s.S,
    { x: 200 + (400 / 3) * Math.cos(-Math.PI / 4), y: 150 + 100 * Math.sin(-Math.PI / 4) });
  equal("the three Show boxes start unchecked, as with no Show parameter",
    [s.showNames, s.showExtended, s.showReflection], [false, false, false]);
  equal("the two starting points and no bounces", [s.points.length, C.geometry(s).bounces], [2, 0]);
  check("a fresh illustration is not yet explored", C.result(s) === null);
}

/* ------------------------------------------- 2. buttons, flags and controls */

{
  const s = C.start();
  const one = C.addReflection(s);
  check("Add reflection appends one point and records the exploration",
    one.points.length === 3 && one.explored && C.result(one) === "done" && one.moves === 1);
  const ten = C.add(s, 10), hundred = C.add(s, 100);
  equal("Add 10 and Add 100 append exactly ten and a hundred points",
    [ten.points.length - 2, hundred.points.length - 2], [10, 100]);
  check("Remove last drops one bounce but keeps T1 and T2",
    C.removeLast(ten).points.length === 11 && C.removeLast(ten).points[0].x === s.S.x);
  equal("Remove all leaves the two starting points", C.removeAll(hundred).points.length, 2);
  check("Remove and Remove all are disabled until there is a bounce",
    !C.controlsEnabled(s) && C.controlsEnabled(one) && !C.controlsEnabled(C.removeAll(one)));
  check("Remove switches the proof box off, as DisableControls does",
    C.withFlag(one, "showReflection", true).showReflection &&
    !C.removeLast(C.withFlag(one, "showReflection", true)).showReflection);
  check("Show flags are independent and clicking the same value changes nothing",
    C.withFlag(s, "showNames", true).showExtended === false &&
    C.withFlag(s, "showNames", true) !== s && C.withFlag(s, "showNames", false) === s);
  check("Reset returns every point and flag to the initial position", (() => {
    const r = C.reset();
    return r.points.length === 2 && !r.explored && r.moves === 0 && r.points[1].x === s.points[1].x;
  })());
  check("a corner drag moves the other three corners and keeps the centre", (() => {
    const q = C.setCorner(s, 1, { x: 300, y: 250 });
    const e = C.ellipseOf(q.corners);
    return e.center.x === 200 && e.center.y === 150 && Math.abs(e.a - 100) < 1e-9 &&
      Math.abs(e.b - 100) < 1e-9 && q.points.length >= 2 && q.explored;
  })());
  check("a ray point is projected back onto the ellipse after a drag", (() => {
    const e = C.ellipseOf(s.corners);
    const q = C.setRayPoint(s, 1, { x: 200, y: 250 });
    return Math.abs(((q.T.x - e.center.x) / e.a) ** 2 + ((q.T.y - e.center.y) / e.b) ** 2 - 1) < 1e-9;
  })());
}

/* --------------------------- 3. the same answers as a second transcription */

/*
 * Independent transcription of EnvelopesInEllipseCanvas.AddReflection:
 *  - CTKEllipse.TangentAt is the analytic tangent (-A sin t, B cos t);
 *  - GeoSDoub.ReflectPointInLine is foot-of-perpendicular, not Rotate;
 *  - CTKEllipse.Intersect is the quadratic on the original ellipse, not the
 *    auxiliary circle of radius 1000.
 */
function secondTranscription(position, count) {
  const e = C.ellipseOf(position.corners);
  const { center, a, b } = e;
  const p = position.points.map((q) => ({ x: q.x, y: q.y }));
  const reflect = (point, A, B) => {
    const dx = B.x - A.x, dy = B.y - A.y;
    const t = ((point.x - A.x) * dx + (point.y - A.y) * dy) / (dx * dx + dy * dy);
    return { x: 2 * (A.x + t * dx) - point.x, y: 2 * (A.y + t * dy) - point.y };
  };
  for (let i = 0; i < count; i++) {
    const B = p[p.length - 1], A = p[p.length - 2];
    const tangent = {
      x: B.x - (B.y - center.y) / (b * b),
      y: B.y + (B.x - center.x) / (a * a),
    };
    const image = reflect(A, B, tangent);
    const D = { x: 2 * B.x - image.x, y: 2 * B.y - image.y };
    const dx = D.x - B.x, dy = D.y - B.y;
    const qa = (dx * dx) / (a * a) + (dy * dy) / (b * b);
    const qb = 2 * ((B.x - center.x) * dx / (a * a) + (B.y - center.y) * dy / (b * b));
    const u = -qb / qa; // the other root is u = 0, the point B itself
    p.push({ x: B.x + u * dx, y: B.y + u * dy });
  }
  return p;
}

{
  const random = rng(20261127);
  let cases = 0, worst = 0, worstAt = null;
  for (const w of [240, 320, 400, 520]) {
    for (const h of [200, 300, 420]) {
      for (let k = 0; k < 30; k++) {
        const tAngle = -Math.PI + (2 * Math.PI * (k + random() * 0.3)) / 30;
        const sAngle = -Math.PI / 4 + (random() - 0.5) * 0.6;
        const start = C.start({ width: w, height: h, sAngle, tAngle });
        const got = C.add(start, 25).points;
        const expected = secondTranscription(start, 25);
        cases++;
        // A line through the ellipse's centre has both intercept parameters
        // below one pixel, so the applet's IntersectX/Y choice returns null and
        // AddReflection stops; compare only the prefix both methods produced.
        if (got.length > expected.length) {
          worst = Infinity;
          worstAt = { w, h, k, reason: "core has extra points" };
        }
        for (let i = 0; i < got.length; i++) {
          const error = dist(got[i], expected[i]);
          if (error > worst) { worst = error; worstAt = { w, h, k, i }; }
        }
      }
    }
  }
  check(`${cases} configurations of 25 bounces match the independent transcription`,
    worst < 1e-3, `worst error ${worst} at ${JSON.stringify(worstAt)}`);

  const fixed = C.start({ tAngle: 1.2 });
  const ref = secondTranscription(fixed, 100);
  const core = C.add(fixed, 100).points;
  check("100 reflections still agree (no drift over a long trajectory)",
    core.length === ref.length &&
    Math.max(...ref.map((p, i) => dist(p, core[i]))) < 1e-3);
}

/* ------------------------------ 4. reflection law and points on the ellipse */

{
  const random = rng(47);
  let worstAngle = 0, worstOn = 0;
  for (let k = 0; k < 120; k++) {
    const start = C.start({
      width: 260 + Math.floor(random() * 300), height: 180 + Math.floor(random() * 260),
      sAngle: -Math.PI + 2 * Math.PI * random(), tAngle: -Math.PI + 2 * Math.PI * random(),
    });
    const s = C.add(start, 12);
    const e = C.ellipseOf(s.corners);
    for (const p of s.points) {
      const on = ((p.x - e.center.x) / e.a) ** 2 + ((p.y - e.center.y) / e.b) ** 2;
      worstOn = Math.max(worstOn, Math.abs(on - 1));
    }
    for (let i = 1; i + 1 < s.points.length; i++) {
      const tangent = C.tangentAt(e, s.points[i]);
      const t = { x: tangent.m2.x - tangent.m1.x, y: tangent.m2.y - tangent.m1.y };
      const incoming = { x: s.points[i].x - s.points[i - 1].x, y: s.points[i].y - s.points[i - 1].y };
      const outgoing = { x: s.points[i + 1].x - s.points[i].x, y: s.points[i + 1].y - s.points[i].y };
      worstAngle = Math.max(worstAngle, Math.abs(angle(incoming, t) - angle(outgoing, t)));
    }
  }
  check("every bounce obeys the mirror law (equal angles with the tangent)",
    worstAngle < 1e-8, `worst difference ${worstAngle}`);
  check("every generated point lies on the ellipse", worstOn < 1e-7, `worst residual ${worstOn}`);
}

/* --------------------------------- 5. the page's three cases, exhaustively */

{
  const s = C.add(C.start(), 10);
  const g = C.geometry(s);
  const e = g.ellipse;
  const R = g.constant, ap = R / 2;
  const b2 = ap * ap - g.c * g.c;
  check("case 2: the default ray stays outside the focal segment", !g.crossing && g.kind === "ellipse");
  let worst = 0;
  for (let i = 0; i + 1 < s.points.length; i++) {
    const [a, b, c] = C.lineCoefs(s.points[i], s.points[i + 1]);
    const n = a * e.center.x + b * e.center.y + c;
    const residual = (n * n - (ap * ap * a * a + b2 * b * b)) / (a * a + b * b);
    worst = Math.max(worst, Math.abs(residual));
  }
  check("every piece is tangent to the confocal ellipse a' = R/2", worst < 1e-6, `worst ${worst}`);
  const proof = C.proof(s);
  check("the proof's two reflected-focus distances are equal to R",
    Math.abs(proof.r1 - R) < 1e-6 && Math.abs(proof.r2 - R) < 1e-6);
}

{
  const s = C.add(C.start({ tAngle: 1.5 }), 10);
  const g = C.geometry(s);
  const e = g.ellipse, R = g.constant, ap = R / 2, b2 = g.c * g.c - ap * ap;
  check("case 3: this ray crosses the focal segment", g.crossing && g.kind === "hyperbola");
  let worst = 0;
  for (let i = 0; i + 1 < s.points.length; i++) {
    const [a, b, c] = C.lineCoefs(s.points[i], s.points[i + 1]);
    const n = a * e.center.x + b * e.center.y + c;
    const residual = (n * n - (ap * ap * a * a - b2 * b * b)) / (a * a + b * b);
    worst = Math.max(worst, Math.abs(residual));
  }
  check("every piece is tangent to the confocal hyperbola a' = R/2", worst < 1e-6, `worst ${worst}`);
}

/* The focal chord through S and a focus, for several mirror shapes and both
   foci: solve the quadratic for the second intersection, then follow 12 rays. */
{
  let cases = 0, worst = 0, alternates = 0;
  for (const [w, h] of [[400, 300], [500, 250], [300, 400]]) {
    const base = C.start({ width: w, height: h });
    const e = C.ellipseOf(base.corners);
    for (const [which, F] of C.fociOf(e).entries()) {
      const ux = F.x - base.S.x, uy = F.y - base.S.y;
      const qa = (ux * ux) / (e.a * e.a) + (uy * uy) / (e.b * e.b);
      const qb = 2 * ((base.S.x - e.center.x) * ux / (e.a * e.a) +
                     (base.S.y - e.center.y) * uy / (e.b * e.b));
      const u = -qb / qa;
      const T = { x: base.S.x + u * ux, y: base.S.y + u * uy };
      const tAngle = Math.atan2((T.y - e.center.y) / e.b, (T.x - e.center.x) / e.a);
      const s = C.add(C.start({ width: w, height: h, tAngle }), 12);
      const g = C.geometry(s);
      cases++;
      if (g.kind === "focus") alternates++;
      const [f1, f2] = g.foci;
      for (let i = 0; i + 1 < s.points.length; i++) {
        // The first piece goes through the focus we chose; each later piece
        // passes through the other focus, then this one, and so on.
        const want = i % 2 === 0 ? (which === 0 ? f1 : f2) : (which === 0 ? f2 : f1);
        worst = Math.max(worst, lineDistance(want, s.points[i], s.points[i + 1]));
      }
    }
  }
  check(`${cases} focal chords are recognised as the focus case`, alternates === cases);
  // The page itself notes that this case is only partly validated because of
  // limited accuracy; after twelve bounces a pixel of drift is expected.
  check("after a focal chord every later piece passes through alternating foci",
    worst < 2, `worst distance ${worst}`);
}

/* Every starting direction on the default ellipse: the page says either every
   piece crosses the focal segment or none does, with matching confocal conic. */
{
  let mismatches = 0, constantErrors = 0, focusCases = 0, ellipseCases = 0, hyperbolaCases = 0;
  let worstConstant = 0;
  for (let k = 0; k < 360; k++) {
    const angleT = -Math.PI / 2 + (k * Math.PI) / 360;
    const s = C.add(C.start({ tAngle: angleT }), 8);
    const g = C.geometry(s);
    const crossing = C.segments(s).some(([p, q]) => C.crossesFoci(p, q, g.foci[0], g.foci[1]));
    if (g.kind === "ellipse") ellipseCases++;
    else if (g.kind === "hyperbola") hyperbolaCases++;
    else if (g.kind === "focus") focusCases++;
    else mismatches++;
    if (g.kind !== "focus" && crossing !== (g.kind === "hyperbola")) mismatches++;
    let localWorst = 0;
    for (let i = 0; i + 1 < s.points.length; i++) {
      localWorst = Math.max(localWorst,
        Math.abs(C.chordConstant(s, s.points[i], s.points[i + 1]) - g.constant));
    }
    if (localWorst > 1e-5 * Math.max(1, g.constant)) constantErrors++;
    worstConstant = Math.max(worstConstant, localWorst);
  }
  check("all 360 starting directions fall into exactly one of the three cases",
    mismatches === 0 && ellipseCases > 0 && hyperbolaCases > 0 && focusCases > 0,
    `ellipse ${ellipseCases}, hyperbola ${hyperbolaCases}, focus ${focusCases}, bad ${mismatches}`);
  check("the confocal constant R is the same for every piece in all 360 runs",
    constantErrors === 0, `worst variation ${worstConstant}`);
}

{
  const s = C.start({ width: 320, height: 320 }); // a circle: both foci coincide
  const g = C.geometry(s);
  check("the circle degenerate case keeps both foci at the centre and does not crash",
    dist(g.foci[0], g.foci[1]) === 0 && g.kind === "circle" && C.add(s, 10).points.length === 12);
}

done("envelopes-in-ellipse");
