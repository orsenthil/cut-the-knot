#!/usr/bin/env node
"use strict";

/*
 * Logic test for bicentric-quadrilateral/bicentric-quadrilateral-core.js.
 *
 * The applet's configuration is a circle with four points A, B, C, D on it and
 * the quadrilateral P Q R S made by the tangents there. It becomes bicentric
 * exactly when the diagonals AC and BD are perpendicular.
 *
 * This test checks, over the whole small grid of angles:
 *   1. the start position and every move (they are pure and bounded);
 *   2. the claims that hold for every cyclic ABCD (the circle is the incircle
 *      of P Q R S, E is also the crossing of PR and QS, and the feet of the
 *      perpendiculars from E always have E as incenter);
 *   3. the claims made on the cut-the-knot page: KLMN is cyclic iff ABCD is
 *      orthodiagonal, and then I, E and O are collinear - both directions, on
 *      the whole grid and on a constructed orthogonal family;
 *   4. the core's geometry against a second, independent transcription of the
 *      applet's own line/tangent/intersection code over the same grid;
 *   5. the tolerance boundary, degenerate cases and the "done" result.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("bicentric-quadrilateral/bicentric-quadrilateral-core.js", "BicentricQuadrilateralCore");

const TAU = 2 * Math.PI;
const R = 42; // the applet's suggested radius for a 400x250 picture
const C0 = { x: 200, y: 125 };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const ptNear = (a, b, tol = 1e-6) => a && b && near(a.x, b.x, tol) && near(a.y, b.y, tol);

/* --------------------------------------------------- a second transcription */

/* Written straight from the applet's bytecode: GetTangent, GeoSDoub.Intersect,
 * Midpoint, GetPerp and DrawCircumCircle. It shares no code with the core. */
const ref = {
  sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; },
  add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; },
  mul(a, k) { return { x: a.x * k, y: a.y * k }; },
  cross(a, b) { return a.x * b.y - a.y * b.x; },
  dot(a, b) { return a.x * b.x + a.y * b.y; },
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
  intersect(l1, l2) { // DoubLine = point + direction
    const den = this.cross(l1.d, l2.d);
    if (Math.abs(den) < 1e-12) return null;
    const t = this.cross(this.sub(l2.p, l1.p), l2.d) / den;
    return this.add(l1.p, this.mul(l1.d, t));
  },
  onCircle(center, r, ang) {
    return { x: center.x + r * Math.cos(ang), y: center.y + r * Math.sin(ang) };
  },
  tangent(center, p) { // GetTangent: (p.y - O.y, -(p.x - O.x)) as direction
    const dx = center.x - p.x, dy = center.y - p.y;
    return { p, d: { x: -dy, y: dx } };
  },
  line(a, b) { return { p: a, d: this.sub(b, a) }; },
  perp(a, b) { // GetPerp(a, b) = a + (b.y - a.y, -(b.x - a.x))
    return { x: a.x + (b.y - a.y), y: a.y - (b.x - a.x) };
  },
  midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; },
  circumcenter(a, b, c) {
    const m1 = this.midpoint(a, b), m2 = this.midpoint(b, c);
    return this.intersect(
      { p: m1, d: this.sub(this.perp(m1, a), m1) },
      { p: m2, d: this.sub(this.perp(m2, b), m2) });
  },
  foot(p, a, b) {
    const ab = this.sub(b, a);
    const t = this.dot(this.sub(p, a), ab) / this.dot(ab, ab);
    return this.add(a, this.mul(ab, t));
  },
  build(center, radius, angles) {
    const [A, B, Cc, D] = angles.map((a) => this.onCircle(center, radius, a));
    const P = this.intersect(this.tangent(center, A), this.tangent(center, B));
    const Q = this.intersect(this.tangent(center, B), this.tangent(center, Cc));
    const Rr = this.intersect(this.tangent(center, Cc), this.tangent(center, D));
    const S = this.intersect(this.tangent(center, D), this.tangent(center, A));
    if (![P, Q, Rr, S].every(Boolean)) return null;
    const E = this.intersect(this.line(A, Cc), this.line(B, D));
    if (!E) return null;
    const O2 = this.circumcenter(P, Q, Rr); // DrawCircumCircle's L
    const feet = [[A, B], [B, Cc], [Cc, D], [D, A]].map(([u, v]) => this.foot(E, u, v));
    return { A, B, C: Cc, D, P, Q, R: Rr, S, E, O2, feet };
  },
};

