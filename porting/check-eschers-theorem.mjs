#!/usr/bin/env node
"use strict";

/*
 * Logic test for eschers-theorem/eschers-theorem-core.js.
 *
 *   node porting/check-eschers-theorem.mjs
 *
 * Two independent readings of EschersTheoremCanvas are compared here: the
 * core, and a second transcription of Rotate / Intersect / UseXToAdjust /
 * Compute / HexagonForRotation.Recreate written straight from the bytecode.
 * They are compared over a grid of drags of each of the three handles plus
 * deterministic random positions. The page's three claims (the 120-degree
 * construction, the Napoleon centres, and the concurrence of AA', BB', CC')
 * are tested on every one of those configurations; the hexagon count and
 * congruence are tested on the same ones.
 */

import { loadCore, check, rng, done } from "./lib/load-core.mjs";

const C = loadCore("eschers-theorem/eschers-theorem-core.js", "EschersTheoremCore");
const DEG = 180 / Math.PI;
const TOL = 1e-4;        // floating-point noise on extreme dragged positions
const TOL_TIGHT = 1e-6;  // two transcriptions of the same arithmetic

/* ---------------------------- second transcription, from the class files ---- */

// GeoSDoub.Rotate(DoubPoint pivot, DoubPoint point, double angle, int dir)
function rotateFromBytecode(pivot, point, angle, dir) {
  const co = Math.cos(angle), si = Math.sin(angle);
  const dx = point.x - pivot.x, dy = point.y - pivot.y;
  return {
    x: pivot.x + co * dx - dir * si * dy,
    y: pivot.y + dir * si * dx + co * dy,
  };
}

// GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint)
function intersectFromBytecode(a, b, c, d) {
  const aa = a.y - b.y, bb = b.x - a.x, cc = a.x * b.y - a.y * b.x;
  const dd = c.y - d.y, ee = d.x - c.x, ff = c.x * d.y - c.y * d.x;
  const den = aa * ee - dd * bb;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (bb * ff - ee * cc) / den, y: (cc * dd - ff * aa) / den };
}

const TWO_THIRDS = 2.0943951023931953;
const ONE_THIRD = 1.0471975511965976;

// UseAToAdjust / UseBToAdjust / UseCToAdjust, in the applet's own order.
function adjustFromBytecode(old, name, p) {
  const sign = -1;
  const q = C.clampToBoard(p);
  let A, B, Cc;
  if (name === "A") {
    B = rotateFromBytecode(old.Cq, q, TWO_THIRDS, -sign);
    Cc = rotateFromBytecode(old.Bq, q, TWO_THIRDS, sign);
    A = q;
  } else if (name === "B") {
    Cc = rotateFromBytecode(old.Aq, q, TWO_THIRDS, -sign);
    A = rotateFromBytecode(old.Cq, q, TWO_THIRDS, sign);
    B = q;
  } else {
    A = rotateFromBytecode(old.Bq, q, TWO_THIRDS, -sign);
    B = rotateFromBytecode(old.Aq, q, TWO_THIRDS, sign);
    Cc = q;
  }
  return { A: A, B: B, C: Cc, Aq: old.Aq, Bq: old.Bq, Cq: old.Cq };
}

// Compute(), without the two-unit early return (tested separately below).
function computeFromBytecode(s) {
  const Ap = rotateFromBytecode(s.B, s.C, ONE_THIRD, 1);
  const Bp = rotateFromBytecode(s.C, s.A, ONE_THIRD, 1);
  const Cp = rotateFromBytecode(s.A, s.B, ONE_THIRD, 1);
  const cross = [
    intersectFromBytecode(s.A, s.Aq, s.B, s.Bq),
    intersectFromBytecode(s.B, s.Bq, s.C, s.Cq),
    intersectFromBytecode(s.C, s.Cq, s.A, s.Aq),
  ];
  const F = {
    x: (cross[0].x + cross[1].x + cross[2].x) / 3,
    y: (cross[0].y + cross[1].y + cross[2].y) / 3,
  };
  return { Ap: Ap, Bp: Bp, Cp: Cp, F: F, crosses: cross };
}

// HexagonForRotation.Recreate / RectreateNext / PutElement.
function recreateFromBytecode(pattern, vertices, list) {
  if (pattern.length === 0) {
    list.push(vertices.map((p) => ({ x: p.x, y: p.y })));
    return;
  }
  const pivot = Number.parseInt(pattern.substring(0, 1), 10);
  const rest = pattern.substring(1);
  for (const dir of [1, -1]) {
    const child = [];
    for (let k = 0; k < 6; k++) {
      child.push(k === pivot
        ? vertices[pivot]
        : rotateFromBytecode(vertices[pivot], vertices[k], TWO_THIRDS, dir));
    }
    list.push(child.map((p) => ({ x: p.x, y: p.y })));
    recreateFromBytecode(rest, child, list);
  }
}

