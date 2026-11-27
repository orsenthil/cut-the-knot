"use strict";

/*
 * Circles Cover Quadrilateral — Alexander Bogomolny's applet
 * CirclesCoverQuadrilateral (Kvant M10, 1970, problem by G. Galperin).
 *
 * Four circles are centred at the corners A, B, C, D of a quadrilateral. The
 * page claims that if the four circles cover the whole quadrilateral, then
 * some three of them cover one of the triangles ABC, BCD, CDA, DAB. The
 * natural (and tested) reading is that the three circles at a triangle's own
 * corners cover that triangle.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, CirclesCoverQuadrilateralCore, so the page
 * loads it with a plain <script> and porting/check-circles-cover-quadrilateral.mjs
 * loads it in Node. Positions are plain data in the SVG viewBox units.
 *
 * The key idea in the code is a Lipschitz test for covering. f(p) =
 * min over the chosen circles of (distance(p, centre) - radius) is 1-Lipschitz,
 * so sampling a polygon with mesh h decides covering whenever every sampled
 * f is below -h (certainly covered) or some sampled f is above 0 (certainly
 * uncovered). Only borderline samples need a smaller h.
 *
 * The applet's own arithmetic is transcribed literally for the check:
 * init() puts the corners at (W/4, H/4), (W/3, 3H/4), (3W/4, 4H/5) and
 * (4W/5, H/5) with integer division; the radii start at 120, 140, 160, 180
 * and their scrollbars run 0..600 in steps of 5; InCircle() uses a strict
 * d*d < r*r; mouseClicked() toggles *every* circle containing the click.
 */
