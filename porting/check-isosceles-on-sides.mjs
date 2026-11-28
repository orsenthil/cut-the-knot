#!/usr/bin/env node
"use strict";

/*
 * Logic test for isosceles-on-sides/isosceles-on-sides-core.js.
 *
 *   node porting/check-isosceles-on-sides.mjs
 *
 * Checked: the initial triangle and the D/E/F offsets against IsoscelesOnSidesCanvas.init;
 * the page's claim (the perpendiculars through A, B, C to EF, FD, DE are
 * concurrent) together with the isosceles legs, the right angles, the equal
 * powers at the radical centre and the second circle intersections, over every
 * fixed configuration and hundreds of random ones; dragging a vertex or an
 * attached point; and degenerate input. The last section is a second, literal
 * transcription of the applet's own bytecode (Midpoint, Perp, PerpP, Compute,
 * FindOrientation, Intersect and AttachedPoint.UpdateLocation) and compares it
 * with the core over all those configurations.
 *
 * The page's claim is true whenever D, E, F are distinct and not collinear.
 * If they are collinear the three perpendiculars are parallel and no finite
 * meeting point exists; the test asserts that too.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("isosceles-on-sides/isosceles-on-sides-core.js", "IsoscelesOnSidesCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) =>
  p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const cross = (a, b) => a.x * b.y - a.y * b.x;
const state = (A, B, Cc, opts = {}) => C.start({
  A, B, C: Cc,
  offset: opts.offset || { D: 50, E: 40, F: 60 },
  sign: opts.sign || { D: 1, E: 1, F: 1 },
});

/* ------------------------- a second transcription of the Java bytecode ----- */

/* IsoscelesOnSidesCanvas.Midpoint */
const aMid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/* IsoscelesOnSidesCanvas.Perp: (-dy, dx)/sqrt(dy*dy + dx*dx) */
function aPerp(p, q) {
  const dy = q.y - p.y, dx = q.x - p.x;
  const len = Math.sqrt(dy * dy + dx * dx);
  return { x: -dy / len, y: dx / len };
}

/* AttachedPoint.Maintain: midpoint(P,Q) + D * Perp, side chosen by Orientation */
function aAttached(P, Q, D, Orientation) {
  const M = aMid(P, Q);
  const v = Orientation === 1 ? aPerp(P, Q) : aPerp(Q, P);
  return { x: M.x + D * v.x, y: M.y + D * v.y };
}

/* IsoscelesOnSidesCanvas.PerpP(P, Q, R, d) */
function aPerpP(P, Q, R, d) {
  const dy = R.y - Q.y, dx = R.x - Q.x;
  const len = Math.sqrt(dy * dy + dx * dx);
  return { x: P.x - d * (dy / len), y: P.y + d * (dx / len) };
}

/* GeoSDoub.FindOrientation(x, p, q) */
function aOrientation(x, p, q) {
  const s = x.x * (p.y - q.y) + x.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Intersect(p1, p2, p3, p4), including its det < 1 tie-break */
function aIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  // The bytecode computes det = a1*b2 - a2*b1 (slots 4,6,10,12).
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}

/* IsoscelesOnSidesCanvas.Compute: intersect the A and B perpendiculars */
function aCompute(A, B, C, D, E, F) {
  const l1 = aPerpP(A, E, F, 200);
  const l2 = aPerpP(B, D, F, 200);
  return aIntersect(A, l1, B, l2);
}

/* AttachedPoint.UpdateLocation, after CTKMoveableDoub's line restriction */
function aDrag(q, P, Q) {
  const M = aMid(P, Q), v = aPerp(P, Q);
  const t = ((q.x - M.x) * v.x + (q.y - M.y) * v.y);
  const on = { x: M.x + t * v.x, y: M.y + t * v.y };
  return { offset: dist(M, on), sign: aOrientation(on, P, Q) };
}