function copiesFromBytecode(s) {
  const list = [];
  const base = [s.A, s.Cq, s.B, s.Aq, s.C, s.Bq];
  for (const code of ["1351", "3513", "5135"]) recreateFromBytecode(code, base, list);
  return list;
}

const maxPointGap = (a, b) => {
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    worst = Math.max(worst, Math.abs(a[i].x - b[i].x), Math.abs(a[i].y - b[i].y));
  }
  return worst;
};

/* ------------------------------------------------------- 1. the opening view */

{
  const s = C.start({});
  check("the fixed triangle is equilateral",
    Math.abs(C.dist(s.Aq, s.Bq) - C.dist(s.Bq, s.Cq)) < TOL &&
    Math.abs(C.dist(s.Bq, s.Cq) - C.dist(s.Cq, s.Aq)) < TOL);
  check("its angles are 60 degrees",
    Math.abs(C.angleAt(s.Aq, s.Bq, s.Cq) * DEG - 60) < TOL);
  check("the five checkboxes start unchecked",
    Object.values(s.options).every((v) => v === false));
  check("B starts on its circle", Math.abs(C.dist(s.B, C.CENTER) - (C.R + 10)) < TOL);
  check("the opening picture is the UseBToAdjust picture",
    maxPointGap([s.A, s.B, s.C],
      [adjustFromBytecode({ Aq: s.Aq, Bq: s.Bq, Cq: s.Cq }, "B", s.B).A, s.B,
        adjustFromBytecode({ Aq: s.Aq, Bq: s.Bq, Cq: s.Cq }, "B", s.B).C]) < TOL);
}

/* --------------------------------- 2. every claim, on a grid of configurations */

const opening = C.start({});
const positions = [];
for (const name of ["A", "B", "C"]) {
  for (let i = 0; i <= 24; i++) {
    for (let j = 0; j <= 16; j++) {
      positions.push({ name: name, p: { x: 16 + i * 25.3, y: 16 + j * 24.25 } });
    }
  }
}
const rand = rng(20261127);
for (let i = 0; i < 300; i++) {
  positions.push({
    name: ["A", "B", "C"][i % 3],
    p: { x: rand() * C.WIDTH, y: rand() * C.HEIGHT },
  });
}

let worstEqual = 0, worstAngle = 0, worstNapoleon = 0, worstConcurrence = 0;
let worstOnCevian = 0, badConfigurations = 0, nonFinite = 0;

for (const item of positions) {
  const s = C.adjust(opening, item.name, item.p);
  if (![s.Ap, s.Bp, s.Cp, s.F, s.crosses[0]].every((p) => Number.isFinite(p.x))) {
    nonFinite++;
    continue;
  }

  let localAngle = 0, localConcurrence = 0, localCevian = 0;
  for (const [fixed, p, q] of [
    [s.Aq, s.B, s.C], [s.Bq, s.C, s.A], [s.Cq, s.A, s.B],
  ]) {
    worstEqual = Math.max(worstEqual, Math.abs(C.dist(fixed, p) - C.dist(fixed, q)));
    localAngle = Math.max(localAngle, Math.abs(C.angleAt(fixed, p, q) * DEG - 120));
  }
  worstAngle = Math.max(worstAngle, localAngle);

  // Napoleon triangles on BC, CA and AB have centres Aq, Bq and Cq.
  const centres = [
    C.barycenter(s.B, s.C, s.Ap),
    C.barycenter(s.C, s.A, s.Bp),
    C.barycenter(s.A, s.B, s.Cp),
  ];
  for (let k = 0; k < 3; k++) {
    worstNapoleon = Math.max(worstNapoleon, C.dist(centres[k], [s.Aq, s.Bq, s.Cq][k]));
  }

  // AA', BB', CC' meet: all three pairwise intersections must be the same F.
  for (const p of s.crosses) {
    localConcurrence = Math.max(localConcurrence, C.dist(p, s.F));
  }
  worstConcurrence = Math.max(worstConcurrence, localConcurrence);
  for (const [vertex, fixed] of [[s.A, s.Aq], [s.B, s.Bq], [s.C, s.Cq]]) {
    const d = C.sub(fixed, vertex);
    const len = Math.hypot(d.x, d.y);
    if (len > 0) {
      localCevian = Math.max(localCevian,
        Math.abs(C.cross(C.sub(s.F, vertex), d)) / len);
    }
  }
  worstOnCevian = Math.max(worstOnCevian, localCevian);
  if (localAngle > TOL || localConcurrence > TOL || localCevian > TOL) badConfigurations++;
}

