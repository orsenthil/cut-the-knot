#!/usr/bin/env node
"use strict";

/*
 * Logic test for incircle-in-segment/incircle-in-segment-core.js.
 *
 *   node porting/check-incircle-in-segment.mjs
 *
 * The core uses a short formula for the inscribed circle. Section 3 writes
 * IncircleInSegmentCanvas.Draw a second time from the bytecode: it cuts line
 * MA against the big circle, inverts that circle in the circle centred at M
 * through A and the cut point (InvertCinC / Inversion.Invert / TangentAt), and
 * intersects the resulting line with the radius to the cut point. The two
 * answers are compared at every grid point inside the disc, not at a few
 * samples. Section 4 checks the page's claim at the same grid points.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("incircle-in-segment/incircle-in-segment-core.js", "IncircleInSegmentCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const O = C.O, R = C.R, M = C.M;

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("a new drawing has A inside the disc", dist(s.A, O) < R && s.A.y < M.y - C.MIN_H);
  check("the applet's M is the bottom of the big circle", M.x === O.x && M.y === O.y + R);
  check("the start matches the applet's fixed angle", Math.abs(s.A.x - C.START.x) < 1e-12 && Math.abs(s.A.y - C.START.y) < 1e-12);
  equal("the hint starts unchecked", s.hint, false);
  equal("an illustration has no win or loss", C.result(s), null);
  equal("A is the only draggable point", C.legalMoves(s), ["A"]);
  const moved = C.move(s, { x: 1000, y: 1000 });
  check("dragging cannot take A outside the disc", dist(moved.A, O) <= C.MAX_D + 1e-9);
  check("dragging cannot take A down to M", moved.A.y <= M.y - C.MIN_H + 1e-9);
  check("a drag that changes nothing keeps the position", C.move(s, s.A) === s);
  equal("the checkbox is set", C.setOption(s, "hint", true).hint, true);
  equal("an unknown option is ignored", C.setOption(s, "other", true), s);
  const reset = C.reset(C.setOption(moved, "hint", true));
  check("reset restores A but keeps the hint", dist(reset.A, s.A) < 1e-12 && reset.hint === true);
  check("a point on M cannot give a circle", C.construct(M) === null);
}

/* --------------------------------- 2. an independent transcription of Draw */

/** InvLine.InvertCinC: invert a circle in the circle (m, rho). */
function invertCircle(m, rho, target, flag) {
  const power = dist(m, target.c) ** 2 - target.r ** 2;
  if (Math.abs(power) > 100) {
    // The applet's analytic branch, including its sign for the negative case.
    const factor = (rho * rho / power) * (flag ? -1 : 1);
    return {
      circle: {
        c: { x: m.x + (target.c.x - m.x) * factor, y: m.y + (target.c.y - m.y) * factor },
        r: Math.abs(target.r * factor),
      },
    };
  }
  // The branch used when M lies on the big circle: invert the point opposite
  // M and take the tangent there (Inversion.Invert + InvLine.TangentAt).
  const opposite = { x: 2 * target.c.x - m.x, y: 2 * target.c.y - m.y };
  const d = dist(m, opposite);
  const f = (rho * rho) / (d * d);
  const p = { x: m.x + f * (opposite.x - m.x), y: m.y + f * (opposite.y - m.y) };
  return { line: { a: p, b: { x: p.x + 100 * (p.y - m.y), y: p.y - 100 * (p.x - m.x) } } };
}

/** GeoSDoub.Intersect(DoubCircle, DoubLine), by the line's parameter. */
function cutCircle(center, r, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fx = a.x - center.x, fy = a.y - center.y;
  const aa = dx * dx + dy * dy;
  const bb = 2 * (fx * dx + fy * dy);
  const disc = bb * bb - 4 * aa * (fx * fx + fy * fy - r * r);
  if (!(aa > 0) || disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-bb + root) / (2 * aa), (-bb - root) / (2 * aa)].map((t) => ({
    x: a.x + t * dx, y: a.y + t * dy,
  }));
}

