#!/usr/bin/env node
"use strict";

/*
 * Logic test for carpets-in-square/carpets-in-square-core.js.
 *
 *   node porting/check-carpets-in-square.mjs
 *
 * Checks the page's exact claim - blue DPQR equals the three red pieces AMP,
 * BMQN and CNR - on a 21x21 grid of M and N positions, on hundreds of random
 * positions and board sizes, and at the midpoint case the applet opens with.
 * Then init(), Compute() and the four filled polygons are transcribed a second
 * time from CarpetsInSquareCanvas's bytecode and compared point by point with
 * the core over all those configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("carpets-in-square/carpets-in-square-core.js", "CarpetsInSquareCore");
const samePoint = (p, q, tol = 1e-7) => C.close(p.x, q.x, tol) && C.close(p.y, q.y, tol);
// Intersect returns NaN on a degenerate pair of lines (M=A and N=C), and Draw
// skips the two fills that need Q; both transcriptions must agree on that.
const sameMaybeNaN = (p, q, tol = 1e-7) =>
  (C.finite(p) && C.finite(q) && samePoint(p, q, tol)) ||
  (!C.finite(p) && !C.finite(q));
const ok = (g) => Object.values(C.claims(g)).every(Boolean);
const pt = (x, y) => ({ x, y });

/* ------------------------------------------------------------ 1. the rules */

{
  equal("opening state is 450x400, side 300, M and N at midpoints, names off",
    C.start({}), {
      width: 450, height: 400, side: 300, m: 150, n: 150,
      showNames: false, explored: false,
    });

  const g = C.compute(C.start({}));
  check("A is top-left, B bottom-left, C bottom-right, D top-right",
    samePoint(g.A, pt(75, 50)) && samePoint(g.B, pt(75, 350)) &&
    samePoint(g.C, pt(375, 350)) && samePoint(g.D, pt(375, 50)));
  check("M is the midpoint of AB and N the midpoint of BC",
    samePoint(g.M, pt(75, 200)) && samePoint(g.N, pt(225, 350)) &&
    !g.noDraw);
  check("Compute's three crossings are P=(135,170), Q=(175,250), R=(255,290)",
    samePoint(g.P, pt(135, 170)) && samePoint(g.Q, pt(175, 250)) &&
    samePoint(g.R, pt(255, 290)) && g.finite);
  check("opening blue area is 24000 and the red pieces are 4500 + 15000 + 4500",
    C.close(g.blueArea, 24000, 1e-9) &&
    g.redAreas.every((v, i) => C.close(v, [4500, 15000, 4500][i], 1e-9)) &&
    C.close(g.redTotal, g.blueArea, 1e-9));
  check("the two halves and the common part add up at the opening",
    C.close(g.halfADN, 45000, 1e-9) && C.close(g.halfCarpets, 45000, 1e-9) &&
    C.close(g.overlap, 21000, 1e-9) && ok(g));
  check("a demo has no win or loss, only a finished exploration",
    C.result(C.start({})) === null && C.result(C.move(C.start({}), { type: "option", key: "showNames", value: true })) === "done");

  check("side is floor(min(width,height)*3/4), as init's integer arithmetic",
    C.snapSide(450, 400) === 300 && C.snapSide(400, 450) === 300 &&
    C.snapSide(500, 500) === 375 && C.snapSide(220, 180) === 135);
  check("an out-of-range or malformed move is refused",
    C.move(null, { type: "reset" }) === null &&
    C.move(C.start({}), null) === null &&
    C.move(C.start({}), { type: "fly" }) === null &&
    C.move(C.start({}), { type: "option", key: "showNames", value: "yes" }) === null &&
    C.move(C.start({}), { type: "option", key: "colors", value: true }) === null &&
    C.move(C.start({}), { type: "point", name: "Z", point: pt(100, 100) }) === null &&
    C.move(C.start({}), { type: "point", name: "M", point: pt(NaN, 100) }) === null &&
    C.move(C.start({}), { type: "point", name: "N", point: pt(-1, 100) }) === null);

  const s = C.start({});
  const names = C.move(s, { type: "option", key: "showNames", value: true });
  check("Show names changes only that flag and marks the picture explored",
    names.showNames && !s.showNames && names.explored && names.m === s.m && names.n === s.n);
  const draggedM = C.move(s, { type: "point", name: "M", point: pt(75, 260) });
  const draggedN = C.move(s, { type: "point", name: "N", point: pt(300, 350) });
  check("dragging M changes only its distance down AB; dragging N only its distance along BC",
    C.close(draggedM.m, 210, 1e-9) && draggedM.n === s.n && draggedM.showNames === s.showNames &&
    C.close(draggedN.n, 225, 1e-9) && draggedN.m === s.m && draggedN.explored);
  check("a point moved past its side but still on the board is clamped to the side",
    C.move(s, { type: "point", name: "M", point: pt(75, 399) }).m === 300 &&
    C.move(s, { type: "point", name: "M", point: pt(75, 1) }).m === 0 &&
    C.move(s, { type: "point", name: "N", point: pt(449, 350) }).n === 300 &&
    C.move(s, { type: "point", name: "N", point: pt(1, 350) }).n === 0);
  check("reset puts M and N back at the midpoints and turns names off",
    C.move(draggedM, { type: "reset" }).m === 150 &&
    C.move(names, { type: "reset" }).showNames === false &&
    C.move(draggedN, { type: "reset" }).n === 150);
}

