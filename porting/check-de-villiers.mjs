#!/usr/bin/env node
"use strict";

/*
 * Logic test for de-villiers/de-villiers-core.js.
 *
 *   node porting/check-de-villiers.mjs
 *
 * 1. The start position, the two kinds of drag and the three checkboxes.
 * 2. A second, literal transcription of the applet's bytecode
 *    (GeoSDoub.Rotate / ComputeAngle / FindOrientation, AdjustOneApex,
 *    AdjustApexes, AdjustParams and init) compared with the core over the
 *    whole grid of drags and thousands of random ones.
 * 3. The page's exact claim — four similar triangles on an arbitrary
 *    quadrilateral make PQRS a parallelogram — checked independently on
 *    fixed shapes and thousands of random shapes, turns and scales, together
 *    with its angle conditions and its three ratio formulas.  In particular
 *    formulas (1)/(3) print RD/DC where line (2) has RD/RC: the test records
 *    the true value of both products.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("de-villiers/de-villiers-core.js", "DeVilliersCore");

const P = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const add = (p, q) => P(p.x + q.x, p.y + q.y);
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closePoint = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);

/* -------------------------------------- second transcription of the bytecode */

/* GeoSDoub.Rotate(a, b, angle, dir): the 1 makes it counter-clockwise in
 * mathematical coordinates, i.e. clockwise on the screen (y grows down). */
function appletRotate(a, b, angle, dir) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = b.x - a.x, dy = b.y - a.y;
  return P(a.x + cos * dx - dir * sin * dy,
    a.y + dir * sin * dx + cos * dy);
}

