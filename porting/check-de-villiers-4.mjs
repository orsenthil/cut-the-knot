#!/usr/bin/env node
"use strict";

/*
 * Logic test for de-villiers-4/de-villiers-4-core.js.
 *
 *   node porting/check-de-villiers-4.mjs
 *
 * Checks the applet's Reset() construction, every drag rule (AdjustParams /
 * AdjustApexes), the three checkboxes, S/E/F and the 0.5 ShowLine threshold.
 * Then it checks the page's exact claim — with similar triangles whose apex
 * angle equals the angle ASB, P, Q, R and S are collinear — over fixed
 * quadrilaterals and thousands of random ones, for several triangle scales.
 * Finally the whole construction is transcribed a second time, literally from
 * the deVilliers4 / GeoSDoub bytecode, and compared with the core after
 * thousands of random corner and apex drags.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("de-villiers-4/de-villiers-4-core.js", "DeVilliers4Core");
const P = (x, y) => ({ x, y });
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closePoint = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ------------------------------------------------------------------------- *
 *  A second, independent transcription of GeoSDoub and deVilliers4Canvas.
 *  Every method below follows the javap output, not the core's code.
 * ------------------------------------------------------------------------- */

function appletSqDist(p, q) {
  return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
}
function appletDist(p, q) { return Math.sqrt(appletSqDist(p, q)); }
function appletComputeAngle(p, q, r) {
  const a = appletSqDist(p, q), b = appletSqDist(p, r), c = appletSqDist(q, r);
  return Math.acos((a + b - c) / (2 * Math.sqrt(a) * Math.sqrt(b)));
}
function appletOrientation(p, q, r) {
  const d = (r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)
    + p.x * q.y - q.x * p.y;
  return d > 0 ? 1 : -1;
}
/* GeoSDoub.Rotate(p,q,angle,1) */
function appletRotate(p, q, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return P(p.x + c * (q.x - p.x) - s * (q.y - p.y),
    p.y + s * (q.x - p.x) + c * (q.y - p.y));
}
/* GeoSDoub.Intersect(a,b,c,d), including its |det| < 1 => NaN guard. */
function appletIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = b1 * a2 - a1 * b2;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((c1 * b2 - b1 * c2) / det, (a1 * c2 - c1 * a2) / det);
}
/* GeoSDoub.Dist(p, DoubLine(a,b)) */
function appletPointLineDistance(p, a, b) {
  if (appletSqDist(a, p) < 0.1) return 0;
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return appletDist(p, P(a.x + t * dx, a.y + t * dy));
}
/* AdjustOneApex(apex, coef, rotated, base1, base2) */
function appletAdjustOneApex(apex, coef, rotated, base1) {
  apex.x = base1.x + coef * (rotated.x - base1.x);
  apex.y = base1.y + coef * (rotated.y - base1.y);
}
/* AdjustParams(apex, base1, base2, 1) */
function appletAdjustParams(apex, base1, base2) {
  return {
    coef: appletDist(base1, apex) / appletDist(base1, base2),
    alpha: -appletComputeAngle(base1, base2, apex) * appletOrientation(base1, base2, apex),
  };
}
/* AdjustApexes(skip) — R, then Q, then P; the skipped apex keeps its spot. */
function appletAdjustApexes(pts, params, skip) {
  if (skip !== "R") appletAdjustOneApex(pts.R, params.coef,
    appletRotate(pts.D, pts.B, -params.alpha), pts.D);
  if (skip !== "Q") appletAdjustOneApex(pts.Q, params.coef,
    appletRotate(pts.D, pts.C, -params.alpha), pts.D);
  if (skip !== "P") appletAdjustOneApex(pts.P, params.coef,
    appletRotate(pts.A, pts.C, -params.alpha), pts.A);
  return pts;
}
/* deVilliers4Canvas.init() on a WxH canvas: centre (6/11 W, 2/3 H), radius
 * min(W,H)/3, with the four hard-coded angles from the bytecode. */
