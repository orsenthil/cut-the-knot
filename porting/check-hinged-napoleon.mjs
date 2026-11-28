#!/usr/bin/env node
"use strict";

/*
 * Logic test for hinged-napoleon/hinged-napoleon-core.js.
 *
 *   node porting/check-hinged-napoleon.mjs
 *
 * 1. The applet's options, input rules and illustration status.
 * 2. A second, literal transcription of HingedNapoleonCanvas.Compute()
 *    (GeoSDoub.Rotate + CTKGeometryPlus.Barycenter and the three swivel
 *    branches) compared with the core on every slider value 0..120, all
 *    three swivel choices and dozens of triangles.
 * 3. The page's claims, checked rather than copied: Napoleon's triangle is
 *    equilateral for inward and outward equilateral triangles; at 120° the
 *    two hinged corners land on the third one; the three hinge angles are
 *    each the matching triangle angle plus 60° and sum to 360° when every
 *    angle is at most 120° (the page's own proviso); the dissection area and
 *    the three reflected Fermat points agree. An obtuse example checks that
 *    the page's caveat is real, while Napoleon's theorem still holds.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hinged-napoleon/hinged-napoleon-core.js", "HingedNapoleonCore");
const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);

const W = C.VIEW.width, H = C.VIEW.height;
const INITIAL = [P(W / 2, H / 4), P(2 * W / 3, H / 2), P(6 * W / 13, 8 * H / 15)];
const OBTUSE = [P(100, 100), P(500, 100), P(200, 110)];
const TRIANGLES = [
  INITIAL,
  [P(90, 240), P(350, 210), P(210, 40)],
  [P(110, 100), P(330, 250), P(250, 55)],
  [P(180, 60), P(480, 300), P(120, 260)],
  [P(160, 340), P(440, 320), P(300, 60)],
  OBTUSE,
];

/* ----------- a second, literal transcription of the applet's own methods */

/* GeoSDoub.Rotate(P, Q, a, dir), from its bytecode. */
function appRotate(p, q, a, dir) {
  const co = Math.cos(a), si = Math.sin(a);
  return P(
    p.x + co * (q.x - p.x) - dir * si * (q.y - p.y),
    p.y + dir * si * (q.x - p.x) + co * (q.y - p.y),
  );
}

