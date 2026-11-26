#!/usr/bin/env node
"use strict";

/*
 * Logic test for area-of-triangle/area-of-triangle-core.js.
 *
 *   node porting/check-area-of-triangle.mjs
 *
 * Checks the opening position, every move kind, and the page's three claims:
 * Area(ABQP) = Area(AHCP) + Area(HBQC) with signed rectangles, the triangle
 * is half of ABQP, and the half-turn copy makes a parallelogram of twice the
 * area. These are tried on a grid that puts H inside AB, beyond A and beyond
 * B, on random triangles, on rotated/scaled ones and on degenerate ones.
 * Finally the applet's own Compute() is transcribed a second time from
 * GeoSDoub.NearestPoint / GetParallelTo bytecode and compared point by point.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("area-of-triangle/area-of-triangle-core.js", "AreaOfTriangleCore");
const close = C.close;
const samePoint = (p, q) => close(p.x, q.x, 1e-12) && close(p.y, q.y, 1e-12);
const ok = (g) => Object.values(C.claims(g)).every(Boolean);

function at(A, B, Cpt) {
  return { A, B, C: Cpt, width: 400, height: 300 };
}

/* ------------------------------------------------------------ 1. the rules */

{
  equal("opening triangle matches the applet at 400x300", C.start({}), {
    A: { x: 100, y: 250 },
    B: { x: 300, y: 250 },
    C: { x: 250, y: 50 },
    width: 400,
    height: 300,
    showTriangle: false,
    showNames: false,
    showColors: false,
  });
  equal("opening triangle scales with the board", C.start({ width: 220, height: 150 }), {
    A: { x: 55, y: 125 },
    B: { x: 165, y: 125 },
    C: { x: 137.5, y: 25 },
    width: 220,
    height: 150,
    showTriangle: false,
    showNames: false,
    showColors: false,
  });

  const s = C.start({});
  check("all three applet switches start off", !s.showTriangle && !s.showNames && !s.showColors);

  const moved = C.move(s, { type: "point", name: "C", point: { x: 20, y: 40 } });
  check("a drag moves only the named corner",
    samePoint(moved.C, { x: 20, y: 40 }) &&
    samePoint(moved.A, s.A) && samePoint(moved.B, s.B));
  check("the original position is not changed by a move", samePoint(s.C, { x: 250, y: 50 }));
  check("a point outside the board is refused",
    C.move(s, { type: "point", name: "A", point: { x: -1, y: 20 } }) === null &&
    C.move(s, { type: "point", name: "A", point: { x: 20, y: 301 } }) === null);
  check("a non-finite or unknown point is refused",
    C.move(s, { type: "point", name: "A", point: { x: NaN, y: 20 } }) === null &&
    C.move(s, { type: "point", name: "D", point: { x: 20, y: 20 } }) === null);
  const shown = C.move(s, { type: "option", key: "showColors", value: true });
  check("a switch changes only its own flag",
    shown.showColors && !shown.showTriangle && !shown.showNames && !s.showColors);
  check("an unknown switch or value is refused",
    C.move(s, { type: "option", key: "showParallelogram", value: true }) === null &&
    C.move(s, { type: "option", key: "showColors", value: "yes" }) === null);
  check("reset restores the opening triangle and the board size",
    samePoint(C.move(shown, { type: "reset" }).C, s.C) &&
    C.move(shown, { type: "reset" }).width === 400 &&
    !C.move(shown, { type: "reset" }).showColors);
}

/* ------------------------------------------- 2. the named cases, by hand */

{
  const A = { x: 100, y: 200 }, B = { x: 300, y: 200 };
  const opening = C.compute(at(A, B, { x: 180, y: 80 }));
  check("foot inside: both rectangles have the same sign as ABQP and add to it",
    opening.insideBase &&
    Math.sign(opening.rect.AHCP) === Math.sign(opening.rect.ABQP) &&
    Math.sign(opening.rect.HBQC) === Math.sign(opening.rect.ABQP) &&
    close(opening.rect.ABQP, opening.rect.AHCP + opening.rect.HBQC) &&
    close(opening.triangleArea, opening.rectangleArea / 2));

  const left = C.compute(at(A, B, { x: 20, y: 80 }));
  check("H beyond A: AHCP changes sign and the sum still holds",
    !left.insideBase && left.t < 0 &&
    Math.sign(left.rect.AHCP) === -Math.sign(left.rect.ABQP) &&
    Math.sign(left.rect.HBQC) === Math.sign(left.rect.ABQP) &&
    close(left.rect.ABQP, left.rect.AHCP + left.rect.HBQC) &&
    close(left.triangleArea, left.rectangleArea / 2));

  const right = C.compute(at(A, B, { x: 380, y: 80 }));
  check("H beyond B: HBQC changes sign and the sum still holds",
    !right.insideBase && right.t > 1 &&
    Math.sign(right.rect.AHCP) === Math.sign(right.rect.ABQP) &&
    Math.sign(right.rect.HBQC) === -Math.sign(right.rect.ABQP) &&
    close(right.rect.ABQP, right.rect.AHCP + right.rect.HBQC) &&
    close(right.triangleArea, right.rectangleArea / 2));

  const atA = C.compute(at(A, B, { x: 100, y: 80 }));
  check("H at A: AHCP has zero area", close(atA.t, 0) && close(atA.rect.AHCP, 0) &&
    close(atA.rect.HBQC, atA.rect.ABQP) && ok(atA));
  const atB = C.compute(at(A, B, { x: 300, y: 80 }));
  check("H at B: HBQC has zero area", close(atB.t, 1) && close(atB.rect.HBQC, 0) &&
    close(atB.rect.AHCP, atB.rect.ABQP) && ok(atB));
  check("the area above and below the base have opposite signs",
    close(opening.rect.ABQP, -C.compute(at(A, B, { x: 180, y: 320 })).rect.ABQP));
}

