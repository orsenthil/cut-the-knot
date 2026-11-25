"use strict";

/*
 * Unit Distance Points: the rules, with no DOM.
 *
 * Erdos's unit distance problem asks how many pairs among n points of the
 * plane can be exactly 1 apart. For a handful of points the answer is known:
 * 3, 5, 7, 9, 12, 14, 18 for n = 3..9. This module counts the pairs, snaps a
 * dragged point onto the unit circles around the others (a mouse cannot hit
 * "exactly 1" by itself), and builds a witness for every n, an arrangement
 * that reaches the target, so the page can show one and the test can check
 * that each target is reachable.
 */

const UnitDistanceCore = (function () {
  const EPS = 1e-6;
  const MIN_N = 3, MAX_N = 9;
  const TARGETS = { 3: 3, 4: 5, 5: 7, 6: 9, 7: 12, 8: 14, 9: 18 };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /** The pairs [i, j] (i < j) at distance 1, within EPS. */
  function pairs(pts) {
    const out = [];
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        if (Math.abs(dist(pts[i], pts[j]) - 1) < EPS) out.push([i, j]);
    return out;
  }
  const count = (pts) => pairs(pts).length;

  /** Where two unit circles around a and b meet: 0, 1 or 2 points. */
  function circleMeets(a, b) {
    const d = dist(a, b);
    if (d < EPS || d > 2 + EPS) return [];
    const h = Math.sqrt(Math.max(0, 1 - (d * d) / 4));
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    return [{ x: mx - uy * h, y: my + ux * h }, { x: mx + uy * h, y: my - ux * h }];
  }

  /**
   * Move point i towards (x, y), then pull it onto the nearest spot that
   * gives an exact unit distance: first a place where two unit circles cross,
   * else the nearest point on one unit circle. `reach` is how close it must
   * already be. Returns the new {x, y}.
   */
  function snap(pts, i, x, y, reach) {
    const others = pts.filter((_, k) => k !== i);
    let best = null, bestD = reach;
    for (let a = 0; a < others.length; a++)
      for (let b = a + 1; b < others.length; b++)
        for (const c of circleMeets(others[a], others[b])) {
          const d = Math.hypot(c.x - x, c.y - y);
          if (d < bestD) { best = c; bestD = d; }
        }
    if (best) return best;
    for (const o of others) {
      const d = Math.hypot(x - o.x, y - o.y);
      if (d > EPS && Math.abs(d - 1) < reach && Math.abs(d - 1) < bestD) {
        best = { x: o.x + (x - o.x) / d, y: o.y + (y - o.y) / d };
        bestD = Math.abs(d - 1);
      }
    }
    return best || { x, y };
  }

  /** A fixed start with no unit pairs: n points round a circle of radius 1.5. */
  function start(n) {
    const pts = [];
    for (let k = 0; k < n; k++) {
      const t = (2 * Math.PI * k) / n + 0.3;
      pts.push({ x: 1.5 * Math.cos(t), y: 1.5 * Math.sin(t) });
    }
    return pts;
  }

  const tri = (k, dir) => ({ x: dir.x * k, y: dir.y * k });
  const unitAt = (deg) => ({ x: Math.cos((deg * Math.PI) / 180), y: Math.sin((deg * Math.PI) / 180) });

  /**
   * An arrangement with TARGETS[n] unit pairs, centred on the origin.
   * 3: a triangle. 4: a rhombus. 5: three triangles in a strip. 6: a
   * triangle of side 2. 7: a hexagon and its centre. 8: that plus a point
   * touching two hexagon points. 9: every sum of a point of one triangle and
   * a point of a turned copy of it: each of the 9 points has 4 neighbours.
   */
  function witness(n) {
    const u0 = unitAt(0), u60 = unitAt(60);
    let pts;
    if (n === 3) pts = [{ x: 0, y: 0 }, u0, u60];
    else if (n === 4) pts = [{ x: 0, y: 0 }, u0, u60, { x: 1.5, y: Math.sqrt(3) / 2 }];
    else if (n === 5) pts = [{ x: 0, y: 0 }, u0, u60, { x: 1.5, y: Math.sqrt(3) / 2 }, { x: 2, y: 0 }];
    else if (n === 6) pts = [{ x: 0, y: 0 }, u0, { x: 2, y: 0 }, u60, { x: 1.5, y: Math.sqrt(3) / 2 }, { x: 1, y: Math.sqrt(3) }];
    else if (n === 7 || n === 8) {
      pts = [{ x: 0, y: 0 }];
      for (let k = 0; k < 6; k++) pts.push(unitAt(60 * k));
      if (n === 8) pts.push({ x: 1.5, y: Math.sqrt(3) / 2 });
    } else if (n === 9) {
      const A = [{ x: 0, y: 0 }, u0, u60];
      const t = unitAt(20);
      const r = (p) => ({ x: p.x * t.x - p.y * t.y, y: p.x * t.y + p.y * t.x });
      pts = [];
      for (const a of A) for (const b of A) { const q = r(b); pts.push({ x: a.x + q.x, y: a.y + q.y }); }
    } else throw new RangeError("n must be 3 to 9");
    // centre the picture
    const cx = pts.reduce((s, p) => s + p.x, 0) / n, cy = pts.reduce((s, p) => s + p.y, 0) / n;
    return pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  }

  const clampN = (n) => Math.min(MAX_N, Math.max(MIN_N, Math.round(Number(n)) || MIN_N));

  return { EPS, MIN_N, MAX_N, TARGETS, dist, pairs, count, circleMeets, snap, start, witness, clampN };
})();