/* -------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  equal("start angles are the applet's", s.angles, C.DEFAULT_ANGLES);
  check("start radius is positive", s.radius > 0);
  check("start is not bicentric", C.geometry(s).orthodiagonal === false);
  check("start has no result", C.result(s) === null);
  check("start names are hidden", s.showNames === false);
  check("legal moves include rotate", C.legalMoves(s).some((m) => m.type === "rotate"));
  check("legal moves include bicentric", C.legalMoves(s).some((m) => m.type === "bicentric"));

  const rotated = C.move(s, { type: "rotate", index: 0, delta: 0.1 });
  check("rotate changes only the named angle", near(rotated.angles[0], s.angles[0] + 0.1) &&
    rotated.angles[1] === s.angles[1] && rotated.angles[2] === s.angles[2] && rotated.angles[3] === s.angles[3]);
  check("rotate selects the moved vertex", rotated.selected === 0);
  check("start was not mutated by rotate", s.angles[0] === C.DEFAULT_ANGLES[0]);
  const renamed = C.move(s, { type: "names", value: true });
  check("names toggle is pure", renamed.showNames === true && s.showNames === false);
  const moved = C.move(s, { type: "center", x: 10, y: 20 });
  check("centre move is pure", moved.center.x === 10 && s.center.x === C0.x);
  const sized = C.move(s, { type: "radius", value: 1 });
  check("radius is clamped at the minimum", sized.radius === C.MIN_RADIUS);
  const big = C.move(s, { type: "radius", value: 1e6 });
  check("radius is clamped at the maximum", big.radius === C.MAX_RADIUS);
  check("an unknown move is a no-op", C.move(s, { type: "nonsense" }) === s);
  check("a bad rotation is a no-op", C.move(s, { type: "rotate", index: 9, delta: 1 }) === s);

  const snap = C.move(s, { type: "bicentric" });
  check("Make it bicentric makes the diagonals perpendicular", C.geometry(snap).orthodiagonal === true);
  check("and ends the demo", C.result(snap) === "done");
  check("with collinear I, E, O", C.geometry(snap).collinear === true);
  check("Make it bicentric does not mutate the old position", C.geometry(s).orthodiagonal === false);
}

/* ------------------------------- 2. claims true of every cyclic quadrilateral */

{
  const N = 12; // 12^4 = 20,736 quadruples, all of them
  let drawable = 0;
  let degenerate = 0;
  for (let ia = 0; ia < N; ia++) for (let ib = 0; ib < N; ib++)
    for (let ic = 0; ic < N; ic++) for (let id = 0; id < N; id++) {
      const angles = [ia, ib, ic, id].map((k) => k * TAU / N);
      const state = C.start({ center: C0, radius: R, angles });
      const g = C.geometry(state);
      if (!g.drawable) { degenerate++; continue; }
      drawable++;
      const refg = ref.build(C0, R, angles);
      check("tangents cross in a finite corner", [g.P, g.Q, g.R, g.S].every(Boolean));

      // The circle is the incircle of P Q R S: every side is at distance r.
      const sides = [[g.P, g.Q], [g.Q, g.R], [g.R, g.S], [g.S, g.P]];
      const dists = sides.map(([u, v]) => C.distance(C0, C.foot(C0, u, v)));
      check("the circle touches all four outer sides", dists.every((d) => near(d, R, 1e-6)));

      // E is the crossing of AC and BD, and also of PR and QS.
      const otherE = C.intersect(C.lineThrough(g.P, g.R), C.lineThrough(g.Q, g.S));
      check("E is also the crossing of the outer diagonals", ptNear(g.E, otherE));

      // The feet of the perpendiculars from E always have E as incenter.
      const f = g.feet;
      const fe = f.map((p, i) => C.foot(g.E, p, f[(i + 1) % 4]));
      const inc = fe.map((p) => C.distance(g.E, p));
      check("E is the incenter of the feet quadrilateral", C.spread(inc) <= 1e-6);
      check("feetInscriptible agrees", g.feetInscriptible === true);

      // Independent transcription of the applet's construction.
      if (refg) {
        check("corners match the applet's method", [g.P, g.Q, g.R, g.S].every((p, i) =>
          ptNear(p, [refg.P, refg.Q, refg.R, refg.S][i], 1e-6)));
        check("E matches the applet's method", ptNear(g.E, refg.E, 1e-6));
        check("circumcenter matches the applet's method", ptNear(g.O, refg.O2, 1e-6));
        check("feet match the applet's method", g.feet.every((p, i) => ptNear(p, refg.feet[i], 1e-6)));
      }
    }
  check("the grid was exhaustive", drawable + degenerate === N ** 4);
  // Many grid quadruples have antipodal points (parallel tangents) or three
  // corners on one line; those are degenerate, and the rest are exercised.
  check("enough grid positions were drawable", drawable > 1000);
}

/* ------------------- 3. the orthogonal family: a + c - b - d = pi (mod 2pi) */

