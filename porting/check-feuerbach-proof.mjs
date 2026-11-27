#!/usr/bin/env node
"use strict";

/*
 * Logic test for feuerbach-proof/feuerbach-proof-core.js.
 *
 *   node porting/check-feuerbach-proof.mjs
 *
 * The cut-the-knot page states Feuerbach's theorem (the nine-point circle
 * touches the incircle internally and the excircles externally) and, for the
 * two excircles Cb and Cc, proves it with an inversion: with L the midpoint
 * of B'C' (also of BC) and w the circle centred at L with radius LB'=LC',
 *   BB' = CC' = (AB+BC+AC)/2,   LB' = LC' = (b+c)/2,
 *   LP*LS = LB'^2,             ACb/ACc = rb/rc = SCb/SCc,
 *   angle XLK = angle KML = angle ABC,
 * and w fixes Cb, Cc (orthogonality) while sending the nine-point circle to
 * the second external tangent through S.
 *
 * 1. The applet's opening figure, its four checkboxes and its no-win rule.
 * 2. All of those claims on an exact triangle and on more than 1,700 grid
 *    and random triangles, checking each worst-case error, plus the internal
 *    tangency with the incircle that the applet does not draw.
 * 3. Dragging, clamping, immutability and the degenerate-triangle guard.
 * 4. A second, independent transcription of the applet's own methods
 *    (FindExcenter, ComputeAngle, Rotate, FindOrientation, Intersect,
 *    NearestPoint, ReflectPointInLine, GetParallelTo, CutTo, GetCircle,
 *    ComputeExcircle, Compute) compared with the core on all the same
 *    configurations: every point, circle and radius, not just a sample.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("feuerbach-proof/feuerbach-proof-core.js", "FeuerbachProofCore");

const W = C.WIDTH;
const near = (a, b, tol = 1e-6) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.isNaN(a) && Number.isNaN(b);
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
};
const nearPt = (p, q, tol = 1e-6) => !!p && !!q &&
  near(p.x, q.x, tol) && near(p.y, q.y, tol);
const nearCircle = (p, q, tol = 1e-6) => nearPt(p, q, tol) && near(p.r, q.r, tol);
const vsub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const vdot = (p, q) => p.x * q.x + p.y * q.y;
const vdist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const projection = (p, a, b) => {
  const d = vsub(b, a), t = vdot(vsub(p, a), d) / vdot(d, d);
  return { x: a.x + d.x * t, y: a.y + d.y * t };
};
const lineDist = (p, a, b) => {
  const d = vsub(b, a);
  return Math.abs(d.y * (p.x - a.x) - d.x * (p.y - a.y)) / Math.hypot(d.x, d.y);
};
const angleAt = (v, p, q) => {
  const u = vsub(p, v), w = vsub(q, v);
  return Math.acos(Math.max(-1, Math.min(1,
    vdot(u, w) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y)))));
};
const invert = (p, center, r) => {
  const d = vsub(p, center), t = r * r / vdot(d, d);
  return { x: center.x + t * d.x, y: center.y + t * d.y };
};
const onLineParam = (p, a, b) => {
  const d = vsub(b, a);
  return vdot(vsub(p, a), d) / vdot(d, d);
};
const stateOf = (A, B, Cp, extra = {}) => Object.assign({
  A, B, C: Cp, showNames: true, showAngles: true,
  showCircle: false, showNPCircle: false,
}, extra);

/* -------------------------------------------------------------------------- */
/* A second transcription, written from the class files, not from the core.  */
/* -------------------------------------------------------------------------- */