/* GeoSDoub.ComputeAngle(a, b, c): the cosine-rule angle at a. */
function appletComputeAngle(a, b, c) {
  const num = (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    + (a.x - c.x) ** 2 + (a.y - c.y) ** 2
    - (b.x - c.x) ** 2 - (b.y - c.y) ** 2;
  const cos = (num / 2) / Math.hypot(a.x - b.x, a.y - b.y)
    / Math.hypot(a.x - c.x, a.y - c.y);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/* GeoSDoub.FindOrientation, exactly as the bytecode assembles it. */
function appletOrientation(a, b, c) {
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + (a.x * b.y - b.x * a.y);
  return v > 0 ? 1 : -1;
}

/* AdjustParams(DoubPoint apex, DoubPoint x, DoubPoint y, int 1). */
function appletAdjustParams(apex, x, y) {
  const coef = Math.hypot(x.x - apex.x, x.y - apex.y)
    / Math.hypot(x.x - y.x, x.y - y.y);
  const alpha = appletComputeAngle(x, y, apex) * appletOrientation(x, y, apex);
  return { alpha: alpha, coef: coef };
}

/* AdjustOneApex(rotated, coef, apex, X, Y): javap slots 4 and 5 are the
 * third and fourth arguments, so the body sets apex = X + coef*(rotated-X);
 * the fifth argument (slot 6) is never read, just as in the applet. */
function appletAdjustOneApex(rotated, coef, apex, x, y) {
  apex.x = x.x + coef * (rotated.x - x.x);
  apex.y = x.y + coef * (rotated.y - x.y);
}

const APPLET_SIDES = {
  P: ["A", "B"], Q: ["C", "B"], R: ["C", "D"], S: ["A", "D"],
};

/* AdjustApexes(DoubPoint changed): `changed` is skipped by identity in Java. */
function appletAdjustApexes(pts, alpha, coef, changed) {
  for (const key of ["P", "Q", "R", "S"]) {
    if (key === changed) continue;
    const [xName, yName] = APPLET_SIDES[key];
    const rotated = appletRotate(pts[xName], pts[yName], alpha, 1);
    appletAdjustOneApex(rotated, coef, pts[key], pts[xName], pts[yName]);
  }
  return pts;
}

/* deVilliersCanvas.init(): four corners on a circle of radius min(W,H)/3. */
function appletInit(W = 460, H = 300) {
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 3;
  const ang = [0.5235987755982988, 2.0943951023931953,
    2.9670597283903604, 5.235987755982989];
  const pts = {
    A: P(cx + r * Math.cos(ang[0]), cy + r * Math.sin(ang[0])),
    B: P(cx + r * Math.cos(ang[1]), cy + r * Math.sin(ang[1])),
    C: P(cx + r * Math.cos(ang[2]), cy + r * Math.sin(ang[2])),
    D: P(cx + r * Math.cos(ang[3]), cy + r * Math.sin(ang[3])),
    P: P(0, 0), Q: P(0, 0), R: P(0, 0), S: P(0, 0),
  };
  appletAdjustApexes(pts, 1.0471975511965976, 1, null);
  return pts;
}

function appletMoveBase(pts, alpha, coef, name, p) {
  const next = {};
  for (const k of Object.keys(pts)) next[k] = P(pts[k].x, pts[k].y);
  next[name] = P(p.x, p.y);
  appletAdjustApexes(next, alpha, coef, null);
  return next;
}

function appletMoveApex(pts, alpha, coef, name, p) {
  const next = {};
  for (const k of Object.keys(pts)) next[k] = P(pts[k].x, pts[k].y);
  next[name] = P(p.x, p.y);
  const [xName, yName] = APPLET_SIDES[name];
  const params = appletAdjustParams(next[name], next[xName], next[yName]);
  appletAdjustApexes(next, params.alpha, params.coef, name);
  return { pts: next, alpha: params.alpha, coef: params.coef };
}

/* An independent check of the page, using complex multiplication, not the core. */
function pageClaim(q, alpha, coef) {
  const [a, b, c, d] = q;
  const kr = coef * Math.cos(alpha), ki = coef * Math.sin(alpha);
  const mul = (p) => P(kr * p.x - ki * p.y, ki * p.x + kr * p.y);
  const apex = (x, y) => add(x, sub(mul(y), mul(x))); // x + k(y-x)
  const Pc = apex(a, b), Qc = apex(c, b), Rc = apex(c, d), Sc = apex(a, d);
  const scale = Math.max(1, ...[a, b, c, d].flatMap((p) =>
    [a, b, c, d].map((r) => dist(p, r))));
  const tol = 1e-8 * scale;
  const eq = (p, r) => dist(p, r) <= tol;
  const vecParallelogram = eq(sub(Qc, Pc), sub(Rc, Sc))
    && eq(sub(Rc, Qc), sub(Sc, Pc));
  const diagParallelogram = eq(add(Pc, Rc), add(Qc, Sc));
  const m = [Pc, Qc, Rc, Sc];
  // Equal apex angles and equal corner angles, by the cosine rule.
  const angle = (v, x, y) => {
    // written out with a dot product, without either the core or applet helper
    const ux = x.x - v.x, uy = x.y - v.y;
    const vx = y.x - v.x, vy = y.y - v.y;
    const nu = ux * vx + uy * vy;
    const den = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    return den > 0 ? Math.acos(Math.max(-1, Math.min(1, nu / den))) : NaN;
  };
  const apexAngles = [angle(Pc, a, b), angle(Qc, c, b),
    angle(Rc, c, d), angle(Sc, a, d)];
  const cornerPairs = [
    [angle(a, b, Pc), angle(a, d, Sc)],
    [angle(b, a, Pc), angle(b, c, Qc)],
    [angle(c, b, Qc), angle(c, d, Rc)],
    [angle(d, c, Rc), angle(d, a, Sc)],
  ];
  // PB/PA = QB/QC = RD/RC = SD/SA, and the two products from the page.
  const ratios = [dist(Pc, b) / dist(Pc, a), dist(Qc, b) / dist(Qc, c),
    dist(Rc, d) / dist(Rc, c), dist(Sc, d) / dist(Sc, a)];
  const invQ = dist(Qc, c) / dist(Qc, b);
  const invS = dist(Sc, a) / dist(Sc, d);
  const withRC = ratios[0] * invQ * ratios[2] * invS;
  const withDC = ratios[0] * invQ * (dist(Rc, d) / dist(d, c)) * invS;
  const finite = ratios.every(Number.isFinite) && apexAngles.every(Number.isFinite);
  return {
    vertices: [Pc, Qc, Rc, Sc], tol, finite,
    parallelogram: finite && vecParallelogram && diagParallelogram,
    apexAnglesEqual: finite && Math.max(...apexAngles) - Math.min(...apexAngles) <= 1e-8,
    cornerAnglesEqual: finite && cornerPairs.every(([u, v]) => Math.abs(u - v) <= 1e-8),
    ratiosEqual: finite && Math.max(...ratios) - Math.min(...ratios) <= 1e-8,
    withRC: withRC, withDC: withDC,
    productIsOne: finite && close(withRC, 1, 1e-8),
    printedEqualsCoef: finite && close(withDC, coef, 1e-8 * Math.max(1, coef)),
  };
}

function stateFrom(q, alpha, coef) {
  const s = C.start({});
  const pts = {
    A: P(q[0].x, q[0].y), B: P(q[1].x, q[1].y),
    C: P(q[2].x, q[2].y), D: P(q[3].x, q[3].y),
    P: P(0, 0), Q: P(0, 0), R: P(0, 0), S: P(0, 0),
  };
  appletAdjustApexes(pts, alpha, coef, null);
  for (const key of ["A", "B", "C", "D", "P", "Q", "R", "S"]) s[key] = pts[key];
  s.alpha = alpha;
  s.coef = coef;
  return s;
}

/* -------------------------------------------------------- 1. start and rules */

{
  const s = C.start({});
  const p = appletInit();
  for (const key of ["A", "B", "C", "D", "P", "Q", "R", "S"]) {
    check(`init puts ${key} at the applet's point`, closePoint(s[key], p[key], 1e-12),
      `applet ${JSON.stringify(p[key])}, core ${JSON.stringify(s[key])}`);
  }
  check("the common angle starts at 60 degrees", close(s.alpha, 1.0471975511965976, 0));
  check("the common scale starts at 1", s.coef === 1);
  check("all three checkboxes start off",
    !s.options.names && !s.options.para && !s.options.angles);
  check("a fresh diagram is not explored", !s.explored);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the start drawing is a parallelogram", C.geometry(s).claims.parallelogram);
  check("the start drawing has equal apex angles", C.geometry(s).claims.apexAnglesEqual);
  check("the start drawing has equal shared corner angles",
    C.geometry(s).claims.sharedAnglesEqual);
  check("the start drawing satisfies the page's ratio line (2)",
    C.geometry(s).claims.ratiosEqual);
  check("the status mentions the parallelogram",
    /parallelogram/.test(C.describe(s)));
}

/* ------------------------------------- 2. drags, options and degenerate input */

{
  const s = C.start({});
  const moved = C.move(s, "D", P(400, 20));
  check("a drag leaves the old state alone", s.D.x !== 400 && moved.D.x === 400);
  check("a drag marks the diagram explored", moved.explored && !s.explored);
  check("an unknown handle is ignored", C.move(s, "Z", P(4, 4)) === s);
  check("a non-finite drag is ignored", C.move(s, "A", P(NaN, 4)) === s);
  check("an Infinity drag is ignored", C.move(s, "P", P(0, Infinity)) === s);
  const far = C.move(s, "A", P(9999, -9999));
  check("a corner is clamped inside the board",
    far.A.x === C.VIEW.width - C.PAD && far.A.y === C.PAD);
  const farApex = C.move(s, "Q", P(-9999, 9999));
  check("an apex is clamped inside the board",
    farApex.Q.x === C.PAD && farApex.Q.y === C.VIEW.height - C.PAD);
  for (const key of ["names", "para", "angles"]) {
    const on = C.setOption(s, key, true);
    check(`${key} toggles on and is remembered`, on.options[key] && !s.options[key]);
    check(`${key} toggles off again`, !C.setOption(on, key, false).options[key]);
    check(`${key} checkbox mentions it in the status`,
      C.describe(on).indexOf(key === "names" ? "Names" : key === "para" ? "parallelogram is outlined" : "equal angles") >= 0);
  }
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(C.setOption(C.move(s, "B", P(20, 20)), "angles", true));
  check("Reset restores the corners and apexes", closePoint(r.A, appletInit().A, 1e-12)
    && closePoint(r.S, appletInit().S, 1e-12));
  check("Reset restores the common angle and scale", r.alpha === C.ALPHA0 && r.coef === 1);
  check("Reset keeps the options and the explored flag", r.options.angles && r.explored);
  check("a non-finite position has no geometry", C.geometry({ A: P(NaN, 1) }) === null);
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

/* --------------- 3. the core against the applet's own drags (second transcription) */

{
  const rand = rng(41317);
  let compared = 0, bad = 0;
  const compare = (label, coreState, appletPts, appletAlpha, appletCoef) => {
    const tol = 1e-9;
    for (const key of ["A", "B", "C", "D", "P", "Q", "R", "S"]) {
      if (!closePoint(coreState[key], appletPts[key], tol)) {
        bad++;
        check(`${label}: core ${key} matches the applet`, false,
          `applet ${JSON.stringify(appletPts[key])}, core ${JSON.stringify(coreState[key])}`);
      }
    }
    if (!close(coreState.alpha, appletAlpha, tol) || !close(coreState.coef, appletCoef, tol)) {
      bad++;
      check(`${label}: core parameters match AdjustParams`, false,
        `applet ${appletAlpha},${appletCoef}, core ${coreState.alpha},${coreState.coef}`);
    }
    compared++;
  };

  const s0 = C.start({});
  const ap0 = appletInit();
  compare("start", s0, ap0, s0.alpha, s0.coef);

  /* Every corner, on a grid and at random positions: AdjustApexes(null). */
  let baseCases = 0;
  for (const x of [20, 100, 220, 340, 450]) {
    for (const y of [15, 90, 160, 240, 295]) {
      for (const name of ["A", "B", "C", "D"]) {
        const p = P(x, y);
        const core = C.move(s0, name, p);
        const apPts = appletMoveBase(ap0, s0.alpha, s0.coef, name,
          C.clamp(p));
        compare(`base ${name} to (${x},${y})`, core, apPts, s0.alpha, s0.coef);
        baseCases++;
      }
    }
  }
  check(`every corner drag on a 5x5 grid (${baseCases} cases) matches the applet`,
    baseCases === 100 && bad === 0);

  /* Every apex, over a grid of positions: AdjustParams + AdjustApexes(apex). */
  let apexCases = 0;
  for (const name of ["P", "Q", "R", "S"]) {
    for (let i = 0; i < 250; i++) {
      const p = P(15 + rand() * 430, 15 + rand() * 270);
      const core = C.move(s0, name, p);
      const ap = appletMoveApex(ap0, s0.alpha, s0.coef, name, C.clamp(p));
      compare(`apex ${name} drag ${i}`, core, ap.pts, ap.alpha, ap.coef);
      apexCases++;
    }
  }
  check(`apex drags recover the same angle and scale (${apexCases} cases)`,
    apexCases === 1000 && bad === 0);

  /* Chains of drags, because AdjustParams uses the current side endpoints. */
  let chain = s0, apChain = ap0, aAlpha = s0.alpha, aCoef = s0.coef;
  for (let i = 0; i < 500; i++) {
    const name = ["A", "B", "C", "D", "P", "Q", "R", "S"][i % 8];
    const p = P(15 + rand() * 430, 15 + rand() * 270);
    if (["A", "B", "C", "D"].indexOf(name) >= 0) {
      chain = C.move(chain, name, p);
      apChain = appletMoveBase(apChain, aAlpha, aCoef, name, C.clamp(p));
    } else {
      chain = C.move(chain, name, p);
      const ap = appletMoveApex(apChain, aAlpha, aCoef, name, C.clamp(p));
      apChain = ap.pts; aAlpha = ap.alpha; aCoef = ap.coef;
    }
    compare(`drag chain ${i}`, chain, apChain, aAlpha, aCoef);
  }
  check(`500 chained drags agree with the applet (${compared} positions in all)`,
    compared > 1600 && bad === 0);
}

/* --------------------------- 4. the page's claim, independent of the core */

{
  const square = [P(70, 40), P(370, 40), P(370, 260), P(70, 260)];
  const rectangle = [P(50, 60), P(410, 60), P(410, 240), P(50, 240)];
  const tilted = [P(60, 210), P(220, 280), P(410, 90), P(160, 30)];
  const bowtie = [P(60, 40), P(410, 250), P(60, 250), P(410, 40)];
  const dart = [P(80, 60), P(410, 130), P(190, 150), P(80, 270)];
  const tiny = [P(100, 100), P(160, 100), P(160, 160), P(100, 160)];
  const fixed = [
    ["square", square], ["rectangle", rectangle], ["tilted", tilted],
    ["crossed bow-tie", bowtie], ["dart", dart], ["small square", tiny],
  ];
  const angles = [0, 0.3, Math.PI / 6, Math.PI / 3, 1.9, 2.8, -0.4, -1.2, -Math.PI];
  const coefs = [0.4, 1, 1.7, 3];
  let cases = 0, failures = 0;
  for (const [name, q] of fixed) {
    for (const alpha of angles) {
      for (const coef of coefs) {
        const claim = pageClaim(q, alpha, coef);
        const g = C.geometry(stateFrom(q, alpha, coef));
        /* With alpha = 0 or pi all four "triangles" collapse to lines, so
         * their angles are not defined; skip those degenerate turns. */
        if (!claim.finite || Math.abs(Math.sin(alpha)) < 0.02) continue;
        cases++;
        if (!claim.parallelogram || !claim.apexAnglesEqual
          || !claim.cornerAnglesEqual || !claim.ratiosEqual || !claim.productIsOne
          || !claim.printedEqualsCoef) {
          failures++;
          check(`${name} alpha=${alpha} coef=${coef}: the page's formulas`, false,
            JSON.stringify(claim));
        }
        check(`${name} alpha=${alpha} coef=${coef}: core and page agree on PQRS`,
          g.claims.parallelogram === claim.parallelogram);
      }
    }
  }
  check(`${cases} fixed shape/angle/scale combinations satisfy the page's claim`,
    cases > 150 && failures === 0);

  const rand = rng(90210);
  let randomCases = 0, claimBad = 0, coreBad = 0, printedBad = 0, printedMismatch = 0;
  for (let trial = 0; trial < 4000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(20 + rand() * 420, 15 + rand() * 270));
    const alpha = -Math.PI + rand() * 2 * Math.PI;
    const coef = 0.25 + rand() * 4;
    const k1 = Math.abs(coef * Math.cos(alpha) - 1);
    const k2 = Math.abs(coef * Math.sin(alpha));
    // Skip collinear triangles (undefined angles) and k = 1 (collapsed apexes).
    if (Math.hypot(k1, k2) < 0.08 || Math.abs(Math.sin(alpha)) < 0.02) continue;
    const claim = pageClaim(q, alpha, coef);
    if (!claim.finite) continue;
    const g = C.geometry(stateFrom(q, alpha, coef));
    randomCases++;
    if (!(claim.parallelogram && claim.apexAnglesEqual && claim.cornerAnglesEqual
      && claim.ratiosEqual && claim.productIsOne && claim.printedEqualsCoef)) {
      claimBad++;
      if (claimBad < 4) check(`random ${trial}: the page's claim`, false, JSON.stringify(claim));
    }
    if (!(g.claims.parallelogram && g.claims.apexAnglesEqual
      && g.claims.sharedAnglesEqual && g.claims.ratiosEqual
      && g.claims.correctedProductIsOne)) {
      coreBad++;
      if (coreBad < 4) check(`random ${trial}: the core agrees`, false, JSON.stringify(g.claims));
    }
    // The formula as printed uses RD/DC, so it equals Coef, not 1 in general.
    if (Math.abs(coef - 1) > 0.2 && claim.printedEqualsCoef) {
      printedBad++;
      if (!close(claim.withDC, 1, 1e-8)) printedMismatch++;
    }
  }
  check(`${randomCases} random configurations satisfy the page's claim`,
    randomCases > 3000 && claimBad === 0);
  check(`the core agrees on all ${randomCases} random configurations`, coreBad === 0);
  check(`the printed RD/DC product is not 1 on ${printedMismatch} of ${printedBad} non-unit cases`,
    printedBad > 100 && printedMismatch === printedBad);

  /* The formula with RD/DC is an identity only at the start's scale of 1. */
  const start = C.geometry(C.start({}));
  check("with the start's scale 1 the printed product happens to be 1",
    start.claims.printedProductIsOne);
  const stretched = pageClaim(square, 0.7, 2.3);
  check("at scale 2.3 the printed product is 2.3, while RD/RC gives 1",
    close(stretched.withDC, 2.3, 1e-8) && close(stretched.withRC, 1, 1e-8));
}

done("de-villiers");