/** InSegment: the middle point of three collinear points, with a 0.1 skip. */
function inSegment(mid, a, b) {
  if (dist(a, b) < 0.1) return false;
  const between = (u, v, w) => (v <= u && u <= w) || (w <= u && u <= v);
  return between(mid.x, a.x, b.x) && between(mid.y, a.y, b.y);
}

/** IncircleInSegmentCanvas.Perp: a point one line-direction away, turned 90deg. */
function perpPoint(p, a, b) {
  return { x: p.x + (a.y - b.y), y: p.y - (a.x - b.x) };
}

/** GeoSDoub.Intersect(DoubPoint x4): intersection of two infinite lines. */
function intersectLines(a, b, c, d) {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return { x: NaN, y: NaN };
  const u = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  return { x: a.x + u * rx, y: a.y + u * ry };
}

/**
 * The applet's Draw loop for one position of A. It returns every circle the
 * canvas would paint, in the order of GeoSDoub.Intersect's two cut points.
 */
function appletDraw(a) {
  const cuts = cutCircle(O, R, M, a);
  const drawn = [];
  for (const t of cuts) {
    if (dist(M, t) <= 0.1) continue; // Draw skips the cut at M itself
    const flag = inSegment(M, a, t);
    const rho = Math.sqrt(dist(M, a) * dist(M, t));
    const inverse = invertCircle(M, rho, { c: O, r: R }, flag);
    const centre = inverse.circle
      ? intersectLines(O, t, a, inverse.circle.c)
      : intersectLines(O, t, a, perpPoint(a, inverse.line.a, inverse.line.b));
    drawn.push({ centre, radius: dist(centre, a), flag, cut: t, inverse });
  }
  return drawn;
}

{
  // Every grid point in the disc, excluding points too close to M (where the
  // applet itself draws a degenerate picture).
  let compared = 0;
  let worstCentre = 0;
  let worstRadius = 0;
  for (let ix = -12; ix <= 12; ix++) {
    for (let iy = -12; iy <= 12; iy++) {
      const a = { x: O.x + ix * 7, y: O.y + iy * 7 };
      if (dist(a, O) > R * 0.9 || a.y > M.y - C.MIN_H) continue;
      const g = C.construct(a);
      const painted = appletDraw(a);
      if (!g || painted.length !== 1) continue;
      const p = painted[0];
      // With A on the line OM the applet's radius line and perpendicular
      // coincide; its own Intersect returns NaN there, so there is nothing to
      // compare. The core still handles that position.
      if (!Number.isFinite(p.centre.x) || !Number.isFinite(p.centre.y)) continue;
      compared++;
      worstCentre = Math.max(worstCentre, dist(g.Op, p.centre));
      worstRadius = Math.max(worstRadius, Math.abs(g.rho - p.radius));
    }
  }
  check("the grid covers hundreds of configurations", compared > 400, `${compared} positions`);
  check("the core's centre matches the bytecode inversion", worstCentre < 1e-6, `${worstCentre}`);
  check("the core's radius matches the bytecode inversion", worstRadius < 1e-6, `${worstRadius}`);

  // InSegment's own edge cases from the bytecode: skip when the ends are less
  // than 0.1 apart, accept the ends and the middle, reject a point outside.
  check("InSegment skips coincident ends", !inSegment({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0.05, y: 0 }));
  check("InSegment accepts an end", inSegment({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }));
  check("InSegment accepts the middle", inSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }));
  check("InSegment rejects a point beyond an end", !inSegment({ x: 11, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }));
  const sample = appletDraw(C.start({}).A)[0];
  equal("the applet never uses the negative inversion branch", sample.flag, false);
  check("M lies on the big circle, so Draw takes the line branch", sample.inverse.line !== undefined);
}

/* --------------------------------- 3. the page's claim at every grid point */

