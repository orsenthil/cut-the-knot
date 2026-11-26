#!/usr/bin/env node
"use strict";

/*
 * Logic test for bender/bender-core.js.
 *
 *   node porting/check-bender.mjs
 *
 * The page's exact claim is about the construction, not a formula: a
 * stationary regular polygon has a spinning regular polygon at every vertex,
 * centred there or nudged two units outward, so the whole picture is carried
 * into itself by a turn of 360/n. The page's other statements ("sides appear
 * misoriented", "the triangle is least susceptible") describe what the eye
 * sees; they are not mathematical assertions and are not tested here.
 *
 * Checked:
 *   1. the defaults against BenderCanvas's constructor and reset;
 *   2. the core's whole-pixel polygons against a second, literal transcription
 *      of reset/CreateNGon/CreateRotNGon/DrawRotated and GeoSDoub.Rotate from
 *      the bytecode, over all 4x4 shape pairs, both modes, every Side value
 *      0..80, all 100 animation steps and 1200 random dragged configurations;
 *   3. regularity, congruence, synchrony, the vertex positions (including
 *      the two-unit displacement) and n-fold symmetry over the full option
 *      cartesian product above, plus Gerbino's hexagon/six-triangles case;
 *   4. option ranges, clamping, wrapping and that no function mutates state.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bender/bender-core.js", "BenderCore");
const TAU = Math.PI * 2;
const shapes = [3, 4, 5, 6];
const sides = Array.from({ length: 81 }, (_, i) => i);

/* ---------------------------------------------------------------- helpers */

const round = Math.round;
const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const nearPoint = (p, q, tol) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const samePoints = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------ the applet, transcribed */

/* GeoSDoub.Rotate(P, Q, angle, 1): x = P.x + c*dx - s*dy, y = P.y + s*dx + c*dy. */
function appletRotate(P, Q, angle) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  const dx = Q.x - P.x, dy = Q.y - P.y;
  return { x: P.x + cs * dx - sn * dy, y: P.y + sn * dx + cs * dy };
}

/**
 * A second transcription of BenderCanvas, straight from the bytecode. Only
 * generalisation: the centre and the starting angle of the fixed polygon are
 * passed in, so a player's dragged positions can be compared too. At the
 * defaults they are exactly what reset()/CreateNGon() compute.
 */
function appletPicture(o) {
  const r = Math.trunc(Math.min(o.width, o.height) / 3); // Java: int / 3, then i2d
  const n = o.fixed, m = o.rot, s = o.side, Ctr = o.center;
  const step = TAU / n, rotStep = TAU / m;
  const Fixed = [];
  for (let i = 0; i < n; i++) { // CreateNGon: angle = phase + step*i
    const a = o.phase + step * i;
    Fixed.push({ x: Ctr.x + r * Math.cos(a), y: Ctr.y + r * Math.sin(a) });
  }
  const RotPoly = []; // CreateRotNGon: angle = rotStep/2 + rotStep*j + step*i
  for (let i = 0; i < n; i++) {
    RotPoly[i] = [];
    for (let j = 0; j < m; j++) {
      const a = rotStep / 2 + rotStep * j + step * i;
      RotPoly[i][j] = { x: Fixed[i].x + s * Math.cos(a), y: Fixed[i].y + s * Math.sin(a) };
    }
  }
  const theta = (TAU * o.frame) / C.FRAMES; // DrawRotated: I*pi*2/N
  const drawn = [], exact = [];
  for (let i = 0; i < n; i++) {
    const poly = [], raw = [];
    for (let j = 0; j < m; j++) {
      const q = appletRotate(Fixed[i], RotPoly[i][j], theta);
      raw.push(q);
      poly.push({ x: round(q.x), y: round(q.y) }); // Polygon.addPoint
    }
    if (o.offCenter) {
      // DrawRotated: d = Dist(Center, Fixed[0]); shift 2*(Center-V)/d.
      const d = Math.hypot(Ctr.x - Fixed[0].x, Ctr.y - Fixed[0].y);
      const dx = (2 * (Ctr.x - Fixed[i].x)) / d;
      const dy = (2 * (Ctr.y - Fixed[i].y)) / d;
      const mx = Math.trunc(round((poly[0].x + poly[1].x) / 2 - Fixed[i].x) + dx);
      const my = Math.trunc(round((poly[0].y + poly[1].y) / 2 - Fixed[i].y) + dy);
      for (let j = 0; j < m; j++) {
        poly[j] = { x: poly[j].x - mx, y: poly[j].y - my }; // Polygon.translate
        raw[j] = { x: raw[j].x - mx, y: raw[j].y - my };
      }
    }
    drawn.push(poly);
    exact.push(raw);
  }
  return {
    radius: r,
    fixed: Fixed,
    drawnFixed: Fixed.map((p) => ({ x: round(p.x), y: round(p.y) })), // DrawFixed
    drawn,
    exact,
  };
}