/* SetBisector: line through the midpoint perpendicular to a side */
function aSetBisector(P, Q) {
  const M = aMid(P, Q);
  return [M, aPerpP(M, P, Q, 200)];
}

/* ---------------------------------------------- 1. starting configuration */

{
  const s = C.start();
  const radius = Math.round(Math.min(400, 300) / 2.5);
  const expectedA = {
    x: 200 + radius * Math.cos(2.0943951023931953),
    y: 150 + radius * Math.sin(2.0943951023931953),
  };
  const expectedB = {
    x: 200 + radius * Math.cos(0.5235987755982988),
    y: 150 + radius * Math.sin(0.5235987755982988),
  };
  const expectedC = { x: 200 + radius * Math.cos(Math.PI / 2), y: 150 - radius };
  check("start A is the applet's first point", closePoint(s.A, expectedA, 1e-9));
  check("start B is the applet's second point", closePoint(s.B, expectedB, 1e-9));
  check("start C is the applet's third point", closePoint(s.C, expectedC, 1e-9));
  equal("the applet's three attached distances", s.offset, { D: 50, E: 40, F: 60 });
  equal("all three attached points start on the + side", s.sign, { D: 1, E: 1, F: 1 });
  check("start D is 50 units off the midpoint of BC on its bisector",
    closePoint(s.D, aAttached(s.B, s.C, 50, 1), 1e-9));
  check("start E is 40 units off the midpoint of CA on its bisector",
    closePoint(s.E, aAttached(s.C, s.A, 40, 1), 1e-9));
  check("start F is 60 units off the midpoint of AB on its bisector",
    closePoint(s.F, aAttached(s.A, s.B, 60, 1), 1e-9));
  check("an illustration has no win or loss", C.result(s) === null);
  check("the page's claim holds in the starting picture", C.claims(s).all);
  check("the applet's own Compute agrees with the core at the start",
    closePoint(C.measure(s).P, aCompute(s.A, s.B, s.C, s.D, s.E, s.F), 1e-8));
}

/* ------------------------------------------------ 2. dragging and immutability */

