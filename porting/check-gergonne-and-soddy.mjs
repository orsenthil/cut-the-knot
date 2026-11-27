#!/usr/bin/env node
"use strict";

/*
 * Logic test for gergonne-and-soddy/gergonne-and-soddy-core.js.
 *
 *   node porting/check-gergonne-and-soddy.mjs
 *
 * The claim on the cut-the-knot page is: "Wherever the Soddy line is uniquely
 * defined (in particular, in a scalene triangle), it is perpendicular to
 * Gergonne Line", and "In a scalene triangle I and Ge never coincide so that
 * the Soddy line is uniquely defined." The page also says the Gergonne line is
 * the polar of Ge, that the three Nobbs points lie on it, and describes the
 * inversion images of the sides, the touch chords and the Gergonne line.
 *
 * Section 2 transcribes Compute() again, straight from the bytecode of
 * GergonneAndSoddyCanvas and the GeoSDoub helpers it calls (angle-bisector
 * incenter, NearestPoint's guard, the 2-pixel Soddy guard and InsideTest's
 * choice of Nobbs points). Both transcriptions are compared over a grid of
 * triangles and 1,500 pseudo-random ones.
 *
 * Section 3 checks the page's claims exhaustively over the same cases: the
 * perpendicularity, the polar identity, the inversion diameters and the
 * equilateral exception to "I and Ge never coincide".
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("gergonne-and-soddy/gergonne-and-soddy-core.js", "GergonneAndSoddyCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const finiteP = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Math.abs(a - b) <= tol;
const closeP = (p, q, tol) => finiteP(p) && finiteP(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const rel = (a, b, scale = 1) => close(a, b, 1e-6 * Math.max(1, Math.abs(a), Math.abs(b), scale));

/**
 * A triangle whose incircle is at least a pixel wide and whose area is not a
 * sliver. The applet's own double precision breaks down for nearly collinear
 * corners (Nobbs points fly far off the board), so those cases are counted and
 * skipped rather than compared with a meaningless tolerance.
 */
const usable = (p, g) => {
  if (!g.valid || !g.soddyDefined || !finiteP(g.S) || !(g.r > 1)) return false;
  const a = dist(p.B, p.C), b = dist(p.C, p.A), c = dist(p.A, p.B);
  const area = Math.abs(cross(sub(p.B, p.A), sub(p.C, p.A)));
  if (area / Math.max(a * a, b * b, c * c) < 0.02) return false;
  return [g.A2, g.B2, g.C2, g.Ge, g.S].every((q) =>
    Math.abs(q.x) < 1e5 && Math.abs(q.y) < 1e5);
};

/* ------------------------------------------------------------------
 * A second transcription of the applet's own bytecode. This one follows
 * GeoSDoub's angle bisectors instead of the core's side-length weights.
 * ------------------------------------------------------------------ */