/* ------------------------------- 2. the page's claim over the whole board --- */

{
  let equalAreas = true, halves = true, overlapFits = true, lines = true;
  let positiveInside = true, degenerate = 0, cases = 0;
  for (let i = 0; i <= 20; i++) {
    for (let j = 0; j <= 20; j++) {
      const s = C.start({ m: i * 15, n: j * 15 });
      const g = C.compute(s);
      cases++;
      const k = C.claims(g);
      halves &&= k.halvesEqual;
      // M=A with N=C makes AN and CM the same diagonal: Intersect returns
      // NaN, exactly as in the applet, and Draw leaves those fills out.
      if (i === 0 && j === 20) {
        degenerate++;
        if (g.finite) degenerate = -1;
        continue;
      }
      equalAreas &&= k.redEqualsBlue;
      overlapFits &&= k.overlapFits;
      lines &&= k.pointsOnLines;
      if (i > 0 && i < 20 && j > 0 && j < 20) positiveInside &&= k.positive;
    }
  }
  check(`blue equals the sum of the three red areas on all ${cases - degenerate} M,N positions`, equalAreas);
  check(`Area(ADN) and Area(ADM)+Area(BCM) are both half the square on all ${cases}`, halves);
  check(`the common part put back makes both halves on all ${cases - degenerate}`, overlapFits);
  check("P,Q,R lie on the two lines that define each one on all configurations", lines && degenerate === 1);
  check("all four carpets have positive area at interior positions and at the midpoint",
    positiveInside && ok(C.compute(C.start({}))));

  const rand = rng(20261126);
  let randomClaim = true, randomLines = true;
  for (let k = 0; k < 500; k++) {
    const width = 200 + Math.floor(rand() * 700);
    const height = 200 + Math.floor(rand() * 700);
    const side = C.snapSide(width, height);
    const g = C.compute(C.start({
      width, height, m: rand() * side, n: rand() * side,
    }));
    randomClaim &&= ok(g);
    randomLines &&= C.claims(g).pointsOnLines && !g.noDraw;
  }
  check("the claim holds on 500 random board sizes, M positions and N positions", randomClaim);
  check("M stays on AB and N on BC for all 500 random configurations", randomLines);

  const small = C.compute(C.start({ m: 60, n: 90 }));
  const big = C.compute(C.start({ width: 900, height: 800, m: 120, n: 180 }));
  check("the picture scales: the same fractions give the same share of the square",
    C.close(small.blueArea / small.squareArea, big.blueArea / big.squareArea, 1e-9) &&
    C.close(small.redTotal / small.squareArea, big.redTotal / big.squareArea, 1e-9));
}

/* ------------- 3. a second transcription of the applet's own computation --- */