/* ----------------------------- 3. the page's claims, over a whole grid */

{
  const A = { x: 40, y: 120 }, B = { x: 160, y: 120 };
  const triangles = [];
  for (let x = -120; x <= 320; x += 20) {
    for (let y = -100; y <= 340; y += 20) {
      triangles.push(at(A, B, { x, y }));
    }
  }

  let allAdd = true, allHalf = true, allBase = true, allShoelace = true, allFeet = true;
  let allDoubling = true, inside = 0, beyondA = 0, beyondB = 0, collinear = 0;
  for (const s of triangles) {
    const g = C.compute(s);
    const k = C.claims(g);
    allAdd &&= k.rectanglesAdd;
    allHalf &&= k.triangleIsHalf;
    allBase &&= k.baseTimesHeight;
    allShoelace &&= k.shoelaceMatches;
    allFeet &&= k.feetArePerpendicular;
    if (g.insideBase) inside++;
    else if (g.t < 0) beyondA++;
    else beyondB++;
    if (g.degenerate) collinear++;
    for (const side of ["AB", "BC", "CA"]) {
      const d = C.doubling(s.A, s.B, s.C, side);
      allDoubling &&= close(d.area, 2 * g.triangleArea) &&
        close(d.area, d.base * d.altitude) &&
        close(d.base, Math.sqrt(C.sqDist(d.U, d.V)));
    }
  }
  check(`signed rectangles add on all ${triangles.length} grid triangles`, allAdd);
  check(`the triangle is half of ABQP on all ${triangles.length} grid triangles`, allHalf);
  check(`ABQP is base times altitude on all ${triangles.length} grid triangles`, allBase);
  check(`the shoelace rectangles agree with the signed lengths on all ${triangles.length} triangles`, allShoelace);
  check(`CH, AP and BQ are perpendicular to AB on all ${triangles.length} triangles`, allFeet);
  check(`the half-turn parallelogram is twice the triangle for all three sides of all ${triangles.length} triangles`, allDoubling);
  check("the grid really covers H inside, beyond A and beyond B",
    inside > 100 && beyondA > 100 && beyondB > 100 && collinear > 0);

  // Euclid I.37: every apex on the line through C parallel to AB has the same area.
  const s = at(A, B, { x: 70, y: 40 });
  const g = C.compute(s);
  let sameArea = true;
  for (let k = -10; k <= 10; k++) {
    const apex = { x: s.C.x + k * (B.x - A.x), y: s.C.y + k * (B.y - A.y) };
    sameArea &&= close(C.compute(at(A, B, apex)).triangleArea, g.triangleArea);
  }
  check("Euclid I.37: apexes on the parallel through C keep the same area", sameArea);
}

/* ------------------------------------- 4. random, rotated and degenerate */