const Applet = (() => {
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

  function computeAngle(p, q, r) {
    const c = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) /
      (2 * Math.sqrt(sqDist(p, q)) * Math.sqrt(sqDist(p, r)));
    return Math.acos(Math.max(-1, Math.min(1, c)));
  }

  function findOrientation(p, q, r) {
    const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
    return v > 0 ? 1 : -1;
  }

  function rotate(centre, point, angle, direction) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = point.x - centre.x, dy = point.y - centre.y;
    return {
      x: centre.x + c * dx - direction * s * dy,
      y: centre.y + direction * s * dx + c * dy,
    };
  }

  // GeoSDoub.Intersect(p1,p2,p3,p4): |det| < 1 returns NaN.
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  function findIncenter(A, B, C) {
    const halfA = computeAngle(A, B, C) / 2;
    const halfB = computeAngle(B, C, A) / 2;
    const dir = findOrientation(A, B, C);
    const bisA = rotate(A, B, halfA, dir);
    const bisB = rotate(B, C, halfB, dir);
    return intersect(A, bisA, B, bisB);
  }

  // GeoSDoub.NearestPoint(P,A,B): SqDist(A,P) < 0.1 returns P itself.
  function nearest(P, A, B) {
    if (sqDist(A, P) < 0.1) return { x: P.x, y: P.y };
    const dx = B.x - A.x, dy = B.y - A.y;
    const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / (dx * dx + dy * dy);
    return { x: A.x + dx * t, y: A.y + dy * t };
  }

  const inside = (P, A, B) => (P.x - A.x) * (P.x - B.x) + (P.y - A.y) * (P.y - B.y) <= 0;

  const cross4 = (p, q, r, s) => intersect(p, q, r, s);

  function compute(A, B, C) {
    const I = findIncenter(A, B, C);
    const B1 = nearest(I, A, C); // B1 = NearestPoint(I, A, C) -- on AC
    const C1 = nearest(I, B, A); // C1 = NearestPoint(I, B, A) -- on AB
    const A1 = nearest(I, C, B); // A1 = NearestPoint(I, C, B) -- on BC

    const A2 = cross4(B, C, B1, C1);
    const B2 = cross4(C, A, C1, A1);
    const C2 = cross4(A, B, A1, B1);

    // GetIncircle(): mean of the three distances from I to the touch points.
    const r = (dist(I, nearest(I, A, B)) + dist(I, nearest(I, B, C)) +
      dist(I, nearest(I, C, A))) / 3;
    const AA = cross4(A, A1, B, B1);
    const BB = cross4(B, B1, C, C1);
    const CC = cross4(C, C1, A, A1);
    const Ge = { x: (AA.x + BB.x + CC.x) / 3, y: (AA.y + BB.y + CC.y) / 3 };

    // GetLine(Ge, Incircle, SLine): dist < 2 keeps the old (null) line.
    const SL = dist(Ge, I) < 2 ? null : { p: I, q: Ge };
    // GetLine(A2, B2, C2): InsideTest chooses the outer pair.
    let pair;
    if (inside(B2, A2, C2)) pair = [A2, C2];
    else if (inside(C2, A2, B2)) pair = [A2, B2];
    else pair = [B2, C2];
    const GL = { p: pair[0], q: pair[1] };
    const S = SL ? cross4(SL.p, SL.q, GL.p, GL.q) : null;
    return { I, r, A1, B1, C1, A2, B2, C2, Ge, GL, SL, S };
  }

  return { compute, findIncenter, nearest, intersect, inside, computeAngle };
})();

/* ------------------------------------------------------------ 1. the setup */

{
  equal("the applet is 500 by 500", [C.WIDTH, C.HEIGHT], [500, 500]);
  const s = C.start({});
  check("A is at (3W/4, 2H/3)",
    closeP(s.A, { x: 375, y: 1000 / 3 }, 1e-9));
  check("B is at (5W/9, H/3)",
    closeP(s.B, { x: 2500 / 9, y: 500 / 3 }, 1e-9));
  check("C is at (5W/11, H/2)",
    closeP(s.C, { x: 2500 / 11, y: 250 }, 1e-9));
  check("the proof applet opens with names and statement on, the other two off",
    s.names && s.statement && !s.premises && !s.inversion);
  const moved = C.setPoint(s, "B", { x: 10, y: 20 });
  check("setPoint is pure and only moves the named point",
    s.B.x !== 10 && moved.B.x === 10 && dist(moved.A, s.A) === 0 && dist(moved.C, s.C) === 0);
  check("setPoint clamps to the applet's two-pixel margin",
    closeP(C.setPoint(s, "A", { x: -20, y: 999 }).A, { x: 2, y: 498 }, 1e-9));
  check("setPoint refuses an unknown vertex", C.setPoint(s, "D", { x: 0, y: 0 }) === s);
  const toggled = C.setOption(C.setOption(s, "premises", true), "inversion", true);
  check("all four checkboxes can change independently",
    toggled.premises && toggled.inversion && toggled.names && toggled.statement &&
    C.setOption(s, "names", false).names === false);
  const reset = C.reset(toggled);
  check("reset keeps the board size and the four options",
    reset.width === 500 && reset.height === 500 && reset.premises &&
    reset.inversion && closeP(reset.A, s.A, 1e-9));
  check("position is plain saveable data",
    JSON.stringify(C.position(s)) === JSON.stringify({
      A: s.A, B: s.B, C: s.C,
      names: true, premises: false, statement: true, inversion: false,
    }));
}

