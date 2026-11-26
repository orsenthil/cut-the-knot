"use strict";

/*
 * Angle Property, from Alexander Bogomolny's applet AngleProperty.
 *
 * The picture has a circle of inversion (centre O, through S) and a second
 * circle (centre P, through R). A line through O and T cuts both circles.
 * The red circle is the inverse of the green one: if a point X on the green
 * circle satisfies OX * OX' = R^2, then X' lies on the red circle. Inversion
 * keeps the size of angles, so the tangents where the line cuts the two
 * circles make the same angles with that line.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, AnglePropertyCore, so the page loads it with
 * a plain <script> and porting/check-angle-property.mjs loads it in Node. The
 * position is plain data, so the player's record can save it as it is.
 *
 * The formulae follow the applet's own classes: InvLine.InvertCinC and
 * Inversion.Invert (CTKGeometry.zip), and GeoSDoub.IntersectX/Y. In particular
 * the applet switches from a circle to a line when |OP^2 - r^2| <= 100; that
 * threshold is kept here even though it is a drawing tolerance, not geometry.
 */

const AnglePropertyCore = (() => {
  /* The applet's WIDTH and HEIGHT parameters default to 400 and 300. */
  const VIEW = { width: 400, height: 300 };
  const EPS = 100; // InvLine's |power| cut-off, in square drawing units
  const PAD = 6; // keep a dragged dot inside the drawing
  const HANDLE_NAMES = ["O", "S", "P", "R", "T"];

  // AnglePropertyCanvas.init(), with WIDTH = 400 and HEIGHT = 300.
  const START = Object.freeze({
    O: { x: 50, y: 150 },    // width / 8, height / 2
    S: { x: 160, y: 150 },   // width * 4 / 10, height / 2
    P: { x: 120, y: 150 },   // width * 3 / 10, height / 2
    R: { x: 140, y: 150 },   // width * 7 / 20, height / 2
    T: { x: 380, y: 90 },    // width - 20, height / 2 - 60
    options: Object.freeze({ names: false, hint: false }),
    touches: 0,
  });

  const copyPoint = (p) => ({ x: p.x, y: p.y });
  const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const dist = (a, b) => Math.sqrt(sqDist(a, b));
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /** The starting picture, with either of the applet's two checkboxes set. */
  function start(options) {
    const o = options || {};
    const next = {};
    for (const name of HANDLE_NAMES) next[name] = copyPoint(START[name]);
    next.options = {
      names: Boolean(o.names === undefined ? START.options.names : o.names),
      hint: Boolean(o.hint === undefined ? START.options.hint : o.hint),
    };
    next.touches = 0;
    return next;
  }

  /** Move one of the five draggable points; out-of-board drags stop at the edge. */
  function moveVertex(state, name, p) {
    if (!HANDLE_NAMES.includes(name) || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    const next = {};
    for (const n of HANDLE_NAMES) next[n] = copyPoint(state[n]);
    next[name] = {
      x: clamp(p.x, PAD, VIEW.width - PAD),
      y: clamp(p.y, PAD, VIEW.height - PAD),
    };
    next.options = { names: state.options.names, hint: state.options.hint };
    next.touches = state.touches + 1;
    return next;
  }

  /** The applet's "Show names" and "Hint" checkboxes. */
  function setOption(state, name, on) {
    if (name !== "names" && name !== "hint") return state;
    if (state.options[name] === Boolean(on)) return state;
    const next = {};
    for (const n of HANDLE_NAMES) next[n] = copyPoint(state[n]);
    next.options = { names: state.options.names, hint: state.options.hint };
    next.options[name] = Boolean(on);
    next.touches = state.touches;
    return next;
  }

  /** Circles are given by a centre point and a point on the rim, as in MoveableCircle. */
  function inversionCircle(state) {
    return { center: copyPoint(state.O), radius: dist(state.O, state.S) };
  }

  function targetCircle(state) {
    return { center: copyPoint(state.P), radius: dist(state.P, state.R) };
  }

  /** The power of inversion may be negative; the applet itself always uses R^2. */
  function invertPoint(center, power, p) {
    const d2 = sqDist(center, p);
    if (!(d2 > 1e-12)) return null; // the centre has no image
    const k = power / d2;
    return { x: center.x + k * (p.x - center.x), y: center.y + k * (p.y - center.y) };
  }

  /*
   * InvLine.InvertCinC, transcribed from the bytecode. `power` is R^2 for the
   * applet; with a negative power it also covers the page's negative inversion.
   * d = |OP|^2 - r^2 is the power of O with respect to the target circle.
   */
  function invertCircle(center, power, target) {
    const r = target.radius;
    const d = sqDist(center, target.center) - r * r;
    if (Math.abs(d) > EPS) {
      const k = power / d;
      return {
        kind: "circle",
        center: { x: center.x + (target.center.x - center.x) * k,
                  y: center.y + (target.center.y - center.y) * k },
        radius: Math.abs(k) * r,
      };
    }
    // Circle through (or very nearly through) O: use the antipode of O on the
    // target circle, invert it, then take the tangent to the inversion circle.
    const antipode = { x: 2 * target.center.x - center.x, y: 2 * target.center.y - center.y };
    const q = invertPoint(center, power, antipode);
    if (!q) return { kind: "line", point: null, direction: null };
    return {
      kind: "line",
      point: q,
      direction: { x: 100 * (q.y - center.y), y: 100 * (center.x - q.x) },
    };
  }

  /** Intersections of a segment/line with a circle, as points on the line. */
  function lineCircleIntersections(a, b, circle) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const fx = a.x - circle.center.x;
    const fy = a.y - circle.center.y;
    const A = dx * dx + dy * dy;
    if (A < 1e-12) return [];
    const B = 2 * (fx * dx + fy * dy);
    const C0 = fx * fx + fy * fy - circle.radius * circle.radius;
    const disc = B * B - 4 * A * C0;
    if (disc < 0) return [];
    const s = Math.sqrt(disc);
    const t1 = (-B + s) / (2 * A);
    const t2 = (-B - s) / (2 * A);
    return [
      { x: a.x + t1 * dx, y: a.y + t1 * dy },
      { x: a.x + t2 * dx, y: a.y + t2 * dy },
    ];
  }

  /* AnglePropertyCanvas.Tangent: a segment of length r, centred at p, at
     right angles to the radius. The divisor is the Java `int 2` in the code. */
  function tangentEnds(p, circle) {
    const vx = (circle.center.y - p.y) / 2;
    const vy = (circle.center.x - p.x) / 2;
    return [{ x: p.x + vx, y: p.y - vy }, { x: p.x - vx, y: p.y + vy }];
  }

  /** The (undirected) angle between two lines, in degrees. */
  function angleBetween(v, w) {
    const nv = Math.hypot(v.x, v.y);
    const nw = Math.hypot(w.x, w.y);
    if (!(nv > 0 && nw > 0)) return NaN;
    const cos = Math.abs((v.x * w.x + v.y * w.y) / (nv * nw));
    return (Math.acos(clamp(cos, -1, 1)) * 180) / Math.PI;
  }

  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });

  /** Everything the page needs to draw, plus the two tangent-angle readings. */
  function geometry(state) {
    const inversion = inversionCircle(state);
    const target = targetCircle(state);
    const line = { a: copyPoint(state.O), b: copyPoint(state.T) };
    const power = inversion.radius * inversion.radius;
    const d = sqDist(inversion.center, target.center) - target.radius * target.radius;
    const image = invertCircle(inversion.center, power, target);
    const originalHits = lineCircleIntersections(line.a, line.b, target);
    const imageHits = image.kind === "circle"
      ? lineCircleIntersections(line.a, line.b, image)
      : [];
    const g = {
      inversion, target, image, line, power, d, originalHits, imageHits,
      pairs: [], angles: [], valid: false,
    };

    if (imageHits.length !== 2 || originalHits.length !== 2) return g;

    // Inversion swaps the near and far crossing of a line through O.
    const near = (ps) => ps.slice().sort((p, q) => dist(inversion.center, p) - dist(inversion.center, q));
    const a = near(originalHits);
    const b = near(imageHits).reverse();
    const u = sub(line.b, line.a);
    for (let i = 0; i < 2; i++) {
      const p = a[i];
      const q = b[i];
      const pTangent = sub(tangentEnds(p, target)[0], tangentEnds(p, target)[1]);
      const qTangent = sub(tangentEnds(q, image)[0], tangentEnds(q, image)[1]);
      g.pairs.push({ point: p, image: q });
      g.angles.push({
        original: angleBetween(pTangent, u),
        inverted: angleBetween(qTangent, u),
      });
    }
    g.valid = g.angles.every((pair) =>
      Number.isFinite(pair.original) && Number.isFinite(pair.inverted) &&
      Math.abs(pair.original - pair.inverted) < 1e-6);
    return g;
  }

  /** The plain-language line under the picture. */
  function status(state, g) {
    const info = g || geometry(state);
    if (info.image.kind === "line") {
      return "This circle goes through O, so its image is a straight line. " +
        "Move P or R away from O to bring the circle back.";
    }
    if (info.originalHits.length !== 2 || info.imageHits.length !== 2) {
      return "Move T until the line cuts both circles; then compare the two tangent angles.";
    }
    const a = info.angles[0];
    const b = info.angles[1];
    const fmt = (v) => v.toFixed(1).replace(/\.0$/, "");
    return `The tangent meets the line at ${fmt(a.original)}° on the green circle and ` +
      `${fmt(a.inverted)}° on its red image; at the other crossing it is ` +
      `${fmt(b.original)}° and ${fmt(b.inverted)}°. Drag any point: the two numbers stay equal.`;
  }

  /** An illustration: there is no win, loss or end. */
  function result(state) {
    return null;
  }

  return {
    VIEW, START, EPS, HANDLE_NAMES,
    start, moveVertex, setOption,
    inversionCircle, targetCircle,
    invertPoint, invertCircle, lineCircleIntersections, tangentEnds,
    angleBetween, dist, sqDist, geometry, status, result,
  };
})();