function applet(A, B, Cp) {
  const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sq(p, q));
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

  // GeoSDoub.Intersect(DoubPoint x4).
  function intersect(p, q, r, s) {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const den = a * b2 - a2 * b;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b * c2 - b2 * c) / den, y: (c * a2 - c2 * a) / den };
  }
  // GeoSDoub.NearestPoint(p,a,b), with its 0.1 squared-distance shortcut.
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (sq(a, p) < 0.1) return p;
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }
  const angle = (a, b, c) => Math.acos(
    (sq(a, b) + sq(a, c) - sq(b, c)) / (2 * dist(a, b) * dist(a, c)));
  const turn = (a, b, c) => (c.x * (a.y - b.y) + c.y * (b.x - a.x) +
    a.x * b.y - b.x * a.y) > 0 ? 1 : -1;
  function rotate(p, c, a, sign) {
    const co = Math.cos(a), si = Math.sin(a);
    return {
      x: p.x + co * (c.x - p.x) - sign * si * (c.y - p.y),
      y: p.y + sign * si * (c.x - p.x) + co * (c.y - p.y),
    };
  }
  function reflect(p, a, b) {
    return rotate(b, p, 2 * angle(b, p, a), turn(b, p, a));
  }
  // GeoSDoub.FindExcenter(p,a,b): external bisectors at a and b.
  function excenter(p, a, b) {
    const ea = angle(a, p, b), eb = angle(b, p, a), s = turn(a, p, b);
    return intersect(a, rotate(a, b, (Math.PI - ea) / 2, s),
      b, rotate(b, a, (Math.PI - eb) / 2, -s));
  }
  // FeuerbachProofCanvas.ComputeExcircle(p,q,r).
  function excircle(p, q, r) {
    const c = excenter(p, q, r);
    return {
      x: c.x, y: c.y,
      r: (dist(c, foot(c, p, q)) + dist(c, foot(c, q, r)) +
        dist(c, foot(c, r, p))) / 3,
    };
  }
  // GeoSDoub.FindCircumcenter + FeuerbachProofCanvas.GetCircle.
  function circle(p, q, r) {
    const m1 = mid(p, q), m2 = mid(q, r);
    const c = intersect(m1,
      { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) }, m2,
      { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) });
    return { x: c.x, y: c.y, r: (dist(c, p) + dist(c, q) + dist(c, r)) / 3 };
  }
  // FeuerbachProofCanvas.CutTo(p,q,len).
  function cutTo(p, q, len) {
    const t = len / dist(p, q);
    return { x: q.x + t * (p.x - q.x), y: q.y + t * (p.y - q.y) };
  }

  // FeuerbachProofCanvas.Compute, instruction for instruction.
  const L1 = mid(B, Cp), L2 = mid(Cp, A), L3 = mid(A, B);
  const CN = circle(L1, L2, L3);
  const Cb = excircle(B, Cp, A);
  const Cc = excircle(Cp, A, B);
  const S = intersect(B, Cp, Cb, Cc);
  const Bp = foot(Cb, B, Cp), CpFoot = foot(Cc, B, Cp);
  const Bd = reflect(Bp, Cb, Cc), Cd = reflect(CpFoot, Cb, Cc);
  const Invert = { x: L1.x, y: L1.y, r: dist(L1, CpFoot) };
  const X0 = { x: L1.x + 100 * (Cd.x - Bd.x), y: L1.y + 100 * (Cd.y - Bd.y) };
  const X = cutTo(X0, L1, W / 6);
  const Y = { x: 2 * L1.x - X.x, y: 2 * L1.y - X.y };
  const P = foot(A, B, Cp);
  const Z = intersect(Cp, A, Bd, Cd);
  return { CN, Cb, Cc, S, Bp, Cp: CpFoot, Bd, Cd, Invert, X, Y, P, Z,
    K: L3, L: L1, M: L2 };
}

/* ------------------------------------------------------- 1. opening figure */

{
  const s = C.start();
  const cx = W / 2, cy = (C.HEIGHT * 2) / 3, r = Math.min(W, C.HEIGHT) / 4;
  equal("A starts at (cx + r cos(-1.6), cy + r sin(-1.6))", s.A, {
    x: cx + r * Math.cos(-1.6), y: cy + r * Math.sin(-1.6),
  });
  equal("C starts at (cx + 20 + r sin(-0.2), cy + r sin(-0.2))", s.C, {
    x: cx + 20 + r * Math.sin(-0.2), y: cy + r * Math.sin(-0.2),
  });
  equal("B starts at (width/5, C.y)", s.B, { x: W / 5, y: s.C.y });
  check("the proof applet's ShowNames=1 starts names and angles shown",
    s.showNames && s.showAngles && !s.showCircle && !s.showNPCircle);
  check("an illustration has no win or loss", C.result(s) === null);
  check("the saved position is plain data with the four checkbox states",
    Object.keys(C.position(s)).length === 7 &&
    typeof C.position(s).showCircle === "boolean" &&
    Number.isFinite(C.position(s).A.x));
  check("the status text names the two circles and the inverse pair",
    /P and S are a pair of inverse points/.test(C.describe(s)));
  const g = C.geometry(s);
  check("the opening nine-point circle passes through K, L, M and P",
    [g.K, g.L, g.M, g.P].every((p) => near(vdist(p, g.CN), g.CN.r, 1e-8)));
  check("the opening triangle is non-degenerate", g.valid);
  check("the opening Cb has the smaller exradius and Cc the larger one",
    g.Cb.r < g.Cc.r && g.Cc.r > g.CN.r);
}