{
  const rand = rng(20261126);
  let randomOK = true, rotatedOK = true;
  for (let i = 0; i < 500; i++) {
    const A = { x: rand() * 400, y: rand() * 300 };
    const B = { x: rand() * 400, y: rand() * 300 };
    const Cpt = { x: rand() * 400, y: rand() * 300 };
    const s = at(A, B, Cpt);
    randomOK &&= ok(C.compute(s));
    for (const side of ["AB", "BC", "CA"]) {
      const d = C.doubling(A, B, Cpt, side);
      randomOK &&= close(d.area, C.compute(s).triangleArea * 2);
    }
    // Rotate by 30 degrees, translate and scale: all areas grow by 1.7^2.
    const turn = (p) => ({
      x: 20 + 1.7 * (p.x * Math.cos(Math.PI / 6) - p.y * Math.sin(Math.PI / 6)),
      y: -30 + 1.7 * (p.x * Math.sin(Math.PI / 6) + p.y * Math.cos(Math.PI / 6)),
    });
    const moved = at(turn(A), turn(B), turn(Cpt));
    const g = C.compute(moved);
    rotatedOK &&= ok(g) && close(g.triangleArea, C.compute(s).triangleArea * 1.7 * 1.7);
  }
  check("all three claims hold on 500 random triangles and their three doublings", randomOK);
  check("rotation, translation and scaling keep the relations and scale the area", rotatedOK);

  const flat = C.compute(at({ x: 50, y: 100 }, { x: 250, y: 100 }, { x: 400, y: 100 }));
  check("a flat triangle has zero area and finite rectangles",
    flat.degenerate && close(flat.triangleArea, 0) && close(flat.rect.ABQP, 0) &&
    Number.isFinite(flat.rect.AHCP) && Number.isFinite(flat.rect.HBQC) && ok(flat));

  const same = at({ x: 200, y: 150 }, { x: 200, y: 150 }, { x: 80, y: 40 });
  const sameG = C.compute(same);
  check("A = B: the applet's 0.1 guard keeps every point finite",
    samePoint(sameG.H, same.C) && Number.isFinite(sameG.t) &&
    close(sameG.triangleArea, 0) && ok(sameG));
}

/* ----------------------------- 5. a second transcription of the applet */

{
  // GeoSDoub.NearestPoint(DoubPoint p, DoubPoint a, DoubPoint b), javap -c:
  // dx = b.x-a.x, dy = b.y-a.y; if SqDist(a,b) < 0.1 return p;
  // t = (dx*(p.x-a.x) + dy*(p.y-a.y)) / (dx*dx+dy*dy); return a + t*(dx,dy).
  function nearest(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if ((dx * dx + dy * dy) < 0.1) return { x: p.x, y: p.y };
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }
  // GeoSDoub.GetParallelTo(C, A, B) = C + 100*(A-B): a point on the parallel.
  function parallelTo(p, a, b) {
    return { x: p.x + 100 * (a.x - b.x), y: p.y + 100 * (a.y - b.y) };
  }
  // AreaOfTriangleCanvas.Compute(), javap -c:
  // H = NearestPoint(C,A,B); L = GetParallelTo(C,A,B);
  // Ha = NearestPoint(A,C,L); Hb = NearestPoint(B,C,L);
  // Nice is rounded ((A+B+C)/3) and holds the "1" subscript label.
  function appletCompute(A, B, Cpt) {
    const H = nearest(Cpt, A, B);
    const L = parallelTo(Cpt, A, B);
    const Ha = nearest(A, Cpt, L);
    const Hb = nearest(B, Cpt, L);
    const Nice = {
      x: Math.round((A.x + B.x + Cpt.x) / 3),
      y: Math.round((A.y + B.y + Cpt.y) / 3),
    };
    return { H, Ha, Hb, Nice };
  }

  const rand = rng(712);
  const cases = [];
  for (let x = -90; x <= 330; x += 15) {
    for (let y = -80; y <= 320; y += 20) {
      cases.push(at({ x: 40, y: 120 }, { x: 160, y: 120 }, { x, y }));
    }
  }
  for (let i = 0; i < 400; i++) {
    cases.push(at(
      { x: rand() * 400, y: rand() * 300 },
      { x: rand() * 400, y: rand() * 300 },
      { x: rand() * 400, y: rand() * 300 },
    ));
  }
  cases.push(at({ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 60, y: 50 }));

  let feetMatch = true, cornersMatch = true, labelMatch = true;
  for (const s of cases) {
    const g = C.compute(s);
    const a = appletCompute(s.A, s.B, s.C);
    feetMatch &&= samePoint(g.H, a.H);
    cornersMatch &&= samePoint(g.P, a.Ha) && samePoint(g.Q, a.Hb);
    labelMatch &&= C.centroid(s.A, s.B, s.C).x === a.Nice.x &&
      C.centroid(s.A, s.B, s.C).y === a.Nice.y;
  }
  check(`H matches the applet's NearestPoint on all ${cases.length} triangles`, feetMatch);
  check(`P and Q match the applet's Ha and Hb on all ${cases.length} triangles`, cornersMatch);
  check(`the label point matches the applet's rounded centroid on all ${cases.length} triangles`, labelMatch);

  const degenerate = appletCompute({ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 50, y: 60 });
  check("the applet's own 0.1 guard returns C, A and B when A = B",
    samePoint(degenerate.H, { x: 50, y: 60 }) &&
    samePoint(degenerate.Ha, { x: 10, y: 10 }) &&
    samePoint(degenerate.Hb, { x: 10, y: 10 }));
}

done("area-of-triangle");