/* ------------------------ 2. the core against the applet's own computation */

function* configurations() {
  // A regular grid: the fixed vertex keeps the triangles well spread out.
  for (const bx of [40, 110, 180, 250, 320, 390, 460]) {
    for (const by of [40, 120, 200, 280, 360, 440]) {
      for (const cx of [60, 140, 220, 300, 380, 460]) {
        for (const cy of [60, 150, 240, 330, 420]) {
          yield { A: { x: 250, y: 250 }, B: { x: bx, y: by }, C: { x: cx, y: cy } };
        }
      }
    }
  }
  const random = rng(20261127);
  for (let i = 0; i < 1500; i++) {
    yield {
      A: { x: random() * 500, y: random() * 500 },
      B: { x: random() * 500, y: random() * 500 },
      C: { x: random() * 500, y: random() * 500 },
    };
  }
}

const tally = {
  cases: 0, skipped: 0, incenter: 0, radius: 0, touches: 0, nobbs: 0,
  gergonne: 0, soddy: 0, gline: 0, inter: 0,
};
const worst = { incenter: 0, radius: 0, touches: 0, nobbs: 0, gergonne: 0, angle: 0, polar: 0 };

for (const p of configurations()) {
  const state = { ...p, width: 500, height: 500 };
  const g = C.geometry(state);
  const ref = Applet.compute(p.A, p.B, p.C);
  if (!usable(p, g) || !finiteP(ref.I) || !finiteP(ref.A2) ||
      !finiteP(ref.B2) || !finiteP(ref.C2) || !finiteP(ref.Ge)) {
    tally.skipped++;
    continue;
  }
  tally.cases++;

  worst.incenter = Math.max(worst.incenter, dist(g.I, ref.I));
  if (closeP(g.I, ref.I, 1e-6 * Math.max(1, dist(ref.I, p.A)))) tally.incenter++;

  worst.radius = Math.max(worst.radius, Math.abs(g.r - ref.r));
  if (close(g.r, ref.r, 1e-6 * Math.max(1, ref.r))) tally.radius++;

  const touches = [["A1", "A1"], ["B1", "B1"], ["C1", "C1"]];
  for (const [a, b] of touches) {
    const err = dist(g[a], ref[b]);
    worst.touches = Math.max(worst.touches, err);
    if (err < 1e-6 * Math.max(1, Math.abs(ref[b].x), Math.abs(ref[b].y))) tally.touches++;
  }
  const nobbs = [["A2", "A2"], ["B2", "B2"], ["C2", "C2"]];
  for (const [a, b] of nobbs) {
    const q = g[a], w = ref[b];
    const err = Math.max(Math.abs(q.x - w.x), Math.abs(q.y - w.y));
    worst.nobbs = Math.max(worst.nobbs, err);
    if (err < 1e-6 * Math.max(1, Math.abs(w.x), Math.abs(w.y))) tally.nobbs++;
  }

  const errGe = Math.max(Math.abs(g.Ge.x - ref.Ge.x), Math.abs(g.Ge.y - ref.Ge.y));
  worst.gergonne = Math.max(worst.gergonne, errGe);
  if (errGe < 1e-6 * Math.max(1, Math.abs(ref.Ge.x), Math.abs(ref.Ge.y))) tally.gergonne++;

  if (g.soddyDefined !== Boolean(ref.SL)) throw new Error("the 2-pixel Soddy guard disagrees");
  if (ref.SL) {
    // Same infinite line: both points of one lie on the other's line.
    const slA = g.lines.SL;
    const refCross = cross(sub(ref.SL.q, ref.SL.p), sub(slA.q, slA.p));
    const aOnRef = Math.abs(cross(sub(slA.p, ref.SL.p), sub(ref.SL.q, ref.SL.p)));
    const bOnRef = Math.abs(cross(sub(slA.q, ref.SL.p), sub(ref.SL.q, ref.SL.p)));
    if (aOnRef < 1e-5 && bOnRef < 1e-5 && Math.abs(refCross) < 1e-5) tally.soddy++;
  } else tally.soddy++;

  const gl = g.lines.GL;
  const refDir = sub(ref.GL.q, ref.GL.p);
  const coreDir = sub(gl.q, gl.p);
  const refLen = Math.hypot(refDir.x, refDir.y);
  const crossDir = Math.abs(cross(coreDir, refDir)) /
    (Math.hypot(coreDir.x, coreDir.y) * refLen);
  const refOnCore = Math.abs(cross(sub(ref.GL.p, gl.p), coreDir)) /
    Math.hypot(coreDir.x, coreDir.y);
  if (crossDir < 1e-9 && refOnCore < 1e-6 * Math.max(1, Math.abs(ref.GL.p.x))) {
    tally.gline++;
  }
  if (ref.S && finiteP(g.S) && dist(g.S, ref.S) < 1e-6 * Math.max(1, Math.abs(ref.S.x), Math.abs(ref.S.y))) {
    tally.inter++;
  }
}