/* ------------------------------------------- 1. the applet's starting state */

{
  const s = C.start();
  equal("the constructor's defaults", {
    fixed: s.fixed, rot: s.rot, side: s.side, speed: s.speed,
    tint: s.tint, offCenter: s.offCenter, frame: s.frame,
    width: s.width, height: s.height,
  }, { fixed: 4, rot: 4, side: 40, speed: 160, tint: 100, offCenter: false, frame: 0, width: 400, height: 300 });
  equal("reset puts the square's centre at (9w/16, h/2)", s.center, { x: 225, y: 150 });
  check("the fixed radius is min(w,h)/3 with Java integer division", C.radius(s) === 100);
  check("the scrollbar delay is 200 - its value", C.delay(s) === 40);
  const pic = C.picture(s);
  const ref = appletPicture(s);
  check("the starting fixed polygon is CreateNGon(4, 100)", samePoints(pic.drawnFixed, ref.drawnFixed));
  check("the starting small polygons match DrawRotated", samePoints(pic.drawn, ref.drawn));
  check("the starting picture has n-fold symmetry", Object.values(C.claims(s)).every(Boolean),
    JSON.stringify(C.claims(s)));
  check("a picture has no win or loss", C.result(s) === null);
}

/* ---------------------------------- 2. the applet's computation, exhaustively */

{
  let bad = "", total = 0;
  outer:
  for (const fixed of shapes) {
    for (const rot of shapes) {
      for (const offCenter of [false, true]) {
        for (const side of sides) {
          const s = C.start({ fixed, rot, side, offCenter });
          const a = C.picture(s).drawn, b = appletPicture(s).drawn;
          total++;
          if (!samePoints(a, b)) { bad = JSON.stringify({ s, a, b }); break outer; }
        }
      }
    }
  }
  check(`all ${total} shape/mode/Side combinations match the bytecode's pixels`, !bad, bad);

  bad = ""; total = 0;
  outer2:
  for (const fixed of shapes) {
    for (const rot of shapes) {
      for (const offCenter of [false, true]) {
        for (const side of [0, 1, 40, 79, 80]) {
          for (let frame = 0; frame < C.FRAMES; frame++) {
            const s = C.start({ fixed, rot, offCenter, side, frame });
            const p = C.picture(s), ref = appletPicture(s);
            total++;
            if (!samePoints(p.drawn, ref.drawn) || !samePoints(p.drawnFixed, ref.drawnFixed)) {
              bad = JSON.stringify({ s, p, ref }); break outer2;
            }
          }
        }
      }
    }
  }
  check(`all ${total} animation steps match the bytecode's pixels`, !bad, bad);

  bad = ""; total = 0;
  const rand = rng(2532);
  for (let i = 0; i < 1200; i++) {
    const width = 200 + Math.floor(rand() * 401), height = 200 + Math.floor(rand() * 401);
    const fixed = shapes[Math.floor(rand() * 4)], rot = shapes[Math.floor(rand() * 4)];
    const base = C.start({ width, height, fixed, rot });
    const s = C.start({
      width, height, fixed, rot,
      side: Math.floor(rand() * 81),
      speed: Math.floor(rand() * 201),
      tint: Math.floor(rand() * 101),
      offCenter: rand() < 0.5,
      frame: Math.floor(rand() * C.FRAMES),
      center: { x: base.center.x + (rand() - 0.5) * 40, y: base.center.y + (rand() - 0.5) * 40 },
      phase: rand() * TAU,
    });
    const p = C.picture(s), ref = appletPicture(s);
    total++;
    const exactOk = p.polygons.every((poly, k) => poly.every((q, j) => nearPoint(q, ref.exact[k][j], 1e-9)));
    if (!exactOk || !samePoints(p.drawn, ref.drawn) || !samePoints(p.drawnFixed, ref.drawnFixed)) {
      bad = JSON.stringify({ s, p, ref }); break;
    }
  }
  check(`all ${total} random dragged configurations match the bytecode`, !bad, bad);
}

/* -------------------------------- 3. the geometric claim, over the whole grid */