function appletInit(W = 400, H = 300) {
  const cx = W * 6 / 11, cy = H * 2 / 3, r = Math.min(W, H) / 3;
  const at = (angle) => P(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  const pts = {
    A: at(2.0943951023931953), B: at(0.5235987755982988),
    C: at(5.235987755982989), D: at(2.9670597283903604),
    P: P(0, 0), Q: P(0, 0), R: P(0, 0),
  };
  const params = { alpha: 1.0471975511965976, coef: 1 };
  return appletAdjustApexes(pts, params, null);
}
/* deVilliers4Canvas.Compute() */
function appletCompute(pts) {
  const S = appletIntersect(pts.A, pts.D, pts.B, pts.C);
  const d = appletPointLineDistance(pts.Q, pts.P, pts.R);
  const E = P(pts.C.x + pts.A.x - pts.D.x, pts.C.y + pts.A.y - pts.D.y);
  const F = appletIntersect(pts.C, E, pts.A, pts.B);
  return { S, E, F, showLine: d < 0.5, distQ: d };
}

/* An independent angle-at-a-point (vertex first), used for the page claim. */
const angleAt = (vertex, p, q) => appletComputeAngle(vertex, p, q);
function lineDistance(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy);
  return n ? Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / n : dist(p, a);
}

/*
 * The page's claim, built without the core.  All three apexes use the same
 * complex multiplier z = k*exp(i*t), so the three triangles are similar and
 * their apex angle equals theta = angle ASB.  There are two mirror choices
 * for t; exactly one is "away from AB" and puts S on line PR.
 */
function pageClaim(A, B, Cc, D, k = 1) {
  const S = appletIntersect(A, D, B, Cc);
  if (!Number.isFinite(S.x)) return null;
  const theta = angleAt(S, A, B);
  if (!Number.isFinite(theta) || theta < 1e-4 || theta > Math.PI - 1e-4) return null;
  const sin2 = 1 - k * k * Math.sin(theta) * Math.sin(theta);
  if (sin2 < 0) return null;
  const root = Math.sqrt(sin2);
  const turns = [];
  for (const v of [k * Math.cos(theta) + root, k * Math.cos(theta) - root]) {
    if (v <= 0) continue;
    const cosT = (1 + k * k - v * v) / (2 * k);
    if (cosT < -1 - 1e-12 || cosT > 1 + 1e-12) continue;
    const t = Math.acos(Math.max(-1, Math.min(1, cosT)));
    turns.push(t, -t);
  }
  const scale = Math.max(1, dist(A, B), dist(B, Cc), dist(Cc, D), dist(D, A));
  const tol = 1e-7 * scale;
  const results = turns.map((t) => {
    const c = Math.cos(t), s = Math.sin(t);
    const mul = (base1, base2) => P(
      base1.x + k * (c * (base2.x - base1.x) - s * (base2.y - base1.y)),
      base1.y + k * (s * (base2.x - base1.x) + c * (base2.y - base1.y)),
    );
    const p = mul(A, Cc), q = mul(D, Cc), r = mul(D, B);
    const dq = lineDistance(q, p, r), ds = lineDistance(S, p, r);
    // The apex angle of the constructed triangle must really be theta.
    const apex = angleAt(p, A, Cc);
    if (!Number.isFinite(apex)) return null;
    return { t, good: dq <= tol && ds <= tol && Math.abs(apex - theta) <= 1e-8 };
  });
  const valid = results.filter(Boolean);
  if (!valid.length) return null;
  const good = valid.filter((r) => r.good);
  return { theta, good: good.length > 0, both: good.length > 1, results: valid };
}

/* ---------------------------------------------------------- 1. Reset/init */