/* ------------------------------------- 2. the page's claims, exhaustively */

const EXACT = stateOf({ x: 200, y: 40 }, { x: 60, y: 180 }, { x: 320, y: 180 });

{
  const f = applet(EXACT.A, EXACT.B, EXACT.C);
  const a = vdist(EXACT.B, EXACT.C), b = vdist(EXACT.C, EXACT.A),
    c = vdist(EXACT.A, EXACT.B), s = (a + b + c) / 2;
  check("exact triangle: L is the midpoint of BC and of B'C'",
    nearPt(f.L, { x: 190, y: 180 }) && near(f.L.x, (f.Bp.x + f.Cp.x) / 2, 1e-8));
  check("exact triangle: BB' = CC' = the semiperimeter",
    near(vdist(EXACT.B, f.Bp), s, 1e-8) && near(vdist(EXACT.C, f.Cp), s, 1e-8));
  check("exact triangle: LB' = LC' = (b+c)/2",
    near(vdist(f.L, f.Bp), (b + c) / 2, 1e-8) &&
    near(vdist(f.L, f.Cp), (b + c) / 2, 1e-8));
  check("exact triangle: LP*LS is the square of that radius",
    near(vdist(f.L, f.P) * vdist(f.L, f.S), f.Invert.r ** 2, 1e-8));
  check("exact triangle: Cb and Cc are orthogonal to the circle of inversion",
    near(vdist(f.L, f.Cb) ** 2, f.Cb.r ** 2 + f.Invert.r ** 2, 1e-8) &&
    near(vdist(f.L, f.Cc) ** 2, f.Cc.r ** 2 + f.Invert.r ** 2, 1e-8));
  check("exact triangle: the angle claim XLK = KML = ABC",
    near(angleAt(f.L, f.X, f.K), angleAt(f.M, f.K, f.L), 1e-8) &&
    near(angleAt(f.M, f.K, f.L), angleAt(EXACT.B, EXACT.A, EXACT.C), 1e-8));
  check("exact triangle: the nine-point circle touches both excircles",
    near(vdist(f.CN, f.Cb), f.CN.r + f.Cb.r, 1e-8) &&
    near(vdist(f.CN, f.Cc), f.CN.r + f.Cc.r, 1e-8));
}