check("the grid and random triangles were exercised", tally.cases > 2500, `${tally.cases} cases`);
check("near-parallel triangles were skipped honestly", tally.skipped > 0, `${tally.skipped} skipped`);
check("the core's incenter matches FindIncenter everywhere", tally.incenter === tally.cases);
check("the incircle radius matches GetIncircle everywhere", tally.radius === tally.cases);
check("the touch points match NearestPoint everywhere", tally.touches === 3 * tally.cases);
check("the three Nobbs points match Intersect everywhere", tally.nobbs === 3 * tally.cases);
check("Ge matches the average of the three cevian intersections", tally.gergonne === tally.cases);
check("the 2-pixel Soddy guard and the Soddy line agree", tally.soddy === tally.cases);
check("the chosen pair of Nobbs points gives the same Gergonne line", tally.gline === tally.cases);
check("S = GL intersect SL agrees", tally.inter === tally.cases);

/* ------------------------ 3. the page's claims, over the same cases */

const claims = {
  perpendicular: 0, collinear: 0, cevians: 0, polar: 0, diameter: 0,
  sideCircles: 0, chordCircles: 0, chordCandidates: 0, soddySelf: 0, pointImages: 0,
  geOnCircle: 0, marks: 0, scalene: 0, scale: 0,
};
let scaleneCases = 0;