check("no configuration degenerates in the grid", nonFinite === 0, `${nonFinite} degenerate`);
check("120-degree distances are equal at A', B', C'", worstEqual < TOL, `${worstEqual}`);
check("all three marked angles are 120 degrees", worstAngle < TOL, `${worstAngle} degrees`);
check("Napoleon centres are exactly A', B', C'", worstNapoleon < TOL, `${worstNapoleon}`);
check("the three cevians share one point", worstConcurrence < TOL, `${worstConcurrence}`);
check("that point lies on AA', BB' and CC'", worstOnCevian < TOL, `${worstOnCevian}`);
check("every claimed configuration passed", badConfigurations === 0, `${badConfigurations}`);
check("the exhaustive grid is large", positions.length >= 1200, `${positions.length}`);

/* --------------------------------------- 3. core against the bytecode again */

let worstAdjust = 0, worstCompute = 0, worstCopies = 0, wrongAdjusts = 0;
for (const item of positions) {
  const mine = C.adjust(opening, item.name, item.p);
  const theirs = adjustFromBytecode(opening, item.name, item.p);
  const gap = maxPointGap([mine.A, mine.B, mine.C], [theirs.A, theirs.B, theirs.C]);
  worstAdjust = Math.max(worstAdjust, gap);
  if (gap > TOL) wrongAdjusts++;
  const calc = computeFromBytecode(mine);
  worstCompute = Math.max(worstCompute,
    maxPointGap([mine.Ap, mine.Bp, mine.Cp, mine.F],
      [calc.Ap, calc.Bp, calc.Cp, calc.F]));
}

check("adjust matches the bytecode at every grid point", wrongAdjusts === 0,
  `${wrongAdjusts} differs, worst ${worstAdjust}`);
check("adjust and the bytecode agree to 1e-6", worstAdjust < TOL_TIGHT, `${worstAdjust}`);
check("Compute matches the bytecode to 1e-6", worstCompute < TOL_TIGHT, `${worstCompute}`);

const myCopies = C.copies(opening);
const theirCopies = copiesFromBytecode(opening);
check("138 copies are created", myCopies.length === 138 && theirCopies.length === 138,
  `${myCopies.length} vs ${theirCopies.length}`);
for (const pattern of C.PATTERNS) {
  const out = [];
  const base = [opening.A, opening.Cq, opening.B, opening.Aq, opening.C, opening.Bq];
  (function grow(code, hex) {
    if (!code.length) { out.push(hex); return; }
    const pivot = Number(code[0]);
    for (const sign of [1, -1]) {
      const child = hex.map((p, k) => k === pivot
        ? p : rotateFromBytecode(hex[pivot], p, TWO_THIRDS, sign));
      out.push(child);
      grow(code.slice(1), child);
    }
  })(pattern, base);
  check(`Recreate("${pattern}") makes 46 copies`, out.length === 46, `${out.length}`);
}

for (const item of positions.filter((_, i) => i % 9 === 0)) {
  const s = C.adjust(opening, item.name, item.p);
  worstCopies = Math.max(worstCopies,
    maxPointGap([].concat(...C.copies(s)), [].concat(...copiesFromBytecode(s))));
}
check("every hexagon of every copy matches the bytecode", worstCopies < TOL_TIGHT, `${worstCopies}`);

/* ------------------------------------ 4. congruence, the caveat and the quirk */

let worstSide = 0;
for (const hex of myCopies) {
  for (let k = 0; k < 6; k++) {
    worstSide = Math.max(worstSide,
      Math.abs(C.dist(hex[k], hex[(k + 1) % 6]) -
        C.dist(myCopies[0][k], myCopies[0][(k + 1) % 6])));
  }
}
check("all 138 hexagons are congruent", worstSide < TOL, `${worstSide}`);

// Rigby's caveat: turn C the other way about A' and concurrence breaks.
const flippedC = C.rotate(opening.Aq, opening.B, C.THIRD_TURN, -1);
const wrong = C.derive({ A: opening.A, B: opening.B, C: flippedC,
  Aq: opening.Aq, Bq: opening.Bq, Cq: opening.Cq });
check("opposite orientation still gives the local 120 degrees",
  Math.abs(C.angleAt(opening.Aq, opening.B, flippedC) * DEG - 120) < TOL);
check("opposite orientation destroys the concurrence",
  C.dist(wrong.crosses[0], wrong.crosses[1]) > 1);

// Compute()'s two-unit early return is part of the applet, quirk and all.
const stale = C.adjust(Object.assign({}, opening, { Ap: C.copy(opening.Ap) }), "A", opening.Ap);
check("Compute keeps stale apices when A lands within two pixels of Ap",
  C.dist(stale.Ap, opening.Ap) === 0);

done("eschers-theorem");