{
  let positions = 0;
  let maxCross = 0;
  let maxArc = 0;
  let maxTangency = 0;
  let maxChord = 0;
  let maxHomo = 0;
  let maxIsosceles = 0;
  let minR = Infinity;
  let maxR = 0;
  for (let ix = -13; ix <= 13; ix++) {
    for (let iy = -13; iy <= 13; iy++) {
      const a = { x: O.x + ix * 7, y: O.y + iy * 7 };
      if (dist(a, O) > R * 0.92 || a.y > M.y - C.MIN_H) continue;
      const g = C.construct(a);
      if (!g) continue;
      positions++;
      // The claim: the tangency points A and B and the arc midpoint M line up.
      maxCross = Math.max(maxCross, Math.abs(cross(g.A, g.B, g.M)));
      // M really is the midpoint of the arc ST away from B.
      maxArc = Math.max(maxArc,
        dist(g.arcMid, g.M), Math.abs(dist(g.M, g.S) - dist(g.M, g.T)));
      // A real inscribed circle: tangent to the chord, to the big circle and
      // passing through B.
      maxTangency = Math.max(maxTangency,
        Math.abs(g.rho - dist(g.Op, g.A)),
        Math.abs(g.rho - dist(g.Op, g.B)),
        Math.abs(dist(g.Op, O) + g.rho - R));
      // The chord is horizontal and OA' is perpendicular to it.
      maxChord = Math.max(maxChord,
        Math.abs(g.S.y - g.A.y), Math.abs(g.T.y - g.A.y),
        g.S.x > g.A.x ? 1 : 0, g.T.x < g.A.x ? 1 : 0,
        dist(g.S, O) - R, dist(g.T, O) - R,
        Math.abs(g.A.x - g.Op.x));
      // Homothety from B with ratio R/rho maps A to M; NOB is isosceles.
      maxHomo = Math.max(maxHomo, dist(g.mappedA, M));
      maxIsosceles = Math.max(maxIsosceles,
        Math.abs(dist(g.N, O) - R), Math.abs(dist(g.B, O) - R),
        Math.abs(dist(g.A, g.Op) - dist(g.B, g.Op)));
      minR = Math.min(minR, g.rho);
      maxR = Math.max(maxR, g.rho);
    }
  }
  check("the exhaustive grid is really exhaustive", positions > 500, `${positions} positions`);
  check("A, B and M are collinear everywhere", maxCross < 1e-9, `${maxCross}`);
  check("M is the midpoint of the arc without B everywhere", maxArc < 1e-9, `${maxArc}`);
  check("the small circle is tangent to chord and big circle", maxTangency < 1e-9, `${maxTangency}`);
  check("S, A, T lie on the chord and S,T on the big circle", maxChord < 1e-9, `${maxChord}`);
  check("the homothety from B carries A to M", maxHomo < 1e-9, `${maxHomo}`);
  check("the two proof triangles are isosceles", maxIsosceles < 1e-9, `${maxIsosceles}`);
  check("every radius is positive", minR > 0, `${minR}`);
  check("every radius is smaller than the big radius", maxR < R, `${maxR}`);

  // The largest inscribed circle in this family occurs when A is the centre.
  const centre = C.construct({ ...O });
  check("A at the centre gives radius R/2", Math.abs(centre.rho - R / 2) < 1e-12);
  check("A at the centre touches the top of the circle", dist(centre.B, centre.Op) < R / 2 + 1e-9);
}

/* ------------------------------------ 4. the applet's own numbers and text */

{
  const g = C.geometry(C.start({}));
  const painted = appletDraw(C.start({}).A)[0];
  check("the transcribed rho squared is MA*MT", Math.abs(painted.inverse.line.a.y - g.A.y) < 1e-6);
  check("the transcribed cut point is B", dist(painted.cut, g.B) < 1e-6);
  check("the description states the collinearity", /A, B and M lie on one line/.test(C.describe(C.start({}))));
  const h = C.setOption(C.start({}), "hint", true);
  check("the description mentions the proof lines with Hint on", /Dashed lines/.test(C.describe(h)));
}

done("incircle-in-segment");