for (const p of configurations()) {
  const g = C.geometry({ ...p, width: 500, height: 500 });
  if (!usable(p, g)) continue;
  claims.scale++;

  // The exact claim: the two lines are perpendicular.
  const errAngle = Math.abs(g.angle - 90);
  worst.angle = Math.max(worst.angle, errAngle);
  if (errAngle < 1e-3) claims.perpendicular++;

  // The three Nobbs points lie on one line (the Gergonne line).
  const glDir = sub(g.lines.GL.q, g.lines.GL.p);
  const glLen = Math.hypot(glDir.x, glDir.y);
  let col = 0;
  for (const q of [g.A2, g.B2, g.C2]) {
    col = Math.max(col, Math.abs(cross(sub(q, g.lines.GL.p), glDir)) / glLen);
  }
  if (col < 1e-5 * Math.max(1, Math.abs(g.A2.x), Math.abs(g.B2.x), Math.abs(g.C2.x))) {
    claims.collinear++;
  }

  // The cevians from A/B/C to the touch points pass through Ge.
  let cev = 0;
  for (const [vertex, touch] of [[p.A, g.A1], [p.B, g.B1], [p.C, g.C1]]) {
    const d = sub(touch, vertex), len = Math.hypot(d.x, d.y);
    cev = Math.max(cev, Math.abs(cross(sub(g.Ge, vertex), d)) / len);
  }
  if (cev < 1e-5 * Math.max(1, Math.abs(g.Ge.x), Math.abs(g.Ge.y))) claims.cevians++;

  // The page calls the Gergonne line the polar of Ge: (X-I).(Ge-I) = r^2.
  let polar = 0;
  for (const q of [g.A2, g.B2, g.C2]) {
    const lhs = dot(sub(q, g.I), sub(g.Ge, g.I));
    const err = Math.abs(lhs - g.r * g.r);
    worst.polar = Math.max(worst.polar, err / Math.max(1, Math.abs(lhs), g.r * g.r));
    if (err < 1e-5 * Math.max(1, Math.abs(lhs), g.r * g.r)) polar++;
  }
  if (polar === 3) claims.polar++;

  // Inversion of the Gergonne line is the circle with diameter IGe.
  const glImage = g.inversions.find((x) => x.key === "GL");
  const wantCentre = mid(g.I, g.Ge), wantRadius = dist(g.I, g.Ge) / 2;
  if (glImage && glImage.kind === "circle" &&
      closeP(glImage.c, wantCentre, 1e-5 * Math.max(1, Math.abs(wantCentre.x))) &&
      close(glImage.r, wantRadius, 1e-5 * Math.max(1, wantRadius))) claims.diameter++;

  // The inverse of each side is the circle on I and the opposite touch point.
  const sides = [
    ["AB", g.C1], ["BC", g.A1], ["CA", g.B1],
  ];
  for (const [key, touch] of sides) {
    const im = g.inversions.find((x) => x.key === key);
    if (im && im.kind === "circle" &&
        closeP(im.c, mid(g.I, touch), 1e-6 * Math.max(1, Math.abs(im.c.x))) &&
        close(im.r, g.r / 2, 1e-6 * Math.max(1, g.r))) claims.sideCircles++;
  }

  // The inverse of each touch chord is the circle on I and the opposite vertex.
  const chords = [["A1B1", p.C], ["B1C1", p.A], ["C1A1", p.B]];
  for (const [key, vertex] of chords) {
    const im = g.inversions.find((x) => x.key === key);
    // InvLine.InvertLinC keeps the line itself when I is within 0.1 of it.
    if (!im || im.kind !== "circle") continue;
    claims.chordCandidates++;
    if (closeP(im.c, mid(g.I, vertex), 1e-6 * Math.max(1, Math.abs(im.c.x))) &&
        close(im.r, dist(g.I, vertex) / 2, 1e-6 * Math.max(1, dist(g.I, vertex)))) {
      claims.chordCircles++;
    }
  }

  // The Soddy line passes through the centre of inversion, so it inverts to
  // itself -- the applet does not draw this one for that reason.
  const slImage = C.invertLine(g.lines.SL, g.I, g.r);
  if (slImage.kind === "line" && closeP(slImage.line.p, g.lines.SL.p, 1e-9)) claims.soddySelf++;

  // A3, B3, C3 (the inverses of the Nobbs points) lie on the image circle,
  // as does Ge; this is the page's reason IGe is that circle's diameter.
  let images = 0, geOn = 0;
  if (glImage && glImage.kind === "circle") {
    for (const q of [g.A2, g.B2, g.C2]) {
      const d2 = Math.max(1e-9, Math.hypot(q.x - g.I.x, q.y - g.I.y) ** 2);
      const inv = {
        x: g.I.x + (g.r * g.r / d2) * (q.x - g.I.x),
        y: g.I.y + (g.r * g.r / d2) * (q.y - g.I.y),
      };
      if (close(dist(inv, glImage.c), glImage.r,
        1e-5 * Math.max(1, Math.abs(inv.x), glImage.r))) images++;
    }
    if (close(dist(g.Ge, glImage.c), glImage.r,
      1e-5 * Math.max(1, Math.abs(g.Ge.x), glImage.r))) geOn++;
  }
  if (images === 3) claims.pointImages++;
  if (geOn) claims.geOnCircle++;

  // ShowStatement() draws right-angle marks at S for the Nobbs points it
  // selects; each mark uses I and a point on the Gergonne line.
  if (g.marks.length >= 2 && g.marks.every((q) => {
    if (!finiteP(q)) return false;
    const u = sub(q, g.S), v = sub(g.I, g.S);
    return Math.abs(dot(u, v)) < 1e-6 * Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
  })) claims.marks++;

  // The scalene half of the page's claim.
  const a = dist(p.B, p.C), b = dist(p.C, p.A), c = dist(p.A, p.B);
  if (Math.min(Math.abs(a - b), Math.abs(b - c), Math.abs(c - a)) > 1e-6 * Math.max(a, b, c)) {
    scaleneCases++;
    if (dist(g.I, g.Ge) > 1e-7 * Math.max(a, b, c)) claims.scalene++;
  }
}