{
  const N = 14;
  let count = 0;
  for (let ia = 0; ia < N; ia++) for (let ib = 0; ib < N; ib++)
    for (let id = 0; id < N; id++) {
      const a = ia * TAU / N, b = ib * TAU / N, d = id * TAU / N;
      const c = ((b + d - a + Math.PI) % TAU + TAU) % TAU;
      const state = C.start({ center: C0, radius: R, angles: [a, b, c, d] });
      const g = C.geometry(state);
      if (!g.drawable) continue;
      count++;
      const dot = C.dot(C.sub(g.C, g.A), C.sub(g.D, g.B));
      check("constructed family really is orthodiagonal", Math.abs(dot) < 1e-6);
      check("orthodiagonal agrees", g.orthodiagonal === true);
      check("P Q R S is cyclic", g.cyclic === true);
      check("the feet quadrilateral is cyclic", g.feetCyclic === true);
      check("I, E and O are collinear", g.collinear === true);
      check("the feet quadrilateral's I, E, O are collinear", g.feetCollinear === true);
      check("result is done", C.result(state) === "done");
      // The circumradius from the applet's four-distance average.
      check("the circumradius is positive and finite", g.circumradius > 0 && Number.isFinite(g.circumradius));
      const refg = ref.build(C0, R, [a, b, c, d]);
      if (refg) check("orthogonal case matches the applet's method", ptNear(g.O, refg.O2, 1e-6));
    }
  check("the orthogonal family was non-empty", count > 500);
}

/* --------------------------- 4. the converse: not orthodiagonal, not bicentric */

{
  const N = 10;
  let count = 0;
  for (let ia = 0; ia < N; ia++) for (let ib = 0; ib < N; ib++)
    for (let ic = 0; ic < N; ic++) for (let id = 0; id < N; id++) {
      const angles = [ia, ib, ic, id].map((k) => k * TAU / N);
      const g = C.geometry(C.start({ center: C0, radius: R, angles }));
      if (!g.drawable) continue;
      const dot = Math.abs(C.dot(C.sub(g.C, g.A), C.sub(g.D, g.B)));
      if (dot < 1000) continue; // leave the near-orthogonal boundary to section 5
      count++;
      check("clearly non-orthogonal is reported as such", g.orthodiagonal === false);
      check("no circumcircle when diagonals are not perpendicular", g.cyclic === false);
      check("feet quadrilateral is not cyclic either", g.feetCyclic === false);
      // The page claims bicentric => I, E, O collinear, not the converse:
      // a symmetric (e.g. equally spaced) quadrilateral can line them up too.
      check("no result while not bicentric", C.result(C.start({ center: C0, radius: R, angles })) === null);
    }
  check("the non-orthogonal family was non-empty", count > 1000);
}

/* --------------------------------- 5. tolerance, pure data, degenerate cases */

{
  // AreOrtho compares |dot(AC, BD)| with 100. Put C just inside and just
  // outside that boundary by rotating C a hair from an exact right angle.
  const angles = [0, 0.7, 0, 2.0];
  const exact = ((0.7 + 2.0 - 0 + Math.PI) % TAU + TAU) % TAU;
  const inside = C.move(C.start({ center: C0, radius: R, angles: [angles[0], angles[1], exact, angles[3]] }),
    { type: "rotate", index: 2, delta: 0 });
  check("exactly orthogonal passes AreOrtho", C.orthodiagonal(
    C.handles(inside).A, C.handles(inside).B, C.handles(inside).C, C.handles(inside).D));
  const far = C.move(inside, { type: "rotate", index: 2, delta: 0.9 });
  const hf = C.handles(far);
  check("a clear miss fails AreOrtho", !C.orthodiagonal(hf.A, hf.B, hf.C, hf.D));
  check("the miss has no result", C.result(far) === null);

  // Two coincident points make the tangents parallel: no finite corner.
  const same = C.geometry(C.start({ center: C0, radius: R, angles: [0, 0, 1, 2] }));
  check("coincident points are degenerate", same.drawable === false);

  // The position is plain JSON and survives a round trip.
  const s = C.start({ center: C0, radius: R });
  const json = JSON.parse(JSON.stringify(s));
  check("position is plain JSON", JSON.stringify(C.start(json)) === JSON.stringify(s));
  check("describe names what to do when not bicentric", /drag|Make it bicentric/i.test(C.describe(s)));
  const snap = C.move(s, { type: "bicentric" });
  check("describe names the right-angle result", /right angles|one line/i.test(C.describe(snap)));

  // Translation, and scaling of the radius, keep exact perpendicularity.
  const orth = C.move(s, { type: "bicentric" });
  const translated = C.move(orth, { type: "center", x: -1000, y: 500 });
  check("moving the circle keeps it bicentric", C.geometry(translated).collinear === true);
  const scaled = C.move(orth, { type: "radius", value: 100 });
  check("resizing the circle keeps it bicentric", C.geometry(scaled).orthodiagonal === true);
}

done("bicentric-quadrilateral");
