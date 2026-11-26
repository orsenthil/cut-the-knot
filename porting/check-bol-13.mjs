#!/usr/bin/env node
"use strict";

/*
 * Logic test for bol-13/bol-13-core.js.
 *
 *   node porting/check-bol-13.mjs
 *
 * Checks the applet's construction and every claim on the cut-the-knot page:
 * H bisects CD, K bisects BM, H bisects MN, E lies on both lines, and above
 * all CN = DM. The core is compared over a grid and hundreds of random
 * positions with a second, independent transcription of the two GeoSDoub
 * methods used by BOL13Canvas.Draw (NearestPoint and Intersect), taken from
 * the applet's bytecode. A third, analytic check uses signed coordinates
 * along the chord.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bol-13/bol-13-core.js", "Bol13Core");

/* ------------------- a second transcription, straight from the bytecode ---- */

/* GeoSDoub.NearestPoint(DoubPoint, DoubPoint, DoubPoint). */
function appletProjection(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) < 0.1) {
    return { x: p.x, y: p.y };
  }
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/* GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint). */
function appletIntersection(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

function appletDiagram(s) {
  const O = s.O, Bo = s.Bo;
  const r = Math.hypot(Bo.x - O.x, Bo.y - O.y);
  const A = { x: O.x - r, y: O.y }, B = { x: O.x + r, y: O.y };
  const H = appletProjection(O, s.C, s.D);
  if (Math.hypot(O.x - H.x, O.y - H.y) <= 0.1) return { active: false };
  const E = appletIntersection(A, B, s.C, s.D);
  const M = appletProjection(A, s.C, s.D);
  const N = appletProjection(B, s.C, s.D);
  const K = appletIntersection(M, B, H, O);
  return {
    active: true, A, B, H, E, M, N, K,
    cn: Math.hypot(s.C.x - N.x, s.C.y - N.y),
    dm: Math.hypot(s.D.x - M.x, s.D.y - M.y),
  };
}

const near = (p, q, tol) =>
  Boolean(p && q) && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const allClaims = (c) => Object.values(c).every(Boolean);
const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

/*
 * GeoSDoub.NearestPoint returns p untouched when p is within sqrt(0.1) of the
 * first point on the line (C here). That is a faithful applet quirk: when the
 * diameter endpoint A or B nearly coincides with C, M or N is that endpoint
 * rather than the exact foot, so the drawn CN and DM can differ slightly. The
 * exact-foot test below keeps the page's claim honest for those positions.
 */
function quirkApplies(m) {
  return sq(m.A, m.C) < 0.1 || sq(m.B, m.C) < 0.1 || sq(m.O, m.C) < 0.1;
}
function exactDiagram(m) {
  const dx = m.D.x - m.C.x, dy = m.D.y - m.C.y;
  const len2 = dx * dx + dy * dy;
  const foot = (p) => {
    const t = (dx * (p.x - m.C.x) + dy * (p.y - m.C.y)) / len2;
    return { x: m.C.x + t * dx, y: m.C.y + t * dy };
  };
  const H = foot(m.O), M = foot(m.A), N = foot(m.B);
  const cn = Math.hypot(m.C.x - N.x, m.C.y - N.y);
  const dm = Math.hypot(m.D.x - M.x, m.D.y - M.y);
  const hmid = { x: (m.C.x + m.D.x) / 2, y: (m.C.y + m.D.y) / 2 };
  const mnmid = { x: (M.x + N.x) / 2, y: (M.y + N.y) / 2 };
  return { cn, dm, hmid, H, mnmid, M, N };
}

/** Signed positions along the chord, used as an analytic third opinion. */
function alongChord(m) {
  const len = Math.hypot(m.D.x - m.C.x, m.D.y - m.C.y);
  const ux = (m.D.x - m.C.x) / len, uy = (m.D.y - m.C.y) / len;
  const s = (p) => (p.x - m.H.x) * ux + (p.y - m.H.y) * uy;
  return { C: s(m.C), D: s(m.D), M: s(m.M), N: s(m.N) };
}

/* ---------------------------------------------- 1. the applet's start position */

{
  const s = C.start({});
  const m = C.measure(s);
  check("the centre starts at 210,150", s.O.x === 210 && s.O.y === 150);
  check("the radius point starts one radius left of O", C.distance(s.O, s.Bo) === 100);
  check("the diameter is horizontal", m.A.y === m.B.y && m.A.y === s.O.y);
  check("A and B are 2r apart", Math.abs(C.distance(m.A, m.B) - 200) < 1e-9);
  check("C is at 60 degrees on the circle", Math.abs(C.distance(s.O, s.C) - 100) < 1e-9);
  check("D is upper left of O", s.D.x < s.O.x && s.D.y < s.O.y);
  check("the chord is not a diameter", m.active);
  check("names are shown, statement and hint are not",
    s.showNames === true && s.showStatement === false && s.showHint === false);
  check("an illustration has no result", C.result(s) === null);
  check("every claim holds at the start", allClaims(C.claims(s, m)));
  check("CN = DM at the start", Math.abs(m.cn - m.dm) < 1e-9);
  check("the start position is not changed by measuring",
    s.O.x === 210 && s.D.x < s.O.x && s.C.y > s.O.y);
}

/* ------------------------------------------- 2. a grid of chord directions */

{
  const aAngles = [0, Math.PI / 12, Math.PI / 6, Math.PI / 3, Math.PI / 2, 2 * Math.PI / 3, Math.PI];
  const bAngles = [-Math.PI / 2, -Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3, Math.PI / 2];
  let tested = 0;
  for (const a of aAngles) {
    for (const b of bAngles) {
      const center = { x: 210, y: 150 };
      const s = {
        O: center, Bo: { x: 110, y: 150 },
        C: C.pointOnCircle(center, 100, a),
        D: C.pointOnCircle(center, 100, b),
        showNames: true, showStatement: false, showHint: false,
      };
      const m = C.measure(s);
      const ref = appletDiagram(s);
      if (!ref.active) {
        check(`grid ${a.toFixed(2)},${b.toFixed(2)}: a chord through O hides the construction`, !m.active);
        continue;
      }
      if (![ref.E, ref.M, ref.N, ref.K].every((p) => Number.isFinite(p.x))) continue;
      check(`grid ${a.toFixed(2)},${b.toFixed(2)}: core matches the applet's H`, near(m.H, ref.H, 1e-9));
      check(`grid ${a.toFixed(2)},${b.toFixed(2)}: core matches E, M, N, K`,
        near(m.E, ref.E, 1e-8) && near(m.M, ref.M, 1e-8) &&
        near(m.N, ref.N, 1e-8) && near(m.K, ref.K, 1e-8));
      const exact = exactDiagram(m);
      if (quirkApplies(m)) {
        check(`grid ${a.toFixed(2)},${b.toFixed(2)}: the exact-foot claim still holds`,
          Math.abs(exact.cn - exact.dm) < 1e-8 && near(exact.H, exact.hmid, 1e-8) &&
          near(exact.mnmid, exact.H, 1e-8));
      } else {
        check(`grid ${a.toFixed(2)},${b.toFixed(2)}: all four claims hold`,
          m.active && allClaims(C.claims(s, m)));
      }
      tested++;
    }
  }
  check("the grid covered many distinct chords", tested >= 35);
}

/* --------------------------------- 3. hundreds of random circles and chords */

{
  const random = rng(20261126);
  let tested = 0, outside = 0;
  for (let i = 0; i < 600; i++) {
    const center = { x: 60 + random() * 300, y: 50 + random() * 200 };
    const r = 35 + random() * 105;
    const a = random() * 2 * Math.PI;
    const b = a + (0.15 + random() * (2 * Math.PI - 0.3)) * (random() < 0.5 ? -1 : 1);
    const s = {
      O: center, Bo: { x: center.x - r, y: center.y },
      C: C.pointOnCircle(center, r, a),
      D: C.pointOnCircle(center, r, b),
      showNames: true, showStatement: false, showHint: false,
    };
    const m = C.measure(s);
    const ref = appletDiagram(s);
    if (!ref.active || m.active === false) continue;
    if (![ref.E, ref.M, ref.N, ref.K].every((p) => Number.isFinite(p.x))) continue;
    const guarded = quirkApplies(m);
    check(`random ${i}: CN = DM to a tenth of a millionth of a unit`,
      Math.abs(m.cn - m.dm) < (guarded ? 0.4 : 1e-7 * Math.max(1, r)));
    check(`random ${i}: the core reproduces the applet's construction`,
      near(m.H, ref.H, 1e-8 * r) && near(m.E, ref.E, 1e-8 * r) &&
      near(m.M, ref.M, 1e-8 * r) && near(m.N, ref.N, 1e-8 * r) &&
      near(m.K, ref.K, 1e-8 * r));
    const u = alongChord(m);
    check(`random ${i}: H, M and N are placed symmetrically on the chord`,
      Math.abs(u.C + u.D) < 1e-7 * r && Math.abs(u.M + u.N) < 1e-7 * r &&
      Math.abs(Math.abs(u.C - u.N) - Math.abs(u.D - u.M)) < 1e-7 * r);
    const exact = exactDiagram(m);
    if (guarded) {
      check(`random ${i}: the exact-foot proof still holds despite the applet's 0.1 short circuit`,
        Math.abs(exact.cn - exact.dm) < 1e-8 * Math.max(1, r) &&
        near(exact.H, exact.hmid, 1e-8 * r) &&
        near(exact.mnmid, exact.H, 1e-8 * r));
    } else {
      check(`random ${i}: the proof's midpoints and perpendiculars hold`,
        allClaims(C.claims(s, m)));
    }
    // E is on the infinite diameter line, and often outside the circle.
    if (Math.abs(m.E.x - center.x) > r) outside++;
    tested++;
  }
  check("hundreds of random positions were checked", tested >= 400);
  check("some intersections E really do lie outside the circle", outside > 0);
}

/* ----------------------------------- 4. the diameter and other edge cases */

{
  const center = { x: 210, y: 150 };
  const diameterChord = {
    O: center, Bo: { x: 110, y: 150 },
    C: C.pointOnCircle(center, 100, Math.PI / 4),
    D: C.pointOnCircle(center, 100, Math.PI / 4 + Math.PI),
    showNames: true, showStatement: false, showHint: false,
  };
  const m = C.measure(diameterChord);
  check("a chord that is a diameter disables the construction", !m.active);
  check("no CN or DM is reported for that chord", m.cn === null && m.dm === null);
  check("the applet transcription agrees", !appletDiagram(diameterChord).active);

  const nearlyDiameter = C.withPoint({
    ...diameterChord,
    D: C.pointOnCircle(center, 100, Math.PI / 4 + Math.PI - 0.001),
  }, "D", C.pointOnCircle(center, 100, Math.PI / 4 + Math.PI - 0.001));
  check("a near-diameter chord is also within the applet's 0.1 cutoff",
    !C.measure(nearlyDiameter).active);

  const tiny = {
    O: center, Bo: { x: center.x - 0.05, y: center.y },
    C: { x: center.x - 0.05, y: center.y },
    D: { x: center.x + 0.05, y: center.y },
    showNames: true, showStatement: false, showHint: false,
  };
  check("a collapsed circle disables the construction", !C.measure(tiny).active);
}

/* ------------------------------------------ 5. dragging and the options */

{
  const s0 = C.start({});
  const s1 = C.withPoint(s0, "Bo", { x: 90, y: 150 });
  check("dragging Bo changes the radius to the new distance", C.measure(s1).r === 120);
  check("dragging Bo leaves O alone", s1.O.x === s0.O.x && s1.O.y === s0.O.y);
  const s2 = C.withPoint(s0, "O", { x: 200, y: 150 });
  check("dragging O changes the radius because Bo stays put", C.measure(s2).r === 90);
  const s3 = C.reproject(s2);
  check("after the centre moves, C and D are put back on the circle",
    Math.abs(C.distance(s3.O, s3.C) - 90) < 1e-9 &&
    Math.abs(C.distance(s3.O, s3.D) - 90) < 1e-9);
  check("reprojection keeps each endpoint's direction from the new centre",
    Math.abs(Math.atan2(s3.C.y - s3.O.y, s3.C.x - s3.O.x) -
             Math.atan2(s2.C.y - s2.O.y, s2.C.x - s2.O.x)) < 1e-9 &&
    Math.abs(Math.atan2(s3.D.y - s3.O.y, s3.D.x - s3.O.x) -
             Math.atan2(s2.D.y - s2.O.y, s2.D.x - s2.O.x)) < 1e-9);

  const moved = C.withPoint(s0, "C", { x: 210, y: 250 });
  const mc = C.measure(moved);
  check("dragging C keeps it on the circle", Math.abs(C.distance(moved.O, moved.C) - 100) < 1e-9);
  check("dragging C below the centre still satisfies CN = DM",
    mc.active && Math.abs(mc.cn - mc.dm) < 1e-9);
  const collapsed = C.withPoint(s0, "C", { ...s0.D });
  check("a collapsed chord is refused", collapsed.C.x === s0.C.x && collapsed.C.y === s0.C.y);

  const opts = C.withPoint(C.withPoint(C.withPoint(s0, "showNames", false), "showStatement", true), "showHint", true);
  check("the three checkboxes flip independently",
    !opts.showNames && opts.showStatement && opts.showHint);
  check("flip functions do not mutate the input",
    s0.showNames && !s0.showStatement && !s0.showHint && s0.C.x === 260);
}

done("bol-13");