/* CTKGeometryPlus.Barycenter(p, q, r): (p + q + r) / 3. */
function appBary(p, q, r) {
  return P((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
}

/* HingedNapoleonCanvas.Compute, branches and argument signs copied exactly. */
function appCompute(V, deg, swivel) {
  const [A, B, Cc0] = V;
  const t = Math.PI / 3, dir = -1, a = deg * Math.PI / 180;
  const Ap = appRotate(B, Cc0, t, dir);
  const Bp = appRotate(Cc0, A, t, dir);
  const Cp = appRotate(A, B, t, dir);
  const Ac = appBary(Ap, B, Cc0);
  const Bc = appBary(A, Bp, Cc0);
  const Cc = appBary(A, B, Cp);
  const Aq = appRotate(Bc, Cc, t, dir);
  const Bq = appRotate(Cc, Ac, t, dir);
  const Cq = appRotate(Ac, Bc, t, dir);
  const polys = [[A, Bc, Cc], [B, Cc, Ac], [Cc0, Ac, Bc]];
  const hinges = [];
  if (swivel === 0) {
    hinges.push(appRotate(Cc, B, -a, dir), appRotate(Cc, Ac, -a, dir),
      appRotate(Bc, Cc0, a, dir), appRotate(Bc, Ac, a, dir));
    polys.push([Cc, hinges[0], hinges[1]], [Bc, hinges[2], hinges[3]]);
  } else if (swivel === 1) {
    hinges.push(appRotate(Cc, Bc, a, dir), appRotate(Cc, A, a, dir),
      appRotate(Ac, Cc0, -a, dir), appRotate(Ac, Bc, -a, dir));
    polys.push([Cc, hinges[0], hinges[1]], [Ac, hinges[2], hinges[3]]);
  } else {
    hinges.push(appRotate(Bc, Cc, -a, dir), appRotate(Bc, A, -a, dir),
      appRotate(Ac, Cc, a, dir), appRotate(Ac, B, a, dir));
    polys.push([Bc, hinges[0], hinges[1]], [Ac, hinges[2], hinges[3]]);
  }
  return { Ap, Bp, Cp, Ac, Bc, Cc, Aq, Bq, Cq, hinges, polys };
}

/* ------------------------------------------------ 1. options and input */

{
  const s = C.start();
  equal("the scrollbar starts at 0 degrees, as Scrollbar(0, 0, 5, 0, 125) does", s.options.angle, 0);
  equal("the panel starts with the B, C checkbox selected", s.options.swivel, 0);
  check("Show names is off at the start", s.options.names === false);
  check("the fresh diagram is not marked explored", s.explored === false);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the starting corners are the applet's 1/2,1/4; 2/3,1/2; 6/13,8/15 fractions",
    closePoint(s.A, INITIAL[0], 1e-9) && closePoint(s.B, INITIAL[1], 1e-9) && closePoint(s.C, INITIAL[2], 1e-9));
  check("the applet's scrollbar can reach 120 degrees but no more",
    C.LIMITS.angle.min === 0 && C.LIMITS.angle.max === 120 &&
    C.normalize("angle", 500) === 120 && C.normalize("angle", -50) === 0);
  check("the three swivel radio choices are normalised to 0, 1 and 2",
    C.normalize("swivel", 99) === 2 && C.normalize("swivel", -1) === 0 &&
    C.SWIVEL_NAMES.join("|") === "B, C|A, C|A, B");

  const moved = C.move(s, "B", P(9999, -9999));
  check("a dragged corner is clamped inside the board",
    moved.B.x === C.VIEW.width - C.PAD && moved.B.y === C.PAD);
  check("dragging marks the diagram explored but never wins it",
    moved.explored && !s.explored && C.result(moved) === null);
  check("unknown or non-finite corners are refused",
    C.move(s, "D", P(5, 5)) === s && C.move(s, "A", P(NaN, 4)) === s);
  check("a high rotation, a different swivel and names are accepted as options",
    (() => {
      const t = C.setOption(C.setOption(C.setOption(s, "angle", 120), "swivel", 2), "names", true);
      return t.options.angle === 120 && t.options.swivel === 2 && t.options.names === true;
    })());
  check("an unknown option is ignored", C.setOption(s, "nope", 1) === s);
  const reset = C.reset(C.setOption(C.move(s, "A", P(10, 10)), "names", true));
  check("Reset restores the starting triangle and turn, keeping the name box",
    closePoint(reset.A, INITIAL[0], 1e-9) && reset.options.angle === 0 &&
    reset.options.swivel === 0 && reset.options.names === true && reset.explored === true);
  check("the status always describes the picture",
    typeof C.describe(s) === "string" && /equilateral/.test(C.describe(s)));
  check("the core does not touch the DOM", typeof globalThis.document === "undefined");
  check("non-finite geometry is refused", C.compute(P(NaN, 1), P(2, 3), P(4, 5), 60, 0) === null);
}

/* ------------------------- 2. all points against the applet's Compute() */

{
  const rand = rng(1201);
  const triangles = TRIANGLES.concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29].map(() =>
    [P(30 + rand() * 580, 30 + rand() * 400),
      P(30 + rand() * 580, 30 + rand() * 400),
      P(30 + rand() * 580, 30 + rand() * 400)]));
  let compared = 0, mismatches = 0;
  for (const V of triangles) {
    const scale = Math.max(dist(V[0], V[1]), dist(V[1], V[2]), dist(V[2], V[0]));
    const tol = 1e-7 * Math.max(1, scale);
    for (let swivel = 0; swivel < 3; swivel++) {
      for (let deg = 0; deg <= 120; deg++) {
        const g = C.compute(V[0], V[1], V[2], deg, swivel, -1);
        const app = appCompute(V, deg, swivel);
        if (!g) { mismatches++; continue; }
        for (const key of ["Ap", "Bp", "Cp", "Ac", "Bc", "Cc", "Aq", "Bq", "Cq"]) {
          if (!closePoint(g[key], app[key], tol)) {
            mismatches++;
            if (mismatches < 4) check(`${key} matches the applet`, false, `${JSON.stringify(g[key])} vs ${JSON.stringify(app[key])}`);
          }
        }
        for (let i = 0; i < 4; i++) {
          if (!closePoint(g.hinges[i], app.hinges[i], tol)) {
            mismatches++;
            if (mismatches < 4) check(`hinge ${i} matches the applet`, false, `swivel=${swivel} deg=${deg}`);
          }
        }
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 3; j++) {
            if (!closePoint(g.polys[i][j], app.polys[i][j], tol)) {
              mismatches++;
              if (mismatches < 4) check(`polygon ${i} point ${j} matches the applet`, false, `swivel=${swivel} deg=${deg}`);
            }
          }
        }
        compared++;
      }
    }
  }
  check(`core matches the applet on ${compared} configurations (every angle, every swivel)`,
    compared > 10000 && mismatches === 0);
  check("at 0 degrees the applet's hinged points are the originals", (() => {
    const app = appCompute(INITIAL, 0, 0);
    return dist(app.hinges[0], INITIAL[1]) < 1e-9 &&
      dist(app.hinges[2], INITIAL[2]) < 1e-9;
  })());
  check("at 120 degrees the applet's own transcription puts B and C onto A", (() => {
    const app = appCompute(INITIAL, 120, 0);
    return closePoint(app.hinges[0], INITIAL[0], 1e-7) &&
      closePoint(app.hinges[2], INITIAL[0], 1e-7) &&
      closePoint(app.hinges[1], app.hinges[3], 1e-7);
  })());
}