const CirclesCoverQuadrilateralCore = (() => {
  /* The applet is embedded at 640x460; its canvas sits above a strip of four
   * scrollbars, so the drawing area is about 640x400. */
  const VIEW = { x: 0, y: 0, width: 640, height: 400 };
  const PAD = 18;
  const DEFAULT_RADII = [120, 140, 160, 180];
  const RADIUS = { min: 0, max: 600, step: 5 };
  const NAMES = ["A", "B", "C", "D"];
  /* ABC, BCD, CDA, DAB — the four triangles named on the page. */
  const TRIANGLES = [[0, 1, 2], [1, 2, 3], [2, 3, 0], [3, 0, 1]];
  const TRIPLES = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];

  const point = (x, y) => ({ x: x, y: y });
  const dist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /** Snap a scrollbar value to the applet's 0..600, step 5 grid. */
  function snapRadius(r) {
    if (!Number.isFinite(r)) return 0;
    return Math.max(RADIUS.min, Math.min(RADIUS.max,
      Math.round(r / RADIUS.step) * RADIUS.step));
  }

  /*
   * CirclesCoverQuadrilateralCanvas.init() on a 640x400 canvas, straight from
   * the bytecode (all four divisions are Java integer divisions, i2d after):
   *   P[0] = (W/4,       H/4)
   *   P[1] = (W/3,       H*3/4)
   *   P[2] = (W*3/4,     H*4/5)
   *   P[3] = (W*4/5,     H/5)
   * R = {120, 140, 160, 180}; On = {true, true, true, true}.
   */
  function start(options) {
    const o = options || {};
    const w = o.width === undefined ? VIEW.width : o.width;
    const h = o.height === undefined ? VIEW.height : o.height;
    const corners = [
      point(Math.trunc(w / 4), Math.trunc(h / 4)),
      point(Math.trunc(w / 3), Math.trunc((h * 3) / 4)),
      point(Math.trunc((w * 3) / 4), Math.trunc((h * 4) / 5)),
      point(Math.trunc((w * 4) / 5), Math.trunc(h / 5)),
    ];
    const radii = o.radii
      ? o.radii.map(snapRadius)
      : DEFAULT_RADII.slice();
    return {
      A: corners[0], B: corners[1], C: corners[2], D: corners[3],
      radii: radii,
      on: [true, true, true, true],
      explored: false,
    };
  }

  function reset(state) {
    const s = start();
    s.explored = !!(state && state.explored);
    return s;
  }

  /** A drag of corner `name`, clamped inside the board. */
  function moveVertex(state, name, p) {
    if (!NAMES.includes(name) || !finite(p)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  /** A scrollbar for circle i: 0..600, in steps of 5. */
  function setRadius(state, i, r) {
    if (!Number.isInteger(i) || i < 0 || i > 3) return state;
    const value = snapRadius(r);
    if (value === state.radii[i]) return state;
    const radii = state.radii.slice();
    radii[i] = value;
    return Object.assign({}, state, { radii: radii, explored: true });
  }

  /** The keyboard equivalent of clicking inside a circle: flip one On flag. */
  function toggleCircle(state, i) {
    if (!Number.isInteger(i) || i < 0 || i > 3) return state;
    const on = state.on.slice();
    on[i] = !on[i];
    return Object.assign({}, state, { on: on, explored: true });
  }

  /* UpgradeCenters() copies each corner into its circle's centre before every
   * repaint, so a disk's centre is always the matching corner. */
  function disks(state) {
    return NAMES.map((name, i) => ({
      name: name,
      index: i,
      center: state[name],
      r: state.radii[i],
      on: !!state.on[i],
    }));
  }

  /* DoubCircle / InCircle: dx*dx + dy*dy < r*r, strict (the boundary is not
   * "inside"). dcmpg makes NaN false, which JS's < does too. */
  function inCircle(disk, p) {
    if (!disk || !finite(p)) return false;
    const dx = disk.center.x - p.x;
    const dy = disk.center.y - p.y;
    return dx * dx + dy * dy < disk.r * disk.r;
  }

  /** The circles whose interiors contain p, including hidden ones. */
  function circlesAt(state, p) {
    return disks(state).filter((d) => inCircle(d, p)).map((d) => d.index);
  }

  /* mouseClicked() loops over all four circles and flips the On flag of each
   * one whose interior contains the click — two overlapping circles both
   * flip. It does not care whether a circle was already hidden. */
  function toggleAt(state, p) {
    const hits = circlesAt(state, p);
    if (!hits.length) return state;
    const on = state.on.slice();
    for (const i of hits) on[i] = !on[i];
    return Object.assign({}, state, { on: on, explored: true });
  }

  function pointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y)
        && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  /** Boundary samples plus cell centres: no point of the polygon is more than
   * `spacing` away from one of these samples. */
  function samplePolygon(poly, spacing) {
    const h = Number.isFinite(spacing) && spacing > 0 ? spacing : 6;
    const pts = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const n = Math.max(1, Math.ceil(dist(a, b) / h));
      for (let k = 0; k <= n; k++) {
        pts.push(point(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n));
      }
    }
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    for (let x = minX + h / 2; x < maxX; x += h) {
      for (let y = minY + h / 2; y < maxY; y += h) {
        const p = point(x, y);
        if (pointInPolygon(p, poly)) pts.push(p);
      }
    }
    return pts;
  }

  /** min_i(distance(p, centre_i) - r_i) for every sample and every circle. */
  function gaps(points, ds) {
    const out = [];
    for (const p of points) {
      const row = [];
      for (const d of ds) row.push(dist(p, d.center) - d.r);
      out.push(row);
    }
    return out;
  }

  /** The largest uncovered margin over the samples for one set of circles. */
  function maxGap(rows, indices) {
    let max = -Infinity;
    for (const row of rows) {
      let gap = Infinity;
      for (const i of indices) if (i < row.length) gap = Math.min(gap, row[i]);
      if (gap > max) max = gap;
    }
    return max;
  }

  /* f is 1-Lipschitz: maxGap <= -h proves covering everywhere; maxGap > 0
   * proves a hole. Anything between needs a smaller mesh to be sure. */
  function classify(max, spacing) {
    return {
      maxGap: max,
      covered: max <= 0,
      certainCovered: max <= -spacing,
      certainUncovered: max > 0,
    };
  }

  /**
   * Everything the status line and the tutor need: the disks, coverage of the
   * quadrilateral by all visible circles, and for each of the four triangles
   * both its own three circles and the best three visible circles.
   */
  function geometry(state, spacing) {
    const h = Number.isFinite(spacing) && spacing > 0 ? spacing : 6;
    const ds = disks(state);
    const corners = NAMES.map((name) => state[name]);
    if (!corners.every(finite) || ds.some((d) => !Number.isFinite(d.r))) return null;
    const active = ds.filter((d) => d.on).map((d) => d.index);

    const quadPoly = corners.slice();
    const quadRows = gaps(samplePolygon(quadPoly, h), ds);
    const quad = classify(maxGap(quadRows, active), h);

    const triangles = TRIANGLES.map((ids) => {
      const poly = ids.map((i) => corners[i]);
      const rows = gaps(samplePolygon(poly, h), ds);
      const own = classify(maxGap(rows, ids), h);
      let best = { indices: [], maxGap: Infinity };
      const triples = [];
      for (const triple of TRIPLES) {
        if (!triple.every((i) => active.includes(i))) continue;
        const c = classify(maxGap(rows, triple), h);
        triples.push({ indices: triple.slice(), maxGap: c.maxGap, covered: c.covered });
        if (c.maxGap < best.maxGap) best = { indices: triple.slice(), maxGap: c.maxGap };
      }
      return {
        name: ids.map((i) => NAMES[i]).join(""),
        vertices: ids.slice(),
        own: own,
        triples: triples,
        best: best,
        coveredBySomeTriple: triples.some((t) => t.covered),
      };
    });

    const hypothesis = active.length === 4 && quad.covered;
    const conclusion = triangles.some((t) => t.own.covered);
    return {
      disks: ds,
      active: active,
      quad: quad,
      triangles: triangles,
      hypothesis: hypothesis,
      conclusion: conclusion,
      conclusionLiteral: triangles.some((t) => t.coveredBySomeTriple),
      theorem: !hypothesis || conclusion,
      spacing: h,
    };
  }

  /* A small convenience not in the applet: pick radii in the direction of
   * the current ones that make all four circles cover the quadrilateral,
   * rounded to the scrollbar's step. Each check uses a coarse mesh; the final
   * answer is refined until it covers with a margin. */
  function fitRadii(state) {
    const corners = NAMES.map((name) => state[name]);
    if (!corners.every(finite)) return state.radii.slice();
    let direction = state.radii.map((r) => (r > 0 ? r : 0));
    if (!direction.some((r) => r > 0)) direction = DEFAULT_RADII.slice();
    const samples = samplePolygon(corners.slice(), 10);
    const base = samples.map((p) => corners.map((c) => dist(p, c)));
    const maxGapAt = (scale) => {
      let max = -Infinity;
      for (const row of base) {
        let gap = Infinity;
        for (let i = 0; i < 4; i++) gap = Math.min(gap, row[i] - direction[i] * scale);
        if (gap > max) max = gap;
      }
      return max;
    };
    let lo = 0, hi = 4000;
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2;
      if (maxGapAt(mid) <= 0) hi = mid; else lo = mid;
    }
    for (let slack = 1.1; slack <= 2.0001; slack *= 1.25) {
      const radii = direction.map((r) => snapRadius(hi * r * slack));
      const withRadii = Object.assign({}, state, { radii: radii, on: [true, true, true, true] });
      const g = geometry(withRadii, 4);
      if (g && g.quad.covered) return radii;
    }
    return state.radii.slice();
  }

  /* An illustration has no win and no loss; exploring it marks it done. */
  function result(state) {
    return null;
  }

  function describe(state, g) {
    if (!state || !Array.isArray(state.radii) || !NAMES.every((name) => finite(state[name]))) {
      return "Drag a corner to make a quadrilateral.";
    }
    const geo = g || geometry(state);
    if (!geo) return "Drag a corner to make a quadrilateral.";
    const hidden = NAMES.filter((name, i) => !state.on[i]);
    if (hidden.length) {
      const list = hidden.length > 2
        ? `${hidden.slice(0, -1).join(", ")} and ${hidden[hidden.length - 1]}`
        : hidden.join(" and ");
      return `Circle${hidden.length > 1 ? "s" : ""} ${list} hidden. `
        + "Click inside a circle or press its button to show it again.";
    }
    if (geo.hypothesis) {
      const shown = geo.triangles.filter((t) => t.own.covered).map((t) => t.name);
      if (!shown.length) {
        return "The four circles cover the quadrilateral. Move the sliders a little to see "
          + "which three circles cover a triangle.";
      }
      const first = shown[0].split("");
      return `The four circles cover the whole quadrilateral. Circles ${first[0]}, ${first[1]} `
        + `and ${first[2]} cover triangle ${shown[0]}.`
        + (shown.length > 1 ? ` Triangle${shown.length > 1 ? "s" : ""} ${shown.slice(1).join(", ")} work too.` : "");
    }
    return `The circles do not cover the whole quadrilateral yet: the largest gap is `
      + `${Math.max(0, geo.quad.maxGap).toFixed(0)} drawing units. Drag a corner, change a radius, `
      + "or press Make them cover.";
  }

  return {
    VIEW: VIEW, PAD: PAD, DEFAULT_RADII: DEFAULT_RADII, RADIUS: RADIUS,
    NAMES: NAMES, TRIANGLES: TRIANGLES, TRIPLES: TRIPLES,
    point: point, dist: dist, finite: finite, clamp: clamp, snapRadius: snapRadius,
    start: start, reset: reset, moveVertex: moveVertex, setRadius: setRadius,
    toggleCircle: toggleCircle, toggleAt: toggleAt, circlesAt: circlesAt,
    disks: disks, inCircle: inCircle,
    pointInPolygon: pointInPolygon, samplePolygon: samplePolygon, gaps: gaps,
    maxGap: maxGap, classify: classify, geometry: geometry, fitRadii: fitRadii,
    result: result, describe: describe,
  };
})();