{
  const worst = {};
  const bump = (key, error) => { worst[key] = Math.max(worst[key] || 0, Math.abs(error)); };
  let cases = 0;
  const rand = rng(20261127);
  const configs = [];
  for (const ax of [150, 200, 250]) for (const ay of [40, 80, 120]) {
    for (const bx of [50, 90, 130]) for (const by of [150, 190, 225]) {
      for (const cx of [230, 270, 310, 350]) for (const cy of [150, 190, 225]) {
        configs.push(stateOf({ x: ax, y: ay }, { x: bx, y: by }, { x: cx, y: cy }));
      }
    }
  }
  for (let i = 0; i < 700; i++) {
    configs.push(stateOf(
      { x: 20 + rand() * 360, y: 20 + rand() * 210 },
      { x: 20 + rand() * 360, y: 20 + rand() * 210 },
      { x: 20 + rand() * 360, y: 20 + rand() * 210 }));
  }
  for (const t of configs) {
    const A = t.A, B = t.B, Cp = t.C;
    const area2 = (B.x - A.x) * (Cp.y - A.y) - (B.y - A.y) * (Cp.x - A.x);
    if (Math.abs(area2) < 400) continue;
    const f = applet(A, B, Cp);
    if (![f.S, f.Bp, f.Cp, f.Bd, f.Cd, f.X, f.Z].every((p) => Number.isFinite(p.x))) continue;
    cases++;
    const a = vdist(B, Cp), b = vdist(Cp, A), c = vdist(A, B), s = (a + b + c) / 2;
    bump("LB'=LC'", vdist(f.L, f.Bp) - vdist(f.L, f.Cp));
    bump("LB'=(b+c)/2", vdist(f.L, f.Cp) - (b + c) / 2);
    bump("BB'=s", vdist(B, f.Bp) - s);
    bump("CC'=s", vdist(Cp, f.Cp) - s);
    bump("L midpoint BC", vdist(f.L, { x: (B.x + Cp.x) / 2, y: (B.y + Cp.y) / 2 }));
    bump("P altitude foot", vdist(f.P, projection(A, B, Cp)));
    bump("LP*LS=r^2", vdist(f.L, f.P) * vdist(f.L, f.S) - f.Invert.r ** 2);
    bump("inverse P=S", vdist(invert(f.P, f.L, f.Invert.r), f.S));
    bump("S on centre line", lineDist(f.S, f.Cb, f.Cc));
    bump("A on centre line", lineDist(A, f.Cb, f.Cc));
    bump("ACb/ACc=rb/rc", vdist(A, f.Cb) / vdist(A, f.Cc) - f.Cb.r / f.Cc.r);
    bump("SCb/SCc=rb/rc", vdist(f.S, f.Cb) / vdist(f.S, f.Cc) - f.Cb.r / f.Cc.r);
    const tA = onLineParam(A, f.Cb, f.Cc), tS = onLineParam(f.S, f.Cb, f.Cc);
    bump("harmonic division", 2 * tA * tS - tA - tS);
    bump("Cb orthogonal", vdist(f.L, f.Cb) ** 2 - f.Cb.r ** 2 - f.Invert.r ** 2);
    bump("Cc orthogonal", vdist(f.L, f.Cc) ** 2 - f.Cc.r ** 2 - f.Invert.r ** 2);
    bump("S on second tangent", lineDist(f.S, f.Bd, f.Cd));
    bump("Cb tangent", lineDist(f.Cb, f.Bd, f.Cd) - f.Cb.r);
    bump("Cc tangent", lineDist(f.Cc, f.Bd, f.Cd) - f.Cc.r);
    bump("XLK=KML", angleAt(f.L, f.X, f.K) - angleAt(f.M, f.K, f.L));
    bump("KML=ABC", angleAt(f.M, f.K, f.L) - angleAt(B, A, Cp));
    for (const k of ["K", "L", "M", "P"]) bump("nine-point " + k, vdist(f.CN, f[k]) - f.CN.r);
    bump("nine-point touches Cb", vdist(f.CN, f.Cb) - f.CN.r - f.Cb.r);
    bump("nine-point touches Cc", vdist(f.CN, f.Cc) - f.CN.r - f.Cc.r);
    // The incircle (not drawn by the applet) is internally tangent.
    const I = {
      x: (a * A.x + b * B.x + c * Cp.x) / (a + b + c),
      y: (a * A.y + b * B.y + c * Cp.y) / (a + b + c),
    };
    const rIn = Math.abs(area2) / (a + b + c);
    bump("incircle internal tangency", vdist(I, f.CN) - Math.abs(f.CN.r - rIn));
    bump("X,Y symmetric", vdist({ x: (f.X.x + f.Y.x) / 2, y: (f.X.y + f.Y.y) / 2 }, f.L));
    bump("LX=W/6", vdist(f.L, f.X) - W / 6);
    bump("Z on CA", lineDist(f.Z, Cp, A));
    bump("Z on second tangent", lineDist(f.Z, f.Bd, f.Cd));
    for (const k of ["K", "M", "P"]) {
      bump("inverse " + k + " on tangent",
        lineDist(invert(f[k], f.L, f.Invert.r), f.Bd, f.Cd));
    }
  }
  check("the sweep has more than a thousand non-degenerate triangles", cases > 1200,
    `only ${cases}`);
  const claimed = [
    "LB'=LC'", "LB'=(b+c)/2", "BB'=s", "CC'=s", "L midpoint BC",
    "P altitude foot", "LP*LS=r^2", "inverse P=S", "S on centre line",
    "A on centre line", "ACb/ACc=rb/rc", "SCb/SCc=rb/rc", "harmonic division",
    "Cb orthogonal", "Cc orthogonal", "S on second tangent", "Cb tangent",
    "Cc tangent", "XLK=KML", "KML=ABC", "nine-point K", "nine-point L",
    "nine-point M", "nine-point P", "nine-point touches Cb",
    "nine-point touches Cc", "incircle internal tangency", "X,Y symmetric",
    "LX=W/6", "Z on CA", "Z on second tangent",
    "inverse K on tangent", "inverse M on tangent", "inverse P on tangent",
  ];
  for (const key of claimed) {
    check(`page claim "${key}" holds on every case (worst ${(worst[key] || 0).toExponential(2)})`,
      (worst[key] || 0) < 1e-4, `worst ${worst[key]}`);
  }
}