check("perpendicularity holds wherever the Soddy line is drawn",
  claims.perpendicular === claims.scale, `${claims.perpendicular}/${claims.scale}`);
check("the Nobbs points are collinear on the Gergonne line",
  claims.collinear === claims.scale);
check("the Gergonne cevians meet at Ge", claims.cevians === claims.scale);
check("the Gergonne line is the polar of Ge in the incircle",
  claims.polar === claims.scale);
check("the inverted Gergonne line has diameter IGe",
  claims.diameter === claims.scale);
check("each side inverts to the circle on I and its touch point",
  claims.sideCircles === 3 * claims.scale);
check("each touch chord inverts to the circle on I and the opposite vertex",
  claims.chordCandidates >= 3 * claims.scale - 40 &&
  claims.chordCircles === claims.chordCandidates,
  `${claims.chordCircles}/${claims.chordCandidates} of ${3 * claims.scale}`);
check("the Soddy line inverts to itself", claims.soddySelf === claims.scale);
check("A3, B3, C3 lie on the inverted Gergonne circle",
  claims.pointImages === claims.scale);
check("Ge lies on the inverted Gergonne circle", claims.geOnCircle === claims.scale);
check("ShowStatement's right-angle marks are really right", claims.marks === claims.scale);
check("I and Ge differ in every scalene case", scaleneCases > 100 && claims.scalene === scaleneCases,
  `${claims.scalene}/${scaleneCases}`);
check("numerical error stayed at floating-point scale",
  worst.incenter < 1e-6 && worst.radius < 1e-6 && worst.touches < 1e-5 &&
  worst.nobbs < 1e-5 && worst.gergonne < 1e-5 && worst.angle < 1e-3 && worst.polar < 1e-5,
  JSON.stringify(worst));

/* ------------------------------------- 4. the equilateral exception and edges */

{
  // I = Ge exactly for an equilateral triangle -- the one case where the
  // Soddy line is not determined. For an isosceles triangle they still differ.
  const h = 200 * Math.sqrt(3);
  const equi = { A: { x: 250, y: 250 - h }, B: { x: 50, y: 250 }, C: { x: 450, y: 250 } };
  const s = (dist(equi.A, equi.B) + dist(equi.B, equi.C) + dist(equi.C, equi.A)) / 2;
  const gergonne = (A, B, C, semiperimeter) => {
    const wa = 1 / (semiperimeter - dist(B, C));
    const wb = 1 / (semiperimeter - dist(C, A));
    const wc = 1 / (semiperimeter - dist(A, B));
    return { x: (wa * A.x + wb * B.x + wc * C.x) / (wa + wb + wc),
      y: (wa * A.y + wb * B.y + wc * C.y) / (wa + wb + wc) };
  };
  const equiI = C.incenter(equi.A, equi.B, equi.C);
  const equiGe = gergonne(equi.A, equi.B, equi.C, s);
  check("the equilateral triangle has I = Ge, so no Soddy line",
    dist(equiI, equiGe) < 1e-8);
  const iso = { A: { x: 250, y: 60 }, B: { x: 120, y: 380 }, C: { x: 380, y: 380 } };
  const isoS = (dist(iso.A, iso.B) + dist(iso.B, iso.C) + dist(iso.C, iso.A)) / 2;
  check("an isosceles but not equilateral triangle still has I != Ge",
    dist(C.incenter(iso.A, iso.B, iso.C),
      gergonne(iso.A, iso.B, iso.C, isoS)) > 1);
  const flat = C.geometry({
    width: 500, height: 500,
    A: { x: 50, y: 100 }, B: { x: 200, y: 100 }, C: { x: 400, y: 100 },
  });
  check("a flat triangle has no figure", flat.valid === false);
  check("the applet's two-pixel guard is kept for coincident I and Ge",
    Applet.compute(equi.A, equi.B, equi.C).SL === null);
  const start = C.start({});
  const g = C.geometry(start);
  check("the starting triangle draws all four constructions",
    g.valid && g.soddyDefined && g.inversions.length === 7 && g.marks.length >= 2);
  check("the starting angle is a right angle", close(g.angle, 90, 1e-6),
    `${g.angle} degrees`);
}

done("gergonne-and-soddy");