{
  let bad = { regular: "", congruent: "", atVertices: "", synchronous: "", symmetry: "", displaced: "" };
  let total = 0, displaced = 0;
  outer3:
  for (const fixed of shapes) {
    for (const rot of shapes) {
      for (const offCenter of [false, true]) {
        for (const side of sides) {
          for (let frame = 0; frame < C.FRAMES; frame++) {
            const s = C.start({ fixed, rot, side, offCenter, frame });
            const cl = C.claims(s);
            total++;
            for (const key of ["regular", "congruent", "atVertices", "synchronous", "symmetry"]) {
              if (!cl[key] && !bad[key]) bad[key] = JSON.stringify({ s, cl });
            }
            if (offCenter) {
              displaced++;
              const pic = C.picture(s);
              for (let k = 0; k < fixed; k++) {
                const pts = pic.polygons[k];
                const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
                const V = pic.fixed[k];
                const out = { x: V.x - (2 * (pic.center.x - V.x)) / pic.radius,
                  y: V.y - (2 * (pic.center.y - V.y)) / pic.radius };
                if (!nearPoint(mid, out, 4) && !bad.displaced) bad.displaced = JSON.stringify({ s, k, mid, out });
              }
            }
            if (Object.values(bad).some(Boolean)) break outer3;
          }
        }
      }
    }
  }
  check(`the stationary polygon is regular in all ${total} configurations`, !bad.regular, bad.regular);
  check(`the small polygons are congruent in all ${total} configurations`, !bad.congruent, bad.congruent);
  check(`they sit at the vertices (centered) or two units out in all ${total} configurations`,
    !bad.atVertices && !bad.displaced, bad.atVertices || bad.displaced);
  check(`they all turn through the same angle in all ${total} configurations`, !bad.synchronous, bad.synchronous);
  check(`the picture has ${"360/n"}-fold symmetry in all ${total} configurations`, !bad.symmetry, bad.symmetry);

  check("the displaced mode really shifts by about two units", displaced === 129600 && !bad.displaced,
    `${displaced} displaced configurations`);

  // The page names Gerbino's original illusion explicitly.
  const gerbino = C.start({ fixed: 6, rot: 3 });
  const gp = C.picture(gerbino);
  check("the hexagon with six small triangles is available", gp.fixed.length === 6 && gp.polygons.length === 6
    && gp.polygons.every((p) => p.length === 3) && Object.values(C.claims(gerbino)).every(Boolean));
  check("the triangle is available as both a stationary and a rotating shape",
    C.picture(C.start({ fixed: 3 })).fixed.length === 3
      && C.picture(C.start({ rot: 3 })).polygons[0].length === 3);
}

/* ------------------------------------------- 4. options, ranges and no mutation */

{
  const s = C.start();
  check("Side is clamped at 0", C.withOption(s, "side", -9).side === 0);
  check("Side is clamped at 80", C.withOption(s, "side", 999).side === 80);
  check("speed is clamped at 0 and 200", C.withOption(s, "speed", -1).speed === 0
    && C.withOption(s, "speed", 201).speed === 200);
  check("tint is clamped at 0 and 100", C.withOption(s, "tint", -1).tint === 0
    && C.withOption(s, "tint", 101).tint === 100);
  check("an unknown shape is replaced by the nearest radio choice",
    C.withOption(s, "fixed", 7).fixed === 6 && C.withOption(s, "rot", 2).rot === 3);
  check("changing the fixed shape resets its centre and phase as reset() does", (() => {
    const t = C.withOption(s, "fixed", 3);
    return t.center.x === 200 && t.center.y === 150 && near(t.phase, Math.PI / 3, 1e-12);
  })());
  check("advance wraps after 100 frames", C.advance(C.start({ frame: 99 })).frame === 0
    && C.advance(C.start({ frame: 99 }), 3).frame === 2);
  check("withOption, withCenter, withPhase and advance never mutate their input", (() => {
    const before = JSON.stringify(s);
    C.withOption(s, "side", 7); C.withCenter(s, { x: 10, y: 20 });
    C.withPhase(s, 1.2); C.advance(s);
    return JSON.stringify(s) === before;
  })());
  check("dragging the centre stays within one radius of the old one", (() => {
    const q = C.withCenter(s, { x: 9999, y: -9999 });
    return q.center.x === 325 && q.center.y === 50;
  })());
  check("turning wraps negative angles into [0, 2*pi)", (() => {
    const q = C.withPhase(s, -Math.PI / 2);
    return near(q.phase, 3 * Math.PI / 2, 1e-12);
  })());
}

done("bender");