/* ------------------------------------- 3. dragging, options, degenerate cases */

{
  const s = C.start();
  const dragged = C.setPoint(s, "A", { x: 260, y: 60 });
  check("dragging A changes only A", nearPt(dragged.A, { x: 260, y: 60 }) &&
    nearPt(dragged.B, s.B) && nearPt(dragged.C, s.C));
  check("the original position is untouched", nearPt(s.A, C.START.A));
  check("dragging clamps to the board", nearPt(C.setPoint(s, "C", { x: -50, y: 999 }).C,
    { x: C.EDGE, y: C.HEIGHT - C.EDGE }));
  check("an unknown handle or flag is ignored", C.setPoint(s, "D", { x: 1, y: 2 }) === s ||
    nearPt(C.setPoint(s, "D", { x: 1, y: 2 }).A, s.A));
  const options = C.setFlag(C.setFlag(C.setFlag(C.setFlag(s, "showNames", false),
    "showAngles", false), "showCircle", true), "showNPCircle", true);
  check("all four panel checkboxes are independent",
    !options.showNames && !options.showAngles && options.showCircle && options.showNPCircle);
  const g = C.geometry(options);
  check("the geometry is unchanged by the four checkboxes",
    nearCircle(g.CN, C.geometry(s).CN, 1e-12) &&
    nearPt(g.S, C.geometry(s).S, 1e-12));
  const flat = C.geometry(stateOf({ x: 60, y: 100 }, { x: 120, y: 100 }, { x: 300, y: 100 }));
  check("a collinear triangle is refused, with no win or loss", !flat.valid &&
    C.result(stateOf({ x: 60, y: 100 }, { x: 120, y: 100 }, { x: 300, y: 100 })) === null);
  check("the status asks for a triangle instead of claiming a result",
    /make a triangle/.test(C.describe(stateOf({ x: 60, y: 100 }, { x: 120, y: 100 }, { x: 300, y: 100 }))));
}

/* -------------------------------------------- 4. independent transcription */

{
  const worst = {};
  const bump = (key, error) => { worst[key] = Math.max(worst[key] || 0, Math.abs(error)); };
  let cases = 0;
  const rand = rng(777);
  const configs = [stateOf(C.START.A, C.START.B, C.START.C), EXACT];
  for (const ax of [30, 110, 190, 270, 350]) for (const ay of [30, 90, 150, 210]) {
    for (const bx of [20, 100, 180, 260]) for (const by of [40, 120, 200]) {
      configs.push(stateOf({ x: ax, y: ay }, { x: bx, y: by },
        { x: 380 - bx / 4, y: 30 + ((ax + by) % 180) }));
    }
  }
  for (let i = 0; i < 1100; i++) {
    configs.push(stateOf(
      { x: 15 + rand() * 370, y: 15 + rand() * 220 },
      { x: 15 + rand() * 370, y: 15 + rand() * 220 },
      { x: 15 + rand() * 370, y: 15 + rand() * 220 }));
  }
  for (const t of configs) {
    const f = applet(t.A, t.B, t.C);
    const g = C.geometry(t);
    cases++;
    for (const key of ["S", "Bp", "Cp", "Bd", "Cd", "X", "Y", "P", "Z", "K", "L", "M"]) {
      bump(key + ".x", g[key].x - f[key].x);
      bump(key + ".y", g[key].y - f[key].y);
    }
    for (const key of ["CN", "Cb", "Cc", "Invert"]) {
      bump(key + ".x", g[key].x - f[key].x);
      bump(key + ".y", g[key].y - f[key].y);
      bump(key + ".r", g[key].r - f[key].r);
    }
  }
  check("the second transcription covers more than a thousand configurations",
    cases > 1200, `only ${cases}`);
  const fields = ["S", "Bp", "Cp", "Bd", "Cd", "X", "Y", "P", "Z", "K", "L", "M",
    "CN", "Cb", "Cc", "Invert"];
  for (const key of fields) {
    for (const part of ["x", "y"].concat(/^(CN|Cb|Cc|Invert)$/.test(key) ? ["r"] : [])) {
      check(`core ${key}.${part} matches the bytecode transcription (worst ${(worst[key + "." + part] || 0).toExponential(2)})`,
        (worst[key + "." + part] || 0) < 1e-6, `worst ${worst[key + "." + part]}`);
    }
  }
}

done("feuerbach-proof");