{
  // GeoSDoub.Intersect(p1,p2,p3,p4), javap -c: a1=p1.y-p2.y, b1=p2.x-p1.x,
  // c1=p1.x*p2.y-p1.y*p2.x; idem for p3,p4; d=a1*b2-a2*b1; NaN if |d|<1;
  // else x=(b1*c2-b2*c1)/d, y=(c1*a2-c2*a1)/d.
  function intersect(p1, p2, p3, p4) {
    const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
    const c1 = p1.x * p2.y - p1.y * p2.x;
    const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
    const c2 = p3.x * p4.y - p3.y * p4.x;
    const d = a1 * b2 - a2 * b1;
    if (Math.abs(d) < 1) return pt(NaN, NaN);
    return pt((b1 * c2 - b2 * c1) / d, (c1 * a2 - c2 * a1) / d);
  }

  // CarpetsInSquareCanvas.init() and Compute(), javap -c. M is Fix(1) (x
  // pinned) on AB, N is Fix(2) (y pinned) on BC; a drag sets m or n.
  function applet(width, height, m, n) {
    const side = Math.floor(Math.min(width, height) * 3 / 4);
    const x0 = (width - side) / 2, y0 = (height - side) / 2;
    const A = pt(x0, y0), B = pt(x0, y0 + side);
    const Cpt = pt(x0 + side, y0 + side), D = pt(x0 + side, y0);
    const M = pt(x0, y0 + m), N = pt(x0 + n, y0 + side);
    const P = intersect(A, N, D, M);
    const Q = intersect(A, N, Cpt, M);
    const R = intersect(Cpt, M, D, N);
    return {
      side, A, B, C: Cpt, D, M, N, P, Q, R,
      blue: [D, R, Q, P],
      reds: [[A, P, M], [M, Q, N, B], [Cpt, R, N]],
      halfs: [[A, D, N], [A, D, M], [B, Cpt, M]],
      overlap: [[A, D, P], [N, Q, R]],
      lines: [[A, N], [D, N], [D, M], [Cpt, M]],
      finiteQ: Number.isFinite(Q.x) && Number.isFinite(Q.y),
      noDraw: !(A.y <= M.y && M.y <= B.y && B.x <= N.x && N.x <= Cpt.x),
    };
  }

  function shoelace(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s / 2);
  }

  const cases = [];
  for (const [w, h] of [[450, 400], [400, 450], [300, 300], [220, 180], [800, 600]]) {
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) cases.push([w, h, i / 10, j / 10]);
    }
  }
  const rand = rng(777);
  for (let k = 0; k < 200; k++) {
    cases.push([
      200 + Math.floor(rand() * 700), 200 + Math.floor(rand() * 700),
      rand(), rand(),
    ]);
  }

  let pointsMatch = true, polygonsMatch = true, linesMatch = true;
  let areasMatch = true, claimMatch = true, flagsMatch = true;
  for (const [w, h, fm, fn] of cases) {
    const side = C.snapSide(w, h);
    const a = applet(w, h, side * fm, side * fn);
    const g = C.compute(C.start({ width: w, height: h, m: side * fm, n: side * fn }));
    for (const key of ["A", "B", "C", "D", "M", "N", "P", "Q", "R"]) {
      pointsMatch &&= sameMaybeNaN(g[key], a[key]);
    }
    const polygons = [["blue", a.blue, g.blue], ...a.reds.map((p, i) => ["red" + i, p, g.reds[i]])];
    for (const [, fromApplet, fromCore] of polygons) {
      polygonsMatch &&= fromApplet.length === fromCore.length &&
        fromApplet.every((p, i) => sameMaybeNaN(p, fromCore[i]));
    }
    linesMatch &&= a.lines.every(([p, q], i) =>
      samePoint(p, g.lines[i][0]) && samePoint(q, g.lines[i][1]));
    flagsMatch &&= g.finite === a.finiteQ && g.noDraw === a.noDraw;
    if (!a.finiteQ) continue; // Draw skips both fills that need Q
    const red = a.reds.map(shoelace).reduce((x, y) => x + y, 0);
    const blue = shoelace(a.blue);
    const halfADN = shoelace(a.halfs[0]);
    const halfCarpets = shoelace(a.halfs[1]) + shoelace(a.halfs[2]);
    const overlap = shoelace(a.overlap[0]) + shoelace(a.overlap[1]);
    areasMatch &&= C.close(g.blueArea, blue, 1e-6) &&
      g.redAreas.every((v, i) => C.close(v, shoelace(a.reds[i]), 1e-6)) &&
      C.close(g.halfADN, halfADN, 1e-6) &&
      C.close(g.halfCarpets, halfCarpets, 1e-6) &&
      C.close(g.overlap, overlap, 1e-6);
    claimMatch &&= C.close(red, blue, 1e-6) &&
      C.close(halfADN, side * side / 2, 1e-6) &&
      C.close(halfCarpets, side * side / 2, 1e-6) &&
      C.close(blue + overlap, halfADN, 1e-6) &&
      C.close(red + overlap, halfCarpets, 1e-6);
  }
  check(`A,B,C,D,M,N,P,Q,R match init and Compute for all ${cases.length} configurations`, pointsMatch);
  check(`the four filled polygons match Draw's fields for all ${cases.length}`, polygonsMatch);
  check("the four drawn lines match AN, DN, DM and CM", linesMatch);
  check(`all areas match a second shoelace transcription for all ${cases.length}`, areasMatch);
  check(`the applet's own coordinates obey the page's claim on all ${cases.length}`, claimMatch);
  check("finite crossings and NoDraw match the applet's guards", flagsMatch);

  const opening = applet(450, 400, 150, 150);
  check("the transcription reproduces the opening pixel truncation and crossings",
    opening.side === 300 && samePoint(opening.P, pt(135, 170)) &&
    samePoint(opening.Q, pt(175, 250)) && samePoint(opening.R, pt(255, 290)));
  const tiny = applet(3, 4, 0, 2);
  check("Draw skips the blue and the middle red fill when Intersect returns NaN",
    !tiny.finiteQ && tiny.side === 2);
}

done("carpets-in-square");