{
  const s = C.start();
  const moved = C.withPoint(s, "A", { x: 100, y: 100 });
  check("withPoint leaves the old position alone", s.A.x === expectedStartX() && moved.A.x === 100);
  check("moving a vertex keeps the attached distances and sides",
    moved.offset.D === 50 && moved.sign.E === 1 && moved.offset.F === 60);
  check("moving a vertex keeps D,E,F on the new perpendicular bisectors",
    closePoint(moved.D, aAttached(moved.B, moved.C, 50, 1), 1e-9) &&
    closePoint(moved.E, aAttached(moved.C, moved.A, 40, 1), 1e-9) &&
    closePoint(moved.F, aAttached(moved.A, moved.B, 60, 1), 1e-9));
  check("an unknown handle is ignored", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  const dragged = C.withPoint(s, "F", { x: s.F.x, y: s.F.y + 40 });
  check("dragging F away raises its attached distance", dragged.offset.F > 60);
  const flipped = C.withPoint(s, "D", {
    x: aAttached(s.B, s.C, 50, -1).x,
    y: aAttached(s.B, s.C, 50, -1).y,
  });
  check("dragging D across BC flips its side", flipped.sign.D === -1);
  check("the page's claim still holds after a drag", C.claims(dragged).all);
  check("move({name, point}) is withPoint", closePoint(
    C.move(s, { name: "B", point: { x: 90, y: 80 } }).B, { x: 90, y: 80 }, 1e-9));
  check("an illegal move is refused", C.move(s, null) === null);
}
function expectedStartX() {
  return 200 + Math.round(300 / 2.5) * Math.cos(2.0943951023931953);
}

/* -------------------------------- 3. the isosceles and concurrency claims */

const fixed = [
  ["the applet's start", C.start()],
  ["a tall acute triangle", state({ x: 200, y: 30 }, { x: 60, y: 270 }, { x: 340, y: 270 })],
  ["an obtuse triangle", state({ x: 40, y: 40 }, { x: 360, y: 90 }, { x: 180, y: 260 })],
  ["a right triangle, mixed sides", state(
    { x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 },
    { offset: { D: 90, E: 10, F: 130 }, sign: { D: 1, E: -1, F: 1 } })],
  ["all three attached points on the far side", state(
    { x: 200, y: 30 }, { x: 60, y: 270 }, { x: 340, y: 270 },
    { offset: { D: 75, E: 55, F: 95 }, sign: { D: -1, E: -1, F: -1 } })],
  ["zero offsets: the three side midpoints", state(
    { x: 200, y: 30 }, { x: 60, y: 270 }, { x: 340, y: 270 },
    { offset: { D: 0, E: 0, F: 0 } })],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  check(`${name}: the three triangles are isosceles`, cl.isosceles);
  check(`${name}: the three rays are perpendicular to EF, FD, DE`, cl.perpendicular);
  check(`${name}: the page's three perpendiculars concur`, cl.concurrent);
  check(`${name}: the meeting point has equal powers (radical centre)`, cl.radicalCenter);
  check(`${name}: the other circle intersections lie on those lines`, cl.secondIntersections);
  check(`${name}: every claim holds at once`, cl.all);
}

/* ------------------------ 4. random configurations, claim and transcription */

{
  const rand = rng(24681357);
  let tested = 0, parallel = 0, worstClaim = 0, worstApplet = 0;
  for (let i = 0; i < 700; i++) {
    const A = { x: 5 + rand() * 390, y: 5 + rand() * 290 };
    const B = { x: 5 + rand() * 390, y: 5 + rand() * 290 };
    const Cc = { x: 5 + rand() * 390, y: 5 + rand() * 290 };
    if (Math.abs(cross({ x: B.x - A.x, y: B.y - A.y }, { x: Cc.x - A.x, y: Cc.y - A.y })) < 1500) continue;
    const offset = { D: rand() * 250, E: rand() * 250, F: rand() * 250 };
    const sign = {
      D: rand() < 0.5 ? 1 : -1,
      E: rand() < 0.5 ? 1 : -1,
      F: rand() < 0.5 ? 1 : -1,
    };
    const s = state(A, B, Cc, { offset, sign });
    const scale = Math.max(dist(A, B), dist(B, Cc), dist(Cc, A), 1);

    // Core D/E/F versus the literal AttachedPoint.Maintain transcription.
    worstApplet = Math.max(worstApplet,
      dist(s.D, aAttached(B, Cc, offset.D, sign.D)) / scale,
      dist(s.E, aAttached(Cc, A, offset.E, sign.E)) / scale,
      dist(s.F, aAttached(A, B, offset.F, sign.F)) / scale);

    // Core P versus the literal Compute transcription.
    const m = C.measure(s);
    const p = aCompute(A, B, Cc, s.D, s.E, s.F);
    if (Number.isFinite(m.P.x) !== Number.isFinite(p.x)) {
      check(`random ${i}: both constructions agree on parallelism`, false);
    }
    if (Number.isFinite(p.x)) {
      worstApplet = Math.max(worstApplet, dist(m.P, p) / scale);
    } else parallel++;

    // The page's claim, checked independently from the applet's transcription.
    const cl = C.claims(s);
    const cLine = aPerp(s.D, s.E);
    const residual = Number.isFinite(p.x)
      ? Math.abs(cross({ x: Cc.x - p.x, y: Cc.y - p.y }, cLine)) / scale : 0;
    worstClaim = Math.max(worstClaim, residual);
    if (!cl.all || residual > 1e-8 || !Number.isFinite(p.x)) {
      check(`random ${i}: the page's concurrence claim holds`, false,
        JSON.stringify({ cl, residual, P: p }));
    }

    // Equal powers at the radical centre, from circles with the applet's radii.
    if (Number.isFinite(p.x)) {
      const cs = C.circles(s);
      const powers = Object.values(cs).map(({ c, r }) => dist(p, c) ** 2 - r ** 2);
      if (Math.max(...powers) - Math.min(...powers) > 1e-6 * scale) {
        check(`random ${i}: equal powers at P`, false, JSON.stringify(powers));
      }
    }

    // Drag any attached point to an arbitrary spot: both transcriptions agree.
    if (i % 7 === 0) {
      for (const name of ["D", "E", "F"]) {
        const [u, v] = C.SIDES[name].map((k) => ({ A, B, C: Cc }[k]));
        const q = { x: rand() * 400, y: rand() * 300 };
        const fromCore = C.withPoint(s, name, q);
        const fromApplet = aDrag(q, u, v);
        if (!close(fromCore.offset[name], fromApplet.offset, 1e-7) ||
            fromCore.sign[name] !== fromApplet.sign) {
          check(`random ${i}: ${name} drag matches AttachedPoint.UpdateLocation`, false,
            JSON.stringify({ core: [fromCore.offset[name], fromCore.sign[name]], applet: fromApplet }));
        }
      }
    }
    tested++;
  }
  check(`all claims hold on ${tested} random configurations`, tested > 600);
  check("no random configuration has parallel A/B perpendiculars", parallel === 0);
  check("the C perpendicular misses P by at most 1e-8 of the scale", worstClaim < 1e-8,
    `worst residual ${worstClaim}`);
  check("core and bytecode agree within 1e-8 of the scale on all points", worstApplet < 1e-8,
    `worst difference ${worstApplet}`);
}

/* --------------------------- 5. applet helpers and degenerate configurations */

{
  const s = C.start();
  const far = { x: 999, y: 999 };
  check("Other picks the far intersection when the first one is the vertex",
    C.other([s.A, far], s.A) === far);
  check("Other keeps the first point when it is far from the vertex",
    C.other([far, s.A], s.A) === far);
  const [Bis, B2] = aSetBisector(s.B, s.C);
  check("SetBisector starts at the side midpoint", closePoint(Bis, C.midpoint(s.B, s.C), 1e-9));
  check("SetBisector's second point is perpendicular to the side",
    close((B2.x - Bis.x) * (s.C.x - s.B.x) + (B2.y - Bis.y) * (s.C.y - s.B.y), 0, 1e-6));

  const flat = state({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("a flat triangle does not throw", typeof C.claims(flat).all === "boolean");
  check("a flat triangle still has no result", C.result(flat) === null);
  const coincident = state({ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 10 });
  check("coincident corners do not throw", typeof C.measure(coincident).P.x === "number");
  // D, E and F on one line: there is no finite meeting point, and the port says so.
  const round = state({ x: 200, y: 150 }, { x: 300, y: 150 }, { x: 250, y: 70 });
  const collinear = state({ x: 200, y: 150 }, { x: 300, y: 150 }, { x: 250, y: 70 }, {
    offset: { D: 50, E: 40, F: 63.672055393347165 },
    sign: { D: 1, E: 1, F: -1 },
  });
  const onOneLine = Math.abs((collinear.E.x - collinear.D.x) * (collinear.F.y - collinear.D.y) -
    (collinear.E.y - collinear.D.y) * (collinear.F.x - collinear.D.x)) < 1e-9;
  check("a collinear D,E,F configuration was constructed", onOneLine);
  check("collinear D,E,F have no finite meeting point", !Number.isFinite(C.measure(collinear).P.x));
  check("the port reports the claim as false in that degenerate case",
    !C.claims(collinear).all && !C.claims(collinear).concurrent);
  check("a very large offset is handled without throwing",
    typeof C.claims(C.withPoint(round, "F", { x: round.F.x, y: round.F.y + 1e6 })).all === "boolean");
  check("the initial P is far from the vertices but still a finite point",
    Number.isFinite(C.measure(s).P.x));
}

done("isosceles-on-sides");