/* ------------------------------------------- 3. the page's exact claims */

{
  const rand = rng(5462);
  const acute = TRIANGLES.filter((V) => C.compute(V[0], V[1], V[2], 60, 0).allAnglesAtMost120);
  for (let i = 0; i < 60; i++) {
    const radius = 150 + rand() * 80;
    const V = [0, 1, 2].map((j) => {
      const t = j * 2 * Math.PI / 3 + (rand() - 0.5) * 0.8;
      return P(320 + radius * Math.cos(t), 230 + radius * Math.sin(t));
    });
    if (C.compute(V[0], V[1], V[2], 60, 0).allAnglesAtMost120) acute.push(V);
  }

  let napoleon = 0, badNapoleon = 0;
  for (const V of TRIANGLES.concat(acute)) {
    for (const orientation of [-1, 1]) {
      const g = C.compute(V[0], V[1], V[2], 60, 0, orientation);
      napoleon++;
      if (!g.claims.napoleonEquilateral) badNapoleon++;
    }
  }
  check(`${napoleon} outward and inward triangles make an equilateral centre triangle`,
    napoleon > 100 && badNapoleon === 0);
  const inward = C.compute(...INITIAL, 60, 0, 1);
  check("inward Napoleon triangles are small and are not the page's hinged dissection",
    inward.claims.napoleonEquilateral && !inward.claims.dissection);

  /* The page says "either all inwardly or all outwardly". The applet always
   * turns by -60°, which is outward for the initial winding; for the opposite
   * winding the outward choice is +60°, so pick that before checking angles. */
  const outward = (V) => C.cross(V[0], V[1], V[2]) > 0 ? -1 : 1;
  let angleCases = 0, angleErrors = 0, sumErrors = 0;
  for (const V of acute) {
    const g = C.compute(V[0], V[1], V[2], 120, 0, outward(V));
    angleCases++;
    for (let i = 0; i < 3; i++) {
      if (!close(g.angleGaps[i], 60, 1e-8)) angleErrors++;
    }
    if (!close(g.hingeAngles[0] + g.hingeAngles[1] + g.hingeAngles[2], 360, 1e-8)) sumErrors++;
  }
  check(`${angleCases} triangles obey ∠A'BC'=∠ABC+60°, ∠A'CB'=∠ACB+60°, ∠B'AC'=∠BAC+60°`,
    angleCases > 40 && angleErrors === 0);
  check("the three hinge angles add to exactly 360° whenever no angle exceeds 120°",
    sumErrors === 0);

  let landings = 0, missed = 0, dissections = 0, fermat = 0;
  for (const V of TRIANGLES.concat(acute)) {
    for (let swivel = 0; swivel < 3; swivel++) {
      const g = C.compute(V[0], V[1], V[2], 120, swivel);
      landings++;
      if (!g.claims.hingedCornersLand || !g.claims.starCentresMeet) missed++;
    }
    const g = C.compute(V[0], V[1], V[2], 60, 0, outward(V));
    if (g.allAnglesAtMost120) {
      if (g.claims.dissection) dissections++;
      if (g.claims.fermatPoint && g.claims.reflectionsMeet) fermat++;
    }
  }
  check(`${landings} swivel choices at 120° put both hinged corners on the third corner`,
    landings > 150 && missed === 0);
  check(`${dissections} dissections have exactly the area of Napoleon's triangle`, dissections > 40);
  check(`${fermat} reflected points coincide and see the corners at 120° (the Fermat point)`, fermat > 40);

  /* The page's proof explicitly assumes no angle exceeds 120°. */
  const obtuse = C.compute(...OBTUSE, 120, 0);
  check("the page's caveat is real: an angle over 120° breaks the 360° sum",
    !obtuse.allAnglesAtMost120 && !obtuse.claims.angleSums360 &&
    obtuse.angleGaps.some((v) => !close(v, 60, 1e-8)));
  check("Napoleon's theorem itself still holds for that obtuse triangle",
    obtuse.claims.napoleonEquilateral && obtuse.claims.hingedCornersLand);
  check("the reflected point is no longer the Fermat point when an angle is over 120°",
    !obtuse.claims.fermatPoint && !obtuse.claims.dissection);
  check("the slider never reaches beyond the page's 120°", C.normalize("angle", 125) === 120);

  const at120 = C.start({ angle: 120, names: true });
  check("the status names the two corners that land and the corner they land on",
    /At 120°, B and C land on A/.test(C.describe(at120)));
  const at60 = C.start({ angle: 60, swivel: 1 });
  check("the status names the chosen swivel at intermediate angles",
    /Turned 60° at A, C/.test(C.describe(at60)));
  check("the reflected point of the default triangle is at its Fermat point", (() => {
    const g = C.compute(...INITIAL, 60, 0);
    return g.claims.fermatPoint && close(g.reflectionSpread, 0, g.measures.tol);
  })());
}

done("hinged-napoleon");