{
  const s = C.start({});
  const ap = appletInit();
  for (const key of ["A", "B", "C", "D", "P", "Q", "R"]) {
    check(`Reset puts ${key} where the applet's init() does`, closePoint(s[key], ap[key], 1e-9));
  }
  check("Alpha starts at the applet's 60 degrees", close(s.alpha, Math.PI / 3, 1e-12));
  check("Coef starts at one", s.coef === 1);
  check("all three checkboxes start unchecked",
    !s.options.names && !s.options.angles && !s.options.hint);
  check("an illustration has no win, loss or end", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  const g = C.geometry(s);
  const cp = appletCompute(ap);
  check("S at start is the applet's Intersect(A,D,B,C)", closePoint(g.S, cp.S, 1e-9));
  check("E at start is C + A - D", closePoint(g.E, cp.E, 1e-9));
  check("F at start is Intersect(C,E,A,B)", closePoint(g.F, cp.F, 1e-9));
  check("ShowLine starts off (the tips are far from a line)", !g.showLine && !cp.showLine);
  check("the start diagram does not claim to satisfy the page",
    !g.onLine && g.angleGap > 0.5);
}

/* ------------------------------------------------ 2. every drag and option */

{
  const s = C.start();
  const moved = C.move(s, "B", P(200, 120));
  check("moving a corner marks the diagram explored", moved.explored && !s.explored);
  check("moving a corner leaves the old position alone", s.B.x !== moved.B.x);
  check("moving corner B leaves apex P on the unchanged AC base",
    closePoint(s.P, moved.P, 1e-9));
  check("moving corner B leaves apex Q on the unchanged DC base",
    closePoint(s.Q, moved.Q, 1e-9));
  check("moving corner B rebuilds apex R on DB", !closePoint(s.R, moved.R, 1e-9));
  const apexMove = C.move(s, "Q", P(150, 60));
  check("dragging Q keeps Q exactly where it was dropped", closePoint(apexMove.Q, P(150, 60), 1e-9));
  check("dragging Q changes Alpha", !close(apexMove.alpha, s.alpha, 1e-12));
  check("dragging Q changes Coef", !close(apexMove.coef, 1, 1e-12));
  check("dragging Q leaves P rebuilt", !closePoint(s.P, apexMove.P, 1e-9));
  check("dragging Q leaves R rebuilt", !closePoint(s.R, apexMove.R, 1e-9));
  check("an unknown handle is ignored", C.move(s, "Z", P(1, 2)) === s);
  check("a non-finite point is ignored", C.move(s, "A", P(NaN, 2)) === s);
  const far = C.move(s, "A", P(9999, -9999));
  check("handles are clamped inside the drawing area",
    far.A.x === C.VIEW.x + C.VIEW.width - C.PAD && far.A.y === C.VIEW.y + C.PAD);
  const names = C.setOption(s, "names", true);
  check("Names toggles on", names.options.names && !s.options.names);
  const angles = C.setOption(s, "angles", true);
  check("Angles toggles on and marks explored", angles.options.angles && angles.explored);
  check("Hint is refused while the tips are apart", C.setOption(names, "hint", true) === names);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(names);
  check("Reset restores every corner", closePoint(r.A, s.A, 1e-9) && closePoint(r.D, s.D, 1e-9));
  check("Reset keeps Names", r.options.names && !r.options.hint);
  check("a fresh diagram has a helpful status", /not in a line/.test(C.describe(s)));
}

/* 3 and 4 put the diagram into the page's configuration and verify the claim. */

{
  const s = C.align(C.start());
  const g = C.geometry(s);
  check("the helper puts Q on line PR", g.showLine);
  check("the helper puts S on line PR too", g.onLine);
  check("the helper matches the two angles", g.angleGap < 1e-8);
  check("the helper marks the diagram explored", s.explored);
  check("the helper keeps the three triangles the same size",
    close(dist(s.A, s.P) / dist(s.A, s.C), g.coef, 1e-9)
    && close(dist(s.D, s.Q) / dist(s.D, s.C), g.coef, 1e-9)
    && close(dist(s.D, s.R) / dist(s.D, s.B), g.coef, 1e-9));
  check("the satisfied status says all four points line up",
    /P, Q, R and S are on one line/.test(C.describe(s)));
  check("Hint can be switched on once the line appears",
    C.setOption(s, "hint", true).options.hint);
  const both = C.setOption(s, "hint", true);
  check("turning Hint on turns Angles off", !both.options.angles);
  const back = C.setOption(both, "angles", true);
  check("turning Angles on turns Hint off", !back.options.hint && back.options.angles);
}

/* ------------------------------------------------- 4. the page's exact claim */

{
  const square = [P(80, 80), P(320, 80), P(320, 280), P(80, 280)];
  const rectangle = [P(60, 110), P(340, 110), P(340, 250), P(60, 250)];
  const tilted = [P(70, 180), P(250, 250), P(360, 90), P(140, 60)];
  const bowtie = [P(80, 80), P(320, 240), P(80, 240), P(320, 80)];
  const dart = [P(90, 90), P(320, 150), P(200, 160), P(90, 260)];
  const ap0 = appletInit();
  const fixed = [square, rectangle, tilted, bowtie, dart, [ap0.A, ap0.B, ap0.C, ap0.D]];
  let seen = 0, wrong = 0;
  for (const q of fixed) {
    for (const k of [1, 0.5, 0.8]) {
      const claim = pageClaim(q[0], q[1], q[2], q[3], k);
      if (!claim) continue;
      seen++;
      if (!claim.good) {
        wrong++;
        check("the page claim holds for a fixed quadrilateral", false,
          `k=${k}: ${JSON.stringify(claim.results)}`);
      }
    }
  }
  check(`the page claim holds on ${seen} fixed quadrilateral/scale pairs`,
    seen >= fixed.length * 3 - 9 && wrong === 0);

  const rand = rng(20261127);
  let tested = 0, failures = 0, mirrorBoth = 0;
  for (let trial = 0; trial < 1200; trial++) {
    const q = [0, 1, 2, 3].map(() => P(20 + rand() * 360, 10 + rand() * 280));
    const k = [0.35, 0.7, 1, 0.5, 0.9][trial % 5];
    const claim = pageClaim(...q, k);
    if (!claim) continue;
    tested++;
    if (!claim.good) {
      failures++;
      if (failures < 4) check(`random ${trial}: page claim`, false, JSON.stringify(claim.results));
    }
    if (claim.both) mirrorBoth++;
  }
  check(`the page claim holds on ${tested} random quadrilateral/scale pairs`,
    tested > 1100 && failures === 0);
  check("the two mirror choices are not both valid in every case", mirrorBoth < tested);

  /* The core's helper must find the same configuration over that range. */
  const rand2 = rng(9981);
  let aligned = 0, bad = 0;
  for (let trial = 0; trial < 600; trial++) {
    const q = [0, 1, 2, 3].map(() => P(30 + rand2() * 340, 20 + rand2() * 260));
    const s0 = C.start();
    for (let i = 0; i < 4; i++) s0[C.CORNERS[i]] = q[i];
    const g = C.geometry(C.align(s0));
    if (!g) continue;
    aligned++;
    if (!g.onLine || g.angleGap > 1e-7) {
      bad++;
      if (bad < 4) check(`align ${trial} satisfies the page claim`, false,
        `distQ ${g.distQ}, distS ${g.distS}, gap ${g.angleGap}`);
    }
  }
  check(`the helper satisfies the claim on ${aligned} random quadrilaterals`,
    aligned > 550 && bad === 0);
}

/* ---------------------------------- 5. the applet's ShowLine quirk is kept */

{
  /* Compute() only compares Q with the line PR; it never checks S.  A tiny
   * drag of R onto B collapses P and Q together, so Q lies on PR while S is
   * still 2-odd units away.  The core must keep that quirk and explain it. */
  const s0 = C.start();
  const rTarget = appletRotate(s0.D, s0.B, -0.2 * Math.PI / 180);
  const s = C.move(s0, "R", rTarget);
  const g = C.geometry(s);
  check("the applet's ShowLine can light up with S off the line",
    g.showLine && !g.onLine && g.distS > 1);
  check("the status tells the player S is still off the line",
    /S is off their line/.test(C.describe(s)));
  check("the applet's own test agrees with the core",
    appletCompute(s).showLine === g.showLine);
}

/* ------------------------- 6. the same answers as the applet's own bytecode */

{
  const rand = rng(4711);
  let compared = 0, mismatches = 0;
  const compareState = (label, s) => {
    const g = C.geometry(s);
    const ap = appletCompute(s);
    const tol = 1e-8;
    for (const key of ["S", "E", "F"]) {
      const ok = key === "E" ? closePoint(g[key], ap[key], tol)
        : (Number.isNaN(ap[key].x) ? !C.finite(g[key]) : closePoint(g[key], ap[key], tol));
      if (!ok) {
        mismatches++;
        if (mismatches < 5) check(`${label}: core ${key} matches bytecode`, false,
          `applet ${JSON.stringify(ap[key])}, core ${JSON.stringify(g[key])}`);
      }
    }
    if (g.showLine !== ap.showLine || !close(g.distQ, ap.distQ, tol)) {
      mismatches++;
      if (mismatches < 5) check(`${label}: ShowLine matches bytecode`, false);
    }
    compared++;
  };

  compareState("start", C.start());
  for (let trial = 0; trial < 1200; trial++) {
    const s = C.start();
    for (const key of C.HANDLES) s[key] = P(20 + rand() * 360, 5 + rand() * 290);
    s.alpha = -Math.PI + rand() * 2 * Math.PI;
    s.coef = 0.2 + rand() * 2;
    compareState(`state ${trial}`, s);
  }
  check(`core geometry matches the bytecode on ${compared} states`,
    compared > 1100 && mismatches === 0);

  /* Drag transcription: a move changes only the dragged handle, then runs
   * AdjustParams (for apexes) and AdjustApexes (skipping that apex). */
  let drags = 0, dragMismatches = 0;
  for (let trial = 0; trial < 2000; trial++) {
    const s = C.start();
    for (const key of C.HANDLES) s[key] = P(30 + rand() * 340, 10 + rand() * 280);
    s.alpha = -Math.PI + rand() * 2 * Math.PI;
    s.coef = 0.2 + rand() * 2;
    const name = C.HANDLES[trial % C.HANDLES.length];
    const target = P(20 + rand() * 360, 10 + rand() * 280);
    const coreNext = C.move(s, name, target);

    const pts = {};
    for (const key of C.HANDLES) pts[key] = P(s[key].x, s[key].y);
    pts[name] = P(target.x, target.y);
    const params = { alpha: s.alpha, coef: s.coef };
    if (name in C.BASES) {
      const base = C.BASES[name];
      const derived = appletAdjustParams(pts[name], pts[base[0]], pts[base[1]]);
      params.alpha = derived.alpha;
      params.coef = derived.coef;
    }
    appletAdjustApexes(pts, params, name in C.BASES ? name : null);
    for (const key of C.HANDLES) {
      if (!closePoint(coreNext[key], pts[key], 1e-9)) {
        dragMismatches++;
        if (dragMismatches < 5) check(`drag ${trial}: ${name} -> ${key}`, false,
          `applet ${JSON.stringify(pts[key])}, core ${JSON.stringify(coreNext[key])}`);
      }
    }
    if (!close(coreNext.alpha, params.alpha, 1e-12)
      || !close(coreNext.coef, params.coef, 1e-12)) {
      dragMismatches++;
      check(`drag ${trial}: alpha and coef`, false);
    }
    drags++;
  }
  check(`core drags match the bytecode on ${drags} random moves`,
    drags === 2000 && dragMismatches === 0);

  /* The point-line distance used by ShowLine, transcribed separately. */
  const a = P(10, 20), b = P(300, 270), p = P(120, 40);
  check("point-to-line distance agrees with the bytecode",
    close(C.pointLineDistance(p, a, b), appletPointLineDistance(p, a, b), 1e-12));
  check("Rotate agrees with the bytecode", closePoint(C.rotate(a, b, 0.7), appletRotate(a, b, 0.7), 1e-12));
  check("Intersect agrees with the bytecode",
    closePoint(C.intersect(a, b, P(50, 300), P(350, 30)),
      appletIntersect(a, b, P(50, 300), P(350, 30)), 1e-12));
  check("near-parallel lines give NaN, as in Intersect",
    !C.finite(C.intersect(P(0, 0), P(100, 0), P(0, 0.2), P(100, 0.2))));
}

/* ------------------------------------------------- 7. degenerate positions */

{
  check("a non-finite point has no geometry",
    C.geometry(Object.assign(C.start(), { A: P(NaN, 4) })) === null);
  check("a degenerate position still has no result",
    C.result(C.move(C.start(), "A", C.start().B)) === null);
  const flat = C.start();
  flat.B = P(flat.A.x + 220, flat.A.y);
  flat.C = P(flat.A.x + 300, flat.A.y);
  flat.D = P(flat.A.x + 100, flat.A.y);
  const g = C.geometry(flat);
  check("parallel AD and BC give no finite S", g && !C.finite(g.S));
  check("the status stays helpful when S is missing", typeof C.describe(flat) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("de-villiers-4");
